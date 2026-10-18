from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Any, Dict
from datetime import datetime

class FeedbackCreate(BaseModel):
    citizen_name: str
    message: str
    red_zone_id: Optional[int] = None
    contact_phone: Optional[str] = None
    issue_type: Optional[str] = None
    urgency: Optional[str] = "Moderate"

class FeedbackResponse(BaseModel):
    id: int
    citizen_name: str
    message: str
    red_zone_id: Optional[int] = None
    contact_phone: Optional[str] = None
    issue_type: Optional[str] = None
    urgency: Optional[str] = "Moderate"
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)

class RedZoneResponse(BaseModel):
    id: int
    habitation_id: int
    hazard_score: float
    vulnerability_score: float
    exposure_score: float
    priority_score: float
    phase: str
    xai_explanation: Optional[str]
    assigned_site_id: Optional[int]
    assigned_site_name: Optional[str] = None
    assigned_site_status: Optional[str] = None
    site_utilization: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class ZoneSite(BaseModel):
    name: str
    status: str = "matched"
    utilization: int = 70

class ZoneItem(BaseModel):
    id: str
    db_id: int
    name: str
    district: str
    state: str
    region: Optional[str] = "North"
    hazard: str
    icon: str
    hazardIntensity: int
    exposure: int
    vulnerability: int
    priorityScore: int
    phase: str
    population: int
    elderly: int
    disabled: int
    lowIncome: int
    isolated: bool
    incidentHistory: bool
    lastSurveyed: Optional[str] = "15 Aug 2026"
    lat: float
    lng: float
    site: ZoneSite
    explanation: str

class ZoneListResponse(BaseModel):
    total: int
    count: int
    zones: List[ZoneItem]

class DistrictInfo(BaseModel):
    district: str
    state: str
    lat: float
    lng: float
    zone_count: int

class EmailCreate(BaseModel):
    email: str

class EmailResponse(BaseModel):
    id: int
    email: str
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)

class AlertTrigger(BaseModel):
    zone_id: int
    hazard_type: str
    phase: str
    priority_score: float
    population: int
    message: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    reply: str

class TinyFishSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
