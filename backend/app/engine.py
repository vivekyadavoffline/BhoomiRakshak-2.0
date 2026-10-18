from sqlalchemy.orm import Session
import pandas as pd
import geopandas as gpd
from shapely.geometry import shape
import json
from . import models

def run_analytics_engine(db: Session):
    # 1. Fetch data directly from SQLite and convert to GeoPandas
    habs_raw = pd.read_sql_query("SELECT id, population, elderly_pct, disabled_pct, income_bracket, housing_quality, geom FROM habitations", db.bind)
    hazards_raw = pd.read_sql_query("SELECT id, hazard_type, intensity, geom FROM hazard_zones", db.bind)
    sites_raw = pd.read_sql_query("SELECT id, max_capacity, geom FROM candidate_sites", db.bind)
    
    if habs_raw.empty or hazards_raw.empty:
        return {"status": "error", "message": "No data available to run engine"}

    # Convert GeoJSON strings to Shapely geometry
    habs_raw['geometry'] = habs_raw['geom'].apply(lambda x: shape(json.loads(x)))
    hazards_raw['geometry'] = hazards_raw['geom'].apply(lambda x: shape(json.loads(x)))
    sites_raw['geometry'] = sites_raw['geom'].apply(lambda x: shape(json.loads(x)))

    habs = gpd.GeoDataFrame(habs_raw, geometry='geometry')
    hazards = gpd.GeoDataFrame(hazards_raw, geometry='geometry')
    sites = gpd.GeoDataFrame(sites_raw, geometry='geometry')

    # 2. Multi-Hazard Live Fusion Engine
    # Find intersections between habitations and hazards
    intersections = gpd.overlay(habs, hazards, how='intersection')
    
    # Calculate hazard score based on intensity (simple sum for demo)
    hazard_scores = intersections.groupby('id_1')['intensity'].sum().reset_index()
    hazard_scores.rename(columns={'id_1': 'habitation_id', 'intensity': 'hazard_score'}, inplace=True)
    
    # 3. Vulnerability Index
    # Normalize vulnerability factors
    def calc_vuln(row):
        score = 0
        if row['elderly_pct'] > 15: score += 2
        if row['disabled_pct'] > 5: score += 2
        if row['housing_quality'] == 'Kutcha': score += 3
        if row['income_bracket'] == 'Low': score += 3
        return score
    
    habs['vulnerability_score'] = habs.apply(calc_vuln, axis=1)

    # 4. Priority Score Engine
    results = pd.merge(habs, hazard_scores, left_on='id', right_on='habitation_id', how='left')
    results['hazard_score'] = results['hazard_score'].fillna(0)
    
    # Exposure = Population
    results['exposure_score'] = results['population']
    
    # Priority Score = Hazard Intensity x Exposure x Vulnerability Factor
    # Scaling down exposure for readability
    results['priority_score'] = results['hazard_score'] * (results['exposure_score'] / 100) * results['vulnerability_score']
    
    # Filter red zones (priority > 0)
    red_zones_df = results[results['priority_score'] > 0].copy()
    red_zones_df = red_zones_df.sort_values(by='priority_score', ascending=False)
    
    # Clear existing red zones
    db.query(models.Feedback).delete()
    db.query(models.LegalCertificate).delete()
    db.query(models.RedZone).delete()
    db.commit()

    # 5. Phased Action Routing & XAI Explanation
    new_red_zones = []
    
    # 6. Carrying Capacity Engine (Greedy Allocation)
    site_capacities = dict(zip(sites['id'], sites['max_capacity']))
    
    for _, row in red_zones_df.iterrows():
        # Phase
        if row['priority_score'] > 500:
            phase = "Immediate"
        elif row['priority_score'] > 200:
            phase = "Short-Term"
        else:
            phase = "Medium-Term"
            
        # XAI
        explanation = f"Zone {row['id']} prioritized due to Hazard Score {row['hazard_score']}, high vulnerability ({row['vulnerability_score']}/10), and population {row['population']}."
        
        # Allocate site
        assigned_site = None
        for site_id, cap in site_capacities.items():
            if cap >= row['population']:
                assigned_site = site_id
                site_capacities[site_id] -= row['population']
                break
                
        if assigned_site is None:
            explanation += " WARNING: No relocation site with sufficient capacity found."

        rz = models.RedZone(
            habitation_id=int(row['id']),
            hazard_score=float(row['hazard_score']),
            vulnerability_score=float(row['vulnerability_score']),
            exposure_score=float(row['exposure_score']),
            priority_score=float(row['priority_score']),
            phase=phase,
            xai_explanation=explanation,
            assigned_site_id=int(assigned_site) if assigned_site else None
        )
        new_red_zones.append(rz)

    db.bulk_save_objects(new_red_zones)
    db.commit()
    
    return {"status": "success", "zones_processed": len(new_red_zones)}
