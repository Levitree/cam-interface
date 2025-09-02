import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, '..', 'server.js');

// Test configuration
const TEST_PORT = 3102;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;

async function startTestServer() {
  console.log('Starting test server...');
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: TEST_PORT },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Wait for server to start
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server startup timeout'));
    }, 10000);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Server:', output.trim());
      if (output.includes(`listening on http://localhost:${TEST_PORT}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server Error:', data.toString());
    });

    serverProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function stopTestServer() {
  if (serverProcess) {
    console.log('Stopping test server...');
    serverProcess.kill();
    serverProcess = null;
  }
}

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`Testing ${name}: ${url}`);
    const response = await fetch(url, options);
    const status = response.status;
    const contentType = response.headers.get('content-type');
    
    console.log(`  Status: ${status}`);
    console.log(`  Content-Type: ${contentType}`);
    
    if (status >= 200 && status < 400) {
      console.log(`  ✅ PASS: ${name}`);
      return true;
    } else {
      console.log(`  ❌ FAIL: ${name} - Status ${status}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${name} - ${error.message}`);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let total = 0;

  console.log('='.repeat(50));
  console.log('CAMERA INTERFACE SERVER TESTS');
  console.log('='.repeat(50));

  try {
    await startTestServer();
    
    // Give server time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Frontend serves
    total++;
    if (await testEndpoint('Frontend HTML', `${BASE_URL}/`)) {
      passed++;
    }

    // Test 2: Static assets
    total++;
    if (await testEndpoint('Favicon handling', `${BASE_URL}/favicon.ico`)) {
      passed++;
    }

    // Test 3: PTZ API endpoints
    total++;
    if (await testEndpoint('PTZ Start API', `${BASE_URL}/api/ptz/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cam: 'robot', code: 'Up', speed: 4 })
    })) {
      passed++;
    }

    total++;
    if (await testEndpoint('PTZ Stop API', `${BASE_URL}/api/ptz/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cam: 'robot', code: 'Stop' })
    })) {
      passed++;
    }

    total++;
    if (await testEndpoint('PTZ Preset API', `${BASE_URL}/api/ptz/preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cam: 'robot', id: 1 })
    })) {
      passed++;
    }

    // Test 4: WHEP endpoints (basic connectivity test)
    total++;
    if (await testEndpoint('WHEP with path param', `${BASE_URL}/whep?path=robot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: 'v=0\no=- 0 0 IN IP4 127.0.0.1\ns=-\nt=0 0\nm=video 9 UDP/TLS/RTP/SAVPF 96\nc=IN IP4 0.0.0.0\na=recvonly'
    })) {
      passed++;
    }

    total++;
    if (await testEndpoint('WHEP with name param', `${BASE_URL}/whep/robot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: 'v=0\no=- 0 0 IN IP4 127.0.0.1\ns=-\nt=0 0\nm=video 9 UDP/TLS/RTP/SAVPF 96\nc=IN IP4 0.0.0.0\na=recvonly'
    })) {
      passed++;
    }

    total++;
    if (await testEndpoint('WHEP direct robot route', `${BASE_URL}/robot/whep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: 'v=0\no=- 0 0 IN IP4 127.0.0.1\ns=-\nt=0 0\nm=video 9 UDP/TLS/RTP/SAVPF 96\nc=IN IP4 0.0.0.0\na=recvonly'
    })) {
      passed++;
    }

    // Test 5: HLS proxy
    total++;
    if (await testEndpoint('HLS proxy', `${BASE_URL}/hls/robot/index.m3u8`)) {
      passed++;
    }

  } catch (error) {
    console.error('Test setup error:', error.message);
  } finally {
    stopTestServer();
  }

  console.log('='.repeat(50));
  console.log(`RESULTS: ${passed}/${total} tests passed`);
  console.log('='.repeat(50));

  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed.');
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  stopTestServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopTestServer();
  process.exit(0);
});

runTests();
