import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Published definition retrieved through OAuth MCP on 2026-10-07.
export const workflow = JSON.parse(await readFile(new URL('./fixtures/doencas-workflow.json', import.meta.url), 'utf8'));
export const outputKeys = workflow.outputs.map(output => output.name);
export const endpoint = 'https://serverless.roboflow.com/carlos-viel-okshf/workflows/doencas-vdoencas-o41wy-1-rfdetr-nano-t1-logic';
export class RoboflowError extends Error {
  constructor(code, status) { super(code); this.name = 'RoboflowError'; this.code = code; this.status = status; }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Run one static image. Returns one dictionary per image, using declared output names.
 * Image outputs are persisted to unique OS temporary directories; caller owns cleanup.
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
  // This workflow declares no WorkflowParameter inputs. Do not send classes/model_id.
  const body = JSON.stringify({ inputs: { [workflow.inputs[0].name]: input } });
  const signal = AbortSignal.timeout(timeoutMs); // Total budget, including retries/body reads.
  let raw;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body, signal });
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
  async function compact(value) {
    if (Array.isArray(value)) { for (let i=0;i<value.length;i++) value[i] = await compact(value[i]); return value; }
    if (!object(value)) return value;
    if (value.type === 'base64') {
      if (typeof value.value !== 'string' || !value.value.length || value.value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.value)) throw new RoboflowError('UNSUPPORTED_RESPONSE');
      const bytes = Buffer.from(value.value, 'base64');
      const directory = await mkdtemp(join(tmpdir(), 'cafeia-workflow-'));
      const path = join(directory, 'image.bin');
      await writeFile(path, bytes);
      delete value.value;
      return { type: 'file', path };
    }
    delete value.points;
    for (const key of Object.keys(value)) value[key] = await compact(value[key]);
    return value;
  }
  const output = results[0];
  for (const key of Object.keys(output)) if (!outputKeys.includes(key)) delete output[key];
  await compact(output);
  return results;
}
