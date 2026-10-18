from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, func, Text
from sqlalchemy.orm import relationship
from .database import Base

class HazardZone(Base):
    __tablename__ = "hazard_zones"
    id = Column(Integer, primary_key=True, index=True)
    hazard_type = Column(String(50), nullable=False)
    intensity = Column(Integer)
    historical_casualties = Column(Integer, default=0)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    geom = Column(Text) # GeoJSON string

class Habitation(Base):
    __tablename__ = "habitations"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    region = Column(String(50), nullable=True)
    hazard = Column(String(100), nullable=True)
    icon = Column(String(50), nullable=True)
    population = Column(Integer, nullable=False)
    elderly_pct = Column(Float, default=0.0)
    disabled_pct = Column(Float, default=0.0)
    low_income_pct = Column(Float, default=0.0)
    income_bracket = Column(String(50), default="Medium")
    housing_quality = Column(String(50), default="Semi-Pucca")
    occupation_type = Column(String(50), default="Agriculture")
    dependency_ratio = Column(Float, default=0.5)
    isolated = Column(Boolean, default=False)
    incident_history = Column(Boolean, default=False)
    last_surveyed = Column(String(50), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    geom = Column(Text) # GeoJSON string
    
    red_zones = relationship("RedZone", back_populates="habitation")

class CandidateSite(Base):
    __tablename__ = "candidate_sites"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    max_capacity = Column(Integer, nullable=False)
    water_availability = Column(Boolean, default=True)
    power_availability = Column(Boolean, default=True)
    sanitation = Column(Boolean, default=True)
    proximity_to_services = Column(Float, default=5.0)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    geom = Column(Text) # GeoJSON string
    
    red_zones = relationship("RedZone", back_populates="assigned_site")

class RedZone(Base):
    __tablename__ = "red_zones"
    id = Column(Integer, primary_key=True, index=True)
    habitation_id = Column(Integer, ForeignKey("habitations.id"))
    hazard_score = Column(Float)
    vulnerability_score = Column(Float)
    exposure_score = Column(Float)
    priority_score = Column(Float)
    phase = Column(String(20)) # Immediate, Short-Term, Medium-Term
    xai_explanation = Column(Text)
    assigned_site_id = Column(Integer, ForeignKey("candidate_sites.id"), nullable=True)
    assigned_site_name = Column(String(100), nullable=True)
    assigned_site_status = Column(String(50), default="matched")
    site_utilization = Column(Integer, default=70)

    habitation = relationship("Habitation", back_populates="red_zones")
    assigned_site = relationship("CandidateSite", back_populates="red_zones")
    feedbacks = relationship("Feedback", back_populates="red_zone")
    certificates = relationship("LegalCertificate", back_populates="red_zone")

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    red_zone_id = Column(Integer, ForeignKey("red_zones.id"), nullable=True)
    citizen_name = Column(String(100))
    message = Column(Text)
    contact_phone = Column(String(20), nullable=True)
    issue_type = Column(String(50), nullable=True)
    urgency = Column(String(20), default="Moderate")
    timestamp = Column(DateTime, default=func.now())
    
    red_zone = relationship("RedZone", back_populates="feedbacks")

class LegalCertificate(Base):
    __tablename__ = "legal_certificates"
    id = Column(Integer, primary_key=True, index=True)
    red_zone_id = Column(Integer, ForeignKey("red_zones.id"))
    pdf_hash = Column(String(256))
    issue_date = Column(DateTime, default=func.now())
    
    red_zone = relationship("RedZone", back_populates="certificates")

class AlertEmail(Base):
    __tablename__ = "alert_emails"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=func.now())
