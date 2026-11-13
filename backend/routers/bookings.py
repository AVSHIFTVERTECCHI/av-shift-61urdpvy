"""Calendar bookings: one entry per day marking it busy (lavoro) or tentative (opzione)."""
from datetime import date as _date

from fastapi import APIRouter, HTTPException, Path, Query

from lib.db import db
from models.booking import DATE, Booking, BookingBulk, BookingDates, BookingInput

router = APIRouter()


@router.get("/bookings", response_model=list[Booking])
async def list_bookings(month: str = Query(..., pattern=r"^\d{4}-\d{2}$")):
    docs = await db.bookings.find({"date": {"$regex": f"^{month}"}}, {"_id": 0}).sort("date", 1).to_list(100)
    return [Booking(**d) for d in docs]


def _check_date(date: str) -> None:
    try:
        _date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Data non valida")


async def _upsert(date: str, body: BookingInput) -> Booking:
    _check_date(date)
    existing = await db.bookings.find_one({"date": date}, {"_id": 0, "id": 1})
    booking = Booking(date=date, **body.model_dump())
    if existing:
        booking.id = existing["id"]
    await db.bookings.replace_one({"date": date}, booking.model_dump(), upsert=True)
    return booking


@router.post("/bookings/bulk", response_model=list[Booking])
async def bulk_upsert(body: BookingBulk):
    data = BookingInput(kind=body.kind, service_name=body.service_name, note=body.note)
    return [await _upsert(d, data) for d in sorted(set(body.dates))]


@router.post("/bookings/bulk-delete", status_code=204)
async def bulk_delete(body: BookingDates):
    await db.bookings.delete_many({"date": {"$in": body.dates}})


@router.put("/bookings/{date}", response_model=Booking)
async def upsert_booking(body: BookingInput, date: str = Path(pattern=DATE)):
    return await _upsert(date, body)


@router.delete("/bookings/{date}", status_code=204)
async def delete_booking(date: str = Path(pattern=DATE)):
    res = await db.bookings.delete_one({"date": date})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nessun impegno in questa data")
