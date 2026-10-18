import requests
import logging
from sqlalchemy.orm import Session
import json
from . import models

logger = logging.getLogger(__name__)

def fetch_live_earthquakes(db: Session):
    """
    Fetches real-time earthquake data from USGS (2.5+ magnitude in the last day).
    Filters for events near India roughly (Lat: 6-36, Lon: 68-98).
    Creates or updates HazardZones.
    """
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # Bounding box for India roughly
        min_lat, max_lat = 6.0, 36.0
        min_lon, max_lon = 68.0, 98.0
        
        added = 0
        for feature in data.get("features", []):
            coords = feature["geometry"]["coordinates"]
            lon, lat = coords[0], coords[1]
            mag = feature["properties"]["mag"]
            
            if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
                # This is a significant event in/near India
                # Map magnitude to intensity (1-100)
                intensity = min(100, int((mag - 2.0) * 20))
                
                geom = {
                    "type": "Point",
                    "coordinates": [lon, lat]
                }
                
                hz = models.HazardZone(
                    hazard_type="earthquake",
                    intensity=intensity,
                    historical_casualties=0,
                    geom=json.dumps(geom)
                )
                db.add(hz)
                added += 1
                
        db.commit()
        return added
    except Exception as e:
        logger.error(f"Error fetching live earthquakes: {e}")
        return 0

def fetch_live_weather(db: Session):
    """
    Fetches real-time extreme weather (precipitation proxy for floods/landslides) from Open-Meteo.
    Using a sample set of coordinates in India.
    """
    # Sample points representing vulnerable regions (Assam, Uttarakhand, Kerala)
    points = [
        {"lat": 26.2006, "lon": 92.9376, "name": "Assam Flood Plains"},
        {"lat": 30.0668, "lon": 79.0193, "name": "Uttarakhand Slopes"},
        {"lat": 10.8505, "lon": 76.2711, "name": "Kerala Coast"}
    ]
    
    added = 0
    for p in points:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={p['lat']}&longitude={p['lon']}&daily=precipitation_sum,rain_sum&timezone=Asia%2FKolkata"
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Check today's expected precipitation
            if "daily" in data and "precipitation_sum" in data["daily"]:
                precip = data["daily"]["precipitation_sum"][0]
                if precip > 0:
                    # Convert precip (mm) to intensity (1-100)
                    # 100mm/day is extreme (100 intensity)
                    intensity = min(100, int(precip))
                    
                    # Assume heavy rain causes both flood and landslide risk depending on the region
                    hazard_type = "flood" if "Flood" in p["name"] or "Coast" in p["name"] else "landslide"
                    
                    geom = {
                        "type": "Point",
                        "coordinates": [p["lon"], p["lat"]]
                    }
                    
                    hz = models.HazardZone(
                        hazard_type=hazard_type,
                        intensity=intensity,
                        historical_casualties=0,
                        geom=json.dumps(geom)
                    )
                    db.add(hz)
                    added += 1
        except Exception as e:
            logger.error(f"Error fetching live weather for {p['name']}: {e}")
            
    db.commit()
    return added

def sync_live_feeds(db: Session):
    """
    Clear old live events (optional, for demo we can just append or clear all hazards to reset)
    and fetch new ones.
    """
    # For a fresh demo state, we might want to clear existing hazards to see only live ones.
    # However, to avoid deleting generated data if desired, we'll just clear generated ones.
    # Or simply append. We will clear the existing ones so the demo shows real data.
    db.query(models.HazardZone).delete()
    db.commit()
    
    eq_added = fetch_live_earthquakes(db)
    we_added = fetch_live_weather(db)
    
    return {"earthquakes_added": eq_added, "weather_events_added": we_added}
