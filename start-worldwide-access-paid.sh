#!/bin/bash

# Worldwide Access Script - Paid Cloudflare Version
# Requires: cloudflared tunnel setup with named tunnel

echo "🌍 === WORLDWIDE CAMERA ACCESS (PAID CLOUDFLARE) ==="
echo ""

# Check if user has configured tunnel
if [ ! -f ~/.cloudflared/config.yml ]; then
    echo "❌ No Cloudflare config found!"
    echo "📖 Please follow setup-paid-cloudflare.md first"
    echo "💡 Or use ./start-worldwide-access.sh for free version"
    exit 1
fi

# Kill any existing processes
echo "1. Cleaning up existing processes..."
pkill -f mediamtx 2>/dev/null || true
pkill -f 'node server' 2>/dev/null || true
pkill -f cloudflared 2>/dev/null || true
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

# Start Cloudflare tunnel (named tunnel)
echo "4. Starting Cloudflare tunnel..."
cloudflared tunnel run &
TUNNEL_PID=$!
sleep 5

# Get the fixed URL from config
TUNNEL_URL=$(grep "hostname:" ~/.cloudflared/config.yml | awk '{print "https://" $2}')

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Could not determine tunnel URL from config"
    kill $MTX_PID $SERVER_PID $TUNNEL_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 === WORLDWIDE ACCESS READY (FIXED URL!) ==="
echo ""
echo "📺 Local interface: http://localhost:3100"
echo "🌍 Worldwide URL: $TUNNEL_URL"
echo ""
echo "✨ === VERCEL ENVIRONMENT VARIABLES (SET ONCE!) ==="
echo ""
echo "CAM_USER=admin"
echo "CAM_PASS=Password"
echo "ROBOT_CAM_IP=192.168.4.181"
echo "TABLE_CAM_IP=192.168.4.182"
echo "CEILING_CAM_IP=192.168.4.183"
echo "MEDIAMTX_HTTP=$TUNNEL_URL"
echo "MEDIAMTX_WHEP=$TUNNEL_URL"
echo ""
echo "🔄 === VERCEL CLI UPDATE (ONE TIME SETUP) ==="
echo ""
echo "vercel env add CAM_USER admin"
echo "vercel env add CAM_PASS Password"
echo "vercel env add ROBOT_CAM_IP 192.168.4.181"
echo "vercel env add TABLE_CAM_IP 192.168.4.182"
echo "vercel env add CEILING_CAM_IP 192.168.4.183"
echo "vercel env add MEDIAMTX_HTTP $TUNNEL_URL"
echo "vercel env add MEDIAMTX_WHEP $TUNNEL_URL"
echo ""
echo "🎯 === SERVICES RUNNING ==="
echo "- MediaMTX PID: $MTX_PID"
echo "- Express Server PID: $SERVER_PID" 
echo "- Cloudflare Tunnel PID: $TUNNEL_PID"
echo ""
echo "💰 Benefits of paid Cloudflare:"
echo "- Same URL every time: $TUNNEL_URL"
echo "- Better uptime and reliability"
echo "- Access controls available"
echo "- No need to update Vercel environment variables!"
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
        cloudflared tunnel run &
        TUNNEL_PID=$!
    fi
done

