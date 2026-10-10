import { HAMMER_ROUTE, hammerCenter, type HammerFlight } from '@auto_matrix/shared';

/** Test driver using the same bounded thruster commands as a player. */
export function hammerPilotInput(flight: HammerFlight) {
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  if (flight.maneuver) {
    const distance = 175 - flight.z, maneuver = flight.maneuver;
    const bank = distance > 162 && distance < 280 ? Math.PI / 2 : 0;
    const x = distance > 162 && distance < 280 ? -1.5 : 0;
    const lift = distance < 112 ? 2 : distance > 290 ? -2.5 : 0;
    return { throttle: flight.speed < 23 ? 1 : 0, brake: false,
      steer: clamp((x - flight.x) * .6 - flight.lateral * .22),
      lift: clamp((lift - maneuver.lift) * .6 - maneuver.vertical * .22),
      roll: clamp((bank - maneuver.bank) * 2 - maneuver.bankVelocity * .6) };
  }
  let target = hammerCenter(flight.z - 12);
  for (const pipe of HAMMER_ROUTE.debris) if (flight.z < pipe.z + 28 && flight.z > pipe.z - 10)
    target += Math.sign(hammerCenter(pipe.z) - pipe.x) * 2;
  return { throttle: flight.speed < 28 ? 1 : 0, steer: clamp((target - flight.x) * .35 - flight.lateral * .12), brake: false };
}
