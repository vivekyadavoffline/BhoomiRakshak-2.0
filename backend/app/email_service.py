import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

def send_alert_email(to_emails: list, alert_data: dict):
    if not to_emails:
        return

    smtp_server = os.environ.get("SMTP_SERVER", "localhost")
    smtp_port = int(os.environ.get("SMTP_PORT", 1025)) # Default to mock server port
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    
    subject = f"🚨 URGENT ALERT: {alert_data.get('hazard_type', 'Disaster')} in {alert_data.get('zone_id', 'Unknown Zone')}"
    
    body = f"""
    This is an automated alert from Bhoomi Rakshak.
    
    Zone ID: {alert_data.get('zone_id')}
    Hazard: {alert_data.get('hazard_type')}
    Phase: {alert_data.get('phase')}
    Priority Score: {alert_data.get('priority_score')}
    Exposed Population: {alert_data.get('population')}
    
    Message:
    {alert_data.get('message', 'A community alert has been issued for this zone. Please take appropriate action.')}
    """

    msg = MIMEMultipart()
    msg["From"] = os.environ.get("SMTP_FROM", "alerts@bhoomirakshak.local")
    msg["To"] = ", ".join(to_emails)
    msg["Subject"] = subject
    
    msg.attach(MIMEText(body, "plain"))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        if smtp_user and smtp_pass:
            server.starttls()
            server.login(smtp_user, smtp_pass)
        
        server.sendmail(msg["From"], to_emails, msg.as_string())
        server.quit()
        print(f"Alert sent successfully to {len(to_emails)} recipients.")
    except Exception as e:
        print(f"Failed to send email via {smtp_server}:{smtp_port}. Error: {e}")
