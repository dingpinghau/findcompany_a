from __future__ import annotations

import re
from datetime import date


def roc7_to_iso(value: str | None) -> str | None:
    """Convert a 7-digit ROC date string (YYYMMDD) to ISO 'YYYY-MM-DD'. Returns None if unparseable."""
    if not value:
        return None
    value = value.strip()
    if not re.fullmatch(r"\d{7}", value):
        return None
    roc_year, month, day = int(value[:3]), int(value[3:5]), int(value[5:7])
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{roc_year + 1911:04d}-{month:02d}-{day:02d}"


def gregorian8_to_iso(value: str | None) -> str | None:
    """Convert an 8-digit plain Gregorian date string 'YYYYMMDD' to ISO 'YYYY-MM-DD'.

    MOPS company-basic-data CSVs (成立日期/上市日期/上櫃日期) use this format —
    distinct from GCIS's 7-digit ROC-year format handled by roc7_to_iso.
    """
    if not value:
        return None
    value = value.strip()
    if not re.fullmatch(r"\d{8}", value):
        return None
    year, month, day = int(value[:4]), int(value[4:6]), int(value[6:8])
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def roc_slash_to_iso(value: str | None) -> str | None:
    """Convert a slash-separated ROC date 'YYY/MM/DD' (e.g. 115/07/01) to ISO 'YYYY-MM-DD'."""
    if not value:
        return None
    m = re.fullmatch(r"(\d{2,3})/(\d{1,2})/(\d{1,2})", value.strip())
    if not m:
        return None
    roc_year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{roc_year + 1911:04d}-{month:02d}-{day:02d}"


def iso_to_roc_slash(iso_date: date) -> str:
    """Convert a Python date to ROC slash format 'YYY/MM/DD' for TPEx-style APIs."""
    return f"{iso_date.year - 1911}/{iso_date.month:02d}/{iso_date.day:02d}"


def parse_number(value) -> float | None:
    """Parse a numeric field that may be an int, float, or comma-formatted string."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace(",", "").strip()
    if cleaned in ("", "--", "X0.00"):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


TAX_ID_RE = re.compile(r"^\d{8}$")


def looks_like_tax_id(value: str) -> bool:
    return bool(TAX_ID_RE.fullmatch(value.strip()))
