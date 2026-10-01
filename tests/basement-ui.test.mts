import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { BASEMENT, TV_EXIT, FILM_SETS, basementRouteLength, type AgentState, type SandboxState } from '@auto_matrix/shared';
function fixture() {
  const center=FILM_SETS.film_ambush_house.center;
  const player={id:'neo',status:'alive',isInMatrix:true,rotation:0,position:{x:center.x+9,y:center.y+BASEMENT.floor,z:center.z+22.5}} as AgentState;
  const sandbox={threats:[],neoLife:{journey:{scene:'m1_basement',actor:'neo',step:1,completed:[],reflections:{},lastText:'撤离',basement:{phase:'searching',elapsed:0,attempts:0,air:73,gas:18,hatch:0,separated:false,company:{neo:0,trinity:0,apoc:0,switch:0,cypher:0},tunnel:0}}}} as SandboxState;
  return {player,sandbox,journey:sandbox.neoLife!.journey!,center};
}

test('the journal requires reachable grate, assembled crew and the actual dead-line call before continuation',async()=>{
  const output=await build({entryPoints:['packages/client/src/player/FilmJourneyPanel.ts'],bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},logLevel:'silent'});
  const {renderFilmJourney}=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const h=fixture(),state=h.journey.basement!;
  assert.doesNotMatch(renderFilmJourney(h.player,h.sandbox),/data-target="film:next"|data-target="film:act"/);
  h.journey.step=2;assert.match(renderFilmJourney(h.player,h.sandbox),/data-target="film:act"/);
  h.player.position.x+=20;assert.match(renderFilmJourney(h.player,h.sandbox),/data-target="film:act" disabled/);h.player.position.x-=20;
  state.phase='hatch_ready';state.hatch=1;assert.match(renderFilmJourney(h.player,h.sandbox),/data-target="film:act" disabled/);
  state.company.apoc=basementRouteLength('apoc');state.company.switch=basementRouteLength('switch');assert.doesNotMatch(renderFilmJourney(h.player,h.sandbox),/data-target="film:act" disabled/);
  state.phase='draining';assert.doesNotMatch(renderFilmJourney(h.player,h.sandbox),/data-target="film:next"|data-target="film:act"/);
  state.phase='failed';assert.match(renderFilmJourney(h.player,h.sandbox),/data-target="film:retry"/);
  state.paused=true;assert.doesNotMatch(renderFilmJourney(h.player,h.sandbox),/data-target="film:retry"/);
  h.journey.scene='m1_tv_exit';h.journey.step=2;h.journey.tvExit={phase:'emerging',elapsed:1,emerge:{neo:1,trinity:0,apoc:0,switch:0},crosscut:{phase:'phone',elapsed:0,view:'matrix',attempts:0,tankHealth:100,tankHit:false,dozerDead:false,apocDead:false,switchDead:false,cypherDead:false,trinityOut:false,neoOut:false}};
  const emerging=renderFilmJourney(h.player,h.sandbox);assert.match(emerging,/按住 W 依次爬出/);assert.match(emerging,/出井 25%/);
  h.journey.tvExit={phase:'ready',elapsed:0};
  h.player.position={x:FILM_SETS.film_tv_repair.center.x+TV_EXIT.approach.x,y:1,z:FILM_SETS.film_tv_repair.center.z+TV_EXIT.approach.z};
  assert.match(renderFilmJourney(h.player,h.sandbox),/取下硬线听筒/);
  h.journey.tvExit.phase='pickup';assert.doesNotMatch(renderFilmJourney(h.player,h.sandbox),/data-target="film:next"|data-target="film:act"/);
  h.journey.tvExit.phase='line_dead';assert.match(renderFilmJourney(h.player,h.sandbox),/请 Trinity 联系船上/);assert.doesNotMatch(renderFilmJourney(h.player,h.sandbox),/data-target="film:next"/);
  h.journey.tvExit.phase='done';assert.match(renderFilmJourney(h.player,h.sandbox),/切换到 Tank 的现实视角/);
});

