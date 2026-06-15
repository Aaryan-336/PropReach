"""
Messages API — Query message logs and get dashboard stats.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import verify_api_key
from models import DashboardStats, DailyMessageStats
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messages", tags=["Messages"], dependencies=[Depends(verify_api_key)])


@router.get("")
async def list_messages(
    campaign_id: Optional[str] = None,
    contact_id: Optional[str] = None,
    direction: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Query message logs with optional filters."""
    sb = get_supabase()
    query = sb.table("messages").select("*", count="exact")

    if campaign_id:
        query = query.eq("campaign_id", campaign_id)
    if contact_id:
        query = query.eq("contact_id", contact_id)
    if direction:
        query = query.eq("direction", direction)

    query = query.order("created_at", desc=True)

    start = (page - 1) * page_size
    end = start + page_size - 1
    query = query.range(start, end)

    result = query.execute()
    items = result.data or []

    # Enrich with contact names
    if items:
        contact_ids = [r["contact_id"] for r in items if r.get("contact_id")]
        if contact_ids:
            contacts_result = sb.table("contacts").select("id, name").in_("id", contact_ids).execute()
            contact_map = {c["id"]: c["name"] for c in (contacts_result.data or [])}
            for item in items:
                item["contact_name"] = contact_map.get(item.get("contact_id"))

    return {
        "items": items,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/stats")
async def get_dashboard_stats():
    """
    Aggregated stats for the dashboard:
    - Total contacts, active campaigns, messages sent this month, reply rate
    - Daily message breakdown for the last 14 days
    """
    sb = get_supabase()

    # Total contacts
    contacts_result = sb.table("contacts").select("id", count="exact").eq("is_blocked", False).execute()
    total_contacts = contacts_result.count or 0

    # Active campaigns (running status)
    campaigns_result = (
        sb.table("campaigns").select("id", count="exact").eq("status", "running").execute()
    )
    active_campaigns = campaigns_result.count or 0

    # Messages sent this month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    msgs_month = (
        sb.table("messages")
        .select("id", count="exact")
        .eq("direction", "outbound")
        .gte("created_at", month_start.isoformat())
        .execute()
    )
    messages_this_month = msgs_month.count or 0

    # Reply rate (replies / outbound messages)
    total_outbound = (
        sb.table("messages")
        .select("id", count="exact")
        .eq("direction", "outbound")
        .execute()
    )
    total_replies = (
        sb.table("replies")
        .select("id", count="exact")
        .execute()
    )
    outbound_count = total_outbound.count or 0
    reply_count = total_replies.count or 0
    reply_rate = round((reply_count / outbound_count * 100), 1) if outbound_count > 0 else 0

    # Daily stats for last 14 days
    fourteen_days_ago = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    daily_messages = (
        sb.table("messages")
        .select("status, created_at")
        .eq("direction", "outbound")
        .gte("created_at", fourteen_days_ago)
        .execute()
    )

    # Aggregate by day
    daily_map: dict[str, dict[str, int]] = {}
    for msg in (daily_messages.data or []):
        if msg.get("created_at"):
            day = msg["created_at"][:10]
            if day not in daily_map:
                daily_map[day] = {"sent": 0, "delivered": 0, "failed": 0}
            status = msg.get("status", "")
            if status in ("sent", "delivered", "read"):
                daily_map[day]["sent"] += 1
            if status in ("delivered", "read"):
                daily_map[day]["delivered"] += 1
            if status == "failed":
                daily_map[day]["failed"] += 1

    # Fill in missing days
    daily_stats = []
    for i in range(13, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        stats = daily_map.get(day, {"sent": 0, "delivered": 0, "failed": 0})
        daily_stats.append(DailyMessageStats(date=day, **stats))

    return DashboardStats(
        total_contacts=total_contacts,
        active_campaigns=active_campaigns,
        messages_sent_this_month=messages_this_month,
        reply_rate=reply_rate,
        daily_stats=daily_stats,
    )


@router.get("/replies")
async def list_replies(
    label: Optional[str] = None,
    is_read: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List replies with optional label and read status filters."""
    sb = get_supabase()
    query = sb.table("replies").select("*", count="exact")

    if label:
        query = query.eq("label", label)
    if is_read is not None:
        query = query.eq("is_read", is_read)

    query = query.order("received_at", desc=True)

    start = (page - 1) * page_size
    end = start + page_size - 1
    query = query.range(start, end)

    result = query.execute()

    # Enrich with contact names
    items = result.data or []
    if items:
        contact_ids = [r["contact_id"] for r in items if r.get("contact_id")]
        if contact_ids:
            contacts_result = sb.table("contacts").select("id, name").in_("id", contact_ids).execute()
            contact_map = {c["id"]: c["name"] for c in (contacts_result.data or [])}
            for item in items:
                item["contact_name"] = contact_map.get(item.get("contact_id"))

    return {
        "items": items,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/replies/{reply_id}")
async def update_reply(reply_id: str, label: Optional[str] = None, agent_note: Optional[str] = None, is_read: Optional[bool] = None):
    """Update a reply's label, note, or read status."""
    sb = get_supabase()

    update_data = {}
    if label is not None:
        update_data["label"] = label
    if agent_note is not None:
        update_data["agent_note"] = agent_note
    if is_read is not None:
        update_data["is_read"] = is_read

    if not update_data:
        return {"message": "Nothing to update"}

    sb.table("replies").update(update_data).eq("id", reply_id).execute()
    return {"message": "Reply updated", "success": True}


@router.post("/{message_id}/retry")
async def retry_message(message_id: str):
    """Retry sending a failed message."""
    sb = get_supabase()

    # 1. Fetch message
    msg_res = sb.table("messages").select("*").eq("id", message_id).execute()
    if not msg_res.data:
        raise HTTPException(status_code=404, detail="Message not found")
    msg = msg_res.data[0]

    if msg.get("status") != "failed":
        raise HTTPException(status_code=400, detail="Only failed messages can be retried")

    campaign_id = msg.get("campaign_id")
    contact_id = msg.get("contact_id")

    if not campaign_id or not contact_id:
        raise HTTPException(status_code=400, detail="Message lacks valid campaign or contact references")

    # 2. Fetch campaign and contact
    camp_res = sb.table("campaigns").select("*").eq("id", campaign_id).execute()
    if not camp_res.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign = camp_res.data[0]

    cont_res = sb.table("contacts").select("*").eq("id", contact_id).execute()
    if not cont_res.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact = cont_res.data[0]

    # 3. Build variables using the helper function
    from services.scheduler import build_message_variables
    template_name = campaign.get("template_name", "")
    template_vars = campaign.get("template_vars", {})
    variables, header_variables = build_message_variables(contact, template_vars)

    has_real_vars = any(v.strip() for v in variables) if variables else False
    has_real_header_vars = any(v.strip() for v in header_variables) if header_variables else False

    # 4. Attempt send
    from services.whatsapp import send_template_message_with_retry
    from datetime import datetime, timezone
    
    # Reset status in DB to pending first (so it doesn't show failed during transit)
    sb.table("messages").update({"status": "pending", "error_message": None}).eq("id", message_id).execute()

    try:
        result = await send_template_message_with_retry(
            phone=contact["phone"],
            template_name=template_name,
            variables=variables if has_real_vars else None,
            header_variables=header_variables if has_real_header_vars else None,
        )

        if result["success"]:
            # Update message status to sent
            sb.table("messages").update({
                "status": "sent",
                "wa_message_id": result["wa_message_id"],
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "error_message": None
            }).eq("id", message_id).execute()

            # Decrement failed count and increment sent count
            from services.supabase_client import increment_campaign_counter
            await increment_campaign_counter(campaign_id, "failed_count", -1)
            await increment_campaign_counter(campaign_id, "sent_count", 1)

            return {"success": True, "message": "Message sent successfully"}
        else:
            error_msg = result.get("error", "Unknown error")
            sb.table("messages").update({
                "status": "failed",
                "error_message": error_msg
            }).eq("id", message_id).execute()
            
            raise HTTPException(status_code=400, detail=f"Meta API Error: {error_msg}")

    except Exception as e:
        error_str = str(e)
        sb.table("messages").update({
            "status": "failed",
            "error_message": error_str
        }).eq("id", message_id).execute()
        raise HTTPException(status_code=500, detail=f"Retry execution failed: {error_str}")
