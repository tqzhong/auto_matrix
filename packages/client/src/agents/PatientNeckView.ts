import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';

// Close only the cut made for the local exposed-patient view. The third-person
// face, contact surface and every original skin vertex remain unchanged.
export function patientNeckView(rig: HeroRig): THREE.SkinnedMesh | undefined {
  const skin = rig.trackingSkin, body = rig.wardrobe.find(part => part.mesh.userData.patientBody);
  if (!skin || !body) return;
  const original = skin.original, visible = new Set(Array.from(skin.patientFirstPerson.index!.array));
  const cut = new Set<number>(), indices = original.index!;
  for (let i = 0; i < indices.count; i += 3) {
    const face = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    if (face.some(vertex => !visible.has(vertex))) for (const vertex of face) if (visible.has(vertex)) cut.add(vertex);
  }
  const head = rig.bones.get('head')!;
  rig.root.updateWorldMatrix(true, true); skin.mesh.skeleton.update();
  const toHead = head.matrixWorld.clone().invert().multiply(skin.mesh.matrixWorld);
  const points = new Map<string, { vertex: number; point: THREE.Vector3 }>();
  for (const vertex of cut) {
    const point = skin.mesh.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(toHead);
    points.set(point.toArray().map(value => value.toFixed(5)).join(','), { vertex, point });
  }
  const rim = [...points.values()], center = new THREE.Vector3();
  if (rim.length < 3) return;
  for (const { point } of rim) center.add(point);
  center.divideScalar(rim.length);
  rim.sort((a, b) => Math.atan2(a.point.z - center.z, a.point.x - center.x) - Math.atan2(b.point.z - center.z, b.point.x - center.x));
  const cap: number[] = [];
  for (const face of THREE.ShapeUtils.triangulateShape(rim.map(({ point }) => new THREE.Vector2(point.x, point.z)), [])) {
    const [a, b, c] = face.map(index => rim[index]);
    const up = b.point.clone().sub(a.point).cross(c.point.clone().sub(a.point)).y;
    cap.push(a.vertex, up > 0 ? b.vertex : c.vertex, up > 0 ? c.vertex : b.vertex);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setIndex(cap);
  geometry.attributes = { ...original.attributes, normal: original.attributes.normal.clone() };
  geometry.morphAttributes = original.morphAttributes; geometry.morphTargetsRelative = original.morphTargetsRelative;
  geometry.computeVertexNormals();
  const source = skin.mesh.material as THREE.MeshStandardMaterial, material = source.clone();
  material.name = 'Patient neck closure'; material.onBeforeCompile = source.onBeforeCompile; material.customProgramCacheKey = source.customProgramCacheKey;
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.onBeforeRender = () => {
    material.color.copy(source.color); material.emissive.copy(source.emissive); material.emissiveIntensity = source.emissiveIntensity;
    material.roughness = source.roughness; material.metalness = source.metalness;
  };
  mesh.name = 'patient-first-person-neck'; mesh.visible = false; mesh.receiveShadow = true;
  mesh.bind(skin.mesh.skeleton, skin.mesh.bindMatrix.clone());
  return mesh;
}
