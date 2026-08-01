"""Pluggable AI research module for the two qualitative sections:
- 主要產品服務說明與優勢 (products/services & competitive advantages)
- 重要消息 (notable public news)

Disabled unless ANTHROPIC_API_KEY is set — no key means no fabricated data.
"""

from __future__ import annotations

import json
import os
import re

from anthropic import Anthropic

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 4096  # web_search tool results count against this budget too, not just the final text

_SYSTEM_PROMPT = (
    "你是一個廠商資料研究助理。使用你可以取得的網路搜尋工具，查詢指定公司的官方網站與新聞，"
    "整理出：1) 主要產品服務說明 2) 相對於同業的優勢 3) 近期公開重要消息(最多3則，需含日期與來源連結)。"
    "只根據搜尋到的實際資訊作答，找不到的欄位請留空陣列或空字串，不要編造內容。"
    "說明與摘要盡量簡潔。"
    "最後一則訊息必須只包含一個 JSON 物件，不要加上任何前言、說明文字或 markdown code fence，格式為："
    '{"products_services": "string", "advantages": ["string", ...], '
    '"news": [{"title": "string", "date": "YYYY-MM-DD or empty", "url": "string", "summary": "string"}]}'
)


def is_enabled() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _extract_json(text: str) -> dict:
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1)
    else:
        # No fence — take the substring between the first '{' and the matching last '}',
        # since the model may still prepend a sentence despite instructions.
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            text = text[start : end + 1]
    return json.loads(text)


def get_insights(name: str, website: str | None) -> dict:
    if not is_enabled():
        return {"enabled": False}

    client = Anthropic()
    query = f"公司名稱：{name}" + (f"，官方網站：{website}" if website else "")

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=_SYSTEM_PROMPT,
            tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}],
            messages=[{"role": "user", "content": query}],
        )
        text_blocks = [b.text for b in response.content if getattr(b, "type", None) == "text"]
        if not text_blocks:
            return {"enabled": True, "error": "模型未回傳文字內容"}
        parsed = _extract_json(text_blocks[-1])
        parsed["enabled"] = True
        if response.stop_reason == "max_tokens":
            parsed["truncated"] = True
        return parsed
    except Exception as exc:  # pragma: no cover - defensive
        return {"enabled": True, "error": str(exc)}
