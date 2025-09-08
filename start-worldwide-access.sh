#!/bin/bash

# Complete Worldwide Access Setup Script
# This starts everything needed and provides easy Vercel environment variables

echo "🌍 === WORLDWIDE CAMERA ACCESS STARTUP ==="
echo ""

# Kill any existing processes
echo "1. Cleaning up existing processes..."
pkill -f mediamtx 2>/dev/null || true
pkill -f 'node server' 2>/dev/null || true
pkill -f cloudflared 2>/dev/null || true
pkill -f socat 2>/dev/null || true
sleep 3

# Start MediaMTX
echo "2. Starting MediaMTX..."
cd /Users/colejohnson/Desktop/cam-interface/cam-web/ptz-proxy
npm run mtx &
MTX_PID=$!
sleep 8

# Check if MediaMTX started successfully
if ps -p $MTX_PID > /dev/null; then
    echo "✅ MediaMTX started successfully"
else
    echo "❌ MediaMTX failed to start"
    exit 1
fi

# Start Express server
echo "3. Starting Express server..."
PORT=3100 node server.js &
SERVER_PID=$!
sleep 3

# Check if Express server started
if curl -s http://localhost:3100/ > /dev/null; then
    echo "✅ Express server started successfully"
else
    echo "❌ Express server failed to start"
    kill $MTX_PID 2>/dev/null
    exit 1
fi

# Start Cloudflare tunnel
echo "4. Starting Cloudflare tunnel..."
TUNNEL_LOG="/tmp/tunnel_$(date +%s).log"
cloudflared tunnel --url http://localhost:3100 > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# Wait for tunnel URL
echo "5. Waiting for tunnel URL..."
TUNNEL_URL=""
for i in {1..30}; do
    if grep -q "trycloudflare.com" "$TUNNEL_LOG" 2>/dev/null; then
        TUNNEL_URL=$(grep -o "https://[^[:space:]]*\.trycloudflare\.com" "$TUNNEL_LOG" | head -1)
        break
    fi
    sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Failed to get tunnel URL"
    kill $MTX_PID $SERVER_PID $TUNNEL_PID 2>/dev/null
    exit 1
fi

# Save tunnel URL for future reference
echo "$TUNNEL_URL" > /tmp/current_tunnel_url.txt

echo ""
echo "🎉 === WORLDWIDE ACCESS READY ==="
echo ""
echo "📺 Local interface: http://localhost:3100"
echo "🌍 Worldwide URL: $TUNNEL_URL"
echo ""
echo "📋 === COPY THESE TO VERCEL ENVIRONMENT VARIABLES ==="
echo ""
echo "CAM_USER=admin"
echo "CAM_PASS=Password"
echo "ROBOT_CAM_IP=192.168.4.181"
echo "TABLE_CAM_IP=192.168.4.182"
echo "CEILING_CAM_IP=192.168.4.183"
echo "MEDIAMTX_HTTP=$TUNNEL_URL"
echo "MEDIAMTX_WHEP=$TUNNEL_URL"
echo ""
echo "🔄 === QUICK VERCEL UPDATE COMMAND ==="
echo ""
echo "Copy this command to update Vercel via CLI (if you have vercel CLI):"
echo ""
echo "vercel env add MEDIAMTX_HTTP $TUNNEL_URL"
echo "vercel env add MEDIAMTX_WHEP $TUNNEL_URL"
echo ""
echo "💡 === TUNNEL MANAGEMENT ==="
echo "- Current tunnel URL saved to: /tmp/current_tunnel_url.txt"
echo "- To get current URL: cat /tmp/current_tunnel_url.txt"
echo "- To restart tunnel: kill $TUNNEL_PID && ./start-worldwide-access.sh"
echo ""
echo "🎯 === SERVICES RUNNING ==="
echo "- MediaMTX PID: $MTX_PID"
echo "- Express Server PID: $SERVER_PID" 
echo "- Cloudflare Tunnel PID: $TUNNEL_PID"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep services running
trap 'echo "Stopping services..."; kill $MTX_PID $SERVER_PID $TUNNEL_PID 2>/dev/null; exit' INT TERM

# Monitor services
while true; do
    sleep 30
    if ! ps -p $MTX_PID > /dev/null; then
        echo "❌ MediaMTX died, restarting..."
        npm run mtx &
        MTX_PID=$!
    fi
    if ! ps -p $SERVER_PID > /dev/null; then
        echo "❌ Express server died, restarting..."
        PORT=3100 node server.js &
        SERVER_PID=$!
    fi
    if ! ps -p $TUNNEL_PID > /dev/null; then
        echo "❌ Tunnel died, restarting..."
        cloudflared tunnel --url http://localhost:3100 > "$TUNNEL_LOG" 2>&1 &
        TUNNEL_PID=$!
    fi
done

