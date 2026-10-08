import { useRef, useState } from 'react';
import { Upload, ImagePlus } from 'lucide-react';
export function ImageUpload({onSelect,disabled}:{onSelect:(file:File)=>void;disabled:boolean}) {
  const input=useRef<HTMLInputElement>(null); const [drag,setDrag]=useState(false);
  return <div className={`upload-zone ${drag?'dragging':''}`} onDragOver={e=>{e.preventDefault();if(!disabled)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(!disabled&&e.dataTransfer.files[0])onSelect(e.dataTransfer.files[0]);}}>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} className="sr-only" aria-label="Selecionar imagem da folha" onChange={e=>{if(e.target.files?.[0])onSelect(e.target.files[0]);e.target.value='';}}/>
    <span className="upload-icon"><ImagePlus size={29} strokeWidth={1.5}/></span><h3>Sua próxima análise começa aqui</h3><p>Arraste uma foto da folha de café<br/>ou selecione uma imagem do seu dispositivo.</p>
    <button className="button secondary" disabled={disabled} onClick={()=>input.current?.click()}><Upload size={18}/>Enviar imagem</button><small>JPG, PNG ou WebP · Até 10 MB</small>
  </div>;
}
