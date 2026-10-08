import type { Analysis } from '../types';
export async function analyzeImage(file:File, signal:AbortSignal):Promise<Analysis> {
  const body = new FormData(); body.append('image',file);
  let response:Response;
  try { response = await fetch('/api/analyze',{method:'POST',body,signal:AbortSignal.any([signal,AbortSignal.timeout(65000)])}); }
  catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof DOMException && ['TimeoutError','AbortError'].includes(error.name)) throw new Error('A análise demorou mais que o esperado. Tente novamente.');
    throw new Error('Não foi possível conectar ao backend. Verifique a conexão e tente novamente.');
  }
  const text = await response.text();
  if (response.status === 404) throw new Error('A rota /api/analyze não existe no deployment. Verifique a configuração da Vercel.');
  if (response.status === 413) throw new Error('A imagem ou o resultado excedeu o limite da Vercel. Envie uma imagem menor.');
  if (response.status === 504) throw new Error('Timeout do servidor ou do Roboflow. Tente novamente.');
  if ([401,403].includes(response.status)) throw new Error('Acesso ao backend negado. Verifique a proteção do deployment.');
  if (/^\s*(?:<!doctype html|<html)/i.test(text) || response.headers.get('content-type')?.includes('text/html')) throw new Error('O servidor retornou HTML em vez de JSON. Verifique o encaminhamento de /api/analyze na Vercel.');
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(response.status >= 500 ? 'Backend indisponível. Verifique os logs da função na Vercel.' : 'O backend retornou um formato diferente de JSON.');
  let result;
  try { result = JSON.parse(text); }
  catch { throw new Error('O backend retornou JSON inválido. Verifique os logs da função.'); }
  if (!response.ok) throw new Error((typeof result?.error === 'string' ? result.error : undefined) || 'Não foi possível analisar a imagem.');
  if (!result || !Array.isArray(result.detections) || !Number.isInteger(result.image?.width) || result.image.width <= 0 || !Number.isInteger(result.image?.height) || result.image.height <= 0 || typeof result.originalImage !== 'string') {
    throw new Error('O backend retornou uma resposta inesperada. Tente novamente ou contate o responsável pela aplicação.');
  }
  if (result.detections.some((d:unknown) => !d || typeof d !== 'object' || typeof (d as {name?:unknown}).name !== 'string' || typeof (d as {className?:unknown}).className !== 'string')) {
    throw new Error('Falha no processamento das predições. Tente novamente ou contate o responsável pela aplicação.');
  }
  return result;
}
