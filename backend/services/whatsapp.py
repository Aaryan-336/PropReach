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
    header_variables: list[str] | None = None,
) -> dict:
    """
    Send a WhatsApp template message to a single phone number.

    Args:
        phone: Phone number in international format (e.g. "919876543210")
        template_name: Name of the approved template
        language_code: Template language code
        variables: List of variable values for BODY template placeholders
        header_variables: List of variable values for HEADER template placeholders

    Returns:
        Meta API response dict with message ID on success
    """
    creds = await get_credentials()

    url = f"{GRAPH_API_BASE}/{creds['phone_number_id']}/messages"
    headers = {
        "Authorization": f"Bearer {creds['access_token']}",
        "Content-Type": "application/json",
    }

    # Fetch template structure to ensure correct payload format
    import json
    import re

    template_meta = None
    try:
        tpl_url = f"{GRAPH_API_BASE}/{creds['waba_id']}/message_templates"
        tpl_headers = {"Authorization": f"Bearer {creds['access_token']}"}
        tpl_params = {"name": template_name}
        async with httpx.AsyncClient(timeout=10) as client:
            tpl_res = await client.get(tpl_url, headers=tpl_headers, params=tpl_params)
            tpl_data = tpl_res.json()
            # User explicitly requested to print the full response to console/logs
            print(f"--- Meta API Template Lookup for '{template_name}': ---")
            print(json.dumps(tpl_data, indent=2))
            logger.info(f"Meta template lookup for {template_name}: {json.dumps(tpl_data)}")
            if tpl_res.status_code == 200 and tpl_data.get("data"):
                # Find matching template name in data (usually the first one)
                for item in tpl_data["data"]:
                    if item.get("name") == template_name:
                        template_meta = item
                        break
    except Exception as e:
        logger.error(f"Failed to fetch template structure for '{template_name}': {e}")

    # Build template components with variables dynamically based on template spec
    components = []

    if template_meta and "components" in template_meta:
        for comp in template_meta["components"]:
            comp_type = comp.get("type", "").lower()
            
            if comp_type == "header":
                header_format = comp.get("format", "").upper()
                
                if header_format in ("IMAGE", "VIDEO", "DOCUMENT"):
                    # Media header — Meta REQUIRES this component for templates
                    # with media headers. The user must provide a valid public URL.
                    # (Meta's template header_handle is only for template creation,
                    #  not usable as a link or media id for sending messages.)
                    media_key = header_format.lower()
                    user_url = None
                    if header_variables and len(header_variables) > 0 and header_variables[0].strip():
                        candidate = header_variables[0].strip()
                        if candidate.startswith("http://") or candidate.startswith("https://"):
                            user_url = candidate

                    if user_url:
                        components.append({
                            "type": "header",
                            "parameters": [{
                                "type": media_key,
                                media_key: {"link": user_url}
                            }]
                        })
                        logger.info(f"Using URL for {header_format} header: {user_url}")
                    else:
                        logger.warning(
                            f"Template '{template_name}' has {header_format} header but no "
                            f"valid URL was provided — message will likely fail. "
                            f"Set the header image URL in campaign settings."
                        )
                elif header_format == "TEXT":
                    text = comp.get("text", "")
                    placeholders = re.findall(r"\{\{(\d+)\}\}", text)
                    if placeholders:
                        params = []
                        for idx, p in enumerate(placeholders):
                            val = ""
                            if header_variables and idx < len(header_variables):
                                val = header_variables[idx]
                            if not val.strip():
                                # Try falling back to example header text
                                examples = comp.get("example", {}).get("header_text", [])
                                if examples and idx < len(examples):
                                    val = examples[idx]
                            params.append({"type": "text", "text": val or "Lead"})
                        components.append({
                            "type": "header",
                            "parameters": params
                        })
            elif comp_type == "body":
                text = comp.get("text", "")
                placeholders = re.findall(r"\{\{(\d+)\}\}", text)
                if placeholders:
                    params = []
                    for idx, p in enumerate(placeholders):
                        val = ""
                        if variables and idx < len(variables):
                            val = variables[idx]
                        if not val.strip():
                            # Try falling back to example body text
                            examples = comp.get("example", {}).get("body_text", [[]])[0]
                            if examples and idx < len(examples):
                                val = examples[idx]
                        params.append({"type": "text", "text": val or "Lead"})
                    components.append({
                        "type": "body",
                        "parameters": params
                    })
    else:
        # Fallback to old simple behavior if template lookup failed
        # Header variables (if any)
        if header_variables:
            filled_header = [v for v in header_variables if v and str(v).strip()]
            if filled_header:
                components.append({
                    "type": "header",
                    "parameters": [{"type": "text", "text": str(v)} for v in filled_header],
                })

        # Body variables — only add if there are real non-empty values
        if variables:
            filled_vars = [v for v in variables if v and str(v).strip()]
            if filled_vars:
                components.append({
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(v)} for v in filled_vars],
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

    # Only add components if we actually have filled parameters
    if components:
        payload["template"]["components"] = components

    # Log the exact payload for debugging
    logger.info(f"Sending to {phone}: {json.dumps(payload)}")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload, headers=headers)
            data = response.json()

            # Log full response for debugging
            logger.info(f"Meta API response for {phone}: status={response.status_code}, body={json.dumps(data)}")

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
    header_variables: list[str] | None = None,
    retry_delay: int = 60,
) -> dict:
    """Send a template message with one automatic retry on failure."""
    result = await send_template_message(
        phone=phone,
        template_name=template_name,
        language_code=language_code,
        variables=variables,
        header_variables=header_variables,
    )
    if not result["success"]:
        logger.info(f"Retrying send to {phone} in {retry_delay}s...")
        await asyncio.sleep(retry_delay)
        result = await send_template_message(
            phone=phone,
            template_name=template_name,
            language_code=language_code,
            variables=variables,
            header_variables=header_variables,
        )
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


