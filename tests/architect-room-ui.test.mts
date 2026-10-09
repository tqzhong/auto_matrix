import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { filmPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';
test('the Architect HUD keeps opening distinct from physically walking through the doorway',async t=>{
  const output=await build({entryPoints:['packages/client/src/player/SandboxUI.ts'],bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},logLevel:'silent'});
  const {SandboxUI}=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements=new Map();const element=(id:string)=>{
    if(!elements.has(id)){const classes=new Set<string>();elements.set(id,{textContent:'',innerHTML:'',style:{},classList:{add:(...n:string[])=>n.forEach(v=>classes.add(v)),remove:(...n:string[])=>n.forEach(v=>classes.delete(v)),contains:(n:string)=>classes.has(n),toggle:(n:string,flag:boolean)=>flag?classes.add(n):classes.delete(n)}});}return elements.get(id);
  };
  const document=globalThis.document;t.after(()=>{globalThis.document=document;});globalThis.document={getElementById:element} as unknown as Document;
  const ui=Object.assign(Object.create(SandboxUI.prototype),{root:{querySelector:(s:string)=>element(s.replace(/^#/,''))},tick:0});
  const player={id:'neo',status:'alive',isInMatrix:true,rotation:Math.PI,position:filmPosition('film_architect_room',-8,-26)} as AgentState;
  const sandbox={threats:[],neoLife:{journey:{scene:'m2_architect',actor:'neo',step:5,completed:[],reflections:{},architect:{phase:'decision',sourceReviewed:true,trinityReviewed:true,remaining:30,lastTick:0,attempts:0,room:{elapsed:1,chairYaw:0}}}}} as SandboxState;
  ui.updateFilm(player,sandbox);assert.equal(element('sandbox-interact').classList.contains('hidden'),false);
  const state=sandbox.neoLife!.journey!.architect!;state.room!.exit={elapsed:.6,x:-8,z:-26};
  ui.updateFilm(player,sandbox);assert.equal(element('sandbox-interact').classList.contains('hidden'),true);assert.match(element('game-objective-copy').textContent,/正在开门/);
  state.room!.exit.elapsed=1.8;ui.updateFilm(player,sandbox);assert.match(element('game-objective-copy').textContent,/WASD.*门槛/);assert.doesNotMatch(element('game-objective-copy').textContent,/按 G/);
  assert.equal(element('sandbox-interact').classList.contains('hidden'),true);
});

test('the journal asks Neo to walk through an opened door instead of offering another G interaction',async()=>{
  const output=await build({entryPoints:['packages/client/src/player/FilmJourneyPanel.ts'],bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},logLevel:'silent'});
  const {renderFilmJourney}=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const player={id:'neo',status:'alive',isInMatrix:true,position:filmPosition('film_architect_room',-8,-26)} as AgentState;
  const sandbox={neoLife:{journey:{scene:'m2_architect',actor:'neo',step:5,completed:[],reflections:{},architect:{phase:'decision',sourceReviewed:true,trinityReviewed:true,remaining:30,lastTick:0,attempts:0,room:{elapsed:1,chairYaw:0}}}}} as SandboxState;
  assert.match(renderFilmJourney(player,sandbox),/data-target="film:act"/);
  const state=sandbox.neoLife!.journey!.architect!;state.room!.exit={elapsed:.6,x:-8,z:-26};
  const opening=renderFilmJourney(player,sandbox);assert.doesNotMatch(opening,/data-target="film:act"/);assert.match(opening,/正在开门/);
  state.room!.exit.elapsed=1.8;const opened=renderFilmJourney(player,sandbox);assert.match(opened,/WASD.*门槛/);assert.doesNotMatch(opened,/data-target="film:act"/);
});
