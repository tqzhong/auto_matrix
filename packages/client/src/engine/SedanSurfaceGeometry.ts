import * as THREE from 'three';

export function sedanPanelGeometry(points: readonly number[][]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
  return geometry;
}

export function sedanWindshieldPoints(widthBottom: number, widthTop: number, bottomY: number, topY: number,
  bottomZ: number, topZ: number, rear = false): number[][] {
  const leftBottom = [-widthBottom / 2, bottomY, bottomZ];
  const rightBottom = [widthBottom / 2, bottomY, bottomZ];
  const leftTop = [-widthTop / 2, topY, topZ];
  const rightTop = [widthTop / 2, topY, topZ];
  return rear ? [leftBottom, rightBottom, rightTop, leftTop] : [leftBottom, leftTop, rightTop, rightBottom];
}

export function sedanFenderGeometry(side: number, from: number, to: number, wheel: number, centerX: number): {
  geometry: THREE.BufferGeometry;
  edge: THREE.Vector3[];
} {
  const left = side > 0 ? -to : from; const right = side > 0 ? -from : to; const center = -side * wheel;
  const shape = new THREE.Shape();
  shape.moveTo(left, .85); shape.lineTo(center - 1.12, .85); shape.lineTo(center - 1.12, 1);
  shape.absarc(center, 1, 1.12, Math.PI, 0, true);
  shape.lineTo(center + 1.12, .85); shape.lineTo(right, .85); shape.lineTo(right, 2.45); shape.lineTo(left, 2.45); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .105, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 24 });
  geometry.rotateY(side * Math.PI / 2); geometry.translate(side * centerX, 0, 0);
  const edge = Array.from({ length: 33 }, (_, i) => {
    const a = Math.PI - i / 32 * Math.PI;
    return new THREE.Vector3(side * (centerX + .138), 1 + Math.sin(a) * 1.14, wheel + Math.cos(a) * 1.14);
  });
  return { geometry, edge };
}
