import { FILM_SCENES, FILM_SCENE_BY_ID, FILM_SETS, FILM_CAST, filmReflections, CHARACTERS, LOCATIONS, NEO_CHAPTERS, filmCharacterFates, filmEntry, filmPosition, filmStepPosition, locationEntrance, distance, playerBlocked, newFreewayRide, stepFreeway, OFFICE_LADDER, awakeningLocked, awakeningPose, AWAKENING_SECONDS, CONSTRUCT_REVEAL, DESERT_REVEAL, oracleActing,
  AMBUSH_REWRITE, AMBUSH_SECONDS, AMBUSH_SEALS, OFFICE_CONTACT, OFFICE_WINDOW, OFFICE_CROSSING_SECONDS, officeCrossingPose, windowCrossing, phoneLocked, heldPhone, windowOpening, pillLocked, pillRoot, PILL_ROOM, PILL_TIMING, trainingLocked, trainingRoot, trainingText, TRAINING_SECONDS,
  lobbyLocked, type DriveInput, type AgentState, type FilmScene, type FilmStep, type SandboxState, type SandboxThreat, type TrainingRole, type CombatImpact } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import { LobbyCombatSystem } from './LobbyCombatSystem.js';
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

const BATHROOM_ROLES = ['neo', 'trinity', 'switch', 'apoc'] as const;
const UNPLUGGED_ROLES = ['tank', 'cypher', 'dozer', 'apoc', 'switch', 'neo', 'trinity'] as const;

