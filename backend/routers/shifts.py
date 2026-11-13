from fastapi import APIRouter, HTTPException, Query

from lib.dates import today_iso
from lib.db import db
from models.shift import (
    MonthTrend,
    PayStatus,
    Service,
    ServiceInput,
    ServiceTotal,
    Settings,
    Shift,
    ShiftInput,
    StatusUpdate,
    BulkStatusUpdate,
    BulkResult,
    Summary,
    Today,
    compute_shift,
)

router = APIRouter()

MONTH = r"^\d{4}-\d{2}$"
NOT_FOUND = "Giornata non trovata"


@router.get("/today", response_model=Today)
async def get_today():
    return Today(today=today_iso())


# ---- settings ----
@router.get("/settings", response_model=Settings)
async def get_settings():
    doc = await db.settings.find_one({"_key": "main"}, {"_id": 0, "_key": 0})
    return Settings(**doc) if doc else Settings()


@router.put("/settings", response_model=Settings)
async def put_settings(body: Settings):
    await db.settings.update_one({"_key": "main"}, {"$set": body.model_dump()}, upsert=True)
    return body


# ---- services (companies with their own day rate) ----
@router.get("/services", response_model=list[Service])
async def list_services():
    docs = await db.services.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return [Service(**d) for d in docs]


@router.post("/services", response_model=Service, status_code=201)
async def create_service(body: ServiceInput):
    svc = Service(**body.model_dump())
    await db.services.insert_one(svc.model_dump())
    return svc


@router.put("/services/{id}", response_model=Service)
async def update_service(id: str, body: ServiceInput):
    res = await db.services.update_one({"id": id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service non trovato")
    # keep denormalised name on shifts in sync
    await db.shifts.update_many({"service_id": id}, {"$set": {"service_name": body.name}})
    return Service(id=id, **body.model_dump())


@router.delete("/services/{id}", status_code=204)
async def delete_service(id: str):
    res = await db.services.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service non trovato")


# ---- shifts ----
@router.get("/shifts", response_model=list[Shift])
async def list_shifts(
    month: str | None = Query(None, pattern=MONTH),
    status: PayStatus | None = None,
):
    q: dict = {}
    if month:
        q["date"] = {"$regex": f"^{month}"}
    if status:
        q["status"] = status
    docs = await db.shifts.find(q, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(2000)
    return [Shift(**d) for d in docs]


@router.post("/shifts", response_model=Shift, status_code=201)
async def create_shift(body: ShiftInput):
    shift = compute_shift(body)
    await db.shifts.insert_one(shift.model_dump())
    return shift


@router.put("/shifts/{id}", response_model=Shift)
async def update_shift(id: str, body: ShiftInput):
    existing = await db.shifts.find_one({"id": id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    shift = compute_shift(body, shift_id=id)
    shift.created_at = existing["created_at"]
    await db.shifts.replace_one({"id": id}, shift.model_dump())
    return shift


@router.post("/shifts/bulk-status", response_model=BulkResult)
async def bulk_status(body: BulkStatusUpdate):
    q: dict = {"date": {"$regex": f"^{body.month}"}, "service_name": body.service_name}
    if body.from_status:
        q["status"] = body.from_status
    res = await db.shifts.update_many(
        q,
        {"$set": {"status": body.status}},
    )
    return BulkResult(updated=res.matched_count)


@router.patch("/shifts/{id}/status", response_model=Shift)
async def update_status(id: str, body: StatusUpdate):
    res = await db.shifts.find_one_and_update(
        {"id": id}, {"$set": {"status": body.status}}, projection={"_id": 0}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return Shift(**res)


@router.delete("/shifts/{id}", status_code=204)
async def delete_shift(id: str):
    res = await db.shifts.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail=NOT_FOUND)


def _prev_months(month: str, n: int) -> list[str]:
    y, m = map(int, month.split("-"))
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(out))


@router.get("/summary", response_model=Summary)
async def summary(month: str = Query(..., pattern=MONTH)):
    months = _prev_months(month, 6)
    docs = await db.shifts.find(
        {"date": {"$gte": f"{months[0]}-01", "$lte": f"{month}-31"}}, {"_id": 0}
    ).to_list(5000)
    docs = [_with_money(d) for d in docs]
    trend = {m: MonthTrend(month=m, total=0, hours=0) for m in months}
    for d in docs:
        t = trend.get(d["date"][:7])
        if t:
            t.total = round(t.total + d["gross"], 2)
            t.hours = round(t.hours + d["hours"], 2)
    cur = [d for d in docs if d["date"].startswith(month)]
    by_svc: dict[str, ServiceTotal] = {}
    for d in cur:
        s = by_svc.setdefault(d["service_name"], ServiceTotal(service_name=d["service_name"], gross=0, net=0, days=0))
        s.gross = round(s.gross + d["gross"], 2)
        s.net = round(s.net + d["net"], 2)
        s.days += 1

    def tot(key: str, rows=cur) -> float:
        return round(sum(d[key] for d in rows), 2)

    ot_net = sum(d["net"] - d["day_rate_net"] for d in cur)
    paid = tot("total", [d for d in cur if d["status"] == "pagato"])
    return Summary(
        month=month,
        gross=tot("gross"),
        net=tot("net"),
        ordinary=tot("day_rate"),
        ordinary_net=tot("day_rate_net"),
        overtime_pay=tot("overtime_pay"),
        overtime_net=round(ot_net, 2),
        expenses=tot("expenses_total"),
        paid=paid,
        pending=round(tot("total") - paid, 2),
        hours=tot("hours"),
        overtime_hours=tot("overtime_hours"),
        days=len({d["date"] for d in cur}),
        trend=list(trend.values()),
        by_service=sorted(by_svc.values(), key=lambda s: -s.gross),
    )


def _with_money(d: dict) -> dict:
    """Older docs may predate gross/net fields — recompute them on read."""
    if "gross" not in d:
        return compute_shift(ShiftInput(**d), shift_id=d["id"]).model_dump()
    return d
