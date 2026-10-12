export const DESERT_TERRAIN = { width: 190, depth: 210, columns: 54, rows: 60 } as const;

export function desertVertexHeight(x: number, z: number): number {
  if (Math.abs(x) <= 9) return 0;
  const bank = Math.max(0, Math.abs(x) - 9);
  return Math.min(1, bank / 6) * Math.max(0, Math.sin(x * .31 - z * .13) * .23 + Math.cos(z * .19 + x * .08) * .18 + bank * .025);
}

/** Interpolate the same two triangles as the rendered PlaneGeometry cell. */
export function desertGroundHeight(x: number, z: number): number {
  if (Math.abs(x) <= 7) return 0;
  const { width, depth, columns, rows } = DESERT_TERRAIN;
  const cellX = Math.max(0, Math.min(columns - .000001, (x + width / 2) / width * columns));
  const cellZ = Math.max(0, Math.min(rows - .000001, (z + depth / 2) / depth * rows));
  const ix = Math.floor(cellX), iz = Math.floor(cellZ), u = cellX - ix, v = cellZ - iz;
  const left = ix / columns * width - width / 2, back = iz / rows * depth - depth / 2;
  const a = desertVertexHeight(left, back), b = desertVertexHeight(left, back + depth / rows);
  const c = desertVertexHeight(left + width / columns, back + depth / rows), d = desertVertexHeight(left + width / columns, back);
  return u + v <= 1 ? a + u * (d - a) + v * (b - a) : c + (1 - u) * (b - c) + (1 - v) * (d - c);
}

export const DESERT_RUINS = Array.from({ length: 28 }, (_, i) => {
  const original = Math.floor((17 + (i * 13) % 34) / 5);
  const levels = Math.max(2, Math.floor(original * [1, .55, .8, .7][i % 4]));
  return { x: (i % 2 ? 1 : -1) * (18 + i % 4 * 9), z: 38 - Math.floor(i / 2) * 10.5,
    width: 8 + i % 5 * 2, depth: 7 + i % 3 * 2, height: levels * 5 + 3.4 };
});

export const DESERT_RUBBLE = Array.from({ length: 46 }, (_, i) => {
  const x = (i % 2 ? 1 : -1) * (9 + (i * 17) % 19), z = 42 - i * 2.45;
  const width = 2.4 + i % 5 * .68, depth = 1.4 + i % 3 * .42, height = .48 + i % 4 * .19;
  const y = Math.min(...[-1, 1].flatMap(side => [-1, 1].map(end => desertGroundHeight(x + side * width / 2, z + end * depth / 2)))) - .025;
  return { x, y, z, width, depth, height };
});
