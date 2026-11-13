import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, db, ensure_indexes


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())  # background: a big index build must not block boot
    yield
    app.state.index_task.cancel()  # stop a build still running before its client closes
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

from routers.shifts import router as shifts_router  # noqa: E402
from routers.bookings import router as bookings_router  # noqa: E402
from routers.calendar_feed import router as calendar_feed_router  # noqa: E402
from routers.auth import router as auth_router, require_session  # noqa: E402
from fastapi import Depends  # noqa: E402

# Everything is behind the PIN session except /api/auth/* and the token-protected .ics feed
# (calendar_feed guards its own non-feed routes).
_private = [Depends(require_session)]
api_router.include_router(auth_router)
api_router.include_router(shifts_router, dependencies=_private)
api_router.include_router(bookings_router, dependencies=_private)
api_router.include_router(calendar_feed_router)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
