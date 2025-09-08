#!/usr/bin/env bash
set -euo pipefail

# Simple launcher to create Low-Latency Mux live streams and push RTSP cameras via ffmpeg
# Requirements: curl, ffmpeg, jq (optional; python3 used as fallback JSON parser)

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)

# Load local env if present (do NOT commit secrets)
if [ -f "$ROOT_DIR/.env.local" ]; then
  set -a
  . "$ROOT_DIR/.env.local"
  set +a
fi

# Camera RTSP URLs (override in .env.local if needed)
ROBOT_RTSP=${ROBOT_RTSP:-"rtsp://admin:Password@192.168.4.181:554/cam/realmonitor?channel=1&subtype=0"}
TABLE_RTSP=${TABLE_RTSP:-"rtsp://admin:Password@192.168.4.182:554/cam/realmonitor?channel=1&subtype=0"}
CEILING_RTSP=${CEILING_RTSP:-"rtsp://admin:Password@192.168.4.183:554/cam/realmonitor?channel=1&subtype=0"}

# Mux tokens (primary required). Optionally set MUX_TOKEN_ID2/3 and MUX_TOKEN_SECRET2/3.
MUX_TOKEN_ID=${MUX_TOKEN_ID:-""}
MUX_TOKEN_SECRET=${MUX_TOKEN_SECRET:-""}
MUX_TOKEN_ID2=${MUX_TOKEN_ID2:-""}
MUX_TOKEN_SECRET2=${MUX_TOKEN_SECRET2:-""}
MUX_TOKEN_ID3=${MUX_TOKEN_ID3:-""}
MUX_TOKEN_SECRET3=${MUX_TOKEN_SECRET3:-""}

STREAM_DIR="$ROOT_DIR/.mux_streams"
mkdir -p "$STREAM_DIR"

has_cmd() { command -v "$1" >/dev/null 2>&1; }

json_get() {
  # json_get FILE JSON_PATH
  # Uses jq if available, else python3
  local file="$1"; shift
  local path="$1"; shift || true
  if has_cmd jq; then
    jq -r "$path" "$file"
  else
    python3 - "$file" "$path" <<'PY'
import json,sys
fname=sys.argv[1]; path=sys.argv[2]
obj=json.load(open(fname))
for part in path.strip('.').split('.'):
    if part.endswith(']') and '[' in part:
        k,idx=part[:-1].split('['); idx=int(idx)
        obj=obj[k][idx]
    else:
        obj=obj[part]
print(obj)
PY
  fi
}

pick_token() {
  # pick_token CAMERA -> echo "ID:SECRET"
  local cam="$1"
  case "$cam" in
    table)
      if [ -n "$MUX_TOKEN_ID2" ] && [ -n "$MUX_TOKEN_SECRET2" ]; then
        echo "$MUX_TOKEN_ID2:$MUX_TOKEN_SECRET2"; return
      fi
      ;;
    ceiling)
      if [ -n "$MUX_TOKEN_ID3" ] && [ -n "$MUX_TOKEN_SECRET3" ]; then
        echo "$MUX_TOKEN_ID3:$MUX_TOKEN_SECRET3"; return
      fi
      ;;
  esac
  if [ -z "$MUX_TOKEN_ID" ] || [ -z "$MUX_TOKEN_SECRET" ]; then
    echo "ERR: MUX_TOKEN_ID/SECRET missing" >&2; return 1
  fi
  echo "$MUX_TOKEN_ID:$MUX_TOKEN_SECRET"
}

ensure_stream() {
  # ensure_stream CAMERA PASSTHROUGH_VAR
  local cam="$1"; shift
  local tag="$1"; shift
  local json="$STREAM_DIR/${cam}.json"
  local token
  token=$(pick_token "$cam")

  # If json exists, reuse
  if [ -f "$json" ]; then
    return 0
  fi

  echo "Creating Mux LL stream for $cam..."
  curl -s -u "$token" \
    -H "Content-Type: application/json" \
    -d '{"latency_mode":"low","playback_policy":["public"],"reconnect_window":60,"passthrough":"'$tag'","new_asset_settings":{"playback_policy":["public"]}}' \
    https://api.mux.com/video/v1/live-streams > "$json"
  if ! grep -q '"data"' "$json"; then
    echo "Failed to create stream for $cam. Response:" >&2; head -n 40 "$json" >&2; return 1
  fi
}

