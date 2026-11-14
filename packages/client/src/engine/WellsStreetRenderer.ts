import * as THREE from 'three';
import {
  OPENING_PHONE, WELLS_AFTERMATH, WELLS_CURB, WELLS_CURBSIDE, WELLS_STREET, WELLS_TRUCK, streetLamps, wellsTruckLift, wellsWheelLift,
  type FilmSet, type openingTruckPose,
} from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';
import { UrbanMaterials } from './UrbanMaterials.js';

const headlampIntensity = 240;

/** Local street scenery and a truck driven by the saved Wells encounter. */
export class WellsStreetRenderer {
  private root = new THREE.Group();
  private street = new THREE.Group();
  private curbside = new THREE.Group();
  private truck = new THREE.Group();
  private driverDoor = new THREE.Group();
  private wheels: THREE.Group[] = [];
  private headlamps: THREE.SpotLight[] = [];
  private urban = new UrbanMaterials();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private textures = new Set<THREE.Texture>();
  private lights: (THREE.PointLight | THREE.SpotLight)[] = [];
  private construction?: Generator<void>;

  constructor(parent: THREE.Group, private set: FilmSet, staged = false, asphalt?: THREE.MeshStandardMaterial, pavement?: THREE.MeshStandardMaterial) {
    // The enclosing film set must leave this renderer's resource batches intact.
    this.root.userData.dynamic = true;
    this.truck.name = 'opening-garbage-truck';
    this.street.add(this.curbside); this.root.add(this.street, this.truck); parent.add(this.root);
    this.construction = this.build(asphalt, pavement);
    if (!staged) while (!this.prepareStep()) { /* Finish the set on direct entry. */ }
  }

  prepareStep(): boolean {
    if (this.construction && !this.construction.next().done) return false;
    this.construction = undefined;
    return true;
  }

  private *build(asphalt?: THREE.MeshStandardMaterial, pavement?: THREE.MeshStandardMaterial): Generator<void> {
    this.buildStreet(this.set.width, this.set.depth, asphalt, pavement);
    yield;
    this.buildTruck();
    yield;
    const fixed = new Set<THREE.Mesh>();
    for (const geometry of batchStaticGeometry(this.street, fixed)) this.geometries.add(geometry);
    yield;
    for (const wheel of this.wheels)
      for (const geometry of batchStaticGeometry(wheel, fixed)) this.geometries.add(geometry);
    const live = new Set<THREE.BufferGeometry>();
    this.root.traverse(object => { if (object instanceof THREE.Mesh) live.add(object.geometry); });
    for (const geometry of this.geometries) if (!live.has(geometry)) { geometry.dispose(); this.geometries.delete(geometry); }
  }

  update(pose: ReturnType<typeof openingTruckPose>, doorAngle = 0): void {
    this.curbside.visible = pose.curbside === true;
    const lift = wellsTruckLift(pose);
    this.truck.position.set(pose.x, lift, pose.z); this.truck.rotation.y = pose.yaw;
    this.driverDoor.rotation.y = doorAngle;
    // Let the light sweep with the cab, then leave a lower pool on the wreck.
    const settled = 1 - THREE.MathUtils.smoothstep(pose.z, WELLS_CURB.edgeZ - 2.5, WELLS_CURB.edgeZ + .5);
    for (const lamp of this.headlamps) lamp.intensity = THREE.MathUtils.lerp(headlampIntensity, 105, settled);
    const travel = Math.hypot(pose.x - 15, pose.z - 4);
    const sin = Math.sin(pose.yaw), cos = Math.cos(pose.yaw);
    for (const wheel of this.wheels) {
      const x = pose.x + cos * wheel.position.x + sin * wheel.position.z, z = pose.z - sin * wheel.position.x + cos * wheel.position.z;
      wheel.position.y = 1 + wellsWheelLift(this.set.width, x, z, pose.curbside) - lift;
      wheel.rotation.x = -travel;
    }
  }

