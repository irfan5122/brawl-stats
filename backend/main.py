from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=True)

API_KEY = os.getenv("BRAWL_STARS_API_KEY", "").strip()
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").strip()

SUPERCELL_API = "https://api.brawlstars.com/v1"
BRAWLAPI_CATALOG = "https://api.brawlapi.com/v1/brawlers"
CACHE_SECONDS = 300

app = FastAPI(
    title="Brawl Stats API",
    description="Backend for the Brawl Stats brawler gallery.",
    version="1.0.0",
)

origins = list(dict.fromkeys([
    FRONTEND_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_catalog_cache: dict[str, Any] = {"expires": 0.0, "items": {}}


def normalise_class(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("name", "Unknown")
    if not isinstance(value, str) or not value.strip():
        return "Unknown"
    return value.strip()


def item_list(value: Any) -> list[dict[str, Any]] | None:
    """Return a list when the endpoint supplies one; None means unavailable."""
    if not isinstance(value, list):
        return None
    return [item for item in value if isinstance(item, dict)]


async def get_catalogue() -> dict[str, dict[str, Any]]:
    now = time.monotonic()
    if _catalog_cache["expires"] > now:
        return _catalog_cache["items"]

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(BRAWLAPI_CATALOG)
            response.raise_for_status()
            payload = response.json()

        if isinstance(payload, dict):
            records = payload.get("list", payload.get("brawlers", []))
        elif isinstance(payload, list):
            records = payload
        else:
            records = []

        catalogue: dict[str, dict[str, Any]] = {}
        for record in records:
            if not isinstance(record, dict):
                continue
            name = str(record.get("name", "")).strip()
            if not name:
                continue
            catalogue[name.casefold()] = {
                "class": normalise_class(record.get("class")),
                "gadgets": record.get("gadgets"),
                "starPowers": record.get("starPowers"),
                "gears": record.get("gears"),
                "imageUrl": record.get("imageUrl") or record.get("image"),
            }

        _catalog_cache.update({
            "expires": now + CACHE_SECONDS,
            "items": catalogue,
        })
        return catalogue
    except (httpx.HTTPError, ValueError, TypeError):
        # Player stats remain usable if the third-party catalogue is down.
        return _catalog_cache.get("items", {})


def owned_count(owned: Any, available: Any) -> dict[str, Any]:
    if not isinstance(owned, list):
        return {"owned": None, "available": None, "label": "—"}

    owned_count_value = len(owned)
    available_count = len(available) if isinstance(available, list) else None
    label = (
        f"{owned_count_value}/{available_count}"
        if available_count is not None and available_count > 0
        else str(owned_count_value)
    )
    return {
        "owned": owned_count_value,
        "available": available_count,
        "label": label,
    }


def equipment_names(value: Any) -> list[str] | None:
    if not isinstance(value, list):
        return None
    names: list[str] = []
    for item in value:
        if isinstance(item, dict):
            name = item.get("name") or item.get("id")
            if name is not None:
                names.append(str(name))
    return names


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "Brawl Stats API"}


@app.get("/api/player")
async def get_player(
    tag: str = Query(..., min_length=2, max_length=30, description="Player tag, with or without #"),
) -> dict[str, Any]:
    if not API_KEY:
        raise HTTPException(
            status_code=500,
            detail="BRAWL_STARS_API_KEY is missing. Add it to backend/.env and restart the backend.",
        )

    clean_tag = tag.strip().upper().replace("#", "")
    if not clean_tag:
        raise HTTPException(status_code=400, detail="Enter a valid player tag.")

    encoded_tag = quote(f"#{clean_tag}", safe="")
    headers = {"Authorization": f"Bearer {API_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{SUPERCELL_API}/players/{encoded_tag}",
                headers=headers,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Brawl Stars API timed out. Try again.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not connect to Brawl Stars API.")

    if response.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail="Brawl Stars API denied access. Check your API key and the public IP allowlist.",
        )
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Player not found. Check the player tag.")
    if response.status_code == 400:
        raise HTTPException(status_code=400, detail="Invalid player tag.")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Brawl Stars API rate limit reached. Wait and retry.")
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Brawl Stars API returned HTTP {response.status_code}.",
        )

    try:
        player = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Brawl Stars API returned invalid JSON.")

    catalogue = await get_catalogue()
    brawlers: list[dict[str, Any]] = []

    for raw in player.get("brawlers", []):
        if not isinstance(raw, dict):
            continue

        name = str(raw.get("name", "Unknown"))
        metadata = catalogue.get(name.casefold(), {})
        current_trophies = int(raw.get("trophies", 0) or 0)

        gadgets = raw.get("gadgets")
        star_powers = raw.get("starPowers")
        gears = raw.get("gears")

        # Some API responses can omit equipment fields. In that case the
        # frontend receives unavailable values rather than false claims.
        brawlers.append({
            "id": raw.get("id"),
            "name": name,
            "className": metadata.get("class", "Unknown"),
            "trophies": current_trophies,
            "highestTrophies": raw.get("highestTrophies"),
            "power": raw.get("power"),
            "rank": raw.get("rank"),
            "imageUrl": metadata.get("imageUrl"),
            "starPowers": owned_count(star_powers, metadata.get("starPowers")),
            "gadgets": owned_count(gadgets, metadata.get("gadgets")),
            "gears": equipment_names(gears),
        })

    brawlers.sort(key=lambda b: (-b["trophies"], b["name"].casefold()))

    qualifying = [b for b in brawlers if b["trophies"] >= 1000]
    below = [b for b in brawlers if b["trophies"] < 1000]

    # Sorted alphabetically by class; descending current trophies inside each class.
    for collection in (qualifying, below):
        collection.sort(
            key=lambda b: (b["className"].casefold(), -b["trophies"], b["name"].casefold())
        )

    return {
        "player": {
            "name": player.get("name", "Player"),
            "tag": f"#{clean_tag}",
            "trophies": player.get("trophies"),
            "highestTrophies": player.get("highestTrophies"),
            "expLevel": player.get("expLevel"),
            "iconUrl": None,
        },
        "summary": {
            "totalBrawlers": len(brawlers),
            "qualifiedCount": len(qualifying),
            "belowCount": len(below),
            "power11Count": sum(1 for b in brawlers if b["power"] == 11),
            "highestBrawlerTrophies": max((b["trophies"] for b in brawlers), default=0),
        },
        "brawlers": brawlers,
    }
