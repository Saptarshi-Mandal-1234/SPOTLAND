import { stripJpegMetadata } from '../../shared/photo-jpeg';
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const SOURCE_TYPES = new Set(['image/jpeg','image/png','image/webp']);

function encode(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('This photo could not be prepared. Try another image.')),'image/jpeg',quality));
}

export async function prepareReviewPhoto(file: File): Promise<File> {
  if (!SOURCE_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error('Choose a photo smaller than 15 MB.');
  let image: ImageBitmap;
  try { image = await createImageBitmap(file); } catch { throw new Error('This image could not be opened. Try another photo.'); }
  try {
    if (!image.width || !image.height || image.width * image.height > 40000000) throw new Error('That image is too large to safely prepare.');
    const maxSide = 1600, scale = Math.min(1,maxSide/Math.max(image.width,image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale));
    const context = canvas.getContext('2d',{alpha:false}); if (!context) throw new Error('Photo preparation is unavailable in this browser.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    let blob = await encode(canvas,0.78);
    if (blob.size > MAX_UPLOAD_BYTES) blob = await encode(canvas,0.62);
    if (blob.size > MAX_UPLOAD_BYTES) {
      canvas.width = Math.max(1,Math.round(canvas.width*0.75)); canvas.height = Math.max(1,Math.round(canvas.height*0.75));
      context.drawImage(image,0,0,canvas.width,canvas.height); blob = await encode(canvas,0.62);
    }
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('This photo is still over 3 MB after compression. Try another image.');
    const clean = stripJpegMetadata(new Uint8Array(await blob.arrayBuffer()));
    return new File([clean],'review.jpg',{type:'image/jpeg',lastModified:Date.now()});
  } finally { image.close(); }
}
