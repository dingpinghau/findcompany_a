from __future__ import annotations

from typing import Optional

from fastapi import APIRouter

from backend.services import claude_insights

router = APIRouter()


@router.get("/insights")
async def get_insights(name: str, website: Optional[str] = None):
    return claude_insights.get_insights(name, website)
