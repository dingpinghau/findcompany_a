"""TWSE (臺灣證券交易所) historical stock price client.

STOCK_DAY returns one calendar month of daily OHLC data per call; we fan out
one call per month in the requested range and concatenate.
"""

from __future__ import annotations

import asyncio
from datetime import date

import httpx

from backend.util import parse_number, roc_slash_to_iso

STOCK_DAY_URL = "https://www.twse.com.tw/exchangeReport/STOCK_DAY"

_CONCURRENCY = 6


def _month_starts(start: date, end: date) -> list[date]:
    months = []
    cur = start.replace(day=1)
    while cur <= end:
        months.append(cur)
        cur = date(cur.year + (1 if cur.month == 12 else 0), 1 if cur.month == 12 else cur.month + 1, 1)
    return months


async def _fetch_month(client: httpx.AsyncClient, stock_no: str, month_start: date) -> list[dict]:
    for attempt in range(3):
        try:
            resp = await client.get(
                STOCK_DAY_URL,
                params={
                    "response": "json",
                    "date": month_start.strftime("%Y%m%d"),
                    "stockNo": stock_no,
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            break
        except (httpx.HTTPError, ValueError):
            if attempt == 2:
                return []
            await asyncio.sleep(0.5 * (attempt + 1))
    if payload.get("stat") != "OK":
        return []
    rows = []
    for row in payload.get("data", []):
        iso_date = roc_slash_to_iso(row[0])
        if not iso_date:
            continue
        rows.append(
            {
                "date": iso_date,
                "open": parse_number(row[3]),
                "high": parse_number(row[4]),
                "low": parse_number(row[5]),
                "close": parse_number(row[6]),
            }
        )
    return rows


async def get_history(stock_no: str, start: date, end: date) -> list[dict]:
    months = _month_starts(start, end)
    sem = asyncio.Semaphore(_CONCURRENCY)

    async with httpx.AsyncClient(timeout=20) as client:
        async def bounded_fetch(month_start: date):
            async with sem:
                return await _fetch_month(client, stock_no, month_start)

        results = await asyncio.gather(*(bounded_fetch(m) for m in months))

    all_rows = [row for month_rows in results for row in month_rows]
    start_iso, end_iso = start.isoformat(), end.isoformat()
    filtered = [r for r in all_rows if start_iso <= r["date"] <= end_iso]
    filtered.sort(key=lambda r: r["date"])
    return filtered
