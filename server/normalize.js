import { resolveClass } from './prompts.js';
const finite = x => typeof x === 'number' && Number.isFinite(x);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const processingError = () => { throw new Error('PREDICTION_PROCESSING_ERROR'); };
// Observed response: outputs[].predictions.{image,predictions[]}.
// Named/nested prediction containers retain compatibility with earlier responses.
export function normalizeWorkflow(raw, fallback) {
  const detections = []; let dimensions = fallback, declaredDimensions; let recognized = false; let annotatedImage;
  function prediction(p) {
    if (!object(p)) processingError();
    const d = resolveClass(p.class);
    if (p.confidence !== undefined && (!finite(p.confidence) || p.confidence < 0 || p.confidence > 1)) processingError();
    if (p.confidence !== undefined) d.confidence = p.confidence;
    if (['x','y','width','height'].some(key => Object.hasOwn(p,key)) && (![p.x,p.y,p.width,p.height].every(finite) || p.width <= 0 || p.height <= 0)) processingError();
    if ([p.x,p.y,p.width,p.height].every(finite) && p.width > 0 && p.height > 0) d.box = {x:p.x,y:p.y,width:p.width,height:p.height};
    if (Array.isArray(p.points) && p.points.length >= 3 && p.points.every(q => object(q) && finite(q.x) && finite(q.y))) d.points = p.points.map(q => ({x:q.x,y:q.y}));
    if (Object.hasOwn(p,'rle_mask') && p.rle_mask !== null) d.rleMask = p.rle_mask;
    detections.push(d);
  }
  function visit(value, depth = 0, inPredictions = false) {
    if (depth > 16) processingError();
    if (Array.isArray(value)) {
      if (inPredictions) recognized = true;
      for (const child of value) {
        if (inPredictions && object(child) && (Object.hasOwn(child,'class') || Object.hasOwn(child,'class_id'))) prediction(child);
        else if (object(child) || Array.isArray(child)) visit(child,depth+1,inPredictions);
        else if (inPredictions) processingError();
      }
      return;
    }
    if (!object(value)) { if(inPredictions) processingError(); return; }
    if (inPredictions && !Object.hasOwn(value,'predictions') && !(Object.values(value).length && Object.values(value).every(child => object(child) || Array.isArray(child)))) processingError();
    if (object(value.image) && !(value.image.width === null && value.image.height === null)) {
      const {width,height} = value.image;
      if (![width,height].every(n => Number.isInteger(n) && n > 0)) processingError();
      if (declaredDimensions && (declaredDimensions.width !== width || declaredDimensions.height !== height)) processingError();
      dimensions = declaredDimensions = {width,height};
    }
    if (Object.hasOwn(value,'annotated_image') && value.annotated_image !== null) {
      const image = value.annotated_image;
      if (!object(image) || image.type !== 'base64' || typeof image.value !== 'string' || !/^[A-Za-z0-9+/=\r\n]+$/.test(image.value)) processingError();
      const bytes = Buffer.from(image.value,'base64');
      const mime = bytes.subarray(0,3).equals(Buffer.from([255,216,255])) ? 'image/jpeg'
        : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
        : bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' ? 'image/webp' : undefined;
      if (!mime) processingError();
      annotatedImage = `data:${mime};base64,${image.value}`;
    }
    for (const [key,child] of Object.entries(value)) {
      if (['image','annotated_image','profiler_trace'].includes(key)) continue;
      if (key === 'predictions') visit(child,depth+1,true);
      else if (object(child) || Array.isArray(child)) visit(child,depth+1,inPredictions);
    }
  }
  if (!object(raw) && !Array.isArray(raw)) throw new Error('UNSUPPORTED_RESPONSE');
  visit(raw);
  if (!recognized) throw new Error('UNSUPPORTED_RESPONSE');
  return {detections,image:dimensions,status:detections.length?'detected':'empty',diagnostics:{returnedCount:detections.length,displayedCount:detections.length,filteredCount:0},...(annotatedImage?{annotatedImage}:{})};
}
