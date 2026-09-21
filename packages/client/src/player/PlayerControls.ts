import * as THREE from 'three';
import { groundHeight, playerBlocked, stepPlayer, MELEE_COMBO, COMBO_WINDOW, COMBAT_SKILLS, combatDisplace, PLAYER_WALK_SPEED, meleeReach, type AgentState, type PlayerInput, type Vector3, type WorldStructure, type CombatImpact, type SkillCast } from '@auto_matrix/shared';
import type { MotionInput } from '../agents/CharacterMotion.js';

export class PlayerControls {
  id: string | null = null;
  firstPerson = false;
  private keys = new Set<string>();
  private yaw = 0;
  private movementYaw = 0;
  private movementForward = 0;
  private movementRight = 0;
  private lastLook = -1000;
  private pitch = 0.24;
  private position: Vector3 = { x: 0, y: 1, z: 0 };
  private vy = 0;
  private planar = { x: 0, z: 0 };
  private sequence = 0;
  private lastSent = 0;
  private localJump = false;
  private networkJump = false;
  private dragging = false;
  private authoritative?: AgentState;
  private enabled = true;
  private running = true;
  private facing = 0;
  private lastAttack = -1000;
  private attackCombo = 0;
  private attackYaw = 0;
  private attackQueuedUntil = 0;
  private impactAge = 10;
  private impactStrength = 0;
  private impulse?: { direction: Vector3; remaining: number; speed: number };
  private cameraReady = false;
  private cameraTarget = new THREE.Vector3();
  private cameraStep = 0;
  readonly motion: MotionInput = { speed: 0, verticalVelocity: 0, grounded: true, turn: 0 };
  onViewChange?: (firstPerson: boolean) => void;
  onMenu?: () => void;
  onPanel?: (panel: 'inventory' | 'journal' | 'map') => void;
  onClosePanel?: () => boolean;
  onHUD?: () => void;
  structures: WorldStructure[] = [];
  targets: Vector3[] = [];

  constructor(private canvas: HTMLCanvasElement, private camera: THREE.PerspectiveCamera,
    private send: (input: PlayerInput) => void, private action: (kind: string) => void) {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    document.addEventListener('mousemove', this.mouseMove);
    canvas.addEventListener('mousedown', this.mouseDown);
    window.addEventListener('mouseup', this.mouseUp);
    canvas.addEventListener('click', this.click);
  }

