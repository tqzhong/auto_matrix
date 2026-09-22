import * as THREE from 'three';
import type { AgentState, SandboxState, SandboxThreat, WorldNode, WorldStructure, WorldIncident, Vector3, CombatImpact } from '@auto_matrix/shared';
import { CharacterModels, weaponMuzzle, type CharacterRig } from '../agents/CharacterModel.js';
import { newMotion } from '../agents/CharacterMotion.js';

type WorldObject = WorldNode | WorldStructure | WorldIncident;
interface Prop { group: THREE.Group; label: THREE.Sprite; data: WorldObject; accent: THREE.Mesh; }
interface Enemy { group: THREE.Group; rig?: CharacterRig; kind: SandboxThreat['kind'] | 'escort'; character?: string; health: THREE.Mesh; label: THREE.Sprite; target: THREE.Vector3; telegraph: THREE.Mesh; aimLine: THREE.Line; hit?: number; impact?: number; shot?: number; fallen?: number; facing: number; }

export class SandboxRenderer {
  private state?: SandboxState;
  private props = new Map<string, Prop>();
  private enemies = new Map<string, Enemy>();
  private pool: Enemy[] = [];
  private models = new CharacterModels();
  private geometries: THREE.BufferGeometry[] = [];
  private textures = new Set<THREE.Texture>();
  private box = this.geometry(new THREE.BoxGeometry(1, 1, 1));
  private cylinder = this.geometry(new THREE.CylinderGeometry(1, 1, 1, 16));
  private orb = this.geometry(new THREE.SphereGeometry(1, 12, 8));
  private diamond = this.geometry(new THREE.OctahedronGeometry(1));
  private metal = new THREE.MeshStandardMaterial({ color: 0x253c35, metalness: .65, roughness: .4 });
  private dark = new THREE.MeshStandardMaterial({ color: 0x111c19, metalness: .3, roughness: .6 });
  private green = new THREE.MeshBasicMaterial({ color: 0xa5e4b5 });
  private amber = new THREE.MeshBasicMaterial({ color: 0xe6c48c });
  private red = new THREE.MeshBasicMaterial({ color: 0xf28b7a });
  private blue = new THREE.MeshBasicMaterial({ color: 0x81cfdd });
  private warning = new THREE.MeshBasicMaterial({ color: 0xf6b177, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  private warningRing = this.geometry(new THREE.RingGeometry(.94, 1, 48));
  private aimMaterial = new THREE.LineBasicMaterial({ color: 0xda9975, transparent: true, opacity: .3, depthWrite: false });
  private elapsed = 0;
  private fallen: Enemy[] = [];
  private actors: Record<string, AgentState> = {};

  constructor(private scene: THREE.Scene) {}
  private geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.push(value); return value; }
  private mesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, position: number[], scale: number[]): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(position[0], position[1], position[2]); mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = material === this.metal || material === this.dark; group.add(mesh); return mesh;
  }
  private label(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#071510dd'; ctx.fillRect(0, 0, 512, 96); ctx.fillStyle = color; ctx.fillRect(0, 0, 4, 96);
    ctx.font = '24px "PingFang SC", sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 48, 480);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  }
  private prop(data: WorldObject): Prop {
    const group = new THREE.Group();
    const isStructure = data.kind === 'beacon' || data.kind === 'barricade';
    const material = data.kind === 'mission' ? this.amber : data.kind === 'raid' ? this.red : data.kind === 'terminal' || data.kind === 'glitch' ? this.blue : this.green;
    let accent: THREE.Mesh;
    if (data.kind === 'cache') {
      this.mesh(group, this.box, this.metal, [0, .8, 0], [3.6, 1.6, 2.6]);
      this.mesh(group, this.box, this.dark, [0, 1.7, 0], [3.8, .3, 2.8]);
      accent = this.mesh(group, this.box, this.amber, [0, 1.25, 1.32], [2.7, .16, .06]);
      for (const x of [-1.4, 1.4]) this.mesh(group, this.box, this.metal, [x, 1.8, 0], [.25, .15, 3]);
    } else if (data.kind === 'barricade') {
      this.mesh(group, this.box, this.metal, [0, 1.4, 0], [8, 2.8, 2.4]);
      for (const x of [-2.8, 0, 2.8]) this.mesh(group, this.box, this.dark, [x, 1.4, 1.23], [1, 2.7, .1]).rotation.z = .35;
      accent = this.mesh(group, this.box, this.amber, [0, 2.75, 0], [8, .18, 2.6]);
    } else if (data.kind === 'beacon') {
      for (const x of [-4.5, 4.5]) for (const z of [-3, 3]) this.mesh(group, this.box, this.metal, [x, 3, z], [.3, 6, .3]);
      this.mesh(group, this.box, this.dark, [0, 6, 0], [10, .4, 7]);
      this.mesh(group, this.box, this.metal, [0, .4, 0], [9, .4, 6]);
      this.mesh(group, this.box, this.dark, [-2.5, 1, 0], [2.2, .7, 4.6]);
      this.mesh(group, this.box, this.metal, [2.5, 2, -1], [1, 3, 1]);
      accent = this.mesh(group, this.box, this.green, [0, 5.7, 3.4], [8.5, .12, .12]);
    } else if (data.kind === 'phone') {
      for (const x of [-1.4, 1.4]) this.mesh(group, this.box, this.metal, [x, 2.8, 0], [.2, 5.6, 2]);
      this.mesh(group, this.box, this.dark, [0, 3.1, -.8], [2.9, 5.3, .2]);
      this.mesh(group, this.box, this.metal, [0, 3.2, -.2], [1.1, 1.8, .8]);
      this.mesh(group, this.box, this.green, [0, 3.6, .25], [.7, .55, .05]);
      accent = this.mesh(group, this.box, this.green, [0, 5.7, 0], [3.1, .3, 2.3]);
    } else if (data.kind === 'terminal' || data.kind === 'mission') {
      this.mesh(group, this.cylinder, this.metal, [0, .3, 0], [1.8, .5, 1.8]);
      this.mesh(group, this.box, this.dark, [0, 1.8, 0], [2.3, 3.1, 1.2]);
      accent = this.mesh(group, this.box, material, [0, 2.8, .65], [1.8, 1.1, .06]);
      for (let i = 0; i < 4; i++) this.mesh(group, this.box, this.dark, [0, 2.5 + i * .18, .7], [1.6, .055, .02]);
      if (data.kind === 'mission') this.mesh(group, this.diamond, material, [0, 5.5, 0], [.75, 1.3, .75]);
    } else {
      this.mesh(group, this.cylinder, this.metal, [0, .3, 0], [2.5, .5, 2.5]);
      accent = this.mesh(group, this.diamond, material, [0, 3, 0], [1.2, 2.2, 1.2]);
    }
    const name = isStructure ? data.kind === 'beacon' ? '安全屋 · 恢复 / 接入' : '路障 · 阻挡追兵' : (data as WorldNode | WorldIncident).name;
    const label = this.label(name, data.kind === 'mission' ? '#e8cea1' : '#b5d5b7'); label.position.y = data.kind === 'beacon' ? 8 : 7;
    group.add(label); group.position.set(data.position.x, data.position.y - 1, data.position.z); this.scene.add(group);
    return { group, label, data, accent: accent! };
  }
  sync(state: SandboxState, agents: Record<string, AgentState>): void {
    if (state === this.state) return;
    this.state = state;
    this.actors = agents;
    const objects = [...state.nodes, ...state.structures.filter(s => !s.film), ...state.incidents]; const ids = new Set(objects.map(object => object.id));
    for (const [id, prop] of this.props) if (!ids.has(id)) { this.scene.remove(prop.group); this.disposeLabel(prop.label); this.props.delete(id); }
    for (const object of objects) {
      if (!this.props.has(object.id)) this.props.set(object.id, this.prop(object));
      this.props.get(object.id)!.data = object;
    }
    const enemyIds = new Set(state.threats.map(threat => threat.id));
    for (const [id, mission] of Object.entries(state.missions)) if (mission.escort) enemyIds.add(`escort:${id}`);
    for (const [id, enemy] of this.enemies) if (!enemyIds.has(id)) {
      this.enemies.delete(id);
      if (enemy.fallen !== undefined) this.fallen.push(enemy);
      else { this.scene.remove(enemy.group); this.pool.push(enemy); }
    }
    for (const threat of state.threats) this.updateEnemy(threat.id, threat.kind, threat.position, threat.health / threat.maxHealth, agents, threat.character);
    for (const [id, mission] of Object.entries(state.missions)) if (mission.escort) this.updateEnemy(`escort:${id}`, 'escort', mission.escort.position, mission.escort.health / 100, agents);
  }
  private updateEnemy(id: string, kind: Enemy['kind'], position: Vector3, health: number, agents: Record<string, AgentState>, character?: string): void {
    let enemy = this.enemies.get(id);
    if (!enemy) {
      const reuse = this.pool.findIndex(entry => entry.kind === kind && entry.character === character);
      if (reuse >= 0) enemy = this.pool.splice(reuse, 1)[0];
      else {
        const group = new THREE.Group(); let rig: CharacterRig | undefined;
        if (kind === 'sentinel') {
          this.mesh(group, this.orb, this.metal, [0, 3.5, 0], [1.8, 1.2, 2.3]);
          for (let i = 0; i < 5; i++) this.mesh(group, this.orb, this.red, [(i - 2) * .45, 3.6, 2], [.16, .16, .16]);
          for (let i = 0; i < 6; i++) {
            const angle = i / 6 * Math.PI * 2;
            const points = [new THREE.Vector3(Math.cos(angle), 3, Math.sin(angle)), new THREE.Vector3(Math.cos(angle) * 2, 1.3, -2), new THREE.Vector3(Math.cos(angle) * 3, .5, -4)];
            this.mesh(group, this.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, .13, 5, false)), this.metal, [0, 0, 0], [1, 1, 1]);
          }
        } else {
          const base = agents[character ?? (kind === 'escort' ? 'keymaker' : 'smith')] ?? agents.neo;
          if (!base) return;
          rig = this.models.create({ ...base, id: character ?? (kind === 'soldier' ? 'film_soldier' : kind === 'escort' ? 'keymaker' : 'smith'),
            appearance: kind === 'soldier' ? { ...base.appearance, clothing: '#172121' } : base.appearance }); rig.root.position.y = -1; group.add(rig.root);
          if (kind === 'soldier') {
            this.mesh(rig.head, this.orb, this.dark, [0, .12, -.03], [.32, .3, .28]);
            this.mesh(rig.head, this.orb, this.dark, [0, -.18, .20], [.22, .13, .08]);
            this.mesh(rig.torso, this.box, this.dark, [0, .8, .29], [.9, .95, .25]);
            for (const x of [-.28, 0, .28]) this.mesh(rig.torso, this.box, this.metal, [x, .58, .44], [.2, .34, .09]);
          }
          if (kind === 'smith' && !character) rig.root.scale.multiplyScalar(1.18);
        }
        const bar = this.mesh(group, this.box, kind === 'escort' ? this.green : this.red, [0, 6.4, 0], [4, .15, .15]);
        const label = this.label(character ? `${agents[character]?.name ?? character}${kind === 'training' ? ' · 对练' : ''}` : ({ agent: '追踪特工', sentinel: '乌贼', smith: 'SMITH / 病毒核心', training: '武术训练程序', soldier: '武装警卫', escort: '钥匙匠 · 留在附近护送' })[kind], kind === 'escort' ? '#c9e8ad' : '#f2aa99');
        label.position.y = 7.1; group.add(label);
        const telegraph = this.mesh(group, this.warningRing, this.warning, [0, -.94, 0], [2.8, 2.8, 2.8]); telegraph.rotation.x = -Math.PI / 2; telegraph.visible = false;
        const aimLine = new THREE.Line(this.geometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])), this.aimMaterial); aimLine.visible = false; group.add(aimLine);
        enemy = { group, rig, kind, character, health: bar, label, target: new THREE.Vector3(), telegraph, aimLine, facing: 0 };
      }
      enemy.group.position.set(position.x, position.y, position.z); enemy.group.rotation.set(0, 0, 0); enemy.group.scale.setScalar(1);
      enemy.fallen = undefined; enemy.hit = enemy.impact = enemy.shot = undefined; enemy.health.visible = true;
      if (enemy.rig) { enemy.rig.motion = newMotion(); enemy.rig.root.rotation.set(0, 0, 0); }
      this.scene.add(enemy.group); this.enemies.set(id, enemy);
    }
    enemy.target.set(position.x, position.y, position.z);
    enemy.health.scale.x = Math.max(.01, health) * 4;
  }
  muzzle(id: string): THREE.Vector3 | undefined { const rig = this.enemies.get(id)?.rig; return rig ? weaponMuzzle(rig) : undefined; }
  impact(hit: CombatImpact): void {
    const enemy = this.enemies.get(hit.target); const source = this.enemies.get(hit.source);
    if (enemy) { enemy.hit = performance.now(); if (hit.downed) enemy.fallen = 0; }
    if (source) source.impact = performance.now();
    if (source && hit.shot) source.shot = performance.now();
  }
  update(delta: number, camera: THREE.Camera, matrix: boolean, tick: number, running: boolean): void {
    if (running) this.elapsed += delta;
    if (!this.state) return;
    for (const prop of this.props.values()) {
      const dist = camera.position.distanceTo(prop.group.position);
      const mission = prop.data.kind === 'mission' ? this.state.missions[prop.data.id.slice(8)] : undefined;
      prop.group.visible = prop.data.matrix === matrix && dist < 360 && mission?.status !== 'locked';
      const ready = !('availableAt' in prop.data) || prop.data.availableAt <= tick;
      prop.accent.visible = ready && mission?.status !== 'complete';
      prop.label.visible = dist < 55 && dist > 20;
      const width = Math.min(12, Math.max(3, dist * .14)); prop.label.scale.set(width, width / 5.33, 1);
      if (prop.accent.geometry === this.diamond) prop.accent.rotation.y = this.elapsed * .65;
    }
    for (const [id, enemy] of this.enemies) {
      const threat = this.state.threats.find(t => t.id === id);
      enemy.group.visible = (threat?.matrix ?? true) === matrix;
      const difference = enemy.target.clone().sub(enemy.group.position);
      const actor = threat ? this.actors[threat.target] : undefined;
      const aim = threat?.aim ?? actor?.position;
      const toward = aim ? new THREE.Vector3(aim.x, aim.y, aim.z).sub(enemy.group.position) : difference;
      if (toward.lengthSq() > .01) enemy.facing = Math.atan2(toward.x, toward.z);
      if (threat?.patrol) enemy.facing = threat.yaw ?? 0;
      if (enemy.rig) {
        const turn = Math.atan2(Math.sin(enemy.facing - enemy.rig.root.rotation.y), Math.cos(enemy.facing - enemy.rig.root.rotation.y));
        enemy.rig.root.rotation.y += turn * (1 - Math.exp(-12 * delta));
      }
      const previous = enemy.group.position.clone();
      enemy.group.position.lerp(enemy.target, running ? 1 - Math.exp(-8 * delta) : 0);
      const dist = enemy.group.position.distanceTo(camera.position);
      if (enemy.rig) this.models.animate(enemy.rig, running ? delta : 0, { speed: Math.min(8.4, previous.distanceTo(enemy.group.position) / Math.max(.001, delta)), grounded: true, verticalVelocity: 0, turn: 0,
        attack: enemy.kind !== 'soldier' && threat && tick - threat.lastStrike < 3 ? threat.lastStrike : undefined, armed: enemy.kind === 'soldier', shot: enemy.shot, combo: threat?.combo ?? 0, windingUp: threat?.attackAt !== undefined, hit: enemy.hit, impact: enemy.impact }, dist);
      enemy.label.visible = !threat?.patrol && dist < (enemy.kind === 'soldier' ? 30 : 65); enemy.label.scale.set(enemy.kind === 'soldier' ? 3 : 5, enemy.kind === 'soldier' ? .56 : .94, 1);
      enemy.health.visible = !threat?.patrol;
      enemy.health.quaternion.copy(camera.quaternion);
      enemy.health.scale.y = threat?.attackAt !== undefined ? .28 + Math.sin(this.elapsed * 22) * .06 : .15;
      enemy.health.material = threat?.infection ? this.green : threat && threat.stunUntil > tick ? this.blue : enemy.kind === 'escort' ? this.green : this.red;
      enemy.telegraph.visible = threat?.attackAt !== undefined;
      enemy.aimLine.visible = Boolean(threat?.aim && threat.attackAt !== undefined);
      if (threat?.aim) {
        const points = enemy.aimLine.geometry.attributes.position;
        points.setXYZ(0, 0, 2.3, 0); points.setXYZ(1, threat.aim.x - enemy.group.position.x, threat.aim.y - enemy.group.position.y, threat.aim.z - enemy.group.position.z); points.needsUpdate = true;
        enemy.aimLine.geometry.computeBoundingSphere();
      }
      enemy.telegraph.scale.setScalar(2.8 + Math.sin(this.elapsed * 20) * .15);
    }
    for (let i = this.fallen.length - 1; i >= 0; i--) {
      const enemy = this.fallen[i]; enemy.fallen! += running ? delta : 0;
      const age = enemy.fallen!; enemy.health.visible = enemy.label.visible = enemy.telegraph.visible = enemy.aimLine.visible = false;
      enemy.group.rotation.y = enemy.facing;
      if (enemy.rig) enemy.rig.root.rotation.y = 0;
      enemy.group.rotation.x = -Math.min(Math.PI / 2, age * 4);
      enemy.group.position.y = enemy.target.y - Math.min(.65, age);
      if (age > .65) enemy.group.scale.setScalar(Math.max(.001, 1 - (age - .65) * 3));
      if (age > 1) { this.scene.remove(enemy.group); this.pool.push(enemy); this.fallen.splice(i, 1); }
    }
  }
  private disposeLabel(sprite: THREE.Sprite): void { const map = sprite.material.map; if (map) { map.dispose(); this.textures.delete(map); } sprite.material.dispose(); }
  dispose(): void {
    for (const prop of this.props.values()) { this.scene.remove(prop.group); this.disposeLabel(prop.label); }
    for (const enemy of [...this.enemies.values(), ...this.pool, ...this.fallen]) { this.scene.remove(enemy.group); this.disposeLabel(enemy.label); }
    this.geometries.forEach(geometry => geometry.dispose());
    [this.metal, this.dark, this.green, this.amber, this.red, this.blue, this.warning, this.aimMaterial].forEach(material => material.dispose());
    this.models.dispose(); this.props.clear(); this.enemies.clear(); this.pool = [];
  }
}
