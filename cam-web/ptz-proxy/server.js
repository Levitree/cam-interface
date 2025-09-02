import express from 'express';
import fetch from 'node-fetch';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import { raw as expressRaw } from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

const app = express();
app.use(compression());
app.use(express.json());
// Accept raw SDP for WHEP endpoints
app.use('/whep', express.text({ type: 'application/sdp' }));

const CAM_USER = process.env.CAM_USER;
const CAM_PASS = process.env.CAM_PASS;
const ROBOT_CAM_IP = process.env.ROBOT_CAM_IP;
const TABLE_CAM_IP = process.env.TABLE_CAM_IP;
const MEDIAMTX_HTTP = process.env.MEDIAMTX_HTTP || 'http://127.0.0.1:8888';
const MEDIAMTX_WHEP = process.env.MEDIAMTX_WHEP || 'http://127.0.0.1:8889';

function ptzUrl(ip, params) {
  const qs = new URLSearchParams(params).toString();
  return `http://${CAM_USER}:${CAM_PASS}@${ip}/cgi-bin/ptz.cgi?${qs}`;
}

// PTZ action mapping
const PTZ_ACTIONS = {
  'up': 'Up',
  'down': 'Down', 
  'left': 'Left',
  'right': 'Right',
  'up-left': 'LeftUp',
  'up-right': 'RightUp',
  'down-left': 'LeftDown',
  'down-right': 'RightDown',
  'zoom-in': 'ZoomTele',
  'zoom-out': 'ZoomWide',
  'stop': 'Stop'
};

