import { readFile, readdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
const root = new URL('./', import.meta.url), result = [];
for (const version of ['before', 'after']) for (const file of (await readdir(new URL(`${version}/`, root))).filter(name => name.endsWith('.json'))) {
  const data = JSON.parse(await readFile(new URL(`${version}/${file}`, root), 'utf8'));
  const inverse = new THREE.Matrix4().fromArray(data.propMatrix).invert();
  const triangles: THREE.Triangle[] = [];
  for (let i = 0; i < data.prop.indices.length; i += 3) {
    const tri = new THREE.Triangle(...[0, 1, 2].map(j => new THREE.Vector3().fromArray(data.prop.vertices[data.prop.indices[i + j]])) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
    if (tri.getArea() > 1e-10) triangles.push(tri);
  }
  const fingers = [];
  for (const finger of [1, 2]) {
    let gap = Infinity, insideHeldRim = 0;
    const closest = new THREE.Vector3();
    data.vertices.forEach((value: number[], i: number) => {
      if (data.labels[i] !== `finger${finger}-3_R`) return;
      const point = new THREE.Vector3().fromArray(value);
      for (const triangle of triangles) gap = Math.min(gap, triangle.closestPointToPoint(point, closest).distanceTo(point));
      point.applyMatrix4(inverse);
      if (point.x > .065 && point.x < .12 && Math.abs(point.y) < .03 && Math.abs(point.z) < .0123) insideHeldRim++;
    });
    fingers.push({ finger, surfaceGap: gap, insideHeldRim });
  }
  result.push({ version, pose: file.replace('.json', ''), fingers });
}
await writeFile(new URL('contact-metrics.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
