"""Covers: pending 'lavoro' bookings show up in /bookings (opzione excluded by filtering
logic replicated from the frontend), and completing a day via POST /shifts with pause_taken
False yields overtime_hours = (hours - standard_hours) + 1, matching the UI's shift-dialog math.

Uses December 2026 dates distinct from the browser-check dates (10/11/12) to avoid clashing
with that check's fixtures: 2026-12-20 (lavoro, to complete) and 2026-12-21 (opzione, control).
"""

import httpx
import pytest

IFET = "IFET"
LAVORO_DATE = "2026-12-20"
OPZIONE_DATE = "2026-12-21"
NOTE = "TEST-PEND"


@pytest.fixture
def cleanup(client: httpx.Client):
    created_shift_ids = []
    yield created_shift_ids
    client.delete(f"/bookings/{LAVORO_DATE}")
    client.delete(f"/bookings/{OPZIONE_DATE}")
    for sid in created_shift_ids:
        client.delete(f"/shifts/{sid}")


def test_lavoro_booking_pending_until_shift_completed_with_overtime(client: httpx.Client, cleanup):
    # Create a 'lavoro' booking (pending) and an 'opzione' booking (should never be pending).
    r1 = client.put(f"/bookings/{LAVORO_DATE}", json={"kind": "lavoro", "service_name": IFET, "note": NOTE})
    assert r1.status_code in (200, 201), r1.text
    r2 = client.put(f"/bookings/{OPZIONE_DATE}", json={"kind": "opzione", "service_name": IFET, "note": NOTE})
    assert r2.status_code in (200, 201), r2.text

    rb = client.get("/bookings", params={"month": "2026-12"})
    assert rb.status_code == 200
    bookings = rb.json()
    lavoro_rows = [b for b in bookings if b["date"] == LAVORO_DATE]
    opzione_rows = [b for b in bookings if b["date"] == OPZIONE_DATE]
    assert len(lavoro_rows) == 1 and lavoro_rows[0]["kind"] == "lavoro"
    assert len(opzione_rows) == 1 and opzione_rows[0]["kind"] == "opzione"

    # No shift yet -> still "pending" per frontend rule (kind=lavoro, no shift on that date).
    rs = client.get("/shifts", params={"month": "2026-12"})
    shift_dates = {s["date"] for s in rs.json()}
    assert LAVORO_DATE not in shift_dates

    # Get IFET's configured day_rate / standard_hours (dialog should prefill these).
    services = client.get("/services").json()
    ifet = next(s for s in services if s["name"] == IFET)
    standard_hours = ifet["standard_hours"]
    day_rate = ifet["day_rate"]

    # Complete the day: 08:00-20:00 (12h), pause skipped -> overtime = (12 - standard_hours) + 1
    payload = {
        "date": LAVORO_DATE,
        "service_id": ifet["id"],
        "service_name": IFET,
        "event": NOTE,
        "location": "TEST Forum",
        "role": "",
        "start_time": "08:00",
        "end_time": "20:00",
        "break_minutes": 0,
        "pause_taken": False,
        "day_rate": day_rate,
        "overtime_pct": 20,
        "standard_hours": standard_hours,
        "tax_pct": 0,
        "km": 0,
        "km_rate": 0,
        "meal": 0,
        "other_expenses": 0,
        "status": "da_fatturare",
        "notes": "",
    }
    rc = client.post("/shifts", json=payload)
    assert rc.status_code in (200, 201), rc.text
    created = rc.json()
    cleanup.append(created["id"])

    expected_overtime = (12 - standard_hours) + 1
    assert created["pause_taken"] is False
    assert created["overtime_hours"] == pytest.approx(expected_overtime), created

    # Now the booking must no longer be pending (a shift exists for that date).
    rs2 = client.get("/shifts", params={"month": "2026-12"})
    shift_dates2 = {s["date"] for s in rs2.json()}
    assert LAVORO_DATE in shift_dates2
