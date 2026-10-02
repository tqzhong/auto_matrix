import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { ARREST_CAR, ARREST_BIKE, ARREST_WHEEL, arrestCarPose, arrestCarPoint, arrestDoor, arrestMirrorShot, type OfficeCustody } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** The sedan moves through the existing city; four hinged doors leave a real cabin. */
export class CustodyStreetRenderer {
  private root = new THREE.Group();
  private car = new THREE.Group();
  private bike = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private doors: { hinge: THREE.Group; side: number; rear: boolean }[] = [];
  private wheels: { pivot: THREE.Group; rotor: THREE.Group; front: boolean }[] = [];
  private steering: THREE.Mesh;
  private mirror: Reflector;
  private mirrorFrame = new THREE.Group();
  constructor(parent: THREE.Group) {
    this.root.name = 'office-street-arrest'; parent.add(this.root);
    this.car.name = 'office-arrest-sedan'; this.car.position.set(ARREST_CAR.x, 0, ARREST_CAR.z); this.car.rotation.y = ARREST_CAR.yaw;
    this.bike.name = 'office-arrest-motorcycle'; this.bike.position.set(ARREST_BIKE.x, 0, ARREST_BIKE.z); this.bike.rotation.y = ARREST_BIKE.yaw;
    this.root.add(this.car, this.bike);
    const paint = this.mat(0x0c1013, .22, .7), chrome = this.mat(0x8a9598, .26, .9), rubber = this.mat(0x141719, .83), leather = this.mat(0x232626, .75);
    const glass = this.mat(0x667f84, .12, .15); glass.transparent = true; glass.opacity = .22; glass.depthWrite = false;
    const light = this.mat(0xe7ddd0, .23), red = this.mat(0x7c1d16, .28), black = this.mat(0x172022, .54);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, radius = .05, parent = this.car) => this.box(parent, x, y, z, w, h, d, material, radius);
    box(0, .2, 0, 5.5, .2, 13.6, black).name = 'office-arrest-car-floor';
    box(0, 1.75, -5.17, 5.65, 1.55, 3.35, paint, .2); box(0, 1.78, 5.35, 5.65, 1.55, 3.1, paint, .18);
    box(0, 2.52, -5.22, 5.45, .12, 3.15, paint); box(0, 2.56, 5.34, 5.45, .1, 2.98, paint);
    box(0, 4, -.13, 5.52, .2, 6.72, paint, .09).name = 'office-arrest-car-roof';
    box(0, 3.4, -3.5, 5.2, .9, .075, glass).rotation.x = .25;
    box(0, 3.4, 3.38, 5.2, .9, .075, glass).rotation.x = -.25;
    for (const z of [-3.5, 3.38]) box(0, 3, z, 5.48, .15, .12, chrome);
    for (const side of [-1, 1]) {
      for (const z of [-3.6, -.36, 3.47]) box(side * 2.73, 3.43, z, .14, 1.08, .18, paint);
      box(side * 2.72, .65, 0, .2, .75, 6.85, paint); box(side * 2.85, .57, 0, .16, .15, 7.1, chrome);
      for (const rear of [false, true]) {
        const hinge = new THREE.Group(); hinge.name = `office-arrest-door-${side}-${rear ? 'rear' : 'front'}`;
        hinge.position.set(side * 2.75, 0, rear ? -.27 : -3.46); this.car.add(hinge); this.doors.push({ hinge, side, rear });
        this.box(hinge, 0, 1.89, 1.44, .14, 2.15, 2.96, paint, .07).name = `${hinge.name}-panel`;
        this.box(hinge, -side * .13, 1.87, 1.4, .12, 1.65, 2.78, leather, .04);
        this.box(hinge, 0, 3.43, 1.42, .06, .81, 2.78, glass, .02);
        for (const z of [0, 2.92]) this.box(hinge, 0, 3.43, z, .09, .9, .08, chrome, .02);
        for (const y of [3.01, 3.84]) this.box(hinge, 0, y, 1.45, .08, .07, 2.97, chrome, .02);
        this.box(hinge, side * .1, 2.73, 2.42, .1, .1, .48, chrome, .03);
        this.box(hinge, -side * .2, 2.1, 1.48, .28, .16, 1.45, leather, .06);
      }
      for (const z of [-4.9, 4.8]) {
        const pivot = new THREE.Group(), rotor = new THREE.Group(); pivot.name = `office-arrest-wheel-${side}-${z < 0 ? 'front' : 'rear'}`;
        pivot.position.set(side * 2.59, .98, z); pivot.add(rotor); this.car.add(pivot); this.wheels.push({ pivot, rotor, front: z < 0 });
        this.cylinder(rotor, 0, 0, 0, 1, .54, rubber).rotation.z = Math.PI / 2;
        this.cylinder(rotor, side * .29, 0, 0, .67, .055, black).rotation.z = Math.PI / 2;
        this.cylinder(rotor, side * .33, 0, 0, .24, .06, chrome).rotation.z = Math.PI / 2;
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          this.box(rotor, side * .32, Math.cos(angle) * .35, Math.sin(angle) * .35, .06, .58, .075, chrome, .02).rotation.x = angle;
        }
      }
      box(side * 1.9, 2.13, -6.89, 1.25, .55, .1, light); box(side * 2.08, 2.18, 6.91, .96, .52, .09, red);
      box(side * 2.95, 3.25, -2.85, .55, .34, .62, paint, .09);
      for (const z of [-1.65, 1.7]) {
        box(side * 1.3, 1.4, z, 2.04, .28, 1.55, leather, .1);
        box(side * 1.3, 2.45, z + .9, 2.02, 2.2, .3, leather, .12).rotation.x = -.06;
        box(side * 1.3, 3.58, z + 1, .85, .48, .26, leather, .08);
        for (const offset of [-.56, 0, .56]) box(side * 1.3 + offset, 2.42, z + .71, .025, 1.7, .02, black, .005);
      }
    }
    for (const z of [-6.97, 6.98]) box(0, 1.23, z, 5.75, .32, .23, chrome, .07);
    box(0, 2.1, -6.96, 2.46, .59, .06, chrome); box(0, 2.1, -7, 2.28, .4, .03, black);
    for (let x = -.98; x <= .98; x += .18) box(x, 2.1, -7.02, .04, .41, .025, chrome, .005);
    box(0, 1.73, 7.02, 1.48, .39, .025, light); box(0, 1.71, -7.03, 1.48, .35, .025, light);
    box(0, .91, -.7, .48, 1.15, 4.25, black); box(0, 2.61, -2.96, 5.2, .61, .75, black, .14);
    this.steering = this.mesh(this.car, new THREE.TorusGeometry(ARREST_WHEEL.radius, .045, 10, 32), rubber, ARREST_WHEEL.x, ARREST_WHEEL.y, ARREST_WHEEL.z);
    this.steering.name = 'office-arrest-steering-wheel'; this.steering.rotation.x = ARREST_WHEEL.tilt;
    for (const x of [-.22, .22]) this.box(this.steering, x, 0, 0, .48, .06, .06, chrome).rotation.z = x < 0 ? -.12 : .12;
    box(-1.3, 2.75, -2.76, 1.38, .31, .06, chrome);
    // Separate fairings, saddle, forks and foot pegs leave space for the lookout's actual limbs.
    this.box(this.bike, 0, 1.91, -.84, 1.45, 1.16, 2.4, paint, .23);
    this.box(this.bike, 0, 2.13, -2.2, 1.58, 1.32, .95, paint, .2);
    this.box(this.bike, 0, 2.15, .48, 1.16, .28, 1.9, rubber, .1);
    this.box(this.bike, 0, 1.61, 2.18, 1.42, .85, 1.18, paint, .13);
    this.box(this.bike, 0, 2.1, -2.71, 1.12, .31, .09, light);
    this.box(this.bike, 0, 1.96, 2.81, .83, .21, .08, red);
    this.box(this.bike, 0, 2.94, ARREST_BIKE.handleZ, 2.13, .12, .13, chrome);
    this.box(this.bike, 0, 2.85, -2.12, 1.22, .7, .06, glass).rotation.x = -.3;
    for (const side of [-1, 1]) {
      this.box(this.bike, side * .93, 2.94, ARREST_BIKE.handleZ, .43, .16, .2, rubber);
      this.box(this.bike, side * .98, .99, .5, .59, .13, .22, chrome);
      this.box(this.bike, side * .58, 1.47, -1.84, .12, 1.45, .14, chrome).rotation.x = -.3;
      this.box(this.bike, side * .58, .94, 1.06, .15, .15, 2.25, chrome);
    }
    for (const z of [-2.02, 2.04]) {
      this.cylinder(this.bike, 0, .93, z, .93, .56, rubber).rotation.z = Math.PI / 2;
      for (const side of [-1, 1]) this.cylinder(this.bike, side * .29, .93, z, .61, .03, chrome).rotation.z = Math.PI / 2;
    }
    this.cylinder(this.bike, .85, 1.15, 1.91, .2, 1.92, chrome).rotation.x = Math.PI / 2;
    const mirror = ARREST_BIKE.mirror;
    this.box(this.bike, mirror.x, 2.98, (mirror.z + ARREST_BIKE.handleZ) / 2, .045, .045, Math.abs(mirror.z - ARREST_BIKE.handleZ) + .04, chrome);
    this.box(this.bike, mirror.x, 3.04, mirror.z, .04, .44, .04, chrome);
    this.mirrorFrame.position.set(mirror.x, mirror.y, mirror.z); this.bike.add(this.mirrorFrame);
    this.box(this.mirrorFrame, 0, 0, -.045, 1.07, .66, .065, rubber, .12);
    const geometry = new THREE.PlaneGeometry(.94, .52); this.geometries.add(geometry);
    this.mirror = new Reflector(geometry, { textureWidth: 512, textureHeight: 256, color: 0xabbfc1, clipBias: .004 });
    this.mirror.name = 'office-arrest-rearview'; this.mirrorFrame.add(this.mirror);
    const batches = batchStaticGeometry(this.root, new Set([this.mirror])); batches.forEach(geometry => this.geometries.add(geometry));
    this.update();
  }
  private mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, radius = .04): THREE.Mesh {
    return this.mesh(parent, new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)), material, x, y, z);
  }
  private cylinder(parent: THREE.Group, x: number, y: number, z: number, radius: number, height: number, material: THREE.Material): THREE.Mesh {
    return this.mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 24), material, x, y, z);
  }
  update(custody?: OfficeCustody, subject?: THREE.Object3D): void {
    this.root.visible = Boolean(custody?.lift); this.bike.visible = Boolean(custody?.watcher);
    const car = arrestCarPose(custody?.street);
    this.car.position.set(car.x, 0, car.z); this.car.rotation.y = car.yaw;
    this.steering.rotation.z = car.steering;
    for (const wheel of this.wheels) { wheel.pivot.rotation.y = wheel.front ? car.steering : 0; wheel.rotor.rotation.x = -car.distance; }
    for (const door of this.doors) door.hinge.rotation.y = door.side * arrestDoor(custody?.street, door.side, door.rear) * (door.rear ? 1.3 : 1.54);
    this.mirror.visible = this.bike.visible && arrestMirrorShot(custody?.street);
    if (!this.mirror.visible) return;
    const slot = ARREST_CAR.seats.neo, neo = arrestCarPoint(slot.x, slot.z);
    const world = this.mirror.getWorldPosition(new THREE.Vector3());
    const view = this.bike.localToWorld(new THREE.Vector3(ARREST_BIKE.view.x, ARREST_BIKE.view.y, ARREST_BIKE.view.z));
    const head = subject?.getObjectByName('head'); subject?.updateWorldMatrix(true, true);
    const image = head ? head.localToWorld(new THREE.Vector3(0, .2, .06)) : new THREE.Vector3(neo.x, 3.6, neo.z);
    const normal = view.sub(world).normalize().add(image.sub(world).normalize()).normalize();
    this.mirrorFrame.quaternion.copy(this.bike.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)));
  }
  dispose(): void {
    this.mirror.getRenderTarget().dispose(); (this.mirror.material as THREE.Material).dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.root.removeFromParent();
  }
}
