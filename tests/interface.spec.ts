import {test,expect} from '@playwright/test';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
test('upload, backend setup error and removal',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/analyze',route=>route.fulfill({status:503,json:{error:'O serviço de análise ainda não está configurado. Contate o responsável pela aplicação.'}}));
 await page.goto('/');await expect(page.getByRole('heading',{level:1})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const analyze=page.getByRole('button',{name:'Analisar imagem com IA'});await expect(analyze).toBeDisabled();
 const buffer=await sharp({create:{width:640,height:480,channels:3,background:'#568b43'}}).png().toBuffer();
 await page.locator('input[type=file]').setInputFiles({name:'leaf.png',mimeType:'image/png',buffer});
 await expect(page.getByAltText('Folha de café selecionada para análise')).toBeVisible();await expect(analyze).toBeEnabled();await analyze.click();
 await expect(page.getByRole('alert')).toContainText('não está configurado');await page.getByRole('button',{name:'Remover'}).click();await expect(analyze).toBeDisabled();expect(errors).toEqual([]);
});
test('camera captures and releases tracks',async({page,context})=>{
 await context.grantPermissions(['camera']);await page.goto('/');await page.getByRole('button',{name:'Abrir câmera'}).click();
 const capture=page.getByRole('button',{name:'Capturar foto'});await expect(capture).toBeEnabled();
 await page.evaluate(()=>{(window as any).__cameraStream=(document.querySelector('video') as HTMLVideoElement).srcObject;});await capture.click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByAltText('Folha de café selecionada para análise')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__cameraStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});
test('results render model geometry and omit unavailable confidence',async({page})=>{
 const buffer=await sharp({create:{width:640,height:480,channels:3,background:'#568b43'}}).png().toBuffer();
 await page.route('**/api/analyze',route=>route.fulfill({json:{detections:[{className:'phomarotation',name:'Mancha de Phoma',box:{x:200,y:200,width:80,height:80}}],image:{width:640,height:480},originalImage:`data:image/png;base64,${buffer.toString('base64')}`}}));
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'leaf.png',mimeType:'image/png',buffer});await page.getByRole('button',{name:'Analisar imagem com IA'}).click();await expect(page.getByRole('heading',{name:'Análise concluída'})).toBeVisible();await expect(page.getByText('Confiança não disponibilizada pelo modelo.')).toBeVisible();await expect(page.locator('.result-image rect')).toHaveCount(1);await page.getByRole('button',{name:'Original',exact:true}).click();await expect(page.locator('.result-image svg')).toHaveCount(0);await page.getByRole('button',{name:'Analisar outra imagem'}).click();await expect(page.getByRole('button',{name:'Analisar imagem com IA'})).toBeDisabled();
});

