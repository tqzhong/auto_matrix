import { TRUCK_ROAD, truthRoot, truckRescuePose, FREEWAY_HANDOFF, truckHoodBack, MOBIL_STATION, trainmanVaultLift } from '@auto_matrix/shared';
import { trinityRelaySeat, cabinSeat, constructGuidePose, podRescuePose, reloadedPose, type CatchGesture, type ReloadedGesture } from '@auto_matrix/shared';
import { deusPactLocked, deusPactPose, farewellPose, smithFinaleLocked, smithFinalePose, trilogyEpilogueLocked } from '@auto_matrix/shared';
import { mirrorEntryPose } from '@auto_matrix/shared';
import { HEL_DOOR_PUSH, helDanceDoorGrip } from '@auto_matrix/shared';
import { hammerHandoverPose } from '@auto_matrix/shared';
import { MELEE_COMBO, COMBO_WINDOW, COMBAT_SKILLS, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, PILL_TIMING, MIRROR_TIMING, lobbyPose, governmentPose, airRescuePose, matrixEscapePose, theOnePose, recoveryCrewPose, type CombatSkillId, type AwakeningPose, type AwakeningReveal, type RecoveryCrewGesture, type OfficePhone, pillPose, lafayetteWelcomePose, oracleVisitPose, betrayalPose, rescuePose, type PillGesture, type InterrogationGesture, type LafayetteWelcomeGesture, type TrainingGesture, type OracleVisitGesture, type BetrayalGesture, type RescueGesture, type RescueLoadout, type LobbyGesture, type GovernmentRescueGesture, type AirRescueGesture, type MatrixEscapeGesture, type TheOneGesture } from '@auto_matrix/shared';

export interface MotionInput {
  speed: number;
  grounded: boolean;
  verticalVelocity: number;
  turn: number;
  attack?: number;
  combo?: number;
  hit?: number;
  impact?: number;
  windingUp?: boolean;
  cast?: number;
  skill?: CombatSkillId;
  armed?: boolean;
  ambushEscort?: import('@auto_matrix/shared').AmbushEscort;
  wetwall?: import('@auto_matrix/shared').WetwallGesture;
  sixth?: import('@auto_matrix/shared').SixthGesture;
  bathroom?: import('@auto_matrix/shared').BathroomGesture;
  basement?: import('@auto_matrix/shared').BasementGesture;
  basementGas?: import('@auto_matrix/shared').BasementLauncherGesture;
  tvExit?: import('@auto_matrix/shared').TvExitGesture;
  crosscut?: import('@auto_matrix/shared').CrosscutGesture;
  shot?: number;
  crouching?: boolean;
  seated?: boolean;
  sourceBriefing?: import('@auto_matrix/shared').SourceBriefingGesture;
  trinityRelay?: import('@auto_matrix/shared').TrinityRelayGesture;
  trinityTerminal?: import('@auto_matrix/shared').TrinityTerminal;
  sourcePortal?: import('@auto_matrix/shared').SourcePortalGesture;
  architect?: import('@auto_matrix/shared').ArchitectGesture;
  primaryDemolition?: import('@auto_matrix/shared').PrimaryDemolition;
  floorSeated?: boolean;
  riding?: boolean;
  freewayPickup?: import('@auto_matrix/shared').FreewayPickup & { role: 'trinity' | 'keymaker'; walking: number };
  freewayDriver?: import('@auto_matrix/shared').FreewayPickup;
  freewayHandoff?: import('@auto_matrix/shared').FreewayHandoff & { role: import('@auto_matrix/shared').FreewayHandoffRole };
  freewayRide?: import('@auto_matrix/shared').FreewayRide & { role: 'trinity' | 'keymaker' };
  climbing?: number;
  performance?: AwakeningPose;
  podWake?: number;
  podBreather?: number;
  podRescue?: number;
  mirrorBeat?: number;
  mirrorEntry?: import('@auto_matrix/shared').AwakeningBeat;
  mirrorRise?: number;
  mirrorCrew?: number;
  mirrorContact?: { x: number; y: number; z: number };
  recovery?: number;
  recoveryCrew?: RecoveryCrewGesture;
  medical?: number;
  cabin?: import('@auto_matrix/shared').CabinGesture;
  truth?: import('@auto_matrix/shared').TruthGesture;
  download?: import('@auto_matrix/shared').DownloadGesture;
  construct?: import('@auto_matrix/shared').ConstructGesture;
  reveal?: AwakeningReveal;
  training?: TrainingGesture;
  workday?: import('@auto_matrix/shared').OfficeWorkdayGesture;
  contact?: import('@auto_matrix/shared').ApartmentGesture;
  homeClothes?: boolean;
  computerCheck?: import('@auto_matrix/shared').ComputerInvestigation;
  wakeCall?: import('@auto_matrix/shared').WakeCall;
  morning?: import('@auto_matrix/shared').MorningRoutine;
  firstPerson?: boolean;
  club?: import('@auto_matrix/shared').ClubGesture;
  sentinel?: import('@auto_matrix/shared').SentinelGesture;
  interlude?: import('@auto_matrix/shared').InterludeGesture;
  oracleVisit?: OracleVisitGesture;
  oracleArrival?: import('@auto_matrix/shared').OracleArrivalGesture;
  oracleDeparture?: import('@auto_matrix/shared').OracleDepartureGesture;
  oracleReception?: import('@auto_matrix/shared').OracleReceptionGesture;
  oracleWaiting?: import('@auto_matrix/shared').OracleWaitingGesture;
  oracleRestored?: boolean;
  oracleRevolutions?: boolean;
  oracleRequest?: import('@auto_matrix/shared').OracleRequestGesture;
  oracleLast?: import('@auto_matrix/shared').OracleLastGesture;
  baneInquiry?: import('@auto_matrix/shared').BaneInquiryGesture;
  hammerBriefing?: import('@auto_matrix/shared').HammerBriefingGesture;
  hammerPilot?: import('@auto_matrix/shared').HammerPilotGesture;
  zionDeployment?: import('@auto_matrix/shared').ZionDeploymentGesture;
  maggieDiscovery?: import('@auto_matrix/shared').MaggieDiscoveryGesture;
  logosBane?: import('@auto_matrix/shared').LogosBaneGesture;
  oracleAbsorption?: import('@auto_matrix/shared').OracleAbsorptionGesture;
  trainmanChase?: import('@auto_matrix/shared').TrainmanChaseGesture;
  helGarage?: import('@auto_matrix/shared').HelGarageGesture;
  helElevator?: import('@auto_matrix/shared').HelElevatorGesture;
  helDoorPush?: import('@auto_matrix/shared').HelDanceDoorEncounter;
  helDisarm?: import('@auto_matrix/shared').HelDisarmGesture;
  helBreakout?: import('@auto_matrix/shared').HelBreakoutGesture;
  betrayal?: BetrayalGesture;
  rescue?: RescueGesture;
  lobbyEntry?: LobbyGesture;
  government?: GovernmentRescueGesture;
  airRescue?: AirRescueGesture;
  matrixEscape?: MatrixEscapeGesture;
  theOne?: TheOneGesture;
  reloaded?: ReloadedGesture;
  catch?: CatchGesture;
  hotel303?: { phase: 'surrender' | 'dive'; elapsed: number };
  openingRoofLeap?: number;
  burly?: import('@auto_matrix/shared').BurlyEncounter & { role: 'neo' | 'smith' };
  chateauWeapon?: import('@auto_matrix/shared').ChateauWeapon;
  mountainFlight?: import('@auto_matrix/shared').MountainFlight;
  truckFlight?: boolean;
  truckPassenger?: boolean;
  truckRoad?: import('@auto_matrix/shared').TruckRoad & { role: string };
  truckWeapons?: import('@auto_matrix/shared').TruckWeaponGesture;
  truckHood?: import('@auto_matrix/shared').TruckHoodGesture;
  truckRescue?: import('@auto_matrix/shared').TruckEncounter & { role: import('@auto_matrix/shared').TruckRescueRole };
  persephone?: import('@auto_matrix/shared').PersephoneEncounter & { role: 'neo' | 'persephone' };
  farewell?: import('@auto_matrix/shared').FarewellGesture;
  farewellOutfit?: 'neo' | 'trinity';
  nebCrew?: import('@auto_matrix/shared').NebCrewRole;
  signal?: import('@auto_matrix/shared').TunnelEncounter;
  deusPact?: import('@auto_matrix/shared').DeusPactGesture;
  smithFinale?: import('@auto_matrix/shared').SmithFinaleGesture;
  epilogue?: import('@auto_matrix/shared').TrilogyEpilogueGesture;
  diggers?: import('@auto_matrix/shared').DiggerGesture;
  upperDigger?: import('@auto_matrix/shared').UpperDiggerGesture;
  dockReload?: import('@auto_matrix/shared').DockReloadGesture;
  dockLastStand?: import('@auto_matrix/shared').DockLastStandGesture;
  dockGate?: import('@auto_matrix/shared').DockGate;
  dockGunnery?: { yaw: number; pitch: number };
  apuDriving?: boolean;
  dockEmp?: number;
  empOperator?: import('@auto_matrix/shared').EmpOperator;
  dockReunion?: import('@auto_matrix/shared').DockReunionGesture;
  dockDeparture?: import('@auto_matrix/shared').DockDepartureGesture;
  dockBriefing?: import('@auto_matrix/shared').DockBriefingGesture;
  dockEvacuation?: import('@auto_matrix/shared').DockEvacuationGesture;
  shaftSeal?: import('@auto_matrix/shared').ShaftSealGesture;
  templeDefense?: import('@auto_matrix/shared').TempleDefenseGesture;
  dockGateCover?: import('@auto_matrix/shared').DockGate;
  parkOutfit?: boolean;
  weaponStyle?: RescueLoadout | 'hel_pistol' | 'gas_launcher' | 'revolver';
  helDanceDoor?: number;
  aimPitch?: number;
  clubClothes?: boolean;
  mirror?: number;
  spoon?: number;
  spoonLesson?: import('@auto_matrix/shared').SpoonGesture;
  phone?: OfficePhone;
  officeCustody?: import('@auto_matrix/shared').OfficeCustodyGesture;
  window?: number;
  crossing?: number;
  pills?: PillGesture;
  interrogation?: InterrogationGesture;
  meeting?: import('@auto_matrix/shared').MeetingGesture;
  welcome?: LafayetteWelcomeGesture;
  knock?: number;
  officeShirt?: boolean;
  inspecting?: boolean;
  vase?: number;
  realWorld?: boolean;
  glasses?: boolean;
  mobilStation?: boolean;
  mobilSeat?: number;
  mobilRefusal?: { role: 'neo' | 'trainman'; elapsed: number };
  mobilFamily?: import('@auto_matrix/shared').MobilFamilyGesture;
  mobilLuggage?: import('@auto_matrix/shared').MobilLuggageGesture;
  mobilReunion?: import('@auto_matrix/shared').MobilReunionGesture;
}

export interface MotionState {
  time: number;
  phase: number;
  speed: number;
  turn: number;
  airborne: number;
  wasGrounded: boolean;
  landing: number;
  attackId?: number;
  attackAge: number;
  combo: number;
  hitId?: number;
  impactId?: number;
  hitAge: number;
  hitPause: number;
  verticalVelocity: number;
  castId?: number;
  skill?: CombatSkillId;
  skillAge: number;
  shotId?: number;
  shotAge: number;
  seated: number;
  climbPhase: number;
}

export const newMotion = (): MotionState => ({ time: 0, phase: 0, speed: 0, turn: 0, airborne: 0, wasGrounded: true, landing: 0, attackAge: 10, combo: 0, hitAge: 10, hitPause: 0, verticalVelocity: 0, skillAge: 10, shotAge: 10, seated: 0, climbPhase: 0 });
const clamp = (x: number, low = 0, high = 1) => Math.min(high, Math.max(low, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => x * x * (3 - 2 * x);

// The planted foot moves backwards at the travelled speed. The return stroke
// lifts it off the ground, instead of rotating both legs like pendulums.
export function footTrajectory(phase: number, stride: number, stance: number): { z: number; lift: number; planted: boolean } {
  const p = ((phase % 1) + 1) % 1;
  if (p < stance) return { z: stride * (1 - 2 * p / stance), lift: 0, planted: true };
  const t = (p - stance) / (1 - stance);
  return { z: mix(-stride, stride, smooth(t)), lift: Math.sin(t * Math.PI), planted: false };
}

export function solveLeg(z: number, height: number): { hip: number; knee: number; ankle: number } {
  const upper = .94; const lower = .9;
  const reach = clamp(Math.hypot(z, height), .15, upper + lower - .002);
  const knee = Math.PI - Math.acos(clamp((upper * upper + lower * lower - reach * reach) / (2 * upper * lower), -1, 1));
  const hip = -Math.atan2(z, height) - Math.acos(clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach), -1, 1));
  return { hip, knee, ankle: -hip - knee };
}

