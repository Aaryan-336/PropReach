"""
WhatsApp Cloud API service.
Reads credentials from the Supabase `settings` table (one-time setup).
Handles sending template messages, fetching templates, and rate limiting.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx

from services.supabase_client import get_all_settings, get_supabase

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"

# In-memory cache for credentials
_creds_cache: dict[str, str] = {}
_creds_cache_time: float = 0
_CACHE_TTL = 300  # 5 minutes


class CredentialsNotConfigured(Exception):
    """Raised when WhatsApp API credentials have not been set up yet."""
    pass


async def get_credentials() -> dict[str, str]:
    """
    Load WhatsApp credentials from Supabase settings table.
    Cached in memory for 5 minutes to avoid repeated DB calls.
    """
    global _creds_cache, _creds_cache_time

    if _creds_cache and (time.time() - _creds_cache_time) < _CACHE_TTL:
        return _creds_cache

    settings = await get_all_settings()
    waba_id = settings.get("waba_id")
    phone_number_id = settings.get("phone_number_id")
    access_token = settings.get("access_token")

    if not all([waba_id, phone_number_id, access_token]):
        raise CredentialsNotConfigured(
            "WhatsApp API credentials not configured. "
            "Go to Settings and enter your WABA ID, Phone Number ID, and Access Token."
        )

    _creds_cache = {
        "waba_id": waba_id,
        "phone_number_id": phone_number_id,
        "access_token": access_token,
    }
    _creds_cache_time = time.time()
    return _creds_cache


def clear_credentials_cache():
    """Clear the cached credentials (call when settings are updated)."""
    global _creds_cache, _creds_cache_time
    _creds_cache = {}
    _creds_cache_time = 0


async def send_template_message(
    phone: str,
    template_name: str,
    language_code: str = "en",
    variables: list[str] | None = None,
) -> dict:
    """
    Send a WhatsApp template message to a single phone number.

    Args:
        phone: Phone number in international format (e.g. "919876543210")
        template_name: Name of the approved template
        language_code: Template language code
        variables: List of variable values for template placeholders

    Returns:
        Meta API response dict with message ID on success
    """
    creds = await get_credentials()

    url = f"{GRAPH_API_BASE}/{creds['phone_number_id']}/messages"
    headers = {
        "Authorization": f"Bearer {creds['access_token']}",
        "Content-Type": "application/json",
    }

    # Build template components with variables
    components = []
    if variables:
        parameters = [
            {"type": "text", "text": var} for var in variables
        ]
        components.append({
            "type": "body",
            "parameters": parameters,
        })

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        },
    }

    if components:
        payload["template"]["components"] = components

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload, headers=headers)
            data = response.json()

            if response.status_code == 200 and "messages" in data:
                wa_message_id = data["messages"][0]["id"]
                logger.info(f"Message sent to {phone}: {wa_message_id}")
                return {
                    "success": True,
                    "wa_message_id": wa_message_id,
                }
            else:
                error_msg = data.get("error", {}).get("message", "Unknown error")
                logger.error(f"Failed to send to {phone}: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                }

    except httpx.TimeoutException:
        logger.error(f"Timeout sending to {phone}")
        return {"success": False, "error": "Request timed out"}
    except Exception as e:
        logger.error(f"Exception sending to {phone}: {str(e)}")
        return {"success": False, "error": str(e)}


async def send_template_message_with_retry(
    phone: str,
    template_name: str,
    language_code: str = "en",
    variables: list[str] | None = None,
    retry_delay: int = 60,
) -> dict:
    """Send a template message with one automatic retry on failure."""
    result = await send_template_message(phone, template_name, language_code, variables)
    if not result["success"]:
        logger.info(f"Retrying send to {phone} in {retry_delay}s...")
        await asyncio.sleep(retry_delay)
        result = await send_template_message(phone, template_name, language_code, variables)
    return result


async def get_templates() -> list[dict]:
    """
    Fetch approved message templates from Meta.
    Results are cached in Supabase for 1 hour.
    """
    sb = get_supabase()

    # Check cache first
    cache_result = (
        sb.table("settings")
        .select("value, updated_at")
        .eq("key", "templates_cache")
        .execute()
    )

    if cache_result.data and len(cache_result.data) > 0:
        import json
        cached = cache_result.data[0]
        updated_at = datetime.fromisoformat(cached["updated_at"].replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - updated_at).total_seconds()
        if age < 3600:  # 1 hour cache
            return json.loads(cached["value"])

    # Fetch from Meta API
    creds = await get_credentials()
    url = f"{GRAPH_API_BASE}/{creds['waba_id']}/message_templates"
    headers = {"Authorization": f"Bearer {creds['access_token']}"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers)
            data = response.json()

            templates = data.get("data", [])

            # Cache in Supabase
            import json
            sb.table("settings").upsert(
                {
                    "key": "templates_cache",
                    "value": json.dumps(templates),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="key",
            ).execute()

            return templates

    except Exception as e:
        logger.error(f"Failed to fetch templates: {e}")
        # Return cached data if available, even if stale
        if cache_result.data:
            import json
            return json.loads(cache_result.data[0]["value"])
        return []


async def test_connection() -> dict:
    """
    Test the WhatsApp API connection by calling the WABA endpoint.
    Returns success status and account info.
    """
    try:
        creds = await get_credentials()
    except CredentialsNotConfigured as e:
        return {"success": False, "message": str(e)}

    url = f"{GRAPH_API_BASE}/{creds['waba_id']}"
    headers = {"Authorization": f"Bearer {creds['access_token']}"}
    params = {"fields": "name,id,message_template_namespace"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, headers=headers, params=params)
            data = response.json()

            if response.status_code == 200 and "name" in data:
                return {
                    "success": True,
                    "message": "Connected successfully",
                    "account_name": data.get("name"),
                }
            else:
                error_msg = data.get("error", {}).get("message", "Connection failed")
                return {"success": False, "message": error_msg}

    except httpx.TimeoutException:
        return {"success": False, "message": "Connection timed out"}
    except Exception as e:
        return {"success": False, "message": str(e)}
