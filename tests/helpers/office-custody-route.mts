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
    const point = officeNextPoint(neo.position, target, 1.15, custody.phase === 'escorting' ? [] : bodies);
    if (!point) { input(); sample(); continue; }
    const dx = point.x - neo.position.x, dz = point.z - neo.position.z, length = Math.max(1, Math.hypot(dx, dz));
    input({ x: dx / length, z: dz / length, yaw: Math.atan2(dx, dz) }); sample();
  }
  assert.fail(`custody exit stalled: ${JSON.stringify({ neo: neo.position, custody: journey().office!.custody })}`);
}
