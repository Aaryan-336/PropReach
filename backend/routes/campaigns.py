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
async def list_templates(refresh: bool = False):
    """Fetch available WhatsApp message templates. Pass ?refresh=true to clear cache."""
    try:
        if refresh:
            # Clear the cached templates so we fetch fresh from Meta
            sb = get_supabase()
            sb.table("settings").delete().eq("key", "templates_cache").execute()
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


@router.post("/{campaign_id}/rerun")
async def rerun_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Rerun a campaign:
    1. Verify campaign exists.
    2. Cancel any active scheduled job.
    3. Delete all message logs in `messages` table for this campaign.
    4. Reset campaign counters to 0.
    5. Launch the campaign again.
    """
    sb = get_supabase()

    # Verify campaign exists
    result = sb.table("campaigns").select("*").eq("id", campaign_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Check credentials are configured
    try:
        from services.whatsapp import get_credentials
        await get_credentials()
    except CredentialsNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Cancel scheduled job if any
    cancel_scheduled_campaign(campaign_id)

    # Delete message logs for this campaign
    sb.table("messages").delete().eq("campaign_id", campaign_id).execute()

    # Reset counters
    reset_data = {
        "status": "running",
        "sent_count": 0,
        "delivered_count": 0,
        "failed_count": 0,
        "reply_count": 0,
    }
    sb.table("campaigns").update(reset_data).eq("id", campaign_id).execute()

    # Run in background
    background_tasks.add_task(run_campaign, campaign_id)

    return SuccessResponse(message="Campaign rerun started — sending in background")


async def process_retry_failed(campaign_id: str):
    """Background task to sequentially retry all failed messages for a campaign."""
    sb = get_supabase()

    # Load campaign info
    camp_res = sb.table("campaigns").select("*").eq("id", campaign_id).execute()
    if not camp_res.data:
        logger.error(f"Campaign {campaign_id} not found during retry-failed background task")
        return
    campaign = camp_res.data[0]
    template_name = campaign.get("template_name", "")
    template_vars = campaign.get("template_vars", {})
    send_rate = campaign.get("send_rate", 1) or 1
    delay = 1.0 / send_rate

    # Load failed messages
    failed_msgs_res = (
        sb.table("messages")
        .select("*")
        .eq("campaign_id", campaign_id)
        .eq("status", "failed")
        .execute()
    )
    failed_msgs = failed_msgs_res.data or []
    if not failed_msgs:
        logger.info(f"No failed messages to retry for campaign {campaign_id}")
        return

    logger.info(f"Starting background retry of {len(failed_msgs)} failed messages for campaign {campaign_id}")

    from services.scheduler import build_message_variables
    from services.whatsapp import send_template_message_with_retry
    from services.supabase_client import increment_campaign_counter
    from datetime import datetime, timezone

    for msg in failed_msgs:
        msg_id = msg["id"]
        contact_id = msg["contact_id"]
        phone = msg["phone"]

        # Fetch contact details
        cont_res = sb.table("contacts").select("*").eq("id", contact_id).execute()
        if not cont_res.data:
            logger.warning(f"Contact {contact_id} not found for retry message {msg_id}")
            continue
        contact = cont_res.data[0]

        # Reset message state to pending in DB
        sb.table("messages").update({"status": "pending", "error_message": None}).eq("id", msg_id).execute()

        # Build variables
        variables, header_variables = build_message_variables(contact, template_vars)
        has_real_vars = any(v.strip() for v in variables) if variables else False
        has_real_header_vars = any(v.strip() for v in header_variables) if header_variables else False

        try:
            result = await send_template_message_with_retry(
                phone=phone,
                template_name=template_name,
                variables=variables if has_real_vars else None,
                header_variables=header_variables if has_real_header_vars else None,
            )

            if result["success"]:
                sb.table("messages").update({
                    "status": "sent",
                    "wa_message_id": result["wa_message_id"],
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "error_message": None
                }).eq("id", msg_id).execute()

                await increment_campaign_counter(campaign_id, "failed_count", -1)
                await increment_campaign_counter(campaign_id, "sent_count", 1)
            else:
                error_msg = result.get("error", "Unknown error")
                sb.table("messages").update({
                    "status": "failed",
                    "error_message": error_msg
                }).eq("id", msg_id).execute()
        except Exception as e:
            logger.error(f"Error retrying message {msg_id}: {e}")
            sb.table("messages").update({
                "status": "failed",
                "error_message": str(e)
            }).eq("id", msg_id).execute()

        # Rate limiting delay between retries
        await asyncio.sleep(delay)


@router.post("/{campaign_id}/retry-failed")
async def retry_campaign_failed(campaign_id: str, background_tasks: BackgroundTasks):
    """Trigger a background process to retry all failed messages of a campaign."""
    sb = get_supabase()

    # Verify campaign exists
    result = sb.table("campaigns").select("*").eq("id", campaign_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Check that there actually are failed messages
    failed_count_res = (
        sb.table("messages")
        .select("id", count="exact")
        .eq("campaign_id", campaign_id)
        .eq("status", "failed")
        .execute()
    )
    if not failed_count_res.count:
        return {"success": True, "message": "No failed messages found for this campaign"}

    # Start retry task in background
    background_tasks.add_task(process_retry_failed, campaign_id)

    return {"success": True, "message": f"Background retry started for {failed_count_res.count} failed messages"}