app.post('/api/ptz/start', async (req, res) => {
  const { camera = 'robot', action, speed = 4 } = { ...req.body, ...req.query };
  const ip = camera === 'table' ? TABLE_CAM_IP : ROBOT_CAM_IP;
  
  if (!ip) {
    return res.status(400).json({ error: 'Camera IP not configured' });
  }
  
  const code = PTZ_ACTIONS[action];
  if (!code) {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }
  
  console.log(`[PTZ] ${camera} start ${action} (${code})`);
  const url = ptzUrl(ip, { action: 'start', channel: 1, code, arg1: 0, arg2: speed, arg3: 0 });
  
  try {
    const r = await fetch(url);
    const result = await r.text();
    console.log(`[PTZ] Response: ${r.status} ${result}`);
    res.json({ ok: r.ok, status: r.status, result });
  } catch (error) {
    console.error(`[PTZ] Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ptz/stop', async (req, res) => {
  const { camera = 'robot', action = 'stop' } = { ...req.body, ...req.query };
  const ip = camera === 'table' ? TABLE_CAM_IP : ROBOT_CAM_IP;
  
  if (!ip) {
    return res.status(400).json({ error: 'Camera IP not configured' });
  }
  
  console.log(`[PTZ] ${camera} stop`);
  const url = ptzUrl(ip, { action: 'stop', channel: 1, code: 'Stop', arg1: 0, arg2: 0, arg3: 0 });
  
  try {
    const r = await fetch(url);
    const result = await r.text();
    console.log(`[PTZ] Stop response: ${r.status} ${result}`);
    res.json({ ok: r.ok, status: r.status, result });
  } catch (error) {
    console.error(`[PTZ] Stop error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ptz/preset', async (req, res) => {
  const { camera = 'robot', preset } = { ...req.body, ...req.query };
  const ip = camera === 'table' ? TABLE_CAM_IP : ROBOT_CAM_IP;
  
  if (!ip) {
    return res.status(400).json({ error: 'Camera IP not configured' });
  }
  
  if (!preset || isNaN(preset)) {
    return res.status(400).json({ error: 'Invalid preset number' });
  }
  
  console.log(`[PTZ] ${camera} goto preset ${preset}`);
  const url = ptzUrl(ip, { action: 'start', channel: 1, code: 'GotoPreset', arg1: 0, arg2: preset, arg3: 0 });
  
  try {
    const r = await fetch(url);
    const result = await r.text();
    console.log(`[PTZ] Preset response: ${r.status} ${result}`);
    res.json({ ok: r.ok, status: r.status, result });
  } catch (error) {
    console.error(`[PTZ] Preset error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy WHEP and HLS to local MediaMTX for dev
// POST /whep?path=robot → forward to MediaMTX
app.post('/whep', async (req, res) => {
  try {
    const name = (req.query.path || '').toString();
    if (!name) {
      console.warn('[WHEP] missing ?path=');
      res.status(400).send('missing path');
      return;
    }
    const target = `${MEDIAMTX_WHEP}/whep?path=${encodeURIComponent(name)}`;
    console.log(`[WHEP] POST /whep?path=%s → %s (sdp %d bytes)`, name, target, (req.body||'').length);
    const r = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: req.body || '' });
    const txt = await r.text();
    console.log(`[WHEP] ← %d (%d bytes)`, r.status, txt.length);
    res.status(r.status);
    const ct = r.headers.get('content-type');
    if (ct) res.set('Content-Type', ct);
    res.send(txt);
  } catch (e) {
    console.error('[WHEP] error', e.message);
    res.status(502).send('bad gateway');
  }
});

// POST /whep/robot → forward to MediaMTX
app.post('/whep/:name', async (req, res) => {
  try {
    const name = req.params.name;
    // MediaMTX v1.14 expects /:name/whep
    const target = `${MEDIAMTX_WHEP}/${encodeURIComponent(name)}/whep`;
    console.log(`[WHEP] POST /whep/%s → %s (sdp %d bytes)`, name, target, (req.body||'').length);
    const r = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: req.body || '' });
    const txt = await r.text();
    console.log(`[WHEP] ← %d (%d bytes)`, r.status, txt.length);
    res.status(r.status);
    const ct = r.headers.get('content-type');
    if (ct) res.set('Content-Type', ct);
    res.send(txt);
  } catch (e) {
    console.error('[WHEP] error', e.message);
    res.status(502).send('bad gateway');
  }
});
// Direct WHEP forward using raw Buffer to preserve SDP newlines
app.post('/robot/whep', expressRaw({ type: () => true, limit: '2mb' }), (req, res) => {
  try {
    const { hostname, port } = new URL(MEDIAMTX_WHEP);
    const options = {
      hostname,
      port: port ? Number(port) : 80,
      path: '/robot/whep',
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp', 'Content-Length': Buffer.byteLength(req.body || 0) }
    };
    const pr = http.request(options, (r) => {
      const chunks = [];
      r.on('data', (d) => chunks.push(d));
      r.on('end', () => {
        res.status(r.statusCode || 502);
        const ct = r.headers['content-type'];
        if (ct) res.set('Content-Type', ct);
        res.send(Buffer.concat(chunks));
      });
    });
    pr.on('error', () => res.status(502).send('bad gateway'));
    if (req.body && req.body.length) pr.write(req.body);
    pr.end();
  } catch {
    res.status(502).send('bad gateway');
  }
});

// MediaMTX HLS in current release serves at /<path>/index.m3u8 (no /hls prefix)
app.use('/hls', createProxyMiddleware({
  target: MEDIAMTX_HTTP,
  changeOrigin: true,
  xfwd: true,
  pathRewrite: (path) => path.replace(/^\/hls\//, '/'),
}));

// Proxy /robot/* to MediaMTX WHEP server (so /robot/whep works)
app.use('/robot', express.text({ type: 'application/sdp' }));
app.use('/robot', createProxyMiddleware({
  target: MEDIAMTX_WHEP,
  changeOrigin: true,
  xfwd: true,
  onProxyReq: (proxyReq, req) => {
    if (typeof req.body === 'string') {
      const len = Buffer.byteLength(req.body);
      proxyReq.setHeader('Content-Length', String(len));
      proxyReq.removeHeader('content-length');
      proxyReq.write(req.body);
    }
  }
}));

// Quiet favicon noise
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Serve static frontend (register last so dynamic routes win)
app.use('/', express.static(new URL('../web', import.meta.url).pathname));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3100;
app.listen(PORT, () => console.log(`Dev server listening on http://localhost:${PORT}`));

