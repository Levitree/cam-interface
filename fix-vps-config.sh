#!/bin/bash

# Fix VPS MediaMTX Configuration
# Run this on your VPS to fix the camera connection issue

echo "=== Fixing VPS MediaMTX Configuration ==="

# Stop MediaMTX
echo "1. Stopping MediaMTX..."
systemctl stop mediamtx

# Create updated config that doesn't rely on RTSP initially
echo "2. Creating test configuration..."
cat > mediamtx.yml << 'EOF'
# Test configuration without camera sources initially
# We'll add cameras later once connectivity is confirmed

webrtc: yes
hls: yes

# Allow external connections
webrtcAddress: 0.0.0.0:8889
hlsAddress: 0.0.0.0:8888

# Test paths (no sources yet)
paths:
  robot:
    # Will add source later
  table:
    # Will add source later  
  ceiling:
    # Will add source later
EOF

# Start MediaMTX with test config
echo "3. Starting MediaMTX with test configuration..."
systemctl start mediamtx
sleep 3

# Check status
echo "4. Checking MediaMTX status..."
systemctl status mediamtx --no-pager -l

echo ""
echo "✅ MediaMTX should now be running without camera connection errors"
echo ""
echo "🔧 Next steps:"
echo "1. Test VPS MediaMTX: https://165.227.7.229:8888"
echo "2. Update Vercel environment variables:"
echo ""
echo "MEDIAMTX_HTTP=https://165.227.7.229:8888"
echo "MEDIAMTX_WHEP=https://165.227.7.229:8889"
echo "CAM_USER=admin"
echo "CAM_PASS=Password"
echo "ROBOT_CAM_IP=100.126.251.43"
echo "TABLE_CAM_IP=100.126.251.43"
echo "CEILING_CAM_IP=100.126.251.43"
echo ""
echo "3. Test Vercel deployment"
echo "4. We'll add camera sources once basic connectivity is working"
