import os
import sys
import random
import json
import re
from shapely.geometry import Polygon, mapping
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path so we can import models and database
sys.path.append(os.path.join(os.path.dirname(__file__), '../backend'))
from app import models
from app.database import Base

DATABASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend/bhoomi_rakshak.db'))
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)

# Ensure tables exist
Base.metadata.create_all(bind=engine)

PAN_INDIA_DISTRICTS = {
    # Northern States & UTs
    "Chamoli, Uttarakhand": {"state": "Uttarakhand", "region": "North", "coords": [30.418, 79.336], "hazard": "Landslide & glacial flood", "icon": "landslide"},
    "Rudraprayag, Uttarakhand": {"state": "Uttarakhand", "region": "North", "coords": [30.285, 78.981], "hazard": "Flash flood & cloudburst", "icon": "flood"},
    "Uttarkashi, Uttarakhand": {"state": "Uttarakhand", "region": "North", "coords": [30.726, 78.435], "hazard": "Slope instability & seismic tremor", "icon": "landslide"},
    "Pithoragarh, Uttarakhand": {"state": "Uttarakhand", "region": "North", "coords": [29.583, 80.217], "hazard": "Flash flood & landslide", "icon": "landslide"},
    "Dehradun, Uttarakhand": {"state": "Uttarakhand", "region": "North", "coords": [30.316, 78.032], "hazard": "Riverine erosion & waterlogging", "icon": "flood"},
    "Kinnaur, Himachal Pradesh": {"state": "Himachal Pradesh", "region": "North", "coords": [31.650, 78.475], "hazard": "High-altitude rockfall & debris flow", "icon": "landslide"},
    "Kullu, Himachal Pradesh": {"state": "Himachal Pradesh", "region": "North", "coords": [31.958, 77.109], "hazard": "River overflow & cloudburst", "icon": "flood"},
    "Shimla, Himachal Pradesh": {"state": "Himachal Pradesh", "region": "North", "coords": [31.104, 77.173], "hazard": "Hill slope subsidence & land slip", "icon": "landslide"},
    "Mandi, Himachal Pradesh": {"state": "Himachal Pradesh", "region": "North", "coords": [31.708, 76.932], "hazard": "Beas river flash flood", "icon": "flood"},
    "Anantnag, Jammu & Kashmir": {"state": "Jammu & Kashmir", "region": "North", "coords": [33.731, 75.155], "hazard": "Jhelum riverine flood", "icon": "flood"},
    "Srinagar, Jammu & Kashmir": {"state": "Jammu & Kashmir", "region": "North", "coords": [34.083, 74.797], "hazard": "Urban basin inundation", "icon": "flood"},
    "Baramulla, Jammu & Kashmir": {"state": "Jammu & Kashmir", "region": "North", "coords": [34.198, 74.364], "hazard": "Seismic fault tremor & soil liquefaction", "icon": "earthquake"},
    "Leh, Ladakh": {"state": "Ladakh", "region": "North", "coords": [34.152, 77.577], "hazard": "Glacial lake outburst & cloudburst", "icon": "flood"},
    "East Delhi, Delhi": {"state": "Delhi", "region": "North", "coords": [28.668, 77.302], "hazard": "Yamuna riverine flood & bank erosion", "icon": "flood"},
    "North Delhi, Delhi": {"state": "Delhi", "region": "North", "coords": [28.724, 77.202], "hazard": "Monsoon basin waterlogging", "icon": "flood"},
    "South Delhi, Delhi": {"state": "Delhi", "region": "North", "coords": [28.545, 77.252], "hazard": "Urban stormwater surge", "icon": "flood"},
    
    # Eastern & Northeastern States
    "Majuli, Assam": {"state": "Assam", "region": "Northeast", "coords": [27.000, 94.200], "hazard": "Brahmaputra island erosion & severe flooding", "icon": "flood"},
    "Guwahati, Assam": {"state": "Assam", "region": "Northeast", "coords": [26.144, 91.736], "hazard": "Urban hill slope slippage & waterlogging", "icon": "landslide"},
    "Dima Hasao, Assam": {"state": "Assam", "region": "Northeast", "coords": [25.180, 93.020], "hazard": "Hill railway corridor landslides", "icon": "landslide"},
    "East Khasi Hills, Meghalaya": {"state": "Meghalaya", "region": "Northeast", "coords": [25.578, 91.893], "hazard": "Extreme rainfall slope wash", "icon": "landslide"},
    "Papum Pare, Arunachal Pradesh": {"state": "Arunachal Pradesh", "region": "Northeast", "coords": [27.100, 93.600], "hazard": "High-velocity river flood & debris avalanche", "icon": "flood"},
    "Aizawl, Mizoram": {"state": "Mizoram", "region": "Northeast", "coords": [23.727, 92.717], "hazard": "Urban slope subsidence & fissures", "icon": "landslide"},
    "Kohima, Nagaland": {"state": "Nagaland", "region": "Northeast", "coords": [25.675, 94.108], "hazard": "Faultline fissure & monsoon landslide", "icon": "landslide"},
    "Gangtok, Sikkim": {"state": "Sikkim", "region": "Northeast", "coords": [27.338, 88.606], "hazard": "Teesta river basin flash flood & rockslide", "icon": "landslide"},
    "Imphal West, Manipur": {"state": "Manipur", "region": "Northeast", "coords": [24.817, 93.936], "hazard": "Valley inundation & riverbank collapse", "icon": "flood"},
    "South 24 Parganas, West Bengal": {"state": "West Bengal", "region": "East", "coords": [22.135, 88.543], "hazard": "Sundarbans coastal storm surge & embankment breach", "icon": "cyclone"},
    "Darjeeling, West Bengal": {"state": "West Bengal", "region": "East", "coords": [27.041, 88.266], "hazard": "Tea-slope mudflow & road collapse", "icon": "landslide"},
    "Kolkata, West Bengal": {"state": "West Bengal", "region": "East", "coords": [22.572, 88.363], "hazard": "High-tide stormwater logging", "icon": "flood"},
    "Patna, Bihar": {"state": "Bihar", "region": "East", "coords": [25.594, 85.137], "hazard": "Ganga riverine backwater flooding", "icon": "flood"},
    "Katihar, Bihar": {"state": "Bihar", "region": "East", "coords": [25.543, 87.572], "hazard": "Kosi river embankment breach", "icon": "flood"},
    "Ranchi, Jharkhand": {"state": "Jharkhand", "region": "East", "coords": [23.344, 85.309], "hazard": "Flash stream overflow & mine subsidence", "icon": "flood"},
    "Puri, Odisha": {"state": "Odisha", "region": "East", "coords": [19.813, 85.831], "hazard": "Bay of Bengal super cyclone & sea surge", "icon": "cyclone"},
    "Balasore, Odisha": {"state": "Odisha", "region": "East", "coords": [21.493, 86.913], "hazard": "Coastal saline inundation & cyclone surge", "icon": "cyclone"},
    "Ganjam, Odisha": {"state": "Odisha", "region": "East", "coords": [19.380, 84.980], "hazard": "Rushikulya river flood & cyclone", "icon": "cyclone"},
    
    # Western & Central States
    "Kutch, Gujarat": {"state": "Gujarat", "region": "West", "coords": [23.242, 69.666], "hazard": "Seismic Zone V tremor & cyclone surge", "icon": "earthquake"},
    "Surat, Gujarat": {"state": "Gujarat", "region": "West", "coords": [21.170, 72.831], "hazard": "Tapi river monsoon discharge surge", "icon": "flood"},
    "Ahmedabad, Gujarat": {"state": "Gujarat", "region": "West", "coords": [23.022, 72.571], "hazard": "Sabarmati river flash inundation", "icon": "flood"},
    "Mumbai Suburban, Maharashtra": {"state": "Maharashtra", "region": "West", "coords": [19.076, 72.877], "hazard": "Monsoon high-tide urban cloudburst flooding", "icon": "flood"},
    "Raigad, Maharashtra": {"state": "Maharashtra", "region": "West", "coords": [18.515, 73.181], "hazard": "Western Ghats hill slope landslide", "icon": "landslide"},
    "Ratnagiri, Maharashtra": {"state": "Maharashtra", "region": "West", "coords": [16.990, 73.300], "hazard": "Konkan coastal erosion & cyclonic wind", "icon": "cyclone"},
    "Kolhapur, Maharashtra": {"state": "Maharashtra", "region": "West", "coords": [16.705, 74.243], "hazard": "Panchganga river backwater flood", "icon": "flood"},
    "Jaipur, Rajasthan": {"state": "Rajasthan", "region": "West", "coords": [26.912, 75.787], "hazard": "Dravyawti river flash flooding & heat stress", "icon": "flood"},
    "Barmer, Rajasthan": {"state": "Rajasthan", "region": "West", "coords": [25.753, 71.396], "hazard": "Desert flash flood & sand dune drift", "icon": "flood"},
    "Bhopal, Madhya Pradesh": {"state": "Madhya Pradesh", "region": "Central", "coords": [23.259, 77.412], "hazard": "Reservoir overflow & basin waterlogging", "icon": "flood"},
    "Jabalpur, Madhya Pradesh": {"state": "Madhya Pradesh", "region": "Central", "coords": [23.181, 79.986], "hazard": "Narmada gorge flash flood", "icon": "flood"},
    "Bastar, Chhattisgarh": {"state": "Chhattisgarh", "region": "Central", "coords": [19.074, 82.030], "hazard": "Indravati river flash flood & soil erosion", "icon": "flood"},

    # Southern & Island States/UTs
    "Wayanad, Kerala": {"state": "Kerala", "region": "South", "coords": [11.685, 76.132], "hazard": "Severe slope debris flow & catastrophic landslide", "icon": "landslide"},
    "Idukki, Kerala": {"state": "Kerala", "region": "South", "coords": [9.849, 76.980], "hazard": "Periyar reservoir overflow & hill slide", "icon": "landslide"},
    "Alappuzha, Kerala": {"state": "Kerala", "region": "South", "coords": [9.498, 76.338], "hazard": "Kuttanad below-sea-level saline flooding", "icon": "flood"},
    "Ernakulam, Kerala": {"state": "Kerala", "region": "South", "coords": [9.981, 76.299], "hazard": "Coastal high-tide surge & urban waterlogging", "icon": "flood"},
    "Chennai, Tamil Nadu": {"state": "Tamil Nadu", "region": "South", "coords": [13.082, 80.270], "hazard": "Northeast monsoon urban flood & cyclone", "icon": "cyclone"},
    "Cuddalore, Tamil Nadu": {"state": "Tamil Nadu", "region": "South", "coords": [11.748, 79.771], "hazard": "Cyclonic storm surge & river mouth breach", "icon": "cyclone"},
    "Nilgiris, Tamil Nadu": {"state": "Tamil Nadu", "region": "South", "coords": [11.410, 76.703], "hazard": "Mountain slope slip & heavy rain slide", "icon": "landslide"},
    "Kanyakumari, Tamil Nadu": {"state": "Tamil Nadu", "region": "South", "coords": [8.088, 77.538], "hazard": "Coastal high-energy sea wave erosion", "icon": "cyclone"},
    "Uttara Kannada, Karnataka": {"state": "Karnataka", "region": "South", "coords": [14.795, 74.686], "hazard": "Kali river flash flood & coastal landslide", "icon": "landslide"},
    "Kodagu, Karnataka": {"state": "Karnataka", "region": "South", "coords": [12.424, 75.738], "hazard": "Cauvery headwater slope collapse", "icon": "landslide"},
    "Dakshina Kannada, Karnataka": {"state": "Karnataka", "region": "South", "coords": [12.870, 74.880], "hazard": "Netravati river monsoon overflow", "icon": "flood"},
    "Visakhapatnam, Andhra Pradesh": {"state": "Andhra Pradesh", "region": "South", "coords": [17.686, 83.218], "hazard": "Severe cyclonic storm landfall & surge", "icon": "cyclone"},
    "East Godavari, Andhra Pradesh": {"state": "Andhra Pradesh", "region": "South", "coords": [16.989, 82.247], "hazard": "Godavari delta riverine & tidal inundation", "icon": "flood"},
    "Krishna, Andhra Pradesh": {"state": "Andhra Pradesh", "region": "South", "coords": [16.180, 81.130], "hazard": "Krishna basin storm surge & river overflow", "icon": "flood"},
    "Hyderabad, Telangana": {"state": "Telangana", "region": "South", "coords": [17.385, 78.486], "hazard": "Musi river urban flash waterlogging", "icon": "flood"},
    "Bhadradri Kothagudem, Telangana": {"state": "Telangana", "region": "South", "coords": [17.550, 80.610], "hazard": "Godavari flood corridor submergence", "icon": "flood"},
    "North & Middle Andaman, A&N": {"state": "Andaman & Nicobar", "region": "Islands", "coords": [12.920, 92.930], "hazard": "Tsunami seismic threat & cyclonic storm", "icon": "earthquake"},
    "South Andaman, A&N": {"state": "Andaman & Nicobar", "region": "Islands", "coords": [11.660, 92.740], "hazard": "Severe tropical depression storm surge", "icon": "cyclone"},
    "Kavaratti, Lakshadweep": {"state": "Lakshadweep", "region": "Islands", "coords": [10.566, 72.641], "hazard": "Atoll coral reef erosion & sea level rise", "icon": "cyclone"},
    "Puducherry, Puducherry": {"state": "Puducherry", "region": "South", "coords": [11.941, 79.808], "hazard": "Coromandel coast storm surge & beach erosion", "icon": "cyclone"},
    "North Goa, Goa": {"state": "Goa", "region": "West", "coords": [15.498, 73.827], "hazard": "Mandovi river tidal flood & estuarine siltation", "icon": "flood"}
}

