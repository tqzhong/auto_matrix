import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { AgentRenderer } from '../packages/client/src/agents/AgentRenderer.js';
import type { LightCulling } from '../packages/client/src/engine/LightCulling.js';

function fixture() {
  const actors = new Map<string, { actor: THREE.Group; hero?: THREE.Group; detail?: THREE.Group }>();
  const work: string[] = [], uploaded = new Map<THREE.Texture, number>();
  const programs: { program: object; isReady(): boolean; getUniforms(): void }[] = [];
  let target: THREE.WebGLRenderTarget | null = null, ready = false;
  const agents = Object.assign(Object.create(AgentRenderer.prototype), {
    getAgent: (id: string) => actors.get(id)?.actor,
    getAgentHero: (id: string) => actors.get(id)?.hero,
    getAgentDetail: (id: string) => actors.get(id)?.detail,
  }) as AgentRenderer;
  const renderer = {
    properties: { get: (texture: THREE.Texture) => ({ __version: uploaded.get(texture) }) },
    extensions: { has: () => true }, info: { programs }, debug: { checkShaderErrors: true },
    getContext: () => ({ LINK_STATUS: 0x8b82, getProgramParameter: () => true }),
    getRenderTarget: () => target, setRenderTarget: (value: typeof target) => { target = value; },
    initTexture: (texture: THREE.Texture) => { work.push(texture.name); uploaded.set(texture, texture.version); },
  } as unknown as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera();
  const lighting = { compileSubject: (gpu: THREE.WebGLRenderer, eye: THREE.Camera, hero: THREE.Group) => {
    assert.equal(gpu, renderer); assert.equal(eye, camera); assert.ok(target);
    work.push('compile:' + hero.name);
    programs.push({ program: {}, isReady: () => ready, getUniforms: () => {
      assert.equal(renderer.debug.checkShaderErrors, false); work.push('uniforms:' + hero.name);
    } });
  } } as unknown as LightCulling;
  const texture = (name: string) => {
    const value = new THREE.Texture({ width: 32, height: 32 }); value.name = name; value.needsUpdate = true; return value;
  };
  const add = (id: string, maps: Record<string, THREE.Texture> = {}) => {
    const actor = new THREE.Group(), detail = new THREE.Group(), hero = new THREE.Group(); hero.name = id;
    actor.add(detail); detail.add(hero); detail.visible = false;
    hero.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(maps)));
    actors.set(id, { actor, hero }); return { actor, detail, hero };
  };
  const floor = () => agents.prepareOfficeCast(renderer, camera, lighting, 'floor');
  const drain = () => { for (let i = 0; i < 40; i++) { const count = work.length; floor(); assert.ok(work.length - count <= 1, 'keep at most one upload, compile or uniform completion per frame'); } };
  return { agents, actors, renderer, work, uploaded, texture, add, floor, drain, ready: () => { ready = true; } };
}

test('the office floor prepares nearby exterior actors and their PBR maps before a window turn', () => {
  const h = fixture(), manager = h.add('rhineheart', { map: h.texture('manager') });
  const skin = h.texture('street-skin'), normal = h.texture('street-normal'), alpha = h.texture('street-alpha');
  const street = h.add('citizen_2', { map: skin, normalMap: normal, alphaMap: alpha });
  const guard = h.add('agent_jones', { map: h.texture('guard') });
  h.drain();
  for (const name of ['manager', 'street-skin', 'street-normal', 'street-alpha', 'guard', 'compile:rhineheart', 'compile:citizen_2', 'compile:agent_jones'])
    assert.ok(h.work.includes(name), 'missing preparation: ' + name);
  assert.ok(!h.work.some(value => value.startsWith('uniforms:')), 'wait for parallel compilation');
  h.ready(); h.drain();
  for (const id of ['rhineheart', 'citizen_2', 'agent_jones']) assert.equal(h.work.filter(value => value === 'uniforms:' + id).length, 1);
  assert.ok([manager, street, guard].every(value => !value.detail.visible && value.hero.parent === value.detail));
  assert.equal(((street.hero.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).normalMap, normal);
  assert.equal(h.renderer.getRenderTarget(), null); assert.equal(h.renderer.debug.checkShaderErrors, true);
});

test('office floor preparation skips hidden and distant actors and picks them up on approach', () => {
  const h = fixture(), actor = h.add('citizen_2', { map: h.texture('nearby') });
  actor.actor.position.z = 131; h.drain(); assert.deepEqual(h.work, []);
  actor.actor.position.z = 120; actor.actor.visible = false; h.drain(); assert.deepEqual(h.work, []);
  actor.actor.visible = true; actor.hero.visible = false; h.drain(); assert.deepEqual(h.work, []);
  actor.hero.visible = true; h.drain(); assert.ok(h.work.includes('nearby')); assert.ok(h.work.includes('compile:citizen_2'));
});

test('late exterior models and replacement GPU contexts each receive their own preparation', () => {
  const h = fixture(); h.actors.set('agent_brown', { actor: new THREE.Group() }); h.drain(); assert.deepEqual(h.work, []);
  h.add('agent_brown', { map: h.texture('late-guard') }); h.ready(); h.drain();
  assert.equal(h.work.filter(value => value === 'compile:agent_brown').length, 1);
  const texture = h.texture('new-model'); h.add('agent_brown', { map: texture }); h.drain();
  assert.ok(h.work.includes('new-model')); assert.equal(h.work.filter(value => value === 'compile:agent_brown').length, 2);
  h.renderer.properties = { get: () => ({}) } as THREE.WebGLRenderer['properties'];
  h.drain(); assert.equal(h.work.filter(value => value === 'compile:agent_brown').length, 3);
});

test('procedural exterior actors prepare their hidden detailed body without changing the displayed LOD', () => {
  const h = fixture(), body = h.add('citizen_1', { map: h.texture('procedural-body') });
  body.detail.name = 'procedural-detail';
  h.actors.set('citizen_1', { actor: body.actor, detail: body.detail });
  h.ready(); h.drain();
  assert.ok(h.work.includes('procedural-body'));
  assert.equal(h.work.filter(value => value === 'compile:procedural-detail').length, 1);
  assert.equal(body.detail.visible, false);
  assert.equal(body.hero.parent, body.detail);
});
