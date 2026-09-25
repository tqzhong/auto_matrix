import { RELOADED, HEL_COATCHECK } from '@auto_matrix/shared';
import { LOCATIONS, heldPhone, pillLocked, lobbyLocked, governmentLocked, airRescueLocked, filmSetAt, FILM_CAST, NEO_CAST, neoSkillUnlocked, insideLifeRoom, MELEE_COMBO, COMBO_WINDOW, DOJO_COMBO_WINDOW, rescueLoadout, rescueLocked, COMBAT_SKILLS, playerSkills, dodgeDirection, combatDisplace, groundHeight, meleeReach, distance, locationEntrance, playerBlocked, stepPlayer, type AgentState, type PlayerInput, type SandboxCommand, type SkillCast, type Vector3, type CombatSkillId } from '@auto_matrix/shared';
import type { SandboxSystem } from './SandboxSystem.js';
import type { WorldState } from '../world/WorldState.js';
import type { ConversationEngine } from '../agents/ConversationEngine.js';
import type { ActionExecutor } from '../agents/ActionExecutor.js';
import type { WorldDynamics } from '../story/WorldDynamics.js';
import { INTERROGATION_CAST, interrogationLocked } from '@auto_matrix/shared';
import { MEETING_CAST, meetingLocked } from '@auto_matrix/shared';
import { SENTINEL_CAST, sentinelActive } from '@auto_matrix/shared';
import { INTERLUDE_CAST, interludeKind, interludeLocked } from '@auto_matrix/shared';
import { deusPactLocked } from '@auto_matrix/shared';

interface PlayerSession {
  agentId: string;
  input: PlayerInput;
  lastInput: number;
  vy: number;
  planar: { x: number; z: number };
  lastAttack: number;
  lastShot?: number;
  combo: number;
  strike?: { age: number; resolved: boolean };
  impulse?: { direction: Vector3; remaining: number; speed: number; strike: boolean };
  palm?: { remaining: number; yaw: number };
  stagger: number;
}
const idleInput = (): PlayerInput => ({ x: 0, z: 0, yaw: 0, pitch: 0, sprint: false, jump: false, sequence: 0 });

export class PlayerController {
  private sessions = new Map<string, PlayerSession>();
  private owners = new Map<string, string>();
  onStoryRole?: (socketId: string, agentId: string, tick: number) => void;
  onSkill?: (cast: SkillCast, tick: number) => void;
  onReplaced?: (socketId: string, tick: number) => void;

  constructor(private world: WorldState, private conversations: ConversationEngine, private actions: ActionExecutor, private dynamics: WorldDynamics, private sandbox?: SandboxSystem) {
    if (sandbox) sandbox.life.film.handoff = (from, id, tick, newCycle) => {
      const owner = this.owners.get(from.id);
      return Boolean(owner && this.possess(owner, id, tick, false, newCycle).agentId === id);
    };
  }

  getAgent(socketId: string): AgentState | undefined {
    const session = this.sessions.get(socketId);
    return session ? this.world.agents.get(session.agentId) : undefined;
  }

