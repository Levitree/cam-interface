# Worldwide Access Setup Guide

## 🌍 Your Configuration

**Your Public IP:** `23.93.85.147`
**Local Cameras:** 192.168.4.181, 192.168.4.182, 192.168.4.183

## 🔧 Step 1: Router Port Forwarding

Configure these rules in your router admin panel:

### Camera HTTP Access (for PTZ commands)
```
External Port 8181 → Internal 192.168.4.181:80 (Robot Camera)
External Port 8182 → Internal 192.168.4.182:80 (Table Camera)  
External Port 8183 → Internal 192.168.4.183:80 (Ceiling Camera)
```

### Camera RTSP Streams (for video)
```
External Port 5541 → Internal 192.168.4.181:554 (Robot RTSP)
External Port 5542 → Internal 192.168.4.182:554 (Table RTSP)
External Port 5543 → Internal 192.168.4.183:554 (Ceiling RTSP)
```

## 🚀 Step 2: Deploy MediaMTX to Cloud VPS

### Create VPS (DigitalOcean recommended)
1. Go to: https://digitalocean.com
2. Create account, choose $6/month Ubuntu 22.04 droplet
3. Note your VPS IP address (example: 143.198.123.45)

### Install MediaMTX on VPS
```bash
# SSH into VPS
ssh root@YOUR_VPS_IP

# Install MediaMTX
wget https://github.com/bluenviron/mediamtx/releases/download/v1.14.0/mediamtx_v1.14.0_linux_amd64.tar.gz
tar -xzf mediamtx_v1.14.0_linux_amd64.tar.gz

# Create config file
cat > mediamtx.yml << 'EOF'
paths:
  robot:
    source: rtsp://admin:Password@23.93.85.147:5541/cam/realmonitor?channel=1&subtype=0
  table:
    source: rtsp://admin:Password@23.93.85.147:5542/cam/realmonitor?channel=1&subtype=0
  ceiling:
    source: rtsp://admin:Password@23.93.85.147:5543/cam/realmonitor?channel=1&subtype=0

webrtc: yes
hls: yes
EOF

# Start MediaMTX
./mediamtx mediamtx.yml
```

## 🌐 Step 3: Update Vercel Environment Variables

Replace with your actual VPS IP:

```bash
CAM_USER=admin
CAM_PASS=Password
ROBOT_CAM_IP=23.93.85.147:8181
TABLE_CAM_IP=23.93.85.147:8182
CEILING_CAM_IP=23.93.85.147:8183
MEDIAMTX_HTTP=https://YOUR_VPS_IP:8888
MEDIAMTX_WHEP=https://YOUR_VPS_IP:8889
```

## ✅ Result
- 🌍 **Worldwide access** to your camera interface
- 📱 **Works from anywhere** - phone, laptop, etc.
- 🎮 **Full PTZ control** from any location
- 📺 **Live video streams** accessible globally

## 🔒 Security Tips
- Change camera passwords from default
- Consider HTTPS for camera access
- Monitor router logs for suspicious access
- Use strong WiFi passwords

**Cost: ~$6/month for VPS hosting**
**Setup time: ~30 minutes**
