#!/bin/bash

# VPS Setup Script for MediaMTX with Tailscale
# Run this on your DigitalOcean/Linode VPS

echo "=== MediaMTX VPS Setup with Tailscale ==="

# Update system
echo "Updating system..."
apt update && apt upgrade -y

# Install Tailscale
echo "Installing Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh

# Connect to Tailscale (you'll need to authorize this)
echo "Connecting to Tailscale..."
tailscale up
echo "Go to the URL above to authorize this VPS"
echo "Press Enter when done..."
read

# Install MediaMTX
echo "Installing MediaMTX..."
wget https://github.com/bluenviron/mediamtx/releases/download/v1.14.0/mediamtx_v1.14.0_linux_amd64.tar.gz
tar -xzf mediamtx_v1.14.0_linux_amd64.tar.gz

# Create MediaMTX config with Tailscale IPs
cat > mediamtx.yml << 'EOF'
paths:
  robot:
    source: rtsp://admin:Password@100.126.251.43:554/cam/realmonitor?channel=1&subtype=0
  table:
    source: rtsp://admin:Password@100.126.251.43:554/cam/realmonitor?channel=1&subtype=0
  ceiling:
    source: rtsp://admin:Password@100.126.251.43:554/cam/realmonitor?channel=1&subtype=0

webrtc: yes
hls: yes

# Allow external connections
webrtcAddress: 0.0.0.0:8889
hlsAddress: 0.0.0.0:8888
EOF

# Create systemd service for MediaMTX
cat > /etc/systemd/system/mediamtx.service << 'EOF'
[Unit]
Description=MediaMTX
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/root/mediamtx /root/mediamtx.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl enable mediamtx
systemctl start mediamtx

# Open firewall ports
ufw allow 8888
ufw allow 8889
ufw --force enable

echo "✅ MediaMTX VPS setup complete!"
echo "Your VPS Tailscale IP: $(tailscale ip -4)"
echo "Test MediaMTX: http://$(tailscale ip -4):8888"
echo ""
echo "🔧 Update Vercel environment variables:"
echo "MEDIAMTX_HTTP=https://$(curl -s ifconfig.me):8888"
echo "MEDIAMTX_WHEP=https://$(curl -s ifconfig.me):8889"
echo "ROBOT_CAM_IP=100.126.251.43"
echo "TABLE_CAM_IP=100.126.251.43" 
echo "CEILING_CAM_IP=100.126.251.43"
