#!/usr/bin/env bash
set -euo pipefail

: "${CAM_USER:?Set CAM_USER}"
: "${CAM_PASS:?Set CAM_PASS}"
: "${ROBOT_CAM_IP:?Set ROBOT_CAM_IP}"
: "${TABLE_CAM_IP:?Set TABLE_CAM_IP}"

check_cam() {
  local name="$1" ip="$2"
  echo "== $name ($ip) =="
  if curl -fsS -o "/tmp/${name}-snapshot.jpg" "http://${CAM_USER}:${CAM_PASS}@${ip}/cgi-bin/snapshot.cgi"; then
    echo "Snapshot OK: /tmp/${name}-snapshot.jpg"
  else
    echo "Snapshot FAILED"
  fi

  local RTSP="rtsp://${CAM_USER}:${CAM_PASS}@${ip}:554/cam/realmonitor?channel=1&subtype=0"
  if command -v ffprobe >/dev/null 2>&1; then
    if ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of default=nk=1:nw=1 "$RTSP" | sed 's/^/RTSP OK: /'; then
      true
    else
      echo "RTSP FAILED"
    fi
  else
    echo "ffprobe not found (macOS: brew install ffmpeg)"
  fi
}

check_cam "robot" "$ROBOT_CAM_IP"
check_cam "table" "$TABLE_CAM_IP"

