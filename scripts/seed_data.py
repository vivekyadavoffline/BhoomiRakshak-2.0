import os
import sys
import random
import json
from shapely.geometry import Polygon, Point, mapping
import geopandas as gpd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path so we can import models
sys.path.append(os.path.join(os.path.dirname(__file__), '../backend'))
from app import models
from app.database import Base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bhoomi_rakshak.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)

# Create tables in SQLite
Base.metadata.create_all(bind=engine)

# Central point: somewhere in Uttarakhand/Himachal (fictional region near Dehradun: 30.316, 78.032)
BASE_LAT = 30.316
BASE_LNG = 78.032

def generate_polygon(center_lat, center_lng, size=0.01):
    return Polygon([
        (center_lng - size, center_lat - size),
        (center_lng + size, center_lat - size),
        (center_lng + size, center_lat + size),
        (center_lng - size, center_lat + size)
    ])

def seed_data():
    session = Session()
    
    print("Clearing existing data...")
    session.query(models.Feedback).delete()
    session.query(models.LegalCertificate).delete()
    session.query(models.RedZone).delete()
    session.query(models.HazardZone).delete()
    session.query(models.Habitation).delete()
    session.query(models.CandidateSite).delete()
    session.commit()

    print("Generating Hazard Zones...")
    hazards = []
    for i in range(5):
        lat = BASE_LAT + random.uniform(-0.1, 0.1)
        lng = BASE_LNG + random.uniform(-0.1, 0.1)
        geom = json.dumps(mapping(generate_polygon(lat, lng, random.uniform(0.01, 0.03))))
        hazards.append(models.HazardZone(
            hazard_type=random.choice(["Landslide", "Flood", "Erosion"]),
            intensity=random.randint(5, 10),
            historical_casualties=random.randint(0, 50),
            geom=geom
        ))
    session.bulk_save_objects(hazards)

    print("Generating Habitations...")
    habs = []
    for i in range(15):
        lat = BASE_LAT + random.uniform(-0.1, 0.1)
        lng = BASE_LNG + random.uniform(-0.1, 0.1)
        geom = json.dumps(mapping(generate_polygon(lat, lng, 0.005)))
        habs.append(models.Habitation(
            name=f"Village {chr(65+i)}{i}",
            population=random.randint(100, 1000),
            elderly_pct=random.uniform(5, 30),
            disabled_pct=random.uniform(1, 10),
            income_bracket=random.choice(["Low", "Medium", "High"]),
            housing_quality=random.choice(["Kutcha", "Semi-Pucca", "Pucca"]),
            occupation_type=random.choice(["Agriculture", "Labor", "Service"]),
            dependency_ratio=random.uniform(0.3, 0.8),
            geom=geom
        ))
    session.bulk_save_objects(habs)

    print("Generating Candidate Relocation Sites...")
    sites = []
    for i in range(3):
        lat = BASE_LAT + random.uniform(-0.15, 0.15)
        lng = BASE_LNG + random.uniform(-0.15, 0.15)
        geom = json.dumps(mapping(generate_polygon(lat, lng, 0.02)))
        sites.append(models.CandidateSite(
            name=f"Safe Camp {i+1}",
            max_capacity=random.randint(1500, 3000),
            water_availability=True,
            power_availability=True,
            sanitation=random.choice([True, False]),
            proximity_to_services=random.uniform(1, 20),
            geom=geom
        ))
    session.bulk_save_objects(sites)

    session.commit()
    print("Seeding complete!")

if __name__ == "__main__":
    seed_data()
