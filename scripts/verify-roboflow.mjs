import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runDiseaseWorkflow, outputKeys } from '../server/roboflow.js';
import { normalizeWorkflow } from '../server/normalize.js';
import { diseaseNames } from '../server/prompts.js';
// Explicit live smoke test; never log credentials, images or provider bodies.
try {
  const image = process.argv[2] ? await readFile(process.argv[2]) : 'https://source.roboflow.com/WyQaNh8FUeQ6GENXYcIH6kEaA2z2/dARPJSFxAjUcO9uF5zdq/original.jpg';
  const results = await runDiseaseWorkflow(image);
  assert.equal(results.length,1);
  for (const key of outputKeys) assert.ok(Object.hasOwn(results[0],key));
  const normalized = normalizeWorkflow(results, {width:2048,height:1024});
  const original = results[0][outputKeys[0]].predictions;
  assert.equal(normalized.detections.length,original.length);
  for (let i=0;i<original.length;i++) {
    const prediction=original[i],detection=normalized.detections[i];
    assert.equal(detection.sourceClass,prediction.class);
    assert.equal(detection.name,diseaseNames.get(prediction.class) ?? prediction.class);
    assert.equal(detection.confidence,prediction.confidence);
    if (detection.box) assert.deepEqual(detection.box,{x:prediction.x,y:prediction.y,width:prediction.width,height:prediction.height});
  }
  console.log(JSON.stringify({status:'passed',outputKeys:Object.keys(results[0]),comparison:'class/confidence/boxes match API',detections:normalized.detections.map(d=>({class:d.sourceClass,name:d.name,confidence:d.confidence,box:d.box}))}));
} catch (error) {
  console.error(JSON.stringify({status:'failed',code:error.code ?? 'SMOKE_TEST_FAILED'}));
  process.exitCode=1;
}
