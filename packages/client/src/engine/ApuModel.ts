import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { APU_RIG, type ApuRun } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

type Point = [number, number, number];

/** Open APU chassis: separate cast links, bearings, rams and gun receivers around the operator. */
export class ApuModel {
  readonly group = new THREE.Group();
  readonly cannons: THREE.Group[] = [];
  readonly flashes: THREE.Mesh[] = [];
  private feeds: THREE.InstancedMesh;
  private pivots = new Map<THREE.Group, THREE.Vector3>();
  private legs: { foot: THREE.Group; shin: THREE.Group; thigh: THREE.Group;
    rams: { group: THREE.Group; from: THREE.Group; a: Point; to: THREE.Group; b: Point }[] }[] = [];
  private geometry = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private armor = this.material(0x909b97, .7, .55);
  private steel = this.material(0xa5aaa7, .62, .65);
  private dark = this.material(0x4b5050, .72, .5);
  private chrome = this.material(0x8e9595, .38, .8);
  private rubber = this.material(0x171919, .94, .02);
  private paint = this.material(0xa88740, .68, .42);
  private blue = this.material(0x376579, .65, .45);
  private red = this.material(0x973f32, .67, .35);

  constructor(parent: THREE.Object3D, flashMaterial: THREE.Material) {
    this.group.name = 'zion-kid-apu'; parent.add(this.group);
    const p = APU_RIG.pilot.y, armor = this.armor;
    this.plate(this.dark, [0, p + .75, .4], [3.1, .3, 2.1], this.group, 'apu-seat-platform');
    this.plate(this.rubber, [0, p + .98, .14], [1.25, .14, .65], this.group, 'apu-seat-pan', .035);
    this.plate(this.rubber, [0, p + 1.95, .42], [1.25, 1.6, .14], this.group, 'apu-seat-back', .045);
    for (const y of [p + 1.4, p + 1.95, p + 2.5]) this.plate(this.dark, [0, y, .53], [1.4, .08, .15]);
    // Narrow spine and rear hydraulic manifold leave the pilot exposed from the front.
    this.plate(armor, [0, 6.45, .83], [1.6, 3.3, .4]);
    this.plate(this.dark, [0, 5.35, 1.17], [1.35, .68, .22]);
    for (let i = 0; i < 7; i++) this.plate(this.steel, [-.52 + i * .175, 6.55, 1.08], [.07, 2.35, .11]);
    const rail = new THREE.Group(); rail.name = 'apu-upper-rail'; rail.position.set(0, 8.25, 1.03); this.group.add(rail);
    this.pipe(this.steel, [-1.5, 0, 0], [1.5, 0, 0], .11, rail);
    this.pipe(this.blue, [-.7, 0, 0], [-.15, 0, 0], .13, rail);
    this.pipe(this.paint, [.15, 0, 0], [.7, 0, 0], .13, rail);
    this.plate(this.dark, [0, p + 1.9, -.85], [1.6, .18, .24], this.group, 'apu-control-panel');
    for (const side of [-1, 1]) {
      this.pipe(this.rubber, [side * .62, p + 2.15, -1], [side * .62, p + 2.45, -1], .065, this.group, `apu-control-${side}`);
      this.plate(this.red, [side * .62, p + 2.47, -1], [.095, .04, .095], this.group, undefined, .015);
      this.link([side * .8, p + .85, -.55], [side * .8, p + 1.87, -1], .16, .12);
      this.pipe(this.steel, [side * .8, p + 1.87, -1], [side * .62, p + 2.07, -1], .05);
      this.plate(this.dark, [side * .225, 4.273, -.96], [.42, .12, .67], this.group, `apu-pedal-${side}`);
      this.link([side * .84, 4.96, -.4], [side * .4, 4.273, -.96], .14, .12);
      this.pipe(this.steel, [side * 1.48, 5.05, .55], [side * 1.5, 8.25, 1.03], .1);
      this.ram([side * 1.65, 4.8, .75], [side * 2.0, 7.93, .65], .19);
      this.hinge([side * 1.95, 7.95, .65], .53, .56);
      this.link([side * 1.95, 7.95, .65], [side * 2.95, 7.35, .3], .75, .45);
      this.hinge([side * 2.95, 7.35, .3], .49, .55);
      this.link([side * 2.95, 7.35, .3], [side * 3.25, 6.2, -.4], .58, .4);
      this.ram([side * 1.77, 8.24, .8], [side * 3.17, 7.47, .24], .105);
      this.ram([side * 3.24, 7.33, .53], [side * 3.51, 6.22, -.25], .11);
      this.hose([[side * 1.8, 5.4, .95], [side * 2.55, 6.1, 1.28], [side * 3.0, 7.18, .94], [side * 3.45, 6.36, .24]], .073);
      this.hose([[side * 1.78, 7.93, 1], [side * 2.33, 8.25, 1], [side * 3.35, 7.24, .82]], .056);
      this.plate(armor, [side * 1.31, 4.88, -.67], [.63, .4, .5]);
      for (let i = 0; i < 4; i++) this.plate(this.steel, [side * 1.31, 4.75 + i * .09, -.94], [.45, .03, .06]);

      // Forked soles and separate ankle/knee/hip joints, with a visible gap between the rams.
      const footX = side * APU_RIG.footX;
      const foot = new THREE.Group(), shin = new THREE.Group(), thigh = new THREE.Group();
      foot.name = `apu-ankle-${side}`; shin.name = `apu-knee-${side}`; thigh.name = `apu-hip-${side}`;
      this.group.add(foot, shin, thigh);
      const shape = new THREE.Shape(APU_RIG.sole.map(([x, z]) => new THREE.Vector2(x, z)));
      const sole = new THREE.ExtrudeGeometry(shape, { depth: .24, bevelEnabled: false, steps: 1 });
      sole.rotateX(Math.PI / 2); sole.translate(0, .24, 0);
      this.mesh(sole, this.dark, foot, `apu-foot-${side}`).position.x = footX;
      for (const toe of [-.58, 0, .58]) {
        this.plate(armor, [footX + toe, .34, -.9], [.3, .2, 1.82], foot);
        this.ram([footX + toe, .72, .03], [footX + toe, .4, -1.25], .08, foot);
        this.hinge([footX + toe, .48, -.22], .15, .38, false, foot);
      }
      this.hinge([footX, .85, .32], .37, .92, true, foot);
      this.link([footX, .85, .32], [side * 1.85, 2.9, -.22], .5, .46, shin);
      this.hinge([side * 1.85, 2.9, -.22], .49, .95, true, shin);
      this.link([side * 1.85, 2.9, -.22], [side * 1.3, 4.7, .42], .54, .56, thigh);
      this.hinge([side * 1.3, 4.7, .42], .42, .65, true, thigh);
      this.plate(armor, [side * 1.85, 2.62, -.52], [.76, .92, .15], shin);
      for (const y of [2.37, 2.62, 2.87]) this.plate(this.steel, [side * 1.85, y, -.63], [.61, .035, .07], shin);
      for (const [part, origin] of [[foot, [footX, 0, 0]], [shin, [side * 1.85, 2.9, -.22]], [thigh, [side * 1.3, 4.7, .42]]] as [THREE.Group, Point][]) {
        const pivot = new THREE.Vector3(...origin); this.pivots.set(part, pivot); part.position.copy(pivot);
        for (const child of part.children) child.position.sub(pivot);
      }
      const rams = [
        { from: foot, a: [side * 1.24, 1.03, .86] as Point, to: shin, b: [side * 1.48, 3.08, .51] as Point, radius: .17 },
        { from: foot, a: [side * 2.17, .91, .57] as Point, to: shin, b: [side * 2.24, 2.81, .24] as Point, radius: .14 },
        { from: shin, a: [side * 2.06, 2.99, .4] as Point, to: thigh, b: [side * 1.63, 4.6, .86] as Point, radius: .17 },
      ].map(spec => {
        const group = new THREE.Group(); this.group.add(group);
        this.ram([0, 0, 0], [0, 1, 0], spec.radius, group); return { ...spec, group };
      });
      this.legs.push({ foot, shin, thigh, rams });

      const gun = new THREE.Group(); gun.name = `apu-cannon-${side}`;
      gun.position.set(side * APU_RIG.cannon.x, APU_RIG.cannon.y, APU_RIG.cannon.z); this.group.add(gun); this.cannons.push(gun);
      this.hinge([side * APU_RIG.cannon.x, APU_RIG.cannon.y, APU_RIG.cannon.z], .53, 1.4);
      const mount = new THREE.Group(); mount.name = `apu-cannon-mount-${side}`; mount.position.copy(gun.position); this.group.add(mount);
      for (const face of [-1, 1]) {
        const outline = new THREE.Shape([[-.95, -.62], [-.87, -.7], [.87, -.7], [.95, -.62], [.95, .62], [.87, .7], [-.87, .7], [-.95, .62]].map(([x, y]) => new THREE.Vector2(x, y)));
        const opening = new THREE.Path(); opening.absellipse(0, 0, .65, .46, 0, Math.PI * 2, true, 0); outline.holes.push(opening);
        const casting = new THREE.ExtrudeGeometry(outline, { depth: .07, bevelEnabled: false, curveSegments: 12 });
        casting.rotateY(Math.PI / 2); casting.translate(face * .665 - .035, 0, 0);
        this.mesh(casting, armor, mount);
        this.plate(this.dark, [0, face * .645, .69], [1.4, .11, .45], mount);
      }
      this.plate(armor, [0, -.1, -.85], [1.05, .88, 2.35], gun);
      this.plate(this.dark, [0, -.1, -2.7], [.65, .68, 1.6], gun);
      for (const x of [-.46, .46]) this.plate(this.steel, [x, -.08, -.75], [.08, .59, 2.32], gun);
      for (let i = 0; i < 9; i++) {
        this.plate(this.dark, [0, .36, .05 - i * .23], [.73, .035, .075], gun, undefined, .012);
        this.plate(this.steel, [0, .25, -2.11 - i * .14], [.74, .05, .06], gun, undefined, .015);
      }
      this.pipe(this.dark, [0, -.1, -1.3], [0, -.1, -4.77], .23, gun);
      this.pipe(this.chrome, [side * .33, .13, -1.1], [side * .33, .13, -3.85], .08, gun);
      for (const z of [-2.16, -3.23, -3.83, -4.53]) this.pipe(this.steel, [0, -.1, z + .09], [0, -.1, z - .09], .29, gun);
      // Hollow muzzle, rather than a glowing capped pipe when the weapon is idle.
      const muzzle = this.mesh(new THREE.TorusGeometry(.23, .065, 6, 20), this.steel, gun); muzzle.position.set(0, -.1, -4.8);
      this.mesh(new THREE.CircleGeometry(.18, 20), this.rubber, gun).position.set(0, -.1, -4.79);
      gun.children.at(-1)!.rotation.y = Math.PI;
      this.plate(this.paint, [side * .545, 0, -.2], [.025, .25, .52], gun, undefined, .006);
      for (const z of [-.05, -.2, -.35]) this.plate(this.red, [side * .56, .015, z], [.014, .14, .045], gun, undefined, .004);
      const flash = this.mesh(new THREE.SphereGeometry(.48, 10, 8), flashMaterial, gun, `apu-muzzle-${side}`);
      flash.position.set(0, -.1, -5.03); flash.visible = false; this.flashes.push(flash);
    }
    batchStaticGeometry(this.group, new Set()).forEach(geometry => this.geometry.add(geometry));
    const feed = new THREE.CylinderGeometry(.095, .095, 1, 8); this.geometry.add(feed);
    this.feeds = new THREE.InstancedMesh(feed, this.rubber, 64); this.feeds.name = 'apu-ammo-feed-hoses';
    this.feeds.castShadow = this.feeds.receiveShadow = true; this.feeds.frustumCulled = false; this.group.add(this.feeds);
    this.update();
  }

