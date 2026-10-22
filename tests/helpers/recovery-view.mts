import * as THREE from 'three';
import type { TestContext } from 'node:test';
import { awakeningPose, cabinBodyPose, filmPosition, type AwakeningBeat } from '@auto_matrix/shared';
import { PlayerControls } from '../../packages/client/src/player/PlayerControls.js';
import { podPatient } from './pod-patient.mjs';

export type RecoveryBeat = AwakeningBeat & { kind: 'recovery' | 'cabin' };

export async function recoveryView(t: TestContext) {
  const h = await podPatient(t);
  class InputTarget extends EventTarget { matches() { return false; } }
  const previous = globalThis.window, window = new InputTarget(), canvas = new InputTarget(), document = new InputTarget();
  globalThis.window = window as unknown as Window & typeof globalThis;
  Object.assign(globalThis.document, { pointerLockElement: canvas, hidden: false, exitPointerLock() {},
    addEventListener: document.addEventListener.bind(document), removeEventListener: document.removeEventListener.bind(document) });
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, .5, 5000);
  const controls = new PlayerControls(canvas as unknown as HTMLCanvasElement, camera, () => {}, () => {});
  h.neo.currentLocation = 'film_neb_deck'; h.neo.isInMatrix = false; h.neo.isAwakened = true;
  const initial = awakeningPose({ kind: 'recovery', elapsed: 0, started: false });
  h.neo.position = filmPosition('film_neb_deck', initial.x, initial.z); h.neo.position.y += initial.y;
  h.neo.rotation = Math.PI;
  let state = { ...h.neo, position: { ...h.neo.position } }, lastBeat = '';
  controls.possess(state);
  const group = h.renderer.getAgent('neo')!;
  const frame = (beat: RecoveryBeat) => {
    const pose = awakeningPose(beat), cabin = beat.kind === 'cabin' ? cabinBodyPose(beat.elapsed) : undefined;
    h.neo.position = filmPosition('film_neb_deck', pose.x, pose.z); h.neo.position.y += pose.y;
    h.neo.rotation = cabin?.yaw ?? Math.PI;
    h.neo.currentAction = { type: 'idle', parameters: { player: true, resolved: true, filmPose: pose.pose,
      recovery: cabin?.clock ?? Math.min(6.8, beat.elapsed), cabin: cabin ? { kind: 'wake', elapsed: beat.elapsed, role: 'neo' } : undefined },
      startedAt: 0, duration: 1, progress: 0 };
    // main.ts replaces received agent snapshots; unchanged paused frames reuse one.
    const key = JSON.stringify(beat);
    if (key !== lastBeat) { state = { ...h.neo, position: { ...h.neo.position } }; lastBeat = key; }
    h.renderer.updateAgent('neo', state);
    controls.performing = true;
    controls.update(1 / 60, state, group, false);
    h.renderer.setPlayer('neo', controls.firstPerson); h.renderer.setPlayerMotion(controls.motion); h.renderer.setWorld(false);
    // Match Engine: controls first, current delivered actor pose next, then eye resampling.
    h.renderer.update(0, camera, 0);
    // The renderer refreshes attached skinned bind inverses before drawing.
    group.updateWorldMatrix(true, false); group.updateMatrixWorld(true);
    const sync = controls as PlayerControls & { syncRecoveryCamera?: (group: THREE.Group) => void };
    sync.syncRecoveryCamera?.(group);
    camera.updateMatrixWorld(true);
    return h.rig.bones.get('head')!;
  };
  const toggle = () => window.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyV', repeat: false }));
  const dispose = () => { controls.dispose(); globalThis.window = previous; };
  return { ...h, controls, camera, document, group, frame, toggle, dispose };
}
