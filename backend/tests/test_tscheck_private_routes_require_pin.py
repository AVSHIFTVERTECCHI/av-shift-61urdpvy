"""Criterion: all private API routes require the PIN session; auth/status is public; /api/status is removed."""

import httpx


def test_private_routes_401_without_cookie(anon_client: httpx.Client):
    paths = [
        "/shifts?month=2026-11",
        "/summary?month=2026-11",
        "/services",
        "/settings",
        "/bookings?month=2026-11",
        "/today",
        "/calendar/feed",
    ]
    for path in paths:
        resp = anon_client.get(path)
        assert resp.status_code == 401, f"GET {path} expected 401, got {resp.status_code}: {resp.text}"

    resp = anon_client.post("/shifts", json={})
    assert resp.status_code == 401, f"POST /shifts expected 401, got {resp.status_code}: {resp.text}"


def test_auth_status_public_and_status_removed(anon_client: httpx.Client):
    resp = anon_client.get("/auth/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["pin_set"] is True
    assert body["authenticated"] is False
    assert body["pin_length"] == 6

    resp = anon_client.get("/status")
    assert resp.status_code == 404
