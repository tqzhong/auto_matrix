import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** The same wingback chair is loaded in Lafayette and the Construct. Callers own its mesh resources. */
export function createLoungeChair(leather: THREE.Material): THREE.Group {
  const root = new THREE.Group();
  const material = (color: number, roughness: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mesh = (geometry: THREE.BufferGeometry, surface: THREE.Material, x: number, y: number, z: number) => {
    const item = new THREE.Mesh(geometry, surface); item.position.set(x, y, z); item.castShadow = item.receiveShadow = true; root.add(item); return item;
  };
  const box = (surface: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, bevel: number) =>
    mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w / 3, h / 3, d / 3)), surface, x, y, z);
  const sphere = (surface: THREE.Material, x: number, y: number, z: number, radius: number) => mesh(new THREE.SphereGeometry(radius, 24, 16), surface, x, y, z);
  const pipe = (points: number[][], radius: number, surface: THREE.Material) =>
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), 20, radius, 8, false), surface, 0, 0, 0);
  const seam = material(0x43221c, .88); const trim = material(0x604c32, .72, .3); const frame = material(0x281c17, .64);
  const leg = new THREE.LatheGeometry([[.18, .12], [.21, .18], [.17, .28], [.12, .38], [.11, .55], [.16, .78], [.2, .85]]
    .map(([radius, y]) => new THREE.Vector2(radius, y)), 16);
  for (const dx of [-1.35, 1.35]) for (const dz of [-1.05, 1.05]) {
    mesh(leg, frame, dx, 0, dz);
  }
  box(frame, 0, .83, 0, 3.45, .22, 2.9, .08);
  box(leather, 0, 1.05, 0, 3.5, .45, 2.95, .2);
  box(leather, 0, 1.49, .14, 2.7, .52, 2.58, .22);
  pipe([[-1.27, 1.5, 1.39], [0, 1.49, 1.44], [1.27, 1.5, 1.39]], .013, seam);
  // A continuous padded shell: a domed crown, a reclined centre and forward
  // wings. The rear and perimeter are closed, so side views have no flat card.
  const buttons: [number, number][] = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    const u = (col - 2) * .38 + row % 2 * .19;
    if (Math.abs(u) < .88) buttons.push([u, .16 + row * .16]);
  }
  const positions: number[] = []; const uv: number[] = []; const indices: number[] = [];
  const surface = (u: number, v: number, back = false): number[] => {
    const sx = u * (1.56 + .22 * Math.sin(v * Math.PI * .85));
    const sy = 1.45 + v * (3.5 + .4 * (1 - u * u));
    const radius = Math.min(...buttons.map(([bu, bv]) => ((u - bu) / .38) ** 2 + ((v - bv) / .16) ** 2));
    const padded = .07 * (1 - Math.exp(-radius * 9)) - .07 * Math.exp(-radius * 45);
    return [sx, sy, -.94 - .55 * v + .62 * u ** 4 * Math.sin(v * Math.PI * .9) + (back ? -.32 : padded)];
  };
  const columns = 40, rows = 56, count = (columns + 1) * (rows + 1);
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    positions.push(...surface(col / columns * 2 - 1, row / rows, !!side)); uv.push(col / columns, row / rows);
    if (row < rows && col < columns) {
      const a = side * count + row * (columns + 1) + col, b = a + columns + 1;
      if (side) indices.push(a, b, a + 1, a + 1, b, b + 1);
      else indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const close = (a: number, b: number) => indices.push(a, b, a + count, b, b + count, a + count);
  for (let col = 0; col < columns; col++) { close(col + 1, col); close(rows * (columns + 1) + col, rows * (columns + 1) + col + 1); }
  for (let row = 0; row < rows; row++) { close(row * (columns + 1), (row + 1) * (columns + 1)); close((row + 1) * (columns + 1) + columns, row * (columns + 1) + columns); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  mesh(geometry, leather, 0, 0, 0);
  for (const [u, v] of buttons) { const [bx, by, bz] = surface(u, v); sphere(seam, bx, by, bz + .022, .046).scale.z = .4; }
  const crown = Array.from({ length: 17 }, (_, i) => surface(i / 8 - 1, 1)); pipe(crown, .018, seam);
  const armShape = new THREE.Shape(); armShape.moveTo(-1.4, 1.03); armShape.lineTo(1.37, 1.03);
  armShape.bezierCurveTo(1.46, 1.56, 1.46, 2.24, 1.34, 2.55);
  armShape.bezierCurveTo(1.16, 2.9, .58, 2.68, -.2, 2.71);
  armShape.bezierCurveTo(-.85, 2.74, -1.13, 3.1, -1.36, 3.22); armShape.closePath();
  const arm = new THREE.ExtrudeGeometry(armShape, { depth: .34, bevelEnabled: true, bevelSize: .12, bevelThickness: .12, bevelSegments: 4, curveSegments: 12, steps: 1 });
  arm.translate(0, 0, -.17); arm.rotateY(-Math.PI / 2);
  for (const side of [-1, 1]) {
    mesh(arm, leather, side * 1.57, 0, 0);
    pipe([[side * 1.58, 3.12, -1.05], [side * 1.59, 2.85, -.5], [side * 1.6, 2.72, .45], [side * 1.6, 2.72, 1.23]], .27, leather);
    sphere(leather, side * 1.6, 2.72, 1.29, .285).scale.z = .58;
    mesh(new THREE.TorusGeometry(.244, .012, 6, 28), seam, side * 1.6, 2.72, 1.36);
    pipe(Array.from({ length: 15 }, (_, i) => surface(side, i / 14)), .018, seam);
    for (let i = 0; i < 13; i++) { const [bx, by, bz] = surface(side, .08 + i * .07); sphere(trim, bx, by, bz + .018, .025); }
  }
  for (let i = 0; i < 23; i++) sphere(trim, -1.55 + i * .141, 1, 1.485, .025);
  // Furniture is static; buttons and piping share the upholstery draw call.
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const originals = new Set<THREE.BufferGeometry>();
  for (const child of root.children as THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]) {
    child.updateMatrix(); originals.add(child.geometry);
    const transformed = child.geometry.clone().applyMatrix4(child.matrix);
    const piece = transformed.index ? transformed.toNonIndexed() : transformed;
    if (piece !== transformed) transformed.dispose();
    const list = parts.get(child.material) ?? []; list.push(piece); parts.set(child.material, list);
  }
  root.clear();
  for (const [surface, pieces] of parts) {
    mesh(mergeGeometries(pieces)!, surface, 0, 0, 0); pieces.forEach(piece => piece.dispose());
  }
  originals.forEach(geometry => geometry.dispose());
  root.scale.setScalar(.65); return root;
}
