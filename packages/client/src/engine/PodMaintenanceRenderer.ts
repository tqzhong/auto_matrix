import * as THREE from 'three';
import type { AwakeningBeat } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The pod inspector faces Neo; its limbs and retreat use the saved unplugging clock. */
export class PodMaintenanceRenderer {
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Map<'map' | 'normalMap' | 'roughnessMap', THREE.Texture>();
  private bars: THREE.InstancedMesh;
  private joints: THREE.InstancedMesh;
  private claws: { root: THREE.Group; fingers: THREE.Mesh[]; side: number }[] = [];
  private dummy = new THREE.Object3D();
  private disposed = false;

  constructor(private root: THREE.Group) {
    root.name = 'pod-maintenance-machine'; root.visible = false;
    const steel = this.metal(0x728184, .43), dark = this.metal(0x273235, .57);
    const hood = new THREE.MeshPhysicalMaterial({ color: 0x516d77, roughness: .44, metalness: .62, clearcoat: .45,
      map: steel.map, normalMap: steel.normalMap, roughnessMap: steel.roughnessMap }); hood.normalScale.set(.12, .12); this.materials.add(hood);
    const lens = new THREE.MeshPhysicalMaterial({ color: 0x19171a, emissive: 0x44050e, emissiveIntensity: .14, roughness: .15, metalness: .4, clearcoat: 1 }); this.materials.add(lens);
    const iris = new THREE.MeshBasicMaterial({ color: 0xd52930, toneMapped: false }); this.materials.add(iris);
    const housing = new THREE.Group(); housing.name = 'pod-maintenance-housing'; root.add(housing);
    this.mesh(new THREE.SphereGeometry(1, 28, 18), dark, 0, -.18, -.12, housing).scale.set(1.08, .66, 1.85);
    this.mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hood, 0, .1, -.12, housing).scale.set(1.02, .65, 1.75);
    const seam = this.mesh(new THREE.TorusGeometry(1, .035, 6, 40), steel, 0, .1, -.12, housing);
    seam.rotation.x = Math.PI / 2; seam.scale.set(1.05, 1.8, 1);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const z = -1.55 + i * .28, width = Math.sqrt(1 - ((z + .12) / 1.85) ** 2);
        this.tube([[side * width * .98, -.35, z], [side * width * 1.11, -.02, z], [side * width * .88, .4, z]], .055, steel, housing);
      }
      for (const y of [-.55, -.31]) this.tube([[side * .28, y, 1.48], [side * .68, y - .02, 1.1], [side * 1.02, y + .1, .2]], .047, steel, housing);
      for (let i = 0; i < 4; i++) this.mesh(new THREE.CylinderGeometry(.075, .075, .18, 10), steel, side * .78, -.37, -.75 + i * .37, housing).rotation.z = Math.PI / 2;
    }
    const optics = new THREE.Group(); optics.name = 'pod-maintenance-optics'; housing.add(optics);
    for (const [i, [x, y, z, radius]] of [[0, -.18, 1.69, .2], [-.45, -.49, 1.52, .15], [.45, -.49, 1.52, .15],
      [-.86, -.23, 1.09, .14], [.86, -.23, 1.09, .14], [-.23, -.73, 1.18, .105], [.23, -.73, 1.18, .105]].entries()) {
      const sensor = new THREE.Object3D(); sensor.name = `pod-maintenance-sensor-${i}`; sensor.position.set(x, y, z + radius * .28); optics.add(sensor);
      this.mesh(new THREE.TorusGeometry(radius, .035, 6, 20), steel, x, y, z, optics);
      const barrel = this.mesh(new THREE.CylinderGeometry(radius + .038, radius + .06, .14, 16), dark, x, y, z - .07, optics); barrel.rotation.x = Math.PI / 2;
      this.mesh(new THREE.SphereGeometry(radius * .92, 16, 10), lens, x, y, z, optics).scale.z = .32;
      this.mesh(new THREE.SphereGeometry(radius * .3, 12, 8), iris, x, y, z + radius * .27, optics).scale.z = .18;
    }
    const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .35, -1.4), new THREE.Vector3(0, .55, -2.2),
      new THREE.Vector3(.45, .8, -3.1), new THREE.Vector3(.8, 1.35, -4.15)]);
    this.mesh(new THREE.TubeGeometry(tail, 32, .26, 10), dark, 0, 0, 0);
    for (let i = 0; i < 23; i++) {
      const t = i / 22, point = tail.getPoint(t), direction = tail.getTangent(t);
      const rib = this.mesh(new THREE.TorusGeometry(.29 - .11 * t, .045, 6, 16), steel, point.x, point.y, point.z);
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    }
    for (const side of [-1, 1]) for (const height of [0, .2]) this.tube([[side * .8, height, -1], [side * .65, .35 + height, -2.2],
      [side * 1.3, 1.05 + height, -3.6], [side * 1.4, .8 + height, -5.3]], .07, dark, root);
    this.bars = this.instances(new THREE.CylinderGeometry(.055, .075, 1, 10), steel, 12);
    this.joints = this.instances(new THREE.SphereGeometry(.15, 12, 8), dark, 4);
    this.bars.name = 'pod-maintenance-outboard-bars'; this.joints.name = 'pod-maintenance-outboard-joints';
    const finger = new THREE.Shape(); finger.moveTo(-.08, 0); finger.bezierCurveTo(-.1, .25, .08, .5, .12, .61);
    finger.bezierCurveTo(.08, .75, -.08, .9, -.18, .95); finger.bezierCurveTo(-.02, .84, .16, .78, .21, .63);
    finger.bezierCurveTo(.2, .36, .09, .17, .08, 0); finger.closePath();
    const fingerGeometry = new THREE.ExtrudeGeometry(finger, { depth: .06, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .018, bevelThickness: .015, curveSegments: 8 });
    for (const side of [-1, 1]) {
      const claw = new THREE.Group(); claw.name = `pod-maintenance-outboard-claw-${side}`; root.add(claw);
      const fingers = [-1, 0, 1].map(branch => {
        const mesh = this.mesh(fingerGeometry, steel, 0, 0, branch * .11, claw); mesh.name = `pod-maintenance-finger-${side}-${branch}`; return mesh;
      });
      this.claws.push({ root: claw, fingers, side });
    }
    batchStaticGeometry(root, new Set()).forEach(geometry => this.geometries.add(geometry));
  }

  private metal(color: number, roughness: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: .72 }); this.materials.add(material);
    if (typeof document === 'undefined') return material;
    for (const [suffix, slot] of [['color', 'map'], ['normal', 'normalMap'], ['roughness', 'roughnessMap']] as const) {
      let texture = this.textures.get(slot);
      if (!texture) {
        texture = new THREE.TextureLoader().load(`/assets/film-materials/metal_plate-${suffix}.jpg`, value => { if (this.disposed) value.dispose(); });
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1.3, 1.3);
        if (slot === 'map') texture.colorSpace = THREE.SRGBColorSpace;
        this.textures.set(slot, texture);
      }
      material[slot] = texture;
    }
    material.normalScale.set(.22, .22); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = this.root): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private tube(points: number[][], radius: number, material: THREE.Material, parent = this.root): void {
    this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point as [number, number, number]))), 18, radius, 6), material, 0, 0, 0, parent);
  }
  private instances(geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
    this.geometries.add(geometry); const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true;
    this.root.add(mesh); return mesh;
  }

  update(beat: AwakeningBeat | undefined, eye: THREE.Vector3): void {
    this.root.visible = beat?.kind === 'disconnect' && beat.elapsed < 6;
    if (!this.root.visible) return;
    const elapsed = beat!.elapsed, approach = THREE.MathUtils.smoothstep(elapsed, .08, 1.65), retreat = THREE.MathUtils.smoothstep(elapsed, 3.8, 5.9);
    this.root.position.set(-7 + 5.6 * approach - 6 * retreat, 9.3 - 4.4 * approach + 4 * retreat, -5 - 4.6 * approach + 6 * retreat);
    this.root.parent!.updateWorldMatrix(true, false); this.root.lookAt(this.root.parent!.localToWorld(eye.clone()));
    const grip = THREE.MathUtils.smoothstep(elapsed, .8, 1.8) * (1 - THREE.MathUtils.smoothstep(elapsed, 3.55, 4.2));
    let bar = 0, joint = 0;
    for (const claw of this.claws) {
      const side = claw.side, nodes = [new THREE.Vector3(side, -.2, -.3), new THREE.Vector3(side * 2.15, .65, .4),
        new THREE.Vector3(side * 2.45, .15 - .25 * grip, 1.45), new THREE.Vector3(side * (2.1 - .28 * grip), -.36 - .2 * grip, 2.2)];
      for (let i = 0; i < 3; i++) {
        const from = nodes[i], to = nodes[i + 1], delta = to.clone().sub(from);
        this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
        this.dummy.scale.set(1, delta.length(), 1);
        for (const rail of [-1, 1]) {
          this.dummy.position.copy(from).add(to).multiplyScalar(.5).add(new THREE.Vector3(rail * .1, 0, 0).applyQuaternion(this.dummy.quaternion));
          this.dummy.updateMatrix(); this.bars.setMatrixAt(bar++, this.dummy.matrix);
        }
        if (i < 2) { this.dummy.position.copy(to); this.dummy.quaternion.identity(); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.joints.setMatrixAt(joint++, this.dummy.matrix); }
      }
      claw.root.position.copy(nodes[3]); claw.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nodes[3].clone().sub(nodes[2]).normalize());
      claw.fingers.forEach((finger, i) => { finger.rotation.y = (i - 1) * (.92 - .64 * grip); finger.rotation.z = side * (.12 + .2 * grip); });
    }
    this.bars.instanceMatrix.needsUpdate = this.joints.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.disposed = true; this.root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.root.removeFromParent(); this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose());
  }
}