  private buildStreet(width: number, depth: number, asphalt?: THREE.MeshStandardMaterial, pavement?: THREE.MeshStandardMaterial): void {
    const halfWidth = width / 2, halfDepth = depth / 2, span = depth + 120;
    const curbWidth = .44, pavingWidth = width * WELLS_STREET.sidewalkWidth - curbWidth, walkwayLength = depth + 78;
    const road = this.urban.surface('asphalt_02', width + 34, span, 8, asphalt);
    const concrete = this.urban.surface('concrete_pavement_03', pavingWidth, walkwayLength, 6, pavement);
    this.urban.setWet(true);
    road.color.setHex(0x647670); road.normalScale.setScalar(.36); road.clearcoat = .28; road.clearcoatRoughness = .38;
    concrete.color.setHex(0x8c9281); concrete.clearcoat = .13;
    this.materials.add(road); this.materials.add(concrete);
    this.box(this.street, road, 0, -.24, 18, width + 34, .48, span).name = 'wells-asphalt';
    const curb = this.standard(0x77796b, .88), gutter = this.standard(0x252c29, .8);
    const iron = this.standard(0x222a25, .71, .45), trim = this.standard(0x596052, .88), paint = this.standard(0x929079, .84);
    const windowGlass = this.standard(0x1b2823, .44, .16), litWindow = this.standard(0x727b5a, .58);
    litWindow.emissive.setHex(0x78815d); litWindow.emissiveIntensity = .12;
    const { sidewalkOffset, sidewalkWidth, sidewalkY, sidewalkHeight, poleHeight, poleRadius } = WELLS_STREET;
    const innerCurb = width * (sidewalkOffset - sidewalkWidth / 2);
    for (const side of [-1, 1]) {
      this.box(this.street, concrete, side * (width * sidewalkOffset + curbWidth / 2), sidewalkY, 7, pavingWidth, sidewalkHeight, walkwayLength);
      this.box(this.street, curb, side * (innerCurb + curbWidth / 2), sidewalkY, 7, curbWidth, sidewalkHeight, walkwayLength);
      this.box(this.street, gutter, side * (innerCurb - .36), .009, 7, .72, .018, walkwayLength);
      for (const z of [-37, -7, 22, 48]) {
        this.box(this.street, iron, side * (innerCurb - .5), .023, z, .64, .028, 1.34);
        for (let i = 0; i < 6; i++) this.box(this.street, gutter, side * (innerCurb - .5), .04, z - .5 + i * .2, .61, .016, .065);
      }
    }
    for (const x of [-6.4, 6.4]) for (let z = -halfDepth - 12; z < halfDepth + 68; z += 11) {
      if (Math.abs(z - OPENING_PHONE.boothZ) <= 7) continue;
      const bend = Math.max(0, z - halfDepth - 22);
      this.box(this.street, paint, x + .011 * bend * bend, .015, z, .12, .021, 4.6).rotation.y = Math.atan(.022 * bend);
    }

    const brick = this.brickMaterial();
    const { sidewalk, wall } = WELLS_CURBSIDE;
    const slab = this.box(this.curbside, concrete, sidewalk.x, sidewalk.y, sidewalk.z, sidewalk.width, sidewalk.height, sidewalk.depth);
    slab.name = 'wells-booth-sidewalk';
    const uv = slab.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sidewalk.width / pavingWidth, uv.getY(i) * sidewalk.depth / walkwayLength);
    this.masonry(new THREE.BoxGeometry(wall.width, wall.height, wall.depth), brick, wall.x, wall.y, wall.z, this.curbside).name = 'wells-booth-wall';
    // The lower service block follows the curb. Recessed bays and upper
    // warehouses continue into the railway cutting beyond the playable street.
    for (const side of [-1, 1]) {
      const face = side * (halfWidth + .28);
      const first = -halfDepth - 34, last = halfDepth + 56;
      const segments = side > 0 ? [[first, -5.5], [13.5, last]] : [[first, last]];
      for (const [from, to] of segments) {
        const z = (from + to) / 2, length = to - from;
        this.masonry(new THREE.BoxGeometry(8, 14.6, length), brick, face + side * 4, 7.3, z);
        this.box(this.street, trim, face, .62, z, .48, 1.24, length);
        this.box(this.street, trim, face, 8.1, z, .45, .36, length);
      }
      for (let z = -halfDepth + 8, bay = 0; z < halfDepth + 50; z += 16, bay++) {
        if (side > 0 && z > -10 && z < 21) continue;
        this.box(this.street, trim, face, 4.1, z - 7.3, .65, 8.2, .56);
        this.box(this.street, iron, face - side * .09, 3.6, z, .2, 6.1, bay % 3 === 1 ? 7.5 : 4.7);
        for (const dz of [-1.55, 1.55]) {
          this.box(this.street, bay % 4 === 1 ? litWindow : windowGlass, face - side * .09, 11.5, z + dz, .18, 2.8, 2.35);
          this.box(this.street, trim, face, 10, z + dz, .42, .26, 2.62);
        }
        if (bay % 3 === 0) {
          const height = 12 + bay % 4 * 2;
          this.masonry(new THREE.BoxGeometry(12, height, 27), brick, face + side * 9.8, 14.6 + height / 2, z + 6);
        }
      }
    }
    // A loading lane accommodates the rear of the truck before it turns.
    this.masonry(new THREE.BoxGeometry(8, 6.6, 19), brick, halfWidth + 4.28, 12.2, 4);
    this.box(this.street, trim, halfWidth + .28, 8.92, 4, .56, .38, 19.45);
    this.masonry(new THREE.BoxGeometry(2, 16, 19), brick, halfWidth + 16, 8, 4);
    this.masonry(new THREE.BoxGeometry(width + 24, 22, 4), brick, 0, 11, -halfDepth - 14);
    this.box(this.street, trim, 0, 1.35, -halfDepth - 11.9, width + 24, 2.7, .33);

