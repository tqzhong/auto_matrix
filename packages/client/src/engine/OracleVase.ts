import * as THREE from 'three';

export class OracleVase {
  private intact = new THREE.Group();
  private shards: { mesh: THREE.Mesh; direction: THREE.Vector3; spin: THREE.Vector3 }[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private ceramic = new THREE.MeshStandardMaterial({ color: 0xb99c6e, roughness: .33, side: THREE.DoubleSide });
  private green = new THREE.MeshStandardMaterial({ color: 0x547640, roughness: .95 });
  private flower = new THREE.MeshStandardMaterial({ color: 0xc1a450, roughness: .8 });
  private petals = new THREE.Group();
  constructor(private parent: THREE.Group) {
    const profile = [[.21, 0], [.25, .06], [.39, .25], [.46, .53], [.39, .78], [.22, .96], [.22, 1.08], [.25, 1.12]].map(([x, y]) => new THREE.Vector2(x, y));
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, group: THREE.Group): THREE.Mesh => {
      this.geometries.push(geometry); const object = new THREE.Mesh(geometry, material); object.castShadow = object.receiveShadow = true; group.add(object); return object;
    };
    mesh(new THREE.LatheGeometry(profile, 48), this.ceramic, this.intact);
    for (let i = 0; i < 6; i++) {
      const tip = new THREE.Vector3(Math.sin(i * 2.4) * .6, 1.9 + i % 2 * .25, Math.cos(i * 2.4) * .45);
      const stem = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .7, 0), tip.clone().multiplyScalar(.6).add(new THREE.Vector3(0, .3, 0)), tip]);
      mesh(new THREE.TubeGeometry(stem, 8, .02, 5), this.green, this.petals);
      for (let petal = 0; petal < 5; petal++) {
        const p = mesh(new THREE.SphereGeometry(.15, 8, 6), this.flower, this.petals);
        p.scale.set(1, .28, .6); p.position.copy(tip).add(new THREE.Vector3(Math.cos(petal * 1.26) * .13, 0, Math.sin(petal * 1.26) * .13));
        p.rotation.y = -petal * 1.26;
      }
    }
    this.intact.add(this.petals); this.intact.position.set(8, 1.95, -11.75); parent.add(this.intact);
    this.intact.userData.dynamic = true;
    for (let band = 0; band < 3; band++) for (let i = 0; i < 12; i++) {
      const start = band * 2; const fragment = mesh(new THREE.LatheGeometry(profile.slice(start, start + 4), 4, i * Math.PI / 6, Math.PI / 6 - .02), this.ceramic, parent);
      fragment.geometry.translate(0, -profile[start + 1].y, 0); fragment.userData.dynamic = true; fragment.visible = false;
      const angle = i * 2.4 + band; this.shards.push({ mesh: fragment, direction: new THREE.Vector3(Math.cos(angle) * (1.1 + band * .25), 1.8 + i % 3 * .35, Math.sin(angle) * (1 + band * .25)), spin: new THREE.Vector3(i * .7, band + i, i * .4) });
    }
  }
  update(elapsed: number | undefined): void {
    const t = elapsed ?? 0; const tilt = THREE.MathUtils.clamp((t - 1.2) / .4, 0, 1);
    const falling = Math.max(0, t - 1.6); const broken = t >= 2.02;
    this.intact.visible = !broken; this.intact.position.set(8 - tilt * .2 - falling * 2, Math.max(.15, 1.95 - falling * falling * 12), -11.75 + tilt * .15);
    this.intact.rotation.z = tilt * .9 + falling * 3;
    const time = Math.max(0, t - 2.02);
    for (const { mesh, direction, spin } of this.shards) {
      mesh.visible = broken;
      const settled = Math.min(time, .5); const spread = 1 - Math.exp(-time * 3);
      mesh.position.set(6.95 + direction.x * spread, Math.max(.08, .4 + direction.y * settled - 12 * settled * settled), -11.55 + direction.z * spread);
      mesh.rotation.set(spin.x * spread + Math.PI / 2, spin.y * spread, spin.z * spread);
    }
    if (broken) {
      if (this.petals.parent === this.intact) this.parent.add(this.petals);
      this.petals.position.set(6.8, .14, -11.45); this.petals.rotation.z = Math.PI / 2;
    } else if (this.petals.parent !== this.intact) { this.intact.add(this.petals); this.petals.position.set(0, 0, 0); this.petals.rotation.set(0, 0, 0); }
    this.petals.userData.dynamic = true;
  }
  dispose(): void {
    this.intact.removeFromParent(); this.petals.removeFromParent(); this.shards.forEach(s => s.mesh.removeFromParent());
    this.geometries.forEach(g => g.dispose()); this.ceramic.dispose(); this.green.dispose(); this.flower.dispose();
  }
}
