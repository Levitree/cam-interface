#!/bin/bash

# Start camera proxy on your Mac
# This allows VPS to access cameras via Tailscale

echo "=== Starting Camera Proxy ==="
echo "This will proxy camera RTSP streams via Tailscale"

# Kill any existing proxies
pkill -f "socat" 2>/dev/null || true

# Install socat if not available
if ! command -v socat >/dev/null 2>&1; then
    echo "Installing socat..."
    brew install socat
fi

echo "Starting RTSP proxies..."

# Proxy camera RTSP streams on different ports
socat TCP-LISTEN:5541,fork,reuseaddr TCP:192.168.4.181:554 &
socat TCP-LISTEN:5542,fork,reuseaddr TCP:192.168.4.182:554 &
socat TCP-LISTEN:5543,fork,reuseaddr TCP:192.168.4.183:554 &

echo "✅ Camera RTSP proxies started:"
echo "  Robot:   100.126.251.43:5541 → 192.168.4.181:554"
echo "  Table:   100.126.251.43:5542 → 192.168.4.182:554" 
echo "  Ceiling: 100.126.251.43:5543 → 192.168.4.183:554"
echo ""
echo "🔧 Now update VPS MediaMTX config:"
echo "ssh root@165.227.7.229"
echo "Then run:"
echo ""
echo "cat > mediamtx.yml << 'EOF'"
echo "paths:"
echo "  robot:"
echo "    source: rtsp://admin:Password@100.126.251.43:5541/cam/realmonitor?channel=1&subtype=0"
echo "  table:"
echo "    source: rtsp://admin:Password@100.126.251.43:5542/cam/realmonitor?channel=1&subtype=0"
echo "  ceiling:"
echo "    source: rtsp://admin:Password@100.126.251.43:5543/cam/realmonitor?channel=1&subtype=0"
echo ""
echo "webrtc: yes"
echo "hls: yes"
echo "webrtcAddress: 0.0.0.0:8889"
echo "hlsAddress: 0.0.0.0:8888"
echo "EOF"
echo ""
echo "systemctl restart mediamtx"
echo ""
echo "Press Ctrl+C to stop proxy when done"
wait

