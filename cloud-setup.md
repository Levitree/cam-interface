# Cloud Deployment Guide

## 🚀 Quick Cloud Setup (5 minutes)

### Step 1: Create VPS
1. Sign up for DigitalOcean/Linode/Vultr
2. Create Ubuntu 22.04 droplet ($6/month)
3. Note the public IP address

### Step 2: Setup MediaMTX on VPS
```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Install MediaMTX
wget https://github.com/bluenviron/mediamtx/releases/download/v1.14.0/mediamtx_v1.14.0_linux_amd64.tar.gz
tar -xzf mediamtx_v1.14.0_linux_amd64.tar.gz

# Upload your mediamtx.yml (with public camera IPs)
# Run MediaMTX
./mediamtx mediamtx.yml
```

### Step 3: Configure Camera Public Access
**Option A: Router Port Forwarding**
- Forward camera ports (80, 554) to your cameras
- Use your public IP: `YOUR_PUBLIC_IP:8081` → `192.168.4.181:80`

**Option B: VPN Access**
- Set up VPN server on your network
- VPS connects via VPN to reach local cameras

### Step 4: Update Vercel Environment Variables
```bash
# Replace with your VPS IP
MEDIAMTX_HTTP=https://YOUR_VPS_IP:8888
MEDIAMTX_WHEP=https://YOUR_VPS_IP:8889

# Option A: Public camera IPs
ROBOT_CAM_IP=YOUR_PUBLIC_IP
TABLE_CAM_IP=YOUR_PUBLIC_IP  
CEILING_CAM_IP=YOUR_PUBLIC_IP

# Option B: Keep local IPs (if using VPN)
ROBOT_CAM_IP=192.168.4.181
TABLE_CAM_IP=192.168.4.182
CEILING_CAM_IP=192.168.4.183
```

## 🎯 Recommended: Start with Option A (Port Forwarding)
- Simplest setup
- No VPN complexity
- Cameras accessible worldwide
- Use different ports for each camera

