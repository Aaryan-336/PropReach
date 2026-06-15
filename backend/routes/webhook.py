"""
WhatsApp webhook receiver.
- GET  /webhook/whatsapp  →  Meta verification challenge
- POST /webhook/whatsapp  →  Incoming messages + status updates
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, Query

from services.supabase_client import (
    get_supabase,
    find_contact_by_phone,
    update_message_status,
    insert_reply,
    increment_campaign_counter,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhook"])

# Keywords that trigger auto-block
BLOCK_KEYWORDS = {"stop", "unsubscribe", "opt out", "opt-out", "block", "remove"}


def verify_signature(payload: bytes, signature: str) -> bool:
    """Validate Meta's X-Hub-Signature-256 HMAC."""
    app_secret = os.getenv("META_APP_SECRET", "")
    if not app_secret:
        logger.warning("META_APP_SECRET not set — skipping signature verification")
        return True

    expected = hmac.new(
        app_secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(f"sha256={expected}", signature)


@router.get("/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Meta webhook verification endpoint.
    Called once when you register the webhook in Meta Developer Console.
    """
    verify_token = os.getenv("WEBHOOK_VERIFY_TOKEN", "")

    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("Webhook verified successfully")
        return int(hub_challenge)

    logger.warning(f"Webhook verification failed: mode={hub_mode}")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp")
async def receive_webhook(request: Request):
    """
    Process incoming webhook events from Meta WhatsApp Cloud API.
    Handles:
    - Message status updates (sent, delivered, read, failed)
    - Inbound messages (text replies from contacts)
    """
    body = await request.body()

    # Log raw webhook payload for diagnostics
    logger.info(f"Webhook received: {len(body)} bytes")

    # Verify HMAC signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    if signature and not verify_signature(body, signature):
        logger.warning("Invalid webhook signature — rejecting request")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    logger.info(f"Webhook payload: {json.dumps(data)}")

    # Process each entry
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})

            # Handle message status updates
            statuses = value.get("statuses", [])
            if statuses:
                logger.info(f"Processing {len(statuses)} status update(s)")
            for status_update in statuses:
                await _handle_status_update(status_update)

            # Handle inbound messages
            messages = value.get("messages", [])
            if messages:
                logger.info(f"Processing {len(messages)} inbound message(s)")
            for message in messages:
                await _handle_inbound_message(message, value)

    return {"status": "ok"}


async def _handle_status_update(status_update: dict):
    """Process a message status change (sent/delivered/read/failed)."""
    wa_message_id = status_update.get("id")
    status = status_update.get("status")
    timestamp = status_update.get("timestamp")

    logger.info(f"Status update received: id={wa_message_id}, status={status}, raw={json.dumps(status_update)}")

    if not wa_message_id or not status:
        logger.warning(f"Ignoring status update with missing id or status: {status_update}")
        return

    ts = None
    if timestamp:
        ts = datetime.fromtimestamp(int(timestamp), tz=timezone.utc).isoformat()

    # Map status to timestamp field
    ts_field_map = {
        "sent": ("sent_at", ts),
        "delivered": ("delivered_at", ts),
        "read": ("read_at", ts),
    }

    ts_field, ts_value = ts_field_map.get(status, (None, None))

    try:
        # Update the message status in the database
        await update_message_status(wa_message_id, status, ts_field, ts_value)

        # Look up the campaign this message belongs to
        sb = get_supabase()
        msg_result = (
            sb.table("messages")
            .select("campaign_id, status")
            .eq("wa_message_id", wa_message_id)
            .execute()
        )

        if not msg_result.data:
            logger.warning(f"No message found in DB for wa_message_id={wa_message_id}")
        else:
            campaign_id = msg_result.data[0].get("campaign_id")
            logger.info(f"Message {wa_message_id} belongs to campaign {campaign_id}, DB status now: {msg_result.data[0].get('status')}")

            if campaign_id:
                # Update campaign counters based on status
                if status == "delivered":
                    await increment_campaign_counter(campaign_id, "delivered_count")
                    logger.info(f"Incremented delivered_count for campaign {campaign_id}")
                elif status == "failed":
                    # Extract error details from Meta's payload if available
                    errors = status_update.get("errors", [])
                    error_msg = errors[0].get("title", "Unknown error") if errors else "Unknown error"
                    logger.warning(f"Message {wa_message_id} failed: {error_msg}")

        logger.info(f"Status update processed: {wa_message_id} → {status}")

    except Exception as e:
        logger.error(f"Error processing status update for {wa_message_id}: {e}", exc_info=True)


async def _handle_inbound_message(message: dict, value: dict):
    """Process an incoming message from a contact."""
    msg_type = message.get("type")
    phone = message.get("from", "")
    wa_message_id = message.get("id")
    timestamp = message.get("timestamp")

    # Extract text content
    text = ""
    if msg_type == "text":
        text = message.get("text", {}).get("body", "")
    elif msg_type == "button":
        text = message.get("button", {}).get("text", "")
    elif msg_type == "interactive":
        interactive = message.get("interactive", {})
        if "button_reply" in interactive:
            text = interactive["button_reply"].get("title", "")
        elif "list_reply" in interactive:
            text = interactive["list_reply"].get("title", "")
    else:
        text = f"[{msg_type} message]"

    # Find or note contact
    contact = await find_contact_by_phone(phone)
    contact_id = contact["id"] if contact else None
    contact_name = contact.get("name") if contact else None

    # Check for block keywords
    if text.lower().strip() in BLOCK_KEYWORDS:
        if contact:
            sb = get_supabase()
            sb.table("contacts").update({"is_blocked": True}).eq(
                "id", contact["id"]
            ).execute()
            logger.info(f"Auto-blocked contact {phone} (keyword: {text})")

    # Save as reply
    received_at = None
    if timestamp:
        received_at = datetime.fromtimestamp(int(timestamp), tz=timezone.utc).isoformat()

    reply_data = {
        "contact_id": contact_id,
        "phone": phone,
        "message_text": text,
        "wa_message_id": wa_message_id,
        "is_read": False,
        "label": "new",
    }
    if received_at:
        reply_data["received_at"] = received_at

    try:
        await insert_reply(reply_data)
        logger.info(f"Saved reply from {phone}: {text[:50]}...")

        # Also save as inbound message
        from services.supabase_client import insert_message
        msg_data = {
            "contact_id": contact_id,
            "phone": phone,
            "direction": "inbound",
            "content": text,
            "wa_message_id": wa_message_id,
            "status": "delivered",
        }
        if received_at:
            msg_data["delivered_at"] = received_at
        await insert_message(msg_data)

        # Update reply_count on related campaigns
        if contact_id:
            sb = get_supabase()
            campaigns = (
                sb.table("messages")
                .select("campaign_id")
                .eq("contact_id", contact_id)
                .eq("direction", "outbound")
                .execute()
            )
            seen_campaigns = set()
            for msg in (campaigns.data or []):
                cid = msg.get("campaign_id")
                if cid and cid not in seen_campaigns:
                    seen_campaigns.add(cid)
                    await increment_campaign_counter(cid, "reply_count")

    except Exception as e:
        logger.error(f"Error saving inbound message from {phone}: {e}")
