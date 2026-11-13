"""Criterion: FamilyWall .ics feed stays public but token-protected.

Logs in to obtain the feed path (token), then verifies the .ics file itself is
reachable WITHOUT any cookie (public), and that a wrong token is 404.
"""

import os

import httpx

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")


def test_calendar_feed_public_with_valid_token_and_404_for_wrong_token(client: httpx.Client):
    # `client` fixture already logged in -> discover the authenticated feed path/token.
    feed = client.get("/calendar/feed")
    assert feed.status_code == 200, feed.text
    body = feed.json()
    assert "path" in body and body["path"].endswith(".ics")
    feed_path = body["path"]

    # Hit the .ics path with a brand-new, cookie-less client -> must be public.
    with httpx.Client(base_url=BACKEND_URL) as anon:
        resp = anon.get(feed_path)
        assert resp.status_code == 200, resp.text
        assert "text/calendar" in resp.headers.get("content-type", "")

        wrong = anon.get("/api/calendar/wrongtoken.ics")
        assert wrong.status_code == 404