test('real MCP predictions group one class and preserve all regional confidences',async({page})=>{
 const raw=JSON.parse(await readFile(new URL('../server/fixtures/doencas-positive-response.json',import.meta.url),'utf8'));
 const predictions=raw[0].predictions.predictions;
 const buffer=await sharp({create:{width:2048,height:1024,channels:3,background:'#568b43'}}).png().toBuffer();
 // Only the image/proxy are replaced in this UI test; detections are captured real MCP results.
 await page.route('**/api/analyze',route=>route.fulfill({json:{detections:predictions.map((p:any)=>({className:p.class,sourceClass:p.class,name:'Bicho-mineiro',confidence:p.confidence,box:{x:p.x,y:p.y,width:p.width,height:p.height}})),image:raw[0].predictions.image,originalImage:`data:image/png;base64,${buffer.toString('base64')}`}}));
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'leaf.png',mimeType:'image/png',buffer});await page.getByRole('button',{name:'Analisar imagem com IA'}).click();
 await expect(page.locator('.detection-list article')).toHaveCount(1);
 await expect(page.locator('.detection-list h3')).toHaveText('Bicho-mineiro');
 await expect(page.getByText('5 ocorrências',{exact:true})).toBeVisible();
 await expect(page.locator('.result-image rect')).toHaveCount(5);
 await expect(page.locator('.region-confidences strong')).toHaveText(predictions.map((p:any)=>`${(p.confidence*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('class colors, overlapping boxes, selection and responsive coordinates', async ({ page }) => {
 // Controlled response fixtures are isolated to this test; inference is never replaced in the application.
 const colors = ['#F59E0B', '#8B5CF6', '#EF4444', '#3B82F6'];
 const classes = ['bicho_mineirorotation', 'cercosporarotation', 'ferrugemrotation', 'phomarotation'];
 const names = ['Bicho-mineiro', 'Cercosporiose', 'Ferrugem do cafeeiro', 'Mancha de Phoma'];
 const buffer = await sharp({create:{width:1200,height:800,channels:3,background:'#568b43'}}).png().toBuffer();
 const originalImage = `data:image/png;base64,${buffer.toString('base64')}`;
 const detections = classes.map((className, index) => ({className, name:names[index], confidence:[0.898,0.883,0.624,0.48][index],box:{x:500+index*30,y:350,width:300,height:200}}));
 await page.route('**/api/analyze', route => route.fulfill({json:{detections,image:{width:1200,height:800},originalImage,annotatedImage:'data:image/png;base64,annotated-fallback-must-not-be-used'}}));
 await page.goto('/');
 await page.locator('input[type=file]').setInputFiles({name:'geometry-test.png',mimeType:'image/png',buffer});
 await page.getByRole('button',{name:'Analisar imagem com IA'}).click();
 await expect(page.locator('.class-legend li')).toHaveCount(4);
 await expect(page.locator('.detection-list article')).toHaveCount(4);
 await expect(page.locator('.result-image>img')).toHaveAttribute('src',originalImage);
 for (let i=0;i<4;i++) {
   await expect(page.locator(`g[data-region="${i+1}"] rect`)).toHaveAttribute('stroke',colors[i]);
   await expect(page.locator(`g[data-region="${i+1}"] rect`)).toHaveAttribute('x',String(350+i*30));
   await expect(page.locator('.detection-list article').nth(i)).toHaveCSS('border-left-color', ['rgb(245, 158, 11)','rgb(139, 92, 246)','rgb(239, 68, 68)','rgb(59, 130, 246)'][i]);
   await expect(page.locator('.region-label').nth(i)).toContainText(`R${i+1}`);
 }
 await page.locator('.region-select').nth(2).click();
 await expect(page.locator('.region-label').nth(2)).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('g[data-region="3"] rect')).toHaveAttribute('stroke-width','4');
 await expect(page.locator('g[data-region="1"]')).toHaveAttribute('opacity','0.35');
 await page.getByRole('button',{name:'Original',exact:true}).click();
 await expect(page.locator('.result-image svg')).toHaveCount(0);
 await page.locator('.region-select').nth(0).click();
 await expect(page.locator('.result-image svg')).toHaveCount(1);
 for (const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844},{width:320,height:740}]) {
   await page.setViewportSize(viewport);
   const geometry = await page.locator('g[data-region="1"] rect').evaluate(element => {
     const rect=element.getBoundingClientRect();
     const image=element.closest('.result-image')!.querySelector('img')!.getBoundingClientRect();
     return {x:(rect.x-image.x)/image.width,y:(rect.y-image.y)/image.height,width:rect.width/image.width,height:rect.height/image.height};
   });
   expect(geometry.x).toBeCloseTo(350/1200,3);
   expect(geometry.y).toBeCloseTo(250/800,3);
   expect(geometry.width).toBeCloseTo(300/1200,3);
   expect(geometry.height).toBeCloseTo(200/800,3);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.screenshot({path:`test-results/class-colors-${test.info().project.name}.png`,fullPage:true});
});

test('polygon and alpha mask retain geometry and receive class colors',async({page})=>{
 const buffer=await sharp({create:{width:640,height:480,channels:3,background:'#568b43'}}).png().toBuffer();
 const mask=await sharp({create:{width:640,height:480,channels:4,background:'#00000000'}}).composite([{input:await sharp({create:{width:40,height:30,channels:4,background:'#81c7846e'}}).png().toBuffer(),left:100,top:80}]).png().toBuffer();
 await page.route('**/api/analyze',route=>route.fulfill({json:{image:{width:640,height:480},originalImage:`data:image/png;base64,${buffer.toString('base64')}`,detections:[{className:'cercosporarotation',name:'Cercosporiose',confidence:0.869,points:[{x:40,y:50},{x:120,y:60},{x:70,y:140}]},{className:'ferrugemrotation',name:'Ferrugem do cafeeiro',confidence:0.624,maskImage:`data:image/png;base64,${mask.toString('base64')}`}]}}));
 await page.goto('/');await page.locator('input[type=file]').setInputFiles({name:'mask-test.png',mimeType:'image/png',buffer});await page.getByRole('button',{name:'Analisar imagem com IA'}).click();
 await expect(page.locator('.result-image polygon')).toHaveAttribute('points','40,50 120,60 70,140');
 await expect(page.locator('.result-image polygon')).toHaveAttribute('stroke','#8B5CF6');
 await expect(page.locator('g[data-region="2"]>rect')).toHaveAttribute('fill','#EF4444');
 await expect(page.locator('.result-image mask image')).toHaveAttribute('width','640');
 await expect(page.locator('.result-image mask image')).toHaveAttribute('height','480');
 await page.locator('.region-select').nth(1).click();
 await expect(page.locator('g[data-region="2"]')).toHaveAttribute('opacity','1');
});
