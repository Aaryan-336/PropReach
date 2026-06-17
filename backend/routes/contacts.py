import csv
import io
import logging
import re
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from auth import verify_api_key
from models import ContactCreate, ContactOut, GroupCreate, SuccessResponse, GSheetImportRequest
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/contacts", tags=["Contacts"], dependencies=[Depends(verify_api_key)])


def process_contacts_csv(csv_content: str, override_group_name: Optional[str] = None) -> dict:
    """Helper to validate columns, clean phone numbers, and upsert contacts from a CSV string."""
    f = io.StringIO(csv_content)
    reader = csv.DictReader(f)

    # Normalize column names by stripping whitespace and converting to lowercase
    if not reader.fieldnames:
        raise ValueError("Spreadsheet must have a header row and cannot be empty")

    # Clean fieldnames and map normalized headers back to original headers
    headers_map = {h.strip().lower(): h for h in reader.fieldnames}

    if "phone" not in headers_map:
        raise ValueError("Spreadsheet must have a 'phone' column")

    sb = get_supabase()
    imported = 0
    updated = 0
    errors = []

    for idx, row in enumerate(reader):
        row_num = idx + 2  # Row 1 is header, first data row is 2

        # Get values using the headers map
        phone_key = headers_map.get("phone")
        phone = row.get(phone_key)

        if phone is None or str(phone).strip() == "":
            errors.append({"row": row_num, "error": "Missing phone number"})
            continue

        phone = str(phone).strip()

        # Clean phone number — remove spaces, dashes, plus signs for consistency
        phone_clean = phone.replace(" ", "").replace("-", "").replace("+", "")
        # Remove any floating point tail if parsed as float (e.g. '919876543210.0' -> '919876543210')
        if phone_clean.endswith(".0"):
            phone_clean = phone_clean[:-2]

        if not phone_clean.isdigit():
            errors.append({"row": row_num, "error": f"Invalid phone: {phone}"})
            continue

        name_key = headers_map.get("name")
        name_val = row.get(name_key) if name_key else None
        name = str(name_val).strip() if name_val is not None else None
        if name == "":
            name = None

        if override_group_name and override_group_name.strip():
            group_name = override_group_name.strip()
        else:
            group_key = headers_map.get("group_name")
            group_val = row.get(group_key) if group_key else None
            group_name = str(group_val).strip() if group_val is not None else "General"
            if not group_name:
                group_name = "General"

        contact_data = {
            "phone": phone_clean,
            "name": name,
            "group_name": group_name,
        }

        # Collect any extra columns as custom_fields
        known_cols = {"phone", "name", "group_name"}
        custom_fields = {}
        for norm_col, orig_col in headers_map.items():
            if norm_col not in known_cols:
                val = row.get(orig_col)
                if val is not None and str(val).strip() != "":
                    custom_fields[norm_col] = str(val).strip()
        if custom_fields:
            contact_data["custom_fields"] = custom_fields

        try:
            existing = sb.table("contacts").select("id").eq("phone", phone_clean).execute()
            if existing.data:
                sb.table("contacts").update(contact_data).eq("phone", phone_clean).execute()
                updated += 1
            else:
                sb.table("contacts").insert(contact_data).execute()
                imported += 1
        except Exception as e:
            errors.append({"row": row_num, "error": str(e)})

    return {
        "imported": imported,
        "updated": updated,
        "errors": errors[:20],
        "total_errors": len(errors)
    }


@router.get("")
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=5000),
    search: Optional[str] = None,
    group: Optional[str] = None,
    blocked: Optional[bool] = None,
):
    """List contacts with pagination, search, and group filter."""
    sb = get_supabase()
    query = sb.table("contacts").select("*", count="exact")

    if search:
        query = query.or_(f"name.ilike.%{search}%,phone.ilike.%{search}%")
    if group:
        query = query.eq("group_name", group)
    if blocked is not None:
        query = query.eq("is_blocked", blocked)

    query = query.order("created_at", desc=True)

    # Pagination
    start = (page - 1) * page_size
    end = start + page_size - 1
    query = query.range(start, end)

    result = query.execute()

    return {
        "items": result.data or [],
        "total": result.count or 0,
        "page": page,
        "page_size": page_size,
    }


