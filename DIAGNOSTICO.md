# Diagnóstico de inferência — 07/10/2026

## Causa comprovada na imagem de teste

O Workflow `general-segmentation-api-5` usa `roboflow_core/sam3@v3`, modelo `sam3/sam3_final`: segmentação genérica por texto. Não usa o modelo treinado no dataset `Doencas`. Os nomes em português eram enviados como prompts. Requisições REST reais, antes de alterar o processamento, retornaram HTTP 200 e lista vazia tanto com esses nomes quanto com os quatro identificadores originais. Isso não demonstra que SAM3 sempre retorne zero, mas comprova a origem do resultado vazio no teste.

A definição publicada foi consultada pelo MCP Roboflow. Também foram confirmadas as classes do projeto `carlos-viel-okshf/doencas-o41wy`: `bicho_mineirorotation`, `cercosporarotation`, `ferrugemrotation` e `phomarotation`. O projeto é de detecção de objetos, não segmentação.

Na mesma imagem real `.tmp/leaf3.jpg`, processada como JPEG 1600 × 800, o Workflow `doencas-o41wy` retornou 10 regiões de bicho-mineiro. Esse Workflow usa `carlos-viel-okshf/doencas-o41wy-1-rfdetr-nano-t1`, RF-DETR Nano. Sua entrada padrão recebe imagem; não é necessário enviar classes como prompts para esse modelo.

O upload real em `https://praga-cafe.vercel.app` também retornou zero detecções, `status: empty` e HTTP 200. Não há acesso à configuração interna desse deployment para comprovar seu identificador de modelo, mas seu resultado foi capturado. A configuração anterior local foi comprovada. Nenhuma publicação foi realizada nesta correção.

## Estrutura JSON real

```text
outputs[0]
  predictions
    image: { width: 1600, height: 800 }
    predictions: [
      { class, class_id, confidence, x, y, width, height,
        detection_id, parent_id }, ...
    ]
  inference_id
  model_id
profiler_trace: []
```

As predições estão em `outputs[0].predictions.predictions`, não diretamente na raiz. `x` e `y` representam o centro da caixa. O SVG converte para o canto usando `x - width/2` e `y - height/2`, preservando a escala da imagem enviada.

O SAM3 retornou a mesma hierarquia com `image: {width:null,height:null}`, `predictions: []`, além de `annotated_image: {type:base64,value:...}`. A resposta completa foi inspecionada com imagens/base64 omitidos dos registros. O resultado especializado não contém máscaras nem polígonos: são bounding boxes reais. O suporte a `points` e máscaras COCO `rle_mask` foi mantido e validado com a captura real existente `sam3-real-predictions.json`. A imagem anotada do provedor é descartada antes da transmissão, pois a interface desenha a geometria com as cores locais.

## Filtros e confiança

| Configuração | SAM3 anterior | Detector especializado |
| --- | --- | --- |
| Confiança mínima | 0.5, padrão do bloco SAM3 v3 | 0.4, entrada publicada |
| NMS IoU | 0.9, padrão do bloco; NMS ativo | 0.3, entrada publicada |
| NMS entre classes | Entre prompts | `class_agnostic_nms: false` |
| Máximo de detecções | Não declarado no Workflow | 1000 |
| Filtro adicional na aplicação | Nenhum | Nenhum |

Os limiares dos modelos não são diretamente comparáveis. O detector mantém seu valor publicado de 40%; nenhuma redução automática de seu threshold foi feita. O Roboflow não expõe propostas anteriores aos filtros: não é possível quantificar quantas regiões foram eliminadas internamente por confiança ou NMS. `filteredCount: 0` refere-se somente à aplicação.

`ROBOFLOW_CONFIDENCE` permite testes no Workflow especializado, validado entre 0 e 1. Qualquer override é identificado como experimental. A variável deve ficar ausente em produção para manter o padrão publicado. O modo SAM3 genérico também aparece como experimental.

## Correções

- Configuração padrão e `.env` local usam `doencas-o41wy`; chave preservada.
- Detector especializado recebe imagem, sem prompts de classe indevidos. SAM3 explicitamente selecionado recebe os identificadores originais.
- Normalização mantém todas as regiões, inclusive classes desconhecidas e confiança baixa; aceita contêineres nomeados aninhados.
- Resposta malformada e confiança inválida geram erros técnicos, em vez de análise vazia ou perda silenciosa de confiança.
- Diagnósticos mostram número recebido, exibido e filtrado pela aplicação, tipo de modelo e threshold.
- Interface distingue lista vazia, predições filtradas, resposta incompatível e erro de processamento.
- Bounding boxes permanecem visíveis também quando existe polígono ou máscara. Mantidos nomes, confiança, contagem, legenda, seleção, cores e responsividade.

A skill `frontend-design` foi procurada no projeto e nas pastas acessíveis de skills/plugins, mas não foi encontrada. Os estilos e componentes existentes foram preservados.

## Evidências de validação

O script `scripts/verify-inference-ui.mjs` fez upload no navegador, enviou a imagem ao backend e chamou Roboflow reais. Comparou cada classe, confiança e coordenada retornada com o backend e os elementos SVG, além de verificar responsividade em 1440 e 390 pixels. Resultado: **10 recebidas, 10 exibidas, 0 filtradas localmente, 10 caixas**. Confianças dessa execução: **82,1% a 96,4%**. Não foram simuladas predições nesse fluxo.

A captura das predições está em `server/fixtures/doencas-live-response.json`, sem imagens/base64. Pequenas diferenças entre chamadas do serviço foram observadas; cada execução foi comparada com sua própria resposta original. Os testes controlados são exclusivos da suíte, sem substituir a inferência no aplicativo.

Passaram build/TypeScript, **29 testes de backend** e **32 testes Playwright** de desktop e celular, incluindo máscaras RLE, erros técnicos, cores, coordenadas e contagem. Também passou o upload multipart usando a mesma entrada Express da Vercel, com dez detecções reais. As inferências reais comprovam o fluxo nesta imagem, mas não medem precisão agronômica para todas as classes.

## Arquivos alterados ou adicionados

- `.env` (somente identificador do Workflow; ignorado pelo Git) e `.env.example`.
- `server/roboflow.js`, `server/normalize.js` e `server/app.js`.
- `src/components/AnalysisResults.tsx` e `src/types.ts`.
- `server/roboflow.test.js`, `server/normalize.test.js`, `server/app.test.js` e `tests/interface.spec.ts`.
- `scripts/inspect-workflow.mjs` e `scripts/verify-inference-ui.mjs`.
- `server/fixtures/doencas-live-response.json`.
- `README.md` e `DIAGNOSTICO.md`.

## Aplicar na Vercel

Altere `ROBOFLOW_WORKFLOW_ID=doencas-o41wy` em Production e Preview, quando usado. Deixe `ROBOFLOW_CONFIDENCE` ausente, publique este código e execute:

```powershell
node --env-file=.env scripts/verify-api.mjs caminho/folha.jpg https://praga-cafe.vercel.app
```

As variáveis da Vercel sobrescrevem o padrão do código. O deployment atual não foi declarado corrigido: a validação publicada precisa ser repetida após o novo deploy.
