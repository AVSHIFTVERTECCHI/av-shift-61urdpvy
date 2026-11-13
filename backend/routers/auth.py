"""PIN access: one PIN for the whole app (single user). Session = random token in an httpOnly cookie."""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from pydantic import BaseModel, Field

from lib.db import db

router = APIRouter(prefix="/auth")

COOKIE = "avshift_session"
SESSION_DAYS = 90
MAX_FAILS = 5
LOCK_MINUTES = 5
PIN = Field(pattern=r"^\d{4,6}$")


class PinBody(BaseModel):
    pin: str = PIN


class ChangePin(BaseModel):
    current: str = PIN
    new: str = PIN


class AuthStatus(BaseModel):
    pin_set: bool
    authenticated: bool
    pin_length: int = 0


def _hash(pin: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, 200_000).hex()


async def _auth_doc() -> dict | None:
    return await db.auth.find_one({"_key": "pin"}, {"_id": 0})


async def _session_valid(token: str | None) -> bool:
    if not token:
        return False
    doc = await db.sessions.find_one({"token": token}, {"_id": 0, "expires_at": 1})
    if not doc:
        return False
    exp = doc["expires_at"].replace(tzinfo=timezone.utc)
    return exp > datetime.now(timezone.utc)


async def require_session(request: Request) -> None:
    """Dependency for every private route."""
    if not await _session_valid(request.cookies.get(COOKIE)):
        raise HTTPException(status_code=401, detail="PIN richiesto")


async def _open_session(response: Response) -> None:
    token = secrets.token_urlsafe(32)
    exp = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    await db.sessions.insert_one({"token": token, "expires_at": exp})
    response.set_cookie(
        COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, secure=True, samesite="lax", path="/"
    )


async def _check_lock() -> None:
    doc = await _auth_doc() or {}
    until = doc.get("locked_until")
    if until and until.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
        mins = max(1, int((until.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).total_seconds() // 60) + 1)
        raise HTTPException(status_code=429, detail=f"Troppi tentativi. Riprova tra {mins} minuti")


async def _verify(pin: str) -> bool:
    doc = await _auth_doc()
    if not doc or "pin_hash" not in doc:
        return False
    ok = hmac.compare_digest(_hash(pin, bytes.fromhex(doc["salt"])), doc["pin_hash"])
    if ok:
        await db.auth.update_one({"_key": "pin"}, {"$set": {"fails": 0, "locked_until": None}})
    else:
        fails = doc.get("fails", 0) + 1
        upd: dict = {"fails": fails}
        if fails >= MAX_FAILS:
            upd = {"fails": 0, "locked_until": datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)}
        await db.auth.update_one({"_key": "pin"}, {"$set": upd})
    return ok


async def _store_pin(pin: str) -> None:
    salt = os.urandom(16)
    await db.auth.update_one(
        {"_key": "pin"},
        {"$set": {"salt": salt.hex(), "pin_hash": _hash(pin, salt), "pin_length": len(pin), "fails": 0, "locked_until": None}},
        upsert=True,
    )


@router.get("/status", response_model=AuthStatus)
async def status(avshift_session: str | None = Cookie(default=None)):
    doc = await _auth_doc()
    pin_set = bool(doc and doc.get("pin_hash"))
    return AuthStatus(
        pin_set=pin_set,
        authenticated=pin_set and await _session_valid(avshift_session),
        pin_length=doc.get("pin_length", 0) if pin_set else 0,
    )


@router.post("/setup", response_model=AuthStatus)
async def setup(body: PinBody, response: Response):
    doc = await _auth_doc()
    if doc and doc.get("pin_hash"):
        raise HTTPException(status_code=409, detail="PIN già impostato")
    await _store_pin(body.pin)
    await _open_session(response)
    return AuthStatus(pin_set=True, authenticated=True, pin_length=len(body.pin))


@router.post("/login", response_model=AuthStatus)
async def login(body: PinBody, response: Response):
    await _check_lock()
    if not await _verify(body.pin):
        await _check_lock()  # this attempt may have triggered the lock
        raise HTTPException(status_code=401, detail="PIN errato")
    await _open_session(response)
    return AuthStatus(pin_set=True, authenticated=True, pin_length=len(body.pin))


@router.post("/logout", status_code=204)
async def logout(response: Response, avshift_session: str | None = Cookie(default=None)):
    if avshift_session:
        await db.sessions.delete_one({"token": avshift_session})
    response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="lax")


@router.post("/change-pin", status_code=204)
async def change_pin(body: ChangePin, request: Request):
    await require_session(request)
    await _check_lock()
    if not await _verify(body.current):
        raise HTTPException(status_code=401, detail="PIN attuale errato")
    await _store_pin(body.new)
    # sign out every other device
    await db.sessions.delete_many({"token": {"$ne": request.cookies.get(COOKIE)}})
