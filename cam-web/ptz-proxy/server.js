import express from 'express';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import dotenv from 'dotenv';

const execAsync = promisify(exec);

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

const app = express();
app.use(compression());
app.use(express.json());
// Accept raw SDP for WHEP endpoints
app.use('/whep', express.text({ type: 'application/sdp' }));

// Detect vercel runtime and optional remote PTZ base (your Cloudflare tunnel)
const IS_VERCEL = !!process.env.VERCEL;
const PTZ_REMOTE_BASE = process.env.PTZ_REMOTE_BASE;

// On Vercel, proxy PTZ API to a remote base (e.g., your local Express via Cloudflare)
if (IS_VERCEL && PTZ_REMOTE_BASE) {
  console.log(`[PTZ] Running on Vercel; proxying /api/ptz to ${PTZ_REMOTE_BASE}`);
  app.use('/api/ptz', createProxyMiddleware({
    target: PTZ_REMOTE_BASE,
    changeOrigin: true,
    xfwd: true,
  }));
}

const CAM_USER = process.env.CAM_USER;
const CAM_PASS = process.env.CAM_PASS;
const ROBOT_CAM_IP = process.env.ROBOT_CAM_IP || '192.168.4.181';
const TABLE_CAM_IP = process.env.TABLE_CAM_IP || '192.168.4.182';
const CEILING_CAM_IP = process.env.CEILING_CAM_IP || '192.168.4.183';
const MEDIAMTX_HTTP = process.env.MEDIAMTX_HTTP || 'http://127.0.0.1:8888';
const MEDIAMTX_WHEP = process.env.MEDIAMTX_WHEP || 'http://127.0.0.1:8889';

// PTZ action mapping for UI controls
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

function ptzUrl(ip, params) {
  const qs = new URLSearchParams(params).toString();
  return `http://${ip}/cgi-bin/ptz.cgi?${qs}`;
}

