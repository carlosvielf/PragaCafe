# PragaCaféIA

React, TypeScript e Vite com backend Express e inferência real do Roboflow.

## Execução local

Requer Node.js 24.x. Instale com `npm.cmd install`. Copie `.env.example` para `.env` somente se o arquivo ainda não existir e preencha a chave privada. Execute `npm.cmd run dev` e abra http://localhost:5173. O proxy do Vite encaminha `/api` para a porta 3001 somente em desenvolvimento. `npm.cmd run build` seguido de `npm.cmd start` serve o build localmente.

## Workflow

O endpoint padrão é `https://serverless.roboflow.com/carlos-viel-okshf/workflows/doencas-o41wy`, configurável pelas variáveis abaixo. A definição publicada foi confirmada pelo MCP Roboflow: entrada `image` (objeto `{type:"base64",value:"..."}`); saídas `predictions`, `inference_id` e `model_id`. A chave vai em `api_key` no JSON enviado exclusivamente pelo servidor via HTTPS.

O Workflow executa o detector especializado RF-DETR Nano `carlos-viel-okshf/doencas-o41wy-1-rfdetr-nano-t1`, com as quatro classes originais do dataset. O modelo recebe apenas a imagem; as classes são fixas. O Workflow anterior `general-segmentation-api-5` executa SAM3 genérico por texto e retornou zero regiões na imagem de teste, enquanto o detector retornou dez. A confiança não equivale a certeza de diagnóstico. Classes desconhecidas mantêm o rótulo recebido. Não há resultados simulados no aplicativo. Veja o [diagnóstico e evidências](DIAGNOSTICO.md).

A visualização `annotated_image` do provedor é descartada: a interface desenha a geometria real com suas próprias cores (âmbar, roxo, vermelho e azul). Máscaras RLE são renderizadas e removidas do JSON final. Resultado vazio retorna HTTP 200 com `status: "empty"`; formato incompatível gera erro, nunca uma falsa análise vazia.

## Vercel

`api/index.js` exporta o Express sem abrir uma porta. `vercel.json` encaminha `/api/:path*` para essa função. Frontend e API usam o mesmo domínio, portanto não precisam de CORS. `server/index.js` continua responsável pelo servidor local.

Use a raiz deste repositório, preset Vite, Node.js 24.x, build `npm run build` e saída `dist`. Cadastre em Production e, se usado, Preview:

```dotenv
ROBOFLOW_API_URL=https://serverless.roboflow.com
ROBOFLOW_WORKSPACE=carlos-viel-okshf
ROBOFLOW_WORKFLOW_ID=doencas-o41wy
ROBOFLOW_IMAGE_INPUT=image
ROBOFLOW_CLASSES_INPUT=classes
ROBOFLOW_API_KEY=<chave privada, somente no servidor>
```

Faça novo deploy com este código após salvar as variáveis. Um `ROBOFLOW_WORKFLOW_ID` antigo na Vercel sobrescreve o padrão corrigido. Nunca use prefixo `VITE_` para segredos. `.env` está ignorado pelo Git; apenas seu identificador de Workflow foi atualizado localmente, preservando a chave.

O threshold publicado do detector é 0.4, NMS IoU 0.3, NMS entre classes desativado e máximo de 1000 detecções. Não há filtro adicional no backend ou frontend. Para testes, `ROBOFLOW_CONFIDENCE` aceita um número entre 0 e 1 somente em `doencas-o41wy`; qualquer override aparece como experimental. Deixe a variável ausente para preservar o padrão publicado.

A função tem duração máxima de 60 segundos; o Roboflow tem orçamento total de 55 segundos e o navegador de 65 segundos. O navegador prepara imagens de até 10 MB como JPEG de até 1600 pixels e limita o arquivo enviado a 4 MB. O Express aceita até 4 MB e verifica o tamanho da resposta antes de enviá-la para respeitar o limite de 4,5 MB da Vercel.

Documentação: [Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [limite de resposta](https://vercel.com/docs/errors/function_response_payload_too_large), [Workflow API](https://github.com/roboflow/computer-vision-skills/blob/main/skills/roboflow-api-reference/inference.md).

## Testes

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
node --env-file-if-exists=.env scripts/verify-roboflow.mjs
node --env-file-if-exists=.env scripts/verify-inference-ui.mjs caminho/folha.jpg
node --env-file-if-exists=.env scripts/verify-api.mjs caminho/folha.jpg
node --env-file-if-exists=.env scripts/verify-api.mjs caminho/folha.jpg https://seu-projeto.vercel.app
```

Os scripts de inferência fazem chamadas reais e podem consumir créditos. `verify-api.mjs` testa health, rota inexistente com JSON e upload multipart usando a mesma entrada Express da Vercel; com URL, testa o deployment publicado. Use uma imagem JPG/PNG/WebP de até 4 MB. Os testes unitários e de navegador substituem o provedor exclusivamente nos testes.

`GET /api/health` deve responder JSON com `status: "ok"` e `configured: true`, sem expor a chave. O frontend distingue rota inexistente, HTML inesperado, JSON inválido, indisponibilidade, configuração ausente, autenticação e timeout. Nenhuma chave, base64 ou mensagem privada do provedor deve ser registrada em logs.

## Validação desta correção

Build/TypeScript e testes de backend passaram. O fluxo real no navegador validou 10 predições recebidas, 10 exibidas, 0 filtradas pela aplicação e 10 caixas. Classes, confidências e coordenadas foram comparadas com a resposta original de cada chamada. Testes de navegador verificam cores, porcentagens, câmera, geometria e mensagens de erro em desktop e mobile.

O deployment `https://praga-cafe.vercel.app` foi testado com upload real e retornou HTTP 200 com zero detecções. A correção local foi validada, mas não publicada. É necessário alterar o Workflow nas variáveis da Vercel, fazer novo deploy e repetir o teste publicado.
