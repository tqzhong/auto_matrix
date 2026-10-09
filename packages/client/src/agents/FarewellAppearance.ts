import * as THREE from 'three';
import type { HeroRig } from './HeroModel.js';
import type { MotionInput } from './CharacterMotion.js';

/** Real-world knit costumes; the normal wardrobe restores Matrix appearances. */
export class FarewellAppearance {
  private weave: THREE.DataTexture;
  private band?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

  constructor(private rig: HeroRig, private role: 'neo' | 'trinity' | 'morpheus', eye: THREE.Vector3) {
    const size = 128, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = y % 16 / 16, column = x % 16;
      const strand = Math.min(Math.abs(column - (8 - row * 6)), Math.abs(column - (8 + row * 6)));
      const height = 74 + Math.exp(-strand * strand / 2.6) * 155 + Math.sin(x * 2.1 + y * 3.7) * 5;
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = Math.round(height); pixels[offset + 3] = 255;
    }
    this.weave = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    this.weave.name = `${role}-farewell-knit`; this.weave.wrapS = this.weave.wrapT = THREE.RepeatWrapping;
    this.weave.repeat.set(role === 'morpheus' ? 12 : 2, role === 'morpheus' ? 12 : 2); this.weave.needsUpdate = true;
    if (role !== 'neo') return;
    const head = rig.bones.get('head')!;
    rig.root.updateMatrixWorld(true);
    const face: { points: number[]; triangles: number[] }[] = [];
    for (const part of rig.wardrobe) {
      if (!/^(Skin|Eyes)$/.test((part.mesh.material as THREE.Material).name)) continue;
      const mesh = part.mesh, source = mesh.geometry, points: number[] = [], triangles: number[] = [];
      if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
      // Decode skinning once. Repeating it for every ray through the entire
      // head/hands mesh would stall the first frame when the asset arrives.
      for (let i = 0; i < source.attributes.position.count; i++) {
        const point = head.worldToLocal(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())));
        points.push(point.x, point.y, point.z);
      }
      for (let i = 0; i < (source.index?.count ?? source.attributes.position.count); i += 3) {
        const ids = [0, 1, 2].map(n => source.index ? source.index.getX(i + n) : i + n), heights = ids.map(id => points[id * 3 + 1]);
        if (Math.max(...heights) >= eye.y - .071 && Math.min(...heights) <= eye.y + .071) triangles.push(...ids);
      }
      face.push({ points, triangles });
    }
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    const columns = 96, rows = 6;
    for (let row = 0; row <= rows; row++) {
      const y = eye.y + (row / rows - .5) * .14, sections: number[][] = [];
      // Slice the actual triangles at this cloth row, then intersect their
      // short 2D segments. This avoids hundreds of full mesh raycasts.
      for (const { points, triangles } of face) for (let i = 0; i < triangles.length; i += 3) {
        const section: number[] = [];
        for (let edge = 0; edge < 3; edge++) {
          const a = triangles[i + edge] * 3, b = triangles[i + (edge + 1) % 3] * 3;
          if ((points[a + 1] <= y && points[b + 1] > y) || (points[b + 1] <= y && points[a + 1] > y)) {
            const t = (y - points[a + 1]) / (points[b + 1] - points[a + 1]);
            section.push(points[a] + (points[b] - points[a]) * t, points[a + 2] + (points[b + 2] - points[a + 2]) * t);
          }
        }
        if (section.length === 4) sections.push(section);
      }
      for (let column = 0; column <= columns; column++) {
        const theta = column / columns * Math.PI * 2, x = Math.sin(theta), z = Math.cos(theta);
        let radius = 0;
        for (const [ax, az, bx, bz] of sections) {
          const dx = bx - ax, dz = bz - az, cross = x * dz - z * dx;
          if (Math.abs(cross) < 1e-9) continue;
          const along = (ax * dz - az * dx) / cross, edge = (ax * z - az * x) / cross;
          if (edge >= 0 && edge <= 1) radius = Math.max(radius, along);
        }
        if (radius === 0) throw new Error('Neo eye band could not find its delivered head surface');
        positions.push(x * (radius + .014), y, z * (radius + .014)); uv.push(column / columns * 3, row / rows);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column, b = a + columns + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const cloth = new THREE.MeshStandardMaterial({ color: 0x292725, roughness: .98, metalness: 0, bumpMap: this.weave, bumpScale: .0015, side: THREE.DoubleSide });
    this.band = new THREE.Mesh(geometry, cloth); this.band.name = 'neo-farewell-eye-band';
    this.band.castShadow = this.band.receiveShadow = true; this.band.visible = false; head.add(this.band);
  }

  garment(mesh: THREE.Mesh, input: MotionInput): 'upper' | 'trousers' | undefined {
    const outfit = input.farewellOutfit ?? input.farewell?.role ?? input.nebCrew;
    if (input.realWorld !== true || (this.role === 'morpheus' ? !input.hammerBriefing : outfit !== this.role && !(this.role === 'trinity' && !outfit))) return;
    const upper = this.role === 'morpheus' ? mesh.userData.hammerBriefingCostume === true
      : this.role === 'neo' ? /Tailored.coat.upper|Black.crew.neck/i.test(mesh.name) : /Fitted.leather.jacket/i.test(mesh.name);
    return upper ? 'upper' : /Tailored.trousers/i.test(mesh.name) ? 'trousers' : undefined;
  }

  update(input: MotionInput): void {
    const outfit = input.farewellOutfit ?? input.farewell?.role ?? input.nebCrew;
    const active = input.realWorld === true && (this.role === 'morpheus' ? Boolean(input.hammerBriefing) : outfit === this.role || this.role === 'trinity' && !outfit);
    if (this.band) this.band.visible = active && Boolean(input.farewellOutfit ?? input.farewell) && !input.firstPerson;
    if (!active) return;
    for (const part of this.rig.wardrobe) {
      if (part.hair) part.mesh.visible = !input.firstPerson;
      if (this.role === 'morpheus') {
        if (part.mesh.userData.hammerBriefingCostume) part.mesh.visible = true;
        else if (/Tailored.coat.upper|Black.crew.neck/i.test(part.mesh.name)) part.mesh.visible = false;
      }
      const garment = this.garment(part.mesh, input);
      if (!garment) continue;
      const upper = garment === 'upper';
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      if (material.map !== null || material.bumpMap !== this.weave) {
        material.map = null; material.bumpMap = this.weave; material.needsUpdate = true;
      }
      const collar = this.role === 'morpheus' && part.mesh.name === 'morpheus-hammer-collar';
      material.bumpScale = upper ? collar ? .002 : .009 : .003;
      material.roughness = .97; material.metalness = 0;
      material.color.setHex(upper ? this.role === 'neo' ? 0x393c3a : this.role === 'morpheus' ? collar ? 0xa7a295 : 0x55343d : 0xa6a59a : 0x333631);
    }
  }

  dispose(): void {
    this.band?.removeFromParent(); this.band?.geometry.dispose(); this.band?.material.dispose(); this.weave.dispose();
  }
}
