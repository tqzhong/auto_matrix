import * as THREE from 'three';
import { groundHeight, type AgentState, type CombatImpact } from '@auto_matrix/shared';
import { CharacterModels, weaponMuzzle, type CharacterRig } from './CharacterModel.js';
import type { MotionInput } from './CharacterMotion.js';

export const FACTION_COLORS: Record<string, string> = {
  zion: '#90d7b1', civilians: '#d0c8a3', machines: '#ee8773', oracle: '#c6b1e7', merovingian: '#cda96c', exiles: '#88b5c5', smith_virus: '#f07565',
};
interface Entry {
  group: THREE.Group;
  body: THREE.Group;
  rig: CharacterRig;
  marker: THREE.Mesh;
  label: THREE.Sprite;
  state: AgentState;
  time: number;
  shadow: THREE.Mesh;
  hit?: number;
  impact?: number;
  shot?: number;
  speech?: { sprite: THREE.Sprite; age: number };
}

export class AgentRenderer {
  private agents = new Map<string, Entry>();
  private selected: string | null = null;
  private playerId: string | null = null;
  private firstPerson = false;
  private matrix = true;
  private playerMotion?: MotionInput;
  private models = new CharacterModels();
  private markerGeometry = new THREE.RingGeometry(2.1, 2.5, 32);
  private shadowGeometry = new THREE.PlaneGeometry(3, 3);
  private shadowTexture: THREE.CanvasTexture;
  private shadowMaterial: THREE.MeshBasicMaterial;

