import { setTimeout as delay } from 'node:timers/promises';
import { diseaseNames } from './prompts.js';

export const outputKeys = ['predictions'];
export const workflowId = process.env.ROBOFLOW_WORKFLOW_ID || 'doencas-vdoencas-o41wy-1-rfdetr-nano-t1-logic';
export const endpoint = `${(process.env.ROBOFLOW_API_URL || 'https://serverless.roboflow.com').replace(/\/$/, '')}/${process.env.ROBOFLOW_WORKSPACE || 'carlos-viel-okshf'}/workflows/${workflowId}`;
export const workflowClasses = [...diseaseNames.keys()];
export function workflowDiagnostics() {
  return { workflowId, modelType: workflowId === 'doencas-vdoencas-o41wy-1-rfdetr-nano-t1-logic' ? 'specialized' : 'unknown',
    confidenceThreshold: null, experimental: false };
}
export class RoboflowError extends Error {
  constructor(code, status) { super(code); this.name = 'RoboflowError'; this.code = code; this.status = status; }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Run one static image. Returns one dictionary per image, using declared output names.
 * @param {Buffer|string} image JPEG bytes or an HTTPS image URL.
 */
export async function runDiseaseWorkflow(image, { apiKey = process.env.ROBOFLOW_API_KEY, request = fetch, timeoutMs = 55000, backoffMs = 250 } = {}) {
  if (!apiKey || apiKey === 'your_roboflow_api_key_here') throw new RoboflowError('CONFIGURATION_ERROR');
  let input;
  if (Buffer.isBuffer(image) && image.length) input = { type: 'base64', value: image.toString('base64') };
  else if (typeof image === 'string') {
    try { const url = new URL(image); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
    catch { throw new RoboflowError('INVALID_IMAGE'); }
    input = { type: 'url', value: image };
  } else throw new RoboflowError('INVALID_IMAGE');
  const body = JSON.stringify({ api_key: apiKey, inputs: {
    [process.env.ROBOFLOW_IMAGE_INPUT || 'image']: input,
  } });
  const signal = AbortSignal.timeout(timeoutMs); // Total budget, including retries/body reads.
  let raw;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal });
      if (!response.ok) {
        await response.body?.cancel();
        const code = [401,403].includes(response.status) ? 'AUTHENTICATION_ERROR' : response.status === 429 ? 'RATE_LIMIT' : 'UPSTREAM_ERROR';
        throw new RoboflowError(code, response.status);
      }
      try { raw = await response.json(); }
      catch (error) { if (error instanceof SyntaxError) throw new RoboflowError('UNSUPPORTED_RESPONSE'); throw error; }
      break;
    } catch (error) {
      const timeout = signal.aborted || ['TimeoutError','AbortError'].includes(error.name);
      const retryable = !(error instanceof RoboflowError) || error.status === 429 || error.status >= 500;
      if (attempt === 2 || !retryable || signal.aborted) throw error instanceof RoboflowError ? error : new RoboflowError(timeout ? 'TIMEOUT' : 'CONNECTION_ERROR');
      try { await delay(backoffMs * 2 ** attempt, undefined, { signal }); }
      catch { throw new RoboflowError('TIMEOUT'); }
    }
  }
  const results = Array.isArray(raw) ? raw : raw?.outputs;
  if (!Array.isArray(results) || results.length !== 1 || !object(results[0]) || outputKeys.some(key => !Object.hasOwn(results[0], key))) throw new RoboflowError('UNSUPPORTED_RESPONSE');
  // Keep the raw prediction geometry; the UI renders its own class colors.
  // Provider visualization is redundant and can exceed Vercel's response limit.
  return [{ predictions: results[0].predictions }];
}
