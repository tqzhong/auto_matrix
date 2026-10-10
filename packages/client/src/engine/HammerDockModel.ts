import * as THREE from 'three';
import { DOCK_REUNION } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Damaged Mjolnir exterior. The pad rims retain the shared landing support envelope. */
export class HammerDockModel {
  readonly group = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private profile = [[-17.1, .12], [-16.7, 1.4], [-15.8, 2.6], [-13.3, 3.45], [-9.5, 4.12], [-6, 4.22], [12, 4.22], [16.8, 4.4], [17.02, 4.4]];

  constructor(parent: THREE.Group, metal: THREE.MeshStandardMaterial, iron: THREE.MeshStandardMaterial, power: THREE.Material) {
    this.group.name = 'hammer-dock-airframe'; parent.add(this.group);
    const hull = metal.clone(); hull.color.setHex(0x697071); hull.metalness = .58; hull.roughness = .72;
    const armor = metal.clone(); armor.color.setHex(0x89908a); armor.metalness = .65; armor.roughness = .64;
    const edge = iron.clone(); edge.color.setHex(0x313b3e); edge.roughness = .64;
    const rubber = new THREE.MeshStandardMaterial({ color: 0x111819, roughness: .91, metalness: .12 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x14282e, roughness: .19, metalness: .5 });
    const scorch = new THREE.MeshStandardMaterial({ color: 0x20211f, roughness: .98, metalness: .06 });
    for (const material of [hull, armor, edge, rubber, glass, scorch]) this.materials.add(material);
    const pressureHull = this.mesh(this.skin(-17.1, 17.02, 0, Math.PI * 2, 0, 64, 42), hull);
    pressureHull.name = 'hammer-pressure-hull';
    for (let row = 0; row < 7; row++) for (let sector = 0; sector < 12; sector++) {
      const z = -12.8 + row * 4.05, angle = sector * Math.PI / 6;
      this.mesh(this.skin(z, Math.min(16.7, z + 3.85), angle + .012, angle + Math.PI / 6 - .012, .055, 5, 3), (row + sector) % 3 ? hull : armor);
      if (sector < 6 && row > 0) for (const end of [.08, 3.75]) {
        const point = this.point(z + end, angle + .045, .095);
        const rivet = this.mesh(new THREE.SphereGeometry(.052, 6, 4), armor); rivet.position.copy(point);
      }
    }
    for (const angle of [.25, .74, 1.14, 2, 2.4, 2.88, 3.8, 5.6]) {
      this.pipe(this.profile.slice(2, -1).map(([z]) => this.point(z, angle, .10)), .045, edge);
    }
    for (const z of [-10, -5.9, -1.85, 2.2, 6.25, 10.3, 14.35]) {
      this.pipe(Array.from({ length: 49 }, (_, i) => this.point(z, i * Math.PI / 24, .09)), .045, armor);
    }
    // Separate inset windows follow the rounded bow instead of a flat cylinder cap.
    for (let pane = 0; pane < 5; pane++) {
      const angle = .55 + pane * .4;
      this.mesh(this.skin(-14.35, -11.35, angle, angle + .34, .082, 5, 5), edge);
      this.mesh(this.skin(-14.2, -11.5, angle + .025, angle + .315, .089, 5, 5), glass);
    }
    for (const side of [-1, 1]) {
      // Open longitudinal trusses: upper/lower rails and diagonal braces, not solid side boxes.
      for (const x of [side * 4.25, side * 7.15]) for (const y of [-1.4, 1.4])
        this.box(edge, x, y, -1, .1, .2, 26);
      for (const z of [-13, -7, -1, 5, 11]) {
        this.pipe([new THREE.Vector3(side * 4.25, -1.4, z), new THREE.Vector3(side * 7.15, 1.4, z)], .075, armor);
        this.pipe([new THREE.Vector3(side * 4.25, 1.4, z), new THREE.Vector3(side * 7.15, -1.4, z)], .075, armor);
        this.pipe([new THREE.Vector3(side * 3.8, .4, z - .8), new THREE.Vector3(side * 4.7, .7, z - .9), new THREE.Vector3(side * 5.8, -.4, z)], .13, rubber);
        const pad = new THREE.Group(); pad.name = 'hammer-dock-hover-pad'; pad.position.set(side * 5.8, -.4, z); this.group.add(pad);
        const rim = this.mesh(new THREE.TorusGeometry(1.55, .37, 8, 18), armor, pad); rim.rotation.x = Math.PI / 2;
        const body = this.mesh(new THREE.CylinderGeometry(1.35, 1.35, .4, 32), edge, pad);
        const face = this.mesh(new THREE.CircleGeometry(1.25, 32), rubber, pad); face.position.y = -.205; face.rotation.x = Math.PI / 2;
        for (const radius of [.28, .55, .82, 1.1]) {
          const coil = this.mesh(new THREE.TorusGeometry(radius, .035, 6, 32), power, pad); coil.position.y = -.23; coil.rotation.x = Math.PI / 2;
        }
        for (let tooth = 0; tooth < 12; tooth++) {
          const a = tooth * Math.PI / 6, clamp = this.box(edge, Math.cos(a) * 1.25, .18, Math.sin(a) * 1.25, .16, .11, .3, pad); clamp.rotation.y = -a;
        }
        body.receiveShadow = true;
      }
      for (const z of [-9, -4, 1, 6, 11]) {
        const angle = side > 0 ? .38 : Math.PI - .38;
        this.mesh(this.skin(z, z + 2.6, angle - .14, angle + .14, .105, 4, 2), edge);
        for (let fin = 0; fin < 7; fin++) this.pipe([this.point(z + .15 + fin * .36, angle - .11, .15), this.point(z + .15 + fin * .36, angle + .11, .15)], .035, armor);
      }
    }
    // Blackened plates and bent service pipes remain after the tunnel attack and EMP.
    for (const [z, angle, length] of [[-7.8, .9, 2.9], [2.8, 2.1, 3.8], [8.6, .3, 2.4]]) {
      this.mesh(this.skin(z, z + length, angle, angle + .35, .12, 6, 3), scorch);
      this.pipe([this.point(z, angle + .18, .16), this.point(z + length * .5, angle + .26, .18), this.point(z + length, angle + .2, .15)], .075, rubber);
    }
    const rear = new THREE.Shape(); rear.absarc(0, 0, 4.4, 0, Math.PI * 2, false);
    const opening = new THREE.Path(); opening.absarc(0, 0, DOCK_REUNION.hatch.radius, 0, Math.PI * 2, true); rear.holes.push(opening);
    const rim = this.mesh(new THREE.ShapeGeometry(rear, 32), armor); rim.position.z = 17.02;
    for (const side of [-1, 1]) this.box(edge, side * 3.45, 0, 15.7, .35, 4.7, 2.5);
    batchStaticGeometry(this.group, new Set()).forEach(geometry => this.geometries.add(geometry));
  }

