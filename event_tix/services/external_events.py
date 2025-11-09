"""
External events service for fetching events from Ticketmaster Discovery API
"""
import os
import requests
import logging
from typing import Optional, List, Dict
from datetime import datetime

logger = logging.getLogger(__name__)

# Category-based Unsplash placeholders
CATEGORY_IMAGES = {
    "Technology": "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200&q=80&auto=format&fit=crop",
    "Music": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80&auto=format&fit=crop",
    "Business": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80&auto=format&fit=crop",
    "General": "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=80&auto=format&fit=crop"
}


def fetch_ticketmaster_events(
    city: Optional[str] = None,
    keyword: Optional[str] = None,
    size: int = 24
) -> List[Dict]:
    """
    Fetch events from Ticketmaster Discovery API
    
    Args:
        city: City name to filter events
        keyword: Search keyword
        size: Number of events to return (default 24)
    
    Returns:
        List of event dictionaries with standardized format
    """
    api_key = os.getenv("TM_API_KEY")
    
    if not api_key:
        logger.info("TM_API_KEY not found in environment, skipping Ticketmaster fetch")
        return []
    
    try:
        url = "https://app.ticketmaster.com/discovery/v2/events.json"
        params = {
            "apikey": api_key,
            "size": min(size, 200),  # Ticketmaster max is 200
            "sort": "date,asc"
        }
        
        if keyword:
            params["keyword"] = keyword
        
        if city:
            params["city"] = city
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Ticketmaster response structure: _embedded.events
        events = data.get("_embedded", {}).get("events", [])
        
        result = []
        for event in events:
            try:
                # Extract name
                name = event.get("name", "Untitled Event")
                
                # Extract image URL (prefer large, fallback to any)
                image_url = None
                images = event.get("images", [])
                if images:
                    # Prefer large images
                    large_images = [img for img in images if img.get("width", 0) >= 1024]
                    if large_images:
                        image_url = large_images[0].get("url")
                    else:
                        image_url = images[0].get("url")
                
                # Extract location
                location_parts = []
                venues = event.get("_embedded", {}).get("venues", [])
                if venues:
                    venue = venues[0]
                    city_name = venue.get("city", {}).get("name")
                    state = venue.get("state", {}).get("name")
                    country = venue.get("country", {}).get("name")
                    
                    if city_name:
                        location_parts.append(city_name)
                    if state:
                        location_parts.append(state)
                    elif country:
                        location_parts.append(country)
                
                location = ", ".join(location_parts) if location_parts else "Location TBD"
                
                # Extract start date
                starts_at = None
                dates = event.get("dates", {})
                start_date = dates.get("start", {})
                if start_date.get("dateTime"):
                    try:
                        starts_at = datetime.fromisoformat(
                            start_date["dateTime"].replace("Z", "+00:00")
                        ).isoformat()
                    except (ValueError, KeyError):
                        pass
                elif start_date.get("localDate"):
                    try:
                        starts_at = datetime.fromisoformat(
                            f"{start_date['localDate']}T00:00:00"
                        ).isoformat()
                    except (ValueError, KeyError):
                        pass
                
                # Extract category/segment
                category = "General"
                classifications = event.get("classifications", [])
                if classifications:
                    segment = classifications[0].get("segment", {})
                    segment_name = segment.get("name")
                    if segment_name:
                        category = segment_name
                
                # Extract URL
                url = event.get("url")
                
                # Extract external ID
                external_id = event.get("id")
                
                result.append({
                    "source": "ticketmaster",
                    "external_id": external_id,
                    "name": name,
                    "image_url": image_url,
                    "location": location,
                    "starts_at": starts_at,
                    "url": url,
                    "category": category
                })
            except Exception as e:
                logger.warning(f"Error processing Ticketmaster event: {e}")
                continue
        
        return result
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching from Ticketmaster API: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error in fetch_ticketmaster_events: {e}")
        return []


def get_category_image(category: Optional[str]) -> str:
    """
    Get Unsplash placeholder image URL based on category
    
    Args:
        category: Event category name
    
    Returns:
        Unsplash image URL
    """
    if not category:
        return CATEGORY_IMAGES["General"]
    
    # Try exact match first
    if category in CATEGORY_IMAGES:
        return CATEGORY_IMAGES[category]
    
    # Try case-insensitive match
    category_lower = category.lower()
    for key, url in CATEGORY_IMAGES.items():
        if key.lower() == category_lower:
            return url
    
    # Default fallback
    return CATEGORY_IMAGES["General"]

