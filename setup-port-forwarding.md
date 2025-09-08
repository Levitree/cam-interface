# Router Port Forwarding Setup

## 🔧 Configure Your Router for Public Access

### Step 1: Find Your Public IP
```bash
curl ifconfig.me
# Example result: 203.0.113.45
```

### Step 2: Router Port Forwarding Rules

Add these rules in your router admin panel:

```
External Port 8181 → Internal 192.168.4.181:80 (Robot Camera)
External Port 8182 → Internal 192.168.4.182:80 (Table Camera)  
External Port 8183 → Internal 192.168.4.183:80 (Ceiling Camera)

External Port 5541 → Internal 192.168.4.181:554 (Robot RTSP)
External Port 5542 → Internal 192.168.4.182:554 (Table RTSP)
External Port 5543 → Internal 192.168.4.183:554 (Ceiling RTSP)
```

### Step 3: Update MediaMTX Config
```yaml
paths:
  robot:
    source: rtsp://admin:Password@YOUR_PUBLIC_IP:5541/cam/realmonitor?channel=1&subtype=0
  table:
    source: rtsp://admin:Password@YOUR_PUBLIC_IP:5542/cam/realmonitor?channel=1&subtype=0
  ceiling:
    source: rtsp://admin:Password@YOUR_PUBLIC_IP:5543/cam/realmonitor?channel=1&subtype=0
```

### Step 4: Update Vercel Environment Variables
```bash
CAM_USER=admin
CAM_PASS=Password
ROBOT_CAM_IP=YOUR_PUBLIC_IP:8181
TABLE_CAM_IP=YOUR_PUBLIC_IP:8182  
CEILING_CAM_IP=YOUR_PUBLIC_IP:8183
MEDIAMTX_HTTP=https://YOUR_VPS_IP:8888
MEDIAMTX_WHEP=https://YOUR_VPS_IP:8889
```

## ⚠️ Security Notes
- Change default camera passwords
- Consider VPN instead for better security
- Monitor access logs

