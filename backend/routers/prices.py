from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from backend.services import tpex_client, twse_client

router = APIRouter()

_RANGE_DAYS = {
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
    "5y": 365 * 5,
}


@router.get("/prices/{stock_no}")
async def get_prices(stock_no: str, market: str, range: str = "6m"):
    if market not in ("twse", "tpex"):
        raise HTTPException(400, "market 必須是 twse 或 tpex")
    if range not in _RANGE_DAYS:
        raise HTTPException(400, f"range 必須是 {list(_RANGE_DAYS)} 之一")

    end = date.today()
    start = end - timedelta(days=_RANGE_DAYS[range])

    if market == "twse":
        series = await twse_client.get_history(stock_no, start, end)
    else:
        series = await tpex_client.get_history(stock_no, start, end)

    return {"stock_no": stock_no, "market": market, "range": range, "series": series}
