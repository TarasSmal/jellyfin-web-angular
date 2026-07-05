import { describe, expect, it, vi } from 'vitest';
import { paintBlurhash } from './blurhash';

// happy-dom has no real 2d context, so stub the minimal surface the painter uses.
function stubCanvas(ctx: unknown): HTMLCanvasElement {
  return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

const VALID_HASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';

describe('paintBlurhash', () => {
  it('paints a valid hash and reports success', () => {
    const putImageData = vi.fn();
    const ctx = {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData,
    };
    const canvas = stubCanvas(ctx);

    expect(paintBlurhash(canvas, VALID_HASH)).toBe(true);
    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(32);
    expect(putImageData).toHaveBeenCalledOnce();
  });

  it('returns false for a malformed hash', () => {
    expect(paintBlurhash(stubCanvas({}), 'not-a-blurhash')).toBe(false);
  });

  it('returns false when the canvas has no 2d context', () => {
    expect(paintBlurhash(stubCanvas(null), VALID_HASH)).toBe(false);
  });
});
