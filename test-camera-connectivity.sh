#!/bin/bash

# Test camera connectivity from VPS
# Run this on your VPS to verify camera proxy connections

echo "=== Testing Camera Connectivity from VPS ==="
echo "VPS Tailscale IP: $(tailscale ip -4)"
echo "Target Mac IP: 100.126.251.43"
echo ""

# Test basic connectivity to Mac
echo "1. Testing basic connectivity to Mac via Tailscale..."
ping -c 2 100.126.251.43 && echo "✅ Mac reachable via Tailscale" || echo "❌ Mac not reachable"
echo ""

# Test RTSP proxy ports
echo "2. Testing RTSP proxy ports..."
for port in 5541 5542 5543; do
    echo "Testing port $port..."
    timeout 3 bash -c "</dev/tcp/100.126.251.43/$port" && echo "✅ Port $port open" || echo "❌ Port $port closed"
done
echo ""

# Test HTTP proxy ports  
echo "3. Testing HTTP proxy ports..."
for port in 8181 8182 8183; do
    echo "Testing port $port..."
    timeout 3 bash -c "</dev/tcp/100.126.251.43/$port" && echo "✅ Port $port open" || echo "❌ Port $port closed"
done
echo ""

# Test camera HTTP endpoints
echo "4. Testing camera HTTP endpoints..."
cameras=("robot:8181" "table:8182" "ceiling:8183")
for cam_port in "${cameras[@]}"; do
    IFS=':' read -r name port <<< "$cam_port"
    echo "Testing $name camera HTTP..."
    response=$(curl -s --max-time 5 --digest -u admin:Password "http://100.126.251.43:$port/cgi-bin/snapshot.cgi" 2>&1)
    if [ $? -eq 0 ] && [ ${#response} -gt 100 ]; then
        echo "✅ $name camera HTTP working (snapshot size: ${#response} bytes)"
    else
        echo "❌ $name camera HTTP failed: $response"
    fi
done
echo ""

# Test RTSP endpoints
echo "5. Testing RTSP endpoints..."
for cam_port in "robot:5541" "table:5542" "ceiling:5543"; do
    IFS=':' read -r name port <<< "$cam_port"
    echo "Testing $name camera RTSP..."
    timeout 5 curl -s "rtsp://admin:Password@100.126.251.43:$port/cam/realmonitor?channel=1&subtype=0" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ $name camera RTSP responding"
    else
        echo "❌ $name camera RTSP not responding"
    fi
done
echo ""

# Check MediaMTX logs for camera connection status
echo "6. Checking MediaMTX camera connection logs..."
journalctl -u mediamtx --no-pager -l | tail -10 | grep -E "(robot|table|ceiling|RTSP source)"

echo ""
echo "🎯 Summary:"
echo "- If all ports are open: Camera proxy working ✅"
echo "- If HTTP endpoints work: PTZ commands will work ✅" 
echo "- If RTSP endpoints work: Video streams will work ✅"
echo "- Check MediaMTX logs for any remaining issues"
