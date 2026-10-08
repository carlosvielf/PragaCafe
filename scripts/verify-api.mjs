import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import app from '../api/index.js';
import { endpoint } from '../server/roboflow.js';
// Uses the real provider and key. Logs metadata only. Optional published URL.
let server;
try {
  let base = process.argv[3];
  if (!base) {
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.match(health.headers.get('content-type'), /application\/json/);
  assert.equal((await health.json()).configured, true);
  const missing = await fetch(`${base}/api/nonexistent`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, 'ROUTE_NOT_FOUND');
  const bytes = await readFile(process.argv[2]);
  const body = new FormData();
  body.append('image', new Blob([bytes], {type:'image/jpeg'}), 'leaf.jpg');
  const response = await fetch(`${base}/api/analyze`, {method:'POST', body, signal:AbortSignal.timeout(65000)});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const result = await response.json();
  assert.ok(Array.isArray(result.detections));
  assert.ok(result.image.width > 0 && result.image.height > 0);
  assert.match(result.originalImage, /^data:image\/jpeg;base64,/);
  console.log(JSON.stringify({status:'passed',target:base,endpoint,detections:result.detections.length,resultStatus:result.status,json:true}));
} catch (error) {
  console.error(JSON.stringify({status:'failed',code:error.code || 'API_CHECK_FAILED'}));
  process.exitCode = 1;
} finally { if (server) await new Promise(resolve => server.close(resolve)); }
