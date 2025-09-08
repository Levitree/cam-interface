#!/bin/bash

echo "🚀 === STARTING WORLDWIDE CAMERA ACCESS ==="
echo ""

# Kill existing processes
echo "1. Cleaning up..."
pkill -f mediamtx 2>/dev/null || true
pkill -f 'node server' 2>/dev/null || true  
pkill -f cloudflared 2>/dev/null || true
sleep 3

# Start MediaMTX
echo "2. Starting MediaMTX..."
cd /Users/colejohnson/Desktop/cam-interface/cam-web/ptz-proxy
npm run mtx > /tmp/mediamtx.log 2>&1 &
MTX_PID=$!
sleep 8

# Start Express server  
echo "3. Starting Express server..."
PORT=3100 node server.js > /tmp/express.log 2>&1 &
SERVER_PID=$!
sleep 3

# Test local server
if curl -s http://localhost:3100/ > /dev/null; then
    echo "✅ Express server working"
else
    echo "❌ Express server failed"
    exit 1
fi

# Start Cloudflare tunnel and capture URL
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

# Test tunnel URL
echo "6. Testing tunnel URL..."
sleep 5
if curl -s -o /dev/null -w "%{http_code}" "$TUNNEL_URL/" | grep -q "200"; then
    echo "✅ Tunnel working!"
else
    echo "⚠️ Tunnel may still be connecting..."
fi

echo ""
echo "🎉 === SUCCESS! WORLDWIDE ACCESS READY ==="
echo ""
echo "📺 Local: http://localhost:3100"
echo "🌍 Worldwide: $TUNNEL_URL"
echo ""
echo "📋 === VERCEL ENVIRONMENT VARIABLES ==="
echo ""
echo "CAM_USER=admin"
echo "CAM_PASS=Password"
echo "ROBOT_CAM_IP=192.168.4.181"
echo "TABLE_CAM_IP=192.168.4.182"
echo "CEILING_CAM_IP=192.168.4.183"
echo "MEDIAMTX_HTTP=$TUNNEL_URL"
echo "MEDIAMTX_WHEP=$TUNNEL_URL"
echo ""
echo "🔄 To update Vercel with new URL:"
echo "vercel env add MEDIAMTX_HTTP $TUNNEL_URL"
echo "vercel env add MEDIAMTX_WHEP $TUNNEL_URL"
echo ""
echo "🎯 Services running:"
echo "- MediaMTX PID: $MTX_PID"
echo "- Express PID: $SERVER_PID"
echo "- Tunnel PID: $TUNNEL_PID"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Save URL for reference
echo "$TUNNEL_URL" > /tmp/current_tunnel_url.txt

# Keep running
trap 'echo "Stopping all services..."; kill $MTX_PID $SERVER_PID $TUNNEL_PID 2>/dev/null; exit' INT TERM
wait

