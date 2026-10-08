export async function prepareImage(file:File):Promise<File> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
  if (file.size > 10*1024*1024) throw new Error('A imagem deve ter no máximo 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src=url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('A imagem tem resolução muito alta. Envie uma versão menor.');
    const scale = Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width=Math.round(image.naturalWidth*scale); canvas.height=Math.round(image.naturalHeight*scale);
    canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Não foi possível preparar a imagem.')),'image/jpeg',0.9));
    if (blob.size > 4*1024*1024) throw new Error('A imagem preparada excedeu 4 MB. Envie uma imagem menor.');
    return new File([blob],'folha-cafe.jpg',{type:'image/jpeg'});
  } catch(e) { throw e instanceof Error && (e.message.includes('resolução') || e.message.includes('4 MB')) ? e : new Error('Não foi possível abrir a imagem. Escolha outra foto.'); }
  finally { URL.revokeObjectURL(url); }
}
