from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from backend.company_index import company_index
from backend.services import gcis_client
from backend.util import looks_like_tax_id

router = APIRouter()


def _attach_listing(company: dict) -> dict:
    listing = company_index.lookup(company["tax_id"]) if company.get("tax_id") else None
    company["listing"] = listing
    return company


@router.get("/company")
async def get_company(request: Request, name: Optional[str] = None, tax_id: Optional[str] = None):
    if not name and not tax_id:
        raise HTTPException(400, "請提供 name 或 tax_id")

    client = request.app.state.http_client

    if tax_id or (name and looks_like_tax_id(name)):
        resolved_tax_id = tax_id or name
        company = await gcis_client.get_by_tax_id(client, resolved_tax_id)
        if not company:
            raise HTTPException(404, f"查無統一編號 {resolved_tax_id} 的公司資料")
        return {"resolved": True, "company": _attach_listing(company)}

    candidates = await gcis_client.search_by_name(client, name)
    if not candidates:
        raise HTTPException(404, f"查無公司名稱包含「{name}」的資料")
    if len(candidates) == 1:
        return {"resolved": True, "company": _attach_listing(candidates[0])}

    return {
        "resolved": False,
        "candidates": [
            {"tax_id": c["tax_id"], "name": c["name"], "address": c["address"]} for c in candidates
        ],
    }
