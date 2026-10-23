import fs from 'node:fs/promises';
import { WorldState } from './candidate-release/packages/server/src/world/WorldState.js';
import { PlayerController } from './candidate-release/packages/server/src/player/PlayerController.js';
import { SandboxSystem } from './candidate-release/packages/server/src/player/SandboxSystem.js';

const saved = JSON.parse(await fs.readFile(new URL('./dojo-input-investigation-world.json', import.meta.url), 'utf8'));
const world = new WorldState(); world.simulationTick = saved.simulation.tick; world.timeOfDay = saved.timeOfDay;
for (const agent of Object.values(saved.agents) as any[]) { delete agent.controller; world.registerAgent(agent); }
const dynamics = { record() {} } as any;
const sandbox = new SandboxSystem(world, dynamics, 123); sandbox.restore(saved.sandbox);
const players = new PlayerController(world, { interrupt() {}, isAgentInConversation: () => false } as any, {} as any, dynamics, sandbox);
players.possess('diagnostic', 'neo', world.simulationTick, true); players.step(0, true, world.simulationTick);
const trace: any[] = [];
for (const path of ['hammerGunnerAction', 'truckRoad.hood.handle', 'truckRoad.weapons.handle', 'sixth.handle', 'bathroomAction', 'sourcePortal.handle', 'reloaded.handle', 'catch.handle', 'dockLastStand.handle', 'upperDigger.handle', 'diggers.handle', 'dockReload.handle', 'baneAction', 'smithFinaleAction', 'helBargainDodge', 'burlyDodge', 'chateauParry', 'governmentDodge', 'airRescueBrace', 'matrixEscapeEvade', 'theOneEvade', 'helGarage.action', 'trainmanChase.action', 'performing']) {
  const parts = path.split('.'); const name = parts.pop()!; let object: any = sandbox.life.film;
  for (const part of parts) object = object[part]; const original = object[name];
  object[name] = function (...args: any[]) { const result = original.apply(this, args); if (result !== undefined) trace.push({ method: path, result }); return result; };
}
const result = players.act('diagnostic', 'dodge', world.simulationTick);
console.log(JSON.stringify({ scene: sandbox.life.film.state?.scene, result, trace, cooldowns: world.agents.get('neo')!.combatCooldowns }, null, 2));
