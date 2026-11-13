from datetime import date
from typing import Annotated

from pydantic import AfterValidator, Field


def _real_date(v: str) -> str:
    date.fromisoformat(v)  # raises ValueError -> 422 for e.g. 2026-13-99
    return v


IsoDate = Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$"), AfterValidator(_real_date)]