def generate_polygon(center_lat, center_lng, size=0.015):
    return Polygon([
        (center_lng - size, center_lat - size),
        (center_lng + size, center_lat - size),
        (center_lng + size, center_lat + size),
        (center_lng - size, center_lat + size)
    ])

def seed_india_database():
    session = Session()
    print("🌱 Initializing Pan-India Geospatial Database Seeding...")

    # Clear existing tables
    print("🧹 Clearing previous records...")
    session.query(models.Feedback).delete()
    session.query(models.LegalCertificate).delete()
    session.query(models.RedZone).delete()
    session.query(models.HazardZone).delete()
    session.query(models.Habitation).delete()
    session.query(models.CandidateSite).delete()
    session.commit()

    random.seed(42)

    all_habitations = []
    all_hazards = []
    all_sites = []
    all_redzones = []

    print("🗺️ Generating pan-India locations across all States and Union Territories...")

    hab_id_counter = 1
    site_id_counter = 1
    hazard_id_counter = 1

    for district_name, info in PAN_INDIA_DISTRICTS.items():
        base_lat, base_lng = info["coords"]
        state = info["state"]
        region = info["region"]
        hazard_desc = info["hazard"]
        icon = info["icon"]

        # 1. Create a Primary Safe Relocation Destination for this District
        site_lat = base_lat + random.uniform(-0.06, 0.06)
        site_lng = base_lng + random.uniform(-0.06, 0.06)
        site_geom = json.dumps(mapping(generate_polygon(site_lat, site_lng, 0.025)))
        dist_base_name = district_name.split(",")[0]

        cand_site = models.CandidateSite(
            id=site_id_counter,
            name=f"{dist_base_name} Central Resettlement & Safe Haven",
            district=district_name,
            state=state,
            max_capacity=random.randint(12000, 35000),
            water_availability=True,
            power_availability=True,
            sanitation=True,
            proximity_to_services=round(random.uniform(1.2, 5.8), 1),
            lat=site_lat,
            lng=site_lng,
            geom=site_geom
        )
        all_sites.append(cand_site)
        current_site_id = site_id_counter
        site_id_counter += 1

        # 2. Create 2 Hazard Overlays in this District
        for h_idx in range(2):
            hz_lat = base_lat + random.uniform(-0.04, 0.04)
            hz_lng = base_lng + random.uniform(-0.04, 0.04)
            hz_geom = json.dumps(mapping(generate_polygon(hz_lat, hz_lng, random.uniform(0.02, 0.04))))
            hazard_zone = models.HazardZone(
                id=hazard_id_counter,
                hazard_type=hazard_desc.split("&")[0].strip(),
                intensity=random.randint(6, 10),
                historical_casualties=random.randint(5, 75),
                district=district_name,
                state=state,
                geom=hz_geom
            )
            all_hazards.append(hazard_zone)
            hazard_id_counter += 1

        # 3. Create 8 to 15 Habitational Settlements per District (totaling 500+ pan-India)
        num_villages = random.randint(8, 14)
        for v_idx in range(1, num_villages + 1):
            offset_lat = base_lat + random.uniform(-0.035, 0.035)
            offset_lng = base_lng + random.uniform(-0.035, 0.035)
            hab_geom = json.dumps(mapping(generate_polygon(offset_lat, offset_lng, 0.008)))

            state_code = "".join([w[0] for w in state.split() if w[0].isalpha()]).upper()[:2]
            dist_code = dist_base_name[:3].upper()
            code = f"{state_code}-{dist_code}-{v_idx:02d}"

            village_name = f"{dist_base_name} Sector {v_idx}" if v_idx % 2 == 0 else f"{dist_base_name} Ward {v_idx}"

            population = random.randint(850, 18500)
            elderly_pct = round(random.uniform(8.0, 28.0), 1)
            disabled_pct = round(random.uniform(2.0, 11.0), 1)
            low_income_pct = round(random.uniform(40.0, 92.0), 1)
            isolated = random.choice([True, False, False])
            incident_history = random.choice([True, True, False])

            # Calculate deterministic priority & scores
            hazard_intensity = random.randint(45, 95)
            vuln_score = int((elderly_pct * 1.5) + (disabled_pct * 2.0) + (low_income_pct * 0.4))
            vuln_score = min(100, max(25, vuln_score))
            expo_score = min(100, max(15, int(population / 150)))

            priority_score = int((hazard_intensity * 0.45) + (vuln_score * 0.35) + (expo_score * 0.20))
            priority_score = min(98, max(22, priority_score))

            if priority_score >= 60:
                phase = "Immediate"
            elif priority_score >= 38:
                phase = "Short-Term"
            else:
                phase = "Medium-Term"

            habitation = models.Habitation(
                id=hab_id_counter,
                code=code,
                name=village_name,
                district=district_name,
                state=state,
                region=region,
                hazard=hazard_desc,
                icon=icon,
                population=population,
                elderly_pct=elderly_pct,
                disabled_pct=disabled_pct,
                low_income_pct=low_income_pct,
                income_bracket="Low" if low_income_pct > 65 else "Medium",
                housing_quality="Kutcha" if low_income_pct > 70 else "Semi-Pucca",
                occupation_type="Agriculture" if "North" in region or "Central" in region else "Fisheries / Labor",
                dependency_ratio=round((elderly_pct + disabled_pct) / 100, 2),
                isolated=isolated,
                incident_history=incident_history,
                last_surveyed=f"{random.randint(1, 28)} Aug 2026",
                lat=offset_lat,
                lng=offset_lng,
                geom=hab_geom
            )
            all_habitations.append(habitation)

            explanation = (
                f"Ranked {phase}: {hazard_desc} vulnerability index ({hazard_intensity}%), {population:,} exposed residents "
                f"with {int(elderly_pct)}% elderly & {int(disabled_pct)}% disabled dependency in {district_name}."
            )

            red_zone = models.RedZone(
                id=hab_id_counter,
                habitation_id=hab_id_counter,
                hazard_score=float(hazard_intensity),
                vulnerability_score=float(vuln_score / 10.0),
                exposure_score=float(expo_score),
                priority_score=float(priority_score),
                phase=phase,
                xai_explanation=explanation,
                assigned_site_id=current_site_id,
                assigned_site_name=cand_site.name,
                assigned_site_status="matched",
                site_utilization=random.randint(55, 88)
            )
            all_redzones.append(red_zone)

            hab_id_counter += 1

    # Save to SQLite
    print(f"💾 Saving {len(all_sites)} candidate relocation sites...")
    session.bulk_save_objects(all_sites)
    session.commit()

    print(f"💾 Saving {len(all_hazards)} hazard polygon zones...")
    session.bulk_save_objects(all_hazards)
    session.commit()

    print(f"💾 Saving {len(all_habitations)} pan-India habitations...")
    session.bulk_save_objects(all_habitations)
    session.commit()

    print(f"💾 Saving {len(all_redzones)} computed red zones...")
    session.bulk_save_objects(all_redzones)
    session.commit()

    session.close()
    print("✅ Pan-India Database Seeding Complete! Total Locations:", len(all_habitations))

if __name__ == "__main__":
    seed_india_database()
