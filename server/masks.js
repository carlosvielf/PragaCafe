import sharp from 'sharp';
// COCO format: signed 5-bit groups, with differences from run i-2.
// Reference: https://github.com/cocodataset/cocoapi/blob/master/common/maskApi.c
export function decodeMask(rle, image) {
  const fail = () => { throw new Error('PREDICTION_PROCESSING_ERROR'); };
  if (!rle || !Array.isArray(rle.size) || rle.size.length !== 2) fail();
  const [height,width] = rle.size;
  if (![width,height].every(n => Number.isInteger(n) && n > 0) || width*height > 4000000 || width !== image.width || height !== image.height) fail();
  let counts;
  if (Array.isArray(rle.counts)) counts = rle.counts;
  else if (typeof rle.counts === 'string' && rle.counts.length <= width*height*2) {
    counts = []; let cursor = 0;
    while (cursor < rle.counts.length) {
      let value = 0, shift = 0, byte;
      do {
        if (cursor >= rle.counts.length || shift >= 30) fail();
        byte = rle.counts.charCodeAt(cursor++) - 48;
        if (byte < 0 || byte > 63) fail();
        value += (byte & 31) * 2 ** shift; shift += 5;
      } while (byte & 32);
      if (byte & 16) value -= 2 ** shift;
      if (counts.length > 2) value += counts[counts.length-2];
      counts.push(value);
    }
  } else fail();
  if (!counts.length || counts.length > width*height+1) fail();
  const rgba = Buffer.alloc(width*height*4);
  let offset = 0;
  for (let run = 0; run < counts.length; run++) {
    const count = counts[run];
    if (!Number.isSafeInteger(count) || count < 0 || offset+count > width*height) fail();
    if (run % 2) for (let pixel = offset; pixel < offset+count; pixel++) {
      // RLE traverses columns; PNG traverses rows.
      const target = ((pixel % height)*width + Math.floor(pixel/height))*4;
      rgba[target]=129; rgba[target+1]=199; rgba[target+2]=132; rgba[target+3]=110;
    }
    offset += count;
  }
  if (offset !== width*height) fail();
  return {rgba,width,height};
}
export async function renderMasks(result) {
  let pixels = 0;
  for (const detection of result.detections) {
    if (!detection.rleMask) continue;
    pixels += result.image.width*result.image.height;
    if (pixels > 100000000) throw new Error('PREDICTION_PROCESSING_ERROR');
    const {rgba,width,height}=decodeMask(detection.rleMask,result.image);
    const png=await sharp(rgba,{raw:{width,height,channels:4}}).png().toBuffer();
    detection.maskImage=`data:image/png;base64,${png.toString('base64')}`;
  }
  return result;
}
