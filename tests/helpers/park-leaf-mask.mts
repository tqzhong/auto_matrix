import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

/** Read the shipped, non-interlaced 16-bit greyscale cutout without a test-only image dependency. */
export async function parkLeafMask() {
  const png = await readFile(new URL('../../packages/client/public/assets/park/tree_small_02_leaves_alpha_1k.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.deepEqual([...png.subarray(24, 29)], [16, 0, 0, 0, 0], 'the shipped leaf mask uses non-interlaced 16-bit greyscale');
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.subarray(offset + 4, offset + 8).toString() === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const encoded = inflateSync(Buffer.concat(chunks)), stride = width * 2, pixels = Buffer.alloc(stride * height);
  assert.equal(encoded.length, (stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filter = encoded[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x, left = x >= 2 ? pixels[index - 2] : 0;
      const up = y ? pixels[index - stride] : 0, corner = y && x >= 2 ? pixels[index - stride - 2] : 0;
      const p = left + up - corner, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
      const predictor = filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2)
        : filter === 4 ? a <= b && a <= c ? left : b <= c ? up : corner : 0;
      pixels[index] = encoded[y * (stride + 1) + 1 + x] + predictor;
    }
  }
  const pixel = (x: number, y: number) => pixels.readUInt16BE((Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 2) / 65535;
  // TextureLoader uses flipY=false and linear filtering for this mask; UV zero is the PNG's top edge.
  return (uv: { x: number; y: number }) => {
    const x = uv.x * width - .5, y = uv.y * height - .5, X = Math.floor(x), Y = Math.floor(y), tx = x - X, ty = y - Y;
    return pixel(X, Y) * (1 - tx) * (1 - ty) + pixel(X + 1, Y) * tx * (1 - ty)
      + pixel(X, Y + 1) * (1 - tx) * ty + pixel(X + 1, Y + 1) * tx * ty;
  };
}
