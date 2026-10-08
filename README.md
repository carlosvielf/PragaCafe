# PragaCaféIA

Aplicação responsiva em React, TypeScript, Vite, Tailwind CSS, Lucide e Framer Motion. Backend Node.js/Express com validação e processamento de imagens em memória usando Sharp.

## Executar

Requer Node.js 22.12+ (ou 24 LTS).

```powershell
npm.cmd install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

O `.env` da raiz já está configurado neste ambiente. O backend fica em `server/` e os scripts npm carregam o arquivo da raiz com `node --env-file-if-exists=.env`. Em outra instalação, edite `.env` e preencha `ROBOFLOW_API_KEY` com sua chave privada do Roboflow. Nunca use prefixo `VITE_` para a chave. `.env` está ignorado pelo Git. Não copie o exemplo por cima de um `.env` existente. Reinicie o servidor depois de alterar variáveis.

```powershell
npm.cmd run dev
```

Abra http://localhost:5173. Frontend e backend são iniciados juntos; o Vite encaminha `/api` para a porta 3001. Alternativamente, execute `npm.cmd run dev:web` e `npm.cmd run dev:server` em dois terminais. Fora do PowerShell, pode usar `npm` sem `.cmd`.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

O servidor serve o build em http://localhost:3001. Para publicação, use HTTPS e mantenha o backend no mesmo domínio. O acesso à câmera por IP local em HTTP pode ser bloqueado no celular; use HTTPS. A interface permite upload da galeria como alternativa. A captura depende do suporte do navegador, da permissão e dos dispositivos disponíveis.

Testes de navegador (execute o build antes):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.playwright"
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Os testes executam upload e câmera virtual em layouts desktop/mobile. As respostas de detecção e de configuração ausente usadas nesses testes são interceptadas exclusivamente no ambiente de teste; o aplicativo usa apenas o backend real. Os testes automatizados não consomem créditos do Roboflow e funcionam com ou sem chave configurada.

## Identificação das classes e diagnóstico da integração

O aplicativo usa o Workflow especializado `doencas-vdoencas-o41wy-1-rfdetr-nano-t1-logic`, não `general-segmentation-api-5`. O MCP confirmou que este último executa `roboflow_core/sam3@v3` com `sam3/sam3_final` e prompts recebidos em `classes`: é segmentação genérica, sem treinamento nas quatro doenças deste projeto.

No Workflow especializado, o bloco interno chama `doencas-o41wy`, cujo bloco `roboflow_core/roboflow_object_detection_model@v3` usa o modelo `carlos-viel-okshf/doencas-o41wy-1-rfdetr-nano-t1`. `models_list`, `models_get` e `projects_get` confirmaram RF-DETR Nano com treinamento concluído, tarefa de detecção de objetos e as quatro classes do projeto Doencas. A configuração publicada utiliza confiança mínima 0,4 e IoU 0,3. Este modelo retorna caixas delimitadoras; não são fabricadas máscaras.

A descrição “Trilhas claras na folha” vinha do antigo mapeamento local em `server/prompts.js`, que associava tanto o identificador da praga quanto um prompt visual ao mesmo nome. Isso permanecia no código mesmo após a troca para o Workflow especializado. A correção removeu a associação entre descrição visual e doença, bem como a associação por posição de `class_id` sem tabela comprovada. Agora apenas identificadores exatos em `prediction.class` recebem os nomes abaixo; classes desconhecidas mantêm o texto original, e um `class_id` isolado gera erro explícito.

| Identificador retornado | Nome apresentado |
| --- | --- |
| `bicho_mineirorotation` | Bicho-mineiro |
| `cercosporarotation` | Cercosporiose |
| `ferrugemrotation` | Ferrugem do cafeeiro |
| `phomarotation` | Mancha de Phoma |

As porcentagens vêm exclusivamente de `prediction.confidence`, quando é um número finito entre 0 e 1, multiplicado por 100 e formatado com no máximo uma casa decimal. Não são probabilidades de diagnóstico. mAP, precision e recall retornados pelas ferramentas de modelos são métricas de avaliação do treinamento e não entram nos resultados da imagem.

A interface agrupa por identificador de classe, informa quantidade de ocorrências e mostra a confiança de cada região sem média ou porcentagem agregada. Mantém a imagem efetivamente enviada ao modelo, caixas/máscaras disponíveis, alternância original/regiões e o botão “Analisar outra imagem”.

Validação real: imagem `dARPJSFxAjUcO9uF5zdq` do projeto Doencas, disponibilizada pelo MCP, retornou cinco regiões de `bicho_mineirorotation`. O JSON MCP original está em `server/fixtures/doencas-positive-response.json`. O teste comparou classe, confiança e caixa da API com a normalização, e uma chamada REST pelo upload real no navegador confirmou um grupo “Bicho-mineiro”, cinco caixas e percentuais individuais de 94,6%, 90,2%, 78%, 74% e 69,7%. Pequenas variações entre chamadas e redimensionamentos são possíveis; cada comparação utiliza a resposta da própria chamada. A imagem pertence ao conjunto de treino, tem seis anotações e produziu cinco detecções; este teste não comprova generalização, cobertura de todas as lesões ou diagnóstico agronômico.

Verificações: 22 testes de backend, build com TypeScript e 8 testes de navegador em desktop/mobile passaram. As respostas substituídas nos testes de navegador são exclusivas de testes; o aplicativo não utiliza simulação. A verificação temporária de navegador está em `.tmp/verify-disease-ui.mjs` e compara o JSON da mesma chamada com os valores renderizados. O smoke test em `scripts/verify-roboflow.mjs` também compara classes, confianças e caixas.

Os ajustes da interface seguiram a skill `frontend-design` localizada em `C:/Users/fifo/Desktop/Grupo4 monolito/.agents/skills/frontend-design/SKILL.md`, preservando o tema existente, os controles acessíveis e o layout responsivo. Os resultados são sugestões de identificação, sem diagnóstico definitivo.

## Workflow Roboflow

Integração de imagens estáticas com **Doencas vdoencas-o41wy-1-rfdetr-nano-t1 Logic**, workspace `carlos-viel-okshf`, slug `doencas-vdoencas-o41wy-1-rfdetr-nano-t1-logic`.

Endpoint POST: `https://serverless.roboflow.com/carlos-viel-okshf/workflows/doencas-vdoencas-o41wy-1-rfdetr-nano-t1-logic`.

