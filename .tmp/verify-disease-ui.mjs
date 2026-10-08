import assert from 'node:assert/strict';
import express from 'express';
import { chromium } from '@playwright/test';
import { createApp } from '../server/app.js';
import { diseaseNames } from '../server/prompts.js';
let raw;
const app=createApp({request:async(url,options)=>{
  const response=await fetch(url,options);
  if(response.ok) raw=await response.clone().json();
  return response;
}});
app.use(express.static('dist'));
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let browser;
try {
  const sample=await fetch('https://source.roboflow.com/WyQaNh8FUeQ6GENXYcIH6kEaA2z2/dARPJSFxAjUcO9uF5zdq/original.jpg');
  assert.ok(sample.ok);
  const buffer=Buffer.from(await sample.arrayBuffer());
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('input[type=file]').setInputFiles({name:'real-leaf.jpg',mimeType:'image/jpeg',buffer});
  const pending=page.waitForResponse(response=>response.url().endsWith('/api/analyze'));
  await page.getByRole('button',{name:'Analisar imagem com IA'}).click();
  const response=await pending;
  assert.equal(response.status(),200);
  const presented=await response.json();
  const predictions=raw.outputs[0].predictions.predictions;
  assert.ok(predictions.length>0);
  assert.equal(presented.detections.length,predictions.length);
  for(let i=0;i<predictions.length;i++){
    const p=predictions[i],d=presented.detections[i];
    assert.equal(d.className,p.class);assert.equal(d.name,diseaseNames.get(p.class)??p.class);assert.equal(d.confidence,p.confidence);
    assert.deepEqual(d.box,{x:p.x,y:p.y,width:p.width,height:p.height});
  }
  await page.getByRole('heading',{name:'Análise concluída'}).waitFor();
  assert.equal(await page.locator('.detection-list article').count(),new Set(predictions.map(p=>p.class)).size);
  assert.equal(await page.locator('.result-image rect').count(),predictions.length);
  assert.deepEqual(await page.locator('.region-confidences strong').allTextContents(),presented.detections.map(d=>`${(d.confidence*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`));
  await page.screenshot({path:'.tmp/disease-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.tmp/disease-mobile.png',fullPage:true});
  console.log(JSON.stringify({status:'passed',comparison:'raw REST → backend → rendered UI',regions:predictions.length,classes:[...new Set(predictions.map(p=>p.class))],displayedConfidences:await page.locator('.region-confidences strong').allTextContents()}));
} finally {
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
