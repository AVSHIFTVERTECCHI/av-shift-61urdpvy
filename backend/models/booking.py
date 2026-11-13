import uuid
from typing import Literal

from pydantic import BaseModel, Field

from lib.validators import IsoDate

BookingKind = Literal["lavoro", "opzione"]
DATE = r"^\d{4}-\d{2}-\d{2}$"


class BookingInput(BaseModel):
    kind: BookingKind = "lavoro"
    service_name: str = Field("", max_length=120)
    note: str = Field("", max_length=300)


class BookingBulk(BookingInput):
    dates: list[IsoDate] = Field(min_length=1, max_length=93)


class BookingDates(BaseModel):
    dates: list[IsoDate] = Field(min_length=1, max_length=93)


class Booking(BookingInput):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: IsoDate