    const arch = new THREE.Shape(), spanX = 20.5, spring = 5.4, rise = 9.7;
    arch.moveTo(-halfWidth - 12, 0);
    arch.lineTo(-spanX, 0);
    for (let i = 0; i <= 40; i++) {
      const angle = Math.PI * (1 - i / 40);
      arch.lineTo(spanX * Math.cos(angle), spring + rise * Math.sin(angle));
    }
    arch.lineTo(spanX, 0); arch.lineTo(halfWidth + 12, 0);
    arch.lineTo(halfWidth + 12, 23); arch.lineTo(-halfWidth - 12, 23); arch.closePath();
    const bridgeZ = halfDepth + 4;
    this.masonry(new THREE.ExtrudeGeometry(arch, { depth: 17, bevelEnabled: false }), brick, 0, 0, bridgeZ).name = 'wells-railway-arch';
    this.box(this.street, trim, 0, 20.2, bridgeZ + 8.5, width + 25, .5, 18);
    this.box(this.street, iron, 0, 22.75, bridgeZ + 8.5, width + 25, .45, 18);
    for (const z of [bridgeZ - .09, bridgeZ + 17.09]) {
      const stones = new THREE.Shape();
      for (let i = 0; i <= 40; i++) {
        const angle = Math.PI * (1 - i / 40), x = spanX * Math.cos(angle), y = spring + rise * Math.sin(angle);
        if (i === 0) stones.moveTo(x, y); else stones.lineTo(x, y);
      }
      for (let i = 40; i >= 0; i--) {
        const angle = Math.PI * (1 - i / 40);
        stones.lineTo((spanX + 1.1) * Math.cos(angle), spring + (rise + 1.1) * Math.sin(angle));
      }
      stones.closePath();
      this.mesh(this.street, new THREE.ExtrudeGeometry(stones, { depth: .18, bevelEnabled: false }), trim, 0, 0, z);
    }
    this.masonry(new THREE.BoxGeometry(width + 4, 21, 5), brick, -20, 10.5, halfDepth + 49);
    this.masonry(new THREE.BoxGeometry(width, 20, 5), brick, 17, 10, halfDepth + 73);

