import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { runDiseaseWorkflow, outputKeys, RoboflowError, workflowClasses, workflowDiagnostics } from './roboflow.js';
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
    assert.deepEqual(JSON.parse(options.body),{api_key:'secret',inputs:{image:{type:'url',value:image}}});
    if (++calls<3) return new Response(null,{status:503});
    return Response.json({outputs:[{[outputKeys[0]]:{predictions:[{class:'unknown',points:[{x:1,y:1}]}]}}]});
  }});
  assert.equal(calls,3);assert.deepEqual(result[0][outputKeys[0]].predictions[0].points,[{x:1,y:1}]);
});
test('specialized workflow keeps its published threshold and exact dataset identifiers',()=>{
  assert.deepEqual(workflowClasses,['bicho_mineirorotation','cercosporarotation','ferrugemrotation','phomarotation']);
  assert.deepEqual(workflowDiagnostics(),{workflowId:'doencas-o41wy',modelType:'specialized',confidenceThreshold:0.4,experimental:false});
});
test('confidence overrides are validated and marked experimental',async()=>{
  const saved=process.env.ROBOFLOW_CONFIDENCE;
  try {
    process.env.ROBOFLOW_CONFIDENCE='0.7';
    assert.equal(workflowDiagnostics().experimental,true);
    await runDiseaseWorkflow(image,{apiKey:'test',request:async(_url,options)=>{
      assert.equal(JSON.parse(options.body).inputs.confidence,0.7);
      return Response.json({outputs:[{predictions:{predictions:[]}}]});
    }});
    for(const invalid of ['','invalid','-0.1','1.1']){
      process.env.ROBOFLOW_CONFIDENCE=invalid;
      assert.throws(workflowDiagnostics,e=>e.code==='CONFIGURATION_ERROR');
    }
  } finally { if(saved===undefined)delete process.env.ROBOFLOW_CONFIDENCE;else process.env.ROBOFLOW_CONFIDENCE=saved; }
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
