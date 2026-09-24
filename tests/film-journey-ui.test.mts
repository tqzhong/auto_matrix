import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { FILM_SCENE_BY_ID, filmPosition, filmStepPosition, type AgentState, type SandboxState } from '@auto_matrix/shared';

test('the second call offers a visible bridge continuation after Neo reaches the apartment door', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const scene = FILM_SCENE_BY_ID.m1_wake_again;
  const player = { id: 'neo', position: filmStepPosition(scene, scene.steps[1]) } as AgentState;
  const sandbox = { neoLife: { journey: { scene: scene.id, actor: 'neo', step: scene.steps.length,
    completed: [scene.id], lastText: '前往 101 房门，离开公寓，去 Adams Street 桥下。',
    wakeCall: { phase: 'done', elapsed: 0, nightmare: true } } } } as SandboxState;
  const html = renderFilmJourney(player, sandbox);
  assert.match(html, /data-target="film:next"/);
  assert.match(html, /Adams Street/);
  assert.doesNotMatch(html, /亲自走到 101 房门/);
});

test('the hotel journal names Trinity when Neo reaches 1313 before the guide', async () => {
  const output = await build({ entryPoints: ['packages/client/src/player/FilmJourneyPanel.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const { renderFilmJourney } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
  const player = { id: 'neo', position: filmPosition('film_lafayette', 24, 0) } as AgentState;
  const sandbox = { neoLife: { journey: { scene: 'm1_pills', actor: 'neo', step: 0, lastText: 'Trinity 正从楼梯赶来。',
    hotel: { progress: 100 } } } } as SandboxState;
  const html = renderFilmJourney(player, sandbox);
  assert.match(html, /等待 Trinity 赶来/);
  assert.doesNotMatch(html, /敲响 1313 房门/);
});
