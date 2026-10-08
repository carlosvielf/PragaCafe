import { useEffect, useRef, useState } from 'react';
import { Camera, X, SwitchCamera, LoaderCircle } from 'lucide-react';
export function CameraCapture({onCapture,onClose}:{onCapture:(file:File)=>void;onClose:()=>void}) {
  const video=useRef<HTMLVideoElement>(null); const stream=useRef<MediaStream|null>(null); const dialog=useRef<HTMLDialogElement>(null);
  const [facing,setFacing]=useState<'environment'|'user'>('environment'); const [error,setError]=useState(''); const [ready,setReady]=useState(false); const [multiple,setMultiple]=useState(false);
  useEffect(()=>{dialog.current?.showModal(); const previous=document.activeElement as HTMLElement; return ()=>previous?.focus();},[]);
  useEffect(()=>{
    let cancelled=false; setReady(false);setError('');
    const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;}; stop();
    async function open() {
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia) {setError('Para acessar a câmera, utilize HTTPS ou localhost em um navegador compatível.');return;}
      try {
        const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}},audio:false});
        if(cancelled){media.getTracks().forEach(t=>t.stop());return;}
        stream.current=media; if(video.current){video.current.srcObject=media;await video.current.play();}
        if(cancelled)return;
        setReady(true);
        const devices=await navigator.mediaDevices.enumerateDevices(); if(!cancelled)setMultiple(devices.filter(d=>d.kind==='videoinput').length>1);
      }catch(e){if(!cancelled){stop();const name=(e as DOMException).name;setError(name==='NotAllowedError'?'Permissão de câmera negada. Autorize o acesso nas configurações do navegador ou envie uma imagem.':name==='NotFoundError'?'Nenhuma câmera encontrada. Envie uma imagem da galeria.':'Não foi possível abrir a câmera. Verifique se outro aplicativo está usando o dispositivo.');}}
    }
    void open(); const hidden=()=>{if(document.hidden)onClose();};document.addEventListener('visibilitychange',hidden);
    return ()=>{cancelled=true;stop();document.removeEventListener('visibilitychange',hidden);};
  },[facing,onClose]);
  function capture(){const v=video.current;if(!v?.videoWidth)return;const canvas=document.createElement('canvas');canvas.width=v.videoWidth;canvas.height=v.videoHeight;canvas.getContext('2d')!.drawImage(v,0,0);canvas.toBlob(blob=>{if(blob){onCapture(new File([blob],'captura.jpg',{type:'image/jpeg'}));onClose();}else setError('Não foi possível capturar a foto. Tente novamente.');},'image/jpeg',0.9);}
  return <dialog ref={dialog} className="camera-modal" onCancel={onClose} aria-labelledby="camera-title"><div className="camera-heading"><h2 id="camera-title">Fotografe sua folha</h2><button className="icon-button" onClick={onClose} aria-label="Fechar câmera"><X/></button></div><p>Enquadre uma folha inteira em um local bem iluminado.</p><div className="camera-view"><video ref={video} playsInline muted autoPlay/>{!ready&&!error&&<LoaderCircle className="spin camera-spinner"/>}</div>{error&&<p className="error" role="alert">{error}</p>}<div className="camera-actions">{multiple&&<button className="button secondary" onClick={()=>setFacing(f=>f==='user'?'environment':'user')}><SwitchCamera size={18}/>Trocar câmera</button>}<button className="button primary" disabled={!ready} onClick={capture}><Camera size={18}/>Capturar foto</button><button className="text-button" onClick={onClose}>Fechar câmera</button></div><small>O acesso à câmera requer HTTPS ou localhost.</small></dialog>;
}
