import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkflow } from './normalize.js';
import { readFile } from 'node:fs/promises';
import { renderMasks } from './masks.js';
const size={width:640,height:480};
test('normalizes nested segmentation outputs and preserves real confidence',()=>{
 const result=normalizeWorkflow({outputs:[{predictions:{image:size,predictions:[{class:'ferrugemrotation',confidence:0.87,x:120,y:80,width:30,height:50,points:[{x:1,y:2},{x:3,y:4},{x:5,y:6}]}]}}]},size);
 assert.equal(result.detections[0].name,'Ferrugem do cafeeiro');assert.equal(result.detections[0].confidence,0.87);assert.equal(result.detections[0].points.length,3);assert.deepEqual(result.image,size);
});
test('missing confidence is never fabricated and unknown classes are preserved',()=>{
 const result=normalizeWorkflow({outputs:[{predictions:{predictions:[{class:'phomarotation'},{class:'other',confidence:1}]}}]},size);
 assert.equal(result.detections.length,2);assert.equal(Object.hasOwn(result.detections[0],'confidence'),false);
});
test('empty detections are valid; unknown responses are errors',()=>{
 assert.deepEqual(normalizeWorkflow({outputs:[{predictions:{predictions:[]}}]},size).detections,[]);
 assert.throws(()=>normalizeWorkflow({outputs:[{error:'invalid'}]},size),/UNSUPPORTED_RESPONSE/);
});
test('invalid confidence is a processing error, never silently lost',()=>{
 assert.throws(()=>normalizeWorkflow({predictions:[{class:'cercosporarotation',confidence:90}]},size),/PREDICTION_PROCESSING_ERROR/);
});
test('malformed prediction containers cannot masquerade as an empty result',()=>{
 for(const predictions of [null,{},[{}],[null],[{error:'bad'}]]) assert.throws(()=>normalizeWorkflow({outputs:[{predictions}]},size),/PREDICTION_PROCESSING_ERROR/);
});
test('named nested arrays preserve every low-confidence and unknown-class region',()=>{
 const result=normalizeWorkflow({outputs:[{predictions:{batch:[{predictions:[{class:'unknown',confidence:0.01,x:10,y:20,width:5,height:6}]}]}}]},size);
 assert.equal(result.detections.length,1);assert.equal(result.detections[0].confidence,0.01);
 assert.deepEqual(result.diagnostics,{returnedCount:1,displayedCount:1,filteredCount:0});
});
test('captured live detector response preserves every region without filtering',async()=>{
 const raw=JSON.parse(await readFile(new URL('./fixtures/doencas-live-response.json',import.meta.url)));
 const result=normalizeWorkflow(raw,size),predictions=raw.outputs[0].predictions.predictions;
 assert.equal(result.detections.length,10);
 for(let i=0;i<predictions.length;i++){
  const p=predictions[i],d=result.detections[i];
  assert.equal(d.sourceClass,p.class);assert.equal(d.confidence,p.confidence);
  assert.deepEqual(d.box,{x:p.x,y:p.y,width:p.width,height:p.height});
 }
});
test('real SAM3 RLE masks render without changing labels, boxes or confidence',async()=>{
 const raw=JSON.parse(await readFile(new URL('./fixtures/sam3-real-predictions.json',import.meta.url)));
 const result=normalizeWorkflow(raw,size),predictions=raw.outputs[0].predictions.predictions;
 await renderMasks(result);
 assert.equal(result.detections.length,predictions.length);
 for(let i=0;i<predictions.length;i++){
  assert.equal(result.detections[i].sourceClass,predictions[i].class);
  assert.equal(result.detections[i].confidence,predictions[i].confidence);
  assert.match(result.detections[i].maskImage,/^data:image\/png;base64,/);
 }
});