  possess(state: AgentState): void {
    this.id = state.id; this.position = { ...state.position }; this.yaw = state.rotation;
    this.movementYaw = this.yaw; this.movementForward = 0; this.movementRight = 0;
    this.lastLook = -1000; this.dragging = false;
    this.facing = state.rotation; this.cameraReady = false; this.motion.attack = undefined;
    this.lastAttack = -1000; this.attackQueuedUntil = 0; this.attackCombo = 0;
    this.motion.hit = this.motion.impact = undefined; this.impactAge = 10;
    this.motion.cast = undefined; this.motion.skill = undefined; this.impulse = undefined;
    this.vy = 0; this.planar = { x: 0, z: 0 }; this.authoritative = state; this.firstPerson = false; this.enabled = true;
    this.keys.clear(); this.lastSent = 0; this.sequence = 0;
    this.camera.fov = 57; this.camera.updateProjectionMatrix();
    this.onViewChange?.(false);
  }
  release(): void {
    this.id = null; this.keys.clear(); this.enabled = true;
    this.camera.fov = 48; this.camera.updateProjectionMatrix();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) { this.planar = { x: 0, z: 0 }; this.blur(); }
  }
  lockPointer(): void {
    if (!this.id) return;
    const request = this.canvas.requestPointerLock?.();
    if (request && typeof request.catch === 'function') void request.catch(() => {});
  }
  private keyDown = (event: KeyboardEvent): void => {
    if (!this.id || (event.target as HTMLElement).matches('input, textarea')) return;
    if (event.code === 'Escape' || event.code === 'Tab') {
      event.preventDefault(); this.blur();
      const closed = this.onClosePanel?.();
      if (!closed || event.code === 'Tab') this.onMenu?.();
      return;
    }
    if (!event.repeat && ['KeyB', 'KeyJ', 'KeyM'].includes(event.code)) {
      event.preventDefault(); this.onPanel?.(event.code === 'KeyB' ? 'inventory' : event.code === 'KeyJ' ? 'journal' : 'map'); return;
    }
    if (!this.enabled) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault(); this.keys.add(event.code);
    }
    if (!event.repeat) {
      if (event.code === 'Space') { this.localJump = true; this.networkJump = true; }
      if (event.code === 'KeyE') this.action('talk');
      if (event.code === 'KeyF') this.requestAttack();
      if (event.code === 'KeyH') this.onHUD?.();
      if (['KeyQ', 'KeyC', 'KeyX'].includes(event.code) && this.running && this.authoritative?.status === 'alive') {
        this.send(this.input(false)); this.action(event.code === 'KeyQ' ? 'ability' : event.code === 'KeyC' ? 'ability2' : 'dodge');
      }
      if (event.code === 'KeyR') this.action('travel');
      if (event.code === 'KeyG') this.action('interact');
      if (event.code === 'Digit1') this.action('medkit');
      if (event.code === 'Digit2') this.action('emp');
      if (event.code === 'Digit3') this.action('beacon');
      if (event.code === 'Digit4') this.action('barricade');
      if (event.code === 'KeyV') {
        this.firstPerson = !this.firstPerson;
        this.onViewChange?.(this.firstPerson);
      }
    }
  };
  private keyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };
  private blur = (): void => { this.keys.clear(); this.dragging = false; this.localJump = false; this.networkJump = false; this.attackQueuedUntil = 0; if (this.id) this.send(this.input(false)); };
  private visibility = (): void => { if (document.hidden) this.blur(); };
  private mouseDown = (event: MouseEvent): void => {
    if (!this.id || !this.enabled) return;
    if (event.button === 2) this.dragging = true;
    if (event.button === 0 && document.pointerLockElement === this.canvas) this.requestAttack();
  };
  private mouseUp = (): void => {
    if (this.dragging) this.lastLook = performance.now();
    this.dragging = false;
  };
  private mouseMove = (event: MouseEvent): void => {
    if (!this.id || !this.enabled || (document.pointerLockElement !== this.canvas && !this.dragging)) return;
    const turn = -event.movementX * 0.0028;
    this.yaw += turn;
    if (!this.dragging) this.movementYaw += turn;
    this.pitch = THREE.MathUtils.clamp(this.pitch + event.movementY * 0.002, -0.4, 1.1);
    this.lastLook = performance.now();
  };
  private click = (): void => { if (this.id && this.enabled && document.pointerLockElement !== this.canvas) this.lockPointer(); };

  private requestAttack(): void {
    if (!this.running || !this.enabled || this.authoritative?.status !== 'alive' || this.impulse || performance.now() - (this.motion.hit ?? -1000) < 220) return;
    const now = performance.now(); const elapsed = (now - this.lastAttack) / 1000;
    if (elapsed < MELEE_COMBO[this.attackCombo].duration) {
      if (MELEE_COMBO[this.attackCombo].duration - elapsed < .18) this.attackQueuedUntil = now + 200;
      return;
    }
    this.attackCombo = elapsed < COMBO_WINDOW ? (this.attackCombo + 1) % 3 : 0;
    const target = !this.firstPerson && this.authoritative ? this.targets.filter(position => meleeReach(this.position, this.yaw, position, MELEE_COMBO[this.attackCombo].reach, this.authoritative!.isInMatrix, this.structures))
      .sort((a, b) => Math.hypot(a.x - this.position.x, a.z - this.position.z) - Math.hypot(b.x - this.position.x, b.z - this.position.z))[0] : undefined;
    this.attackYaw = target ? Math.atan2(target.x - this.position.x, target.z - this.position.z) : this.yaw;
    this.lastAttack = now; this.attackQueuedUntil = 0; this.motion.attack = now; this.motion.combo = this.attackCombo;
    this.send(this.input(false)); this.action('attack');
  }

  impact(hit: CombatImpact): void {
    if (hit.source !== this.id && hit.target !== this.id) return;
    this.impactAge = 0; this.impactStrength = hit.combo === 2 ? .10 : .055;
    if (hit.target === this.id) { this.motion.hit = performance.now(); this.attackQueuedUntil = 0; this.impulse = undefined; }
    else this.motion.impact = performance.now();
  }

  skill(cast: SkillCast): void {
    if (cast.source !== this.id) return;
    this.motion.cast = performance.now(); this.motion.skill = cast.skill; this.attackQueuedUntil = 0;
    if (cast.skill === 'dodge' || cast.skill === 'scorpion_dash') {
      this.planar = { x: 0, z: 0 };
      this.impulse = { direction: cast.direction, remaining: COMBAT_SKILLS[cast.skill].duration, speed: cast.skill === 'dodge' ? 16 : 20 };
    }
    if (['scorpion_dash', 'crushing_palm', 'viral_overwrite'].includes(cast.skill)) {
      this.attackYaw = Math.atan2(cast.direction.x, cast.direction.z);
      this.motion.attack = performance.now(); this.motion.combo = cast.skill === 'scorpion_dash' ? 2 : 1;
    }
  }

  private input(jump: boolean): PlayerInput {
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const right = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    // Keep a held direction stable in world space while either camera follows a turn.
    // A new direction uses the current view; mouse steering still turns both.
    if (forward !== this.movementForward || right !== this.movementRight) this.movementYaw = this.yaw;
    this.movementForward = forward; this.movementRight = right;
    let x = Math.sin(this.movementYaw) * forward - Math.cos(this.movementYaw) * right;
    let z = Math.cos(this.movementYaw) * forward + Math.sin(this.movementYaw) * right;
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    const attacking = (performance.now() - this.lastAttack) / 1000 < MELEE_COMBO[this.attackCombo].duration;
    return { x, z, yaw: attacking ? this.attackYaw : this.yaw, sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), jump, sequence: ++this.sequence };
  }

  update(delta: number, state: AgentState, group: THREE.Group, running: boolean): void {
    if (!this.id) return;
    this.running = running;
    const now = performance.now();
    if (!running || !this.enabled || state.status !== 'alive') { this.attackQueuedUntil = 0; this.localJump = false; this.networkJump = false; this.impulse = undefined; }
    else if (this.attackQueuedUntil > now && (now - this.lastAttack) / 1000 >= MELEE_COMBO[this.attackCombo].duration) this.requestAttack();
    if (state !== this.authoritative) {
      const difference = Math.hypot(state.position.x - this.position.x, state.position.z - this.position.z);
      if (difference > 12 || state.isInMatrix !== this.authoritative?.isInMatrix || state.status === 'dead') {
        this.position = { ...state.position }; this.vy = 0; this.planar = { x: 0, z: 0 }; this.cameraReady = false;
      } else {
        this.position.x += (state.position.x - this.position.x) * 0.16;
        this.position.z += (state.position.z - this.position.z) * 0.16;
        if (Math.abs(state.position.y - this.position.y) > 3) { this.position.y = state.position.y; this.vy = state.velocity.y; }
      }
      this.authoritative = state;
    }
    const previous = { ...this.position };
    if (running && this.enabled && state.status === 'alive') {
      const boost = state.activeEffects.some(effect => ['speed_blur', 'agent_dodge', 'phase_shift'].includes(effect.visualEffect)) ? 1.8 : 1;
      const input = this.input(this.localJump);
      const attackScale = this.impulse || now - (this.motion.hit ?? -1000) < 220 ? 0 : (now - this.lastAttack) / 1000 < MELEE_COMBO[this.attackCombo].duration ? .4 : 1;
      const result = stepPlayer(this.position, this.vy, { ...input, x: input.x * attackScale, z: input.z * attackScale }, Math.min(delta, 0.05), state.isInMatrix, this.structures, this.planar, boost);
      this.position = result.position; this.vy = result.verticalVelocity; this.planar = result.horizontalVelocity; this.localJump = false;
      if (this.impulse) {
        this.position = combatDisplace(this.position, this.impulse.direction, Math.min(delta, this.impulse.remaining) * this.impulse.speed, state.isInMatrix, this.structures);
        this.impulse.remaining -= delta;
        if (this.impulse.remaining <= 0) this.impulse = undefined;
      }
    }
    if (performance.now() - this.lastSent >= 50) {
      this.send(this.input(this.networkJump && running && this.enabled));
      this.networkJump = false; this.lastSent = performance.now();
    }
    group.position.set(this.position.x, this.position.y, this.position.z);
    const dx = this.position.x - previous.x; const dz = this.position.z - previous.z;
    this.motion.speed = Math.hypot(dx, dz) / Math.max(delta, .001);
    this.motion.grounded = this.position.y <= groundHeight(this.position, state.isInMatrix) + .12;
    this.motion.verticalVelocity = this.vy;
    const attacking = (now - this.lastAttack) / 1000 < MELEE_COMBO[this.attackCombo].duration;
    const heading = attacking ? this.attackYaw : this.motion.speed > .1 ? Math.atan2(dx, dz) : this.facing;
    const turn = Math.atan2(Math.sin(heading - this.facing), Math.cos(heading - this.facing));
    this.facing += turn * (1 - Math.exp(-14 * delta)); this.motion.turn = turn * 8;
    if (running && this.enabled && this.motion.speed > .1 && !this.dragging && performance.now() - this.lastLook > 900) {
      const cameraTurn = Math.atan2(Math.sin(this.facing - this.yaw), Math.cos(this.facing - this.yaw));
      this.yaw += cameraTurn * (1 - Math.exp(-5 * delta));
    }
    const body = group.children[0];
    if (body) body.rotation.y = this.firstPerson ? this.yaw : this.facing;
    const sprint = this.motion.speed > PLAYER_WALK_SPEED * 1.6;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.firstPerson ? sprint ? 74 : 68 : sprint ? 64 : 57, 1 - Math.exp(-4 * delta));
    this.camera.updateProjectionMatrix();
    this.cameraStep += this.motion.speed * delta;
    const target = new THREE.Vector3(this.position.x, this.position.y + (this.firstPerson ? 2.99 : 2.05), this.position.z);
    if (!this.cameraReady) { this.cameraTarget.copy(target); this.cameraReady = true; }
    const verticalTarget = THREE.MathUtils.lerp(this.cameraTarget.y, target.y, 1 - Math.exp(-8 * delta));
    this.cameraTarget.lerp(target, 1 - Math.exp(-22 * delta)); this.cameraTarget.y = verticalTarget;
    if (this.firstPerson) {
      this.camera.position.copy(target);
      if (this.motion.grounded && this.motion.speed > .1) this.camera.position.y += Math.sin(this.cameraStep * 2) * .018;
      this.camera.lookAt(target.x + Math.sin(this.yaw) * Math.cos(this.pitch), target.y - Math.sin(this.pitch), target.z + Math.cos(this.yaw) * Math.cos(this.pitch));
    } else {
      const offset = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch) + 0.1, -Math.cos(this.yaw) * Math.cos(this.pitch));
      const shoulder = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).multiplyScalar(this.camera.aspect < .8 ? .3 : .8);
      const pivot = this.cameraTarget.clone().add(shoulder);
      const followDistance = this.camera.aspect < .8 ? 13 : 11.5;
      let cameraDistance = followDistance;
      for (let distance = 1; distance <= followDistance; distance += .5) {
        const point = pivot.clone().addScaledVector(offset, distance);
        if (playerBlocked(point, state.isInMatrix, 0.5, this.structures)) { cameraDistance = Math.max(2, distance - 1); break; }
      }
      const ideal = pivot.clone().addScaledVector(offset, cameraDistance);
      this.camera.position.lerp(ideal, 1 - Math.exp(-20 * delta));
      this.camera.lookAt(pivot.clone().add(new THREE.Vector3(Math.sin(this.yaw) * 2, -.08, Math.cos(this.yaw) * 2)));
    }
    this.impactAge += delta;
    if (this.impactAge < .18) {
      const kick = this.impactStrength * (1 - this.impactAge / .18) ** 2;
      this.camera.position.x += Math.cos(this.yaw) * Math.sin(this.impactAge * 95) * kick;
      this.camera.position.y += Math.sin(this.impactAge * 80) * kick * .6;
    }
  }

  dispose(): void {
    this.release(); window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur); document.removeEventListener('visibilitychange', this.visibility);
    document.removeEventListener('mousemove', this.mouseMove); this.canvas.removeEventListener('mousedown', this.mouseDown);
    window.removeEventListener('mouseup', this.mouseUp); this.canvas.removeEventListener('click', this.click);
  }
}
