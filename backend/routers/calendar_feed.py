"""iCalendar (.ics) feed of bookings + shifts, so FamilyWall / Google / Apple can subscribe by URL.
The feed is public by necessity (calendar apps can't log in) and is protected by an unguessable token."""
import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from lib.dates import today_iso
from lib.db import db
from routers.auth import require_session

router = APIRouter()


class FeedInfo(BaseModel):
    token: str
    path: str  # relative, e.g. /api/calendar/<token>.ics


async def _token(rotate: bool = False) -> str:
    doc = await db.settings.find_one({"_key": "main"}, {"ics_token": 1})
    if doc and doc.get("ics_token") and not rotate:
        return doc["ics_token"]
    tok = secrets.token_urlsafe(24)
    await db.settings.update_one({"_key": "main"}, {"$set": {"ics_token": tok}}, upsert=True)
    return tok


def _info(tok: str) -> FeedInfo:
    return FeedInfo(token=tok, path=f"/api/calendar/{tok}.ics")


@router.get("/calendar/feed", response_model=FeedInfo, dependencies=[Depends(require_session)])
async def feed_info():
    return _info(await _token())


@router.post("/calendar/feed/rotate", response_model=FeedInfo, dependencies=[Depends(require_session)])
async def rotate_feed():
    return _info(await _token(rotate=True))


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> str:
    out, cur = [], line.encode()
    while len(cur) > 75:
        cut = 75 if not out else 74
        while cut > 0 and (cur[cut] & 0xC0) == 0x80:  # don't split a UTF-8 char
            cut -= 1
        out.append(cur[:cut].decode())
        cur = cur[cut:]
    out.append(cur.decode())
    return "\r\n ".join(out)


def _ymd(d: str) -> str:
    return d.replace("-", "")


@router.get("/calendar/{token}.ics")
async def ics_feed(token: str):
    if not secrets.compare_digest(token, await _token()):
        raise HTTPException(status_code=404, detail="Calendario non trovato")
    since = (date.fromisoformat(today_iso()) - timedelta(days=90)).isoformat()
    shifts = await db.shifts.find({"date": {"$gte": since}}, {"_id": 0}).to_list(3000)
    bookings = await db.bookings.find({"date": {"$gte": since}}, {"_id": 0}).to_list(3000)
    shift_dates = {s["date"] for s in shifts}
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AV SHIFT//Calendario lavoro//IT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:AV SHIFT - Lavoro",
        "X-WR-TIMEZONE:Europe/Rome",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
        "BEGIN:VTIMEZONE",
        "TZID:Europe/Rome",
        "BEGIN:DAYLIGHT",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "TZNAME:CEST",
        "DTSTART:19700329T020000",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "TZNAME:CET",
        "DTSTART:19701025T030000",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "END:VTIMEZONE",
    ]
    for b in bookings:
        if b["date"] in shift_dates:
            continue  # the registered shift (with times) represents this day
        label = "Lavoro" if b["kind"] == "lavoro" else "Opzione"
        title = f"{label} - {b['service_name']}" if b.get("service_name") else label
        end = (date.fromisoformat(b["date"]) + timedelta(days=1)).isoformat()
        lines += [
            "BEGIN:VEVENT",
            f"UID:booking-{b['id']}@avshift",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{_ymd(b['date'])}",
            f"DTEND;VALUE=DATE:{_ymd(end)}",
            f"SUMMARY:{_esc(title)}",
            *([f"DESCRIPTION:{_esc(b['note'])}"] if b.get("note") else []),
            f"STATUS:{'CONFIRMED' if b['kind'] == 'lavoro' else 'TENTATIVE'}",
            "TRANSP:OPAQUE",
            "END:VEVENT",
        ]
    for s in shifts:
        start = f"{_ymd(s['date'])}T{s['start_time'].replace(':', '')}00"
        end_day = s["date"]
        if s["end_time"] <= s["start_time"]:  # overnight
            end_day = (date.fromisoformat(s["date"]) + timedelta(days=1)).isoformat()
        end = f"{_ymd(end_day)}T{s['end_time'].replace(':', '')}00"
        title = f"Lavoro - {s['service_name']}"
        desc = " · ".join(x for x in [s.get("event", ""), s.get("role", "")] if x)
        lines += [
            "BEGIN:VEVENT",
            f"UID:shift-{s['id']}@avshift",
            f"DTSTAMP:{stamp}",
            f"DTSTART;TZID=Europe/Rome:{start}",
            f"DTEND;TZID=Europe/Rome:{end}",
            f"SUMMARY:{_esc(title)}",
            *([f"LOCATION:{_esc(s['location'])}"] if s.get("location") else []),
            *([f"DESCRIPTION:{_esc(desc)}"] if desc else []),
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    body = "\r\n".join(_fold(line) for line in lines) + "\r\n"
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="av-shift.ics"', "Cache-Control": "no-cache"},
    )
