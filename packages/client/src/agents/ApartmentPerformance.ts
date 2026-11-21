import * as THREE from 'three';
import { FILM_SETS, APARTMENT, APARTMENT_BOOK, APARTMENT_NETWORK, computerCheckLocked, computerNetworkPull, apartmentAfter, apartmentDoor, apartmentAtComputer, apartmentComputerPose, apartmentPaymentPose, apartmentSleepWeight, apartmentBookCrouch, type ApartmentGesture, type ComputerInvestigation } from '@auto_matrix/shared';
import { apartmentDisc } from './ApartmentDisc.js';
import type { HeroRig } from './HeroModel.js';

// Head-local forehead sections from the Dujour rig, sampled from the center toward the temple.
const dujourFringe = [
  { y: .170, width: .159, depth: [.272, .267, .250, .211, .124] },
  { y: .207, width: .158, depth: [.260, .254, .236, .200, .112] },
  { y: .244, width: .148, depth: [.243, .237, .225, .194, .118] },
  { y: .274, width: .127, depth: [.223, .218, .208, .186, .137] },
  { y: .300, width: .105, depth: [.198, .194, .185, .168, .136] },
  { y: .324, width: .075, depth: [.166, .162, .154, .140, .120] },
];

export class ApartmentPerformance {
  private disk = apartmentDisc();
  private cash = new THREE.Group();
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private tattoo?: THREE.CanvasTexture;
  private dujourHair?: THREE.Group;
  private dujourCollar?: THREE.Mesh;
  constructor(private rig: HeroRig) {
    this.disk.name = 'apartment-held-disc'; this.cash.name = 'apartment-held-cash';
    this.disk.traverse(object => { if (object instanceof THREE.Mesh) { this.geometries.add(object.geometry); this.materials.add(object.material as THREE.Material); } });
    const money = new THREE.MeshStandardMaterial({ color: 0x8b9677, roughness: .95 });
    this.mesh(this.cash, new THREE.BoxGeometry(.36, .04, .18), money);
    this.mesh(this.cash, new THREE.BoxGeometry(.08, .045, .19), new THREE.MeshStandardMaterial({ color: 0xc4bfa5, roughness: .98 }));
    rig.root.add(this.disk, this.cash);
    if (rig.apartmentRole === 'choi') this.fitChoiGoatee();
    if (rig.apartmentRole === 'dujour') {
      this.fitDujourHair();
      this.fitDujourCollar();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#d4d0bf'; ctx.strokeStyle = '#555a4e'; ctx.lineWidth = 7;
      const oval = (x: number, y: number, rx: number, ry: number, angle: number) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
      oval(162, 173, 20, 12, -.2); oval(96, 158, 57, 39, -.25); oval(172, 103, 26, 28, -.25);
      oval(162, 60, 9, 35, -.32); oval(185, 63, 9, 33, .22); oval(45, 154, 15, 14, 0); oval(79, 187, 30, 9, -.1);
      ctx.fillStyle = '#363d33'; ctx.beginPath(); ctx.arc(180, 98, 4, 0, Math.PI * 2); ctx.fill();
      this.tattoo = new THREE.CanvasTexture(canvas); this.tattoo.colorSpace = THREE.SRGBColorSpace;
      rig.root.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial) || object.material.name !== 'Skin') return;
        const mat = object.material; const previous = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
          previous(shader, renderer); shader.uniforms.rabbitTattoo = { value: this.tattoo };
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 rabbitSurface;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nrabbitSurface = position;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D rabbitTattoo;\nvarying vec3 rabbitSurface;')
            .replace('#include <map_fragment>', `#include <map_fragment>
              vec2 rabbitUv = vec2((rabbitSurface.x - 0.12) / 0.28, (rabbitSurface.y - 3.29) / 0.22);
              if (rabbitSurface.z < -0.03 && rabbitUv.x > 0.0 && rabbitUv.x < 1.0 && rabbitUv.y > 0.0 && rabbitUv.y < 1.0) {
                vec4 ink = texture2D(rabbitTattoo, rabbitUv);
                diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, ink.a * 0.84);
              }`);
        };
        mat.customProgramCacheKey = () => 'dujour-shoulder-rabbit-v1'; mat.needsUpdate = true;
      });
    }
  }
  private fitChoiGoatee(): void {
    const face = this.rig.root.getObjectByName('Anatomical_head_and_hands');
    if (!(face instanceof THREE.Mesh) || !(face.material instanceof THREE.MeshStandardMaterial)) return;
    const material = face.material, original = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      original.call(material, shader, renderer);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 choiFace;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nchoiFace = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 choiFace;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (choiFace.z > 0.29 && abs(choiFace.x) < 0.14 && choiFace.y > 3.77 && choiFace.y < 3.972) {
            float x = abs(choiFace.x), y = choiFace.y;
            float chinWidth = mix(.065, .098, smoothstep(3.799, 3.903, y));
            vec2 chin = vec2(x / chinWidth, (y - 3.849) / .061);
            vec2 sides = vec2((x - .082) / .027, (y - 3.894) / .044);
            vec2 mustache = vec2((x - .038) / .062, (y - 3.944 + x * .115) / .023);
            vec2 lips = vec2(x / .076, (y - 3.910) / .019);
            float outline = min(dot(chin, chin), min(dot(sides, sides), dot(mustache, mustache)));
            float grain = fract(sin(dot(floor(choiFace.xy * vec2(990.0, 460.0)), vec2(36.73, 78.23))) * 4872.19);
            float hair = (1.0 - smoothstep(.68, 1.13, outline + .15 * (grain - .5))) * smoothstep(.75, 1.14, dot(lips, lips));
            vec3 goateeColor = mix(vec3(.036, .018, .008), vec3(.103, .057, .028), grain);
            diffuseColor.rgb = mix(diffuseColor.rgb, goateeColor, hair * (.76 + .20 * grain));
          }`);
    };
    material.customProgramCacheKey = () => `${key}:choi-goatee`; material.needsUpdate = true;
  }
  private fitDujourCollar(): void {
    // Neck cross-sections from the rest mesh taper and shift forward toward the jaw.
    const sections = [[0, .183], [.012, .174], [.025, .163], [.039, .156], [.052, .153], [.066, .152]];
    const profile = sections.flatMap(([y, r], index) => index === sections.length - 1
      ? [new THREE.Vector2(r + .006, y), new THREE.Vector2(r, y)]
      : [new THREE.Vector2(r + .003, y), new THREE.Vector2(r + .008, y + .003), new THREE.Vector2(r + .002, y + .008)]);
    const geometry = new THREE.LatheGeometry(profile, 40), position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) position.setZ(i, .86 * position.getZ(i) + .026 * position.getY(i) / .066);
    geometry.computeVertexNormals();
    const chest = this.bone('chest'), root = this.rig.root;
    const collar = this.dujourCollar = this.mesh(chest, geometry, new THREE.MeshStandardMaterial({ color: 0xb8c4bd, metalness: .7, roughness: .28 }));
    collar.name = 'dujour-silver-collar';
    collar.position.copy(chest.worldToLocal(root.localToWorld(new THREE.Vector3(0, 3.57, .054))));
    collar.quaternion.copy(chest.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion())));
  }
  private fitDujourHair(): void {
    const shortHair = this.rig.root.getObjectByName('short04') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const material = shortHair.material.clone();
    const attachment = this.dujourHair = new THREE.Group();
    this.bone('head').add(attachment);
    const fringePosition: number[] = [], fringeUv: number[] = [], indices: number[] = [];
    for (const [row, section] of dujourFringe.entries()) {
      for (let column = 0; column < 9; column++) {
        const side = column - 4;
        fringePosition.push(section.width * side / 4, section.y, section.depth[Math.abs(side)]);
        // Both pieces use the opaque center of the existing hair atlas.
        fringeUv.push(.436 + column / 8 * .1, .272 + row / 5 * .04);
        if (row && column) {
          const corner = row * 9 + column;
          indices.push(corner - 10, corner - 9, corner, corner - 10, corner, corner - 1);
        }
      }
    }
    const fringe = new THREE.BufferGeometry();
    fringe.setAttribute('position', new THREE.Float32BufferAttribute(fringePosition, 3));
    fringe.setAttribute('uv', new THREE.Float32BufferAttribute(fringeUv, 2));
    fringe.setIndex(indices); fringe.computeVertexNormals();
    this.mesh(attachment, fringe, material).name = 'dujour-fringe';
    const crown = new THREE.SphereGeometry(1, 24, 16), uv = crown.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, .436 + uv.getX(i) * .1, .272 + uv.getY(i) * .04);
    const bun = this.mesh(attachment, crown, material);
    bun.name = 'dujour-hair-bun'; bun.position.set(0, .353, -.105); bun.scale.set(.144, .164, .155);
  }
  private mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material) {
    this.geometries.add(geo); this.materials.add(mat); const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  private bone(name: string) { return this.rig.bones.get(name)!; }
  private local(x: number, y: number, z: number) {
    const center = FILM_SETS.film_anderson_flat.center;
    return this.rig.root.worldToLocal(new THREE.Vector3(center.x + x, center.y - 1 + y, center.z + z));
  }
  private hand(side: 'R' | 'L', point: THREE.Vector3, blend: number, typing = false, tilt = 0, heading = 0): void {
    if (blend <= 0) return;
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const upper = this.bone('shoulder_' + side); const lower = this.bone('elbow_' + side); const wrist = this.bone('wrist_' + side);
    const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    const palm = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, typing ? 0 : side === 'R' ? Math.PI / 2 : -Math.PI / 2));
    if (tilt || heading) palm.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, heading, tilt)));
    const desired = rotation.clone().invert().multiply(wrist.getWorldQuaternion(new THREE.Quaternion())).slerp(palm, blend);
    const offset = new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01);
    const target = root.worldToLocal(wrist.localToWorld(offset.clone())).lerp(point, blend).sub(offset.clone().applyQuaternion(desired)); root.localToWorld(target);
    const start = upper.getWorldPosition(new THREE.Vector3()); const direction = target.clone().sub(start);
    const a = lower.position.length(); const b = wrist.position.length(); const length = THREE.MathUtils.clamp(direction.length(), .02, a + b - .001); direction.normalize();
    const along = (a * a - b * b + length * length) / (2 * length);
    const pole = new THREE.Vector3(side === 'R' ? -.45 : .45, -.6, -.2).applyQuaternion(rotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    const aim = (joint: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) => {
      joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(target.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
    };
    aim(upper, lower, hinge); aim(lower, wrist, start.addScaledVector(direction, length));
    wrist.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation).multiply(desired));
    for (let finger = 1; finger <= 5; finger++) for (let segment = 1; segment <= 3; segment++) this.bone(`finger${finger}-${segment}_${side}`).rotation.z = (side === 'R' ? 1 : -1) * (typing ? .06 : .28) * blend;
  }
  private feet(seated: number, contacts?: Record<'R' | 'L', { x: number; z: number; yaw: number; lift: number }>): void {
    const root = this.rig.root; root.updateWorldMatrix(true, true);
    const rotation = root.getWorldQuaternion(new THREE.Quaternion());
    const forward = new THREE.Vector3(0, 0, 1.2 * seated).applyQuaternion(rotation);
    const floor = root.getWorldPosition(new THREE.Vector3()).y + this.rig.footHeight + .015;
    for (const side of ['R', 'L'] as const) {
      const hip = this.bone('hip_' + side), knee = this.bone('knee_' + side), ankle = this.bone('ankle_' + side);
      const foot = contacts?.[side];
      const start = hip.getWorldPosition(new THREE.Vector3()), target = foot ? this.local(foot.x, floor + foot.lift, foot.z) : start.clone().add(forward);
      if (foot) root.localToWorld(target); else target.y = floor;
      const direction = target.clone().sub(start), a = knee.position.length(), b = ankle.position.length();
      const length = THREE.MathUtils.clamp(direction.length(), .02, a + b - .002); direction.normalize();
      const along = (a * a - b * b + length * length) / (2 * length);
      const pole = new THREE.Vector3(0, .1, 1).applyQuaternion(rotation); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
      const hinge = start.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
      const aim = (joint: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) => {
        joint.quaternion.setFromUnitVectors(child.position.clone().normalize(), joint.parent!.worldToLocal(point.clone()).sub(joint.position).normalize()); joint.updateWorldMatrix(false, true);
      };
      aim(hip, knee, hinge); aim(knee, ankle, start.addScaledVector(direction, length));
      const heading = foot ? new THREE.Quaternion().setFromEuler(new THREE.Euler(0, foot.yaw, 0)) : rotation;
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(heading)); ankle.updateWorldMatrix(false, true);
    }
  }
  update(gesture?: ApartmentGesture, check?: ComputerInvestigation): void {
    this.disk.visible = this.cash.visible = false;
    if (computerCheckLocked(check)) {
      const t = check!.elapsed, pull = computerNetworkPull(check);
      const hold = THREE.MathUtils.smoothstep(t, .1, .45) * (1 - THREE.MathUtils.smoothstep(t, 1.2, APARTMENT_NETWORK.seconds));
      const clearance = 1 - THREE.MathUtils.smoothstep(t, .35, .5) + THREE.MathUtils.smoothstep(t, 1.12, 1.38);
      this.bone('spine').rotation.x += .04 * hold; this.bone('chest').rotation.x += .06 * hold; this.bone('head').rotation.x += .15 * hold;
      this.rig.root.updateWorldMatrix(true, true);
      this.hand('R', this.local(APARTMENT_NETWORK.plug.x, APARTMENT_NETWORK.plug.y - .16 * pull + APARTMENT_NETWORK.gripHeight + .32 * clearance, APARTMENT_NETWORK.plug.z + .31 * pull + .38 * clearance), hold, true);
      return;
    }
    if (!gesture) return;
    const { role, phase, elapsed: t } = gesture; const root = this.rig.root;
    const smooth = THREE.MathUtils.smoothstep;
    const cartridge = gesture.propMotion === 'minidisc';
    const ownsDisk = cartridge && (role === 'neo' && (phase === 'retrieving' && t >= APARTMENT_BOOK.pickup || phase === 'disk' || phase === 'handover' && t < 2.3)
      || role === 'choi' && (phase === 'handover' && t >= 2.3 || apartmentAfter(gesture, 'invitation')));
    const diskSide = role === 'choi' ? 'L' : 'R', cashSide = role === 'choi' ? 'R' : 'L';
    if (ownsDisk && phase !== 'retrieving') {
      this.hand(diskSide, new THREE.Vector3(diskSide === 'R' ? -.5 : .5, 2.5, .38), 1, true);
      for (let segment = 1; segment <= 3; segment++) {
        this.bone(`finger3-${segment}_${diskSide}`).rotation.x = .55;
        this.bone(`finger4-${segment}_${diskSide}`).rotation.x = .85;
        this.bone(`finger5-${segment}_${diskSide}`).rotation.x = .85;
      }
    }
    if (role === 'neo' && apartmentAtComputer(phase)) {
      const pose = apartmentComputerPose(gesture), { seated, walking } = pose;
      const sleep = apartmentSleepWeight(gesture);
      const reading = gesture.chairMotion === 'seated' ? (1 - sleep) * (phase === 'knocking' ? 1 - smooth(t, 0, .3) : 1) : 0;
      const pelvis = this.bone('pelvis'); pelvis.position.copy(this.rig.rest.get('pelvis')!); pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y - .25 * walking, pose.feet ? 1.65 : 1.6, seated);
      if (pose.feet) {
        pelvis.rotation.set(0, 0, 0);
        this.bone('spine').rotation.set(.12 * walking, 0, 0); this.bone('chest').rotation.set(.08 * walking, 0, 0); this.bone('head').rotation.set(-.12 * walking, .35 * walking, 0);
        for (const side of ['R', 'L']) {
          this.bone('shoulder_' + side).rotation.set(.2, 0, side === 'R' ? -.045 : .045);
          this.bone('elbow_' + side).rotation.x = -.35;
        }
      }
      this.feet(seated, pose.feet);
      this.bone('spine').rotation.x += .16 * seated + .4 * sleep;
      this.bone('chest').rotation.x += .2 * seated + .19 * sleep;
      this.bone('head').rotation.x += .12 * seated + .32 * sleep - .5 * reading;
      this.bone('head').rotation.z += .2 * sleep;
      root.updateWorldMatrix(true, true);
      for (const side of ['R', 'L'] as const) this.hand(side, this.local(-9 + (side === 'R' ? .6 : -.6) * (1 + .28 * sleep),
        2.65 + .45 * Math.sin(Math.PI * seated) + (phase === 'knocking' && t < .6 ? Math.sin(t * 28) * .025 : 0),
        -10.49 + .6 * (1 - seated) - .22 * sleep), seated, true);
    } else if (role === 'neo' && phase === 'opening') {
      const { x, z, yaw } = APARTMENT.openDoor;
      const step = (side: number, start: number, end: number, back: number, stand: number) => {
        const out = smooth(t, start, end), returning = smooth(t, back, stand), clearance = out - returning;
        return { x: x + side * .276 + .92 * clearance, z: z - .43 * clearance, yaw,
          lift: .16 * (Math.sin(Math.PI * out) + Math.sin(Math.PI * returning)) };
      };
      const feet = { L: step(1, .02, .30, 1.86, 2.23), R: step(-1, .18, .55, 1.48, 1.86) };
      // Step beyond the latch's swing before it crosses the old stance.
      const pelvis = this.bone('pelvis').position;
      pelvis.x += (feet.L.x + feet.R.x) / 2 - x; pelvis.z += (feet.L.z + feet.R.z) / 2 - z;
      this.feet(0, feet);
      const angle = apartmentDoor(gesture) * 1.42, release = smooth(t, .57, .8);
      const aroundLatch = Math.sin(Math.PI * release), reach = 3.3 + .85 * aroundLatch, grip = .35 + .32 * aroundLatch;
      const hold = smooth(t, 0, .31) * (1 - release);
      this.bone('chest').rotation.y -= angle * .12;
      root.updateWorldMatrix(true, true);
      this.hand('R', this.local(-1.9 + Math.cos(angle) * reach - Math.sin(angle) * grip, 2.85, APARTMENT.doorZ - Math.sin(angle) * reach - Math.cos(angle) * grip), hold, false, 0, -2.28);
    } else if (role === 'neo' && phase === 'retrieving' && cartridge) {
      const crouch = apartmentBookCrouch(gesture), pelvis = this.bone('pelvis');
      pelvis.position.y = THREE.MathUtils.lerp(pelvis.position.y, .88, crouch); pelvis.position.z += .15 * crouch;
      pelvis.rotation.set(0, 0, 0); this.bone('spine').rotation.x += 1.5 * crouch; this.bone('chest').rotation.x += .12 * crouch; this.bone('head').rotation.x += .12 * crouch;
      const approach = APARTMENT_BOOK.approach;
      this.feet(0, { R: { x: approach.x - .276, z: approach.z, yaw: 0, lift: 0 }, L: { x: approach.x + .276, z: approach.z, yaw: 0, lift: 0 } });
      const angle = smooth(Math.min(t, .8), .35, 1.35) * 2.88, size = APARTMENT_BOOK.scale, withdraw = smooth(t, .8, 1.1);
      root.updateWorldMatrix(true, true);
      const coverGrip = this.local(6 + (-.84 + .35 * Math.cos(angle)) * size - Math.sin(angle) * .21 - .4 * withdraw,
        APARTMENT_BOOK.y + (.39 + .35 * Math.sin(angle)) * size + Math.cos(angle) * .21 + .3 * withdraw, APARTMENT_BOOK.z - .3 - .45 * withdraw);
      const knee = root.worldToLocal(this.bone('knee_L').getWorldPosition(new THREE.Vector3()));
      const brace = smooth(t, .93, 1.35);
      coverGrip.lerp(knee.add(new THREE.Vector3(.43, .24, -.09)), brace);
      this.hand('L', coverGrip, smooth(t, .25, .55) * (1 - smooth(t, 2.15, 3.2)), true, angle * (1 - brace));
      const grip = this.local(6, APARTMENT_BOOK.y + .09 * size + .17 + .45 * (1 - smooth(t, 1.75, APARTMENT_BOOK.pickup)), APARTMENT_BOOK.z);
      grip.lerp(new THREE.Vector3(-.5, 2.5, .38), smooth(t, APARTMENT_BOOK.pickup, 3.1));
      const readyHand = root.worldToLocal(this.bone('knee_R').getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(-.64, .5, .22));
      readyHand.lerp(grip, smooth(t, 1.35, 1.8));
      this.hand('R', readyHand, smooth(t, .28, .88), true);
    } else if (role === 'neo' && phase === 'retrieving') {
      const lean = smooth(t, 0, .65) * (1 - smooth(t, 2.5, 3.2));
      this.bone('spine').rotation.x += .26 * lean; this.bone('chest').rotation.x += .36 * lean; this.bone('head').rotation.x += .2 * lean;
      root.updateWorldMatrix(true, true);
      this.hand('L', this.local(5.5, 2.26, 5.45), lean);
      this.hand('R', this.local(6.2, 2.1 + smooth(t, 2.1, 2.65) * .8, 5.6 - smooth(t, 2.1, 2.65) * .6), smooth(t, 1.4, 2.2) * (1 - smooth(t, 2.8, 3.2)));
      if (t > 2.3 && t < 2.9) {
        root.updateWorldMatrix(true, true); this.disk.position.copy(root.worldToLocal(this.bone('wrist_R').localToWorld(new THREE.Vector3(.065, -.17, .01)))); this.disk.visible = true;
      }
    } else if (role === 'choi' && phase === 'knocking') {
      const tap = [1.05, 1.36, 1.68].reduce((amount, beat) => Math.max(amount, Math.max(0, 1 - Math.abs(t - beat) / .14)), 0);
      root.updateWorldMatrix(true, true); this.hand('R', this.local(-.35, 3.7, 12.25 + (1 - tap) * .16), smooth(t, .2, .8) * (1 - smooth(t, 1.9, 2.6)));
    } else if ((role === 'neo' || role === 'choi') && (phase === 'payment' || phase === 'handover')) {
      const payment = phase === 'payment', exchangesCash = payment || !gesture.paid, fittedCash = payment || cartridge;
      const hold = smooth(t, payment ? .94 : .2, 1.5) * (1 - smooth(t, 3, 4));
      if (payment && role === 'neo') {
        const { feet, lowering } = apartmentPaymentPose(t);
        this.bone('pelvis').position.y -= lowering;
        this.feet(0, feet);
      }
      this.bone('spine').rotation.x += .12 * hold; this.bone('chest').rotation.x += .14 * hold;
      root.updateWorldMatrix(true, true);
      const diskGrip = new THREE.Vector3(0, .17, diskSide === 'R' ? -.125 : .125);
      const cashDirection = cashSide === 'R' ? -1 : 1;
      // Approach from opposite sides, with the bills between the index and middle fingers.
      const cashGrip = payment ? new THREE.Vector3(.18 * cashDirection + .025, -.048, -.23 * cashDirection) : new THREE.Vector3(.18 * cashDirection, .17, 0);
      const cashHold = payment && role === 'choi' ? hold * (1 - smooth(t, 2.45, 3.35)) : hold;
      if (exchangesCash && fittedCash) this.hand(cashSide, new THREE.Vector3(cashSide === 'R' ? -.5 : .5, 2.5, .38), 1, true);
      if (!payment) this.hand(cartridge ? diskSide : 'R', this.local(-.35, 2.9 + (cartridge ? diskGrip.y : 0), 11.65 + (cartridge ? diskGrip.z : 0)), hold, cartridge);
      if (exchangesCash) this.hand(fittedCash ? cashSide : 'L', this.local(.4 + (fittedCash ? cashGrip.x : 0), 2.82 + (fittedCash ? cashGrip.y : 0), 11.65 + cashGrip.z), cashHold, fittedCash);
      root.updateWorldMatrix(true, true);
      if (!payment && !cartridge && role === (t < 2.3 ? 'neo' : 'choi')) { this.disk.visible = true; this.disk.position.copy(root.worldToLocal(this.bone('wrist_R').localToWorld(new THREE.Vector3(.065, -.17, .01)))); }
      if (exchangesCash && role === (t < 2.3 ? 'choi' : 'neo')) {
        this.cash.visible = true; const side = fittedCash ? cashSide : 'L';
        const position = this.bone('wrist_' + side).localToWorld(new THREE.Vector3(side === 'R' ? .065 : -.065, -.17, .01));
        if (fittedCash) {
          const rotation = this.bone('wrist_' + side).getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
          rotation.copy(new THREE.Quaternion().slerp(rotation, smooth(t, 3, 4))); position.sub(cashGrip.clone().applyQuaternion(rotation));
          this.cash.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
        }
        this.cash.position.copy(root.worldToLocal(position));
      }
    } else if (role === 'choi' && apartmentAfter(gesture, 'invitation')) this.bone('head').rotation.y -= .24;
    root.updateWorldMatrix(true, true);
    if (ownsDisk) {
      const heading = root.getWorldQuaternion(new THREE.Quaternion()), wrist = this.bone('wrist_' + diskSide);
      const rotation = wrist.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
      if (phase === 'handover') rotation.copy(new THREE.Quaternion().slerp(rotation, smooth(t, 3, 4)));
      const gripZ = (diskSide === 'R' ? -.125 : .125) * (phase === 'retrieving' ? smooth(t, APARTMENT_BOOK.pickup, 3.1) : 1);
      const position = wrist.localToWorld(new THREE.Vector3(diskSide === 'R' ? .065 : -.065, -.17, .01)).sub(new THREE.Vector3(0, .17, gripZ).applyQuaternion(rotation));
      this.disk.position.copy(root.worldToLocal(position)); this.disk.visible = true;
      this.disk.quaternion.copy(heading.invert().multiply(rotation));
    }
  }
  dispose(): void { this.disk.removeFromParent(); this.cash.removeFromParent(); this.dujourHair?.removeFromParent(); this.dujourCollar?.removeFromParent(); this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.tattoo?.dispose(); }
}