  private point(z: number, angle: number, offset: number): THREE.Vector3 {
    let radius = this.profile[0][1];
    for (let i = 1; i < this.profile.length; i++) {
      const [end, r] = this.profile[i], [start, previous] = this.profile[i - 1];
      if (z > end) { radius = r; continue; }
      radius = THREE.MathUtils.lerp(previous, r, Math.max(0, (z - start) / (end - start))); break;
    }
    return new THREE.Vector3(Math.cos(angle) * (radius + offset), Math.sin(angle) * (radius + offset), z);
  }
  private skin(start: number, end: number, from: number, to: number, offset: number, sides: number, rows: number): THREE.BufferGeometry {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for (let row = 0; row <= rows; row++) for (let side = 0; side <= sides; side++) {
      const z = THREE.MathUtils.lerp(start, end, row / rows), angle = THREE.MathUtils.lerp(from, to, side / sides);
      positions.push(...this.point(z, angle, offset).toArray()); uv.push(angle * 1.5, z * .22);
    }
    for (let row = 0; row < rows; row++) for (let side = 0; side < sides; side++) {
      const a = row * (sides + 1) + side, b = a + 1, c = a + sides + 1, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.group): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = this.mesh(new THREE.BoxGeometry(w, h, d), material, parent); mesh.position.set(x, y, z); return mesh;
  }
  private pipe(points: THREE.Vector3[], radius: number, material: THREE.Material): void {
    this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(1, points.length - 1) * 3, radius, 6, false), material);
  }
  dispose(): void { this.group.removeFromParent(); this.group.clear(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); }
}
