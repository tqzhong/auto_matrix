import { dockReloadHeight, dockReloadLocked } from '@auto_matrix/shared';
import { dockGateEye, dockGateAim, dockGateShip, dockLastStandLocked, dockLastStandPose } from '@auto_matrix/shared';
import { crosscutView } from '@auto_matrix/shared';
import { truthRest, truthKneel, truthSeat } from '@auto_matrix/shared';
import { METACORTEX } from '@auto_matrix/shared';
import { OFFICE_CUSTODY, officeCustodyStep } from '@auto_matrix/shared';
import { ARREST_BIKE, arrestCarPoint, arrestBikePoint, arrestMirrorShot } from '@auto_matrix/shared';
import { catchLocked, deusPactLocked, deusPactPose, reloadedPhaseLocked, SMITH_FINALE, smithFinaleLocked, smithFinalePose, smithCraterAmount, smithCraterFloor, smithOracleRestored, trilogyEpilogueLocked } from '@auto_matrix/shared';
import { reloadedCamera } from './ReloadedCamera.js';
import * as THREE from 'three';
import { spoonLessonSeat, oracleDepartureLocked, pillPose } from '@auto_matrix/shared';
import { FILM_SETS, OFFICE_CONTACT, LOBBY_FIRE_INTERVAL, RESCUE, PILL_ROOM, PILL_TIMING, MIRROR_SEAT, MIRROR_TIMING, groundHeight, playerBlocked, stepPlayer, MELEE_COMBO, COMBO_WINDOW, DOJO_COMBO_WINDOW, COMBAT_SKILLS, combatDisplace, PLAYER_WALK_SPEED, meleeReach, trainingRoot, matrixEscapePhaseLocked, matrixEscapePose, matrixEscapeRoot, theOnePhaseLocked, theOnePose, theOneRoot, sentinelMachinePose, type OfficePhone, type AwakeningPose, type FreewayRide, type AgentState, type PlayerInput, type Vector3, type WorldStructure, type CombatImpact, type SkillCast, type RescueLoadout } from '@auto_matrix/shared';
import { lafayetteWelcomeCamera } from './LafayetteWelcomeCamera.js';
import type { MotionInput } from '../agents/CharacterMotion.js';
import { ambushCompanyStep } from '@auto_matrix/shared';
import { AIR_RESCUE, governmentPose, airRescuePose, airRescueRoot, interrogationPose, meetingPose, meetingCarPose, meetingCarPoint, MEETING_TIMING } from '@auto_matrix/shared';
import { officeClothing } from '@auto_matrix/shared';
import { officeClipboardPoint } from '@auto_matrix/shared';
import { APARTMENT_BOOK, APARTMENT_NETWORK, APARTMENT_ROOM, apartmentComputerPose, apartmentBookCrouch, cabinSeat, computerCheckLocked, computerNetworkPull, MORNING, POD_RESCUE, podRescuePose, recoveryBodyPose, recoveryCrewPose } from '@auto_matrix/shared';
import { mirrorEntryPose } from '@auto_matrix/shared';
import { ambushCat } from '@auto_matrix/shared';
import { wetwallPose, sixthPose, bathroomFightRoot, WETWALL, WETWALL_SHAFT, type WetwallPhase } from '@auto_matrix/shared';
import { BASEMENT, TV_EXIT, basementBlocked, basementDropPose, basementDropRoot, basementDropPlayback, tvExitEmergeRoot, tvExitEmergingRole, type BasementDropPlayback } from '@auto_matrix/shared';

export class PlayerControls {
  id: string | null = null;
  firstPerson = false;
  custodyBodies?: Vector3[];
  private inOfficeLift = false;
  private recoveryYaw: number | undefined;
  private truthYaw: number | undefined;
  private keys = new Set<string>();
  private yaw = 0;
  private movementYaw = 0;
  private movementForward = 0;
  private movementRight = 0;
  private lastLook = -1000;
  private pitch = 0.24;
  private cableAim = false;
  private bookAim = false;
  private morningAim = false;
  private signingAim = false;
  private lastStandAim = false;
  private cablePitch?: number;
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
  private podInterior = false;
  private bridgeCaught?: { x: number; z: number };
  readonly motion: MotionInput = { speed: 0, verticalVelocity: 0, grounded: true, turn: 0 };
  onViewChange?: (firstPerson: boolean) => void;
  onMenu?: () => void;
  onPanel?: (panel: 'inventory' | 'journal' | 'map') => void;
  onClosePanel?: () => boolean;
  onHUD?: () => void;
  structures: WorldStructure[] = [];
  targets: Vector3[] = [];
  ambushCompany: Vector3[] = [];
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
  private arrestYaw?: number;
  private chairYaw?: number;
  private mirrorYaw?: number;
  mirror = 0;
  spoon?: number;
  ambushObservation?: number;
  private watchingAmbush = false;
  private wetwallGuide?: { phase: WetwallPhase; from: number; to: number; progress: number; elapsed: number };
  private hangingWetwall = false;
  private basementDropClock?: BasementDropPlayback;
  private sixthGuide?: { source: NonNullable<MotionInput['sixth']>; elapsed: number };
  private bathroomGuide?: { source: NonNullable<MotionInput['bathroom']>; elapsed: number };
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
    this.custodyBodies = undefined; this.motion.officeCustody = undefined;
    this.meetingYaw = undefined; this.arrestYaw = undefined; this.welcomeShot = undefined; this.performing = false; this.phoneExit = false;
    this.chairYaw = undefined;
    this.mirrorYaw = undefined; this.motion.mirrorEntry = undefined;
    this.bridgeCaught = undefined;
    this.watchingAmbush = false;
    this.wetwallGuide = undefined; this.hangingWetwall = false; this.sixthGuide = undefined; this.motion.sixth = undefined;
    this.bathroomGuide = undefined; this.motion.bathroom = undefined;
    this.basementDropClock = undefined;
    this.id = state.id; this.position = { ...state.position }; this.yaw = state.rotation;
    this.recoveryYaw = typeof state.currentAction?.parameters.recovery === 'number'
      ? state.currentAction.parameters.download ? state.rotation : recoveryBodyPose(state.currentAction.parameters.recovery).yaw : undefined;
    this.truthYaw = state.currentAction?.parameters.truth ? state.rotation : undefined;
    this.movementYaw = this.yaw; this.movementForward = 0; this.movementRight = 0;
    this.lastLook = -1000; this.dragging = false;
    this.facing = state.rotation; this.cameraReady = false; this.motion.attack = undefined;
    this.motion.computerCheck = undefined;
    this.cableAim = this.bookAim = this.morningAim = this.signingAim = false;
    if (this.cablePitch !== undefined) this.pitch = this.cablePitch;
    this.cablePitch = undefined;
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
    this.custodyBodies = undefined; this.motion.officeCustody = undefined;
    this.id = null; this.keys.clear(); this.enabled = true; this.firing = false; this.firearm = false; this.weaponStyle = undefined; this.fireInterval = LOBBY_FIRE_INTERVAL; this.ride = undefined; this.gunner = false; this.climbing = false; this.performing = false; this.phoneExit = false; this.mirror = 0; this.spoon = undefined; this.phone = undefined; this.welcomeShot = undefined;
    this.bridgeCaught = undefined;
    this.ambushObservation = undefined; this.watchingAmbush = false;
    this.wetwallGuide = undefined; this.hangingWetwall = false; this.sixthGuide = undefined; this.motion.sixth = undefined;
    this.bathroomGuide = undefined; this.motion.bathroom = undefined;
    this.basementDropClock = undefined;
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
      if (['KeyQ', 'KeyC'].includes(event.code) && !this.motion.officeCustody && this.running && this.authoritative?.status === 'alive') {
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
        this.morningAim = this.firstPerson && Boolean(this.motion.morning);
        this.signingAim = this.firstPerson && this.motion.workday?.role === 'neo' && this.motion.workday.phase === 'signing';
        this.lastStandAim = this.firstPerson && dockLastStandLocked(this.motion.dockLastStand);
        if (this.bridgeCaught) this.cameraReady = false;
        if (this.firstPerson && this.motion.mirrorBeat !== undefined) {
          if (this.motion.mirrorEntry && this.motion.mirrorBeat < MIRROR_TIMING.sit) { this.yaw = this.movementYaw = this.facing; this.pitch = .08; }
          else this.aimAtMirror();
        }
        if (this.firstPerson && this.motion.computerCheck) this.cableAim = true;
        if (this.firstPerson && this.motion.contact?.phase === 'retrieving' && this.motion.contact.propMotion === 'minidisc') this.bookAim = true;
        else if (this.firstPerson && this.authoritative?.currentLocation === 'neo_apartment'
          && Math.hypot(this.position.x - APARTMENT_ROOM.center.x - APARTMENT_NETWORK.screenApproach.x, this.position.z - APARTMENT_ROOM.center.z - APARTMENT_NETWORK.screenApproach.z) < .75) {
          const x = APARTMENT_ROOM.center.x + APARTMENT_NETWORK.screen.x - this.position.x;
          const z = APARTMENT_ROOM.center.z + APARTMENT_NETWORK.screen.z - this.position.z;
          this.yaw = this.movementYaw = Math.atan2(x, z);
          this.pitch = Math.atan2(this.position.y + 2.99 - APARTMENT_NETWORK.screen.y, Math.hypot(x, z));
        }
        if (this.firstPerson && this.motion.meeting && ['scanning', 'located', 'removing', 'discarding'].includes(this.motion.meeting.phase)) this.aimAtMeetingScanner();
        if (this.firstPerson && this.motion.crosscut && (this.motion.crosscut.phase === 'phone' || this.motion.crosscut.phase === 'neo_exit')) this.aimAtHardline();
        if (this.firstPerson && this.motion.officeCustody?.street) { this.yaw = this.movementYaw = this.facing; this.pitch = .12; }
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
    this.pitch = THREE.MathUtils.clamp(this.pitch + event.movementY * 0.002, this.motion.dockGate ? -1.35 : this.motion.mirrorBeat !== undefined ? -.9 : -.4, this.motion.dockGate ? 1.35 : this.motion.computerCheck ? 1.5 : 1.1);
    this.lastLook = performance.now();
  };
  private click = (): void => { if (this.id && this.enabled && document.pointerLockElement !== this.canvas) this.lockPointer(); };

  private aimAtMirror(): void {
    const center = FILM_SETS.film_lafayette.center;
    const x = center.x + PILL_ROOM.mirror.x + .5 - this.position.x;
    const z = center.z + PILL_ROOM.mirror.z - this.position.z;
    const eye = this.position.y + 2.99 - THREE.MathUtils.smoothstep(this.motion.mirrorBeat ?? 0, .65, MIRROR_TIMING.sit) * .9;
    this.yaw = this.movementYaw = Math.atan2(x, z);
    this.pitch = -Math.atan2(center.y + (this.motion.mirrorEntry ? 2.5 : 2.1) - eye, Math.hypot(x, z));
  }

