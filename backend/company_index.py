"""Builds an in-memory index of listed/OTC/emerging companies from MOPS open data CSVs.

These CSVs are public, no auth needed, and conveniently include the stock code
alongside the tax id — so once we resolve a company's tax id (via GCIS), we can
look it up here to find out whether it's publicly traded and get its stock code.
"""

from __future__ import annotations

import csv
import io
import time
from pathlib import Path

import httpx

from backend.util import gregorian8_to_iso, parse_number

CACHE_DIR = Path(__file__).resolve().parent.parent / "data_cache"
CACHE_TTL_SECONDS = 24 * 60 * 60

SOURCES = {
    "twse": ("https://mopsfin.twse.com.tw/opendata/t187ap03_L.csv", "上市"),
    "tpex": ("https://mopsfin.twse.com.tw/opendata/t187ap03_O.csv", "上櫃"),
    "emerging": ("https://mopsfin.twse.com.tw/opendata/t187ap03_R.csv", "興櫃"),
}


class CompanyIndex:
    def __init__(self):
        self.by_tax_id: dict[str, dict] = {}

    def lookup(self, tax_id: str) -> dict | None:
        return self.by_tax_id.get(tax_id)

    async def load(self):
        CACHE_DIR.mkdir(exist_ok=True)
        async with httpx.AsyncClient(timeout=30) as client:
            for market_key, (url, market_label) in SOURCES.items():
                text = await self._get_csv(client, market_key, url)
                self._index_csv(text, market_key, market_label)

    async def _get_csv(self, client: httpx.AsyncClient, market_key: str, url: str) -> str:
        cache_file = CACHE_DIR / f"{market_key}.csv"
        if cache_file.exists() and (time.time() - cache_file.stat().st_mtime) < CACHE_TTL_SECONDS:
            return cache_file.read_text(encoding="utf-8-sig")
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text
        cache_file.write_text(text, encoding="utf-8")
        return text

    def _index_csv(self, text: str, market_key: str, market_label: str):
        reader = csv.DictReader(io.StringIO(text))
        listed_date_field = "上市日期" if market_key == "twse" else "上櫃日期" if market_key == "tpex" else None
        for row in reader:
            tax_id = (row.get("營利事業統一編號") or "").strip()
            if not tax_id:
                continue
            self.by_tax_id[tax_id] = {
                "stock_no": (row.get("公司代號") or "").strip(),
                "market": market_key,
                "market_label": market_label,
                "short_name": (row.get("公司簡稱") or "").strip(),
                "website": (row.get("網址") or "").strip() or None,
                "listed_date": gregorian8_to_iso(row.get(listed_date_field)) if listed_date_field else None,
                "capital_paid_in": parse_number(row.get("實收資本額")),
                "setup_date": gregorian8_to_iso(row.get("成立日期")),
                "address": (row.get("住址") or "").strip() or None,
            }


company_index = CompanyIndex()
