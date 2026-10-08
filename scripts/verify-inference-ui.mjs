// Live multipart upload: compare untouched Roboflow predictions with backend and DOM.
// Requires a real local image and a build. Prints no credentials or image data.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { resolveClass } from '../server/prompts.js';
import { normalizeWorkflow } from '../server/normalize.js';

const browsers=fileURLToPath(new URL('../.playwright-browsers',import.meta.url));
if(!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(browsers))process.env.PLAYWRIGHT_BROWSERS_PATH=browsers;
const {chromium}=await import('@playwright/test');
let raw,server,browser;
try {
  assert.ok(process.argv[2],'Provide a real JPG/PNG/WebP path');
  const bytes=await readFile(process.argv[2]);
  const app=createApp({request:async(url,options)=>{
    const response=await fetch(url,options);
    if(response.ok)raw=await response.clone().json();
    return response;
  }});
  app.use(express.static(fileURLToPath(new URL('../dist',import.meta.url))));
  server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('input[type=file]').setInputFiles({name:'real-leaf.jpg',mimeType:'image/jpeg',buffer:bytes});
  const pending=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));
  await page.getByRole('button',{name:'Analisar imagem com IA'}).click();
  const response=await pending;
  assert.equal(response.status(),200);
  const presented=await response.json();
  const predictions=raw.outputs[0].predictions.predictions;
  const normalized=normalizeWorkflow(raw,presented.image);
  assert.equal(presented.detections.length,predictions.length);
  assert.equal(presented.diagnostics.returnedCount,predictions.length);
  assert.equal(presented.diagnostics.filteredCount,0);
  for(let i=0;i<predictions.length;i++) {
    const p=predictions[i],d=presented.detections[i];
    assert.equal(d.sourceClass,p.class);
    assert.equal(d.name,resolveClass(p.class).name);
    assert.equal(d.confidence,p.confidence);
    assert.deepEqual(d.box,normalized.detections[i].box);
    assert.deepEqual(d.points,normalized.detections[i].points);
  }
  await page.getByRole('heading',{name:'Análise concluída'}).waitFor();
  const boxes=presented.detections.filter(d=>d.box);
  assert.equal(await page.locator('g[data-region]>rect[stroke]').count(),boxes.length);
  for(let i=0;i<presented.detections.length;i++) {
    const d=presented.detections[i];if(!d.box)continue;
    const rect=page.locator(`g[data-region="${i+1}"]>rect[stroke]`);
    const colors={bicho_mineirorotation:'#F59E0B',cercosporarotation:'#8B5CF6',ferrugemrotation:'#EF4444',phomarotation:'#3B82F6'};
    assert.equal(await rect.getAttribute('stroke'),colors[d.className]??'#64748B');
    for(const [k,v] of Object.entries({x:d.box.x-d.box.width/2,y:d.box.y-d.box.height/2,width:d.box.width,height:d.box.height}))assert.equal(Number(await rect.getAttribute(k)),v);
  }
  assert.equal(await page.locator('.detection-list article').count(),new Set(presented.detections.map(d=>d.className)).size);
  const grouped=[...new Set(presented.detections.map(d=>d.className))].flatMap(c=>presented.detections.filter(d=>d.className===c));
  assert.deepEqual(await page.locator('.region-confidences strong').allTextContents(),grouped.filter(d=>d.confidence!==undefined).map(d=>`${(d.confidence*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`));
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify({outputs:raw.outputs.map(o=>({predictions:o.predictions}))},null,2));
  console.log(JSON.stringify({status:'passed',comparison:'real upload → Roboflow → backend → DOM',regions:predictions.length,classes:[...new Set(predictions.map(p=>p.class))],confidences:predictions.map(p=>p.confidence),boxes:boxes.length,diagnostics:presented.diagnostics}));
}catch(error){console.error(JSON.stringify({status:'failed',code:error.code??error.name}));process.exitCode=1;}
finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
