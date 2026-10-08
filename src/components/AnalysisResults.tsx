import { useId, useState, type CSSProperties } from 'react';
import { CircleCheck, Info, RotateCcw } from 'lucide-react';
import type { Analysis, Detection } from '../types';
import { getClassStyle } from '../config/classes';

const confidenceText = (d: Detection) => d.confidence === undefined ? '' : `${(d.confidence * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const hasGeometry = (d: Detection) => Boolean(d.box || d.points?.length || d.maskImage);
function anchor(d: Detection) {
  if (d.points?.length) return { x: Math.min(...d.points.map(p => p.x)), y: Math.min(...d.points.map(p => p.y)) };
  if (d.box) return { x: d.box.x - d.box.width / 2, y: d.box.y - d.box.height / 2 };
  return undefined;
}
export function AnalysisResults({ result, onReset }: { result: Analysis; onReset: () => void }) {
  const [overlay, setOverlay] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const maskPrefix = useId().replace(/:/g, '');
  const { width, height } = result.image;
  const diagnostics = result.diagnostics;
  const filtered = result.status === 'filtered' || Boolean(diagnostics && diagnostics.filteredCount > 0 && !result.detections.length);
  const groups = new Map<string, { detection: Detection; index: number }[]>();
  result.detections.forEach((detection, index) => {
    const group = groups.get(detection.className) ?? [];
    group.push({ detection, index });
    groups.set(detection.className, group);
  });
  // Draw only on the original image. An annotated-only response is a fallback,
  // never a background for another layer of boxes.
  const useAnnotated = overlay && !result.detections.some(hasGeometry) && Boolean(result.annotatedImage);
  function selectRegion(index: number) {
    setSelected(selected === index ? null : index);
    setOverlay(true);
  }
  return <section className="results" aria-labelledby="results-title">
    <div className="panel-heading">
      <span className="section-icon"><CircleCheck size={20} /></span>
      <div><h2 id="results-title">Análise concluída</h2><p>{result.detections.length
        ? `${result.detections.length} regiões identificadas em ${groups.size} ${groups.size === 1 ? 'classe' : 'classes'}.`
        : filtered ? 'As predições retornadas foram eliminadas por filtros.' : 'Nenhuma predição retornada pelo modelo.'}</p></div>
    </div>
    {diagnostics && <div className="notice"><Info size={18} /><p>
      {diagnostics.experimental && <strong>Resultado experimental. </strong>}
      {diagnostics.modelType === 'generic' ? 'Segmentação genérica por texto; o modelo não foi treinado para diagnosticar estas doenças. ' : diagnostics.modelType === 'specialized' ? 'Detector especializado nas classes de doenças do café. ' : ''}
      {diagnostics.returnedCount} predições recebidas; {diagnostics.displayedCount} exibidas; {diagnostics.filteredCount} eliminadas pela aplicação.
      {diagnostics.confidenceThreshold != null && ` Confiança mínima no Workflow: ${diagnostics.confidenceThreshold * 100}%.`}
      {' O Roboflow não informa quantas propostas foram descartadas internamente.'}
    </p></div>}
    <div className="result-grid">
      <div>
        <div className="image-tabs"><button aria-pressed={!overlay} onClick={() => setOverlay(false)}>Original</button><button aria-pressed={overlay} onClick={() => setOverlay(true)}>Regiões identificadas</button></div>
        <div className="result-image" style={{ aspectRatio: `${width} / ${height}` }}>
          <img src={useAnnotated ? result.annotatedImage : result.originalImage} alt={overlay ? 'Folha com regiões identificadas pela IA' : 'Imagem original analisada'} />
          {overlay && !useAnnotated && <>
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Regiões detectadas">
              {result.detections.map((d, i) => {
                const { color, name } = getClassStyle(d.className, d.name);
                const active = selected === i;
                return <g key={i} data-region={i + 1} opacity={selected !== null && !active ? 0.35 : 1}>
                  <title>{`${name}, região ${i + 1}${d.confidence !== undefined ? `, ${confidenceText(d)}` : ''}`}</title>
                  {d.maskImage ? <>
                    <defs><mask id={`${maskPrefix}-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height} style={{ maskType: 'alpha' }}><image href={d.maskImage} width={width} height={height} preserveAspectRatio="none" /></mask></defs>
                    <rect width={width} height={height} fill={color} opacity={active ? 0.9 : 0.7} mask={`url(#${maskPrefix}-${i})`} />
                  </> : d.points?.length ? <polygon points={d.points.map(p => `${p.x},${p.y}`).join(' ')} fill={`${color}22`} stroke={color} strokeWidth={active ? 4 : 2} vectorEffect="non-scaling-stroke" />
                    : null}
                  {d.box && <rect x={d.box.x - d.box.width / 2} y={d.box.y - d.box.height / 2} width={d.box.width} height={d.box.height} fill={d.maskImage || d.points?.length ? 'none' : `${color}14`} stroke={color} strokeWidth={active ? 4 : 2} vectorEffect="non-scaling-stroke" />}
                </g>;
              })}
            </svg>
            {result.detections.map((d, i) => {
              const position = anchor(d);
              if (!position) return null;
              const { color, shortName } = getClassStyle(d.className, d.name);
              return <button key={i} className="region-label" aria-pressed={selected === i} onClick={() => selectRegion(i)} style={{ '--class-color': color, left: `clamp(4px, ${position.x / width * 100}%, max(4px, 100% - 220px))`, top: `clamp(4px, ${position.y / height * 100}%, max(4px, 100% - 28px))`, opacity: selected !== null && selected !== i ? 0.5 : 1, zIndex: selected === i ? 3 : 2 } as CSSProperties}>
                <b>R{i + 1}</b> {shortName}{d.confidence !== undefined && ` · ${confidenceText(d)}`}
              </button>;
            })}
          </>}
        </div>
        {groups.size > 0 && <ul className="class-legend" aria-label="Legenda das classes identificadas">
          {[...groups.entries()].map(([className, entries]) => {
            const style = getClassStyle(className, entries[0].detection.name);
            return <li key={className}><span className="class-dot" style={{ background: style.color }} aria-hidden="true" /><span>{style.name} — {entries.length} {entries.length === 1 ? 'ocorrência' : 'ocorrências'}</span></li>;
          })}
        </ul>}
        {result.detections.some(hasGeometry) && <p className="region-help">Selecione uma região no cartão ou na imagem para destacá-la. Os identificadores R1, R2… conectam cada região ao seu resultado.</p>}
      </div>
      <div className="detection-list">
        {result.detections.length ? [...groups.entries()].map(([className, entries]) => {
          const style = getClassStyle(className, entries[0].detection.name);
          return <article key={className} style={{ '--class-color': style.color } as CSSProperties}>
            <div className="detection-heading"><h3><span className="class-dot" aria-hidden="true" />{style.name}</h3><span>{entries.length} {entries.length === 1 ? 'ocorrência' : 'ocorrências'}</span></div>
            <p className="source-class">Classe retornada: {entries[0].detection.sourceClass ?? className}</p>
            <p>Identificação sugerida pelo modelo. A confiança indica a pontuação de cada região, não a probabilidade de um diagnóstico.</p>
            <ul className="region-confidences" aria-label={`Confiança das regiões de ${style.name}`}>
              {entries.map(({ detection: d, index }) => <li key={index}>
                <button className="region-select" disabled={!hasGeometry(d)} aria-pressed={selected === index} onClick={() => selectRegion(index)}>
                  <div className="confidence"><span>Região {index + 1} <b className="region-id">R{index + 1}</b></span>{d.confidence !== undefined ? <strong>{confidenceText(d)}</strong> : <span>Confiança não disponibilizada pelo modelo.</span>}</div>
                  {d.confidence !== undefined && <div className="confidence-track"><span style={{ width: `${d.confidence * 100}%` }} /></div>}
                </button>
                {!hasGeometry(d) && <small>Localização não disponibilizada pelo modelo.</small>}
              </li>)}
            </ul>
          </article>;
        }) : <article><h3>{filtered ? 'Predições eliminadas por filtros' : 'Nenhuma predição retornada pelo modelo'}</h3><p>{filtered ? 'Verifique os filtros configurados antes de interpretar o resultado.' : 'O Roboflow retornou uma lista vazia de predições. Isso não confirma que a planta esteja saudável. Se houver sintomas, tente uma foto mais nítida e consulte um profissional.'}</p></article>}
      </div>
    </div>
    <div className="notice"><Info size={18} /><p>As classes são sugestões do modelo. Os resultados não substituem uma avaliação técnica agronômica.</p></div>
    <button className="button primary" onClick={onReset}><RotateCcw size={18} />Analisar outra imagem</button>
  </section>;
}
