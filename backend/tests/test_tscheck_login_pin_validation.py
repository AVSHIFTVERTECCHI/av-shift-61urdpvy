"""Criterion: login with correct/incorrect PIN, malformed PIN validation, setup conflict.

Only ONE wrong-PIN attempt is issued here (shared lockout budget with other suites/checks) -
never enough on its own to trigger the 5-attempt lockout, and fails are reset by the
browser flow's own login attempts around it as well.
"""

import httpx


def test_login_wrong_then_correct_pin_and_cookie_grants_access(anon_client: httpx.Client):
    # Wrong PIN -> 401 "PIN errato", no cookie set.
    wrong = anon_client.post("/auth/login", json={"pin": "000111"})
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "PIN errato"

    # Malformed PIN -> 422.
    malformed = anon_client.post("/auth/login", json={"pin": "12"})
    assert malformed.status_code == 422

    # Correct PIN -> 200 + Set-Cookie avshift_session (HttpOnly; Secure; SameSite=lax).
    ok = anon_client.post("/auth/login", json={"pin": "567890"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["authenticated"] is True
    set_cookie = ok.headers.get("set-cookie", "")
    assert "avshift_session" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "lax" in set_cookie.lower()

    # Cookie jar on `anon_client` cannot resend this Secure cookie over plain http
    # (same stdlib-cookiejar behaviour as the `client` fixture) -> pin it manually.
    session_value = set_cookie.split("avshift_session=", 1)[-1].split(";", 1)[0]
    anon_client.headers["Cookie"] = f"avshift_session={session_value}"
    private = anon_client.get("/services")
    assert private.status_code == 200, private.text


def test_setup_conflict_when_pin_already_exists(client: httpx.Client):
    resp = client.post("/auth/setup", json={"pin": "999999"})
    assert resp.status_code == 409, resp.text