async def upload_media_to_meta(file_bytes: bytes, file_name: str, mime_type: str) -> str:
    """Upload header media (JPG/PNG) to Meta Resumable Upload API to get a header_handle."""
    creds = await get_credentials()
    access_token = creds["access_token"]
    
    # 1. Fetch app_id dynamically by debugging the access token
    debug_url = "https://graph.facebook.com/debug_token"
    debug_params = {"input_token": access_token, "access_token": access_token}
    async with httpx.AsyncClient(timeout=15) as client:
        debug_res = await client.get(debug_url, params=debug_params)
        debug_data = debug_res.json()
        app_id = debug_data.get("data", {}).get("app_id")
        if not app_id:
            raise RuntimeError(f"Could not retrieve Meta App ID from token debug endpoint: {debug_data}")

    # 2. Start Meta resumable upload session
    init_url = f"{GRAPH_API_BASE}/{app_id}/uploads"
    init_params = {
        "file_name": file_name,
        "file_length": len(file_bytes),
        "file_type": mime_type,
        "access_token": access_token
    }
    async with httpx.AsyncClient(timeout=15) as client:
        init_res = await client.post(init_url, params=init_params)
        init_data = init_res.json()
        session_id = init_data.get("id")
        if not session_id:
            raise RuntimeError(f"Failed to initialize upload session: {init_data}")

    # 3. Upload the binary data chunk
    upload_url = f"https://graph.facebook.com/v19.0/{session_id}"
    upload_headers = {
        "Authorization": f"Bearer {access_token}",
        "file_offset": "0",
        "Content-Type": "application/octet-stream"
    }
    async with httpx.AsyncClient(timeout=30) as client:
        upload_res = await client.post(upload_url, headers=upload_headers, content=file_bytes)
        upload_data = upload_res.json()
        handle = upload_data.get("h")
        if not handle:
            raise RuntimeError(f"Upload failed to return a media handle: {upload_data}")
        return handle


async def create_meta_template(payload: dict) -> dict:
    """Create a new template on Meta Business Manager."""
    creds = await get_credentials()
    url = f"{GRAPH_API_BASE}/{creds['waba_id']}/message_templates"
    headers = {
        "Authorization": f"Bearer {creds['access_token']}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(url, json=payload, headers=headers)
        data = res.json()
        if res.status_code == 200:
            return {"success": True, "data": data}
        else:
            error_msg = data.get("error", {}).get("message", "Template creation failed")
            return {"success": False, "error": error_msg}


async def delete_meta_template(template_name: str) -> dict:
    """Delete a template from Meta Business Manager."""
    creds = await get_credentials()
    url = f"{GRAPH_API_BASE}/{creds['waba_id']}/message_templates"
    headers = {"Authorization": f"Bearer {creds['access_token']}"}
    params = {"name": template_name}
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.delete(url, headers=headers, params=params)
        data = res.json()
        if res.status_code == 200:
            return {"success": True, "data": data}
        else:
            error_msg = data.get("error", {}).get("message", "Template deletion failed")
            return {"success": False, "error": error_msg}
