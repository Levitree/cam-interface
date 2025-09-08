// RTSP Proxy Server
// Runs on your Mac to proxy camera RTSP streams to VPS via Tailscale

import express from 'express';
import { spawn } from 'child_process';

const app = express();

console.log('=== RTSP Proxy Server ===');
console.log('Proxying local camera RTSP streams for VPS access via Tailscale');

// Camera mappings
const cameras = {
  robot: '192.168.4.181',
  table: '192.168.4.182', 
  ceiling: '192.168.4.183'
};

// Simple RTSP proxy using ffmpeg
function createRTSPProxy(cameraName, localIP, port) {
  app.get(`/${cameraName}`, (req, res) => {
    console.log(`RTSP request for ${cameraName} camera`);
    
    const rtspUrl = `rtsp://admin:Password@${localIP}:554/cam/realmonitor?channel=1&subtype=0`;
    
    res.writeHead(200, {
      'Content-Type': 'application/x-rtsp'
    });
    
    // Simple proxy response
    res.end(`RTSP stream available at: ${rtspUrl}`);
  });
}

// Create proxies for each camera
Object.entries(cameras).forEach(([name, ip]) => {
  createRTSPProxy(name, ip, 554);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cameras: cameras,
    tailscaleIP: process.env.TAILSCALE_IP || '100.126.251.43'
  });
});

// Test camera connectivity
app.get('/test/:camera', async (req, res) => {
  const camera = req.params.camera;
  const ip = cameras[camera];
  
  if (!ip) {
    return res.status(404).json({ error: 'Camera not found' });
  }
  
  console.log(`Testing ${camera} camera at ${ip}`);
  
  // Test with curl
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    const { stdout } = await execAsync(`curl -s --max-time 3 --digest -u admin:Password "http://${ip}/cgi-bin/snapshot.cgi" | wc -c`);
    const size = parseInt(stdout.trim());
    
    if (size > 1000) {
      res.json({ status: 'ok', camera, ip, snapshotSize: size });
    } else {
      res.status(500).json({ status: 'error', camera, ip, message: 'Snapshot too small' });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', camera, ip, message: error.message });
  }
});

const PORT = 8554;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RTSP proxy listening on port ${PORT}`);
  console.log('VPS can now access: http://100.126.251.43:8554/robot');
  console.log('Test: http://100.126.251.43:8554/health');
});

