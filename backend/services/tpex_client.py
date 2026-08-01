"""TPEx (證券櫃檯買賣中心) historical stock price client.

Unlike TWSE, TPEx's open API has no per-stock monthly bulk endpoint — the
`dailyQuotes` endpoint returns a whole-market snapshot for one requested day.
We fan out one call per trading day in range and pick out the target stock's
row. For long ranges (1y/5y) this is downsampled to keep the call count sane
(documented limitation — see plan).
"""

from __future__ import annotations

import asyncio
from datetime import date, timedelta

import httpx

from backend.util import iso_to_roc_slash, parse_number

DAILY_QUOTES_URL = "https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes"

_CONCURRENCY = 8
_MAX_CALLS = 130  # cap total requests for long ranges; downsample if exceeded

# dailyQuotes table field order (index-based, confirmed against a live response)
_IDX_CODE, _IDX_CLOSE, _IDX_OPEN, _IDX_HIGH, _IDX_LOW = 0, 2, 4, 5, 6


def _business_days(start: date, end: date) -> list[date]:
    days = []
    cur = start
    while cur <= end:
        if cur.weekday() < 5:  # Mon-Fri
            days.append(cur)
        cur += timedelta(days=1)
    return days


def _downsample(days: list[date]) -> list[date]:
    if len(days) <= _MAX_CALLS:
        return days
    step = -(-len(days) // _MAX_CALLS)  # ceil division
    sampled = days[::step]
    if sampled[-1] != days[-1]:
        sampled.append(days[-1])
    return sampled


async def _fetch_day(client: httpx.AsyncClient, stock_no: str, day: date) -> dict | None:
    for attempt in range(3):
        try:
            resp = await client.get(DAILY_QUOTES_URL, params={"date": iso_to_roc_slash(day)})
            resp.raise_for_status()
            payload = resp.json()
            break
        except (httpx.HTTPError, ValueError):
            if attempt == 2:
                return None
            await asyncio.sleep(0.5 * (attempt + 1))
    tables = payload.get("tables") or []
    if not tables:
        return None
    for row in tables[0].get("data", []):
        if row[_IDX_CODE] == stock_no:
            return {
                "date": day.isoformat(),
                "open": parse_number(row[_IDX_OPEN]),
                "high": parse_number(row[_IDX_HIGH]),
                "low": parse_number(row[_IDX_LOW]),
                "close": parse_number(row[_IDX_CLOSE]),
            }
    return None


async def get_history(stock_no: str, start: date, end: date) -> list[dict]:
    all_days = _business_days(start, end)
    sampled_days = _downsample(all_days)
    sem = asyncio.Semaphore(_CONCURRENCY)

    async with httpx.AsyncClient(timeout=20) as client:
        async def bounded_fetch(day: date):
            async with sem:
                return await _fetch_day(client, stock_no, day)

        results = await asyncio.gather(*(bounded_fetch(d) for d in sampled_days))

    rows = [r for r in results if r is not None]
    rows.sort(key=lambda r: r["date"])
    return rows