  update(run?: ApuRun): void {
    for (const [index, leg] of this.legs.entries()) {
      const side = index ? 1 : -1, { foot, shin, thigh } = leg;
      const hip = this.pivots.get(thigh)!, kneeRest = this.pivots.get(shin)!;
      const ankleRest = new THREE.Vector3(side * APU_RIG.footX, .85, .32);
      foot.position.copy(this.pivots.get(foot)!);
      if (run?.gait) foot.position.copy(run.gait.feet[index]).sub(new THREE.Vector3(run.x, 0, run.z));
      const ankle = foot.position.clone().add(new THREE.Vector3(0, .85, .32));
      const upper = kneeRest.distanceTo(hip), lower = ankleRest.distanceTo(kneeRest), axis = ankle.clone().sub(hip);
      const distance = axis.length(); axis.normalize();
      const along = Math.min(upper, (upper * upper - lower * lower + distance * distance) / (2 * distance));
      const bend = kneeRest.clone().sub(hip); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
      const knee = hip.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
      thigh.quaternion.setFromUnitVectors(kneeRest.clone().sub(hip).normalize(), knee.clone().sub(hip).normalize());
      shin.position.copy(knee); shin.quaternion.setFromUnitVectors(ankleRest.clone().sub(kneeRest).normalize(), ankle.clone().sub(knee).normalize());
      for (const ram of leg.rams) {
        const a = this.anchor(ram.from, ram.a), b = this.anchor(ram.to, ram.b), delta = b.sub(a);
        ram.group.position.copy(a); ram.group.scale.y = delta.length();
        ram.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      }
    }
    // Flexible feeds stay attached to the receiver while the cannon elevates. During a fall,
    // their underside rests on the dock instead of following a rigid loop through the floor.
    const matrix = new THREE.Object3D(), inverse = this.group.quaternion.clone().invert();
    const curves: THREE.Curve<THREE.Vector3>[] = [];
    for (const [index, gun] of this.cannons.entries()) {
      const side = index ? 1 : -1;
      const start = new THREE.Vector3(side * .95, 4.62, 1.82);
      const end = new THREE.Vector3(side * .4, -.3, .6).applyQuaternion(gun.quaternion).add(gun.position);
      curves.push(new THREE.QuadraticBezierCurve3(start, start.clone().lerp(end, .5).add(new THREE.Vector3(side * .8, -.6, 1.1)), end));
    }
    for (const [index, leg] of this.legs.entries()) {
      const side = index ? 1 : -1;
      curves.push(new THREE.CatmullRomCurve3([new THREE.Vector3(side * 1.25, 4.82, 1.05),
        this.anchor(leg.thigh, [side * 2.3, 3.7, 1.18]), this.anchor(leg.shin, [side * 2.3, 1.2, .97]),
        this.anchor(leg.foot, [side * 1.68, .85, .65])]));
    }
    for (const [index, curve] of curves.entries()) {
      const points = Array.from({ length: 17 }, (_, i) => {
        const point = curve.getPoint(i / 16).applyQuaternion(this.group.quaternion).add(this.group.position);
        point.y = Math.max(.14, point.y);
        return point.sub(this.group.position).applyQuaternion(inverse);
      });
      for (let i = 0; i < 16; i++) {
        const delta = points[i + 1].clone().sub(points[i]);
        matrix.position.copy(points[i]).add(points[i + 1]).multiplyScalar(.5);
        matrix.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
        matrix.scale.set(1, delta.length(), 1); matrix.updateMatrix(); this.feeds.setMatrixAt(index * 16 + i, matrix.matrix);
      }
    }
    this.feeds.instanceMatrix.needsUpdate = true;
  }

