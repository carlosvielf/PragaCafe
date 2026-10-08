import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { endpoint } from '../server/app.js';
import { normalizeWorkflow } from '../server/normalize.js';
const buffer = await sharp(await readFile('.tmp/leaf3.jpg')).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();
const groups = {
 original: ['bicho_mineirorotation','cercosporarotation','ferrugemrotation','phomarotation'],
 visual: ['pale winding trails on a leaf','circular brown spots with yellow halos on a leaf','orange powdery spots on a leaf','dark brown dead areas on leaf edges'],
 control: ['leaf', 'brown spots'],
};
for (const [name,classes] of Object.entries(groups)) {
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.ROBOFLOW_API_KEY}`},body:JSON.stringify({inputs:{image:{type:'base64',value:buffer.toString('base64')},classes}}),signal:AbortSignal.timeout(55000)});
 console.log(JSON.stringify({group:name,status:response.status}));
 if(!response.ok)continue;
 const raw=await response.json();const output=raw.outputs?.[0];const predictions=output?.predictions?.predictions;
 console.log(JSON.stringify({group:name,rootKeys:Object.keys(raw),outputKeys:Object.keys(output??{}),containerKeys:Object.keys(output?.predictions??{}),count:predictions?.length,predictions:predictions?.map(p=>({keys:Object.keys(p),class:classes.includes(p.class)?p.class:'unmapped',class_id:p.class_id,confidence:p.confidence,points:p.points?.length,maskType:typeof p.mask})),normalizedCount:normalizeWorkflow(raw,{width:1600,height:800}).detections.length}));
 // Retain real prediction geometry only as a regression fixture; no image or trace.
 await writeFile(`.tmp/${name}-predictions.json`,JSON.stringify({outputs:[{predictions:output.predictions}]},null,2));
 if(name==='visual'&&output.annotated_image?.type==='base64')await writeFile('.tmp/annotated.jpg',Buffer.from(output.annotated_image.value,'base64'));
}
