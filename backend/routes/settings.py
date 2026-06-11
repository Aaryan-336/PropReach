"""
Settings API — Save and load WhatsApp API credentials (one-time setup).
Credentials are stored in the Supabase `settings` table.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from auth import verify_api_key
from models import SettingsUpdate, SettingsOut, TestConnectionResult, SuccessResponse
from services.supabase_client import get_all_settings, upsert_setting
from services.whatsapp import test_connection, clear_credentials_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["Settings"], dependencies=[Depends(verify_api_key)])


def mask_token(value: str | None) -> str | None:
    """Mask a token for display: show first 4 and last 4 chars."""
    if not value:
        return None
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}····{value[-4:]}"


@router.get("", response_model=SettingsOut)
async def get_settings():
    """
    Load saved settings with masked sensitive values.
    Returns is_configured=True when all required fields are set.
    """
    settings = await get_all_settings()

    waba_id = settings.get("waba_id")
    phone_number_id = settings.get("phone_number_id")
    access_token = settings.get("access_token")
    verify_token = settings.get("webhook_verify_token")

    is_configured = all([waba_id, phone_number_id, access_token])

    return SettingsOut(
        waba_id=waba_id,
        phone_number_id=phone_number_id,
        access_token_masked=mask_token(access_token),
        webhook_verify_token=verify_token,
        is_configured=is_configured,
    )


@router.put("")
async def update_settings(settings: SettingsUpdate):
    """
    Save or update WhatsApp API credentials.
    Only non-None fields are updated — pass null to skip a field.
    This is the ONE-TIME setup: enter credentials here, they're saved forever.
    """
    updates = settings.model_dump(exclude_none=True)

    if not updates:
        return SuccessResponse(message="No settings to update")

    for key, value in updates.items():
        await upsert_setting(key, value)

    # Clear the cached credentials so the WhatsApp service picks up new values
    clear_credentials_cache()

    logger.info(f"Settings updated: {list(updates.keys())}")
    return SuccessResponse(message="Settings saved successfully")


@router.post("/test", response_model=TestConnectionResult)
async def test_whatsapp_connection():
    """
    Test the WhatsApp API connection using saved credentials.
    Calls the WABA endpoint to verify the token is valid.
    """
    result = await test_connection()
    return TestConnectionResult(**result)