export function advanceMotion(state: MotionState, input: MotionInput, delta: number) {
  if (input.hammerPilot) {
    const gesture = input.hammerPilot, handover = gesture.handover && gesture.role !== 'roland' ? hammerHandoverPose(gesture.handover, gesture.role) : undefined;
    const seated = handover ? handover.sitting > .5 : gesture.role !== 'roland';
    Object.assign(state, newMotion(), { time: gesture.handover?.elapsed ?? gesture.flight.elapsed, seated: seated ? 1 : 0 });
    return { legs: [0, 1].map(() => solveLeg(seated ? 1.05 : 0, seated ? 1.27 : 1.82)),
      arms: [0, 1].map(i => ({ shoulder: -.7, elbow: -.8, outward: (i ? 1 : -1) * .12, grip: .8 })),
      hipHeight: seated ? 1.43 : 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.helDisarm || input.helBreakout) {
    Object.assign(state, newMotion(), { time: input.helDisarm?.elapsed ?? input.helBreakout!.elapsed });
    return { legs: [0, 1].map(() => ({ hip: 0, knee: 0, ankle: 0 })),
      arms: [0, 1].map(i => ({ shoulder: -.04, elbow: -.2, outward: (i ? 1 : -1) * .12, grip: .1 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.helDoorPush) {
    const door = input.helDoorPush, grip = helDanceDoorGrip(door), moving = door.elapsed < HEL_DOOR_PUSH.approach
      ? Math.sin(Math.PI * door.elapsed / HEL_DOOR_PUSH.approach) * .65 : 0, cycle = door.elapsed / HEL_DOOR_PUSH.approach;
    Object.assign(state, newMotion(), { time: door.elapsed, phase: cycle });
    return { legs: [0, 1].map(i => { const foot = footTrajectory(cycle + i * .5, .4 * moving, .57);
      return solveLeg(foot.z + (i ? -.1 : .1) * grip, 1.82 - foot.lift * .2 * moving); }),
      arms: [0, 1].map(i => ({ shoulder: -.04 - Math.sin((cycle + i * .5) * Math.PI * 2) * moving * .35,
        elbow: -.2, outward: (i ? 1 : -1) * .12, grip: 0 })),
      hipHeight: 1.98, twist: 0, lean: grip * .12 + moving * .08, sway: 0, lunge: 0, roll: 0,
      headTurn: 0, moving, run: 0, airborne: 0, coat: moving * .3, impact: 0, landing: 0 };
  }
  if (input.helElevator) {
    const h = input.helElevator, walk = h.role === 'trinity' && h.phase === 'descending' && h.elapsed > .85 && h.elapsed < 2.1;
    const moving = walk ? .65 : 0, cycle = h.elapsed * 2;
    Object.assign(state, newMotion(), { time: h.elapsed, phase: cycle });
    return { legs: [0, 1].map(i => {
      const foot = footTrajectory(cycle + i * .5, .36 * moving, .57);
      return solveLeg(foot.z, 1.82 - foot.lift * .2 * moving);
    }), arms: [0, 1].map(i => ({ shoulder: -.04 - Math.sin((cycle + i * .5) * Math.PI * 2) * moving * .35,
      elbow: -.2, outward: (i ? 1 : -1) * .12, grip: .12 })),
      hipHeight: 1.98, twist: 0, lean: moving * .08, sway: 0, lunge: 0, roll: 0,
      headTurn: h.role === 'seraph' && h.phase === 'descending' ? -.2 : 0, moving, run: 0, airborne: 0, coat: moving * .3, impact: 0, landing: 0 };
  }
  if (input.helGarage) {
    const h = input.helGarage, guard = h.role === 'guard';
    const relaxed = ['ready', 'talking'].includes(h.phase) || !guard && h.phase === 'opening' && (h.role !== 'trinity' || h.door >= .24);
    const free = ['ready', 'cleared', 'exit', 'done'].includes(h.phase) && !guard;
    const moving = free || h.phase === 'talking' ? clamp(input.speed / PLAYER_WALK_SPEED) : 0;
    const cycle = h.age * input.speed / 4.2, strike = h.phase === 'striking' ? Math.sin(Math.PI * clamp(h.elapsed / .85)) : 0;
    const fall = h.phase === 'falling' ? smooth(clamp(h.elapsed / 1.5)) : ['cleared', 'opening', 'exit', 'done'].includes(h.phase) ? 1 : 0;
    Object.assign(state, newMotion(), { time: h.age, phase: cycle, speed: input.speed });
    return { legs: [0, 1].map(i => {
      const foot = footTrajectory(cycle + i * .5, .48 * moving, .57);
      return solveLeg(foot.z + (free ? 0 : i ? -.25 : .27), 1.82 - foot.lift * .25 * moving - (free ? 0 : .1));
    }), arms: [0, 1].map(i => ({ shoulder: relaxed ? -.05 - Math.sin((cycle + i * .5) * Math.PI * 2) * moving * .4 : -.3 - (free ? Math.sin((cycle + i * .5) * Math.PI * 2) * moving * .5 : .75),
      elbow: relaxed ? -.2 - moving * .4 : free ? -.35 - moving * .6 : -1, outward: (i ? 1 : -1) * .16, grip: free || relaxed ? .15 : .8 })),
      hipHeight: 1.98 - (free ? 0 : .1), twist: guard ? strike * -.16 : strike * (h.hits % 2 ? -.24 : .24),
      lean: moving * .12 + (guard ? -strike * .22 - fall * .1 : strike * .15), sway: 0, lunge: 0, roll: 0,
      headTurn: 0, moving, run: clamp(input.speed / PLAYER_RUN_SPEED), airborne: 0, coat: moving * .45 + strike * .15, impact: 0, landing: 0 };
  }
  if (input.trainmanChase) {
    const chase = input.trainmanChase, seated = chase.role === 'trainman' ? chase.phase === 'ready' ? 1 : chase.phase === 'confronting' ? 1 - smooth(clamp(chase.elapsed / 1.4)) : 0 : 0;
    const vault = chase.vault === undefined ? 0 : Math.sin(Math.PI * chase.vault), brace = chase.bracing ? Math.sin(clamp(chase.elapsed / 3.2) * Math.PI) : 0;
    const plant = chase.vault === undefined ? 0 : smooth(clamp(chase.vault / .22)) * (1 - smooth(clamp((chase.vault - .28) / .4)));
    const air = chase.vault === undefined ? 0 : trainmanVaultLift(chase.vault) / 2.3;
    const dodge = chase.dodging === undefined ? 0 : Math.sin(Math.PI * clamp(chase.dodging));
    const moving = seated || chase.vault !== undefined || chase.bracing ? 0 : clamp(input.speed / PLAYER_WALK_SPEED), cycle = (chase.stride ?? chase.age * input.speed) / 4.2;
    const hipHeight = 1.98 - seated * .53 - vault * .4 - plant * .5 - brace * .15 - dodge * .65;
    Object.assign(state, newMotion(), { time: chase.age, phase: cycle, speed: input.speed, seated });
    return { legs: [0, 1].map(i => {
      const foot = footTrajectory(cycle + i * .5, .48 * moving, .57);
      return solveLeg(seated ? .98 : foot.z - plant * .35 - air * (i ? .55 : .3), hipHeight - .16 - foot.lift * .3 * moving - air * .55);
    }), arms: [0, 1].map(i => ({ shoulder: seated ? -.36 : -Math.sin((cycle + i * .5) * Math.PI * 2) * moving * .5 - vault * (i ? -.65 : 1.5) - brace * 1.7,
      elbow: seated ? -.95 : -.35 - moving * .6 - vault * .4, outward: (i ? 1 : -1) * (.12 + vault * .18), grip: brace ? .85 : .12 })),
      hipHeight, twist: 0, lean: moving * .14 + brace * .16 + vault * .4, sway: dodge * .6, lunge: 0, roll: dodge * -.2,
      headTurn: 0, moving, run: clamp(input.speed / PLAYER_RUN_SPEED), airborne: vault, coat: moving * .6 + vault * .4, impact: 0, landing: 0 };
  }
  if (input.mobilLuggage && (input.mobilLuggage.luggage.phase === 'lifting'
    || input.mobilLuggage.role === 'rama_kandra' && input.mobilLuggage.luggage.phase === 'retrieving' && input.mobilLuggage.luggage.elapsed >= (input.mobilLuggage.luggage.walk ?? .7))) {
    Object.assign(state, newMotion());
    return { legs: [0, 1].map(() => ({ hip: 0, knee: 0, ankle: 0 })),
      arms: [0, 1].map(i => ({ shoulder: .03, elbow: .08, outward: (i ? 1 : -1) * .14, grip: 0 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.mobilStation && (input.seated || input.mobilSeat !== undefined && (input.mobilSeat > 0 || input.speed === 0))) {
    const seated = input.mobilSeat ?? 1, hipHeight = mix(1.98, MOBIL_STATION.bench.seat + .2, seated);
    Object.assign(state, newMotion(), { seated });
    return { legs: [0, 1].map(() => solveLeg(.75 * seated, hipHeight - .16)),
      arms: [0, 1].map(i => ({ shoulder: -.43 * seated, elbow: -.82 * seated, outward: (i ? 1 : -1) * .12, grip: .05 })),
      hipHeight, twist: 0, lean: Math.sin(seated * Math.PI) * .16, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.baneInquiry) {
    Object.assign(state, newMotion(), { time: input.baneInquiry.elapsed });
    return { legs: [0, 1].map(() => ({ hip: 0, knee: 0, ankle: 0 })),
      arms: [0, 1].map(i => ({ shoulder: 0, elbow: 0, outward: (i ? 1 : -1) * .12, grip: 0 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.hammerBriefing) {
    const walking = input.hammerBriefing.role === 'trinity' && input.hammerBriefing.phase === 'leaving' ? Math.min(1, input.speed / 3) : 0;
    const cycle = input.hammerBriefing.elapsed * .72;
    Object.assign(state, newMotion(), { time: input.hammerBriefing.elapsed, phase: cycle });
    return { legs: [0, 1].map(i => { const foot = footTrajectory(cycle + i * .5, walking * .7, .32); return solveLeg(foot.z, 1.98 - foot.lift * walking); }),
      arms: [0, 1].map(i => ({ shoulder: Math.sin((cycle + i * .5) * Math.PI * 2) * walking * .22, elbow: -.16 * walking, outward: (i ? 1 : -1) * .12, grip: 0 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: walking, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.oracleAbsorption) {
    const h = input.oracleAbsorption, moving = h.role === 'sati' || h.role === 'seraph' ? h.escape > 0 && h.escape < 23
      : h.role === 'oracle' ? h.escape > 24 && h.escape < 27
        : h.invasion > 0 && h.invasion < 14 || h.invasion > 18.2 && h.invasion < 20.7 || h.invasion > 22.4 && h.invasion < 25.4;
    const clock = h.farewell + h.escape + h.invasion + h.elapsed, cycle = clock * .38;
    Object.assign(state, newMotion(), { time: clock, phase: cycle });
    return { legs: [0, 1].map(i => { const foot = footTrajectory(cycle + i * .5, moving ? .55 : 0, .57); return solveLeg(foot.z, 1.86 - (moving ? foot.lift * .06 : 0)); }),
      arms: [0, 1].map(i => ({ shoulder: -.05, elbow: -.2, outward: (i ? 1 : -1) * .14, grip: .12 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: moving ? .35 : 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.oracleLast) {
    const h = input.oracleLast, walking = h.role === 'sati' ? h.arrival > 5 && h.arrival < 28
      : h.role === 'oracle' && (h.arrival > 4 && h.arrival < 8.8 || h.arrival > 12.8 && h.arrival < 17.6);
    const moving = walking ? .3 : 0, cycle = h.arrival * .32;
    Object.assign(state, newMotion(), { time: h.arrival + h.elapsed, phase: cycle });
    return { legs: [0, 1].map(i => {
      const foot = footTrajectory(cycle + i * .5, .48 * moving, .57);
      return solveLeg(foot.z, 1.86 - foot.lift * .14 * moving);
    }), arms: [0, 1].map(i => ({ shoulder: -.05, elbow: -.2, outward: (i ? 1 : -1) * .14, grip: .15 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.mobilRefusal || input.mobilFamily && !input.seated || input.mobilReunion?.reunion.phase === 'embracing') {
    Object.assign(state, newMotion(), { time: input.mobilRefusal?.elapsed ?? input.mobilReunion?.reunion.elapsed ?? input.mobilFamily!.elapsed });
    return { legs: [0, 1].map(() => ({ hip: 0, knee: 0, ankle: 0 })),
      arms: [0, 1].map(i => ({ shoulder: .03, elbow: .08, outward: (i ? 1 : -1) * .14, grip: 0 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.signal) {
    Object.assign(state, newMotion(), { time: input.signal.age ?? 0 });
    return { legs: [0, 1].map(() => ({ hip: 0, knee: 0, ankle: 0 })),
      arms: [0, 1].map(i => ({ shoulder: .03, elbow: .08, outward: (i ? 1 : -1) * .14, grip: 0 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  let dt = clamp(delta, 0, .1);
  if (input.primaryDemolition?.blast && ['countdown', 'blast'].includes(input.primaryDemolition.blast.phase)) {
    const blast = input.primaryDemolition.blast;
    Object.assign(state, newMotion(), { time: blast.elapsed });
    const brace = blast.phase === 'blast' ? Math.sin(Math.min(1, blast.elapsed / 1.5) * Math.PI) * .08 : 0;
    return { legs: [0, 1].map(() => ({ hip: -.025, knee: .055, ankle: -.03 })),
      arms: [0, 1].map(i => ({ shoulder: -.08 - brace, elbow: -.2, outward: (i ? 1 : -1) * .1, grip: .08 })),
      hipHeight: 1.98, twist: 0, lean: brace, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.primaryDemolition?.phase === 'mounting') {
    Object.assign(state, newMotion(), { time: input.primaryDemolition.elapsed });
    return { legs: [0, 1].map(() => ({ hip: -.025, knee: .055, ankle: -.03 })),
      arms: [0, 1].map(i => ({ shoulder: -.5, elbow: -.8, outward: (i ? 1 : -1) * .13, grip: .12 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.architect) {
    const seated = input.architect.role === 'architect';
    Object.assign(state, newMotion(), { time: input.architect.elapsed, seated: seated ? 1 : 0 });
    return { legs: [0, 1].map(() => ({ hip: 0, knee: .1, ankle: 0 })),
      arms: [0, 1].map(i => ({ shoulder: -.15, elbow: -.32, outward: (i ? 1 : -1) * .12, grip: .08 })),
      hipHeight: seated ? 1.48 : 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.sourcePortal) {
    const s = input.sourcePortal, stride = s.phase === 'escaping' ? Math.sin(s.elapsed * 10) * .55 : 0;
    Object.assign(state, newMotion(), { time: s.elapsed });
    return { legs: [0, 1].map(i => ({ hip: (i ? 1 : -1) * stride, knee: .16 + Math.abs(stride), ankle: -.08 })),
      arms: [0, 1].map(i => ({ shoulder: -.4 + (i ? 1 : -1) * stride, elbow: -.7, outward: (i ? 1 : -1) * .15, grip: .1 })),
      hipHeight: 1.98, twist: 0, lean: s.phase === 'escaping' ? .2 : 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: stride ? 1 : 0, run: stride ? .6 : 0, airborne: 0, coat: .1, impact: 0, landing: 0 };
  }
  if (input.trinityTerminal) {
    Object.assign(state, newMotion(), { time: input.trinityTerminal.elapsed });
    return { legs: [0, 1].map(() => ({ hip: -.025, knee: .055, ankle: -.03 })),
      arms: [0, 1].map(i => ({ shoulder: -.5, elbow: -.7, outward: (i ? 1 : -1) * .1, grip: .08 })),
      hipHeight: 1.98, twist: 0, lean: .14, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.trinityRelay && (input.trinityRelay.role === 'trinity' || input.trinityRelay.phase !== 'connecting' || input.trinityRelay.elapsed < 1.6 || input.trinityRelay.elapsed > 13.2)) {
    const relay = input.trinityRelay, seated = trinityRelaySeat(relay);
    Object.assign(state, newMotion(), { time: relay.elapsed, seated });
    return { legs: [0, 1].map(() => ({ hip: -.025 - seated * 1.175, knee: .055 + seated * 1.245, ankle: -.03 - seated * .07 })),
      arms: [0, 1].map(i => ({ shoulder: .05 - seated * .37, elbow: -.13 - seated * .97, outward: (i ? 1 : -1) * .16, grip: .1 })),
      hipHeight: 1.98 - seated * .6, twist: 0, lean: seated * -.12, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.sourceBriefing) {
    const briefing = input.sourceBriefing, seated = briefing.role === 'keymaker';
    Object.assign(state, newMotion(), { time: briefing.elapsed, seated: seated ? 1 : 0 });
    const speaking = !briefing.paused && !briefing.unavailable && (briefing.phase === 'hearing' && seated
      || briefing.phase === 'captains' && (briefing.elapsed < 4 ? briefing.role === 'keymaker' : briefing.elapsed < 8 ? briefing.role === 'morpheus' : briefing.role === 'niobe'));
    const beat = speaking ? .5 + .5 * Math.sin(briefing.elapsed * 1.7) : 0;
    return { legs: [0, 1].map(() => ({ hip: seated ? -1.2 : -.025, knee: seated ? 1.3 : .055, ankle: seated ? -.1 : -.03 })),
      arms: [0, 1].map(i => ({ shoulder: seated ? -.32 - beat * .16 : .05 - (i ? 0 : beat * .5), elbow: seated ? -1.1 : -.13 - (i ? 0 : beat * .45),
        outward: (i ? 1 : -1) * (seated ? .16 : .09 + (i ? 0 : beat * .05)), grip: .1 })),
      hipHeight: seated ? 1.38 : 1.98, twist: 0, lean: seated ? .02 : beat * .015, sway: 0, lunge: 0, roll: 0,
      headTurn: seated ? Math.sin(briefing.elapsed * .6) * .025 : beat * .018, moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.truckHood) {
    const h = input.truckHood, driver = h.role === 'niobe' || h.role === 'ghost', morpheus = h.role === 'morpheus';
    Object.assign(state, newMotion(), { time: h.total, seated: driver ? 1 : 0 });
    const back = morpheus ? truckHoodBack(h) : 0;
    const braced = morpheus && h.phase === 'impact' ? 1 - back : morpheus && h.phase === 'hood' ? 1 : morpheus && h.phase === 'passing' ? 1 - clamp(h.elapsed / .7) : 0;
    const crouch = braced * 1.58 + (morpheus && h.phase === 'running' ? .35 : 0) + (morpheus && h.phase === 'landing' ? .6 * (1 - clamp(h.elapsed / .55)) : 0);
    const flight = morpheus && h.phase === 'flight' ? 1 : 0, kick = flight * clamp((h.elapsed - .9) / .6);
    const falling = morpheus && ['falling', 'slipping'].includes(h.phase) ? 1 : 0;
    const stride = morpheus && h.phase === 'running' ? Math.sin(h.elapsed / .44 * Math.PI * 2) : 0;
    return { legs: [0, 1].map(i => driver ? solveLeg(.9, .25) : ({ hip: -.2 - (i ? .3 : 1.2) * kick,
        knee: .4 + (i ? 1.2 : -.3) * kick + crouch, ankle: -.2 })),
      arms: [0, 1].map(i => ({ shoulder: driver ? -.9 : -.5 - falling * .65 - flight * .6 + (i ? -1 : 1) * stride * .5, elbow: driver ? -.8 : -.8,
        outward: (i ? 1 : -1) * (falling || flight || back ? .9 : .25), grip: driver ? .8 : braced || falling ? .04 : .15 })),
      hipHeight: driver ? .52 : 1.98 - crouch, twist: 0, lean: driver ? .12 : braced * 1.6 + (crouch - braced * 1.58) * .65 + flight * -.3,
      sway: 0, lunge: 0, roll: morpheus && h.phase === 'kick' ? -.3 * Math.sin(Math.PI * clamp(h.elapsed / .75)) : 0,
      headTurn: 0, moving: 0, run: 0, airborne: flight || falling, coat: flight || falling, impact: crouch, landing: crouch };
  }
  if (input.truckRoad?.role === 'niobe') {
    Object.assign(state, newMotion(), { seated: 1 });
    return { legs: [0, 1].map(() => solveLeg(.88, .22)),
      arms: [0, 1].map(i => ({ shoulder: -.9, elbow: -.8, outward: (i ? 1 : -1) * .2, grip: 1 })),
      hipHeight: .52, twist: 0, lean: .25, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.truckWeapons && input.truckWeapons.phase !== 'unarmed') {
    const w = input.truckWeapons, johnson = w.role === 'agent_johnson';
    Object.assign(state, newMotion(), { time: w.total });
    const swing = w.phase === 'slash' ? Math.sin(Math.PI * clamp(w.elapsed / .65)) : 0;
    const evade = johnson && w.phase === 'gun' && w.shotAt !== undefined ? Math.sin(Math.PI * clamp((w.total - w.shotAt) / .3)) : 0;
    const counter = w.phase === 'counter' ? Math.sin(Math.PI * clamp(w.elapsed)) : 0;
    return { legs: [0, 1].map(i => solveLeg(i ? -.25 : .25, 1.7)),
      arms: [0, 1].map(i => ({ shoulder: -.7 - counter * .4, elbow: -1.1, outward: (i ? 1 : -1) * .15, grip: 1 })),
      hipHeight: 1.83, twist: swing * (johnson ? -.4 : .3), lean: counter * .12, sway: evade * .18, lunge: 0, roll: evade * -.22,
      headTurn: 0, moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.truckRoad && ['keymaker', 'agent_johnson'].includes(input.truckRoad.role) && input.attack === undefined && !input.truckRescue && !input.truckWeapons) {
    const road = input.truckRoad, keymaker = road.role === 'keymaker';
    const walking = keymaker && road.elapsed < TRUCK_ROAD.approach ? 1 : 0;
    const landing = keymaker ? 0 : Math.sin(Math.PI * clamp((road.elapsed - TRUCK_ROAD.approach - TRUCK_ROAD.drop) / TRUCK_ROAD.landing, 0, 1));
    const dropping = !keymaker && road.phase === 'dropping' ? 1 : 0;
    const cycle = road.elapsed * 1.5;
    return { legs: [0, 1].map(i => { const foot = footTrajectory(cycle + i * .5, .6 * walking, .65);
        return { hip: solveLeg(foot.z, 1.83 - foot.lift * .2).hip - dropping * .45 - landing * .7,
          knee: solveLeg(foot.z, 1.83 - foot.lift * .2).knee + dropping * .7 + landing * 1.2, ankle: landing * -.4 }; }),
      arms: [0, 1].map(i => ({ shoulder: -.3 - dropping * .7 - landing * .4 + Math.sin(cycle * Math.PI * 2 + i * Math.PI) * .3 * walking,
        elbow: -.7, outward: (i ? 1 : -1) * (.15 + dropping * .2), grip: .8 })),
      hipHeight: (keymaker ? 1.98 : 1.83) - landing * .5, twist: 0, lean: landing * .2, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: walking, run: 0, airborne: dropping, coat: dropping, impact: landing, landing };
  }
  if (input.freewayHandoff && !input.freewayRide) {
    const gesture = input.freewayHandoff;
    Object.assign(state, newMotion(), { time: gesture.total });
    const progress = clamp(gesture.elapsed / FREEWAY_HANDOFF.exit), distance = 2.9 * smooth(progress);
    const walking = gesture.role === 'keymaker' && gesture.phase === 'departing' ? 6 * progress * (1 - progress) * 2.9 / FREEWAY_HANDOFF.exit / 2.3 : 0;
    const legs = [0, 1].map(i => { const foot = footTrajectory(distance / 2.6 + i * .5, .6 * walking, .65);
      return solveLeg(foot.z, 1.83 - foot.lift * .2 * walking); });
    return { legs,
      arms: [0, 1].map(i => ({ shoulder: -.35 + Math.sin(distance / 2.6 * Math.PI * 2 + i * Math.PI) * .3 * walking, elbow: -.7, outward: (i ? 1 : -1) * .15, grip: .8 })),
      hipHeight: gesture.role === 'keymaker' ? 1.98 : 1.83, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: walking, run: 0, airborne: Number(gesture.role === 'keymaker' && gesture.phase === 'lifting'), coat: 0, impact: 0, landing: 0 };
  }
  if (input.freewayRide) {
    const ride = input.freewayRide;
    Object.assign(state, newMotion(), { time: ride.elapsed, seated: 1 });
    return { legs: [0, 1].map(() => solveLeg(.95, 1.22)),
      arms: [0, 1].map(i => ({ shoulder: ride.role === 'trinity' ? -1.25 : -.85, elbow: -.65, outward: (i ? 1 : -1) * .13, grip: .8 })),
      hipHeight: 1.38, twist: 0, lean: ride.role === 'trinity' ? 1.05 : .32, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.freewayDriver) {
    Object.assign(state, newMotion(), { time: input.freewayDriver.total, seated: 1 });
    return { legs: [0, 1].map(() => solveLeg(.95, 1.22)),
      arms: [0, 1].map(i => ({ shoulder: -.9, elbow: -.65, outward: (i ? 1 : -1) * .16, grip: .8 })),
      hipHeight: 1.38, twist: 0, lean: .2, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.freewayPickup) {
    const pickup = input.freewayPickup;
    const failedSeat = pickup.phase === 'failed' && pickup.failedBike && pickup.failedRoots
      && Math.abs(pickup.failedRoots[pickup.role].y - pickup.failedBike.y - .9) < .001;
    const mount = pickup.phase === 'mounting' ? smooth(pickup.elapsed / 2.4) : failedSeat || ['mounted', 'shooting', 'launching', 'merging', 'done'].includes(pickup.phase) ? 1 : 0;
    const air = pickup.phase === 'jumping' ? 1 : 0, walking = clamp(pickup.walking / 3), cycle = pickup.stride / 3.2 * Math.PI * 2;
    Object.assign(state, newMotion(), { time: pickup.total, phase: pickup.stride / 3.2, speed: pickup.walking, airborne: air, seated: mount });
    const legs = [0, 1].map(i => {
      const stride = Math.sin(cycle + i * Math.PI) * .55 * walking;
      const standing = solveLeg(stride, 1.83 - Math.max(0, Math.cos(cycle + i * Math.PI)) * .16 * walking);
      const sitting = solveLeg(.95, 1.22);
      return { hip: mix(mix(standing.hip, -.65 + i * .16, air), sitting.hip, mount),
        knee: mix(mix(standing.knee, 1.05, air), sitting.knee, mount), ankle: mix(mix(standing.ankle, -.15, air), sitting.ankle, mount) };
    });
    const arms = [0, 1].map(i => ({ shoulder: mix(mix(Math.cos(cycle + i * Math.PI) * .3 * walking, -1.65, air), pickup.role === 'trinity' ? -1.25 : -.85, mount),
      elbow: mix(mix(-.18, -.75, air), -.65, mount), outward: (i ? 1 : -1) * mix(.075 + air * .25, .13, mount), grip: mount * .8 }));
    if (pickup.phase === 'key') { arms[0].shoulder = -1.05; arms[0].elbow = -.95; arms[0].grip = .45; }
    return { legs, arms, hipHeight: 1.98 - mount * .6, twist: Math.sin(cycle) * .04 * walking, lean: mount * (pickup.role === 'trinity' ? 1.05 : .32),
      sway: 0, lunge: 0, roll: 0, headTurn: 0, moving: walking, run: 0, airborne: air, coat: air * .2, impact: 0, landing: 0 };
  }
  if (input.epilogue?.kind === 'neo_carried' && input.epilogue.role === 'neo') {
    Object.assign(state, newMotion(), { time: input.epilogue.total });
    return { legs: [0, 1].map(() => ({ hip: 0, knee: .04, ankle: 0 })),
      arms: [0, 1].map(i => ({ shoulder: .02, elbow: -.08, outward: (i ? 1 : -1) * 1.3, grip: 0 })),
      hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0, roll: 0, headTurn: 0,
      moving: 0, run: 0, airborne: 0, coat: 0, impact: 0, landing: 0 };
  }
  if (input.truckRescue || input.truckFlight) {
    const gesture = input.truckRescue ?? { phase: 'rescue', elapsed: 10, rescueElapsed: 0, lastTick: 0, attempt: 0, role: 'neo' } as const;
    const pose = truckRescuePose(gesture, gesture.role);
    const neo = gesture.role === 'neo', air = pose.airborne;
    state.time = gesture.rescueElapsed ?? 0; state.phase = 0; state.speed = 0;
    state.turn = 0; state.seated = 0; state.airborne = air; state.landing = 0;
    const standing = solveLeg(0, 1.83);
    const legs = [0, 1].map(i => ({ hip: mix(standing.hip, i ? -.08 : .06, air),
      knee: mix(standing.knee, i ? .24 : .13, air), ankle: mix(standing.ankle, -.08, air) }));
    const arms = [0, 1].map(i => ({ shoulder: mix(0, neo && input.truckRescue ? -1.55 : -2.95, air),
      elbow: mix(-.22, neo ? -.35 : -.18, air), outward: (i ? 1 : -1) * mix(.075, neo ? .42 : .16, air),
      grip: neo ? .5 * pose.hold : .12 * air }));
    return { legs, arms, hipHeight: 1.98, twist: 0, lean: 0, sway: 0, lunge: 0,
      roll: 0, headTurn: 0, moving: 0, run: 0, airborne: air, coat: .22 * air, impact: 0, landing: 0 };
  }
  if (dt > 0) {
    if (input.hit !== undefined && input.hit !== state.hitId) { state.hitId = input.hit; state.hitAge = 0; state.hitPause = .045; }
    if (input.impact !== undefined && input.impact !== state.impactId) { state.impactId = input.impact; state.hitPause = .035; }
    const hold = Math.min(dt, state.hitPause); state.hitPause -= hold; dt -= hold;
  }
  const blend = 1 - Math.exp(-12 * dt);
  const pills = input.pills && pillPose(input.pills);
  const exiting = input.pills?.role === 'neo' && input.pills.phase === 'taking' && input.pills.elapsed > PILL_TIMING.stand && input.pills.elapsed < PILL_TIMING.exit;
  const welcome = input.welcome && lafayetteWelcomePose(input.welcome);
  const oracleGesture = input.oracleVisit ?? (input.oracleDeparture?.role === 'neo' ? { phase: 'responding' as const, elapsed: 4.2, role: 'neo' as const } : undefined);
  const oracle = oracleGesture && oracleVisitPose(oracleGesture);
  const betrayal = input.betrayal && betrayalPose(input.betrayal);
  const rescue = input.rescue && rescuePose(input.rescue);
  const lobby = input.lobbyEntry && lobbyPose(input.lobbyEntry);
  const government = input.government && governmentPose(input.government);
  const airRescue = input.airRescue && airRescuePose(input.airRescue);
  const matrixEscape = input.matrixEscape && matrixEscapePose(input.matrixEscape);
  const theOne = input.theOne && theOnePose(input.theOne);
  const reloaded = input.reloaded && reloadedPose(input.reloaded);
  const recoveryCrew = input.recoveryCrew && recoveryCrewPose(input.recoveryCrew);
  const boardingCrouch = input.recoveryCrew?.boarding ? podRescuePose(input.recoveryCrew.elapsed).settle : 0;
  const farewell = input.farewell && farewellPose(input.farewell);
  const deus = input.deusPact && deusPactPose(input.deusPact);
  const deusLocked = deusPactLocked(input.deusPact);
  const smithFinale = input.smithFinale && smithFinalePose(input.smithFinale);
  if (smithFinale && input.smithFinale?.role === 'smith') smithFinale.fallen = 0;
  const smithLocked = smithFinaleLocked(input.smithFinale);
  const welcomeWalking = input.welcome?.phase === 'approach' || input.welcome?.phase === 'departing' && input.welcome.role !== 'neo';
  const welcomeSpeed = input.welcome?.role === 'morpheus' ? 2.6 : input.welcome?.role === 'neo' ? 2.3 : 1.8;
  const speed = input.farewell || deusPactLocked(input.deusPact) || smithFinaleLocked(input.smithFinale) || trilogyEpilogueLocked(input.epilogue) ? 0 : input.pills ? exiting ? 1.7 : 0 : welcomeWalking ? welcomeSpeed : input.speed;
  state.time = input.farewell ? input.farewell.total : deusLocked ? input.deusPact!.total : smithLocked ? input.smithFinale!.total : state.time + dt;
  state.speed = mix(state.speed, input.riding || input.climbing !== undefined ? 0 : speed, blend);
  if (input.farewell) { state.speed = 0; state.airborne = 0; state.seated = 0; }
  if (input.cabin?.kind === 'core' && input.cabin.role === 'neo') state.speed = 2.2 * smooth(clamp(input.cabin.elapsed / .25)) * (1 - smooth(clamp((input.cabin.elapsed - .65) / .3)));
  const construct = input.construct?.role === 'morpheus' ? constructGuidePose(input.construct.elapsed) : undefined;
  if (construct) state.speed = construct.speed;
  const truthWalk = input.truth?.phase === 'unplug' && input.truth.role === 'neo' ? clamp((input.truth.elapsed - 5.5) / 2.5) : undefined;
  if (truthWalk !== undefined) state.speed = 2.35 / 2.5 * 6 * truthWalk * (1 - truthWalk);
  if (input.mirrorEntry) {
    state.speed = 1.4 * mirrorEntryPose(input.mirrorEntry).walking;
    state.time = input.mirrorEntry.elapsed;
  }
  state.climbPhase += (input.climbing ?? 0) * dt * 5;
  state.seated = input.cabin?.kind === 'core' && input.cabin.role === 'neo' ? cabinSeat(input.cabin.elapsed) : deus ? deus.seated : reloaded ? reloaded.seated : pills ? pills.seat : welcome ? welcome.seated : mix(state.seated, input.seated || input.riding || input.performance === 'connect' || input.performance === 'construct' ? 1 : 0, blend);
  if (input.performance === 'touch') state.seated = smooth(clamp(((input.mirrorBeat ?? MIRROR_TIMING.sit) - .65) / (MIRROR_TIMING.sit - .65)));
  if (input.mirrorRise !== undefined) state.seated = 1 - smooth(clamp(input.mirrorRise));
  if (input.construct || input.reveal?.kind === 'construct') state.seated = construct?.seated ?? (input.reveal?.role === 'morpheus' ? 1 : 0);
  if (input.truth) state.seated = truthRoot(input.truth, input.truth.role).seated;
  if (input.spoonLesson?.role === 'boy') state.seated = 1;
  state.turn = mix(state.turn, clamp(input.turn, -3, 3), blend);
  if (input.mirrorEntry) state.turn = 0;
  state.airborne = mix(state.airborne, input.grounded ? 0 : 1, 1 - Math.exp(-18 * dt));
  if (dt > 0) {
    if (input.grounded && !state.wasGrounded) state.landing = clamp(Math.abs(state.verticalVelocity) / 14, .25, 1);
    state.wasGrounded = input.grounded;
    state.verticalVelocity = input.verticalVelocity;
    state.landing *= Math.exp(-8 * dt);
    state.hitAge += dt;
    state.skillAge += dt;
    state.shotAge += dt;
    if (input.shot !== undefined && input.shot !== state.shotId) { state.shotId = input.shot; state.shotAge = 0; }
    if (input.cast !== undefined && input.cast !== state.castId) { state.castId = input.cast; state.skill = input.skill; state.skillAge = 0; }
    if (input.attack !== undefined && input.attack !== state.attackId) {
      state.combo = input.combo ?? (state.attackAge < COMBO_WINDOW ? (state.combo + 1) % 3 : 0);
      state.attackId = input.attack; state.attackAge = 0;
    } else state.attackAge += dt * (input.windingUp ? .28 : 1);
  }
  if (input.farewell || deusLocked || smithLocked) {
    state.landing = 0;
    state.attackAge = state.hitAge = state.skillAge = state.shotAge = 10;
    state.hitPause = 0; state.skill = undefined;
  }
  if (deusLocked || smithLocked) { state.speed = smithFinale?.[input.smithFinale!.role].speed ?? 0; state.turn = 0; state.airborne = 0; state.phase = 0; }
  if (smithLocked) { state.seated = 0; state.combo = 0; }
  const run = smooth(clamp((state.speed - PLAYER_WALK_SPEED) / (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED)));
  const stride = mix(.84, 1.22, run);
  const stance = mix(.6, .42, run);
  if (input.grounded) state.phase += speed * dt / (2 * stride / stance);
  if (smithLocked) state.phase = (smithFinale![input.smithFinale!.role].travel ?? 0) / (2 * stride / stance);
  if (welcomeWalking && input.welcome) state.phase = input.welcome.elapsed * welcomeSpeed / (2 * stride / stance);
  if (exiting) state.phase = (input.pills!.elapsed - PILL_TIMING.stand) * 1.1;
  if (input.cabin?.kind === 'core' && input.cabin.role === 'neo') state.phase = -Math.min(.95, input.cabin.elapsed) * .85;
  if (truthWalk !== undefined) state.phase = 2.35 * smooth(truthWalk) / (2 * stride / stance);
  if (input.mirrorEntry) state.phase = input.mirrorEntry.elapsed / .88;
  const moving = smooth(clamp(state.speed / 2.2));
  const cycle = state.phase * Math.PI * 2;
  const bob = (Math.cos(cycle * 2) * mix(.025, .045, run) * moving + Math.sin(state.time * 1.7) * .009 * (1 - moving)) * (input.mirrorEntry ? 1 - state.seated : 1);
  const strike = MELEE_COMBO[state.combo];
  const age = state.attackAge;
  const skillDuration = state.skill ? COMBAT_SKILLS[state.skill].duration : 0;
  const skillBlend = smooth(clamp(state.skillAge / .08)) * (1 - smooth(clamp((state.skillAge - skillDuration) / .25)));
  const guarding = state.skill === 'iron_guard' ? skillBlend : 0;
  const dodging = state.skill === 'dodge' ? skillBlend : 0;
  const casting = state.skill && ['force_push', 'system_hack', 'bullet_time', 'code_snare'].includes(state.skill) && state.skillAge < .65 ? Math.sin(state.skillAge / .65 * Math.PI) : 0;
  const guard = Math.max(guarding, smooth(clamp(age / .07)) * (1 - smooth(clamp((age - strike.duration) / .35))));
  const extension = smooth(clamp((age - strike.contact * .5) / (strike.contact * .5)))
    * (1 - smooth(clamp((age - strike.contact - .025) / (strike.duration - strike.contact - .025))));
  const windup = Math.sin(clamp(age / strike.contact) * Math.PI) * guard;
  const recoil = state.hitAge < .32 ? Math.sin(state.hitAge / .32 * Math.PI) * (1 - state.hitAge / .32) : 0;
  const kick = state.combo === 2 ? extension : 0;
  const lobbyDown = lobby?.fall ?? 0;
  const governmentBend = government?.bend ?? 0;
  const escapePinned = matrixEscape?.grapple && input.matrixEscape?.role === 'neo' ? matrixEscape.grapple : 0;
  const hipHeight = 1.98 - boardingCrouch * .75 - moving * .08 - run * .12 + bob - state.landing * .20 - guard * .08 - dodging * .3 - (input.crouching ? .9 : 0) - state.seated * .6 - (input.floorSeated ? .85 : 0) - lobbyDown * 1.5 - governmentBend * .9 - (airRescue?.strain ?? 0) * .32 - (airRescue?.land ?? 0) * .18 - escapePinned * .72 - (matrixEscape?.brace ?? 0) * .55
    - (theOne?.wound ?? 0) * 1.2 - (theOne?.fallen ?? 0) * 1.58 - (theOne?.kiss ?? 0) * .28 - (theOne?.block ?? 0) * .18 - (theOne?.dive ?? 0) * .22 - (theOne?.burst ?? 0) * .28 - (reloaded?.down ?? 0) * 1.5 - (reloaded?.dodge ?? 0) * .38 - (smithFinale?.fallen ?? 0) * 1.38;
  const legs = [0, .5].map(offset => {
    const foot = footTrajectory(state.phase + offset, stride, stance);
    const lift = foot.lift * mix(.22, .55, run) * moving;
    const planted = solveLeg(foot.z * moving, hipHeight - .15 - lift);
    const airHip = input.verticalVelocity > 0 ? -.6 + offset * .45 : -.12 + offset * .18;
    const airKnee = input.verticalVelocity > 0 ? 1.02 : .3;
    return {
      hip: mix(planted.hip, airHip, state.airborne),
      knee: mix(planted.knee, airKnee, state.airborne),
      ankle: mix(planted.ankle, -.2, state.airborne),
    };
  });
  if (state.combo === 2) {
    legs[0].hip = mix(legs[0].hip, -1.35, kick);
    legs[0].knee = mix(legs[0].knee + windup * .65, .12, kick);
    legs[0].ankle = mix(legs[0].ankle, .12, kick);
  }
  const activeArm = state.combo % 2;
  const arms = [0, 1].map(i => {
    const swing = Math.cos(cycle + i * Math.PI) * moving;
    const striking = i === activeArm && state.combo !== 2;
    return {
      shoulder: mix(swing * mix(.32, .65, run), striking ? -.45 + windup * .18 - extension * .95 : -.45, guard) - state.airborne * .25 + recoil * .2,
      elbow: mix(-.22 - run * .8 - Math.max(0, swing) * .15, striking ? -1.7 + extension * 1.6 : -1.55, guard),
      outward: (i ? 1 : -1) * (.075 + run * .025 + state.airborne * .12 + guard * .1),
      grip: Math.max(run * .6, guard),
    };
  });
  const doorPush = input.helDanceDoor === undefined ? 0 : smooth(clamp(input.helDanceDoor * 3)) * (1 - smooth(clamp((input.helDanceDoor - .8) / .2)));
  if (doorPush) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = mix(arms[i].shoulder, -1.48, doorPush);
    arms[i].elbow = mix(arms[i].elbow, -.22, doorPush);
    arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .2, doorPush);
    arms[i].grip = mix(arms[i].grip, .15, doorPush);
  }
  const glance = input.vase === undefined ? 0 : Math.sin(clamp((input.vase - .5) / 2.5) * Math.PI) * .15;
  const twist = Math.cos(cycle) * moving * mix(.055, .10, run) + (extension * .3 - windup * .16) * (activeArm ? -1 : 1) * guard + glance;
  if (casting) for (const arm of arms) { arm.shoulder = mix(arm.shoulder, -1.35, casting); arm.elbow = mix(arm.elbow, -.25, casting); arm.grip = 0; }
  if (input.armed && guard < .1 && !casting) for (const [index, arm] of arms.entries()) {
    if (input.weaponStyle === 'hel_pistol' && index === 1) continue;
    const kickback = Math.max(0, 1 - state.shotAge / .18) ** 2;
    arm.shoulder = input.ambushEscort?.retreat ? -.14 : -1.16 + clamp(input.aimPitch ?? 0, -.9, .9) * .82 - recoil * .1 - kickback * .16;
    arm.elbow = input.ambushEscort?.retreat ? -.5 : -.4 - kickback * .12; arm.outward *= .4; arm.grip = .9;
  }
  for (let i = 0; i < 2; i++) {
    legs[i].hip = mix(legs[i].hip, -1.36, state.seated); legs[i].knee = mix(legs[i].knee, 1.46, state.seated); legs[i].ankle = mix(legs[i].ankle, -.1, state.seated);
    arms[i].shoulder = mix(arms[i].shoulder, -.32, state.seated); arms[i].elbow = mix(arms[i].elbow, -1.1, state.seated); arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .16, state.seated);
  }
  if (input.riding) for (const arm of arms) { arm.shoulder = -.9; arm.elbow = -.65; arm.grip = .8; }
  if (input.climbing !== undefined) for (let i = 0; i < 2; i++) {
    const pull = Math.sin(state.climbPhase + i * Math.PI);
    legs[i].hip = -.75 + pull * .4; legs[i].knee = 1.1 - pull * .6; legs[i].ankle = -.2;
    arms[i].shoulder = -2.2 - pull * .55; arms[i].elbow = -.65 + pull * .5; arms[i].grip = 1;
  }
  if (input.performance === 'touch') {
    if (input.mirrorEntry) for (const [index, arm] of arms.entries()) {
      const sidestep = mirrorEntryPose(input.mirrorEntry).sideways;
      arm.shoulder = mix(mix(.14 + Math.sin(input.mirrorEntry.elapsed / .88 * Math.PI * 2 + index * Math.PI) * .05, .8, sidestep), -.32, state.seated);
      arm.elbow = mix(mix(-.08, -1.4, sidestep), -1.1, state.seated); arm.grip = .15 * (1 - state.seated);
    }
    const reach = smooth(clamp(((input.mirrorBeat ?? MIRROR_TIMING.touch) - MIRROR_TIMING.wired) / (MIRROR_TIMING.touch - MIRROR_TIMING.wired)));
    arms[0].shoulder = mix(arms[0].shoulder, -1.5, reach);
    arms[0].elbow = mix(arms[0].elbow, -.65, reach);
    arms[0].grip = mix(arms[0].grip, 0, reach);
    const withdraw = smooth(clamp(((input.mirrorBeat ?? 0) - MIRROR_TIMING.touch - .35) / .85));
    arms[0].shoulder = mix(arms[0].shoulder, -1.1, withdraw);
    arms[0].elbow = mix(arms[0].elbow, -1.65, withdraw);
  }
  if (input.mirrorCrew !== undefined) {
    const wire = smooth(clamp((input.mirrorCrew - MIRROR_TIMING.sit) / .55)) * (1 - smooth(clamp((input.mirrorCrew - MIRROR_TIMING.wired) / .5)));
    arms[0].shoulder = mix(arms[0].shoulder, -1.42, wire);
    arms[0].elbow = mix(arms[0].elbow, -.34, wire);
    arms[0].outward = mix(arms[0].outward, -.25, wire);
  }
  if (input.spoon !== undefined) { arms[0].shoulder = -.72; arms[0].elbow = -1.45; arms[0].outward = -.2; arms[0].grip = .65; }
  if (input.vase !== undefined) {
    const reach = Math.sin(clamp((input.vase - .6) / 1.8) * Math.PI);
    arms[1].shoulder = mix(arms[1].shoulder, -1.1, reach); arms[1].elbow = mix(arms[1].elbow, -.25, reach);
  }
  if (oracle && oracleGesture) {
    if (oracleGesture.role === 'oracle') {
      arms[0].shoulder = mix(arms[0].shoulder, -1.34, oracle.inspect);
      arms[0].elbow = mix(arms[0].elbow, -.18, oracle.inspect);
      arms[0].outward = mix(arms[0].outward, -.08, oracle.inspect);
      arms[0].shoulder = mix(arms[0].shoulder, -.76, oracle.offer);
      arms[0].elbow = mix(arms[0].elbow, -1.28, oracle.offer);
      arms[0].outward = mix(arms[0].outward, -.19, oracle.offer);
      arms[0].grip = mix(arms[0].grip, .28, oracle.offer);
      arms[1].shoulder = mix(arms[1].shoulder, -.42, oracle.listen);
      arms[1].elbow = mix(arms[1].elbow, -1.02, oracle.listen);
    } else {
      arms[0].shoulder = mix(arms[0].shoulder, -.66, oracle.receive);
      arms[0].elbow = mix(arms[0].elbow, -1.34, oracle.receive);
      arms[0].outward = mix(arms[0].outward, -.14, oracle.receive);
      arms[0].grip = mix(arms[0].grip, .38, oracle.receive);
    }
  }
  if (betrayal && input.betrayal) {
    if (betrayal.charge) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.12, betrayal.charge); arms[i].elbow = mix(arms[i].elbow, -.38, betrayal.charge);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .28, betrayal.charge); arms[i].grip = mix(arms[i].grip, .9, betrayal.charge);
    }
    if (betrayal.yank) {
      arms[0].shoulder = mix(arms[0].shoulder, -.32, betrayal.yank); arms[0].elbow = mix(arms[0].elbow, -1.72, betrayal.yank);
      arms[0].outward = mix(arms[0].outward, -.42, betrayal.yank); arms[0].grip = mix(arms[0].grip, 1, betrayal.yank);
    }
    if (betrayal.counter || betrayal.reconnect) {
      const reach = Math.max(betrayal.counter, betrayal.reconnect);
      arms[0].shoulder = mix(arms[0].shoulder, -.88, reach); arms[0].elbow = mix(arms[0].elbow, -1.08, reach); arms[0].grip = mix(arms[0].grip, .9, reach);
      if (betrayal.reconnect) { arms[1].shoulder = -.72; arms[1].elbow = -1.34; arms[1].grip = .75; }
    }
    if (betrayal.unplugged) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, .28, .92); arms[i].elbow = mix(arms[i].elbow, -.18, .92); arms[i].grip = 0;
    }
  }
  if (rescue && input.rescue) {
    if (rescue.briefingPoint) {
      const arm = input.rescue.role === 'trinity' ? 1 : 0;
      arms[arm].shoulder = mix(arms[arm].shoulder, -1.16, rescue.briefingPoint);
      arms[arm].elbow = mix(arms[arm].elbow, -.22, rescue.briefingPoint);
      arms[arm].outward = mix(arms[arm].outward, (arm ? 1 : -1) * .12, rescue.briefingPoint);
      arms[arm].grip = mix(arms[arm].grip, .18, rescue.briefingPoint);
    }
    if (rescue.equip) for (let i = 0; i < 2; i++) {
      const active = input.weaponStyle === 'compact' || i === 0;
      arms[i].shoulder = mix(arms[i].shoulder, active ? -.78 : -.38, rescue.equip);
      arms[i].elbow = mix(arms[i].elbow, active ? -1.16 + rescue.inspect * .42 : -.94, rescue.equip);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .16, rescue.equip);
      arms[i].grip = mix(arms[i].grip, active ? .95 : .45, rescue.equip);
    }
  }
  if (lobby && input.lobbyEntry) {
    if (input.lobbyEntry.role === 'guard') {
      arms[0].shoulder = mix(arms[0].shoulder, -1.05, lobby.alarm * (1 - lobby.fall));
      arms[0].elbow = mix(arms[0].elbow, -1.42, lobby.alarm * (1 - lobby.fall));
      arms[0].grip = mix(arms[0].grip, .5, lobby.alarm * (1 - lobby.fall));
      for (let i = 0; i < 2; i++) {
        arms[i].shoulder = mix(arms[i].shoulder, i ? -.35 : .2, lobby.fall);
        arms[i].elbow = mix(arms[i].elbow, -.18, lobby.fall); arms[i].grip = mix(arms[i].grip, 0, lobby.fall);
      }
    } else if (lobby.draw > 0) for (const arm of arms) {
      arm.shoulder = mix(arm.shoulder, -1.16 + clamp(input.aimPitch ?? 0, -.9, .9) * .82, lobby.draw);
      arm.elbow = mix(arm.elbow, -.4, lobby.draw); arm.outward *= mix(1, .4, lobby.draw); arm.grip = mix(arm.grip, .9, lobby.draw);
    }
  }
  if (government && input.government) {
    const role = input.government.role;
    if (role === 'morpheus' && government.restrained) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = -.34 + government.strain * .12; arms[i].elbow = -1.45; arms[i].outward = (i ? 1 : -1) * .42; arms[i].grip = .82;
    }
    if (role === 'smith' && government.removeEarpiece) {
      arms[1].shoulder = mix(arms[1].shoulder, -1.5, government.removeEarpiece);
      arms[1].elbow = mix(arms[1].elbow, -1.3, government.removeEarpiece);
      arms[1].outward = mix(arms[1].outward, .42, government.removeEarpiece); arms[1].grip = mix(arms[1].grip, .48, government.removeEarpiece);
    }
    if (role === 'smith' && government.grip) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.98, government.grip); arms[i].elbow = mix(arms[i].elbow, -.38, government.grip);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .3, government.grip); arms[i].grip = mix(arms[i].grip, .9, government.grip);
    }
    if (role === 'neo' && government.bend) {
      for (let i = 0; i < 2; i++) {
        legs[i].hip = mix(legs[i].hip, i ? -.75 : -.98, government.bend); legs[i].knee = mix(legs[i].knee, i ? 1.55 : 1.2, government.bend);
        arms[i].shoulder = mix(arms[i].shoulder, -.7, government.bend); arms[i].elbow = mix(arms[i].elbow, -1.25, government.bend);
        arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .48, government.bend); arms[i].grip = mix(arms[i].grip, .94, government.bend);
      }
    }
    if (role === 'trinity' && government.aim) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.18, government.aim); arms[i].elbow = mix(arms[i].elbow, -.44, government.aim);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .1, government.aim); arms[i].grip = mix(arms[i].grip, .96, government.aim);
    }
    if (government.help && (role === 'neo' || role === 'trinity')) {
      const arm = role === 'neo' ? 0 : 1; arms[arm].shoulder = mix(arms[arm].shoulder, -1.02, government.help);
      arms[arm].elbow = mix(arms[arm].elbow, -.72, government.help); arms[arm].outward = mix(arms[arm].outward, arm ? .28 : -.28, government.help);
      arms[arm].grip = mix(arms[arm].grip, .75, government.help);
    }
    if (role === 'trinity' && government.phone) {
      arms[1].shoulder = mix(arms[1].shoulder, -1.38, government.phone); arms[1].elbow = mix(arms[1].elbow, -1.45, government.phone);
      arms[1].outward = mix(arms[1].outward, .42, government.phone); arms[1].grip = mix(arms[1].grip, .52, government.phone);
    }
    if (government.fall) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, .15, government.fall); arms[i].elbow = mix(arms[i].elbow, -.12, government.fall); arms[i].grip = mix(arms[i].grip, 0, government.fall);
    }
  }
  if (airRescue && input.airRescue) {
    const role = input.airRescue.role;
    if (role === 'neo' && airRescue.gun) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.88, airRescue.gun); arms[i].elbow = mix(arms[i].elbow, -.52, airRescue.gun);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .24, airRescue.gun); arms[i].grip = mix(arms[i].grip, .98, airRescue.gun);
    }
    if (role === 'trinity' && airRescue.pilot) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.62, airRescue.pilot); arms[i].elbow = mix(arms[i].elbow, -.92, airRescue.pilot);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .28, airRescue.pilot); arms[i].grip = mix(arms[i].grip, .88, airRescue.pilot);
    }
    if (airRescue.rope && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.35, airRescue.rope); arms[i].elbow = mix(arms[i].elbow, -1.2, airRescue.rope);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .18, airRescue.rope); arms[i].grip = mix(arms[i].grip, .98, airRescue.rope);
    }
    if (airRescue.reach && (role === 'neo' || role === 'morpheus' || role === 'trinity')) {
      const arm = role === 'morpheus' ? 0 : 1; arms[arm].shoulder = mix(arms[arm].shoulder, -1.48, airRescue.reach);
      arms[arm].elbow = mix(arms[arm].elbow, -.25, airRescue.reach); arms[arm].outward = mix(arms[arm].outward, arm ? .22 : -.22, airRescue.reach);
      arms[arm].grip = mix(arms[arm].grip, .92, airRescue.reach);
    }
    if (airRescue.fall && (role === 'morpheus' || role === 'trinity')) for (let i = 0; i < 2; i++) {
      legs[i].hip = mix(legs[i].hip, i ? -.5 : .45, airRescue.fall); legs[i].knee = mix(legs[i].knee, .75, airRescue.fall);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .72, airRescue.fall);
    }
    if (airRescue.cut && role === 'trinity') {
      arms[1].shoulder = mix(arms[1].shoulder, -1.2, airRescue.cut); arms[1].elbow = mix(arms[1].elbow, -.2, airRescue.cut); arms[1].grip = mix(arms[1].grip, .95, airRescue.cut);
    }
    if (airRescue.scatter && ['smith', 'agent_brown', 'agent_jones'].includes(role)) {
      arms[0].shoulder = mix(arms[0].shoulder, -.45, airRescue.scatter); arms[1].shoulder = mix(arms[1].shoulder, .35, airRescue.scatter);
      legs[0].hip = mix(legs[0].hip, -.55, airRescue.scatter); legs[1].knee = mix(legs[1].knee, .72, airRescue.scatter);
    }
  }
  if (matrixEscape && input.matrixEscape) {
    const role = input.matrixEscape.role;
    if (role === 'neo' && matrixEscape.phone) {
      arms[1].shoulder = mix(arms[1].shoulder, -1.34, matrixEscape.phone); arms[1].elbow = mix(arms[1].elbow, -1.5, matrixEscape.phone);
      arms[1].outward = mix(arms[1].outward, .36, matrixEscape.phone); arms[1].grip = mix(arms[1].grip, .58, matrixEscape.phone);
    }
    if (role === 'smith' && matrixEscape.aim) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.12, matrixEscape.aim); arms[i].elbow = mix(arms[i].elbow, -.34, matrixEscape.aim);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .08, matrixEscape.aim); arms[i].grip = mix(arms[i].grip, .96, matrixEscape.aim);
    }
    if (matrixEscape.stance) for (let i = 0; i < 2; i++) {
      const neo = role === 'neo';
      arms[i].shoulder = mix(arms[i].shoulder, neo ? -.66 : -.52, matrixEscape.stance);
      arms[i].elbow = mix(arms[i].elbow, neo ? -1.42 : -1.18, matrixEscape.stance);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * (neo ? .27 : .2), matrixEscape.stance);
      arms[i].grip = mix(arms[i].grip, .88, matrixEscape.stance);
    }
    if (role === 'neo' && matrixEscape.strike) {
      arms[0].shoulder = mix(arms[0].shoulder, -1.34, matrixEscape.strike); arms[0].elbow = mix(arms[0].elbow, -.08, matrixEscape.strike);
      arms[0].outward = mix(arms[0].outward, -.12, matrixEscape.strike); arms[0].grip = mix(arms[0].grip, 1, matrixEscape.strike);
    }
    if (matrixEscape.wall) for (let i = 0; i < 2; i++) {
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .48, matrixEscape.wall);
      legs[i].hip = mix(legs[i].hip, i ? -.52 : .18, matrixEscape.wall); legs[i].knee = mix(legs[i].knee, .7, matrixEscape.wall);
    }
    if (matrixEscape.grapple) {
      if (role === 'smith') for (let i = 0; i < 2; i++) {
        arms[i].shoulder = mix(arms[i].shoulder, -1.08, matrixEscape.grapple); arms[i].elbow = mix(arms[i].elbow, -.32, matrixEscape.grapple);
        arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .18, matrixEscape.grapple); arms[i].grip = mix(arms[i].grip, 1, matrixEscape.grapple);
      } else if (role === 'neo') for (let i = 0; i < 2; i++) {
        arms[i].shoulder = mix(arms[i].shoulder, -.42, matrixEscape.grapple); arms[i].elbow = mix(arms[i].elbow, -1.18, matrixEscape.grapple);
        arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .45, matrixEscape.grapple); arms[i].grip = mix(arms[i].grip, .9, matrixEscape.grapple);
        legs[i].hip = mix(legs[i].hip, i ? -.75 : -.98, matrixEscape.grapple); legs[i].knee = mix(legs[i].knee, 1.35, matrixEscape.grapple);
      }
    }
    if (role === 'neo' && matrixEscape.leap) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.65, matrixEscape.leap); arms[i].elbow = mix(arms[i].elbow, -.35, matrixEscape.leap);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .4, matrixEscape.leap);
      legs[i].hip = mix(legs[i].hip, i ? -.85 : .12, matrixEscape.leap); legs[i].knee = mix(legs[i].knee, i ? 1.4 : .62, matrixEscape.leap);
    }
    if (matrixEscape.transform) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.55, matrixEscape.transform); arms[i].elbow = mix(arms[i].elbow, -.18, matrixEscape.transform);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .74, matrixEscape.transform); arms[i].grip = mix(arms[i].grip, .12, matrixEscape.transform);
      legs[i].hip = mix(legs[i].hip, i ? -.22 : .16, matrixEscape.transform); legs[i].knee = mix(legs[i].knee, .38, matrixEscape.transform);
    }
    if (role === 'neo' && matrixEscape.brace) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, i ? -.3 : -1.12, matrixEscape.brace); arms[i].elbow = mix(arms[i].elbow, -1.2, matrixEscape.brace);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .52, matrixEscape.brace);
      legs[i].hip = mix(legs[i].hip, i ? -.28 : -1.18, matrixEscape.brace); legs[i].knee = mix(legs[i].knee, i ? 1.42 : .72, matrixEscape.brace);
    }
    if (role === 'neo' && matrixEscape.door) {
      arms[0].shoulder = mix(arms[0].shoulder, -1.25, matrixEscape.door); arms[0].elbow = mix(arms[0].elbow, -.18, matrixEscape.door);
      arms[0].grip = mix(arms[0].grip, .72, matrixEscape.door);
    }
  }
  if (reloaded && input.reloaded) {
    for (let i = 0; i < 2; i++) {
      const fall = reloaded.falling;
      arms[i].shoulder = mix(arms[i].shoulder, reloaded.dreamAgent ? -1.1 : -2.05, fall); arms[i].elbow = mix(arms[i].elbow, -.28, fall); arms[i].grip = mix(arms[i].grip, .92, fall);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .18, fall);
      legs[i].hip = mix(legs[i].hip, i ? -.55 : .45, fall); legs[i].knee = mix(legs[i].knee, i ? 1.12 : .6, fall);
      const stance = Math.max(reloaded.windup, reloaded.dodge);
      arms[i].shoulder = mix(arms[i].shoulder, i ? -.5 : -1.25, stance); arms[i].elbow = mix(arms[i].elbow, -1.4, stance);
      legs[i].hip = mix(legs[i].hip, i ? -.55 : .25, stance); legs[i].knee = mix(legs[i].knee, .72, stance);
      arms[i].shoulder = mix(arms[i].shoulder, i ? -1.65 : -.8, Math.max(reloaded.punch, reloaded.strike)); arms[i].elbow = mix(arms[i].elbow, i ? -.15 : -1.3, Math.max(reloaded.punch, reloaded.strike));
      arms[i].shoulder = mix(arms[i].shoulder, -1.55, reloaded.flight); arms[i].elbow = mix(arms[i].elbow, -.18, reloaded.flight);
      legs[i].hip = mix(legs[i].hip, i ? -.3 : .18, reloaded.flight); legs[i].knee = mix(legs[i].knee, .3, reloaded.flight);
      legs[i].knee = mix(legs[i].knee, .42, reloaded.down); arms[i].shoulder = mix(arms[i].shoulder, .25, reloaded.down);
    }
    if (reloaded.inspect) { arms[0].shoulder = -.75; arms[0].elbow = -1.45; arms[0].grip = .45; }
  }
  if (theOne && input.theOne) {
    const role = input.theOne.role;
    if (theOne.wound && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, i ? .18 : -.15, theOne.wound); arms[i].elbow = mix(arms[i].elbow, -.18, theOne.wound); arms[i].grip = mix(arms[i].grip, .08, theOne.wound);
      legs[i].hip = mix(legs[i].hip, i ? -.72 : .22, theOne.wound); legs[i].knee = mix(legs[i].knee, i ? 1.28 : .65, theOne.wound);
    }
    if (theOne.fallen && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, i ? .35 : -.18, theOne.fallen); arms[i].elbow = mix(arms[i].elbow, -.08, theOne.fallen); arms[i].grip = 0;
      legs[i].hip = mix(legs[i].hip, i ? -.4 : .35, theOne.fallen); legs[i].knee = mix(legs[i].knee, .5, theOne.fallen);
    }
    if (theOne.kiss && role === 'trinity') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.08, theOne.kiss); arms[i].elbow = mix(arms[i].elbow, -1.28, theOne.kiss);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .22, theOne.kiss); arms[i].grip = mix(arms[i].grip, .75, theOne.kiss);
    }
    if (theOne.revive && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.62, theOne.revive); arms[i].elbow = mix(arms[i].elbow, -.95, theOne.revive); arms[i].grip = mix(arms[i].grip, .45, theOne.revive);
    }
    if (theOne.aim && role === 'smith') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.18, theOne.aim); arms[i].elbow = mix(arms[i].elbow, -.34, theOne.aim);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .08, theOne.aim); arms[i].grip = mix(arms[i].grip, .98, theOne.aim);
    }
    if (theOne.stop && role === 'neo') {
      arms[0].shoulder = mix(arms[0].shoulder, -1.5, theOne.stop); arms[0].elbow = mix(arms[0].elbow, -.18, theOne.stop);
      arms[0].outward = mix(arms[0].outward, -.08, theOne.stop); arms[0].grip = mix(arms[0].grip, .08, theOne.stop);
      arms[1].shoulder = mix(arms[1].shoulder, -.38, theOne.stop); arms[1].elbow = mix(arms[1].elbow, -1.1, theOne.stop);
    }
    if (theOne.block && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, i ? -.88 : -1.22, theOne.block); arms[i].elbow = mix(arms[i].elbow, -1.22, theOne.block);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .36, theOne.block); arms[i].grip = mix(arms[i].grip, .92, theOne.block);
    }
    if (theOne.dive && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.85, theOne.dive); arms[i].elbow = mix(arms[i].elbow, -.2, theOne.dive);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .12, theOne.dive); arms[i].grip = mix(arms[i].grip, .82, theOne.dive);
      legs[i].hip = mix(legs[i].hip, i ? -.76 : .2, theOne.dive); legs[i].knee = mix(legs[i].knee, i ? 1.25 : .28, theOne.dive);
    }
    if (theOne.burst && role === 'smith') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.42, theOne.burst); arms[i].elbow = mix(arms[i].elbow, -.12, theOne.burst);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .82, theOne.burst); arms[i].grip = mix(arms[i].grip, .06, theOne.burst);
      legs[i].hip = mix(legs[i].hip, i ? -.28 : .22, theOne.burst); legs[i].knee = mix(legs[i].knee, .4, theOne.burst);
    }
    if (theOne.phone && role === 'neo') {
      arms[1].shoulder = mix(arms[1].shoulder, -1.4, theOne.phone); arms[1].elbow = mix(arms[1].elbow, -1.5, theOne.phone);
      arms[1].outward = mix(arms[1].outward, .4, theOne.phone); arms[1].grip = mix(arms[1].grip, .56, theOne.phone);
    }
    if (theOne.flight && role === 'neo') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -1.58, theOne.flight); arms[i].elbow = mix(arms[i].elbow, -.12, theOne.flight);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .14, theOne.flight); arms[i].grip = mix(arms[i].grip, .28, theOne.flight);
      legs[i].hip = mix(legs[i].hip, i ? -.55 : .22, theOne.flight); legs[i].knee = mix(legs[i].knee, i ? .95 : .3, theOne.flight);
    }
  }
  const catching = input.catch;
  const catchFlying = catching && ['departing', 'flight', 'catching', 'ascent'].includes(catching.phase);
  if (catchFlying) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = catching.role === 'trinity' ? -.7 : catching.phase === 'ascent' ? -1.1 : -1.9;
    arms[i].elbow = catching.phase === 'ascent' ? -.85 : -.25;
    arms[i].outward = (i ? 1 : -1) * (catching.role === 'trinity' ? .72 : .2);
    arms[i].grip = catching.role === 'neo' ? .75 : .1;
    legs[i].hip = i ? -.42 : .15; legs[i].knee = i ? .9 : .25;
  }
  if (catching?.role === 'trinity' && (['landing', 'extract_ready', 'extracting', 'pulse', 'reviving', 'done'].includes(catching.phase) || catching.phase === 'failed' && catching.checkpoint === 'pulse')) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = -.55; arms[i].elbow = -.25; legs[i].hip = i ? -.18 : .12; legs[i].knee = i ? .38 : .22;
  }
  if (catching?.role === 'neo' && ['extract_ready', 'extracting', 'pulse', 'reviving'].includes(catching.phase)) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = catching.phase === 'pulse' ? i ? -.55 : -1.25 : -1.25;
    arms[i].elbow = catching.phase === 'pulse' ? i ? -.45 : -.25 : -1.15;
    arms[i].outward = (i ? 1 : -1) * .3; arms[i].grip = .6;
  }
  const mountainFlight = input.mountainFlight && ['takeoff', 'flying', 'arrived'].includes(input.mountainFlight.phase) || input.truckFlight;
  if (mountainFlight) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = i ? -.25 : -2.15; arms[i].elbow = i ? -.35 : -.08; arms[i].outward = (i ? 1 : -1) * .12; arms[i].grip = i ? .18 : .8;
    legs[i].hip = i ? -.2 : .08; legs[i].knee = i ? .26 : .12;
  }
  if (input.truckPassenger) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = -.92; arms[i].elbow = -.95; arms[i].outward = (i ? 1 : -1) * .38; arms[i].grip = .7;
    legs[i].hip = i ? -.5 : .2; legs[i].knee = i ? .9 : .55;
  }
  if (farewell && input.farewell) {
    const neo = input.farewell.role === 'neo'; const contact = neo ? farewell.neo.hold : farewell.trinity.reach;
    for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, neo ? -.78 : -.52, contact);
      arms[i].elbow = mix(arms[i].elbow, neo ? -1.12 : -.88, contact);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * (neo ? .25 : .18), contact);
      arms[i].grip = mix(arms[i].grip, neo ? .38 : .12, contact);
    }
    if (neo) {
      arms[1].shoulder = mix(arms[1].shoulder, -.78, farewell.neo.kneel);
      arms[1].elbow = mix(arms[1].elbow, -1.95, farewell.neo.kneel);
      arms[1].outward = mix(arms[1].outward, .7, farewell.neo.kneel);
    }
    if (!neo) {
      for (const arm of arms) { arm.shoulder = -.52; arm.elbow = -.88; arm.grip = .12; }
      legs[0].hip = -.5; legs[1].hip = .16; legs[0].knee = 1.02; legs[1].knee = .72;
    }
  }
  if (deus) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = mix(arms[i].shoulder, -.92, deus.brace);
    arms[i].elbow = mix(arms[i].elbow, -.72, deus.brace);
    arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .42, deus.brace);
    arms[i].grip = mix(arms[i].grip, .74, deus.brace);
    if (deus.seated) {
      arms[i].shoulder = mix(arms[i].shoulder, -.43, deus.seated);
      arms[i].elbow = mix(arms[i].elbow, -.98, deus.seated);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .3, deus.seated);
      arms[i].grip = mix(arms[i].grip, .56, deus.seated);
    }
  }
  if (smithFinale && input.smithFinale) {
    const neo = input.smithFinale.role === 'neo';
    const counter = input.smithFinale.phase === 'ground_counter' || input.smithFinale.phase === 'shockwave';
    const pit = input.smithFinale.phase.startsWith('pit_') || input.smithFinale.failedPhase?.startsWith('pit_');
    const attack = pit ? neo ? smithFinale.facePunch : smithFinale.smithPunch
      : counter && !neo || neo && input.smithFinale.phase === 'assault' ? 0 : smithFinale.strike;
    for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.82, smithFinale.guard);
      arms[i].elbow = mix(arms[i].elbow, -1.28, smithFinale.guard);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .31, smithFinale.guard);
      arms[i].grip = mix(arms[i].grip, .92, smithFinale.guard);
      if (smithFinale.flight) {
        arms[i].shoulder = mix(arms[i].shoulder, i === 0 ? -1.92 : -.34, smithFinale.flight);
        arms[i].elbow = mix(arms[i].elbow, i === 0 ? -.18 : -.5, smithFinale.flight);
        legs[i].hip = mix(legs[i].hip, i ? -.58 : .2, smithFinale.flight);
        legs[i].knee = mix(legs[i].knee, i ? 1.08 : .28, smithFinale.flight);
      }
      if (smithFinale.fallen) {
        arms[i].shoulder = mix(arms[i].shoulder, -.48, smithFinale.fallen);
        arms[i].elbow = mix(arms[i].elbow, -1.08, smithFinale.fallen);
        legs[i].hip = mix(legs[i].hip, i ? -.92 : -.22, smithFinale.fallen);
        legs[i].knee = mix(legs[i].knee, i ? 1.48 : 1.1, smithFinale.fallen);
      }
    }
    const strikingArm = neo ? counter && input.smithFinale.hits % 2 === 0 ? 1 : 0
      : pit ? input.smithFinale.phase === 'pit_retaliation' && input.smithFinale.elapsed > 1.25 && input.smithFinale.elapsed < 1.9 ? 1 : 0 : 1;
    arms[strikingArm].shoulder = mix(arms[strikingArm].shoulder, -1.55, attack);
    arms[strikingArm].elbow = mix(arms[strikingArm].elbow, -.08, attack);
    arms[strikingArm].grip = mix(arms[strikingArm].grip, 1, attack);
    if (neo && counter || pit) {
      arms[1 - strikingArm].shoulder = mix(arms[1 - strikingArm].shoulder, -.25, attack);
      arms[1 - strikingArm].elbow = mix(arms[1 - strikingArm].elbow, -1.85, attack);
    }
    if (neo && smithFinale.kick) {
      legs[0].hip = mix(legs[0].hip, -1.6, smithFinale.kick);
      legs[0].knee = mix(legs[0].knee, .12, smithFinale.kick);
      legs[0].ankle = mix(legs[0].ankle, .2, smithFinale.kick);
      arms[0].shoulder = mix(arms[0].shoulder, -.6, smithFinale.kick);
      arms[1].shoulder = mix(arms[1].shoulder, .35, smithFinale.kick);
    }
    if (smithFinale.surrender) for (let i = 0; i < 2; i++) {
      arms[i].shoulder = mix(arms[i].shoulder, -.08, smithFinale.surrender);
      arms[i].elbow = mix(arms[i].elbow, -.12, smithFinale.surrender);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .08, smithFinale.surrender);
      arms[i].grip = mix(arms[i].grip, neo ? .02 : .8, smithFinale.surrender);
    }
  }
  if (input.epilogue) {
    const epilogue = input.epilogue; const run = epilogue.role === 'kid' && epilogue.phase === 'running';
    const embrace = epilogue.phase === 'embrace' && ['morpheus', 'niobe', 'zee', 'link'].includes(epilogue.role);
    const announce = epilogue.role === 'kid' && epilogue.phase === 'announcement';
    const sky = epilogue.role === 'sati' && ['sati', 'sunrise'].includes(epilogue.phase);
    if (run) for (let i = 0; i < 2; i++) {
      const stride = Math.sin(epilogue.elapsed * 9 + i * Math.PI);
      arms[i].shoulder = stride * .95; arms[i].elbow = -.75; legs[i].hip = -stride * .85; legs[i].knee = Math.max(0, stride) * 1.05;
    }
    if (embrace || announce || sky) for (let i = 0; i < 2; i++) {
      const amount = embrace ? 1 : announce ? .8 : .72;
      arms[i].shoulder = mix(arms[i].shoulder, embrace ? -1.25 : -1.72, amount);
      arms[i].elbow = mix(arms[i].elbow, embrace ? -1.05 : -.3, amount);
      arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * (embrace ? .26 : .56), amount);
      arms[i].grip = mix(arms[i].grip, embrace ? .18 : .55, amount);
    }
    if (epilogue.role === 'neo' && epilogue.kind === 'neo_carried') for (let i = 0; i < 2; i++) {
      arms[i].shoulder = -.12; arms[i].elbow = -.08; arms[i].outward = (i ? 1 : -1) * .12; arms[i].grip = 0;
      legs[i].hip = i ? -.04 : .05; legs[i].knee = .08;
    }
  }
  if (recoveryCrew && input.recoveryCrew) {
    const arm = input.recoveryCrew.role === 'morpheus' ? 0 : 1;
    arms[arm].shoulder = mix(arms[arm].shoulder, -.72, recoveryCrew.support);
    arms[arm].elbow = mix(arms[arm].elbow, -.88, recoveryCrew.support);
    arms[arm].outward = mix(arms[arm].outward, (arm ? 1 : -1) * .32, recoveryCrew.support);
    arms[arm].grip = mix(arms[arm].grip, .08, recoveryCrew.support);
  }
  if (input.performance && !['touch', 'connect', 'core', 'construct', 'desert'].includes(input.performance)) for (let i = 0; i < 2; i++) {
    const afloat = input.performance === 'float'; const raised = input.performance === 'lift';
    const held = raised ? podRescuePose(input.podRescue ?? 5).grip : 0;
    const scull = afloat || raised ? 1 - held : 0;
    const clock = input.podRescue ?? state.time;
    arms[i].shoulder = -.5 + Math.sin(clock * 2 + i) * .2 * scull;
    arms[i].elbow = mix(-.7, -.18, held); arms[i].outward = (i ? 1 : -1) * (afloat || raised ? .72 : .25); arms[i].grip = .1;
    legs[i].hip = mix(-.2, i ? -.08 : .12, held);
    legs[i].knee = mix(.45 + Math.sin(clock * 1.8 + i * Math.PI) * .15 * scull, i ? .3 : .18, held);
  }
  if (input.hotel303?.phase === 'surrender') for (let i = 0; i < 2; i++) {
    arms[i].shoulder = -2.55; arms[i].elbow = -.45; arms[i].outward = (i ? 1 : -1) * .42; arms[i].grip = .1;
    legs[i].hip = 0; legs[i].knee = .12;
  }
  if (input.hotel303?.phase === 'dive') for (let i = 0; i < 2; i++) {
    arms[i].shoulder = -1.35; arms[i].elbow = -.65; arms[i].outward = (i ? 1 : -1) * .38; arms[i].grip = .72;
    legs[i].hip = i ? -.72 : .48; legs[i].knee = i ? 1.12 : .45;
  }
  const roofLeap = input.openingRoofLeap === undefined ? 0 : Math.sin(Math.max(0, Math.min(1, input.openingRoofLeap)) * Math.PI);
  if (roofLeap > 0) for (let i = 0; i < 2; i++) {
    arms[i].shoulder = mix(arms[i].shoulder, -1.9, roofLeap);
    arms[i].elbow = mix(arms[i].elbow, -.25, roofLeap);
    arms[i].outward = mix(arms[i].outward, (i ? 1 : -1) * .22, roofLeap);
    legs[i].hip = mix(legs[i].hip, i ? -.75 : .3, roofLeap);
    legs[i].knee = mix(legs[i].knee, i ? 1.42 : .36, roofLeap);
  }
  const oracleLean = oracle && input.oracleVisit?.role === 'oracle' ? oracle.inspect * .07 : 0;
  const oracleLook = oracle && input.oracleVisit ? (input.oracleVisit.role === 'oracle' ? oracle.listen * .12 : -oracle.listen * .09) : 0;
  const betrayalLean = betrayal ? betrayal.fall * 1.15 + (betrayal.unplugged ? .62 : 0) - betrayal.charge * .2 : 0;
  const betrayalRoll = betrayal?.fall ? (input.betrayal?.role === 'cypher' ? -.86 : .68) * betrayal.fall : 0;
  const rescueLean = rescue?.briefingLean ? rescue.briefingLean * .07 : 0;
  const rescueLook = rescue?.briefingPoint ? (input.rescue?.role === 'trinity' ? -.16 : .13) * rescue.briefingPoint : 0;
  const lobbyLean = lobbyDown * 1.38;
  const lobbyRoll = -1.18 * lobbyDown;
  const governmentLean = government ? government.strain * .42 - government.bend * 1.08 + government.fall * 1.25 - (government.jonesDodge ?? 0) * .24 : 0;
  const governmentRoll = government ? government.bend * (Math.sin(input.government!.elapsed * 2.1) >= 0 ? .42 : -.42) + government.fall * .85 + (government.jonesDodge ?? 0) * .5 : 0;
  const airRescueLean = airRescue ? airRescue.strain * .72 + airRescue.fall * .45 - airRescue.land * .25 : 0;
  const airRescueRoll = airRescue ? airRescue.fall * .5 + airRescue.strain * Math.sin(input.airRescue!.elapsed * 4) * .18 : 0;
  const escapeLean = matrixEscape ? matrixEscape.wall * .75 + matrixEscape.grapple * (input.matrixEscape?.role === 'neo' ? -.82 : .24) - matrixEscape.strike * .32 - matrixEscape.leap * .24 + matrixEscape.brace * .74 : 0;
  const escapeRoll = matrixEscape ? matrixEscape.wall * (input.matrixEscape?.role === 'smith' ? -.68 : .52) + matrixEscape.brace * 1.05 + matrixEscape.transform * Math.sin(input.matrixEscape!.elapsed * 18) * .12 : 0;
  const theOneLean = theOne ? theOne.wound * .92 + theOne.fallen * 1.35 + theOne.kiss * .45 - theOne.revive * .18 + theOne.block * .18 - theOne.dive * .72 + theOne.burst * .32 - theOne.flight * .58 : 0;
  const hotelLean = input.hotel303?.phase === 'dive' ? -.68 : 0;
  const farewellLean = farewell && input.farewell ? input.farewell.role === 'neo' ? farewell.neo.kneel * .22 : .68 * farewell.trinity.recline : 0;
  const farewellRoll = farewell && input.farewell?.role === 'trinity' ? -.18 * farewell.trinity.recline : 0;
  const deusLean = deus ? deus.seated * .32 - deus.brace * .08 + deus.pulse * .18 : 0;
  const smithLean = smithFinale ? smithFinale.fallen * 1.25 - smithFinale.flight * .62 + smithFinale.impact * .3 + smithFinale.purge * .22
    - (input.smithFinale?.role === 'smith' ? smithFinale.stagger * .22 : smithFinale.facePunch * .12) : 0;
  const smithRoll = smithFinale ? -(input.smithFinale?.role === 'smith' && (input.smithFinale.phase.startsWith('pit_') || input.smithFinale.failedPhase?.startsWith('pit_'))
    ? smithFinale.stagger * .18 : smithFinale.dodge * .78)
    + smithFinale.fallen * .82 + smithFinale.flight * Math.sin(input.smithFinale!.total * 1.7) * .09 : 0;
  const epilogueLean = input.epilogue?.role === 'kid' && input.epilogue.phase === 'running' ? -.18 : 0;
  const theOneRoll = theOne ? theOne.wound * .58 + theOne.fallen * 1.08 + theOne.burst * (.18 + Math.sin(input.theOne!.elapsed * 11) * .12) + theOne.flight * Math.sin(input.theOne!.elapsed * .8) * .08 : 0;
  return { legs, arms, hipHeight, twist, lean: boardingCrouch * .18 + run * .12 + state.landing * .12 + state.airborne * .04 + extension * .10 - kick * .27 - recoil * .35 + (input.crouching ? .26 : 0) + (input.riding ? .2 : 0) + doorPush * .38 + oracleLean + betrayalLean + rescueLean + lobbyLean + governmentLean + airRescueLean + escapeLean + theOneLean + hotelLean + farewellLean + deusLean + smithLean + epilogueLean + (recoveryCrew?.support ?? 0) * .1 - roofLeap * .45 - (reloaded?.falling ?? 0) * .85 + (reloaded?.dreamAgent ?? 0) * 2 + (reloaded?.down ?? 0) * 1.25 - (reloaded?.flight ?? 0) * .65 - (catchFlying && catching?.role === 'neo' ? .45 : 0) + (catching?.role === 'trinity' && catching.phase === 'flight' ? .25 : 0),
    sway: Math.sin(cycle) * moving * .035, lunge: extension * .16 - kick * .25 - recoil * .22 - dodging * .35 + doorPush * .12 + (matrixEscape?.strike ?? 0) * .32,
    roll: -state.turn * run * .035 - dodging * .22 + betrayalRoll + lobbyRoll + governmentRoll + airRescueRoll + escapeRoll + theOneRoll + farewellRoll + smithRoll + (reloaded?.down ?? 0) * 1.1 - (reloaded?.dodge ?? 0) * .6 + (reloaded?.falling ?? 0) * (input.reloaded?.drift ?? 0) * .055, headTurn: -twist * .65 + glance + oracleLook + rescueLook + (recoveryCrew?.support ?? 0) * (input.recoveryCrew?.role === 'morpheus' ? -.12 : .12), moving, run, airborne: state.airborne,
    coat: moving * (.10 + run * .3) + state.airborne * .18 + kick * .35, impact: extension, landing: state.landing };
}
