import { stepFreeway, type DriveInput, type FreewayRide } from '@auto_matrix/shared';

/** Select ordinary steering inputs for QA; never move or repair the saved bike. */
export function freewayDriveInput(ride: FreewayRide, target: number): DriveInput {
  return { throttle: 1, steer: Math.max(-1, Math.min(1, (target - ride.x) * .8 - ride.lateral * .35)), brake: false };
}

export function freewayAvoidanceTarget(ride: FreewayRide): number {
  let target = 10, best = Infinity;
  for (const candidate of [4.5, 9.6, 10.4, 17.6, 18.4, 25.5]) {
    let preview = ride;
    for (let frame = 0; frame < 60 && preview.phase === 'riding'; frame++) {
      preview = stepFreeway(preview, freewayDriveInput(preview, candidate), .05);
    }
    const score = (ride.hull - preview.hull) * 100 + (preview.z - ride.z) * .1 + Math.abs(candidate - ride.x) * .3;
    if (score < best) { best = score; target = candidate; }
  }
  return target;
}
