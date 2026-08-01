from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

from backend.company_index import company_index
from backend.routers import company, insights, prices

FRONTEND_DIR = PROJECT_ROOT / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=20)
    await company_index.load()
    yield
    await app.state.http_client.aclose()


app = FastAPI(title="廠商資料查詢服務", lifespan=lifespan)

app.include_router(company.router, prefix="/api")
app.include_router(prices.router, prefix="/api")
app.include_router(insights.router, prefix="/api")

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
