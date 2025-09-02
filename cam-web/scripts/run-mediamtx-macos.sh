#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

MTX_DIR=".mtx"
MTX_BIN="$MTX_DIR/mediamtx"

mkdir -p "$MTX_DIR"
if [ ! -x "$MTX_BIN" ]; then
  echo "Downloading MediaMTX (macOS amd64/arm64)..."
  ARCH=$(/usr/bin/uname -m)
  case "$ARCH" in
    arm64) URL=$(/usr/bin/curl -s https://api.github.com/repos/bluenviron/mediamtx/releases/latest | /usr/bin/grep browser_download_url | /usr/bin/grep darwin_arm64.tar.gz | /usr/bin/head -n1 | /usr/bin/cut -d '"' -f4) ;;
    x86_64) URL=$(/usr/bin/curl -s https://api.github.com/repos/bluenviron/mediamtx/releases/latest | /usr/bin/grep browser_download_url | /usr/bin/grep darwin_amd64.tar.gz | /usr/bin/head -n1 | /usr/bin/cut -d '"' -f4) ;;
    *) echo "Unsupported arch: $ARCH"; exit 1 ;;
  esac
  TMP_EXTRACT="$MTX_DIR/extract-$$"
  /bin/mkdir -p "$TMP_EXTRACT"
  # Stream extract to avoid intermediate files; handle varying tar layout
  if ! /usr/bin/curl -L "$URL" | /usr/bin/tar -xzf - -C "$TMP_EXTRACT"; then
    echo "Failed to download or extract MediaMTX" >&2
    exit 1
  fi
  # Find mediamtx (or legacy rtsp-simple-server) binary
  FOUND_BIN=$(/usr/bin/find "$TMP_EXTRACT" -type f \( -name mediamtx -o -name rtsp-simple-server \) -perm -111 -print -quit)
  if [ -z "$FOUND_BIN" ]; then
    echo "Could not locate mediamtx binary in archive. Contents:" >&2
    /usr/bin/find "$TMP_EXTRACT" -maxdepth 2 -print >&2
    exit 1
  fi
  /bin/mv "$FOUND_BIN" "$MTX_BIN"
  /bin/chmod +x "$MTX_BIN"
  /bin/rm -rf "$TMP_EXTRACT"
fi

set +o allexport
set -a
[ -f .env ] && . ./.env || true
set +a
echo "Starting MediaMTX with mediamtx.yml"
"$MTX_BIN" ./mediamtx.yml

