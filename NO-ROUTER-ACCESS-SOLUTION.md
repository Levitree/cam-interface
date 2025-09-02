# No Router Access Solution

## 🌥️ Cloud + VPN Approach (No Port Forwarding Required)

If you can't configure your router, use this approach:

### Step 1: Install Tailscale (Free VPN)
```bash
# On your Mac (where cameras are)
brew install tailscale
sudo tailscale up

# Get your Tailscale IP
tailscale ip -4
# Example: 100.64.1.2
```

### Step 2: Create Cloud VPS with Tailscale
```bash
# On DigitalOcean VPS
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Now VPS can access your local cameras via Tailscale network
```

### Step 3: Update MediaMTX Config (on VPS)
```yaml
paths:
  robot:
    source: rtsp://admin:Password@100.64.1.2:554/cam/realmonitor?channel=1&subtype=0
  table:
    source: rtsp://admin:Password@100.64.1.2:554/cam/realmonitor?channel=1&subtype=0  
  ceiling:
    source: rtsp://admin:Password@100.64.1.2:554/cam/realmonitor?channel=1&subtype=0
```

### Step 4: Vercel Environment Variables
```bash
CAM_USER=admin
CAM_PASS=Password
ROBOT_CAM_IP=100.64.1.2  # Your Tailscale IP
TABLE_CAM_IP=100.64.1.2
CEILING_CAM_IP=100.64.1.2
MEDIAMTX_HTTP=https://YOUR_VPS_IP:8888
MEDIAMTX_WHEP=https://YOUR_VPS_IP:8889
```

## ✅ Benefits:
- ✅ **No router configuration needed**
- ✅ **Secure VPN connection**
- ✅ **Cameras stay private**
- ✅ **Easy to set up**

## 💰 Cost:
- **Tailscale**: Free (up to 20 devices)
- **DigitalOcean VPS**: $6/month

This approach creates a secure tunnel between your cameras and the cloud without exposing anything publicly!