  possess(socketId: string, id: string, tick: number, takeover = false, newCycle = false): { agentId?: string; error?: string } {
    const agent = this.world.agents.get(id);
    if (!agent) return { error: '没有找到这个角色。' };
    const hotel = this.sandbox?.life.film.state?.hotel;
    if ((id === 'trinity' || id === 'morpheus') && hotel && hotel.welcome?.phase !== 'done') return { error: id === 'trinity' ? 'Trinity 正在带路并参与迎接，离开相邻房间后可以接入。' : 'Morpheus 正在窗前等待并迎接 Neo，交谈结束后可以接入。' };
    if (MEETING_CAST.includes(id as typeof MEETING_CAST[number]) && this.sandbox?.life.film.state && meetingLocked(this.sandbox.life.film.state)) return { error: '这个角色正在参与接头检查，结束后可以接入。' };
    if (SENTINEL_CAST.includes(id as typeof SENTINEL_CAST[number]) && this.sandbox?.life.film.state && sentinelActive(this.sandbox.life.film.state) && this.sandbox.life.film.state.sentinel?.phase !== 'ready') return { error: '这个角色正在参与静默潜航，哨兵离开后可以接入。' };
    const interlude = this.sandbox?.life.film.state;
    const interludeScene = interlude && interludeKind(interlude.scene);
    if (interlude && interludeScene && id !== interlude.actor && (INTERLUDE_CAST[interludeScene] as readonly string[]).includes(id) && interludeLocked(interlude)) return { error: '这个角色正在参与当前电影片段，表演结束后可以接入。' };
    const betrayalRoles = interlude?.betrayal?.kind === 'bathroom' ? ['neo', 'trinity', 'morpheus', 'smith', 'switch', 'apoc'] : ['neo', 'trinity', 'tank', 'cypher', 'dozer', 'switch', 'apoc'];
    const betrayalActive = interlude?.betrayal && !['ready', 'failed', 'done'].includes(interlude.betrayal.phase);
    if (betrayalActive && id !== interlude.actor && betrayalRoles.includes(id)) return { error: '这个角色正在参与背叛片段，动作结束后可以接入。' };
    const rescueRoles = interlude?.scene === 'm1_rescue_decision' ? ['neo', 'trinity', 'tank'] : ['neo', 'trinity'];
    if (interlude && rescueLocked(interlude) && id !== interlude.actor && rescueRoles.includes(id)) return { error: '这个角色正在参与营救准备，动作结束后可以接入。' };
    const governmentRoles = interlude?.government?.kind === 'questioning' ? ['morpheus', 'smith', 'agent_brown', 'agent_jones'] : ['neo', 'trinity', 'agent_jones', 'citizen_11'];
    if (interlude && governmentLocked(interlude) && id !== interlude.actor && governmentRoles.includes(id)) return { error: '这个角色正在参与政府大楼营救片段，当前动作结束后可以接入。' };
    const airRoles = interlude?.airRescue?.kind === 'office' ? ['neo', 'trinity', 'morpheus', 'smith', 'agent_brown', 'agent_jones'] : ['neo', 'trinity', 'morpheus'];
    if (interlude && airRescueLocked(interlude) && id !== interlude.actor && airRoles.includes(id)) return { error: '这个角色正在参与直升机营救片段，当前动作结束后可以接入。' };
    const escapeRoles = interlude?.matrixEscape?.kind === 'subway' ? ['neo', 'smith', 'citizen_13'] : ['neo', 'smith', 'citizen_13', 'citizen_14'];
    if (interlude?.matrixEscape && !['failed', 'done'].includes(interlude.matrixEscape.phase) && id !== interlude.actor && escapeRoles.includes(id)) return { error: '这个角色正在参与地铁与街巷追逐片段，当前撤离结束后可以接入。' };
    if (interlude?.reloaded && !interlude.visiting && interlude.reloaded.phase !== 'done' && id !== interlude.actor && (RELOADED.cast as readonly string[]).includes(id)) return { error: '这个角色正在参与第二部的预感与升级特工片段，结束后可以接入。' };
    if (interlude?.scene === 'm2_catch' && !interlude.visiting && interlude.catch && interlude.catch.phase !== 'done' && id !== interlude.actor && ['trinity', 'agent_johnson'].includes(id)) return { error: '这个角色正在参与 Neo 的高空营救，片段结束后可以接入。' };
    if (interlude?.scene === 'm2_medical' && !interlude.visiting && this.sandbox?.life.film.step && ['neo', 'bane'].includes(id) && id !== interlude.actor) return { error: '这个角色正在 Hammer 医疗舱昏迷；等待剧情恢复后再接入。' };
    const theOneRoles = interlude?.theOne?.kind === 'death' ? ['neo', 'smith', 'agent_brown', 'trinity', 'morpheus', 'tank']
      : interlude?.theOne?.kind === 'return' ? ['neo', 'smith', 'agent_brown', 'agent_jones', 'trinity', 'morpheus', 'tank'] : ['neo'];
    if (interlude?.theOne && !['ready', 'failed', 'done'].includes(interlude.theOne.phase) && id !== interlude.actor && theOneRoles.includes(id)) return { error: '这个角色正在参与 Neo 的复苏与觉醒片段，当前演出结束后可以接入。' };
    if (interlude && lobbyLocked(interlude) && id !== interlude.actor && ['trinity', 'citizen_12'].includes(id)) return { error: '这个角色正在参与大厅安检片段，警戒启动后可以接入。' };
    if (INTERROGATION_CAST.includes(id as typeof INTERROGATION_CAST[number]) && this.sandbox?.life.film.state && interrogationLocked(this.sandbox.life.film.state)) return { error: '这个特工正在参与审讯，结束后可以接入。' };
    if (id === 'morpheus' && this.sandbox?.life.film.state && pillLocked(this.sandbox.life.film.state)) return { error: 'Morpheus 正在与 Neo 交谈递药，结束后可以接入。' };
    if (id === 'morpheus' && this.sandbox?.life.film.state?.mirrorGuide && !this.sandbox.life.film.state.mirrorGuide.done) return { error: 'Morpheus 正在带 Neo 前往追踪室。抵达后可以接入。' };
    if (id === 'keymaker' && this.sandbox?.life.film.state?.ride?.phase === 'riding') return { error: '钥匙匠正在后座接受护送，抵达接应区后可以接入。' };
    if (['keymaker', 'morpheus', 'twin1', 'twin2'].includes(id) && this.sandbox?.life.film.state?.garage?.phase === 'riding') return { error: '这个角色正在车库追逐中，轿车冲出车库后可以接入。' };
    if (['morpheus', 'roland'].includes(id) && this.sandbox?.life.film.state?.hammer?.phase === 'riding') return { error: '这个角色正在 Hammer 舰桥协助 Niobe 驾驶，驶出管线后可以接入。' };
    if (id === 'neo' && this.sandbox?.life.film.state?.logos?.phase === 'riding') return { error: 'Neo 正在 Logos 驾驶舱为 Trinity 指引航线，航行结束后可以接入。' };
    if (id === 'trinity' && this.sandbox?.life.film.state?.scene === 'm3_farewell') return { error: 'Trinity 正在 Logos 残骸中完成最后的告别，当前不能接管。' };
    if (id === 'deus_ex_machina' && this.sandbox?.life.film.state?.scene === 'm3_deus'
      && deusPactLocked(this.sandbox.life.film.state.deus)) return { error: '机器集体正在与 Neo 谈判并建立连接，当前动作结束后可以接入。' };
    if (id === 'kid' && this.sandbox?.life.film.state?.dockGunnery?.phase === 'firing') return { error: 'Kid 正在船坞推送弹药车。掩护完成后可以接入。' };
    if (['keymaker', 'neo', 'agent_johnson'].includes(id) && ['collision', 'rescue'].includes(this.sandbox?.life.film.state?.trucks?.phase ?? '')) return { error: '这个角色正在卡车对撞接应中，抵达安全地点后可以接入。' };
    if (['trainman', 'rama_kandra', 'kamala', 'sati'].includes(id) && this.sandbox?.life.film.state?.scene === 'm3_trainman'
      && this.sandbox.life.film.state.mobil?.phase !== 'gone') return { error: '这个角色正在 Mobil Ave 的列车片段中，驶离后可以接入。' };
    if (id === 'trainman' && this.sandbox?.life.film.state?.scene === 'm3_trainman_chase'
      && this.sandbox.life.film.state.helChase?.phase !== 'escaped') return { error: 'Trainman 正在地铁追逐中，列车驶过后可以接入。' };
    if (['trinity', 'trainman'].includes(id) && this.sandbox?.life.film.state?.scene === 'm3_mobil_release'
      && this.sandbox.life.film.state.mobil?.phase !== 'stopped') return { error: '这个角色正在返程列车中，到站后可以接入。' };
    if (interlude?.scene === 'm3_bane' && interlude.bane && interlude.bane.phase !== 'ready' && !interlude.completed.includes('m3_bane')
      && id !== interlude.actor && ['bane', 'trinity'].includes(id)) return { error: '这个角色正在参与 Logos 船上的剧情交手，片段结束后可以接入。' };
    if (this.sandbox?.state.threats.some(t => t.character === id)) return { error: '这个角色正在剧情交手，结束后可以接入。' };
    const restarting = newCycle && id === 'neo' && this.sandbox?.life.film.state?.finished;
    if (!restarting && this.sandbox?.life.film.unavailable(id) && !this.sandbox.life.film.controls(agent)) return { error: '这个角色在本轮故事中已无法接入；新循环会恢复。' };
    const owner = this.owners.get(id);
    if (owner && owner !== socketId) {
      if (!takeover) return { error: '这个角色已在其他页面游玩。点击角色，在当前页面继续原有进度。' };
      this.release(socketId, tick);
      const session = this.sessions.get(owner)!;
      session.input = { ...idleInput(), yaw: agent.rotation }; session.lastInput = Date.now();
      session.planar = { x: 0, z: 0 }; session.strike = undefined; session.impulse = undefined; session.palm = undefined;
      agent.velocity = { x: 0, y: session.vy, z: 0 };
      this.sessions.delete(owner); this.sessions.set(socketId, session); this.owners.set(id, socketId);
      this.onReplaced?.(owner, tick);
      if (agent.status === 'alive') return { agentId: id };
    } else if (owner === socketId && agent.status === 'alive') return { agentId: id };
    this.release(socketId, tick);
    this.conversations.interrupt(id, this.world.agents, tick);
    if (agent.status !== 'alive' && this.sandbox?.life.film.controls(agent)) {
      this.sandbox.life.film.command(agent, 'retry', tick);
    } else if (agent.status !== 'alive') {
      agent.status = 'alive'; agent.health = agent.maxHealth; agent.activeEffects = [];
      agent.currentLocation = agent.mind?.home ?? (agent.isInMatrix ? 'times_square' : 'nebuchadnezzar');
      agent.isInMatrix = LOCATIONS[agent.currentLocation]?.world !== 'real';
      agent.position = locationEntrance(agent.currentLocation);
      if (agent.mind) { agent.mind.energy = 85; agent.mind.stress = 10; }
      this.dynamics.record({ type: 'agent_spawn', title: `${agent.name} 的信号被重建`, description: '玩家选择重新接入这个角色，角色在归属地点恢复行动。',
        cause: '玩家重建角色', consequence: '生命恢复，既有记忆、关系与觉醒状态被保留。', involvedAgents: [id], location: agent.currentLocation,
        position: { ...agent.position }, tick, importance: 7 });
    }
    agent.controller = 'player';
    this.sandbox?.enter(agent);
    if (!this.sandbox?.life.film.performing(agent) && playerBlocked(agent.position, agent.isInMatrix)) agent.position = locationEntrance(agent.currentLocation);
    agent.currentAction = null; agent.targetPosition = null; agent.currentPath = [];
    agent.velocity = { x: 0, y: 0, z: 0 };
    this.sessions.set(socketId, { agentId: id, input: { ...idleInput(), yaw: agent.rotation }, lastInput: Date.now(), vy: 0, planar: { x: 0, z: 0 }, lastAttack: 0, combo: 0, stagger: 0 });
    this.owners.set(id, socketId);
    this.sandbox?.life.film.windowFrame(agent, 0, tick);
    this.sandbox?.life.film.crossingFrame(agent, 0, tick);
    this.sandbox?.life.film.pillFrame(agent, 0, tick);
    this.sandbox?.life.film.interrogationFrame(agent, 0, tick);
    this.sandbox?.life.film.meetingFrame(agent, false, 0, tick);
    this.sandbox?.life.film.hotelFrame(agent, 0, tick);
    this.sandbox?.life.film.workdayFrame(agent, 0, tick);
    this.sandbox?.life.film.apartmentFrame(agent, 0, tick);
    this.sandbox?.life.film.clubFrame(agent, 0, tick);
    this.sandbox?.life.film.persephoneFrame(agent, 0, tick);
    this.sandbox?.life.film.keymakerFrame(agent, 0, tick);
    this.sandbox?.life.film.sentinelFrame(agent, { movement: 0, sprint: false, jump: false }, 0, tick);
    this.sandbox?.life.film.interludeFrame(agent, 0, tick);
    this.sandbox?.life.film.betrayalFrame(agent, 0, tick);
    this.sandbox?.life.film.rescueFrame(agent, 0, tick);
    this.sandbox?.life.film.governmentFrame(agent, false, 0, tick);
    this.sandbox?.life.film.airRescueFrame(agent, false, 0, tick);
    this.sandbox?.life.film.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick);
    this.sandbox?.life.film.farewellFrame(agent, 0, tick);
    this.sandbox?.life.film.deusFrame(agent, false, 0, tick);
    this.sandbox?.life.film.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick); this.sandbox?.life.film.reloaded.frame(agent, { x: 0, focus: false }, 0, tick);
    this.sandbox?.life.film.catch.frame(agent, { x: 0, z: 0, focus: false }, 0, tick);
    this.sandbox?.life.film.lobby.frame(agent, 0, tick);
    if (agent.mind) agent.mind.thought = '由玩家决定下一步行动。';
    return { agentId: id };
  }

  release(socketId: string, tick: number): void {
    const session = this.sessions.get(socketId);
    if (!session) return;
    const agent = this.world.agents.get(session.agentId);
    if (agent) {
      this.conversations.interrupt(agent.id, this.world.agents, tick);
      delete agent.controller;
      agent.currentAction = null; agent.velocity = { x: 0, y: 0, z: 0 };
      this.sandbox?.life.film.windowFrame(agent, 0, tick);
      this.sandbox?.life.film.crossingFrame(agent, 0, tick);
      this.sandbox?.life.film.pillFrame(agent, 0, tick);
      this.sandbox?.life.film.interrogationFrame(agent, 0, tick);
      this.sandbox?.life.film.meetingFrame(agent, false, 0, tick);
      this.sandbox?.life.film.hotelFrame(agent, 0, tick);
      this.sandbox?.life.film.workdayFrame(agent, 0, tick);
      this.sandbox?.life.film.apartmentFrame(agent, 0, tick);
      this.sandbox?.life.film.clubFrame(agent, 0, tick);
      this.sandbox?.life.film.persephoneFrame(agent, 0, tick);
      this.sandbox?.life.film.keymakerFrame(agent, 0, tick);
      this.sandbox?.life.film.interludeFrame(agent, 0, tick);
      this.sandbox?.life.film.betrayalFrame(agent, 0, tick);
      this.sandbox?.life.film.rescueFrame(agent, 0, tick);
      this.sandbox?.life.film.governmentFrame(agent, false, 0, tick);
      this.sandbox?.life.film.airRescueFrame(agent, false, 0, tick);
      this.sandbox?.life.film.farewellFrame(agent, 0, tick);
      this.sandbox?.life.film.deusFrame(agent, false, 0, tick);
      this.sandbox?.life.film.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick); this.sandbox?.life.film.reloaded.frame(agent, { x: 0, focus: false }, 0, tick);
      this.sandbox?.life.film.catch.frame(agent, { x: 0, z: 0, focus: false }, 0, tick);
      this.sandbox?.life.film.lobby.frame(agent, 0, tick);
      agent.activeEffects = agent.activeEffects.filter(effect => effect.remainingSeconds === undefined);
      if (agent.mind) agent.mind.thought = '重新回到自己的生活，继续追寻尚未完成的目标。';
    }
    this.owners.delete(session.agentId); this.sessions.delete(socketId);
    this.sandbox?.life.film.reconcileCast();
    if (agent) this.sandbox?.life.film.sentinelFrame(agent, { movement: 0, sprint: false, jump: false }, 0, tick);
    if (agent) this.sandbox?.life.film.interludeFrame(agent, 0, tick);
  }

  receiveInput(socketId: string, value: unknown): void {
    const session = this.sessions.get(socketId);
    if (!session || !value || typeof value !== 'object') return;
    const input = value as PlayerInput;
    if (![input.x, input.z, input.yaw, input.sequence].every(Number.isFinite) || input.pitch !== undefined && !Number.isFinite(input.pitch) || Math.abs(input.x) > 1 || Math.abs(input.z) > 1 || input.sequence < session.input.sequence) return;
    const drive = input.drive && Number.isFinite(input.drive.throttle) && Number.isFinite(input.drive.steer) ? { throttle: Math.max(0, Math.min(1, input.drive.throttle)), steer: Math.max(-1, Math.min(1, input.drive.steer)), brake: input.drive.brake === true } : undefined;
    session.input = { x: input.x, z: input.z, yaw: input.yaw, pitch: Math.max(-1.35, Math.min(1.35, input.pitch ?? 0)), sprint: input.sprint === true, crouch: input.crouch === true, jump: input.jump === true || session.input.jump, drive, climb: Number.isFinite(input.climb) ? Math.max(-1, Math.min(1, input.climb!)) : 0, focus: input.focus === true, sequence: input.sequence };
    session.lastInput = Date.now();
  }

  timeScale(): number {
    return [...this.sessions.values()].some(session => {
      const agent = this.world.agents.get(session.agentId)!;
      return agent.status === 'alive' && agent.activeEffects.some(effect => effect.visualEffect === 'slow_motion' && (effect.remainingSeconds ?? 0) > 0);
    }) ? .25 : 1;
  }

  takeHit(id: string): void {
    const owner = this.owners.get(id); const session = owner ? this.sessions.get(owner) : undefined;
    if (session) { session.strike = undefined; session.impulse = undefined; session.palm = undefined; session.stagger = .22; }
  }

  step(dt: number, running: boolean, tick: number, now = Date.now()): void {
    dt = Math.min(dt, .1);
    if (running) for (const agent of this.world.agents.values()) {
      for (const id of Object.keys(agent.combatCooldowns ?? {})) agent.combatCooldowns![id] = Math.max(0, agent.combatCooldowns![id] - dt);
      agent.activeEffects = agent.activeEffects.filter(effect => {
        if (effect.remainingSeconds === undefined) return true;
        effect.remainingSeconds -= dt; return effect.remainingSeconds > 0 && agent.status === 'alive';
      });
    }
    for (const session of this.sessions.values()) {
      const agent = this.world.agents.get(session.agentId)!;
      if (!running || agent.status !== 'alive') { agent.velocity = { x: 0, y: 0, z: 0 }; this.sandbox?.life.film.hotelFrame(agent, 0, tick); this.sandbox?.life.film.sentinelFrame(agent, { movement: 0, sprint: false, jump: false }, 0, tick); this.sandbox?.life.film.interludeFrame(agent, 0, tick); this.sandbox?.life.film.betrayalFrame(agent, 0, tick); this.sandbox?.life.film.rescueFrame(agent, 0, tick); this.sandbox?.life.film.governmentFrame(agent, false, 0, tick); this.sandbox?.life.film.airRescueFrame(agent, false, 0, tick); this.sandbox?.life.film.matrixEscapeFrame(agent, { movement: 0, sprint: false }, 0, tick); this.sandbox?.life.film.farewellFrame(agent, 0, tick); this.sandbox?.life.film.deusFrame(agent, false, 0, tick); this.sandbox?.life.film.theOneFrame(agent, { x: 0, z: 0, sprint: false, jump: false, focus: false }, 0, tick); this.sandbox?.life.film.reloaded.frame(agent, { x: 0, focus: false }, 0, tick); this.sandbox?.life.film.catch.frame(agent, { x: 0, z: 0, focus: false }, 0, tick); this.sandbox?.life.film.mountainFrame(agent, { x: 0, z: 0, yaw: agent.rotation, jump: false, sprint: false }, 0, tick); this.sandbox?.life.film.lobby.frame(agent, 0, tick); session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue; }
      session.stagger = Math.max(0, session.stagger - dt);
      const stale = now - session.lastInput > 300;
      let input = stale ? { ...idleInput(), yaw: session.input.yaw } : session.input;
      const lesson = this.sandbox?.life.film.state;
      const sparring = session.strike && lesson?.scene === 'm1_dojo' && lesson.dojo?.dodged
        ? this.sandbox!.state.threats.find(threat => threat.scene === lesson.scene && threat.character === 'morpheus') : undefined;
      if (sparring) {
        const yaw = Math.atan2(sparring.position.x - agent.position.x, sparring.position.z - agent.position.z);
        input = { ...input, yaw }; session.input.yaw = yaw;
      }
      this.sandbox?.life.film.hotelFrame(agent, dt, tick);
      this.sandbox?.life.film.bridgeArrivalFrame(agent, dt, tick);
      this.sandbox?.life.film.workdayFrame(agent, dt, tick);
      this.sandbox?.life.film.apartmentFrame(agent, dt, tick);
      this.sandbox?.life.film.clubFrame(agent, dt, tick);
      if (this.sandbox?.life.film.persephoneFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      this.sandbox?.life.film.keymakerFrame(agent, dt, tick);
      if (this.sandbox?.life.film.mountainFrame(agent, input, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.burlyFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.interludeFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.betrayalFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.rescueFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.governmentFrame(agent, Boolean(input.focus), dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.airRescueFrame(agent, Boolean(input.focus), dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.matrixEscapeFrame(agent, { movement: Math.hypot(input.x, input.z), sprint: input.sprint }, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.baneFrame(agent, { focus: Boolean(input.focus), yaw: input.yaw }, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.farewellFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.deusFrame(agent, Boolean(input.focus), dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.reloaded.frame(agent, { x: input.x, focus: Boolean(input.focus) }, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.catch.frame(agent, { x: input.x, z: input.z, focus: Boolean(input.focus) }, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.finaleFrame(agent, Boolean(input.focus), input.yaw, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.mobilFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.theOneFrame(agent, { x: input.x, z: input.z, sprint: input.sprint, jump: input.jump, focus: Boolean(input.focus) }, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.lobby.frame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.dockGunneryFrame(agent, tick)) {
        agent.rotation = input.yaw; session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false;
        session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.sentinelFrame(agent, { movement: Math.hypot(input.x, input.z), sprint: input.sprint, jump: input.jump }, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.awakeningFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.trainingFrame(agent, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.performing(agent)) {
        this.sandbox.life.film.openingHotel.frame(agent);
        this.sandbox.life.film.truckFrame(agent, dt, tick);
        this.sandbox.life.film.windowFrame(agent, dt, tick);
        this.sandbox.life.film.crossingFrame(agent, dt, tick);
        this.sandbox.life.film.phoneFrame(agent, dt, tick);
        this.sandbox.life.film.pillFrame(agent, dt, tick);
        this.sandbox.life.film.interrogationFrame(agent, dt, tick);
        this.sandbox.life.film.meetingFrame(agent, Boolean(input.focus), dt, tick);
        session.input.yaw = agent.rotation;
        this.sandbox.life.film.oracleFrame(agent, false, dt, tick);
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; session.palm = undefined; continue;
      }
      if (this.sandbox?.life.film.climbFrame(agent, input.climb ?? 0, dt, tick)) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.input.jump = false; session.strike = undefined; session.impulse = undefined; continue;
      }
      if (this.sandbox?.life.film.driveFrame(agent, input.drive ?? { throttle: 0, steer: 0,
        brake: this.sandbox.life.film.state?.logos?.phase !== 'riding' }, dt, tick, Boolean(input.focus))) {
        session.vy = 0; session.planar = { x: 0, z: 0 }; session.strike = undefined; session.impulse = undefined; session.palm = undefined; session.input.jump = false;
        continue;
      }
      const previous = agent.position;
      const boost = agent.activeEffects.some(effect => ['speed_blur', 'agent_dodge', 'phase_shift'].includes(effect.visualEffect)) ? 1.8 : 1;
      const attackScale = session.impulse || session.stagger > 0 ? 0 : session.strike ? .4 : 1;
      const movement = stepPlayer(previous, session.vy, { ...input, x: input.x * attackScale, z: input.z * attackScale }, Math.min(dt, 0.1), agent.isInMatrix, this.sandbox?.state.structures, stale ? undefined : session.planar, boost);
      agent.position = movement.position; session.vy = movement.verticalVelocity; session.planar = movement.horizontalVelocity; session.input.jump = false;
      agent.rotation = input.yaw;
      if (session.impulse) {
        const impulse = session.impulse;
        agent.position = combatDisplace(agent.position, impulse.direction, impulse.speed * Math.min(dt, impulse.remaining), agent.isInMatrix, this.sandbox?.state.structures);
        impulse.remaining -= dt;
        if (impulse.remaining <= .0001) {
          if (impulse.strike) { agent.rotation = Math.atan2(impulse.direction.x, impulse.direction.z); this.sandbox?.skill(agent, 'scorpion_dash', tick); }
          session.impulse = undefined;
        }
      }
      agent.velocity = { x: (agent.position.x - previous.x) / dt, y: session.vy, z: (agent.position.z - previous.z) / dt };
      if (session.palm) {
        session.palm.remaining -= dt;
        if (session.palm.remaining <= 0) { agent.rotation = session.palm.yaw; this.sandbox?.skill(agent, 'crushing_palm', tick); session.palm = undefined; }
      }
      if (session.strike) {
        session.strike.age += dt;
        const strike = MELEE_COMBO[session.combo];
        if (!session.strike.resolved && session.strike.age >= strike.contact) {
          session.strike.resolved = true;
          if (this.sandbox?.attack(agent, tick, session.combo) == null) {
            const cast = this.sandbox?.state.neoLife?.journey ? FILM_CAST : this.sandbox?.state.neoLife ? NEO_CAST : [];
            const target = [...this.world.agents.values()].filter(other => !cast.includes(other.id) && other.id !== agent.id && other.status === 'alive' && other.isInMatrix === agent.isInMatrix
              && meleeReach(agent.position, agent.rotation, other.position, strike.reach, agent.isInMatrix, this.sandbox?.state.structures))
              .sort((a, b) => distance(a.position, agent.position) - distance(b.position, agent.position))[0];
            if (target) {
              const action = { type: 'attack' as const, target: target.id, parameters: { player: true, damage: strike.damage, combo: session.combo }, startedAt: tick, duration: 1, progress: 0 };
              this.actions.execute(agent, action, this.world.agents, tick); agent.currentAction = action;
            }
          }
        }
        if (session.strike.age >= strike.duration) session.strike = undefined;
      }
      if (!this.conversations.isAgentInConversation(agent.id)) {
        const moving = Math.hypot(input.x, input.z) > 0.05;
        if (!session.strike) {
          agent.currentAction = { type: moving ? 'move_to' : 'idle', parameters: { player: true, resolved: true, crouching: input.crouch === true }, startedAt: tick, duration: 1, progress: 0 };
        }
      }
      this.sandbox?.life.film.oracleFrame(agent, input.focus === true, dt, tick);
      this.sandbox?.life.film.ambushFrame(agent, dt, tick);
      this.sandbox?.life.film.matrixEscapeAction(agent, tick);
      this.sandbox?.life.film.theOneAction(agent, tick);
      this.sandbox?.life.film.reloaded.action(agent, tick);
      this.sandbox?.life.film.burlyAction(agent);
      this.sandbox?.life.film.chateauAction(agent);
      this.sandbox?.life.film.helBargainFrame(agent, tick);
      const journey = this.sandbox?.life.film.state;
      if (journey?.actor === agent.id && agent.currentAction && heldPhone(journey)) agent.currentAction.parameters.phone = { ...heldPhone(journey)! };
      const nearbyLocation = Object.values(LOCATIONS).filter(location => location.id !== 'downtown' && (location.world === 'matrix') === agent.isInMatrix)
        .find(location => distance(locationEntrance(location.id), agent.position) < 42);
      const room = agent.isInMatrix ? insideLifeRoom(agent.position) : undefined;
      const set = filmSetAt(agent.position, agent.isInMatrix);
      if (set) agent.currentLocation = set.id;
      else if (room) agent.currentLocation = room;
      else if (nearbyLocation) agent.currentLocation = nearbyLocation.id;
      else if (agent.isInMatrix) agent.currentLocation = 'downtown';
    }
  }

  act(socketId: string, kind: string, tick: number): string {
    const session = this.sessions.get(socketId);
    const agent = this.getAgent(socketId);
    if (!session || !agent || agent.status !== 'alive') return '请先接入一个存活角色。';
    const reloaded = this.sandbox?.life.film.reloaded.handle(agent, kind, tick);
    if (reloaded !== undefined) return reloaded;
    const catchAction = this.sandbox?.life.film.catch.handle(agent, kind, tick);
    if (catchAction !== undefined) return catchAction;
    const baneAction = this.sandbox?.life.film.baneAction(agent, kind, tick);
    if (baneAction !== undefined) return baneAction;
    if (kind === 'attack') {
      const helStrike = this.sandbox?.life.film.helBargainStrike(agent, tick);
      if (helStrike !== undefined) return helStrike;
    }
    if (kind === 'dodge') {
      const helDodge = this.sandbox?.life.film.helBargainDodge(agent, tick);
      if (helDodge !== undefined) return helDodge;
      const burly = this.sandbox?.life.film.burlyDodge(agent, tick);
      if (burly !== undefined) return burly;
      const chateau = this.sandbox?.life.film.chateauParry(agent, tick);
      if (chateau !== undefined) return chateau;
      const result = this.sandbox?.life.film.governmentDodge(agent, tick);
      if (result !== undefined) return result;
      const rescue = this.sandbox?.life.film.airRescueBrace(agent, tick);
      if (rescue !== undefined) return rescue;
      const escape = this.sandbox?.life.film.matrixEscapeEvade(agent, tick);
      if (escape !== undefined) return escape;
      const theOne = this.sandbox?.life.film.theOneEvade(agent, tick);
      if (theOne !== undefined) return theOne;
    }
    if (this.sandbox?.life.film.controls(agent) && this.sandbox.life.film.state?.scene === 'm3_hel_bargain'
      && ['attack', 'shoot', 'ability', 'ability2', 'dodge'].includes(kind)) return '人群封住了射线。按当前剧情提示行动，不能用普通攻击跳过谈判。';
    if (this.sandbox?.life.film.performing(agent) && kind !== 'interact') return '演出进行中，可以转动视角观察；进度会自动保存。';
    if (this.sandbox?.life.film.state && sentinelActive(this.sandbox.life.film.state) && ['attack', 'shoot', 'ability', 'ability2', 'dodge', 'travel'].includes(kind)) return '哨兵正在附近扫描。保持安静，武器和能力会暴露整艘船。';
    if (this.sandbox?.life.film.driving(agent) && ['attack', 'shoot', 'ability', 'ability2', 'dodge', 'travel'].includes(kind)) return this.sandbox.life.film.state?.scene === 'm3_hammer_tunnels'
      ? '正在驾驶 Hammer。W 加速，S 刹车，A / D 控制侧向推进器。' : this.sandbox.life.film.state?.scene === 'm3_gate'
        ? '正在驾驶受损 APU。W 前进，S 制动，A / D 横向避开哨兵。' : ['m3_defense', 'm3_sun'].includes(this.sandbox.life.film.state?.scene ?? '')
          ? '正在驾驶 Logos。W 爬升，S 俯冲，A / D 横移；G 让 Neo 感知迫近目标。' : '正在护送钥匙匠。W 加速，S 刹车，A / D 转向。';
    if (this.sandbox?.life.film.state?.scene === 'm2_seraph' && this.sandbox.life.film.state.fighting && ['shoot', 'ability', 'ability2'].includes(kind)) return 'Seraph 要看近身攻防。观察起手，X 闪避后用 F 反击。';
    if (this.sandbox?.life.film.controls(agent) && ['m3_mobil', 'm3_family', 'm3_trainman'].includes(this.sandbox.life.film.state!.scene)
      && ['ability', 'ability2', 'travel'].includes(kind)) return 'Mobil Ave 的边界由 Trainman 控制，Neo 的能力不能直接打开这条线路。';
    if (this.sandbox?.life.film.controls(agent) && ['m1_office_escape', 'm1_ledge'].includes(this.sandbox.life.film.state!.scene)
      && ['attack', 'shoot', 'ability', 'ability2', 'dodge'].includes(kind)) return '你仍是普通的 Anderson。按住 Z 潜行，利用遮挡避开特工。';
    if (agent.id === 'neo' && this.sandbox?.state.neoLife) {
      if (this.sandbox.state.neoLife.activity) return '先完成当前日常活动，或移动离开来中断它。';
      if ((kind === 'ability' || kind === 'ability2') && !neoSkillUnlocked(this.sandbox.state.neoLife, kind === 'ability' ? 0 : 1)) return '这项能力会在 Neo 的训练与觉醒剧情中解锁。';
      if (kind === 'talk' && !agent.isAwakened) return 'J 打开生活手记：可以和同事聊天，或预约与朋友见面。';
    }
    const nearby = [...this.world.agents.values()].filter(other => other.id !== agent.id && other.status === 'alive' && !other.currentAction?.parameters.finaleComa && other.isInMatrix === agent.isInMatrix && distance(agent.position, other.position) < 14)
      .sort((a, b) => distance(agent.position, a.position) - distance(agent.position, b.position));
    if (kind === 'talk') {
      const target = nearby[0];
      if (!target) return '走近一个人物，然后按 E 交谈。';
      return this.conversations.startConversation(agent.id, target.id, agent, target, undefined, tick) ? `正在与 ${target.name} 交谈。` : `${target.name} 暂时无法交谈，稍后再试。`;
    }
    if (kind === 'attack') {
      const lesson = this.sandbox?.life.film.state;
      const sparring = lesson?.scene === 'm1_dojo' && lesson.dojo?.dodged
        ? this.sandbox!.state.threats.find(threat => threat.scene === lesson.scene && threat.character === 'morpheus') : undefined;
      if (sparring) session.input.yaw = agent.rotation = Math.atan2(sparring.position.x - agent.position.x, sparring.position.z - agent.position.z);
      const elapsed = (Date.now() - session.lastAttack) / 1000;
      if (session.stagger > 0 || session.impulse || session.palm || session.strike && !session.strike.resolved || elapsed < MELEE_COMBO[session.combo].duration) return '';
      session.combo = sparring && (session.lastAttack === 0 || elapsed < DOJO_COMBO_WINDOW) ? lesson!.dojo!.combo
        : elapsed < COMBO_WINDOW ? (session.combo + 1) % MELEE_COMBO.length : 0;
      session.lastAttack = Date.now(); session.strike = { age: 0, resolved: false };
      agent.currentAction = { type: 'attack', parameters: { player: true, resolved: true, combo: session.combo }, startedAt: tick, duration: 1, progress: 0 };
      return '';
    }
    if (kind === 'shoot') {
      const lobby = this.sandbox?.life.film.lobby.active(agent);
      const coatcheck = this.sandbox?.life.film.coatcheck.active(agent);
      const hotel = this.sandbox?.life.film.openingHotel.active(agent);
      const dock = this.sandbox?.life.film.state?.scene === 'm3_dock_battle' && this.sandbox.life.film.state.dockGunnery?.phase === 'firing';
      if (!lobby && !coatcheck && !hotel && !dock || session.strike || session.impulse || session.stagger > 0 || Date.now() - (session.lastShot ?? 0) < (dock ? 110 : coatcheck || hotel ? HEL_COATCHECK.fireInterval * 1000 : rescueLoadout(this.sandbox!.life.film.state).fireInterval * 1000)) return '';
      session.lastShot = Date.now();
      return dock ? this.sandbox!.life.film.dockShoot(agent, session.input.yaw, session.input.pitch ?? 0, tick)
        : hotel ? this.sandbox!.life.film.openingHotel.shoot(agent, session.input.yaw, session.input.pitch ?? 0, tick)
        : coatcheck ? this.sandbox!.life.film.coatcheck.shoot(agent, session.input.yaw, session.input.pitch ?? 0, tick)
        : this.sandbox!.life.film.lobby.shoot(agent, session.input.yaw, session.input.pitch ?? 0, tick);
    }
    if (kind === 'reload') return this.sandbox?.life.film.openingHotel.active(agent)
      ? this.sandbox.life.film.openingHotel.reload(agent, tick) : this.sandbox?.life.film.coatcheck.active(agent)
      ? this.sandbox.life.film.coatcheck.reload(agent, tick) : this.sandbox?.life.film.lobby.reload(agent, tick) ?? '';
    if (kind === 'ability' || kind === 'ability2' || kind === 'dodge') {
      return this.cast(agent, session, kind === 'dodge' ? 'dodge' : playerSkills(agent)[kind === 'ability' ? 0 : 1], tick);
    }
    if (kind === 'travel' && this.sandbox?.life.film.controls(agent)) return '电影路线通过 J 手记继续，完成的场景可随时回访。';
    if (kind === 'travel') {
      const phone = locationEntrance(agent.isInMatrix ? 'subway_station' : 'nebuchadnezzar');
      if (distance(agent.position, phone) > 24) return agent.isInMatrix ? '前往地铁站出口电话，靠近后按 R 拔出。' : '前往尼布甲尼撒号接入终端，靠近后按 R 进入 Matrix。';
      if (agent.isInMatrix && !agent.isAwakened && agent.faction !== 'machines') return '尚未觉醒的角色无法使用出口。';
      agent.isInMatrix = !agent.isInMatrix;
      agent.currentLocation = agent.isInMatrix ? 'subway_station' : 'nebuchadnezzar';
      agent.position = locationEntrance(agent.currentLocation);
      session.vy = 0; session.planar = { x: 0, z: 0 }; session.input = idleInput();
      session.strike = undefined;
      session.impulse = undefined;
      session.palm = undefined;
      agent.activeEffects = agent.activeEffects.filter(effect => effect.remainingSeconds === undefined);
      this.dynamics.record({ type: 'portal_open', title: `${agent.name} ${agent.isInMatrix ? '接入 Matrix' : '返回真实世界'}`, description: '玩家通过出口电话与接入终端切换世界。', cause: '玩家交互', consequence: '人物继续保留记忆与关系。', involvedAgents: [agent.id], location: agent.currentLocation, position: { ...agent.position }, tick, importance: 7 });
      return agent.isInMatrix ? '接入成功。欢迎回到 Matrix。' : '已拔出，返回尼布甲尼撒号。';
    }
    return '';
  }

  private cast(agent: AgentState, session: PlayerSession, id: CombatSkillId, tick: number): string {
    const skill = COMBAT_SKILLS[id];
    if (skill.matrixOnly && !agent.isInMatrix) return '这项程序能力需要接入 Matrix。';
    if ((agent.combatCooldowns?.[id] ?? 0) > 0) return `${skill.name}冷却中：${Math.ceil(agent.combatCooldowns![id])} 秒。`;
    if (session.stagger > 0 || session.impulse || session.palm) return '';
    if (['dodge', 'scorpion_dash'].includes(id) && agent.position.y > groundHeight(agent.position, agent.isInMatrix) + .15) return '落地后才能突进或闪避。';
    agent.combatCooldowns ??= {}; agent.combatCooldowns[id] = skill.cooldown;
    agent.rotation = session.input.yaw;
    session.strike = undefined;
    const direction = id === 'dodge' ? dodgeDirection(session.input.x, session.input.z, session.input.yaw)
      : { x: Math.sin(agent.rotation), y: 0, z: Math.cos(agent.rotation) };
    agent.activeEffects.push({ abilityId: `combat:${id}`, visualEffect: skill.effect, remainingTicks: 1, remainingSeconds: skill.duration });
    if (id === 'dodge' || id === 'scorpion_dash') {
      session.planar = { x: 0, z: 0 };
      session.impulse = { direction, remaining: skill.duration, speed: id === 'dodge' ? 16 : 20, strike: id === 'scorpion_dash' };
      if (id === 'dodge') {
        const warning = this.sandbox?.state.threats.find(threat => threat.target === agent.id && threat.attackAt !== undefined);
        if (warning && (this.sandbox!.life.film.matrixEscapeCombatDodge(agent, warning, tick) || this.sandbox!.life.film.trainingDodge(agent, warning, tick))) {
          warning.attackAt = undefined; warning.stunUntil = Math.max(warning.stunUntil, tick + 3);
        }
      }
    } else if (id === 'crushing_palm') session.palm = { remaining: .18, yaw: agent.rotation };
    else if (id === 'field_patch') {
      for (const other of this.world.agents.values()) if (other.status === 'alive' && other.faction === agent.faction && other.isInMatrix === agent.isInMatrix && distance(other.position, agent.position) <= 10) other.health = Math.min(other.maxHealth, other.health + 25);
    } else if (['force_push', 'system_hack', 'viral_overwrite', 'code_snare', 'escape'].includes(id)) this.sandbox?.skill(agent, id, tick);
    this.onSkill?.({ source: agent.id, skill: id, position: { ...agent.position }, direction, matrix: agent.isInMatrix }, tick);
    return id === 'dodge' ? '' : `${skill.name} · ${skill.description}`;
  }

  sandboxAction(socketId: string, command: SandboxCommand, tick: number): string {
    const agent = this.getAgent(socketId);
    if (!agent || !this.sandbox) return '请先接入角色。';
    const result = this.sandbox.command(agent, command, tick);
    if (command.kind === 'transit' || command.kind === 'life') {
      const session = this.sessions.get(socketId)!;
      session.vy = 0; session.planar = { x: 0, z: 0 }; session.input = { ...idleInput(), yaw: this.getAgent(socketId)!.rotation };
      session.strike = undefined;
      session.impulse = undefined;
      session.palm = undefined;
    }
    const current = this.getAgent(socketId);
    if (current && current.id !== agent.id) this.onStoryRole?.(socketId, current.id, tick);
    return result;
  }
}
