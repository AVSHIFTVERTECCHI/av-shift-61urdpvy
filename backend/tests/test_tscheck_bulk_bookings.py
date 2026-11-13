"""Backend coverage for POST /api/bookings/bulk and /api/bookings/bulk-delete.

Uses December 2026 (well past the seeded "today" of 2026-11-07) and note "TEST" per
briefing instructions. All fixture rows are deleted at the end via DELETE /api/bookings/{date}.
"""

import httpx
import pytest


MONTH = "2026-12"
DATES = ["2026-12-05", "2026-12-07"]
DEDUP_DATES = ["2026-12-10", "2026-12-08", "2026-12-08"]


@pytest.fixture
def cleanup_dates(client):
    created = []
    yield created
    for d in created:
        client.delete(f"/bookings/{d}")


def test_bulk_create_returns_deduped_sorted_bookings(client: httpx.Client, cleanup_dates):
    payload = {"dates": DEDUP_DATES, "kind": "opzione", "service_name": "", "note": "TEST"}
    resp = client.post("/bookings/bulk", json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    cleanup_dates.extend([b["date"] for b in body])

    dates_out = [b["date"] for b in body]
    assert dates_out == ["2026-12-08", "2026-12-10"], f"expected deduped+sorted dates, got {dates_out}"
    assert all(b["kind"] == "opzione" and b["note"] == "TEST" for b in body)


def test_bulk_create_then_get_month_reflects_and_bulk_delete_clears(client: httpx.Client, cleanup_dates):
    payload = {"dates": DATES, "kind": "lavoro", "service_name": "Rider", "note": "TEST"}
    create_resp = client.post("/bookings/bulk", json=payload)
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    assert {b["date"] for b in created} == set(DATES)
    cleanup_dates.extend(DATES)

    month_resp = client.get(f"/bookings?month={MONTH}")
    assert month_resp.status_code == 200
    month_dates = {b["date"] for b in month_resp.json()}
    assert set(DATES).issubset(month_dates), "GET /bookings?month= should reflect bulk-created bookings"

    del_resp = client.post("/bookings/bulk-delete", json={"dates": DATES})
    assert del_resp.status_code == 204, del_resp.text

    month_resp2 = client.get(f"/bookings?month={MONTH}")
    month_dates2 = {b["date"] for b in month_resp2.json()}
    assert not set(DATES).intersection(month_dates2), "bulk-delete should remove the bookings from the month view"
    cleanup_dates.clear()  # already deleted


@pytest.mark.parametrize("bad_date", ["2026-13-99", "2026-02-30"])
def test_bulk_create_invalid_date_should_be_rejected(client: httpx.Client, cleanup_dates, bad_date):
    """Criterion: POST /api/bookings/bulk with an invalid date -> 422, nothing persisted."""
    payload = {"dates": [bad_date], "kind": "lavoro", "service_name": "", "note": "TEST"}
    resp = client.post("/bookings/bulk", json=payload)
    if resp.status_code == 200:
        cleanup_dates.append(bad_date)
    assert resp.status_code == 422, (
        f"expected 422 for invalid date '{bad_date}', got {resp.status_code}: {resp.text}"
    )
    # confirm nothing persisted (only a well-formed month can be queried)
    month = bad_date[:7]
    if month[5:7].isdigit() and 1 <= int(month[5:7]) <= 12:
        check = client.get(f"/bookings?month={month}")
        if check.status_code == 200:
            assert not any(b["date"] == bad_date for b in check.json()), (
                f"invalid date '{bad_date}' should not be persisted"
            )


def test_bulk_create_valid_dates_still_200(client: httpx.Client, cleanup_dates):
    """Criterion: valid dates still -> 200, unaffected by stricter validation."""
    payload = {"dates": ["2026-12-16"], "kind": "lavoro", "service_name": "", "note": "TEST"}
    resp = client.post("/bookings/bulk", json=payload)
    assert resp.status_code == 200, resp.text
    cleanup_dates.append("2026-12-16")


def test_bulk_delete_invalid_date_should_be_rejected(client: httpx.Client):
    """Criterion: POST /api/bookings/bulk-delete with an invalid date -> 422."""
    resp = client.post("/bookings/bulk-delete", json={"dates": ["2026-13-99"]})
    assert resp.status_code == 422, (
        f"expected 422 for invalid date in bulk-delete, got {resp.status_code}: {resp.text}"
    )


def test_put_booking_invalid_date_should_be_rejected(client: httpx.Client):
    """Criterion: PUT /api/bookings/2026-13-99 -> 422."""
    resp = client.put("/bookings/2026-13-99", json={"kind": "lavoro", "service_name": "", "note": "TEST"})
    assert resp.status_code == 422, (
        f"expected 422 for PUT with invalid date, got {resp.status_code}: {resp.text}"
    )


def test_put_booking_valid_date_still_works(client: httpx.Client, cleanup_dates):
    """Criterion: valid dates still work for PUT /api/bookings/{date}."""
    date = "2026-12-17"
    resp = client.put(f"/bookings/{date}", json={"kind": "lavoro", "service_name": "", "note": "TEST"})
    assert resp.status_code in (200, 204), resp.text
    cleanup_dates.append(date)


SHIFT_BASE = {
    "service_name": "TEST",
    "start_time": "09:00",
    "end_time": "17:00",
    "day_rate": 100,
}


def test_post_shift_invalid_date_should_be_rejected(client: httpx.Client):
    """Criterion: POST /api/shifts with date '2026-13-01' -> 422."""
    payload = {**SHIFT_BASE, "date": "2026-13-01"}
    resp = client.post("/shifts", json=payload)
    if resp.status_code in (200, 201):
        shift_id = resp.json().get("id")
        if shift_id:
            client.delete(f"/shifts/{shift_id}")
    assert resp.status_code == 422, (
        f"expected 422 for POST /shifts with invalid date, got {resp.status_code}: {resp.text}"
    )


def test_post_shift_valid_date_still_200(client: httpx.Client):
    """Criterion: valid dates still -> 200/201 for POST /api/shifts."""
    payload = {**SHIFT_BASE, "date": "2026-12-18"}
    resp = client.post("/shifts", json=payload)
    assert resp.status_code in (200, 201), resp.text
    shift_id = resp.json().get("id")
    assert shift_id
    client.delete(f"/shifts/{shift_id}")
