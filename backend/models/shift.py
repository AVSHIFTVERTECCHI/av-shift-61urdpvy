import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from lib.validators import IsoDate

PayStatus = Literal["da_fatturare", "fatturato", "pagato"]
HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


class Settings(BaseModel):
    standard_hours: float = Field(9, gt=0, le=24)
    overtime_pct: float = Field(10, ge=0, le=100)
    tax_pct: float = Field(28, ge=0, le=100)
    km_rate: float = Field(0.35, ge=0)
    meal_allowance: float = Field(0, ge=0)
    default_role: str = "Tecnico Video"
    display_name: str = ""  # firma nei messaggi di disponibilità


class ServiceInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    day_rate: float = Field(ge=0)
    # hours of presence before overtime: 9 = "8+1", 10 = "9+1" (work + 1h pause)
    standard_hours: float = Field(9, gt=0, le=24)
    notes: str = ""


class Service(ServiceInput):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class ShiftInput(BaseModel):
    date: IsoDate
    service_id: str = ""
    service_name: str = Field(min_length=1, max_length=120)
    event: str = ""
    location: str = ""
    role: str = ""
    start_time: str = Field(pattern=HHMM)
    end_time: str = Field(pattern=HHMM)
    break_minutes: int = Field(0, ge=0, le=600)
    pause_taken: bool = True  # False = pausa saltata -> +1h di straordinario
    day_rate: float = Field(ge=0)
    overtime_pct: float = Field(10, ge=0, le=100)
    standard_hours: float = Field(9, gt=0, le=24)
    tax_pct: float = Field(28, ge=0, le=100)
    km: float = Field(0, ge=0)
    km_rate: float = Field(0, ge=0)
    meal: float = Field(0, ge=0)
    other_expenses: float = Field(0, ge=0)
    status: PayStatus = "da_fatturare"
    notes: str = ""


class StatusUpdate(BaseModel):
    status: PayStatus


class BulkStatusUpdate(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    service_name: str = Field(min_length=1, max_length=120)
    status: PayStatus
    from_status: PayStatus | None = None  # only move the days currently in this status


class BulkResult(BaseModel):
    updated: int


class Shift(ShiftInput):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hours: float = 0
    overtime_hours: float = 0
    overtime_rate: float = 0
    overtime_pay: float = 0
    gross: float = 0  # day_rate + overtime_pay (lordo)
    net: float = 0  # gross * (1 - tax_pct) (netto)
    day_rate_net: float = 0
    expenses_total: float = 0
    total: float = 0  # gross + expenses (rimborsi non tassati)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MonthTrend(BaseModel):
    month: str
    total: float
    hours: float


class ServiceTotal(BaseModel):
    service_name: str
    gross: float
    net: float
    days: int


class Summary(BaseModel):
    month: str
    gross: float
    net: float
    ordinary: float
    ordinary_net: float
    overtime_pay: float
    overtime_net: float
    expenses: float
    pending: float
    paid: float
    hours: float
    overtime_hours: float
    days: int
    trend: list[MonthTrend]
    by_service: list[ServiceTotal]


class Today(BaseModel):
    today: str


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def compute_shift(data: ShiftInput, shift_id: str | None = None) -> Shift:
    span = _minutes(data.end_time) - _minutes(data.start_time)
    if span <= 0:
        span += 24 * 60  # overnight shift
    hours = max(0.0, (span - data.break_minutes) / 60)
    overtime = max(0.0, hours - data.standard_hours) + (0 if data.pause_taken else 1)
    ot_rate = data.day_rate * data.overtime_pct / 100
    ot_pay = overtime * ot_rate
    expenses = data.km * data.km_rate + data.meal + data.other_expenses
    gross = data.day_rate + ot_pay
    keep = 1 - data.tax_pct / 100
    fields = data.model_dump()
    if shift_id:
        fields["id"] = shift_id
    return Shift(
        **fields,
        hours=round(hours, 2),
        overtime_hours=round(overtime, 2),
        overtime_rate=round(ot_rate, 2),
        overtime_pay=round(ot_pay, 2),
        gross=round(gross, 2),
        net=round(gross * keep, 2),
        day_rate_net=round(data.day_rate * keep, 2),
        expenses_total=round(expenses, 2),
        total=round(gross + expenses, 2),
    )
