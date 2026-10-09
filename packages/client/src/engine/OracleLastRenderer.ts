import * as THREE from 'three';
import { ORACLE_LAST, oracleLastBowl, type OracleLast } from '@auto_matrix/shared';

/** Kitchen props follow the same saved clock as the people carrying them. */
export class OracleLastRenderer {
  readonly root = new THREE.Group();
  readonly bowl = new THREE.Group();
  private water: THREE.Mesh;
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  constructor(parent: THREE.Group) {
    this.root.name = 'oracle-last-kitchen'; parent.add(this.root);
    const steel = this.mat(0x9aada6, .3, .72), enamel = this.mat(0xe2ddbf, .47), dough = this.mat(0xcbae79, .95);
    this.bowl.name = 'sati-cookie-bowl'; this.root.add(this.bowl);
    const profile = [[0, .02], [.22, .02], [.29, .065], [.38, .17], [.44, .32], [.445, .36], [.425, .37], [.405, .32], [.35, .18], [.25, .07], [0, .07]].map(([r, y]) => new THREE.Vector2(r, y));
    this.mesh(new THREE.LatheGeometry(profile, 48), enamel, this.bowl);
    const rim = this.mesh(new THREE.TorusGeometry(.43, .017, 8, 48), steel, this.bowl); rim.position.y = .35; rim.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const handle = this.mesh(new THREE.TorusGeometry(.085, .02, 8, 20), steel, this.bowl);
      handle.position.set(side * .455, .28, 0); handle.rotation.y = Math.PI / 2;
    }
    for (let i = 0; i < 7; i++) {
      const lump = this.mesh(new THREE.SphereGeometry(.115, 12, 8), dough, this.bowl);
      lump.scale.set(1, .55, 1); lump.position.set(Math.cos(i * 2.4) * .2, .17 + i % 2 * .035, Math.sin(i * 2.4) * .2);
    }
    const basin = this.mesh(new THREE.LatheGeometry([[0, 0], [.40, 0], [.60, .06], [.73, .20], [.73, .24], [.69, .24], [.55, .09], [0, .09]].map(([r, y]) => new THREE.Vector2(r, y)), 40), steel);
    basin.position.set(ORACLE_LAST.wash.x, 2.44, -26.8); basin.scale.z = .75; basin.name = 'oracle-handwash-basin';
    const tap = new THREE.CatmullRomCurve3([[-1.5, 2.5, -27.38], [-1.5, 3.17, -27.38], [-1.5, 3.35, -27.12], [-1.5, 3.31, -26.8], [-1.5, 3.15, -26.68]].map(point => new THREE.Vector3(...point as [number, number, number])));
    this.mesh(new THREE.TubeGeometry(tap, 24, .045, 8, false), steel);
    const waterMaterial = new THREE.MeshStandardMaterial({ color: 0xa8d2cd, transparent: true, opacity: .45, roughness: .12, depthWrite: false }); this.materials.add(waterMaterial);
    this.water = this.mesh(new THREE.CylinderGeometry(.022, .028, .4, 8), waterMaterial);
    this.water.position.set(-1.5, 2.93, -26.68); this.water.name = 'oracle-running-water'; this.water.visible = false;
    const ash = this.mesh(new THREE.TorusGeometry(.16, .037, 8, 24), steel); ash.position.set(-6.8, 2.12, -20); ash.rotation.x = Math.PI / 2;
    const radio = this.mesh(new THREE.BoxGeometry(1.35, .7, .45), this.mat(0x514b39, .8)); radio.position.set(3.2, 2.85, -27.6);
    const speaker = this.mesh(new THREE.BoxGeometry(.62, .40, .02), this.mat(0x171d19, 1)); speaker.position.set(2.93, 2.87, -27.36);
    for (const x of [3.52, 3.69]) { const dial = this.mesh(new THREE.CylinderGeometry(.06, .06, .04, 12), steel); dial.rotation.x = Math.PI / 2; dial.position.set(x, 2.77, -27.32); }
    for (let i = 0; i < 2; i++) { const book = this.mesh(new THREE.BoxGeometry(1.15, .17, 1.3), this.mat(i ? 0x9c923b : 0x69764a, .95)); book.position.set(9, 5.01 + i * .18, -25.5); }
    this.update(undefined);
  }
  private mat(color: number, roughness: number, metalness = 0) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material; }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = this.root) {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  update(state?: OracleLast): void {
    const pose = state ? oracleLastBowl(state) : { ...ORACLE_LAST.bowl, yaw: Math.PI / 2 };
    this.bowl.position.set(pose.x, pose.y, pose.z); this.bowl.rotation.y = pose.yaw;
    this.water.visible = Boolean(state && state.arrival >= 8.8 && state.arrival < 12.8);
  }
  dispose(): void { this.root.removeFromParent(); this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); }
}
