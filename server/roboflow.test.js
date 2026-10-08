import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { runDiseaseWorkflow, outputKeys, RoboflowError, workflowClasses } from './roboflow.js';
import { normalizeWorkflow } from './normalize.js';
const image = 'https://raw.githubusercontent.com/EduardoLisboa/YCgCr_leaf_segmentation/main/images/1.jpg';
test('real MCP fixture uses declared outputs and nullable dimensions', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/doencas-real-response.json', import.meta.url)));
  const result = await runDiseaseWorkflow(image, { apiKey:'test-only', request:async()=>Response.json(fixture) });
  assert.deepEqual(Object.keys(result[0]),outputKeys);
  assert.deepEqual(normalizeWorkflow(result,{width:1600,height:800}).image,{width:1600,height:800});
});
test('retries transient failures with private body auth; preserves polygons', async () => {
  let calls=0;
  const result=await runDiseaseWorkflow(image,{apiKey:'secret',backoffMs:1,request:async(url, options)=>{
    assert.equal(new URL(url).search,'');
    assert.equal(options.headers.Authorization,undefined);
    assert.deepEqual(JSON.parse(options.body),{api_key:'secret',inputs:{image:{type:'url',value:image},classes:workflowClasses}});
    if (++calls<3) return new Response(null,{status:503});
    return Response.json({outputs:[{[outputKeys[0]]:{predictions:[{class:'unknown',points:[{x:1,y:1}]}]}}]});
  }});
  assert.equal(calls,3);assert.deepEqual(result[0][outputKeys[0]].predictions[0].points,[{x:1,y:1}]);
});
test('rejects HTTP URLs and malformed schemas with typed errors',async()=>{
  await assert.rejects(runDiseaseWorkflow('http://example.com/photo.jpg',{apiKey:'test'}),e=>e instanceof RoboflowError && e.code==='INVALID_IMAGE');
  await assert.rejects(runDiseaseWorkflow(image,{apiKey:'test',request:async()=>Response.json({outputs:[{}]})}),e=>e instanceof RoboflowError && e.code==='UNSUPPORTED_RESPONSE');
});
test('provider visualization is discarded, predictions retain geometry', async()=>{
  const predictions={predictions:[]};
  const result=await runDiseaseWorkflow(image,{apiKey:'test',request:async()=>Response.json({outputs:[{predictions,annotated_image:{type:'base64',value:'large-provider-image'}}]})});
  assert.deepEqual(result,[{predictions}]);
});
