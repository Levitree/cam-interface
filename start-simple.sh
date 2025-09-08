#!/bin/bash

echo "🚀 Starting Camera System..."

# Kill existing processes
pkill -f cloudflared 2>/dev/null || true
pkill -f mediamtx 2>/dev/null || true  
pkill -f 'node server' 2>/dev/null || true
sleep 3

# Start MediaMTX
echo "1. Starting MediaMTX..."
cd /Users/colejohnson/Desktop/cam-interface/cam-web/ptz-proxy
npm run mtx &
sleep 8

# Start Express server
echo "2. Starting Express server..."
PORT=3100 node server.js &
sleep 3

# Test local server
echo "3. Testing local server..."
if curl -s http://localhost:3100/ > /dev/null; then
    echo "✅ Local server working"
else
    echo "❌ Local server failed"
    exit 1
fi

# Start tunnel in foreground so we can see the URL
echo "4. Starting Cloudflare tunnel..."
echo "   Watch for the URL below:"
echo ""
cloudflared tunnel --url http://localhost:3100