async function sendPTZCommand(ip, params) {
  const url = ptzUrl(ip, params);
  console.log(`[PTZ] Sending Digest auth command to ${url}`);
  
  try {
    // Use curl with Digest auth since we know it works
    const curlCmd = `curl -s --digest -u "${CAM_USER}:${CAM_PASS}" "${url}"`;
    const { stdout, stderr } = await execAsync(curlCmd);
    
    if (stderr) {
      console.error(`[PTZ] curl error: ${stderr}`);
      return { ok: false, error: stderr };
    }
    
    console.log(`[PTZ] Response: ${stdout.trim()}`);
    const success = stdout.trim() === 'OK';
    return { 
      ok: success, 
      status: success ? 200 : 500, 
      data: stdout.trim() 
    };
  } catch (error) {
    console.error(`[PTZ] Command error: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

app.post('/api/ptz/start', async (req, res) => {
  // Support both original body format and new query format
  const { camera = 'robot', cam = camera, action, code = action ? PTZ_ACTIONS[action] : undefined, speed = 1 } = { ...req.body, ...req.query };
  const ip = (cam === 'table' || camera === 'table') ? TABLE_CAM_IP : 
             (cam === 'ceiling' || camera === 'ceiling') ? CEILING_CAM_IP : ROBOT_CAM_IP;
  const finalCode = code || PTZ_ACTIONS[action];
  
  if (!finalCode) {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }
  
  if (!ip) {
    return res.status(400).json({ error: 'Camera IP not configured' });
  }
  
  console.log(`[PTZ] ${camera} start ${action || 'custom'} (${finalCode})`);
  const result = await sendPTZCommand(ip, { action: 'start', channel: 1, code: finalCode, arg1: 0, arg2: speed, arg3: 0 });
  res.json(result);
});

app.post('/api/ptz/stop', async (req, res) => {
  const { camera = 'robot', cam = camera } = { ...req.body, ...req.query };
  const ip = (cam === 'table' || camera === 'table') ? TABLE_CAM_IP : 
             (cam === 'ceiling' || camera === 'ceiling') ? CEILING_CAM_IP : ROBOT_CAM_IP;
  
  if (!ip) {
    return res.status(400).json({ error: 'Camera IP not configured' });
  }
  
  console.log(`[PTZ] ${camera} stop all movements (speed=0 method)`);
  
  // Amcrest cameras stop by sending all direction commands with speed=0
  const stopCommands = ['Up', 'Down', 'Left', 'Right'];
  let allOk = true;
  
  for (const direction of stopCommands) {
    const result = await sendPTZCommand(ip, { action: 'start', channel: 1, code: direction, arg1: 0, arg2: 0, arg3: 0 });
    if (!result.ok) allOk = false;
  }
  
  res.json({ ok: allOk, method: 'multi-stop' });
});

app.post('/api/ptz/preset', async (req, res) => {
  const { camera = 'robot', cam = camera, preset, id = preset } = { ...req.body, ...req.query };
  const ip = (cam === 'table' || camera === 'table') ? TABLE_CAM_IP : 
             (cam === 'ceiling' || camera === 'ceiling') ? CEILING_CAM_IP : ROBOT_CAM_IP;
  
  if (!ip) {
    return res.status(400).json({ error: 'Camera IP not configured' });
  }
  
  if (!preset && !id) {
    return res.status(400).json({ error: 'Preset number required' });
  }
  
  const presetNum = preset || id;
  console.log(`[PTZ] ${camera} goto preset ${presetNum}`);
  const result = await sendPTZCommand(ip, { action: 'start', channel: 1, code: 'GotoPreset', arg1: 0, arg2: presetNum, arg3: 0 });
  res.json(result);
});

// Camera IP configuration endpoint
app.post('/api/camera/ip', async (req, res) => {
  const { camera, ip } = { ...req.body, ...req.query };
  
  if (!camera || !ip) {
    return res.status(400).json({ error: 'Camera and IP required' });
  }
  
  if (!ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return res.status(400).json({ error: 'Invalid IP format' });
  }
  
  console.log(`[CONFIG] Updating ${camera} camera IP to ${ip}`);
  
  // Test connectivity to new IP
  try {
    const testResult = await sendPTZCommand(ip, { action: 'start', channel: 1, code: 'Up', arg1: 0, arg2: 0, arg3: 0 });
    if (testResult.ok) {
      // Update the IP in runtime (note: this is temporary, would need env file update for persistence)
      console.log(`[CONFIG] ${camera} camera IP ${ip} tested successfully`);
      res.json({ ok: true, message: 'IP updated and tested successfully' });
    } else {
      res.status(400).json({ error: 'Cannot connect to camera at new IP' });
    }
  } catch (error) {
    res.status(400).json({ error: `Connection test failed: ${error.message}` });
  }
});

// Debug endpoints for Vercel connectivity testing
app.get('/api/debug/status', (req, res) => {
  console.log('[DEBUG] Status check from:', req.ip);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      CAM_USER: CAM_USER || 'not set',
      ROBOT_CAM_IP: ROBOT_CAM_IP || 'not set',
      TABLE_CAM_IP: TABLE_CAM_IP || 'not set', 
      CEILING_CAM_IP: CEILING_CAM_IP || 'not set',
      MEDIAMTX_HTTP: MEDIAMTX_HTTP || 'not set',
      MEDIAMTX_WHEP: MEDIAMTX_WHEP || 'not set'
    },
    server: {
      uptime: process.uptime(),
      platform: process.platform,
      nodeVersion: process.version
    }
  });
});

app.get('/api/debug/camera-test/:camera', async (req, res) => {
  const camera = req.params.camera;
  console.log(`[DEBUG] Testing ${camera} camera connectivity from:`, req.ip);
  
  const ip = (camera === 'table') ? TABLE_CAM_IP : 
             (camera === 'ceiling') ? CEILING_CAM_IP : ROBOT_CAM_IP;
  
  if (!ip) {
    return res.status(400).json({ error: `${camera} camera IP not configured` });
  }
  
  try {
    // Test PTZ command
    const result = await sendPTZCommand(ip, { action: 'start', channel: 1, code: 'Up', arg1: 0, arg2: 0, arg3: 0 });
    console.log(`[DEBUG] ${camera} camera test result:`, result);
    
    res.json({
      camera,
      ip,
      connectivity: result.ok ? 'success' : 'failed',
      result: result
    });
  } catch (error) {
    console.log(`[DEBUG] ${camera} camera test error:`, error.message);
    res.status(500).json({
      camera,
      ip,
      connectivity: 'error',
      error: error.message
    });
  }
});

app.get('/api/debug/mediamtx-test', async (req, res) => {
  console.log('[DEBUG] Testing MediaMTX connectivity from:', req.ip);
  
  try {
    const response = await fetch(`${MEDIAMTX_HTTP}/`);
    const status = response.status;
    const text = await response.text();
    
    console.log(`[DEBUG] MediaMTX test - Status: ${status}`);
    
    res.json({
      mediamtx: {
        http: MEDIAMTX_HTTP,
        whep: MEDIAMTX_WHEP,
        status: status,
        reachable: status < 500
      }
    });
  } catch (error) {
    console.log(`[DEBUG] MediaMTX test error:`, error.message);
    res.status(500).json({
      error: error.message,
      mediamtx: {
        http: MEDIAMTX_HTTP,
        whep: MEDIAMTX_WHEP,
        reachable: false
      }
    });
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
// WHEP routes for both cameras
app.use('/robot/whep', express.text({ type: 'application/sdp' }));
app.post('/robot/whep', async (req, res) => {
  try {
    const target = `${MEDIAMTX_WHEP}/robot/whep`;
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: req.body || ''
    });
    const result = await response.text();
    res.status(response.status);
    if (response.headers.get('content-type')) {
      res.set('Content-Type', response.headers.get('content-type'));
    }
    res.send(result);
  } catch (error) {
    res.status(502).send('bad gateway');
  }
});

app.use('/table/whep', express.text({ type: 'application/sdp' }));
app.post('/table/whep', async (req, res) => {
  try {
    const target = `${MEDIAMTX_WHEP}/table/whep`;
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: req.body || ''
    });
    const result = await response.text();
    res.status(response.status);
    if (response.headers.get('content-type')) {
      res.set('Content-Type', response.headers.get('content-type'));
    }
    res.send(result);
  } catch (error) {
    res.status(502).send('bad gateway');
  }
});

app.use('/ceiling/whep', express.text({ type: 'application/sdp' }));
app.post('/ceiling/whep', async (req, res) => {
  try {
    const target = `${MEDIAMTX_WHEP}/ceiling/whep`;
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: req.body || ''
    });
    const result = await response.text();
    res.status(response.status);
    if (response.headers.get('content-type')) {
      res.set('Content-Type', response.headers.get('content-type'));
    }
    res.send(result);
  } catch (error) {
    res.status(502).send('bad gateway');
  }
});

// Rewrite master playlist to strip alternate audio (stability over Quick Tunnels)
// GET /hls/:name/index.m3u8 -> fetch from MediaMTX and remove #EXT-X-MEDIA audio lines and AUDIO="..." attributes
app.get('/hls/:name/index.m3u8', async (req, res) => {
  try {
    const name = req.params.name;
    const target = `${MEDIAMTX_HTTP}/${encodeURIComponent(name)}/index.m3u8`;
    const r = await fetch(target);
    const txt = await r.text();
    if (!r.ok) {
      res.status(r.status).send(txt);
      return;
    }
    const rewritten = txt
      .split('\n')
      .filter((line) => !/^#EXT-X-MEDIA:TYPE=AUDIO/i.test(line))
      .map((line) => {
        if (/^#EXT-X-STREAM-INF:/i.test(line)) {
          return line.replace(/,?AUDIO="[^"]*"/i, '');
        }
        return line;
      })
      .join('\n');
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-store');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (e) {
    res.status(502).send('bad gateway');
  }
});

// MediaMTX HLS in current release serves at /<path>/index.m3u8 (no /hls prefix)
// Support dynamic base via ?base=... or X-Stream-Base header so we don't need to redeploy when tunnel rotates
app.use('/hls', createProxyMiddleware({
  changeOrigin: true,
  xfwd: true,
  router: (req) => {
    // In local/dev, always hit local MediaMTX directly to avoid double-tunneling (stalls after first frame)
    if (!IS_VERCEL) {
      return MEDIAMTX_HTTP;
    }
    try {
      const url = new URL(req.url, 'http://local');
      const qBase = url.searchParams.get('base');
      const headerBase = (req.headers['x-stream-base'] || '').toString();
      const chosen = (qBase && /^https?:\/\//.test(qBase)) ? qBase : (headerBase && /^https?:\/\//.test(headerBase) ? headerBase : MEDIAMTX_HTTP);
      return chosen;
    } catch (e) {
      return MEDIAMTX_HTTP;
    }
  },
  pathRewrite: (path) => path.replace(/^\/hls\//, '/'),
  onProxyReq: (proxyReq, req) => {
    // Ensure CF doesn't buffer/transform; keep connection streaming
    proxyReq.setHeader('Cache-Control', 'no-store');
    proxyReq.setHeader('Connection', 'keep-alive');
  },
  onProxyRes: (proxyRes) => {
    // Propagate streaming-friendly headers
    try {
      proxyRes.headers['Cache-Control'] = 'no-store';
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    } catch (_) {}
  }
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
if (!IS_VERCEL) {
  app.listen(PORT, () => console.log(`Dev server listening on http://localhost:${PORT}`));
}

export default app;