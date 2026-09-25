import { catchLocked, deusPactLocked, deusPactPose, reloadedPhaseLocked, smithFinaleLocked, smithFinalePose, trilogyEpilogueLocked } from '@auto_matrix/shared';
import { reloadedCamera } from './ReloadedCamera.js';
import * as THREE from 'three';
import { FILM_SETS, OFFICE_CONTACT, LOBBY_FIRE_INTERVAL, RESCUE, PILL_ROOM, PILL_TIMING, MIRROR_SEAT, MIRROR_TIMING, groundHeight, playerBlocked, stepPlayer, MELEE_COMBO, COMBO_WINDOW, DOJO_COMBO_WINDOW, COMBAT_SKILLS, combatDisplace, PLAYER_WALK_SPEED, meleeReach, trainingRoot, matrixEscapePhaseLocked, matrixEscapePose, matrixEscapeRoot, theOnePhaseLocked, theOnePose, theOneRoot, type OfficePhone, type AwakeningPose, type FreewayRide, type AgentState, type PlayerInput, type Vector3, type WorldStructure, type CombatImpact, type SkillCast, type RescueLoadout } from '@auto_matrix/shared';
import { lafayetteWelcomeCamera } from './LafayetteWelcomeCamera.js';
import type { MotionInput } from '../agents/CharacterMotion.js';
import { AIR_RESCUE, governmentPose, airRescuePose, airRescueRoot, interrogationPose, meetingPose, meetingCarPose, meetingCarPoint, MEETING_TIMING } from '@auto_matrix/shared';
import { officeClothing } from '@auto_matrix/shared';

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
  private welcomeShot?: ReturnType<typeof lafayetteWelcomeCamera>['name'];
  readonly motion: MotionInput = { speed: 0, verticalVelocity: 0, grounded: true, turn: 0 };
  onViewChange?: (firstPerson: boolean) => void;
  onMenu?: () => void;
  onPanel?: (panel: 'inventory' | 'journal' | 'map') => void;
  onClosePanel?: () => boolean;
  onHUD?: () => void;
  structures: WorldStructure[] = [];
  targets: Vector3[] = [];
  firearm = false;
  weaponStyle?: RescueLoadout | 'hel_pistol';
  fireInterval = LOBBY_FIRE_INTERVAL;
  ride?: Pick<FreewayRide, 'speed'> & { mode?: 'defense' | 'sun' };
  gunner = false;
  climbing = false;
  performing = false;
  private phoneExit = false;
  truckRescue = false;
  private wasPerforming = false;
  private meetingYaw?: number;
  mirror = 0;
  spoon?: number;
  phone?: OfficePhone;
  private firing = false;
  private lastShot = -1000;
  private readonly defaultNear: number;

  constructor(private canvas: HTMLCanvasElement, private camera: THREE.PerspectiveCamera,
    private send: (input: PlayerInput) => void, private action: (kind: string) => void) {
    this.defaultNear = camera.near;
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
    this.meetingYaw = undefined; this.welcomeShot = undefined; this.performing = false; this.phoneExit = false;
    this.id = state.id; this.position = { ...state.position }; this.yaw = state.rotation;
    this.movementYaw = this.yaw; this.movementForward = 0; this.movementRight = 0;
    this.lastLook = -1000; this.dragging = false;
    this.facing = state.rotation; this.cameraReady = false; this.motion.attack = undefined;
    this.lastAttack = -1000; this.attackQueuedUntil = 0; this.attackCombo = 0;
    this.motion.hit = this.motion.impact = undefined; this.impactAge = 10;
    this.motion.cast = undefined; this.motion.skill = undefined; this.impulse = undefined;
    this.motion.shot = undefined;
    this.vy = 0; this.planar = { x: 0, z: 0 }; this.authoritative = state; this.firstPerson = false; this.enabled = true;
    this.keys.clear(); this.lastSent = 0; this.sequence = 0;
    this.firing = false; this.lastShot = -1000;
    this.camera.near = this.defaultNear; this.camera.fov = 57; this.camera.updateProjectionMatrix();
    this.onViewChange?.(false);
  }
  release(): void {
    this.id = null; this.keys.clear(); this.enabled = true; this.firing = false; this.firearm = false; this.weaponStyle = undefined; this.fireInterval = LOBBY_FIRE_INTERVAL; this.ride = undefined; this.gunner = false; this.climbing = false; this.performing = false; this.phoneExit = false; this.mirror = 0; this.spoon = undefined; this.phone = undefined; this.welcomeShot = undefined;
    this.camera.near = this.defaultNear; this.camera.fov = 48; this.camera.updateProjectionMatrix();
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
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyG', 'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault(); this.keys.add(event.code);
    }
    if (!event.repeat) {
      if (event.code === 'Space') { this.localJump = true; this.networkJump = true; }
      if (event.code === 'KeyE') this.action('talk');
      if (event.code === 'KeyF') this.triggerCombat('attack');
      if (event.code === 'KeyH') this.onHUD?.();
      if (event.code === 'KeyX') this.triggerCombat('dodge');
      if (['KeyQ', 'KeyC'].includes(event.code) && this.running && this.authoritative?.status === 'alive') {
        this.send(this.input(false)); this.action(event.code === 'KeyQ' ? 'ability' : event.code === 'KeyC' ? 'ability2' : 'dodge');
      }
      if (event.code === 'KeyT' && this.firearm) { this.firing = true; this.requestShot(); }
      if (event.code === 'KeyR') this.action(this.firearm ? 'reload' : 'travel');
      if (event.code === 'KeyG') this.action('interact');
      if (event.code === 'Digit1') this.action('medkit');
      if (event.code === 'Digit2') this.action('emp');
      if (event.code === 'Digit3') this.action('beacon');
      if (event.code === 'Digit4') this.action('barricade');
      if (event.code === 'KeyV') {
        this.firstPerson = !this.firstPerson;
        if (this.firstPerson && this.motion.mirrorBeat !== undefined) this.aimAtMirror();
        if (this.firstPerson && this.motion.meeting && ['scanning', 'located', 'removing', 'discarding'].includes(this.motion.meeting.phase)) this.aimAtMeetingScanner();
        if (this.firstPerson && this.climbing && this.authoritative?.currentLocation === 'film_office_ledge') {
          this.yaw = -.55; this.pitch = .55;
        }
        this.onViewChange?.(this.firstPerson);
      }
    }
  };
  private keyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); if (event.code === 'KeyT') this.firing = false; };
  private blur = (): void => { this.keys.clear(); this.firing = false; this.dragging = false; this.localJump = false; this.networkJump = false; this.attackQueuedUntil = 0; if (this.id) this.send(this.input(false)); };
  private visibility = (): void => { if (document.hidden) this.blur(); };
  private mouseDown = (event: MouseEvent): void => {
    if (!this.id || !this.enabled) return;
    if (event.button === 2) this.dragging = true;
    if (event.button === 0 && document.pointerLockElement === this.canvas) {
      if (this.firearm) { this.firing = true; this.requestShot(); } else this.requestAttack();
    }
  };
  private mouseUp = (): void => {
    this.firing = false;
    if (this.dragging) this.lastLook = performance.now();
    this.dragging = false;
  };
  private mouseMove = (event: MouseEvent): void => {
    if (!this.id || !this.enabled || (document.pointerLockElement !== this.canvas && !this.dragging)) return;
    const turn = -event.movementX * 0.0028;
    this.yaw += turn;
    if (!this.dragging) this.movementYaw += turn;
    this.pitch = THREE.MathUtils.clamp(this.pitch + event.movementY * 0.002, this.motion.mirrorBeat !== undefined ? -.9 : -.4, 1.1);
    this.lastLook = performance.now();
  };
  private click = (): void => { if (this.id && this.enabled && document.pointerLockElement !== this.canvas) this.lockPointer(); };

  private aimAtMirror(): void {
    const center = FILM_SETS.film_lafayette.center;
    const x = center.x + PILL_ROOM.mirror.x + .5 - this.position.x;
    const z = center.z + PILL_ROOM.mirror.z - this.position.z;
    const eye = this.position.y + 2.99 - THREE.MathUtils.smoothstep(this.motion.mirrorBeat ?? 0, .65, MIRROR_TIMING.sit) * .9;
    this.yaw = this.movementYaw = Math.atan2(x, z);
    this.pitch = -Math.atan2(center.y + 2.1 - eye, Math.hypot(x, z));
  }

  private aimAtMeetingScanner(): void {
    const car = meetingCarPose(this.motion.meeting); const pose = meetingPose(this.motion.meeting!);
    const center = FILM_SETS.film_adams_bridge.center;
    const tool = new THREE.Vector3(-.6, 1.82, 1.05).lerp(new THREE.Vector3(1.02, 2.15, 1.38), pose.probe)
      .lerp(new THREE.Vector3(-2.45, 3, .3), pose.discard);
    const target = meetingCarPoint(car, tool.x, tool.z);
    const eye = this.meetingEye(this.motion.meeting!);
    const x = center.x + target.x - eye.x; const z = center.z + target.z - eye.z;
    this.yaw = this.movementYaw = Math.atan2(x, z);
    this.pitch = THREE.MathUtils.clamp(-Math.atan2(center.y - 1 + tool.y + .75 - eye.y, Math.hypot(x, z)), -.4, 1.1);
  }

  private meetingEye(gesture: NonNullable<MotionInput['meeting']>): THREE.Vector3 {
    const blend = gesture.phase === 'scanning' && !gesture.bugged
      ? THREE.MathUtils.smoothstep(gesture.elapsed, MEETING_TIMING.scanning - 2, MEETING_TIMING.scanning)
      : gesture.phase === 'discarding' ? meetingPose(gesture).discard
        : ['scanning', 'located', 'removing'].includes(gesture.phase) ? 0 : 1;
    return new THREE.Vector3(-1.05 * blend, 2.86, .4 - 1.2 * blend)
      .applyEuler(new THREE.Euler(0, meetingCarPose(gesture).yaw, 0))
      .add(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
  }

  triggerCombat(kind: 'attack' | 'dodge', guided = false, guidedCombo?: number): boolean {
    if (kind === 'attack') return this.requestAttack(guided, guidedCombo);
    if (!this.running || !this.enabled || this.authoritative?.status !== 'alive') return false;
    this.send(this.input(false)); this.action('dodge');
    return true;
  }

  private requestAttack(guided = false, guidedCombo?: number): boolean {
    if (this.motion.reloaded?.phase === 'falling' || this.motion.catch?.phase === 'pulse') {
      if (!this.running || !this.enabled || this.authoritative?.status !== 'alive') return false;
      this.send(this.input(false)); this.action('attack'); return true;
    }
    if (this.ride || this.climbing || !guided && (this.performing || this.spoon !== undefined)) return false;
    if (!this.running || !this.enabled || this.authoritative?.status !== 'alive' || !guided && (this.impulse || performance.now() - (this.motion.hit ?? -1000) < 220)) return false;
    const now = performance.now(); const elapsed = (now - this.lastAttack) / 1000;
    if (elapsed < MELEE_COMBO[this.attackCombo].duration) {
      if (MELEE_COMBO[this.attackCombo].duration - elapsed < .18) this.attackQueuedUntil = now + 200;
      return false;
    }
    this.attackCombo = guidedCombo === undefined ? elapsed < (guided ? DOJO_COMBO_WINDOW : COMBO_WINDOW) ? (this.attackCombo + 1) % 3 : 0
      : Math.max(0, Math.min(2, Math.floor(guidedCombo)));
    const target = !this.firstPerson && this.authoritative ? this.targets.filter(position => meleeReach(this.position,
      guided ? Math.atan2(position.x - this.position.x, position.z - this.position.z) : this.yaw,
      position, MELEE_COMBO[this.attackCombo].reach, this.authoritative!.isInMatrix, this.structures))
      .sort((a, b) => Math.hypot(a.x - this.position.x, a.z - this.position.z) - Math.hypot(b.x - this.position.x, b.z - this.position.z))[0] : undefined;
    this.attackYaw = target ? Math.atan2(target.x - this.position.x, target.z - this.position.z) : this.yaw;
    this.lastAttack = now; this.attackQueuedUntil = 0; this.motion.attack = now; this.motion.combo = this.attackCombo;
    this.send(this.input(false)); this.action('attack');
    return true;
  }

  private requestShot(): void {
    if (!this.firearm || !this.enabled || !this.running || this.authoritative?.status !== 'alive' || performance.now() - this.lastShot < this.fireInterval * 1000) return;
    this.lastShot = performance.now(); this.send(this.input(false)); this.action('shoot');
  }

  impact(hit: CombatImpact): void {
    if (hit.source !== this.id && hit.target !== this.id) return;
    this.impactAge = 0; this.impactStrength = hit.combo === 2 ? .10 : .055;
    if (hit.target === this.id) { this.motion.hit = performance.now(); this.attackQueuedUntil = 0; this.impulse = undefined; }
    else this.motion.impact = performance.now();
    if (hit.shot && hit.source === this.id) this.motion.shot = performance.now();
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
    return { x, z, yaw: attacking ? this.attackYaw : this.yaw, pitch: this.pitch, sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), crouch: this.keys.has('KeyZ'), jump,
      drive: this.ride ? { throttle: this.enabled ? Math.max(0, forward) : 0, steer: this.enabled ? right : 0, brake: forward < 0 || !this.enabled } : undefined,
      climb: this.climbing && this.enabled ? forward : 0, focus: this.enabled && this.running && this.keys.has('KeyG'), sequence: ++this.sequence };
  }

  update(delta: number, state: AgentState, group: THREE.Group, running: boolean, phoneExit = false): void {
    if (!this.id) return;
    const mirrorStarting = this.motion.mirrorBeat === undefined && state.currentAction?.parameters.mirrorBeat !== undefined;
    const redPillEnded = this.motion.pills?.choice === 'red' && !state.currentAction?.parameters.pills && state.currentLocation === 'film_lafayette';
    if (this.phoneExit && !phoneExit) this.performing = false;
    this.phoneExit = phoneExit;
    this.running = running;
    const escapeGesture = state.currentAction?.parameters.matrixEscape as MotionInput['matrixEscape'];
    const escapeCinematic = matrixEscapePhaseLocked(escapeGesture);
    const reloadedGesture = state.currentAction?.parameters.reloaded as MotionInput['reloaded'];
    const reloadedCinematic = reloadedPhaseLocked(reloadedGesture);
    const catchGesture = state.currentAction?.parameters.catch as MotionInput['catch'];
    const catchCinematic = catchLocked(catchGesture);
    const oneGesture = state.currentAction?.parameters.theOne as MotionInput['theOne'];
    const oneCinematic = theOnePhaseLocked(oneGesture) || Boolean(oneGesture?.kind === 'flight' && oneGesture.phase === 'done');
    if (this.motion.crossing !== undefined && state.currentLocation === 'film_office_ledge' && state.currentAction?.parameters.crossing === undefined) this.performing = false;
    if (this.motion.pills && !state.currentAction?.parameters.pills) this.performing = false;
    if (state.currentAction?.parameters.pills) this.performing = true;
    if (this.motion.interrogation && !state.currentAction?.parameters.interrogation) this.performing = false;
    if (state.currentAction?.parameters.interrogation) this.performing = true;
    if (this.motion.meeting && !state.currentAction?.parameters.meeting) this.performing = false;
    if (state.currentAction?.parameters.meeting) this.performing = true;
    if (this.motion.welcome && !state.currentAction?.parameters.welcome) this.performing = false;
    if (state.currentAction?.parameters.welcome) this.performing = true;
    if (this.motion.knock !== undefined && state.currentAction?.parameters.knock === undefined) this.performing = false;
    if (state.currentAction?.parameters.knock !== undefined) this.performing = true;
    if (this.motion.reveal && !state.currentAction?.parameters.reveal) this.performing = false;
    if (state.currentAction?.parameters.reveal) this.performing = true;
    if (this.motion.training && !state.currentAction?.parameters.training) this.performing = false;
    if (state.currentAction?.parameters.training) this.performing = true;
    if (this.motion.workday && !state.currentAction?.parameters.workday) this.performing = false;
    if (state.currentAction?.parameters.workday) this.performing = true;
    if (this.motion.contact && !state.currentAction?.parameters.contact) this.performing = false;
    if (state.currentAction?.parameters.contact) this.performing = true;
    if (this.motion.wakeCall && !state.currentAction?.parameters.wakeCall) this.performing = false;
    if (state.currentAction?.parameters.wakeCall) this.performing = true;
    if (this.motion.club && !state.currentAction?.parameters.club) this.performing = false;
    if (state.currentAction?.parameters.club) this.performing = true;
    if (this.motion.sentinel && !state.currentAction?.parameters.sentinel) this.performing = false;
    if (state.currentAction?.parameters.sentinel) this.performing = true;
    if (this.motion.interlude && !state.currentAction?.parameters.interlude) this.performing = false;
    if (state.currentAction?.parameters.interlude) this.performing = true;
    if (this.motion.oracleVisit && !state.currentAction?.parameters.oracleVisit) this.performing = false;
    if (state.currentAction?.parameters.oracleVisit) this.performing = true;
    if (this.motion.betrayal && !state.currentAction?.parameters.betrayal) this.performing = false;
    if (state.currentAction?.parameters.betrayal) this.performing = true;
    if (this.motion.rescue && !state.currentAction?.parameters.rescue) this.performing = false;
    if (state.currentAction?.parameters.rescue) this.performing = true;
    if (this.motion.government && !state.currentAction?.parameters.government) this.performing = false;
    if (state.currentAction?.parameters.government) this.performing = true;
    if (this.motion.airRescue && !state.currentAction?.parameters.airRescue) this.performing = false;
    if (state.currentAction?.parameters.airRescue) this.performing = true;
    if (this.motion.matrixEscape && !escapeCinematic) this.performing = false;
    if (escapeCinematic) this.performing = true;
    if (this.motion.theOne && !oneCinematic) this.performing = false;
    if (oneCinematic) this.performing = true;
    if (this.motion.reloaded && !reloadedCinematic) this.performing = false;
    if (reloadedCinematic) this.performing = true;
    if (this.motion.catch && !catchCinematic) this.performing = false;
    if (catchCinematic) this.performing = true;
    if (this.motion.burly && !state.currentAction?.parameters.burly) this.performing = false;
    if (['approaching', 'grapple', 'flight'].includes((state.currentAction?.parameters.burly as MotionInput['burly'] | undefined)?.phase ?? '')) this.performing = true;
    if (this.motion.mountainFlight && !state.currentAction?.parameters.mountainFlight) this.performing = false;
    if (['takeoff', 'flying', 'arrived'].includes((state.currentAction?.parameters.mountainFlight as MotionInput['mountainFlight'] | undefined)?.phase ?? '')) this.performing = true;
    if (this.motion.truckPassenger && !state.currentAction?.parameters.truckPassenger) this.performing = false;
    if (state.currentAction?.parameters.truckPassenger) this.performing = true;
    if (this.motion.persephone && !state.currentAction?.parameters.persephone) this.performing = false;
    if (state.currentAction?.parameters.persephone) this.performing = true;
    const farewell = state.currentAction?.parameters.farewell as MotionInput['farewell'];
    if (this.motion.farewell && (!farewell || ['ready', 'still'].includes(farewell.phase))) this.performing = false;
    if (farewell && !['ready', 'still'].includes(farewell.phase)) this.performing = true;
    const deusPact = state.currentAction?.parameters.deusPact as MotionInput['deusPact'];
    if (this.motion.deusPact && !deusPactLocked(deusPact)) this.performing = false;
    if (deusPactLocked(deusPact)) this.performing = true;
    const smithFinale = state.currentAction?.parameters.smithFinale as MotionInput['smithFinale'];
    if (this.motion.smithFinale && !smithFinaleLocked(smithFinale)) this.performing = false;
    if (smithFinaleLocked(smithFinale)) this.performing = true;
    const epilogue = state.currentAction?.parameters.epilogue as MotionInput['epilogue'];
    if (this.motion.epilogue && !trilogyEpilogueLocked(epilogue)) this.performing = false;
    if (trilogyEpilogueLocked(epilogue)) this.performing = true;
    if (this.motion.lobbyEntry && !state.currentAction?.parameters.lobbyEntry) this.performing = false;
    if ((state.currentAction?.parameters.lobbyEntry as MotionInput['lobbyEntry'])?.phase === 'checkpoint') this.performing = true;
    if (phoneExit) this.performing = true;
    if (this.wasPerforming && !this.performing) this.yaw = this.movementYaw = this.facing;
    if (redPillEnded) this.yaw = this.movementYaw = this.facing = state.rotation;
    this.wasPerforming = this.performing;
    this.motion.armed = this.firearm || state.currentAction?.parameters.armed === true;
    this.motion.seated = state.currentAction?.parameters.seated === true;
    this.motion.floorSeated = state.currentAction?.parameters.floorSeated === true;
    this.motion.weaponStyle = state.currentAction?.parameters.weaponStyle as MotionInput['weaponStyle'] ?? (this.firearm ? this.weaponStyle : undefined);
    this.motion.crouching = farewell?.role === 'neo' || this.enabled && !this.performing && this.keys.has('KeyZ');
    this.motion.riding = Boolean(this.ride || this.gunner);
    this.motion.performance = this.performing ? state.currentAction?.parameters.filmPose as AwakeningPose : undefined;
    this.motion.mirrorBeat = state.currentAction?.parameters.mirrorBeat as number | undefined;
    this.motion.helDanceDoor = state.currentAction?.parameters.helDanceDoor as number | undefined;
    this.motion.recovery = state.currentAction?.parameters.recovery as number | undefined;
    this.motion.reveal = state.currentAction?.parameters.reveal as MotionInput['reveal'];
    this.motion.training = state.currentAction?.parameters.training as MotionInput['training'];
    this.motion.workday = state.currentAction?.parameters.workday as MotionInput['workday'];
    this.motion.contact = state.currentAction?.parameters.contact as MotionInput['contact'];
    this.motion.wakeCall = state.currentAction?.parameters.wakeCall as MotionInput['wakeCall'];
    this.motion.club = state.currentAction?.parameters.club as MotionInput['club'];
    this.motion.sentinel = state.currentAction?.parameters.sentinel as MotionInput['sentinel'];
    this.motion.interlude = state.currentAction?.parameters.interlude as MotionInput['interlude'];
    this.motion.oracleVisit = state.currentAction?.parameters.oracleVisit as MotionInput['oracleVisit'];
    this.motion.betrayal = state.currentAction?.parameters.betrayal as MotionInput['betrayal'];
    this.motion.rescue = state.currentAction?.parameters.rescue as MotionInput['rescue'];
    this.motion.government = state.currentAction?.parameters.government as MotionInput['government'];
    this.motion.airRescue = state.currentAction?.parameters.airRescue as MotionInput['airRescue'];
    this.motion.matrixEscape = escapeGesture;
    this.motion.theOne = oneGesture;
    this.motion.reloaded = reloadedGesture;
    this.motion.catch = catchGesture;
    this.motion.hotel303 = state.currentAction?.parameters.hotel303 as MotionInput['hotel303'];
    this.motion.burly = state.currentAction?.parameters.burly as MotionInput['burly'];
    this.motion.chateauWeapon = state.currentAction?.parameters.chateauWeapon as MotionInput['chateauWeapon'];
    this.motion.mountainFlight = state.currentAction?.parameters.mountainFlight as MotionInput['mountainFlight'];
    this.motion.truckPassenger = state.currentAction?.parameters.truckPassenger as boolean | undefined;
    this.motion.persephone = state.currentAction?.parameters.persephone as MotionInput['persephone'];
    this.motion.farewell = farewell;
    this.motion.deusPact = deusPact;
    this.motion.smithFinale = smithFinale;
    this.motion.epilogue = epilogue;
    this.motion.lobbyEntry = state.currentAction?.parameters.lobbyEntry as MotionInput['lobbyEntry'];
    this.motion.aimPitch = this.firearm || state.currentAction?.parameters.armed === true ? this.pitch : undefined;
    this.motion.mirror = this.mirror;
    this.motion.spoon = this.spoon;
    this.motion.phone = this.phone;
    this.motion.window = this.performing ? state.currentAction?.parameters.window as number | undefined : undefined;
    this.motion.crossing = this.performing ? state.currentAction?.parameters.crossing as number | undefined : undefined;
    if (this.motion.crossing !== undefined && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    this.motion.pills = state.currentAction?.parameters.pills as MotionInput['pills'];
    this.motion.interrogation = state.currentAction?.parameters.interrogation as MotionInput['interrogation'];
    this.motion.meeting = state.currentAction?.parameters.meeting as MotionInput['meeting'];
    this.motion.welcome = state.currentAction?.parameters.welcome as MotionInput['welcome'];
    this.motion.knock = state.currentAction?.parameters.knock as number | undefined;
    const vehicleYaw = this.motion.meeting && meetingCarPose(this.motion.meeting).yaw;
    if (vehicleYaw !== undefined && this.meetingYaw !== undefined && this.firstPerson) {
      const turn = Math.atan2(Math.sin(vehicleYaw - this.meetingYaw), Math.cos(vehicleYaw - this.meetingYaw));
      this.yaw += turn; this.movementYaw += turn;
    }
    this.meetingYaw = vehicleYaw;
    if (this.motion.meeting && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.welcome && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.knock !== undefined && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.reveal && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.training && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.workday && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.contact && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.wakeCall && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.club && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.sentinel && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.interlude && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.oracleVisit && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.betrayal && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.rescue && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.government && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.airRescue && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (escapeCinematic && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (oneCinematic && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (smithFinaleLocked(this.motion.smithFinale) && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (trilogyEpilogueLocked(this.motion.epilogue) && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.lobbyEntry && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    this.motion.officeShirt = officeClothing(state.id, state.currentLocation);
    if (this.motion.interrogation && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.pills && (!this.firstPerson || this.motion.pills.phase === 'offering' || this.motion.pills.elapsed > 9.6)) this.yaw = this.movementYaw = state.rotation;
    this.motion.vase = state.currentAction?.parameters.vase as number | undefined;
    this.motion.realWorld = !state.isInMatrix && state.currentLocation !== 'film_real_desert';
    this.motion.clubClothes = state.currentLocation === 'film_white_rabbit_club';
    this.motion.glasses = !this.motion.clubClothes && (state.id !== 'neo' || state.isAwakened && state.currentLocation !== 'film_oracle_home');
    this.motion.climbing = this.climbing ? Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) : undefined;
    if (this.firing) this.requestShot();
    const now = performance.now();
    if (!running || !this.enabled || state.status !== 'alive') { this.attackQueuedUntil = 0; this.localJump = false; this.networkJump = false; this.impulse = undefined; }
    else if (this.attackQueuedUntil > now && (now - this.lastAttack) / 1000 >= MELEE_COMBO[this.attackCombo].duration) this.requestAttack();
    if (state !== this.authoritative) {
      const difference = Math.hypot(state.position.x - this.position.x, state.position.z - this.position.z);
      if (difference > 12 || state.isInMatrix !== this.authoritative?.isInMatrix || state.status === 'dead') {
        this.position = { ...state.position }; this.vy = 0; this.planar = { x: 0, z: 0 }; this.cameraReady = false;
        if (state.currentLocation !== this.authoritative?.currentLocation && (FILM_SETS[state.currentLocation] || FILM_SETS[this.authoritative?.currentLocation ?? ''])) {
          this.yaw = this.facing = this.movementYaw = state.rotation;
          this.keys.clear(); this.movementForward = this.movementRight = 0; this.lastLook = -1000;
          this.lastAttack = -1000; this.attackQueuedUntil = 0; this.localJump = this.networkJump = false; this.impulse = undefined;
        }
      } else {
        this.position.x += (state.position.x - this.position.x) * 0.16;
        this.position.z += (state.position.z - this.position.z) * 0.16;
        if (Math.abs(state.position.y - this.position.y) > 3) { this.position.y = state.position.y; this.vy = state.velocity.y; }
      }
      this.authoritative = state;
    }
    const previous = { ...this.position };
    if (this.ride || this.climbing || this.performing) {
      const blend = this.motion.truckPassenger || this.motion.pills || this.motion.interrogation || this.motion.meeting || this.motion.training || this.motion.workday || this.motion.interlude || this.motion.oracleVisit || this.motion.betrayal || this.motion.rescue || this.motion.government || this.motion.airRescue || escapeCinematic || oneCinematic || catchCinematic || smithFinaleLocked(this.motion.smithFinale) || this.motion.lobbyEntry ? 1 : 1 - Math.exp(-20 * delta);
      this.position.x += (state.position.x - this.position.x) * blend; this.position.y += (state.position.y - this.position.y) * blend; this.position.z += (state.position.z - this.position.z) * blend;
      this.vy = 0; this.planar = { x: 0, z: 0 }; this.localJump = false;
    } else if (running && this.enabled && state.status === 'alive') {
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
    if (mirrorStarting && this.firstPerson && now - this.lastLook > 900) this.aimAtMirror();
    const dx = this.position.x - previous.x; const dz = this.position.z - previous.z;
    this.motion.speed = this.ride || this.climbing || this.performing ? 0 : Math.hypot(dx, dz) / Math.max(delta, .001);
    if (this.motion.wakeCall?.phase === 'waking' && this.motion.wakeCall.elapsed > 2.7) this.motion.speed = 1.45;
    this.motion.grounded = Boolean(this.ride || this.gunner) || this.climbing || this.performing || this.position.y <= groundHeight(this.position, state.isInMatrix) + .12;
    this.motion.verticalVelocity = this.vy;
    this.motion.inspecting = Boolean((this.motion.pills || this.motion.interrogation || this.motion.welcome || this.motion.knock !== undefined || this.motion.recovery !== undefined || this.motion.reveal || this.motion.training || this.motion.workday || this.motion.wakeCall || this.motion.sentinel || this.motion.interlude || this.motion.oracleVisit || this.motion.betrayal || this.motion.rescue || this.motion.government || this.motion.airRescue || escapeCinematic || oneCinematic || this.motion.lobbyEntry) && !this.firstPerson) || Boolean(this.phone && this.performing && this.motion.window === undefined && this.motion.crossing === undefined) || this.spoon !== undefined && this.enabled && this.motion.speed < .25 && this.motion.grounded;
    const attacking = (now - this.lastAttack) / 1000 < MELEE_COMBO[this.attackCombo].duration;
    const heading = this.ride || this.climbing || this.performing ? state.rotation : attacking ? this.attackYaw : this.firearm ? this.yaw : this.motion.speed > .1 ? Math.atan2(dx, dz) : this.facing;
    const turn = Math.atan2(Math.sin(heading - this.facing), Math.cos(heading - this.facing));
    this.facing += turn * (this.motion.pills || this.motion.interrogation || this.motion.meeting || this.motion.welcome || this.motion.knock !== undefined || this.motion.training || this.motion.workday || this.motion.wakeCall || this.motion.sentinel || this.motion.interlude || this.motion.oracleVisit || this.motion.betrayal || this.motion.rescue || this.motion.government || this.motion.airRescue || escapeCinematic || oneCinematic || this.motion.lobbyEntry ? 1 : 1 - Math.exp(-14 * delta)); this.motion.turn = turn * 8;
    if (running && this.enabled && (this.motion.speed > .1 || this.ride || this.climbing) && !(this.firstPerson && this.climbing && state.currentLocation === 'film_office_ledge') && !this.dragging && performance.now() - this.lastLook > 900) {
      const cameraTurn = Math.atan2(Math.sin(this.facing - this.yaw), Math.cos(this.facing - this.yaw));
      this.yaw += cameraTurn * (1 - Math.exp(-5 * delta));
    }
    const body = group.children[0];
    if (body) body.rotation.y = this.firstPerson && !this.performing ? this.yaw : this.facing;
    const sprint = this.motion.speed > PLAYER_WALK_SPEED * 1.6 || Boolean(this.ride && this.ride.speed > 20);
    const interviewWide = !this.firstPerson && this.motion.interrogation && (this.motion.interrogation.phase === 'file' || this.motion.interrogation.phase === 'coercion' && this.motion.interrogation.elapsed > 5.3 && this.motion.interrogation.elapsed < 14);
    const interviewApproach = !this.firstPerson && state.currentLocation === 'film_agent_interrogation' && !this.motion.interrogation;
    const welcomeWide = !this.firstPerson && this.motion.welcome && ['approach', 'departing'].includes(this.motion.welcome.phase);
    const revealWide = !this.firstPerson && Boolean(this.motion.reveal && (this.motion.reveal.kind === 'desert' ? this.motion.reveal.elapsed < 10.2 : this.motion.reveal.elapsed < 2.4));
    const trainingWide = !this.firstPerson && Boolean(this.motion.training && (this.motion.training.kind === 'jump' || this.motion.training.kind === 'red_dress' && this.motion.training.elapsed < 4.8));
    const officeWide = !this.firstPerson && this.motion.workday && this.motion.workday.phase !== 'signing';
    const wakeWide = !this.firstPerson && this.motion.wakeCall?.phase === 'waking';
    const sentinelWide = !this.firstPerson && Boolean(this.motion.sentinel && ['shutdown', 'detected', 'clear'].includes(this.motion.sentinel.phase));
    const interludeWide = !this.firstPerson && Boolean(this.motion.interlude);
    const oracleWide = !this.firstPerson && Boolean(this.motion.oracleVisit?.phase === 'examining');
    const betrayalWide = !this.firstPerson && Boolean(this.motion.betrayal);
    const rescueWide = !this.firstPerson && Boolean(this.motion.rescue);
    const governmentWide = !this.firstPerson && Boolean(this.motion.government);
    const airRescueWide = !this.firstPerson && Boolean(this.motion.airRescue);
    const escapeWide = !this.firstPerson && escapeCinematic;
    const oneWide = !this.firstPerson && oneCinematic;
    const catchWide = !this.firstPerson && catchCinematic;
    const smithFinaleWide = !this.firstPerson && smithFinaleLocked(this.motion.smithFinale);
    const epilogueWide = !this.firstPerson && trilogyEpilogueLocked(this.motion.epilogue);
    const lobbyWide = !this.firstPerson && Boolean(this.motion.lobbyEntry);
    const ladderWide = this.climbing && state.currentLocation === 'film_office_ledge' && !this.firstPerson;
    const pillDepartureWide = !this.firstPerson && this.motion.pills?.phase === 'taking' && this.motion.pills.elapsed >= 10;
    const podWide = !this.firstPerson && this.motion.performance === 'pod';
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, podWide ? 65 : smithFinaleWide || epilogueWide ? 64 : ladderWide ? 62 : interviewApproach ? 70 : interviewWide || welcomeWide || revealWide || trainingWide || officeWide || wakeWide || sentinelWide || interludeWide || oracleWide || betrayalWide || rescueWide || governmentWide || airRescueWide || escapeWide || oneWide || catchWide || lobbyWide || pillDepartureWide ? 58 : this.motion.inspecting ? 42 : this.firstPerson ? this.motion.mirrorBeat !== undefined ? 78 : sprint ? 74 : 68 : sprint ? 64 : 57, 1 - Math.exp(-4 * delta));
    this.camera.near = this.firstPerson && this.motion.club ? .08 : this.defaultNear;
    this.camera.updateProjectionMatrix();
    this.cameraStep += this.motion.speed * delta;
    const target = new THREE.Vector3(this.position.x, this.position.y + (this.firstPerson ? 2.99 : 2.05) - (this.motion.pills ? .9 : 0) - (this.motion.mirrorBeat !== undefined ? THREE.MathUtils.smoothstep(this.motion.mirrorBeat, .65, MIRROR_TIMING.sit) * .9 : 0) - (this.motion.reveal?.kind === 'construct' ? .62 : 0) - (this.motion.crouching ? 1.1 : 0), this.position.z);
    if (this.motion.contact && ['signal', 'reply', 'knocking'].includes(this.motion.contact.phase)) target.y -= .65;
    if (this.motion.wakeCall?.phase === 'waking') target.y -= (1 - THREE.MathUtils.smoothstep(this.motion.wakeCall.elapsed, 1.3, 3.1)) * 1.35;
    const meeting = this.motion.meeting && meetingPose(this.motion.meeting);
    if (meeting) { target.y -= meeting.seat * .87; target.x += Math.sin(vehicleYaw!) * meeting.recline * .52; target.z += Math.cos(vehicleYaw!) * meeting.recline * .52; }
    const interview = this.motion.interrogation && interrogationPose(this.motion.interrogation);
    if (interview) {
      target.y -= interview.seated * .79;
      if (this.firstPerson && interview.pinned) {
        const center = FILM_SETS.film_agent_interrogation.center;
        target.lerp(new THREE.Vector3(center.x + .6, center.y + 1.78, center.z), interview.pinned);
      }
    }
    const resetCamera = !this.cameraReady;
    if (!this.motion.welcome) this.welcomeShot = undefined;
    if (!this.cameraReady) { this.cameraTarget.copy(target); this.cameraReady = true; }
    const verticalTarget = THREE.MathUtils.lerp(this.cameraTarget.y, target.y, 1 - Math.exp(-8 * delta));
    this.cameraTarget.lerp(target, 1 - Math.exp(-22 * delta)); this.cameraTarget.y = verticalTarget;
    const spoon = this.motion.inspecting && group.getObjectByName('held-spoon');
    if (this.motion.government) {
      const gesture = this.motion.government; const center = FILM_SETS[state.currentLocation].center;
      if (this.firstPerson) {
        const pose = governmentPose(gesture); const eyeHeight = gesture.kind === 'questioning' ? 2.18 : 2.99 - pose.bend * 1.38 - pose.fall * 1.25;
        const eye = new THREE.Vector3(this.position.x, this.position.y + eyeHeight, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1, center.z); let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (gesture.kind === 'questioning') {
          const alarm = gesture.phase === 'alarm'; const close = gesture.phase === 'monologue' ? THREE.MathUtils.smoothstep(gesture.elapsed, 2.4, 8.5) : 0;
          const portrait = this.camera.aspect < .85;
          ideal = alarm ? new THREE.Vector3(portrait ? -13.8 : -11.2, 5.6, 1.5)
            : new THREE.Vector3(portrait ? -12.5 : -9.6, 4.9, 2.3).lerp(new THREE.Vector3(portrait ? -10.5 : -7.4, 4.25, -.2), close);
          focus = alarm ? new THREE.Vector3(.5, 3.25, -5.8) : new THREE.Vector3(0, 2.8, -4.1);
        } else if (gesture.phase === 'opening') {
          const reverse = THREE.MathUtils.smoothstep(gesture.elapsed, 1.6, 3.2);
          ideal = new THREE.Vector3(-11.5, 5.2, 7.5).lerp(new THREE.Vector3(10.8, 4.8, 5.2), reverse);
          focus = new THREE.Vector3(0, 3, -3.1);
        } else if (gesture.phase === 'bullet_time') {
          const swing = Math.sin(gesture.elapsed * .48) * 2.1;
          ideal = new THREE.Vector3(this.camera.aspect < .85 ? 21.8 : 12.2, this.camera.aspect < .85 ? 5 : 4.2 + Math.sin(gesture.elapsed * .7) * .35, (this.camera.aspect < .85 ? 3.5 : 5.2) + swing);
          focus = new THREE.Vector3(0, 2.55, -3.1);
        } else if (gesture.phase === 'trinity') {
          const reverse = THREE.MathUtils.smoothstep(gesture.elapsed, 2.1, 3.6);
          const portrait = this.camera.aspect < .85;
          const orbit = reverse * Math.PI;
          ideal = portrait
            ? new THREE.Vector3(-29 * Math.cos(orbit), THREE.MathUtils.lerp(7.4, 6.2, reverse), .8 + Math.sin(orbit) * 26 + reverse * 6.2)
            : new THREE.Vector3(-15 * Math.cos(orbit), THREE.MathUtils.lerp(5.2, 4.7, reverse), -2 + Math.sin(orbit) * 13 + reverse * 7);
          focus = (portrait ? new THREE.Vector3(-1.4, 2.7, -1.6) : new THREE.Vector3(-.8, 2.55, -5.5))
            .lerp(portrait ? new THREE.Vector3(-1.6, 2.55, .4) : new THREE.Vector3(-1.8, 2.45, 2.8), reverse);
        } else {
          const boarding = THREE.MathUtils.smoothstep(gesture.elapsed, 1.2, 4.4); const portrait = this.camera.aspect < .85;
          ideal = (portrait ? new THREE.Vector3(48, 13.5, 16) : new THREE.Vector3(35, 10, 8))
            .lerp(portrait ? new THREE.Vector3(42, 11, 9) : new THREE.Vector3(31, 8.5, 4), boarding);
          focus = new THREE.Vector3(7, 4, -20).lerp(new THREE.Vector3(6, 4, -20), boarding);
        }
        ideal.add(origin); focus.add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.airRescue) {
      const gesture = this.motion.airRescue; const center = FILM_SETS[state.currentLocation].center;
      if (this.firstPerson) {
        const pose = airRescuePose(gesture); const eyeHeight = 2.82 - pose.strain * .72 - pose.fall * .38;
        const eye = new THREE.Vector3(this.position.x, this.position.y + eyeHeight, this.position.z);
        if (gesture.kind === 'office' && ['ready', 'approach', 'firing'].includes(gesture.phase)) {
          eye.set(center.x - 1.7, center.y + 5.45, center.z - 34.65);
        }
        if (gesture.kind === 'roof') { eye.x = center.x - 31.45; eye.y = Math.max(eye.y, center.y + 3.15); }
        const partner = gesture.kind === 'office' && ['leap_window', 'catching', 'done'].includes(gesture.phase) ? 'morpheus'
          : gesture.kind === 'roof' && ['impact', 'bracing', 'pulling', 'done'].includes(gesture.phase) ? 'trinity' : undefined;
        this.camera.position.copy(eye);
        if (partner) {
          const root = airRescueRoot(gesture, partner); this.camera.lookAt(center.x + root.x, center.y + root.y + 2.2, center.z + root.z);
        } else {
          const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
          this.camera.lookAt(eye.clone().add(forward));
        }
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1, center.z); const portrait = this.camera.aspect < .85;
        let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (gesture.kind === 'office') {
          const catching = gesture.phase === 'leap_window' || gesture.phase === 'catching' || gesture.phase === 'done';
          const catchProgress = gesture.phase === 'catching' || gesture.phase === 'done'
            ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, 3.8) : 0;
          ideal = catching
            ? (portrait ? new THREE.Vector3(-32, 11, -43) : new THREE.Vector3(-25, 9, -42)).lerp(portrait ? new THREE.Vector3(-28, 9, -39) : new THREE.Vector3(-22, 8, -39), catchProgress)
            : (portrait ? new THREE.Vector3(-34, 12, -43) : new THREE.Vector3(-27, 10, -42));
          focus = catching ? new THREE.Vector3(1.5, 4, -27).lerp(new THREE.Vector3(2.5, 4.5, -30.5), catchProgress)
            : new THREE.Vector3(0, 4.6, -28);
        } else if (gesture.phase === 'impact') {
          ideal = portrait ? new THREE.Vector3(44, 17, 10) : new THREE.Vector3(34, 13, 5);
          focus = new THREE.Vector3(-1.5, 2.4, -28);
        } else if (gesture.phase === 'bracing') {
          const sway = Math.sin(gesture.elapsed * .7) * 1.6;
          ideal = new THREE.Vector3(portrait ? -48 : -43, portrait ? 5 : 4.5, -17 + sway);
          focus = new THREE.Vector3(-31.5, -3.8, -27);
        } else {
          const crash = THREE.MathUtils.smoothstep(gesture.elapsed, 1.8, 3.1);
          const recovery = THREE.MathUtils.smoothstep(gesture.elapsed, 4.2, AIR_RESCUE.roof.pulling);
          ideal = (portrait ? new THREE.Vector3(-46, 8, -12) : new THREE.Vector3(-42, 8, -8))
            .lerp(portrait ? new THREE.Vector3(-42, 11, -10) : new THREE.Vector3(-38, 10, -8), crash)
            .lerp(portrait ? new THREE.Vector3(-38, 9, -8) : new THREE.Vector3(-35, 8, -6), recovery);
          focus = new THREE.Vector3(-31, -3, -29).lerp(new THREE.Vector3(-24, 0, -34), crash)
            .lerp(new THREE.Vector3(-29, 3, -23), recovery);
        }
        ideal.add(origin); focus.add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.matrixEscape && escapeCinematic) {
      const gesture = this.motion.matrixEscape; const center = FILM_SETS[state.currentLocation].center;
      const origin = new THREE.Vector3(center.x, center.y - 1, center.z); const pose = matrixEscapePose(gesture);
      if (this.firstPerson) {
        const eyeHeight = 2.99 - pose.grapple * .82 - pose.brace * .52;
        const eye = new THREE.Vector3(this.position.x, this.position.y + eyeHeight, this.position.z);
        let look: THREE.Vector3 | undefined;
        const focusRole = gesture.kind === 'subway'
          ? gesture.phase === 'body_swap' ? 'citizen_13' : 'smith'
          : gesture.phase === 'phone_failure' ? 'citizen_13' : gesture.phase === 'possession' ? 'citizen_14' : undefined;
        if (focusRole) {
          const root = matrixEscapeRoot(gesture, focusRole); look = new THREE.Vector3(center.x + root.x, center.y + root.y + 2.25, center.z + root.z);
        }
        this.camera.position.copy(eye);
        if (look) this.camera.lookAt(look);
        else {
          const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
          this.camera.lookAt(eye.clone().add(forward));
        }
      } else {
        const portrait = this.camera.aspect < .85; let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (gesture.kind === 'subway') {
          if (gesture.phase === 'phone_shot' || gesture.phase === 'stance') {
            const turn = gesture.phase === 'stance' ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, 1.8) : 0;
            ideal = new THREE.Vector3(portrait ? 18 : 13, 5.4, 26).lerp(new THREE.Vector3(portrait ? 15 : 11, 4.7, 13), turn);
            focus = new THREE.Vector3(-2, 2.7, 18).lerp(new THREE.Vector3(0, 2.65, 6), turn);
          } else if (gesture.phase === 'wall_break') {
            const crash = THREE.MathUtils.smoothstep(gesture.elapsed, .35, 2.2);
            ideal = new THREE.Vector3(4, 5.8, 12).lerp(new THREE.Vector3(-8, 4.8, 11), crash);
            focus = new THREE.Vector3(-7, 2.7, 1).lerp(new THREE.Vector3(-17, 2.5, 1), crash);
          } else if (gesture.phase === 'body_swap') {
            const transform = THREE.MathUtils.smoothstep(gesture.elapsed, .45, 2.1);
            ideal = new THREE.Vector3(portrait ? 5 : 2.5, 4.4, -14).lerp(new THREE.Vector3(portrait ? 4 : 1.5, 3.8, -17), transform);
            focus = new THREE.Vector3(-8, 2.7, -27);
          } else {
            const train = gesture.phase === 'train_window' ? THREE.MathUtils.smoothstep(gesture.elapsed, .2, 3.4) : 0;
            ideal = new THREE.Vector3(portrait ? 10.5 : 9.5, 5.2, 2).lerp(new THREE.Vector3(portrait ? 9.5 : 8.5, 4.2, -11), train);
            focus = new THREE.Vector3(16, 1.5, -6);
          }
        } else if (gesture.phase === 'briefing') {
          ideal = new THREE.Vector3(portrait ? 17 : 13, 6, 43); focus = new THREE.Vector3(0, 2.8, 29);
        } else if (gesture.phase === 'phone_failure') {
          ideal = new THREE.Vector3(portrait ? 15 : 11, 4.8, 27); focus = new THREE.Vector3(-3, 2.6, 17);
        } else if (gesture.phase === 'possession') {
          ideal = new THREE.Vector3(portrait ? -19 : -14, 4.6, -18); focus = new THREE.Vector3(-5, 2.6, -27);
        } else if (gesture.phase === 'door') {
          ideal = new THREE.Vector3(portrait ? 18 : 14, portrait ? 8 : 7, portrait ? -21 : -23); focus = new THREE.Vector3(0, 3.1, -43);
        } else {
          const truck = gesture.phase === 'truck_window' ? THREE.MathUtils.smoothstep(gesture.elapsed, .2, 3) : 0;
          ideal = new THREE.Vector3(14, portrait ? 8 : 7.5, portrait ? -36 : -34)
            .lerp(new THREE.Vector3(13, portrait ? 7 : 6.5, portrait ? -32 : -30), truck);
          focus = new THREE.Vector3(7, 2.4, -10.5);
        }
        ideal.add(origin); focus.add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.catch && catchCinematic) {
      const gesture = this.motion.catch;
      const falling = gesture.phase === 'flight';
      const heading = gesture.yaw ?? Math.PI;
      const target = falling ? new THREE.Vector3(this.position.x + Math.sin(heading) * 16, this.position.y - 3, this.position.z + Math.cos(heading) * 16)
        : gesture.phase === 'ascent' ? new THREE.Vector3(this.position.x - 1, this.position.y + 1, this.position.z - 2)
          : new THREE.Vector3(this.position.x - 1.7, this.position.y + .85, this.position.z - 2.3);
      const ideal = this.firstPerson ? new THREE.Vector3(this.position.x, this.position.y + 2.7, this.position.z)
        : falling ? new THREE.Vector3(this.position.x - Math.sin(heading) * 15 + Math.cos(heading) * (this.camera.aspect < .8 ? 3 : 6), this.position.y + 5, this.position.z - Math.cos(heading) * 15 - Math.sin(heading) * (this.camera.aspect < .8 ? 3 : 6))
          : gesture.phase === 'ascent' ? new THREE.Vector3(this.position.x + 11, this.position.y + 5, this.position.z + 9)
            : new THREE.Vector3(this.position.x - (this.camera.aspect < .8 ? 6 : 8), this.position.y + 5.3, this.position.z + 8);
      if (this.firstPerson || resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-9 * delta));
      this.camera.lookAt(target);
    } else if (this.motion.reloaded && reloadedCinematic) {
      const framing = reloadedCamera(this.motion.reloaded, this.position, state.currentLocation, this.firstPerson, this.camera.aspect, this.yaw, this.pitch);
      if (this.firstPerson || resetCamera || this.motion.reloaded.elapsed < .12) this.camera.position.copy(framing.eye);
      else this.camera.position.lerp(framing.eye, 1 - Math.exp(-12 * delta));
      this.camera.lookAt(framing.target);
    } else if (this.motion.theOne && oneCinematic) {
      const gesture = this.motion.theOne; const center = FILM_SETS[state.currentLocation].center; const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const pose = theOnePose(gesture);
      if (this.firstPerson) {
        const eyeHeight = gesture.kind === 'flight' ? 2.35 : gesture.kind === 'death' && ['flatline', 'listening', 'kiss'].includes(gesture.phase)
          ? .95 : 2.99 - pose.wound * 1.25 - pose.fallen * 1.7;
        const eye = new THREE.Vector3(this.position.x, this.position.y + eyeHeight, this.position.z); this.camera.position.copy(eye);
        let focus: THREE.Vector3 | undefined;
        const role = gesture.kind === 'death' ? state.currentLocation === 'film_neb_deck' ? 'trinity' : 'smith'
          : gesture.kind === 'return' ? gesture.phase === 'emp' ? 'morpheus' : 'smith' : undefined;
        if (role) {
          const root = theOneRoot(gesture, role); focus = new THREE.Vector3(center.x + root.x, center.y + root.y + 2.15, center.z + root.z);
        }
        if (focus) this.camera.lookAt(focus);
        else if (gesture.kind === 'flight') this.camera.lookAt(eye.x, eye.y + .4, eye.z - 18);
        else {
          const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
          this.camera.lookAt(eye.clone().add(forward));
        }
      } else {
        const portrait = this.camera.aspect < .85; let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (state.currentLocation === 'film_neb_deck') {
          if (gesture.kind === 'death') {
            const close = gesture.phase === 'kiss' ? THREE.MathUtils.smoothstep(gesture.elapsed, .2, 1.55) : 0;
            ideal = new THREE.Vector3(portrait ? 14 : 11.5, 5.4, .8).lerp(new THREE.Vector3(portrait ? 11 : 9, 4.1, -.8), close);
            focus = new THREE.Vector3(4.7, 1.9, -5);
          } else {
            ideal = new THREE.Vector3(4, portrait ? 10 : 8.5, portrait ? 18 : 13); focus = new THREE.Vector3(4, 2.2, -2.8);
          }
          ideal.add(origin); focus.add(origin);
        } else if (state.currentLocation === 'film_final_phone') {
          if (gesture.phase === 'call') {
            ideal = new THREE.Vector3(portrait ? 13 : 10, 5.2, -14); focus = new THREE.Vector3(0, 2.6, -25); ideal.add(origin); focus.add(origin);
          } else {
            const distance = portrait ? 20 : 15; ideal = new THREE.Vector3(this.position.x + distance * .58, this.position.y + 7, this.position.z + distance);
            focus = new THREE.Vector3(this.position.x, this.position.y + 2, this.position.z - 3);
          }
        } else {
          if (gesture.kind === 'death') {
            ideal = new THREE.Vector3(5.35, 5.2, -8); focus = new THREE.Vector3(0, 2.25, -18);
          } else if (gesture.phase === 'dive' || gesture.phase === 'burst') {
            const reverse = gesture.phase === 'burst' ? THREE.MathUtils.smoothstep(gesture.elapsed, .3, 1.5) : 0;
            ideal = new THREE.Vector3(5.35, 4.8, -10).lerp(new THREE.Vector3(-5.35, 4.4, -12), reverse);
            focus = new THREE.Vector3(0, 2.25, -19.2);
          } else {
            ideal = new THREE.Vector3(5.35, 5.6, -3.2); focus = new THREE.Vector3(0, 2.35, -18.5);
          }
          ideal.add(origin); focus.add(origin);
        }
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.lobbyEntry) {
      const gesture = this.motion.lobbyEntry;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 2.99, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const center = FILM_SETS.film_government_lobby.center; const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
        const alarm = THREE.MathUtils.smoothstep(gesture.elapsed, 1.8, 3.1);
        const ideal = new THREE.Vector3(this.camera.aspect < .85 ? 8.2 : 10.8, 5.1, 31)
          .lerp(new THREE.Vector3(this.camera.aspect < .85 ? 7.2 : 9.2, 4.75, 26.8), alarm).add(origin);
        const focus = new THREE.Vector3(0, 3.35, 24).lerp(new THREE.Vector3(0, 3.8, 20.8), alarm).add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.club && !this.firstPerson) {
      const center = FILM_SETS.film_white_rabbit_club.center; const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const intimate = ['whisper', 'question', 'reply'].includes(this.motion.club.phase);
      const close = intimate ? THREE.MathUtils.smoothstep(this.motion.club.phase === 'whisper' ? this.motion.club.elapsed : 2, 0, 2) : 0;
      const portrait = this.camera.aspect < 1;
      const ideal = new THREE.Vector3(portrait ? 12.8 : 11.5, 4.8, -1.2).lerp(new THREE.Vector3(portrait ? 3.5 : 4.2, 4.5, portrait ? -1.5 : -2.2), close).add(origin);
      const focus = new THREE.Vector3(6.7, 3.5, -5.2).lerp(new THREE.Vector3(6.65, 3.92, -4.55), close).add(origin);
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.wakeCall && !this.firstPerson) {
      const call = this.motion.wakeCall; const center = FILM_SETS.film_anderson_flat.center; const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const waking = call.phase === 'waking'; const rise = waking ? THREE.MathUtils.smoothstep(call.elapsed, 1.1, 3.5) : 1;
      const ideal = (waking ? new THREE.Vector3(15.4, 5.2, -5.2).lerp(new THREE.Vector3(8.3, 4.35, -4.8), rise)
        : new THREE.Vector3(-2.55, 4.35, -11.05)).add(origin);
      const focus = (waking ? new THREE.Vector3(10.1, 2.05, -9.2).lerp(new THREE.Vector3(6.2, 3.05, -8.9), rise)
        : new THREE.Vector3(-5.95, 3.15, -9.05)).add(origin);
      if (resetCamera || call.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.contact && !this.firstPerson) {
      const phase = this.motion.contact.phase; const center = FILM_SETS.film_anderson_flat.center;
      const computer = ['signal', 'reply', 'knocking'].includes(phase); const book = phase === 'retrieving';
      const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const ideal = (computer ? new THREE.Vector3(-6.6, 4.7, -7.1) : book ? new THREE.Vector3(9.3, 4.9, 3.1) : new THREE.Vector3(4.2, 5.4, 7.4)).add(origin);
      const focus = (computer ? new THREE.Vector3(-9, 2.9, -11.8) : book ? new THREE.Vector3(6, 2.1, 6) : new THREE.Vector3(0, 3.5, 12.3)).add(origin);
      if (phase === 'inspecting') { ideal.copy(origin).add(new THREE.Vector3(-1.45, 4, 12.7)); focus.copy(origin).add(new THREE.Vector3(-.65, 3.42, 14.38)); }
      if (resetCamera || this.motion.contact.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.workday && !this.firstPerson) {
      const signing = this.motion.workday.phase === 'signing'; const center = FILM_SETS.film_metacortex_floor.center;
      const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const ideal = (signing ? new THREE.Vector3(10.5, 5.7, 4.6) : new THREE.Vector3(this.camera.aspect < 1 ? -10 : -14.6, this.camera.aspect < 1 ? 5.2 : 4.6, 31)).add(origin);
      const focus = (signing ? new THREE.Vector3(13.5, 3.15, 7.1) : new THREE.Vector3(-20.5, 3, 27.4)).add(origin);
      if (resetCamera || this.motion.workday.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.training) {
      const gesture = this.motion.training; const center = FILM_SETS[state.currentLocation].center;
      if (this.firstPerson) {
        const seated = gesture.kind === 'download';
        const eye = new THREE.Vector3(this.position.x, this.position.y + (seated ? 2.15 : 3), this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1, center.z); let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (gesture.kind === 'download') {
          const close = THREE.MathUtils.smoothstep(gesture.elapsed, .4, 2.2); const wake = THREE.MathUtils.smoothstep(gesture.elapsed, 8.2, 9.8);
          ideal = new THREE.Vector3(1.2, 5.4, .8).lerp(new THREE.Vector3(8.5, 4.15, .1), close).lerp(new THREE.Vector3(2.3, 4.9, -1), wake);
          focus = new THREE.Vector3(6.5, 2.35, -5).lerp(new THREE.Vector3(8.6, 3.15, -5), wake);
        } else if (gesture.kind === 'jump') {
          const root = trainingRoot({ kind: 'jump', elapsed: gesture.elapsed, started: true }, 'morpheus');
          ideal = new THREE.Vector3(12, 7.8, -17).lerp(new THREE.Vector3(9, 5.8, -28), THREE.MathUtils.smoothstep(gesture.elapsed, 1.1, 3.4));
          focus = new THREE.Vector3(root.x, Math.max(2.4, root.y + 1.8), root.z);
        } else {
          const turn = THREE.MathUtils.smoothstep(gesture.elapsed, 5.2, 6.6); const reveal = THREE.MathUtils.smoothstep(gesture.elapsed, 6.15, 7.1);
          ideal = new THREE.Vector3(12.5, 5.2, -6).lerp(new THREE.Vector3(1.2, 4.1, -5.5), turn).lerp(new THREE.Vector3(12.8, 4.3, 11), reveal);
          focus = new THREE.Vector3(7, 2.7, -18).lerp(new THREE.Vector3(7, 2.8, 7), turn);
        }
        ideal.add(origin); focus.add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.interlude) {
      const gesture = this.motion.interlude; const center = FILM_SETS[state.currentLocation].center;
      if (this.firstPerson) {
        const seated = gesture.kind !== 'console';
        const eye = new THREE.Vector3(this.position.x, this.position.y + (seated ? 2.65 : 3), this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1, center.z); let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (gesture.kind === 'console') {
          const reverse = gesture.phase === 'responding' ? 1 : THREE.MathUtils.smoothstep(gesture.elapsed, 4.5, 6.4);
          ideal = new THREE.Vector3(-5.5, 4.8, 1.5).lerp(new THREE.Vector3(-8, 4.3, -2.5), reverse);
          focus = new THREE.Vector3(5.1, 3.05, 6.35).lerp(new THREE.Vector3(6.4, 3.05, 6), reverse);
        } else if (gesture.kind === 'steak') {
          const reverse = THREE.MathUtils.smoothstep(gesture.elapsed, 7.2, 9.4);
          const portrait = this.camera.aspect < .85;
          ideal = new THREE.Vector3(portrait ? 15.8 : 12.8, portrait ? 6.1 : 5.45, -13)
            .lerp(new THREE.Vector3(portrait ? -14.2 : -11.2, portrait ? 5.8 : 5.15, -13), reverse);
          focus = new THREE.Vector3(0, 3.25, -13);
        } else {
          const reverse = THREE.MathUtils.smoothstep(gesture.elapsed, 7.8, 10.4);
          ideal = new THREE.Vector3(3.4, 5.7, 28.5).lerp(new THREE.Vector3(3.8, 4.9, 15.3), reverse);
          focus = new THREE.Vector3(-6.3, 2.45, 22);
        }
        ideal.add(origin); focus.add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.oracleVisit) {
      const gesture = this.motion.oracleVisit; const center = FILM_SETS.film_oracle_home.center;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 2.99, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1, center.z); const portrait = this.camera.aspect < .85;
        let ideal = new THREE.Vector3(-5.72, 4.72, portrait ? -12.6 : -15.4);
        let focus = new THREE.Vector3(-5.72, 4.04, -22);
        if (gesture.phase === 'examining' && gesture.elapsed >= 4.6 && gesture.elapsed < 7.25) {
          ideal = new THREE.Vector3(-1.45, 4.45, -18.1); focus = new THREE.Vector3(-7.05, 4.08, -22);
        } else if (gesture.phase === 'examining' && gesture.elapsed >= 7.25) {
          ideal = new THREE.Vector3(-5.55, 3.72, -16.25); focus = new THREE.Vector3(-5.76, 2.78, -21.8);
        } else if (gesture.phase === 'question') {
          ideal = new THREE.Vector3(-1.35, 4.4, -18.2); focus = new THREE.Vector3(-7.05, 4.08, -22);
        } else if (gesture.phase === 'responding') {
          ideal = new THREE.Vector3(-10.1, 4.42, -18.1); focus = new THREE.Vector3(-4.4, 4.08, -22);
        }
        ideal.add(origin); focus.add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.rescue) {
      const gesture = this.motion.rescue; const center = FILM_SETS[state.currentLocation].center;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 2.99, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1, center.z); let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (gesture.phase === 'briefing') {
          const close = THREE.MathUtils.smoothstep(gesture.elapsed, 5.6, 7.9);
          ideal = new THREE.Vector3(-12.8, 6.5, 9.8).lerp(new THREE.Vector3(9.5, 5.1, 5.8), close);
          focus = new THREE.Vector3(0, 2.25, -.4).lerp(new THREE.Vector3(0, 2.65, -1.2), close);
        } else if (gesture.phase === 'racks_arriving') {
          const approach = THREE.MathUtils.smoothstep(gesture.elapsed, .3, RESCUE.racksArrival);
          ideal = new THREE.Vector3(0, 8.2, 18).lerp(new THREE.Vector3(13.5, 5.6, 5), approach);
          focus = new THREE.Vector3(0, 2.7, -18).lerp(new THREE.Vector3(0, 2.6, -11), approach);
        } else {
          const selected = RESCUE.loadoutRoots[gesture.loadout ?? 'rifle']; const reverse = THREE.MathUtils.smoothstep(gesture.elapsed, 2.5, 4.6);
          ideal = new THREE.Vector3(selected.x + 6.8, 4.7, selected.z + 5.5).lerp(new THREE.Vector3(selected.x - 5.4, 4.35, selected.z + 4.2), reverse);
          focus = new THREE.Vector3(selected.x, 2.65, selected.z + .4);
        }
        ideal.add(origin); focus.add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.betrayal) {
      const gesture = this.motion.betrayal; const center = FILM_SETS[state.currentLocation].center;
      if (this.firstPerson) {
        const low = gesture.kind === 'unplugged' && gesture.role === 'tank' && ['unplugging', 'aiming', 'window'].includes(gesture.phase);
        const eye = new THREE.Vector3(this.position.x, this.position.y + (low ? 1.35 : 2.99), this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1, center.z); let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (gesture.kind === 'bathroom') {
          const crash = gesture.phase === 'sacrifice' && gesture.elapsed > 2.1;
          ideal = crash ? new THREE.Vector3(-5.8, 3.7, -1.8) : new THREE.Vector3(9.8, 5.2, 5.8);
          focus = crash ? new THREE.Vector3(3.2, 2.5, -6.7) : new THREE.Vector3(0, 3, -2.7);
        } else if (gesture.phase === 'unplugging') {
          const second = gesture.elapsed > 3.5; ideal = second ? new THREE.Vector3(12.5, 5.1, 1.8) : new THREE.Vector3(-14.5, 5.7, -1.5);
          focus = second ? new THREE.Vector3(3.4, 2.4, 5.5) : new THREE.Vector3(-4.6, 2.55, -5);
        } else if (gesture.phase === 'aiming' || gesture.phase === 'window') {
          ideal = new THREE.Vector3(-10.8, 2.3, -16.5); focus = new THREE.Vector3(-2.6, 3.1, -8.2);
        } else if (gesture.phase === 'countering') {
          ideal = gesture.elapsed < 2.2 ? new THREE.Vector3(-11.6, 2.15, -14.8) : new THREE.Vector3(5.8, 4.25, -13.8);
          focus = gesture.elapsed < 2.2 ? new THREE.Vector3(-7, 1.45, -14) : new THREE.Vector3(-3, 2.6, -8);
        } else if (gesture.phase === 'reconnect') {
          ideal = new THREE.Vector3(0, 6.8, -21.5); focus = new THREE.Vector3(0, 2.6, 1);
        } else {
          ideal = new THREE.Vector3(-13.5, 5.3, -8.5); focus = new THREE.Vector3(0, 2.7, -2);
        }
        ideal.add(origin); focus.add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.sentinel && !this.firstPerson) {
      const gesture = this.motion.sentinel; const center = FILM_SETS.film_service_tunnels.center; const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const detected = gesture.phase === 'detected' || gesture.phase === 'failed'; const window = ['clear', 'confirming'].includes(gesture.phase);
      const ideal = (detected ? new THREE.Vector3(9.5, 5.6, -35.5) : window ? new THREE.Vector3(10.5, 5.2, -38.5) : new THREE.Vector3(-11.5, 6.2, -31.5)).add(origin);
      const focus = (detected ? new THREE.Vector3(0, 5.4, -52) : window ? new THREE.Vector3(0, 5, -55) : new THREE.Vector3(0, 3.1, -39)).add(origin);
      if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.reveal) {
      const gesture = this.motion.reveal; const center = FILM_SETS[gesture.kind === 'construct' ? 'film_white_construct' : 'film_real_desert'].center;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + (gesture.kind === 'construct' ? 2.35 : 3.02), this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else if (gesture.kind === 'construct') {
        const boot = THREE.MathUtils.smoothstep(gesture.elapsed, .6, 2.4); const entry = THREE.MathUtils.smoothstep(gesture.elapsed, 8.1, 10.7);
        const ideal = new THREE.Vector3(13, 4.8, -9.5).lerp(new THREE.Vector3(8.5, 4.7, -1.5), boot).lerp(new THREE.Vector3(0, 3.25, -13.9), entry).add(new THREE.Vector3(center.x, center.y - 1, center.z));
        const focus = new THREE.Vector3(0, 2.4, -10.5).lerp(new THREE.Vector3(0, 3.1, -15.2), boot).lerp(new THREE.Vector3(0, 3.25, -16.5), entry).add(new THREE.Vector3(center.x, center.y - 1, center.z));
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-6 * delta));
        this.camera.lookAt(focus);
      } else {
        const reaction = THREE.MathUtils.smoothstep(gesture.elapsed, 10.1, 11.4);
        const ideal = new THREE.Vector3(10, 7.2, -15).lerp(new THREE.Vector3(-6.5, 4.6, -20), reaction).add(new THREE.Vector3(center.x, center.y - 1, center.z));
        const focus = new THREE.Vector3(-1, 5, -55).lerp(new THREE.Vector3(1.8, 2.5, -28), reaction).add(new THREE.Vector3(center.x, center.y - 1, center.z));
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-5 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.recovery !== undefined) {
      const rise = THREE.MathUtils.smoothstep(this.motion.recovery, 7, 11.7);
      if (this.firstPerson) {
        const eye = new THREE.Vector3(0, THREE.MathUtils.lerp(1.7, 3.13, rise), THREE.MathUtils.lerp(-1.78, .32, rise));
        eye.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.rotation).add(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
        this.camera.position.copy(eye);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        const lying = forward.clone().multiplyScalar(.24).add(new THREE.Vector3(0, .97, 0)).normalize();
        forward.lerp(lying, 1 - rise).normalize(); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const ideal = new THREE.Vector3(this.position.x + THREE.MathUtils.lerp(3, 1.5, rise), this.position.y + THREE.MathUtils.lerp(4, 4.8, rise), this.position.z + THREE.MathUtils.lerp(6, 5, rise));
        const focus = new THREE.Vector3(this.position.x, this.position.y + THREE.MathUtils.lerp(2.55, 3.05, rise), this.position.z);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.meeting && !this.firstPerson) {
      const gesture = this.motion.meeting; const pose = meeting!; const center = FILM_SETS.film_adams_bridge.center;
      const car = meetingCarPose(gesture); const origin = new THREE.Vector3(center.x + car.x, center.y - 1, center.z + car.z);
      const entering = gesture.phase === 'boarding' || gesture.phase === 'leaving' || gesture.phase === 'exiting';
      const doorway = gesture.phase === 'hesitating' || gesture.phase === 'reconsidering';
      const travelling = gesture.phase === 'driving' || gesture.phase === 'parked';
      const portrait = this.camera.aspect < .8;
      const ideal = travelling ? portrait ? new THREE.Vector3(9, 6.2, 13) : new THREE.Vector3(14, 8, 19)
        : entering ? new THREE.Vector3(9, 4.4, 7) : doorway ? portrait ? new THREE.Vector3(8, 4.1, 5) : new THREE.Vector3(9, 4.4, 5.5) : new THREE.Vector3(.1, 3.65, -2.85);
      const focus = travelling ? new THREE.Vector3(0, 2.1, 0) : entering ? new THREE.Vector3(2.6, 2.3, 1.5) : doorway ? new THREE.Vector3(2.3, 2.75, 1.65) : new THREE.Vector3(.12, 2.95, 1.85);
      if (!entering && pose.probe > 0) { ideal.lerp(new THREE.Vector3(1.1, 3.65, -1.25), pose.probe); focus.lerp(new THREE.Vector3(.65, 2.65, 1.65), pose.probe); }
      if (!entering && pose.discard > 0) { ideal.lerp(new THREE.Vector3(.1, 3.55, -.8), pose.discard); focus.lerp(new THREE.Vector3(-1.8, 2.9, .65), pose.discard); }
      const rotation = new THREE.Euler(0, car.yaw, 0); ideal.applyEuler(rotation).add(origin); focus.applyEuler(rotation).add(origin);
      if (resetCamera || (entering || doorway || gesture.phase === 'scanning') && gesture.elapsed < .15) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.meeting && this.firstPerson) {
      const eye = this.meetingEye(this.motion.meeting);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (interviewApproach) {
      const room = FILM_SETS.film_agent_interrogation;
      // Orbit sideways: the entry is too close to the rear wall for a straight follow camera.
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const ideal = this.cameraTarget.clone().addScaledVector(forward, -4).addScaledVector(right, -6);
      ideal.x = THREE.MathUtils.clamp(ideal.x, room.center.x - room.width / 2 + .65, room.center.x + room.width / 2 - .65);
      ideal.z = THREE.MathUtils.clamp(ideal.z, room.center.z - room.depth / 2 + .65, room.center.z + room.depth / 2 - .65);
      ideal.y = this.position.y + 4.8;
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-10 * delta));
      this.camera.lookAt(this.cameraTarget.clone().addScaledVector(forward, 3));
    } else if (this.motion.interrogation && !this.firstPerson) {
      const gesture = this.motion.interrogation; const center = FILM_SETS.film_agent_interrogation.center; const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const action = gesture.phase === 'coercion' || gesture.phase === 'done'; const t = gesture.elapsed;
      let ideal = new THREE.Vector3(2, 4.7, 9.6); let focus = new THREE.Vector3(.1, 2.5, 0);
      if (gesture.phase === 'response' || action && t < 5.3) {
        ideal.set(.9, 3.4, 3.5); focus.set(4, 3.15, 0);
        const mouth = action ? THREE.MathUtils.smoothstep(t, 1.8, 3.1) : 0;
        ideal.lerp(new THREE.Vector3(2.35, 3.25, .48), mouth); focus.lerp(new THREE.Vector3(3.85, 3.12, 0), mouth);
      } else if (action && t < 12.7) {
        const pin = THREE.MathUtils.smoothstep(t, 9.8, 12.7);
        ideal.set(2.2, 5.8, 7.5).lerp(new THREE.Vector3(3.5, 5.5, 7.5), pin); focus.set(4.8, 3, 0).lerp(new THREE.Vector3(0, 2.6, 0), pin);
      }
      else if (action) {
        ideal.set(4.8, 5.8, 6.2); focus.set(.3, 2.75, 0);
        const device = THREE.MathUtils.smoothstep(t, 14, 15.2); const implant = THREE.MathUtils.smoothstep(t, 17.7, 19);
        ideal.lerp(new THREE.Vector3(.3, 4.55, 3), device).lerp(new THREE.Vector3(-.2, 4.8, 1.6), implant);
        focus.lerp(new THREE.Vector3(-.35, 3.25, -.55), device).lerp(new THREE.Vector3(-.43, 2.94, .01), implant);
      }
      ideal.add(origin); focus.add(origin);
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.knock !== undefined && !this.firstPerson) {
      const center = FILM_SETS.film_lafayette.center;
      const ideal = new THREE.Vector3(center.x + 26.2, center.y + 4.45, center.z + 5.3);
      const focus = new THREE.Vector3(center.x + 21.55, center.y + 2.55, center.z + .2);
      if (resetCamera || this.motion.knock < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.welcome && !this.firstPerson) {
      const gesture = this.motion.welcome; const center = FILM_SETS.film_lafayette.center;
      const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const shot = lafayetteWelcomeCamera(gesture); const ideal = shot.ideal; const focus = shot.focus;
      ideal.add(origin); focus.add(origin);
      const changed = this.welcomeShot !== shot.name; this.welcomeShot = shot.name;
      if (resetCamera || changed) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.pills && !this.firstPerson) {
      const center = FILM_SETS.film_lafayette.center;
      const taking = this.motion.pills.phase === 'taking';
      const close = taking ? THREE.MathUtils.smoothstep(this.motion.pills.elapsed, .1, 1.2) * (1 - THREE.MathUtils.smoothstep(this.motion.pills.elapsed, 3.65, 4.3)) : 0;
      const mouth = taking ? THREE.MathUtils.smoothstep(this.motion.pills.elapsed, 2.15, 2.85) * (1 - THREE.MathUtils.smoothstep(this.motion.pills.elapsed, 3.85, 4.3)) : 0;
      const departure = taking ? THREE.MathUtils.smoothstep(this.motion.pills.elapsed, 10, PILL_TIMING.walk) : 0;
      const mirrorReveal = taking && this.motion.pills.choice === 'red' ? THREE.MathUtils.smoothstep(this.motion.pills.elapsed, PILL_TIMING.exit - .7, PILL_TIMING.take) : 0;
      const ideal = new THREE.Vector3(.1, 3.85, 1.1).lerp(new THREE.Vector3(.6, 3.05, -2.1), close).lerp(new THREE.Vector3(-.3, 3.85, -2.8), mouth)
        .lerp(new THREE.Vector3(-1.5, 5.2, 8), departure).add(new THREE.Vector3(center.x, center.y - 1, center.z));
      const focus = new THREE.Vector3(0, 2.6, -6).lerp(new THREE.Vector3(-.2, 2.5, -5.8), close).lerp(new THREE.Vector3(1.3, 3.2, -6), mouth)
        .lerp(new THREE.Vector3(-1, 2.7, -5.4), departure).lerp(new THREE.Vector3(-4, 3.1, -9.5), mirrorReveal)
        .add(new THREE.Vector3(center.x, center.y - 1, center.z));
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-6 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.mirrorBeat !== undefined && !this.firstPerson) {
      const center = FILM_SETS.film_lafayette.center;
      const ideal = new THREE.Vector3(center.x + MIRROR_SEAT.x + 5.2, center.y + 5.1, center.z + MIRROR_SEAT.z + 2);
      const focus = new THREE.Vector3(this.position.x, center.y + 2.5, this.position.z - .5);
      if (resetCamera || this.motion.mirrorBeat < .12) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.performance === 'pod' && state.currentLocation === 'film_power_plant_pods') {
      const center = FILM_SETS.film_power_plant_pods.center;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(center.x - .85, center.y + 2.5, center.z - 13.8);
        const pitch = this.pitch - 1.47, yaw = this.yaw - .12;
        const forward = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.add(forward));
      } else {
        const ideal = new THREE.Vector3(center.x + 5.8, center.y + 8.2, center.z - 6.5);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(center.x, center.y + 4.9, center.z - 12.5);
      }
    } else if (this.firstPerson && state.currentLocation === 'film_power_plant_pods' &&
      (this.motion.performance === 'float' || this.motion.performance === 'lift')) {
      const eye = new THREE.Vector3(this.position.x - .85, this.position.y + 2.5, this.position.z - .5);
      const pitch = this.pitch - 1, yaw = this.yaw - Math.PI / 2;
      const forward = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.add(forward));
    } else if (this.performing && this.motion.crossing !== undefined && !this.firstPerson) {
      const center = FILM_SETS.film_metacortex_floor.center;
      const outside = THREE.MathUtils.smoothstep(this.motion.crossing, 1.7, 5.4);
      const ideal = new THREE.Vector3(center.x - 29.4, center.y + 3.8, center.z - 31 - outside * 4.5);
      if (this.motion.crossing < .15 || resetCamera) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(this.position.x, this.position.y + 1.9, this.position.z);
    } else if (this.performing && this.motion.window !== undefined && !this.firstPerson) {
      const center = FILM_SETS.film_metacortex_floor.center;
      const reveal = THREE.MathUtils.smoothstep(this.motion.window, 2, 3.2);
      const ideal = new THREE.Vector3(-20, 6.6, -22.5).lerp(new THREE.Vector3(-24, 6.8, -25), reveal).add(new THREE.Vector3(center.x, center.y - 1, center.z));
      const focus = new THREE.Vector3(-28.5, 3.8, -27).lerp(new THREE.Vector3(-42, -8, -36), reveal).add(new THREE.Vector3(center.x, center.y - 1, center.z));
      this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta)); this.camera.lookAt(focus);
    } else if (this.performing && this.phone && this.motion.window === undefined && this.motion.crossing === undefined) {
      const center = FILM_SETS.film_metacortex_floor.center;
      const call = this.phone.phase === 'answering' ? THREE.MathUtils.smoothstep(this.phone.elapsed, .4, 2) : 0;
      const lift = this.phone.phase === 'pickup' ? THREE.MathUtils.smoothstep(this.phone.elapsed, .65, 1.8) : 1;
      const origin = new THREE.Vector3(center.x + OFFICE_CONTACT.x, center.y - 1, center.z + OFFICE_CONTACT.z);
      const ideal = origin.clone().add(new THREE.Vector3(.7, 4.25, .5).lerp(new THREE.Vector3(2.35, 4.35, -2.5), call));
      const target = origin.clone().add(new THREE.Vector3(.5, 2.725, -1.39).lerp(new THREE.Vector3(.38, 3.255, -.66), lift).lerp(new THREE.Vector3(.15, 3.65, -.1), call));
      this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta)); this.camera.lookAt(target);
    } else if (this.performing && this.motion.vase !== undefined) {
      const center = FILM_SETS.film_oracle_home.center;
      const ideal = new THREE.Vector3(center.x + 1.8, center.y + 4.8, center.z - 8.8);
      this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(center.x + 7.6, center.y + 1.7, center.z - 11.7);
    } else if (spoon) {
      spoon.updateWorldMatrix(true, false);
      const focus = spoon.localToWorld(new THREE.Vector3(.1, .55, 0));
      const ideal = focus.clone().add(new THREE.Vector3(Math.sin(this.yaw + .45) * 2.1, .35 + Math.sin(this.pitch), Math.cos(this.yaw + .45) * 2.1));
      this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta)); this.camera.lookAt(focus);
    } else if (this.motion.mountainFlight && ['takeoff', 'flying', 'arrived'].includes(this.motion.mountainFlight.phase)) {
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 2.3, this.position.z);
        this.camera.position.copy(eye); this.camera.lookAt(eye.x, eye.y + .35, eye.z - 24);
      } else {
        const ideal = new THREE.Vector3(this.position.x + 3, this.position.y + 8, this.position.z + 21);
        const focus = new THREE.Vector3(this.position.x, this.position.y + 1, this.position.z - 8);
        if (resetCamera) this.camera.position.copy(ideal);
        else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.burly?.phase === 'flight') {
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 2.35, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const center = FILM_SETS.film_oracle_courtyard.center;
        const ideal = new THREE.Vector3(center.x + 14, this.position.y + 16, center.z - 61);
        const focus = new THREE.Vector3(this.position.x, this.position.y + 1.7, this.position.z + 2.2);
        if (resetCamera || this.motion.burly.elapsed < .12) this.camera.position.copy(ideal);
        else this.camera.position.lerp(ideal, 1 - Math.exp(-9 * delta));
        this.camera.lookAt(focus);
      }
    } else if (state.currentLocation === 'film_freeway_trucks' && this.truckRescue && !this.firstPerson) {
      const ideal = new THREE.Vector3(this.position.x + 8, this.position.y + 8, this.position.z + 12);
      const focus = new THREE.Vector3(this.position.x, this.position.y + 1.8, this.position.z - 3);
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (state.currentLocation === 'film_freeway_trucks' && !this.firstPerson) {
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const ideal = new THREE.Vector3(this.position.x, this.position.y + 8, this.position.z)
        .addScaledVector(forward, -17).addScaledVector(right, this.camera.aspect < .8 ? -3.5 : -6);
      const focus = new THREE.Vector3(this.position.x, this.position.y + 1.8, this.position.z).addScaledVector(forward, 3);
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.climbing && state.currentLocation === 'film_office_ledge' && !this.firstPerson) {
      const ideal = new THREE.Vector3(this.position.x - 6.5, this.position.y + 5.5, this.position.z - 15);
      const focus = new THREE.Vector3(this.position.x - 4, this.position.y - 2.5, this.position.z + 9);
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.gunner) {
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const ideal = new THREE.Vector3(this.position.x, this.position.y + (this.firstPerson ? 5.6 : 8.4), this.position.z)
        .addScaledVector(forward, this.firstPerson ? 6 : -10).addScaledVector(side, this.firstPerson ? 0 : -7);
      const focus = new THREE.Vector3(this.position.x, this.position.y + 5.6 - Math.sin(this.pitch - .24) * 24, this.position.z)
        .addScaledVector(forward, 36);
      if (this.firstPerson || resetCamera) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-12 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.epilogue && trilogyEpilogueLocked(this.motion.epilogue) && this.firstPerson) {
      const carried = this.motion.epilogue.kind === 'neo_carried';
      const eye = new THREE.Vector3(this.position.x, this.position.y + (carried ? 1.25 : 2.25), this.position.z + (carried ? .7 : 0));
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().addScaledVector(forward, 20));
    } else if (this.motion.epilogue && trilogyEpilogueLocked(this.motion.epilogue)) {
      const gesture = this.motion.epilogue; const center = FILM_SETS[state.currentLocation].center;
      const carried = gesture.kind === 'neo_carried'; const dawn = gesture.kind === 'dawn';
      const focus = carried ? new THREE.Vector3(this.position.x, this.position.y + .8, this.position.z - .4)
        : dawn ? new THREE.Vector3(center.x, center.y + 8, center.z - 28)
          : new THREE.Vector3(center.x, center.y + 5.5, center.z + (gesture.phase === 'retreat' ? -42 : 14));
      const ideal = carried ? new THREE.Vector3(this.position.x + 13, this.position.y + 6.8, this.position.z + 4.5)
        : dawn ? new THREE.Vector3(center.x + 17, center.y + 9, center.z + 1)
          : new THREE.Vector3(center.x + 15, center.y + 9, center.z + (gesture.phase === 'retreat' ? -20 : 31));
      if (resetCamera || gesture.elapsed < .08) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.smithFinale && smithFinaleLocked(this.motion.smithFinale) && this.firstPerson) {
      const pose = smithFinalePose(this.motion.smithFinale);
      const eye = new THREE.Vector3(this.position.x, this.position.y + 2.32 - pose.fallen * 1.05, this.position.z);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().addScaledVector(forward, 18));
    } else if (this.motion.smithFinale && smithFinaleLocked(this.motion.smithFinale)) {
      const gesture = this.motion.smithFinale; const pose = smithFinalePose(gesture); const center = FILM_SETS.film_smith_avenue.center;
      const neo = new THREE.Vector3(center.x + pose.neo.x, center.y + pose.neo.y + 1.7, center.z + pose.neo.z);
      const smith = new THREE.Vector3(center.x + pose.smith.x, center.y + pose.smith.y + 1.7, center.z + pose.smith.z);
      const focus = neo.clone().lerp(smith, gesture.phase === 'surrender' || gesture.phase === 'assimilating' ? .56 : .5);
      const flying = pose.flight > .1; const crater = ['crater', 'choice', 'vision', 'understanding', 'surrender', 'assimilating', 'purging'].includes(gesture.phase);
      const distance = flying ? 18 : crater ? 11 : 14; const height = flying ? 7.5 : crater ? 4.8 : 6.4; const side = flying ? 5 : crater ? 4.2 : 5.5;
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const ideal = focus.clone().addScaledVector(forward, -distance).addScaledVector(right, side); ideal.y += height;
      if (resetCamera || gesture.elapsed < .08) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.deusPact && deusPactLocked(this.motion.deusPact) && this.firstPerson) {
      const pose = deusPactPose(this.motion.deusPact);
      const eye = new THREE.Vector3(this.position.x, this.position.y + 2.05 - pose.seated * .72, this.position.z + .22);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      const focus = pose.face > .15 && pose.seated < .4
        ? new THREE.Vector3(this.position.x, this.position.y + 20, this.position.z - 22)
        : eye.clone().add(forward);
      this.camera.position.copy(eye); this.camera.lookAt(focus);
    } else if (this.motion.deusPact && deusPactLocked(this.motion.deusPact)) {
      const pose = deusPactPose(this.motion.deusPact);
      const orbit = this.yaw - Math.PI; const side = pose.seated > .4 ? 4.3 : this.camera.aspect < .85 ? 4.8 : 6.4;
      const back = pose.seated > .4 ? -4.5 : 8.2;
      const ideal = new THREE.Vector3(this.position.x + Math.cos(orbit) * side + Math.sin(orbit) * back,
        this.position.y + (pose.seated > .4 ? 3.8 : 8.6), this.position.z - Math.sin(orbit) * side + Math.cos(orbit) * back);
      const focus = pose.seated > .4
        ? new THREE.Vector3(this.position.x, this.position.y + 2.35, this.position.z + .1)
        : pose.face > .15 ? new THREE.Vector3(this.position.x, this.position.y + 20, this.position.z - 21)
          : new THREE.Vector3(this.position.x, this.position.y + 5.8, this.position.z - 8);
      if (resetCamera || this.motion.deusPact.elapsed < .12) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.farewell && this.firstPerson) {
      const eye = new THREE.Vector3(this.position.x, this.position.y + 2.05, this.position.z + .72);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (this.motion.farewell) {
      const ideal = new THREE.Vector3(this.position.x + (this.camera.aspect < .85 ? 5.8 : 4.8), this.position.y + 4.4, this.position.z + 3.2);
      const focus = new THREE.Vector3(this.position.x, this.position.y + 1.45, this.position.z - .35);
      if (resetCamera || this.motion.farewell.elapsed < .12) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-9 * delta));
      this.camera.lookAt(focus);
    } else if (this.firstPerson) {
      this.camera.position.copy(target);
      if (this.motion.grounded && this.motion.speed > .1) this.camera.position.y += Math.sin(this.cameraStep * 2) * .018;
      const pitch = interview?.pinned ? THREE.MathUtils.lerp(this.pitch, -Math.PI / 2 + this.pitch * .6, interview.pinned) : this.pitch;
      this.camera.lookAt(target.x + Math.sin(this.yaw) * Math.cos(pitch), target.y - Math.sin(pitch), target.z + Math.cos(this.yaw) * Math.cos(pitch));
    } else {
      const offset = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch) + 0.1, -Math.cos(this.yaw) * Math.cos(this.pitch));
      const shoulder = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).multiplyScalar(this.camera.aspect < .8 ? .3 : .8);
      const pivot = this.cameraTarget.clone().add(shoulder);
      const followDistance = this.motion.farewell ? 8.5 : this.ride?.mode ? 34 : this.ride ? 22 : this.camera.aspect < .8 ? 13 : 11.5;
      let cameraDistance = followDistance;
      for (let distance = 1; !(this.performing && state.currentLocation === 'film_power_plant_pods') && distance <= followDistance; distance += .5) {
        const point = pivot.clone().addScaledVector(offset, distance);
        if (playerBlocked(point, state.isInMatrix, 0.5, this.structures)) { cameraDistance = Math.max(2, distance - 1); break; }
      }
      const ideal = pivot.clone().addScaledVector(offset, cameraDistance);
      if (resetCamera) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-20 * delta));
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
