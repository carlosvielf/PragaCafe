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
  const result = await response.json().catch(() => { throw new Error('Resposta inválida do servidor. Verifique se o backend está em execução.'); });
  if (!response.ok) throw new Error(result.error || 'Não foi possível analisar a imagem.');
  if (!result || !Array.isArray(result.detections) || !Number.isInteger(result.image?.width) || result.image.width <= 0 || !Number.isInteger(result.image?.height) || result.image.height <= 0 || typeof result.originalImage !== 'string') {
    throw new Error('O backend retornou uma resposta inesperada. Tente novamente ou contate o responsável pela aplicação.');
  }
  if (result.detections.some((d:unknown) => !d || typeof d !== 'object' || typeof (d as {name?:unknown}).name !== 'string' || typeof (d as {className?:unknown}).className !== 'string')) {
    throw new Error('Falha no processamento das predições. Tente novamente ou contate o responsável pela aplicação.');
  }
  return result;
}
