import { FILM_SCENES, FILM_SCENE_BY_ID, FILM_SETS, FILM_CAST, filmReflections, CHARACTERS, LOCATIONS, NEO_CHAPTERS, filmCharacterFates, filmEntry, filmPosition, filmStepPosition, locationEntrance, distance, playerBlocked, newFreewayRide, stepFreeway, OFFICE_LADDER, awakeningLocked, awakeningPose, AWAKENING_SECONDS, CONSTRUCT_REVEAL, DESERT_REVEAL, oracleActing,
  AMBUSH_REWRITE, AMBUSH_SECONDS, AMBUSH_SEALS, OFFICE_CONTACT, OFFICE_WINDOW, OFFICE_CROSSING_SECONDS, officeCrossingPose, windowCrossing, phoneLocked, heldPhone, windowOpening, pillLocked, pillRoot, PILL_ROOM, PILL_TIMING, trainingLocked, trainingRoot, trainingText, TRAINING_SECONDS,
  type DriveInput, type AgentState, type FilmScene, type FilmStep, type SandboxState, type SandboxThreat, type TrainingRole } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';
import { LobbyCombatSystem } from './LobbyCombatSystem.js';
import { OfficeEscapeSystem } from './OfficeEscapeSystem.js';
import { INTERROGATION_CAST, INTERROGATION_TIMING, interrogationLocked, interrogationRoot } from '@auto_matrix/shared';
import { MEETING_CAR, MEETING_CAST, MEETING_TIMING, meetingLocked, meetingRoot, type MeetingEncounter } from '@auto_matrix/shared';
import { LAFAYETTE, LAFAYETTE_WELCOME, LAFAYETTE_KNOCK_SECONDS, HOTEL_ROUTE_LENGTH, HOTEL_DOOR_PROGRESS, hotelRoutePose, hotelRouteProgress, lafayetteKnocking, lafayetteKnockRoot, lafayetteWelcomeLocked, lafayetteWelcomeRoot, filmSetAt } from '@auto_matrix/shared';
import { OFFICE_WORKDAY, OFFICE_DELIVERY_SECONDS, officeCourierRoot, officeRecipientRoot, workdayLocked, workdayText } from '@auto_matrix/shared';
import { APARTMENT, apartmentAfter, apartmentDoor, apartmentLocked, apartmentText, lifeRoomCenter, type ApartmentPhase } from '@auto_matrix/shared';

export class FilmStorySystem {
  // The controller owns socket sessions. It can refuse a handoff occupied by another player.
  handoff?: (from: AgentState, to: string, tick: number, newCycle?: boolean) => boolean;
  readonly lobby: LobbyCombatSystem;
  readonly office: OfficeEscapeSystem;
  constructor(private world: WorldState, private sandbox: () => SandboxState, private returnToLife: (tick: number) => void) { this.lobby = new LobbyCombatSystem(world, sandbox); this.office = new OfficeEscapeSystem(sandbox); }
  get state() { return this.sandbox().neoLife?.journey; }
  get scene(): FilmScene | undefined { return this.state && FILM_SCENE_BY_ID[this.state.scene]; }
  get step(): FilmStep | undefined { return this.scene?.steps[this.state!.step]; }
  controls(agent: AgentState): boolean { return Boolean(this.state && this.state.actor === agent.id); }
  performing(agent: AgentState): boolean { return this.controls(agent) && (apartmentLocked(this.state!) || workdayLocked(this.state!) || awakeningLocked(this.state!) || trainingLocked(this.state!) || oracleActing(this.state!) || phoneLocked(this.state!) || windowOpening(this.state!) || windowCrossing(this.state!) || pillLocked(this.state!) || interrogationLocked(this.state!) || meetingLocked(this.state!) || lafayetteKnocking(this.state!) || lafayetteWelcomeLocked(this.state!)); }
  apartmentFrame(agent: AgentState, dt: number, tick: number): void {
    const state = this.state;
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
      if (oracle.vase >= 4.5) { this.sandbox().neoLife!.choices.oracle_vase = 'broken'; this.advance(this.step!.text!, agent, tick); }
    }
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
      if (state.scene === 'm1_wake_up' && state.contact) {
        delete state.visiting; delete state.returnPosition;
        agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
        this.place(agent, this.scene, { ...state.checkpoint }); this.apartmentFrame(agent, 0, tick);
        return '已回到公寓当前目标，保留屏幕、房门、磁盘和交易进度。';
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
        if (!state.fighting) { state.fighting = true; this.lobby.start(agent, tick); }
        return '左键 / T 射击 · R 换弹 · F 近战 · X 闪避 · Q 子弹时间。柱列能遮挡枪火。';
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
    this.sandbox().structures = this.sandbox().structures.filter(s => s.id !== 'film:apartment:door');
    delete state.pills;
    delete state.interrogation;
    if (!['m1_pills', 'm1_mirror'].includes(scene.id)) { delete state.hotel; this.sealHotelDoor(); }
    if (scene.id !== 'm1_bug') {
      delete state.meeting;
      for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.meeting) other.currentAction = null;
    }
    for (const other of this.world.agents.values()) if (!other.controller && other.currentAction?.parameters.interrogation) other.currentAction = null;
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
    if (scene.id === 'm1_wake_again' && state.office?.outcome === 'escaped') state.lastText = '脱身后，Morpheus 再次来电。前往 Adams Street 桥下，与接应者见面。';
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
      if (scene.id === 'm1_lobby' && id === 'trinity') actor.position = filmPosition(scene.set, -4, 30);
      actor.rotation = i % 2 ? -Math.PI / 2 : Math.PI / 2;
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
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: this.scene!.title, text });
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