  private aimAtHardline(): void {
    const center = FILM_SETS.film_tv_repair.center;
    const x = center.x + TV_EXIT.phone.x + .26 - this.position.x, z = center.z + TV_EXIT.phone.z + .28 - this.position.z;
    this.yaw = this.movementYaw = Math.atan2(x, z);
    this.pitch = THREE.MathUtils.clamp(Math.atan2(this.position.y + 2.99 - (center.y - 1 + TV_EXIT.phone.y + .2), Math.hypot(x, z)), -.4, 1.1);
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
    const pose = meetingPose(gesture);
    const blend = gesture.phase === 'scanning' && !gesture.bugged
      ? THREE.MathUtils.smoothstep(gesture.elapsed, MEETING_TIMING.scanning - 2, MEETING_TIMING.scanning)
      : gesture.phase === 'discarding' ? pose.discard
        : ['scanning', 'located', 'removing'].includes(gesture.phase) ? 0 : 1;
    return new THREE.Vector3(-1.05 * blend, 2.74 - pose.duck * .43, .4 - 1.2 * blend)
      .applyEuler(new THREE.Euler(0, meetingCarPose(gesture).yaw, 0))
      .add(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
  }

  triggerCombat(kind: 'attack' | 'dodge', guided = false, guidedCombo?: number): boolean {
    if (this.motion.officeCustody) return false;
    if (kind === 'attack') return this.requestAttack(guided, guidedCombo);
    if (!this.running || !this.enabled || this.authoritative?.status !== 'alive') return false;
    this.send(this.input(false)); this.action('dodge');
    return true;
  }

  private requestAttack(guided = false, guidedCombo?: number): boolean {
    if (this.motion.officeCustody) return false;
    if (this.motion.bathroom || this.motion.reloaded?.phase === 'falling' || this.motion.catch?.phase === 'pulse' || this.motion.dockReload?.phase === 'jammed') {
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
    if (this.motion.officeCustody || !this.firearm || !this.enabled || !this.running || this.authoritative?.status !== 'alive' || performance.now() - this.lastShot < this.fireInterval * 1000) return;
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
    return { x, z, yaw: attacking ? this.attackYaw : this.yaw, location: this.authoritative?.currentLocation, pitch: this.pitch, sprint: !this.motion.officeCustody && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')), crouch: !this.motion.officeCustody && this.keys.has('KeyZ'), jump: !this.motion.officeCustody && jump,
      drive: this.ride ? { throttle: this.enabled ? Math.max(0, forward) : 0, steer: this.enabled ? right : 0, brake: forward < 0 || !this.enabled } : undefined,
      climb: (this.climbing || dockReloadLocked(this.motion.dockReload) || this.motion.tvExit?.phase === 'emerging') && this.enabled ? forward : 0, focus: this.enabled && this.running && this.keys.has('KeyG'), sequence: ++this.sequence };
  }

  update(delta: number, state: AgentState, group: THREE.Group, running: boolean, phoneExit = false): void {
    if (!this.id) return;
    const sixth = state.currentAction?.parameters.sixth as MotionInput['sixth'];
    if (this.motion.sixth && !sixth) this.performing = false;
    if (sixth && !this.motion.sixth) { this.yaw = this.movementYaw = sixth.role === 'neo' ? 0 : state.rotation; this.pitch = .08; this.cameraReady = false; }
    if (sixth) {
      this.performing = true;
      if (this.sixthGuide?.source !== sixth) this.sixthGuide = { source: sixth, elapsed: sixth.elapsed };
      const guide = this.sixthGuide!;
      if (running && !sixth.paused && !['ready', 'failed', 'done', 'firing'].includes(sixth.phase)) guide.elapsed = Math.min(sixth.elapsed + .5, guide.elapsed + delta);
      this.motion.sixth = { ...sixth, elapsed: guide.elapsed };
    } else { this.motion.sixth = undefined; this.sixthGuide = undefined; }
    const mirrorStarting = this.motion.mirrorBeat === undefined && state.currentAction?.parameters.mirrorBeat !== undefined;
    const mirrorSitting = state.currentAction?.parameters.mirrorEntry && (state.currentAction.parameters.mirrorBeat as number) >= MIRROR_TIMING.sit && (this.motion.mirrorBeat ?? 0) < MIRROR_TIMING.sit;
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
    if (this.motion.truth && !state.currentAction?.parameters.truth) this.performing = false;
    if (state.currentAction?.parameters.truth) this.performing = true;
    if (this.motion.construct && !state.currentAction?.parameters.construct) this.performing = false;
    if (state.currentAction?.parameters.construct) this.performing = (state.currentAction.parameters.construct as MotionInput['construct'])?.phase !== 'approach';
    if (this.motion.reveal && !state.currentAction?.parameters.reveal) this.performing = false;
    if (state.currentAction?.parameters.reveal) this.performing = true;
    if (this.motion.training && !state.currentAction?.parameters.training) this.performing = false;
    if (this.motion.download && !state.currentAction?.parameters.download) this.performing = false;
    if (state.currentAction?.parameters.download) this.performing = true;
    if (state.currentAction?.parameters.training) this.performing = true;
    if (this.motion.workday && !state.currentAction?.parameters.workday) this.performing = false;
    if (state.currentAction?.parameters.workday) this.performing = true;
    if (this.motion.officeCustody && !state.currentAction?.parameters.officeCustody) this.performing = false;
    const custody = state.currentAction?.parameters.officeCustody as MotionInput['officeCustody'];
    if (custody) this.performing = custody.locked ?? (custody.phase === 'securing' || Boolean(custody.paused));
    if (this.motion.contact && !state.currentAction?.parameters.contact) this.performing = false;
    if (state.currentAction?.parameters.contact) this.performing = ['signal', 'reply', 'knocking', 'opening', 'retrieving', 'handover', 'inspecting'].includes((state.currentAction.parameters.contact as NonNullable<MotionInput['contact']>).phase);
    const computerCheck = state.currentAction?.parameters.computerCheck as MotionInput['computerCheck'];
    const computerStarting = Boolean(computerCheck && !this.motion.computerCheck);
    if (this.motion.computerCheck && !computerCheckLocked(computerCheck)) {
      this.performing = false;
      if (this.cablePitch !== undefined) this.pitch = this.cablePitch;
      this.cablePitch = undefined;
    }
    if (computerCheckLocked(computerCheck)) {
      this.performing = true; this.motion.attack = undefined; this.attackQueuedUntil = 0;
      this.localJump = this.networkJump = false; this.impulse = undefined;
    }
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
    const departure = state.currentAction?.parameters.oracleDeparture as MotionInput['oracleDeparture'];
    const departureCinematic = oracleDepartureLocked(departure);
    if (this.motion.oracleDeparture && !departureCinematic) this.performing = false;
    if (departureCinematic) this.performing = true;
    if (this.motion.spoonLesson && !state.currentAction?.parameters.spoonLesson) this.performing = false;
    if (state.currentAction?.parameters.spoonLesson) this.performing = true;
    if (this.motion.betrayal && !state.currentAction?.parameters.betrayal) this.performing = false;
    if (this.motion.wetwall && !state.currentAction?.parameters.wetwall) this.performing = false;
    if (state.currentAction?.parameters.wetwall) this.performing = (state.currentAction.parameters.wetwall as NonNullable<MotionInput['wetwall']>).phase !== 'sealed';
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
    if (this.motion.farewell && (!farewell || farewell.phase === 'ready')) this.performing = false;
    if (farewell && farewell.phase !== 'ready') this.performing = true;
    const deusPact = state.currentAction?.parameters.deusPact as MotionInput['deusPact'];
    if (this.motion.deusPact && !deusPactLocked(deusPact)) this.performing = false;
    if (deusPactLocked(deusPact) && !deusPactLocked(this.motion.deusPact)) {
      this.yaw = this.movementYaw = state.rotation; this.pitch = .24; this.cameraReady = false;
    }
    if (deusPactLocked(deusPact)) this.performing = true;
    const smithFinale = state.currentAction?.parameters.smithFinale as MotionInput['smithFinale'];
    if (this.motion.smithFinale && !smithFinaleLocked(smithFinale)) this.performing = false;
    if (smithFinaleLocked(smithFinale) && !smithFinaleLocked(this.motion.smithFinale)) {
      this.yaw = this.movementYaw = state.rotation; this.pitch = .24; this.cameraReady = false;
    }
    if (smithFinaleLocked(smithFinale)) this.performing = true;
    const dockReload = state.currentAction?.parameters.dockReload as MotionInput['dockReload'];
    const gate = state.currentAction?.parameters.dockGate as MotionInput['dockGate'];
    if (gate && (!this.motion.dockGate || gate.phase === 'ready' && this.motion.dockGate.phase !== 'ready')) { this.yaw = this.movementYaw = gate.yaw; this.pitch = gate.pitch; this.cameraReady = false; }
    this.motion.dockGate = gate;
    const lastStand = state.currentAction?.parameters.dockLastStand as MotionInput['dockLastStand'];
    if (this.motion.dockLastStand && !dockLastStandLocked(lastStand)) this.performing = false;
    if (dockLastStandLocked(lastStand)) {
      if (!dockLastStandLocked(this.motion.dockLastStand) || this.motion.dockLastStand?.phase !== lastStand?.phase && lastStand?.phase === 'kneeling') {
        this.yaw = this.movementYaw = state.rotation; this.pitch = lastStand?.phase === 'attack' ? -.3 : .55; this.cameraReady = false;
        this.lastStandAim = true;
      }
      this.performing = true;
    }
    if (this.motion.dockReload && !dockReloadLocked(dockReload)) this.performing = false;
    if (dockReloadLocked(dockReload)) {
      if (!dockReloadLocked(this.motion.dockReload)) { this.yaw = this.movementYaw = state.rotation; this.pitch = .26; this.cameraReady = false; }
      this.performing = true;
    }
    const epilogue = state.currentAction?.parameters.epilogue as MotionInput['epilogue'];
    if (this.motion.epilogue && !trilogyEpilogueLocked(epilogue)) this.performing = false;
    if (trilogyEpilogueLocked(epilogue) && (!trilogyEpilogueLocked(this.motion.epilogue)
      || epilogue?.kind === 'dawn' && epilogue.phase === 'architect' && this.motion.epilogue?.phase === 'sitting')) {
      this.yaw = this.movementYaw = state.rotation; this.pitch = .06; this.cameraReady = false;
    }
    if (trilogyEpilogueLocked(epilogue)) this.performing = true;
    if (this.motion.lobbyEntry && !state.currentAction?.parameters.lobbyEntry) this.performing = false;
    if ((state.currentAction?.parameters.lobbyEntry as MotionInput['lobbyEntry'])?.phase === 'checkpoint') this.performing = true;
    if (phoneExit) this.performing = true;
    const bridgeCaught = state.currentAction?.parameters.bridgeCaught as { x: number; z: number } | undefined;
    const bridgeCaptureStarting = Boolean(bridgeCaught && !this.bridgeCaught);
    if (this.bridgeCaught && !bridgeCaught) this.performing = false;
    if (bridgeCaught) this.performing = true;
    this.bridgeCaught = bridgeCaught;
    const inOfficeLift = Boolean(state.currentAction?.parameters.metacortexLift);
    if (this.inOfficeLift && !inOfficeLift) this.performing = false;
    if (inOfficeLift) this.performing = true;
    this.inOfficeLift = inOfficeLift;
    let basement = state.currentAction?.parameters.basement as MotionInput['basement'];
    if (basement?.drop !== undefined && basement.start) {
      this.basementDropClock = basementDropPlayback(this.basementDropClock, basement.drop, delta, running && !basement.paused);
      basement = { ...basement, drop: this.basementDropClock.age, landing: basementDropPose(this.basementDropClock.age).landing };
    } else this.basementDropClock = undefined;
    const dropRoot = basement?.drop !== undefined && basement.start ? basementDropRoot(basement.role, basement.start, basement.drop) : undefined;
    const tvExit = state.currentAction?.parameters.tvExit as MotionInput['tvExit'];
    const hardlineStarting = Boolean(state.currentAction?.parameters.crosscut && tvExit?.phase === 'pickup' && this.motion.tvExit?.phase !== 'pickup');
    if (this.motion.basement && !basement || this.motion.tvExit && !tvExit) this.performing = false;
    if (basement) this.performing = Boolean(basement.paused || ['ready', 'descending', 'landing', 'draining', 'tunnel', 'done', 'failed'].includes(basement.phase));
    if (tvExit) this.performing = Boolean(tvExit.paused || ['emerging', 'pickup', 'line_dead', 'calling'].includes(tvExit.phase));
    if (Boolean(this.motion.basement?.crawling) !== Boolean(basement?.crawling)) this.cameraReady = false;
    this.motion.basement = basement; this.motion.tvExit = tvExit;
    this.motion.crosscut = state.currentAction?.parameters.crosscut as MotionInput['crosscut'];
    if (this.motion.crosscut) this.performing = !['phone', 'trinity_ready', 'neo_ready'].includes(this.motion.crosscut.phase) || this.motion.crosscut.phase === 'phone' && Boolean(tvExit);
    if (this.wasPerforming && !this.performing) this.yaw = this.movementYaw = this.facing;
    if (redPillEnded) this.yaw = this.movementYaw = this.facing = state.rotation;
    if (bridgeCaptureStarting) this.yaw = this.movementYaw = Math.atan2(bridgeCaught!.x - state.position.x, bridgeCaught!.z - state.position.z);
    this.wasPerforming = this.performing;
    this.motion.armed = !gate && (this.firearm || state.currentAction?.parameters.armed === true);
    this.motion.seated = state.currentAction?.parameters.seated === true;
    this.motion.floorSeated = state.currentAction?.parameters.floorSeated === true;
    this.motion.weaponStyle = state.currentAction?.parameters.weaponStyle as MotionInput['weaponStyle'] ?? (this.firearm ? this.weaponStyle : undefined);
    this.motion.crouching = farewell?.role === 'neo' || !custody && this.enabled && !this.performing && this.keys.has('KeyZ');
    this.motion.riding = Boolean(this.ride || this.gunner);
    this.motion.performance = this.performing ? state.currentAction?.parameters.filmPose as AwakeningPose : undefined;
    this.motion.mirrorBeat = state.currentAction?.parameters.mirrorBeat as number | undefined;
    this.motion.mirrorEntry = state.currentAction?.parameters.mirrorEntry as MotionInput['mirrorEntry'];
    const mirrorYaw = this.motion.mirrorEntry ? state.rotation : undefined;
    if (mirrorYaw !== undefined && this.mirrorYaw !== undefined && this.firstPerson) {
      const turn = Math.atan2(Math.sin(mirrorYaw - this.mirrorYaw), Math.cos(mirrorYaw - this.mirrorYaw));
      this.yaw += turn; this.movementYaw += turn;
    }
    this.mirrorYaw = mirrorYaw;
    this.motion.helDanceDoor = state.currentAction?.parameters.helDanceDoor as number | undefined;
    this.motion.recovery = state.currentAction?.parameters.recovery as number | undefined;
    this.motion.cabin = state.currentAction?.parameters.cabin as MotionInput['cabin'];
    this.motion.download = state.currentAction?.parameters.download as MotionInput['download'];
    if (this.motion.recovery !== undefined) {
      const yaw = this.motion.download ? state.rotation : recoveryBodyPose(this.motion.recovery).yaw;
      if (this.recoveryYaw !== undefined) { this.yaw += yaw - this.recoveryYaw; this.movementYaw += yaw - this.recoveryYaw; }
      this.recoveryYaw = yaw;
    } else this.recoveryYaw = undefined;
    this.motion.reveal = state.currentAction?.parameters.reveal as MotionInput['reveal'];
    this.motion.truth = state.currentAction?.parameters.truth as MotionInput['truth'];
    if (this.motion.truth) {
      if (this.truthYaw !== undefined) {
        const turn = Math.atan2(Math.sin(state.rotation - this.truthYaw), Math.cos(state.rotation - this.truthYaw));
        this.yaw += turn; this.movementYaw += turn;
      }
      this.truthYaw = state.rotation;
    } else this.truthYaw = undefined;
    this.motion.construct = state.currentAction?.parameters.construct as MotionInput['construct'];
    this.motion.training = state.currentAction?.parameters.training as MotionInput['training'];
    const signingStarting = this.motion.workday?.phase !== 'signing';
    this.motion.workday = state.currentAction?.parameters.workday as MotionInput['workday'];
    if (signingStarting && this.firstPerson && this.motion.workday?.role === 'neo' && this.motion.workday.phase === 'signing') this.signingAim = true;
    const floorBookStarting = this.motion.contact?.phase !== 'retrieving' && (state.currentAction?.parameters.contact as MotionInput['contact'])?.phase === 'retrieving';
    this.motion.contact = state.currentAction?.parameters.contact as MotionInput['contact'];
    if (floorBookStarting && this.firstPerson && this.motion.contact?.propMotion === 'minidisc') this.bookAim = true;
    const chairYaw = this.motion.contact?.chairMotion === 'stepping' && ['signal', 'reply', 'knocking'].includes(this.motion.contact.phase) ? state.rotation : undefined;
    if (chairYaw !== undefined && this.chairYaw !== undefined && this.firstPerson) {
      const turn = Math.atan2(Math.sin(chairYaw - this.chairYaw), Math.cos(chairYaw - this.chairYaw));
      this.yaw += turn; this.movementYaw += turn;
    }
    this.chairYaw = chairYaw;
    this.motion.computerCheck = computerCheck;
    this.motion.wakeCall = state.currentAction?.parameters.wakeCall as MotionInput['wakeCall'];
    this.motion.morning = state.currentAction?.parameters.morning as MotionInput['morning'];
    this.motion.club = state.currentAction?.parameters.club as MotionInput['club'];
    this.motion.sentinel = state.currentAction?.parameters.sentinel as MotionInput['sentinel'];
    this.motion.interlude = state.currentAction?.parameters.interlude as MotionInput['interlude'];
    this.motion.oracleVisit = state.currentAction?.parameters.oracleVisit as MotionInput['oracleVisit'];
    this.motion.oracleDeparture = departure;
    this.motion.spoonLesson = state.currentAction?.parameters.spoonLesson as MotionInput['spoonLesson'];
    const wall = state.currentAction?.parameters.wetwall as MotionInput['wetwall'];
    if (wall) {
      const guide = this.wetwallGuide;
      if (!guide || guide.phase !== wall.phase || Math.abs(wall.progress - guide.progress) > 5)
        this.wetwallGuide = { phase: wall.phase, from: wall.progress, to: wall.progress, progress: wall.progress, elapsed: .5 };
      else if (guide.to !== wall.progress) this.wetwallGuide = { ...guide, from: guide.progress, to: wall.progress, elapsed: 0 };
      const track = this.wetwallGuide!;
      if (running) track.elapsed = Math.min(.5, track.elapsed + delta);
      track.progress = THREE.MathUtils.lerp(track.from, track.to, track.elapsed / .5);
      const pose = wetwallPose(wall.start, wall.role, track.progress, wall.phase, wall.elapsed, wall.fallY, wall.continued);
      this.motion.wetwall = { ...wall, progress: track.progress, hanging: pose.hanging };
    } else { this.motion.wetwall = undefined; this.wetwallGuide = undefined; }
    this.motion.betrayal = state.currentAction?.parameters.betrayal as MotionInput['betrayal'];
    const bathroom = state.currentAction?.parameters.bathroom as MotionInput['bathroom'];
    if (bathroom) {
      if (!this.motion.bathroom) { this.yaw = this.movementYaw = state.rotation; this.pitch = ['ready', 'pinning', 'failed'].includes(bathroom.phase) || bathroom.phase === 'breakout' && bathroom.elapsed < 1.4 ? .65 : .12; this.cameraReady = false; }
      if (this.bathroomGuide?.source !== bathroom) this.bathroomGuide = { source: bathroom, elapsed: bathroom.elapsed };
      if (running && !bathroom.paused && !['ready', 'failed', 'done', 'pinning', 'capture_ready'].includes(bathroom.phase))
        this.bathroomGuide.elapsed = Math.min(bathroom.elapsed + .5, this.bathroomGuide.elapsed + delta);
      if (bathroom.phase === 'faceoff' && this.motion.bathroom?.phase === 'breakout') { this.yaw = this.movementYaw = state.rotation; this.pitch = .12; }
      this.motion.bathroom = { ...bathroom, elapsed: this.bathroomGuide.elapsed };
    } else { this.motion.bathroom = undefined; this.bathroomGuide = undefined; }
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
    this.motion.truckFlight = state.currentAction?.parameters.truckFlight as boolean | undefined;
    this.motion.truckRescue = state.currentAction?.parameters.truckRescue as MotionInput['truckRescue'];
    this.motion.persephone = state.currentAction?.parameters.persephone as MotionInput['persephone'];
    this.motion.farewell = farewell;
    this.motion.deusPact = deusPact;
    this.motion.smithFinale = smithFinale;
    this.motion.epilogue = epilogue;
    this.motion.dockReload = dockReload;
    this.motion.dockLastStand = lastStand;
    this.motion.lobbyEntry = state.currentAction?.parameters.lobbyEntry as MotionInput['lobbyEntry'];
    this.motion.aimPitch = this.firearm || state.currentAction?.parameters.armed === true ? this.pitch : undefined;
    this.motion.mirror = this.mirror;
    this.motion.podRescue = state.currentAction?.parameters.podRescue as number | undefined;
    this.motion.spoon = this.spoon;
    this.motion.phone = this.phone;
    this.motion.officeCustody = custody;
    const arrestYaw = custody?.street && custody.street.phase !== 'approaching' ? state.rotation : undefined;
    if (arrestYaw !== undefined && this.arrestYaw !== undefined && this.firstPerson) {
      const turn = Math.atan2(Math.sin(arrestYaw - this.arrestYaw), Math.cos(arrestYaw - this.arrestYaw));
      this.yaw += turn; this.movementYaw += turn;
    }
    this.arrestYaw = arrestYaw;
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
    if (this.motion.contact && this.performing && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.wakeCall && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.club && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.sentinel && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.interlude && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.oracleVisit && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.spoonLesson) {
      this.facing = state.rotation;
      if (!this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    }
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
    this.motion.homeClothes = state.id === 'neo' && ['neo_apartment', 'film_anderson_flat'].includes(state.currentLocation);
    if (this.motion.interrogation && !this.firstPerson) this.yaw = this.movementYaw = state.rotation;
    if (this.motion.pills && (!this.firstPerson || this.motion.pills.phase === 'offering' || this.motion.pills.elapsed > 9.6)) this.yaw = this.movementYaw = state.rotation;
    this.motion.vase = state.currentAction?.parameters.vase as number | undefined;
    this.motion.realWorld = !state.isInMatrix && state.currentLocation !== 'film_real_desert';
    this.motion.clubClothes = state.currentLocation === 'film_white_rabbit_club' || state.id === 'neo' && state.currentLocation === 'film_white_construct' && !state.currentAction?.parameters.rescue;
    this.motion.glasses = !this.motion.clubClothes && (state.id !== 'neo' || state.isAwakened && state.currentLocation !== 'film_oracle_home');
    const shaftRole = this.motion.tvExit?.phase === 'emerging' ? tvExitEmergingRole(this.motion.tvExit) : undefined;
    this.motion.climbing = dropRoot ? undefined : this.motion.wetwall?.hanging ? Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) : shaftRole !== undefined && shaftRole === this.motion.tvExit?.role ? Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) : this.climbing && !wall ? Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) : undefined;
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
          if (state.currentLocation === 'film_agent_interrogation') this.pitch = .12;
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
    const watchingAmbush = this.ambushObservation !== undefined && state.currentLocation === 'film_ambush_house';
    if (watchingAmbush && !this.watchingAmbush) {
      const cat = ambushCat(Math.max(.8, this.ambushObservation!), true), center = FILM_SETS.film_ambush_house.center;
      const x = center.x + cat.x - this.position.x, z = center.z + cat.z - this.position.z;
      const eye = this.position.y + (this.firstPerson ? 2.99 : 2.05);
      this.yaw = this.movementYaw = this.facing = Math.atan2(x, z);
      this.pitch = THREE.MathUtils.clamp(-Math.atan2(center.y - 1 + cat.y + .9 - eye, Math.hypot(x, z)), -.4, 1.1);
      this.cameraReady = false; this.lastLook = now;
    }
    this.watchingAmbush = watchingAmbush;
    if (this.motion.bathroom) {
      const root = bathroomFightRoot(this.motion.bathroom, this.motion.bathroom.role), center = FILM_SETS.film_ambush_house.center;
      this.position = { x: center.x + root.x, y: state.position.y, z: center.z + root.z };
    } else if (this.motion.sixth) {
      const pose = sixthPose(this.motion.sixth), center = FILM_SETS.film_ambush_house.center;
      this.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z };
      this.facing = pose.yaw; this.vy = 0; this.planar = { x: 0, z: 0 }; this.localJump = false;
    } else if (wall && wall.phase !== 'sealed' && !['falling', 'failed'].includes(wall.phase)) {
      const track = this.wetwallGuide!, pose = wetwallPose(wall.start, wall.role, track.progress, wall.phase, wall.elapsed, wall.fallY, wall.continued), center = FILM_SETS.film_ambush_house.center;
      this.position = { x: center.x + pose.x, y: center.y + pose.y, z: center.z + pose.z };
      this.facing = pose.yaw; this.vy = 0; this.planar = { x: 0, z: 0 }; this.localJump = false;
    } else if (dropRoot) {
      const center = FILM_SETS.film_ambush_house.center;
      this.position = { x: center.x + dropRoot.x, y: center.y + dropRoot.y, z: center.z + dropRoot.z };
      this.vy = basementDropPose(basement!.drop!).verticalVelocity; this.planar = { x: 0, z: 0 }; this.localJump = false;
    } else if (this.ride || this.climbing || this.performing) {
      const blend = this.motion.dockGate || dockLastStandLocked(this.motion.dockLastStand) || dockReloadLocked(this.motion.dockReload) || computerCheckLocked(computerCheck) || this.motion.contact || inOfficeLift || this.motion.officeCustody?.street || this.motion.truckPassenger || this.motion.farewell || this.motion.pills || this.motion.interrogation || this.motion.meeting || this.motion.training || this.motion.workday || this.motion.interlude || this.motion.oracleVisit || departureCinematic || this.motion.betrayal || this.motion.rescue || this.motion.government || this.motion.airRescue || escapeCinematic || oneCinematic || catchCinematic || deusPactLocked(this.motion.deusPact) || smithFinaleLocked(this.motion.smithFinale) || trilogyEpilogueLocked(this.motion.epilogue) || this.motion.mirrorEntry || this.motion.lobbyEntry ? 1 : 1 - Math.exp(-20 * delta);
      this.position.x += (state.position.x - this.position.x) * blend; this.position.y += (state.position.y - this.position.y) * blend; this.position.z += (state.position.z - this.position.z) * blend;
      this.vy = 0; this.planar = { x: 0, z: 0 }; this.localJump = false;
    } else if (running && this.enabled && state.status === 'alive') {
      const boost = this.motion.officeCustody ? OFFICE_CUSTODY.speed / PLAYER_WALK_SPEED : state.activeEffects.some(effect => ['speed_blur', 'agent_dodge', 'phase_shift'].includes(effect.visualEffect)) ? 1.8 : 1;
      const input = this.input(this.localJump);
      const attackScale = this.impulse || now - (this.motion.hit ?? -1000) < 220 ? 0 : (now - this.lastAttack) / 1000 < MELEE_COMBO[this.attackCombo].duration ? .4 : 1;
      const previous = this.position;
      const result = stepPlayer(this.position, this.vy, { ...input, x: input.x * attackScale, z: input.z * attackScale }, Math.min(delta, 0.05), state.isInMatrix, this.structures, this.planar, boost);
      this.position = result.position; this.vy = result.verticalVelocity; this.planar = result.horizontalVelocity; this.localJump = false;
      if (this.impulse) {
        this.position = combatDisplace(this.position, this.impulse.direction, Math.min(delta, this.impulse.remaining) * this.impulse.speed, state.isInMatrix, this.structures);
        this.impulse.remaining -= delta;
        if (this.impulse.remaining <= 0) this.impulse = undefined;
      }
      const separated = ambushCompanyStep(previous, this.position, this.ambushCompany);
      if (separated !== this.position) { this.position = playerBlocked(separated, state.isInMatrix, 1.1, this.structures) ? previous : separated; this.planar = { x: 0, z: 0 }; this.vy = 0; }
      if (this.custodyBodies) {
        const restrained = officeCustodyStep(previous, this.position, this.custodyBodies);
        if (restrained !== this.position) { this.position = restrained; this.planar = { x: 0, z: 0 }; this.vy = 0; }
      }
    }
    if (performance.now() - this.lastSent >= 50) {
      this.send(this.input(this.networkJump && running && this.enabled));
      this.networkJump = false; this.lastSent = performance.now();
    }
    group.position.set(this.position.x, this.position.y, this.position.z);
    if (computerStarting && this.firstPerson) this.cableAim = true;
    const hanging = Boolean(this.motion.wetwall?.hanging);
    if (hanging && !this.hangingWetwall && !this.motion.sixth) { this.yaw = this.movementYaw = Math.PI; this.pitch = .65; this.cameraReady = false; }
    this.hangingWetwall = hanging;
    if ((mirrorStarting && !this.motion.mirrorEntry || mirrorSitting) && this.firstPerson && now - this.lastLook > 900) this.aimAtMirror();
    if (hardlineStarting && this.firstPerson) this.aimAtHardline();
    const dx = this.position.x - previous.x; const dz = this.position.z - previous.z;
    this.motion.speed = dropRoot ? dropRoot.speed : basement?.crawling || wall && !hanging ? Math.hypot(dx, dz) / Math.max(delta, .001) : this.ride || this.climbing || this.performing ? 0 : Math.hypot(dx, dz) / Math.max(delta, .001);
    if (this.motion.spoonLesson?.phase === 'sitting' && this.motion.spoonLesson.elapsed < 1.1) this.motion.speed = Math.hypot(state.velocity.x, state.velocity.z);
    if (this.motion.wakeCall?.phase === 'waking' && this.motion.wakeCall.elapsed > 2.7 && this.motion.morning?.phase !== 'lying') this.motion.speed = 1.45;
    if (this.motion.wakeCall?.phase === 'leaving' && this.motion.wakeCall.elapsed > 1.15 && this.motion.wakeCall.elapsed < 3.05) this.motion.speed = 1.35;
    this.motion.firstPerson = this.firstPerson;
    this.motion.grounded = dropRoot ? !basementDropPose(basement!.drop!).airborne : wall?.role === 'neo' && wall.phase === 'falling' ? false : Boolean(this.ride || this.gunner) || this.climbing || this.performing || this.position.y <= groundHeight(this.position, state.isInMatrix, this.structures) + .12;
    this.motion.verticalVelocity = wall?.role === 'neo' && wall.phase === 'falling' ? state.velocity.y : this.vy;
    this.motion.inspecting = Boolean((this.motion.pills || this.motion.interrogation || this.motion.welcome || this.motion.knock !== undefined || this.motion.recovery !== undefined || this.motion.cabin || this.motion.reveal || this.motion.training || this.motion.workday || this.motion.wakeCall || this.motion.sentinel || this.motion.interlude || this.motion.oracleVisit || departureCinematic || this.motion.betrayal || this.motion.rescue || this.motion.government || this.motion.airRescue || escapeCinematic || oneCinematic || this.motion.lobbyEntry) && !this.firstPerson) || Boolean(this.phone && this.performing && this.motion.window === undefined && this.motion.crossing === undefined) || !this.firstPerson && this.spoon !== undefined && this.enabled && this.motion.speed < .25 && this.motion.grounded;
    const attacking = (now - this.lastAttack) / 1000 < MELEE_COMBO[this.attackCombo].duration;
    const heading = dropRoot ? dropRoot.yaw : this.motion.bathroom ? bathroomFightRoot(this.motion.bathroom, this.motion.bathroom.role).yaw : this.motion.sixth ? sixthPose(this.motion.sixth).yaw : this.motion.wetwall && this.wetwallGuide ? wetwallPose(this.motion.wetwall.start, this.motion.wetwall.role, this.wetwallGuide.progress, this.motion.wetwall.phase, this.motion.wetwall.elapsed, this.motion.wetwall.fallY, this.motion.wetwall.continued).yaw
      : this.ride || this.climbing || this.performing ? state.rotation : attacking ? this.attackYaw : this.firearm ? this.yaw : this.motion.speed > .1 ? Math.atan2(dx, dz) : this.facing;
    const turn = Math.atan2(Math.sin(heading - this.facing), Math.cos(heading - this.facing));
    this.facing += turn * (dockLastStandLocked(this.motion.dockLastStand) || dockReloadLocked(this.motion.dockReload) || smithFinaleLocked(this.motion.smithFinale) || trilogyEpilogueLocked(this.motion.epilogue) || deusPactLocked(this.motion.deusPact) || this.motion.farewell || mirrorYaw !== undefined || chairYaw !== undefined || computerCheckLocked(computerCheck) || dropRoot || this.motion.officeCustody?.street || this.motion.pills || this.motion.interrogation || this.motion.meeting || this.motion.welcome || this.motion.knock !== undefined || this.motion.training || this.motion.workday || this.motion.wakeCall || this.motion.sentinel || this.motion.interlude || this.motion.oracleVisit || departureCinematic || this.motion.betrayal || this.motion.rescue || this.motion.government || this.motion.airRescue || escapeCinematic || oneCinematic || this.motion.lobbyEntry ? 1 : 1 - Math.exp(-14 * delta)); this.motion.turn = turn * 8;
    if (running && this.enabled && !this.motion.wetwall && (this.motion.speed > .1 || this.ride || this.climbing) && !(this.firstPerson && this.climbing && state.currentLocation === 'film_office_ledge') && !this.dragging && performance.now() - this.lastLook > 900) {
      const cameraTurn = Math.atan2(Math.sin(this.facing - this.yaw), Math.cos(this.facing - this.yaw));
      this.yaw += cameraTurn * (1 - Math.exp(-5 * delta));
    }
    const body = group.children[0];
    if (body && !(state.currentLocation === 'film_power_plant_pods' && this.motion.performance === 'pod')) body.rotation.y = this.firstPerson && !this.performing ? this.yaw : this.facing;
    const sprint = this.motion.speed > PLAYER_WALK_SPEED * 1.6 || Boolean(this.ride && this.ride.speed > 20);
    const interviewWide = !this.firstPerson && this.motion.interrogation && (this.motion.interrogation.phase === 'file' || this.motion.interrogation.phase === 'coercion' && this.motion.interrogation.elapsed > 5.3 && this.motion.interrogation.elapsed < 14);
    const interviewApproach = !this.firstPerson && state.currentLocation === 'film_agent_interrogation' && !this.motion.interrogation;
    const welcomeWide = !this.firstPerson && this.motion.welcome && ['approach', 'departing'].includes(this.motion.welcome.phase);
    const revealWide = !this.firstPerson && Boolean(this.motion.truth || this.motion.construct || this.motion.reveal && (this.motion.reveal.kind === 'desert' ? this.motion.reveal.elapsed < 10.2 : this.motion.reveal.elapsed < 7.8));
    const trainingWide = !this.firstPerson && Boolean(this.motion.download?.phase === 'connecting' || this.motion.training && (this.motion.training.kind !== 'red_dress' || this.motion.training.elapsed < 4.8));
    const officeWide = !this.firstPerson && this.motion.workday && this.motion.workday.phase !== 'signing';
    const wakeWide = !this.firstPerson && Boolean(this.motion.wakeCall && ['waking', 'leaving'].includes(this.motion.wakeCall.phase));
    const sentinelWide = !this.firstPerson && Boolean(this.motion.sentinel && ['shutdown', 'detected', 'clear'].includes(this.motion.sentinel.phase));
    const interludeWide = !this.firstPerson && Boolean(this.motion.interlude);
    const oracleWide = !this.firstPerson && Boolean(this.motion.spoonLesson || this.motion.oracleVisit?.phase === 'examining' || departureCinematic);
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
    const cabinWide = !this.firstPerson && Boolean(this.motion.cabin);
    const bathroomWide = !this.firstPerson && Boolean(this.motion.bathroom);
    const basementWide = !this.firstPerson && Boolean(dropRoot);
    const streetShaftWide = !this.firstPerson && tvExit?.phase === 'emerging';
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, inOfficeLift && !this.firstPerson ? 80 : basementWide ? this.camera.aspect < .85 ? 82 : 78 : bathroomWide ? this.camera.aspect < .85 ? 78 : 58 : streetShaftWide ? this.camera.aspect < .85 ? 68 : 60 : podWide ? 65 : this.motion.truth && !this.firstPerson && this.camera.aspect < .85 ? 68 : cabinWide ? this.camera.aspect < .85 ? 68 : 58 : smithFinaleWide || epilogueWide ? 64 : ladderWide ? 62 : interviewApproach ? 70 : interviewWide || welcomeWide || revealWide || trainingWide || officeWide || wakeWide || sentinelWide || interludeWide || oracleWide || betrayalWide || rescueWide || governmentWide || airRescueWide || escapeWide || oneWide || catchWide || lobbyWide || pillDepartureWide ? 58 : this.motion.inspecting && !this.firstPerson ? 42 : this.firstPerson ? this.motion.mirrorBeat !== undefined ? 78 : sprint ? 74 : 68 : sprint ? 64 : 57, 1 - Math.exp(-4 * delta));
    this.camera.near = basement?.crawling || Boolean(dropRoot) || this.firstPerson && (this.motion.performance === 'pod' && state.currentLocation === 'film_power_plant_pods' || this.motion.morning || this.motion.workday?.role === 'neo' && this.motion.workday.phase === 'signing' || this.motion.computerCheck || this.motion.contact?.propMotion === 'minidisc' && ['retrieving', 'disk', 'handover'].includes(this.motion.contact.phase) || this.motion.pills || this.motion.farewell || this.motion.dockGate || this.motion.dockLastStand || deusPactLocked(this.motion.deusPact) || smithFinaleLocked(this.motion.smithFinale) || this.motion.bathroom || this.motion.sixth || this.motion.wetwall?.hanging || tvExit?.phase === 'emerging') ? .06 : this.firstPerson && this.motion.club ? .08 : this.defaultNear;
    const arrest = this.motion.officeCustody?.street;
    if (this.motion.epilogue?.kind === 'neo_carried') this.camera.fov = this.firstPerson ? 68 : 58;
    if (deusPactLocked(this.motion.deusPact)) this.camera.fov = this.firstPerson ? 68 : 57;
    if (smithFinaleLocked(this.motion.smithFinale)) this.camera.fov = this.firstPerson && !smithOracleRestored(this.motion.smithFinale) ? 68 : 64;
    if (arrest && arrest.phase !== 'approaching') {
      this.camera.fov = this.firstPerson ? 68 : arrestMirrorShot(arrest) ? this.camera.aspect < .85 ? 60 : 38 : this.camera.aspect < .85 ? 64 : 54;
      this.camera.near = .06;
    }
    this.camera.updateProjectionMatrix();
    this.cameraStep += this.motion.speed * delta;
    const target = new THREE.Vector3(this.position.x, this.position.y + (this.firstPerson ? 2.99 : 2.05) - (this.motion.pills ? .9 : 0) - (this.motion.mirrorBeat !== undefined ? THREE.MathUtils.smoothstep(this.motion.mirrorBeat, .65, MIRROR_TIMING.sit) * .9 : 0) - (this.motion.reveal?.kind === 'construct' ? .62 : 0) - (this.motion.crouching ? 1.1 : 0), this.position.z);
    if (this.motion.contact && ['signal', 'reply', 'knocking'].includes(this.motion.contact.phase)) target.y -= .65 * apartmentComputerPose(this.motion.contact).seated;
    if (this.firstPerson && this.motion.contact?.propMotion === 'minidisc') target.y -= 2.6 * apartmentBookCrouch(this.motion.contact);
    if (this.motion.wakeCall?.phase === 'waking') target.y -= (1 - THREE.MathUtils.smoothstep(this.motion.wakeCall.elapsed, 1.3, 3.1)) * 1.35;
    if (this.firstPerson && this.motion.morning && this.motion.wakeCall) {
      const reclining = 1 - THREE.MathUtils.smoothstep(this.motion.wakeCall.elapsed, 1.3, 3.1);
      target.y = this.position.y + 2.99 - 2.07 * reclining;
      target.x -= Math.sin(this.facing) * 1.9 * reclining; target.z -= Math.cos(this.facing) * 1.9 * reclining;
    }
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
    if (arrest && arrest.phase !== 'approaching') {
      const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
      const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : new THREE.Vector3(this.position.x, this.position.y + 2.2, this.position.z);
      if (this.firstPerson) {
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else if (arrestMirrorShot(arrest) && arrest.observed) {
        const mirror = arrestBikePoint(ARREST_BIKE.mirror.x, ARREST_BIKE.mirror.z); mirror.y = ARREST_BIKE.mirror.y;
        const view = arrestBikePoint(ARREST_BIKE.view.x, ARREST_BIKE.view.z);
        this.camera.position.set(view.x, ARREST_BIKE.view.y, view.z); this.camera.lookAt(mirror.x, mirror.y, mirror.z);
      } else {
        const point = arrestCarPoint(this.camera.aspect < .85 ? -11 : -9, 4.5, arrest);
        this.camera.position.set(point.x, 3.7, point.z); this.camera.lookAt(eye);
      }
    } else if (this.bridgeCaught) {
      const pursuer = new THREE.Vector3(this.bridgeCaught.x, this.position.y, this.bridgeCaught.z);
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 2.99, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const neo = new THREE.Vector3(this.position.x, this.position.y, this.position.z);
        const towardPursuer = pursuer.clone().sub(neo).normalize();
        const focus = neo.clone().add(pursuer).multiplyScalar(.5); focus.y += 2.65;
        const ideal = focus.clone().add(new THREE.Vector3(towardPursuer.z, 0, -towardPursuer.x).multiplyScalar(this.camera.aspect < .8 ? 9 : 7));
        ideal.y += 1.8;
        if (resetCamera || bridgeCaptureStarting) this.camera.position.copy(ideal);
        else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.government) {
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
    } else if (this.motion.morning && this.firstPerson) {
      const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
      const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .23)) : target;
      if (this.morningAim) {
        const x = APARTMENT_ROOM.center.x + MORNING.alarm.x - eye.x, z = APARTMENT_ROOM.center.z + MORNING.alarm.z - eye.z;
        this.yaw = this.movementYaw = Math.atan2(x, z);
        this.pitch = Math.atan2(eye.y - MORNING.alarm.y - .255, Math.hypot(x, z)); this.morningAim = false;
      }
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (this.motion.wakeCall && !this.firstPerson) {
      const call = this.motion.wakeCall; const center = FILM_SETS.film_anderson_flat.center; const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const waking = call.phase === 'waking'; const rise = waking ? THREE.MathUtils.smoothstep(call.elapsed, 1.1, 3.5) : 1;
      const leaving = call.phase === 'leaving'; const crossing = leaving ? THREE.MathUtils.smoothstep(call.elapsed, 1.15, 3.9) : 0;
      const ideal = (waking ? new THREE.Vector3(15.4, 5.2, -5.2).lerp(new THREE.Vector3(8.3, 4.35, -4.8), rise)
        : leaving ? new THREE.Vector3(4.5, 4.6, 6.8).lerp(new THREE.Vector3(4.6, 4.7, 7.2), crossing)
          : new THREE.Vector3(-2.55, 4.35, -11.05)).add(origin);
      const focus = (waking ? new THREE.Vector3(10.1, 2.05, -9.2).lerp(new THREE.Vector3(6.2, 3.05, -8.9), rise)
        : leaving ? new THREE.Vector3(.8, 3.05, 11).lerp(new THREE.Vector3(.1, 3.05, 13), crossing)
          : new THREE.Vector3(-5.95, 3.15, -9.05)).add(origin);
      if (this.motion.morning) {
        ideal.copy(new THREE.Vector3(MORNING.alarm.x - 3.1, 4.1, -7.5).lerp(new THREE.Vector3(8.3, 4.35, -4.8), rise).add(origin));
        focus.copy(new THREE.Vector3(MORNING.bedX - .35, 1.92, -10.2).lerp(new THREE.Vector3(6.2, 3.05, -8.9), rise).add(origin));
      }
      if (resetCamera || call.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.contact && this.performing && !this.firstPerson) {
      const phase = this.motion.contact.phase; const center = FILM_SETS.film_anderson_flat.center;
      const computer = ['signal', 'reply', 'knocking'].includes(phase); const book = phase === 'retrieving';
      const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const ideal = (computer ? new THREE.Vector3(-6.6, 4.7, -7.1) : book ? new THREE.Vector3(9.3, 4.9, 3.1) : new THREE.Vector3(4.2, 5.4, 7.4)).add(origin);
      const focus = (computer ? new THREE.Vector3(-9, 2.9, -11.8) : book ? new THREE.Vector3(6, 2.1, 6) : new THREE.Vector3(0, 3.5, 12.3)).add(origin);
      if (computer && this.motion.contact.chairMotion === 'stepping') {
        const pose = apartmentComputerPose(this.motion.contact);
        ideal.lerp(new THREE.Vector3(-16, 5.6, -8.8).add(origin), 1 - pose.seated);
        focus.lerp(new THREE.Vector3(pose.x, 1.6, pose.z).add(origin), 1 - pose.seated);
      }
      if (book && this.motion.contact.propMotion === 'minidisc') {
        const crouch = apartmentBookCrouch(this.motion.contact);
        ideal.copy(new THREE.Vector3(this.camera.aspect < .85 ? 2 : 2.8, 4.6, -3.5).lerp(new THREE.Vector3(this.camera.aspect < .85 ? 2.8 : 3.6, 2.6, -3.6), crouch).add(origin));
        focus.copy(new THREE.Vector3(5.8, 2, -6.35).lerp(new THREE.Vector3(5.8, .75, -5.95), crouch).add(origin));
      }
      if (phase === 'inspecting') { ideal.copy(origin).add(new THREE.Vector3(-1.45, 4, 12.7)); focus.copy(origin).add(new THREE.Vector3(-.65, 3.42, 14.38)); }
      if (resetCamera || this.motion.contact.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.workday?.role === 'neo' && this.motion.workday.phase === 'signing' && this.firstPerson) {
      const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
      const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .23)) : target;
      if (this.signingAim) {
        const board = officeClipboardPoint(this.motion.workday), center = FILM_SETS.film_metacortex_floor.center;
        const x = center.x + board.x - eye.x, z = center.z + board.z - eye.z;
        this.yaw = this.movementYaw = Math.atan2(x, z);
        this.pitch = Math.atan2(eye.y - center.y + 1 - board.y, Math.hypot(x, z)); this.signingAim = false;
      }
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (this.motion.workday && !this.firstPerson) {
      const signing = this.motion.workday.phase === 'signing'; const center = FILM_SETS.film_metacortex_floor.center;
      const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const ideal = (signing ? new THREE.Vector3(10.5, 5.7, 4.6) : new THREE.Vector3(this.camera.aspect < 1 ? -10 : -14.6, this.camera.aspect < 1 ? 5.2 : 4.6, 31)).add(origin);
      const focus = (signing ? new THREE.Vector3(13.5, 3.15, 7.1) : new THREE.Vector3(-20.5, 3, 27.4)).add(origin);
      if (resetCamera || this.motion.workday.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.training || this.motion.download?.phase === 'connecting') {
      const gesture = this.motion.training ?? { kind: 'download', elapsed: this.motion.download!.elapsed }; const center = FILM_SETS[state.currentLocation].center;
      if (this.firstPerson) {
        const seated = gesture.kind === 'download';
        const head = seated ? group.getObjectByName('head') : undefined;
        const eye = head ? head.localToWorld(new THREE.Vector3(0, .18, .17)) : new THREE.Vector3(this.position.x, this.position.y + (seated ? 3.13 - .684 * (this.motion.download ? cabinSeat(gesture.elapsed) : 1) : 3), this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1, center.z); let ideal: THREE.Vector3; let focus: THREE.Vector3;
        if (gesture.kind === 'download') {
          const portrait = this.camera.aspect < .85;
          ideal = new THREE.Vector3(portrait ? -4 : -1.3, portrait ? 7 : 5.1, 1.3);
          focus = new THREE.Vector3(9, 2.4, -6.9);
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
          const reverse = THREE.MathUtils.smoothstep(gesture.elapsed, 8.6, 10.8);
          const portrait = this.camera.aspect < .85;
          ideal = new THREE.Vector3(portrait ? 18.2 : 15.2, portrait ? 5.9 : 5.2, -13)
            .lerp(new THREE.Vector3(portrait ? -18.2 : -15.2, portrait ? 5.7 : 5, -13), reverse);
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
    } else if (this.motion.spoonLesson) {
      const gesture = this.motion.spoonLesson, seat = spoonLessonSeat(gesture);
      const center = FILM_SETS.film_oracle_home.center;
      if (this.firstPerson) {
        const head = group.getObjectByName('head'); head?.updateWorldMatrix(true, false);
        const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .23)) : new THREE.Vector3(this.position.x, this.position.y + 2.99 - seat * 2.1, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const focus = new THREE.Vector3(center.x - 8, center.y + 1.3 - seat * .5, center.z + 9);
        const offset = new THREE.Vector3(5.2, 2.2 - seat * 1.2, -6.5).multiplyScalar((this.camera.aspect < .85 ? 1.4 : 1) * (1 - seat * .22));
        const ideal = focus.clone().add(offset);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
        this.camera.lookAt(focus);
      }
    } else if (departureCinematic && this.motion.oracleDeparture) {
      const gesture = this.motion.oracleDeparture;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 2.99, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const focus = new THREE.Vector3(this.position.x - (gesture.phase === 'talking' ? .7 : 0), this.position.y + 2.7, this.position.z);
        const ideal = focus.clone().add(new THREE.Vector3(0, 1.15, this.camera.aspect < .85 ? 8.4 : 6));
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
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
    } else if (this.motion.sixth) {
      const gesture = this.motion.sixth, center = FILM_SETS.film_ambush_house.center;
      if (this.firstPerson) {
        const head = group.getObjectByName('head'); head?.updateWorldMatrix(true, false);
        const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, 0)) : new THREE.Vector3(this.position.x, this.position.y + 3.1, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        eye.addScaledVector(forward, .85);
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const breach = ['breach', 'done'].includes(gesture.phase), contact = ['rushing', 'grapple'].includes(gesture.phase), origin = new THREE.Vector3(center.x, center.y - 1, center.z);
        const ideal = breach ? new THREE.Vector3(-20.5, WETWALL_SHAFT.sixth + 5.8, -19.5).add(origin)
          : contact ? new THREE.Vector3(-14.35, WETWALL_SHAFT.sixth + 3.8, -33.15).add(origin)
          : new THREE.Vector3(-19.7, WETWALL_SHAFT.sixth + (this.camera.aspect < .85 ? 3.2 : 2.8), -31.35).add(origin);
        const focus = breach ? new THREE.Vector3(-16.4, WETWALL_SHAFT.sixth + 2.5, -28.3).add(origin)
          : contact ? new THREE.Vector3(this.position.x, this.position.y + 3.25, center.z + WETWALL_SHAFT.bodyZ + .25)
          : new THREE.Vector3(this.position.x, this.position.y + 2.25, center.z + WETWALL_SHAFT.bodyZ);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-10 * delta));
        this.camera.lookAt(focus);
      }
    } else if (dropRoot) {
      const center = FILM_SETS.film_ambush_house.center;
      group.updateWorldMatrix(true, true);
      if (this.firstPerson) {
        const head = group.getObjectByName('head'), eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : new THREE.Vector3(this.position.x, this.position.y + 3.2, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const side = 1 + 3 * THREE.MathUtils.smoothstep(dropRoot.drop, .62, .82);
        this.camera.position.set(THREE.MathUtils.clamp(this.position.x - side, center.x - 21.3, center.x - 13.7),
          Math.min(center.y - 1 + BASEMENT.floor + BASEMENT.ceiling - .45, this.position.y + 2.6), this.position.z + .95);
        this.camera.lookAt(this.position.x, this.position.y + 1.6, this.position.z);
      }
    } else if (basement?.crawling) {
      const center = FILM_SETS.film_ambush_house.center, floor = Math.max(center.y - 1 + BASEMENT.tunnelFloor, this.position.y - 1);
      group.updateWorldMatrix(true, true);
      const head = group.getObjectByName('head');
      const focus = new THREE.Vector3(this.position.x, floor + 2.45, this.position.z);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      if (this.firstPerson) {
        const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : focus;
        eye.y = THREE.MathUtils.clamp(eye.y, floor + .4, floor + BASEMENT.tunnelHeight - .15);
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else if (basement.phase === 'draining' && this.position.y > center.y + BASEMENT.tunnelFloor + .1) {
        this.camera.position.set(center.x + BASEMENT.grate.x + .95, center.y - 1 + BASEMENT.floor + 3.15, center.z + BASEMENT.grate.z + .65);
        this.camera.lookAt(focus);
      } else {
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const shoulder = focus.clone().addScaledVector(right, .95);
        const behind = Math.min(2.8, Math.max(1.05, this.position.z - center.z - BASEMENT.grate.z + 1.05));
        const ideal = shoulder.clone().addScaledVector(forward, -behind); ideal.y = floor + BASEMENT.tunnelHeight - .2;
        let distance = 0;
        for (let t = .05; t <= 1; t += .05) {
          const sample = focus.clone().lerp(ideal, t);
          if (basementBlocked(sample.x - center.x, sample.y - center.y + 1, sample.z - center.z, .14)) break;
          distance = t;
        }
        this.camera.position.copy(focus.clone().lerp(ideal, distance)); this.camera.lookAt(shoulder.clone().addScaledVector(forward, 2.5));
      }
    } else if (this.motion.wetwall?.hanging) {
      const center = FILM_SETS.film_ambush_house.center;
      if (this.firstPerson) {
        const head = group.getObjectByName('head'); head?.updateWorldMatrix(true, false);
        const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : new THREE.Vector3(this.position.x, this.position.y + 3.1, this.position.z - .32);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const rescue = ['jammed', 'rescuing'].includes(this.motion.wetwall.phase);
        const ideal = new THREE.Vector3(center.x + (rescue ? -18.5 : -19.7), rescue ? center.y + WETWALL_SHAFT.top - WETWALL.jam + (this.camera.aspect < .85 ? 8.3 : 7.2) : this.position.y + (this.camera.aspect < .85 ? 3.2 : 1.8), center.z + WETWALL_SHAFT.front - .5);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-10 * delta));
        this.camera.lookAt(rescue ? center.x - 19.1 : this.position.x, rescue ? center.y + WETWALL_SHAFT.top - WETWALL.jam + 2.35 : this.position.y + 1.3, center.z + WETWALL_SHAFT.bodyZ);
        this.camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw - Math.PI));
        this.camera.rotateX(.65 - this.pitch);
      }
    } else if (this.motion.bathroom) {
      const gesture = this.motion.bathroom, center = FILM_SETS.film_ambush_house.center;
      const ground = ['ready', 'pinning', 'failed'].includes(gesture.phase) || gesture.phase === 'breakout' && gesture.elapsed < 1.4;
      if (this.firstPerson) {
        const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        const eye = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(this.position.x, this.position.y + 2.1, this.position.z);
        if (ground) {
          const smith = bathroomFightRoot(gesture, 'smith');
          forward.set(center.x + smith.x, center.y - 1 + WETWALL_SHAFT.sixth + .75, center.z + smith.z - 1.7).sub(eye).normalize();
          forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw - bathroomFightRoot(gesture, gesture.role).yaw);
          forward.applyAxisAngle(new THREE.Vector3(0, 1, 0).cross(forward).normalize(), this.pitch - .65);
        }
        eye.addScaledVector(forward, ground ? .72 : .12); this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const origin = new THREE.Vector3(center.x, center.y - 1 + WETWALL_SHAFT.sixth, center.z);
        const falling = gesture.phase === 'done' ? 1 : gesture.phase === 'capturing' ? THREE.MathUtils.smoothstep(gesture.elapsed, 1.3, 2.8) : 0;
        const ideal = new THREE.Vector3(ground ? -21 : -14.8, ground ? 4.8 : 5.2 + falling * .6, ground ? -26.1 : -26.4 + falling).add(origin);
        const focus = new THREE.Vector3(-17.7 - falling * .9, ground ? 1.2 : 2.4 - falling * .8, -26.9 - falling * 1.3).add(origin);
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (tvExit?.phase === 'emerging') {
      const center = FILM_SETS.film_tv_repair.center;
      if (this.firstPerson) {
        const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
        const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : new THREE.Vector3(this.position.x, this.position.y + 2.9, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const role = tvExitEmergingRole(tvExit), progress = role ? tvExit.emerge?.[role] ?? 0 : 1;
        const root = role ? tvExitEmergeRoot(role, progress) : undefined, climbing = progress < TV_EXIT.emerge.mantleEnd;
        const ideal = climbing && root
          ? new THREE.Vector3(center.x + TV_EXIT.street.drain.x + (this.camera.aspect < .85 ? 3.2 : 3.6), center.y + root.y + 2, center.z + TV_EXIT.street.drain.z - (this.camera.aspect < .85 ? 1.4 : 1.8))
          : new THREE.Vector3(center.x + TV_EXIT.street.drain.x + (this.camera.aspect < .85 ? 7.2 : 6), center.y + (this.camera.aspect < .85 ? 7.8 : 6.4), center.z + TV_EXIT.street.drain.z - (this.camera.aspect < .85 ? 8.2 : 6.8));
        const focus = root ? new THREE.Vector3(center.x + root.x, center.y + root.y + (climbing ? 2.45 : 1.7), center.z + root.z) : new THREE.Vector3(this.position.x, this.position.y + 1.7, this.position.z);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-9 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.crosscut && this.performing && !['trinity_ready', 'neo_ready'].includes(this.motion.crosscut.phase)) {
      const cut = this.motion.crosscut, ship = crosscutView(cut) === 'ship', center = FILM_SETS[ship ? 'film_neb_deck' : 'film_tv_repair'].center;
      const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      if (this.firstPerson) {
        const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
        const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : new THREE.Vector3(this.position.x, this.position.y + 2.9, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const pulling = ship && cut.phase === 'call', second = pulling && cut.elapsed >= 14;
        const ideal = cut.phase === 'done' ? new THREE.Vector3(0, 6, -14) : ship ? pulling ? new THREE.Vector3(second ? 0 : -12, 5.5, second ? 11 : 1) : new THREE.Vector3(4, 5.7, -17)
          : new THREE.Vector3(3.5, 5.2, -16.5);
        const focus = cut.phase === 'done' ? new THREE.Vector3(2.5, 2.6, -5) : ship ? pulling ? new THREE.Vector3(second ? 6.5 : -6.5, 2.7, second ? 6 : -5) : new THREE.Vector3(-5, 2.5, -10.8)
          : cut.phase === 'call' && cut.elapsed >= 8.6 ? new THREE.Vector3(cut.elapsed < 17.6 ? 4.5 : 8.5, 1.4, cut.elapsed < 17.6 ? -11 : -9) : new THREE.Vector3(-5.5, 3.1, -17.5);
        this.camera.position.copy(ideal.add(origin)); this.camera.lookAt(focus.add(origin));
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
          ideal = gesture.sixth ? new THREE.Vector3(-20.5, WETWALL_SHAFT.sixth + 5.8, -19.5) : crash ? new THREE.Vector3(-5.8, 3.7, -1.8) : new THREE.Vector3(9.8, 5.2, 5.8);
          focus = gesture.sixth ? new THREE.Vector3(this.position.x - center.x, WETWALL_SHAFT.sixth + 2.5, this.position.z - center.z + 1.2) : crash ? new THREE.Vector3(3.2, 2.5, -6.7) : new THREE.Vector3(0, 3, -2.7);
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
      const sweep = gesture.phase === 'sweep'; const machine = sentinelMachinePose(gesture);
      const ideal = (detected ? new THREE.Vector3(9.5, 5.6, -35.5) : window ? new THREE.Vector3(10.5, 5.2, -38.5)
        : sweep ? new THREE.Vector3(-5.8, 6.15, -34.5) : new THREE.Vector3(-11.5, 6.2, -31.5)).add(origin);
      const focus = (detected ? new THREE.Vector3(0, 5.4, -52) : window ? new THREE.Vector3(0, 5, -55)
        : sweep ? new THREE.Vector3(machine.x * .35, 5.25, machine.z + 1.5) : new THREE.Vector3(0, 3.1, -39)).add(origin);
      if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.truth) {
      const truth = this.motion.truth, rest = truthRest(truth), program = truth.phase === 'ready' || truth.phase === 'exit';
      if (this.firstPerson) {
        const kneel = truth.phase === 'unplug' ? truthKneel(truth.elapsed) : 0;
        const height = rest ? 1.7 : 3.02 - (truth.phase === 'unplug' ? truthSeat(truth.elapsed) * .684 : 0) - kneel * 1.9;
        const eye = new THREE.Vector3(0, height, rest ? -1.78 : 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.facing)
          .add(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
        const head = truth.phase === 'unplug' ? group.getObjectByName('head') : undefined;
        if (head) eye.copy(head.localToWorld(new THREE.Vector3(0, .18, .17)));
        this.camera.position.copy(eye);
        const pitch = this.pitch + kneel * .5;
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
        if (rest) forward.multiplyScalar(.24).add(new THREE.Vector3(0, .97, 0)).normalize();
        this.camera.lookAt(eye.clone().add(forward));
      } else {
        const center = FILM_SETS[program ? 'film_white_construct' : 'film_neb_deck'].center;
        const portrait = this.camera.aspect < .85;
        const ideal = rest ? portrait ? new THREE.Vector3(7.2, 5.4, -28) : new THREE.Vector3(8.7, 4.6, -30.4) : program ? new THREE.Vector3(13.5, 5.2, -10.5) : new THREE.Vector3(1, portrait ? 6 : 5.1, portrait ? 6 : 1.3);
        const focus = rest ? new THREE.Vector3(13.5, 1.4, -33) : program ? new THREE.Vector3(1.2, 2.2, -5.5) : new THREE.Vector3(portrait ? 5.2 : 5 - 2 * THREE.MathUtils.smoothstep(truth.elapsed, 5.5, 8), 1.8, -5);
        ideal.add(new THREE.Vector3(center.x, center.y - 1, center.z)); focus.add(new THREE.Vector3(center.x, center.y - 1, center.z));
        // The two physical spaces are separated by the authored blackout.
        this.camera.position.copy(ideal); this.camera.lookAt(focus);
      }
    } else if (this.motion.construct) {
      const center = FILM_SETS.film_white_construct.center;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 3.02, this.position.z);
        this.camera.position.copy(eye);
        this.camera.lookAt(eye.clone().add(new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))));
      } else {
        const ideal = new THREE.Vector3(center.x + 15, center.y + 5.3, center.z - .6);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
        this.camera.lookAt(center.x + 1.5, center.y + 2.1, center.z + 1.8);
      }
    } else if (this.motion.reveal) {
      const gesture = this.motion.reveal; const center = FILM_SETS[gesture.kind === 'construct' ? 'film_white_construct' : 'film_real_desert'].center;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 3.02, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else if (gesture.kind === 'construct') {
        const boot = THREE.MathUtils.smoothstep(gesture.elapsed, 4.8, 7.8); const entry = THREE.MathUtils.smoothstep(gesture.elapsed, 8.1, 10.7);
        const ideal = new THREE.Vector3(12.8, 5.5, -10.8).lerp(new THREE.Vector3(9.5, 5.1, -.5), boot).lerp(new THREE.Vector3(0, 1.8, -10.4), entry).add(new THREE.Vector3(center.x, center.y - 1, center.z));
        const focus = new THREE.Vector3(.5, 2.5, -6.2).lerp(new THREE.Vector3(0, 1.8, -12), boot).lerp(new THREE.Vector3(0, 1.8, -13), entry).add(new THREE.Vector3(center.x, center.y - 1, center.z));
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-6 * delta));
        this.camera.lookAt(focus);
      } else {
        const reaction = THREE.MathUtils.smoothstep(gesture.elapsed, 10.1, 11.4);
        const ideal = new THREE.Vector3(10, 7.2, -15).lerp(new THREE.Vector3(-6.5, 4.6, -20), reaction).add(new THREE.Vector3(center.x, center.y - 1, center.z));
        const focus = new THREE.Vector3(-1, 5, -55).lerp(new THREE.Vector3(1.8, 2.5, -28), reaction).add(new THREE.Vector3(center.x, center.y - 1, center.z));
        if (resetCamera || gesture.elapsed < .12) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-5 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.cabin?.kind === 'core') {
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + (3.13 - .684 * cabinSeat(this.motion.cabin.elapsed)), this.position.z);
        this.camera.position.copy(eye);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.lookAt(eye.clone().add(forward));
      } else {
        const ideal = new THREE.Vector3(this.position.x + 2.9, this.position.y + 4.1, this.position.z + 5.3);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
        this.camera.lookAt(this.position.x, this.position.y + 1.9, this.position.z);
      }
    } else if (this.motion.recovery !== undefined) {
      const rise = THREE.MathUtils.smoothstep(this.motion.recovery, 7, 11.7);
      const body = recoveryBodyPose(this.motion.recovery);
      if (this.firstPerson) {
        const eye = new THREE.Vector3(0, THREE.MathUtils.lerp(1.7, 3, body.sit) + .13 * body.rise, THREE.MathUtils.lerp(-1.78, .18, body.sit));
        eye.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.rotation).add(new THREE.Vector3(this.position.x, this.position.y, this.position.z));
        this.camera.position.copy(eye);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        const lying = forward.clone().multiplyScalar(.24).add(new THREE.Vector3(0, .97, 0)).normalize();
        forward.lerp(lying, 1 - body.sit).normalize(); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const bedside = THREE.MathUtils.smoothstep(this.motion.recovery, 6.8, 8.4);
        const waking = this.motion.cabin?.kind === 'wake';
        const center = FILM_SETS.film_neb_deck.center;
        const ideal = waking ? new THREE.Vector3(center.x + 7.3, center.y + 3.8, center.z - 26.7)
          : new THREE.Vector3(this.position.x + THREE.MathUtils.lerp(3, -3.4, bedside), this.position.y + THREE.MathUtils.lerp(4, 5.5, bedside), this.position.z + THREE.MathUtils.lerp(6, 7.5, bedside));
        const focus = waking ? new THREE.Vector3(center.x + 14, center.y + 1.1, center.z - 32.4)
          : new THREE.Vector3(this.position.x, this.position.y + THREE.MathUtils.lerp(1.55, 2.05, rise), this.position.z);
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
      if (resetCamera || (entering || doorway || gesture.phase === 'rolling' || gesture.phase === 'scanning') && gesture.elapsed < .15) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
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
    } else if (this.motion.pills && this.firstPerson) {
      const head = group.getObjectByName('head'); head?.updateWorldMatrix(true, false);
      const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : target;
      const pitch = THREE.MathUtils.clamp(this.pitch + (this.motion.pills.role === 'neo' ? pillPose(this.motion.pills).drink * .7 : 0), -.4, 1.1);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (this.motion.pills && !this.firstPerson) {
      const center = FILM_SETS.film_lafayette.center;
      const taking = this.motion.pills.phase === 'taking';
      const close = taking ? THREE.MathUtils.smoothstep(this.motion.pills.elapsed, .1, 1.2) * (1 - THREE.MathUtils.smoothstep(this.motion.pills.elapsed, 3.65, 4.3)) : 0;
      const mouth = taking ? THREE.MathUtils.smoothstep(this.motion.pills.elapsed, 2.15, 2.85) * (1 - THREE.MathUtils.smoothstep(this.motion.pills.elapsed, 3.85, 4.3)) : 0;
      const departure = taking ? THREE.MathUtils.smoothstep(this.motion.pills.elapsed, 10, PILL_TIMING.walk) : 0;
      const mirrorReveal = taking && this.motion.pills.choice === 'red' ? THREE.MathUtils.smoothstep(this.motion.pills.elapsed, PILL_TIMING.exit - .7, PILL_TIMING.take) : 0;
      const wide = new THREE.Vector3(.1, 1.6, 8.6).multiplyScalar(Math.max(1, 1.1 / this.camera.aspect)).add(new THREE.Vector3(0, 1.1, -6));
      const ideal = wide.lerp(new THREE.Vector3(.6, 3.05, -2.1), close).lerp(new THREE.Vector3(-.3, 3.85, -2.8), mouth)
        .lerp(new THREE.Vector3(-1.5, 5.2, 8), departure).add(new THREE.Vector3(center.x, center.y - 1, center.z));
      const focus = new THREE.Vector3(0, 1.1, -6).lerp(new THREE.Vector3(-.2, 2.5, -5.8), close).lerp(new THREE.Vector3(1.3, 3.2, -6), mouth)
        .lerp(new THREE.Vector3(-1, 2.7, -5.4), departure).lerp(new THREE.Vector3(-4, 3.1, -9.5), mirrorReveal)
        .add(new THREE.Vector3(center.x, center.y - 1, center.z));
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-6 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.mirrorEntry && this.firstPerson) {
      const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
      const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .23)) : target;
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (this.motion.mirrorBeat !== undefined && !this.firstPerson) {
      const center = FILM_SETS.film_lafayette.center;
      const ideal = new THREE.Vector3(center.x + MIRROR_SEAT.x + 5.2, center.y + 5.1, center.z + MIRROR_SEAT.z + 2);
      const focus = new THREE.Vector3(this.position.x, center.y + 2.5, this.position.z - .5);
      if (this.motion.mirrorEntry) {
        const entry = mirrorEntryPose(this.motion.mirrorEntry);
        ideal.lerp(new THREE.Vector3(this.position.x + 7.4, center.y + 6.6, Math.min(center.z - 12.5, this.position.z + 4.8)), 1 - entry.seated);
        focus.lerp(new THREE.Vector3(this.position.x, center.y + 1.7, this.position.z), 1 - entry.seated);
      }
      if (resetCamera || (this.motion.mirrorEntry?.elapsed ?? this.motion.mirrorBeat) < .12) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.performance === 'pod' && state.currentLocation === 'film_power_plant_pods') {
      const center = FILM_SETS.film_power_plant_pods.center;
      if (this.firstPerson) {
        const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
        const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : new THREE.Vector3(center.x, center.y + 1.45, center.z - 15);
        const forward = head ? new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch)
          .applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw - state.rotation)
          : new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch - 1.47), -Math.sin(this.pitch - 1.47), Math.cos(this.yaw) * Math.cos(this.pitch - 1.47));
        this.camera.position.copy(eye); this.camera.lookAt(eye.add(forward));
      } else {
        const ideal = new THREE.Vector3(center.x + 5.8, center.y + 8.2, center.z - 6.5);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(center.x, center.y + 3.45, center.z - 12.5);
      }
    } else if (this.firstPerson && state.currentLocation === 'film_power_plant_pods' &&
      (this.motion.performance === 'float' || this.motion.performance === 'lift')) {
      const boarding = podRescuePose(this.motion.podRescue ?? 0);
      const eye = new THREE.Vector3(this.position.x, this.position.y + 3.25 - boarding.settle * 1.1, this.position.z - .25);
      const crew = recoveryCrewPose({ elapsed: this.motion.podRescue ?? 0, role: 'morpheus', boarding: true });
      const center = FILM_SETS.film_power_plant_pods.center;
      const dx = center.x + crew.x - eye.x, dz = center.z + crew.z - eye.z;
      const crewPitch = -Math.atan2(center.y + 3.2 - boarding.settle * .75 - eye.y, Math.hypot(dx, dz));
      const receiving = THREE.MathUtils.smoothstep(this.motion.podRescue ?? 0, POD_RESCUE.lowered, 10.1);
      const pitch = this.pitch - 1.42 * (1 - boarding.board) + (crewPitch - .24) * receiving;
      const yaw = this.yaw - Math.PI / 2 * (1 - boarding.board) + (Math.atan2(dx, dz) - Math.PI) * receiving;
      const forward = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.add(forward));
    } else if (state.currentLocation === 'film_power_plant_pods' &&
      (this.motion.performance === 'float' || this.motion.performance === 'lift')) {
      // The ordinary rear boom rises through the tower behind the drain.
      // Keep the cinematic shot in the open channel; V retains free eye movement.
      const center = FILM_SETS.film_power_plant_pods.center;
      const interior = (this.motion.podRescue ?? 0) >= POD_RESCUE.hoisted + .65;
      const approach = THREE.MathUtils.smoothstep(this.motion.podRescue ?? 0, 4.4, 5.3);
      const ideal = interior ? new THREE.Vector3(center.x + 5.2, center.y + 4.4, center.z + 18)
        : new THREE.Vector3(this.position.x + 6.5 - approach * 4.5, Math.min(center.y - 2.1, this.position.y + 4.8), this.position.z + 4.5 - approach * 2.5);
      if (resetCamera || interior !== this.podInterior) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.podInterior = interior;
      this.camera.lookAt(this.position.x, this.position.y + 2.5 - podRescuePose(this.motion.podRescue ?? 0).settle, this.position.z);
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
    } else if (this.performing && this.phone && this.motion.window === undefined && this.motion.crossing === undefined && this.firstPerson) {
      const head = group.getObjectByName('head'); head?.updateWorldMatrix(true, false);
      const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : target;
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (this.performing && this.phone && this.motion.window === undefined && this.motion.crossing === undefined && !this.firstPerson) {
      const center = FILM_SETS.film_metacortex_floor.center;
      const call = this.phone.phase === 'answering' ? THREE.MathUtils.smoothstep(this.phone.elapsed, .4, 2) : 0;
      const lift = this.phone.phase === 'pickup' ? THREE.MathUtils.smoothstep(this.phone.elapsed, .65, 1.8) : 1;
      const origin = new THREE.Vector3(center.x + OFFICE_CONTACT.x, center.y - 1, center.z + OFFICE_CONTACT.z);
      const ideal = origin.clone().add(new THREE.Vector3(.7, 4.25, .5).lerp(new THREE.Vector3(2.35, 4.35, -2.5), call));
      const target = origin.clone().add(new THREE.Vector3(.5, 2.725, -1.39).lerp(new THREE.Vector3(.38, 3.255, -.66), lift).lerp(new THREE.Vector3(.15, 3.65, -.1), call));
      this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta)); this.camera.lookAt(target);
    } else if (this.performing && this.motion.vase !== undefined) {
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 2.99, this.position.z);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
      } else {
        const center = FILM_SETS.film_oracle_home.center;
        const ideal = new THREE.Vector3(center.x + 1.8, center.y + 4.8, center.z - 8.8);
        this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
        this.camera.lookAt(center.x + 7.6, center.y + 1.7, center.z - 11.7);
      }
    } else if (spoon) {
      spoon.updateWorldMatrix(true, false);
      const hand = spoon.localToWorld(new THREE.Vector3(.1, .55, 0));
      const focus = new THREE.Vector3(this.position.x, this.position.y + 2.85, this.position.z).lerp(hand, .58);
      const distance = this.camera.aspect < 1 ? 4.6 : 3.7;
      const ideal = focus.clone().add(new THREE.Vector3(Math.sin(this.facing + .22) * distance, .3, Math.cos(this.facing + .22) * distance));
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
    } else if (this.motion.truckRescue && this.firstPerson) {
      this.camera.position.copy(target);
      this.syncTruckRescueCamera(group);
    } else if (this.motion.truckRescue) {
      const ideal = new THREE.Vector3(this.position.x + 9, this.position.y + 5, this.position.z + 13);
      const focus = new THREE.Vector3(this.position.x - 1.4, this.position.y - .2, this.position.z + 2.3);
      if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
      this.camera.lookAt(focus);
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
    } else if (dockLastStandLocked(this.motion.dockLastStand)) {
      const center = FILM_SETS.film_zion_hangar.center, gesture = this.motion.dockLastStand!;
      if (this.firstPerson) this.syncDockLastStandCamera(group);
      else {
        const attack = gesture.phase === 'attack', fall = dockLastStandPose(gesture).fallen;
        const narrow = this.camera.aspect < .85;
        const ideal = new THREE.Vector3(center.x - (attack ? 5.8 : 5.4), center.y + (attack ? 8 : 3.5), center.z + (attack ? narrow ? -8 : -3 : narrow ? -5.5 : .2));
        const focus = new THREE.Vector3(center.x - .7, center.y + (attack ? 5.8 - fall * 4 : 1.3), center.z + (attack ? 11 - fall * 3 : 6.3));
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (dockReloadLocked(this.motion.dockReload)) {
      const center = FILM_SETS.film_zion_hangar.center;
      if (this.firstPerson) {
        const eye = new THREE.Vector3(this.position.x, this.position.y + 3.08, this.position.z - .18);
        const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
        this.camera.position.copy(eye); this.camera.lookAt(eye.clone().addScaledVector(forward, 20));
      } else {
        const height = dockReloadHeight(this.motion.dockReload!.climb);
        const ideal = new THREE.Vector3(center.x + (this.camera.aspect < .85 ? 8 : 6.2), center.y + 5.2 + height * .35, center.z + 24.5);
        const focus = new THREE.Vector3(center.x - .75, center.y + 2.6 + height * .5, center.z + 14.5);
        if (resetCamera) this.camera.position.copy(ideal); else this.camera.position.lerp(ideal, 1 - Math.exp(-8 * delta));
        this.camera.lookAt(focus);
      }
    } else if (this.motion.dockGate) {
      const gate = this.motion.dockGate, center = FILM_SETS.film_zion_hangar.center;
      const origin = new THREE.Vector3(center.x, center.y - 1, center.z);
      const eye = new THREE.Vector3().copy(dockGateEye(gate)).add(origin);
      const target = new THREE.Vector3().copy(dockGateAim({ ...gate, yaw: this.yaw, pitch: this.pitch })).add(origin);
      const shoulder = this.yaw + .68;
      const ideal = this.firstPerson ? eye : eye.clone().add(new THREE.Vector3(-Math.sin(shoulder) * 56, 5, -Math.cos(shoulder) * 56));
      ideal.y = Math.max(center.y + 2, ideal.y);
      if (!this.firstPerson && ['opening', 'entering', 'done'].includes(gate.phase)) {
        this.camera.fov = this.camera.aspect < .85 ? 80 : 64;
        ideal.set(center.x - 34, center.y + 31, center.z);
        target.set(center.x + 13, center.y + 26, center.z - 64);
        if (gate.phase !== 'opening') {
          const ship = dockGateShip(gate); target.set(center.x + ship.x, center.y - 1 + ship.y, center.z + ship.z);
        }
      }
      this.camera.position.copy(ideal); this.camera.lookAt(target);
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
      const focus = carried ? new THREE.Vector3(this.position.x, this.position.y + .4, this.position.z + 1.8)
        : dawn ? new THREE.Vector3(center.x - 6.4, center.y + 1.9, center.z - 22.4)
          : gesture.kind === 'reset' ? new THREE.Vector3(this.position.x + .9, this.position.y - .45, this.position.z)
          : new THREE.Vector3(center.x, center.y + 5.5, center.z + (gesture.phase === 'retreat' ? -42 : 14));
      const ideal = carried ? new THREE.Vector3(this.position.x + 9.4, this.position.y + 6.4, this.position.z - 6)
        : dawn ? new THREE.Vector3(center.x + 1, center.y + 4.1, center.z - 29)
          : gesture.kind === 'reset' ? new THREE.Vector3(this.position.x + 6, this.position.y + 3.4, this.position.z + 6)
          : new THREE.Vector3(center.x + 15, center.y + 9, center.z + (gesture.phase === 'retreat' ? -20 : 31));
      if (carried) ideal.sub(focus).multiplyScalar(Math.max(1, .92 / this.camera.aspect)).add(focus);
      if (gesture.kind === 'reset' && gesture.resetVersion === 2) {
        const approach = gesture.phase === 'ready' ? 0 : gesture.phase === 'cat' ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, 8.8) : 1;
        focus.set(this.position.x + THREE.MathUtils.lerp(-3, .7, approach), this.position.y - .3, this.position.z);
        ideal.set(this.position.x + THREE.MathUtils.lerp(-1.6, 4.1, approach),
          this.position.y + THREE.MathUtils.lerp(.65, 1.6, approach), this.position.z + THREE.MathUtils.lerp(8.8, 5.2, approach));
        ideal.sub(focus).multiplyScalar(Math.max(1, 1.15 / this.camera.aspect)).add(focus);
      }
      if (dawn) {
        const sunrise = gesture.phase === 'sunrise' ? THREE.MathUtils.smoothstep(gesture.elapsed, 0, 6.2) : ['belief', 'done'].includes(gesture.phase) ? 1 : 0;
        focus.lerp(new THREE.Vector3(center.x + 1, center.y + 10, center.z - 110), sunrise);
        ideal.lerp(new THREE.Vector3(center.x - 6, center.y + 5.3, center.z - 5), sunrise);
        if (this.camera.aspect < 1) ideal.x += 3;
      }
      if (carried || resetCamera || gesture.elapsed < .08) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-7 * delta));
      this.camera.lookAt(focus);
    } else if (this.motion.smithFinale && smithFinaleLocked(this.motion.smithFinale) && this.firstPerson && !smithOracleRestored(this.motion.smithFinale)) {
      const pose = smithFinalePose(this.motion.smithFinale);
      const eye = new THREE.Vector3(this.position.x, this.position.y + 2.32 - pose.fallen * 1.05, this.position.z);
      const pitch = this.pitch - pose.fallen * .44;
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().addScaledVector(forward, 18));
    } else if (this.motion.smithFinale && smithFinaleLocked(this.motion.smithFinale)) {
      const gesture = this.motion.smithFinale; const pose = smithFinalePose(gesture); const center = FILM_SETS.film_smith_avenue.center;
      const neo = new THREE.Vector3(center.x + pose.neo.x, center.y + pose.neo.y + 1.7, center.z + pose.neo.z);
      const smith = new THREE.Vector3(center.x + pose.smith.x, center.y + pose.smith.y + 1.7, center.z + pose.smith.z);
      const crater = smithCraterAmount(gesture);
      neo.y -= pose.fallen * 1.1;
      const focus = neo.clone().lerp(smith, gesture.phase === 'surrender' || gesture.phase === 'assimilating' ? .56 : .5 - crater * .15);
      const distance = THREE.MathUtils.lerp(14, 18, pose.flight);
      const height = THREE.MathUtils.lerp(THREE.MathUtils.lerp(6.4, 10, crater), 7.5, pose.flight);
      const side = THREE.MathUtils.lerp(THREE.MathUtils.lerp(5.5, 7.5, crater), 5, pose.flight);
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const ideal = focus.clone().addScaledVector(forward, -distance).addScaledVector(right, side); ideal.y += height;
      if (['vision', 'understanding', 'surrender', 'assimilating', 'purging', 'done'].includes(gesture.phase)) {
        const midZ = (pose.neo.z + pose.smith.z) / 2;
        focus.set(center.x, center.y + pose.neo.y + 1.65, center.z + midZ);
        ideal.set(center.x + (this.camera.aspect < 1 ? 9 : 6.8), center.y + pose.neo.y + 3.1, center.z + midZ - 1.3);
        const reveal = gesture.phase === 'done' ? 1 : gesture.phase === 'purging' ? THREE.MathUtils.smoothstep(gesture.elapsed, 4.2, 6.2) : 0;
        focus.lerp(new THREE.Vector3(center.x, center.y + 3, center.z + 6), reveal);
        ideal.lerp(new THREE.Vector3(center.x + 6, center.y + 22, center.z - (this.camera.aspect < 1 ? 100 : 80)), reveal);
        const restore = gesture.phase === 'done' ? 1 : gesture.phase === 'purging' ? THREE.MathUtils.smoothstep(gesture.elapsed, 8.2, 10.5) : 0;
        const host = SMITH_FINALE.oracle, portrait = this.camera.aspect < 1 ? 2.1 : 1;
        focus.lerp(new THREE.Vector3(center.x + host.x - 2.1, center.y - SMITH_FINALE.crater.depth - .2, center.z + host.z), restore);
        ideal.lerp(new THREE.Vector3(center.x + host.x - 1.3, center.y - SMITH_FINALE.crater.depth + 1.6 * portrait, center.z + host.z - 5.3 * portrait), restore);
      }
      if (crater > 0) ideal.y = Math.max(ideal.y, center.y + smithCraterFloor(ideal.x - center.x, ideal.z - center.z) * crater + .6);
      this.camera.position.copy(ideal);
      this.camera.lookAt(focus);
    } else if (this.motion.deusPact && deusPactLocked(this.motion.deusPact) && this.firstPerson) {
      const pose = deusPactPose(this.motion.deusPact);
      const eye = new THREE.Vector3(this.position.x, this.position.y + 2.05 - pose.seated * .72, this.position.z + .22);
      const pitch = this.pitch - (Math.atan2(17.95, 22.22) + .24) * pose.face * (1 - pose.seated);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (this.motion.deusPact && deusPactLocked(this.motion.deusPact)) {
      const pose = deusPactPose(this.motion.deusPact);
      const orbit = this.yaw - Math.PI;
      const side = THREE.MathUtils.lerp(THREE.MathUtils.lerp(6.4, this.camera.aspect < .85 ? 8 : 13, pose.face), 6, pose.seated);
      const back = THREE.MathUtils.lerp(THREE.MathUtils.lerp(14, this.camera.aspect < .85 ? 40 : 35, pose.face), -7, pose.seated);
      const ideal = new THREE.Vector3(this.position.x + Math.cos(orbit) * side + Math.sin(orbit) * back,
        this.position.y + THREE.MathUtils.lerp(THREE.MathUtils.lerp(8.6, 11, pose.face), 3.8, pose.seated),
        this.position.z - Math.sin(orbit) * side + Math.cos(orbit) * back);
      const focus = new THREE.Vector3(this.position.x,
        this.position.y + THREE.MathUtils.lerp(THREE.MathUtils.lerp(5.8, 14, pose.face), .5, pose.seated),
        this.position.z + THREE.MathUtils.lerp(THREE.MathUtils.lerp(-8, -13, pose.face), .1, pose.seated));
      this.camera.position.copy(ideal);
      this.camera.lookAt(focus);
    } else if (this.motion.farewell && this.firstPerson) {
      // Temporary eye while the GLB loads; Engine resamples the posed head below.
      const eye = new THREE.Vector3(this.position.x, this.position.y + 2.05, this.position.z + .72);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
    } else if (this.motion.farewell) {
      const ideal = new THREE.Vector3(this.position.x + (this.camera.aspect < .85 ? 5.8 : 4.8), this.position.y + 4.4, this.position.z + 3.2);
      const focus = new THREE.Vector3(this.position.x, this.position.y + 1.45, this.position.z - .35);
      if (resetCamera || this.motion.farewell.elapsed < .12) this.camera.position.copy(ideal);
      else this.camera.position.lerp(ideal, 1 - Math.exp(-9 * delta));
      this.camera.lookAt(focus);
    } else if (state.currentAction?.parameters.metacortexLift && !this.firstPerson) {
      const focus = target.clone(); focus.y = this.position.y + 1.75;
      const ideal = focus.clone().add(new THREE.Vector3(-Math.sin(this.yaw) * 3.8, .4 + Math.sin(this.pitch) * 1.4, -Math.cos(this.yaw) * 3.8));
      ideal.x = THREE.MathUtils.clamp(ideal.x, METACORTEX.center.x - 2.65, METACORTEX.center.x + 2.65);
      ideal.z = THREE.MathUtils.clamp(ideal.z, METACORTEX.center.z - 31.65, METACORTEX.center.z - 26.2);
      this.camera.position.copy(ideal); this.camera.lookAt(focus);
    } else if (this.firstPerson && this.motion.contact?.propMotion === 'minidisc' && ['retrieving', 'disk', 'handover'].includes(this.motion.contact.phase)) {
      const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
      const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .44)) : target;
      if (this.bookAim) {
        const x = APARTMENT_ROOM.center.x + APARTMENT_BOOK.x - eye.x, z = APARTMENT_ROOM.center.z + APARTMENT_BOOK.z - eye.z;
        this.yaw = this.movementYaw = Math.atan2(x, z);
        this.pitch = Math.atan2(eye.y - APARTMENT_BOOK.y - .2, Math.hypot(x, z)); this.bookAim = false;
      }
      this.camera.position.copy(eye);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.lookAt(eye.clone().add(forward));
    } else if (this.firstPerson && this.motion.computerCheck) {
      const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
      const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .44)) : target;
      if (this.cableAim) {
        this.cablePitch ??= this.pitch;
        const pull = computerNetworkPull(this.motion.computerCheck);
        const x = APARTMENT_ROOM.center.x + APARTMENT_NETWORK.plug.x - eye.x;
        const z = APARTMENT_ROOM.center.z + APARTMENT_NETWORK.plug.z + .31 * pull - eye.z;
        this.yaw = this.movementYaw = Math.atan2(x, z);
        this.pitch = THREE.MathUtils.clamp(Math.atan2(eye.y - APARTMENT_NETWORK.plug.y + .16 * pull - APARTMENT_NETWORK.gripHeight, Math.hypot(x, z)), -.4, 1.5);
        this.cableAim = false;
      }
      this.camera.position.copy(eye);
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.lookAt(eye.clone().add(forward));
    } else if (this.firstPerson) {
      this.camera.position.copy(target);
      if (this.motion.grounded && this.motion.speed > .1) this.camera.position.y += Math.sin(this.cameraStep * 2) * .018;
      const pitch = interview?.pinned ? THREE.MathUtils.lerp(this.pitch, -Math.PI / 2 + this.pitch * .6, interview.pinned) : this.pitch;
      this.camera.lookAt(target.x + Math.sin(this.yaw) * Math.cos(pitch), target.y - Math.sin(pitch), target.z + Math.cos(this.yaw) * Math.cos(pitch));
    } else {
      const offset = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch) + 0.1, -Math.cos(this.yaw) * Math.cos(this.pitch));
      // In the ambush aisle the bathroom partition sits to Neo's right.
      const ambushAisle = state.currentLocation === 'film_ambush_house' && this.position.z < FILM_SETS.film_ambush_house.center.z - 4;
      const sixthBathroom = ambushAisle && state.id === 'morpheus' && Math.abs(this.position.y - FILM_SETS.film_ambush_house.center.y - WETWALL_SHAFT.sixth) < 3;
      const shoulder = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).multiplyScalar(sixthBathroom ? 2.6 : ambushAisle ? -1.1 : this.camera.aspect < .8 ? .3 : .8);
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
      this.camera.lookAt((sixthBathroom ? pivot.clone().lerp(this.cameraTarget, .6) : pivot.clone()).add(new THREE.Vector3(Math.sin(this.yaw) * 2, -.08, Math.cos(this.yaw) * 2)));
    }
    this.impactAge += delta;
    if (this.impactAge < .18) {
      const kick = this.impactStrength * (1 - this.impactAge / .18) ** 2;
      this.camera.position.x += Math.cos(this.yaw) * Math.sin(this.impactAge * 95) * kick;
      this.camera.position.y += Math.sin(this.impactAge * 80) * kick * .6;
    }
  }

  syncTruckRescueCamera(group: THREE.Group): void {
    if (!this.firstPerson || !this.motion.truckRescue) return;
    // AgentRenderer poses the body after controls; resample its current head before rendering.
    const head = group.getObjectByName('head'); group.updateWorldMatrix(true, true);
    const eye = head ? head.localToWorld(new THREE.Vector3(0, .1, .32)) : this.camera.position;
    const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
  }

  syncFarewellCamera(group: THREE.Group): void {
    if (!this.firstPerson || !this.motion.farewell) return;
    const head = group.getObjectByName('head'); if (!head) return;
    // Read after both actors' current poses/contact, including the first paused frame.
    group.updateWorldMatrix(true, true);
    const localEye = head.userData.cameraEye as THREE.Vector3 | undefined;
    const eye = head.localToWorld(localEye?.clone() ?? new THREE.Vector3(0, .1, .32));
    const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
  }

  syncDockLastStandCamera(group: THREE.Group): void {
    if (!this.firstPerson || !dockLastStandLocked(this.motion.dockLastStand)) return;
    const head = group.getObjectByName('kid-head'); if (!head) return;
    group.updateWorldMatrix(true, true);
    const eye = head.localToWorld(new THREE.Vector3(0, -.005, .275));
    if (this.lastStandAim) {
      const center = FILM_SETS.film_zion_hangar.center, attack = this.motion.dockLastStand?.phase === 'attack';
      const captain = group.parent?.getObjectByName('mifune-head');
      const target = captain ? captain.localToWorld(new THREE.Vector3(0, 0, .23))
        : new THREE.Vector3(center.x, center.y + (attack ? 5.4 : -.4), center.z + (attack ? 12 : 5.1));
      const direction = target.sub(eye);
      this.yaw = this.movementYaw = Math.atan2(direction.x, direction.z);
      this.pitch = Math.atan2(-direction.y, Math.hypot(direction.x, direction.z)); this.lastStandAim = false;
    }
    const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
  }

  syncSmithFinaleCamera(group: THREE.Group): void {
    if (!this.firstPerson || !smithFinaleLocked(this.motion.smithFinale)
      || smithOracleRestored(this.motion.smithFinale)
      || this.authoritative?.currentLocation !== 'film_smith_avenue') return;
    const head = group.getObjectByName('head'); if (!head) return;
    // Controls run before the saved flight/fall pose is applied to the GLB.
    group.updateWorldMatrix(true, true);
    const localEye = head.userData.cameraEye as THREE.Vector3 | undefined;
    if (!localEye) return;
    const eye = head.localToWorld(localEye.clone());
    const pitch = this.pitch - smithFinalePose(this.motion.smithFinale!).fallen * .44;
    const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
  }

  syncNeoCarryCamera(group: THREE.Group): void {
    if (!this.firstPerson || !this.motion.epilogue) return;
    if (['dawn', 'reset'].includes(this.motion.epilogue.kind)) {
      const head = group.getObjectByName(this.motion.epilogue.kind === 'dawn' ? 'oracle-head' : 'sati-head'); if (!head) return;
      group.updateWorldMatrix(true, true);
      const eye = head.localToWorld(new THREE.Vector3(0, 0, .27));
      const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward)); return;
    }
    if (this.motion.epilogue.kind !== 'neo_carried') return;
    const head = group.getObjectByName('head'); if (!head) return;
    group.updateWorldMatrix(true, true);
    const localEye = head.userData.cameraEye as THREE.Vector3 | undefined; if (!localEye) return;
    const eye = head.localToWorld(localEye.clone());
    const pitch = this.pitch - 1.15;
    const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
  }

  syncDeusCamera(group: THREE.Group): void {
    if (!this.firstPerson || this.id !== 'neo' || !deusPactLocked(this.motion.deusPact)
      || this.authoritative?.isInMatrix || this.authoritative?.currentLocation !== 'film_machine_core') return;
    const head = group.getObjectByName('head'); if (!head) return;
    group.updateWorldMatrix(true, true);
    const localEye = head.userData.cameraEye as THREE.Vector3 | undefined;
    if (!localEye) return;
    const eye = head.localToWorld(localEye.clone()), pose = deusPactPose(this.motion.deusPact!);
    const pitch = this.pitch - (Math.atan2(17.95, 22.22) + .24) * pose.face * (1 - pose.seated);
    const forward = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    this.camera.position.copy(eye); this.camera.lookAt(eye.clone().add(forward));
  }

  dispose(): void {
    this.release(); window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur); document.removeEventListener('visibilitychange', this.visibility);
    document.removeEventListener('mousemove', this.mouseMove); this.canvas.removeEventListener('mousedown', this.mouseDown);
    window.removeEventListener('mouseup', this.mouseUp); this.canvas.removeEventListener('click', this.click);
  }
}
