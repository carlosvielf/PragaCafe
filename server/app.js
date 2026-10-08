import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { normalizeWorkflow } from './normalize.js';
import { runDiseaseWorkflow } from './roboflow.js';
import { renderMasks } from './masks.js';
export { endpoint } from './roboflow.js';
export function createApp({ apiKey = process.env.ROBOFLOW_API_KEY, request = fetch } = {}) {
  const app = express(); app.disable('x-powered-by');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0 } });
  let active = 0;
  app.get('/api/health', (_req,res) => res.json({ status:'ok', configured: Boolean(apiKey && apiKey !== 'your_roboflow_api_key_here') }));
  app.post('/api/analyze', upload.single('image'), async (req,res) => {
    res.set('Cache-Control','no-store');
    if (!req.file) return res.status(400).json({ error:'Selecione uma imagem para analisar.' });
    if (!['image/jpeg','image/png','image/webp'].includes(req.file.mimetype)) return res.status(415).json({error:'Utilize JPG, PNG ou WebP.'});
    if (active >= 3) return res.status(429).json({error:'O serviço está ocupado. Tente novamente em instantes.'});
    active++;
    try {
      let buffer, info;
      try {
        const image = sharp(req.file.buffer, {limitInputPixels: 40000000, animated:false});
        const metadata = await image.metadata();
        if (!['jpeg','png','webp'].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error();
        ({data:buffer,info} = await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer({resolveWithObject:true}));
      } catch { return res.status(400).json({error:'Imagem inválida, corrompida ou grande demais. Escolha outra foto.'}); }
      if (!apiKey || apiKey === 'your_roboflow_api_key_here') return res.status(503).json({code:'CONFIGURATION_ERROR',error:'ROBOFLOW_API_KEY ausente no servidor. O serviço de análise ainda não está configurado.'});
      const raw = await runDiseaseWorkflow(buffer, {apiKey, request});
      const result = normalizeWorkflow(raw, {width:info.width,height:info.height});
      try { await renderMasks(result); }
      catch { throw new Error('PREDICTION_PROCESSING_ERROR'); }
      for (const detection of result.detections) delete detection.rleMask;
      const payload = {...result, originalImage:`data:image/jpeg;base64,${buffer.toString('base64')}`};
      if (Buffer.byteLength(JSON.stringify(payload)) > 4 * 1024 * 1024) return res.status(413).json({code:'RESPONSE_TOO_LARGE',error:'O resultado excedeu o limite de resposta. Envie uma imagem menor.'});
      return res.json(payload);
    } catch (e) {
      if (['AUTHENTICATION_ERROR','RATE_LIMIT','UPSTREAM_ERROR'].includes(e.code)) return res.status(e.code === 'RATE_LIMIT' ? 429 : 502).json({code:e.code,error:e.code === 'AUTHENTICATION_ERROR' ? 'Não foi possível autenticar o serviço de análise. Contate o responsável pela aplicação.' : e.code === 'RATE_LIMIT' ? 'O serviço de análise atingiu o limite de uso. Tente novamente mais tarde.' : 'O serviço de análise não concluiu a solicitação. Tente novamente.'});
      const timeout = e.code === 'TIMEOUT' || e.name === 'TimeoutError' || e.name === 'AbortError';
      const unexpected = e.message === 'UNSUPPORTED_RESPONSE';
      const processing = e.message === 'PREDICTION_PROCESSING_ERROR';
      return res.status(timeout ? 504 : 502).json({code:timeout?'TIMEOUT':unexpected?'UNEXPECTED_RESPONSE':processing?'PREDICTION_PROCESSING_ERROR':'CONNECTION_ERROR',error:timeout ? 'A análise demorou mais que o esperado. Tente novamente.' : unexpected ? 'O Roboflow retornou uma resposta inesperada ou incompatível. Contate o responsável pela aplicação.' : processing ? 'Falha no processamento das predições retornadas pelo modelo. Contate o responsável pela aplicação.' : 'Não foi possível conectar ao serviço de análise. Verifique a conexão e tente novamente.'});
    } finally { active--; }
  });
  app.use('/api', (_req,res) => res.status(404).json({code:'ROUTE_NOT_FOUND',error:'Rota de API não encontrada.'}));
  app.use((error,_req,res,_next) => res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({error:error.code === 'LIMIT_FILE_SIZE' ? 'A imagem enviada deve ter no máximo 4 MB.' : 'Envio inválido. Envie apenas uma imagem.'}));
  return app;
}
