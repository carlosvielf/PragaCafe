# Integra??o RF-DETR ? 07/10/2026

O Workflow publicado solicitado ? `doencas-vdoencas-o41wy-1-rfdetr-nano-t1-logic`, no workspace `carlos-viel-okshf` e servidor `https://serverless.roboflow.com`. Sua defini??o foi consultada pela API autenticada: uma entrada `InferenceImage` chamada `image`, uma sa?da `JsonField` chamada `predictions` e etapa `roboflow_core/inner_workflow@v1`.

## Requisi??o e parser

A chave ? carregada de ROBOFLOW_API_KEY no servidor e enviada em api_key no JSON. A imagem ? enviada como {type:"base64",value:"..."}. Classes e confidence n?o s?o enviados, mesmo se as antigas vari?veis existirem no ambiente. O Workflow n?o declara essas entradas. O limiar interno n?o ? presumido.

A resposta real cont?m outputs[0].predictions.image e outputs[0].predictions.predictions. Cada detec??o mant?m class, confidence, x, y, width e height. O parser existente j? suportava essa hierarquia; foi refor?ado para rejeitar geometria parcial ou inv?lida, evitando perder caixas silenciosamente. Coordenadas x/y s?o centrais; o SVG existente usa x-width/2 e y-height/2.

As quatro classes preservadas s?o bicho_mineirorotation, cercosporarotation, ferrugemrotation e phomarotation. Cores existentes: ?mbar, roxo, vermelho e azul. Nenhum arquivo de interface foi alterado; c?mera, upload, sele??o e identidade visual foram preservados.

## Infer?ncia real e compara??o com o navegador

- .tmp/leaf3.jpg: 10 detec??es de bicho-mineiro; 10 caixas no DOM, com cada classe, confian?a e coordenada comparada ? resposta da mesma chamada.
- .tmp/leaf2.jpg: 3 detec??es, duas de bicho-mineiro e uma de Phoma; caixas sobrepostas preservadas, cores conferidas, duas classes no frontend. Confian?as da chamada: 0.8629627227783203, 0.8574524521827698 e 0.4642837345600128.
- .tmp/leaf.jpg e .tmp/leaf4.jpg: listas vazias reais, tratadas como aus?ncia de predi??es.

Capturas sem credenciais nem imagens em server/fixtures/rfdetr-workflow-live-response.json e server/fixtures/rfdetr-workflow-multiclass-response.json. Isso valida o transporte e a apresenta??o de m?ltiplas classes; n?o estabelece a precis?o agron?mica dos r?tulos.

## Local e Vercel

O padr?o do c?digo, .env local, .env.example e script de inspe??o usam o Workflow solicitado. A chave local foi preservada. A entrada api/index.js da Vercel passou no upload real em execu??o local, com dez detec??es. O Express ? compartilhado entre os dois ambientes; o frontend chama /api/analyze no mesmo dom?nio. Permanecem os limites existentes de imagem/resposta e or?amento de timeout de 55 segundos dentro da fun??o de 60 segundos.

Na Vercel, configure as cinco vari?veis do README em Production/Preview, remova ROBOFLOW_CLASSES_INPUT e ROBOFLOW_CONFIDENCE, e fa?a redeploy. Vari?veis remotas antigas sobrescrevem o padr?o do c?digo. Nenhuma configura??o remota ou publica??o foi realizada nesta tarefa.

## Verifica??es

Build e TypeScript passaram. Passaram 32 testes de backend e 32 testes Playwright (desktop e celular), incluindo c?mera, upload, cores e geometria. As infer?ncias reais no navegador e o upload pela entrada da API da Vercel tamb?m passaram.
