"""Pre-scaffolded pytest fixtures for the FastAPI backend.

Tests hit the live uvicorn process managed by supervisor (not an in-process ASGI app), so
the app under test is the same one the frontend and Playwright see. Do NOT re-create this
file — add app-specific fixtures below the marker at the bottom.
"""

import os

import httpx
import pytest
import pytest_asyncio

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"


def api_url(path: str = "") -> str:
    """Absolute URL for an /api route: api_url("/status") -> http://localhost:8001/api/status."""
    return f"{API_URL}{path}"


@pytest.fixture(scope="session")
def backend_url() -> str:
    return BACKEND_URL


PIN = os.environ.get("TSCHECK_PIN", "567890")


@pytest.fixture
def client():
    """Sync httpx client rooted at /api — the default for endpoint tests.

    Auto-authenticates with the app's PIN session (private routes return 401
    otherwise) so existing feature tests keep working after PIN auth was added.

    The session cookie is Secure, and httpx's stdlib-backed cookie jar (like real
    browsers) refuses to resend Secure cookies over a plain-http plain base_url,
    so we capture the raw Set-Cookie value and pin it as an explicit header
    instead of relying on jar auto-resend.
    """
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        resp = c.post("/auth/login", json={"pin": PIN})
        raw_cookie = resp.headers.get("set-cookie", "")
        session_value = raw_cookie.split("avshift_session=", 1)[-1].split(";", 1)[0] if "avshift_session" in raw_cookie else ""
        if session_value:
            c.headers["Cookie"] = f"avshift_session={session_value}"
        yield c


@pytest.fixture
def anon_client():
    """Sync httpx client rooted at /api, WITHOUT logging in — for auth-check tests."""
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        yield c


@pytest_asyncio.fixture
async def aclient():
    """Async variant, for tests that also await motor/backend helpers directly."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=30.0) as c:
        yield c


# --- app-specific fixtures below this line ---
