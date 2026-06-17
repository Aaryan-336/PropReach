"""
APScheduler service for running campaigns at scheduled times.
The scheduler runs server-side — the user's phone does NOT need to stay open.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore

from services.supabase_client import (
    get_supabase,
    get_contacts_by_group,
    get_all_contacts_unblocked,
    update_campaign_status,
    increment_campaign_counter,
    insert_message,
)
from services.whatsapp import send_template_message_with_retry

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler(
    jobstores={"default": MemoryJobStore()},
    job_defaults={"coalesce": True, "max_instances": 3},
)


def start_scheduler():
    """Start the APScheduler (call on app startup)."""
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")


def shutdown_scheduler():
    """Gracefully shut down the scheduler (call on app shutdown)."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")


def build_message_variables(contact: dict, template_vars: dict) -> tuple[list[str], list[str]]:
    """Helper to parse template_vars into sorted lists of body and header variables."""
    body_vars_map = {}
    header_vars_map = {}

    if template_vars:
        for k, field_name in template_vars.items():
            # If the value is a URL (starts with http), use it directly
            # instead of looking it up as a contact field name.
            # This handles media header URLs (e.g., header_1: "https://example.com/img.jpg")
            if isinstance(field_name, str) and (
                field_name.startswith("http://") or field_name.startswith("https://")
            ):
                val_str = field_name
            else:
                value = contact.get(field_name, "")
                if not value and contact.get("custom_fields"):
                    value = contact["custom_fields"].get(field_name, "")
                val_str = str(value) if value else ""

            if k.startswith("header_"):
                try:
                    num = int(k.replace("header_", ""))
                    header_vars_map[num] = val_str
                except ValueError:
                    pass
            else:
                try:
                    num = int(k)
                    body_vars_map[num] = val_str
                except ValueError:
                    pass

    variables = [body_vars_map[k] for k in sorted(body_vars_map.keys())]
    header_variables = [header_vars_map[k] for k in sorted(header_vars_map.keys())]
    return variables, header_variables


async def run_campaign(campaign_id: str):
    """
    Execute a campaign: iterate contacts, send messages, track results.
    This runs as a background job — phone doesn't need to be on.
    """
    sb = get_supabase()

    # Load campaign
    result = sb.table("campaigns").select("*").eq("id", campaign_id).execute()
    if not result.data:
        logger.error(f"Campaign {campaign_id} not found")
        return

    campaign = result.data[0]

    # Check if campaign was paused or cancelled
    if campaign["status"] not in ("running", "draft"):
        logger.info(f"Campaign {campaign_id} is {campaign['status']}, skipping")
        return

    # Update status to running
    await update_campaign_status(campaign_id, "running")

    # Get contacts
    group = campaign.get("contact_group")
    if group and group != "All":
        contacts = await get_contacts_by_group(group)
    else:
        contacts = await get_all_contacts_unblocked()

    # Update total contacts
    sb.table("campaigns").update({"total_contacts": len(contacts)}).eq(
        "id", campaign_id
    ).execute()

    template_name = campaign.get("template_name", "")
    template_vars = campaign.get("template_vars", {})
    send_rate = campaign.get("send_rate", 1) or 1
    # Use cooldown_seconds if set, otherwise fall back to 1/send_rate for backwards compat
    cooldown = campaign.get("cooldown_seconds")
    if cooldown is not None:
        delay = float(cooldown)
    else:
        delay = 1.0 / send_rate

    logger.info(
        f"Starting campaign {campaign_id}: {len(contacts)} contacts, "
        f"template={template_name}, rate={send_rate}/s"
    )

    for contact in contacts:
        # Re-check campaign status (support pause mid-send)
        status_check = (
            sb.table("campaigns").select("status").eq("id", campaign_id).execute()
        )
        if status_check.data and status_check.data[0]["status"] == "paused":
            logger.info(f"Campaign {campaign_id} paused, stopping sends")
            return

        phone = contact["phone"]
        contact_id = contact["id"]

        # Build variables from contact fields
        variables, header_variables = build_message_variables(contact, template_vars)

        has_real_vars = any(v.strip() for v in variables) if variables else False
        has_real_header_vars = any(v.strip() for v in header_variables) if header_variables else False

        # Insert message record as pending
        msg_data = {
            "campaign_id": campaign_id,
            "contact_id": contact_id,
            "phone": phone,
            "direction": "outbound",
            "content": f"Template: {template_name}",
            "status": "pending",
        }
        msg = await insert_message(msg_data)

        # Send the message
        try:
            result = await send_template_message_with_retry(
                phone=phone,
                template_name=template_name,
                variables=variables if has_real_vars else None,
                header_variables=header_variables if has_real_header_vars else None,
            )

            if result["success"]:
                sb.table("messages").update(
                    {
                        "status": "sent",
                        "wa_message_id": result["wa_message_id"],
                        "sent_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("id", msg["id"]).execute()
                await increment_campaign_counter(campaign_id, "sent_count")
            else:
                sb.table("messages").update(
                    {
                        "status": "failed",
                        "error_message": result.get("error", "Unknown error"),
                    }
                ).eq("id", msg["id"]).execute()
                await increment_campaign_counter(campaign_id, "failed_count")

        except Exception as e:
            logger.error(f"Error sending to {phone}: {e}")
            sb.table("messages").update(
                {"status": "failed", "error_message": str(e)}
            ).eq("id", msg["id"]).execute()
            await increment_campaign_counter(campaign_id, "failed_count")

        # Rate limiting delay
        await asyncio.sleep(delay)

    # Mark campaign complete
    await update_campaign_status(campaign_id, "completed")
    logger.info(f"Campaign {campaign_id} completed")


def schedule_campaign(campaign_id: str, run_at: datetime):
    """Schedule a campaign to run at a specific time."""
    scheduler.add_job(
        run_campaign,
        "date",
        run_date=run_at,
        args=[campaign_id],
        id=f"campaign_{campaign_id}",
        replace_existing=True,
    )
    logger.info(f"Campaign {campaign_id} scheduled for {run_at}")


def cancel_scheduled_campaign(campaign_id: str):
    """Cancel a scheduled campaign job."""
    job_id = f"campaign_{campaign_id}"
    try:
        scheduler.remove_job(job_id)
        logger.info(f"Cancelled scheduled campaign {campaign_id}")
    except Exception:
        logger.warning(f"No scheduled job found for campaign {campaign_id}")
