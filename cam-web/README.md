# Two Amcrest cams → WebRTC site with PTZ

This repo streams two Amcrest IP2M-841 cameras via MediaMTX to WebRTC (WHEP) with TURN, serves a minimal web UI, and proxies PTZ control via a tiny Node backend.

Important: Hosting on Vercel can only serve the static frontend. MediaMTX (WebRTC/WHEP), TURN (coturn), and the PTZ proxy must run on a server that can reach your cameras (same LAN or via VPN) and expose UDP/TCP ports to the internet. See Non‑Docker install below.

## 0) Prereqs

- Cameras reachable from the server (static IPs or DHCP reservations)
- A domain name for the public site (e.g., streams.yourdomain.com)
- TLS certs for the domain (Let's Encrypt or your own)
- If testing locally on macOS: `brew install ffmpeg` (for ffprobe)

## 1) Camera connectivity test

Export env vars and run the checker (from `cam-web/`):

```bash
export CAM_USER=admin
export CAM_PASS=REPLACE_ME
export ROBOT_CAM_IP=192.168.10.101
export TABLE_CAM_IP=192.168.10.102
bash scripts/cam-check.sh
```

You should see a snapshot downloaded for each camera and ffprobe output confirming the RTSP stream.

## 2) Non‑Docker install (recommended if frontend on Vercel)

Provision a small Linux VPS (e.g., Ubuntu 22.04) or an on‑prem box that can reach your cameras. Open inbound: TCP 80/443, UDP 3478, TCP 3478, TCP 5349, and allow ephemeral UDP for WebRTC (or rely on TURN/TCP 5349 for restrictive NATs).

1. MediaMTX
   - Download latest release: https://github.com/bluenviron/mediamtx/releases
   - Place `mediamtx.yml` from this repo and export env vars (`CAM_*`, `*_CAM_IP`, `PUBLIC_HOST`, `TURN_*`).
   - Run: `./mediamtx ./mediamtx.yml` (or create a systemd service).

2. coturn (TURN/STUN)
   - Install: `sudo apt-get install coturn`
   - Provide cert/key for your domain (e.g., in `/etc/letsencrypt/live/<host>/`)
   - Minimal flags (systemd ExecStart or /etc/turnserver.conf):
     ```
     --fingerprint --lt-cred-mech \
     --realm=$TURN_REALM --user=$TURN_USER:$TURN_PASS \
     --listening-port=3478 --tls-listening-port=5349 \
     --cert=/path/to/fullchain.pem --pkey=/path/to/privkey.pem
     ```

3. Nginx (TLS termination + reverse proxy)
   - Copy `nginx/default.conf` and replace `${PUBLIC_HOST}` with your host.
   - Ensure certs at `/etc/letsencrypt/live/${PUBLIC_HOST}/`.
   - Proxy `/whep/` → MediaMTX `8889`, `/hls/` → MediaMTX `8888`, `/api/ptz/` → PTZ proxy `3000`.

4. PTZ proxy (Node/Express)
   - `cd ptz-proxy && npm ci && CAM_USER=... CAM_PASS=... ROBOT_CAM_IP=... TABLE_CAM_IP=... node server.js`
   - Keep it running with pm2/systemd if desired.

Frontend options:
 - Serve `web/` via the same Nginx on the server (simplest). The page will call `https://<PUBLIC_HOST>/whep/...` and `/api/ptz/...` automatically.
 - Or deploy only `web/` to Vercel (static). Set a Project Env `NEXT_PUBLIC_STREAM_HOST` and add this inline before the player starts:
   ```html
   <script>window.PUBLIC_HOST = window.NEXT_PUBLIC_STREAM_HOST || '';</script>
   ```
   Or hardcode `window.PUBLIC_HOST = 'streams.yourdomain.com'`.

## 3) Docker Compose (optional, Linux host recommended)

Use `docker-compose.yml` as provided. Note: `network_mode: host` for MediaMTX requires a Linux host for proper UDP behavior. On macOS/Windows Docker Desktop, WebRTC ICE can be unreliable.

```bash
cp env.example .env   # then edit values
docker compose up -d
```

Place certs at `nginx/certs/live/${PUBLIC_HOST}/...` or adjust the Nginx config accordingly.

## 4) Verify

- https://PUBLIC_HOST/ loads with valid TLS
- `/whep/robot` and `/whep/table` respond 200 with SDP
- WebRTC plays from LTE (TURN used on restrictive networks)
- HLS fallback: `https://PUBLIC_HOST/hls/robot/index.m3u8`
- PTZ buttons pan/tilt while pressed; presets move instantly

## 5) Notes

- Keep camera credentials server-side only. The browser never sees RTSP or IPs.
- TURN on 5349/TLS is essential for “anywhere” connectivity.
- For best reliability, run MediaMTX and TURN on the same VM with public IP.
 - Vercel cannot run MediaMTX or TURN. Use Vercel only for the static site; run services on a reachable server and point the site to it via `window.PUBLIC_HOST`.

