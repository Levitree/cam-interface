#!/bin/bash

# Update VPS MediaMTX to use camera proxy
# Run this on your VPS: ssh root@165.227.7.229

echo "=== Updating VPS MediaMTX Configuration ==="

# Stop MediaMTX
echo "1. Stopping MediaMTX..."
systemctl stop mediamtx

# Create updated config with camera proxy sources
echo "2. Creating MediaMTX config with camera sources..."
cat > mediamtx.yml << 'EOF'
paths:
  robot:
    source: rtsp://admin:Password@100.126.251.43:5541/cam/realmonitor?channel=1&subtype=0
  table:
    source: rtsp://admin:Password@100.126.251.43:5542/cam/realmonitor?channel=1&subtype=0
  ceiling:
    source: rtsp://admin:Password@100.126.251.43:5543/cam/realmonitor?channel=1&subtype=0

webrtc: yes
hls: yes
webrtcAddress: 0.0.0.0:8889
hlsAddress: 0.0.0.0:8888
EOF

# Start MediaMTX
echo "3. Starting MediaMTX..."
systemctl start mediamtx

# Wait and check status
echo "4. Checking MediaMTX status..."
sleep 5
systemctl status mediamtx --no-pager -l | tail -10

echo ""
echo "5. Testing camera connectivity..."
# Test if cameras are now accessible
curl -s --max-time 5 "http://100.126.251.43:5541" && echo "✅ Robot camera proxy reachable" || echo "❌ Robot camera proxy not reachable"

echo ""
echo "✅ VPS MediaMTX updated with camera sources!"
echo "🌐 Test: http://165.227.7.229:8888"
