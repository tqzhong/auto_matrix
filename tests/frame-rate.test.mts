import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameRate } from '../packages/client/src/engine/FrameRate.js';

test('reported FPS includes slow frames rather than using the capped physics delta', () => {
  const rate = new FrameRate();
  for (let i = 0; i < 10; i++) rate.update(.25);
  assert.equal(rate.fps, 4);
  for (let i = 0; i < 20; i++) rate.update(.125);
  assert.equal(rate.fps, 8);
});

test('FPS counts frames over elapsed time instead of averaging reciprocal frame times', () => {
  const rate = new FrameRate();
  rate.update(0); rate.update(.05); rate.update(.45);
  assert.equal(rate.fps, 4, 'two uneven frames over half a second are still four FPS');
  rate.update(.125); rate.update(.125); rate.update(.125); rate.update(.125);
  assert.equal(rate.fps, 8, 'the next completed window reflects recovery');
});
