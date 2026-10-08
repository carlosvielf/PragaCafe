import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveClass, diseaseNames } from './prompts.js';
import { normalizeWorkflow } from './normalize.js';

test('maps only exact dataset identifiers; preserves visual descriptions and rejects bare IDs',()=>{
  for (const [id,name] of diseaseNames) assert.deepEqual(resolveClass(id),{className:id,name,sourceClass:id});
  for (const label of ['Trilhas claras na folha','pale winding trails on a leaf','unknown']) assert.equal(resolveClass(label).name,label);
  assert.throws(()=>resolveClass(undefined,0),/PREDICTION_PROCESSING_ERROR/);
});
test('positive MCP response preserves every class, confidence and bounding box',async()=>{
  const raw=JSON.parse(await readFile(new URL('./fixtures/doencas-positive-response.json',import.meta.url)));
  const result=normalizeWorkflow(raw,{width:2048,height:1024});
  const predictions=raw[0].predictions.predictions;
  assert.equal(result.detections.length,5);
  for (let i=0;i<predictions.length;i++) {
    const p=predictions[i],d=result.detections[i];
    assert.equal(d.sourceClass,p.class);
    assert.equal(d.name,'Bicho-mineiro');
    assert.equal(d.confidence,p.confidence);
    assert.deepEqual(d.box,{x:p.x,y:p.y,width:p.width,height:p.height});
  }
});
