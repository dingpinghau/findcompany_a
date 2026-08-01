"""經濟部商工行政資料開放平臺 (GCIS) client.

Both endpoints below are public, unauthenticated open data APIs (no application/
registration required) — verified live during implementation:

- APP1 (公司登記基本資料-應用一): lookup by tax id (統一編號)
- KEYWORD (公司登記關鍵字查詢): lookup by company name substring

Docs: https://data.gcis.nat.gov.tw/od/ (swagger: http://data.gcis.nat.gov.tw/resources/swagger/swagger.json)
"""

from __future__ import annotations

import httpx

from backend.util import parse_number, roc7_to_iso

BASE_URL = "https://data.gcis.nat.gov.tw/od/data/api"
APP1_ID = "5F64D864-61CB-4D0D-8AD9-492047CC1EA6"
KEYWORD_ID = "6BBA2268-1367-4B42-9CCA-BC17499EBE8C"

# GCIS registers company names using either variant of "台"/"臺" (e.g. 台灣 vs 臺灣).
# The keyword API does literal substring matching, so we retry with the swapped variant.
_VARIANT_PAIRS = (("台", "臺"), ("臺", "台"))


def _name_variants(name: str) -> list[str]:
    variants = [name]
    for a, b in _VARIANT_PAIRS:
        if a in name:
            variants.append(name.replace(a, b))
    # de-dup while preserving order
    seen = set()
    out = []
    for v in variants:
        if v not in seen:
            seen.add(v)
            out.append(v)
    return out


def _normalize(record: dict) -> dict:
    return {
        "tax_id": record.get("Business_Accounting_NO"),
        "name": record.get("Company_Name"),
        "status_desc": record.get("Company_Status_Desc"),
        "address": record.get("Company_Location"),
        "capital_total": parse_number(record.get("Capital_Stock_Amount")),
        "capital_paid_in": parse_number(record.get("Paid_In_Capital_Amount")),
        "responsible_name": record.get("Responsible_Name"),
        "setup_date": roc7_to_iso(record.get("Company_Setup_Date")),
        "source": "gcis",
    }


async def get_by_tax_id(client: httpx.AsyncClient, tax_id: str) -> dict | None:
    resp = await client.get(
        f"{BASE_URL}/{APP1_ID}",
        params={"$format": "json", "$filter": f"Business_Accounting_NO eq {tax_id}"},
    )
    resp.raise_for_status()
    data = resp.json() if resp.text.strip() else []
    if not data:
        return None
    return _normalize(data[0])


async def search_by_name(client: httpx.AsyncClient, name: str, limit: int = 10) -> list[dict]:
    name = name.strip()
    if not name:
        return []
    for variant in _name_variants(name):
        resp = await client.get(
            f"{BASE_URL}/{KEYWORD_ID}",
            params={
                "$format": "json",
                "$filter": f"Company_Name like {variant} and Company_Status eq 01",
                "$top": limit,
            },
        )
        resp.raise_for_status()
        data = resp.json() if resp.text.strip() else []
        if data:
            return [_normalize(r) for r in data]
    return []