Definição publicada obtida por `workflows_get` e execução por `workflows_run` via MCP OAuth em 7 de outubro de 2026. Entrada única: `image` (`InferenceImage`). Não existem parâmetros declarados: não enviar `classes`, `model_id` ou outros parâmetros. Saída declarada: `predictions`, selecionada de `$steps.model.predictions`. O bloco interno usa `doencas-o41wy` com modelo `carlos-viel-okshf/doencas-o41wy-1-rfdetr-nano-t1`. O snapshot publicado está em `server/fixtures/doencas-workflow.json`; o cliente deriva os nomes das entradas/saídas desse arquivo.

`server/roboflow.js` exporta `runDiseaseWorkflow(image, options)` e `RoboflowError` com códigos seguros. Aceita um Buffer de imagem ou URL HTTPS e retorna uma lista de dicionários, um por imagem. Usa o `fetch` nativo existente no backend: o SDK oficial JavaScript em https://github.com/roboflow/inference-sdk-js (0.4.0) oferece WebRTC, sem método para executar Workflows em imagens estáticas, e não oferece a autenticação Bearer necessária para esta chamada. Nenhuma dependência foi adicionada. A câmera apenas captura uma fotografia; transmissão de vídeo exige uma integração WebRTC separada.

Configure `ROBOFLOW_API_KEY` no `.env` existente, obtendo a chave em https://app.roboflow.com/settings/api. OAuth do MCP permite consultas nesta sessão; o aplicativo usa sua própria chave do ambiente. Autenticação exclusivamente por `Authorization: Bearer`, sem credencial na URL, corpo, logs ou navegador.

```js
import { runDiseaseWorkflow } from './server/roboflow.js';
const results = await runDiseaseWorkflow('https://example.com/folha.jpg');
// Ou: await runDiseaseWorkflow(await readFile('folha.jpg'));
```

Payload: `{"inputs":{"image":{"type":"base64","value":"<JPEG em base64>"}}}`. URLs usam `{"type":"url","value":"https://..."}`; HTTP é rejeitado.

