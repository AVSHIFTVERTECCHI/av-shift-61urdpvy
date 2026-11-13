"""Idempotent seed: the user's real services (from TABELLA ORARI 2026.xlsx), only if none exist.
Run: python seed.py            -> insert services if empty
     python seed.py --reset    -> wipe services + shifts + settings, then insert services
"""
import asyncio
import sys

from lib.db import db, ensure_indexes
from models.shift import Service

SERVICES = [
    "F.A.R.E. Servizi", "365 SRL", "Anteprima Video", "IFET", "Ciccarelli", "VMS",
    "Tecnoservice 2000", "B-NOMIO", "StudioVisio", "DHS", "Mondialtecnica", "One Group",
]
DEFAULT_RATE = 200


async def main():
    if "--reset" in sys.argv:
        for c in ("services", "shifts", "settings"):
            await db[c].drop()
    await ensure_indexes()
    if await db.services.count_documents({}) > 0:
        print("services already present")
        return
    await db.services.insert_many([Service(name=n, day_rate=DEFAULT_RATE).model_dump() for n in SERVICES])
    print(f"seeded {len(SERVICES)} services @ {DEFAULT_RATE}€")


if __name__ == "__main__":
    asyncio.run(main())
