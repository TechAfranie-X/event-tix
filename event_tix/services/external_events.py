import os
import logging
from typing import Optional

import httpx

log = logging.getLogger(__name__)

SEATGEEK_API = "https://api.seatgeek.com/2/events"


def search_external_events(keyword: str | None, city: str | None, size: int = 12) -> list[dict]:
    """
    Search for events using SeatGeek API.
    Returns empty list if SEATGEEK_CLIENT_ID is missing or on any error.
    """
    client_id = os.getenv("SEATGEEK_CLIENT_ID")
    if not client_id:
        return []

    params = {
        "client_id": client_id,
        "per_page": size,
    }
    if keyword:
        params["q"] = keyword
    if city:
        params["venue.city"] = city

    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(SEATGEEK_API, params=params)
            if response.status_code != 200:
                log.warning("SeatGeek API returned %s: %s", response.status_code, response.text[:300])
                return []
            
            data = response.json()
            events = data.get("events", [])
            
            result = []
            for e in events:
                # Get best image URL
                best_image_url = None
                performers = e.get("performers", [])
                if performers:
                    first_performer = performers[0]
                    # Try images dict first (prefer "huge")
                    if "images" in first_performer and isinstance(first_performer["images"], dict):
                        best_image_url = first_performer["images"].get("huge") or first_performer["images"].get("large") or first_performer["images"].get("medium") or first_performer["images"].get("small")
                    # Fall back to image field
                    if not best_image_url and first_performer.get("image"):
                        best_image_url = first_performer["image"]
                
                # Get location
                venue = e.get("venue", {})
                location = None
                if venue.get("city") and venue.get("state"):
                    location = f'{venue["city"]}, {venue["state"]}'
                elif venue.get("display_location"):
                    location = venue["display_location"]
                else:
                    location = ""
                
                # Get primary type
                primary_type = "General"
                if e.get("type"):
                    primary_type = e["type"].title()
                elif e.get("taxonomies"):
                    for tax in e["taxonomies"]:
                        if tax.get("primary") is True:
                            primary_type = tax.get("name", "General").title()
                            break
                
                result.append({
                    "source": "seatgeek",
                    "external_id": e["id"],
                    "name": e["title"],
                    "image_url": best_image_url,
                    "location": location,
                    "starts_at": e.get("datetime_local"),
                    "url": e.get("url"),
                    "category": primary_type,
                })
            
            return result
    except Exception as e:
        log.exception("SeatGeek search failed: %s", e)
        return []
