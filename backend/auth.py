"""
Simple API key authentication for all protected routes.
The frontend sends the key in the X-API-Key header.
"""

import os
from fastapi import Header, HTTPException, status


def get_api_key():
    """Return the configured API secret key."""
    key = os.getenv("API_SECRET_KEY")
    if not key:
        raise RuntimeError("API_SECRET_KEY environment variable is not set")
    return key


async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    """
    FastAPI dependency that validates the X-API-Key header.
    Attach to any route or router that needs protection.
    """
    expected = get_api_key()
    if x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return x_api_key
