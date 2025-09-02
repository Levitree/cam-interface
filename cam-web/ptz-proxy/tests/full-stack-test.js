import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, '..', 'server.js');
const mediaMTXScript = join(__dirname, '..', '..', 'scripts', 'run-mediamtx-macos.sh');

// Test configuration
const TEST_PORT = 3103;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;
let mediaMTXProcess;

async function startMediaMTX() {
  console.log('Starting MediaMTX...');
  mediaMTXProcess = spawn('bash', [mediaMTXScript], {
    cwd: join(__dirname, '..', '..'),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('MediaMTX startup timeout'));
    }, 15000);

    mediaMTXProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('MediaMTX:', output.trim());
      if (output.includes('WebRTC] listener opened')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    mediaMTXProcess.stderr.on('data', (data) => {
      console.error('MediaMTX Error:', data.toString());
    });

    mediaMTXProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function startTestServer() {
  console.log('Starting test server...');
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, PORT: TEST_PORT },
    stdio: ['pipe', 'pipe', 'pipe']
  });

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

function cleanup() {
  console.log('Cleaning up processes...');
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (mediaMTXProcess) {
    mediaMTXProcess.kill();
    mediaMTXProcess = null;
  }
}

async function testVideoStream() {
  try {
    console.log('Testing video stream...');
    
    // Test basic SDP offer/answer exchange
    const sdpOffer = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=-
t=0 0
m=video 9 UDP/TLS/RTP/SAVPF 96
c=IN IP4 0.0.0.0
a=recvonly
a=rtcp-mux
a=ice-ufrag:test
a=ice-pwd:test
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
a=setup:actpass
a=mid:0
a=rtpmap:96 H264/90000`;

    const response = await fetch(`${BASE_URL}/robot/whep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: sdpOffer
    });

    console.log(`WHEP Response: ${response.status}`);
    
    if (response.ok) {
      const sdpAnswer = await response.text();
      console.log(`SDP Answer received: ${sdpAnswer.length} bytes`);
      
      // Check if it looks like valid SDP
      if (sdpAnswer.includes('v=0') && sdpAnswer.includes('m=video')) {
        console.log('✅ Valid SDP answer received - video stream working!');
        return true;
      } else {
        console.log('❌ Invalid SDP answer format');
        return false;
      }
    } else {
      const error = await response.text();
      console.log(`❌ WHEP failed: ${response.status} - ${error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Video stream test error: ${error.message}`);
    return false;
  }
}

async function runFullStackTest() {
  console.log('='.repeat(60));
  console.log('FULL STACK VIDEO STREAMING TEST');
  console.log('='.repeat(60));

  try {
    // Start MediaMTX first
    await startMediaMTX();
    console.log('✅ MediaMTX started successfully');
    
    // Wait a bit for MediaMTX to fully initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start the server
    await startTestServer();
    console.log('✅ Server started successfully');
    
    // Wait a bit for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test the video stream
    const videoWorking = await testVideoStream();
    
    console.log('='.repeat(60));
    if (videoWorking) {
      console.log('🎉 FULL STACK TEST PASSED! Video streaming is working.');
      console.log(`Visit ${BASE_URL}/ to see the interface.`);
    } else {
      console.log('❌ Video streaming test failed.');
      console.log('Check MediaMTX logs and camera connection.');
    }
    console.log('='.repeat(60));
    
    return videoWorking;
    
  } catch (error) {
    console.error('Full stack test error:', error.message);
    return false;
  } finally {
    // Don't cleanup automatically - let user test the interface
    console.log('Processes left running for manual testing...');
    console.log('Press Ctrl+C to stop all processes.');
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

runFullStackTest();
