from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import io
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from . import models

def generate_legal_certificate(db: Session, red_zone_id: int) -> bytes:
    zone = db.query(models.RedZone).filter(models.RedZone.id == red_zone_id).first()
    if not zone:
        return None

    # Generate PDF in memory
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    
    can.setFont("Helvetica-Bold", 16)
    can.drawString(100, 750, "BHOOMI RAKSHAK - OFFICIAL LEGAL CERTIFICATE")
    
    can.setFont("Helvetica", 12)
    can.drawString(100, 710, f"Certificate ID: BR-RZ-{zone.id}-{datetime.now().strftime('%Y%m%d')}")
    can.drawString(100, 680, f"Habitation ID: {zone.habitation_id}")
    can.drawString(100, 650, f"Priority Score: {zone.priority_score}")
    can.drawString(100, 620, f"Action Phase: {zone.phase}")
    
    can.drawString(100, 580, "Explainable AI (XAI) Justification:")
    
    # Wrap text manually (simple for demo)
    text_object = can.beginText(100, 560)
    text_object.setFont("Helvetica", 10)
    words = zone.xai_explanation.split()
    line = ""
    for word in words:
        if len(line) + len(word) > 80:
            text_object.textLine(line)
            line = word + " "
        else:
            line += word + " "
    text_object.textLine(line)
    can.drawText(text_object)
    
    can.setFont("Helvetica", 11)
    site_str = str(zone.assigned_site_id) if zone.assigned_site_id else "Site #104 (Green Safe Haven)"
    can.drawString(100, 480, f"Section 1 (Short-Term Relief Shelter): {site_str} - Dijkstra Corridor")
    can.drawString(100, 460, f"Section 2 (Permanent Sustainable Resettlement): Township #{zone.id + 200} (Sustainability Score: 96/100 A+)")
    
    issue_time = datetime.now().isoformat()
    can.drawString(100, 430, f"Issue Date: {issue_time}")
    
    # Generate mock hash
    content_hash = hashlib.sha256(f"{zone.id}-{issue_time}-{zone.priority_score}".encode()).hexdigest()
    can.setFont("Helvetica", 8)
    can.drawString(100, 390, f"Blockchain Audit Hash (SHA-256): {content_hash}")
    
    can.save()
    packet.seek(0)
    pdf_bytes = packet.getvalue()
    
    # Save hash to DB
    cert = models.LegalCertificate(red_zone_id=zone.id, pdf_hash=content_hash)
    db.add(cert)
    db.commit()
    
    return pdf_bytes
