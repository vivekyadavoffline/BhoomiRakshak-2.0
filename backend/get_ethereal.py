import urllib.request
import json
import os

req = urllib.request.Request(
    'https://api.nodemailer.com/user', 
    data=json.dumps({'requestor':'Antigravity','version':'1.0.0'}).encode('utf-8'), 
    headers={'Content-Type':'application/json'}
)
res = urllib.request.urlopen(req)
data = json.loads(res.read().decode('utf-8'))

with open('.env', 'w') as f:
    f.write(f"SMTP_SERVER=smtp.ethereal.email\n")
    f.write(f"SMTP_PORT=587\n")
    f.write(f"SMTP_USER={data['user']}\n")
    f.write(f"SMTP_PASSWORD={data['pass']}\n")
    f.write(f"SMTP_FROM={data['user']}\n")

print(f"Ethereal account created!")
print(f"Webmail URL: https://ethereal.email/login")
print(f"User: {data['user']}")
print(f"Pass: {data['pass']}")
