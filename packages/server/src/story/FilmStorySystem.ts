import { ReloadedOpeningSystem } from './ReloadedOpeningSystem.js';
import { ReloadedCatchSystem } from './ReloadedCatchSystem.js';
import { newReloaded, reloadedLocked, ZION_CAST } from '@auto_matrix/shared';
import { catchLocked, newCatch } from '@auto_matrix/shared';
import { FILM_SCENES, FILM_SCENE_BY_ID, FILM_SETS, FILM_CAST, GRID_WINDOW_SECONDS, GRID_REROUTE_SECONDS, GRID_HACK_SECONDS, ARCHITECT_DOOR_SECONDS, RELOADED_FINALE, HEL_ELEVATOR, HEL_DANCE_DOOR, helElevatorLocked, helDanceDoorLocked, filmReflections, CHARACTERS, LOCATIONS, NEO_CHAPTERS, filmCharacterFates, filmEntry, filmPosition, filmStepPosition, locationEntrance, distance, playerBlocked, newFreewayRide, stepFreeway, OFFICE_LADDER, awakeningLocked, awakeningPose, AWAKENING_SECONDS, MIRROR_TOUCH, MIRROR_TIMING, mirrorSilver, CONSTRUCT_REVEAL, DESERT_REVEAL, oracleActing,
  AMBUSH_REWRITE, AMBUSH_SECONDS, AMBUSH_SEALS, OFFICE_CONTACT, OFFICE_WINDOW, OFFICE_CROSSING_SECONDS, officeCrossingPose, windowCrossing, phoneLocked, heldPhone, windowOpening, pillLocked, pillRoot, PILL_ROOM, PILL_TIMING, trainingLocked, trainingRoot, trainingText, TRAINING_SECONDS,
  lobbyLocked, meleeReach, groundHeight, MIRROR_SEAT, type DriveInput, type AgentState, type FilmScene, type FilmStep, type GridOperation, type SandboxState, type SandboxThreat, type TrainingRole, type CombatImpact } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import { LobbyCombatSystem } from './LobbyCombatSystem.js';
import { HelCoatcheckSystem } from './HelCoatcheckSystem.js';
import { OfficeEscapeSystem } from './OfficeEscapeSystem.js';
import { INTERROGATION_CAST, INTERROGATION_TIMING, interrogationLocked, interrogationRoot } from '@auto_matrix/shared';
import { MEETING_CAR, MEETING_CAST, MEETING_TIMING, meetingLocked, meetingRoot, type MeetingEncounter } from '@auto_matrix/shared';
import { LAFAYETTE, LAFAYETTE_WELCOME, LAFAYETTE_KNOCK_SECONDS, HOTEL_ROUTE_LENGTH, HOTEL_DOOR_PROGRESS, hotelRoutePose, hotelRouteProgress, lafayetteKnocking, lafayetteKnockRoot, lafayetteWelcomeLocked, lafayetteWelcomeRoot, filmSetAt } from '@auto_matrix/shared';
import { OFFICE_WORKDAY, OFFICE_DELIVERY_SECONDS, officeCourierRoot, officeRecipientRoot, workdayLocked, workdayText } from '@auto_matrix/shared';
import { APARTMENT, WAKE_CALL, apartmentAfter, apartmentDoor, apartmentLocked, apartmentText, wakeCallLocked, wakeCallRoot, wakeCallText, lifeRoomCenter, type ApartmentPhase, type WakeCallPhase } from '@auto_matrix/shared';
import { CLUB, clubLocked, clubRoot, clubText, type ClubPhase } from '@auto_matrix/shared';
import { SENTINEL_CAST, SENTINEL_TIMING, sentinelActive, sentinelDanger, sentinelLocked, sentinelRoot, sentinelText, type SentinelRole } from '@auto_matrix/shared';
import { INTERLUDE_CAST, interludeDuration, interludeKind, interludeLocked, interludeRoot, interludeSeated, interludeText, type InterludeEncounter, type InterludeRole } from '@auto_matrix/shared';
import { ORACLE_VISIT, oracleLegacyChoice, oracleVisitDuration, oracleVisitLocked, oracleVisitRoot, oracleVisitText, type OracleVisitRole } from '@auto_matrix/shared';
import { BETRAYAL, betrayalDuration, betrayalLocked, betrayalRoot, betrayalText, type BetrayalEncounter, type BetrayalRole } from '@auto_matrix/shared';
import { RESCUE, rescueDuration, rescueLocked, rescueRoot, rescueText, type RescueLoadout, type RescuePreparation, type RescueRole } from '@auto_matrix/shared';
import { GOVERNMENT_RESCUE, governmentLocked, governmentRoot, governmentText, type GovernmentRescueEncounter, type GovernmentRescueRole } from '@auto_matrix/shared';
import { AIR_RESCUE, airRescueLocked, airRescueRoot, airRescueText, type AirRescueEncounter, type AirRescueRole } from '@auto_matrix/shared';
import { MATRIX_ESCAPE, matrixEscapeLocked, matrixEscapeRoot, matrixEscapeText, type MatrixEscapeEncounter, type MatrixEscapeRole } from '@auto_matrix/shared';
import { THE_ONE, theOneLocked, theOneRoot, theOneText, type TheOneEncounter, type TheOneRole } from '@auto_matrix/shared';
import { BURLY, burlyLocked, burlyText, type BurlyEncounter } from '@auto_matrix/shared';
import { EXILES } from '@auto_matrix/shared';
import { CHATEAU, type ChateauEncounter } from '@auto_matrix/shared';
import { MOUNTAIN, type MountainFlight, type PlayerInput } from '@auto_matrix/shared';
import { GARAGE, newGarageEscape, stepGarageEscape } from '@auto_matrix/shared';
import { TRUCKS } from '@auto_matrix/shared';
import { OPENING_ESCAPE } from '@auto_matrix/shared';
import { OpeningHotelSystem } from './OpeningHotelSystem.js';

const BATHROOM_ROLES = ['neo', 'trinity', 'switch', 'apoc'] as const;
const UNPLUGGED_ROLES = ['tank', 'cypher', 'dozer', 'apoc', 'switch', 'neo', 'trinity'] as const;

export class FilmStorySystem {
  // The controller owns socket sessions. It can refuse a handoff occupied by another player.
  handoff?: (from: AgentState, to: string, tick: number, newCycle?: boolean) => boolean;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  readonly reloaded: ReloadedOpeningSystem;
  readonly catch: ReloadedCatchSystem;
  readonly lobby: LobbyCombatSystem;
  readonly coatcheck: HelCoatcheckSystem;
  readonly openingHotel: OpeningHotelSystem;
  readonly office: OfficeEscapeSystem;
  constructor(private world: WorldState, private sandbox: () => SandboxState, private returnToLife: (tick: number) => void) { this.lobby = new LobbyCombatSystem(world, sandbox); this.coatcheck = new HelCoatcheckSystem(world, sandbox); this.openingHotel = new OpeningHotelSystem(sandbox); this.openingHotel.onAdvance = (text, actor, tick) => this.advance(text, actor, tick); this.openingHotel.onImpact = (impact, tick) => this.onImpact?.(impact, tick); this.office = new OfficeEscapeSystem(sandbox); this.reloaded = new ReloadedOpeningSystem(world, sandbox); this.reloaded.onAdvance = (text, actor, tick) => this.advance(text, actor, tick); this.reloaded.onImpact = (impact, tick) => this.onImpact?.(impact, tick); this.catch = new ReloadedCatchSystem(world, sandbox); this.catch.onAdvance = (text, actor, tick) => this.advance(text, actor, tick); }
  get state() { return this.sandbox().neoLife?.journey; }
  get scene(): FilmScene | undefined { return this.state && FILM_SCENE_BY_ID[this.state.scene]; }
  get step(): FilmStep | undefined { return this.scene?.steps[this.state!.step]; }
  controls(agent: AgentState): boolean { return Boolean(this.state && this.state.actor === agent.id); }
  private openingRoofTick(actor: AgentState, tick: number): void {
    const state = this.state!;
    state.openingRoof ??= { phase: 'running', lastTick: tick, attempts: 0 };
    const chase = state.openingRoof;
    const dt = Math.min(.5, Math.max(0, tick - chase.lastTick) * .5);
    chase.lastTick = tick;
    if (chase.phase !== 'running') return;
    if (actor.position.y < FILM_SETS.film_hotel_roofs.center.y - 7) {
      chase.phase = 'failed'; delete state.started;
      state.lastText = 'Trinity 没能跨过楼间空隙。J 打开手记，从屋顶入口重试。'; return;
    }
    const brown = this.world.agents.get('agent_brown');
    if (!brown || brown.currentLocation !== this.scene!.set) return;
    const roof = FILM_SETS.film_hotel_roofs;
    const takeoff = OPENING_ESCAPE.roofGapNear + 2;
    const landing = OPENING_ESCAPE.roofGapFar - 1;
    const localZ = brown.position.z - roof.center.z;
    if (!chase.crossed && !chase.leap && localZ <= OPENING_ESCAPE.roofGapFar) chase.crossed = true;
    if (!chase.crossed && !chase.leap && localZ < takeoff && localZ > OPENING_ESCAPE.roofGapFar) {
      chase.leap = { elapsed: (takeoff - localZ) / (takeoff - landing) * OPENING_ESCAPE.pursuerLeapSeconds,
        fromX: brown.position.x - roof.center.x, toX: brown.position.x - roof.center.x };
    }
    if (!brown.controller && dt > 0) {
      if (!chase.crossed && !chase.leap && actor.position.z - roof.center.z < OPENING_ESCAPE.roofGapFar && localZ <= takeoff + .1) {
        chase.leap = { elapsed: 0, fromX: brown.position.x - roof.center.x,
          toX: Math.max(-roof.width / 2 + 4, Math.min(roof.width / 2 - 4, actor.position.x - roof.center.x)) };
      }
      if (chase.leap) {
        const leap = chase.leap;
        leap.elapsed = Math.min(OPENING_ESCAPE.pursuerLeapSeconds, leap.elapsed + dt);
        const progress = leap.elapsed / OPENING_ESCAPE.pursuerLeapSeconds;
        const before = { ...brown.position };
        brown.position.x = roof.center.x + leap.fromX + (leap.toX - leap.fromX) * progress;
        brown.position.z = roof.center.z + takeoff + (landing - takeoff) * progress;
        brown.position.y = roof.center.y + Math.sin(progress * Math.PI) * OPENING_ESCAPE.pursuerLeapHeight;
        brown.rotation = Math.atan2(leap.toX - leap.fromX, landing - takeoff);
        brown.velocity = { x: (brown.position.x - before.x) / dt, y: (brown.position.y - before.y) / dt, z: (brown.position.z - before.z) / dt };
        brown.currentAction = { type: 'move_to', parameters: { resolved: true, filmPursuit: true, openingRoofLeap: progress }, startedAt: tick, duration: 1, progress: 0 };
        if (progress >= 1) { chase.crossed = true; delete chase.leap; }
      } else {
        const dx = actor.position.x - brown.position.x;
        const dz = (chase.crossed ? actor.position.z : Math.max(actor.position.z, roof.center.z + takeoff)) - brown.position.z;
        const length = Math.hypot(dx, dz); const travel = Math.min(length, OPENING_ESCAPE.pursuerSpeed * dt);
        if (length > .01) {
          brown.position.x += dx / length * travel; brown.position.z += dz / length * travel;
          brown.rotation = Math.atan2(dx, dz);
        }
        brown.velocity = { x: dt ? dx / Math.max(length, .01) * travel / dt : 0, y: 0, z: dt ? dz / Math.max(length, .01) * travel / dt : 0 };
        brown.currentAction = { type: travel > .01 ? 'move_to' : 'idle', parameters: { resolved: true, filmPursuit: true }, startedAt: tick, duration: 1, progress: 0 };
      }
    }
    if (distance(actor.position, brown.position) < 2.7) {
      chase.phase = 'failed'; delete state.started;
      state.lastText = 'Brown 追上了 Trinity。J 打开手记，从屋顶入口重试。';
    }
  }
  private openingPhoneTick(tick: number): void {
    const state = this.state!;
    state.openingPhone ??= { phase: 'running', remaining: OPENING_ESCAPE.phoneSeconds, lastTick: tick, attempts: 0 };
    const phone = state.openingPhone;
    const dt = Math.min(.5, Math.max(0, tick - phone.lastTick) * .5);
    phone.lastTick = tick;
    if (phone.phase === 'running') {
      phone.remaining = Math.max(0, phone.remaining - dt);
      if (phone.remaining === 0) {
        phone.phase = 'failed'; delete state.started;
        state.lastText = '卡车撞进电话亭，线路被切断。J 打开手记，从街口重试。';
      }
    } else if (phone.phase === 'connected') {
      phone.impactElapsed = Math.min(OPENING_ESCAPE.truckImpactSeconds, (phone.impactElapsed ?? 0) + dt);
      if (phone.impactElapsed >= OPENING_ESCAPE.truckImpactSeconds) phone.phase = 'done';
    }
  }
  private ensureMobil(tick: number): void {
    const state = this.state;
    if (!state || !['m3_mobil', 'm3_family', 'm3_trainman', 'm3_mobil_release'].includes(state.scene) || state.mobil) return;
    // A save from the original two-step station can continue at its recorded scene.
    state.mobil = { phase: state.scene === 'm3_mobil_release' || state.scene === 'm3_trainman' && state.step > 0 ? 'approaching' : 'waiting', elapsed: 0, lastTick: tick, loops: 0 };
  }
  private helChaseTick(tick: number): void {
    const state = this.state!;
    state.helChase ??= { phase: state.step > 0 ? 'running' : 'sighting', elapsed: 0, lastTick: tick };
    const chase = state.helChase;
    const trainman = this.world.agents.get('trainman');
    if (trainman?.controller) { chase.lastTick = tick; return; }
    if (chase.phase === 'running') chase.elapsed = Math.min(6, chase.elapsed + Math.max(0, tick - chase.lastTick) * .5);
    chase.lastTick = tick;
    if (chase.phase === 'running' && chase.elapsed >= 6) {
      chase.phase = 'escaped'; state.lastText = '列车没有停。Trainman 从钢柱后跃过轨道，消失在驶过的车厢另一侧。';
    }
    if (trainman) {
      const progress = Math.min(1, chase.elapsed / 6);
      trainman.position = filmPosition(this.scene!.set, chase.phase === 'escaped' ? 26 : progress > .72 ? (progress - .72) / .28 * 26 : 0,
        chase.phase === 'sighting' ? 10 : 10 - progress * 49);
      trainman.rotation = Math.PI; trainman.velocity = { x: 0, y: 0, z: 0 };
      trainman.currentAction = { type: chase.phase === 'escaped' ? 'idle' : 'move_to',
        parameters: { resolved: true, helChase: chase.phase }, startedAt: tick, duration: 1, progress };
    }
  }
  private sealHelElevator(): void {
    const id = 'film:hel:elevator-door'; const state = this.state;
    if (state?.scene !== 'm3_hel_entry' || state.visiting || state.step > 0 || state.helElevator?.phase === 'open') {
      this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== id); return;
    }
    if (!this.sandbox().structures.some(s => s.id === id)) this.sandbox().structures.push({ id, kind: 'barricade', owner: 'matrix',
      position: filmPosition('film_club_hel', 0, HEL_ELEVATOR.doorZ), matrix: true, health: 999,
      film: { scene: 'm3_hel_entry', width: HEL_ELEVATOR.doorWidth, depth: .4, height: HEL_ELEVATOR.doorHeight } });
  }
  private helElevatorTick(actor: AgentState, tick: number): void {
    const state = this.state!;
    if (!state.helElevator) { state.helElevator = { phase: state.step ? 'open' : 'ready', elapsed: 0, lastTick: tick }; delete state.started; }
    const lift = state.helElevator;
    if (lift.phase === 'descending') {
      lift.elapsed = Math.min(HEL_ELEVATOR.seconds, lift.elapsed + Math.max(0, tick - lift.lastTick) * .5);
      actor.velocity = { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, helElevator: lift.elapsed / HEL_ELEVATOR.seconds },
        startedAt: tick, duration: 1, progress: lift.elapsed / HEL_ELEVATOR.seconds };
      state.checkpoint = { ...actor.position };
      if (lift.elapsed >= HEL_ELEVATOR.seconds) {
        lift.phase = 'open'; actor.currentAction = null;
        this.sealHelElevator();
        this.advance('铁笼到达 Club Hel。前门滑开，衣帽间的守卫拦住去路。', actor, tick);
      }
    }
    lift.lastTick = tick;
  }
  private ensureHelDanceDoor(tick: number): void {
    const state = this.state;
    if (state?.scene !== 'm3_hel_entry' || state.helDanceDoor) return;
    // Saves from before the door objective were already walking into the dance floor.
    const pastWeaponCheck = state.step >= 3;
    if (pastWeaponCheck) state.step++;
    state.helDanceDoor = { phase: pastWeaponCheck ? 'open' : 'sealed', elapsed: pastWeaponCheck ? HEL_DANCE_DOOR.seconds : 0, lastTick: tick };
  }
  private sealHelDanceDoor(): void {
    const id = 'film:hel:dance-door'; const state = this.state;
    if (state?.scene !== 'm3_hel_entry' || state.visiting || state.step > 3 || state.helDanceDoor?.phase === 'open') {
      this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== id); return;
    }
    if (!this.sandbox().structures.some(s => s.id === id)) this.sandbox().structures.push({ id, kind: 'barricade', owner: 'matrix',
      position: filmPosition('film_club_hel', 0, HEL_DANCE_DOOR.z), matrix: true, health: 999,
      film: { scene: 'm3_hel_entry', width: HEL_DANCE_DOOR.width, depth: .5, height: HEL_DANCE_DOOR.height } });
  }
  private helDanceDoorTick(actor: AgentState, tick: number): void {
    const state = this.state!; const door = state.helDanceDoor;
    if (!door) return;
    if (door.phase === 'opening') {
      door.elapsed = Math.min(HEL_DANCE_DOOR.seconds, door.elapsed + Math.max(0, tick - door.lastTick) * .5);
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.rotation = Math.PI;
      actor.currentAction = { type: 'idle', parameters: { player: true, resolved: true, helDanceDoor: door.elapsed / HEL_DANCE_DOOR.seconds },
        startedAt: tick, duration: 1, progress: door.elapsed / HEL_DANCE_DOOR.seconds };
      state.checkpoint = { ...actor.position };
      if (door.elapsed >= HEL_DANCE_DOOR.seconds) {
        door.phase = 'open'; actor.currentAction = null;
        this.advance('重门向内打开。舞曲盖过身后的枪声，穿过人群去见 Merovingian。', actor, tick);
      }
    }
    door.lastTick = tick;
  }
  private helDanceAlliesTick(actor: AgentState, tick: number): void {
    const state = this.state!; const door = state.helDanceDoor;
    if (!door || state.step < 2) return;
    const dt = Math.min(.5, Math.max(0, tick - (door.allyTick ?? tick - 1)) * .5);
    door.allyTick = tick;
    for (const [index, id] of (['morpheus', 'seraph'] as const).entries()) {
      const ally = this.world.agents.get(id);
      if (!ally || ally.controller || ally.status !== 'alive' || ally.currentLocation !== 'film_club_hel') continue;
      const side = index ? 1 : -1;
      const target = state.step === 2 ? filmPosition(this.scene!.set, side * 5, 7)
        : state.step === 3 ? filmPosition(this.scene!.set, side * 2.5, 5.5)
          : { ...actor.position, x: actor.position.x + side * 2.5, z: actor.position.z + 3.2 };
      const dx = target.x - ally.position.x; const dz = target.z - ally.position.z;
      const length = Math.hypot(dx, dz); const travel = Math.min(length, dt * 5.5);
      if (length > .01 && dt > 0) {
        ally.position.x += dx / length * travel; ally.position.z += dz / length * travel;
        ally.rotation = Math.atan2(dx, dz);
      }
      ally.velocity = { x: dt ? dx / Math.max(length, .01) * travel / dt : 0, y: 0, z: dt ? dz / Math.max(length, .01) * travel / dt : 0 };
      ally.currentAction = { type: travel > .01 ? 'move_to' : 'idle', parameters: { resolved: true, armed: true, weaponStyle: 'hel_pistol' },
        startedAt: tick, duration: 1, progress: 0 };
    }
  }
  private ensureHelBargain(tick: number): void {
    const state = this.state;
    if (state?.scene !== 'm3_hel_bargain' || state.helBargain) return;
    // Saves made before the playable standoff used three objectives. Keep their
    // decision, then resume at the corresponding new checkpoint.
    const oldStep = state.step;
    state.step = oldStep === 1 ? 2 : oldStep === 2 ? 3 : oldStep >= 3 ? this.scene!.steps.length : 0;
    const answer = state.reflections['m3_hel_bargain:1'];
    if (answer) state.reflections['m3_hel_bargain:2'] = answer;
    state.helBargain = { phase: oldStep === 0 ? 'armed' : oldStep === 1 ? 'offered' : oldStep === 2 ? 'ready' : 'released',
      elapsed: 0, lastTick: tick, attempts: 0 };
    delete state.started;
  }
  restoreHelBargain(tick: number): void {
    this.ensureHelBargain(tick);
  }
  private helBargainOccupied(): boolean {
    return ['merovingian', 'persephone', 'trainman'].some(id => Boolean(this.world.agents.get(id)?.controller));
  }
  private helBargainTick(actor: AgentState, tick: number): void {
    this.ensureHelBargain(tick);
    const state = this.state!; const bargain = state.helBargain!;
    if (this.helBargainOccupied()) { bargain.lastTick = tick; this.helBargainFrame(actor, tick); return; }
    const delta = Math.max(0, tick - bargain.lastTick) * .5;
    bargain.lastTick = tick;
    if (bargain.phase === 'windup' && (bargain.elapsed += delta) >= .7) {
      bargain.phase = 'evade'; bargain.elapsed = 0;
      state.lastText = '前排守卫向 Trinity 挥拳。现在按 X 闪避，再面朝高台反击。';
    } else if (['evade', 'counter', 'airborne'].includes(bargain.phase)) {
      bargain.elapsed += delta;
      if (bargain.elapsed >= (bargain.phase === 'evade' ? 3 : bargain.phase === 'counter' ? 2.4 : 2.8)) {
        bargain.phase = 'failed'; bargain.elapsed = 0; actor.currentAction = null;
        state.lastText = '包围圈重新合拢，枪落在舞池。J 打开手记，从突围前的检查点重试。';
      }
    }
    this.helBargainFrame(actor, tick);
  }
  helBargainFrame(actor: AgentState, tick: number): void {
    const state = this.state;
    if (state?.scene !== 'm3_hel_bargain' || !this.controls(actor) || !state.helBargain) return;
    const bargain = state.helBargain;
    if (bargain.phase === 'gunpoint') actor.currentAction = { type: 'idle',
      parameters: { player: true, resolved: true, armed: true, weaponStyle: 'hel_pistol' }, startedAt: tick, duration: 1, progress: 0 };
    else if (bargain.phase === 'armed') actor.currentAction = { type: 'idle',
      parameters: { player: true, resolved: true, armed: true, weaponStyle: 'hel_pistol' }, startedAt: tick, duration: 1, progress: 0 };
    else if (actor.currentAction?.parameters.weaponStyle === 'hel_pistol') actor.currentAction = null;
    for (const id of ['morpheus', 'seraph']) {
      const companion = this.world.agents.get(id);
      if (!companion || companion.controller || companion.currentLocation !== this.scene!.set) continue;
      if (bargain.phase === 'armed') companion.currentAction = { type: 'idle',
        parameters: { resolved: true, armed: true, weaponStyle: 'hel_pistol' }, startedAt: tick, duration: 1, progress: 0 };
      else if (companion.currentAction?.parameters.weaponStyle === 'hel_pistol') companion.currentAction = null;
    }
  }
  helBargainDodge(agent: AgentState, tick: number): string | undefined {
    const state = this.state;
    if (state?.scene !== 'm3_hel_bargain' || !this.controls(agent) || state.step !== 3) return undefined;
    this.ensureHelBargain(tick);
    const bargain = state.helBargain!;
    if (this.helBargainOccupied()) return '对峙中的角色由另一位玩家控制，动作窗口已暂停。';
    if (bargain.phase !== 'evade') return bargain.phase === 'failed' ? '包围圈已合拢。J 打开手记重试。' : '等守卫真正挥拳时再按 X。';
    if (!this.near(agent, this.step!)) return '回到舞池中央，才能避开贴身的守卫。';
    bargain.phase = 'counter'; bargain.elapsed = 0; bargain.lastTick = tick;
    agent.currentAction = { type: 'defend', parameters: { player: true, resolved: true }, startedAt: tick, duration: .7, progress: 0 };
    state.lastText = 'Trinity 侧身躲过挥拳。趁守卫失去平衡，面朝高台按 F 反击。';
    return state.lastText;
  }
  helBargainStrike(agent: AgentState, tick: number): string | undefined {
    const state = this.state;
    if (state?.scene !== 'm3_hel_bargain' || !this.controls(agent) || state.step !== 3) return undefined;
    this.ensureHelBargain(tick);
    const bargain = state.helBargain!;
    if (this.helBargainOccupied()) return '对峙中的角色由另一位玩家控制，动作窗口已暂停。';
    if (bargain.phase !== 'counter') return bargain.phase === 'failed' ? '突围失败。J 打开手记重试。' : '先等守卫出拳，用 X 闪避后再按 F。';
    if (!this.near(agent, this.step!)) return '守卫还在舞池中央，靠近后再反击。';
    const vip = filmPosition(this.scene!.set, 0, -35);
    const dx = vip.x - agent.position.x; const dz = vip.z - agent.position.z;
    if ((Math.sin(agent.rotation) * dx + Math.cos(agent.rotation) * dz) / Math.hypot(dx, dz) < .55) return '转身面朝 VIP 高台，再用 F 打开缺口。';
    bargain.phase = 'airborne'; bargain.elapsed = 0; bargain.lastTick = tick;
    agent.currentAction = { type: 'attack', parameters: { player: true, resolved: true, combo: 2 }, startedAt: tick, duration: .8, progress: 0 };
    const seraph = this.world.agents.get('seraph');
    if (seraph && !seraph.controller) seraph.currentAction = { type: 'attack', parameters: { resolved: true, combo: 2 }, startedAt: tick, duration: .8, progress: 0 };
    this.advance('Trinity 打开人墙；Seraph 踢起手枪。枪正在空中，快按 G 接住。', agent, tick);
    return state.lastText;
  }
  private helBargainAct(agent: AgentState, tick: number): string {
    const state = this.state!; const bargain = state.helBargain!; const step = this.step!;
    if (bargain.phase === 'failed') return '突围失败。J 打开手记，选择从当前检查点重试。';
    if (state.step === 3 && bargain.phase !== 'ready') return bargain.phase === 'windup' || bargain.phase === 'evade'
      ? '守卫正在出拳，按 X 闪避。' : '闪避之后面朝高台，按 F 反击。';
    if (!this.near(agent, step)) return '靠近舞池里的当前目标（4 米内）再按 G。';
    if (state.step === 0) {
      bargain.phase = 'disarmed'; this.advance('舞曲骤停。Trinity、Morpheus 与 Seraph 放下枪，武装人群没有立刻开火。', agent, tick);
    } else if (state.step === 1) {
      bargain.phase = 'offered'; this.advance('Merovingian 要先知的双眼，才肯让 Trainman 带回 Neo。', agent, tick);
    } else if (state.step === 3) {
      if (this.helBargainOccupied()) return '对峙中的角色由另一位玩家控制，突围暂时停在检查点。';
      bargain.phase = 'windup'; bargain.elapsed = 0; bargain.lastTick = tick;
      state.lastText = 'Trinity 拒绝交易，向前冲入人群。前排守卫开始起手；等拳锋逼近再闪避。';
    } else if (state.step === 4) {
      if (bargain.phase !== 'airborne') return '枪还没被踢起。';
      const flight = Math.min(1, bargain.elapsed / 2.8);
      const gun = filmPosition(this.scene!.set, 3.2 * (1 - flight), -27 - 4 * flight);
      if (Math.hypot(agent.position.x - gun.x, agent.position.z - gun.z) > 2.2) return '枪还没有飞到手边。盯住空中的轨迹，再按 G 接住。';
      bargain.phase = 'gunpoint'; bargain.elapsed = 0; bargain.lastTick = tick;
      this.advance('Trinity 在人群上方接住 Seraph 踢来的枪，转向高台。', agent, tick);
    } else if (state.step === 5) {
      if (bargain.phase !== 'gunpoint') return '先接住枪。';
      const vip = filmPosition(this.scene!.set, 0, -35);
      const dx = vip.x - agent.position.x; const dz = vip.z - agent.position.z;
      if ((Math.sin(agent.rotation) * dx + Math.cos(agent.rotation) * dz) / Math.hypot(dx, dz) < .7) return '面朝 Merovingian，再举枪提出要求。';
      if (this.helBargainOccupied()) return '对峙中的角色由另一位玩家控制，营救决定停在当前检查点。';
      bargain.phase = 'released';
      this.advance('Trinity 把枪抵住 Merovingian。Persephone 看出她不会退让；Merovingian 让 Trainman 带回 Neo。', agent, tick);
    }
    return state.lastText;
  }
  private mobilPassengers(progress: number, tick: number): void {
    const encounter = this.state!.mobil!;
    encounter.boarding = Math.max(encounter.boarding ?? 0, Math.min(1, progress));
    const boarding = encounter.boarding;
    for (const [id, x, z, offset] of [['rama_kandra', -12, -8, -1], ['kamala', -10, -8, 0], ['sati', -5, -8, 1]] as const) {
      const passenger = this.world.agents.get(id);
      if (!passenger || passenger.controller) continue;
      const approach = Math.min(1, boarding / .7); const entering = Math.max(0, (boarding - .7) / .3);
      const px = x + (6.5 - x) * approach + entering * 6;
      const pz = z + (-20 + offset * 2 - z) * approach;
      passenger.position = filmPosition(this.scene!.set, px, pz);
      if (px > 8) passenger.position.y -= 1.35;
      passenger.rotation = Math.PI / 2; passenger.velocity = { x: 0, y: 0, z: 0 };
      passenger.currentAction = { type: boarding > 0 && boarding < 1 ? 'move_to' : 'idle',
        parameters: { resolved: true, mobilBoarding: boarding }, startedAt: tick, duration: 1, progress: boarding };
    }
  }
  mobilFrame(agent: AgentState, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || state.visiting || state.scene !== 'm3_trainman' || !this.controls(agent)) return false;
    this.ensureMobil(tick);
    const encounter = state.mobil!;
    if (encounter.phase !== 'refusing') return false;
    if (['trainman', 'rama_kandra', 'kamala', 'sati'].some(id => this.world.agents.get(id)?.controller)) {
      state.lastText = '车门旁的角色由其他玩家控制，登车片段停在这里。'; return true;
    }
    const previous = encounter.elapsed;
    encounter.elapsed = Math.min(2.2, encounter.elapsed + Math.max(0, dt));
    this.mobilPassengers((encounter.boarding ?? 0) + Math.max(0, dt) / 2.2, tick);
    const center = FILM_SETS[this.scene!.set].center;
    const impact = Math.max(0, Math.min(1, (encounter.elapsed - .35) / 1.2));
    agent.position = { x: center.x + (encounter.approach?.x ?? 6) - impact * 4.2, y: center.y,
      z: center.z + (encounter.approach?.z ?? -20) + impact * 2.5 };
    agent.rotation = encounter.approach?.yaw ?? Math.PI / 2;
    agent.velocity = { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'defend', parameters: { player: true, resolved: true, mobilRefusal: encounter.elapsed }, startedAt: tick, duration: 1, progress: impact };
    const trainman = this.world.agents.get('trainman');
    if (trainman && !trainman.controller) trainman.currentAction = { type: 'attack', target: agent.id,
      parameters: { resolved: true, contactTick: tick + 1 }, startedAt: tick, duration: 1, progress: impact };
    if (previous < .35 && encounter.elapsed >= .35) this.onImpact?.({ source: 'trainman', target: agent.id,
      position: { ...agent.position }, direction: { x: -1, y: 0, z: .2 }, damage: 10, combo: 0, matrix: true, downed: false }, tick);
    if (encounter.elapsed >= 2.2) {
      agent.health = Math.max(1, agent.health - 10);
      this.advance('Trainman 挡住 Neo：这条线路由他定规矩。Sati 一家已经上车，车门在 Neo 面前关闭。', agent, tick);
      encounter.phase = 'departing'; encounter.elapsed = 0; encounter.lastTick = tick;
    }
    return true;
  }
  private mobilTick(actor: AgentState, tick: number): void {
    const state = this.state!; this.ensureMobil(tick);
    const encounter = state.mobil!;
    const elapsed = Math.max(0, tick - encounter.lastTick) * .5; encounter.lastTick = tick;
    if (encounter.phase === 'approaching' || encounter.phase === 'departing' || encounter.phase === 'stopped') encounter.elapsed += elapsed;
    if (encounter.phase === 'approaching' && encounter.elapsed >= 4.5) {
      encounter.phase = 'stopped'; encounter.elapsed = 0;
      state.lastText = '隧道灯逐盏亮起。只有一节车厢的列车停在站台前，Trainman 守在车门旁。';
    }
    if (encounter.phase === 'departing' && encounter.elapsed >= 3) {
      encounter.phase = 'gone'; encounter.elapsed = 0;
      state.lastText = '尾灯消失在隧道中。两端都没有楼梯；只剩下铁轨。';
    }
    if (encounter.phase === 'stopped' && state.scene === 'm3_trainman') this.mobilPassengers(encounter.elapsed / 5, tick);
    if (state.scene === 'm3_mobil_release') {
      const trainman = this.world.agents.get('trainman');
      if (trainman && !trainman.controller) {
        trainman.position = filmPosition(this.scene!.set, 13, encounter.phase === 'approaching' ? -80 + Math.min(1, encounter.elapsed / 4.5) * 60 : -20);
        trainman.position.y -= 1.35; trainman.rotation = -Math.PI / 2;
      }
      const trinity = this.world.agents.get('trinity');
      if (trinity && !trinity.controller) {
        const arrival = encounter.phase === 'stopped' ? Math.min(1, encounter.elapsed / 2) : 0;
        const x = 12 - arrival * 10;
        const z = encounter.phase === 'approaching' ? -80 + Math.min(1, encounter.elapsed / 4.5) * 60 : -20 + arrival * 2;
        trinity.position = filmPosition(this.scene!.set, x, z);
        if (x > 8) trinity.position.y -= 1.35;
        trinity.rotation = -Math.PI / 2; trinity.velocity = { x: 0, y: 0, z: 0 };
        trinity.currentAction = { type: arrival > 0 && arrival < 1 ? 'move_to' : 'idle',
          parameters: { resolved: true, mobilRelease: arrival }, startedAt: tick, duration: 1, progress: arrival };
      }
      return;
    }
    const trainman = this.world.agents.get('trainman');
    if (trainman && !trainman.controller && state.scene === 'm3_trainman') {
      const boarding = encounter.phase === 'stopped' || encounter.phase === 'refusing';
      trainman.position = filmPosition(this.scene!.set, boarding ? 7.4 : 12,
        boarding ? -20 : encounter.phase === 'departing' ? -20 - Math.min(3, encounter.elapsed) * 20 : -80);
      if (!boarding) trainman.position.y -= 1.35;
      trainman.rotation = -Math.PI / 2;
    }
    if (encounter.phase === 'departing' || encounter.phase === 'gone') {
      for (const [id, offset] of [['rama_kandra', -1], ['kamala', 0], ['sati', 1]] as const) {
        const passenger = this.world.agents.get(id);
        if (passenger && !passenger.controller) {
          passenger.position = filmPosition(this.scene!.set, 12.5, -20 + offset * 2 - Math.min(3, encounter.elapsed) * 18);
          if (encounter.phase === 'gone') passenger.position.z = FILM_SETS[this.scene!.set].center.z - 80;
          passenger.position.y -= 1.35;
          passenger.rotation = Math.PI / 2; passenger.velocity = { x: 0, y: 0, z: 0 };
        }
      }
    }
    if (state.scene !== 'm3_trainman' || encounter.phase !== 'gone') return;
    const center = FILM_SETS[this.scene!.set].center;
    if (state.step === 3 && actor.position.z < center.z - 46) {
      actor.position = filmPosition(this.scene!.set, 0, 42); actor.velocity = { x: 0, y: 0, z: 0 };
      encounter.loops = 1; this.sandbox().neoLife!.choices.mobil_loop = 'one_end';
      this.advance('隧道转过弯，Neo 却从另一侧走回同一个站台：MOBIL AVE。', actor, tick);
    } else if (state.step === 4 && actor.position.z > center.z + 46) {
      actor.position = filmPosition(this.scene!.set, 0, -42); actor.velocity = { x: 0, y: 0, z: 0 };
      encounter.loops = 2; this.sandbox().neoLife!.choices.mobil_loop = 'both_ends';
      this.advance('另一端也返回 Mobil Ave。空间被 Trainman 折成闭环，Neo 必须等外面的人来开门。', actor, tick);
    }
  }
  private ensureFinale(tick: number): void {
    const state = this.state; if (!state || state.visiting) return;
    if (state.scene === 'm2_ship_lost' && !state.shipLoss) state.shipLoss = {
      phase: state.step >= this.scene!.steps.length ? 'escaped' : state.step >= 3 ? 'evacuating' : 'briefing',
      remaining: RELOADED_FINALE.evacuationSeconds, lastTick: tick, attempts: 0,
    };
    if (state.scene === 'm2_stop_sentinels' && !state.tunnel) state.tunnel = {
      phase: state.step >= this.scene!.steps.length ? 'collapsed' : state.step >= 1 ? 'sensing' : 'running',
      remaining: RELOADED_FINALE.sentinelSeconds, focus: 0, lastTick: tick, attempts: 0,
    };
  }
  finaleFrame(agent: AgentState, focus: boolean, yaw: number, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || state.visiting || !this.controls(agent)) return false;
    this.ensureFinale(tick);
    if (state.scene === 'm2_ship_lost' && state.shipLoss?.phase === 'evacuating') {
      for (const [id, side, lag] of [['neo', -1, 5], ['trinity', 1, 8], ['link', 0, 11]] as const) {
        const crew = this.world.agents.get(id);
        if (!crew || crew.controller) continue;
        const target = filmPosition(this.scene!.set, side * 4, Math.max(-4, Math.min(31, agent.position.z - FILM_SETS[this.scene!.set].center.z - lag)));
        const before = { ...crew.position }; const blend = Math.min(1, dt * 3);
        crew.position.x += (target.x - crew.position.x) * blend; crew.position.z += (target.z - crew.position.z) * blend;
        crew.velocity = dt > 0 ? { x: (crew.position.x - before.x) / dt, y: 0, z: (crew.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
        crew.rotation = 0; crew.currentAction = { type: 'move_to', parameters: { resolved: true }, startedAt: tick, duration: 100000, progress: 0 };
      }
      return false;
    }
    if (state.scene !== 'm2_stop_sentinels' || !state.tunnel || state.tunnel.phase !== 'sensing' || state.step !== 1) return false;
    const encounter = state.tunnel;
    agent.rotation = yaw; agent.velocity = { x: 0, y: 0, z: 0 };
    if (['trinity', 'morpheus', 'link'].some(id => this.world.agents.get(id)?.controller)) {
      state.lastText = '同伴由另一位玩家控制；哨兵的追击停在当前检查点。'; return true;
    }
    const nearSignal = this.near(agent, this.step!); const facing = Math.cos(agent.rotation) > .45;
    if (nearSignal && focus && facing) encounter.focus = Math.min(RELOADED_FINALE.signalSeconds, encounter.focus + Math.max(0, Math.min(.1, dt)));
    else if (!focus) encounter.focus = Math.max(0, encounter.focus - Math.max(0, dt) * .25);
    if (encounter.focus >= RELOADED_FINALE.signalSeconds) {
      encounter.phase = 'collapsed'; agent.health = Math.max(1, Math.min(agent.health, 1));
      this.advance('三只哨兵逐一失去动力。Neo 在现实中触及机器信号，却耗尽体力倒下；Hammer 的探照灯照进隧道。', agent, tick);
      agent.currentAction = { type: 'idle', parameters: { resolved: true, finaleCollapse: true }, startedAt: tick, duration: 100000, progress: 0 };
      return true;
    }
    state.lastText = !nearSignal ? '跑到窄口，再回身面对追来的哨兵。' : !facing ? '哨兵在身后。转身朝向它们，再按住 G 感知连接。' : '面对哨兵，按住 G；信号不在矩阵里，Neo 的身体正承受代价。';
    return true;
  }
  private finaleTick(actor: AgentState | undefined, tick: number): void {
    const state = this.state!;
    if (state.scene === 'm2_ship_lost' && state.shipLoss?.phase === 'evacuating') {
      const loss = state.shipLoss; const elapsed = Math.max(0, tick - loss.lastTick) * .5; loss.lastTick = tick;
      if (!actor?.controller || ['neo', 'trinity', 'link'].some(id => this.world.agents.get(id)?.controller)) return;
      loss.remaining = Math.max(0, loss.remaining - elapsed);
      if (loss.remaining === 0) { loss.phase = 'failed'; state.lastText = '炸弹击中船体，货舱出口关闭。按 J 从弃船命令检查点重试。'; }
    }
    if (state.scene === 'm2_stop_sentinels' && state.tunnel?.phase === 'sensing') {
      const encounter = state.tunnel; const elapsed = Math.max(0, tick - encounter.lastTick) * .5; encounter.lastTick = tick;
      if (!actor?.controller || ['trinity', 'morpheus', 'link'].some(id => this.world.agents.get(id)?.controller)) return;
      encounter.remaining = Math.max(0, encounter.remaining - elapsed);
      if (encounter.remaining === 0) { encounter.phase = 'failed'; state.lastText = '哨兵逼到身前，Neo 失去接触信号的机会。按 J 从隧道窄口重试。'; }
    }
  }
  private grid(tick: number): GridOperation {
    const state = this.state!;
    if (!state.grid) {
      // Saves from before the linked operation existed retain their current scene and step.
      const current = FILM_SCENES.findIndex(scene => scene.id === state.scene);
      const reached = (id: string) => state.completed.includes(id) || current > FILM_SCENES.findIndex(scene => scene.id === id)
        || state.scene === id && state.step >= FILM_SCENE_BY_ID[id].steps.length;
      const backup = reached('m2_backup');
      state.grid = { primary: backup ? 'off' : reached('m2_power') ? 'armed' : 'online', emergency: backup ? 'off' : 'online',
        vigilant: reached('m2_vigilant') || state.scene === 'm2_vigilant' && state.step > 0 ? 'lost' : 'active',
        trinity: reached('m2_vigilant') ? 'connected' : 'waiting',
        phase: reached('m2_key_door') ? 'opened' : backup ? 'window' : 'preparing',
        remaining: GRID_WINDOW_SECONDS, lastTick: tick, reroute: 0, attempts: 0 };
    }
    return state.grid;
  }
  private gridTick(actor: AgentState | undefined, tick: number): void {
    const state = this.state!; const grid = this.grid(tick);
    const elapsed = Math.max(0, tick - grid.lastTick) * .5;
    grid.lastTick = tick;
    if (!actor?.controller || actor.status !== 'alive') return;
    if (grid.phase === 'emergency' && state.scene === 'm2_key_door') {
      if (this.world.agents.get('trinity')?.controller) {
        state.lastText = 'Trinity 正由另一位玩家控制；应急系统等待她完成接管。'; return;
      }
      grid.hackRemaining = Math.max(0, (grid.hackRemaining ?? GRID_HACK_SECONDS) - elapsed);
      if (grid.hackRemaining === 0) {
        grid.emergency = 'off'; grid.phase = 'window'; grid.remaining = GRID_WINDOW_SECONDS;
        state.lastText = 'Trinity 关闭应急改线，城市灯光再次熄灭。钥匙匠的 314 秒连接窗口开始；快抵达白门。';
      }
    } else if (grid.phase === 'window') {
      grid.remaining = Math.max(0, grid.remaining - elapsed);
      if (grid.remaining === 0) {
        grid.phase = 'expired'; delete state.started;
        state.lastText = '314 秒窗口关闭，白门重新受保护。赶到门前让 Link 联系 Niobe 与 Trinity 改线；这是游戏中的补救路线。';
      }
    } else if (grid.phase === 'rerouting') {
      if (['niobe', 'trinity'].some(id => this.world.agents.get(id)?.controller)) {
        state.lastText = 'Niobe 或 Trinity 正由另一位玩家控制；改线等待队伍重新配合。'; return;
      }
      grid.reroute = Math.min(GRID_REROUTE_SECONDS, grid.reroute + elapsed);
      if (grid.reroute >= GRID_REROUTE_SECONDS) {
        grid.phase = 'window'; grid.remaining = GRID_WINDOW_SECONDS; grid.attempts++;
        state.lastText = 'Link 确认 Niobe 重设主网时序、Trinity 重新接入应急系统。白门获得新的 314 秒窗口，快拿钥匙进入。';
      }
    }
  }
  private architect(tick: number): void {
    const state = this.state!;
    if (state.architect) return;
    // The original scene had only walk, reflection and a right-hand exit.
    // Re-enter the conversation so an old save sees both doors and their costs.
    if (state.step >= 3) state.step = FILM_SCENE_BY_ID.m2_architect.steps.length;
    else if (state.step > 0) { state.step = 1; delete state.started; }
    const oldReflection = state.reflections['m2_architect:1'];
    if (oldReflection) {
      state.reflections['m2_architect:4'] = oldReflection;
      delete state.reflections['m2_architect:1'];
      const choices = this.sandbox().neoLife!.choices;
      choices['m2_architect:4'] = oldReflection; delete choices['m2_architect:1'];
    }
    state.architect = { phase: state.step >= FILM_SCENE_BY_ID.m2_architect.steps.length ? 'done' : 'cycles',
      sourceReviewed: state.step >= FILM_SCENE_BY_ID.m2_architect.steps.length,
      trinityReviewed: state.step >= FILM_SCENE_BY_ID.m2_architect.steps.length,
      remaining: ARCHITECT_DOOR_SECONDS, lastTick: tick, attempts: 0,
      door: state.step >= FILM_SCENE_BY_ID.m2_architect.steps.length ? 'matrix' : undefined };
    if (state.architect.door) this.sandbox().neoLife!.choices.architect_door = 'matrix';
    const performer = this.world.agents.get('architect');
    if (performer && !performer.controller) {
      this.place(performer, FILM_SCENE_BY_ID.m2_architect, filmPosition('film_architect_room', 0, -14));
      performer.rotation = 0;
      performer.currentAction = { type: 'idle', parameters: { seated: true }, startedAt: state.enteredAt, duration: 100000, progress: 0 };
    }
    this.sealArchitectDoors();
  }
  private architectTick(actor: AgentState | undefined, tick: number): void {
    this.architect(tick);
    const state = this.state!; const encounter = state.architect!;
    const elapsed = Math.max(0, tick - encounter.lastTick) * .5;
    encounter.lastTick = tick;
    if (state.step !== FILM_SCENE_BY_ID.m2_architect.steps.length - 1 || encounter.phase !== 'decision' || !actor?.controller || actor.status !== 'alive') return;
    if (this.world.agents.get('trinity')?.controller) return;
    encounter.remaining = Math.max(0, encounter.remaining - elapsed);
    if (encounter.remaining === 0) {
      encounter.phase = 'failed'; delete state.started;
      state.lastText = 'Trinity 的信号在屏幕中消失。按 J 从抉择检查点重试；关于循环与两扇门的了解会保留。';
    }
  }
  private sealArchitectDoors(): void {
    const state = this.state; const prefix = 'film:architect:';
    this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith(prefix));
    if (state?.scene !== 'm2_architect' || state.visiting) return;
    for (const [side, x] of [['source', 8], ['matrix', -8]] as const) {
      if (side === 'matrix' && state.architect?.door === 'matrix') continue;
      this.sandbox().structures.push({ id: `${prefix}${side}`, kind: 'barricade', owner: 'matrix',
        position: filmPosition('film_architect_room', x, -28.2), matrix: true, health: 999,
        film: { scene: 'm2_architect', width: 5, depth: .5, height: 8 } });
    }
  }
  performing(agent: AgentState): boolean { return this.controls(agent) && (this.state!.scene === 'm1_room303' && ['breach', 'dive', 'ladder_ready'].includes(this.state!.openingHotel?.phase ?? '') || this.state!.scene === 'm1_phone_escape' && ['connected', 'done'].includes(this.state!.openingPhone?.phase ?? '') || helElevatorLocked(this.state!) || helDanceDoorLocked(this.state!) || this.state!.scene === 'm3_trainman' && this.state!.mobil?.phase === 'refusing' || this.state!.trucks?.phase === 'rescue' || this.state!.persephone?.phase === 'enacting' || burlyLocked(this.state!) || clubLocked(this.state!) || apartmentLocked(this.state!) || wakeCallLocked(this.state!) || workdayLocked(this.state!) || awakeningLocked(this.state!) || trainingLocked(this.state!) || sentinelLocked(this.state!) || interludeLocked(this.state!) || oracleActing(this.state!) || betrayalLocked(this.state!) || rescueLocked(this.state!) || governmentLocked(this.state!) || airRescueLocked(this.state!) || matrixEscapeLocked(this.state!) || theOneLocked(this.state!) || reloadedLocked(this.state!) || catchLocked(this.state!.catch) || lobbyLocked(this.state!) || phoneLocked(this.state!) || windowOpening(this.state!) || windowCrossing(this.state!) || pillLocked(this.state!) || interrogationLocked(this.state!) || meetingLocked(this.state!) || lafayetteKnocking(this.state!) || lafayetteWelcomeLocked(this.state!)); }
  clubFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (state?.scene !== 'm1_club' || state.visiting || !this.controls(agent)) return;
    if (!state.club) {
      const complete = state.completed.includes(state.scene);
      state.club = { phase: complete ? 'done' : state.step ? 'question' : 'crowd', elapsed: 0 };
      state.step = complete ? this.scene!.steps.length : state.step ? 2 : 0; delete state.started;
    }
    const club = state.club; const trinity = this.world.agents.get('trinity')!;
    if (trinity.controller) { state.lastText = 'Trinity 正由另一位玩家控制，夜店交谈停在当前进度。'; return; }
    if (club.phase === 'crowd' && state.step === 1 && dt > 0) { club.phase = 'approaching'; club.elapsed = 0; }
    const durations: Partial<Record<ClubPhase, number>> = { approaching: CLUB.approach, introduction: CLUB.introduction, whisper: CLUB.whisper, reply: CLUB.reply, departing: CLUB.departure };
    const duration = durations[club.phase];
    if (duration) club.elapsed = Math.min(duration, club.elapsed + Math.max(0, Math.min(.1, dt)));
    if (duration && club.elapsed >= duration) {
      const previous = club.phase;
      club.phase = ({ approaching: 'ready', introduction: 'listen', whisper: 'question', reply: 'departing', departing: 'done' } as Partial<Record<ClubPhase, ClubPhase>>)[previous]!;
      club.elapsed = 0;
      if (previous === 'whisper' || previous === 'reply') this.advance(clubText(club), agent, tick);
      if (previous === 'reply') { agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 }; }
    }
    for (const role of ['neo', 'trinity'] as const) {
      if (role === 'neo' && !clubLocked(state)) continue;
      const actor = this.world.agents.get(role)!; const before = { ...actor.position }; const pose = clubRoot(club, role);
      this.place(actor, this.scene!, filmPosition(this.scene!.set, pose.x, pose.z)); actor.rotation = pose.yaw;
      actor.velocity = dt ? { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { resolved: true, player: role === 'neo', club: { ...club, role } }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (clubLocked(state)) state.checkpoint = { ...agent.position };
    state.lastText = club.phase === 'reply' ? filmReflections('m1_club').find(choice => choice.id === club.answer)!.response : clubText(club);
  }
  private clubAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; this.clubFrame(agent, 0, tick); const club = state.club!;
    if (this.world.agents.get('trinity')!.controller) return state.lastText;
    if (!this.near(agent, this.step!)) return '走近拱墙旁的 Trinity，再继续这次交谈。';
    if (target === 'act' && club.phase === 'ready') {
      const center = FILM_SETS[this.scene!.set].center;
      club.approach = { x: agent.position.x - center.x, z: agent.position.z - center.z, yaw: agent.rotation };
      club.phase = 'introduction'; club.elapsed = 0;
    } else if (target === 'act' && club.phase === 'listen') { club.phase = 'whisper'; club.elapsed = 0; }
    else if (target.startsWith('reflect:') && club.phase === 'question') {
      const choice = filmReflections('m1_club').find(choice => choice.id === target.slice(8));
      if (!choice) return '请选择手记里的一个具体问题。';
      const life = this.sandbox().neoLife!; const key = `${state.scene}:${state.step}`;
      if (!state.reflections[key]) {
        state.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
        life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `${this.scene!.title} · ${choice.label}`, text: choice.response });
      }
      club.answer = choice.id; club.phase = 'reply'; club.elapsed = 0;
    }
    this.clubFrame(agent, 0, tick); return state.lastText;
  }
  apartmentFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (state?.scene === 'm1_wake_again' && !state.visiting) {
      this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== 'film:apartment:door');
      this.wakeCallFrame(agent, dt, tick); return;
    }
    if (state?.scene !== 'm1_wake_up' || state.visiting) {
      this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== 'film:apartment:door'); return;
    }
    if (!state || state.scene !== 'm1_wake_up' || state.visiting || !this.controls(agent)) return;
    if (!state.contact) {
      // Old saves had only computer and delivery objectives. Keep their completed history.
      if (state.completed.includes(state.scene)) state.step = this.scene!.steps.length;
      state.contact = { phase: state.completed.includes(state.scene) ? 'accepted' : state.step ? 'door' : 'idle', elapsed: 0 };
      delete state.started;
    }
    const contact = state.contact;
    const guests = [this.world.agents.get('choi')!, this.world.agents.get('dujour')!];
    if (guests.some(actor => actor.controller) && apartmentAfter(contact, 'door') && contact.phase !== 'accepted') {
      state.lastText = '门外的人物正由另一位玩家控制，来访停在当前进度。'; return;
    }
    const timed: Partial<Record<ApartmentPhase, number>> = { signal: APARTMENT.signal, knocking: APARTMENT.knocking,
      opening: APARTMENT.opening, retrieving: APARTMENT.retrieving, handover: APARTMENT.handover, invitation: 2, inspecting: 3 };
    const duration = timed[contact.phase];
    if (duration) contact.elapsed = Math.min(duration, contact.elapsed + Math.max(0, Math.min(.1, dt)));
    if (duration && contact.elapsed >= duration && contact.phase !== 'invitation') {
      const next: Partial<Record<ApartmentPhase, ApartmentPhase>> = { signal: 'reply', knocking: 'door', opening: 'book', retrieving: 'disk', handover: 'invitation', inspecting: 'noticed' };
      const previous = contact.phase; contact.phase = next[previous]!; contact.elapsed = 0; agent.currentAction = null;
      if (previous === 'handover' && !contact.paid) { this.sandbox().neoLife!.money += 2000; contact.paid = true; }
      if (previous !== 'signal') this.advance(apartmentText(contact), agent, tick);
    }
    for (const actor of guests) {
      if (actor.controller) continue;
      const pose = actor.id === 'choi' ? APARTMENT.choi : APARTMENT.dujour;
      this.place(actor, this.scene!, filmPosition(this.scene!.set, pose.x, pose.z)); actor.rotation = pose.yaw;
      if (actor.id === 'dujour' && apartmentAfter(contact, 'invitation')) actor.rotation = pose.yaw + (.35 - pose.yaw) * (contact.phase === 'invitation' ? Math.min(1, contact.elapsed / 2) : 1);
      actor.currentAction = { type: 'idle', parameters: { resolved: true, contact: { ...contact, role: actor.id } }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (apartmentLocked(state)) {
      const pose = ['signal', 'reply', 'knocking'].includes(contact.phase) ? APARTMENT.computer : contact.phase === 'retrieving' ? { x: 6, z: 3.95, yaw: 0 } : contact.phase === 'opening' ? { x: 1.4, z: 10.6, yaw: 0 } : APARTMENT.door;
      agent.position = filmPosition(this.scene!.set, pose.x, pose.z); agent.rotation = pose.yaw; agent.velocity = { x: 0, y: 0, z: 0 };
      agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, contact: { ...contact, role: 'neo' } }, startedAt: tick, duration: 1, progress: 0 };
      state.checkpoint = { ...agent.position };
    }
    const seal = 'film:apartment:door';
    if (apartmentDoor(contact) >= .8) this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== seal);
    else if (!this.sandbox().structures.some(s => s.id === seal)) this.sandbox().structures.push({ id: seal, kind: 'barricade', owner: 'matrix', position: filmPosition(this.scene!.set, 0, APARTMENT.doorZ), matrix: true, health: 1,
      film: { scene: state.scene, width: APARTMENT.doorWidth, depth: .28, height: 6.5 } });
    state.lastText = apartmentText(contact);
  }
  private wakeCallFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (!state || state.scene !== 'm1_wake_again' || state.visiting || !this.controls(agent)) return;
    const call = state.wakeCall ??= { phase: state.step ? 'done' : 'ringing', elapsed: 0, nightmare: state.office?.outcome !== 'escaped' };
    const duration = call.phase === 'waking' ? WAKE_CALL.waking : call.phase === 'pickup' ? WAKE_CALL.pickup
      : call.phase === 'listening' ? WAKE_CALL.listening : call.phase === 'reply' ? WAKE_CALL.reply : 0;
    if (duration) call.elapsed = Math.min(duration, call.elapsed + Math.max(0, Math.min(.1, dt)));
    if (duration && call.elapsed >= duration) {
      const previous = call.phase;
      const next: Partial<Record<WakeCallPhase, WakeCallPhase>> = { waking: 'ringing', pickup: 'listening', listening: 'decision', reply: 'done' };
      call.phase = next[previous]!; call.elapsed = 0;
      if (previous === 'waking') {
        agent.position = filmPosition(this.scene!.set, APARTMENT.bedside.x, APARTMENT.bedside.z); agent.rotation = APARTMENT.bedside.yaw;
        agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null; state.checkpoint = { ...agent.position };
      }
      if (previous === 'reply') {
        agent.currentAction = null; this.advance('Morpheus 约你到 Adams Street 桥下。接应车辆会在那里找到你。', agent, tick);
      }
    }
    if (wakeCallLocked(state)) {
      const before = { ...agent.position }; const root = wakeCallRoot(call);
      agent.position = filmPosition(this.scene!.set, root.x, root.z); agent.rotation = root.yaw;
      agent.velocity = dt > 0 ? { x: (agent.position.x - before.x) / dt, y: 0, z: (agent.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, wakeCall: { ...call } }, startedAt: tick, duration: 1, progress: 0 };
      state.checkpoint = { ...agent.position };
    } else if (call.phase === 'ringing' || call.phase === 'done') agent.currentAction = null;
    state.lastText = wakeCallText(call);
  }
  private wakeCallAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; this.wakeCallFrame(agent, 0, tick); const call = state.wakeCall!;
    if (target !== 'act') return state.lastText;
    if (call.phase === 'ringing') {
      if (!this.near(agent, this.step!)) return '先走到工作台旁正在响的座机前。';
      call.phase = 'pickup'; call.elapsed = 0;
    } else if (call.phase === 'decision') { call.phase = 'reply'; call.elapsed = 0; }
    this.wakeCallFrame(agent, 0, tick); return state.lastText;
  }
  private apartmentAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; this.apartmentFrame(agent, 0, tick); const contact = state.contact!;
    if (!this.near(agent, this.step!)) return '走近当前目标，再与眼前的物品或来客互动。';
    if (apartmentAfter(contact, 'door') && ['choi', 'dujour'].some(id => this.world.agents.get(id)!.controller)) return state.lastText;
    if (target === 'contact:wait' && contact.phase === 'noticed') {
      const life = this.sandbox().neoLife!; state.checkpoint = { ...agent.position };
      life.deferredContact = state; life.contactSignal = true; life.choices.white_rabbit = 'wait';
      this.releaseCast(); delete life.journey;
      agent.currentLocation = 'neo_apartment'; agent.position = lifeRoomCenter('neo_apartment')!; agent.rotation = Math.PI;
      agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: '先过完今天', text: '白兔线索和交易已记下。你暂时没有接受邀请；回到家后仍可继续这条联系。' });
      return '你暂时回到日常生活。线索、交易与门口的决定已保存。';
    }
    if (target === 'contact:follow' && contact.phase === 'noticed') {
      contact.phase = 'accepted'; contact.elapsed = 0; this.sandbox().neoLife!.choices.white_rabbit = 'follow';
      this.sandbox().neoLife!.philosophy.agency++; this.advance(apartmentText(contact), agent, tick); return state.lastText;
    }
    if (target !== 'act') return state.lastText;
    const next: Partial<Record<ApartmentPhase, ApartmentPhase>> = { idle: 'signal', reply: 'knocking', door: 'opening', book: 'retrieving', disk: 'handover', invitation: 'inspecting' };
    const phase = next[contact.phase];
    if (phase) {
      contact.phase = phase; contact.elapsed = 0;
      if (phase === 'inspecting') {
        const life = this.sandbox().neoLife!; if (!life.evidence.includes('white_rabbit')) life.evidence.push('white_rabbit');
      }
      this.apartmentFrame(agent, 0, tick);
    }
    return state.lastText;
  }
  workdayFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (!state || state.scene !== 'm1_boss' || state.visiting || !this.controls(agent)) return;
    const workday = state.workday ??= { phase: state.step === 0 ? 'waiting' : 'delivered', elapsed: 0 };
    const manager = this.world.agents.get('rhineheart')!; const courier = this.world.agents.get('courier')!;
    const busy = ['waiting', 'briefing', 'answer'].includes(workday.phase) ? manager.controller : courier.controller;
    if (busy) { state.lastText = '当前人物正由另一位玩家控制；交谈和快递停在原处，等待对方结束。'; return; }
    if (workday.phase === 'released' && this.near(agent, this.step!) && dt > 0) { workday.phase = 'delivery'; workday.elapsed = 0; }
    const duration = workday.phase === 'briefing' ? OFFICE_WORKDAY.briefing : workday.phase === 'signing' ? OFFICE_WORKDAY.signing
      : ['delivery', 'delivered'].includes(workday.phase) ? OFFICE_DELIVERY_SECONDS : 0;
    if (duration) workday.elapsed = Math.min(duration, workday.elapsed + Math.min(.1, dt));
    if (workday.phase === 'briefing' && workday.elapsed >= duration) { workday.phase = 'answer'; workday.elapsed = 0; }
    if (workday.phase === 'delivery' && workday.elapsed >= duration) { workday.phase = 'signature'; workday.elapsed = 0; }
    if (workday.phase === 'signing' && workday.elapsed >= duration) { workday.phase = 'delivered'; workday.elapsed = 0; agent.currentAction = null; }
    for (const actor of [manager, courier]) {
      if (actor.controller) continue;
      const root = actor === manager ? OFFICE_WORKDAY.manager : officeCourierRoot(workday);
      const previous = actor.position; actor.position = filmPosition('film_metacortex_floor', root.x, root.z); actor.rotation = root.yaw;
      actor.velocity = dt > 0 ? { x: (actor.position.x - previous.x) / dt, y: 0, z: (actor.position.z - previous.z) / dt } : { x: 0, y: 0, z: 0 };
      actor.currentLocation = 'film_metacortex_floor'; actor.isInMatrix = true;
      actor.currentAction = { type: 'idle', parameters: { resolved: true, seated: actor === manager,
        workday: { ...workday, role: actor.id } }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (workdayLocked(state)) {
      const root = workday.phase === 'signing' ? officeRecipientRoot(workday) : OFFICE_WORKDAY.neo;
      agent.position = filmPosition('film_metacortex_floor', root.x, root.z); agent.rotation = root.yaw; agent.velocity = { x: 0, y: 0, z: 0 };
      agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, workday: { ...workday, role: 'neo' } }, startedAt: tick, duration: 1, progress: 0 };
      state.checkpoint = { ...agent.position };
    }
    if (!state.phone) state.lastText = workdayText(workday);
  }
  private workdayAct(agent: AgentState, tick: number): string {
    const state = this.state!; this.workdayFrame(agent, 0, tick); const workday = state.workday!;
    if (!this.near(agent, this.step!)) return state.step === 0 ? '走进玻璃主管办公室，到桌前再交谈。' : '回到自己的隔间后才能签收这份快递。';
    const actor = this.world.agents.get(state.step === 0 ? 'rhineheart' : 'courier')!;
    if (actor.controller) return state.lastText;
    if (workday.phase === 'waiting') { workday.phase = 'briefing'; workday.elapsed = 0; }
    else if (workday.phase === 'answer') {
      workday.phase = 'released'; workday.elapsed = 0; agent.currentAction = null;
      this.advance('你向 Rhineheart 表示明白，转身回自己的隔间。', agent, tick);
    } else if (workday.phase === 'released') { workday.phase = 'delivery'; workday.elapsed = 0; }
    else if (workday.phase === 'signature') { workday.phase = 'signing'; workday.elapsed = 0; }
    this.workdayFrame(agent, 0, tick); return state.lastText;
  }
  hotelFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state; const hotel = state?.hotel;
    if (!state || !hotel || state.visiting || !this.controls(agent) || !['m1_pills', 'm1_mirror'].includes(state.scene)) return;
    const guide = this.world.agents.get('trinity')!;
    if (guide.controller) { state.lastText = 'Trinity 暂时无法带路，楼梯和当前进度已保留。'; return; }
    const center = FILM_SETS.film_lafayette.center;
    const local = { x: agent.position.x - center.x, y: agent.position.y - center.y + LAFAYETTE.upper, z: agent.position.z - center.z };
    if (hotel.door !== undefined) hotel.door = Math.min(LAFAYETTE.doorSeconds, hotel.door + dt);
    if (hotel.knock !== undefined && hotel.door === undefined) {
      hotel.knock = Math.min(LAFAYETTE_KNOCK_SECONDS, hotel.knock + dt);
      const root = lafayetteKnockRoot(hotel); agent.position = filmPosition('film_lafayette', root.x, root.z); agent.rotation = root.yaw;
      agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentLocation = 'film_lafayette'; agent.isInMatrix = true;
      agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, knock: hotel.knock }, startedAt: tick, duration: 1, progress: 0 };
      state.checkpoint = { ...agent.position };
      state.lastText = hotel.knock < .7 ? 'Neo 走近 1313 的木门，抬起右手。' : hotel.knock < 1.55 ? '三下敲门声穿过安静的十三层走廊。' : '门内传来脚步。Trinity 向后退开。';
      const guidePose = hotelRoutePose(hotel.progress); guide.position = filmPosition('film_lafayette', guidePose.x, guidePose.z); guide.rotation = -Math.PI / 2;
      guide.velocity = { x: 0, y: 0, z: 0 }; guide.currentAction = { type: 'idle', parameters: { resolved: true, hotelGuide: true }, startedAt: tick, duration: 1, progress: 0 };
      if (hotel.knock < LAFAYETTE_KNOCK_SECONDS) { this.sealHotelDoor(); return; }
      delete hotel.knock; delete hotel.knockFrom; hotel.door = 0; agent.currentAction = null;
    }
    if (hotel.door === LAFAYETTE.doorSeconds && local.y > 83 && local.x < 19.5 && Math.abs(local.z) < 4) {
      hotel.entered = true;
      hotel.welcome ??= { phase: 'approach', elapsed: 0 };
    }
    if (hotel.welcome) {
      if (hotel.welcome.phase !== 'done') this.welcomeFrame(agent, dt, tick);
      else this.sealHotelDoor();
      return;
    }
    const allowed = hotel.entered ? HOTEL_ROUTE_LENGTH : Math.min(HOTEL_DOOR_PROGRESS, hotelRouteProgress(local) + 7);
    const before = hotelRoutePose(hotel.progress);
    hotel.progress = Math.min(Math.max(hotel.progress, allowed), hotel.progress + dt * (allowed - hotel.progress > 12 ? 6.2 : 3.4));
    const pose = hotelRoutePose(hotel.progress);
    guide.position = { x: center.x + pose.x, y: center.y - LAFAYETTE.upper + pose.y, z: center.z + pose.z };
    guide.rotation = hotel.progress >= HOTEL_DOOR_PROGRESS && !hotel.entered ? -Math.PI / 2 : pose.yaw;
    guide.currentLocation = filmSetAt(guide.position, true)?.id ?? 'film_lafayette'; guide.isInMatrix = true;
    guide.velocity = dt > 0 ? { x: (pose.x - before.x) / dt, y: (pose.y - before.y) / dt, z: (pose.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
    guide.currentAction = { type: hotel.progress > 0 && hotel.progress < allowed ? 'move_to' : 'idle', parameters: { resolved: true, hotelGuide: true }, startedAt: tick, duration: 1, progress: 0 };
    this.sealHotelDoor();
    if (!hotel.entered) {
      state.checkpoint = { ...agent.position };
      state.lastText = hotel.door !== undefined ? hotel.door < LAFAYETTE.doorSeconds ? 'TRINITY · 门开了。进去吧，Morpheus 在等你。' : '走过打开的 1313 房门，去见 Morpheus。'
        : hotel.progress >= HOTEL_DOOR_PROGRESS - .01 ? 'TRINITY · 就是这里。进去后，把你真正的疑问告诉他。按 G 敲门。'
        : Math.abs(local.y - 84) < 1 ? '十三层。跟随 Trinity 沿走廊来到 1313 房间。'
        : `TRINITY · 跟我来。我们去十三层。当前 ${Math.min(13, Math.floor(local.y / 7) + 1)} 层；你停下来时，我会等你。`;
    }
  }
  private welcomeFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state; const welcome = state?.hotel?.welcome;
    if (!state || !welcome || state.visiting || !this.controls(agent)) return;
    const morpheus = this.world.agents.get('morpheus')!; const trinity = this.world.agents.get('trinity')!;
    if (morpheus.controller || trinity.controller) {
      state.lastText = '迎接演出已停在当前动作：Morpheus 或 Trinity 正由另一位玩家控制。'; return;
    }
    const duration = welcome.phase === 'approach' ? LAFAYETTE_WELCOME.approach
      : welcome.phase === 'handshake' ? LAFAYETTE_WELCOME.handshake
      : welcome.phase === 'departing' ? LAFAYETTE_WELCOME.departing : undefined;
    if (duration !== undefined) welcome.elapsed = Math.min(duration, welcome.elapsed + Math.min(.1, dt));
    if (duration !== undefined && welcome.elapsed >= duration) {
      if (welcome.phase === 'approach') { welcome.phase = 'ready'; welcome.elapsed = 0; }
      else if (welcome.phase === 'handshake') { welcome.phase = 'departing'; welcome.elapsed = 0; }
      else { welcome.phase = 'done'; welcome.elapsed = LAFAYETTE_WELCOME.departing; }
    }
    for (const role of ['neo', 'morpheus', 'trinity'] as const) {
      const actor = role === 'neo' ? agent : this.world.agents.get(role)!;
      const before = { ...actor.position }; const root = lafayetteWelcomeRoot(welcome, role);
      actor.position = filmPosition('film_lafayette', root.x, root.z); actor.rotation = root.yaw;
      actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      actor.currentLocation = 'film_lafayette'; actor.isInMatrix = true;
      actor.currentAction = { type: 'idle', parameters: { player: role === 'neo', resolved: true,
        seated: role === 'morpheus' && welcome.phase === 'done', welcome: { phase: welcome.phase, elapsed: welcome.elapsed, role } }, startedAt: tick, duration: 1, progress: 0 };
    }
    state.checkpoint = { ...agent.position };
    state.lastText = welcome.phase === 'approach' ? welcome.elapsed < 1.35 ? '雷声掠过窗外。窗前的人影转过身，离开垂着薄纱的高窗。'
      : welcome.elapsed < 3.7 ? 'MORPHEUS · 终于见面了，Neo。Morpheus 向你走来，Trinity 退到一旁。'
      : 'NEO · 能见到你是我的荣幸。MORPHEUS · 荣幸属于我。'
      : welcome.phase === 'ready' ? 'Morpheus 在你面前伸出右手。按 G 握住他的手。'
      : welcome.phase === 'handshake' ? welcome.elapsed < 1.15 ? '你伸出右手。两人的手掌在房间中央握紧。' : 'MORPHEUS · 请坐。我们需要谈谈你一直在寻找的问题。'
      : welcome.phase === 'departing' ? welcome.elapsed < 1.5 ? 'Morpheus 向 Trinity 点头。她转身推开通往相邻房间的门。'
        : 'Trinity 穿过相邻房门。Morpheus 走向两把开裂的酒红色皮椅。'
      : 'Morpheus 已在对面的皮椅落座。走到空椅前，按 G 开始交谈。';
    if (welcome.phase === 'done') {
      agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
      trinity.currentAction = null; trinity.velocity = { x: 0, y: 0, z: 0 };
    }
    this.sealHotelDoor();
  }
  private sealHotelDoor(): void {
    const hotel = this.state?.hotel; const id = 'film:lafayette:door';
    if (!hotel || hotel.door !== undefined && hotel.door >= LAFAYETTE.doorSeconds * .75) {
      this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== id); return;
    }
    if (!this.sandbox().structures.some(s => s.id === id)) this.sandbox().structures.push({ id, kind: 'barricade', owner: 'matrix', position: filmPosition('film_lafayette', LAFAYETTE.door.x, LAFAYETTE.door.z), matrix: true, health: 1,
      film: { scene: 'm1_pills', width: LAFAYETTE.door.width, depth: LAFAYETTE.door.depth, height: LAFAYETTE.door.height } });
  }
  restoreHotelSpace(): void {
    if (this.state?.hotel) { this.sealHotelDoor(); return; }
    const center = FILM_SETS.film_lafayette.center;
    const migrate = (position?: AgentState['position']) => {
      if (position && Math.abs(position.x - center.x) < 24 && Math.abs(position.z - center.z) < 28 && position.y < 40) position.y += LAFAYETTE.upper;
    };
    for (const actor of this.world.agents.values()) if (actor.currentLocation === 'film_lafayette') migrate(actor.position);
    if (this.scene?.set === 'film_lafayette') migrate(this.state?.checkpoint);
    migrate(this.state?.returnPosition);
  }
  restoreAwakeningSpace(): void {
    const state = this.state; const scene = this.scene;
    if (!state || !scene || state.visiting) return;
    if (state.scene === 'm1_mirror' && state.step >= scene.steps.length) {
      this.finishMirror(this.world.agents.get(state.actor)!, this.world.simulationTick);
      return;
    }
    if (state.scene === 'm1_mirror' && state.step === 0 && !state.awakening) {
      const actor = this.world.agents.get(state.actor);
      const oldTouch = filmPosition(scene.set, MIRROR_SEAT.x, MIRROR_SEAT.z);
      if (actor?.currentLocation === scene.set && distance(actor.position, oldTouch) < 1.35) {
        actor.position = filmStepPosition(scene, scene.steps[0]);
        state.checkpoint = { ...actor.position };
      }
    }
    if (state.awakening) return;
    const kind = state.scene === 'm1_recovery' && state.step === 0 ? 'recovery'
      : state.scene === 'm1_construct' && state.step === 0 ? 'construct'
      : state.scene === 'm1_desert' && state.step === 1 ? 'desert' : undefined;
    if (!kind) return;
    state.awakening = { kind, elapsed: 0, started: false };
    const actor = this.world.agents.get(state.actor);
    if (!actor) return;
    actor.currentLocation = scene.set; actor.isInMatrix = FILM_SETS[scene.set].world === 'matrix';
    this.stageCast();
    this.awakeningFrame(actor, 0, this.world.simulationTick);
  }
  restoreTrainingSpace(): void {
    const state = this.state; const scene = this.scene;
    if (!state || !scene || state.visiting) return;
    if (!state.training) {
      const kind = state.scene === 'm1_download' && state.step === 0 ? 'download'
        : state.scene === 'm1_jump' && state.step === 1 ? 'jump'
        : state.scene === 'm1_red_dress' && state.step === 1 ? 'red_dress' : undefined;
      if (kind) state.training = { kind, elapsed: 0, started: false };
    }
    if (state.scene === 'm1_dojo' && state.step === 0) state.dojo ??= { dodged: false, combo: 0, hits: 0 };
    const actor = this.world.agents.get(state.actor);
    if (actor && state.training && trainingLocked(state)) this.trainingFrame(actor, 0, this.world.simulationTick);
  }
  meetingFrame(agent: AgentState, focus: boolean, dt: number, tick: number): void {
    const state = this.state;
    if (!state || !this.controls(agent) || !meetingLocked(state) || MEETING_CAST.some(id => this.world.agents.get(id)?.controller)) return;
    const encounter = state.meeting ??= { phase: state.step > 0 ? 'done' : 'ready', elapsed: 0, bugged: state.office?.bugged ?? state.office?.outcome !== 'escaped',
      approach: { ...MEETING_CAR.approach, yaw: -Math.PI / 2 } };
    if (encounter.phase === 'located' && focus) { encounter.phase = 'removing'; encounter.elapsed = 0; }
    const duration = MEETING_TIMING[encounter.phase as keyof typeof MEETING_TIMING];
    if (duration && (encounter.phase !== 'removing' || focus)) encounter.elapsed = Math.min(duration, encounter.elapsed + Math.min(.1, dt));
    let finish = false;
    if (duration && encounter.elapsed >= duration) {
      if (encounter.phase === 'boarding') { encounter.phase = 'choice'; encounter.elapsed = 0; }
      else if (encounter.phase === 'scanning') { encounter.phase = encounter.bugged ? 'located' : 'done'; encounter.elapsed = 0; finish = !encounter.bugged; }
      else if (encounter.phase === 'removing') {
        if (state.office) state.office.bugged = false;
        encounter.phase = 'discarding'; encounter.elapsed = 0;
      } else if (encounter.phase === 'discarding') { encounter.phase = 'done'; encounter.elapsed = 0; finish = true; }
      else if (encounter.phase === 'driving') { encounter.phase = 'parked'; encounter.elapsed = 0; }
    }
    for (const role of ['neo', ...MEETING_CAST] as const) {
      const actor = this.world.agents.get(role)!; const pose = meetingRoot(encounter, role);
      actor.position = filmPosition(this.scene!.set, pose.x, pose.z); actor.rotation = pose.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentLocation = this.scene!.set; actor.isInMatrix = true;
      actor.currentAction = { type: 'idle', parameters: { player: role === 'neo', resolved: true, meeting: { phase: encounter.phase, elapsed: encounter.elapsed, bugged: encounter.bugged, role } }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (encounter.phase === 'leaving' && encounter.elapsed >= MEETING_TIMING.leaving) {
      delete state.meeting; agent.currentAction = null;
      state.lastText = '你回到了桥下。今晚还没有结束，可以走开，也可以再次上车。'; return;
    }
    if (encounter.phase === 'exiting' && encounter.elapsed >= MEETING_TIMING.exiting) {
      encounter.phase = 'outside'; encounter.elapsed = 0; agent.currentAction = null;
      state.checkpoint = { ...agent.position };
      state.lastText = '车停在旧楼的后巷。走到入口按 G，前往楼上的会面房间。'; return;
    }
    if (encounter.phase !== 'done') state.lastText = encounter.phase === 'boarding' ? '车门向后展开。你俯身跨过门槛，在 Trinity 身旁坐下。'
      : encounter.phase === 'choice' ? 'SWITCH · 先接受检查。TRINITY · 你知道外面那条路会通向哪里。留下接受检查，或者现在下车；决定还在你手里。'
      : encounter.phase === 'leaving' ? '你打开车门，退回雨中的桥下。Trinity 没有拉住你。'
      : encounter.phase === 'ready' ? 'Trinity 在身旁准备装置。按 G 开始检查。'
      : encounter.phase === 'driving' ? encounter.elapsed < 8 ? 'APOC · 检查结束。坐稳，我们去见 Morpheus。'
        : encounter.elapsed < 39 ? 'TRINITY · 他会回答你的问题。先想清楚：你愿意知道多少？雨中的街灯从车窗旁退去。'
        : 'APOC · 前面就是 Lafayette。车辆减速，驶向旧楼后巷。'
      : encounter.phase === 'parked' ? '已经抵达 Lafayette。车完全停稳了，按 G 打开右后门下车。'
      : encounter.phase === 'exiting' ? '你打开车门，俯身走出后座，站到旧楼旁。'
      : encounter.phase === 'scanning' ? encounter.elapsed < 3 ? '你向后靠，露出腹部。Trinity 把扫描装置移到身体上方。' : '探头贴在腹部。微弱的脉冲出现在监视器上。'
      : encounter.phase === 'located' ? '扫描发现了移动的异物。按住 G 保持身体稳定，让 Trinity 抽出追踪器。'
      : encounter.phase === 'removing' ? focus ? '保持稳定。Trinity 拉动泵杆，透明收集筒里的压力正在改变。' : '你暂时停止配合。装置停在原处；继续按住 G 才会抽取。'
      : '追踪器已经离开身体。Trinity 把收集装置移到窗边，将它弹入雨中。';
    if (finish) this.advance(encounter.bugged ? this.step!.text! : '扫描完成，没有发现追踪装置。Trinity 收起仪器，确认接头安全。', agent, tick);
  }
  interrogationFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (!state || !this.controls(agent) || !interrogationLocked(state)) return;
    if (INTERROGATION_CAST.some(id => this.world.agents.get(id)?.controller)) return;
    const encounter = state.interrogation!;
    if (encounter.phase === 'file' || encounter.phase === 'coercion') encounter.elapsed = Math.min(INTERROGATION_TIMING[encounter.phase], encounter.elapsed + Math.min(.1, dt));
    for (const role of ['neo', ...INTERROGATION_CAST] as const) {
      const actor = this.world.agents.get(role)!; const pose = interrogationRoot(encounter, role);
      actor.position = filmPosition(this.scene!.set, pose.x, pose.z); actor.rotation = pose.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentLocation = this.scene!.set; actor.isInMatrix = true;
      actor.currentAction = { type: 'idle', parameters: { player: role === 'neo', resolved: true, interrogation: { phase: encounter.phase, elapsed: encounter.elapsed, role } }, startedAt: tick, duration: 1, progress: 0 };
    }
    const t = encounter.elapsed;
    state.lastText = encounter.phase === 'file' ? t < 2 ? '椅脚擦过地面。Smith 在桌子的另一侧打开文件夹。' : 'SMITH · 公司职员和名叫 Neo 的黑客。档案把你的两种生活摆在一起。'
      : encounter.phase === 'response' ? 'SMITH · 帮我们找到 Morpheus，这些记录就可以被清除。你还没有答应。按 G 拒绝合作，要求通话。'
      : encounter.phase === 'done' ? '房间消失了。追踪器仍在身体里。按 G 从公寓中醒来。'
      : t < 2.4 ? 'NEO · 我不会替你们找他。我要求打电话。'
      : t < 5.3 ? '嘴唇开始粘连。你想继续说话，却发不出声音。'
      : t < 9.8 ? '你摸向嘴边，退到墙旁。两名特工绕过桌子，封住去路。'
      : t < 13.8 ? '特工抓住双臂，把你按在金属桌上。身体已经不再完全听从你。'
      : t < 17.6 ? 'Smith 从盒子里拿出细长的装置。透明外壳开始弯曲，像活物一样伸展。'
      : t < 21.5 ? '装置落在腹部，弯曲的足肢抓住皮肤，向内钻入。'
      : '追踪器已经消失在皮肤下面。顶灯变得模糊，房间逐渐远去。';
    if (encounter.phase === 'coercion' && t >= INTERROGATION_TIMING.implanted) {
      state.office ??= { alert: 100, suspicion: [], waypoints: [], lastTick: tick, guide: '', outcome: 'captured' };
      state.office.bugged = true;
    }
    if (encounter.phase === 'file' && t >= INTERROGATION_TIMING.file) {
      encounter.phase = 'response'; encounter.elapsed = 0; this.advance(this.step!.text!, agent, tick); this.interrogationFrame(agent, 0, tick);
    } else if (encounter.phase === 'coercion' && t >= INTERROGATION_TIMING.coercion) {
      encounter.phase = 'done'; this.advance(this.step!.text!, agent, tick); this.interrogationFrame(agent, 0, tick);
    }
  }
  pillFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (!state || !this.controls(agent) || !pillLocked(state)) return;
    const pills = state.pills!; const life = this.sandbox().neoLife!;
    if (pills.phase !== 'choice') pills.elapsed = Math.min(pills.phase === 'offering' ? PILL_TIMING.offer : PILL_TIMING.take, pills.elapsed + Math.min(.1, dt));
    const root = pillRoot(pills);
    agent.position = filmPosition(this.scene!.set, root.x, root.z); agent.rotation = root.yaw; agent.velocity = { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, pills: { phase: pills.phase, elapsed: pills.elapsed, choice: pills.choice, role: 'neo' } }, startedAt: tick, duration: 1, progress: 0 };
    const morpheus = this.world.agents.get('morpheus')!;
    morpheus.position = filmPosition(this.scene!.set, -PILL_ROOM.seat, PILL_ROOM.z); morpheus.rotation = Math.PI / 2; morpheus.velocity = { x: 0, y: 0, z: 0 };
    morpheus.currentAction = { type: 'idle', parameters: { seated: true, pills: { phase: pills.phase, elapsed: pills.elapsed, choice: pills.choice, role: 'morpheus' } }, startedAt: tick, duration: 1, progress: 0 };
    state.lastText = pills.phase === 'offering' ? pills.elapsed < 2 ? '你在对面的皮椅上坐下。Morpheus 等你安静下来。' : 'MORPHEUS · 我能让你看见另一面，但是否继续，只能由你决定。'
      : pills.phase === 'choice' ? '两只手掌停在面前。红色，继续追问；蓝色，回到日常。你可以慢慢决定。'
      : pills.elapsed < 2.15 ? `你伸手拿取${pills.choice === 'red' ? '红色' : '蓝色'}药丸。`
      : pills.elapsed < 4.1 ? '你把药丸送入口中。Morpheus 收回双手，注视着你。'
      : pills.elapsed < 8.6 ? '拿起桌上的水杯，用一口水吞下药丸。'
      : '杯子放回桌上。你离开皮椅，这个决定已经发生。';
    if (pills.phase === 'offering' && pills.elapsed >= PILL_TIMING.offer) {
      pills.phase = 'choice'; pills.elapsed = 0;
      this.advance(this.step!.text!, agent, tick); this.pillFrame(agent, 0, tick);
    } else if (pills.phase === 'taking' && pills.elapsed >= PILL_TIMING.take) {
      pills.phase = 'done'; agent.currentAction = null;
      morpheus.currentAction.parameters.pills = { phase: 'done', elapsed: pills.elapsed, choice: pills.choice, role: 'morpheus' };
      life.choices.pill = pills.choice!;
      if (pills.choice === 'blue') { this.releaseCast(); delete life.journey; this.returnToLife(tick); }
      else {
        life.philosophy.agency++;
        this.advance('红色药丸已经吞下。Morpheus 示意接线组开始定位，裂镜就在房间另一侧。', agent, tick);
        this.command(agent, 'next', tick);
        const mirror = filmPosition('film_lafayette', PILL_ROOM.mirror.x, PILL_ROOM.mirror.z);
        agent.rotation = Math.atan2(mirror.x - agent.position.x, mirror.z - agent.position.z);
      }
    }
  }
  crossingFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (!state || !this.controls(agent) || !windowCrossing(state)) return;
    const office = state.office!;
    office.crossing = Math.min(OFFICE_CROSSING_SECONDS, office.crossing! + Math.min(.1, dt));
    const pose = officeCrossingPose(office.crossing);
    agent.position = filmPosition('film_metacortex_floor', pose.x, pose.z); agent.position.y += pose.y;
    agent.rotation = pose.yaw; agent.velocity = { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, crossing: office.crossing, phone: heldPhone(state) }, startedAt: tick, duration: 1, progress: 0 };
    state.lastText = office.crossing < 1.7 ? '左手撑住窗台。慢慢抬起左腿，手机仍贴在耳边。' : office.crossing < 3.5 ? '身体穿过窗口，先把左脚探向外沿。' : office.crossing < 5.4 ? '右腿越过窗沿。脚下踩稳后，再松开扶着窗台的手。' : '两脚已经落在窄台上。沿幕墙前往远端的维修架。';
    if (office.crossing >= OFFICE_CROSSING_SECONDS) {
      const position = { ...agent.position }; delete office.crossing;
      const next = FILM_SCENE_BY_ID.m1_ledge;
      state.scene = next.id; state.step = 0;
      this.enter(next, tick, position); agent.rotation = pose.yaw;
    }
  }
  restoreOfficeSpace(): void {
    const center = FILM_SETS.film_metacortex_floor.center; const ledge = FILM_SETS.film_office_ledge.center;
    const migrate = (position: AgentState['position'] | undefined): boolean => {
      if (!position || Math.abs(position.x - center.x - 320) > 44 || Math.abs(position.z - center.z) > 66) return false;
      position.x += ledge.x - center.x - 320; position.z = center.z * 2 - position.z; return true;
    };
    for (const agent of this.world.agents.values()) if (agent.currentLocation === 'film_office_ledge' && migrate(agent.position)) {
      agent.rotation = Math.PI - agent.rotation; agent.velocity = { x: 0, y: 0, z: 0 }; agent.targetPosition = null; agent.currentPath = [];
    }
    migrate(this.state?.checkpoint); migrate(this.state?.returnPosition);
    for (const item of [...this.sandbox().structures, ...this.sandbox().nodes, ...this.sandbox().threats]) migrate(item.position);
  }
  windowFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (!state || !this.controls(agent) || !windowOpening(state)) return;
    const office = state.office!;
    office.window = Math.min(OFFICE_WINDOW.seconds, office.window! + Math.min(.1, dt));
    agent.position = filmPosition(this.scene!.set, OFFICE_WINDOW.approachX, OFFICE_WINDOW.approachZ); agent.rotation = -Math.PI / 2;
    agent.velocity = { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, window: office.window, phone: heldPhone(state) }, startedAt: tick, duration: 1, progress: 0 };
    state.lastText = office.window < .7 ? '左手扶住窗上的把手，手机仍在耳边。' : office.window < 1.2 ? '转动把手，窗锁松开。' : '窗扇向外推开。风声涌入，街道远在脚下。';
    if (office.window >= OFFICE_WINDOW.seconds) this.advance(this.step!.text!, agent, tick);
  }
  phoneFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (!state || !this.controls(agent) || !phoneLocked(state)) return;
    const phone = state.phone!;
    if (phone.phase !== 'ready') phone.elapsed = Math.min(phone.phase === 'pickup' ? OFFICE_CONTACT.pickupSeconds : OFFICE_CONTACT.answerSeconds, phone.elapsed + Math.min(.1, dt));
    agent.position = filmPosition(this.scene!.set, OFFICE_CONTACT.x, OFFICE_CONTACT.z); agent.rotation = Math.PI;
    agent.velocity = { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, phone: { ...phone } }, startedAt: tick, duration: 1, progress: 0 };
    if (phone.phase === 'pickup' && phone.elapsed >= OFFICE_CONTACT.pickupSeconds) { phone.phase = 'ready'; phone.elapsed = 0; }
    state.lastText = phone.phase === 'ready' ? '号码没有显示。手机仍在响，按 G 打开滑盖接听。'
      : phone.phase === 'pickup' ? '写着 Thomas Anderson 的快递里，装着一部正在响铃的手机。'
      : phone.elapsed < 2 ? '滑盖弹开，电话接通。'
      : phone.elapsed < 5 ? 'MORPHEUS · 我知道你一直在找我。现在先听清楚，有人正在找你。'
      : phone.elapsed < 8 ? 'MORPHEUS · 看一眼通道，特工已经到达这一层。留在原地会被带走。'
      : 'MORPHEUS · 保持通话。低下身体，借隔间挡住视线，换到对面的空隔间。';
    if (phone.phase === 'answering' && phone.elapsed >= OFFICE_CONTACT.answerSeconds) {
      phone.phase = 'connected'; this.advance(state.lastText, agent, tick);
    }
  }
  ambushFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (!state || !this.controls(agent) || state.visiting || state.scene !== 'm1_dejavu' || state.step !== 0 || !state.ambush || !this.near(agent, this.step!)) return;
    state.ambush.elapsed = Math.min(AMBUSH_SECONDS, state.ambush.elapsed + Math.min(.1, dt));
    const time = state.ambush.elapsed;
    state.lastText = time < 4 ? '一只黑猫从门前经过，伸展身体，继续向右。' : time < 8.3 ? '同一只猫，又做了同样的动作。Trinity 突然停住：系统正在改变这里。' : '外面的光线消失了。门与窗被砖墙封死，原来的出口已经不在了。';
    this.sealAmbush();
    if (time >= AMBUSH_SECONDS) this.advance(this.step!.text!, agent, tick);
  }
  private ensureBetrayal(kind: BetrayalEncounter['kind']): BetrayalEncounter {
    const state = this.state!;
    if (state.betrayal?.kind !== kind) {
      const done = state.completed.includes(state.scene) || state.step >= this.scene!.steps.length;
      const clearedBathroom = kind === 'bathroom' && state.step > 0;
      state.betrayal = { kind, phase: done ? 'done' : clearedBathroom ? 'sacrifice_ready' : 'ready', elapsed: 0, attempt: 0,
        repels: clearedBathroom || done && kind === 'bathroom' ? BETRAYAL.bathroom.requiredRepels : 0, rescued: done && kind === 'unplugged' ? 2 : 0 };
    }
    return state.betrayal;
  }
  private betrayalOccupied(encounter: BetrayalEncounter): AgentState | undefined {
    const roles = encounter.kind === 'bathroom' ? ['smith', ...BATHROOM_ROLES] : UNPLUGGED_ROLES.filter(role => role !== 'tank');
    return roles.map(id => this.world.agents.get(id)).find(actor => actor?.controller);
  }
  private stageBetrayalActor(role: BetrayalRole, encounter: BetrayalEncounter, dt: number, tick: number): void {
    const actor = this.world.agents.get(role); if (!actor || actor.controller && actor.id !== this.state!.actor) return;
    if (encounter.kind === 'bathroom' && encounter.phase === 'defending' && role === 'smith') return;
    const root = betrayalRoot(encounter, role); const before = { ...actor.position };
    actor.position = filmPosition(this.scene!.set, root.x, root.z); actor.rotation = root.yaw;
    actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
    actor.currentLocation = this.scene!.set; actor.isInMatrix = FILM_SETS[this.scene!.set].world === 'matrix';
    const connected = encounter.kind === 'unplugged' && ['neo', 'trinity', 'apoc', 'switch'].includes(role);
    const armed = encounter.kind === 'unplugged' && (role === 'cypher' && !['countering', 'reconnect', 'done'].includes(encounter.phase)
      || role === 'tank' && encounter.phase === 'countering');
    actor.currentAction = { type: 'idle', parameters: { player: role === this.state!.actor, resolved: true, seated: connected,
      floorSeated: role === 'dozer' || role === 'tank' && ['unplugging', 'aiming', 'window'].includes(encounter.phase), armed,
      betrayal: { ...encounter, role } }, startedAt: tick, duration: 1, progress: 0 };
  }
  private clearBetrayalActions(): void {
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.betrayal) {
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
    }
  }
  betrayalFrame(agent: AgentState, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || !this.controls(agent) || state.visiting || !['m1_bathroom', 'm1_unplugged'].includes(state.scene)) return false;
    const encounter = this.ensureBetrayal(state.scene === 'm1_bathroom' ? 'bathroom' : 'unplugged');
    if (encounter.phase === 'done') {
      this.clearBetrayalActions(); state.lastText = betrayalText(encounter); return false;
    }
    const occupied = this.betrayalOccupied(encounter);
    if (occupied && encounter.phase !== 'ready' && encounter.phase !== 'failed') {
      state.lastText = `${occupied.name} 正由另一位玩家控制，当前动作停在保存的位置。`;
      return betrayalLocked(state);
    }
    const delta = Math.max(0, Math.min(.1, dt));
    if (encounter.kind === 'bathroom') {
      if (encounter.phase === 'defending') {
        encounter.elapsed = Math.min(BETRAYAL.bathroom.hold, encounter.elapsed + delta);
        for (const role of BATHROOM_ROLES) this.stageBetrayalActor(role, encounter, dt, tick);
        if (encounter.elapsed >= BETRAYAL.bathroom.hold && (encounter.repels ?? 0) >= BETRAYAL.bathroom.requiredRepels) {
          this.clearThreats(); encounter.phase = 'sacrifice_ready'; encounter.elapsed = 0;
          this.advance('撤离通道已经争取到。Morpheus 仍要亲自把 Smith 从入口带开。', agent, tick);
          const smith = this.world.agents.get('smith'); if (smith && !smith.controller) this.stageBetrayalActor('smith', encounter, 0, tick);
        }
      } else if (encounter.phase === 'sacrifice') {
        encounter.elapsed = Math.min(BETRAYAL.bathroom.sacrifice, encounter.elapsed + delta);
        for (const role of ['morpheus', 'smith', ...BATHROOM_ROLES] as BetrayalRole[]) this.stageBetrayalActor(role, encounter, dt, tick);
        state.checkpoint = { ...agent.position };
        if (encounter.elapsed >= BETRAYAL.bathroom.sacrifice) {
          encounter.phase = 'done'; this.sandbox().neoLife!.choices.morpheus_captured = 'sacrifice';
          this.clearBetrayalActions(); this.advance(this.step!.text!, agent, tick);
        }
      } else {
        for (const role of BATHROOM_ROLES) this.stageBetrayalActor(role, encounter, 0, tick);
        if (encounter.phase === 'sacrifice_ready') this.stageBetrayalActor('smith', encounter, 0, tick);
      }
      state.lastText = betrayalText(encounter); return betrayalLocked(state);
    }

    const timed = ['unplugging', 'aiming', 'window', 'countering'].includes(encounter.phase);
    if (timed) encounter.elapsed = Math.min(betrayalDuration(encounter), encounter.elapsed + delta);
    if (encounter.phase === 'unplugging' && encounter.elapsed >= BETRAYAL.unplugged.unplugging) { encounter.phase = 'aiming'; encounter.elapsed = 0; }
    else if (encounter.phase === 'aiming' && encounter.elapsed >= BETRAYAL.unplugged.aiming) { encounter.phase = 'window'; encounter.elapsed = 0; }
    else if (encounter.phase === 'window' && encounter.elapsed >= BETRAYAL.unplugged.window) {
      encounter.phase = 'failed'; encounter.elapsed = BETRAYAL.unplugged.window; agent.health = 0; agent.status = 'dead'; agent.currentAction = null;
    } else if (encounter.phase === 'countering' && encounter.elapsed >= BETRAYAL.unplugged.countering) { encounter.phase = 'reconnect'; encounter.elapsed = 0; }
    for (const role of UNPLUGGED_ROLES) if (role !== 'tank' || encounter.phase !== 'ready') this.stageBetrayalActor(role, encounter, dt, tick);
    if (encounter.phase === 'failed') agent.currentAction = null;
    else if (betrayalLocked(state)) state.checkpoint = { ...agent.position };
    state.lastText = betrayalText(encounter); return betrayalLocked(state);
  }
  bathroomHit(agent: AgentState, threat: SandboxThreat): boolean {
    const state = this.state; const encounter = state?.betrayal;
    if (!state || state.scene !== 'm1_bathroom' || encounter?.kind !== 'bathroom' || encounter.phase !== 'defending'
      || threat.scene !== state.scene || threat.character !== 'smith' || agent.id !== 'morpheus') return false;
    encounter.repels = Math.min(BETRAYAL.bathroom.requiredRepels, (encounter.repels ?? 0) + 1);
    state.lastText = betrayalText(encounter); return true;
  }
  private betrayalAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const encounter = this.ensureBetrayal(state.scene === 'm1_bathroom' ? 'bathroom' : 'unplugged');
    this.betrayalFrame(agent, 0, tick);
    if (target !== 'act') return state.lastText;
    const occupied = this.betrayalOccupied(encounter);
    if (occupied) return `${occupied.name} 正由另一位玩家控制，等待对方结束后再继续。`;
    if (encounter.kind === 'bathroom') {
      if (!this.near(agent, this.step!)) return '先走到浴室门线前，再按 G 挡住 Smith。';
      if (encounter.phase === 'ready') {
        encounter.phase = 'defending'; encounter.elapsed = 0; encounter.repels = 0; state.checkpoint = { ...agent.position };
        this.clearThreats(); this.spawn(agent, this.step!, tick); state.fighting = true;
      } else if (encounter.phase === 'sacrifice_ready') { encounter.phase = 'sacrifice'; encounter.elapsed = 0; this.clearThreats(); }
      this.betrayalFrame(agent, 0, tick); return state.lastText;
    }
    if (!this.near(agent, this.step!)) return '先回到备用控制台旁，再处理飞船上的背叛。';
    if (encounter.phase === 'ready') { encounter.phase = 'unplugging'; encounter.elapsed = 0; encounter.rescued = 0; state.checkpoint = { ...agent.position }; }
    else if (encounter.phase === 'window') { encounter.phase = 'countering'; encounter.elapsed = 0; }
    else if (encounter.phase === 'reconnect') {
      encounter.rescued = Math.min(2, (encounter.rescued ?? 0) + 1);
      if (encounter.rescued >= 2) {
        encounter.phase = 'done'; this.sandbox().neoLife!.choices.cypher_stopped = 'tank';
        this.clearBetrayalActions(); this.advance(this.step!.text!, agent, tick); return state.lastText;
      }
    }
    this.betrayalFrame(agent, 0, tick); return state.lastText;
  }
  private ensureRescue(): RescuePreparation {
    const state = this.state!;
    if (!state.rescue) {
      if (state.scene === 'm1_rescue_decision') {
        const done = state.completed.includes(state.scene) || state.step >= this.scene!.steps.length;
        state.rescue = { phase: done ? 'briefing_done' : 'briefing_ready', elapsed: 0 };
      } else {
        const done = state.completed.includes('m1_guns') || state.scene !== 'm1_guns' || state.step > 0;
        state.rescue = { phase: done ? 'equipped' : 'racks_ready', elapsed: 0, loadout: done ? 'rifle' : undefined };
      }
    }
    return state.rescue;
  }
  private rescueOccupied(preparation: RescuePreparation): AgentState | undefined {
    const roles = ['briefing_ready', 'briefing', 'briefing_done'].includes(preparation.phase) ? ['trinity', 'tank'] : ['trinity'];
    return roles.map(id => this.world.agents.get(id)).find(actor => actor?.controller);
  }
  private stageRescueActor(role: RescueRole, preparation: RescuePreparation, dt: number, tick: number): void {
    const actor = this.world.agents.get(role); if (!actor || actor.controller && actor.id !== this.state!.actor) return;
    const root = rescueRoot(preparation, role); const before = { ...actor.position };
    actor.position = filmPosition(this.scene!.set, root.x, root.z); actor.rotation = root.yaw;
    actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
    actor.currentLocation = this.scene!.set; actor.isInMatrix = FILM_SETS[this.scene!.set].world === 'matrix';
    const armed = preparation.phase === 'equipping' && Boolean(preparation.loadout) && role !== 'tank';
    actor.currentAction = { type: 'idle', parameters: { player: role === this.state!.actor, resolved: true, armed,
      weaponStyle: preparation.loadout, rescue: { ...preparation, role } }, startedAt: tick, duration: 1, progress: 0 };
  }
  private clearRescueActions(): void {
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.rescue) {
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
    }
  }
  rescueFrame(agent: AgentState, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || !this.controls(agent) || state.visiting || !['m1_rescue_decision', 'm1_guns'].includes(state.scene)) return false;
    const preparation = this.ensureRescue(); const locked = rescueLocked(state);
    if (preparation.phase === 'briefing' || preparation.phase === 'racks_arriving' || preparation.phase === 'equipping') {
      const occupied = this.rescueOccupied(preparation);
      if (occupied) { state.lastText = `${occupied.name} 正由另一位玩家控制，营救准备停在保存的位置。`; return locked; }
      preparation.elapsed = Math.min(rescueDuration(preparation), preparation.elapsed + Math.max(0, Math.min(.1, dt)));
      const roles: RescueRole[] = preparation.phase === 'briefing' ? ['neo', 'trinity', 'tank'] : ['neo', 'trinity'];
      for (const role of roles) this.stageRescueActor(role, preparation, dt, tick);
      state.checkpoint = { ...agent.position };
      if (preparation.elapsed >= rescueDuration(preparation)) {
        if (preparation.phase === 'briefing') {
          preparation.phase = 'briefing_done'; preparation.elapsed = 0; this.clearRescueActions();
          this.advance(this.step!.text!, agent, tick);
        } else if (preparation.phase === 'racks_arriving') {
          preparation.phase = 'selecting'; preparation.elapsed = 0; this.clearRescueActions();
        } else {
          preparation.phase = 'equipped'; preparation.elapsed = 0; this.clearRescueActions();
          this.sandbox().neoLife!.choices.rescue_loadout = preparation.loadout ?? 'rifle';
          this.advance(this.step!.text!, agent, tick);
        }
      }
    } else this.clearRescueActions();
    state.lastText = rescueText(preparation); return rescueLocked(state);
  }
  private rescueAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const preparation = this.ensureRescue();
    if (target !== 'act') return state.lastText;
    const occupied = this.rescueOccupied(preparation);
    if (occupied) return `${occupied.name} 正由另一位玩家控制，等待对方结束后再继续。`;
    if (state.scene === 'm1_rescue_decision') {
      if (state.step !== 1 || preparation.phase !== 'briefing_ready') return state.lastText;
      if (!this.near(agent, this.step!)) return '先走到核心投影旁，再按 G 核对营救方案。';
      preparation.phase = 'briefing'; preparation.elapsed = 0; state.checkpoint = { ...agent.position };
      this.rescueFrame(agent, 0, tick); return state.lastText;
    }
    if (preparation.phase === 'racks_ready') {
      if (!this.near(agent, this.step!)) return '先走到构造体的装载标记旁，再按 G 载入武器架。';
      preparation.phase = 'racks_arriving'; preparation.elapsed = 0; state.checkpoint = { ...agent.position };
      this.rescueFrame(agent, 0, tick); return state.lastText;
    }
    if (preparation.phase === 'selecting') {
      const options = Object.entries(RESCUE.loadoutRoots) as [RescueLoadout, { x: number; z: number; yaw: number }][];
      const nearest = options.map(([loadout, root]) => ({ loadout, distance: distance(agent.position, filmPosition(this.scene!.set, root.x, root.z)) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > 4) return '走近左、中、右其中一套武器，进入 4 米内再按 G。';
      preparation.loadout = nearest.loadout; preparation.phase = 'equipping'; preparation.elapsed = 0; state.checkpoint = { ...agent.position };
      this.rescueFrame(agent, 0, tick); return state.lastText;
    }
    return state.lastText;
  }
  private ensureGovernment(): GovernmentRescueEncounter {
    const state = this.state!;
    if (!state.government) {
      const kind = state.scene === 'm1_smith_question' ? 'questioning' : 'rooftop';
      const done = state.completed.includes(state.scene) || state.step >= this.scene!.steps.length;
      state.government = kind === 'questioning'
        ? { kind, phase: done ? 'done' : state.step ? 'alarm_ready' : 'ready', elapsed: 0, attempt: 0, resolve: 1 }
        : { kind, phase: done ? 'done' : state.step ? 'download_ready' : 'ready', elapsed: 0, attempt: 0, dodges: 0, wounds: 0, resolved: [] };
    }
    return state.government;
  }
  private governmentOccupied(encounter: GovernmentRescueEncounter): AgentState | undefined {
    const ids = encounter.kind === 'questioning' ? ['smith', 'agent_brown', 'agent_jones'] : ['trinity', 'agent_jones', 'citizen_11'];
    return ids.map(id => this.world.agents.get(id)).find(actor => actor?.controller);
  }
  private stageGovernmentActor(role: GovernmentRescueRole, encounter: GovernmentRescueEncounter, dt: number, tick: number): void {
    const id = role === 'pilot' ? 'citizen_11' : role; const actor = this.world.agents.get(id);
    if (!actor || actor.controller && actor.id !== this.state!.actor) return;
    const root = governmentRoot(encounter, role); const before = { ...actor.position };
    actor.position = filmPosition(this.scene!.set, root.x, root.z); actor.rotation = root.yaw;
    actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
    actor.currentLocation = this.scene!.set; actor.isInMatrix = true;
    const armed = encounter.kind === 'rooftop' && (role === 'neo' && ['opening', 'bullet_time'].includes(encounter.phase)
      || role === 'agent_jones' && encounter.phase === 'bullet_time' || role === 'trinity' && encounter.phase === 'trinity');
    actor.currentAction = { type: 'idle', parameters: { player: actor.id === this.state!.actor, resolved: true,
      seated: encounter.kind === 'questioning' && role === 'morpheus', armed,
      government: { ...encounter, resolved: encounter.resolved ? [...encounter.resolved] : undefined, role } }, startedAt: tick, duration: 1, progress: 0 };
  }
  private clearGovernmentActions(): void {
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.government) {
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
    }
  }
  private governmentFailure(agent: AgentState, encounter: GovernmentRescueEncounter): void {
    encounter.phase = 'failed'; agent.health = 0; agent.status = 'dead'; agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
    agent.activeEffects = agent.activeEffects.filter(effect => effect.visualEffect !== 'slow_motion');
    this.clearGovernmentActions(); this.state!.lastText = governmentText(encounter);
  }
  private governmentShot(encounter: GovernmentRescueEncounter, source: 'neo' | 'trinity' | 'agent_jones', target: 'neo' | 'agent_jones' | undefined, damage: number, tick: number, offset = 0): void {
    const fromRoot = governmentRoot(encounter, source); const toRoot = governmentRoot(encounter, target ?? 'neo');
    const from = filmPosition(this.scene!.set, fromRoot.x, fromRoot.z); from.y += 2.25;
    const position = filmPosition(this.scene!.set, toRoot.x + (target ? 0 : offset), toRoot.z - (target ? 0 : 1.5)); position.y += target ? 1.8 : .15;
    const length = Math.max(.001, distance(from, position)); const direction = { x: (position.x - from.x) / length, y: (position.y - from.y) / length, z: (position.z - from.z) / length };
    this.onImpact?.({ source, target: target ?? 'government-roof', position, direction, damage, combo: 0, matrix: true,
      downed: source === 'trinity' && target === 'agent_jones', shot: { from, surface: target ? 'body' : 'stone' } }, tick);
  }
  governmentFrame(agent: AgentState, focus: boolean, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || !this.controls(agent) || state.visiting || !['m1_smith_question', 'm1_bullet_dodge'].includes(state.scene)) return false;
    const encounter = this.ensureGovernment();
    if (encounter.phase === 'done') {
      const roles: GovernmentRescueRole[] = encounter.kind === 'questioning'
        ? ['morpheus', 'smith', 'agent_brown', 'agent_jones'] : ['neo', 'trinity'];
      for (const role of roles) this.stageGovernmentActor(role, encounter, 0, tick);
      state.checkpoint = { ...agent.position }; state.lastText = governmentText(encounter); return true;
    }
    if (encounter.phase === 'failed' || encounter.phase === 'alarm_ready' || encounter.phase === 'download_ready') {
      this.clearGovernmentActions(); state.lastText = governmentText(encounter); return false;
    }
    const occupied = this.governmentOccupied(encounter);
    if (occupied) {
      state.lastText = `${occupied.name} 正由另一位玩家控制，当前片段停在保存的位置。`;
      return governmentLocked(state);
    }
    const delta = Math.max(0, Math.min(.1, dt));
    if (encounter.kind === 'questioning') {
      if (encounter.phase === 'monologue') {
        encounter.elapsed = Math.min(GOVERNMENT_RESCUE.questioning.monologue, encounter.elapsed + delta);
        encounter.resolve = Math.max(0, Math.min(1, (encounter.resolve ?? 1) + delta * (focus ? .12 : -1 / GOVERNMENT_RESCUE.questioning.failure)));
        if ((encounter.resolve ?? 0) <= 0) { this.governmentFailure(agent, encounter); return false; }
        if (encounter.elapsed >= GOVERNMENT_RESCUE.questioning.monologue) {
          encounter.phase = 'alarm_ready'; encounter.elapsed = 0; this.clearGovernmentActions();
          this.advance('Morpheus 没有交出锡安接入密码。远处的枪声打断了 Smith 的逼问。', agent, tick);
          state.lastText = governmentText(encounter); return false;
        }
      } else if (encounter.phase === 'alarm') {
        encounter.elapsed = Math.min(GOVERNMENT_RESCUE.questioning.alarm, encounter.elapsed + delta);
        if (encounter.elapsed >= GOVERNMENT_RESCUE.questioning.alarm) {
          encounter.phase = 'done'; this.clearGovernmentActions();
          this.advance(this.step!.text ?? '特工中断审讯，转向楼内的营救者。', agent, tick);
          this.governmentFrame(agent, false, 0, tick); return false;
        }
      }
      for (const role of ['morpheus', 'smith', 'agent_brown', 'agent_jones'] as GovernmentRescueRole[]) this.stageGovernmentActor(role, encounter, dt, tick);
      state.checkpoint = { ...agent.position }; state.lastText = governmentText(encounter); return governmentLocked(state);
    }

    if (encounter.phase === 'opening') {
      encounter.elapsed = Math.min(GOVERNMENT_RESCUE.rooftop.opening, encounter.elapsed + delta);
      if (encounter.elapsed >= GOVERNMENT_RESCUE.rooftop.opening) {
        encounter.phase = 'bullet_time'; encounter.elapsed = 0; encounter.resolved = []; encounter.dodges = 0; encounter.wounds = 0;
        agent.activeEffects = agent.activeEffects.filter(effect => effect.visualEffect !== 'slow_motion');
        agent.activeEffects.push({ abilityId: 'film:bullet-dodge', visualEffect: 'slow_motion', remainingTicks: 1,
          remainingSeconds: GOVERNMENT_RESCUE.rooftop.finish + 1 });
      }
    } else if (encounter.phase === 'bullet_time') {
      encounter.elapsed = Math.min(GOVERNMENT_RESCUE.rooftop.finish, encounter.elapsed + delta);
      encounter.resolved ??= [];
      for (const [index, beat] of GOVERNMENT_RESCUE.rooftop.beats.entries()) {
        if (encounter.resolved.includes(index) || encounter.elapsed <= beat + GOVERNMENT_RESCUE.rooftop.window) continue;
        encounter.resolved.push(index); encounter.wounds = (encounter.wounds ?? 0) + 1; agent.health = Math.max(1, agent.health - 28);
        this.governmentShot(encounter, 'agent_jones', 'neo', 28, tick);
        if ((encounter.wounds ?? 0) >= 2) { this.governmentFailure(agent, encounter); return false; }
      }
      if (encounter.elapsed >= GOVERNMENT_RESCUE.rooftop.finish) {
        if ((encounter.dodges ?? 0) < 2) { this.governmentFailure(agent, encounter); return false; }
        encounter.phase = 'trinity'; encounter.elapsed = 0;
        agent.activeEffects = agent.activeEffects.filter(effect => effect.visualEffect !== 'slow_motion');
      }
    } else if (encounter.phase === 'trinity') {
      encounter.elapsed = Math.min(GOVERNMENT_RESCUE.rooftop.trinity, encounter.elapsed + delta);
      if (!encounter.trinityShot && encounter.elapsed >= 1.35) { encounter.trinityShot = true; this.governmentShot(encounter, 'trinity', 'agent_jones', 100, tick); }
      if (encounter.elapsed >= GOVERNMENT_RESCUE.rooftop.trinity) {
        encounter.phase = 'download_ready'; encounter.elapsed = 0; this.clearGovernmentActions();
        this.advance('Trinity 在 Jones 身后近距离开火。特工代码退出飞行员身体，她随后把 Neo 拉起来。', agent, tick);
        state.lastText = governmentText(encounter); return false;
      }
    } else if (encounter.phase === 'downloading') {
      encounter.elapsed = Math.min(GOVERNMENT_RESCUE.rooftop.download, encounter.elapsed + delta);
      if (encounter.elapsed >= GOVERNMENT_RESCUE.rooftop.download) {
        encounter.phase = 'done'; this.clearGovernmentActions();
        this.advance(this.step!.text ?? 'Trinity 完成 B-212 驾驶程序下载。', agent, tick);
        this.governmentFrame(agent, false, 0, tick); return false;
      }
    }
    const roles: GovernmentRescueRole[] = encounter.phase === 'trinity'
      ? ['neo', 'trinity', encounter.elapsed >= 2.4 ? 'pilot' : 'agent_jones']
      : encounter.phase === 'downloading' ? ['neo', 'trinity'] : ['neo', 'trinity', 'agent_jones'];
    for (const role of roles) this.stageGovernmentActor(role, encounter, dt, tick);
    state.checkpoint = { ...agent.position }; state.lastText = governmentText(encounter); return governmentLocked(state);
  }
  governmentDodge(agent: AgentState, tick: number): string | undefined {
    const state = this.state; const encounter = state?.government;
    if (!state || state.scene !== 'm1_bullet_dodge' || !this.controls(agent) || encounter?.kind !== 'rooftop' || encounter.phase !== 'bullet_time') return undefined;
    encounter.resolved ??= [];
    const match = GOVERNMENT_RESCUE.rooftop.beats.map((beat, index) => ({ beat, index, distance: Math.abs(encounter.elapsed - beat) }))
      .filter(candidate => !encounter.resolved!.includes(candidate.index) && candidate.distance <= GOVERNMENT_RESCUE.rooftop.window)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!match) return '弹道尚未进入闪避窗口。观察时间收缩，在子弹贴近时按 X。';
    encounter.resolved.push(match.index); encounter.dodges = (encounter.dodges ?? 0) + 1;
    this.governmentShot(encounter, 'agent_jones', undefined, 0, tick, [-2.4, 2.1, -1.4][match.index] ?? 0);
    agent.activeEffects = agent.activeEffects.filter(effect => effect.visualEffect !== 'slow_motion');
    agent.activeEffects.push({ abilityId: 'film:bullet-dodge', visualEffect: 'slow_motion', remainingTicks: 1,
      remainingSeconds: Math.max(.8, GOVERNMENT_RESCUE.rooftop.finish - encounter.elapsed + .5) });
    this.governmentFrame(agent, false, 0, tick); return match.distance < GOVERNMENT_RESCUE.rooftop.window * .45
      ? 'Neo 在弹道闭合前折身闪过。' : '子弹贴身掠过，闪避仍然有效。';
  }
  private retryGovernment(agent: AgentState, tick: number): string {
    const state = this.state!; const previous = this.ensureGovernment(); const attempt = previous.attempt + 1;
    this.clearGovernmentActions(); agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
    agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    state.government = previous.kind === 'questioning'
      ? { kind: 'questioning', phase: 'ready', elapsed: 0, attempt, resolve: 1, answer: previous.answer }
      : { kind: 'rooftop', phase: 'ready', elapsed: 0, attempt, dodges: 0, wounds: 0, resolved: [] };
    delete state.fighting; delete state.started; this.governmentFrame(agent, false, 0, tick);
    return previous.kind === 'questioning'
      ? '已从审讯椅重试；你的反思仍被保留，重新在手记中确认后按住 G 抵抗。'
      : '已从屋顶交火检查点重试；按 G 重新开火，再在弹道贴近时按 X。';
  }
  private governmentAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const encounter = this.ensureGovernment(); const occupied = this.governmentOccupied(encounter);
    if (occupied) return `${occupied.name} 正由另一位玩家控制，等待对方结束后再继续。`;
    if (encounter.phase === 'failed' && target === 'act') return this.retryGovernment(agent, tick);
    if (encounter.kind === 'questioning') {
      if (encounter.phase === 'ready' && target.startsWith('reflect:')) {
        const choice = filmReflections(state.scene).find(candidate => candidate.id === target.slice(8));
        if (!choice) return '请在手记中选择一种具体回应。';
        const life = this.sandbox().neoLife!; const key = `${state.scene}:${state.step}`;
        if (!state.reflections[key]) {
          state.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
          life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `${this.scene!.title} · ${choice.label}`, text: choice.response });
        }
        encounter.answer = choice.id; encounter.phase = 'monologue'; encounter.elapsed = 0; encounter.resolve = 1;
        this.governmentFrame(agent, false, 0, tick); return `${choice.response} 现在按住 G，让 Morpheus 在 Smith 的逼问中保持清醒。`;
      }
      if (encounter.phase === 'alarm_ready' && target === 'act') {
        encounter.phase = 'alarm'; encounter.elapsed = 0; this.governmentFrame(agent, false, 0, tick); return state.lastText;
      }
      return governmentText(encounter);
    }
    if (encounter.phase === 'ready' && target === 'act') {
      encounter.phase = 'opening'; encounter.elapsed = 0; this.governmentShot(encounter, 'neo', 'agent_jones', 0, tick);
      this.governmentFrame(agent, false, 0, tick); return 'Neo 举枪开火。Jones 接管飞行员并开始避开弹道。';
    }
    if (encounter.phase === 'download_ready' && target === 'act') {
      if (!this.near(agent, this.step!)) return '先走到屋顶直升机驾驶舱旁，再按 G 请求驾驶程序。';
      encounter.phase = 'downloading'; encounter.elapsed = 0; this.governmentFrame(agent, false, 0, tick); return state.lastText;
    }
    return governmentText(encounter);
  }
  private ensureAirRescue(): AirRescueEncounter {
    const state = this.state!;
    if (!state.airRescue) {
      const kind = state.scene === 'm1_helicopter' ? 'office' : 'roof';
      const done = state.completed.includes(state.scene) || state.step >= this.scene!.steps.length;
      state.airRescue = kind === 'office'
        ? { kind, phase: done ? 'done' : 'ready', elapsed: 0, attempt: 0, suppression: done ? 1 : 0, bursts: done ? 4 : 0 }
        : { kind, phase: done ? 'done' : 'ready', elapsed: 0, attempt: 0, grip: 1, braces: done ? 3 : 0, misses: 0, resolved: done ? [0, 1, 2] : [] };
    }
    return state.airRescue;
  }
  private airRescueOccupied(encounter: AirRescueEncounter): AgentState | undefined {
    const ids = encounter.kind === 'office' ? ['trinity', 'morpheus', 'smith', 'agent_brown', 'agent_jones'] : ['trinity', 'morpheus'];
    return ids.map(id => this.world.agents.get(id)).find(actor => actor?.controller);
  }
  private stageAirRescueActor(role: AirRescueRole, encounter: AirRescueEncounter, dt: number, tick: number): void {
    const actor = this.world.agents.get(role); if (!actor || actor.controller && actor.id !== this.state!.actor) return;
    const root = airRescueRoot(encounter, role); const before = { ...actor.position };
    actor.position = filmPosition(this.scene!.set, root.x, root.z); actor.position.y += root.y; actor.rotation = root.yaw;
    actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: (actor.position.y - before.y) / dt, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
    actor.currentLocation = this.scene!.set; actor.isInMatrix = true;
    const armed = encounter.kind === 'office' && (role === 'neo' && encounter.phase === 'firing'
      || ['smith', 'agent_brown', 'agent_jones'].includes(role) && ['firing', 'leap_window'].includes(encounter.phase));
    actor.currentAction = { type: 'idle', parameters: { player: actor.id === this.state!.actor, resolved: true, armed,
      airRescue: { ...encounter, resolved: encounter.resolved ? [...encounter.resolved] : undefined, role } }, startedAt: tick, duration: 1, progress: 0 };
  }
  private clearAirRescueActions(): void {
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.airRescue) {
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
    }
  }
  private airRescueImpact(source: string, target: string, encounter: AirRescueEncounter, tick: number, damage = 0): void {
    const sourceRole: AirRescueRole = source === 'helicopter' ? 'trinity' : source as AirRescueRole;
    const root = airRescueRoot(encounter, sourceRole); const from = filmPosition(this.scene!.set, root.x, root.z); from.y += root.y + 2;
    const destination = encounter.kind === 'office'
      ? filmPosition(this.scene!.set, 0, -26.2)
      : filmPosition(this.scene!.set, -2.4, -38);
    destination.y += encounter.kind === 'office' ? 5 : 7;
    const length = Math.max(.001, distance(from, destination));
    this.onImpact?.({ source, target, position: destination, direction: { x: (destination.x - from.x) / length, y: (destination.y - from.y) / length, z: (destination.z - from.z) / length },
      damage, combo: 0, matrix: true, downed: false, shot: { from, surface: target.includes('glass') ? 'stone' : 'body' } }, tick);
  }
  private failAirRescue(agent: AgentState, encounter: AirRescueEncounter): void {
    encounter.phase = 'failed'; agent.health = 0; agent.status = 'dead'; agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
    this.clearAirRescueActions(); this.state!.lastText = airRescueText(encounter);
  }
  airRescueFrame(agent: AgentState, focus: boolean, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || !this.controls(agent) || state.visiting || !['m1_helicopter', 'm1_rooftop_rescue'].includes(state.scene)) return false;
    const encounter = this.ensureAirRescue();
    if (encounter.phase === 'failed') { this.clearAirRescueActions(); state.lastText = airRescueText(encounter); return false; }
    const occupied = this.airRescueOccupied(encounter);
    if (occupied) { state.lastText = `${occupied.name} 正由另一位玩家控制，直升机营救停在当前动作。`; return airRescueLocked(state); }
    const delta = Math.max(0, Math.min(.1, dt));
    if (encounter.kind === 'office') {
      if (encounter.phase === 'approach') {
        encounter.elapsed = Math.min(AIR_RESCUE.office.approach, encounter.elapsed + delta);
        if (encounter.elapsed >= AIR_RESCUE.office.approach) { encounter.phase = 'firing'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'firing') {
        encounter.elapsed += delta; encounter.suppression = Math.max(0, Math.min(1, (encounter.suppression ?? 0) + delta * (focus ? 1 / AIR_RESCUE.office.fire : -.15)));
        const bursts = Math.floor((encounter.suppression ?? 0) * 4 + .0001);
        while ((encounter.bursts ?? 0) < bursts) { encounter.bursts = (encounter.bursts ?? 0) + 1; this.airRescueImpact('neo', 'government-glass', encounter, tick); }
        if ((encounter.suppression ?? 0) >= 1) { encounter.phase = 'leap_window'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'leap_window') {
        encounter.elapsed = Math.min(AIR_RESCUE.office.leapWindow, encounter.elapsed + delta);
        if (encounter.elapsed >= AIR_RESCUE.office.leapWindow) { this.failAirRescue(agent, encounter); return false; }
      } else if (encounter.phase === 'catching') {
        encounter.elapsed = Math.min(AIR_RESCUE.office.catching, encounter.elapsed + delta);
        if (encounter.elapsed >= AIR_RESCUE.office.catching) {
          encounter.phase = 'done'; this.clearAirRescueActions();
          this.advance(this.step!.text ?? 'Neo 抓住下坠的 Morpheus。', agent, tick);
          this.airRescueFrame(agent, false, 0, tick); return false;
        }
      }
      const roles: AirRescueRole[] = encounter.phase === 'done' ? ['neo', 'trinity', 'morpheus']
        : ['neo', 'trinity', 'morpheus', 'smith', 'agent_brown', 'agent_jones'];
      for (const role of roles) this.stageAirRescueActor(role, encounter, dt, tick);
    } else {
      if (encounter.phase === 'impact') {
        encounter.elapsed = Math.min(AIR_RESCUE.roof.impact, encounter.elapsed + delta);
        if (encounter.elapsed >= AIR_RESCUE.roof.impact) { encounter.phase = 'bracing'; encounter.elapsed = 0; encounter.resolved = []; encounter.grip = 1; encounter.braces = 0; encounter.misses = 0; }
      } else if (encounter.phase === 'bracing') {
        encounter.elapsed = Math.min(AIR_RESCUE.roof.duration, encounter.elapsed + delta);
        encounter.grip = Math.max(0, Math.min(1, (encounter.grip ?? 1) + delta * (focus ? .08 : -.42)));
        encounter.resolved ??= [];
        for (const [index, beat] of AIR_RESCUE.roof.beats.entries()) {
          if (encounter.resolved.includes(index) || encounter.elapsed <= beat + AIR_RESCUE.roof.window) continue;
          encounter.resolved.push(index); encounter.misses = (encounter.misses ?? 0) + 1; encounter.grip = Math.max(0, (encounter.grip ?? 0) - .34);
          if ((encounter.misses ?? 0) >= 2) { this.failAirRescue(agent, encounter); return false; }
        }
        if ((encounter.grip ?? 0) <= 0) { this.failAirRescue(agent, encounter); return false; }
        if (encounter.elapsed >= AIR_RESCUE.roof.duration) {
          if ((encounter.braces ?? 0) < 2) { this.failAirRescue(agent, encounter); return false; }
          encounter.phase = 'pulling'; encounter.elapsed = 0;
        }
      } else if (encounter.phase === 'pulling') {
        const before = encounter.elapsed; encounter.elapsed = Math.min(AIR_RESCUE.roof.pulling, encounter.elapsed + delta);
        if (!encounter.ropeCut && before < .9 && encounter.elapsed >= .9) { encounter.ropeCut = true; this.airRescueImpact('trinity', 'helicopter-rope', encounter, tick); }
        if (!encounter.crash && before < 2.65 && encounter.elapsed >= 2.65) { encounter.crash = true; this.airRescueImpact('helicopter', 'glass-facade', encounter, tick); }
        if (encounter.elapsed >= AIR_RESCUE.roof.pulling) {
          encounter.phase = 'done'; this.clearAirRescueActions();
          this.advance(this.step!.text ?? 'Neo 把 Trinity 拉回屋顶。', agent, tick);
          this.airRescueFrame(agent, false, 0, tick); return false;
        }
      }
      for (const role of ['neo', 'trinity', 'morpheus'] as AirRescueRole[]) this.stageAirRescueActor(role, encounter, dt, tick);
    }
    state.checkpoint = { ...agent.position }; state.lastText = airRescueText(encounter); return airRescueLocked(state);
  }
  airRescueBrace(agent: AgentState, tick: number): string | undefined {
    const state = this.state; const encounter = state?.airRescue;
    if (!state || !this.controls(agent) || !encounter) return undefined;
    if (encounter.kind === 'office' && encounter.phase === 'leap_window') {
      const distanceToCatch = Math.abs(encounter.elapsed - AIR_RESCUE.office.leapAt);
      if (distanceToCatch > .62) return encounter.elapsed < AIR_RESCUE.office.leapAt ? '救援绳还没有摆到 Morpheus 上方。' : '绳索已经越过最佳接应线。';
      encounter.phase = 'catching'; encounter.elapsed = 0; this.airRescueFrame(agent, false, 0, tick); return 'Neo 跃出侧舱，抓住了下坠的 Morpheus。';
    }
    if (encounter.kind !== 'roof' || encounter.phase !== 'bracing') return undefined;
    encounter.resolved ??= [];
    const match = AIR_RESCUE.roof.beats.map((beat, index) => ({ beat, index, distance: Math.abs(encounter.elapsed - beat) }))
      .filter(candidate => !encounter.resolved!.includes(candidate.index) && candidate.distance <= AIR_RESCUE.roof.window)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!match) return '绳索尚未突然绷紧。持续按住 G，在冲击抵达时按 X。';
    encounter.resolved.push(match.index); encounter.braces = (encounter.braces ?? 0) + 1; encounter.grip = Math.min(1, (encounter.grip ?? 0) + .12);
    this.airRescueFrame(agent, false, 0, tick); return match.distance < AIR_RESCUE.roof.window * .45
      ? 'Neo 借女儿墙卸掉冲击，稳住绳索。' : '绳索从手套中滑过一截，但 Neo 仍抓住了。';
  }
  private retryAirRescue(agent: AgentState, tick: number): string {
    const state = this.state!; const previous = this.ensureAirRescue(); const attempt = previous.attempt + 1;
    this.clearAirRescueActions(); agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
    agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    state.airRescue = previous.kind === 'office'
      ? { kind: 'office', phase: 'ready', elapsed: 0, attempt, suppression: 0, bursts: 0 }
      : { kind: 'roof', phase: 'ready', elapsed: 0, attempt, grip: 1, braces: 0, misses: 0, resolved: [] };
    this.airRescueFrame(agent, false, 0, tick);
    return previous.kind === 'office' ? '已从 B-212 侧舱重试；按住 G 重新接近并压制审讯层。' : '已从屋顶接应点重试；按住 G 抓绳，在冲击抵达时按 X。';
  }
  private airRescueAct(agent: AgentState, target: string, tick: number): string {
    const encounter = this.ensureAirRescue(); const occupied = this.airRescueOccupied(encounter);
    if (occupied) return `${occupied.name} 正由另一位玩家控制，等待对方结束后再继续。`;
    if (encounter.phase === 'failed' && target === 'act') return this.retryAirRescue(agent, tick);
    if (encounter.phase !== 'ready' || target !== 'act') return airRescueText(encounter);
    encounter.phase = encounter.kind === 'office' ? 'approach' : 'impact'; encounter.elapsed = 0;
    this.airRescueFrame(agent, true, 0, tick);
    return encounter.kind === 'office' ? 'Trinity 把 B-212 贴向审讯层；持续按住 G 操作侧舱机枪。' : 'Neo 抓紧连接 Trinity 的绳索；持续按住 G，冲击到来时按 X。';
  }
  private ensureMatrixEscape(): MatrixEscapeEncounter {
    const state = this.state!; const kind = state.scene === 'm1_subway' ? 'subway' : 'city';
    if (!state.matrixEscape || state.matrixEscape.kind !== kind) {
      const done = state.completed.includes(state.scene) || state.step >= this.scene!.steps.length;
      const checkpoint = kind === 'subway' ? state.step > 0 ? 'tracks' : 'duel' : 'street';
      state.matrixEscape = { kind, phase: done ? 'done' : kind === 'subway' ? state.step > 0 ? 'tracks' : 'ready' : state.step > 0 ? 'running' : 'ready',
        elapsed: 0, attempt: 0, checkpoint, hits: 0, dodges: 0, pursuit: 0, segment: state.step, possessions: 0, resolved: [] };
    }
    const encounter = state.matrixEscape;
    encounter.checkpoint ??= encounter.kind === 'subway' && state.step > 0 ? 'tracks' : encounter.kind === 'subway' ? 'duel' : 'street';
    encounter.hits ??= 0; encounter.dodges ??= 0; encounter.pursuit ??= 0; encounter.segment ??= state.step;
    encounter.possessions ??= 0; encounter.resolved ??= [];
    return encounter;
  }
  private matrixEscapeOccupied(encounter: MatrixEscapeEncounter): AgentState | undefined {
    const ids = encounter.kind === 'subway' ? ['smith', 'citizen_13'] : ['smith', 'citizen_13', 'citizen_14'];
    return ids.map(id => this.world.agents.get(id)).find(actor => actor?.controller);
  }
  private clearMatrixEscapeActions(): void {
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.matrixEscape) {
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
    }
  }
  private stageMatrixEscapeActor(role: MatrixEscapeRole, encounter: MatrixEscapeEncounter, dt: number, tick: number): void {
    const actor = this.world.agents.get(role); if (!actor || actor.controller && actor.id !== this.state!.actor) return;
    const root = matrixEscapeRoot(encounter, role); const before = { ...actor.position };
    actor.position = filmPosition(this.scene!.set, root.x, root.z); actor.position.y += root.y; actor.rotation = root.yaw;
    actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: (actor.position.y - before.y) / dt, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
    actor.currentLocation = this.scene!.set; actor.isInMatrix = true;
    const armed = role === 'smith' && encounter.phase === 'phone_shot';
    actor.currentAction = { type: 'idle', parameters: { player: actor.id === this.state!.actor, resolved: true, armed,
      matrixEscape: { ...encounter, resolved: [...encounter.resolved], role } }, startedAt: tick, duration: 1, progress: 0 };
  }
  matrixEscapeAction(agent: AgentState, tick: number): void {
    const state = this.state; const encounter = state?.matrixEscape;
    if (!state || !encounter || !this.controls(agent) || state.visiting || !['m1_subway', 'm1_city_chase'].includes(state.scene)
      || matrixEscapeLocked(state) || encounter.phase === 'failed') return;
    agent.currentAction ??= { type: 'idle', parameters: { player: true, resolved: true }, startedAt: tick, duration: 1, progress: 0 };
    agent.currentAction.parameters.matrixEscape = { ...encounter, resolved: [...encounter.resolved], role: 'neo' };
  }
  private spawnMatrixEscapeThreat(agent: AgentState, tick: number): void {
    const state = this.state!; const encounter = this.ensureMatrixEscape();
    if (this.sandbox().threats.some(threat => threat.scene === state.scene)) return;
    const position = encounter.kind === 'subway' ? filmPosition(this.scene!.set, 0, 2)
      : { ...agent.position, x: agent.position.x + Math.sin(agent.rotation + Math.PI) * 12, z: agent.position.z + Math.cos(agent.rotation + Math.PI) * 12 };
    this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`, scene: state.scene, kind: 'smith', character: 'smith', position,
      matrix: true, health: 999, maxHealth: 999, target: agent.id, stunUntil: tick + (encounter.kind === 'subway' ? 3 : 8), lastStrike: tick });
    const smith = this.world.agents.get('smith');
    if (smith && !smith.controller) smith.currentAction = { type: 'idle', parameters: { filmDuel: true }, startedAt: tick, duration: 100000, progress: 0 };
  }
  private matrixEscapeImpact(source: string, target: string, encounter: MatrixEscapeEncounter, tick: number, downed = false): void {
    const root = matrixEscapeRoot(encounter, target === 'smith' ? 'smith' : 'neo');
    const position = filmPosition(this.scene!.set, root.x, root.z); position.y += root.y + 2;
    const from = encounter.kind === 'subway' ? filmPosition(this.scene!.set, 16.4, 18) : filmPosition(this.scene!.set, 7, 18);
    from.y += 2; const length = Math.max(.001, distance(from, position));
    this.onImpact?.({ source, target, position, direction: { x: (position.x - from.x) / length, y: (position.y - from.y) / length, z: (position.z - from.z) / length },
      damage: 0, combo: 0, matrix: true, downed, shot: source === 'smith' ? { from, surface: 'stone' } : undefined }, tick);
  }
  private finishSubwayExchange(agent: AgentState, encounter: MatrixEscapeEncounter, tick: number): void {
    if (encounter.phase !== 'duel' || encounter.hits < MATRIX_ESCAPE.subway.requiredHits || encounter.dodges < MATRIX_ESCAPE.subway.requiredDodges) return;
    encounter.phase = 'wall_break'; encounter.elapsed = 0; this.clearThreats();
    this.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick);
  }
  matrixEscapeHit(agent: AgentState, threat: SandboxThreat, _combo: number, tick: number): boolean {
    const state = this.state; const encounter = state?.matrixEscape;
    if (!state || !encounter || !this.controls(agent) || threat.scene !== state.scene) return false;
    if (encounter.kind === 'subway' && encounter.phase === 'duel') {
      encounter.hits = Math.min(MATRIX_ESCAPE.subway.requiredHits, encounter.hits + 1); threat.health = threat.maxHealth;
      state.lastText = matrixEscapeText(encounter); this.finishSubwayExchange(agent, encounter, tick); return true;
    }
    if (encounter.kind === 'city' && encounter.phase === 'running') {
      encounter.pursuit = Math.max(0, encounter.pursuit - .08); threat.health = threat.maxHealth;
      state.lastText = `Neo 击退当前身体，但 Smith 会继续换体。${matrixEscapeText(encounter)}`; return true;
    }
    return false;
  }
  matrixEscapeCombatDodge(agent: AgentState, threat: SandboxThreat, tick: number): boolean {
    const state = this.state; const encounter = state?.matrixEscape;
    if (!state || !encounter || !this.controls(agent) || threat.scene !== state.scene) return false;
    if (encounter.kind === 'subway' && encounter.phase === 'duel') {
      encounter.dodges = Math.min(MATRIX_ESCAPE.subway.requiredDodges, encounter.dodges + 1); state.lastText = matrixEscapeText(encounter);
      this.finishSubwayExchange(agent, encounter, tick); return true;
    }
    if (encounter.kind === 'city' && encounter.phase === 'running') {
      encounter.dodges++; encounter.pursuit = Math.max(0, encounter.pursuit - .12); state.lastText = matrixEscapeText(encounter); return true;
    }
    return false;
  }
  matrixEscapeEvade(agent: AgentState, tick: number): string | undefined {
    const state = this.state; const encounter = state?.matrixEscape;
    if (!state || !encounter || !this.controls(agent)) return undefined;
    if (encounter.kind === 'subway' && encounter.phase === 'train_window') {
      const offset = Math.abs(encounter.elapsed - MATRIX_ESCAPE.subway.trainBeat);
      if (offset > MATRIX_ESCAPE.subway.trainWindow) return encounter.elapsed < MATRIX_ESCAPE.subway.trainBeat ? '列车还没到翻身线，盯住头灯越过立柱的瞬间。' : '已经错过最安全的起身点，继续寻找列车侧面的空隙。';
      encounter.phase = 'train_escape'; encounter.elapsed = 0; encounter.dodges++; this.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick);
      return 'Neo 蹬开 Smith，翻上站台边缘。列车已经进入轨道。';
    }
    if (encounter.kind === 'city' && encounter.phase === 'truck_window') {
      const offset = Math.abs(encounter.elapsed - MATRIX_ESCAPE.city.truckBeat);
      if (offset > MATRIX_ESCAPE.city.truckWindow) return encounter.elapsed < MATRIX_ESCAPE.city.truckBeat ? '垃圾车还没封死路口，保持重心等待侧面的缺口。' : '车身已经压过最佳线，沿墙寻找最后的侧翻空间。';
      encounter.phase = 'possession'; encounter.elapsed = 0; encounter.dodges++; encounter.truckHit = true;
      this.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick); return 'Neo 侧翻穿过垃圾车与墙面的窄缝，追来的身体被撞倒。';
    }
    return undefined;
  }
  private failMatrixEscape(agent: AgentState, encounter: MatrixEscapeEncounter): void {
    encounter.phase = 'failed'; this.clearThreats(); this.clearMatrixEscapeActions();
    agent.health = 0; agent.status = 'dead'; agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
    this.state!.lastText = matrixEscapeText(encounter);
  }
  matrixEscapeDefeated(agent: AgentState): boolean {
    const state = this.state; const encounter = state?.matrixEscape;
    if (!state || !encounter || !this.controls(agent) || encounter.phase === 'failed' || encounter.phase === 'done') return false;
    this.failMatrixEscape(agent, encounter); return true;
  }
  matrixEscapeFrame(agent: AgentState, input: { movement: number; sprint: boolean }, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || !this.controls(agent) || state.visiting || !['m1_subway', 'm1_city_chase'].includes(state.scene)) return false;
    const encounter = this.ensureMatrixEscape();
    if (encounter.phase === 'failed') { this.clearMatrixEscapeActions(); state.lastText = matrixEscapeText(encounter); return false; }
    if (agent.status !== 'alive') { this.failMatrixEscape(agent, encounter); return false; }
    const occupied = this.matrixEscapeOccupied(encounter);
    if (occupied) { state.lastText = `${occupied.name} 正由另一位玩家控制，地铁撤离停在当前进度。`; return matrixEscapeLocked(state); }
    const delta = Math.max(0, Math.min(.1, dt));
    if (encounter.kind === 'subway') {
      // Keep the later possession host at its authored waiting position. Scene
      // entry otherwise leaves it near the track camera before the body swap.
      this.stageMatrixEscapeActor('citizen_13', encounter, dt, tick);
      if (encounter.phase === 'phone_shot') {
        const before = encounter.elapsed; encounter.elapsed = Math.min(MATRIX_ESCAPE.subway.phoneShot, encounter.elapsed + delta);
        if (!encounter.phoneBroken && before < .62 && encounter.elapsed >= .62) { encounter.phoneBroken = true; this.matrixEscapeImpact('smith', 'subway-phone', encounter, tick); }
        for (const role of ['neo', 'smith'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.subway.phoneShot) { encounter.phase = 'stance'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'stance') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.subway.stance, encounter.elapsed + delta);
        for (const role of ['neo', 'smith'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.subway.stance) {
          const root = matrixEscapeRoot(encounter, 'neo'); agent.position = filmPosition(this.scene!.set, root.x, root.z); agent.rotation = root.yaw;
          encounter.phase = 'duel'; encounter.elapsed = 0; this.clearMatrixEscapeActions(); this.spawnMatrixEscapeThreat(agent, tick); state.checkpoint = { ...agent.position };
        }
      } else if (encounter.phase === 'duel') {
        this.spawnMatrixEscapeThreat(agent, tick); this.matrixEscapeAction(agent, tick);
      } else if (encounter.phase === 'wall_break') {
        const before = encounter.elapsed; encounter.elapsed = Math.min(MATRIX_ESCAPE.subway.wallBreak, encounter.elapsed + delta);
        if (!encounter.wallBroken && before < 1.05 && encounter.elapsed >= 1.05) { encounter.wallBroken = true; this.matrixEscapeImpact('neo', 'subway-wall', encounter, tick); }
        for (const role of ['neo', 'smith'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.subway.wallBreak) {
          this.advance(this.step!.text ?? 'Neo 把 Smith 撞穿站台墙面。', agent, tick); encounter.phase = 'tracks'; encounter.elapsed = 0; encounter.checkpoint = 'tracks';
          for (const role of ['neo', 'smith'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, 0, tick);
          state.checkpoint = { ...agent.position };
        }
      } else if (encounter.phase === 'tracks') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.subway.tracks, encounter.elapsed + delta);
        for (const role of ['neo', 'smith'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.subway.tracks) { encounter.phase = 'train_window'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'train_window') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.subway.trainDuration, encounter.elapsed + delta);
        for (const role of ['neo', 'smith'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.subway.trainDuration) { this.failMatrixEscape(agent, encounter); return false; }
      } else if (encounter.phase === 'train_escape') {
        const before = encounter.elapsed; encounter.elapsed = Math.min(MATRIX_ESCAPE.subway.escape, encounter.elapsed + delta);
        if (!encounter.trainHit && before < 1.45 && encounter.elapsed >= 1.45) { encounter.trainHit = true; this.matrixEscapeImpact('subway-train', 'smith', encounter, tick, true); }
        for (const role of ['neo', 'smith'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.subway.escape) { encounter.phase = 'body_swap'; encounter.elapsed = 0; encounter.possessions = 1; encounter.host = 'citizen_13'; }
      } else if (encounter.phase === 'body_swap') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.subway.bodySwap, encounter.elapsed + delta);
        for (const role of ['neo', 'smith'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.subway.bodySwap) {
          encounter.phase = 'done'; this.clearMatrixEscapeActions(); this.advance(this.step!.text ?? 'Smith 通过新的身体继续追踪。', agent, tick);
        }
      }
    } else {
      if (encounter.phase === 'briefing') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.city.briefing, encounter.elapsed + delta); this.stageMatrixEscapeActor('neo', encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.city.briefing) { encounter.phase = 'running'; encounter.elapsed = 0; this.clearMatrixEscapeActions(); this.spawnMatrixEscapeThreat(agent, tick); state.checkpoint = { ...agent.position }; }
      } else if (encounter.phase === 'running') {
        const moving = input.movement > .12;
        encounter.pursuit = Math.max(0, Math.min(1, encounter.pursuit + delta * (input.sprint && moving ? -MATRIX_ESCAPE.city.pursuitSprint : moving ? MATRIX_ESCAPE.city.pursuitMoving : MATRIX_ESCAPE.city.pursuitIdle)));
        this.spawnMatrixEscapeThreat(agent, tick);
        const pursuer = this.sandbox().threats.find(threat => threat.scene === state.scene);
        if (pursuer && distance(agent.position, pursuer.position) < 6) encounter.pursuit = Math.min(1, encounter.pursuit + delta * .18);
        if (encounter.pursuit >= 1) { this.failMatrixEscape(agent, encounter); return false; }
        if (this.step && this.near(agent, this.step)) {
          this.clearThreats(); state.checkpoint = filmPosition(this.scene!.set, this.step.x, this.step.z + 7);
          encounter.phase = state.step === 0 ? 'phone_failure' : state.step === 1 ? 'truck_warning' : 'door_ready'; encounter.elapsed = 0;
          if (encounter.phase !== 'door_ready') this.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick);
        } else this.matrixEscapeAction(agent, tick);
      } else if (encounter.phase === 'phone_failure') {
        const before = encounter.elapsed; encounter.elapsed = Math.min(MATRIX_ESCAPE.city.phoneFailure, encounter.elapsed + delta);
        if (!encounter.phoneBroken && before < .55 && encounter.elapsed >= .55) { encounter.phoneBroken = true; this.matrixEscapeImpact('smith', 'city-phone', encounter, tick); }
        for (const role of ['neo', 'citizen_13'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.city.phoneFailure) {
          encounter.possessions = 1; encounter.host = 'citizen_13'; this.advance(this.step!.text ?? '第一部出口电话失效。', agent, tick);
          encounter.segment = 1; encounter.phase = 'running'; encounter.elapsed = 0; encounter.pursuit = .12; this.clearMatrixEscapeActions(); this.spawnMatrixEscapeThreat(agent, tick);
        }
      } else if (encounter.phase === 'truck_warning') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.city.truckWarning, encounter.elapsed + delta); this.stageMatrixEscapeActor('neo', encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.city.truckWarning) { encounter.phase = 'truck_window'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'truck_window') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.city.truckDuration, encounter.elapsed + delta); this.stageMatrixEscapeActor('neo', encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.city.truckDuration) { this.failMatrixEscape(agent, encounter); return false; }
      } else if (encounter.phase === 'possession') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.city.possession, encounter.elapsed + delta);
        for (const role of ['neo', 'citizen_14'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.city.possession) {
          encounter.possessions = 2; encounter.host = 'citizen_14'; this.advance(this.step!.text ?? 'Neo 穿过封锁路口。', agent, tick);
          encounter.segment = 2; encounter.phase = 'running'; encounter.elapsed = 0; encounter.pursuit = .18; this.clearMatrixEscapeActions(); this.spawnMatrixEscapeThreat(agent, tick);
        }
      } else if (encounter.phase === 'door_ready') this.matrixEscapeAction(agent, tick);
      else if (encounter.phase === 'door') {
        encounter.elapsed = Math.min(MATRIX_ESCAPE.city.door, encounter.elapsed + delta);
        for (const role of ['neo', encounter.host ?? 'citizen_14'] as MatrixEscapeRole[]) this.stageMatrixEscapeActor(role, encounter, dt, tick);
        if (encounter.elapsed >= MATRIX_ESCAPE.city.door) {
          encounter.phase = 'done'; this.clearThreats(); this.clearMatrixEscapeActions(); this.advance(this.step!.text ?? 'Neo 进入 303 房间的撤离楼梯。', agent, tick);
        }
      }
    }
    state.lastText = matrixEscapeText(encounter); return matrixEscapeLocked(state);
  }
  private retryMatrixEscape(agent: AgentState, tick: number): string {
    const state = this.state!; const previous = this.ensureMatrixEscape(); const attempt = previous.attempt + 1;
    this.clearThreats(); this.clearMatrixEscapeActions(); agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
    agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    if (previous.kind === 'subway') {
      const tracks = previous.checkpoint === 'tracks' || state.step > 0; state.step = tracks ? 1 : 0;
      state.matrixEscape = { kind: 'subway', phase: tracks ? 'tracks' : 'ready', elapsed: 0, attempt, checkpoint: tracks ? 'tracks' : 'duel',
        hits: 0, dodges: 0, pursuit: 0, segment: state.step, possessions: tracks ? previous.possessions : 0, resolved: [], phoneBroken: tracks || previous.phoneBroken, wallBroken: tracks };
    } else {
      state.matrixEscape = { ...previous, phase: 'running', elapsed: 0, attempt, checkpoint: 'street', pursuit: .12, segment: state.step,
        hits: 0, dodges: previous.dodges, resolved: [...previous.resolved] };
      this.spawnMatrixEscapeThreat(agent, tick);
    }
    this.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick);
    return previous.kind === 'subway' ? state.step ? '已从轨道挣扎前重试；列车仍会按保存的时序接近。' : '已从出口电话前重试；重新面对 Smith。'
      : '已从最近的街巷检查点重试；继续沿 Tank 的路线奔跑。';
  }
  private matrixEscapeAct(agent: AgentState, target: string, tick: number): string {
    const encounter = this.ensureMatrixEscape(); const occupied = this.matrixEscapeOccupied(encounter);
    if (occupied) return `${occupied.name} 正由另一位玩家控制，等待对方结束后再继续。`;
    if (encounter.phase === 'failed' && target === 'act') return this.retryMatrixEscape(agent, tick);
    if (target !== 'act') return matrixEscapeText(encounter);
    if (encounter.kind === 'subway' && encounter.phase === 'ready') {
      encounter.phase = 'phone_shot'; encounter.elapsed = 0; this.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick);
      return 'Neo 刚碰到听筒，Smith 的子弹击碎了出口电话。';
    }
    if (encounter.kind === 'city' && encounter.phase === 'ready') {
      encounter.phase = 'briefing'; encounter.elapsed = 0; this.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick);
      return 'Tank 接通耳机，把市场、后巷和 303 房间分成三段路线。';
    }
    if (encounter.kind === 'city' && encounter.phase === 'door_ready') {
      encounter.phase = 'door'; encounter.elapsed = 0; this.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick);
      return 'Neo 推开旅馆楼梯门，向 303 房间冲去。';
    }
    return matrixEscapeText(encounter);
  }
  private ensureTheOne(): TheOneEncounter {
    const state = this.state!;
    const kind = state.scene === 'm1_death' ? 'death' : state.scene === 'm1_return' ? 'return' : 'flight';
    if (!state.theOne || state.theOne.kind !== kind) {
      const done = state.completed.includes(state.scene) || state.step >= this.scene!.steps.length;
      const phase = done ? 'done' : kind === 'return' ? state.step >= 2 ? 'exit_run' : state.step === 1 ? 'counter' : 'ready'
        : kind === 'flight' && state.step > 0 ? 'call_ready' : 'ready';
      state.theOne = { kind, phase, elapsed: 0, attempt: 0, checkpoint: kind === 'death' ? 'door' : kind === 'return' ? state.step >= 2 ? 'exit' : 'bullets' : 'phone',
        signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] };
    }
    const encounter = state.theOne;
    encounter.signal ??= 0; encounter.hits ??= 0; encounter.blocks ??= 0; encounter.deadline ??= 0;
    encounter.altitude ??= 0; encounter.flightX ??= 0; encounter.flightZ ??= 0; encounter.resolved ??= [];
    return encounter;
  }
  private theOneOccupied(encounter: TheOneEncounter): AgentState | undefined {
    const roles = encounter.kind === 'death' ? ['smith', 'agent_brown', 'trinity', 'morpheus', 'tank']
      : encounter.kind === 'return' ? ['smith', 'agent_brown', 'agent_jones', 'trinity', 'morpheus', 'tank'] : [];
    return roles.map(id => this.world.agents.get(id)).find(actor => actor?.controller);
  }
  private clearTheOneActions(): void {
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.theOne) {
      actor.currentAction = null; actor.velocity = { x: 0, y: 0, z: 0 };
    }
  }
  private stageTheOneActor(role: TheOneRole, encounter: TheOneEncounter, dt: number, tick: number): void {
    const actor = this.world.agents.get(role); if (!actor || actor.controller && actor.id !== this.state!.actor) return;
    const root = theOneRoot(encounter, role); const before = { ...actor.position }; const position = filmPosition(root.set, root.x, root.z); position.y += root.y;
    actor.position = position; actor.rotation = root.yaw; actor.currentLocation = root.set; actor.isInMatrix = FILM_SETS[root.set].world === 'matrix';
    actor.velocity = dt > 0 ? { x: (position.x - before.x) / dt, y: (position.y - before.y) / dt, z: (position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
    actor.currentAction = { type: 'idle', parameters: { player: actor.id === this.state!.actor, resolved: true,
      armed: role === 'smith' && ['ambush', 'gunfire'].includes(encounter.phase), theOne: { ...encounter, resolved: [...encounter.resolved], role } },
      startedAt: tick, duration: 1, progress: 0 };
  }
  theOneAction(agent: AgentState, tick: number): void {
    const state = this.state; const encounter = state?.theOne;
    if (!state || !encounter || !this.controls(agent) || state.visiting || !['m1_death', 'm1_return', 'm1_final_call'].includes(state.scene)
      || theOneLocked(state) || encounter.phase === 'failed') return;
    agent.currentAction ??= { type: 'idle', parameters: { player: true, resolved: true }, startedAt: tick, duration: 1, progress: 0 };
    agent.currentAction.parameters.theOne = { ...encounter, resolved: [...encounter.resolved], role: 'neo' };
  }
  private spawnTheOneThreat(agent: AgentState, tick: number): void {
    const state = this.state!; const encounter = this.ensureTheOne();
    if (encounter.kind !== 'return' || encounter.phase !== 'counter' || this.sandbox().threats.some(threat => threat.scene === state.scene)) return;
    const root = theOneRoot(encounter, 'smith'); const position = filmPosition(root.set, root.x, root.z);
    this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`, scene: state.scene, kind: 'smith', character: 'smith', position,
      matrix: true, health: 999, maxHealth: 999, target: agent.id, stunUntil: tick + 2.5, lastStrike: tick });
    const smith = this.world.agents.get('smith');
    if (smith && !smith.controller) smith.currentAction = { type: 'idle', parameters: { filmDuel: true }, startedAt: tick, duration: 100000, progress: 0 };
  }
  private theOneImpact(source: string, target: string, tick: number, downed = false): void {
    const encounter = this.ensureTheOne(); const root = theOneRoot(encounter, target === 'smith' ? 'smith' : 'neo');
    const position = filmPosition(root.set, root.x, root.z); position.y += root.y + 2;
    const fromRoot = theOneRoot(encounter, source === 'smith' ? 'smith' : 'neo'); const from = filmPosition(fromRoot.set, fromRoot.x, fromRoot.z); from.y += fromRoot.y + 2;
    const length = Math.max(.001, distance(from, position));
    this.onImpact?.({ source, target, position, direction: { x: (position.x - from.x) / length, y: (position.y - from.y) / length, z: (position.z - from.z) / length },
      damage: 0, combo: 0, matrix: encounter.phase !== 'emp', downed, shot: source === 'smith' ? { from, surface: 'stone' } : undefined }, tick);
  }
  theOneHit(agent: AgentState, threat: SandboxThreat, _combo: number, tick: number): boolean {
    const state = this.state; const encounter = state?.theOne;
    if (!state || !encounter || !this.controls(agent) || encounter.kind !== 'return' || encounter.phase !== 'counter'
      || threat.scene !== state.scene || threat.character !== 'smith') return false;
    encounter.hits = Math.min(THE_ONE.return.requiredHits, encounter.hits + 1); threat.health = threat.maxHealth;
    state.lastText = theOneText(encounter);
    if (encounter.hits >= THE_ONE.return.requiredHits && encounter.blocks >= THE_ONE.return.requiredBlocks) {
      encounter.phase = 'dive'; encounter.elapsed = 0; this.clearThreats(); this.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
    }
    return true;
  }
  theOneEvade(agent: AgentState, tick: number): string | undefined {
    const state = this.state; const encounter = state?.theOne;
    if (!state || !encounter || !this.controls(agent)) return undefined;
    if (encounter.kind === 'return' && encounter.phase === 'bullet_window') {
      const offset = Math.abs(encounter.elapsed - THE_ONE.return.bulletBeat);
      if (offset > THE_ONE.return.bulletWindow) return encounter.elapsed < THE_ONE.return.bulletBeat
        ? '弹群仍在高速接近；等它们进入代码视野中心再按 X。' : '停弹拍点已经掠过；保持观察，失败后可从代码视野检查点重试。';
      encounter.phase = 'bullet_stop'; encounter.elapsed = 0; encounter.bulletStopped = true;
      this.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
      return 'Neo 抬手，整片弹群停在走廊中央。';
    }
    if (encounter.kind === 'return' && encounter.phase === 'counter') {
      const threat = this.sandbox().threats.find(candidate => candidate.scene === state.scene && candidate.character === 'smith');
      if (!threat?.attackAt || threat.attackAt <= tick) return '先看清 Smith 的红色起手，再在命中前按 X 格挡。';
      encounter.blocks = Math.min(THE_ONE.return.requiredBlocks, encounter.blocks + 1); delete threat.attackAt; threat.stunUntil = Math.max(threat.stunUntil, tick + 2.2);
      state.lastText = theOneText(encounter);
      if (encounter.hits >= THE_ONE.return.requiredHits) {
        encounter.phase = 'dive'; encounter.elapsed = 0; this.clearThreats(); this.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
      }
      return 'Neo 单手截住 Smith 的拳路。程序的速度已经不再构成优势。';
    }
    return undefined;
  }
  private failTheOne(agent: AgentState, encounter: TheOneEncounter): void {
    encounter.phase = 'failed'; this.clearThreats(); this.clearTheOneActions();
    agent.health = 0; agent.status = 'dead'; agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
    this.state!.lastText = theOneText(encounter);
  }
  theOneDefeated(agent: AgentState): boolean {
    const state = this.state; const encounter = state?.theOne;
    if (!state || !encounter || !this.controls(agent) || encounter.phase === 'failed' || encounter.phase === 'done'
      || encounter.kind === 'death') return false;
    this.failTheOne(agent, encounter); return true;
  }
  theOneFrame(agent: AgentState, input: { x: number; z: number; sprint: boolean; jump: boolean; focus: boolean }, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || !this.controls(agent) || state.visiting || !['m1_death', 'm1_return', 'm1_final_call'].includes(state.scene)) return false;
    const encounter = this.ensureTheOne();
    if (encounter.phase === 'failed') { this.clearTheOneActions(); state.lastText = theOneText(encounter); return false; }
    if (encounter.kind === 'flight' && encounter.phase === 'done') {
      this.stageTheOneActor('neo', encounter, 0, tick); state.lastText = theOneText(encounter); return true;
    }
    if (agent.status !== 'alive') { this.failTheOne(agent, encounter); return false; }
    const occupied = this.theOneOccupied(encounter);
    if (occupied) { state.lastText = `${occupied.name} 正由另一位玩家控制，觉醒片段停在当前进度。`; return theOneLocked(state); }
    const delta = Math.max(0, Math.min(.1, dt));
    if (encounter.kind === 'death') {
      if (encounter.phase === 'ready') {
        if (state.step === 0 && this.near(agent, this.step!)) this.advance(this.step!.label, agent, tick);
        this.theOneAction(agent, tick);
      } else if (encounter.phase === 'ambush') {
        encounter.elapsed = Math.min(THE_ONE.death.ambush, encounter.elapsed + delta);
        for (const role of ['neo', 'smith', 'agent_brown'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.death.ambush) { encounter.phase = 'gunfire'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'gunfire') {
        const before = encounter.elapsed; encounter.elapsed = Math.min(THE_ONE.death.gunfire, encounter.elapsed + delta);
        for (const beat of [.35, .78, 1.22]) if (!encounter.resolved.includes(beat) && before < beat && encounter.elapsed >= beat) {
          encounter.resolved.push(beat); this.theOneImpact('smith', 'neo', tick, beat === 1.22);
        }
        for (const role of ['neo', 'smith', 'agent_brown'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.death.gunfire) { encounter.phase = 'flatline'; encounter.elapsed = 0; encounter.resolved = []; }
      } else if (encounter.phase === 'flatline') {
        encounter.elapsed = Math.min(THE_ONE.death.flatline, encounter.elapsed + delta);
        for (const role of ['neo', 'trinity', 'morpheus', 'tank'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.death.flatline) { encounter.phase = 'listening'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'listening') {
        if (input.focus) encounter.signal = Math.min(1, encounter.signal + delta / THE_ONE.death.listen);
        for (const role of ['neo', 'trinity', 'morpheus', 'tank'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.signal >= 1) { encounter.phase = 'kiss'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'kiss') {
        encounter.elapsed = Math.min(THE_ONE.death.kiss, encounter.elapsed + delta);
        for (const role of ['neo', 'trinity', 'morpheus', 'tank'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.death.kiss) { encounter.phase = 'revive'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'revive') {
        encounter.elapsed = Math.min(THE_ONE.death.revive, encounter.elapsed + delta);
        for (const role of ['neo', 'smith', 'agent_brown', 'trinity', 'morpheus', 'tank'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.death.revive) {
          agent.health = agent.maxHealth; encounter.phase = 'done'; this.clearTheOneActions(); this.stageTheOneActor('neo', encounter, 0, tick);
          this.advance(this.step!.text ?? 'Neo 在旅馆走廊恢复心跳。', agent, tick);
        }
      }
    } else if (encounter.kind === 'return') {
      if (encounter.phase === 'ready') this.theOneAction(agent, tick);
      else if (encounter.phase === 'code_reveal') {
        encounter.elapsed = Math.min(THE_ONE.return.reveal, encounter.elapsed + delta);
        for (const role of ['neo', 'smith', 'agent_brown', 'agent_jones'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.return.reveal) { encounter.phase = 'bullet_window'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'bullet_window') {
        encounter.elapsed = Math.min(THE_ONE.return.bulletDuration, encounter.elapsed + delta);
        for (const role of ['neo', 'smith', 'agent_brown', 'agent_jones'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.return.bulletDuration) { this.failTheOne(agent, encounter); return false; }
      } else if (encounter.phase === 'bullet_stop') {
        encounter.elapsed = Math.min(THE_ONE.return.bulletStop, encounter.elapsed + delta);
        for (const role of ['neo', 'smith', 'agent_brown', 'agent_jones'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.return.bulletStop) {
          this.advance(this.step!.text ?? 'Neo 停住并放下整片弹群。', agent, tick); encounter.phase = 'counter'; encounter.elapsed = 0;
          this.clearTheOneActions(); this.spawnTheOneThreat(agent, tick); state.checkpoint = { ...agent.position };
        }
      } else if (encounter.phase === 'counter') {
        this.spawnTheOneThreat(agent, tick); this.theOneAction(agent, tick);
      } else if (encounter.phase === 'dive') {
        encounter.elapsed = Math.min(THE_ONE.return.dive, encounter.elapsed + delta);
        for (const role of ['neo', 'smith', 'agent_brown', 'agent_jones'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.return.dive) { encounter.phase = 'burst'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'burst') {
        const before = encounter.elapsed; encounter.elapsed = Math.min(THE_ONE.return.burst, encounter.elapsed + delta);
        if (!encounter.smithBurst && before < 1.15 && encounter.elapsed >= 1.15) {
          encounter.smithBurst = true; this.theOneImpact('neo-code', 'smith', tick, true);
        }
        for (const role of ['neo', 'smith', 'agent_brown', 'agent_jones'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.return.burst) {
          this.advance(this.step!.text ?? 'Neo 从内部撕开 Smith 的程序外壳。', agent, tick); encounter.phase = 'exit_run'; encounter.elapsed = 0;
          encounter.checkpoint = 'exit'; encounter.deadline = 0; this.clearTheOneActions();
          agent.position = filmPosition(this.scene!.set, 0, 8); agent.rotation = Math.PI; state.checkpoint = { ...agent.position };
        }
      } else if (encounter.phase === 'exit_run') {
        encounter.deadline = Math.min(THE_ONE.return.exitDeadline, encounter.deadline + delta);
        if (encounter.deadline >= THE_ONE.return.exitDeadline) { this.failTheOne(agent, encounter); return false; }
        if (this.step && this.near(agent, this.step)) { encounter.phase = 'exit_ready'; encounter.elapsed = 0; }
        this.theOneAction(agent, tick);
      } else if (encounter.phase === 'exit_ready') this.theOneAction(agent, tick);
      else if (encounter.phase === 'exit_phone') {
        encounter.elapsed = Math.min(THE_ONE.return.exitPhone, encounter.elapsed + delta); this.stageTheOneActor('neo', encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.return.exitPhone) { encounter.phase = 'emp'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'emp') {
        const before = encounter.elapsed; encounter.elapsed = Math.min(THE_ONE.return.emp, encounter.elapsed + delta);
        for (const role of ['neo', 'trinity', 'morpheus', 'tank'] as TheOneRole[]) this.stageTheOneActor(role, encounter, dt, tick);
        if (!encounter.empFired && before < 1.15 && encounter.elapsed >= 1.15) encounter.empFired = true;
        if (encounter.elapsed >= THE_ONE.return.emp) {
          encounter.phase = 'done'; this.clearTheOneActions(); this.stageTheOneActor('neo', encounter, 0, tick);
          this.advance(this.step!.text ?? 'Neo 离线后，Morpheus 启动 EMP。', agent, tick);
        }
      }
    } else {
      if (encounter.phase === 'ready' && state.step > 0) { encounter.phase = 'call_ready'; encounter.elapsed = 0; }
      if (encounter.phase === 'ready' || encounter.phase === 'call_ready') this.theOneAction(agent, tick);
      else if (encounter.phase === 'call') {
        encounter.elapsed = Math.min(THE_ONE.flight.call, encounter.elapsed + delta); this.stageTheOneActor('neo', encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.flight.call) { encounter.phase = 'takeoff_ready'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'takeoff_ready') {
        this.stageTheOneActor('neo', encounter, dt, tick);
        if (input.jump) { encounter.phase = 'takeoff'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'takeoff') {
        encounter.elapsed = Math.min(THE_ONE.flight.takeoff, encounter.elapsed + delta);
        const progress = encounter.elapsed / THE_ONE.flight.takeoff; encounter.altitude = THE_ONE.flight.maxAltitude * progress * progress * (3 - 2 * progress);
        const speed = THE_ONE.flight.speed * (input.sprint ? 1.35 : 1); encounter.flightX += input.x * speed * delta; encounter.flightZ += input.z * speed * delta;
        encounter.flightX = Math.max(-18, Math.min(18, encounter.flightX)); encounter.flightZ = Math.max(-14, Math.min(14, encounter.flightZ));
        this.stageTheOneActor('neo', encounter, dt, tick);
        if (encounter.elapsed >= THE_ONE.flight.takeoff) {
          encounter.phase = 'done'; this.clearTheOneActions(); this.stageTheOneActor('neo', encounter, 0, tick);
          this.advance(this.step!.text ?? 'Neo 飞向城市上空。', agent, tick);
        }
      }
    }
    state.lastText = theOneText(encounter); return theOneLocked(state);
  }
  private retryTheOne(agent: AgentState, tick: number): string {
    const state = this.state!; const previous = this.ensureTheOne(); const attempt = previous.attempt + 1;
    this.clearThreats(); this.clearTheOneActions(); agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
    if (previous.kind === 'return') {
      const exit = previous.checkpoint === 'exit' || state.step >= 2; state.step = exit ? 2 : 0;
      state.theOne = { kind: 'return', phase: exit ? 'exit_run' : 'code_reveal', elapsed: 0, attempt, checkpoint: exit ? 'exit' : 'bullets',
        signal: 0, hits: exit ? THE_ONE.return.requiredHits : 0, blocks: exit ? THE_ONE.return.requiredBlocks : 0, deadline: 0,
        altitude: 0, flightX: 0, flightZ: 0, resolved: [], bulletStopped: exit || previous.bulletStopped, smithBurst: exit || previous.smithBurst };
      agent.position = exit ? filmPosition(this.scene!.set, 0, 8) : filmPosition(this.scene!.set, 0, -9.5); agent.isInMatrix = true; agent.currentLocation = this.scene!.set;
    } else {
      state.theOne = { kind: previous.kind, phase: 'ready', elapsed: 0, attempt, checkpoint: previous.checkpoint,
        signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] };
      agent.position = { ...state.checkpoint };
    }
    agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    this.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
    return previous.kind === 'return' && state.step >= 2 ? '已从 Smith 消失后的走廊重试；出口电话与 EMP 倒计时重新开始。'
      : previous.kind === 'return' ? '已从代码视野检查点重试；重新面对三名特工的子弹。' : '已恢复当前觉醒片段的检查点。';
  }
  private theOneAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const encounter = this.ensureTheOne(); const occupied = this.theOneOccupied(encounter);
    if (occupied) return `${occupied.name} 正由另一位玩家控制，等待对方结束后再继续。`;
    if (encounter.phase === 'failed' && target === 'act') return this.retryTheOne(agent, tick);
    if (target !== 'act') return theOneText(encounter);
    if (encounter.kind === 'death' && encounter.phase === 'ready' && state.step === 1) {
      encounter.phase = 'ambush'; encounter.elapsed = 0; this.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
      return 'Neo 推开 303 房门，Smith 从黑暗里举起手枪。';
    }
    if (encounter.kind === 'return' && encounter.phase === 'ready') {
      encounter.phase = 'code_reveal'; encounter.elapsed = 0; this.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
      return 'Neo 看见走廊、特工与子弹背后的 Matrix 代码。';
    }
    if (encounter.kind === 'return' && encounter.phase === 'exit_ready') {
      encounter.phase = 'exit_phone'; encounter.elapsed = 0; this.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
      return 'Neo 接起出口电话。Morpheus 等到信号确认离线后再启动 EMP。';
    }
    if (encounter.kind === 'flight' && encounter.phase === 'call_ready') {
      if (!this.near(agent, this.step!)) return '走近街角电话亭，再接通系统线路。';
      encounter.phase = 'call'; encounter.elapsed = 0; this.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
      return 'Neo 接通电话，追踪程序重新运行。';
    }
    return theOneText(encounter);
  }
  private sealAmbush(): void {
    const state = this.state;
    const sealed = (state?.ambush?.elapsed ?? 0) >= AMBUSH_REWRITE || state?.completed.includes('m1_dejavu') || state?.scene === 'm1_dejavu' && state.step > 0;
    if (!sealed) return;
    for (const [i, wall] of AMBUSH_SEALS.entries()) {
      const id = `film:ambush:seal:${i}`; if (this.sandbox().structures.some(s => s.id === id)) continue;
      this.sandbox().structures.push({ id, kind: 'barricade', owner: 'matrix', position: filmPosition('film_ambush_house', wall.x, wall.z), matrix: true, health: 1,
        film: { scene: 'm1_dejavu', width: wall.width, depth: wall.depth, height: wall.height } });
    }
  }
  oracleFrame(agent: AgentState, focus: boolean, dt: number, tick: number): void {
    const state = this.state;
    if (!state || !this.controls(agent) || state.visiting || !state.oracle) return;
    const oracle = state.oracle;
    if (state.scene === 'm1_spoon' && oracle.spoon !== undefined) {
      if (state.step === 0) {
        const still = Math.hypot(agent.velocity.x, agent.velocity.y, agent.velocity.z) < .25;
        const attentive = focus && still && this.near(agent, this.step!);
        oracle.spoon = Math.max(0, Math.min(1, oracle.spoon + Math.min(.1, dt) * (attentive ? 1 / 5 : -.5)));
        state.lastText = attentive ? '手指不再用力。你注视着勺子，金属正在弯曲。' : '停下脚步，按住 G 专注。松开按键或走开，勺子会恢复原形。';
        if (oracle.spoon >= 1) { this.sandbox().neoLife!.choices.spoon = 'bent'; this.advance(this.step!.text!, agent, tick); }
      }
      if (agent.currentAction) agent.currentAction.parameters.spoon = oracle.spoon;
    }
    if (state.scene === 'm1_oracle' && state.step === 0 && oracle.vase !== undefined) {
      oracle.vase = Math.min(4.5, oracle.vase + Math.min(.1, dt));
      const turn = Math.max(0, Math.min(1, (oracle.vase - .4) / .8));
      agent.position = filmPosition(this.scene!.set, 7, -14); agent.rotation = Math.PI - turn * turn * (3 - 2 * turn) * 2.72; agent.velocity = { x: 0, y: 0, z: 0 };
      agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, vase: oracle.vase }, startedAt: tick, duration: 1, progress: 0 };
      state.lastText = oracle.vase < 1.2 ? '先知看着烤箱，随口提醒你留意身后的花瓶。' : oracle.vase < 2.5 ? '你回头寻找花瓶，衣袖擦过它。' : '碎片落在脚边。先知说，真正值得想的是那句提醒如何改变了你的动作。';
      if (agent.currentAction) agent.currentAction.parameters.vase = oracle.vase;
      if (oracle.vase >= 4.5) {
        this.sandbox().neoLife!.choices.oracle_vase = 'broken';
        oracle.consultation ??= { phase: 'waiting', elapsed: 0 };
        this.advance(this.step!.text!, agent, tick); agent.currentAction = null;
      }
      return;
    }
    const encounter = oracle.consultation;
    if (state.scene !== 'm1_oracle' || state.step !== 1 || !encounter) return;
    const oracleActor = this.world.agents.get('oracle')!;
    const occupied = Boolean(oracleActor.controller);
    const playing = oracleVisitLocked(state) && !occupied && ['examining', 'responding'].includes(encounter.phase);
    if (playing) encounter.elapsed = Math.min(oracleVisitDuration(encounter), encounter.elapsed + Math.max(0, Math.min(.1, dt)));
    for (const role of ['neo', 'oracle'] as const) {
      const actor = role === 'neo' ? agent : oracleActor;
      if (role === 'oracle' && actor.controller || role === 'neo' && !oracleVisitLocked(state)) continue;
      const pose = oracleVisitRoot(encounter, role);
      const before = { ...actor.position };
      this.place(actor, this.scene!, filmPosition(this.scene!.set, pose.x, pose.z)); actor.rotation = pose.yaw;
      actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { player: role === 'neo', resolved: true,
        oracleVisit: { ...encounter, role } }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (!oracleVisitLocked(state) && agent.currentAction?.parameters.oracleVisit) agent.currentAction = null;
    if (oracleVisitLocked(state)) state.checkpoint = { ...agent.position };
    state.lastText = occupied && oracleVisitLocked(state) ? '先知正由另一位玩家控制，检查和谈话停在当前动作。' : oracleVisitText(encounter);
    if (playing && encounter.elapsed >= oracleVisitDuration(encounter)) {
      if (encounter.phase === 'examining') { encounter.phase = 'question'; encounter.elapsed = 0; }
      else {
        const response = oracleVisitText(encounter); encounter.phase = 'done'; encounter.elapsed = ORACLE_VISIT.response;
        this.advance(`${this.step!.text} ${response}`, agent, tick); agent.currentAction = null; oracleActor.currentAction = null;
      }
      this.oracleFrame(agent, false, 0, tick);
    }
  }

  private oracleAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const encounter = state.oracle!.consultation!;
    this.oracleFrame(agent, false, 0, tick);
    const oracleActor = this.world.agents.get('oracle')!;
    if (oracleActor.controller) return '先知正由另一位玩家控制，等待对方结束后再继续谈话。';
    if (encounter.phase === 'waiting') {
      if (target !== 'act') return oracleVisitText(encounter);
      if (!this.near(agent, this.step!)) return '走到厨房操作台旁，靠近先知后再按 G。';
      const center = FILM_SETS[this.scene!.set].center;
      encounter.approach = { x: agent.position.x - center.x, z: agent.position.z - center.z, yaw: agent.rotation };
      encounter.phase = 'examining'; encounter.elapsed = 0; state.checkpoint = { ...agent.position };
      this.oracleFrame(agent, false, 0, tick); return state.lastText;
    }
    if (encounter.phase === 'question') {
      if (!target.startsWith('reflect:')) return '打开手记，选择你要如何回应先知。';
      const choice = filmReflections(state.scene).find(item => item.id === target.slice(8));
      if (!choice) return '请选择手记中的一种具体回答。';
      const life = this.sandbox().neoLife!; const key = `${state.scene}:${state.step}`;
      if (!state.reflections[key]) {
        state.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
        life.choices.oracle_first = oracleLegacyChoice(choice.id);
        life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `${this.scene!.title} · ${choice.label}`, text: choice.response });
      }
      encounter.answer = choice.id; encounter.phase = 'responding'; encounter.elapsed = 0;
      this.oracleFrame(agent, false, 0, tick); return choice.response;
    }
    if (oracleVisitLocked(state)) return '谈话进行中。可以转动视角观察；暂停、断线与重新载入会保留当前动作。';
    return state.lastText;
  }
  awakeningFrame(agent: AgentState, dt: number, tick: number): boolean {
    if (!this.controls(agent) || !awakeningLocked(this.state!)) return false;
    const state = this.state!; const beat = state.awakening;
    const reveal = beat?.kind === 'construct' || beat?.kind === 'desert';
    const morpheus = reveal ? this.world.agents.get('morpheus') : undefined;
    const trinity = beat?.kind === 'mirror' ? this.world.agents.get('trinity') : undefined;
    const wasPlaying = beat && beat.elapsed < AWAKENING_SECONDS[beat.kind] && beat.started !== false && !morpheus?.controller && !trinity?.controller;
    if (wasPlaying) beat.elapsed = Math.min(AWAKENING_SECONDS[beat.kind], beat.elapsed + Math.min(.1, dt));
    const pose = awakeningPose(beat); const previous = agent.position;
    agent.position = filmPosition(this.scene!.set, pose.x, pose.z); agent.position.y += pose.y;
    agent.rotation = beat?.kind === 'construct' ? CONSTRUCT_REVEAL.neo.yaw : beat?.kind === 'desert' ? DESERT_REVEAL.neo.yaw : Math.PI;
    agent.velocity = dt > 0 ? { x: beat?.kind === 'mirror' ? (agent.position.x - previous.x) / dt : 0,
      y: (agent.position.y - previous.y) / dt, z: beat?.kind === 'mirror' ? (agent.position.z - previous.z) / dt : 0 } : { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, filmPose: pose.pose,
      mirror: beat?.kind === 'mirror' ? mirrorSilver(beat.elapsed) : 0, mirrorBeat: beat?.kind === 'mirror' ? beat.elapsed : undefined,
      recovery: beat?.kind === 'recovery' ? beat.elapsed : undefined,
      seated: beat?.kind === 'construct' || beat?.kind === 'mirror' && beat.elapsed >= MIRROR_TIMING.sit,
      reveal: reveal ? { kind: beat.kind, elapsed: beat.elapsed, role: 'neo' } : undefined }, startedAt: tick, duration: 1, progress: 0 };
    if (beat?.kind === 'mirror' && trinity && !trinity.controller)
      trinity.currentAction = { type: 'idle', parameters: { mirrorCrew: beat.elapsed }, startedAt: tick, duration: 1, progress: 0 };
    if (reveal && morpheus && !morpheus.controller) {
      const root = beat.kind === 'construct' ? CONSTRUCT_REVEAL.morpheus : DESERT_REVEAL.morpheus;
      const before = morpheus.position; morpheus.position = filmPosition(this.scene!.set, root.x, root.z); morpheus.rotation = root.yaw;
      morpheus.velocity = dt > 0 ? { x: (morpheus.position.x - before.x) / dt, y: 0, z: (morpheus.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      morpheus.currentLocation = this.scene!.set; morpheus.isInMatrix = FILM_SETS[this.scene!.set].world === 'matrix';
      morpheus.currentAction = { type: 'idle', parameters: { resolved: true, filmPose: pose.pose, seated: beat.kind === 'construct',
        reveal: { kind: beat.kind, elapsed: beat.elapsed, role: 'morpheus' } }, startedAt: tick, duration: 1, progress: 0 };
    }
    state.lastText = morpheus?.controller ? '揭示暂停在当前画面：Morpheus 正由另一位玩家控制。'
      : trinity?.controller ? '追踪暂停在当前画面：Trinity 正由另一位玩家控制。' : pose.text;
    if (wasPlaying && beat.elapsed >= AWAKENING_SECONDS[beat.kind]) {
      if (beat.kind === 'mirror') this.finishMirror(agent, tick);
      else this.advance(this.step!.text!, agent, tick);
    }
    return true;
  }
  private finishMirror(agent: AgentState, tick: number): void {
    const state = this.state!;
    if (!state.completed.includes('m1_mirror')) {
      state.step = 0; // Old saves may be waiting at the removed connection-chair objective.
      this.advance(FILM_SCENE_BY_ID.m1_mirror.steps[0].text!, agent, tick);
    }
    const pod = FILM_SCENE_BY_ID.m1_pod;
    state.scene = pod.id; state.actor = pod.actor; state.step = 0; state.lastText = pod.context;
    this.enter(pod, tick);
  }
  trainingFrame(agent: AgentState, dt: number, tick: number): boolean {
    const state = this.state; const training = state?.training;
    if (!state || !training || !this.controls(agent) || !trainingLocked(state)) return false;
    const roles: TrainingRole[] = training.kind === 'download' ? ['neo', 'tank']
      : training.kind === 'jump' ? ['neo', 'morpheus']
      : ['neo', 'morpheus', 'citizen_1', 'citizen_2', 'smith'];
    const occupied = roles.find(id => id !== agent.id && this.world.agents.get(id)?.controller);
    const playing = training.started && !occupied;
    if (playing) training.elapsed = Math.min(TRAINING_SECONDS[training.kind], training.elapsed + Math.min(.1, dt));
    for (const role of roles) {
      const actor = this.world.agents.get(role);
      if (!actor || actor.controller && actor !== agent) continue;
      const before = { ...actor.position }; const root = trainingRoot(training, role);
      actor.position = filmPosition(this.scene!.set, root.x, root.z); actor.position.y += root.y; actor.rotation = root.yaw;
      actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: (actor.position.y - before.y) / dt, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      actor.currentLocation = this.scene!.set; actor.isInMatrix = FILM_SETS[this.scene!.set].world === 'matrix';
      if (training.kind === 'red_dress' && role === 'citizen_1') actor.status = training.elapsed >= 6.2 ? 'disconnected' : 'alive';
      else if (training.kind === 'red_dress' && role === 'smith') actor.status = training.elapsed >= 6.2 ? 'alive' : 'disconnected';
      else actor.status = 'alive';
      actor.currentAction = { type: actor.velocity.x || actor.velocity.y || actor.velocity.z ? 'move_to' : 'idle', parameters: {
        player: role === agent.id, resolved: true, seated: training.kind === 'download' && role === 'neo', armed: training.kind === 'red_dress' && role === 'smith' && training.elapsed >= 6.2,
        training: { kind: training.kind, elapsed: training.elapsed, role },
      }, startedAt: tick, duration: 1, progress: 0 };
    }
    state.checkpoint = { ...agent.position };
    state.lastText = occupied ? `训练暂停在当前动作：${this.world.agents.get(occupied)?.name ?? occupied} 正由另一位玩家控制。` : trainingText(training);
    if (playing && training.elapsed >= TRAINING_SECONDS[training.kind]) {
      if (training.kind === 'jump') {
        agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
        state.lastText = trainingText(training);
      } else this.advance(this.step!.text!, agent, tick);
    }
    return true;
  }
  sentinelFrame(agent: AgentState, input: { movement: number; sprint: boolean; jump: boolean }, dt: number, tick: number): boolean {
    const state = this.state;
    if (!state || state.scene !== 'm1_sentinels' || state.visiting || !this.controls(agent)) return false;
    const encounter = state.sentinel ??= { phase: state.step >= 2 ? 'done' : state.step === 1 ? 'verify' : 'ready', elapsed: 0, noise: 0, attempt: 0 };
    const occupied = SENTINEL_CAST.find(id => this.world.agents.get(id)?.controller);
    const active = sentinelActive(state) && encounter.phase !== 'ready';
    const delta = Math.max(0, Math.min(.1, dt));
    if (!occupied || !active) {
      if (encounter.phase === 'shutdown') {
        encounter.elapsed = Math.min(SENTINEL_TIMING.shutdown, encounter.elapsed + delta);
        if (encounter.elapsed >= SENTINEL_TIMING.shutdown) { encounter.phase = 'sweep'; encounter.elapsed = 0; agent.currentAction = null; }
      } else if (encounter.phase === 'sweep') {
        encounter.elapsed = Math.min(SENTINEL_TIMING.sweep, encounter.elapsed + delta);
        const danger = sentinelDanger(encounter.elapsed);
        const moving = Math.max(0, Math.min(1, input.movement));
        const added = moving * delta * (.3 + danger * 1.25) * (input.sprint ? 1.7 : 1) + (input.jump ? .32 : 0);
        encounter.noise = Math.max(0, Math.min(1, encounter.noise + added - (moving < .05 && !input.jump ? delta * .11 : 0)));
        if (encounter.noise >= 1) {
          const center = FILM_SETS[this.scene!.set].center;
          encounter.phase = 'detected'; encounter.elapsed = 0;
          encounter.caughtAt = { x: agent.position.x - center.x, z: agent.position.z - center.z, yaw: agent.rotation };
        } else if (encounter.elapsed >= SENTINEL_TIMING.sweep) { encounter.phase = 'clear'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'detected') {
        encounter.elapsed = Math.min(SENTINEL_TIMING.detected, encounter.elapsed + delta);
        if (encounter.elapsed >= SENTINEL_TIMING.detected) { encounter.phase = 'failed'; encounter.elapsed = 0; }
      } else if (encounter.phase === 'clear') {
        encounter.elapsed = Math.min(SENTINEL_TIMING.clear, encounter.elapsed + delta);
        if (encounter.elapsed >= SENTINEL_TIMING.clear) {
          encounter.phase = 'verify'; encounter.elapsed = 0; encounter.noise = 0;
          this.advance(this.scene!.steps[0].text!, agent, tick);
        }
      } else if (encounter.phase === 'confirming') {
        encounter.elapsed = Math.min(SENTINEL_TIMING.confirming, encounter.elapsed + delta);
        if (encounter.elapsed >= SENTINEL_TIMING.confirming) {
          encounter.phase = 'done'; encounter.elapsed = SENTINEL_TIMING.confirming;
          this.advance(this.scene!.steps[1].text!, agent, tick);
        }
      }
    }
    if (encounter.phase !== 'done') for (const role of ['neo', ...SENTINEL_CAST] as SentinelRole[]) {
      const actor = this.world.agents.get(role);
      if (!actor || actor.controller && actor !== agent || role === 'neo' && !sentinelLocked(state)) continue;
      const before = { ...actor.position }; const pose = sentinelRoot(encounter, role);
      this.place(actor, this.scene!, filmPosition(this.scene!.set, pose.x, pose.z)); actor.rotation = pose.yaw;
      actor.velocity = delta > 0 ? { x: (actor.position.x - before.x) / delta, y: 0, z: (actor.position.z - before.z) / delta } : { x: 0, y: 0, z: 0 };
      actor.currentAction = { type: 'idle', parameters: { player: role === 'neo', resolved: true, sentinel: { ...encounter, role } }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (!sentinelLocked(state) && agent.currentAction?.parameters.sentinel) agent.currentAction = null;
    if (sentinelLocked(state) && encounter.phase !== 'detected' && encounter.phase !== 'failed') state.checkpoint = { ...agent.position };
    state.lastText = occupied && active ? `${this.world.agents.get(occupied)?.name ?? occupied} 正由另一位玩家控制，静默场景停在当前画面。` : sentinelText(encounter);
    return sentinelLocked(state);
  }
  private sentinelAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; this.sentinelFrame(agent, { movement: 0, sprint: false, jump: false }, 0, tick);
    const encounter = state.sentinel!;
    if (target !== 'act' && target !== 'retry') return state.lastText;
    if (encounter.phase === 'failed') {
      encounter.phase = 'shutdown'; encounter.elapsed = 0; encounter.noise = 0; encounter.attempt++;
      delete encounter.caughtAt; agent.status = 'alive'; agent.health = agent.maxHealth;
      agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 };
      this.sentinelFrame(agent, { movement: 0, sprint: false, jump: false }, 0, tick); return state.lastText;
    }
    if (!this.near(agent, this.step!)) return '先走到前舱当前目标旁，再按 G。';
    if (SENTINEL_CAST.some(id => this.world.agents.get(id)?.controller)) return '一名船员正由另一位玩家控制，静默停机暂时无法开始。';
    if (encounter.phase === 'ready') {
      encounter.phase = 'shutdown'; encounter.elapsed = 0; encounter.noise = 0;
      state.checkpoint = { ...agent.position };
    } else if (encounter.phase === 'verify') { encounter.phase = 'confirming'; encounter.elapsed = 0; }
    this.sentinelFrame(agent, { movement: 0, sprint: false, jump: false }, 0, tick); return state.lastText;
  }
  interludeFrame(agent: AgentState, dt: number, tick: number): boolean {
    const state = this.state; const kind = state && interludeKind(state.scene);
    if (!state || !kind || state.visiting || !this.controls(agent)) return false;
    const completed = state.step >= this.scene!.steps.length;
    const fallback: InterludeEncounter = { kind, phase: completed ? 'done' : kind === 'console' && state.step > 0 ? 'choice' : kind === 'meal' && state.step > 0 ? 'done' : 'ready', elapsed: 0 };
    const encounter = state.interlude?.kind === kind ? state.interlude : (state.interlude = fallback);
    const roles = INTERLUDE_CAST[kind];
    const occupied = roles.find(id => id !== agent.id && this.world.agents.get(id)?.controller);
    const locked = interludeLocked(state);
    const playing = locked && !occupied;
    if (playing) encounter.elapsed = Math.min(interludeDuration(encounter), encounter.elapsed + Math.max(0, Math.min(.1, dt)));

    for (const role of roles) {
      const actor = this.world.agents.get(role);
      if (!actor || actor.controller && actor !== agent || role === agent.id && !locked) continue;
      const pose = interludeRoot(kind, role as InterludeRole); if (!pose) continue;
      const before = { ...actor.position };
      this.place(actor, this.scene!, filmPosition(this.scene!.set, pose.x, pose.z)); actor.rotation = pose.yaw;
      actor.velocity = dt > 0 ? { x: (actor.position.x - before.x) / dt, y: 0, z: (actor.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      const gesture = { ...encounter, role: role as InterludeRole };
      actor.currentAction = { type: 'idle', parameters: { player: role === agent.id, resolved: true, seated: interludeSeated(gesture), interlude: gesture }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (!locked && agent.currentAction?.parameters.interlude) agent.currentAction = null;
    if (locked) state.checkpoint = { ...agent.position };
    if (occupied && locked) state.lastText = `${this.world.agents.get(occupied)?.name ?? occupied} 正由另一位玩家控制，这段表演停在当前动作。`;
    else if (encounter.phase !== 'responding') state.lastText = interludeText(encounter);

    if (playing && encounter.elapsed >= interludeDuration(encounter)) {
      if (kind === 'console' && encounter.phase === 'performing') {
        encounter.phase = 'choice'; encounter.elapsed = 0;
        this.advance(this.scene!.steps[0].text!, agent, tick);
      } else if (kind === 'console' && encounter.phase === 'responding') {
        const response = state.lastText; const duration = interludeDuration(encounter); encounter.phase = 'done'; encounter.elapsed = duration;
        this.advance(`${this.scene!.steps[1].text} ${response}`, agent, tick);
      } else if (kind === 'steak') {
        const duration = interludeDuration(encounter); encounter.phase = 'done'; encounter.elapsed = duration;
        this.advance(this.scene!.steps[1].text!, agent, tick);
      } else {
        const duration = interludeDuration(encounter); encounter.phase = 'done'; encounter.elapsed = duration;
        this.advance(this.scene!.steps[0].text!, agent, tick);
      }
      agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
    }
    return interludeLocked(state);
  }
  private interludeAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const kind = interludeKind(state.scene)!;
    this.interludeFrame(agent, 0, tick); const encounter = state.interlude!;
    if (interludeLocked(state)) return '演出进行中。可以转动视角观察；暂停、断线与重新载入会保留当前动作。';
    const occupied = INTERLUDE_CAST[kind].find(id => id !== agent.id && this.world.agents.get(id)?.controller);
    if (occupied) return `${this.world.agents.get(occupied)?.name ?? occupied} 正由另一位玩家控制，当前片段无法开始。`;
    if (kind === 'steak' && state.step === 0) {
      if (!this.near(agent, this.step!)) return '先走近窗边餐桌的空座。';
      this.advance(this.step!.label, agent, tick); return 'Smith 在 Cypher 对面落座。按 G 见证这场既定交易。';
    }
    if (!this.near(agent, this.step!)) return kind === 'meal' ? '先走到餐桌尽头，靠近 Tank 递来的食物。' : '先走到滚动代码或窗边餐桌旁。';
    if (kind === 'console' && encounter.phase === 'choice') {
      if (!target.startsWith('reflect:')) return '打开手记，选择你要如何回应 Cypher。';
      const choice = filmReflections(state.scene).find(item => item.id === target.slice(8));
      if (!choice) return '请选择手记中的一种具体回应。';
      const life = this.sandbox().neoLife!; const key = `${state.scene}:${state.step}`;
      if (!state.reflections[key]) {
        state.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
        life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `${this.scene!.title} · ${choice.label}`, text: choice.response });
      }
      encounter.answer = choice.id; encounter.phase = 'responding'; encounter.elapsed = 0; state.lastText = choice.response;
      this.interludeFrame(agent, 0, tick); return state.lastText;
    }
    if (target !== 'act') return state.lastText;
    if (encounter.phase !== 'ready') return state.lastText;
    encounter.phase = 'performing'; encounter.elapsed = 0; state.checkpoint = { ...agent.position };
    this.interludeFrame(agent, 0, tick); return state.lastText;
  }
  trainingDodge(agent: AgentState, threat: SandboxThreat, tick: number): boolean {
    const state = this.state;
    if (state?.scene === 'm2_seraph' && state.step === 0 && threat.scene === state.scene && threat.character === 'seraph' && agent.id === state.actor) {
      const trial = state.seraph ??= { dodges: 0, counters: 0, attempts: 0 };
      if (threat.attackAt === undefined || trial.counterUntil && trial.counterUntil >= tick) return false;
      trial.dodges++; trial.counterUntil = tick + 10;
      threat.stunUntil = tick + 8;
      state.lastText = `你避开了 Seraph 的第 ${trial.dodges} 次攻势。趁他重心尚未恢复，靠近按 F 反击。`;
      agent.currentAction = { type: 'defend', parameters: { player: true, resolved: true }, startedAt: tick, duration: 1, progress: 0 };
      return true;
    }
    if (!state || state.scene !== 'm1_dojo' || state.step !== 0 || threat.scene !== state.scene || threat.character !== 'morpheus') return false;
    const dojo = state.dojo ??= { dodged: false, combo: 0, hits: 0 };
    if (dojo.dodged) return true;
    dojo.dodged = true; dojo.combo = 0;
    threat.stunUntil = Number.MAX_SAFE_INTEGER;
    state.lastText = '你看见了 Morpheus 的起手并闪到攻击线外。现在按 F 完成刺拳、直拳、正蹬三段反击。';
    agent.currentAction = { type: 'defend', parameters: { player: true, resolved: true }, startedAt: tick, duration: 1, progress: 0 };
    return true;
  }
  trainingHit(agent: AgentState, threat: SandboxThreat, combo: number, tick: number): boolean {
    const state = this.state;
    if (state?.scene === 'm2_seraph' && state.step === 0 && threat.scene === state.scene && threat.character === 'seraph') {
      const trial = state.seraph ??= { dodges: 0, counters: 0, attempts: 0 };
      if (agent.id !== state.actor || !trial.counterUntil || trial.counterUntil < tick) {
        state.lastText = 'Seraph 轻易挡开了正面攻击。看见起手提示后按 X，避开再反击。';
        return true;
      }
      trial.counters++; delete trial.counterUntil;
      if (trial.counters < 2) {
        threat.stunUntil = tick + 3;
        state.lastText = 'Seraph 接下这一击，后退半步又重新摆好架势。还要读懂一次不同的进攻。';
        return true;
      }
      threat.health = 0; this.sandbox().threats = this.sandbox().threats.filter(item => item !== threat);
      const seraph = this.world.agents.get('seraph'); if (seraph && !seraph.controller) seraph.currentAction = null;
      state.lastText = '第二次攻防结束。Seraph 收手，取下钥匙，示意 Neo 跟他去茶馆后门。';
      return true;
    }
    if (!state || state.scene !== 'm1_dojo' || state.step !== 0 || threat.scene !== state.scene || threat.character !== 'morpheus') return false;
    const dojo = state.dojo ??= { dodged: false, combo: 0, hits: 0 };
    if (!dojo.dodged) {
      dojo.combo = 0; state.lastText = 'Morpheus 挡开了进攻。先等红色起手提示出现，用 X 闪避一次，再组织反击。'; return true;
    }
    const expected = dojo.combo;
    if (combo !== expected) dojo.combo = combo === 0 ? 1 : 0;
    else dojo.combo++;
    dojo.hits++;
    if (dojo.combo < 3) {
      state.lastText = dojo.combo === 1 ? '刺拳命中。保持距离，在连击窗口内继续第二击。'
        : dojo.combo === 2 ? '直拳接上。最后用正蹬结束这一组反击。'
        : '节奏断开了。从刺拳重新开始三段连击。';
      return true;
    }
    dojo.complete = true; threat.health = 0;
    this.sandbox().threats = this.sandbox().threats.filter(item => item !== threat);
    const morpheus = this.world.agents.get('morpheus'); if (morpheus && !morpheus.controller) morpheus.currentAction = null;
    state.lastText = '闪避与三段反击完成。Morpheus 收起架势：下载的知识终于变成了你自己的动作。';
    return true;
  }
  seraphFailed(agent: AgentState): void {
    const state = this.state;
    if (!state || state.scene !== 'm2_seraph' || state.step !== 0 || agent.id !== state.actor) return;
    const attempts = (state.seraph?.attempts ?? 0) + 1;
    this.clearThreats(); state.seraph = { dodges: 0, counters: 0, attempts }; delete state.fighting;
    agent.health = agent.maxHealth; agent.position = filmStepPosition(this.scene!, this.scene!.steps[0]);
    agent.velocity = { x: 0, y: 0, z: 0 }; agent.activeEffects = [];
    state.checkpoint = { ...agent.position }; state.lastText = 'Seraph 在最后一击前收手，让 Neo 重新站稳。观察起手，按 G 再次开始考验。';
    this.stageCast();
  }
  private burlyEncounter(tick: number): BurlyEncounter {
    return this.state!.burly ??= { phase: 'ready', elapsed: 0, attempt: 0, repelled: 0, staffSwings: 0, assimilation: 0, nextCopyAt: tick };
  }
  burlyFrame(agent: AgentState, dt: number, tick: number): boolean {
    const state = this.state;
    if (state?.scene !== 'm2_burly' || state.visiting || !this.controls(agent)) return false;
    const encounter = this.burlyEncounter(tick);
    if (!burlyLocked(state)) return false;
    encounter.elapsed += Math.max(0, Math.min(.1, dt));
    if (encounter.phase === 'approaching' || encounter.phase === 'grapple') {
      const smith = this.world.agents.get('smith');
      if (smith && !smith.controller) {
        const z = encounter.phase === 'approaching' ? -8 + 6 * Math.min(1, encounter.elapsed / BURLY.approach) : -2;
        smith.position = filmPosition(this.scene!.set, 0, z); smith.rotation = 0;
        smith.currentAction = { type: 'move_to', parameters: { resolved: true, burly: { ...encounter, role: 'smith' } }, startedAt: tick, duration: 1, progress: 0 };
      }
      agent.position = filmPosition(this.scene!.set, 0, 0); agent.rotation = Math.PI;
      if (encounter.phase === 'approaching' && encounter.elapsed >= BURLY.approach) { encounter.phase = 'grapple'; encounter.elapsed = 0; }
      else if (encounter.phase === 'grapple' && encounter.elapsed >= BURLY.grapple) { this.burlyFailed(agent, tick); return true; }
    } else if (encounter.phase === 'flight') {
      const from = encounter.flightFrom!; const progress = Math.min(1, encounter.elapsed / BURLY.flight); const drift = progress * progress * (3 - 2 * progress);
      agent.position = { x: from.x, y: from.y + 50 * Math.sin(Math.min(1, progress * 1.1) * Math.PI / 2), z: from.z - 14 * drift };
      agent.rotation = Math.PI;
      if (progress >= 1) {
        encounter.phase = 'done'; this.clearThreats(); this.advance(burlyText(encounter), agent, tick);
        this.command(agent, 'next', tick); return true;
      }
    }
    agent.velocity = { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, burly: { ...encounter, role: 'neo' } }, startedAt: tick, duration: 1, progress: 0 };
    state.checkpoint = { ...agent.position };
    state.lastText = burlyText(encounter);
    return true;
  }
  burlyAction(agent: AgentState): void {
    if (this.state?.scene !== 'm2_burly' || this.state.visiting || !this.controls(agent) || !agent.currentAction) return;
    agent.currentAction.parameters.burly = { ...this.burlyEncounter(this.world.simulationTick), role: 'neo' };
  }
  private spawnBurlyCopies(agent: AgentState, tick: number, count: number): void {
    const state = this.state!; const encounter = this.burlyEncounter(tick);
    const positions = [[-14, -10], [14, -10], [-14, 10], [14, 10], [0, -26], [-18, 25], [18, 25], [0, 20]];
    for (let i = 0; i < count; i++) {
      const index = (encounter.repelled + this.sandbox().serial + i) % positions.length;
      const [x, z] = positions[index]; let position = filmPosition(this.scene!.set, x, z);
      if (playerBlocked(position, true, 1.1, this.sandbox().structures)) position = filmPosition(this.scene!.set, 0, -12 - i * 3);
      this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`, scene: state.scene, kind: 'smith', position, matrix: true,
        health: 64, maxHealth: 64, target: agent.id, stunUntil: tick + 2, lastStrike: tick + i * 2 });
    }
  }
  private burlyTick(agent: AgentState, tick: number): void {
    const state = this.state!; const encounter = this.burlyEncounter(tick);
    if (!['swarm', 'staff_ready', 'staff', 'flight_ready'].includes(encounter.phase)) return;
    encounter.assimilation = Math.max(0, encounter.assimilation - 1);
    const copies = this.sandbox().threats.filter(threat => threat.scene === state.scene);
    if (tick >= encounter.nextCopyAt && copies.length < BURLY.maxCopies) {
      this.spawnBurlyCopies(agent, tick, Math.min(2, BURLY.maxCopies - copies.length));
      encounter.nextCopyAt = tick + BURLY.copyInterval;
    }
  }
  private burlyAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const encounter = this.burlyEncounter(tick);
    if (target !== 'act') return burlyText(encounter);
    if (encounter.phase === 'failed') return this.retryBurly(agent, tick);
    if (encounter.phase === 'ready') {
      if (!this.near(agent, this.scene!.steps[0])) return '走近庭院中央的 Smith，再按 G 面对他。';
      if (this.world.agents.get('smith')?.controller) return 'Smith 正由另一位玩家控制，庭院对峙停在这里。';
      encounter.phase = 'approaching'; encounter.elapsed = 0; state.fighting = true;
      this.burlyFrame(agent, 0, tick); return state.lastText;
    }
    if (encounter.phase === 'staff_ready') {
      if (distance(agent.position, filmPosition(this.scene!.set, BURLY.staff.x, BURLY.staff.z)) > 4) return '先冲到庭院右侧松动的金属栏杆旁。';
      encounter.phase = 'staff'; encounter.elapsed = 0; state.lastText = burlyText(encounter); return state.lastText;
    }
    if (encounter.phase === 'flight_ready') {
      if (!this.near(agent, this.scene!.steps[1])) return '先冲到庭院北侧的空地，摆脱围住出口的复制体。';
      encounter.phase = 'flight'; encounter.elapsed = 0; encounter.flightFrom = { ...agent.position };
      this.clearThreats(); this.burlyFrame(agent, 0, tick); return state.lastText;
    }
    return burlyText(encounter);
  }
  burlyDodge(agent: AgentState, tick: number): string | undefined {
    const state = this.state;
    if (state?.scene !== 'm2_burly' || !this.controls(agent) || state.visiting || state.burly?.phase !== 'grapple') return undefined;
    const encounter = state.burly; encounter.phase = 'swarm'; encounter.elapsed = 0; encounter.assimilation = 0; encounter.nextCopyAt = tick + BURLY.copyInterval;
    const smith = this.world.agents.get('smith'); if (smith && !smith.controller) smith.currentAction = { type: 'idle', parameters: { filmDuel: true }, startedAt: tick, duration: 100000, progress: 0 };
    this.spawnBurlyCopies(agent, tick, BURLY.initialCopies);
    state.lastText = 'Neo 挣脱了按进胸口的手；黑色代码退去，四周的 Smith 却继续复制。';
    return state.lastText;
  }
  burlyContact(agent: AgentState, tick: number): boolean {
    const encounter = this.state?.scene === 'm2_burly' && this.controls(agent) ? this.state.burly : undefined;
    if (!encounter || !['swarm', 'staff_ready', 'staff', 'flight_ready'].includes(encounter.phase)) return false;
    encounter.assimilation = Math.min(100, encounter.assimilation + 12);
    if (encounter.assimilation >= 100) return this.burlyFailed(agent, tick);
    this.state!.lastText = `Smith 的手掌碰到你，代码试图重写身体。同化 ${encounter.assimilation}%；用 X 闪避，别停在包围中心。`;
    return false;
  }
  burlyRepelled(agent: AgentState, tick: number): void {
    const encounter = this.state?.scene === 'm2_burly' && this.controls(agent) ? this.state.burly : undefined;
    if (!encounter || !['swarm', 'staff_ready', 'staff'].includes(encounter.phase)) return;
    encounter.repelled++;
    if (encounter.phase === 'swarm' && encounter.repelled >= BURLY.staffAfterRepels) encounter.phase = 'staff_ready';
    encounter.nextCopyAt = Math.min(encounter.nextCopyAt, tick + 2);
    this.state!.lastText = burlyText(encounter);
  }
  burlyStaffStrike(agent: AgentState, tick: number): void {
    const encounter = this.state?.scene === 'm2_burly' && this.controls(agent) ? this.state.burly : undefined;
    if (encounter?.phase !== 'staff') return;
    encounter.staffSwings++;
    if (encounter.staffSwings >= BURLY.escapeAfterSwings) {
      encounter.phase = 'flight_ready'; this.advance(burlyText(encounter), agent, tick);
    } else this.state!.lastText = burlyText(encounter);
  }
  burlyFailed(agent: AgentState, tick: number): boolean {
    const state = this.state;
    if (state?.scene !== 'm2_burly' || !this.controls(agent) || !state.burly || state.burly.phase === 'done') return false;
    const encounter = state.burly; encounter.phase = 'failed'; encounter.elapsed = 0; encounter.attempt++;
    this.clearThreats(); delete state.fighting;
    agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
    agent.position = filmPosition(this.scene!.set, 0, 10); agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    state.checkpoint = { ...agent.position }; state.lastText = burlyText(encounter); this.stageCast();
    return true;
  }
  private retryBurly(agent: AgentState, tick: number): string {
    const state = this.state!; const old = this.burlyEncounter(tick);
    const escape = state.step === 1 || old.phase === 'flight' || old.phase === 'flight_ready';
    this.clearThreats(); agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
    agent.position = filmPosition(this.scene!.set, 0, escape ? -28 : 10); agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    state.step = escape ? 1 : 0; state.burly = { phase: escape ? 'flight_ready' : 'ready', elapsed: 0, attempt: old.attempt + 1,
      repelled: escape ? old.repelled : 0, staffSwings: escape ? old.staffSwings : 0, assimilation: 0, nextCopyAt: tick + BURLY.copyInterval };
    state.checkpoint = { ...agent.position }; state.lastText = burlyText(state.burly); delete state.fighting;
    this.stageCast(); return state.lastText;
  }
  private chateauEncounter(): ChateauEncounter {
    return this.state!.chateau ??= { phase: 'ready', wave: 1, parries: 0, disarms: 0, attempts: 0, wounded: false };
  }
  restoreChateauSpace(): void {
    const state = this.state;
    if (state?.scene !== 'm2_chateau' || state.chateau) return;
    state.chateau = { phase: state.step === 0 ? 'ready' : 'cleared', wave: state.step === 0 ? 1 : 2,
      parries: 0, disarms: 0, attempts: 0, wounded: false };
    this.sandbox().threats = this.sandbox().threats.filter(threat => threat.scene !== 'm2_chateau');
    if (state.step !== 0) return;
    const actor = this.world.agents.get(state.actor);
    if (!actor) return;
    actor.position = filmPosition('film_chateau_hall', 0, 10); actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null;
    actor.status = 'alive'; actor.health = actor.maxHealth; state.checkpoint = { ...actor.position };
    delete state.started; delete state.fighting;
    state.lastText = '已从旧存档接回城堡大厅。走到中央重新迎战，墙上兵器可以取用。';
  }
  private spawnChateau(agent: AgentState, tick: number): void {
    const encounter = this.chateauEncounter();
    for (const guard of CHATEAU.waves[encounter.wave - 1]) {
      const position = filmPosition(this.scene!.set, guard.x, guard.z);
      position.y = groundHeight(position, true);
      this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`, scene: 'm2_chateau', kind: 'agent', weapon: guard.weapon,
        position, matrix: true, health: 88, maxHealth: 88, target: agent.id, stunUntil: tick + 2, lastStrike: tick });
    }
    encounter.phase = 'duel'; this.state!.fighting = true;
  }
  private chateauAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const encounter = this.chateauEncounter();
    if (target !== 'act') return state.lastText;
    if (encounter.phase === 'failed') return this.retryChateau(agent, tick);
    if (encounter.phase === 'ready') {
      if (!this.near(agent, this.scene!.steps[0])) return '走到大厅中央，掩护钥匙匠一行离开。';
      this.spawnChateau(agent, tick); encounter.volleyAt = tick;
      state.lastText = 'Merovingian 的人开枪。Neo 伸手截住子弹；守卫拔出墙上的古兵器。两侧武器架可以按 G 取剑或长矛。';
      return state.lastText;
    }
    for (const weapon of ['sword', 'spear'] as const) {
      const rack = CHATEAU.racks[weapon];
      if (distance(agent.position, filmPosition(this.scene!.set, rack.x, rack.z)) > 4) continue;
      encounter.weapon = weapon; this.chateauAction(agent);
      state.lastText = weapon === 'sword' ? '从左墙取下长剑。X 在敌人起手时格挡，F 趁破绽缴械。' : '换上右墙长矛。保持正面距离，X 格挡后用 F 反击。';
      return state.lastText;
    }
    return encounter.phase === 'landing' ? '沿左或右楼梯上到二层平台，挡住最后两名守卫。' : '先靠近两侧墙上的兵器架取剑或长矛；看见红色起手时按 X 格挡。';
  }
  chateauAction(agent: AgentState): void {
    const encounter = this.state?.scene === 'm2_chateau' && !this.state.visiting && this.controls(agent) ? this.state.chateau : undefined;
    if (encounter && agent.currentAction) agent.currentAction.parameters.chateauWeapon = encounter.weapon;
  }
  chateauParry(agent: AgentState, tick: number): string | undefined {
    const encounter = this.state?.scene === 'm2_chateau' && this.controls(agent) && !this.state.visiting ? this.state.chateau : undefined;
    if (encounter?.phase !== 'duel') return undefined;
    const guard = this.sandbox().threats.find(threat => threat.scene === 'm2_chateau' && threat.attackAt !== undefined && threat.weapon
      && meleeReach(agent.position, agent.rotation, threat.position, 4.4, true, this.sandbox().structures));
    if (!guard) return undefined;
    guard.attackAt = undefined; guard.stunUntil = tick + 5; guard.openingUntil = tick + 5; encounter.parries++;
    this.state!.lastText = `${guard.weapon === 'mace' ? '重锤' : guard.weapon === 'axe' ? '战斧' : guard.weapon === 'spear' ? '长矛' : '长剑'}被格开。现在按 F 反击；持械守卫会挡下贸然出拳。`;
    return this.state!.lastText;
  }
  chateauStrike(agent: AgentState, guard: SandboxThreat, tick: number): number | undefined {
    const encounter = this.state?.scene === 'm2_chateau' && this.controls(agent) && !this.state.visiting ? this.state.chateau : undefined;
    if (!encounter || guard.scene !== 'm2_chateau') return undefined;
    if (!encounter.weapon) { this.state!.lastText = '徒手无法拆开这群守卫的兵器防线。先从墙上取一件兵器。'; return 0; }
    if (guard.weapon && (guard.openingUntil ?? -1) < tick) { this.state!.lastText = '守卫架住了正面攻击。等红色起手出现，按 X 格挡再用 F 反击。'; return 0; }
    const damage = encounter.weapon === 'sword' ? 52 : 44;
    if (guard.weapon) { guard.weapon = undefined; encounter.disarms++; this.state!.lastText = '兵刃相撞，守卫的武器脱手。趁他失去防线继续进攻。'; }
    else this.state!.lastText = '守卫退向大厅边缘。保持朝向，继续压制。';
    return damage;
  }
  private chateauTick(agent: AgentState, tick: number): void {
    const state = this.state!; const encounter = this.chateauEncounter();
    if (state.step !== 0) return;
    if (encounter.phase === 'duel' && !this.sandbox().threats.some(threat => threat.scene === 'm2_chateau')) {
      if (encounter.wave === 1) {
        encounter.phase = 'landing'; state.fighting = false;
        state.lastText = '大厅下层已清开。Merovingian 退向楼上；沿双楼梯追到二层平台。';
        state.checkpoint = { ...agent.position };
      } else {
        encounter.phase = 'cleared'; state.fighting = false;
        this.advance('最后的守卫倒下。Merovingian 穿过二层门扉；Neo 追上去，却看见门后空间开始错位。', agent, tick);
      }
    }
    if (encounter.phase === 'landing' && distance(agent.position, filmStepPosition(this.scene!, this.scene!.steps[1])) <= 5) {
      encounter.wave = 2; this.spawnChateau(agent, tick); state.checkpoint = { ...agent.position };
      state.lastText = '二层平台的两名守卫从雕花门旁包抄。利用楼梯和长兵器挡住他们。';
    }
  }
  chateauFailed(agent: AgentState, tick: number): boolean {
    const state = this.state;
    if (state?.scene !== 'm2_chateau' || !this.controls(agent) || state.step !== 0 || !state.chateau) return false;
    const encounter = state.chateau; encounter.phase = 'failed'; encounter.attempts++;
    this.clearThreats(); delete state.fighting;
    agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
    agent.position = encounter.wave === 1 ? filmPosition(this.scene!.set, 0, 10) : filmStepPosition(this.scene!, this.scene!.steps[1]);
    agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    state.checkpoint = { ...agent.position }; state.lastText = '守卫合围，Neo 暂时退回安全位置。按 G 重试当前楼层，已夺取的兵器保留。';
    return true;
  }
  private retryChateau(agent: AgentState, tick: number): string {
    const state = this.state!; const encounter = this.chateauEncounter();
    this.clearThreats(); agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
    agent.position = encounter.wave === 1 ? filmPosition(this.scene!.set, 0, 10) : filmStepPosition(this.scene!, this.scene!.steps[1]);
    agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    encounter.phase = encounter.wave === 1 ? 'ready' : 'landing'; delete state.fighting;
    state.checkpoint = { ...agent.position }; state.lastText = encounter.wave === 1 ? '再走进大厅中央迎战；兵器架仍在两侧。' : '再上二层平台迎战剩余守卫。';
    return state.lastText;
  }
  mountainFrame(agent: AgentState, input: Pick<PlayerInput, 'x' | 'z' | 'yaw' | 'jump' | 'sprint'>, dt: number, tick: number): boolean {
    const state = this.state;
    if (state?.scene !== 'm2_mountain' || state.visiting || !this.controls(agent)) return false;
    const flight = state.mountain;
    if (!flight || state.step !== 2 && flight.phase !== 'arrived') return false;
    if (flight.phase === 'ready') {
      if (!input.jump || !this.near(agent, this.scene!.steps[2])) return false;
      flight.phase = 'takeoff'; flight.elapsed = 0;
      flight.x = agent.position.x - FILM_SETS[this.scene!.set].center.x;
      flight.z = agent.position.z - FILM_SETS[this.scene!.set].center.z;
      flight.altitude = 0;
      state.lastText = 'Neo 冲离雪地。按住 W 向南飞，A / D 调整航线，Shift 加速。';
    }
    const delta = Math.max(0, Math.min(.1, dt));
    if (flight.phase === 'takeoff') {
      flight.elapsed += delta;
      const rise = Math.min(1, flight.elapsed / MOUNTAIN.ascent);
      flight.altitude = MOUNTAIN.altitude * rise * rise * (3 - 2 * rise);
      flight.z -= delta * 8;
      if (rise >= 1) { flight.phase = 'flying'; flight.elapsed = 0; }
    } else if (flight.phase === 'flying') {
      flight.elapsed += delta;
      flight.x = Math.max(-115, Math.min(115, flight.x + input.x * 25 * delta));
      flight.z = Math.max(MOUNTAIN.destinationZ, Math.min(MOUNTAIN.launch.z, flight.z + input.z * MOUNTAIN.speed * (input.sprint ? 1.4 : 1) * delta));
      flight.altitude = MOUNTAIN.altitude + Math.sin(flight.elapsed * 2.6) * .45;
      if (flight.z <= MOUNTAIN.destinationZ) {
        flight.phase = 'arrived'; this.advance('雪山退到身后。Neo 已锁定城市方向，继续追赶高速公路上的同伴。', agent, tick);
      } else if (flight.elapsed >= MOUNTAIN.deadline) {
        flight.phase = 'failed'; flight.attempt++;
        agent.position = filmPosition(this.scene!.set, MOUNTAIN.launch.x, MOUNTAIN.launch.z);
        agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
        state.lastText = '航线失去方向。Neo 回到城堡外的起飞点；Link 的方位仍记得。按 G 重试。';
        return true;
      }
    }
    if (flight.phase === 'failed') return false;
    agent.position = { ...filmPosition(this.scene!.set, flight.x, flight.z), y: FILM_SETS[this.scene!.set].center.y + flight.altitude };
    agent.velocity = { x: input.x * 25, y: 0, z: input.z * MOUNTAIN.speed };
    if (Math.hypot(input.x, input.z) > .1) agent.rotation = Math.atan2(input.x, input.z);
    agent.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, mountainFlight: { ...flight } }, startedAt: tick, duration: 1, progress: 0 };
    if (flight.phase === 'flying') state.lastText = `向南飞往城市 · 已离开山口 ${Math.round(MOUNTAIN.launch.z - flight.z)} / ${MOUNTAIN.launch.z - MOUNTAIN.destinationZ} 米 · 剩余 ${Math.max(0, Math.ceil(MOUNTAIN.deadline - flight.elapsed))} 秒`;
    return true;
  }
  private retryMountain(agent: AgentState): string {
    const state = this.state!; const flight = state.mountain!;
    flight.phase = 'ready'; flight.elapsed = 0; flight.x = MOUNTAIN.launch.x; flight.z = MOUNTAIN.launch.z; flight.altitude = 0;
    agent.position = filmPosition(this.scene!.set, flight.x, flight.z);
    agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
    state.checkpoint = { ...agent.position }; state.lastText = 'Link 的方位仍在：城市位于正南。站在山崖边按 Space 再次起飞。';
    return state.lastText;
  }
  climbing(agent: AgentState): boolean { return this.controls(agent) && !this.state?.visiting && this.state?.scene === 'm1_ledge' && this.state.step === 1 && this.state.office?.climbed !== undefined; }
  climbFrame(agent: AgentState, direction: number, dt: number, tick: number): boolean {
    if (this.openingHotel.climbFrame(agent, direction, dt, tick)) return true;
    if (!this.climbing(agent)) return false;
    const state = this.state!; const office = state.office!;
    office.climbed = Math.max(0, Math.min(OFFICE_LADDER.depth, office.climbed! + direction * Math.min(.1, dt) * OFFICE_LADDER.speed));
    agent.position = filmPosition(this.scene!.set, OFFICE_LADDER.x, OFFICE_LADDER.z); agent.position.y -= office.climbed;
    agent.rotation = Math.PI / 2; agent.velocity = { x: 0, y: -direction * OFFICE_LADDER.speed, z: 0 };
    agent.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, climbing: true, climbDirection: direction }, startedAt: tick, duration: 1, progress: 0 };
    if (office.climbed >= OFFICE_LADDER.depth) {
      office.outcome = 'escaped'; office.bugged = false; delete office.climbed;
      agent.position.x = FILM_SETS[this.scene!.set].center.x; agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
      this.sandbox().neoLife!.choices.office_escape = 'escaped';
      this.advance('你沿维修梯抵达安全楼层，摆脱搜索。Morpheus 会再次联系，安排桥下接头。', agent, tick);
    }
    return true;
  }
  truckFrame(agent: AgentState, dt: number, tick: number): boolean {
    const state = this.state;
    if (state?.scene !== 'm2_trucks' || state.visiting || !this.controls(agent) || state.trucks?.phase !== 'rescue') return false;
    const rescue = state.trucks;
    rescue.rescueElapsed = Math.min(TRUCKS.rescueSeconds, (rescue.rescueElapsed ?? 0) + Math.max(0, Math.min(.1, dt)));
    const t = rescue.rescueElapsed / TRUCKS.rescueSeconds;
    const progress = t * t * (3 - 2 * t);
    const origin = rescue.origin ?? { x: TRUCKS.keymaker.x, z: TRUCKS.keymaker.z };
    const base = FILM_SETS[this.scene!.set].center;
    const x = origin.x + (20 - origin.x) * progress;
    const z = origin.z + (46 - origin.z) * progress;
    const y = t >= 1 ? base.y : base.y + TRUCKS.roof.height * (1 - progress) + 11 * Math.sin(Math.PI * progress);
    const passengers = [
      [agent, 0, 0, 0, 'morpheus'],
      [this.world.agents.get('keymaker'), -1.5, 1, 0, 'keymaker'],
      [this.world.agents.get('neo'), 1.4, -1, .8, 'neo'],
    ] as const;
    for (const [passenger, dx, dz, dy, role] of passengers) {
      if (!passenger || role !== 'morpheus' && passenger.controller) continue;
      const before = { ...passenger.position };
      passenger.position = { x: base.x + x + dx * progress, y: t >= 1 ? base.y : y + dy * Math.sin(Math.PI * progress), z: base.z + z + dz * progress };
      passenger.velocity = dt > 0 ? { x: (passenger.position.x - before.x) / dt, y: (passenger.position.y - before.y) / dt, z: (passenger.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      passenger.rotation = Math.atan2(20 - origin.x, 46 - origin.z);
      passenger.currentAction = { type: 'move_to', parameters: { resolved: true, player: role === 'morpheus', truckFlight: role === 'neo', truckPassenger: role !== 'neo' }, startedAt: tick, duration: 1, progress: t };
    }
    state.checkpoint = { ...agent.position };
    state.lastText = 'Neo 接住 Morpheus 与钥匙匠，带两人离开相撞的卡车。';
    if (t >= 1) {
      rescue.phase = 'rescued';
      for (const [passenger] of passengers) if (passenger) { passenger.velocity = { x: 0, y: 0, z: 0 }; passenger.currentAction = null; }
      this.advance('两辆卡车迎面相撞；Neo 在爆炸前接住 Morpheus 与钥匙匠，三人安全落地。', agent, tick);
    }
    return true;
  }
  driving(agent: AgentState): boolean { return this.controls(agent) && !this.state?.visiting && ((this.state?.scene === 'm2_freeway' && this.state.ride?.phase === 'riding') || (this.state?.scene === 'm2_garage' && this.state.garage?.phase === 'riding')); }
  driveFrame(agent: AgentState, input: DriveInput, dt: number, tick: number): boolean {
    if (!this.driving(agent)) return false;
    if (this.state!.scene === 'm2_garage') {
      const state = this.state!; const before = state.garage!;
      const escape = state.garage = stepGarageEscape(before, input, dt);
      agent.position = { ...filmPosition(this.scene!.set, escape.x - 1.05, escape.z), y: FILM_SETS[this.scene!.set].center.y };
      agent.velocity = { x: escape.lateral, y: 0, z: -escape.speed };
      agent.rotation = Math.PI - Math.atan2(escape.lateral, Math.max(1, escape.speed));
      agent.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, riding: true, seated: true }, startedAt: tick, duration: 1, progress: 0 };
      for (const [id, x, z] of [['morpheus', 2.05, .2], ['keymaker', .1, 1.7]] as const) {
        const passenger = this.world.agents.get(id); if (!passenger || passenger.controller) continue;
        passenger.position = { ...agent.position, x: agent.position.x + x, z: agent.position.z + z };
        passenger.velocity = { ...agent.velocity }; passenger.rotation = agent.rotation;
        passenger.currentAction = { type: 'idle', parameters: { riding: true, passenger: true, seated: true }, startedAt: tick, duration: 1, progress: 0 };
      }
      for (let index = 0; index < 2; index++) {
        const twin = this.world.agents.get(`twin${index + 1}`);
        if (twin && !twin.controller) twin.currentAction = { type: 'idle', parameters: { ghostPhase: escape.elapsed < escape.ghostUntil[index] }, startedAt: tick, duration: 1, progress: 0 };
      }
      if (escape.twins !== before.twins) state.lastText = escape.hits === before.hits ? '双子在车头前化为白色残影，轿车直接穿过。保持速度，冲向出口。' : '车速太慢，双子的剃刀擦过车厢。加速或者绕开下一个拦截点。';
      else if (escape.hits > before.hits) state.lastText = '车身擦上混凝土护栏。稳住方向，别让钥匙匠受到第二次冲击。';
      if (escape.phase === 'wrecked') { agent.health = 0; agent.status = 'dead'; agent.velocity = { x: 0, y: 0, z: 0 }; state.lastText = '双子追上了车队。按 J 从轿车旁重试，之前的剧情仍会保留。'; }
      return true;
    }
    const state = this.state!; const before = state.ride!;
    const ride = state.ride = stepFreeway(before, input, dt);
    agent.position = { ...filmPosition(this.scene!.set, ride.x, ride.z), y: FILM_SETS[this.scene!.set].center.y + .65 };
    agent.velocity = { x: ride.lateral, y: 0, z: -ride.speed }; agent.rotation = Math.PI - Math.atan2(ride.lateral, Math.max(1, ride.speed));
    agent.currentAction = { type: 'move_to', parameters: { player: true, resolved: true, riding: true }, startedAt: tick, duration: 1, progress: 0 };
    const passenger = this.world.agents.get('keymaker');
    if (passenger && !passenger.controller) {
      passenger.position = { ...agent.position, z: agent.position.z + 1.25 };
      passenger.velocity = { ...agent.velocity }; passenger.rotation = agent.rotation;
      passenger.currentAction = { type: 'idle', parameters: { riding: true, passenger: true }, startedAt: tick, duration: 1, progress: 0 };
    }
    if (ride.hits > before.hits) state.lastText = '车身受到撞击。先松开油门或按 S 刹车，寻找下一条车道；钥匙匠仍在后座。';
    if (ride.phase === 'wrecked') { agent.health = 0; agent.status = 'dead'; agent.velocity = { x: 0, y: 0, z: 0 }; state.lastText = '摩托车无法继续。J 从护送开始处重试，之前的剧情仍然保留。'; }
    return true;
  }

  unavailable(id: string): boolean {
    const fate = this.state && filmCharacterFates(this.state)[id];
    // Bane remains active as Smith's host, unlike the programs consumed inside the Matrix.
    return Boolean(fate && fate !== 'alive' && !(id === 'bane' && fate === 'assimilated'));
  }
  private sealZionMessageDoor(): void {
    const id = 'film:zion:oracle-door';
    if (this.state?.scene === 'm2_oracle_message' && this.state.step === 0 && !this.state.visiting) {
      if (!this.sandbox().structures.some(s => s.id === id)) this.sandbox().structures.push({ id, kind: 'barricade', owner: 'zion',
        position: filmPosition('film_zion_bedroom', 0, 17.6), matrix: false, health: 1,
        film: { scene: 'm2_oracle_message', width: 4.2, depth: .35, height: 8.8 } });
    } else this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== id);
  }
  reconcileCast(): void {
    if (!this.state) return;
    this.ensureHelDanceDoor(this.world.simulationTick);
    this.sealAmbush(); this.sealZionMessageDoor(); this.sealArchitectDoors(); this.sealHelElevator(); this.sealHelDanceDoor();
    const bane = this.world.agents.get('bane');
    if (bane) {
      const infected = Boolean(this.sandbox().neoLife?.choices.bane_infected || this.state.completed.includes('m2_bane_copy'));
      bane.faction = infected ? 'machines' : 'zion';
      bane.currentGoal = infected ? 'Find Neo without revealing Smith' : 'Return to Zion';
      bane.alertness = infected ? 8 : 3;
    }
    for (const [id, fate] of Object.entries(filmCharacterFates(this.state))) {
      const actor = this.world.agents.get(id);
      if (!actor || actor.controller || id === 'bane' && fate === 'assimilated') continue;
      actor.status = fate === 'alive' ? 'alive' : fate === 'dead' ? 'dead' : 'disconnected';
      actor.health = fate === 'alive' ? actor.maxHealth : 0;
      actor.currentAction = null; actor.targetPosition = null; actor.currentPath = []; actor.velocity = { x: 0, y: 0, z: 0 };
    }
  }
  releaseCast(reset = false): void {
    if (reset) this.sandbox().structures = this.sandbox().structures.filter(s => !s.film);
    for (const id of FILM_CAST) {
      const actor = this.world.agents.get(id);
      if (!actor || actor.controller || !reset && !FILM_SETS[actor.currentLocation]) continue;
      actor.currentLocation = CHARACTERS[id].initialLocation; actor.position = locationEntrance(actor.currentLocation);
      actor.isInMatrix = LOCATIONS[actor.currentLocation].world === 'matrix'; actor.status = 'alive'; actor.health = actor.maxHealth;
      actor.currentAction = null; actor.targetPosition = null; actor.currentPath = []; actor.velocity = { x: 0, y: 0, z: 0 }; actor.activeEffects = [];
      if (reset && id === 'bane') { actor.faction = 'zion'; actor.currentGoal = 'Return to Zion'; actor.alertness = 3; }
    }
    if (!reset) this.reconcileCast();
  }

  persephoneFrame(agent: AgentState, dt: number, tick: number): boolean {
    const state = this.state;
    if (state?.scene !== 'm2_persephone' || state.visiting || !this.controls(agent) || state.persephone?.phase !== 'enacting') return false;
    const encounter = state.persephone;
    if (['persephone', 'trinity'].some(id => this.world.agents.get(id)?.controller)) {
      state.lastText = '另一位玩家正在控制这段交谈中的人物。动作停在当前一拍。'; return true;
    }
    encounter.elapsed = Math.min(EXILES.exchangeSeconds, encounter.elapsed + Math.max(0, Math.min(.1, dt)));
    const memory = encounter.route === 'memory';
    const neo = filmPosition(this.scene!.set, 22.1, 21.8);
    agent.position = neo; agent.rotation = memory ? .9 : 1.5; agent.velocity = { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, persephone: { ...encounter, role: 'neo' } }, startedAt: tick, duration: 1, progress: 0 };
    const persephone = this.world.agents.get('persephone')!;
    if (!persephone.controller) {
      persephone.position = filmPosition(this.scene!.set, 23.4, 22.5); persephone.rotation = -.9;
      persephone.currentAction = { type: 'idle', parameters: { resolved: true, persephone: { ...encounter, role: 'persephone' } }, startedAt: tick, duration: 1, progress: 0 };
    }
    state.checkpoint = { ...agent.position };
    if (encounter.elapsed < EXILES.exchangeSeconds) return true;
    agent.currentAction = null; persephone.currentAction = null;
    if (memory && encounter.attempts === 0) {
      encounter.phase = 'reconsider'; encounter.attempts = 1; encounter.elapsed = 0;
      state.lastText = '第一次只是敷衍的交换。Persephone 后退，Trinity 仍在旁边看着你；认真回应，或重新提出自己的条件。';
      return true;
    }
    encounter.phase = 'agreed'; encounter.elapsed = 0;
    const choice = memory ? 'memory' : 'appeal';
    this.sandbox().neoLife!.choices.persephone_route = choice;
    const response = memory ? 'Neo 想起 Trinity，第二次没有把这当成手续。Trinity 明显不悦，但 Persephone 决定带路。'
      : 'Neo 拒绝把亲密变成赎金，承认 Persephone 有权自己决定。她听见有人第一次问她想做什么，选择背离丈夫。';
    this.advance(response, agent, tick);
    return true;
  }
  private persephoneAct(agent: AgentState, target: string, tick: number): string {
    const state = this.state!; const encounter = state.persephone!;
    if (!this.near(agent, this.step!)) return '先走近 Persephone，在盥洗室里回应。';
    if (encounter.phase === 'enacting') return state.lastText;
    if (target !== 'persephone:memory' && target !== 'persephone:appeal') return '打开 J 手记，亲自回应她提出的条件。';
    if (['persephone', 'trinity'].some(id => this.world.agents.get(id)?.controller)) return '这段交谈中的人物正由另一位玩家控制，等待对方离开再继续。';
    if (target === 'persephone:appeal' && this.sandbox().neoLife!.choices['m2_merovingian:2'] !== 'care') {
      encounter.phase = 'reconsider';
      return state.lastText = '你试着请求她自行带路，但刚才在餐桌上没有正面回应她被当成工具的处境。她不接受这套说辞；可以重新考虑电影中的条件。';
    }
    encounter.phase = 'enacting'; encounter.route = target === 'persephone:memory' ? 'memory' : 'appeal'; encounter.elapsed = 0;
    state.lastText = encounter.route === 'memory' ? 'Neo 走近她，Trinity 抬眼看着两人。' : 'Neo 停下，先把选择还给 Persephone。';
    this.persephoneFrame(agent, 0, tick); return state.lastText;
  }
  keymakerFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
    if (state?.scene !== 'm2_library' || state.visiting || !this.controls(agent) || !state.keymaker) return;
    this.sealKeymakerDoor();
    const encounter = state.keymaker; const captive = this.world.agents.get('keymaker')!;
    if (captive.controller) { state.lastText = '钥匙匠正由另一位玩家控制，营救进度停在原处。'; return; }
    if (encounter.phase === 'following' && dt > 0) {
      const x = agent.position.x - FILM_SETS[this.scene!.set].center.x;
      const z = agent.position.z - FILM_SETS[this.scene!.set].center.z;
      const gap = Math.hypot(x - encounter.x, z - encounter.z);
      if (gap > EXILES.followRange) encounter.separated += Math.min(.1, dt);
      else encounter.separated = Math.max(0, encounter.separated - dt * 2);
      if (encounter.separated >= 7) {
        encounter.phase = 'revealed'; encounter.x = EXILES.keymaker.x; encounter.z = EXILES.keymaker.z;
        encounter.separated = 0; encounter.setbacks++; state.step = 3;
        agent.position = filmPosition(this.scene!.set, EXILES.bookshelf.x, EXILES.bookshelf.z + 3);
        agent.velocity = { x: 0, y: 0, z: 0 }; state.checkpoint = { ...agent.position };
        state.lastText = '你走得太远。看守把钥匙匠重新带回工作台；从已打开的暗门再次接应他。';
      } else if (gap > 2.7 && gap <= EXILES.followRange) {
        const length = Math.min(gap - 2.7, EXILES.followSpeed * Math.min(.1, dt));
        const crossingBookcase = encounter.z < EXILES.bookshelf.z - 1 && z > EXILES.bookshelf.z;
        const throughDoor = crossingBookcase && Math.hypot(encounter.x - EXILES.bookshelf.x, encounter.z - (EXILES.bookshelf.z - 1)) < 1.3;
        const goalX = crossingBookcase && !throughDoor ? EXILES.bookshelf.x : x;
        const goalZ = crossingBookcase && !throughDoor ? EXILES.bookshelf.z - 1 : z;
        const toGoal = Math.hypot(goalX - encounter.x, goalZ - encounter.z);
        const stride = Math.min(length, toGoal);
        if (toGoal > 0) { encounter.x += (goalX - encounter.x) / toGoal * stride; encounter.z += (goalZ - encounter.z) / toGoal * stride; }
        captive.rotation = Math.atan2(goalX - encounter.x, goalZ - encounter.z);
      }
    }
    captive.position = filmPosition(this.scene!.set, encounter.x, encounter.z);
    captive.currentLocation = this.scene!.set; captive.isInMatrix = true; captive.status = 'alive'; captive.velocity = { x: 0, y: 0, z: 0 };
    captive.currentAction = { type: 'idle', parameters: { resolved: true, keymakerEscort: encounter.phase }, startedAt: tick, duration: 1, progress: 0 };
  }
  private sealKeymakerDoor(): void {
    const id = 'film:library:bookdoor'; const state = this.state;
    if (state?.scene !== 'm2_library' || state.visiting || state.step >= 3) {
      this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== id); return;
    }
    if (!this.sandbox().structures.some(s => s.id === id)) this.sandbox().structures.push({ id, kind: 'barricade', owner: 'matrix',
      position: filmPosition('film_keymaker_workshop', EXILES.bookshelf.x, EXILES.bookshelf.z), matrix: true, health: 999,
      film: { scene: 'm2_library', width: 5, depth: .6, height: 13 } });
  }
  private sourceDoor(): void {
    const state = this.state!;
    const former = FILM_SETS.film_backdoor_hall.center; const current = FILM_SETS.film_source_corridor.center;
    const inFormer = (position: typeof state.checkpoint) => Math.abs(position.x - former.x) < 60 && Math.abs(position.z - former.z) < 100;
    const migrate = (position: typeof state.checkpoint) => ({ x: position.x + current.x - former.x, y: position.y + current.y - former.y, z: position.z + current.z - former.z });
    for (const id of [state.actor, ...this.scene!.cast]) {
      const agent = this.world.agents.get(id);
      if (!agent || agent.currentLocation !== 'film_backdoor_hall' && (agent.currentLocation !== 'film_source_corridor' || !inFormer(agent.position))) continue;
      agent.position = migrate(agent.position); agent.currentLocation = 'film_source_corridor';
    }
    if (inFormer(state.checkpoint)) state.checkpoint = migrate(state.checkpoint);
    if (state.returnPosition && inFormer(state.returnPosition)) state.returnPosition = migrate(state.returnPosition);
    if (!state.keyDoor) {
      // The old two-step hallway save had already reached its only door at step 1.
      if (state.step >= 2) state.step = FILM_SCENE_BY_ID.m2_key_door.steps.length;
      else if (state.step === 1) { state.step = 3; delete state.started; }
      state.keyDoor = { portalOpened: state.step >= 4, keyTaken: state.step >= 5 };
    }
    this.sealSourceDoor();
    if (state.keyDoor.keyTaken) {
      const keymaker = this.world.agents.get('keymaker');
      if (keymaker && !keymaker.controller) { keymaker.status = 'dead'; keymaker.health = 0; keymaker.currentAction = null; }
    }
  }
  private sealSourceDoor(): void {
    const state = this.state; const prefix = 'film:keydoor:';
    if (state?.scene !== 'm2_key_door' || state.visiting) {
      this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith(prefix)); return;
    }
    const closed = !state.keyDoor?.portalOpened;
    this.sandbox().structures = this.sandbox().structures.filter(s => !s.id.startsWith(prefix) || s.id !== `${prefix}portal` || closed);
    const barriers: [string, number, number][] = [['left', -8.7, 10.6], ['right', 8.7, 10.6]];
    if (closed) barriers.push(['portal', 0, 6.8]);
    for (const [id, x, width] of barriers) {
      const existing = this.sandbox().structures.find(s => s.id === `${prefix}${id}`);
      if (existing) { existing.position = filmPosition('film_source_corridor', x, -39); continue; }
      this.sandbox().structures.push({ id: `${prefix}${id}`, kind: 'barricade', owner: 'matrix',
        position: filmPosition('film_source_corridor', x, -39), matrix: true, health: 999,
        film: { scene: 'm2_key_door', width, depth: .6, height: 12 } });
    }
  }

  command(agent: AgentState, target: string, tick: number): string {
    const life = this.sandbox().neoLife;
    if (!life) return '先以 Neo 开始生活，再追查异常。';
    if (target === 'start' || target === 'continue') {
      if (agent.id !== 'neo' || this.state) return '电影进度已经存在，请继续当前场景。';
      if (target === 'start' && life.deferredContact) return '已经保留了白兔的邀请，请继续这段联系，或继续日常生活。';
      if (!life.chapter) return '先在日常生活中调查异常，与 Trinity 建立联系。';
      if (life.activity || this.sandbox().threats.some(t => t.target === agent.id)) return '先结束当前活动或战斗。';
      if (target === 'continue' && life.chapter === 1 && life.contactSignal && (!agent.isInMatrix || distance(agent.position, lifeRoomCenter('neo_apartment')!) > 12)) return '线索留在家里的电脑上。先回公寓，再决定继续调查。';
      if (target === 'continue' && life.deferredContact) {
        life.journey = life.deferredContact; delete life.deferredContact;
        this.place(agent, this.scene!, { ...life.journey.checkpoint }); this.apartmentFrame(agent, 0, tick);
        return '回到已经核对的白兔线索。先前的交易与选择都保留。';
      }
      const first = target === 'start' ? FILM_SCENES[0] : FILM_SCENES.find(s => s.actor === 'neo' && s.chapter === NEO_CHAPTERS[life.chapter].id) ?? FILM_SCENE_BY_ID.m1_wake_up;
      if (!this.changeActor(agent, first.actor, tick)) return 'Trinity 正在由另一位玩家控制，稍后再接入序幕。';
      life.journey = { version: 1, scene: first.id, step: 0, actor: first.actor, completed: [], enteredAt: tick, reflections: {}, lastText: first.context, checkpoint: filmEntry(first) };
      this.enter(first, tick);
      return `${first.actor === 'neo' ? '继续 Neo 的故事。生活记录与物品已保留。' : '可选序幕从 Trinity 开始。'}WASD 移动，G 互动，J 查看故事。`;
    }
    const state = this.state;
    if (!state || !this.scene) return '这条电影进度尚未开始。';
    if (target === 'resume' && agent.id === 'neo' && agent.id !== state.actor) {
      if (!this.changeActor(agent, state.actor, tick)) return '当前剧情角色正在由另一位玩家控制。';
      return '已继续保存的剧情视角与位置。';
    }
    if (!this.controls(agent)) return '请接入当前剧情角色，或以 Neo 继续电影进度。';
    this.ensureHelBargain(tick);
    this.ensureFinale(tick);
    if (state.scene === 'm2_key_door' && !state.visiting) this.sourceDoor();
    if (state.scene === 'm2_architect' && !state.visiting) { this.architect(tick); this.sealArchitectDoors(); }
    if (target === 'return' && state.visiting) {
      agent.position = { ...(state.returnPosition ?? state.checkpoint) }; agent.currentLocation = this.scene.set;
      agent.isInMatrix = FILM_SETS[this.scene.set].world === 'matrix';
      delete state.visiting; delete state.returnPosition; this.stageCast();
      return '已回到原来的剧情检查点。';
    }
    if (target.startsWith('visit:')) {
      const visited = FILM_SCENE_BY_ID[target.slice(6)];
      if (!visited || !state.completed.includes(visited.id)) return '完成这个场景后才能回访。';
      if (state.fighting || state.started !== undefined || state.ride?.phase === 'riding' || state.garage?.phase === 'riding' || state.shipLoss?.phase === 'evacuating' || state.tunnel?.phase === 'sensing' || this.climbing(agent) || this.performing(agent)) return '先完成当前战斗或互动，再回访场景。';
      if (!state.visiting) state.returnPosition = { ...agent.position };
      state.visiting = visited.id; this.place(agent, visited, filmEntry(visited));
      return `回访${FILM_SETS[visited.set].name}。J 可返回当前剧情，回访不会改写进度。`;
    }
    if (target === 'retry') {
      if (this.reloaded.active(agent)) return this.reloaded.command(agent, target, tick);
      if (this.catch.active(agent)) return this.catch.command(agent, target, tick);
      if (state.scene === 'm1_room303' && (state.openingHotel?.phase === 'failed' || agent.status !== 'alive')) return this.openingHotel.retry(agent, tick);
      if (state.scene === 'm1_roofs' && state.openingRoof?.phase === 'failed') {
        state.openingRoof = { phase: 'running', lastTick: tick, attempts: state.openingRoof.attempts + 1 };
        state.step = 0; state.checkpoint = filmEntry(this.scene); delete state.started;
        this.place(agent, this.scene, state.checkpoint);
        const brown = this.world.agents.get('agent_brown');
        if (brown && !brown.controller) {
          this.place(brown, this.scene, filmPosition(this.scene.set, 0, 43));
          brown.rotation = Math.PI; brown.currentAction = null;
        }
        return state.lastText = '回到屋顶入口。Brown 正从身后赶来；穿过通风设施，在楼间空隙前助跑起跳。';
      }
      if (state.scene === 'm1_phone_escape' && state.openingPhone?.phase === 'failed') {
        state.openingPhone = { phase: 'running', remaining: OPENING_ESCAPE.phoneSeconds, lastTick: tick, attempts: state.openingPhone.attempts + 1 };
        state.step = 0; state.checkpoint = filmEntry(this.scene); delete state.started;
        this.place(agent, this.scene, state.checkpoint);
        return state.lastText = '线路重新响起，卡车正在掉头。Shift 奔跑，到电话亭后立即按 G 接起。';
      }
      if (state.scene === 'm3_hel_bargain' && state.helBargain?.phase === 'failed') {
        state.helBargain = { phase: 'ready', elapsed: 0, lastTick: tick, attempts: state.helBargain.attempts + 1 };
        state.step = 3; agent.status = 'alive'; agent.health = agent.maxHealth;
        agent.position = filmStepPosition(this.scene!, this.scene!.steps[3]); agent.rotation = Math.PI;
        agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
        state.checkpoint = { ...agent.position };
        state.lastText = '回到舞池包围圈。之前的拒绝仍保留；按 G 再次突围。'; return state.lastText;
      }
      if (state.scene === 'm2_ship_lost' && state.shipLoss?.phase === 'failed') {
        state.shipLoss = { phase: 'evacuating', remaining: RELOADED_FINALE.evacuationSeconds, lastTick: tick, attempts: state.shipLoss.attempts + 1 };
        agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 };
        state.lastText = '从弃船命令检查点重试。带同伴穿过船尾货舱，别回去启动无效的 EMP。'; return state.lastText;
      }
      if (state.scene === 'm2_stop_sentinels' && state.tunnel?.phase === 'failed') {
        state.tunnel = { phase: 'sensing', remaining: RELOADED_FINALE.sentinelSeconds, focus: 0, lastTick: tick, attempts: state.tunnel.attempts + 1 };
        agent.position = { ...state.checkpoint }; agent.rotation = 0; agent.velocity = { x: 0, y: 0, z: 0 };
        state.lastText = '回到隧道窄口。面朝哨兵，按住 G 聚焦；现实中的能力会使 Neo 昏迷。'; return state.lastText;
      }
      if (state.scene === 'm2_architect' && state.architect?.phase === 'failed') {
        state.architect.phase = 'decision'; state.architect.remaining = ARCHITECT_DOOR_SECONDS;
        state.architect.lastTick = tick; state.architect.attempts++;
        agent.status = 'alive'; agent.health = agent.maxHealth;
        agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 };
        delete state.started;
        state.lastText = '抉择窗口已重置。屏幕、两扇门与之前的反思仍然保留；赶往左门救 Trinity。';
        return '已从建筑师房间的抉择检查点重试。';
      }
      if (state.scene === 'm2_burly') return this.retryBurly(agent, tick);
      if (state.scene === 'm3_hel_entry' && state.step === 1) {
        this.clearThreats(); this.coatcheck.reset(); delete state.fighting;
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        agent.position = filmStepPosition(this.scene!, this.scene!.steps[1]); agent.rotation = Math.PI;
        agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null; state.checkpoint = { ...agent.position };
        return state.lastText = '已回到衣帽间门口。五名守卫和弹药恢复，走近后按 G 再次突围。';
      }
      if (state.scene === 'm2_chateau' && state.step === 0) return this.retryChateau(agent, tick);
      if (state.scene === 'm2_mountain' && state.step === 2 && state.mountain) return this.retryMountain(agent);
      if (state.scene === 'm2_persephone' && state.persephone?.phase === 'enacting') {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.persephoneFrame(agent, 0, tick); return '已接回盥洗室，条件与动作进度均已保留。';
      }
      if (state.theOne && ['m1_death', 'm1_return', 'm1_final_call'].includes(state.scene)) return this.retryTheOne(agent, tick);
      if (state.government && ['m1_smith_question', 'm1_bullet_dodge'].includes(state.scene)) return this.retryGovernment(agent, tick);
      if (state.airRescue && ['m1_helicopter', 'm1_rooftop_rescue'].includes(state.scene)) return this.retryAirRescue(agent, tick);
      if (state.matrixEscape && ['m1_subway', 'm1_city_chase'].includes(state.scene)) return this.retryMatrixEscape(agent, tick);
      if (state.scene === 'm1_sentinels' && state.sentinel) {
        if (state.sentinel.phase === 'failed') return this.sentinelAct(agent, target, tick);
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.sentinelFrame(agent, { movement: 0, sprint: false, jump: false }, 0, tick);
        return '已接回静默航行，保留断电、扫描、噪声与船员位置。';
      }
      if (interludeKind(state.scene) && state.interlude) {
        delete state.visiting; delete state.returnPosition;
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 };
        this.interludeFrame(agent, 0, tick);
        return '已接回当前片段，保留人物位置、动作、对话与选择进度。';
      }
      if (state.scene === 'm1_oracle' && state.oracle?.consultation) {
        delete state.visiting; delete state.returnPosition;
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 };
        this.oracleFrame(agent, false, 0, tick);
        return '已接回先知厨房，保留花瓶、检查、饼干与回答进度。';
      }
      if (state.betrayal && ['m1_bathroom', 'm1_unplugged'].includes(state.scene)) {
        delete state.visiting; delete state.returnPosition; this.clearThreats(); this.clearBetrayalActions();
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 };
        if (state.betrayal.phase === 'failed' || state.betrayal.phase === 'defending') {
          state.betrayal = { kind: state.scene === 'm1_bathroom' ? 'bathroom' : 'unplugged', phase: 'ready', elapsed: 0,
            attempt: state.betrayal.attempt + 1, repels: 0, rescued: 0 };
          delete state.fighting;
        }
        this.betrayalFrame(agent, 0, tick);
        return state.scene === 'm1_bathroom' ? '已从浴室门线重试；撤离目标仍在，重新按 G 开始掩护。' : '已从备用控制台重试；拔线结果尚未结算，重新按 G 等待反击窗口。';
      }
      if (state.rescue && ['m1_rescue_decision', 'm1_guns'].includes(state.scene)) {
        delete state.visiting; delete state.returnPosition;
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 };
        this.rescueFrame(agent, 0, tick);
        return '已接回营救准备，保留方案核对、武器架和装备选择进度。';
      }
      if (state.scene === 'm1_club' && state.club) {
        delete state.visiting; delete state.returnPosition;
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.place(agent, this.scene, { ...state.checkpoint }); this.clubFrame(agent, 0, tick);
        return '已接回夜店，保留交谈、人物位置和已经作出的回应。';
      }
      if (state.scene === 'm1_wake_up' && state.contact) {
        delete state.visiting; delete state.returnPosition;
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.place(agent, this.scene, { ...state.checkpoint }); this.apartmentFrame(agent, 0, tick);
        return '已回到公寓当前目标，保留屏幕、房门、磁盘和交易进度。';
      }
      if (state.scene === 'm1_wake_again' && state.wakeCall) {
        delete state.visiting; delete state.returnPosition;
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.place(agent, this.scene, { ...state.checkpoint }); this.wakeCallFrame(agent, 0, tick);
        return '已接回公寓来电，保留惊醒、听筒和对话进度。';
      }
      if (state.scene === 'm1_boss' && state.workday) {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        agent.position = { ...state.checkpoint }; this.workdayFrame(agent, 0, tick); this.phoneFrame(agent, 0, tick);
        return '已接回办公室，保留交谈、签收与来电进度。';
      }
      if (state.hotel && !state.hotel.entered) {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        agent.position = { ...state.checkpoint }; agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null;
        this.hotelFrame(agent, 0, tick); return '已回到旅馆途中保存的位置，Trinity 与房门进度保留。';
      }
      if (lafayetteWelcomeLocked(state)) {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.welcomeFrame(agent, 0, tick); return '已接回 1313 房内的迎接，人物位置、握手与离场进度保留。';
      }
      if (meetingLocked(state)) {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.meetingFrame(agent, false, 0, tick); return '已接回车内检查，保留座位、车门与抽取进度。';
      }
      if (interrogationLocked(state)) {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.interrogationFrame(agent, 0, tick); return '已经接回审讯，保留档案、身体状态与演出进度。';
      }
      if (pillLocked(state)) {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.pillFrame(agent, 0, tick); return '已经接回递药演出，保留原来的选择与动作进度。';
      }
      if (state.awakening && ['recovery', 'construct', 'desert'].includes(state.awakening.kind)) {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.awakeningFrame(agent, 0, tick);
        return state.awakening.kind === 'recovery' ? '已经接回医疗舱恢复，保留针疗和起身进度。' : '已经接回真相揭示，保留电视、讲解与身体动作进度。';
      }
      if (state.training && trainingLocked(state)) {
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.trainingFrame(agent, 0, tick);
        return '已经接回训练程序，保留人物位置与演出进度。';
      }
      this.clearThreats();
      delete state.ride;
      delete state.garage;
      if (state.scene === 'm2_trucks') state.trucks = { phase: state.step === 0 ? 'duel' : 'collision', elapsed: 0, lastTick: tick, attempt: (state.trucks?.attempt ?? 0) + 1 };
      if (state.scene === 'm1_spoon' && state.step === 0 && state.oracle) delete state.oracle.spoon;
      if (state.scene === 'm1_oracle' && state.step === 0 && state.oracle) delete state.oracle.vase;
      if (state.scene === 'm1_dejavu' && state.step === 0) { delete state.ambush; this.sandbox().structures = this.sandbox().structures.filter(s => s.film?.scene !== 'm1_dejavu'); }
      if (state.scene === 'm1_boss' && state.step === 1) delete state.phone;
      if (state.awakening) state.awakening = state.scene === 'm1_pod' && state.step > 0 ? { kind: 'disconnect', elapsed: 9 } : undefined;
      if (state.office) { delete state.office.climbed; delete state.office.crossing; }
      if (state.scene === 'm1_lobby') this.lobby.reset();
      if (state.scene === 'm1_dojo' && state.step === 0) state.dojo = { dodged: false, combo: 0, hits: 0 };
      if (state.scene === 'm1_office_escape' && state.office?.outcome !== 'captured') {
        this.office.start(tick);
        if (state.step >= 3) state.office!.window = OFFICE_WINDOW.seconds;
      }
      delete state.visiting; delete state.returnPosition;
      agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
      agent.position = { ...state.checkpoint }; agent.isInMatrix = FILM_SETS[this.scene.set].world === 'matrix';
      agent.currentLocation = this.scene.set; agent.velocity = { x: 0, y: 0, z: 0 };
      agent.currentAction = null;
      delete state.started; delete state.fighting;
      this.stageCast();
      state.lastText = '已恢复当前目标的检查点；完成过的目标保留。';
      return state.lastText;
    }
    if (state.visiting) return '回访期间不推进主线。J 返回当前剧情。';
    if (state.finished) return '三部曲已完成。可回访场景，或在手记中开始下一轮生活。';
    if (state.hotel && !state.hotel.entered) {
      const door = filmPosition('film_lafayette', 24, 0);
      if (target === 'act' && distance(agent.position, door) < 4 && state.hotel.progress >= HOTEL_DOOR_PROGRESS - .01) {
        if (state.hotel.knock === undefined && state.hotel.door === undefined) {
          const center = FILM_SETS.film_lafayette.center;
          state.hotel.knock = 0; state.hotel.knockFrom = { x: agent.position.x - center.x, z: agent.position.z - center.z, yaw: agent.rotation };
        }
        this.hotelFrame(agent, 0, tick); return state.lastText;
      }
      return state.lastText;
    }
    if (lafayetteWelcomeLocked(state)) {
      this.welcomeFrame(agent, 0, tick);
      const welcome = state.hotel!.welcome!;
      if (welcome.phase === 'ready' && target === 'act') {
        welcome.phase = 'handshake'; welcome.elapsed = 0;
        this.welcomeFrame(agent, 0, tick);
      }
      return state.lastText;
    }
    if (windowCrossing(state)) return '正在跨过窗沿。撑稳身体再落到窄台，暂停或断线会保留当前姿势。';
    if (meetingLocked(state)) {
      if (MEETING_CAST.some(id => this.world.agents.get(id)?.controller)) return '一位接头者正在由另一位玩家控制，检查进度已经保留。';
      this.meetingFrame(agent, false, 0, tick);
      const encounter = state.meeting!;
      if (encounter.phase === 'choice' && (target === 'meeting:stay' || target === 'meeting:leave')) {
        encounter.elapsed = 0;
        if (target === 'meeting:leave') encounter.phase = 'leaving';
        else {
          this.advance('你决定留在车内，接受检查后再去见 Morpheus。', agent, tick);
          encounter.phase = 'scanning'; state.scene = 'm1_bug'; state.step = 0;
          this.enter(FILM_SCENE_BY_ID.m1_bug, tick, { ...agent.position });
        }
        this.meetingFrame(agent, false, 0, tick); return state.lastText;
      }
      if (encounter.phase === 'ready' && target === 'act') { encounter.phase = 'scanning'; encounter.elapsed = 0; this.meetingFrame(agent, false, 0, tick); return state.lastText; }
      if (encounter.phase === 'done' && state.step >= 2 && (target === 'act' || target === 'next')) {
        encounter.phase = 'driving'; encounter.elapsed = 0; this.meetingFrame(agent, false, 0, tick); return state.lastText;
      }
      if (encounter.phase === 'parked' && target === 'act') { encounter.phase = 'exiting'; encounter.elapsed = 0; this.meetingFrame(agent, false, 0, tick); return state.lastText; }
      if (encounter.phase !== 'done') return state.lastText;
    }
    if (target === 'next') {
      if (this.step) return '先完成当前场景中的目标。';
      if (state.scene === 'm1_phone_escape' && state.openingPhone?.phase === 'connected') return '信号已经断开。卡车撞过电话亭后再继续 Neo 的故事。';
      if (state.scene === 'm2_seraph' && !this.near(agent, this.scene.steps.at(-1)!)) return '走近茶馆后门，再跟 Seraph 穿过那把钥匙打开的门。';
      if (state.scene === 'm2_backdoors' && !this.near(agent, this.scene.steps.at(-1)!)) return '走到白色走廊尽头的庭院门，再按 G 通过。';
      if (state.scene === 'm1_office_escape' && state.office?.outcome !== 'captured' && !this.near(agent, this.scene.steps[2])) return '先回到已打开的窗口旁，再按 G 前往窄台。';
      if (state.scene === 'm1_office_escape' && state.office?.outcome !== 'captured') {
        state.office ??= { alert: 0, suspicion: [], waypoints: [], lastTick: tick, guide: '' };
        state.office.window = OFFICE_WINDOW.seconds; state.office.crossing = 0;
        this.crossingFrame(agent, 0, tick); return state.lastText;
      }
      const index = FILM_SCENES.findIndex(s => s.id === state.scene);
      const branch = state.scene === 'm1_office_escape' && state.office?.outcome === 'captured' ? 'm1_interrogation'
        : state.scene === 'm1_ledge' && state.office?.outcome === 'escaped' ? 'm1_wake_again' : undefined;
      const next = branch ? FILM_SCENE_BY_ID[branch] : FILM_SCENES[index + 1];
      if (branch) {
        const skipped = FILM_SCENES.slice(index + 1, FILM_SCENES.indexOf(next!)).map(s => s.id);
        state.skipped = [...new Set([...(state.skipped ?? []), ...skipped])];
      }
      if (!next) { state.finished = true; life.ending = 'peace'; this.sandbox().ending = 'peace'; return '三部曲通关。停战与本轮反思已经保存。'; }
      if (!this.changeActor(agent, next.actor, tick)) return '下一段的角色正在由另一位玩家控制，进度已保留。';
      const sameRoom = state.scene === 'm1_pills' && next.id === 'm1_mirror' || state.scene === 'm2_merovingian' && next.id === 'm2_persephone'
        || state.scene === 'm3_mobil' && next.id === 'm3_family' || state.scene === 'm3_family' && next.id === 'm3_trainman'
        || state.scene === 'm3_hel_entry' && next.id === 'm3_hel_bargain';
      const position = sameRoom || state.scene === 'm1_boss' && next.id === 'm1_office_escape' ? { ...agent.position } : undefined;
      const facing = agent.rotation;
      state.scene = next.id; state.actor = next.actor; state.step = 0; state.lastText = next.context;
      this.enter(next, tick, position);
      if (sameRoom) agent.rotation = facing;
      return `${next.title} · ${FILM_SETS[next.set].name}。`;
    }
    const step = this.step;
    if (!step) return '本场景已完成。G 或 J 继续下一段。';
    if (state.scene === 'm1_room303') {
      this.openingHotel.ensure(tick);
      if (state.openingHotel?.phase === 'failed') return '警员已经封住 303。J 打开手记，从破门检查点重试。';
      if (state.step === 1 && target === 'act' && state.openingHotel?.phase === 'combat') return this.openingHotel.disarm(agent);
      if (state.openingHotel && ['breach', 'dive'].includes(state.openingHotel.phase)) return '演出进行中；进度会保存，等待下一步。';
    }
    if (state.scene === 'm1_roofs' && state.openingRoof?.phase === 'failed' || state.scene === 'm1_phone_escape' && state.openingPhone?.phase === 'failed')
      return '撤离失败。J 打开手记，从本场景入口重试。';
    if (this.reloaded.active(agent)) return this.reloaded.command(agent, target, tick);
    if (this.catch.active(agent)) return this.catch.command(agent, target, tick);
    if (state.scene === 'm2_ship_lost' && state.shipLoss?.phase === 'failed' || state.scene === 'm2_stop_sentinels' && state.tunnel?.phase === 'failed') return '当前检查点失败。按 J 打开手记并重试。';
    if (state.scene === 'm3_trainman' && state.step === 1 && state.mobil?.phase !== 'stopped') return '列车仍在进站，等车门完全打开。';
    if (helElevatorLocked(state)) return '电梯正在下降。到站开门后再进入衣帽间。';
    if (helDanceDoorLocked(state)) return '重门正在打开。留在门前，等舞池入口完全敞开。';
    if (state.scene === 'm3_trainman_chase' && state.step === 2 && state.helChase?.phase !== 'escaped') return 'Trainman 正穿过对向站台；等驶过的列车遮断视线。';
    if (state.scene === 'm3_mobil_release' && state.step === 0 && state.mobil?.phase !== 'stopped') return '列车仍在进站，等 Trinity 下车。';
    if (state.scene === 'm2_burly') return this.burlyAct(agent, target, tick);
    if (state.scene === 'm2_chateau' && state.step === 0) return this.chateauAct(agent, target, tick);
    if (state.scene === 'm2_mountain' && state.step === 2) return state.mountain?.phase === 'failed' && target === 'act' ? this.retryMountain(agent) : '站在山崖起飞点按 Space，随后按住 W 向南飞，A / D 调整航线。';
    if (state.scene === 'm2_persephone' && state.step === 2) return this.persephoneAct(agent, target, tick);
    if (state.scene === 'm1_wake_up') return this.apartmentAct(agent, target, tick);
    if (state.scene === 'm1_wake_again' && state.step === 0) return this.wakeCallAct(agent, target, tick);
    if (state.scene === 'm1_club') return this.clubAct(agent, target, tick);
    if (state.scene === 'm1_sentinels') return this.sentinelAct(agent, target, tick);
    if (interludeKind(state.scene)) return this.interludeAct(agent, target, tick);
    if (state.scene === 'm1_oracle' && state.step === 1 && state.oracle?.consultation) return this.oracleAct(agent, target, tick);
    if (state.scene === 'm1_bathroom' || state.scene === 'm1_unplugged' && state.step === 1) return this.betrayalAct(agent, target, tick);
    if ((state.scene === 'm1_rescue_decision' && state.step === 1) || state.scene === 'm1_guns') return this.rescueAct(agent, target, tick);
    if (state.scene === 'm1_smith_question' || state.scene === 'm1_bullet_dodge') return this.governmentAct(agent, target, tick);
    if (state.scene === 'm1_helicopter' || state.scene === 'm1_rooftop_rescue') return this.airRescueAct(agent, target, tick);
    if (state.scene === 'm1_subway' || state.scene === 'm1_city_chase') return this.matrixEscapeAct(agent, target, tick);
    if (state.scene === 'm1_death' || state.scene === 'm1_return' || state.scene === 'm1_final_call' && state.step > 0) return this.theOneAct(agent, target, tick);
    if (interrogationLocked(state) && state.interrogation!.phase !== 'response') return '审讯正在进行。可以转动视角观察，暂停会保留当前进度。';
    if (target === 'escape:retreat' && state.scene === 'm1_ledge') {
      this.capture(agent, tick, '你退回办公室。特工将你带走；电话中的联系尚未结束。');
      return state.lastText;
    }
    if (this.climbing(agent)) return 'W 沿梯子向下，S 向上。到达下方维修平台才能完成逃脱；停手会抓住当前横档。';
    if (windowOpening(state)) return '正在转动把手、推开窗扇。可以转动视角观察；开窗进度会保存。';
    if (state.scene === 'm1_boss' && (state.step === 0 || state.workday && state.workday.phase !== 'delivered')) {
      if (target !== 'act') return state.lastText;
      return this.workdayAct(agent, tick);
    }
    if (state.training && trainingLocked(state)) {
      if (!state.training.started) {
        if (target !== 'act') return trainingText(state.training);
        const required = state.training.kind === 'download' ? ['tank'] : state.training.kind === 'jump' ? ['morpheus'] : ['morpheus', 'citizen_1', 'citizen_2', 'smith'];
        const occupied = required.find(id => this.world.agents.get(id)?.controller);
        if (occupied) return `${this.world.agents.get(occupied)?.name ?? occupied} 正由另一位玩家控制，训练停在当前画面。`;
        state.training.started = true; this.trainingFrame(agent, 0, tick); return state.lastText;
      }
      return '训练演出进行中，可以转动视角观察；进度会自动保存。';
    }
    if (state.awakening?.started === false) {
      const prompt = state.awakening.kind === 'mirror' ? 'Neo 坐在追踪椅上。按 G 继续接线和触镜。'
        : state.awakening.kind === 'recovery' ? '身体仍躺在医疗床上。按 G 示意船员开始恢复肌肉。'
        : state.awakening.kind === 'construct' ? '电视仍然关闭。按 G 请 Morpheus 开始说明。' : '灰烬中的讲解正在等待。按 G 请 Morpheus 继续。';
      if (target !== 'act') return prompt;
      if (['construct', 'desert'].includes(state.awakening.kind) && this.world.agents.get('morpheus')?.controller) return 'Morpheus 正由另一位玩家控制，揭示停在当前画面。';
      if (state.awakening.kind === 'mirror' && this.world.agents.get('trinity')?.controller) return 'Trinity 正由另一位玩家控制，接线停在当前画面。';
      state.awakening.started = true; this.awakeningFrame(agent, 0, tick); return state.lastText;
    }
    if (state.awakening && state.awakening.elapsed < AWAKENING_SECONDS[state.awakening.kind]) return '演出进行中，可以转动视角观察；进度会自动保存。';
    if (state.scene === 'm2_architect' && state.architect?.phase === 'failed') return 'Trinity 的信号已经消失。按 J 从抉择检查点重试。';
    if (!this.near(agent, step) && !(state.scene === 'm1_construct' && step.kind === 'reflect')) return state.scene === 'm1_mirror' && state.step === 0 ? '穿过会客厅后方的门，走到追踪椅右侧再按 G。' : '请走近金色目标标记（4 米内），再按 G。';
    if (state.scene === 'm1_room303' && state.step === 0 && target === 'act') return this.openingHotel.begin(agent, tick);
    if (state.scene === 'm1_room303' && state.step === 2 && target === 'act') {
      this.openingHotel.state!.phase = 'corridor';
      this.advance('Morpheus 说这条硬线已经被切断：Wells 与 Lake 的电话仍可接入。Trinity 放下听筒，冲向另一端的破窗。', agent, tick);
      return state.lastText;
    }
    if (state.scene === 'm1_room303' && state.step === 4 && target === 'act') return this.openingHotel.dive(agent, tick);
    if (state.scene === 'm1_room303' && state.step === 5 && target === 'act') return this.openingHotel.beginClimb(agent);
    if (state.scene === 'm2_ship_lost' && state.step === 2 && target === 'act') {
      if (['neo', 'trinity', 'link'].some(id => this.world.agents.get(id)?.controller)) return '船员正在由其他玩家控制，弃船命令先停在这里。';
      state.shipLoss = { phase: 'evacuating', remaining: RELOADED_FINALE.evacuationSeconds, lastTick: tick, attempts: state.shipLoss?.attempts ?? 0 };
      this.advance(step.text!, agent, tick); return state.lastText;
    }
    if (state.scene === 'm2_stop_sentinels' && state.step === 1) return '面向身后追来的哨兵，按住 G 保持连接；松开会渐渐失去聚焦。';
    if (state.scene === 'm2_key_door' && [3, 5].includes(state.step)) {
      const grid = this.grid(tick);
      if (grid.phase === 'expired') {
        if (target !== 'act') return state.lastText;
        if (['niobe', 'trinity'].some(id => this.world.agents.get(id)?.controller)) return 'Niobe 或 Trinity 正由另一位玩家控制，改线需要等待她们配合。';
        grid.phase = 'rerouting'; grid.reroute = 0; grid.lastTick = tick;
        state.lastText = 'Link 正联系 Niobe 与 Trinity，重设主网与应急系统的同步时序。等待改线完成。';
        return state.lastText;
      }
      if (grid.phase === 'rerouting') return '队伍正在重新接通电网时序，等待改线完成。';
      if (grid.phase === 'emergency') return 'Trinity 仍在覆盖应急改线。守住这条走廊，等最后一路保护解除。';
      if (grid.phase !== 'window') return '主网和应急系统尚未同时解除保护。先完成两支队伍的任务。';
    }
    if (state.scene === 'm2_key_door' && state.step === 1 && this.world.agents.get('smith')?.controller) return 'Smith 正由另一位玩家控制，走廊交锋停在当前检查点。';
    if (state.scene === 'm2_key_door' && state.step === 2 && this.world.agents.get('morpheus')?.controller) return 'Morpheus 正由另一位玩家控制，营救动作等待他的玩家。';
    if (state.scene === 'm2_key_door' && [3, 4].includes(state.step) && this.world.agents.get('keymaker')?.controller) return '钥匙匠正由另一位玩家控制，开门与交钥匙等待他的玩家。';
    if (state.scene === 'm2_architect' && state.step === 1 && this.world.agents.get('architect')?.controller) return '建筑师正由另一位玩家控制，循环的解释停在当前检查点。';
    if (state.scene === 'm2_architect' && state.step === 3 && this.world.agents.get('trinity')?.controller) return 'Trinity 正由另一位玩家控制，实时影像等待她的路线稳定。';
    if (state.scene === 'm2_architect' && state.step === 5 && this.world.agents.get('trinity')?.controller) return 'Trinity 正由另一位玩家控制，营救选择等待她完成当前行动。';
    if (state.scene === 'm2_bane_copy' && state.step > 0 && ['malachi', 'smith'].some(id => this.world.agents.get(id)?.controller)) return 'Ballard 的船员或 Smith 正由另一位玩家控制，感染片段停在当前检查点。';
    if (state.scene === 'm1_boss' && state.step === 1) delete state.started;
    if (state.started !== undefined) return '互动进行中，移动离开会中断。';
    if (state.scene === 'm3_hel_entry' && state.step === 3) {
      if (target !== 'act') return '靠近舞池重门，按 G 推开。';
      state.helDanceDoor ??= { phase: 'sealed', elapsed: 0, lastTick: tick };
      state.helDanceDoor.phase = 'opening'; state.helDanceDoor.elapsed = 0; state.helDanceDoor.lastTick = tick;
      agent.rotation = Math.PI;
      state.lastText = 'Trinity 抵住门板；铰链缓缓转动，红色灯光和低音从门缝里涌出。';
      return state.lastText;
    }
    if (state.scene === 'm3_hel_entry' && state.step === 0) {
      if (target !== 'act') return '走近电梯按钮，按 G 开始下降。';
      state.helElevator ??= { phase: 'ready', elapsed: 0, lastTick: tick };
      state.helElevator.phase = 'descending'; state.helElevator.elapsed = 0; state.helElevator.lastTick = tick;
      state.lastText = '铁笼门锁住。电梯沿井道下降，外侧灯带一层层向上掠过。';
      return state.lastText;
    }
    if (state.scene === 'm1_ledge' && step.kind === 'reflect') {
      if (target !== 'escape:climb') return 'J 选择沿维修架脱身，或退回办公室。';
      state.office ??= { alert: 0, suspicion: [], waypoints: [], lastTick: tick, guide: '' };
      state.office.climbed = 0;
      state.lastText = '你抓住外侧维修梯。W 向下，S 向上；双手停在当前横档时不会松开。';
      return state.lastText;
    }
    if (state.scene === 'm1_pills' && step.kind === 'reflect') {
      if (state.pills?.phase === 'taking') return '选择已经记下。请看完拿取、吞服和放回水杯的动作。';
      if (target !== 'pill:red' && target !== 'blue') return '亲自选择面前的红色或蓝色药丸；等待不会替你决定。';
      if (this.world.agents.get('morpheus')?.controller) return 'Morpheus 正在由另一位玩家控制，等待对方结束后再交谈。';
      // Old saves may already be at the reflection step, before gestures existed.
      state.pills ??= { phase: 'choice', elapsed: 0, approach: { x: PILL_ROOM.seat, z: PILL_ROOM.z, yaw: -Math.PI / 2 } };
      state.pills.phase = 'taking'; state.pills.elapsed = 0; state.pills.choice = target === 'pill:red' ? 'red' : 'blue';
      this.pillFrame(agent, 0, tick);
      return state.lastText;
    }
    if (target.startsWith('reflect:') && step.kind === 'reflect') {
      const choice = filmReflections(state.scene).find(c => c.id === target.slice(8));
      if (!choice) return '请选择手记中的一种反思。';
      if (state.scene === 'm2_architect' && state.reflections['m2_architect:4'] && state.reflections['m2_architect:4'] !== choice.id)
        return '此前存档中的回答已经记录。请沿原来的理解继续抉择。';
      const response = state.scene === 'm1_oracle' && life.choices.oracle_vase === 'broken' ? `刚才那句提醒改变了你对花瓶的注意，也改变了行动。${choice.response}` : choice.response;
      const key = `${state.scene}:${state.step}`;
      if (!state.reflections[key]) {
        state.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
        life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `${this.scene.title} · ${choice.label}`, text: response });
      }
      this.advance(`${step.text} ${response}`, agent, tick);
      if (state.scene === 'm1_construct') this.command(agent, 'next', tick);
      return response;
    }
    if (target !== 'act') return '当前没有这个场景操作。';
    if (state.scene === 'm1_phone_escape' && state.step === 1) {
      const phone = state.openingPhone;
      if (!phone || phone.phase !== 'running' || phone.remaining <= 0) return '线路已经被卡车切断。J 打开手记重试。';
      phone.phase = 'connected'; phone.impactElapsed = 0; phone.impactFrom = phone.remaining; phone.lastTick = tick;
      this.advance('Trinity 抢在卡车前接起听筒，连接立即断开。空车撞进玻璃电话亭。', agent, tick);
      return state.lastText;
    }
    if (state.scene === 'm3_hel_bargain') return this.helBargainAct(agent, tick);
    if (state.scene === 'm1_bug' && state.step === 2 && state.meeting?.phase === 'outside') {
      if (this.world.agents.get('trinity')?.controller) return 'Trinity 正在由另一位玩家控制，等待对方结束后再一起上楼。';
      const position = { ...agent.position }; const facing = agent.rotation;
      this.advance('抵达 Lafayette 后门。跟随 Trinity 上楼，Morpheus 在十三层等你。', agent, tick);
      state.scene = 'm1_pills'; state.step = 0; state.hotel = { progress: 0 };
      this.enter(FILM_SCENE_BY_ID.m1_pills, tick, position); agent.rotation = facing;
      this.hotelFrame(agent, 0, tick); return state.lastText;
    }
    if (state.scene === 'm1_bridge' && state.step === 1) {
      if (MEETING_CAST.some(id => this.world.agents.get(id)?.controller)) return '一位接头者正在由另一位玩家控制，等待对方结束后再上车。';
      const center = FILM_SETS[this.scene.set].center;
      state.meeting = { phase: 'boarding', elapsed: 0, bugged: state.office?.bugged ?? state.office?.outcome !== 'escaped',
        approach: { x: agent.position.x - center.x, z: agent.position.z - center.z, yaw: agent.rotation } };
      delete state.started; this.meetingFrame(agent, false, 0, tick); return state.lastText;
    }
    if (state.scene === 'm1_interrogation') {
      if (INTERROGATION_CAST.some(id => this.world.agents.get(id)?.controller)) return '有一名特工正在由另一位玩家控制，等待对方结束后再开始审讯。';
      const center = FILM_SETS[this.scene.set].center;
      state.interrogation ??= { phase: state.step === 0 ? 'file' : 'response', elapsed: 0, approach: { x: agent.position.x - center.x, z: agent.position.z - center.z, yaw: agent.rotation } };
      if (state.interrogation.phase === 'response') { state.interrogation.phase = 'coercion'; state.interrogation.elapsed = 0; }
      delete state.started; this.interrogationFrame(agent, 0, tick); return state.lastText;
    }
    if (state.scene === 'm1_pills' && state.step === 0) {
      if (this.world.agents.get('morpheus')?.controller) return 'Morpheus 正在由另一位玩家控制，等待对方结束后再交谈。';
      const center = FILM_SETS[this.scene.set].center;
      state.pills ??= { phase: 'offering', elapsed: 0, approach: { x: agent.position.x - center.x, z: agent.position.z - center.z, yaw: agent.rotation } };
      this.pillFrame(agent, 0, tick); return state.lastText;
    }
    if (state.scene === 'm1_office_escape' && state.step === 2) {
      if (!state.office) this.office.start(tick);
      delete state.started; state.office!.window = 0;
      this.windowFrame(agent, 0, tick); return state.lastText;
    }
    if (state.scene === 'm1_boss' && state.step === 1) {
      if (!state.phone) state.phone = { phase: 'pickup', elapsed: 0 };
      else if (state.phone.phase === 'ready') state.phone = { phase: 'answering', elapsed: 0 };
      this.phoneFrame(agent, 0, tick); return state.lastText;
    }
    if (state.scene === 'm1_dejavu' && state.step === 0) { state.ambush ??= { elapsed: 0 }; return '留意前方门廊。走远会中断观察，回到这里可以继续。'; }
    if (state.scene === 'm1_spoon' && state.step === 0) {
      state.oracle ??= {}; state.oracle.spoon ??= 0;
      return '勺子已在手中。停下脚步并按住 G 专注，松开时观察它如何恢复；V 可切换视角。';
    }
    if (state.scene === 'm1_oracle' && state.step === 0) {
      state.oracle ??= {}; state.oracle.vase ??= 0;
      return '先知提醒你留意花瓶。你的注意转向身后。';
    }
    if (state.scene === 'm1_mirror' || state.scene === 'm1_pod') {
      if (state.scene === 'm1_mirror' && this.world.agents.get('trinity')?.controller) return 'Trinity 正由另一位玩家控制；接线会在她空闲后继续。';
      const center = FILM_SETS[this.scene!.set].center;
      state.awakening = { kind: state.scene === 'm1_mirror' ? 'mirror' : state.step === 0 ? 'disconnect' : 'rescue', elapsed: 0,
        approach: state.scene === 'm1_mirror' ? { x: agent.position.x - center.x, z: agent.position.z - center.z } : undefined };
      this.awakeningFrame(agent, 0, tick);
      return state.lastText;
    }
    if (state.scene === 'm3_trainman' && state.step === 2) {
      if (['trainman', 'rama_kandra', 'kamala', 'sati'].some(id => this.world.agents.get(id)?.controller)) return '车门旁的角色正由其他玩家控制，等待他们完成行动。';
      this.ensureMobil(tick);
      if (state.mobil?.phase !== 'stopped') return '等车停稳，Trainman 才会打开车门。';
      const center = FILM_SETS[this.scene!.set].center;
      state.mobil.phase = 'refusing'; state.mobil.elapsed = 0;
      state.mobil.approach = { x: agent.position.x - center.x, z: agent.position.z - center.z, yaw: agent.rotation };
      this.mobilFrame(agent, 0, tick); return 'Trainman 伸手拦住你。';
    }
    if (state.scene === 'm1_jump' && state.step === 1) return 'Morpheus 已经完成示范。Shift 助跑，空格起跳；跌落会恢复检查点。';
    if (step.kind === 'reflect') return 'J 打开手记，记录自己的理解。';
    if (state.scene === 'm2_trucks' && state.step === 2 && ['keymaker', 'neo'].some(id => this.world.agents.get(id)?.controller))
      return '钥匙匠或 Neo 正由另一位玩家控制，等待对方结束后再接应。';
    if (step.kind === 'drive') {
      if (state.scene === 'm2_garage') {
        if (['morpheus', 'keymaker', 'twin1', 'twin2'].some(id => this.world.agents.get(id)?.controller)) return '车内同伴或双子正在由另一位玩家控制，等待对方结束后再开始撤离。';
        if (!state.garage) state.garage = newGarageEscape();
        return '已上车。W 加速，S 刹车，A / D 转向；保持速度穿过双子的相位，趁他们追上前冲出车库。';
      }
      if (this.world.agents.get('keymaker')?.controller) return '钥匙匠正在由另一位玩家控制，等待对方结束后再开始护送。';
      if (!state.ride) state.ride = newFreewayRide();
      return '已上车。W 加速，S 刹车，A / D 转向；护送钥匙匠通过逆向车流，抵达前方接应区。';
    }
    if (step.kind === 'fight') {
      if (step.opponent && this.world.agents.get(step.opponent)?.controller) return '对手正在由另一位玩家控制，等待对方结束后再开始。';
      if (state.scene === 'm1_lobby') {
        const occupied = this.lobby.occupied();
        if (occupied) return `${occupied.name} 正由另一位玩家控制，等待对方结束后再进入安检区。`;
        if (!state.fighting) { state.fighting = true; this.lobby.start(agent, tick); }
        return state.lastText;
      }
      if (state.scene === 'm3_hel_entry') {
        if (!state.fighting) { state.fighting = true; this.coatcheck.start(agent, tick); }
        return state.lastText;
      }
      if (state.fighting) return state.scene === 'm2_seraph' ? '观察 Seraph 起手，X 闪避后靠近 F 反击。完成两次攻防才会收手。' : 'F 连击，X 闪避；清除追兵后会记录完成。';
      this.spawn(agent, step, tick); state.fighting = true;
      return state.scene === 'm2_seraph' ? 'Seraph 放下茶杯摆好架势。正面进攻会被挡开：先观察红色起手，再用 X 闪避。' : '行动开始。F 连击 / X 闪避 / 1 医疗包；完成后返回目标路线。';
    }
    if (step.kind === 'reach') { this.advance(step.label, agent, tick); return '已抵达目标。'; }
    state.started = tick; return `${step.label}。停留 ${step.seconds ?? 3} 秒。`;
  }

  private changeActor(agent: AgentState, id: string, tick: number): boolean {
    if (id === agent.id) return true;
    const next = this.world.agents.get(id);
    if (!next || next.controller) return false;
    return this.handoff?.(agent, id, tick) ?? false;
  }
  private capture(agent: AgentState, tick: number, text: string): void {
    const state = this.state!;
    state.office ??= { alert: 100, suspicion: [], waypoints: [], lastTick: tick, guide: '' };
    state.office.outcome = 'captured'; state.office.guide = text;
    delete state.office.climbed;
    delete state.office.crossing;
    this.sandbox().neoLife!.choices.office_escape = 'captured';
    this.clearThreats(); agent.velocity = { x: 0, y: 0, z: 0 };
    agent.position = { ...state.checkpoint };
    state.step = this.scene!.steps.length - 1;
    this.advance(text, agent, tick);
  }
  private place(agent: AgentState, scene: FilmScene, position: AgentState['position']): void {
    agent.position = { ...position }; agent.isInMatrix = FILM_SETS[scene.set].world === 'matrix'; agent.currentLocation = scene.set;
    agent.rotation = Math.PI; agent.velocity = { x: 0, y: 0, z: 0 }; agent.currentAction = null; agent.targetPosition = null; agent.currentPath = [];
  }
  private prepareOracleRescue(): void {
    const life = this.sandbox().neoLife!; const answer = life.choices.oracle_first;
    if (!['doubt', 'rescue', 'observe'].includes(answer) || life.choices.oracle_prepared) return;
    const inventory = this.sandbox().profiles.neo.inventory;
    const text = answer === 'doubt'
      ? '你没有把预言当作命令。Tank 根据你的核对习惯准备了额外破解代码。'
      : answer === 'rescue'
        ? '你曾把 Morpheus 当作一个具体的人。Trinity 提前把三份医疗补给装入营救装备。'
        : '你保留了有限的信任。船员把一枚协作信标加入装备，让撤离路线能被彼此确认。';
    if (answer === 'doubt') inventory.code += 10;
    else if (answer === 'rescue') inventory.medkit += 3;
    else inventory.beacon++;
    life.choices.oracle_prepared = answer;
    life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: '先知的提醒成为准备', text });
    this.state!.lastText = `${this.state!.lastText} ${text}`;
  }
  private enter(scene: FilmScene, tick: number, position?: AgentState['position']): void {
    const state = this.state!; const life = this.sandbox().neoLife!;
    this.openingHotel.clear();
    this.clearThreats(); state.enteredAt = tick; state.checkpoint = position ?? filmEntry(scene); delete state.started; delete state.fighting;
    delete state.lobby;
    delete state.ride;
    delete state.garage;
    delete state.trucks;
    delete state.awakening;
    delete state.training;
    delete state.dojo;
    delete state.workday;
    delete state.contact;
    delete state.wakeCall;
    delete state.club;
    delete state.sentinel;
    delete state.interlude;
    delete state.betrayal;
    delete state.government;
    delete state.airRescue;
    delete state.matrixEscape;
    delete state.theOne;
    delete state.reloaded;
    delete state.catch;
    delete state.shipLoss;
    delete state.tunnel;
    delete state.openingRoof;
    delete state.openingPhone;
    delete state.openingHotel;
    if (scene.id === 'm1_room303') this.openingHotel.reset(tick);
    if (scene.id === 'm1_roofs') state.openingRoof = { phase: 'running', lastTick: tick, attempts: 0 };
    if (scene.id === 'm1_phone_escape') state.openingPhone = { phase: 'running', remaining: OPENING_ESCAPE.phoneSeconds, lastTick: tick, attempts: 0 };
    if (scene.id === 'm3_mobil') state.mobil = { phase: 'waiting', elapsed: 0, lastTick: tick, loops: 0 };
    else if (scene.id === 'm3_mobil_release') state.mobil = { phase: 'approaching', elapsed: 0, lastTick: tick, loops: 0 };
    else if (!['m3_family', 'm3_trainman'].includes(scene.id)) delete state.mobil;
    if (scene.id === 'm3_trainman_chase') state.helChase = { phase: 'sighting', elapsed: 0, lastTick: tick };
    else delete state.helChase;
    if (scene.id === 'm3_hel_entry') state.helElevator = { phase: 'ready', elapsed: 0, lastTick: tick };
    else delete state.helElevator;
    if (scene.id === 'm3_hel_entry') state.helDanceDoor = { phase: 'sealed', elapsed: 0, lastTick: tick };
    else delete state.helDanceDoor;
    if (scene.id === 'm3_hel_entry') this.coatcheck.reset();
    else delete state.helCoatcheck;
    if (scene.id === 'm3_hel_bargain') state.helBargain = { phase: 'armed', elapsed: 0, lastTick: tick, attempts: 0 };
    else delete state.helBargain;
    delete state.baneCopy;
    delete state.seraph;
    delete state.burly;
    delete state.chateau;
    delete state.mountain;
    delete state.persephone;
    delete state.keymaker;
    delete state.keyDoor;
    delete state.architect;
    this.sandbox().structures = this.sandbox().structures.filter(structure => structure.id !== 'film:reloaded:door');
    this.sandbox().structures = this.sandbox().structures.filter(structure => structure.id !== 'film:library:bookdoor');
    this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== 'film:apartment:door');
    delete state.pills;
    delete state.interrogation;
    if (!['m1_pills', 'm1_mirror'].includes(scene.id)) { delete state.hotel; this.sealHotelDoor(); }
    if (scene.id !== 'm1_bug') {
      delete state.meeting;
      for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.meeting) other.currentAction = null;
    }
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.interrogation) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.sentinel) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.interlude) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.oracleVisit) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.betrayal) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.rescue) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.government) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.airRescue) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.matrixEscape) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && (other.currentAction?.parameters.theOne || other.currentAction?.parameters.reloaded || other.currentAction?.parameters.catch)) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.lobbyEntry) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.riding) { other.currentAction = null; other.velocity = { x: 0, y: 0, z: 0 }; }
    if (scene.id === 'm1_lobby') this.lobby.reset();
    const actor = this.world.agents.get(state.actor)!;
    this.place(actor, scene, state.checkpoint); actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = [];
    if (scene.id === 'm2_room') actor.rotation = Math.PI;
    if (scene.id === 'm2_mountain') actor.rotation = 0;
    if (scene.id === 'm2_trucks') actor.rotation = Math.PI;
    if (scene.id === 'm2_oracle_message') actor.rotation = 0;
    life.chapter = NEO_CHAPTERS.findIndex(c => c.id === scene.chapter);
    const neo = this.world.agents.get('neo')!;
    neo.isAwakened = FILM_SCENES.indexOf(scene) >= FILM_SCENES.findIndex(s => s.id === 'm1_pod');
    const profile = this.sandbox().profiles[actor.id];
    if (profile) { profile.trackedMission = ''; profile.trace = 0; profile.inventory.medkit = Math.max(profile.inventory.medkit, 2); delete profile.job; if (!profile.visited.includes(scene.set)) profile.visited.push(scene.set); }
    this.sandbox().weather = FILM_SETS[scene.set].light === 'storm' ? 'rain' : 'clear';
    this.sandbox().weatherUntil = tick + 100000;
    this.stageCast();
    this.reconcileCast();
    if (scene.id === 'm2_burly') {
      state.burly = { phase: 'ready', elapsed: 0, attempt: 0, repelled: 0, staffSwings: 0, assimilation: 0, nextCopyAt: tick };
      state.lastText = burlyText(state.burly);
      const oracle = this.world.agents.get('oracle');
      if (oracle && !oracle.controller) {
        oracle.currentLocation = CHARACTERS.oracle.initialLocation; oracle.position = locationEntrance(oracle.currentLocation);
        oracle.currentAction = null; oracle.targetPosition = null; oracle.currentPath = []; oracle.velocity = { x: 0, y: 0, z: 0 };
      }
    }
    if (scene.id === 'm2_chateau') state.chateau = { phase: 'ready', wave: 1, parries: 0, disarms: 0, attempts: 0, wounded: false };
    if (scene.id === 'm2_trucks') state.trucks = { phase: 'duel', elapsed: 0, lastTick: tick, attempt: 0 };
    if (scene.id === 'm2_plan') state.grid = { primary: 'online', emergency: 'online', vigilant: 'active', trinity: 'waiting', phase: 'preparing',
      remaining: GRID_WINDOW_SECONDS, lastTick: tick, reroute: 0, attempts: 0 };
    if (['m2_power', 'm2_vigilant', 'm2_backup', 'm2_key_door'].includes(scene.id)) this.grid(tick);
    if (scene.id === 'm2_key_door') state.keyDoor = { portalOpened: false, keyTaken: false };
    if (scene.id === 'm2_architect') state.architect = { phase: 'cycles', sourceReviewed: false, trinityReviewed: false,
      remaining: ARCHITECT_DOOR_SECONDS, lastTick: tick, attempts: 0 };
    this.sealSourceDoor();
    this.sealArchitectDoors();
    if (scene.id === 'm2_mountain') state.mountain = { phase: 'ground', elapsed: 0, x: MOUNTAIN.launch.x, z: MOUNTAIN.launch.z, altitude: 0, attempt: 0 };
    if (scene.id === 'm2_persephone') state.persephone = { phase: 'offered', elapsed: 0, attempts: 0 };
    if (scene.id === 'm2_library') {
      state.keymaker = { x: EXILES.keymaker.x, z: EXILES.keymaker.z, phase: 'hidden', separated: 0, setbacks: 0 };
      this.keymakerFrame(actor, 0, tick);
    }
    if (scene.id === 'm2_merovingian' && life.choices.oracle_second_lead && !life.choices.oracle_second_prepared) {
      const answer = life.choices['m2_bench:2']; const inventory = this.sandbox().profiles[actor.id].inventory;
      const preparation = answer === 'agency' ? '你核对过约见地址与程序入口，备好 8 份破解代码。'
        : answer === 'care' ? '你记住先知对流亡者的提醒，同行者带来两份急救包。'
          : '你接受一次有边界的合作，船员为团队带来一枚协作信标。';
      if (answer === 'agency') inventory.code += 8;
      else if (answer === 'care') inventory.medkit += 2;
      else inventory.beacon++;
      life.choices.oracle_second_prepared = answer ?? 'trust'; state.lastText += ` ${preparation}`;
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: '带着先知的线索赴约', text: preparation });
    }
    if (scene.id === 'm3_zion_prepare' && life.choices.zion_residents_contacted) state.lastText += ' 居住层的两份寻人请求已列入联络簿，撤离名单有了对应家属。';
    if (scene.id === 'm3_dock_battle' && !life.choices.zion_dock_supplies_used) {
      const supplies = Number(Boolean(life.choices.zion_ship_charged)) + Number(Boolean(life.choices.zion_lock_reported));
      if (supplies) { this.sandbox().profiles[actor.id].inventory.medkit += supplies; life.choices.zion_dock_supplies_used = String(supplies); state.lastText += ` 已整理的补给与部署带来 ${supplies} 份急救包。`; }
    }
    if (scene.id === 'm3_temple_defense' && life.choices.zion_residents_contacted && !life.choices.zion_care_supplies_used) {
      this.sandbox().profiles[actor.id].inventory.medkit++; life.choices.zion_care_supplies_used = '1';
      state.lastText += ' 联络簿上的家属已找到避难区；互助小组留下一份急救包。';
    }
    if (scene.id === 'm1_wake_up') { state.contact = { phase: 'idle', elapsed: 0 }; this.apartmentFrame(actor, 0, tick); }
    if (scene.id === 'm1_wake_again') { state.wakeCall = { phase: 'waking', elapsed: 0, nightmare: state.office?.outcome !== 'escaped' }; this.apartmentFrame(actor, 0, tick); }
    if (scene.id === 'm1_club') { state.club = { phase: 'crowd', elapsed: 0 }; this.clubFrame(actor, 0, tick); }
    if (scene.id === 'm1_boss') { state.workday = { phase: 'waiting', elapsed: 0 }; this.workdayFrame(actor, 0, tick); }
    if (scene.id === 'm1_office_escape') this.office.start(tick);
    if (scene.id === 'm1_pod') this.awakeningFrame(actor, 0, tick);
    if (scene.id === 'm1_recovery') {
      state.awakening = { kind: 'recovery', elapsed: 0, started: false };
      this.awakeningFrame(actor, 0, tick);
    }
    if (scene.id === 'm1_construct') {
      state.awakening = { kind: 'construct', elapsed: 0, started: false };
      this.awakeningFrame(actor, 0, tick);
    }
    if (scene.id === 'm1_download') {
      state.training = { kind: 'download', elapsed: 0, started: false };
      this.trainingFrame(actor, 0, tick);
    }
    if (scene.id === 'm1_dojo') state.dojo = { dodged: false, combo: 0, hits: 0 };
    if (scene.id === 'm1_bug') this.meetingFrame(actor, false, 0, tick);
    if (scene.id === 'm1_sentinels') {
      state.sentinel = { phase: 'ready', elapsed: 0, noise: 0, attempt: 0 };
      this.sentinelFrame(actor, { movement: 0, sprint: false, jump: false }, 0, tick);
    }
    const interlude = interludeKind(scene.id);
    if (interlude) {
      state.interlude = { kind: interlude, phase: 'ready', elapsed: 0 };
      this.interludeFrame(actor, 0, tick);
    }
    if (scene.id === 'm1_bathroom' || scene.id === 'm1_unplugged') {
      state.betrayal = { kind: scene.id === 'm1_bathroom' ? 'bathroom' : 'unplugged', phase: 'ready', elapsed: 0, attempt: 0, repels: 0, rescued: 0 };
      this.betrayalFrame(actor, 0, tick);
    }
    if (scene.id === 'm1_rescue_decision') {
      state.rescue = { phase: 'briefing_ready', elapsed: 0 };
      this.prepareOracleRescue(); this.rescueFrame(actor, 0, tick);
    }
    if (scene.id === 'm1_guns') {
      state.rescue = { phase: 'racks_ready', elapsed: 0 };
      this.rescueFrame(actor, 0, tick);
    }
    if (scene.id === 'm1_lobby') {
      state.rescue ??= { phase: 'equipped', elapsed: 0, loadout: 'rifle' };
      state.rescue.phase = 'equipped'; state.rescue.elapsed = 0; state.rescue.loadout ??= 'rifle';
    }
    if (scene.id === 'm1_smith_question') {
      state.government = { kind: 'questioning', phase: 'ready', elapsed: 0, attempt: 0, resolve: 1 };
      this.governmentFrame(actor, false, 0, tick);
    }
    if (scene.id === 'm1_bullet_dodge') {
      state.government = { kind: 'rooftop', phase: 'ready', elapsed: 0, attempt: 0, dodges: 0, wounds: 0, resolved: [] };
      this.governmentFrame(actor, false, 0, tick);
    }
    if (scene.id === 'm1_helicopter') {
      state.airRescue = { kind: 'office', phase: 'ready', elapsed: 0, attempt: 0, suppression: 0, bursts: 0 };
      this.airRescueFrame(actor, false, 0, tick);
    }
    if (scene.id === 'm1_rooftop_rescue') {
      state.airRescue = { kind: 'roof', phase: 'ready', elapsed: 0, attempt: 0, grip: 1, braces: 0, misses: 0, resolved: [] };
      this.airRescueFrame(actor, false, 0, tick);
    }
    if (scene.id === 'm1_subway') {
      state.matrixEscape = { kind: 'subway', phase: 'ready', elapsed: 0, attempt: 0, checkpoint: 'duel', hits: 0, dodges: 0,
        pursuit: 0, segment: 0, possessions: 0, resolved: [] };
      this.matrixEscapeFrame(actor, { movement: 0, sprint: false }, 0, tick);
    }
    if (scene.id === 'm1_city_chase') {
      state.matrixEscape = { kind: 'city', phase: 'ready', elapsed: 0, attempt: 0, checkpoint: 'street', hits: 0, dodges: 0,
        pursuit: 0, segment: 0, possessions: 0, resolved: [] };
      this.matrixEscapeFrame(actor, { movement: 0, sprint: false }, 0, tick);
    }
    if (scene.id === 'm1_death' || scene.id === 'm1_return' || scene.id === 'm1_final_call') {
      const kind = scene.id === 'm1_death' ? 'death' : scene.id === 'm1_return' ? 'return' : 'flight';
      state.theOne = { kind, phase: 'ready', elapsed: 0, attempt: 0, checkpoint: kind === 'death' ? 'door' : kind === 'return' ? 'bullets' : 'phone',
        signal: 0, hits: 0, blocks: 0, deadline: 0, altitude: 0, flightX: 0, flightZ: 0, resolved: [] };
      this.theOneFrame(actor, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick);
    }
    if (scene.id === 'm2_dream' || scene.id === 'm2_meeting') {
      state.reloaded = newReloaded(scene.id === 'm2_dream' ? 'dream' : 'meeting');
      this.reloaded.frame(actor, { x: 0, focus: false }, 0, tick);
    }
    if (scene.id === 'm2_catch') { state.catch = newCatch(); this.catch.frame(actor, { x: 0, z: 0, focus: false }, 0, tick); }
    if (scene.id === 'm2_ship_lost') state.shipLoss = { phase: 'briefing', remaining: RELOADED_FINALE.evacuationSeconds, lastTick: tick, attempts: 0 };
    if (scene.id === 'm2_stop_sentinels') state.tunnel = { phase: 'running', remaining: RELOADED_FINALE.sentinelSeconds, focus: 0, lastTick: tick, attempts: 0 };
    if (scene.id === 'm2_bane_copy') state.baneCopy = { progress: 0 };
    if (scene.id === 'm2_seraph') state.seraph = { dodges: 0, counters: 0, attempts: 0 };
    if (scene.id === 'm2_catch' && life.choices.trinity_dream) state.lastText += life.choices.trinity_dream === 'clear' ? '你认出了梦里的破窗、枪口与坠落方向；这次仍有机会作出行动。' : '这座大楼让你想起那个破碎的梦。';
    if (scene.id === 'm1_bug' && state.office?.outcome === 'escaped') state.lastText = '你没有被特工带走。Switch 仍要求做安全检查，确认没有追踪装置。';
  }
  private stageCast(): void {
    const scene = this.scene!;
    if (['m1_death', 'm1_return', 'm1_final_call', 'm2_dream', 'm2_meeting', 'm2_catch'].includes(scene.id)) return;
    scene.cast.forEach((id, i) => {
      const actor = this.world.agents.get(id);
      if (!actor || actor.controller || actor.id === this.state!.actor || this.unavailable(id)) return;
      if (id === 'trinity' && this.state?.hotel && scene.id !== 'm1_mirror') return;
      // Cast stands clear of the playable aisle and its interaction targets.
      this.place(actor, scene, filmPosition(scene.set, (i % 2 ? 1 : -1) * (10 + Math.floor(i / 2) * 2), -6 + Math.floor(i / 2) * 8));
      const zion = ZION_CAST[scene.id]?.[id];
      if (zion) { actor.position = filmPosition(scene.set, zion.x, zion.z); actor.rotation = zion.yaw; }
      if (scene.set === 'film_oracle_home') {
        if (id === 'oracle') actor.position = filmPosition(scene.set, -7, -22);
        else if (id === 'spoon_boy') actor.position = filmPosition(scene.set, -9, 8);
        else actor.position = filmPosition(scene.set, i % 2 ? 10 : -10, 5 + Math.floor(i / 2) * 6);
      }
      if (!zion) actor.rotation = i % 2 ? -Math.PI / 2 : Math.PI / 2;
      if (scene.id === 'm1_roofs' && id === 'agent_brown') { actor.position = filmPosition(scene.set, 0, 43); actor.rotation = Math.PI; }
      if (scene.id === 'm1_lobby' && id === 'trinity') { actor.position = filmPosition(scene.set, -4, 30); actor.rotation = Math.PI; }
      if (scene.id === 'm1_lobby' && id === 'citizen_12') { actor.position = filmPosition(scene.set, 0, 20.8); actor.rotation = 0; }
      if (scene.id === 'm1_recovery') {
        const recoveryCrew = { morpheus: [-2.4, -18.5, -2.45], trinity: [-10.5, -15.5, 2.7], tank: [6.5, -5, -2.8], dozer: [10.5, -3, -2.8] } as const;
        const position = recoveryCrew[id as keyof typeof recoveryCrew];
        if (position) { actor.position = filmPosition(scene.set, position[0], position[1]); actor.rotation = position[2]; }
      }
      if (scene.id === 'm1_construct' && id === 'morpheus') { actor.position = filmPosition(scene.set, CONSTRUCT_REVEAL.morpheus.x, CONSTRUCT_REVEAL.morpheus.z); actor.rotation = CONSTRUCT_REVEAL.morpheus.yaw; }
      if (scene.id === 'm1_desert' && id === 'morpheus') { actor.position = filmPosition(scene.set, DESERT_REVEAL.morpheus.x, DESERT_REVEAL.morpheus.z); actor.rotation = DESERT_REVEAL.morpheus.yaw; }
      actor.status = 'alive'; actor.health = actor.maxHealth;
      if (id === 'spoon_boy' && scene.id === 'm1_spoon') {
        actor.rotation = .7;
        actor.currentAction = { type: 'idle', parameters: { seated: true, floorSeated: true, spoon: 1 }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if (scene.id === 'm1_pills' && id === 'morpheus') {
        const hotelWelcome = this.state!.hotel?.welcome;
        if (this.state!.hotel && hotelWelcome?.phase !== 'done') {
          const welcome = hotelWelcome ?? { phase: 'approach' as const, elapsed: 0 };
          const pose = lafayetteWelcomeRoot(welcome, 'morpheus');
          actor.position = filmPosition(scene.set, pose.x, pose.z); actor.rotation = pose.yaw;
          actor.currentAction = { type: 'idle', parameters: { welcome: { ...welcome, role: 'morpheus' } }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
        } else {
          actor.position = filmPosition(scene.set, -PILL_ROOM.seat, PILL_ROOM.z); actor.rotation = Math.PI / 2;
          actor.currentAction = { type: 'idle', parameters: { seated: true, pills: { phase: 'offering', elapsed: 0, role: 'morpheus' } }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
        }
      }
      if (scene.id === 'm1_mirror') {
        const crew: Record<string, [number, number, number]> = {
          morpheus: [-3, -17, -1.43], trinity: [-6.4, -16.5, -1.35], apoc: [1, -17, 1.57], switch: [-3, -22, 0], cypher: [9, -18.5, -1.57],
        };
        const station = crew[id];
        if (station) { actor.position = filmPosition(scene.set, station[0], station[1]); actor.rotation = station[2]; }
      }
      if (scene.id === 'm1_interrogation' && INTERROGATION_CAST.includes(id as typeof INTERROGATION_CAST[number])) {
        const role = id as typeof INTERROGATION_CAST[number];
        const pose = interrogationRoot({ phase: 'file', elapsed: 0, approach: { x: 0, z: 0, yaw: 0 } }, role);
        actor.position = filmPosition(scene.set, pose.x, pose.z); actor.rotation = pose.yaw;
        actor.currentAction = { type: 'idle', parameters: { interrogation: { phase: 'file', elapsed: 0, role } }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if (scene.id === 'm1_jump' && id === 'morpheus') actor.position = filmPosition(scene.set, 0, -38);
      if (scene.id === 'm2_seraph' && id === 'seraph') { actor.position = filmPosition(scene.set, 0, -8); actor.rotation = 0; }
      if (scene.id === 'm2_burly' && id === 'smith') { actor.position = filmPosition(scene.set, 0, -8); actor.rotation = 0; }
      if (scene.id === 'm2_merovingian') {
        const seats: Record<string, [number, number, number]> = { merovingian: [0, -27, 0], persephone: [-5, -27, .5],
          morpheus: [-7, -17, Math.PI], trinity: [7, -17, Math.PI], twin1: [-14, -25, .7], twin2: [14, -25, -.7] };
        const seat = seats[id]; if (seat) { actor.position = filmPosition(scene.set, seat[0], seat[1]); actor.rotation = seat[2];
          actor.currentAction = { type: 'idle', parameters: { seated: ['merovingian', 'persephone'].includes(id) }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 }; }
      }
      if (scene.id === 'm2_persephone') {
        const positions: Record<string, [number, number, number]> = { persephone: [23.4, 22.5, -.9], trinity: [18.5, 20.2, 1], morpheus: [17.5, 17.2, 1] };
        const spot = positions[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
      }
      if (scene.id === 'm2_library') {
        const positions: Record<string, [number, number, number]> = { keymaker: [EXILES.keymaker.x, EXILES.keymaker.z, 0],
          persephone: [-4, -4, Math.PI], morpheus: [-7, 9, Math.PI], trinity: [7, 9, Math.PI],
          cain: [-7, -7, 0], abel_mero: [7, -7, 0] };
        const spot = positions[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
      }
      if (scene.id === 'm2_backdoors' && id === 'seraph') { actor.position = filmPosition(scene.set, 2.5, -30); actor.rotation = Math.PI; }
      if (scene.id === 'm2_architect' && id === 'architect') {
        actor.position = filmPosition(scene.set, 0, -14); actor.rotation = 0;
        actor.currentAction = { type: 'idle', parameters: { seated: true }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if (scene.id === 'm2_key_door') {
        const positions: Record<string, [number, number, number]> = { keymaker: [2, -37, 0], morpheus: [-2, -31, 0], smith: [0, -25, 0] };
        const spot = positions[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
      }
      if (scene.id === 'm2_bench' && id === 'oracle') {
        actor.position = filmPosition(scene.set, -9, -20); actor.rotation = 0;
        actor.currentAction = { type: 'idle', parameters: { seated: true }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if ((scene.id === 'm1_bridge' || scene.id === 'm1_bug') && MEETING_CAST.includes(id as typeof MEETING_CAST[number])) {
        const encounter: MeetingEncounter = this.state!.meeting ?? { phase: 'ready', elapsed: 0, bugged: false, approach: { ...MEETING_CAR.approach, yaw: -Math.PI / 2 } };
        const role = id as typeof MEETING_CAST[number]; const pose = meetingRoot(encounter, role);
        actor.position = filmPosition(scene.set, pose.x, pose.z); actor.rotation = pose.yaw;
        actor.currentAction = { type: 'idle', parameters: { meeting: { phase: encounter.phase, elapsed: encounter.elapsed, bugged: encounter.bugged, role } }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if (scene.id === 'm2_freeway') actor.position = filmPosition(scene.set, id === 'keymaker' ? 19 : 20, id === 'keymaker' ? 660 : -660);
      if (scene.id === 'm2_garage') {
        const poses: Record<string, [number, number, number]> = {
          morpheus: [2.7, 14, Math.PI], keymaker: [3.5, 10.5, Math.PI],
          twin1: [GARAGE.twins[0].x, GARAGE.twins[0].z, 0], twin2: [GARAGE.twins[1].x, GARAGE.twins[1].z, 0],
        };
        const pose = poses[id]; if (pose) { actor.position = filmPosition(scene.set, pose[0], pose[1]); actor.rotation = pose[2]; }
      }
      if (scene.id === 'm2_trucks') {
        const poses: Record<string, [number, number, number]> = {
          keymaker: [TRUCKS.keymaker.x, TRUCKS.keymaker.z, TRUCKS.roof.height],
          agent_johnson: this.state!.trucks?.phase === 'collision'
            ? [TRUCKS.roof.x, 14, .5] : [TRUCKS.johnson.x, TRUCKS.johnson.z, TRUCKS.roof.height],
          niobe: [TRUCKS.niobe.x, TRUCKS.niobe.z, .5], neo: [TRUCKS.morpheus.x, -58, 23],
        };
        const pose = poses[id]; if (pose) {
          actor.position = { ...filmPosition(scene.set, pose[0], pose[1]), y: FILM_SETS[scene.set].center.y + pose[2] };
          if (id === 'niobe') actor.currentAction = { type: 'idle', parameters: { seated: true }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
          if (id === 'agent_johnson' && this.state!.trucks?.phase === 'collision') actor.currentAction = { type: 'idle', parameters: { seated: true }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
          if (id === 'neo') actor.currentAction = { type: 'move_to', parameters: { truckFlight: true, resolved: true }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
        }
      }
      if (scene.id === 'm2_ship_lost') {
        const spots: Record<string, [number, number, number]> = { neo: [2, 22, 0], trinity: [5, 24, 0], link: [4, 1, Math.PI] };
        const spot = spots[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
      }
      if (scene.id === 'm2_stop_sentinels') {
        const spots: Record<string, [number, number, number]> = { trinity: [-6, -35, 0], morpheus: [6, -35, 0], link: [0, -40, 0] };
        const spot = spots[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
      }
      if (scene.id === 'm2_medical') {
        const spots: Record<string, [number, number, number]> = { neo: [-10, -23, 0], bane: [10, -23, 0], maggie: [-13, -21, Math.PI], morpheus: [2, -16, Math.PI], roland: [0, -18, 0] };
        const spot = spots[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
        if (id === 'neo' || id === 'bane') actor.currentAction = { type: 'idle', parameters: { resolved: true, finaleComa: true }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if (['m3_mobil', 'm3_family', 'm3_trainman'].includes(scene.id)) {
        const spots: Record<string, [number, number, number]> = { sati: [-5, scene.id === 'm3_mobil' ? 12 : -8, 0],
          rama_kandra: [-12, -8, Math.PI / 2], kamala: [-10, -8, Math.PI / 2], trainman: [12, -80, -Math.PI / 2] };
        const spot = spots[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
        if (scene.id === 'm3_family' && id === 'kamala') actor.currentAction = { type: 'idle', parameters: { seated: true }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if (scene.id === 'm3_trainman_chase') {
        const spots: Record<string, [number, number, number]> = { trainman: [0, 10, Math.PI], trinity: [-4, 22, Math.PI], morpheus: [4, 22, Math.PI] };
        const spot = spots[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
      }
      if (['m3_hel_garage', 'm3_hel_entry', 'm3_hel_bargain'].includes(scene.id)) {
        const z = scene.id === 'm3_hel_garage' ? 23 : scene.id === 'm3_hel_entry' ? 34 : -27;
        const spots: Record<string, [number, number, number]> = { morpheus: [-4, z, Math.PI], seraph: [4, z, Math.PI],
          merovingian: [0, -35, 0], persephone: [5, -35, 0], trainman: [-9, -32, 0] };
        const spot = spots[id]; if (spot) { actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.rotation = spot[2]; }
        if (spot && scene.id === 'm3_hel_bargain' && spot[1] < -28) actor.position.y += .6;
      }
      if (scene.id === 'm3_mobil_release') {
        const spot: [number, number, number] = id === 'trainman' ? [13, -80, -Math.PI / 2] : [12, -80, -Math.PI / 2];
        actor.position = filmPosition(scene.set, spot[0], spot[1]); actor.position.y -= 1.35; actor.rotation = spot[2];
      }
    });
  }
  private near(agent: AgentState, step: FilmStep): boolean {
    const radius = this.state?.scene === 'm1_mirror' && this.state.step === 0 ? MIRROR_TOUCH.radius : 4;
    return agent.isInMatrix === (FILM_SETS[this.scene!.set].world === 'matrix') && distance(agent.position, filmStepPosition(this.scene!, step)) <= radius;
  }
  private advance(text: string, agent: AgentState, tick: number): void {
    const state = this.state!; const life = this.sandbox().neoLife!;
    if (state.scene === 'm2_architect' && state.architect) {
      const encounter = state.architect;
      if (state.step === 1) encounter.phase = 'source';
      if (state.step === 2) { encounter.sourceReviewed = true; encounter.phase = 'trinity'; }
      if (state.step === 3) { encounter.trinityReviewed = true; encounter.phase = 'reflection'; }
      if (state.step === 4) { encounter.phase = 'decision'; encounter.remaining = ARCHITECT_DOOR_SECONDS; encounter.lastTick = tick; }
      if (state.step === 5) {
        if (this.world.agents.get('trinity')?.controller) {
          state.lastText = 'Trinity 正由另一位玩家控制，营救选择等待她完成当前行动。'; delete state.started; return;
        }
        if (encounter.phase !== 'decision' || !encounter.sourceReviewed || !encounter.trinityReviewed) {
          state.lastText = '先了解两扇门的代价，再作出选择。'; delete state.started; return;
        }
        encounter.phase = 'done'; encounter.door = 'matrix'; life.choices.architect_door = 'matrix';
      }
    }
    if (state.scene === 'm2_backup' && state.step === 1) {
      const grid = this.grid(tick);
      if (grid.primary !== 'armed' || grid.vigilant !== 'lost' || grid.trinity !== 'connected') {
        state.lastText = '主网装置、Vigilant 的失联确认和 Trinity 的补位尚未全部完成。'; delete state.started; return;
      }
      grid.primary = 'off'; grid.emergency = 'online'; grid.phase = 'emergency'; grid.hackRemaining = GRID_HACK_SECONDS; grid.lastTick = tick;
    }
    if (state.scene === 'm2_key_door' && [3, 5].includes(state.step)) {
      const grid = this.grid(tick);
      if (grid.phase !== 'window') { state.lastText = '连接窗口已经关闭。先在门前完成改线。'; delete state.started; return; }
      if (state.step === 5) grid.phase = 'opened';
    }
    if (state.scene === 'm2_key_door' && state.keyDoor) {
      const keymaker = this.world.agents.get('keymaker'); const morpheus = this.world.agents.get('morpheus');
      if (state.step === 2) {
        if (morpheus && !morpheus.controller) morpheus.position = filmPosition(this.scene!.set, -2, -37);
      }
      if (state.step === 3) {
        state.keyDoor.portalOpened = true;
        if (keymaker && !keymaker.controller) {
          keymaker.position = filmPosition(this.scene!.set, 1, -45); keymaker.health = Math.max(1, Math.round(keymaker.maxHealth * .18));
          keymaker.currentAction = { type: 'idle', parameters: { crouching: true, resolved: true }, startedAt: tick, duration: 100000, progress: 0 };
        }
        if (morpheus && !morpheus.controller) morpheus.position = filmPosition(this.scene!.set, -2, -43);
      }
      if (state.step === 4) {
        state.keyDoor.keyTaken = true;
        if (keymaker && !keymaker.controller) { keymaker.status = 'dead'; keymaker.health = 0; keymaker.currentAction = null; }
      }
    }
    if (state.scene === 'm2_power' && state.step === 1) this.grid(tick).primary = 'armed';
    if (state.scene === 'm2_vigilant' && state.step === 0) this.grid(tick).vigilant = 'lost';
    if (state.scene === 'm2_vigilant' && state.step === 1) this.grid(tick).trinity = 'connected';
    if (state.scene === 'm2_library' && state.keymaker) {
      if (state.step === 1) {
        const cain = this.world.agents.get('cain'); if (cain && !cain.controller) { cain.status = 'dead'; cain.currentAction = null; }
        const abel = this.world.agents.get('abel_mero'); if (abel && !abel.controller) abel.targetPosition = filmPosition(this.scene!.set, 0, 26);
      }
      if (state.step === 2) state.keymaker.phase = 'revealed';
      if (state.step === 3) { state.keymaker.phase = 'following'; state.keymaker.separated = 0; }
      if (state.step === 4) { state.keymaker.phase = 'escaped'; life.choices.keymaker_rescued = 'yes'; }
    }
    if (state.scene === 'm2_seraph' && state.step === 0) {
      const seraph = this.world.agents.get('seraph'); if (seraph && !seraph.controller) { seraph.position = filmPosition(this.scene!.set, 2.8, -24); seraph.rotation = Math.PI; }
    }
    if (state.scene === 'm2_bench' && state.step === 3) {
      life.choices.oracle_second_lead = 'le_vrai';
      const oracle = this.world.agents.get('oracle');
      if (oracle && !oracle.controller) {
        oracle.currentAction = null;
        oracle.targetPosition = filmPosition(this.scene!.set, -18, 25);
        oracle.currentPath = [filmPosition(this.scene!.set, -9, -16), filmPosition(this.scene!.set, -18, -12)];
      }
    }
    if (state.scene === 'm2_dock' && state.step === 2) life.choices.zion_ship_charged = 'yes';
    if (state.scene === 'm2_lock' && state.step === 1) life.choices.zion_lock_reported = '72h';
    if (state.scene === 'm2_residents' && state.step === 1) life.choices.zion_jacob_request = 'Gnosis';
    if (state.scene === 'm2_residents' && state.step === 2) life.choices.zion_icarus_request = 'Icarus';
    if (state.scene === 'm2_residents' && state.step === 3) life.choices.zion_residents_contacted = 'both';
    if (state.scene === 'm2_temple' && state.step === 1) life.choices.zion_truth_spoken = '72h';
    if (state.scene === 'm2_room' && state.step === 1) life.choices.zion_dream_shared = 'trinity';
    if (state.scene === 'm2_bane_copy' && state.step === 1) {
      life.choices.oracle_disk_carrier = 'malachi';
      const malachi = this.world.agents.get('malachi'); if (malachi && !malachi.controller) malachi.position = filmPosition(this.scene!.set, -34, 32);
      const smith = this.world.agents.get('smith'); if (smith && !smith.controller) { smith.position = filmPosition(this.scene!.set, 3, -20); smith.rotation = 2.8; }
    }
    if (state.scene === 'm2_bane_copy' && state.step === 2) {
      life.choices.bane_infected = 'smith'; if (state.baneCopy) state.baneCopy.progress = 1;
      agent.faction = 'machines'; agent.currentGoal = 'Find Neo without revealing Smith'; agent.alertness = 8;
    }
    if (state.scene === 'm2_bane_copy' && state.step === 3) life.choices.bane_returned = 'yes';
    if (state.scene === 'm2_hamann' && state.step === 2) life.choices.zion_backup_balanced = 'yes';
    if (state.scene === 'm2_oracle_message' && state.step === 0) {
      const ballard = this.world.agents.get('ballard'); if (ballard && !ballard.controller) ballard.position = filmPosition(this.scene!.set, 2, 11);
      const malachi = this.world.agents.get('malachi'); if (malachi && !malachi.controller) malachi.position = filmPosition(this.scene!.set, -2, 12);
    }
    if (state.scene === 'm2_oracle_message' && state.step === 1) life.choices.oracle_disk_received = 'yes';
    if (state.scene === 'm2_departure' && state.step === 0) life.choices.zee_charm_given = 'link';
    if (state.scene === 'm2_departure' && state.step === 1) life.choices.bane_departure_encounter = 'unexplained';
    if (state.scene === 'm2_departure' && state.step === 2) life.choices.kid_spoon = 'received';
    if (state.scene === 'm2_departure' && state.step === 3) life.choices.zion_clearance = 'hamann';
    if (state.scene === 'm2_mountain' && state.step === 1 && state.mountain) state.mountain.phase = 'ready';
    if (state.scene === 'm2_trucks' && state.trucks) {
      if (state.step === 0) {
        state.trucks.phase = 'collision'; state.trucks.elapsed = 0; state.trucks.lastTick = tick;
        this.stageCast();
        text = 'Johnson 被踢下车，随即占据了驾驶员。另一名特工驾驶卡车迎面掉头；快去保护钥匙匠。';
      } else if (state.step === 2) {
        state.trucks.phase = 'rescued'; state.trucks.elapsed = TRUCKS.collisionSeconds;
      }
    }
    if (state.scene === 'm3_trainman' && state.step === 0) {
      this.ensureMobil(tick);
      state.mobil!.phase = 'approaching'; state.mobil!.elapsed = 0; state.mobil!.lastTick = tick;
      text = '你接过 Rama 的箱子。轨道深处亮起两束车灯，迟到的单节列车终于来了。';
    }
    if (state.scene === 'm3_trainman_chase' && state.step === 0) {
      state.helChase ??= { phase: 'sighting', elapsed: 0, lastTick: tick };
      state.helChase.phase = 'running'; state.helChase.elapsed = 0; state.helChase.lastTick = tick;
      text = 'Trainman 拉下紧急制动，朝对向站台冲去；Seraph 追出车厢。';
    }
    if (state.scene === 'm3_hel_bargain' && state.step === 2 && state.helBargain) state.helBargain.phase = 'ready';
    if (state.scene === 'm3_hel_bargain' && state.step === 5) life.choices.neo_release = 'trinity_refused_trade';
    if (state.scene === 'm1_bug' && state.step === 0 && state.office?.outcome === 'escaped') text = '扫描完成，没有发现追踪装置。Trinity 收起仪器，确认接头安全，继续前往 Morpheus 的房间。';
    state.lastText = text; state.step++; state.checkpoint = { ...agent.position }; delete state.started; delete state.fighting;
    if (state.scene === 'm1_roofs' && state.step === this.scene!.steps.length && state.openingRoof) state.openingRoof.phase = 'escaped';
    if (state.scene === 'm2_ship_lost' && state.step === this.scene!.steps.length && state.shipLoss) state.shipLoss.phase = 'escaped';
    if (state.scene === 'm2_stop_sentinels' && state.step === 1 && state.tunnel) { state.tunnel.phase = 'sensing'; state.tunnel.lastTick = tick; }
    if (state.scene === 'm2_library') this.sealKeymakerDoor();
    if (state.scene === 'm2_key_door') this.sealSourceDoor();
    if (state.scene === 'm2_architect') this.sealArchitectDoors();
    if (state.scene === 'm2_oracle_message' && state.step === 1) this.sealZionMessageDoor();
    if (state.scene === 'm3_hel_entry') this.sealHelDanceDoor();
    if (state.scene === 'm1_desert' && state.step === 1) {
      state.awakening = { kind: 'desert', elapsed: 0, started: false };
      this.awakeningFrame(agent, 0, tick); return;
    }
    if (state.scene === 'm1_jump' && state.step === 1) {
      state.training = { kind: 'jump', elapsed: 0, started: false };
      this.trainingFrame(agent, 0, tick); return;
    }
    if (state.scene === 'm1_red_dress' && state.step === 1) {
      state.training = { kind: 'red_dress', elapsed: 0, started: false };
      this.trainingFrame(agent, 0, tick); return;
    }
    if (this.step) return;
    if (!state.completed.includes(state.scene)) {
      state.completed.push(state.scene);
      this.reconcileCast();
      const observing = state.scene === 'm1_steak' || state.scene === 'm2_bane_copy';
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: observing ? `旁观片段 · ${this.scene!.title}` : this.scene!.title,
        text: observing ? `这不是 Neo 此时拥有的角色知识。${text}` : text });
      life.journal = life.journal.slice(0, 120);
      const profile = this.sandbox().profiles[agent.id]; if (profile) profile.xp += 15;
    }
    state.enteredAt = tick;
  }
  private clearThreats(): void {
    this.sandbox().threats = this.sandbox().threats.filter(t => !t.scene);
    for (const actor of this.world.agents.values()) if (actor.currentAction?.parameters.filmDuel) actor.currentAction = null;
  }
  private spawn(agent: AgentState, step: FilmStep, tick: number): void {
    const kind = step.enemy ?? 'agent'; const health = this.state?.scene === 'm1_dojo' ? 999 : step.opponent === 'morpheus' ? 80 : step.opponent === 'seraph' ? 100 : kind === 'smith' ? 135 : kind === 'sentinel' ? 58 : kind === 'training' ? 36 : 48;
    for (let i = 0; i < (step.enemies ?? 2); i++) {
      const angle = i * Math.PI * 2 / (step.enemies ?? 2);
      const facing = agent.rotation + ((step.enemies ?? 1) > 1 ? angle * .35 : 0);
      let position = step.opponent
        ? { ...agent.position, x: agent.position.x + Math.sin(facing) * 6, z: agent.position.z + Math.cos(facing) * 6 }
        : filmPosition(this.scene!.set, step.x + Math.sin(angle) * 9, step.z + Math.cos(angle) * 9);
      if (this.state?.scene === 'm2_trucks') position = { ...filmPosition(this.scene!.set, TRUCKS.johnson.x, TRUCKS.johnson.z), y: FILM_SETS[this.scene!.set].center.y + TRUCKS.roof.height };
      if (playerBlocked(position, agent.isInMatrix)) position = filmPosition(this.scene!.set, step.x, step.z - 5 - i * 3);
      this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`, scene: this.state!.scene, kind, character: step.opponent, position, matrix: agent.isInMatrix,
        health, maxHealth: health, target: agent.id, stunUntil: tick + 4, lastStrike: tick });
      const opponent = step.opponent && this.world.agents.get(step.opponent);
      if (opponent) opponent.currentAction = { type: 'idle', parameters: { filmDuel: true }, startedAt: tick, duration: 100000, progress: 0 };
    }
  }
  tick(tick: number): void {
    const state = this.state; if (!state || !this.scene || state.finished || state.visiting) return;
    this.ensureFinale(tick);
    if (state.scene === 'm2_key_door') this.sourceDoor();
    const actor = this.world.agents.get(state.actor);
    this.finaleTick(actor, tick);
    if (state.scene === 'm2_ship_lost' && state.shipLoss?.phase === 'failed' || state.scene === 'm2_stop_sentinels' && state.tunnel?.phase === 'failed') return;
    if (state.scene === 'm2_architect') this.architectTick(actor, tick);
    if (['m2_plan', 'm2_power', 'm2_vigilant', 'm2_backup', 'm2_key_door'].includes(state.scene)) this.gridTick(actor, tick);
    if (state.scene === 'm2_trucks' && actor?.currentLocation === 'film_freeway_101') {
      const roof = filmEntry(this.scene);
      this.place(actor, this.scene, roof); state.checkpoint = { ...roof };
      if (state.step >= 2) state.step = this.scene.steps.length;
      state.trucks = { phase: state.step === 0 ? 'duel' : state.step === 1 ? 'collision' : 'rescued',
        elapsed: 0, lastTick: tick, attempt: 0 };
      this.stageCast();
    }
    if (!actor?.controller || actor.status !== 'alive') {
      if (state.openingHotel) state.openingHotel.lastTick = tick;
      if (state.openingRoof) state.openingRoof.lastTick = tick;
      if (state.openingPhone) state.openingPhone.lastTick = tick;
      if (state.mobil) state.mobil.lastTick = tick;
      if (state.helChase) state.helChase.lastTick = tick;
      if (state.helElevator) state.helElevator.lastTick = tick;
      if (state.helDanceDoor) state.helDanceDoor.lastTick = tick;
      if (state.helDanceDoor) state.helDanceDoor.allyTick = tick;
      if (state.helBargain) state.helBargain.lastTick = tick;
      if (actor?.status === 'alive' && state.scene === 'm2_trucks' && state.trucks) {
        const gap = Math.max(0, tick - state.trucks.lastTick);
        if (state.started !== undefined) state.started += gap;
        state.trucks.lastTick = tick;
      } else delete state.started;
      return;
    }
    if (state.scene === 'm2_trucks' && !state.trucks)
      state.trucks = { phase: state.step === 0 ? 'duel' : 'collision', elapsed: 0, lastTick: tick, attempt: 0 };
    if (state.scene === 'm1_roofs') { this.openingRoofTick(actor, tick); if (state.openingRoof?.phase === 'failed') return; }
    if (state.scene === 'm1_phone_escape') { this.openingPhoneTick(tick); if (state.openingPhone?.phase === 'failed') return; }
    if (state.scene === 'm1_room303' && this.openingHotel.tick(actor, tick)) return;
    if (['m3_mobil', 'm3_family', 'm3_trainman', 'm3_mobil_release'].includes(state.scene)) this.mobilTick(actor, tick);
    if (state.scene === 'm3_trainman_chase') this.helChaseTick(tick);
    if (state.scene === 'm3_hel_entry') { this.ensureHelDanceDoor(tick); this.helElevatorTick(actor, tick); this.helDanceDoorTick(actor, tick); this.helDanceAlliesTick(actor, tick); this.sealHelElevator(); this.sealHelDanceDoor(); }
    if (state.scene === 'm3_hel_bargain') this.helBargainTick(actor, tick);
    if (state.scene === 'm2_trucks' && state.trucks?.phase === 'collision') {
      state.trucks.elapsed = Math.min(TRUCKS.collisionSeconds, state.trucks.elapsed + Math.max(0, tick - state.trucks.lastTick) * .5);
      state.trucks.lastTick = tick;
      const neo = this.world.agents.get('neo');
      if (neo && !neo.controller && state.trucks.elapsed >= 5.5) {
        const approach = (state.trucks.elapsed - 5.5) / (TRUCKS.collisionSeconds - 5.5);
        neo.position = { ...filmPosition(this.scene.set, TRUCKS.roof.x, -58 + approach * 91),
          y: FILM_SETS[this.scene.set].center.y + 23 - approach * 12 };
        neo.velocity = { x: 0, y: -12 / 4.5, z: 91 / 4.5 };
      }
      if (state.trucks.elapsed >= TRUCKS.collisionSeconds) {
        state.trucks.phase = 'failed'; actor.status = 'dead'; actor.health = 0; delete state.started;
        state.lastText = '两辆卡车先于 Neo 的接应正面相撞。按 J 从车顶检查点重试。'; return;
      }
    }
    if (state.scene === 'm2_burly') { this.burlyTick(actor, tick); return; }
    if (state.scene === 'm2_chateau' && state.step === 0) { this.chateauTick(actor, tick); return; }
    if (state.scene === 'm2_library' && state.step === 4) {
      if (this.world.agents.get('keymaker')?.controller) return;
      const escort = state.keymaker;
      if (escort && this.near(actor, this.step!) && Math.hypot(escort.x - EXILES.escape.x, escort.z - EXILES.escape.z) <= EXILES.escapeRange)
        this.advance('钥匙匠跟上了。Morpheus 与 Trinity 接过护送，Neo 留在大厅挡住赶来的守卫。', actor, tick);
      else if (escort && this.near(actor, this.step!)) state.lastText = '钥匙匠仍在身后。回去接应他，保持在能跟上的距离。';
      return;
    }
    if (state.scene === 'm2_bane_copy' && state.baneCopy && state.step === 2 && state.started !== undefined) state.baneCopy.progress = Math.min(1, (tick - state.started) / 10);
    if (state.scene === 'm1_office_escape') {
      if (this.office.tick(actor, tick)) {
        this.capture(actor, tick, '特工认出了你并封住通道。你被带去审讯；这次失败仍然通往接头与真相。'); return;
      }
      if (state.step === 2) { delete state.started; return; }
    }
    if (this.reloaded.active(actor)) return;
    if (this.catch.active(actor)) return;
    if (state.matrixEscape && ['m1_subway', 'm1_city_chase'].includes(state.scene)) return;
    if (state.theOne && ['m1_death', 'm1_return', 'm1_final_call'].includes(state.scene)) return;
    const step = this.step; if (!step) return;
    if (state.scene === 'm1_wake_up') { delete state.started; return; }
    if (state.scene === 'm1_boss' && state.step === 1) { delete state.started; return; }
    if (this.performing(actor)) return;
    if (this.climbing(actor)) return;
    if (step.kind === 'drive') {
      if (state.scene === 'm2_garage' && state.garage?.phase === 'arrived') {
        actor.position.y = FILM_SETS[this.scene.set].center.y; actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null;
        for (const id of ['morpheus', 'keymaker', 'twin1', 'twin2']) {
          const passenger = this.world.agents.get(id); if (passenger && !passenger.controller) { passenger.velocity = { x: 0, y: 0, z: 0 }; passenger.currentAction = null; }
        }
        this.advance('轿车冲出车库。双子转身抢另一辆车追来；Link 只能在高速公路外侧接应，Trinity 必须继续护送钥匙匠。', actor, tick);
        return;
      }
      if (state.ride?.phase === 'arrived') {
        actor.position.y = FILM_SETS[this.scene.set].center.y; actor.velocity = { x: 0, y: 0, z: 0 }; actor.currentAction = null;
        const passenger = this.world.agents.get('keymaker');
        if (passenger && !passenger.controller) { passenger.position = filmPosition(this.scene.set, 20, -660); passenger.velocity = { x: 0, y: 0, z: 0 }; passenger.currentAction = null; }
        this.advance('你把钥匙匠安全带过车流。Morpheus 正在护栏旁等待，先下车与他汇合。', actor, tick);
      }
      return;
    }
    if (state.scene === 'm1_jump' && state.step === 1 && actor.position.y < FILM_SETS[this.scene.set].center.y - 8) {
      actor.position = { ...state.checkpoint }; actor.velocity = { x: 0, y: 0, z: 0 }; actor.health = Math.max(1, actor.health - 12);
      this.advance('第一次跳跃失败。程序把你送回起跳线，但身体仍记得坠落的痛感。现在可以回到连接椅。', actor, tick);
      return;
    }
    if (state.scene === 'm3_trainman' && state.step === 1 && state.mobil?.phase !== 'stopped') return;
    if (state.scene === 'm3_trainman' && state.step >= 3) return;
    if (state.scene === 'm3_mobil_release' && state.step === 0 && state.mobil?.phase !== 'stopped') return;
    if (state.scene === 'm1_ledge' && actor.position.y < FILM_SETS[this.scene.set].center.y - 6) {
      this.capture(actor, tick, '你失足抓住下方维修架，赶来的保安将你带回室内。被捕之后，故事仍会继续。'); return;
    }
    if (state.scene === 'm1_lobby' && step.kind === 'fight' && state.fighting) {
      if (this.lobby.tick(actor, tick)) {
        const ally = this.world.agents.get('trinity'); if (ally && !ally.controller) ally.velocity = { x: 0, y: 0, z: 0 };
        this.advance('警戒已经解除。与 Trinity 前往大厅尽头的电梯。', actor, tick);
      }
      return;
    }
    if (state.scene === 'm3_hel_entry' && step.kind === 'fight' && state.fighting) {
      if (this.coatcheck.tick(actor, tick)) this.advance('最后一名守卫倒下。Seraph 确认女服务生仍躲在柜台后，三人去武器检查柜补齐装备。', actor, tick);
      return;
    }
    if (step.kind === 'reach' && this.near(actor, step)) this.advance(step.label, actor, tick);
    else if (state.started !== undefined) {
      if (!this.near(actor, step)) { delete state.started; state.lastText = '已离开互动位置。返回标记旁可重新开始。'; }
      else if (tick - state.started >= (step.seconds ?? 3) * 2) {
        if (state.scene === 'm2_trucks' && state.step === 2 && state.trucks) {
          state.trucks.phase = 'rescue'; state.trucks.elapsed = TRUCKS.collisionSeconds;
          state.trucks.rescueElapsed = 0;
          state.trucks.origin = { x: actor.position.x - FILM_SETS[this.scene.set].center.x, z: actor.position.z - FILM_SETS[this.scene.set].center.z };
          delete state.started; this.truckFrame(actor, 0, tick);
        } else this.advance(step.text ?? step.label, actor, tick);
      }
    } else if (step.kind === 'fight' && state.fighting && !this.sandbox().threats.some(t => t.scene === state.scene)) {
      this.clearThreats();
      this.advance(step.enemy === 'training' ? '对练结束，对手收起架势。可以继续交谈。' : '通路已经打开。继续完成本场景的目标。', actor, tick);
    }
  }
}
