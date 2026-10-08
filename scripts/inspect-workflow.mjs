// Outputs schema/status only. Never print tokens, response bodies or image data.
const key = process.env.ROBOFLOW_API_KEY;
if (!key) { console.error('ROBOFLOW_API_KEY ausente.'); process.exit(1); }
try {
 const response = await fetch('https://api.roboflow.com/carlos-viel-okshf/workflows/general-segmentation-api-5', {headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(30000)});
 console.log(JSON.stringify({operation:'workflow-definition',status:response.status}));
 if (response.ok) {
  const raw=await response.json(); const config=typeof raw.workflow?.config==='string'?JSON.parse(raw.workflow.config):raw.workflow?.config;
  const spec=config?.specification;
  console.log(JSON.stringify({inputs:spec?.inputs,outputs:spec?.outputs,steps:spec?.steps?.map(s=>({name:s.name,type:s.type,model_id:s.model_id,classes:s.classes}))}));
 }
} catch(error) { console.error(JSON.stringify({operation:'workflow-definition',error:error.name})); process.exitCode=1; }
