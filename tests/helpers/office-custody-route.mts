import assert from 'node:assert/strict';
import { officeCustodyHeld, officeCustodyTarget, type AgentState, type FilmJourney, type PlayerInput } from '@auto_matrix/shared';
import { officeNextPoint } from '../../packages/server/src/story/OfficeNavigation.js';

/** Follow all new escort stages with ordinary input; never assign actor positions. */
export function exitOfficeCustody(neo: AgentState, journey: () => FilmJourney, input: (values?: Partial<PlayerInput>) => void, command: (target: string) => unknown,
  sample: () => void = () => {}): void {
  for (let i = 0; i < 7000; i++) {
    const custody = journey().office!.custody!;
    if (custody.phase === 'outside') { input(); sample(); return; }
    if (custody.phase === 'ready') { command('act'); input(); sample(); continue; }
    const target = officeCustodyTarget(custody);
    if (!target || officeCustodyHeld(custody)) { input(); sample(); continue; }
    const bodies = [...Object.values(custody.bodies).map(body => body.position), ...(custody.courier ? [custody.courier.position] : [])];
    const point = officeNextPoint(neo.position, target, 1.15, custody.phase === 'escorting' ? [] : bodies, custody.street);
    if (!point) { input(); sample(); continue; }
    const dx = point.x - neo.position.x, dz = point.z - neo.position.z, length = Math.max(1, Math.hypot(dx, dz));
    input({ x: dx / length, z: dz / length, yaw: Math.atan2(dx, dz) }); sample();
  }
  assert.fail(`custody exit stalled: ${JSON.stringify({ neo: neo.position, custody: journey().office!.custody })}`);
}

/** Reach the street car through the same controller and confirmation gates as a player. */
export function boardOfficeArrest(neo: AgentState, journey: () => FilmJourney, input: (values?: Partial<PlayerInput>) => void, command: (target: string) => unknown,
  sample: () => void = () => {}): void {
  if (journey().office!.custody!.phase === 'outside') command('act');
  for (let i = 0; i < 5000; i++) {
    const custody = journey().office!.custody!;
    if (custody.street?.phase === 'done') { input(); sample(); return; }
    if (custody.street?.phase === 'ready') { command('act'); input(); sample(); continue; }
    const target = officeCustodyTarget(custody);
    const point = target && !officeCustodyHeld(custody) ? officeNextPoint(neo.position, target, 1.15, Object.values(custody.bodies).map(body => body.position), custody.street) : undefined;
    if (!point) { input(); sample(); continue; }
    const dx = point.x - neo.position.x, dz = point.z - neo.position.z, length = Math.max(1, Math.hypot(dx, dz));
    input({ x: dx / length, z: dz / length, yaw: Math.atan2(dx, dz) }); sample();
  }
  assert.fail(`street arrest stalled: ${JSON.stringify({ neo: neo.position, custody: journey().office!.custody })}`);
}

/** Remain a passenger until the real street departure reaches the scene cut. */
export function departOfficeArrest(journey: () => FilmJourney, input: (values?: Partial<PlayerInput>) => void, command: (target: string) => unknown): void {
  assert.equal(journey().office!.custody!.street!.phase, 'done'); command('act');
  for (let i = 0; i < 800 && journey().scene === 'm1_office_escape'; i++) input();
  assert.equal(journey().scene, 'm1_interrogation', `departure stalled: ${JSON.stringify(journey().office!.custody)}`);
}