    const bulb = this.basic(0xc4c6a8);
    for (const [index, { x, z }] of streetLamps(width, depth).entries()) {
      this.mesh(this.street, new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 12), iron, x, poleHeight / 2, z);
      this.box(this.street, iron, x - Math.sign(x) * .59, poleHeight, z, 1.4, .16, .16);
      this.box(this.street, iron, x - Math.sign(x) * 1.15, poleHeight - .06, z, 1.05, .36, .82);
      this.box(this.street, bulb, x - Math.sign(x) * 1.15, poleHeight - .25, z, .88, .08, .66);
      if (index % 2 === Number(x > 0)) this.point(x, poleHeight - .3, z, 0xb7c4ab, 130, 33);
    }
    this.point(-8, 9, bridgeZ + 10, 0x99b7a4, 170, 38);
    this.point(6, 5.8, OPENING_PHONE.boothZ - 8, 0xb8a580, 38, 21);
    this.spot(this.street, [-4.8, 11, OPENING_PHONE.boothZ + 3.4], [0, 1.8, OPENING_PHONE.boothZ],
      0xdbe9df, 300, 32, .43);
  }

  private buildTruck(): void {
    const paint = new THREE.MeshPhysicalMaterial({ color: 0x38453b, roughness: .54, metalness: .32, clearcoat: .35, clearcoatRoughness: .27 });
    this.materials.add(paint);
    const compactor = this.standard(0x394239, .75, .24), dark = this.standard(0x171e1a, .88, .3);
    const steel = this.standard(0x65746b, .54, .69), rubber = this.standard(0x101612, .98);
    const glass = this.standard(0x23342e, .18, .24), headlamp = this.basic(0xe5eee7), amber = this.basic(0xe49b32), tail = this.basic(0x91382a);
    const { chassis, windshield, roof, cargo } = WELLS_TRUCK;
    const front = -chassis.depth / 2, low = chassis.y - chassis.height / 2, hood = chassis.y + chassis.height / 2;
    this.profile(paint, chassis.width, [[front, low], [front, 1.23], [front + .19, 1.23], [front + .19, 2.36], [front + .38, hood], [-2.52, hood],
      [-1.8, 2.4], [chassis.depth / 2, 2.25], [chassis.depth / 2, low]]).name = 'wells-truck-chassis';
    this.profile(compactor, cargo.width, [[.475, 1.1], [.475, 6.7], [1.9, 7.825], [11.7, 7.825],
      [13.525, 6.4], [13.525, 2.18], [12.4, .775], [1, .775]]);
    this.box(this.truck, paint, 0, windshield.y, .68, roof.width, windshield.height, 1.67);
    this.box(this.truck, paint, roof.x, roof.y, roof.z, roof.width, roof.height, roof.depth);
    this.box(this.truck, glass, 0, 3.55, -2.46, 3.43, 1.07, .06);
    this.box(this.truck, paint, 0, 3.53, -2.5, .13, 1.18, .09);
    this.box(this.truck, paint, 0, 4.11, -2.49, 3.87, .19, .29);
    this.box(this.truck, steel, 0, 1.09, front + .19, chassis.width, .27, .38);
    this.box(this.truck, dark, 0, 1.93, front + .11, 1.93, 1.14, .12);
    for (let i = -4; i <= 4; i++) this.box(this.truck, steel, i * .197, 1.93, front + .04, .053, 1.05, .026);
    const { door, doorGrip, upperStep, lowerStep } = WELLS_AFTERMATH;
    this.driverDoor.name = 'wells-driver-door';
    this.driverDoor.position.set(door.x, 0, door.z); this.truck.add(this.driverDoor);
    this.box(this.driverDoor, glass, .095, 3.53, .96, .08, 1.04, 1.84);
    this.box(this.driverDoor, paint, .03, 2.99, .98, .12, .55, 1.96);
    this.box(this.driverDoor, paint, .03, 4.047, .98, .13, .105, 1.96);
    for (const z of [.035, 1.925]) this.box(this.driverDoor, paint, .03, 3.54, z, .13, 1.01, .11);
    this.box(this.driverDoor, steel, -.045, 2.94, 1.61, .11, .085, .28);
    const { x, y, z, width, height, depth } = doorGrip;
    for (const offset of [-.135, .135]) this.box(this.driverDoor, steel, .16, y, z + offset, .16, height, .075);
    this.box(this.driverDoor, steel, x, y, z, width, height, depth).name = 'wells-driver-grip';
    for (const step of [upperStep, lowerStep])
      this.box(this.truck, steel, step.x, step.y - .075, step.z, .7, .15, 1.26).name = 'wells-cab-step';
    for (const edge of [-.49, .49]) {
      const dx = upperStep.x - lowerStep.x, dy = upperStep.y - lowerStep.y;
      this.box(this.truck, dark, (lowerStep.x + upperStep.x) / 2, (lowerStep.y + upperStep.y) / 2 - .09, lowerStep.z + edge,
        .13, Math.hypot(dx, dy), .14).rotation.z = -Math.atan2(dx, dy);
    }
    const lettering = this.compactorLettering();
    for (const side of [-1, 1]) {
      const lampX = side * 1.5;
      this.box(this.truck, steel, lampX, 1.9, front + .145, .78, .65, .14);
      this.box(this.truck, headlamp, lampX, 1.9, front + .055, .62, .46, .05);
      this.box(this.truck, amber, side * 1.79, hood + .04, -6.51, .31, .13, .36);
      this.headlamps.push(this.spot(this.truck, [lampX, 1.9, front], [lampX * .55, 4.8, front - 19],
        0xd4e9e8, headlampIntensity, 39, .58));
      if (side > 0) {
        this.box(this.truck, glass, 1.845, 3.53, -1.24, .08, 1.04, 1.84);
        this.box(this.truck, paint, 1.91, 3, -.31, .1, .5, 3.76);
      } else this.box(this.truck, paint, -1.91, 3, .665, .1, .5, 1.81);
      this.box(this.truck, steel, side * 1.99, 3.34, -2.05, .14, .53, .32);
      this.box(this.truck, steel, side * 1.94, 2.84, -.02, .08, .09, .32);
      for (const z of [2.05, 5.1, 8.1, 11.1]) this.box(this.truck, dark, side * 2.865, 4.25, z, .09, 5.8, .19);
      this.box(this.truck, steel, side * 2.79, 1.5, 6.99, .24, .24, 11.9);
      this.mesh(this.truck, new THREE.PlaneGeometry(6.2, 1.36), lettering, side * (cargo.width / 2 + .008), 4.74, 7.15).rotation.y = side * Math.PI / 2;
      this.box(this.truck, tail, side * 2.2, 1.76, 13.64, .33, .39, .1);
      this.box(this.truck, amber, side * 2.63, 6.65, 11.92, .17, .27, .34);
      for (const z of WELLS_TRUCK.axles) {
        const wheel = new THREE.Group(); wheel.position.set(side * 2.1, 1, z); this.truck.add(wheel); this.wheels.push(wheel);
        this.mesh(wheel, new THREE.CylinderGeometry(1, 1, .6, 24), rubber, 0, 0, 0).rotation.z = Math.PI / 2;
        this.mesh(wheel, new THREE.CylinderGeometry(.62, .62, .09, 20), steel, side * .303, 0, 0).rotation.z = Math.PI / 2;
        this.mesh(wheel, new THREE.CylinderGeometry(.25, .25, .15, 12), dark, side * .343, 0, 0).rotation.z = Math.PI / 2;
        for (let lug = 0; lug < 6; lug++) {
          const angle = lug * Math.PI / 3;
          this.box(wheel, dark, side * .36, Math.cos(angle) * .41, Math.sin(angle) * .41, .065, .13, .13);
        }
      }
    }
    this.box(this.truck, dark, 0, 4.16, 13.52, 4.95, 3.8, .19);
    for (const y of [2.46, 3.37, 4.28, 5.2]) this.box(this.truck, compactor, 0, y, 13.59, 4.76, .22, .14);
    this.box(this.truck, steel, 0, 1.1, 13.56, 4.7, .24, .25);
  }

  private compactorLettering(): THREE.MeshBasicMaterial {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 56;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#85917a';
    ctx.fillText('CITY WASTE', 128, 28);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: .67, depthWrite: false });
    this.materials.add(material); return material;
  }

  private brickMaterial(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#302e25'; ctx.fillRect(0, 0, 256, 128);
    const shades = ['#514c3e', '#55513f', '#61594a', '#48473a', '#50483b', '#5a5443'];
    for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
      const x = col * 64 + row % 2 * 32, y = row * 16;
      ctx.fillStyle = shades[(row * 13 + (col + 5) * 7) % shades.length]; ctx.fillRect(x + 1, y + 1, 62, 14);
      ctx.fillStyle = '#ffffff12'; ctx.fillRect(x + 1, y + 1, 62, 1);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4; this.textures.add(map);
    const material = this.standard(0xffffff, .94);
    material.map = map; return material;
  }

  private masonry(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent = this.street): THREE.Mesh {
    const { position, normal, uv } = geometry.attributes;
    for (let i = 0; i < uv.count; i++) uv.setXY(i,
      (Math.abs(normal.getX(i)) > .65 ? position.getZ(i) + z : position.getX(i) + x) / 6.2,
      (position.getY(i) + y) / 3.6);
    return this.mesh(parent, geometry, material, x, y, z);
  }

  private profile(material: THREE.Material, width: number, points: [number, number][]): THREE.Mesh {
    const shape = new THREE.Shape();
    points.forEach(([z, y], i) => { if (i === 0) shape.moveTo(z, y); else shape.lineTo(z, y); });
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geometry.rotateY(-Math.PI / 2); geometry.translate(width / 2, 0, 0);
    return this.mesh(this.truck, geometry, material, 0, 0, 0);
  }

  private standard(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material;
  }
  private basic(color: number): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({ color }); this.materials.add(material); return material;
  }
  private mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = parent !== this.street && parent !== this.curbside; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Group, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number): THREE.Mesh {
    return this.mesh(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
  }
  private point(x: number, y: number, z: number, color: number, intensity: number, distance: number): void {
    const light = new THREE.PointLight(color, intensity, distance, 2); light.position.set(x, y, z);
    this.street.add(light); this.lights.push(light);
  }
  private spot(parent: THREE.Group, position: [number, number, number], target: [number, number, number],
    color: number, intensity: number, distance: number, angle: number): THREE.SpotLight {
    const light = new THREE.SpotLight(color, intensity, distance, angle, .72, 2);
    light.position.set(...position); light.target.position.set(...target);
    parent.add(light, light.target); this.lights.push(light);
    return light;
  }
  dispose(): void {
    this.construction = undefined;
    this.root.removeFromParent(); this.root.clear();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose()); this.urban.dispose();
    this.lights.forEach(light => light.dispose());
  }
}