export class FilmStorySystem {
  // The controller owns socket sessions. It can refuse a handoff occupied by another player.
  handoff?: (from: AgentState, to: string, tick: number, newCycle?: boolean) => boolean;
  onImpact?: (impact: CombatImpact, tick: number) => void;
  readonly lobby: LobbyCombatSystem;
  readonly office: OfficeEscapeSystem;
  constructor(private world: WorldState, private sandbox: () => SandboxState, private returnToLife: (tick: number) => void) { this.lobby = new LobbyCombatSystem(world, sandbox); this.office = new OfficeEscapeSystem(sandbox); }
  get state() { return this.sandbox().neoLife?.journey; }
  get scene(): FilmScene | undefined { return this.state && FILM_SCENE_BY_ID[this.state.scene]; }
  get step(): FilmStep | undefined { return this.scene?.steps[this.state!.step]; }
  controls(agent: AgentState): boolean { return Boolean(this.state && this.state.actor === agent.id); }
  performing(agent: AgentState): boolean { return this.controls(agent) && (clubLocked(this.state!) || apartmentLocked(this.state!) || wakeCallLocked(this.state!) || workdayLocked(this.state!) || awakeningLocked(this.state!) || trainingLocked(this.state!) || sentinelLocked(this.state!) || interludeLocked(this.state!) || oracleActing(this.state!) || betrayalLocked(this.state!) || rescueLocked(this.state!) || governmentLocked(this.state!) || airRescueLocked(this.state!) || matrixEscapeLocked(this.state!) || lobbyLocked(this.state!) || phoneLocked(this.state!) || windowOpening(this.state!) || windowCrossing(this.state!) || pillLocked(this.state!) || interrogationLocked(this.state!) || meetingLocked(this.state!) || lafayetteKnocking(this.state!) || lafayetteWelcomeLocked(this.state!)); }
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
    if (!state || !scene || state.awakening || state.visiting) return;
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
      else { life.philosophy.agency++; this.advance('红色药丸已经吞下。Morpheus 示意接线组开始定位，裂镜就在房间另一侧。', agent, tick); }
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
    const wasPlaying = beat && beat.elapsed < AWAKENING_SECONDS[beat.kind] && beat.started !== false && !morpheus?.controller;
    if (wasPlaying) beat.elapsed = Math.min(AWAKENING_SECONDS[beat.kind], beat.elapsed + Math.min(.1, dt));
    const pose = awakeningPose(beat); const previous = agent.position;
    agent.position = filmPosition(this.scene!.set, pose.x, pose.z); agent.position.y += pose.y;
    agent.rotation = beat?.kind === 'construct' ? CONSTRUCT_REVEAL.neo.yaw : beat?.kind === 'desert' ? DESERT_REVEAL.neo.yaw : Math.PI;
    agent.velocity = dt > 0 ? { x: 0, y: (agent.position.y - previous.y) / dt, z: (agent.position.z - previous.z) / dt } : { x: 0, y: 0, z: 0 };
    agent.currentAction = { type: 'idle', parameters: { player: true, resolved: true, filmPose: pose.pose,
      mirror: beat?.kind === 'mirror' ? beat.elapsed / 8 : 0, recovery: beat?.kind === 'recovery' ? beat.elapsed : undefined,
      seated: beat?.kind === 'construct', reveal: reveal ? { kind: beat.kind, elapsed: beat.elapsed, role: 'neo' } : undefined }, startedAt: tick, duration: 1, progress: 0 };
    if (reveal && morpheus && !morpheus.controller) {
      const root = beat.kind === 'construct' ? CONSTRUCT_REVEAL.morpheus : DESERT_REVEAL.morpheus;
      const before = morpheus.position; morpheus.position = filmPosition(this.scene!.set, root.x, root.z); morpheus.rotation = root.yaw;
      morpheus.velocity = dt > 0 ? { x: (morpheus.position.x - before.x) / dt, y: 0, z: (morpheus.position.z - before.z) / dt } : { x: 0, y: 0, z: 0 };
      morpheus.currentLocation = this.scene!.set; morpheus.isInMatrix = FILM_SETS[this.scene!.set].world === 'matrix';
      morpheus.currentAction = { type: 'idle', parameters: { resolved: true, filmPose: pose.pose, seated: beat.kind === 'construct',
        reveal: { kind: beat.kind, elapsed: beat.elapsed, role: 'morpheus' } }, startedAt: tick, duration: 1, progress: 0 };
    }
    state.lastText = morpheus?.controller ? '揭示暂停在当前画面：Morpheus 正由另一位玩家控制。' : pose.text;
    if (wasPlaying && beat.elapsed >= AWAKENING_SECONDS[beat.kind]) this.advance(this.step!.text!, agent, tick);
    return true;
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
    if (!state || state.scene !== 'm1_dojo' || state.step !== 0 || threat.scene !== state.scene || threat.character !== 'morpheus') return false;
    const dojo = state.dojo ??= { dodged: false, combo: 0, hits: 0 };
    if (dojo.dodged) return true;
    dojo.dodged = true; dojo.combo = 0;
    threat.stunUntil = Number.MAX_SAFE_INTEGER;
    state.lastText = '你看见了 Morpheus 的起手并闪到攻击线外。现在按 F 完成刺拳、直拳、正蹬三段反击。';
    agent.currentAction = { type: 'defend', parameters: { player: true, resolved: true }, startedAt: tick, duration: 1, progress: 0 };
    return true;
  }
  trainingHit(agent: AgentState, threat: SandboxThreat, combo: number): boolean {
    const state = this.state;
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
  climbing(agent: AgentState): boolean { return this.controls(agent) && !this.state?.visiting && this.state?.scene === 'm1_ledge' && this.state.step === 1 && this.state.office?.climbed !== undefined; }
  climbFrame(agent: AgentState, direction: number, dt: number, tick: number): boolean {
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
  driving(agent: AgentState): boolean { return this.controls(agent) && !this.state?.visiting && this.state?.scene === 'm2_freeway' && this.state?.ride?.phase === 'riding'; }
  driveFrame(agent: AgentState, input: DriveInput, dt: number, tick: number): boolean {
    if (!this.driving(agent)) return false;
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
  reconcileCast(): void {
    if (!this.state) return;
    this.sealAmbush();
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
    }
    if (!reset) this.reconcileCast();
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
    if (target === 'return' && state.visiting) {
      agent.position = { ...(state.returnPosition ?? state.checkpoint) }; agent.currentLocation = this.scene.set;
      agent.isInMatrix = FILM_SETS[this.scene.set].world === 'matrix';
      delete state.visiting; delete state.returnPosition; this.stageCast();
      return '已回到原来的剧情检查点。';
    }
    if (target.startsWith('visit:')) {
      const visited = FILM_SCENE_BY_ID[target.slice(6)];
      if (!visited || !state.completed.includes(visited.id)) return '完成这个场景后才能回访。';
      if (state.fighting || state.started !== undefined || state.ride?.phase === 'riding' || this.climbing(agent) || this.performing(agent)) return '先完成当前战斗或互动，再回访场景。';
      if (!state.visiting) state.returnPosition = { ...agent.position };
      state.visiting = visited.id; this.place(agent, visited, filmEntry(visited));
      return `回访${FILM_SETS[visited.set].name}。J 可返回当前剧情，回访不会改写进度。`;
    }
    if (target === 'retry') {
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
      const sameRoom = state.scene === 'm1_pills' && next.id === 'm1_mirror';
      const position = sameRoom || state.scene === 'm1_boss' && next.id === 'm1_office_escape' ? { ...agent.position } : undefined;
      const facing = agent.rotation;
      state.scene = next.id; state.actor = next.actor; state.step = 0; state.lastText = next.context;
      this.enter(next, tick, position);
      if (sameRoom) agent.rotation = facing;
      return `${next.title} · ${FILM_SETS[next.set].name}。`;
    }
    const step = this.step;
    if (!step) return '本场景已完成。G 或 J 继续下一段。';
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
      const prompt = state.awakening.kind === 'recovery' ? '身体仍躺在医疗床上。按 G 示意船员开始恢复肌肉。'
        : state.awakening.kind === 'construct' ? '电视仍然关闭。按 G 请 Morpheus 开始说明。' : '灰烬中的讲解正在等待。按 G 请 Morpheus 继续。';
      if (target !== 'act') return prompt;
      if (['construct', 'desert'].includes(state.awakening.kind) && this.world.agents.get('morpheus')?.controller) return 'Morpheus 正由另一位玩家控制，揭示停在当前画面。';
      state.awakening.started = true; this.awakeningFrame(agent, 0, tick); return state.lastText;
    }
    if (state.awakening && state.awakening.elapsed < AWAKENING_SECONDS[state.awakening.kind]) return '演出进行中，可以转动视角观察；进度会自动保存。';
    if (!this.near(agent, step)) return '请走近金色目标标记（4 米内），再按 G。';
    if (state.scene === 'm1_boss' && state.step === 1) delete state.started;
    if (state.started !== undefined) return '互动进行中，移动离开会中断。';
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
      const response = state.scene === 'm1_oracle' && life.choices.oracle_vase === 'broken' ? `刚才那句提醒改变了你对花瓶的注意，也改变了行动。${choice.response}` : choice.response;
      const key = `${state.scene}:${state.step}`;
      if (!state.reflections[key]) {
        state.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
        life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `${this.scene.title} · ${choice.label}`, text: response });
      }
      this.advance(`${step.text} ${response}`, agent, tick); return response;
    }
    if (target !== 'act') return '当前没有这个场景操作。';
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
      state.awakening = { kind: state.scene === 'm1_mirror' ? state.step === 0 ? 'mirror' : 'connect' : state.step === 0 ? 'disconnect' : 'rescue', elapsed: 0 };
      this.awakeningFrame(agent, 0, tick);
      return state.lastText;
    }
    if (state.scene === 'm3_mobil' && state.step === 0) return '沿站台走进黑色隧道，亲自寻找出口。';
    if (state.scene === 'm1_jump' && state.step === 1) return 'Morpheus 已经完成示范。Shift 助跑，空格起跳；跌落会恢复检查点。';
    if (step.kind === 'reflect') return 'J 打开手记，记录自己的理解。';
    if (step.kind === 'drive') {
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
      if (state.fighting) return 'F 连击，X 闪避；清除追兵后会记录完成。';
      this.spawn(agent, step, tick); state.fighting = true;
      return '行动开始。F 连击 / X 闪避 / 1 医疗包；完成后返回目标路线。';
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
    this.clearThreats(); state.enteredAt = tick; state.checkpoint = position ?? filmEntry(scene); delete state.started; delete state.fighting;
    delete state.lobby;
    delete state.ride;
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
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.lobbyEntry) other.currentAction = null;
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.riding) { other.currentAction = null; other.velocity = { x: 0, y: 0, z: 0 }; }
    if (scene.id === 'm1_lobby') this.lobby.reset();
    const actor = this.world.agents.get(state.actor)!;
    this.place(actor, scene, state.checkpoint); actor.status = 'alive'; actor.health = actor.maxHealth; actor.activeEffects = [];
    life.chapter = NEO_CHAPTERS.findIndex(c => c.id === scene.chapter);
    const neo = this.world.agents.get('neo')!;
    neo.isAwakened = FILM_SCENES.indexOf(scene) >= FILM_SCENES.findIndex(s => s.id === 'm1_pod');
    const profile = this.sandbox().profiles[actor.id];
    if (profile) { profile.trackedMission = ''; profile.trace = 0; profile.inventory.medkit = Math.max(profile.inventory.medkit, 2); delete profile.job; if (!profile.visited.includes(scene.set)) profile.visited.push(scene.set); }
    this.sandbox().weather = FILM_SETS[scene.set].light === 'storm' ? 'rain' : 'clear';
    this.sandbox().weatherUntil = tick + 100000;
    this.stageCast();
    this.reconcileCast();
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
    if (scene.id === 'm1_bug' && state.office?.outcome === 'escaped') state.lastText = '你没有被特工带走。Switch 仍要求做安全检查，确认没有追踪装置。';
  }
  private stageCast(): void {
    const scene = this.scene!;
    scene.cast.forEach((id, i) => {
      const actor = this.world.agents.get(id);
      if (!actor || actor.controller || actor.id === this.state!.actor || this.unavailable(id)) return;
      if (id === 'trinity' && this.state?.hotel) return;
      // Cast stands clear of the playable aisle and its interaction targets.
      this.place(actor, scene, filmPosition(scene.set, (i % 2 ? 1 : -1) * (10 + Math.floor(i / 2) * 2), -6 + Math.floor(i / 2) * 8));
      if (scene.set === 'film_oracle_home') {
        if (id === 'oracle') actor.position = filmPosition(scene.set, -7, -22);
        else if (id === 'spoon_boy') actor.position = filmPosition(scene.set, -9, 8);
        else actor.position = filmPosition(scene.set, i % 2 ? 10 : -10, 5 + Math.floor(i / 2) * 6);
      }
      actor.rotation = i % 2 ? -Math.PI / 2 : Math.PI / 2;
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
      if (scene.id === 'm1_interrogation' && INTERROGATION_CAST.includes(id as typeof INTERROGATION_CAST[number])) {
        const role = id as typeof INTERROGATION_CAST[number];
        const pose = interrogationRoot({ phase: 'file', elapsed: 0, approach: { x: 0, z: 0, yaw: 0 } }, role);
        actor.position = filmPosition(scene.set, pose.x, pose.z); actor.rotation = pose.yaw;
        actor.currentAction = { type: 'idle', parameters: { interrogation: { phase: 'file', elapsed: 0, role } }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if (scene.id === 'm1_jump' && id === 'morpheus') actor.position = filmPosition(scene.set, 0, -38);
      if ((scene.id === 'm1_bridge' || scene.id === 'm1_bug') && MEETING_CAST.includes(id as typeof MEETING_CAST[number])) {
        const encounter: MeetingEncounter = this.state!.meeting ?? { phase: 'ready', elapsed: 0, bugged: false, approach: { ...MEETING_CAR.approach, yaw: -Math.PI / 2 } };
        const role = id as typeof MEETING_CAST[number]; const pose = meetingRoot(encounter, role);
        actor.position = filmPosition(scene.set, pose.x, pose.z); actor.rotation = pose.yaw;
        actor.currentAction = { type: 'idle', parameters: { meeting: { phase: encounter.phase, elapsed: encounter.elapsed, bugged: encounter.bugged, role } }, startedAt: this.state!.enteredAt, duration: 100000, progress: 0 };
      }
      if (scene.id === 'm2_freeway') actor.position = filmPosition(scene.set, id === 'keymaker' ? 19 : 20, id === 'keymaker' ? 660 : -660);
      if (scene.id === 'm2_trucks' && id === 'keymaker') actor.position = filmPosition(scene.set, 20, -6);
    });
  }
  private near(agent: AgentState, step: FilmStep): boolean {
    return agent.isInMatrix === (FILM_SETS[this.scene!.set].world === 'matrix') && distance(agent.position, filmStepPosition(this.scene!, step)) <= 4;
  }
  private advance(text: string, agent: AgentState, tick: number): void {
    const state = this.state!; const life = this.sandbox().neoLife!;
    if (state.scene === 'm1_bug' && state.step === 0 && state.office?.outcome === 'escaped') text = '扫描完成，没有发现追踪装置。Trinity 收起仪器，确认接头安全，继续前往 Morpheus 的房间。';
    state.lastText = text; state.step++; state.checkpoint = { ...agent.position }; delete state.started; delete state.fighting;
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
      const observing = state.scene === 'm1_steak';
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
      if (playerBlocked(position, agent.isInMatrix)) position = filmPosition(this.scene!.set, step.x, step.z - 5 - i * 3);
      this.sandbox().threats.push({ id: `film:${++this.sandbox().serial}`, scene: this.state!.scene, kind, character: step.opponent, position, matrix: agent.isInMatrix,
        health, maxHealth: health, target: agent.id, stunUntil: tick + 4, lastStrike: tick });
      const opponent = step.opponent && this.world.agents.get(step.opponent);
      if (opponent) opponent.currentAction = { type: 'idle', parameters: { filmDuel: true }, startedAt: tick, duration: 100000, progress: 0 };
    }
  }
  tick(tick: number): void {
    const state = this.state; if (!state || !this.scene || state.finished || state.visiting) return;
    const actor = this.world.agents.get(state.actor);
    if (!actor?.controller || actor.status !== 'alive') { delete state.started; return; }
    if (state.scene === 'm1_office_escape') {
      if (this.office.tick(actor, tick)) {
        this.capture(actor, tick, '特工认出了你并封住通道。你被带去审讯；这次失败仍然通往接头与真相。'); return;
      }
      if (state.step === 2) { delete state.started; return; }
    }
    if (state.matrixEscape && ['m1_subway', 'm1_city_chase'].includes(state.scene)) return;
    const step = this.step; if (!step) return;
    if (state.scene === 'm1_wake_up') { delete state.started; return; }
    if (state.scene === 'm1_boss' && state.step === 1) { delete state.started; return; }
    if (this.performing(actor)) return;
    if (this.climbing(actor)) return;
    if (step.kind === 'drive') {
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
    if (state.scene === 'm3_mobil' && state.step === 0) {
      if (actor.position.z < FILM_SETS[this.scene.set].center.z - 46) {
        actor.position = filmPosition(this.scene.set, 0, 42); actor.velocity = { x: 0, y: 0, z: 0 };
        this.sandbox().neoLife!.choices.mobil_loop = 'experienced';
        this.advance('隧道并没有通往城市。你从另一端走回同一个站台，墙上仍是 MOBIL AVE。', actor, tick);
      }
      return;
    }
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
    if (step.kind === 'reach' && this.near(actor, step)) this.advance(step.label, actor, tick);
    else if (state.started !== undefined) {
      if (!this.near(actor, step)) { delete state.started; state.lastText = '已离开互动位置。返回标记旁可重新开始。'; }
      else if (tick - state.started >= (step.seconds ?? 3) * 2) this.advance(step.text ?? step.label, actor, tick);
    } else if (step.kind === 'fight' && state.fighting && !this.sandbox().threats.some(t => t.scene === state.scene)) {
      this.clearThreats();
      this.advance(step.enemy === 'training' ? '对练结束，对手收起架势。可以继续交谈。' : '通路已经打开。继续完成本场景的目标。', actor, tick);
    }
  }
}
