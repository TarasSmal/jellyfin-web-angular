import { decode } from 'blurhash';

/**
 * Paint a BlurHash placeholder into a canvas at low resolution; CSS scaling
 * smooths it to full size. Returns false on a malformed hash or when the
 * canvas has no 2d context — a bad server hash must never break a card.
 */
export function paintBlurhash(canvas: HTMLCanvasElement, hash: string, w = 32, h = 32): boolean {
  try {
    const pixels = decode(hash, w, h);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const image = ctx.createImageData(w, h);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
    return true;
  } catch {
    return false;
  }
}
