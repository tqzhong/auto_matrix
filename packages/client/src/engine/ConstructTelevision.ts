import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONSTRUCT } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The same physical cabinet survives the loading program's change of surroundings.
 * Callers own the returned meshes, materials and label texture. */
export function createConstructTelevision(wood: THREE.Material, black: THREE.Material, screenMaterial: THREE.Material): THREE.Group {
  const tv = new THREE.Group(); tv.name = 'construct-television';
  const originals = new Set<THREE.BufferGeometry>();
  const mesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh => {
    originals.add(geometry); const item = new THREE.Mesh(geometry, material); item.castShadow = item.receiveShadow = true;
    if (name) item.name = name; parent.add(item); return item;
  };
  const box = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, radius = 0): THREE.Mesh => {
    const geometry = radius ? new RoundedBoxGeometry(width, height, depth, 4, Math.min(radius, width / 3, height / 3, depth / 3)) : new THREE.BoxGeometry(width, height, depth);
    const item = mesh(parent, geometry, material); item.position.set(x, y, z); return item;
  };
  const cylinder = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, radius: number, height: number): THREE.Mesh => {
    const item = mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 18), material); item.position.set(x, y, z); return item;
  };
  // Veneered panels enclose the tube; the top rear cooling strip stays open.
  for (const x of [-1.635, 1.635]) box(tv, wood, x, 1.4, 0, .13, 2.6, 2.25, .04);
  box(tv, wood, 0, 2.75, 0, 3.4, .1, 2.25, .025);
  box(tv, wood, 0, .08, 0, 3.4, .16, 2.25, .035);
  box(tv, wood, 0, .43, 1.065, 3.14, .57, .12, .025);
  box(tv, wood, 0, 2.72, 1.065, 3.14, .07, .12);
  for (const x of [-1.54, 1.54]) box(tv, wood, x, 1.75, 1.065, .14, 1.93, .12, .025);
  const surround = new THREE.Shape();
  const rectangle = (path: THREE.Path, width: number, height: number, radius: number) => {
    const x = width / 2, y = height / 2;
    path.moveTo(-x + radius, -y); path.lineTo(x - radius, -y); path.quadraticCurveTo(x, -y, x, -y + radius);
    path.lineTo(x, y - radius); path.quadraticCurveTo(x, y, x - radius, y);
    path.lineTo(-x + radius, y); path.quadraticCurveTo(-x, y, -x, y - radius);
    path.lineTo(-x, -y + radius); path.quadraticCurveTo(-x, -y, -x + radius, -y);
  };
  rectangle(surround, 3.06, 1.94, .22);
  const aperture = new THREE.Path(); rectangle(aperture, 2.8, 1.7, .18); surround.holes.push(aperture);
  const bezel = mesh(tv, new THREE.ExtrudeGeometry(surround, { depth: .08, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 12 }), black, 'construct-crt-surround');
  bezel.position.set(0, CONSTRUCT.television.screenY, 1.014);
  const tube = new THREE.PlaneGeometry(2.8, 1.7, 36, 24), vertices = tube.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i), edge = Math.max(0, Math.abs(y) - .67);
    const halfWidth = 1.22 + Math.sqrt(Math.max(0, .18 ** 2 - edge ** 2));
    const x = vertices.getX(i) * halfWidth / 1.4;
    vertices.setXYZ(i, x, y, .06 * Math.max(0, 1 - (x / 1.4) ** 2) * Math.max(0, 1 - (y / .85) ** 2));
  }
  tube.computeVertexNormals();
  const screen = mesh(tv, tube, screenMaterial, 'construct-television-screen');
  screen.position.set(0, CONSTRUCT.television.screenY, 1.065); screen.castShadow = screen.receiveShadow = false;
  const brass = new THREE.MeshStandardMaterial({ color: 0x7d6c4c, roughness: .42, metalness: .65 });
  for (const x of [-1.22, 1.22]) {
    cylinder(tv, brass, x, .44, 1.073, .16, .06).rotation.x = Math.PI / 2;
    cylinder(tv, black, x, .44, 1.105, .115, .035).rotation.x = Math.PI / 2;
    box(tv, brass, x, .485, 1.125, .012, .075, .006);
  }
  for (let i = 0; i < 15; i++) box(tv, black, -.91 + i * .13, .43, 1.128, .025, .27, .006);
  box(tv, black, 0, 1.19, -.99, 3.16, 2.2, .16, .01);
  if (typeof document !== 'undefined') {
    const rear = document.createElement('canvas'); rear.width = 768; rear.height = 544;
    const ctx = rear.getContext('2d')!; ctx.fillStyle = '#30241b'; ctx.fillRect(0, 0, 768, 544);
    ctx.strokeStyle = '#8b7858'; ctx.fillStyle = '#8b7858'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(90, 80); ctx.lineTo(678, 80); ctx.lineTo(718, 128); ctx.lineTo(50, 128); ctx.lineTo(90, 80); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(55, 130); ctx.lineTo(384, 460); ctx.lineTo(713, 130); ctx.stroke();
    ctx.font = 'italic 30px Georgia'; ctx.fillText('DEEP IMAGE', 228, 112);
    ctx.beginPath(); ctx.arc(384, 238, 62, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '27px Georgia'; ctx.fillText('RADIOLA TELEVISION', 188, 371);
    ctx.font = '16px Georgia'; ctx.fillText('A RADIO CORPORATION RECEIVER', 207, 419);
    for (const y of [453, 472, 491]) for (const x of [75, 498]) ctx.fillRect(x, y, 195, 3);
    const label = new THREE.CanvasTexture(rear); label.colorSpace = THREE.SRGBColorSpace;
    const panel = mesh(tv, new THREE.PlaneGeometry(3.1, 2.18), new THREE.MeshStandardMaterial({ map: label, roughness: .9 }), 'construct-tv-rear');
    panel.position.set(0, 1.19, -1.075); panel.rotation.y = Math.PI;
  }
  for (const y of [2.33, 2.7]) box(tv, brass, 0, y, -1.055, 3.16, .05, .1);
  box(tv, brass, 0, 2.52, -1.055, .35, .33, .1);
  for (const side of [-1, 1]) for (let i = 0; i < 12; i++) box(tv, black, side * (.23 + i * .1), 2.52, -1.055, .035, .33, .1);
  // Keep the screen and rear label separate; discard replaced static pieces.
  batchStaticGeometry(tv, new Set());
  const retained = new Set<THREE.BufferGeometry>();
  tv.traverse(object => { if (object instanceof THREE.Mesh) retained.add(object.geometry); });
  originals.forEach(geometry => { if (!retained.has(geometry)) geometry.dispose(); });
  return tv;
}
