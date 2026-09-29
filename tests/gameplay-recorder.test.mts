import assert from 'node:assert/strict';
import test from 'node:test';
import { GameplayRecorder } from '../packages/client/src/player/GameplayRecorder.js';

test('recorded scene fades preserve the visible opacity instead of restarting the blackout animation', async t => {
  const previous = { document: globalThis.document, Image: globalThis.Image, XMLSerializer: globalThis.XMLSerializer, getComputedStyle: globalThis.getComputedStyle };
  t.after(() => Object.assign(globalThis, previous));
  const blackout = { id: 'film-blackout', style: { opacity: '0' } };
  let copiedBlackout: { style: Record<string, string> };
  const source = {
    id: 'sandbox-overlay', tagName: 'DIV',
    querySelectorAll: (selector: string) => selector === '*' ? [blackout] : [],
    cloneNode: () => {
      copiedBlackout = { style: { ...blackout.style } };
      return { querySelectorAll: (selector: string) => selector === '*' ? [copiedBlackout] : [] };
    },
  };
  let opacity = '.6'; const transform = 'matrix(1.03, 0, 0, 1.03, 0, 0)';
  globalThis.document = {
    body: { className: '', children: [source] }, styleSheets: [],
    createElement: () => ({ style: {}, appendChild() {} }),
  } as unknown as Document;
  globalThis.Image = class { src = ''; async decode() {} } as unknown as typeof Image;
  globalThis.XMLSerializer = class { serializeToString() { return '<div></div>'; } } as unknown as typeof XMLSerializer;
  globalThis.getComputedStyle = element => {
    assert.equal(element, blackout); return { opacity, transform } as CSSStyleDeclaration;
  };
  const recorder = Object.assign(Object.create(GameplayRecorder.prototype), { canvas: { width: 449, height: 680 } });
  for (opacity of ['.6', '0']) {
    await recorder.captureUI();
    assert.equal(copiedBlackout!.style.opacity, opacity, 'mid-fade and fully revealed frames must match the visible game');
    assert.equal(copiedBlackout!.style.transform, transform, 'the Construct-to-desert zoom must keep its current scale');
    assert.equal(copiedBlackout!.style.animation, 'none', 'SVG snapshots must not restart pod-reveal from opaque black');
    assert.equal(copiedBlackout!.style.transition, 'none');
    assert.deepEqual(blackout.style, { opacity: '0' }, 'capturing must not change the live scene transition');
  }
});
