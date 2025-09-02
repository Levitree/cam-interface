#!/bin/bash

# Script to start a persistent Cloudflare tunnel
# This helps maintain the same tunnel URL

TUNNEL_URL_FILE="/tmp/tunnel_url.txt"
LOG_FILE="/tmp/tunnel.log"

echo "=== Starting Persistent Cloudflare Tunnel ==="

# Kill any existing tunnels
pkill -f cloudflared 2>/dev/null || true
sleep 2

# Start MediaMTX if not running
if ! pgrep -f mediamtx > /dev/null; then
    echo "Starting MediaMTX..."
    cd cam-web/ptz-proxy
    npm run mtx &
    sleep 5
    cd ..
fi

# Start Express server if not running
if ! pgrep -f "node server.js" > /dev/null; then
    echo "Starting Express server..."
    cd cam-web/ptz-proxy
    PORT=3100 node server.js &
    sleep 3
    cd ..
fi

# Start tunnel
echo "Starting Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:3100 > "$LOG_FILE" 2>&1 &
TUNNEL_PID=$!

# Wait for tunnel URL
echo "Waiting for tunnel URL..."
for i in {1..30}; do
    if grep -q "trycloudflare.com" "$LOG_FILE" 2>/dev/null; then
        TUNNEL_URL=$(grep -o "https://[^[:space:]]*\.trycloudflare\.com" "$LOG_FILE" | head -1)
        echo "$TUNNEL_URL" > "$TUNNEL_URL_FILE"
        echo "✅ Tunnel created: $TUNNEL_URL"
        echo ""
        echo "🔧 Update Vercel environment variables:"
        echo "MEDIAMTX_HTTP=$TUNNEL_URL"
        echo "MEDIAMTX_WHEP=$TUNNEL_URL"
        echo ""
        echo "🌐 Test your tunnel: $TUNNEL_URL"
        break
    fi
    sleep 1
done

# Keep tunnel running
echo "Tunnel running (PID: $TUNNEL_PID). Press Ctrl+C to stop."
wait $TUNNEL_PID
