# Camera Interface

Professional multi-camera PTZ control interface with WebRTC streaming.

## Features

🎥 **Triple Camera Support**
- Robot Camera (192.168.4.181)
- Table Camera (192.168.4.182)  
- Ceiling Camera (192.168.4.183)

🎮 **PTZ Controls**
- Hold-to-move directional controls
- Individual controls for each camera
- Instant stop functionality
- IP address configuration per camera

📺 **Live Streaming**
- WebRTC/WHEP for low-latency streaming
- MediaMTX backend for RTSP→WebRTC conversion
- Responsive 3-camera layout

## Local Development

```bash
# Clone repository
git clone https://github.com/Levitree/cam-interface.git
cd cam-interface

# Install dependencies
cd cam-web/ptz-proxy
npm install

# Start development (requires cameras on local network)
npm run dev
```

Visit `http://localhost:3100` to access the interface.

## Vercel Deployment

**Important:** This app requires local camera access and MediaMTX streaming server. The Vercel deployment serves the frontend interface, but you'll need to configure the backend endpoints to point to your local streaming server.

### Environment Variables

Set these in your Vercel project settings:

```
MEDIAMTX_HTTP=https://your-streaming-server.com:8888
MEDIAMTX_WHEP=https://your-streaming-server.com:8889
PUBLIC_HOST=your-vercel-app.vercel.app
```

### Camera Configuration

Each camera can be configured via the settings menu (⋯ button) in the interface.

## Architecture

- **Frontend**: Static HTML/JS served by Vercel
- **Backend**: Express.js server for PTZ proxy (can run on Vercel Functions)
- **Streaming**: MediaMTX server (requires separate hosting)
- **Cameras**: Amcrest IP2M-841 with Digest authentication

## Camera Requirements

- Amcrest IP cameras with PTZ support
- Network accessible via RTSP
- Digest authentication (admin/Password)
- Static IP configuration recommended
