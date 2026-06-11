"""
Supabase client initialisation and common DB helper functions.
Uses the service-role key for full access (this is a private internal tool).
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from supabase import create_client, Client

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return a cached Supabase client instance."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
    return create_client(url, key)


# ── Settings helpers ─────────────────────────────────


async def get_setting(key: str) -> str | None:
    """Get a single setting value by key."""
    sb = get_supabase()
    result = sb.table("settings").select("value").eq("key", key).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]["value"]
    return None


async def upsert_setting(key: str, value: str) -> None:
    """Insert or update a setting."""
    sb = get_supabase()
    sb.table("settings").upsert(
        {"key": key, "value": value},
        on_conflict="key",
    ).execute()


async def get_all_settings() -> dict[str, str]:
    """Get all settings as a dict."""
    sb = get_supabase()
    result = sb.table("settings").select("key, value").execute()
    return {row["key"]: row["value"] for row in (result.data or [])}


# ── Contact helpers ──────────────────────────────────


async def get_contacts_by_group(group_name: str) -> list[dict]:
    """Fetch all non-blocked contacts in a group."""
    sb = get_supabase()
    result = (
        sb.table("contacts")
        .select("*")
        .eq("group_name", group_name)
        .eq("is_blocked", False)
        .execute()
    )
    return result.data or []


async def get_all_contacts_unblocked() -> list[dict]:
    """Fetch all non-blocked contacts."""
    sb = get_supabase()
    result = (
        sb.table("contacts")
        .select("*")
        .eq("is_blocked", False)
        .execute()
    )
    return result.data or []


async def find_contact_by_phone(phone: str) -> dict | None:
    """Lookup a contact by phone number."""
    sb = get_supabase()
    result = sb.table("contacts").select("*").eq("phone", phone).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


# ── Campaign helpers ─────────────────────────────────


async def update_campaign_status(campaign_id: str, status: str) -> None:
    """Update the status field of a campaign."""
    sb = get_supabase()
    sb.table("campaigns").update({"status": status}).eq("id", campaign_id).execute()


async def increment_campaign_counter(campaign_id: str, field: str, amount: int = 1) -> None:
    """
    Increment a campaign counter (sent_count, delivered_count, etc.).
    Uses a select-then-update pattern since Supabase doesn't support atomic increment.
    """
    sb = get_supabase()
    result = sb.table("campaigns").select(field).eq("id", campaign_id).execute()
    if result.data:
        current = result.data[0].get(field, 0) or 0
        sb.table("campaigns").update({field: current + amount}).eq("id", campaign_id).execute()


# ── Message helpers ──────────────────────────────────


async def insert_message(message_data: dict) -> dict:
    """Insert a message record and return it."""
    sb = get_supabase()
    result = sb.table("messages").insert(message_data).execute()
    return result.data[0] if result.data else {}


async def update_message_status(
    wa_message_id: str,
    status: str,
    timestamp_field: str | None = None,
    timestamp_value: str | None = None,
) -> None:
    """Update message status by WhatsApp message ID."""
    sb = get_supabase()
    update_data: dict = {"status": status}
    if timestamp_field and timestamp_value:
        update_data[timestamp_field] = timestamp_value
    sb.table("messages").update(update_data).eq("wa_message_id", wa_message_id).execute()


# ── Reply helpers ────────────────────────────────────


async def insert_reply(reply_data: dict) -> dict:
    """Insert a reply record."""
    sb = get_supabase()
    result = sb.table("replies").insert(reply_data).execute()
    return result.data[0] if result.data else {}
