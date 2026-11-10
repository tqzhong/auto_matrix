import assert from 'node:assert/strict';
import test from 'node:test';
import { filmPosition,type WorldEvent }from '@auto_matrix/shared';
import { WorldState }from '../packages/server/src/world/WorldState.js';
import { AgentManager }from '../packages/server/src/agents/AgentManager.js';
import { SandboxSystem }from '../packages/server/src/player/SandboxSystem.js';
import { PlayerController }from '../packages/server/src/player/PlayerController.js';
import type { ConversationEngine }from '../packages/server/src/agents/ConversationEngine.js';
import type { ActionExecutor }from '../packages/server/src/agents/ActionExecutor.js';
import type { WorldDynamics }from '../packages/server/src/story/WorldDynamics.js';

test('failure and retry expose a complete held-weapon checkpoint before another movement frame runs',()=>{
  const world=new WorldState();new AgentManager(world).initializeAllAgents();const dynamics={record:(_event:Omit<WorldEvent,'id'>)=>undefined}as WorldDynamics,sandbox=new SandboxSystem(world,dynamics,42);
  const players=new PlayerController(world,{interrupt(){},isAgentInConversation:()=>false}as unknown as ConversationEngine,{execute(){}}as unknown as ActionExecutor,dynamics,sandbox),neo=world.agents.get('neo')!;
  players.possess('p','neo',0);sandbox.life.begin(neo,0);neo.currentLocation='film_chateau_hall';neo.isInMatrix=true;neo.position=filmPosition('film_chateau_hall',0,10);
  sandbox.state.neoLife!.journey={version:1,scene:'m2_chateau',step:0,actor:'neo',enteredAt:10,checkpoint:{...neo.position},completed:[],reflections:{},lastText:'',chateau:{phase:'duel',wave:1,weapon:'sword',parries:0,disarms:0,attempts:0,wounded:true}};
  neo.health=0;assert.equal(sandbox.life.film.chateauFailed(neo,20),true);assert.equal(neo.currentAction?.parameters.chateauWeapon,'sword','the failure snapshot already displays the selected sword');assert.equal(neo.currentAction?.type,'idle');
  players.sandboxAction('p',{kind:'life',target:'film:act'},21);assert.equal(sandbox.life.film.state!.chateau?.phase,'ready');assert.equal(neo.currentAction?.parameters.chateauWeapon,'sword','retry cannot leave a transient empty equipment pose');assert.equal(neo.health,neo.maxHealth);
});
