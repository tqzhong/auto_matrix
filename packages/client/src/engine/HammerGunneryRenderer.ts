import * as THREE from 'three';
import { HAMMER_COCKPIT, HAMMER_GUNNERY, hammerGunneryTarget, hammerGunneryView, hammerRoutePoint, hammerTunnelSection, type HammerFlight, type HammerHandover } from '@auto_matrix/shared';
import { batchStaticGeometry } from './StaticGeometry.js';

/** Physical remote gun controls; the CRT projects the actual ship-space firing ray and enemies. */
export class HammerGunneryRenderer {
  private room = new THREE.Group();
  private outside = new THREE.Group();
  private turret = new THREE.Group();
  private grip = new THREE.Group();
  private gate = new THREE.Group();
  private enemies: { root: THREE.Group; limbs: THREE.InstancedMesh; eyes: THREE.MeshStandardMaterial }[] = [];
  private tracer: THREE.Mesh;
  private flash: THREE.Mesh;
  private screens: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; texture: THREE.CanvasTexture }[] = [];
  private geometry = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.Material>();
  private glow = new THREE.PointLight(0x76afc9, 8, 5, 2);
  private lastScreen = '';

  constructor(root: THREE.Group, cockpit: THREE.Group) {
    root.add(this.outside); cockpit.add(this.room, this.turret);
    this.room.name = 'hammer-gunnery-room'; this.turret.name = 'hammer-stern-turret';
    const metal = this.material(0x596775, .58, .5), frame = this.material(0x879399, .7, .42), rubber = this.material(0x10171b, .06, .85);
    const chair = new THREE.Group(); chair.name = 'ghost-hammer-seat';
    chair.position.set(HAMMER_GUNNERY.seat.x, HAMMER_COCKPIT.floor, HAMMER_GUNNERY.seat.z); this.room.add(chair);
    this.box(chair, [1.38, .22, 1.32], [0, HAMMER_COCKPIT.seat - .11, 0], rubber).name = 'ghost-seat-cushion';
    this.box(chair, [1.28, 1.9, .18], [0, 2.02, -.65], rubber).name = 'ghost-seat-back';
    this.box(chair, [.83, .43, .21], [0, 2.96, -.72], rubber);
    this.box(chair, [.45, .8, .45], [0, .5, 0], metal);
    for (const side of [-1, 1]) {
      this.box(chair, [.16, .12, .92], [side * .77, 1.72, .05], rubber).name = 'ghost-seat-armrest';
      this.box(chair, [.42, .055, .5], [side * .25, .04, 1.14], metal);
    }
    this.gate.name = 'ghost-yoke-hinge'; this.gate.position.set(-.76, 1.86, HAMMER_GUNNERY.grip.z); chair.add(this.gate);
    this.grip.name = 'ghost-hammer-yoke'; this.grip.position.set(.76, 0, 0); this.gate.add(this.grip);
    this.box(this.grip, [.97, .07, .09], [0, .03, 0], frame).name = 'ghost-yoke-bar';
    for (const side of [-1, 1]) {
      const handle = this.mesh(new THREE.CylinderGeometry(.068, .068, .38, 12), rubber, this.grip);
      handle.name = 'hammer-control-grip'; handle.position.set(side * HAMMER_GUNNERY.grip.x, HAMMER_GUNNERY.grip.y - 1.86, 0);
      this.box(this.grip, [.1, .06, .07], [side * .48, .42, .02], frame);
    }
    this.box(chair, [.1, 1.3, .12], [-.76, 1.2, HAMMER_GUNNERY.grip.z], metal);
    this.box(this.gate, [.29, .07, .09], [.145, .03, 0], frame);
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1, upper = i < 2;
      const screen = new THREE.Group(); screen.position.set(side * .81, HAMMER_COCKPIT.floor + (upper ? 2.98 : 1.83), upper ? 14.15 : 13.9); this.room.add(screen);
      this.box(screen, [1.53, .95, .36], [0, 0, 0], metal).name = 'ghost-screen-casing';
      this.box(screen, [1.39, .79, .02], [0, 0, -.19], rubber);
      let material: THREE.Material = this.material(0x365363, .1, .5);
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 480;
        const context = canvas.getContext('2d');
        if (context) {
          const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
          material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }); this.materials.add(material);
          this.screens.push({ canvas, context, texture });
        }
      }
      const face = this.mesh(new THREE.PlaneGeometry(1.34, .74), material, screen); face.rotation.y = Math.PI; face.position.z = -.207; face.name = `hammer-gunnery-screen-${i}`;
      for (let b = 0; b < 5; b++) this.box(screen, [.05, .024, .035], [-.5 + b * .12, -.426, -.196], frame);
    }
    for (const x of [-1.72, 1.72]) {
      this.box(this.room, [.08, 3.5, .1], [x, -.45, 14.41], frame);
      const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 1.3, 14.3), new THREE.Vector3(x, .5, 14.4), new THREE.Vector3(x, -.8, 14.6), new THREE.Vector3(x * .6, -2.1, 14.6)]);
      this.mesh(new THREE.TubeGeometry(cable, 12, .055, 6, false), rubber, this.room);
    }
    this.glow.position.set(0, .5, 12.8); this.room.add(this.glow);
    this.turret.position.set(HAMMER_GUNNERY.muzzle.x, HAMMER_GUNNERY.muzzle.y, HAMMER_GUNNERY.muzzle.z);
    this.mesh(new THREE.SphereGeometry(.3, 16, 10), metal, this.turret);
    for (const x of [-.13, .13]) {
      const barrel = this.mesh(new THREE.CylinderGeometry(.045, .075, .6, 10), rubber, this.turret); barrel.rotation.x = Math.PI / 2; barrel.position.set(x, 0, .29);
    }
    const hot = this.material(0xffcfa1, .1, .45); hot.emissive.setHex(0xff9845); hot.emissiveIntensity = 2;
    this.tracer = this.mesh(new THREE.CylinderGeometry(.02, .02, 1, 5), hot, this.outside); this.tracer.name = 'hammer-gun-tracer';
    this.flash = this.mesh(new THREE.SphereGeometry(.13, 8, 6), hot, this.turret); this.flash.position.z = .6;
    for (let i = 0; i < HAMMER_GUNNERY.waves.length; i++) {
      const enemy = new THREE.Group(); enemy.name = `hammer-gunnery-sentinel-${i}`; this.outside.add(enemy);
      const body = this.mesh(new THREE.SphereGeometry(1, 16, 10), metal, enemy); body.scale.set(.94, .58, 1.14);
      const eyes = this.material(0x990f08, .4, .3); eyes.emissive.setHex(0xff321d); eyes.emissiveIntensity = 1.7;
      for (const x of [-.52, 0, .52]) for (const y of [-.18, .15]) {
        const lens = this.mesh(new THREE.SphereGeometry(.12, 8, 6), eyes, enemy); lens.position.set(x, y, -.99 + Math.abs(x) * .18);
      }
      batchStaticGeometry(enemy, new Set()).forEach(g => this.geometry.add(g));
      const geometry = new THREE.CylinderGeometry(.06, .085, 1, 6); this.geometry.add(geometry);
      const limbs = new THREE.InstancedMesh(geometry, frame, 48); limbs.frustumCulled = false; enemy.add(limbs);
      this.enemies.push({ root: enemy, limbs, eyes });
    }
    batchStaticGeometry(this.room, new Set()).forEach(g => this.geometry.add(g));
  }

  private material(color: number, metalness: number, roughness: number) {
    const material = new THREE.MeshStandardMaterial({ color, metalness, roughness }); this.materials.add(material); return material;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) {
    this.geometry.add(geometry); const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, size: number[], position: number[], material: THREE.Material) {
    const mesh = this.mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material, parent); mesh.position.set(position[0], position[1], position[2]); return mesh;
  }

  update(flight: HammerFlight | undefined, handover?: HammerHandover): void {
    const gun = flight?.gunnery; this.outside.visible = this.turret.visible = Boolean(gun);
    this.gate.rotation.y = !gun && handover?.station ? Math.PI / 2 * (1 - THREE.MathUtils.smoothstep(handover.elapsed, 15.9, 16.3)) : 0;
    this.room.visible = Boolean(gun || handover?.station || handover?.phase === 'waiting');
    if (!flight || !gun) {
      if (this.room.visible && this.lastScreen !== 'standby') {
        this.lastScreen = 'standby';
        this.screens.forEach(({ context: c, texture }) => {
          c.fillStyle = '#07151f'; c.fillRect(0, 0, 768, 480); c.fillStyle = '#9fc9d0'; c.font = '26px monospace';
          c.fillText('HAMMER / AFT FIRE CONTROL', 36, 80); c.fillText('STANDBY', 36, 240); c.fillText('AWAITING PILOT', 36, 310); texture.needsUpdate = true;
        });
      }
      return;
    }
    this.turret.rotation.set(gun.pitch, gun.yaw, 0, 'YXZ');
    const shot = gun.lastShot, flash = Boolean(shot && flight.elapsed - shot.at < .1 && flight.phase === 'riding');
    this.tracer.visible = this.flash.visible = flash;
    if (shot && flash) {
      const from = new THREE.Vector3(shot.from.x, shot.from.y + 1, shot.from.z), to = new THREE.Vector3(shot.to.x, shot.to.y + 1, shot.to.z);
      this.tracer.position.copy(from).add(to).multiplyScalar(.5); this.tracer.scale.y = from.distanceTo(to);
      this.tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    }
    const transform = new THREE.Object3D();
    this.enemies.forEach((enemy, i) => {
      const state = gun.targets[i], age = flight.elapsed - state.spawn;
      enemy.root.visible = age >= 0 && !state.struck && (state.health > 0 || state.downAt !== undefined && flight.elapsed - state.downAt < 1.25);
      if (!enemy.root.visible) return;
      const point = hammerGunneryTarget(flight, i), eye = hammerGunneryView(flight).eye;
      enemy.root.position.set(point.x, point.y + 1, point.z); enemy.root.lookAt(new THREE.Vector3(point.x * 2 - eye.x, point.y * 2 + 1 - eye.y, point.z * 2 - eye.z));
      enemy.eyes.emissiveIntensity = state.health > 0 ? 1.7 : 0;
      for (let arm = 0; arm < 6; arm++) for (let part = 0; part < 8; part++) {
        const angle = arm * Math.PI / 3, pointAt = (j: number) => new THREE.Vector3(
          Math.cos(angle) * (.6 + j * .13) + Math.sin(age * 4 - j * .65 + arm) * j * .045,
          Math.sin(angle) * (.38 + j * .08), .5 + j * .45);
        const a = pointAt(part), b = pointAt(part + 1);
        transform.position.copy(a).add(b).multiplyScalar(.5); transform.scale.set(1, a.distanceTo(b), 1);
        transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); transform.updateMatrix();
        enemy.limbs.setMatrixAt(arm * 8 + part, transform.matrix);
      }
      enemy.limbs.instanceMatrix.needsUpdate = true;
    });
    const key = `${Math.floor(flight.elapsed * 15)}:${gun.yaw.toFixed(3)}:${gun.pitch.toFixed(3)}:${gun.shots}`;
    if (key !== this.lastScreen) { this.lastScreen = key; this.drawScreens(flight); }
  }

  private drawScreens(flight: HammerFlight): void {
    const gun = flight.gunnery!, view = hammerGunneryView(flight);
    const project = (point: { x: number; y: number; z: number }) => {
      const dx = point.x - view.eye.x, dy = point.y - view.eye.y, dz = point.z - view.eye.z;
      const dot = (v: typeof point) => dx * v.x + dy * v.y + dz * v.z, z = dot(view.direction);
      return { x: 384 + dot(view.right) / z * 420, y: 240 - dot(view.up) / z * 420, z };
    };
    this.screens.forEach(({ context: c, texture }, index) => {
      c.fillStyle = '#07151f'; c.fillRect(0, 0, 768, 480); c.strokeStyle = '#294656'; c.lineWidth = 1;
      for (let y = 20; y < 480; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(768, y); c.stroke(); }
      c.font = '22px monospace'; c.fillStyle = '#c4e5e6'; c.fillText(index < 2 ? 'HAMMER / AFT FIRE CONTROL' : 'HULL / WEAPONS TELEMETRY', 24, 36);
      if (index < 2) {
        c.strokeStyle = '#477282';
        for (let d = 20; d < 80; d += 10) {
          const station = 175 - flight.z - d, section = hammerTunnelSection(station); let previous: ReturnType<typeof project> | undefined;
          for (let side = 0; side <= 12; side++) {
            const a = side * Math.PI / 6, p = project(hammerRoutePoint(station, { x: Math.cos(a) * section.width, y: Math.sin(a) * section.height, z: 0 }));
            if (p.z > 1 && previous && previous.z > 1) { c.beginPath(); c.moveTo(previous.x, previous.y); c.lineTo(p.x, p.y); c.stroke(); } previous = p;
          }
        }
        gun.targets.forEach((target, i) => {
          if (target.spawn > flight.elapsed || target.struck || target.health <= 0) return;
          const p = project(hammerGunneryTarget(flight, i)); if (p.z <= 0 || p.x < -50 || p.x > 818 || p.y < -50 || p.y > 530) return;
          const radius = Math.min(65, 420 * HAMMER_GUNNERY.radius / p.z);
          c.strokeStyle = '#fc795d'; c.lineWidth = 2; c.strokeRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
          c.fillStyle = '#fc795d'; c.fillText(`${i + 1} / ${target.health}`, p.x + radius + 5, p.y);
        });
        c.strokeStyle = '#c9f5e3'; c.lineWidth = 2; c.beginPath();
        c.moveTo(353, 240); c.lineTo(375, 240); c.moveTo(393, 240); c.lineTo(415, 240);
        c.moveTo(384, 209); c.lineTo(384, 231); c.moveTo(384, 249); c.lineTo(384, 271); c.stroke();
        c.fillStyle = '#b7dce0'; c.fillText(`AZ ${(gun.yaw * 180 / Math.PI).toFixed(0)}  EL ${(-gun.pitch * 180 / Math.PI).toFixed(0)}`, 24, 445);
      } else {
        const rows = [`HULL INTEGRITY   ${Math.ceil(flight.hull)}%`, `ROUNDS REMAIN   ${gun.ammo}`, `TARGETS DOWN    ${gun.kills}`, `DISTANCE        ${Math.max(0, Math.round(flight.z + 175))} M`, flight.antennaLost ? 'EXTERNAL COMMS  OFFLINE' : 'EXTERNAL COMMS  ONLINE'];
        rows.forEach((line, i) => { c.fillStyle = i === 4 && flight.antennaLost ? '#eb986e' : '#9fc9d0'; c.fillText(line, 36, 102 + i * 64); });
      }
      texture.needsUpdate = true;
    });
  }

  dispose(): void {
    this.glow.dispose();
    this.room.removeFromParent(); this.outside.removeFromParent(); this.turret.removeFromParent();
    this.geometry.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); this.screens.forEach(s => s.texture.dispose());
  }
}
