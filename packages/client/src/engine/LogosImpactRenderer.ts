import * as THREE from 'three';
import { logosCrashTarget, type LogosFlight } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The tower is fixed at the saved contact point; fragments use the same collision clock as the crew. */
export class LogosImpactRenderer {
  private tower = new THREE.Group();
  private plates: THREE.Mesh[] = [];
  private glass = new THREE.Group();
  private pane: THREE.Mesh;
  private shards: THREE.InstancedMesh;
  private sparks: THREE.InstancedMesh;
  private flash = new THREE.PointLight(0xb4dbff, 0, 22, 2);
  private key = new THREE.DirectionalLight(0x9bb9d4, 1.4);
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private matrix = new THREE.Object3D();

  constructor(root: THREE.Group, private ship: THREE.Group) {
    this.tower.name = 'logos-impact-tower'; root.add(this.tower);
    const metal = new THREE.MeshStandardMaterial({ color: 0x29373f, metalness: .76, roughness: .51 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x53616a, metalness: .65, roughness: .43 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x091218, metalness: .4, roughness: .8 });
    const node = new THREE.MeshStandardMaterial({ color: 0x658293, emissive: 0x3d667e, emissiveIntensity: .8 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fb6be, metalness: .2, roughness: .12, transparent: true,
      opacity: .16, side: THREE.DoubleSide, depthWrite: false });
    const broken = glass.clone(); broken.opacity = .27; broken.roughness = .07; broken.metalness = .35;
    const spark = new THREE.MeshBasicMaterial({ color: 0xc9eaff, transparent: true, opacity: .9, depthWrite: false });
    [metal, edge, dark, node, glass, broken, spark].forEach(material => this.materials.add(material));
    const box = (size: number[], point: number[], material: THREE.Material) => {
      const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]); this.geometries.add(geometry);
      const part = new THREE.Mesh(geometry, material); part.position.set(point[0], point[1], point[2]);
      this.tower.add(part); return part;
    };
    // A ribbed tower facade with a hollow breach. No solid wall is left inside the cockpit after impact.
    box([39, 46, 7], [0, 28, -4], metal); box([39, 35, 7], [0, -23, -4], metal);
    for (const side of [-1, 1]) {
      box([13, 12, 7], [side * 13, .5, -4], metal);
      for (let i = 0; i < 7; i++) {
        box([.35, 76, 1.3], [side * (7.2 + i * 1.9), 8, .4 + i % 2 * .2], edge);
        for (let j = 0; j < 8; j++) {
          box([1.5, 1.7, 1.2], [side * (7.2 + i * 1.9), -17 + j * 8, .5], i % 3 ? dark : edge);
          if ((i + j) % 4 === 0) box([.14, .75, .1], [side * (7.2 + i * 1.9), -17 + j * 8, 1.15], node);
        }
      }
    }
    for (const y of [-16, -7, 7, 17, 31]) box([39, .45, 1.6], [0, y, .5], edge);
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const points = Array.from({ length: 13 }, (_, j) => new THREE.Vector3(side * (8 + i * 1.85 + Math.sin(j * .72 + i) * .65),
        -24 + j * 6, 1.8 + Math.cos(j * .58 + i) * .65));
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 42, .18 + i % 3 * .06, 7, false);
      this.geometries.add(geometry); this.tower.add(new THREE.Mesh(geometry, i % 2 ? edge : dark));
      for (let j = 0; j < 5; j++) {
        const ringGeometry = new THREE.TorusGeometry(.68 + i % 2 * .22, .11, 6, 18); this.geometries.add(ringGeometry);
        const ring = new THREE.Mesh(ringGeometry, edge); ring.position.set(side * (8 + i * 1.85), -18 + j * 12, 2);
        this.tower.add(ring);
      }
    }
    box([13, 12, .4], [0, .5, -24], dark);
    for (let i = 0; i < 4; i++) {
      const plate = box([3.25, 10, .35], [-4.875 + i * 3.25, .5, .2], edge);
      plate.name = `logos-impact-plate-${i}`; this.plates.push(plate);
      for (let j = 0; j < 6; j++) box([.7, .2, 8], [i * 3 - 4.5, 4.7, -4 - j * 3], metal);
    }
    batchStaticGeometry(this.tower, new Set(this.plates)).forEach(geometry => this.geometries.add(geometry));
    this.key.position.set(-18, 35, 22); this.key.target.position.set(0, 4, 0); this.tower.add(this.key, this.key.target);
    const paneGeometry = new THREE.PlaneGeometry(6.4, 2.95); this.geometries.add(paneGeometry);
    this.pane = new THREE.Mesh(paneGeometry, glass); this.pane.name = 'logos-impact-windscreen';
    this.pane.position.set(0, 1.65, -9.79); ship.add(this.pane);
    const triangle = new THREE.BufferGeometry();
    triangle.setAttribute('position', new THREE.Float32BufferAttribute([-.12, -.08, 0, .13, -.11, 0, .08, .15, 0,
      -.12, -.08, 0, .08, .15, 0, -.07, .04, 0], 3));
    triangle.computeVertexNormals(); this.geometries.add(triangle);
    this.shards = new THREE.InstancedMesh(triangle, broken, 96); this.shards.frustumCulled = false;
    const ember = new THREE.BoxGeometry(.027, .027, .42); this.geometries.add(ember);
    this.sparks = new THREE.InstancedMesh(ember, spark, 36); this.sparks.frustumCulled = false;
    this.glass.name = 'logos-impact-glass'; this.glass.add(this.shards, this.sparks, this.flash); ship.add(this.glass);
    this.flash.position.set(0, 1.5, -8.9);
    this.update(undefined);
  }

  update(flight: LogosFlight | undefined): void {
    const crash = flight?.crash;
    this.tower.visible = Boolean(crash); this.pane.visible = !crash || crash.elapsed < crash.approach + .08;
    this.glass.visible = Boolean(crash && crash.elapsed >= crash.approach);
    if (!flight || !crash) {
      const nose = this.ship.getObjectByName('logos-lower-nose');
      if (nose) { nose.scale.y = .48; nose.position.z = -9.1; }
      return;
    }
    const target = logosCrashTarget(flight); this.tower.position.set(target.x, target.y, target.z);
    const hit = Math.max(0, crash.elapsed - crash.approach), split = 1 - Math.exp(-hit * 9);
    this.plates.forEach((plate, i) => {
      const side = i < 2 ? -1 : 1;
      plate.position.set(-4.875 + i * 3.25 + side * split * 5.5, .5 - split * (i % 2 ? 2 : -1.6), .2 - split * 6);
      plate.rotation.set(split * side * .4, split * side * 1.1, split * side * .28);
    });
    this.flash.intensity = hit > 0 ? 42 * Math.exp(-hit * 6) : 0;
    for (let i = 0; i < this.shards.count; i++) {
      const t = Math.max(0, hit - .08 - i % 4 * .018), x = -3.1 + (i * 37 % 97) / 96 * 6.2, y = .25 + (i * 61 % 97) / 96 * 2.8;
      this.matrix.position.set(x + Math.sin(i * 2.3) * t * .7, Math.max(-1.03, y + (i % 3 - .6) * t - 2.7 * t * t),
        -9.78 + Math.min(2.05, t * (2.6 + i % 3 * .2)));
      this.matrix.rotation.set(t * (i % 5 - 2) * 3, t * (i % 7 - 3), i * 1.73 + t * 4);
      this.matrix.scale.setScalar(hit > .08 ? .45 + i % 5 * .13 : 0); this.matrix.updateMatrix();
      this.shards.setMatrixAt(i, this.matrix.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.sparks.count; i++) {
      const t = Math.max(0, hit - i % 6 * .018), angle = i * 2.399;
      this.matrix.position.set(Math.cos(angle) * (2 + t * 3.5), 1.2 + Math.sin(angle) * (1 + t * 2) - t * t * 2,
        -10.1 + Math.min(2.2, t * 3.5));
      this.matrix.rotation.set(Math.sin(angle) * .7, Math.cos(angle), angle);
      this.matrix.scale.setScalar(hit > 0 && t < .7 ? 1 - t / .7 : 0); this.matrix.updateMatrix();
      this.sparks.setMatrixAt(i, this.matrix.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    const nose = this.ship.getObjectByName('logos-lower-nose');
    if (nose) { nose.scale.y = .48 * (1 - split * .42); nose.position.z = -9.1 + split * .8; }
  }

  dispose(): void {
    this.tower.removeFromParent(); this.pane.removeFromParent(); this.glass.removeFromParent();
    this.shards.dispose(); this.sparks.dispose(); this.flash.dispose(); this.key.dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
  }
}
