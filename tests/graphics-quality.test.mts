import assert from 'node:assert/strict';
import test from 'node:test';
import { graphicsPixelRatio, readGraphicsQuality, saveGraphicsQuality } from '../packages/client/src/engine/GraphicsQuality.js';

test('quality presets preserve the original high quality and reduce actual 3D pixel work', () => {
  assert.equal(graphicsPixelRatio('high', 1280, 720, 2), 1.5);
  assert.equal(graphicsPixelRatio('balanced', 1280, 720, 2), 1);
  assert.equal(graphicsPixelRatio('smooth', 1280, 720, 2), .75);
  for (const quality of ['high', 'balanced', 'smooth'] as const) {
    assert.equal(graphicsPixelRatio(quality, 1280, 720, .5), .5, 'never render above a lower-density device');
  }
});

test('larger windows stay within the chosen pixel budget without changing the aspect ratio', () => {
  for (const [width, height] of [[3840, 2160], [2560, 1440], [600, 1800]]) {
    for (const quality of ['balanced', 'smooth'] as const) {
      const ratio = graphicsPixelRatio(quality, width, height, 2);
      const pixels = width * height * ratio * ratio;
      assert.ok(pixels <= (quality === 'balanced' ? 1920 * 1080 : 1280 * 720) + .001);
      assert.equal((width * ratio) / (height * ratio), width / height);
    }
  }
  assert.equal(graphicsPixelRatio('high', 3840, 2160, 2), 1.5, 'the original quality is never silently reduced');
});

test('quality reloads saved choices and falls back safely for missing, stale or blocked storage', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    assert.equal(readGraphicsQuality(), 'high');
    for (const quality of ['smooth', 'balanced', 'high'] as const) {
      assert.equal(saveGraphicsQuality(quality), true); assert.equal(readGraphicsQuality(), quality);
    }
    values.set('matrix:graphics-quality', 'removed-preset'); assert.equal(readGraphicsQuality(), 'high');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('storage blocked'); } });
    assert.equal(readGraphicsQuality(), 'high'); assert.equal(saveGraphicsQuality('smooth'), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