stream_key() { json_get "$STREAM_DIR/$1.json" '.data.stream_key'; }
playback_id() { json_get "$STREAM_DIR/$1.json" '.data.playback_ids[0].id'; }

start_ffmpeg() {
  # start_ffmpeg CAMERA RTSP
  local cam="$1"; shift
  local rtsp="$1"; shift
  local key
  key=$(stream_key "$cam")
  local pid_file="/tmp/ffmpeg-mux-${cam}-ll.pid"
  local log_file="/tmp/ffmpeg-mux-${cam}-ll.log"
  pkill -f "ffmpeg .*global-live.mux.com/app/$key" 2>/dev/null || true
  echo "Starting ingest for $cam → $key"
  nohup ffmpeg -nostats -hide_banner -loglevel info -rtsp_transport tcp \
    -i "$rtsp" \
    -fflags +genpts -c:v libx264 -preset veryfast -profile:v high -pix_fmt yuv420p \
    -r 30 -g 30 -keyint_min 30 -sc_threshold 0 -b:v 3800k -maxrate 4200k -bufsize 7600k \
    -c:a aac -ar 44100 -b:a 128k \
    -f flv "rtmps://global-live.mux.com:443/app/$key" >> "$log_file" 2>&1 & echo $! > "$pid_file"
}

stop_ffmpeg() {
  local cam="$1"; shift
  local key
  key=$(stream_key "$cam" 2>/dev/null || true)
  pkill -f "ffmpeg .*global-live.mux.com/app/$key" 2>/dev/null || true
}

probe_mux() {
  local cam="$1"; shift
  local pid
  pid=$(playback_id "$cam")
  echo "== $cam (playback) =="
  curl -sS "https://stream.mux.com/$pid.m3u8" | head -n 8 || true
}

status_cam() {
  local cam="$1"; shift
  local key pidf 
  key=$(stream_key "$cam" 2>/dev/null || true)
  pidf="/tmp/ffmpeg-mux-${cam}-ll.pid"
  echo "-- $cam --"
  echo "stream_key: ${key:-unknown}"
  if [ -s "$pidf" ] && ps -p "$(cat "$pidf")" >/dev/null 2>&1; then
    echo "ffmpeg: running (PID $(cat "$pidf"))"
  else
    echo "ffmpeg: not running"
  fi
}

cmd=${1:-help}
case "$cmd" in
  start)
    ensure_stream robot robot; ensure_stream table table; ensure_stream ceiling ceiling;
    start_ffmpeg robot   "$ROBOT_RTSP"
    start_ffmpeg table   "$TABLE_RTSP"
    start_ffmpeg ceiling "$CEILING_RTSP" || true
    echo "Warming up..."; sleep 20
    probe_mux robot; echo; probe_mux table; echo; probe_mux ceiling;
    ;;
  start-robot)
    ensure_stream robot robot; start_ffmpeg robot "$ROBOT_RTSP"; sleep 15; probe_mux robot;
    ;;
  start-table)
    ensure_stream table table; start_ffmpeg table "$TABLE_RTSP"; sleep 15; probe_mux table;
    ;;
  start-ceiling)
    ensure_stream ceiling ceiling; start_ffmpeg ceiling "$CEILING_RTSP"; sleep 15; probe_mux ceiling;
    ;;
  stop)
    for c in robot table ceiling; do stop_ffmpeg "$c"; done
    ;;
  status)
    for c in robot table ceiling; do status_cam "$c"; done
    echo; for c in robot table ceiling; do probe_mux "$c"; echo; done
    ;;
  *)
    echo "Usage: $0 {start|start-robot|start-table|start-ceiling|stop|status}";
    echo "- Configure MUX_TOKEN_ID/SECRET (and optionally 2/3) in .env.local";
    echo "- Override RTSP URLs via ROBOT_RTSP/TABLE_RTSP/CEILING_RTSP if needed";
    ;;
esac


