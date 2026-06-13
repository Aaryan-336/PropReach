"""
Campaigns API — Create, launch, pause, resume, duplicate campaigns.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from auth import verify_api_key
from models import CampaignCreate, CampaignLaunch, SuccessResponse
from services.supabase_client import (
    get_supabase,
    get_contacts_by_group,
    get_all_contacts_unblocked,
    update_campaign_status,
)
from services.scheduler import run_campaign, schedule_campaign, cancel_scheduled_campaign
from services.whatsapp import get_templates, CredentialsNotConfigured

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/campaigns", tags=["Campaigns"], dependencies=[Depends(verify_api_key)])


@router.get("/templates/list")
async def list_templates():
    """Fetch available WhatsApp message templates."""
    try:
        templates = await get_templates()
        return {"templates": templates}
    except CredentialsNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch templates")


@router.get("")
async def list_campaigns(
    status: str | None = None,
    limit: int = 50,
):
    """List all campaigns, optionally filtered by status."""
    sb = get_supabase()
    query = sb.table("campaigns").select("*").order("created_at", desc=True).limit(limit)

    if status:
        query = query.eq("status", status)

    result = query.execute()
    return {"campaigns": result.data or []}


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str):
    """Get a single campaign with full details."""
    sb = get_supabase()
    result = sb.table("campaigns").select("*").eq("id", campaign_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return result.data[0]


@router.post("")
async def create_campaign(campaign: CampaignCreate):
    """Create a new campaign (draft status)."""
    sb = get_supabase()

    # Count contacts in the target group
    if campaign.contact_group and campaign.contact_group != "All":
        contacts = await get_contacts_by_group(campaign.contact_group)
    else:
        contacts = await get_all_contacts_unblocked()

    data = {
        "name": campaign.name,
        "template_name": campaign.template_name,
        "template_vars": campaign.template_vars,
        "contact_group": campaign.contact_group,
        "status": "draft",
        "scheduled_at": campaign.scheduled_at.isoformat() if campaign.scheduled_at else None,
        "total_contacts": len(contacts),
        "send_rate": campaign.send_rate,
    }

    result = sb.table("campaigns").insert(data).execute()

    return SuccessResponse(
        message="Campaign created",
        data=result.data[0] if result.data else None,
    )


@router.post("/{campaign_id}/launch")
async def launch_campaign(
    campaign_id: str,
    launch: CampaignLaunch | None = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Launch a campaign — either immediately or at a scheduled time.
    Once launched, it runs server-side. The phone can be locked.
    """
    sb = get_supabase()

    # Verify campaign exists
    result = sb.table("campaigns").select("*").eq("id", campaign_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign = result.data[0]
    if campaign["status"] not in ("draft", "paused"):
        raise HTTPException(
            status_code=400,
            detail=f"Campaign is {campaign['status']} — can only launch draft or paused campaigns",
        )

    # Check credentials are configured
    try:
        from services.whatsapp import get_credentials
        await get_credentials()
    except CredentialsNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Update send rate if provided
    if launch and launch.send_rate:
        sb.table("campaigns").update({"send_rate": launch.send_rate}).eq(
            "id", campaign_id
        ).execute()

    scheduled_at = None
    if launch and launch.scheduled_at:
        scheduled_at = launch.scheduled_at
    elif campaign.get("scheduled_at"):
        scheduled_at = datetime.fromisoformat(campaign["scheduled_at"])

    if scheduled_at and scheduled_at > datetime.now(timezone.utc):
        # Schedule for later
        await update_campaign_status(campaign_id, "draft")
        sb.table("campaigns").update(
            {"scheduled_at": scheduled_at.isoformat()}
        ).eq("id", campaign_id).execute()
        schedule_campaign(campaign_id, scheduled_at)
        return SuccessResponse(
            message=f"Campaign scheduled for {scheduled_at.strftime('%b %d, %Y %I:%M %p UTC')}"
        )
    else:
        # Launch immediately in background
        await update_campaign_status(campaign_id, "running")
        background_tasks.add_task(run_campaign, campaign_id)
        return SuccessResponse(message="Campaign launched — sending in background")


@router.post("/{campaign_id}/pause")
async def pause_campaign(campaign_id: str):
    """Pause a running campaign. Sends stop mid-send."""
    sb = get_supabase()
    result = sb.table("campaigns").select("status").eq("id", campaign_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if result.data[0]["status"] != "running":
        raise HTTPException(status_code=400, detail="Campaign is not running")

    await update_campaign_status(campaign_id, "paused")
    cancel_scheduled_campaign(campaign_id)
    return SuccessResponse(message="Campaign paused")


@router.post("/{campaign_id}/resume")
async def resume_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Resume a paused campaign."""
    sb = get_supabase()
    result = sb.table("campaigns").select("status").eq("id", campaign_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if result.data[0]["status"] != "paused":
        raise HTTPException(status_code=400, detail="Campaign is not paused")

    await update_campaign_status(campaign_id, "running")
    background_tasks.add_task(run_campaign, campaign_id)
    return SuccessResponse(message="Campaign resumed")


@router.post("/{campaign_id}/duplicate")
async def duplicate_campaign(campaign_id: str):
    """Duplicate an existing campaign as a new draft."""
    sb = get_supabase()
    result = sb.table("campaigns").select("*").eq("id", campaign_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    original = result.data[0]
    new_campaign = {
        "name": f"{original['name']} (Copy)",
        "template_name": original.get("template_name"),
        "template_vars": original.get("template_vars", {}),
        "contact_group": original.get("contact_group"),
        "status": "draft",
        "total_contacts": original.get("total_contacts", 0),
    }

    new_result = sb.table("campaigns").insert(new_campaign).execute()

    return SuccessResponse(
        message="Campaign duplicated",
        data=new_result.data[0] if new_result.data else None,
    )


