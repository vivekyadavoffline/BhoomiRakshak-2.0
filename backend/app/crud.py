from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from . import models, schemas
import json

def habitation_to_zone_dict(hab: models.Habitation, rz: models.RedZone = None) -> dict:
    priority_score = int(rz.priority_score) if rz and rz.priority_score is not None else 65
    phase = rz.phase if rz and rz.phase else ("Immediate" if priority_score > 60 else "Short-Term" if priority_score > 35 else "Medium-Term")
    hazard_score = int(rz.hazard_score) if rz and rz.hazard_score is not None else 75
    vuln_score = int(rz.vulnerability_score * 10) if rz and rz.vulnerability_score is not None else int(hab.elderly_pct * 2 + hab.disabled_pct * 2 + 30)
    expo_score = int(rz.exposure_score) if rz and rz.exposure_score is not None else min(100, int(hab.population / 250))
    
    site_name = rz.assigned_site_name if rz and rz.assigned_site_name else f"{hab.district.split(',')[0]} Safe Haven & Resettlement Hub"
    site_status = rz.assigned_site_status if rz and rz.assigned_site_status else "matched"
    site_util = rz.site_utilization if rz and rz.site_utilization else 72

    explanation = rz.xai_explanation if rz and rz.xai_explanation else (
        f"Ranked {phase}: {hab.hazard or 'Geospatial hazard'} index ({hazard_score}%), {hab.population:,} exposed residents "
        f"with {int(hab.elderly_pct)}% elderly & {int(hab.disabled_pct)}% disabled dependency in {hab.district}."
    )

    zone_code = hab.code or f"IN-ZON-{hab.id:04d}"

    return {
        "id": zone_code,
        "db_id": hab.id,
        "name": hab.name,
        "district": hab.district,
        "state": hab.state,
        "region": hab.region or "North",
        "hazard": hab.hazard or "Multi-hazard exposure",
        "icon": hab.icon or "flood",
        "hazardIntensity": min(100, max(10, hazard_score)),
        "exposure": min(100, max(10, expo_score)),
        "vulnerability": min(100, max(10, vuln_score)),
        "priorityScore": min(100, max(1, priority_score)),
        "phase": phase,
        "population": hab.population,
        "elderly": int(hab.elderly_pct),
        "disabled": int(hab.disabled_pct),
        "lowIncome": int(hab.low_income_pct),
        "isolated": bool(hab.isolated),
        "incidentHistory": bool(hab.incident_history),
        "lastSurveyed": hab.last_surveyed or "15 Aug 2026",
        "lat": round(hab.lat, 4),
        "lng": round(hab.lng, 4),
        "site": {
            "name": site_name,
            "status": site_status,
            "utilization": site_util
        },
        "explanation": explanation
    }

def get_zones(
    db: Session,
    state: str = None,
    district: str = None,
    phase: str = None,
    search: str = None,
    limit: int = 1000,
    offset: int = 0
):
    query = db.query(models.Habitation).outerjoin(models.RedZone, models.Habitation.id == models.RedZone.habitation_id)
    
    if state and state != "All":
        query = query.filter(models.Habitation.state == state)
    if district and district != "All":
        query = query.filter(models.Habitation.district == district)
    if phase and phase != "All":
        query = query.filter(models.RedZone.phase == phase)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                models.Habitation.name.ilike(search_pattern),
                models.Habitation.district.ilike(search_pattern),
                models.Habitation.code.ilike(search_pattern),
                models.Habitation.state.ilike(search_pattern),
                models.Habitation.hazard.ilike(search_pattern)
            )
        )
        
    total = query.count()
    results = query.order_by(models.RedZone.priority_score.desc().nullslast(), models.Habitation.id.asc()).offset(offset).limit(limit).all()
    
    zones_list = []
    for hab in results:
        rz = hab.red_zones[0] if hab.red_zones else None
        zones_list.append(habitation_to_zone_dict(hab, rz))
        
    return {
        "total": total,
        "count": len(zones_list),
        "zones": zones_list
    }