  private anchor(part: THREE.Group, point: Point): THREE.Vector3 {
    return new THREE.Vector3(...point).sub(this.pivots.get(part)!).applyQuaternion(part.quaternion).add(part.position);
  }

  private material(color: number, roughness: number, metalness: number) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, vertexColors: true }); this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, name?: string): THREE.Mesh {
    if (geometry.index) { const indexed = geometry; geometry = indexed.toNonIndexed(); indexed.dispose(); }
    const positions = geometry.attributes.position, normals = geometry.attributes.normal, colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const wear = 1 - Math.max(Math.abs(normals.getX(i)), Math.abs(normals.getY(i)), Math.abs(normals.getZ(i)));
      const grain = Math.sin(positions.getX(i) * 49.1 + positions.getY(i) * 17.7 + positions.getZ(i) * 31.3) * .025;
      const value = Math.min(1, .83 + wear * .55 + grain); colors.set([value, value, value], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name; parent.add(mesh); return mesh;
  }
  private plate(material: THREE.Material, position: Point, size: Point, parent: THREE.Object3D = this.group, name?: string, radius = .045): THREE.Mesh {
    const mesh = this.mesh(new RoundedBoxGeometry(...size, 1, Math.min(radius, ...size.map(value => value * .2))), material, parent, name);
    mesh.position.set(...position); return mesh;
  }
  private pipe(material: THREE.Material, from: Point, to: Point, radius: number, parent: THREE.Object3D = this.group, name?: string): THREE.Mesh {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 12), material, parent, name);
    mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return mesh;
  }
  private link(from: Point, to: Point, width: number, depth: number, parent: THREE.Object3D = this.group): void {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const length = delta.length();
    const outline = new THREE.Shape([[-.35, -.5], [-.5, -.34], [-.31, .3], [-.4, .5], [.4, .5], [.31, .3], [.5, -.34], [.35, -.5]]
      .map(([x, y]) => new THREE.Vector2(x * width, y * length)));
    if (width > .3) for (const y of [-.16, .16]) {
      const hole = new THREE.Path(); hole.absellipse(0, y * length, width * .13, length * .08, 0, Math.PI * 2, true, 0); outline.holes.push(hole);
    }
    const casting = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 1, curveSegments: 8 });
    casting.translate(0, 0, -depth / 2);
    const mesh = this.mesh(casting, this.armor, parent); mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    for (const side of [-1, 1]) {
      const strip = this.plate(this.steel, [0, 0, 0], [.075, delta.length() * .64, .055], parent);
      strip.quaternion.copy(mesh.quaternion); strip.position.copy(mesh.position).add(new THREE.Vector3(side * width * .36, 0, -depth * .52).applyQuaternion(mesh.quaternion));
    }
  }
  private hinge(position: Point, radius: number, width: number, bolts = true, parent: THREE.Object3D = this.group): void {
    const [x, y, z] = position;
    this.pipe(this.dark, [x - width / 2, y, z], [x + width / 2, y, z], radius, parent);
    for (const side of [-1, 1]) {
      this.pipe(this.steel, [x + side * (width / 2 - .05), y, z], [x + side * width / 2, y, z], radius * .84, parent);
      this.pipe(this.dark, [x + side * width / 2, y, z], [x + side * (width / 2 + .018), y, z], radius * .49, parent);
      this.pipe(this.chrome, [x + side * width / 2, y, z], [x + side * (width / 2 + .03), y, z], radius * .25, parent);
      if (bolts) for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3, yy = y + Math.cos(a) * radius * .66, zz = z + Math.sin(a) * radius * .66;
        this.pipe(this.dark, [x + side * width / 2, yy, zz], [x + side * (width / 2 + .025), yy, zz], .04, parent);
      }
    }
  }
  private ram(from: Point, to: Point, radius: number, parent: THREE.Object3D = this.group): void {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const split = a.clone().lerp(b, .55).toArray();
    this.pipe(this.dark, from, split, radius, parent); this.pipe(this.chrome, split, to, radius * .52, parent);
    for (const t of [0, .49, .55]) this.pipe(this.steel, a.clone().lerp(b, t).toArray(), a.clone().lerp(b, t + .04).toArray(), radius * 1.2, parent);
  }
  private hose(points: Point[], radius: number, parent: THREE.Object3D = this.group): void {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    this.mesh(new THREE.TubeGeometry(curve, 18, radius, 6, false), this.rubber, parent);
  }
  dispose(): void {
    this.group.removeFromParent(); this.group.clear(); this.geometry.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.geometry.clear(); this.materials.clear();
  }
}