  constructor(private scene: THREE.Scene) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!; const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    gradient.addColorStop(0, '#00000090'); gradient.addColorStop(.45, '#00000045'); gradient.addColorStop(1, '#00000000');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    this.shadowTexture = new THREE.CanvasTexture(canvas);
    this.shadowMaterial = new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: .55, depthWrite: false, toneMapped: false });
  }

  updateAgent(id: string, state: AgentState): void {
    let entry = this.agents.get(id);
    if (!entry) {
      const group = new THREE.Group();
      const rig = this.models.create(state);
      const body = rig.root;
      body.position.y = -1;
      const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.97;
      const color = FACTION_COLORS[state.faction] ?? '#91cfb0';
      const marker = new THREE.Mesh(this.markerGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.1;
      group.add(body, marker, shadow);
      const label = this.label(state.name, color, false);
      label.position.y = 7;
      group.add(label);
      group.position.set(state.position.x, state.position.y, state.position.z);
      this.scene.add(group);
      entry = { group, body, rig, marker, label, state, time: 0, shadow };
      this.agents.set(id, entry);
    }
    entry.state = state;
    entry.group.visible = state.isInMatrix === this.matrix && state.status !== 'disconnected';
  }

  setSelected(id: string | null): void { this.selected = id; }
  setPlayer(id: string | null, firstPerson = false): void { this.playerId = id; this.firstPerson = firstPerson; }
  setPlayerMotion(motion: MotionInput): void { this.playerMotion = motion; }
  setWorld(matrix: boolean): void {
    this.matrix = matrix;
    for (const entry of this.agents.values()) entry.group.visible = entry.state.isInMatrix === matrix;
  }
  getAgent(id: string): THREE.Group | null { return this.agents.get(id)?.group ?? null; }
  getAgentState(id: string): AgentState | null { return this.agents.get(id)?.state ?? null; }
  getAgentIds(): string[] { return [...this.agents.keys()]; }
  muzzle(id: string): THREE.Vector3 | undefined { const entry = this.agents.get(id); return entry ? weaponMuzzle(entry.rig) : undefined; }
  updateActionIndicator(_id: string, _type: string): void {}
  impact(hit: CombatImpact): void {
    const target = this.agents.get(hit.target); const source = this.agents.get(hit.source);
    if (target) target.hit = performance.now();
    if (source) source.impact = performance.now();
    if (source && hit.shot) source.shot = performance.now();
  }

  update(delta: number, camera?: THREE.Camera, speed = 1, tick = 0): void {
    for (const [id, entry] of this.agents) {
      const state = entry.state;
      entry.body.visible = (id !== this.playerId || !this.firstPerson || this.playerMotion?.inspecting === true) && state.status !== 'disconnected' && !state.currentAction?.parameters.filmDuel;
      const warning = state.currentAction?.type === 'attack' && state.currentAction.target === this.playerId && Number(state.currentAction.parameters.contactTick ?? 0) > tick;
      entry.marker.visible = warning || !this.playerId || id === this.selected;
      (entry.marker.material as THREE.MeshBasicMaterial).color.set(warning ? '#f6b177' : FACTION_COLORS[state.faction] ?? '#91cfb0');
      entry.marker.position.y = this.playerId ? -.94 : .1;
      entry.time += delta * (id === this.playerId ? 1 : speed);
      if (id !== this.playerId) {
        const target = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
        const driver = this.playerId ? this.agents.get(this.playerId) : undefined;
        if (state.currentAction?.parameters.passenger && driver?.state.currentAction?.parameters.riding) {
          target.sub(new THREE.Vector3(driver.state.position.x, driver.state.position.y, driver.state.position.z)).add(driver.group.position);
          entry.group.position.copy(target);
        } else if (state.currentAction?.parameters.meeting || state.currentAction?.parameters.pills || state.currentAction?.parameters.interrogation || state.currentAction?.parameters.welcome || entry.group.position.distanceTo(target) > 60) entry.group.position.copy(target);
        else entry.group.position.lerp(target, 1 - Math.exp(-8 * delta));
      }
      const moving = Math.hypot(state.velocity.x, state.velocity.z) > .1;
      const heading = moving && state.currentLocation !== 'film_government_lobby' ? Math.atan2(state.velocity.x, state.velocity.z) : state.rotation;
      let difference = heading - entry.body.rotation.y;
      difference = Math.atan2(Math.sin(difference), Math.cos(difference));
      if (id !== this.playerId) entry.body.rotation.y += difference * (state.currentAction?.parameters.meeting || state.currentAction?.parameters.pills || state.currentAction?.parameters.interrogation || state.currentAction?.parameters.welcome ? 1 : 1 - Math.exp(-10 * delta));
      const velocity = state.status === 'alive' ? Math.hypot(state.velocity.x, state.velocity.z) : 0;
      entry.body.rotation.z = THREE.MathUtils.lerp(entry.body.rotation.z, state.status === 'dead' ? Math.PI / 2 : 0, 1 - Math.exp(-7 * delta));
      const dist = camera ? entry.group.position.distanceTo(camera.position) : 0;
      const floor = groundHeight(state.position, state.isInMatrix);
      const input: MotionInput = id === this.playerId && this.playerMotion ? this.playerMotion : {
        speed: velocity, grounded: Boolean(state.currentAction?.parameters.riding || state.currentAction?.parameters.climbing) || state.position.y <= floor + .12, verticalVelocity: state.velocity.y,
        turn: difference * 8, attack: state.currentAction?.type === 'attack' ? Number(state.currentAction.parameters.contactTick ?? state.currentAction.startedAt) : undefined,
        hit: entry.hit, impact: entry.impact, shot: entry.shot, windingUp: warning,
        armed: state.currentLocation === 'film_government_lobby' && ['neo', 'trinity'].includes(id),
        crouching: state.currentAction?.parameters.crouching === true,
        seated: state.currentAction?.parameters.seated === true,
        floorSeated: state.currentAction?.parameters.floorSeated === true,
        spoon: state.currentAction?.parameters.spoon as number | undefined,
        phone: state.currentAction?.parameters.phone as MotionInput['phone'],
        window: state.currentAction?.parameters.window as number | undefined,
        crossing: state.currentAction?.parameters.crossing as number | undefined,
        pills: state.currentAction?.parameters.pills as MotionInput['pills'],
        interrogation: state.currentAction?.parameters.interrogation as MotionInput['interrogation'],
        meeting: state.currentAction?.parameters.meeting as MotionInput['meeting'],
        welcome: state.currentAction?.parameters.welcome as MotionInput['welcome'],
        knock: state.currentAction?.parameters.knock as number | undefined,
        recovery: state.currentAction?.parameters.recovery as number | undefined,
        vase: state.currentAction?.parameters.vase as number | undefined,
        riding: state.currentAction?.parameters.riding === true,
        climbing: state.currentAction?.parameters.climbing ? Number(state.currentAction.parameters.climbDirection ?? 0) : undefined,
      };
      input.realWorld = !state.isInMatrix;
      input.officeShirt = state.id === 'neo' && state.currentLocation === 'film_agent_interrogation';
      input.glasses = state.id !== 'neo' || state.isAwakened && state.currentLocation !== 'film_oracle_home';
      this.models.animate(entry.rig, delta * (id === this.playerId && speed > 0 ? 1 : speed), input, dist);
      entry.shadow.position.y = floor - entry.group.position.y - .97;
      entry.shadow.visible = state.status !== 'disconnected' && !state.currentAction?.parameters.filmDuel;
      entry.shadow.scale.setScalar(1 + Math.max(0, entry.group.position.y - floor) * .04);
      const selected = id === this.selected;
      entry.label.visible = id !== this.playerId && state.status === 'alive' && !state.currentAction?.parameters.filmDuel && (selected || (!this.playerId && dist < 90 && (['neo', 'trinity', 'smith', 'morpheus'].includes(id) || state.currentAction?.type === 'talk_to')));
      const labelWidth = this.playerId ? Math.min(7, Math.max(2.5, dist * 0.13)) : 17;
      entry.label.scale.set(labelWidth, labelWidth / 4, 1);
      entry.label.position.y = this.playerId ? 4.4 : 7;
      entry.label.material.depthTest = this.playerId !== null;
      entry.marker.scale.setScalar((selected ? 1.8 : 1) * Math.max(1, dist / 180));
      if (this.playerId) entry.marker.scale.setScalar(0.65);
      (entry.marker.material as THREE.MeshBasicMaterial).opacity = state.status === 'dead' ? 0.2 : selected ? 1 : 0.65;
      if (entry.speech) {
        entry.speech.age += delta;
        entry.speech.sprite.visible = !this.playerId && (dist < 240 || selected);
        if (entry.speech.age > 8) { this.disposeSprite(entry.speech.sprite); entry.speech = undefined; }
      }
    }
  }

  showSpeechBubble(id: string, _name: string, text: string): void {
    const entry = this.agents.get(id);
    if (!entry) return;
    if (entry.speech) this.disposeSprite(entry.speech.sprite);
    const sprite = this.label(text, '#d7eadb', true);
    sprite.position.y = 12;
    entry.group.add(sprite);
    entry.speech = { sprite, age: 0 };
  }

  private label(text: string, color: string, bubble: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = bubble ? 512 : 256; canvas.height = bubble ? 150 : 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(4, 15, 11, 0.86)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = bubble ? '#325244' : '#395e4b'; ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.fillStyle = color; ctx.font = bubble ? '22px sans-serif' : '22px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (bubble) {
      const characters = [...text.slice(0, 64)];
      for (let i = 0; i < 3; i++) ctx.fillText(characters.slice(i * 20, i * 20 + 20).join(''), 256, 30 + i * 40, 480);
    } else ctx.fillText(text, 128, 32, 240);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }));
    sprite.scale.set(bubble ? 30 : 17, bubble ? 9 : 4.25, 1);
    return sprite;
  }
  private disposeSprite(sprite: THREE.Sprite): void {
    sprite.removeFromParent(); sprite.material.map?.dispose(); sprite.material.dispose();
  }
  removeAgent(id: string): void {
    const entry = this.agents.get(id);
    if (!entry) return;
    this.scene.remove(entry.group);
    this.disposeSprite(entry.label);
    if (entry.speech) this.disposeSprite(entry.speech.sprite);
    (entry.marker.material as THREE.Material).dispose();
    this.agents.delete(id);
  }
  dispose(): void {
    for (const id of this.agents.keys()) this.removeAgent(id);
    this.models.dispose(); this.markerGeometry.dispose(); this.shadowGeometry.dispose(); this.shadowMaterial.dispose(); this.shadowTexture.dispose();
  }
}