test('the HUD describes pipe and low-drain controls and never offers a distant phone or busy grate',async t=>{
  const output=await build({entryPoints:['packages/client/src/player/SandboxUI.ts'],bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},logLevel:'silent'});
  const {SandboxUI}=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements = new Map<string, { textContent: string; innerHTML: string; style: Record<string, string>; classes: Set<string>; classList: { add(value: string): void; remove(value: string): void; toggle(value: string, force: boolean): void } }>();
  const element = (id: string) => {
    if (!elements.has(id)) { const classes = new Set<string>(); elements.set(id, { textContent: '', innerHTML: '', style: {}, classes, classList: {
      add: value => { classes.add(value); }, remove: value => { classes.delete(value); }, toggle: (value, force) => { if (force) classes.add(value); else classes.delete(value); } } }); }
    return elements.get(id)!;
  };
  const document = globalThis.document; t.after(() => { globalThis.document = document; });
  globalThis.document = { getElementById: element } as unknown as Document;
  const ui = Object.assign(Object.create(SandboxUI.prototype), { root: { querySelector: element }, tick: 0 }), h = fixture();

  ui.updateFilm(h.player,h.sandbox);assert.ok(element('#sandbox-interact').classes.has('hidden'));assert.match(element('#sandbox-trace').textContent,/73%/);
  h.journey.basement!.phase='descending';ui.updateFilm(h.player,h.sandbox);assert.match(element('#film-sequence-hint').textContent,/W.*下行.*S/);assert.equal(element('#sandbox-waypoint').textContent,'');
  h.journey.basement!.phase='hatch_ready';ui.updateFilm(h.player,h.sandbox);assert.ok(element('#sandbox-interact').classes.has('hidden'));
  h.journey.basement!.company.apoc=basementRouteLength('apoc');h.journey.basement!.company.switch=basementRouteLength('switch');ui.updateFilm(h.player,h.sandbox);assert.equal(element('#sandbox-interact').classes.has('hidden'),false);
  h.journey.basement!.paused=true;ui.updateFilm(h.player,h.sandbox);assert.ok(element('#sandbox-interact').classes.has('hidden'));
  h.journey.scene='m1_tv_exit';h.journey.step=2;h.journey.tvExit={phase:'ready',elapsed:0};ui.updateFilm(h.player,h.sandbox);assert.ok(element('#sandbox-interact').classes.has('hidden'));
  h.journey.tvExit.phase='line_dead';ui.updateFilm(h.player,h.sandbox);assert.equal(element('#sandbox-interact').classes.has('hidden'),false);assert.match(element('#film-sequence-hint').textContent,/Trinity/);
  h.journey.tvExit.phase='calling';ui.updateFilm(h.player,h.sandbox);assert.ok(element('#sandbox-interact').classes.has('hidden'));assert.doesNotMatch(element('game-objective-copy').textContent,/继续下一段/);
});

test('crosscut HUD uses existing template elements and presents the currently playable action',async t=>{
  const source=await readFile('packages/client/src/player/SandboxUI.ts','utf8');
  const ids=new Set([...source.matchAll(/\bid="([\w-]+)"/g)].map(match=>match[1]));
  const output=await build({entryPoints:['packages/client/src/player/SandboxUI.ts'],bundle:true,platform:'node',format:'esm',write:false,loader:{'.css':'empty'},logLevel:'silent'});
  const {SandboxUI}=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const elements=new Map<string,any>();
  for(const id of [...ids,'game-objective','game-objective-copy']) {
    const classes=new Set<string>(id==='film-sequence'?['hidden']:[]);
    elements.set(id,{textContent:'',style:{},classes,classList:{add:(...values:string[])=>values.forEach(v=>classes.add(v)),remove:(...values:string[])=>values.forEach(v=>classes.delete(v)),toggle:(v:string,force:boolean)=>force?classes.add(v):classes.delete(v)}});
  }
  const document=globalThis.document;t.after(()=>{globalThis.document=document;});
  globalThis.document={getElementById:(id:string)=>elements.get(id)??null} as unknown as Document;
  const ui=Object.assign(Object.create(SandboxUI.prototype),{root:{querySelector:(selector:string)=>elements.get(selector.slice(1))??null},tick:0}),h=fixture();
  h.journey.scene='m1_tv_exit';h.journey.step=2;
  h.player.position={x:FILM_SETS.film_tv_repair.center.x+TV_EXIT.approach.x,y:1,z:FILM_SETS.film_tv_repair.center.z+TV_EXIT.approach.z};
  h.journey.tvExit={phase:'ready',elapsed:0,crosscut:{phase:'phone',elapsed:0,view:'matrix',attempts:0,tankHealth:100,tankHit:false,dozerDead:false,apocDead:false,switchDead:false,cypherDead:false,trinityOut:false,neoOut:false}};
  assert.doesNotThrow(()=>ui.updateFilm(h.player,h.sandbox));
  assert.equal(elements.get('film-sequence').classes.has('hidden'),false);
  assert.match(elements.get('film-sequence-line').textContent,/Trinity.*Neo/);
  assert.match(elements.get('film-sequence-hint').textContent,/G.*取下硬线/);
  const cut=h.journey.tvExit.crosscut!;cut.phase='assault';cut.view='ship';h.journey.actor='tank';h.player.id='tank';
  ui.updateFilm(h.player,h.sandbox);assert.match(elements.get('game-objective').textContent,/现实飞船/);
  assert.ok(elements.get('sandbox-interact').classes.has('hidden'));
  h.journey.scene='m1_unplugged';cut.phase='window';cut.elapsed=.5;
  ui.updateFilm(h.player,h.sandbox);assert.match(elements.get('film-sequence-hint').textContent,/G.*反击/);
  cut.phase='failed';ui.updateFilm(h.player,h.sandbox);assert.match(elements.get('film-sequence-hint').textContent,/J.*重试/);
  assert.ok(elements.get('sandbox-interact').classes.has('hidden'));
});
