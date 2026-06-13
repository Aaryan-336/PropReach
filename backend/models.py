"""
Pydantic models for request/response validation across all API routes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Contacts ─────────────────────────────────────────


class ContactCreate(BaseModel):
    name: Optional[str] = None
    phone: str
    group_name: str = "General"
    custom_fields: dict[str, Any] = Field(default_factory=dict)


class ContactOut(BaseModel):
    id: str
    name: Optional[str]
    phone: str
    group_name: str
    custom_fields: dict[str, Any]
    is_blocked: bool
    created_at: datetime


class GroupCreate(BaseModel):
    name: str


class GSheetImportRequest(BaseModel):
    url: str
    group_name: Optional[str] = None



# ── Campaigns ────────────────────────────────────────


class CampaignCreate(BaseModel):
    name: str
    template_name: Optional[str] = None
    template_vars: dict[str, str] = Field(default_factory=dict)
    contact_group: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    send_rate: int = Field(default=1, ge=1, le=80, description="Messages per second")


class CampaignOut(BaseModel):
    id: str
    name: str
    template_name: Optional[str]
    template_vars: dict[str, Any]
    contact_group: Optional[str]
    status: str
    scheduled_at: Optional[datetime]
    total_contacts: int
    sent_count: int
    delivered_count: int
    failed_count: int
    reply_count: int
    created_at: datetime


class CampaignLaunch(BaseModel):
    scheduled_at: Optional[datetime] = None
    send_rate: int = Field(default=1, ge=1, le=80)


# ── Messages ─────────────────────────────────────────


class MessageOut(BaseModel):
    id: str
    campaign_id: Optional[str]
    contact_id: Optional[str]
    phone: Optional[str]
    direction: str
    content: Optional[str]
    wa_message_id: Optional[str]
    status: str
    error_message: Optional[str]
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    created_at: datetime


class DailyMessageStats(BaseModel):
    date: str
    sent: int
    delivered: int
    failed: int


class DashboardStats(BaseModel):
    total_contacts: int
    active_campaigns: int
    messages_sent_this_month: int
    reply_rate: float
    daily_stats: list[DailyMessageStats]


# ── Replies ──────────────────────────────────────────


class ReplyOut(BaseModel):
    id: str
    contact_id: Optional[str]
    phone: str
    message_text: Optional[str]
    wa_message_id: Optional[str]
    is_read: bool
    label: str
    agent_note: Optional[str]
    received_at: datetime
    contact_name: Optional[str] = None


class ReplyUpdate(BaseModel):
    label: Optional[str] = None
    agent_note: Optional[str] = None
    is_read: Optional[bool] = None


# ── Settings ─────────────────────────────────────────


class SettingsUpdate(BaseModel):
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    access_token: Optional[str] = None
    webhook_verify_token: Optional[str] = None


class SettingsOut(BaseModel):
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    access_token_masked: Optional[str] = None
    webhook_verify_token: Optional[str] = None
    is_configured: bool = False


class TestConnectionResult(BaseModel):
    success: bool
    message: str
    account_name: Optional[str] = None


# ── Templates ────────────────────────────────────────


class TemplateOut(BaseModel):
    name: str
    status: str
    language: str
    category: str
    components: list[dict[str, Any]] = Field(default_factory=list)


# ── Generic ──────────────────────────────────────────


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = "OK"
    data: Optional[Any] = None


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