def get_zone_by_id(db: Session, zone_id_or_code: str):
    if zone_id_or_code.isdigit():
        hab = db.query(models.Habitation).filter(models.Habitation.id == int(zone_id_or_code)).first()
    else:
        hab = db.query(models.Habitation).filter(models.Habitation.code == zone_id_or_code).first()
        
    if not hab:
        return None
        
    rz = hab.red_zones[0] if hab.red_zones else None
    return habitation_to_zone_dict(hab, rz)

def get_districts(db: Session):
    rows = db.query(
        models.Habitation.district,
        models.Habitation.state,
        func.avg(models.Habitation.lat).label("avg_lat"),
        func.avg(models.Habitation.lng).label("avg_lng"),
        func.count(models.Habitation.id).label("count")
    ).group_by(models.Habitation.district, models.Habitation.state).order_by(models.Habitation.state, models.Habitation.district).all()
    
    districts = []
    for r in rows:
        districts.append({
            "district": r.district,
            "state": r.state,
            "lat": round(float(r.avg_lat), 4),
            "lng": round(float(r.avg_lng), 4),
            "zone_count": r.count
        })
    return districts

def get_red_zones(db: Session):
    return db.query(models.RedZone).all()

def create_feedback(db: Session, feedback: schemas.FeedbackCreate):
    db_feedback = models.Feedback(
        red_zone_id=feedback.red_zone_id,
        citizen_name=feedback.citizen_name,
        message=feedback.message,
        contact_phone=feedback.contact_phone,
        issue_type=feedback.issue_type,
        urgency=feedback.urgency
    )
    db.add(db_feedback)
    db.commit()
    db.refresh(db_feedback)
    return db_feedback

def get_all_feedback(db: Session):
    return db.query(models.Feedback).order_by(models.Feedback.timestamp.desc()).all()

def get_hazard_zones_geojson(db: Session):
    zones = db.query(models.HazardZone).all()
    features = []
    for row in zones:
        geom_obj = json.loads(row.geom) if row.geom else {"type": "Point", "coordinates": [78.0, 30.0]}
        features.append({
            "type": "Feature",
            "properties": {
                "id": row.id,
                "hazard_type": row.hazard_type,
                "intensity": row.intensity,
                "district": row.district,
                "state": row.state
            },
            "geometry": geom_obj
        })
    return {"type": "FeatureCollection", "features": features}

def get_habitations_geojson(db: Session):
    habs = db.query(models.Habitation).all()
    features = []
    for row in habs:
        geom_obj = json.loads(row.geom) if row.geom else {"type": "Point", "coordinates": [row.lng, row.lat]}
        features.append({
            "type": "Feature",
            "properties": {
                "id": row.id,
                "code": row.code,
                "name": row.name,
                "district": row.district,
                "state": row.state,
                "population": row.population,
                "lat": row.lat,
                "lng": row.lng
            },
            "geometry": geom_obj
        })
    return {"type": "FeatureCollection", "features": features}

def get_candidate_sites_geojson(db: Session):
    sites = db.query(models.CandidateSite).all()
    features = []
    for row in sites:
        geom_obj = json.loads(row.geom) if row.geom else {"type": "Point", "coordinates": [row.lng or 78.0, row.lat or 30.0]}
        features.append({
            "type": "Feature",
            "properties": {
                "id": row.id,
                "name": row.name,
                "district": row.district,
                "state": row.state,
                "max_capacity": row.max_capacity
            },
            "geometry": geom_obj
        })
    return {"type": "FeatureCollection", "features": features}

def get_alert_emails(db: Session):
    return db.query(models.AlertEmail).all()

def add_alert_email(db: Session, email: str):
    existing = db.query(models.AlertEmail).filter(models.AlertEmail.email == email).first()
    if existing:
        return existing
    db_email = models.AlertEmail(email=email)
    db.add(db_email)
    db.commit()
    db.refresh(db_email)
    return db_email
