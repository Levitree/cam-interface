// Camera Proxy Server
// Runs on your Mac to proxy camera requests from VPS via Tailscale

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

console.log('=== Camera Proxy Server ===');
console.log('This proxies camera requests from VPS to local cameras');

// Proxy RTSP requests to cameras
app.use('/robot', createProxyMiddleware({
  target: 'rtsp://192.168.4.181:554',
  changeOrigin: true,
  logLevel: 'info'
}));

app.use('/table', createProxyMiddleware({
  target: 'rtsp://192.168.4.182:554', 
  changeOrigin: true,
  logLevel: 'info'
}));

app.use('/ceiling', createProxyMiddleware({
  target: 'rtsp://192.168.4.183:554',
  changeOrigin: true, 
  logLevel: 'info'
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    cameras: {
      robot: '192.168.4.181:554',
      table: '192.168.4.182:554',
      ceiling: '192.168.4.183:554'
    }
  });
});

const PORT = 554;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Camera proxy listening on port ${PORT}`);
  console.log('VPS can now access cameras via Tailscale IP');
});

