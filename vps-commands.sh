#!/bin/bash

# VPS Setup Commands for 165.227.7.229
# Your Tailscale IP: 100.126.251.43

echo "=== MediaMTX VPS Setup ==="
echo "VPS IP: 165.227.7.229"
echo "Your Tailscale IP: 100.126.251.43"
echo ""

# Update system
echo "1. Updating system..."
apt update && apt upgrade -y

# Install Tailscale
echo "2. Installing Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh

echo "3. Connecting to Tailscale network..."
tailscale up
echo ""
echo "🔗 IMPORTANT: Go to the URL above to authorize this VPS"
echo "Press Enter when you've authorized it..."
read

# Verify Tailscale connection
echo "4. Verifying Tailscale connection..."
VPS_TAILSCALE_IP=$(tailscale ip -4)
echo "VPS Tailscale IP: $VPS_TAILSCALE_IP"

# Test connection to your cameras via Tailscale
echo "5. Testing camera connectivity via Tailscale..."
curl -s --max-time 5 --digest -u admin:Password "http://100.126.251.43/cgi-bin/snapshot.cgi" -o /tmp/test.jpg
if [ -s /tmp/test.jpg ]; then
    echo "✅ Camera connection working!"
else
    echo "❌ Camera connection failed - check Tailscale setup"
fi

# Install MediaMTX
echo "6. Installing MediaMTX..."
wget https://github.com/bluenviron/mediamtx/releases/download/v1.14.0/mediamtx_v1.14.0_linux_amd64.tar.gz
tar -xzf mediamtx_v1.14.0_linux_amd64.tar.gz

# Create MediaMTX config
echo "7. Creating MediaMTX configuration..."
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

# Create systemd service
echo "8. Creating MediaMTX service..."
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

# Configure firewall
echo "9. Configuring firewall..."
ufw allow 8888/tcp
ufw allow 8889/tcp
ufw allow 22/tcp
ufw --force enable

# Start MediaMTX
echo "10. Starting MediaMTX..."
systemctl enable mediamtx
systemctl start mediamtx

# Wait and check status
sleep 5
systemctl status mediamtx --no-pager

echo ""
echo "🎉 SETUP COMPLETE!"
echo ""
echo "📋 Copy these environment variables to Vercel:"
echo "CAM_USER=admin"
echo "CAM_PASS=Password"
echo "ROBOT_CAM_IP=100.126.251.43"
echo "TABLE_CAM_IP=100.126.251.43"
echo "CEILING_CAM_IP=100.126.251.43"
echo "MEDIAMTX_HTTP=https://165.227.7.229:8888"
echo "MEDIAMTX_WHEP=https://165.227.7.229:8889"
echo ""
echo "🌐 Test your setup: https://165.227.7.229:8888"