A execução MCP de https://raw.githubusercontent.com/EduardoLisboa/YCgCr_leaf_segmentation/main/images/1.jpg retornou `[{"predictions":{"image":{"width":null,"height":null},"predictions":[]}}]`, salvo em `server/fixtures/doencas-real-response.json`. Dimensões nulas usam as dimensões da imagem enviada. Resultado vazio não comprova saúde da planta nem qualidade diagnóstica. O smoke test REST com a chave local também passou, verificando as saídas declaradas.

O cliente valida quantidade de resultados e presença de todas as saídas declaradas; descarta saídas extras e polígonos `points`. Objetos de imagem `{type:"base64",value:"..."}` são decodificados para arquivos em diretórios temporários únicos do sistema e substituídos por `{type:"file",path:"..."}`. O chamador deve remover esses diretórios após o uso. Este Workflow não declara saída de imagem. Nenhum blob é registrado. Caixas e confiança existentes continuam disponíveis para a interface.

Prazo total do provedor: 55 segundos, incluindo leitura de resposta e até duas novas tentativas para falhas de rede, HTTP 429 e 5xx; backoff de 250 e 500 ms. Erros de autenticação e esquema não são repetidos. Falhas geram erros tipados e respostas seguras ao navegador.

Teste real (pode consumir créditos):

```powershell
node --env-file=.env scripts/verify-roboflow.mjs
node --env-file=.env scripts/verify-roboflow.mjs "C:\caminho\folha.jpg"
```

O smoke test chama a função real, exige um resultado e verifica todas as chaves da definição publicada. Registra apenas status e nomes de saída. `npm.cmd test` usa respostas substituídas, incluindo a resposta MCP capturada, sem consumir créditos. `scripts/inspect-workflow.mjs` consulta a definição por REST e registra somente o esquema; atualizações de contrato devem ser confirmadas via MCP antes de alterar o snapshot e o parser.

Instruções para desenvolvimento: mantenha chave exclusivamente no servidor, derive nomes do snapshot confirmado, preserve erros de esquema como falhas explícitas e nunca registre respostas completas, base64 ou polígonos. Rode `npm.cmd test`, `npm.cmd run typecheck` e o smoke test explícito após alterar a integração. Não há arquivos de instruções de agentes ou onboarding adicionais neste repositório.

## Estrutura e limites

- `src/components`: cabeçalho, câmera, upload, prévia, botão, carregamento e resultados.
- `src/services`: validação/redimensionamento no navegador e comunicação HTTP.
- `server/app.js`: upload, decodificação, limite de concorrência e comunicação com Roboflow.
- `server/roboflow.js`: cliente, autenticação, retries e validação das saídas declaradas.
- `server/normalize.js`: transformação e filtragem das saídas do Workflow.
- `server/*.test.js`: testes do normalizador e integração HTTP com provedor substituído apenas em testes.

JPG, PNG e WebP até 10 MB e 40 megapixels. Imagens são orientadas, convertidas para JPEG e limitadas a 1600 pixels. Prazo total do provedor com retries: 55 segundos; timeout do cliente: 65 segundos. Até três requisições ao provedor simultâneas por processo. A câmera é encerrada na captura, fechamento, troca, desmontagem ou quando a página deixa de estar visível. URLs temporárias são liberadas. Não há persistência ou registro de imagens/chaves na aplicação. As imagens são enviadas ao Roboflow para processamento; políticas de retenção do provedor são independentes.

Antes de disponibilizar publicamente em larga escala, adicione autenticação, limites por usuário/IP e limites de upload no proxy para proteger as cotas da sua conta. Verifique câmera e troca de câmera em dispositivos Android/iOS reais; testes automatizados com câmera virtual não substituem essa validação.

## Vercel

O projeto está configurado para executar Vite e Express localmente; ainda não possui uma configuração de deploy conjunta na Vercel. Publicar apenas o frontend como Vite não publica automaticamente este backend. A adaptação precisa encaminhar `/api` para uma função Express e respeitar os limites de payload e duração do provedor.

Quando o backend estiver configurado na Vercel, abra o projeto → Settings → Environment Variables, adicione `ROBOFLOW_API_KEY` com a chave privada e escolha Production e, se necessário, Preview/Development. Não use prefixo `VITE_`. Salve e faça um novo deploy; alterações nas variáveis não atualizam deploys existentes. Documentação: https://vercel.com/docs/environment-variables/managing-environment-variables.
#   P r a g a C a f e  
 