@router.post("")
async def create_contact(contact: ContactCreate):
    """Create a single contact."""
    sb = get_supabase()

    # Check for duplicate phone
    existing = sb.table("contacts").select("id").eq("phone", contact.phone).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Contact with this phone already exists")

    data = contact.model_dump()
    result = sb.table("contacts").insert(data).execute()

    return SuccessResponse(message="Contact created", data=result.data[0] if result.data else None)


@router.post("/import")
async def import_contacts(
    file: UploadFile = File(...),
    group_name: Optional[str] = Query(None)
):
    """
    Import contacts from a CSV file.
    Expected columns: name, phone (required), group_name (optional)
    Upserts by phone number — existing contacts are updated, new ones created.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file")

    try:
        contents = await file.read()
        csv_content = contents.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {str(e)}")

    try:
        result = process_contacts_csv(csv_content, override_group_name=group_name)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

    return SuccessResponse(
        message=f"Import complete: {result['imported']} created, {result['updated']} updated, {result['total_errors']} errors",
        data=result,
    )


@router.post("/import-gsheet")
async def import_google_sheet(payload: GSheetImportRequest):
    """
    Import contacts from a public Google Sheet URL.
    The URL is converted to a direct CSV export link and parsed.
    """
    url = payload.url.strip()
    
    # Extract spreadsheet ID from url
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Google Sheets URL. Must contain '/d/SPREADSHEET_ID'")
    
    spreadsheet_id = match.group(1)
    
    # Check for tab ID (gid) in the URL
    gid_match = re.search(r"[#&?]gid=([0-9]+)", url)
    gid = gid_match.group(1) if gid_match else None
    
    # Build export URL
    export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv"
    if gid:
        export_url += f"&gid={gid}"
        
    logger.info(f"Fetching Google Sheet CSV from URL: {export_url}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(export_url, follow_redirects=True, timeout=15.0)
            response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch Google Sheet: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to retrieve Google Sheet. Please ensure the link sharing is set to 'Anyone with the link can view' (Public)."
        )
        
    try:
        csv_content = response.text
    except Exception as e:
        logger.error(f"Failed to read Google Sheet CSV: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to read sheet content as CSV: {str(e)}")
        
    try:
        result = process_contacts_csv(csv_content, override_group_name=payload.group_name)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
        
    return SuccessResponse(
        message=f"Google Sheet Import complete: {result['imported']} created, {result['updated']} updated, {result['total_errors']} errors",
        data=result,
    )


@router.get("/groups")
async def list_groups():
    """List all distinct contact group names."""
    sb = get_supabase()
    result = sb.table("contacts").select("group_name").execute()

    groups = sorted(set(row["group_name"] for row in (result.data or []) if row.get("group_name")))
    return {"groups": groups}


@router.post("/groups")
async def create_group(group: GroupCreate):
    """
    Create a named contact group.
    Groups are implicit (just a string on contacts), so this endpoint
    creates a placeholder contact to establish the group name.
    Actually, we just return success — groups exist when contacts use them.
    """
    return SuccessResponse(message=f"Group '{group.name}' is ready to use")


@router.patch("/{contact_id}/block")
async def toggle_block(contact_id: str):
    """Toggle the blocked status of a contact."""
    sb = get_supabase()

    result = sb.table("contacts").select("is_blocked").eq("id", contact_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")

    current = result.data[0]["is_blocked"]
    sb.table("contacts").update({"is_blocked": not current}).eq("id", contact_id).execute()

    action = "unblocked" if current else "blocked"
    return SuccessResponse(message=f"Contact {action}")


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete a contact."""
    sb = get_supabase()
    sb.table("contacts").delete().eq("id", contact_id).execute()
    return SuccessResponse(message="Contact deleted")
