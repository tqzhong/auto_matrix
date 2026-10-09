import { BANE_INQUIRY, FILM_SCENE_BY_ID, FILM_SETS, baneInquiryActive, baneInquiryLocked, baneInquiryText, baneInquiryLines,
  newBaneInquiry, baneInquiryRoot, filmPosition, filmReflections, distance, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class BaneInquirySystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  active(actor: AgentState): boolean { return baneInquiryActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => !item.id.startsWith('film:bane-inquiry:'));
    for (const member of this.world.agents.values()) if (!member.controller && member.currentAction?.parameters.baneInquiry) member.currentAction = null;
  }
  frame(actor: AgentState, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, scene = FILM_SCENE_BY_ID.m3_bane_questions;
    if (!journey.baneInquiry) {
      journey.baneInquiry = newBaneInquiry(journey.step, actor.health);
      // Upgrade only the old, untouched entry. A player who has already walked is not moved.
      const old = filmPosition(scene.set, 0, FILM_SETS[scene.set].depth * .32);
      if (journey.step === 0 && distance(actor.position, old) < .1) {
        actor.position = filmPosition(scene.set, BANE_INQUIRY.entry.x, BANE_INQUIRY.entry.z);
        journey.checkpoint = { ...actor.position };
      }
      if (journey.step === 0) actor.rotation = Math.atan2(BANE_INQUIRY.approach.x - (actor.position.x - FILM_SETS[scene.set].center.x),
        BANE_INQUIRY.approach.z - (actor.position.z - FILM_SETS[scene.set].center.z));
    }
    const state = journey.baneInquiry; delete journey.started;
    const neo = this.world.agents.get('neo'), center = FILM_SETS[scene.set].center;
    if (neo && !neo.controller && neo.status === 'alive' && neo.currentLocation === scene.set && Math.abs(neo.position.x - center.x) < 9.6
      && neo.position.z - center.z < -4.5 && neo.position.z - center.z > -29.5) {
      neo.position = filmPosition(scene.set, 6.1, 1.2); neo.velocity = { x: 0, y: 0, z: 0 }; neo.targetPosition = null; neo.currentPath = []; neo.currentAction = null;
    }
    const occupied = BANE_INQUIRY.cast.find(id => this.world.agents.get(id)?.controller);
    const unavailable = BANE_INQUIRY.cast.find(id => !this.world.agents.get(id) || this.world.agents.get(id)!.status !== 'alive' || this.world.agents.get(id)!.health <= 0);
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    const elapsed = !occupied && !unavailable && actor.controller && actor.status === 'alive' && actor.health > 0 ? Math.max(0, Math.min(.1, dt)) : 0;
    this.seal();
    if (state.phase === 'approach' && elapsed && actor.currentLocation === scene.set && !actor.isInMatrix
      && distance(actor.position, filmPosition(scene.set, BANE_INQUIRY.approach.x, BANE_INQUIRY.approach.z)) <= 1.05) {
      state.phase = 'ready'; this.onAdvance?.(baneInquiryText(state, 1), actor, tick);
    }
    if (state.phase === 'seating') {
      state.elapsed = Math.min(BANE_INQUIRY.sitSeconds, state.elapsed + elapsed); state.seated = state.elapsed / BANE_INQUIRY.sitSeconds;
      if (state.elapsed >= BANE_INQUIRY.sitSeconds) { state.phase = 'hearing'; state.elapsed = 0; state.seated = 1; }
    } else if (state.phase === 'hearing') {
      state.elapsed = Math.min(baneInquiryLines(journey.step).length * BANE_INQUIRY.lineSeconds, state.elapsed + elapsed);
      if (state.elapsed >= baneInquiryLines(journey.step).length * BANE_INQUIRY.lineSeconds) {
        state.elapsed = 0;
        if (journey.step === 3) state.phase = 'reviewing';
        else { state.phase = 'ready'; this.onAdvance?.(baneInquiryText(state, journey.step + 1), actor, tick); }
      }
    } else if (state.phase === 'responding' || state.phase === 'rising') {
      const responding = state.phase === 'responding', seconds = responding ? BANE_INQUIRY.lineSeconds : BANE_INQUIRY.riseSeconds;
      state.elapsed = Math.min(seconds, state.elapsed + elapsed);
      if (state.elapsed >= seconds) {
        state.elapsed = 0; state.phase = responding ? 'rising' : 'leaving'; state.seated = responding ? 1 : 0;
        if (!responding) this.onAdvance?.(baneInquiryText(state, 5), actor, tick);
      }
    } else if (state.phase === 'leaving' && elapsed && actor.currentLocation === scene.set && !actor.isInMatrix
      && distance(actor.position, filmPosition(scene.set, BANE_INQUIRY.exit.x, BANE_INQUIRY.exit.z)) <= 1.1) {
      state.phase = 'done'; this.onAdvance?.(baneInquiryText(state, 6), actor, tick);
    }
    for (const role of BANE_INQUIRY.cast) {
      const member = this.world.agents.get(role); if (!member || member.status !== 'alive' || member.health <= 0 || member.controller) continue;
      const root = BANE_INQUIRY.roots[role];
      member.position = filmPosition(scene.set, root.x, root.z); member.rotation = root.yaw; member.currentLocation = scene.set; member.isInMatrix = false;
      member.velocity = { x: 0, y: 0, z: 0 }; member.targetPosition = null; member.currentPath = [];
      member.currentAction = { type: 'idle', parameters: { resolved: true, baneInquiry: { ...state, role, step: journey.step } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
    if (baneInquiryLocked(state) && !state.paused && !state.unavailable) {
      const root = baneInquiryRoot(state, 'roland');
      actor.position = filmPosition(scene.set, root.x, root.z); actor.rotation = root.yaw;
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
      actor.currentAction = { type: 'idle', parameters: { resolved: true, baneInquiry: { ...state, role: 'roland', step: journey.step } }, startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    } else if (actor.currentAction?.parameters.baneInquiry) actor.currentAction = null;
    journey.lastText = baneInquiryText(state, journey.step); return baneInquiryLocked(state);
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, 0, tick); const journey = this.journey!, state = journey.baneInquiry!, life = this.sandbox().neoLife!;
    if (state.paused || state.unavailable) return journey.lastText;
    if (target === 'retry') {
      if (actor.status !== 'alive' || actor.health <= 0) { actor.status = 'alive'; actor.health = state.checkpointHealth; }
      actor.position = { ...journey.checkpoint }; this.frame(actor, 0, tick);
      return '已接回询问检查点。已听回答、检查结果、物品与其他人的伤势保留。';
    }
    if (actor.status !== 'alive' || actor.health <= 0) return '先在手记中接回当前询问检查点。';
    if (target === 'act' && state.phase === 'reviewing') { state.page = state.page === 'vdt' ? 'neural' : 'vdt'; this.frame(actor, 0, tick); return journey.lastText; }
    if (target.startsWith('review:') && state.phase === 'reviewing') {
      const result = target.slice(7), expected = state.page === 'vdt' ? 'negative' : 'abnormal';
      if (result !== expected) { state.mistakes++; return '这个判断与当前检查单不符。进度保留，重新核对数据。'; }
      if (!state.reviewed.includes(state.page)) state.reviewed.push(state.page);
      if (state.reviewed.length === 2) { state.phase = 'reflection'; this.onAdvance?.(baneInquiryText(state, 4), actor, tick); }
      else state.page = state.page === 'vdt' ? 'neural' : 'vdt';
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target.startsWith('reflect:') && state.phase === 'reflection' && journey.step === 4) {
      const choice = filmReflections('m3_bane_questions').find(item => item.id === target.slice(8));
      if (!choice) return '请选择手记中的一种判断。';
      const key = 'm3_bane_questions:4'; if (journey.reflections[key]) return '判断已保存，等 Roland 结束询问。';
      journey.reflections[key] = choice.id; life.choices[key] = choice.id; life.philosophy[choice.id]++;
      life.journal.unshift({ day: life.day, time: this.world.timeOfDay, title: `幸存者的说法 · ${choice.label}`, text: choice.response });
      state.reply = choice.id; state.phase = 'responding'; state.elapsed = 0; this.frame(actor, 0, tick); return journey.lastText;
    }
    if (target === 'act' && state.phase === 'ready' && [1, 2, 3].includes(journey.step)) {
      state.phase = state.seated < 1 ? 'seating' : 'hearing'; state.elapsed = 0;
      state.checkpointHealth = actor.health; journey.checkpoint = filmPosition('film_hammer_deck', BANE_INQUIRY.roots.roland.x, BANE_INQUIRY.roots.roland.z);
      this.frame(actor, 0, tick); return journey.lastText;
    }
    if (state.phase !== 'done') return journey.lastText;
  }
  private seal(): void {
    const prefix = 'film:bane-inquiry:', scene = FILM_SCENE_BY_ID.m3_bane_questions;
    if (this.sandbox().structures.some(item => item.id === `${prefix}table`)) {
      for (const item of this.sandbox().structures) if (item.id.startsWith(`${prefix}chair:`) && item.film) item.film.height = BANE_INQUIRY.seat.top;
      return;
    }
    const table = BANE_INQUIRY.table;
    for (const [name, shape] of [ ['table', { x: table.x, z: table.z, width: table.width, depth: table.depth, height: table.top }],
      ...Object.entries(BANE_INQUIRY.roots).map(([role, root]) => [`chair:${role}`, { ...root, width: BANE_INQUIRY.seat.width, depth: BANE_INQUIRY.seat.depth, height: BANE_INQUIRY.seat.top }]),
      ['wall:left', { x: -9.6, z: -17, width: .35, depth: 25, height: 7 }], ['wall:right', { x: 9.6, z: -17, width: .35, depth: 25, height: 7 }],
      ['wall:back', { x: 0, z: -29.5, width: 19.2, depth: .35, height: 7 }],
      ['wall:front:left', { x: -2.5, z: -4.5, width: 14.2, depth: .35, height: 7 }], ['wall:front:right', { x: 8.3, z: -4.5, width: 2.6, depth: .35, height: 7 }],
    ] as [string, { x: number; z: number; width: number; depth: number; height: number }][]) this.sandbox().structures.push({
      id: `${prefix}${name}`, owner: 'film', kind: 'barricade', matrix: false, health: 1e9, position: filmPosition(scene.set, shape.x, shape.z),
      film: { scene: scene.id, width: shape.width, depth: shape.depth, height: shape.height },
    });
  }
}
