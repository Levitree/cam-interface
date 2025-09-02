#!/usr/bin/env node
import fetch from 'node-fetch';

const BASE = process.env.HLS_BASE || 'http://127.0.0.1:8888';
const NAME = process.env.HLS_NAME || 'robot';

function joinUrl(...parts) {
  return parts
    .map((p, i) => (i === 0 ? String(p).replace(/\/$/, '') : String(p).replace(/^\//, '')))
    .join('/');
}

async function getText(url, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    clearTimeout(to);
  }
}

async function getBuffer(url, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, buf };
  } finally {
    clearTimeout(to);
  }
}

(async () => {
  const masterUrl = joinUrl(BASE, NAME, 'index.m3u8');
  const pl = await getText(masterUrl);
  if (pl.status !== 200 || !pl.text.startsWith('#EXTM3U')) {
    console.error(`FAIL: master playlist ${masterUrl} status=${pl.status}`);
    process.exit(1);
  }

  // choose a variant or assume the master is the variant
  let variantRel = pl.text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && l.endsWith('.m3u8')) || 'stream.m3u8';
  let variantUrl = joinUrl(BASE, NAME, variantRel);
  let vpl = await getText(variantUrl);
  if (vpl.status !== 200 || !vpl.text.startsWith('#EXTM3U')) {
    // fallback: some builds use the master as variant
    variantUrl = masterUrl;
    vpl = pl;
  }

  // fetch init if present (CMAF)
  const mapMatch = vpl.text.match(/#EXT-X-MAP:.*URI="([^"]+)"/);
  if (mapMatch && mapMatch[1]) {
    const initUrl = joinUrl(BASE, NAME, mapMatch[1]);
    const init = await getBuffer(initUrl);
    if (init.status !== 200 || init.buf.byteLength < 200) {
      console.error(`FAIL: init fetch ${initUrl} status=${init.status} size=${init.buf.byteLength}`);
      process.exit(1);
    }
  }

  // try up to 10 times to get a part or segment
  for (let attempt = 0; attempt < 10; attempt++) {
    const lines = vpl.text.split('\n').map((l) => l.trim());
    const partUris = lines
      .map((l) => (/#EXT-X-PART:.*URI="([^"]+)"/.exec(l) || [])[1])
      .filter(Boolean);
    const segUris = lines.filter((l) => l && !l.startsWith('#') && (l.endsWith('.m4s') || l.endsWith('.ts')));
    const candidate = (partUris[partUris.length - 1] || segUris[segUris.length - 1]);
    if (candidate) {
      const segUrl = joinUrl(BASE, NAME, candidate);
      const seg = await getBuffer(segUrl);
      if (seg.status === 200 && seg.buf.byteLength > 200) {
        console.log('OK: HLS stream present');
        process.exit(0);
      }
    }
    // refetch variant and try again
    await new Promise((r) => setTimeout(r, 700));
    vpl = await getText(variantUrl);
  }

  console.error('FAIL: no playable HLS parts/segments detected after retries');
  process.exit(1);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });


