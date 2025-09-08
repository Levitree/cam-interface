#!/bin/bash

# Simple VPS connectivity test
# Run this on VPS: curl -s https://raw.githubusercontent.com/Levitree/cam-interface/main/simple-vps-test.sh | bash

echo "=== Simple VPS Camera Connectivity Test ==="

# Test basic Tailscale connectivity
echo "1. Testing Tailscale connectivity to Mac..."
if ping -c 1 -W 3 100.126.251.43 >/dev/null 2>&1; then
    echo "✅ Mac reachable via Tailscale"
else
    echo "❌ Mac not reachable via Tailscale"
    exit 1
fi

# Test if we can reach cameras directly via your Mac's local network
echo ""
echo "2. Testing direct camera access via Mac..."

# Try to reach cameras through your Mac (assuming port forwarding)
for cam in "robot:192.168.4.181" "table:192.168.4.182" "ceiling:192.168.4.183"; do
    IFS=':' read -r name ip <<< "$cam"
    echo "Testing $name camera..."
    
    # Test camera HTTP endpoint
    if curl -s --max-time 3 --digest -u admin:Password "http://$ip/cgi-bin/snapshot.cgi" >/dev/null 2>&1; then
        echo "✅ $name camera ($ip) reachable directly"
    else
        echo "❌ $name camera ($ip) not reachable directly"
    fi
done

echo ""
echo "3. Checking MediaMTX status..."
if systemctl is-active mediamtx >/dev/null 2>&1; then
    echo "✅ MediaMTX service running"
    
    # Check recent logs
    echo "Recent MediaMTX logs:"
    journalctl -u mediamtx --since "5 minutes ago" --no-pager | tail -5 || echo "No recent logs"
else
    echo "❌ MediaMTX service not running"
fi

echo ""
echo "4. Testing MediaMTX endpoints..."
curl -s --max-time 3 "http://localhost:8888/" >/dev/null && echo "✅ MediaMTX HLS responding" || echo "❌ MediaMTX HLS not responding"
curl -s --max-time 3 "http://localhost:8889/" >/dev/null && echo "✅ MediaMTX WHEP responding" || echo "❌ MediaMTX WHEP not responding"

echo ""
echo "🎯 Summary:"
echo "If cameras are reachable directly, the issue is with the proxy setup on your Mac"
echo "If MediaMTX is responding, the VPS side is working correctly"

