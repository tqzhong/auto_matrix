import { LOGOS_BANE, BANE_ENCOUNTER, FILM_SETS, filmPosition, distance, logosBaneActive, logosBaneLocked,
  logosBaneRoot, logosBaneHatch, logosBaneText, type BaneEncounter, type LogosBaneRoot, type AgentState, type SandboxState } from '@auto_matrix/shared';
import type { WorldState } from '../world/WorldState.js';

export class LogosBaneSystem {
  onAdvance?: (text: string, actor: AgentState, tick: number) => void;
  constructor(private world: WorldState, private sandbox: () => SandboxState) {}
  private get journey() { return this.sandbox().neoLife?.journey; }
  private active(actor: AgentState): boolean { return logosBaneActive(this.journey) && actor.id === this.journey!.actor; }
  clear(): void {
    this.sandbox().structures = this.sandbox().structures.filter(item => !item.id.startsWith('film:logos-bane:'));
    for (const member of this.world.agents.values()) if (!member.controller && member.currentAction?.parameters.logosBane) member.currentAction = null;
  }
  private local(actor: AgentState): LogosBaneRoot {
    const center = FILM_SETS.film_logos_deck.center;
    return { x: actor.position.x - center.x, y: actor.position.y - center.y, z: actor.position.z - center.z, yaw: actor.rotation };
  }
  private place(actor: AgentState, root: LogosBaneRoot): void {
    actor.position = filmPosition('film_logos_deck', root.x, root.z); actor.position.y += root.y; actor.rotation = root.yaw;
  }
  private ensure(actor: AgentState): BaneEncounter {
    const journey = this.journey!, bane = this.world.agents.get('bane');
    if (!journey.bane) {
      // An unfinished legacy record is evidence of its existing fates, not
      // permission to resurrect the host to replay a newly authored scene.
      if (journey.step > 0 && !journey.completed.includes('m3_bane')) { journey.step = 1; delete journey.fighting; delete journey.started; }
      journey.bane = { phase: 'ready', elapsed: 0, attempts: 0, checkpoint: 'gun', hits: 0, focus: 0, counters: 0, lastStrike: -1 };
    }
    const encounter = journey.bane;
    if (!encounter.physical) encounter.physical = { version: 1, intro: encounter.phase === 'ready' ? 'waiting' : 'done', elapsed: 0,
      known: encounter.phase !== 'ready', gunOnDeck: encounter.phase !== 'ready', rescue: journey.step >= 3 ? 'done' : 'waiting', rescueElapsed: 0,
      gunHealth: actor.health, blindHealth: actor.health, baneHealth: bane?.health ?? 0, fall: encounter.phase === 'defeated' ? 1.2 : 0,
      player: this.local(actor), legacy: encounter.phase !== 'ready' };
    return encounter;
  }
  frame(actor: AgentState, input: { focus: boolean; yaw: number }, dt: number, tick: number): boolean {
    if (!this.active(actor)) return false;
    const journey = this.journey!, encounter = this.ensure(actor), state = encounter.physical!;
    const required = ['trinity', ...(encounter.phase === 'defeated' ? [] : ['bane'])];
    const occupied = required.find(id => this.world.agents.get(id)?.controller);
    const unavailable = required.find(id => { const member = this.world.agents.get(id); return !member || member.status !== 'alive' || member.health <= 0; });
    state.paused = occupied ? this.world.agents.get(occupied)!.name : undefined;
    state.unavailable = unavailable ? this.world.agents.get(unavailable)?.name ?? unavailable : undefined;
    const available = !occupied && !unavailable && actor.status === 'alive' && actor.health > 0 && !actor.isInMatrix && actor.currentLocation === 'film_logos_deck';
    if (available && encounter.phase === 'burning' && state.burnFrom && state.burnTo) {
      const bane = logosBaneRoot(encounter, 'bane'), dx = state.burnTo.x - bane.x, dz = state.burnTo.z - bane.z, length = Math.hypot(dx, dz);
      // Earlier saves placed the two forward-leaning heads at the same point.
      if (length > .01 && length < LOGOS_BANE.burnDistance - .05) state.burnTo = { ...state.burnTo,
        x: bane.x + dx / length * LOGOS_BANE.burnDistance, z: bane.z + dz / length * LOGOS_BANE.burnDistance };
    }
    const elapsed = available && actor.controller ? Math.max(0, Math.min(.1, dt)) : 0;
    state.player = this.local(actor);
    if (elapsed) {
      if (encounter.phase === 'defeated') state.fall = Math.min(1.2, state.fall + elapsed);
      if (state.intro !== 'done') {
        if (['hostage', 'lowering', 'dropping', 'taking', 'recognition'].includes(state.intro)) state.elapsed += elapsed;
        if (state.intro === 'lowering' && state.elapsed >= LOGOS_BANE.lowerSeconds * .68) state.gunOnDeck = true;
        if (state.intro === 'hostage' && state.elapsed >= LOGOS_BANE.hostageLines.length * LOGOS_BANE.lineSeconds) { state.intro = 'lower_ready'; state.elapsed = 0; }
        else if (state.intro === 'lowering' && state.elapsed >= LOGOS_BANE.lowerSeconds) { state.gunOnDeck = true; state.intro = 'dropping'; state.elapsed = 0; }
        else if (state.intro === 'dropping' && state.elapsed >= LOGOS_BANE.dropSeconds) { state.intro = 'taking'; state.elapsed = 0; }
        else if (state.intro === 'taking') {
          if (state.elapsed >= LOGOS_BANE.takeSeconds - .4) state.gunOnDeck = false;
          if (state.elapsed >= LOGOS_BANE.takeSeconds) { state.intro = 'recognition_ready'; state.elapsed = 0; }
        } else if (state.intro === 'recognition') {
          if (state.elapsed >= LOGOS_BANE.lineSeconds * 2 && !state.known) {
            state.known = true; this.sandbox().neoLife!.choices.bane_identity = 'smith';
            this.sandbox().neoLife!.journal.unshift({ day: this.sandbox().neoLife!.day, time: this.world.timeOfDay,
              title: '肉身背后的身份', text: 'Neo 在 Logos 的对峙中认出 Bane 身体里的 Smith。此前 Hammer 的调查只指出 Bane 的去向与风险。' });
          }
          if (state.elapsed >= LOGOS_BANE.recognitionLines.length * LOGOS_BANE.lineSeconds) {
            state.intro = 'done'; state.elapsed = 0; encounter.phase = 'gun_warning'; encounter.elapsed = 0;
            state.gunHealth = actor.health; journey.checkpoint = { ...actor.position };
          }
        }
      } else if (state.dodge) {
        state.dodge.elapsed = Math.min(LOGOS_BANE.dodgeSeconds, state.dodge.elapsed + elapsed);
        this.place(actor, logosBaneRoot(encounter, 'neo'));
        if (state.dodge.elapsed >= LOGOS_BANE.dodgeSeconds) {
          const kind = state.dodge.kind; delete state.dodge;
          encounter.phase = kind === 'gun' ? 'grapple' : 'counter'; encounter.elapsed = 0; encounter.lastStrike = -1;
          state.gunOnDeck = true; state.player = this.local(actor);
          journey.lastText = kind === 'gun' ? 'Neo 避开枪线，电枪在缠斗中落地。靠近 Bane，用 F 近身还击。' : 'Neo 躲过铁管，循着金色轮廓靠近，用 F 夺取武器并反击。';
        }
      } else if (state.strike) {
        const strike = state.strike, duration = strike.kind === 'punch' ? LOGOS_BANE.punchSeconds : LOGOS_BANE.pipeSeconds;
        strike.elapsed = Math.min(duration, strike.elapsed + elapsed); this.place(actor, logosBaneRoot(encounter, 'neo'));
        if (!strike.landed && strike.elapsed >= (strike.kind === 'punch' ? LOGOS_BANE.punchImpact : LOGOS_BANE.pipeImpact)) {
          strike.landed = true;
          if (strike.kind === 'punch') encounter.hits++;
          else if (++encounter.counters >= 2) {
            const bane = this.world.agents.get('bane')!; bane.status = 'dead'; bane.health = 0; encounter.phase = 'defeated'; state.fall = 0;
            this.sandbox().neoLife!.choices.bane_defeated = 'committed';
          }
        }
        if (strike.elapsed >= duration) {
          const kind = strike.kind; delete state.strike; state.player = this.local(actor); encounter.lastStrike = encounter.elapsed;
          if (kind === 'punch' && encounter.hits >= 2) {
            encounter.phase = 'burning'; encounter.elapsed = 0; state.burnFrom = this.local(actor);
            const bane = logosBaneRoot(encounter, 'bane'), dx = actor.position.x - FILM_SETS.film_logos_deck.center.x - bane.x, dz = actor.position.z - FILM_SETS.film_logos_deck.center.z - bane.z;
            const length = Math.max(.01, Math.hypot(dx, dz));
            state.burnTo = { x: bane.x + dx / length * LOGOS_BANE.burnDistance, y: 0, z: bane.z + dz / length * LOGOS_BANE.burnDistance, yaw: Math.atan2(-dx, -dz) };
            journey.lastText = 'Bane 扯住裸露电缆，把冒火的线端压向 Neo 的双眼。';
          } else if (encounter.phase === 'defeated') {
            encounter.elapsed = 0;
            this.onAdvance?.('Neo 夺下铁管，击倒了 Bane。金色的轮廓散去；Trinity 仍在下层。', actor, tick);
          }
        }
      } else if (state.rescue !== 'waiting' && state.rescue !== 'done') {
        state.rescueElapsed += elapsed;
        if (state.rescue === 'opening' && state.rescueElapsed >= LOGOS_BANE.hatch.seconds) { state.rescue = 'climbing'; state.rescueElapsed = 0; }
        else if (state.rescue === 'climbing' && state.rescueElapsed >= LOGOS_BANE.climbSeconds) { state.rescue = 'checking'; state.rescueElapsed = 0; }
        else if (state.rescue === 'checking' && state.rescueElapsed >= LOGOS_BANE.rescueLines.length * LOGOS_BANE.lineSeconds) {
          state.rescue = 'done'; state.rescueElapsed = 0; this.onAdvance?.(logosBaneText(encounter), actor, tick);
        }
      } else if (!['ready', 'defeated', 'failed'].includes(encounter.phase)) {
        encounter.elapsed += elapsed;
        if (encounter.phase === 'gun_warning' && encounter.elapsed >= BANE_ENCOUNTER.gunWarning) {
          encounter.phase = 'gun_window'; encounter.elapsed = 0; journey.lastText = 'Trinity 推下断路器，灯骤灭。现在用 X 躲开电枪枪线。';
        } else if (encounter.phase === 'gun_window' && encounter.elapsed >= BANE_ENCOUNTER.gunWindow) this.fail(actor, 'gun', '电枪击中了 Neo。', tick);
        else if (encounter.phase === 'grapple' && encounter.elapsed >= BANE_ENCOUNTER.grappleWindow) this.fail(actor, 'gun', 'Bane 重新摸到电枪。', tick);
        else if (encounter.phase === 'burning') {
          this.place(actor, logosBaneRoot(encounter, 'neo'));
          if (encounter.elapsed >= BANE_ENCOUNTER.burnSeconds) {
            encounter.phase = 'blind'; encounter.elapsed = 0; encounter.focus = 0; encounter.checkpoint = 'blind';
            this.sandbox().neoLife!.choices.neo_eyes = 'burned'; actor.health = Math.max(1, actor.health - 18);
            state.blindHealth = actor.health; state.player = this.local(actor); journey.checkpoint = { ...actor.position };
            journey.lastText = '双眼被电缆灼伤，房间失去形状。按住 G，循着脚步和机器信号建立金色感知。';
          }
        } else if (encounter.phase === 'blind') {
          encounter.focus = Math.max(0, Math.min(BANE_ENCOUNTER.focusSeconds, encounter.focus + (input.focus ? elapsed : -elapsed * .35)));
          if (encounter.focus >= BANE_ENCOUNTER.focusSeconds) {
            const root = logosBaneRoot(encounter, 'bane'); encounter.pipeX = root.x; encounter.pipeZ = root.z;
            encounter.phase = 'pipe_window'; encounter.elapsed = 0; journey.lastText = '肉身隐没，Smith 的金色轮廓显现。他举起铁管：现在按 X。';
          }
        } else if (encounter.phase === 'pipe_window' && encounter.elapsed >= BANE_ENCOUNTER.pipeWindow) this.fail(actor, 'blind', '铁管击中了 Neo。', tick);
        else if (encounter.phase === 'counter' && encounter.elapsed >= BANE_ENCOUNTER.counterWindow) this.fail(actor, 'blind', 'Bane 脱开了反击范围。', tick);
      }
    }
    if (available) this.pose(actor);
    this.seal();
    const text = logosBaneText(encounter); if (text) journey.lastText = text;
    return logosBaneLocked(encounter);
  }
  private pose(actor: AgentState): void {
    const journey = this.journey!, encounter = journey.bane!, state = encounter.physical!;
    if (logosBaneLocked(encounter) && !state.paused && !state.unavailable) {
      if (state.intro !== 'done' || encounter.phase === 'burning') this.place(actor, logosBaneRoot(encounter, 'neo'));
      actor.velocity = { x: 0, y: 0, z: 0 }; actor.targetPosition = null; actor.currentPath = [];
    }
    state.player = this.local(actor);
    for (const role of ['neo', 'bane', 'trinity'] as const) {
      const member = this.world.agents.get(role); if (!member || role !== 'neo' && member.controller || role !== 'bane' && member.status !== 'alive') continue;
      if (role !== 'neo') { this.place(member, logosBaneRoot(encounter, role)); member.velocity = { x: 0, y: 0, z: 0 }; }
      member.currentLocation = 'film_logos_deck'; member.isInMatrix = false; member.targetPosition = null; member.currentPath = [];
      member.currentAction = { type: 'idle', parameters: { resolved: true, logosBane: { encounter: { ...encounter, physical: { ...state, player: { ...state.player } } }, role } },
        startedAt: journey.enteredAt, duration: 1e9, progress: 0 };
    }
  }
  private fail(actor: AgentState, checkpoint: 'gun' | 'blind', text: string, tick: number): void {
    const encounter = this.journey!.bane!; encounter.phase = 'failed'; encounter.checkpoint = checkpoint; encounter.elapsed = 0;
    actor.health = Math.max(1, Math.min(actor.health, Math.ceil(actor.maxHealth * .15))); actor.velocity = { x: 0, y: 0, z: 0 };
    actor.currentAction = { type: 'idle', parameters: { resolved: true }, startedAt: tick, duration: 1, progress: 0 };
    this.journey!.lastText = `${text} J 打开手记，从${checkpoint === 'gun' ? '断电前' : '失明后'}的已保存伤势重试。`;
  }
  action(actor: AgentState, kind: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, { focus: false, yaw: actor.rotation }, 0, tick);
    const encounter = this.journey!.bane!, state = encounter.physical!;
    if (['ability', 'ability2', 'shoot', 'travel'].includes(kind)) return '这里是现实世界，矩阵能力不能代替近身求生。';
    if (!['attack', 'dodge'].includes(kind)) return;
    if (state.paused || state.unavailable) return this.journey!.lastText;
    if (state.intro !== 'done') return '先应对挟持与身份对峙。F 或 X 不会跳过放枪、放人和断电。';
    if (state.strike || state.dodge) return '这一动作正在进行，等站稳再出下一招。';
    if (kind === 'dodge' && ['gun_window', 'pipe_window'].includes(encounter.phase)) {
      state.dodge = { kind: encounter.phase === 'gun_window' ? 'gun' : 'pipe', elapsed: 0, from: this.local(actor) };
      this.pose(actor); return 'Neo 移开重心，侧身离开攻击线。';
    }
    if (kind === 'attack' && ['grapple', 'counter'].includes(encounter.phase)) {
      const bane = this.world.agents.get('bane')!, range = encounter.phase === 'grapple' ? 3.25 : 5;
      const yaw = Math.atan2(bane.position.x - actor.position.x, bane.position.z - actor.position.z);
      if (distance(actor.position, bane.position) > range || Math.cos(actor.rotation - yaw) < .5) return '用 WASD 靠近并面向 Bane，再按 F 反击。';
      const from = this.local(actor), root = logosBaneRoot(encounter, 'bane'), dx = from.x - root.x, dz = from.z - root.z, length = Math.max(.01, Math.hypot(dx, dz));
      state.strike = { kind: encounter.phase === 'grapple' ? 'punch' : 'pipe', elapsed: 0, landed: false, from,
        to: { x: root.x + dx / length * 1.25, y: 0, z: root.z + dz / length * 1.25, yaw } };
      this.pose(actor); return 'Neo 跨步贴近，攻击会在动作接触时结算。';
    }
    return encounter.phase === 'blind' ? '按住 G，听脚步并建立金色感知。' : encounter.phase === 'failed' ? 'J 打开手记重试。' : '等待攻击窗口，X 闪避，靠近并面向目标后 F 反击。';
  }
  command(actor: AgentState, target: string, tick: number): string | undefined {
    if (!this.active(actor)) return;
    this.frame(actor, { focus: false, yaw: actor.rotation }, 0, tick);
    const journey = this.journey!, encounter = journey.bane!, state = encounter.physical!;
    if (state.paused || state.unavailable) return journey.lastText;
    if (target === 'retry' && encounter.phase === 'failed') {
      encounter.phase = encounter.checkpoint === 'gun' ? 'gun_warning' : 'blind'; encounter.elapsed = 0; encounter.focus = 0;
      encounter.hits = 0; encounter.counters = 0; encounter.lastStrike = -1; encounter.attempts++;
      delete encounter.pipeX; delete encounter.pipeZ; delete state.strike; delete state.dodge;
      actor.status = 'alive'; actor.health = encounter.checkpoint === 'gun' ? state.gunHealth : state.blindHealth;
      actor.position = { ...journey.checkpoint }; actor.rotation = Math.atan2(LOGOS_BANE.gunman.x - this.local(actor).x, LOGOS_BANE.gunman.z - this.local(actor).z);
      actor.velocity = { x: 0, y: 0, z: 0 }; state.player = this.local(actor);
      this.pose(actor); return journey.lastText = '回到已保存的交锋检查点。原有伤势、眼伤、物品、同伴状态与身份认知保留。';
    }
    if (target.startsWith('visit:') && journey.step < 3) return '先完成这段船舱交锋与救援，再回访此前的剧情。';
    if (target !== 'act') return journey.step < 3 ? journey.lastText : undefined;
    if (journey.step === 1 && state.intro !== 'done') {
      const target = state.intro === 'recognition_ready' ? this.world.agents.get('bane')!.position : filmPosition('film_logos_deck', LOGOS_BANE.approach.x, LOGOS_BANE.approach.z);
      if (distance(actor.position, target) > (state.intro === 'recognition_ready' ? 7 : 2.3)) return '先走近货舱里的对峙位置，再按 G。';
      if (state.intro === 'waiting') state.intro = 'hostage';
      else if (state.intro === 'lower_ready') { state.intro = 'lowering'; state.gunPoint = { x: state.player.x + .34, y: .26, z: state.player.z + .8 }; }
      else if (state.intro === 'recognition_ready') state.intro = 'recognition';
      else return journey.lastText;
      state.elapsed = 0; this.pose(actor); return journey.lastText = logosBaneText(encounter);
    }
    if (journey.step === 2 && encounter.phase === 'defeated') {
      if (state.strike || state.rescue !== 'waiting') return journey.lastText;
      if (distance(actor.position, filmPosition('film_logos_deck', LOGOS_BANE.rescue.x, LOGOS_BANE.rescue.z)) > 1.7) return '先走到下层舱口旁，再按 G 打开它。';
      state.rescue = 'opening'; state.rescueElapsed = 0; this.pose(actor); return journey.lastText = logosBaneText(encounter);
    }
    return journey.step < 3 ? journey.lastText : undefined;
  }
  private seal(): void {
    const prefix = 'film:logos-bane:', journey = this.journey!;
    const hatch = LOGOS_BANE.hatch, id = `${prefix}hatch-floor`;
    let floor = this.sandbox().structures.find(item => item.id === id);
    if (!floor) {
      floor = { id, owner: 'film', kind: 'beacon', matrix: false, health: 1e9, position: filmPosition('film_logos_deck', hatch.x, hatch.z),
        film: { scene: journey.scene, width: hatch.width - .14, depth: hatch.depth - .14, height: 0 } };
      this.sandbox().structures.push(floor);
    }
    floor.position.y = FILM_SETS.film_logos_deck.center.y + (logosBaneHatch(journey.bane) > .85 ? hatch.lower : 0);
    if (this.sandbox().structures.some(item => item.id === `${prefix}wall:0`)) return;
    for (const [i, wall] of LOGOS_BANE.walls.entries()) this.sandbox().structures.push({ id: `${prefix}wall:${i}`, owner: 'film', kind: 'barricade', matrix: false, health: 1e9,
      position: filmPosition('film_logos_deck', wall.x, wall.z), film: { scene: journey.scene, width: wall.width, depth: wall.depth, height: wall.height } });
    for (const x of [-5.35, 5.35]) for (const z of [-25, -13, 2, 15]) this.sandbox().structures.push({ id: `${prefix}equipment:${x}:${z}`, owner: 'film', kind: 'barricade', matrix: false, health: 1e9,
      position: filmPosition('film_logos_deck', x, z), film: { scene: journey.scene, width: 1.1, depth: 3.4, height: 3.1 } });
  }
}
