import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
const directory = process.argv[2]; if (!directory) throw new Error('Specify artifact directory');
const results = [];
for (const version of ['before', 'after']) for (const pose of ['receiving-1.101-0', 'focus-0-0', 'focus-0-1']) {
  const data = JSON.parse(await readFile(`${directory}/${version}/${pose}.json`, 'utf8'));
  const prop = data.prop.vertices.map((v: number[]) => new THREE.Vector3(...v)), triangles: THREE.Triangle[] = [];
  for (let i = 0; i < data.prop.indices.length; i += 3) {
    const triangle = new THREE.Triangle(...data.prop.indices.slice(i, i + 3).map((j: number) => prop[j]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
    if (triangle.getArea() > 1e-10) triangles.push(triangle);
  }
  const inverse = new THREE.Matrix4().fromArray(data.propMatrix).invert(), closest = new THREE.Vector3();
  const gaps = [Infinity, Infinity], inside = [0, 0];
  for (const [i, vertex] of data.vertices.entries()) {
    const match = /^finger([12])-3_R$/.exec(data.labels[i]); if (!match) continue;
    const digit = Number(match[1]) - 1, point = new THREE.Vector3(...vertex);
    for (const triangle of triangles) gaps[digit] = Math.min(gaps[digit], triangle.closestPointToPoint(point, closest).distanceTo(point));
    const local = point.applyMatrix4(inverse);
    if (local.y > .005 && local.y < .165) {
      const radius = .045 - .013 * local.y / .65;
      const side = Math.max(...Array.from({ length: 8 }, (_, k) => {
        const angle = (k + .5) * Math.PI / 4;
        return Math.cos(angle) * local.x / radius + Math.sin(angle) * local.z / (radius * .24);
      }));
      if (side < Math.cos(Math.PI / 8) - .005) inside[digit]++;
    }
  }
  const joints = data.joints;
  const angles = [1, 2].map(finger => {
    const points = [1, 2, 3].map(segment => new THREE.Vector3(...joints[`finger${finger}-${segment}_R`]));
    points.push(new THREE.Vector3(...data.report[finger - 1].pad));
    return [1, 2].map(j => THREE.MathUtils.radToDeg(points[j].clone().sub(points[j - 1]).angleTo(points[j + 1].clone().sub(points[j]))));
  });
  results.push({ version, pose, fingertipSurfaceGap: gaps, fingertipVerticesInsideStem: inside, fingerSegmentAngles: angles });
}
await writeFile(`${directory}/contact-metrics.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
