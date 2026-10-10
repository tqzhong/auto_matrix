import { poseReloadedCatchContact } from './ReloadedCatchPerformance.js';
import { poseHammerPatient } from './HammerPatientPerformance.js';
import { poseHelProtection } from './HelCoatcheckPerformance.js';
import type { HelCoatcheckEncounter } from '@auto_matrix/shared';
import { HEL_DISARM, HEL_TRIO, helDanceDoorDuration, helDanceDoorLocked } from '@auto_matrix/shared';
import { contactMobilStrike } from './MobilRefusalPerformance.js';
import { contactMobilFamily } from './MobilFamilyPerformance.js';
import { poseFreewayTransferContact } from './FreewayPickupContact.js';
import { truckRoadRoot, freewayHandoffRoot, truckWeaponPairRoot, truckHoodRoot } from '@auto_matrix/shared';
import { freewayPickupRoot, freewayDriverRoot, freewayRideRoot } from '@auto_matrix/shared';
import * as THREE from 'three';
import { hammerCrewRoot, hammerShipPose } from '@auto_matrix/shared';
import { CONNECTED_ROLES, BETRAYAL, crosscutActive, type CrosscutGesture, FILM_SETS, groundHeight, mirrorGuidePose, ambushRouteRoot, ambushRetreatRoot, wetwallPose, sixthPose, bathroomFightRoot, basementDropPose, basementDropRoot, basementDropPlayback, CLUB, clubRoot, oracleCookieOwner, oracleReceptionRoot, officeClothing, type AmbushEscort, type AgentState, type CombatImpact, type FilmJourney, type WetwallPhase, type BasementDropPlayback, type ClubPhase } from '@auto_matrix/shared';
import { trackingContact } from './TrackingContact.js';
import { CharacterModels, weaponMuzzle, type CharacterRig } from './CharacterModel.js';
import { newMotion, type MotionInput } from './CharacterMotion.js';
import { poseBathroom } from './BathroomPerformance.js';
import { officeCustodyActive, smithFinaleLocked, truckRescuePose } from '@auto_matrix/shared';
import { OfficeCustodyPerformance } from './OfficeCustodyPerformance.js';
import { poseClub } from './ClubPerformance.js';
import { poseTruckRescue } from './TruckRescueContact.js';
import { poseSmithFinaleContact } from './SmithFinaleContact.js';
import { SmithEndingAppearance } from './SmithEndingAppearance.js';
import { poseUpperDigger } from './UpperDiggerPerformance.js';
import { poseDockDeparture, poseDockReunion } from './DockReunionPerformance.js';
import { poseTempleDefense } from './TempleDefensePerformance.js';
import { ceasefireReunionPose, gardenPose, gardenGroundHeight, type CeasefireReunionRole, type TrilogyEpilogueGesture } from '@auto_matrix/shared';
import { poseCeasefireReunionPair } from './CeasefireReunionPerformance.js';
import { poseMobilReunionPair } from './MobilReunionPerformance.js';
import { contactOracleAbsorption } from './OracleAbsorptionPerformance.js';
import { OracleSmithAppearance } from './OracleSmithAppearance.js';

export const FACTION_COLORS: Record<string, string> = {
  zion: '#90d7b1', civilians: '#d0c8a3', machines: '#ee8773', oracle: '#c6b1e7', merovingian: '#cda96c', exiles: '#88b5c5', smith_virus: '#f07565',
};
interface Entry {
  group: THREE.Group;
  body: THREE.Group;
  rig: CharacterRig;
  marker: THREE.Mesh;
  label: THREE.Sprite;
  state: AgentState;
  time: number;
  shadow: THREE.Mesh;
  hit?: number;
  impact?: number;
  shot?: number;
  speech?: { sprite: THREE.Sprite; age: number };
  mirrorGuide?: { from: number; to: number; progress: number; elapsed: number };
  oracleGuide?: { phase: 'approaching' | 'guiding' | 'returning'; from: number; to: number; progress: number; elapsed: number };
  ambushGuide?: { stairCat?: true; retreat?: true; role: AmbushEscort['role']; from: number; to: number; progress: number; elapsed: number };
  wetwallGuide?: { phase: WetwallPhase; from: number; to: number; progress: number; elapsed: number };
  clubGuide?: { phase: ClubPhase; from: number; to: number; progress: number; elapsed: number };
  sixthElapsed?: number;
  bathroomElapsed?: number;
  hammerPilot?: boolean;
  basementDropClock?: BasementDropPlayback;
}

export class AgentRenderer {
  private agents = new Map<string, Entry>();
  private oracleSmith?: OracleSmithAppearance;
  private selected: string | null = null;
  private playerId: string | null = null;
  private firstPerson = false;
  private matrix = true;
  private playerMotion?: MotionInput;
  private models = new CharacterModels();
  private custody = new OfficeCustodyPerformance();
  private smithEnding?: SmithEndingAppearance;
  private markerGeometry = new THREE.RingGeometry(2.1, 2.5, 32);
  private shadowGeometry = new THREE.PlaneGeometry(3, 3);
  private shadowTexture: THREE.CanvasTexture;
  private shadowMaterial: THREE.MeshBasicMaterial;

  constructor(private scene: THREE.Scene) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!; const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    gradient.addColorStop(0, '#00000090'); gradient.addColorStop(.45, '#00000045'); gradient.addColorStop(1, '#00000000');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    this.shadowTexture = new THREE.CanvasTexture(canvas);
    this.shadowMaterial = new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: .55, depthWrite: false, toneMapped: false });
  }

  updateAgent(id: string, state: AgentState): void {
    let entry = this.agents.get(id);
    if (!entry) {
      const group = new THREE.Group();
      const rig = this.models.create(state);
      const body = rig.root;
      body.position.y = -1;
      const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.97;
      const color = FACTION_COLORS[state.faction] ?? '#91cfb0';
      const marker = new THREE.Mesh(this.markerGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.1;
      group.add(body, marker, shadow);
      const label = this.label(state.name, color, false);
      label.position.y = 7;
      group.add(label);
      group.position.set(state.position.x, state.position.y, state.position.z);
      this.scene.add(group);
      entry = { group, body, rig, marker, label, state, time: 0, shadow };
      this.agents.set(id, entry);
    }
    const progress = state.currentAction?.parameters.mirrorGuide;
    if (typeof progress === 'number') {
      const guide = entry.mirrorGuide;
      if (!guide || progress < guide.to || progress - guide.progress > 4) {
        entry.mirrorGuide = { from: progress, to: progress, progress, elapsed: .5 };
        const pose = mirrorGuidePose(progress), center = FILM_SETS.film_lafayette.center;
        entry.group.position.set(center.x + pose.x, state.position.y, center.z + pose.z);
      } else if (progress !== guide.to) entry.mirrorGuide = { from: guide.progress, to: progress, progress: guide.progress, elapsed: 0 };
    } else entry.mirrorGuide = undefined;
    const reception = state.currentAction?.parameters.oracleReception as MotionInput['oracleReception'];
    if (reception && (reception.phase === 'approaching' || reception.phase === 'guiding' || reception.phase === 'returning')) {
      const guide = entry.oracleGuide, progress = reception.progress;
      if (!guide || guide.phase !== reception.phase || progress < guide.to || progress - guide.progress > 4)
        entry.oracleGuide = { phase: reception.phase, from: progress, to: progress, progress, elapsed: .5 };
      else if (progress !== guide.to) entry.oracleGuide = { ...guide, from: guide.progress, to: progress, elapsed: 0 };
    } else entry.oracleGuide = undefined;
    const escort = state.currentAction?.parameters.ambushEscort as AmbushEscort | undefined;
    if (escort) {
      const guide = entry.ambushGuide, progress = escort.progress;
      if (!guide || guide.role !== escort.role || guide.stairCat !== escort.stairCat || guide.retreat !== escort.retreat || progress < guide.to || progress - guide.progress > 5)
        entry.ambushGuide = { stairCat: escort.stairCat, retreat: escort.retreat, role: escort.role, from: progress, to: progress, progress, elapsed: .5 };
      else if (progress !== guide.to) entry.ambushGuide = { ...guide, from: guide.progress, to: progress, elapsed: 0 };
    } else entry.ambushGuide = undefined;
    const wall = state.currentAction?.parameters.wetwall as MotionInput['wetwall'];
    if (wall) {
      const guide = entry.wetwallGuide, progress = wall.progress;
      if (!guide || guide.phase !== wall.phase || Math.abs(progress - guide.progress) > 5)
        entry.wetwallGuide = { phase: wall.phase, from: progress, to: progress, progress, elapsed: .5 };
      else if (progress !== guide.to) entry.wetwallGuide = { ...guide, from: guide.progress, to: progress, elapsed: 0 };
    } else entry.wetwallGuide = undefined;
    const club = state.currentAction?.parameters.club as MotionInput['club'];
    if (club) {
      const guide = entry.clubGuide, progress = club.elapsed;
      const end = guide?.phase === 'approaching' && ['ready', 'introduction'].includes(club.phase) ? CLUB.approach
        : guide?.phase === 'departing' && club.phase === 'done' ? CLUB.departure : undefined;
      if (guide && end !== undefined && end - guide.progress <= 1.5) {
        if (guide.to !== end) entry.clubGuide = { ...guide, from: guide.progress, to: end, elapsed: 0 };
      } else if (!guide || guide.phase !== club.phase || progress < guide.to || progress - guide.progress > 1.5)
        entry.clubGuide = { phase: club.phase, from: progress, to: progress, progress, elapsed: .5 };
      else if (progress !== guide.to) entry.clubGuide = { ...guide, from: guide.progress, to: progress, elapsed: 0 };
    } else entry.clubGuide = undefined;
    entry.sixthElapsed = (state.currentAction?.parameters.sixth as MotionInput['sixth'])?.elapsed;
    entry.bathroomElapsed = (state.currentAction?.parameters.bathroom as MotionInput['bathroom'])?.elapsed;
    entry.state = state;
    entry.group.visible = state.isInMatrix === this.matrix && state.status !== 'disconnected';
  }

  setSelected(id: string | null): void { this.selected = id; }
  setPlayer(id: string | null, firstPerson = false): void { this.playerId = id; this.firstPerson = firstPerson; }
  setPlayerMotion(motion: MotionInput): void { this.playerMotion = motion; }
  setWorld(matrix: boolean): void {
    this.matrix = matrix;
    for (const entry of this.agents.values()) entry.group.visible = entry.state.isInMatrix === matrix;
  }
  getAgent(id: string): THREE.Group | null { return this.agents.get(id)?.group ?? null; }
  getAgentBody(id: string): THREE.Group | undefined { return this.agents.get(id)?.body; }
  protectHelAttendant(attendant?: THREE.Object3D, state?: HelCoatcheckEncounter): void {
    const entry = this.agents.get('seraph'); if (!entry) return;
    poseHelProtection(entry.rig, entry.state.controller || entry.state.status !== 'alive' ? undefined : attendant, state);
  }
  getAgentState(id: string): AgentState | null { return this.agents.get(id)?.state ?? null; }
  getAgentIds(): string[] { return [...this.agents.keys()].filter(id => !id.startsWith('body:')); }
  getPhysicalBody(id: string): THREE.Group | undefined { return this.agents.get(`body:${id}`)?.body ?? this.getAgentBody(id); }
  muzzle(id: string): THREE.Vector3 | undefined { const entry = this.agents.get(id); return entry ? weaponMuzzle(entry.rig) : undefined; }
  updateActionIndicator(_id: string, _type: string): void {}
  impact(hit: CombatImpact): void {
    const target = this.agents.get(hit.target); const source = this.agents.get(hit.source);
    if (target) target.hit = performance.now();
    if (source) source.impact = performance.now();
    if (source && hit.shot) source.shot = performance.now();
  }

  update(delta: number, camera?: THREE.Camera, speed = 1, tick = 0, journey?: FilmJourney): void {
    const farewellFrames: { entry: Entry; gesture: NonNullable<MotionInput['farewell']> }[] = [];
    let upperSupport: { entry: Entry; gesture: NonNullable<MotionInput['upperDigger']> } | undefined;
    const savedEpilogue = journey?.scene === 'm3_ceasefire' && !journey.visiting ? journey.epilogue : undefined;
    const fastEpilogue = this.playerId === journey?.actor ? this.playerMotion?.epilogue : undefined;
    const reunionClock = savedEpilogue && fastEpilogue?.kind === savedEpilogue.kind
      && fastEpilogue.total >= savedEpilogue.total ? fastEpilogue : savedEpilogue;
    const savedGarden = journey?.scene === 'm3_dawn' && !journey.visiting ? journey.epilogue : undefined;
    const gardenClock = savedGarden && fastEpilogue?.kind === savedGarden.kind
      && fastEpilogue.total >= savedGarden.total ? fastEpilogue : savedGarden;
    const savedPickup = journey?.scene === 'm2_freeway' && journey.step === 0 && !journey.visiting ? journey.freewayPickup : undefined;
    const fastPickup = this.playerId === journey?.actor ? this.playerMotion?.freewayPickup : undefined;
    const pickupClock = savedPickup && fastPickup?.attempts === savedPickup.attempts && fastPickup.total >= savedPickup.total ? fastPickup : savedPickup;
    const savedHandoff = journey?.scene === 'm2_freeway' && journey.step === 2 && !journey.visiting ? journey.freewayHandoff : undefined;
    const fastHandoff = this.playerId === journey?.actor ? this.playerMotion?.freewayHandoff : undefined;
    const handoffClock = savedHandoff && fastHandoff?.attempt === savedHandoff.attempt && fastHandoff.total >= savedHandoff.total ? fastHandoff : savedHandoff;
    const savedRoad = journey?.scene === 'm2_trucks' && !journey.visiting ? journey.trucks?.road : undefined;
    const fastRoad = this.playerId === journey?.actor ? this.playerMotion?.truckRoad : undefined;
    const roadClock = savedRoad && fastRoad?.bridgeZ === savedRoad.bridgeZ && fastRoad.elapsed >= savedRoad.elapsed ? fastRoad : savedRoad;
    const savedWeapons = savedRoad && journey?.trucks?.phase === 'duel' ? journey.trucks.weapons : undefined;
    const fastWeapons = this.playerId === journey?.actor ? this.playerMotion?.truckWeapons : undefined;
    const weaponClock = savedWeapons && fastWeapons && fastWeapons.total >= savedWeapons.total ? fastWeapons : savedWeapons;
    const savedHood = savedRoad ? journey?.trucks?.hood : undefined;
    const fastHood = this.playerId === journey?.actor ? this.playerMotion?.truckHood : undefined;
    const hoodClock = savedHood && fastHood?.attempt === savedHood.attempt && fastHood.total >= savedHood.total ? fastHood : savedHood;
    const savedRide = journey?.scene === 'm2_freeway' && journey.step === 1 && !journey.visiting ? journey.ride : undefined;
    const fastRide = this.playerId === journey?.actor ? this.playerMotion?.freewayRide : undefined;
    const rideClock = savedRide && savedRide.startedAt !== undefined && fastRide?.startedAt === savedRide.startedAt
      && fastRide.elapsed >= savedRide.elapsed ? fastRide : savedRide;
    const savedDisarm = journey?.scene === 'm3_hel_bargain' && !journey.visiting && journey.helBargain?.phase === 'disarming' ? journey.helBargain.disarm : undefined;
    const fastDisarm = (this.playerId === journey?.actor ? this.playerMotion?.helDisarm
      : this.agents.get(journey?.actor ?? '')?.state.currentAction?.parameters.helDisarm) as MotionInput['helDisarm'];
    const disarmClock = savedDisarm && fastDisarm && fastDisarm.elapsed >= savedDisarm.elapsed ? fastDisarm : savedDisarm;
    const savedBreakout = journey?.scene === 'm3_hel_bargain' && !journey.visiting ? journey.helBargain : undefined;
    const fastBreakout = (this.playerId === journey?.actor ? this.playerMotion?.helBreakout
      : this.agents.get(journey?.actor ?? '')?.state.currentAction?.parameters.helBreakout) as MotionInput['helBreakout'];
    const breakoutClock = savedBreakout?.breakout && ['airborne', 'catching'].includes(savedBreakout.phase)
      ? fastBreakout?.phase === savedBreakout.phase && fastBreakout.elapsed >= savedBreakout.elapsed ? fastBreakout
        : { phase: savedBreakout.phase as 'airborne' | 'catching', elapsed: savedBreakout.elapsed, breakout: savedBreakout.breakout } : undefined;
    const cut = crosscutActive(journey) ? journey!.tvExit!.crosscut : undefined;
    if (cut) for (const role of CONNECTED_ROLES) {
      const source = this.agents.get(role)?.state; if (!source) continue;
      const root = BETRAYAL.deckRoots[role], center = FILM_SETS.film_neb_deck.center;
      this.updateAgent(`body:${role}`, { ...source, isInMatrix: false, status: 'alive', controller: undefined,
        position: { x: center.x + root.x, y: center.y, z: center.z + root.z }, rotation: root.yaw, velocity: { x: 0, y: 0, z: 0 },
        currentAction: { type: 'idle', parameters: { seated: true, crosscut: { ...cut, role, body: true } }, startedAt: tick, duration: 1e9, progress: 0 } });
    }
    for (const [id, entry] of this.agents) {
      let state = entry.state; const physical = id.startsWith('body:');
      const disarmRole = disarmClock && HEL_TRIO.includes(id as typeof HEL_TRIO[number]) && (!state.controller || id === this.playerId)
        && state.status === 'alive' && state.currentLocation === 'film_club_hel' ? id as typeof HEL_TRIO[number] : undefined;
      const disarmGesture = disarmRole && { ...disarmClock!, role: disarmRole };
      if (disarmGesture) {
        const start = disarmGesture.starts[disarmGesture.role], center = FILM_SETS.film_club_hel.center;
        state = { ...state, position: { x: center.x + start.x, y: center.y + start.y, z: center.z + start.z }, rotation: start.yaw,
          currentAction: { type: 'idle', parameters: { resolved: true, armed: disarmGesture.elapsed < HEL_DISARM.release, weaponStyle: 'hel_pistol', helDisarm: disarmGesture },
            startedAt: journey!.enteredAt, duration: HEL_DISARM.seconds, progress: disarmGesture.elapsed / HEL_DISARM.seconds } };
      }
      if (handoffClock && ['trinity', 'keymaker', 'morpheus'].includes(id) && (!state.controller || id === this.playerId) && state.status === 'alive') {
        const role = id as 'trinity' | 'keymaker' | 'morpheus', root = freewayHandoffRoot(handoffClock, role), center = FILM_SETS.film_freeway_101.center;
        const seated = role === 'trinity' || role === 'keymaker' && handoffClock.phase === 'approach';
        state = { ...state, position: { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }, rotation: root.yaw,
          currentAction: { type: 'idle', parameters: { resolved: true, seated, freewayHandoff: { ...handoffClock, role },
            ...(seated ? { freewayRide: { ...handoffClock.bike, role } } : {}) }, startedAt: handoffClock.startedAt ?? tick, duration: 1e9, progress: 0 } };
      }
      if (roadClock && ['keymaker', 'agent_johnson'].includes(id) && !state.controller && state.status === 'alive' && journey?.trucks?.phase === 'duel'
        && (id === 'keymaker' || roadClock.phase !== 'ready')) {
        const root = truckRoadRoot(roadClock, id as 'keymaker' | 'agent_johnson'), center = FILM_SETS.film_freeway_101.center;
        state = { ...state, position: { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }, rotation: root.yaw,
          currentAction: { type: 'idle', parameters: { resolved: true, truckRoad: { ...roadClock, role: id } }, startedAt: tick, duration: 1e9, progress: 0 } };
      }
      if (roadClock && weaponClock && weaponClock.phase !== 'unarmed' && id === 'agent_johnson' && !state.controller && state.status === 'alive') {
        const root = truckWeaponPairRoot(weaponClock, 'agent_johnson') ?? weaponClock.johnson, center = FILM_SETS.film_freeway_101.center;
        const actor = this.agents.get('morpheus')!.state, morpheus = fastWeapons?.bodies.morpheus ?? {
          x: actor.position.x - center.x - roadClock.truck.x, y: actor.position.y - center.y, z: actor.position.z - center.z - roadClock.truck.z, yaw: actor.rotation };
        state = { ...state, position: { x: center.x + roadClock.truck.x + root.x, y: center.y + root.y, z: center.z + roadClock.truck.z + root.z }, rotation: root.yaw,
          currentAction: { type: 'idle', parameters: { resolved: true, truckRoad: { ...roadClock, role: id }, truckWeapons: {
            ...weaponClock, role: id, truck: roadClock.truck, bodies: { morpheus, agent_johnson: root }
          } }, startedAt: tick, duration: 1e9, progress: 0 } };
      }
      if (roadClock && hoodClock && hoodClock.phase !== 'failed' && ['morpheus', 'agent_johnson', 'niobe', 'ghost'].includes(id) && (!state.controller || id === this.playerId) && state.status === 'alive'
        && (journey?.trucks?.phase === 'duel' || ['niobe', 'ghost'].includes(id))) {
        const role = id as import('@auto_matrix/shared').TruckHoodRole, root = truckHoodRoot(hoodClock, role), center = FILM_SETS.film_freeway_101.center;
        state = { ...state, position: { x: center.x + roadClock.truck.x + root.x, y: center.y + root.y, z: center.z + roadClock.truck.z + root.z }, rotation: root.yaw,
          currentAction: { type: 'idle', parameters: { ...state.currentAction?.parameters, resolved: true, seated: role === 'niobe' || role === 'ghost', truckRoad: { ...roadClock, role },
            truckHood: { ...hoodClock, truck: roadClock.truck, role } }, startedAt: tick, duration: 1e9, progress: 0 } };
      }
      if (rideClock && ['trinity', 'keymaker'].includes(id) && (!state.controller || id === this.playerId) && state.status === 'alive') {
        const role = id as 'trinity' | 'keymaker', root = freewayRideRoot(rideClock, role), center = FILM_SETS.film_freeway_101.center;
        state = { ...state, position: { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }, rotation: root.yaw,
          currentAction: { type: 'idle', parameters: { resolved: true, riding: true, seated: true, freewayRide: { ...rideClock, role } }, startedAt: rideClock.startedAt ?? tick, duration: 1e9, progress: 0 } };
      }
      if (pickupClock && id === 'keymaker' && !state.controller && state.status === 'alive') {
        const root = freewayPickupRoot(pickupClock, 'keymaker'), center = FILM_SETS.film_freeway_101.center;
        state = { ...state, position: { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }, rotation: root.yaw,
          currentAction: { type: 'idle', parameters: { resolved: true, freewayPickup: { ...pickupClock, role: 'keymaker' } }, startedAt: tick, duration: 1e9, progress: 0 } };
      }
      if (pickupClock?.chase && id === 'agent_jackson' && !state.controller && state.status === 'alive') {
        const root = freewayDriverRoot(pickupClock), center = FILM_SETS.film_freeway_101.center;
        state = { ...state, position: { x: center.x + root.x, y: center.y + root.y, z: center.z + root.z }, rotation: root.yaw,
          currentAction: { type: 'idle', parameters: { resolved: true, riding: true, seated: true, freewayDriver: pickupClock }, startedAt: tick, duration: 1e9, progress: 0 } };
      }
      const epilogue = state.currentAction?.parameters.epilogue as MotionInput['epilogue'];
      const reunionRole = epilogue?.kind === 'ceasefire' && ['morpheus', 'niobe', 'link', 'zee'].includes(id)
        && state.status === 'alive' && !state.controller ? id as CeasefireReunionRole : undefined;
      const reunionGesture = reunionRole && { ...(reunionClock ?? epilogue!), role: reunionRole };
      const gardenRole = gardenClock?.kind === 'dawn' && epilogue?.kind === 'dawn' && ['oracle', 'architect', 'sati', 'seraph'].includes(id)
        && state.status === 'alive' && !state.controller ? id as TrilogyEpilogueGesture['role'] : undefined;
      const gardenGesture = gardenRole && { ...gardenClock!, role: gardenRole };
      const smithLocked = smithFinaleLocked(state.currentAction?.parameters.smithFinale as MotionInput['smithFinale']);
      if (physical && (this.matrix || !cut || id === 'body:neo' && cut.neoOut || id === 'body:trinity' && cut.trinityOut)) { entry.group.visible = false; continue; }
      const phoneExit = journey?.scene === 'm1_phone_escape' && journey.actor === id && ['connected', 'done'].includes(journey.openingPhone?.phase ?? '');
      const rescueBystander = journey?.scene === 'm2_catch' && !journey.visiting && state.currentLocation === 'film_trinity_roof'
        && !['neo', 'trinity', 'agent_thompson'].includes(id) && !state.controller;
      entry.group.visible = state.isInMatrix === this.matrix && state.status !== 'disconnected' && !phoneExit && !rescueBystander;
      const doorActor = journey?.scene === 'm3_hel_entry' && !journey.visiting && journey.actor === id && state.status === 'alive' && state.currentLocation === 'film_club_hel';
      const fastDoor = doorActor ? (id === this.playerId ? this.playerMotion?.helDoorPush : undefined)
        ?? state.currentAction?.parameters.helDoorPush as MotionInput['helDoorPush'] : undefined;
      const physicalDoor = fastDoor?.phase === 'opening' && fastDoor.physical ? fastDoor
        : doorActor && helDanceDoorLocked(journey) && journey!.helDanceDoor!.physical ? journey!.helDanceDoor : undefined;
      const door = physicalDoor ?? (doorActor && helDanceDoorLocked(journey) ? journey!.helDanceDoor : undefined);
      const doorPush = door ? door.elapsed / helDanceDoorDuration(door) : undefined;
      const pistolView = id === this.playerId && this.firstPerson && (disarmGesture || this.playerMotion?.armed && this.playerMotion.weaponStyle === 'hel_pistol');
      entry.body.visible = (id !== this.playerId || !this.firstPerson || pistolView || doorPush !== undefined || (this.playerMotion?.primaryDemolition?.phase === 'mounting' || this.playerMotion?.primaryDemolition?.blast?.phase === 'countdown') || this.playerMotion?.signal !== undefined || this.playerMotion?.helGarage !== undefined || this.playerMotion?.helElevator !== undefined || this.playerMotion?.trainmanChase !== undefined || this.playerMotion?.baneInquiry !== undefined || this.playerMotion?.hammerBriefing !== undefined || this.playerMotion?.hammerPilot !== undefined || this.playerMotion?.zionDeployment !== undefined || this.playerMotion?.maggieDiscovery !== undefined || this.playerMotion?.logosBane !== undefined || this.playerMotion?.architect?.role === 'neo' || this.playerMotion?.catch?.role === 'neo' || this.playerMotion?.truckHood !== undefined || this.playerMotion?.truckWeapons !== undefined || this.playerMotion?.freewayPickup !== undefined || this.playerMotion?.freewayRide !== undefined || this.playerMotion?.dockEvacuation !== undefined || this.playerMotion?.shaftSeal !== undefined || this.playerMotion?.templeDefense?.phase === 'mounting' || this.playerMotion?.dockReunion !== undefined || this.playerMotion?.empOperator !== undefined || this.playerMotion?.upperDigger !== undefined || this.playerMotion?.diggers !== undefined || this.playerMotion?.smithFinale?.pitFight && smithLocked || this.playerMotion?.morning !== undefined || state.id === 'neo' && state.currentLocation === 'film_power_plant_pods' && this.playerMotion?.performance === 'pod' || Boolean(this.playerMotion?.workday?.role === 'neo' && this.playerMotion.workday.phase === 'signing') || this.playerMotion?.computerCheck !== undefined || Boolean(this.playerMotion?.contact?.propMotion === 'minidisc' && ['retrieving', 'disk', 'handover'].includes(this.playerMotion.contact.phase)) || this.playerMotion?.pills !== undefined || this.playerMotion?.wetwall?.hanging || this.playerMotion?.inspecting === true || this.playerMotion?.spoon !== undefined || this.playerMotion?.spoonLesson !== undefined || Boolean(this.playerMotion?.oracleVisit && oracleCookieOwner(this.playerMotion.oracleVisit) === 'neo') || this.playerMotion?.oracleDeparture?.role === 'neo') && state.status !== 'disconnected' && !state.currentAction?.parameters.filmDuel && !state.currentAction?.parameters.ghostPhase;
      const warning = state.currentAction?.type === 'attack' && state.currentAction.target === this.playerId && Number(state.currentAction.parameters.contactTick ?? 0) > tick;
      entry.marker.visible = !physical && (warning || !this.playerId || id === this.selected);
      (entry.marker.material as THREE.MeshBasicMaterial).color.set(warning ? '#f6b177' : FACTION_COLORS[state.faction] ?? '#91cfb0');
      entry.marker.position.y = this.playerId ? -.94 : .1;
      entry.time += delta * (id === this.playerId ? 1 : speed);
      let guideHeading: number | undefined, guideSpeed = 0;
      const club = state.currentAction?.parameters.club as MotionInput['club'], clubGuide = entry.clubGuide;
      if (club && clubGuide) {
        if (speed === 0) {
          clubGuide.phase = club.phase; clubGuide.progress = clubGuide.from = clubGuide.to = club.elapsed; clubGuide.elapsed = .5;
        }
        else {
          clubGuide.elapsed = Math.min(.5, clubGuide.elapsed + delta * speed);
          clubGuide.progress = THREE.MathUtils.lerp(clubGuide.from, clubGuide.to, clubGuide.elapsed / .5);
          if (clubGuide.phase !== club.phase && clubGuide.elapsed === .5) {
            clubGuide.phase = club.phase; clubGuide.progress = clubGuide.from = clubGuide.to = club.elapsed;
          }
        }
      }
      const clubGesture = club && { ...club, phase: clubGuide?.phase ?? club.phase, elapsed: clubGuide?.progress ?? club.elapsed };
      const sixth = state.currentAction?.parameters.sixth as MotionInput['sixth'];
      if (sixth && entry.sixthElapsed !== undefined && !sixth.paused && !['ready', 'failed', 'done', 'firing'].includes(sixth.phase))
        entry.sixthElapsed = Math.min(sixth.elapsed + .5, entry.sixthElapsed + delta * speed);
      const sixthGesture = sixth && { ...sixth, elapsed: entry.sixthElapsed ?? sixth.elapsed };
      const sixthRoot = sixthGesture && sixthPose(sixthGesture);
      const bathroom = state.currentAction?.parameters.bathroom as MotionInput['bathroom'];
      if (bathroom && entry.bathroomElapsed !== undefined && this.agents.get('morpheus')?.state.controller && !bathroom.paused && !['ready', 'failed', 'done', 'pinning', 'capture_ready'].includes(bathroom.phase))
        entry.bathroomElapsed = Math.min(bathroom.elapsed + .5, entry.bathroomElapsed + delta * speed);
      const bathroomGesture = bathroom && { ...bathroom, elapsed: entry.bathroomElapsed ?? bathroom.elapsed };
      let basement = state.currentAction?.parameters.basement as MotionInput['basement'];
      if (basement?.drop !== undefined && basement.start) {
        entry.basementDropClock = basementDropPlayback(entry.basementDropClock, basement.drop, delta * speed, speed > 0 && !basement.paused);
        basement = { ...basement, drop: entry.basementDropClock.age, landing: basementDropPose(entry.basementDropClock.age).landing };
      } else entry.basementDropClock = undefined;
      const dropRoot = basement?.drop !== undefined && basement.start ? basementDropRoot(basement.role, basement.start, basement.drop) : undefined;
      if (sixthRoot?.hidden) entry.body.visible = entry.marker.visible = entry.label.visible = false;
      if (id !== this.playerId) {
        const previous = entry.group.position.clone();
        const target = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
        const driver = this.playerId ? this.agents.get(this.playerId) : undefined;
        if (disarmGesture) { entry.group.position.copy(target); guideHeading = state.rotation; }
        else if (reunionGesture) {
          const root = ceasefireReunionPose(reunionGesture, reunionGesture.role), center = FILM_SETS.film_zion_temple.center;
          entry.group.position.set(center.x + root.x, state.position.y, center.z + root.z); guideHeading = root.yaw;
        } else if (gardenGesture) {
          const root = gardenPose(gardenGesture, gardenGesture.role), center = FILM_SETS.film_sunrise_garden.center;
          entry.group.position.set(center.x + root.x, center.y + gardenGroundHeight(root.x, root.z), center.z + root.z); guideHeading = root.yaw;
        } else if (clubGesture) {
          const root = clubRoot(clubGesture, clubGesture.role), center = FILM_SETS.film_white_rabbit_club.center;
          entry.group.position.set(center.x + root.x, state.position.y, center.z + root.z); guideHeading = root.yaw;
          if (delta * speed > 0) guideSpeed = entry.group.position.distanceTo(previous) / (delta * speed);
        } else if (dropRoot) {
          const center = FILM_SETS.film_ambush_house.center;
          entry.group.position.set(center.x + dropRoot.x, center.y + dropRoot.y, center.z + dropRoot.z); guideHeading = dropRoot.yaw; guideSpeed = dropRoot.speed;
        } else if (bathroomGesture) {
          const root = bathroomFightRoot(bathroomGesture, bathroomGesture.role), center = FILM_SETS.film_ambush_house.center;
          entry.group.position.set(center.x + root.x, state.position.y, center.z + root.z); guideHeading = root.yaw;
        } else if (sixthRoot) {
          const before = entry.group.position.clone(), center = FILM_SETS.film_ambush_house.center;
          entry.group.position.set(center.x + sixthRoot.x, center.y + sixthRoot.y, center.z + sixthRoot.z); guideHeading = sixthRoot.yaw;
          if (!sixthRoot.hanging && delta * speed > 0) guideSpeed = entry.group.position.distanceTo(before) / (delta * speed);
        } else if (entry.wetwallGuide && state.currentAction?.parameters.wetwall) {
          const wall = state.currentAction.parameters.wetwall as NonNullable<MotionInput['wetwall']>, guide = entry.wetwallGuide, before = guide.progress;
          guide.elapsed = Math.min(.5, guide.elapsed + delta * speed);
          guide.progress = THREE.MathUtils.lerp(guide.from, guide.to, guide.elapsed / .5);
          const pose = wetwallPose(wall.start, wall.role, guide.progress, wall.phase, wall.elapsed, wall.fallY, wall.continued), center = FILM_SETS.film_ambush_house.center;
          entry.group.position.set(center.x + pose.x, center.y + pose.y, center.z + pose.z); guideHeading = pose.yaw;
          if (speed > 0 && delta > 0 && !pose.hanging) guideSpeed = Math.abs(guide.progress - before) / (delta * speed);
        } else if (entry.mirrorGuide) {
          const guide = entry.mirrorGuide, before = guide.progress;
          guide.elapsed = Math.min(.5, guide.elapsed + delta * speed);
          guide.progress = THREE.MathUtils.lerp(guide.from, guide.to, guide.elapsed / .5);
          const pose = mirrorGuidePose(guide.progress), center = FILM_SETS.film_lafayette.center;
          entry.group.position.set(center.x + pose.x, state.position.y, center.z + pose.z);
          guideHeading = pose.yaw;
          if (speed > 0 && delta > 0) guideSpeed = Math.abs(guide.progress - before) / (delta * speed);
        } else if (entry.oracleGuide) {
          const guide = entry.oracleGuide, before = guide.progress;
          guide.elapsed = Math.min(.5, guide.elapsed + delta * speed); guide.progress = THREE.MathUtils.lerp(guide.from, guide.to, guide.elapsed / .5);
          const pose = oracleReceptionRoot({ phase: guide.phase, progress: guide.progress, elapsed: 0 }), center = FILM_SETS.film_oracle_home.center;
          entry.group.position.set(center.x + pose.x, state.position.y, center.z + pose.z); guideHeading = pose.yaw;
          if (speed > 0 && delta > 0) guideSpeed = Math.abs(guide.progress - before) / (delta * speed);
        } else if (entry.ambushGuide) {
          const guide = entry.ambushGuide, before = guide.progress;
          guide.elapsed = Math.min(.5, guide.elapsed + delta * speed); guide.progress = THREE.MathUtils.lerp(guide.from, guide.to, guide.elapsed / .5);
          const pose = guide.retreat ? ambushRetreatRoot(guide.progress, guide.role) : ambushRouteRoot(guide.progress, guide.role, guide.stairCat), center = FILM_SETS.film_ambush_house.center;
          entry.group.position.set(center.x + pose.x, center.y + pose.y, center.z + pose.z);
          guideHeading = (state.currentAction?.parameters.ambushEscort as AmbushEscort).watching ? state.rotation : pose.yaw;
          if (speed > 0 && delta > 0) guideSpeed = Math.abs(guide.progress - before) / (delta * speed);
        } else if (state.currentAction?.parameters.metacortexLift || state.currentAction?.parameters.officeCustody && (delta * speed === 0 || (state.currentAction.parameters.officeCustody as MotionInput['officeCustody'])?.street?.phase !== undefined && (state.currentAction.parameters.officeCustody as MotionInput['officeCustody'])?.street?.phase !== 'approaching')) entry.group.position.copy(target);
        else if (state.currentAction?.parameters.architect || state.currentAction?.parameters.sourcePortal || state.currentAction?.parameters.trinityTerminal || state.currentAction?.parameters.trinityRelay || state.currentAction?.parameters.oracleReception || state.currentAction?.parameters.oracleWaiting || state.currentAction?.parameters.oracleRequest || state.currentAction?.parameters.oracleLast || state.currentAction?.parameters.baneInquiry || state.currentAction?.parameters.hammerBriefing || state.currentAction?.parameters.zionDeployment || state.currentAction?.parameters.maggieDiscovery || state.currentAction?.parameters.logosBane || state.currentAction?.parameters.oracleAbsorption || state.currentAction?.parameters.trainmanChase || state.currentAction?.parameters.helGarage || state.currentAction?.parameters.helElevator || state.currentAction?.parameters.helProtection !== undefined
          || (state.currentAction?.parameters.oracleArrival as MotionInput['oracleArrival'])?.phase === 'opening'
          || ((state.currentAction?.parameters.oracleArrival as MotionInput['oracleArrival'])?.seating ?? 0) > 0) entry.group.position.copy(target);
        else if (state.currentAction?.parameters.freewayRide) entry.group.position.copy(target);
        else if (state.currentAction?.parameters.mobilReunion || state.currentAction?.parameters.mobilBoarding !== undefined) entry.group.position.copy(target);
        else if (state.currentAction?.parameters.passenger && driver?.state.currentAction?.parameters.riding) {
          target.sub(new THREE.Vector3(driver.state.position.x, driver.state.position.y, driver.state.position.z)).add(driver.group.position);
          entry.group.position.copy(target);
        } else if (state.currentAction?.parameters.truckRoad || state.currentAction?.parameters.freewayHandoff || state.currentAction?.parameters.freewayPickup || state.currentAction?.parameters.freewayDriver || smithLocked || state.currentAction?.parameters.oracleRestored || state.currentAction?.parameters.epilogue || state.currentAction?.parameters.upperDigger || state.currentAction?.parameters.diggers || state.currentAction?.parameters.dockReload || state.currentAction?.parameters.dockLastStand || state.currentAction?.parameters.dockGate || state.currentAction?.parameters.dockGateCover || state.currentAction?.parameters.dockReunion || state.currentAction?.parameters.dockDeparture || state.currentAction?.parameters.dockEvacuation || state.currentAction?.parameters.shaftSeal || state.currentAction?.parameters.templeDefense || state.currentAction?.parameters.dockBriefing || state.currentAction?.parameters.empOperator || state.currentAction?.parameters.openingRoofLeap !== undefined) entry.group.position.copy(target);
        else if (state.currentAction?.parameters.truckPassenger || state.currentAction?.parameters.truckFlight || state.currentAction?.parameters.farewell || state.currentAction?.parameters.club || state.currentAction?.parameters.sentinel || state.currentAction?.parameters.interlude || state.currentAction?.parameters.oracleVisit || state.currentAction?.parameters.oracleDeparture || state.currentAction?.parameters.crosscut || state.currentAction?.parameters.betrayal || state.currentAction?.parameters.rescue || state.currentAction?.parameters.government || state.currentAction?.parameters.airRescue || state.currentAction?.parameters.matrixEscape || state.currentAction?.parameters.theOne || state.currentAction?.parameters.reloaded || state.currentAction?.parameters.catch || state.currentAction?.parameters.lobbyEntry || state.currentAction?.parameters.meeting || state.currentAction?.parameters.pills || state.currentAction?.parameters.interrogation || state.currentAction?.parameters.welcome || state.currentAction?.parameters.reveal || state.currentAction?.parameters.training || state.currentAction?.parameters.workday || state.currentAction?.parameters.recoveryCrew || state.currentAction?.parameters.mirrorEntry || entry.group.position.distanceTo(target) > 60) entry.group.position.copy(target);
        else entry.group.position.lerp(target, 1 - Math.exp(-8 * delta));
        if (state.currentAction?.parameters.basement && !dropRoot && delta * speed > 0) guideSpeed = entry.group.position.distanceTo(previous) / (delta * speed);
      }
      const hammerPilot = state.currentAction?.parameters.hammerPilot as MotionInput['hammerPilot'];
      if (!hammerPilot && entry.hammerPilot) entry.body.rotation.z = 0;
      entry.hammerPilot = Boolean(hammerPilot);
      if (hammerPilot) {
        const point = hammerCrewRoot(hammerPilot.flight, hammerPilot.role, hammerPilot.handover), center = FILM_SETS.film_hammer_route.center;
        entry.group.position.set(center.x + point.x, center.y + point.y, center.z + point.z); guideHeading = point.yaw;
        entry.body.rotation.y = point.yaw;
        if (hammerPilot.role === 'ghost' && hammerPilot.handover?.phase === 'ready' && !hammerPilot.flight.gunnery) entry.body.visible = false;
      }
      const moving = Math.hypot(state.velocity.x, state.velocity.z) > .1;
      const heading = guideHeading ?? (moving && state.currentAction?.parameters.helProtection === undefined && !state.currentAction?.parameters.helElevator && !state.currentAction?.parameters.helGarage && !state.currentAction?.parameters.trainmanChase && !state.currentAction?.parameters.truckRoad && !state.currentAction?.parameters.freewayHandoff && !state.currentAction?.parameters.freewayPickup && !state.currentAction?.parameters.freewayDriver && !smithLocked && !state.currentAction?.parameters.mirrorEntry && !state.currentAction?.parameters.officeCustody && !state.currentAction?.parameters.oracleLast && !state.currentAction?.parameters.baneInquiry && !state.currentAction?.parameters.hammerBriefing && !state.currentAction?.parameters.zionDeployment && !state.currentAction?.parameters.maggieDiscovery && !state.currentAction?.parameters.logosBane && !state.currentAction?.parameters.oracleAbsorption && !state.currentAction?.parameters.oracleArrival && !state.currentAction?.parameters.oracleReception && !state.currentAction?.parameters.oracleDeparture && !state.currentAction?.parameters.club && !state.currentAction?.parameters.upperDigger && !state.currentAction?.parameters.diggers && !state.currentAction?.parameters.dockReload && !state.currentAction?.parameters.dockLastStand && !state.currentAction?.parameters.catch && !state.currentAction?.parameters.truckRescue && !state.currentAction?.parameters.recoveryCrew && state.currentLocation !== 'film_government_lobby' ? Math.atan2(state.velocity.x, state.velocity.z) : state.rotation);
      let difference = heading - entry.body.rotation.y;
      difference = Math.atan2(Math.sin(difference), Math.cos(difference));
      if (id !== this.playerId && (state.currentAction?.parameters.helProtection !== undefined || state.currentAction?.parameters.helElevator || state.currentAction?.parameters.helGarage || state.currentAction?.parameters.trainmanChase || state.currentAction?.parameters.mobilReunion || state.currentAction?.parameters.mobilBoarding !== undefined || state.currentAction?.parameters.oracleRequest || state.currentAction?.parameters.oracleLast || state.currentAction?.parameters.baneInquiry || state.currentAction?.parameters.hammerBriefing || state.currentAction?.parameters.zionDeployment || state.currentAction?.parameters.maggieDiscovery || state.currentAction?.parameters.logosBane || state.currentAction?.parameters.oracleAbsorption || state.currentAction?.parameters.architect || state.currentAction?.parameters.sourcePortal || state.currentAction?.parameters.truckRoad || state.currentAction?.parameters.freewayHandoff || state.currentAction?.parameters.freewayPickup || state.currentAction?.parameters.freewayDriver || smithLocked || state.currentAction?.parameters.oracleRestored || state.currentAction?.parameters.epilogue || state.currentAction?.parameters.upperDigger || state.currentAction?.parameters.diggers || state.currentAction?.parameters.dockReload || state.currentAction?.parameters.dockLastStand || state.currentAction?.parameters.dockGate || state.currentAction?.parameters.dockGateCover || state.currentAction?.parameters.dockReunion || state.currentAction?.parameters.dockDeparture || state.currentAction?.parameters.dockEvacuation || state.currentAction?.parameters.shaftSeal || state.currentAction?.parameters.templeDefense || state.currentAction?.parameters.dockBriefing || state.currentAction?.parameters.empOperator || state.currentAction?.parameters.officeCustody && (delta * speed === 0 || (state.currentAction.parameters.officeCustody as MotionInput['officeCustody'])?.street))) { entry.body.rotation.y = heading; difference = 0; }
      const arrival = state.currentAction?.parameters.oracleArrival as MotionInput['oracleArrival'];
      if (id !== this.playerId && clubGesture) entry.body.rotation.y += delta * speed > 0 ? Math.sign(difference) * Math.min(Math.abs(difference), 2.4 * delta * speed) : difference;
      else if (id !== this.playerId) entry.body.rotation.y += difference * (dropRoot || entry.wetwallGuide || entry.ambushGuide && delta === 0 || arrival?.phase === 'opening' || (arrival?.seating ?? 0) > 0 || state.currentAction?.parameters.farewell || state.currentAction?.parameters.sentinel || state.currentAction?.parameters.interlude || state.currentAction?.parameters.oracleVisit || state.currentAction?.parameters.oracleDeparture || state.currentAction?.parameters.crosscut || state.currentAction?.parameters.betrayal || state.currentAction?.parameters.rescue || state.currentAction?.parameters.government || state.currentAction?.parameters.airRescue || state.currentAction?.parameters.matrixEscape || state.currentAction?.parameters.theOne || state.currentAction?.parameters.reloaded || state.currentAction?.parameters.catch || state.currentAction?.parameters.lobbyEntry || state.currentAction?.parameters.meeting || state.currentAction?.parameters.pills || state.currentAction?.parameters.interrogation || state.currentAction?.parameters.welcome || state.currentAction?.parameters.reveal || state.currentAction?.parameters.training || state.currentAction?.parameters.workday || state.currentAction?.parameters.recoveryCrew || state.currentAction?.parameters.mirrorEntry ? 1 : 1 - Math.exp(-10 * delta));
      const velocity = state.status === 'alive' ? Math.hypot(state.velocity.x, state.velocity.z) : 0;
      entry.body.rotation.z = THREE.MathUtils.lerp(entry.body.rotation.z, state.status === 'dead' && !state.currentAction?.parameters.sourcePortal && !state.currentAction?.parameters.crosscut && !state.currentAction?.parameters.farewell && !state.currentAction?.parameters.dockLastStand && !state.currentAction?.parameters.upperDigger && !state.currentAction?.parameters.logosBane ? Math.PI / 2 : 0, 1 - Math.exp(-7 * delta));
      const dist = camera ? entry.group.position.distanceTo(camera.position) : 0;
      const floor = groundHeight(state.position, state.isInMatrix);
      const input: MotionInput = id === this.playerId && this.playerMotion ? this.playerMotion : {
        speed: clubGesture || state.currentAction?.parameters.basement || sixthRoot || entry.mirrorGuide || entry.oracleGuide || entry.ambushGuide || entry.wetwallGuide ? guideSpeed : velocity, grounded: state.currentAction?.parameters.truckRoad ? id !== 'niobe' && !(id === 'agent_johnson' && (state.currentAction.parameters.truckRoad as MotionInput['truckRoad'])?.phase === 'dropping') : dropRoot ? !basementDropPose(basement!.drop!).airborne : Boolean(state.currentAction?.parameters.riding || state.currentAction?.parameters.climbing || state.currentAction?.parameters.wetwall) || state.position.y <= floor + .12, verticalVelocity: dropRoot ? basementDropPose(basement!.drop!).verticalVelocity : state.velocity.y,
        turn: difference * 8, attack: state.currentAction?.type === 'attack' ? Number(state.currentAction.parameters.contactTick ?? state.currentAction.startedAt) : undefined,
        hit: entry.hit, impact: entry.impact, shot: entry.shot, windingUp: warning,
        armed: state.currentAction?.parameters.armed === true || !state.currentAction?.parameters.lobbyEntry && state.currentLocation === 'film_government_lobby' && ['neo', 'trinity'].includes(id),
        ambushEscort: state.currentAction?.parameters.ambushEscort as MotionInput['ambushEscort'],
        wetwall: state.currentAction?.parameters.wetwall as MotionInput['wetwall'],
        basement,
        tvExit: state.currentAction?.parameters.tvExit as MotionInput['tvExit'],
        crosscut: state.currentAction?.parameters.crosscut as MotionInput['crosscut'],
        sixth: sixthGesture,
        crouching: state.currentAction?.parameters.crouching === true,
        seated: state.currentAction?.parameters.seated === true,
        mobilSeat: state.currentAction?.parameters.mobilSeat as number | undefined,
        mirrorRise: entry.mirrorGuide ? Number(state.currentAction?.parameters.mirrorRise ?? (state.currentAction?.parameters.seated ? 0 : 1)) : undefined,
        floorSeated: state.currentAction?.parameters.floorSeated === true,
        spoon: state.currentAction?.parameters.spoon as number | undefined,
        spoonLesson: state.currentAction?.parameters.spoonLesson as MotionInput['spoonLesson'],
        phone: state.currentAction?.parameters.phone as MotionInput['phone'],
        window: state.currentAction?.parameters.window as number | undefined,
        crossing: state.currentAction?.parameters.crossing as number | undefined,
        pills: state.currentAction?.parameters.pills as MotionInput['pills'],
        interrogation: state.currentAction?.parameters.interrogation as MotionInput['interrogation'],
        meeting: state.currentAction?.parameters.meeting as MotionInput['meeting'],
        welcome: state.currentAction?.parameters.welcome as MotionInput['welcome'],
        knock: state.currentAction?.parameters.knock as number | undefined,
        recovery: state.currentAction?.parameters.recovery as number | undefined,
        recoveryCrew: state.currentAction?.parameters.recoveryCrew as MotionInput['recoveryCrew'],
        medical: state.currentAction?.parameters.medical as number | undefined,
        cabin: state.currentAction?.parameters.cabin as MotionInput['cabin'],
        truth: state.currentAction?.parameters.truth as MotionInput['truth'],
        download: state.currentAction?.parameters.download as MotionInput['download'],
        construct: state.currentAction?.parameters.construct as MotionInput['construct'],
        performance: state.currentAction?.parameters.filmPose as MotionInput['performance'],
        mirrorBeat: state.currentAction?.parameters.mirrorBeat as number | undefined,
        mirrorEntry: state.currentAction?.parameters.mirrorEntry as MotionInput['mirrorEntry'],
        mirrorCrew: state.currentAction?.parameters.mirrorCrew as number | undefined,
        helDanceDoor: state.currentAction?.parameters.helDanceDoor as number | undefined,
        helDisarm: state.currentAction?.parameters.helDisarm as MotionInput['helDisarm'],
        helBreakout: state.currentAction?.parameters.helBreakout as MotionInput['helBreakout'],
        reveal: state.currentAction?.parameters.reveal as MotionInput['reveal'],
        training: state.currentAction?.parameters.training as MotionInput['training'],
        workday: state.currentAction?.parameters.workday as MotionInput['workday'],
        contact: state.currentAction?.parameters.contact as MotionInput['contact'],
        homeClothes: id === 'neo' && ['neo_apartment', 'film_anderson_flat'].includes(state.currentLocation),
        computerCheck: state.currentAction?.parameters.computerCheck as MotionInput['computerCheck'],
        wakeCall: state.currentAction?.parameters.wakeCall as MotionInput['wakeCall'],
        morning: state.currentAction?.parameters.morning as MotionInput['morning'],
        club: clubGesture,
        sentinel: state.currentAction?.parameters.sentinel as MotionInput['sentinel'],
        interlude: state.currentAction?.parameters.interlude as MotionInput['interlude'],
        oracleVisit: state.currentAction?.parameters.oracleVisit as MotionInput['oracleVisit'],
        oracleDeparture: state.currentAction?.parameters.oracleDeparture as MotionInput['oracleDeparture'],
        oracleArrival: state.currentAction?.parameters.oracleArrival as MotionInput['oracleArrival'],
        oracleReception: state.currentAction?.parameters.oracleReception as MotionInput['oracleReception'],
        oracleWaiting: state.currentAction?.parameters.oracleWaiting as MotionInput['oracleWaiting'],
        oracleRestored: state.currentAction?.parameters.oracleRestored as boolean | undefined,
        betrayal: state.currentAction?.parameters.betrayal as MotionInput['betrayal'],
        bathroom: bathroomGesture,
        rescue: state.currentAction?.parameters.rescue as MotionInput['rescue'],
        government: state.currentAction?.parameters.government as MotionInput['government'],
        airRescue: state.currentAction?.parameters.airRescue as MotionInput['airRescue'],
        matrixEscape: state.currentAction?.parameters.matrixEscape as MotionInput['matrixEscape'],
        theOne: state.currentAction?.parameters.theOne as MotionInput['theOne'],
        reloaded: state.currentAction?.parameters.reloaded as MotionInput['reloaded'],
        catch: state.currentAction?.parameters.catch as MotionInput['catch'],
        hotel303: state.currentAction?.parameters.hotel303 as MotionInput['hotel303'],
        openingRoofLeap: state.currentAction?.parameters.openingRoofLeap as number | undefined,
        burly: state.currentAction?.parameters.burly as MotionInput['burly'],
        chateauWeapon: state.currentAction?.parameters.chateauWeapon as MotionInput['chateauWeapon'],
        mountainFlight: state.currentAction?.parameters.mountainFlight as MotionInput['mountainFlight'],
        truckFlight: state.currentAction?.parameters.truckFlight as boolean | undefined,
        truckPassenger: state.currentAction?.parameters.truckPassenger as boolean | undefined,
        truckRescue: state.currentAction?.parameters.truckRescue as MotionInput['truckRescue'],
        persephone: state.currentAction?.parameters.persephone as MotionInput['persephone'],
        farewell: state.currentAction?.parameters.farewell as MotionInput['farewell'],
        deusPact: state.currentAction?.parameters.deusPact as MotionInput['deusPact'],
        smithFinale: state.currentAction?.parameters.smithFinale as MotionInput['smithFinale'],
        epilogue: gardenGesture || reunionGesture || epilogue,
        diggers: state.currentAction?.parameters.diggers as MotionInput['diggers'],
        upperDigger: state.currentAction?.parameters.upperDigger as MotionInput['upperDigger'],
        dockReload: state.currentAction?.parameters.dockReload as MotionInput['dockReload'],
        dockLastStand: state.currentAction?.parameters.dockLastStand as MotionInput['dockLastStand'],
        dockGate: state.currentAction?.parameters.dockGate as MotionInput['dockGate'],
        empOperator: state.currentAction?.parameters.empOperator as MotionInput['empOperator'],
        dockReunion: state.currentAction?.parameters.dockReunion as MotionInput['dockReunion'],
        dockDeparture: state.currentAction?.parameters.dockDeparture as MotionInput['dockDeparture'],
        dockBriefing: state.currentAction?.parameters.dockBriefing as MotionInput['dockBriefing'],
        sourceBriefing: state.currentAction?.parameters.sourceBriefing as MotionInput['sourceBriefing'],
        mobilFamily: state.currentAction?.parameters.mobilFamily as MotionInput['mobilFamily'],
        mobilReunion: state.currentAction?.parameters.mobilReunion as MotionInput['mobilReunion'],
        trinityRelay: state.currentAction?.parameters.trinityRelay as MotionInput['trinityRelay'],
        sourcePortal: state.currentAction?.parameters.sourcePortal as MotionInput['sourcePortal'],
        architect: state.currentAction?.parameters.architect as MotionInput['architect'],
        trinityTerminal: state.currentAction?.parameters.trinityTerminal as MotionInput['trinityTerminal'],
        primaryDemolition: state.currentAction?.parameters.primaryDemolition as MotionInput['primaryDemolition'],
        dockEvacuation: state.currentAction?.parameters.dockEvacuation as MotionInput['dockEvacuation'],
        shaftSeal: state.currentAction?.parameters.shaftSeal as MotionInput['shaftSeal'],
        templeDefense: state.currentAction?.parameters.templeDefense as MotionInput['templeDefense'],
        dockGunnery: state.currentAction?.parameters.dockGunnery as MotionInput['dockGunnery'],
        apuDriving: state.currentAction?.parameters.apuDriving === true,
        dockGateCover: state.currentAction?.parameters.dockGateCover as MotionInput['dockGateCover'],
        lobbyEntry: state.currentAction?.parameters.lobbyEntry as MotionInput['lobbyEntry'],
        weaponStyle: state.currentAction?.parameters.weaponStyle as MotionInput['weaponStyle'],
        vase: state.currentAction?.parameters.vase as number | undefined,
        riding: state.currentAction?.parameters.riding === true,
        freewayPickup: state.currentAction?.parameters.freewayPickup as MotionInput['freewayPickup'],
        freewayDriver: state.currentAction?.parameters.freewayDriver as MotionInput['freewayDriver'],
        freewayRide: state.currentAction?.parameters.freewayRide as MotionInput['freewayRide'],
        truckRoad: state.currentAction?.parameters.truckRoad as MotionInput['truckRoad'],
        truckWeapons: state.currentAction?.parameters.truckWeapons as MotionInput['truckWeapons'],
        truckHood: state.currentAction?.parameters.truckHood as MotionInput['truckHood'],
        freewayHandoff: state.currentAction?.parameters.freewayHandoff as MotionInput['freewayHandoff'],
        climbing: state.currentAction?.parameters.climbing ? Number(state.currentAction.parameters.climbDirection ?? 0) : undefined,
      };
      // The ruined city is still a loading program: actors keep their residual
      // self image even though the represented place is the real world.
      if (input.crosscut?.role === 'cypher' && input.crosscut.phase === 'call') {
        const role = input.crosscut.elapsed < 14 ? 'apoc' : 'switch', body = this.getPhysicalBody(role);
        const socket = body?.getObjectByName('cervical-interface') ?? body?.getObjectByName('head');
        socket?.updateWorldMatrix(true, false); const point = socket?.getWorldPosition(new THREE.Vector3());
        if (point) input.crosscut = { ...input.crosscut, contact: { x: point.x, y: point.y, z: point.z } };
      } else if (input.crosscut && input.armed) {
        const target = input.crosscut.role === 'tank' ? 'cypher' : input.crosscut.elapsed < 4 ? 'tank' : 'dozer';
        const entry = this.agents.get(target), point = entry?.rig.hero?.bones.get('chest')?.getWorldPosition(new THREE.Vector3());
        if (point) input.crosscut = { ...input.crosscut, contact: { x: point.x, y: point.y, z: point.z } };
      }
      if (input.upperDigger?.role === 'zee') {
        upperSupport = { entry, gesture: input.upperDigger };
      }
      if (doorPush !== undefined) input.helDanceDoor = doorPush;
      input.helDoorPush = physicalDoor;
      if (disarmGesture) { input.helDisarm = disarmGesture; input.weaponStyle = 'hel_pistol'; input.armed = disarmGesture.elapsed < HEL_DISARM.release; }
      if (breakoutClock && ['trinity', 'seraph'].includes(id) && state.status === 'alive'
        && state.currentLocation === 'film_club_hel' && (!state.controller || id === this.playerId)) {
        input.helBreakout = { ...breakoutClock, role: id as 'trinity' | 'seraph' }; input.weaponStyle = 'hel_pistol';
        input.armed = id === 'trinity' && breakoutClock.phase === 'catching';
      }
      input.realWorld = !state.isInMatrix && state.currentLocation !== 'film_real_desert';
      input.nebCrew = input.realWorld && ((journey?.visiting ?? journey?.scene)?.startsWith('m2_') || journey?.scene === 'm3_logos_plan')
        && ['film_neb_deck', 'film_service_tunnels', 'film_hammer_deck'].includes(state.currentLocation)
        && ['neo', 'morpheus', 'trinity', 'link'].includes(id) ? id as NonNullable<MotionInput['nebCrew']> : undefined;
      input.signal = id === 'neo' && input.realWorld && journey?.scene === 'm2_stop_sentinels' && !journey.visiting
        && journey.tunnel?.phase !== 'running' ? journey.tunnel : undefined;
      input.mobilRefusal = !journey?.visiting && journey?.scene === 'm3_trainman' && journey.mobil?.phase === 'refusing'
        && (id === 'neo' || id === 'trainman') ? { role: id, elapsed: journey.mobil.elapsed } : undefined;
      const luggage = !journey?.visiting && journey?.scene === 'm3_trainman' ? journey.mobil?.luggage : undefined;
      input.mobilLuggage = luggage && (id === 'neo' && ['lifting', 'carried'].includes(luggage.phase)
        || id === 'rama_kandra' && ['retrieving', 'returned'].includes(luggage.phase)) ? { role: id as 'neo' | 'rama_kandra', luggage } : undefined;
      input.oracleRevolutions = id === 'oracle' && state.currentLocation === 'film_oracle_home'
        && ['m3_oracle_request', 'm3_oracle_last', 'm3_oracle_absorbed'].includes(journey?.visiting ?? journey?.scene ?? '');
      input.oracleRequest = state.currentAction?.parameters.oracleRequest as MotionInput['oracleRequest'];
      input.oracleLast = state.currentAction?.parameters.oracleLast as MotionInput['oracleLast'];
      input.baneInquiry = state.currentAction?.parameters.baneInquiry as MotionInput['baneInquiry'];
      input.hammerBriefing = state.currentAction?.parameters.hammerBriefing as MotionInput['hammerBriefing'];
      input.hammerPilot = hammerPilot;
      input.zionDeployment = state.currentAction?.parameters.zionDeployment as MotionInput['zionDeployment'];
      input.maggieDiscovery = state.currentAction?.parameters.maggieDiscovery as MotionInput['maggieDiscovery'];
      input.logosBane = (id === this.playerId ? this.playerMotion?.logosBane : state.currentAction?.parameters.logosBane) as MotionInput['logosBane'];
      if (input.logosBane?.role === 'bane') {
        const other = this.agents.get(input.logosBane.encounter.phase === 'burning' ? 'neo' : 'trinity');
        const head = other?.rig.hero?.bones.get('head') ?? other?.rig.head;
        if (head) { head.updateWorldMatrix(true, false); const contact = head.localToWorld(new THREE.Vector3(0, input.logosBane.encounter.phase === 'burning' ? .01 : -.37, .18)); input.logosBane = { ...input.logosBane, contact }; }
      } else if (input.logosBane?.encounter.physical?.rescue === 'checking') {
        const trinity = input.logosBane.role === 'trinity', other = this.agents.get(trinity ? 'neo' : 'trinity');
        const head = other?.rig.hero?.bones.get('head') ?? other?.rig.head;
        if (head) {
          head.updateWorldMatrix(true, false);
          const handContacts = [0, 1].map(i => head.localToWorld(new THREE.Vector3((i ? -1 : 1) * (trinity ? .18 : .25), trinity ? -.2 : -.6, trinity ? .18 : -.12))) as [THREE.Vector3, THREE.Vector3];
          input.logosBane = { ...input.logosBane, handContacts };
        }
      }
      input.oracleAbsorption = state.currentAction?.parameters.oracleAbsorption as MotionInput['oracleAbsorption'];
      input.trainmanChase = state.currentAction?.parameters.trainmanChase as MotionInput['trainmanChase'];
      input.helGarage = state.currentAction?.parameters.helGarage as MotionInput['helGarage'];
      input.helElevator = typeof state.currentAction?.parameters.helElevator === 'object' ? state.currentAction.parameters.helElevator as MotionInput['helElevator'] : undefined;
      input.parkOutfit = state.currentLocation === 'film_sunrise_garden';
      input.farewellOutfit = input.realWorld && (id === 'neo' || id === 'trinity')
        && (state.currentLocation === 'film_logos_wreck' || id === 'neo' && state.currentLocation === 'film_machine_core') ? id : undefined;
      if (input.wetwall && !input.sixth && id !== this.playerId && entry.wetwallGuide) {
        const progress = entry.wetwallGuide.progress, wall = input.wetwall, pose = wetwallPose(wall.start, wall.role, progress, wall.phase, wall.elapsed, wall.fallY, wall.continued);
        input.wetwall = { ...wall, progress, hanging: pose.hanging }; input.climbing = pose.hanging ? 0 : undefined;
      }
      const podBeat = journey?.scene === 'm1_pod' && !journey.visiting ? journey.awakening : undefined;
      const podBody = state.id === 'neo' && state.currentLocation === 'film_power_plant_pods' && journey?.scene === 'm1_pod' && !journey.visiting;
      input.podWake = podBody && (input.performance === 'pod' || podBeat?.kind === 'disconnect' && podBeat.elapsed < 5.2)
        ? podBeat?.kind === 'breather' ? Math.min(1.35, podBeat.elapsed)
          : podBeat?.kind === 'disconnect' ? Math.max(podBeat.breatherRemoved ? 1.35 : 0, podBeat.elapsed) : 0 : undefined;
      input.podBreather = podBody && podBeat?.kind === 'breather' ? podBeat.elapsed : undefined;
      input.podRescue = journey?.scene === 'm1_pod' && !journey.visiting && input.performance === 'lift' && journey.awakening?.kind === 'rescue'
        ? journey.awakening.elapsed : undefined;
      input.officeShirt = officeClothing(state.id, state.currentLocation);
      input.clubClothes = state.currentLocation === 'film_white_rabbit_club' || state.id === 'neo' && state.currentLocation === 'film_white_construct' && !state.currentAction?.parameters.rescue;
      input.mobilStation = state.currentLocation === 'film_mobil_station';
      input.glasses = !state.id.startsWith('oracle_') && !input.clubClothes && (state.id !== 'neo' || state.isAwakened && !['film_oracle_home', 'film_mobil_station'].includes(state.currentLocation));
      if (input.sixth?.role === 'smith' && input.sixth.phase === 'grapple') {
        const neo = this.agents.get('neo'), head = neo?.rig.hero?.bones.get('head');
        if (head) {
          neo!.group.updateWorldMatrix(true, true);
          const point = head.localToWorld(new THREE.Vector3(0, -.17, .04));
          input.sixth = { ...input.sixth, contact: { x: point.x, y: point.y, z: point.z } };
        }
      }
      if (input.oracleDeparture?.role === 'morpheus' && input.oracleDeparture.phase === 'talking') {
        const neo = this.agents.get('neo'), shoulder = neo?.rig.hero?.bones.get('shoulder_R') ?? neo?.rig.shoulders[0];
        if (neo && shoulder) {
          neo.group.updateWorldMatrix(true, true);
          const point = shoulder.localToWorld(new THREE.Vector3(0, -.12, .07));
          input.oracleDeparture = { ...input.oracleDeparture, target: { x: point.x, y: point.y, z: point.z } };
        }
      }
      if (input.oracleReception?.phase === 'inviting') {
        const neo = this.agents.get('neo'), shoulder = neo?.rig.hero?.bones.get('shoulder_R') ?? neo?.rig.shoulders[0];
        if (neo && shoulder) {
          neo.group.updateWorldMatrix(true, true);
          const point = shoulder.localToWorld(new THREE.Vector3(0, -.12, .07));
          input.oracleReception = { ...input.oracleReception, target: { x: point.x, y: point.y, z: point.z } };
        }
      }
      if (input.recoveryCrew) {
        const neo = this.agents.get('neo'); const shoulder = neo?.rig.hero?.bones.get(input.recoveryCrew.role === 'morpheus' ? 'shoulder_R' : 'shoulder_L');
        if (neo && shoulder) {
          neo.group.updateWorldMatrix(true, true);
          const target = shoulder.localToWorld(new THREE.Vector3(0, -.16, .06));
          input.recoveryCrew = { ...input.recoveryCrew, target: { x: target.x, y: target.y, z: target.z } };
        }
      }
      if (input.truth?.phase === 'unplug' && (input.truth.role === 'trinity' || input.truth.role === 'dozer')) {
        const neo = this.agents.get('neo');
        const targetObject = input.truth.role === 'trinity' ? neo?.body.getObjectByName('cervical-interface') : neo?.rig.hero?.bones.get('shoulder_R');
        if (neo && targetObject) {
          neo.group.updateWorldMatrix(true, true);
          const point = targetObject.getWorldPosition(new THREE.Vector3());
          if (input.truth.role === 'trinity') point.x += .49 + .7 * THREE.MathUtils.smoothstep(input.truth.elapsed, 1.5, 3.2);
          input.truth = { ...input.truth, target: { x: point.x, y: point.y, z: point.z } };
        }
      }
      if (input.download?.phase === 'connecting' && input.download.role === 'tank') {
        const neo = this.agents.get('neo'), socket = neo?.body.getObjectByName('cervical-interface');
        if (neo && socket) {
          neo.group.updateWorldMatrix(true, true);
          const point = socket.getWorldPosition(new THREE.Vector3());
          point.x += .49 + .7 * (1 - THREE.MathUtils.smoothstep(input.download.elapsed, 3, 4.6));
          input.download = { ...input.download, target: { x: point.x, y: point.y, z: point.z } };
        }
      }
      if (input.cabin?.kind === 'core' && input.cabin.role === 'morpheus') {
        const neo = this.agents.get('neo'); const socket = neo?.body.getObjectByName('cervical-interface');
        if (neo && socket) {
          neo.group.updateWorldMatrix(true, true);
          const target = socket.getWorldPosition(new THREE.Vector3());
          target.x += .49 + .7 * (1 - THREE.MathUtils.smoothstep(input.cabin.elapsed, 3, 4.6));
          input.cabin = { ...input.cabin, target: { x: target.x, y: target.y, z: target.z } };
        }
      }
      if (input.farewell) {
        farewellFrames.push({ entry, gesture: input.farewell });
        input.farewell = { ...input.farewell, target: undefined };
      }
      if (input.mirrorCrew !== undefined) {
        const neo = this.agents.get('neo');
        if (neo) input.mirrorContact = trackingContact(neo.body);
      }
      const mountainFlying = input.mountainFlight && ['takeoff', 'flying', 'arrived'].includes(input.mountainFlight.phase) || input.truckFlight;
      const catchFlying = input.catch && ['departing', 'flight', 'catching', 'ascent', 'landing'].includes(input.catch.phase);
      const coma = state.currentAction?.parameters.finaleComa === true;
      const medicalPatient = coma && state.currentLocation === 'film_hammer_deck' && journey?.scene === 'm2_medical' && !journey.visiting
        && (id === 'neo' || id === 'bane') ? id : undefined;
      const epilogueCarried = input.epilogue?.kind === 'neo_carried' && input.epilogue.role === 'neo';
      const disconnect = journey?.scene === 'm1_pod' && journey.awakening?.kind === 'disconnect' ? journey.awakening.elapsed : 0;
      const pod = state.currentLocation === 'film_power_plant_pods' && (input.performance === 'pod' || disconnect > 0 && disconnect < 5.2);
      const podRecline = pod ? 1 - THREE.MathUtils.smoothstep(disconnect, 3.8, 5.2) : 0;
      entry.body.position.y = input.diggers || input.upperDigger ? 0 : epilogueCarried ? 1.3 : coma ? 2.62 : THREE.MathUtils.lerp(-1, .9, podRecline);
      entry.body.position.z = podRecline * 1.2;
      if (podRecline) entry.body.rotation.y = state.rotation * (1 - podRecline);
      const truckPose = input.truckRescue ? truckRescuePose(input.truckRescue, input.truckRescue.role)
        : input.truckFlight ? { yaw: state.rotation, airborne: 1, tumble: 0 } : undefined;
      entry.body.rotation.order = truckPose ? 'YXZ' : 'XYZ';
      if (!hammerPilot) entry.body.position.x = 0;
      if (truckPose) { entry.body.rotation.y = truckPose.yaw; entry.body.rotation.z = truckPose.tumble; }
      if (input.catch || input.farewell || epilogueCarried || input.oracleRestored || input.dockLastStand) entry.body.rotation.z = 0;
      entry.body.rotation.x = input.catch ? 0 : epilogueCarried ? Math.PI / 2 : truckPose ? Math.PI / 2 * truckPose.airborne : input.farewell?.role === 'trinity' ? -.48
        : mountainFlying ? THREE.MathUtils.lerp(entry.body.rotation.x, 1.05, 1 - Math.exp(-6 * delta))
        : coma || epilogueCarried ? THREE.MathUtils.lerp(entry.body.rotation.x, -Math.PI / 2, 1 - Math.exp(-6 * delta)) : -Math.PI / 2 * podRecline;
      if (hammerPilot) {
        const pose = hammerShipPose(hammerPilot.flight);
        const direction = hammerPilot.role === 'ghost' && hammerPilot.flight.gunnery ? 1 : -1;
        entry.body.rotation.set(direction * pose.pitch, hammerCrewRoot(hammerPilot.flight, hammerPilot.role, hammerPilot.handover).yaw, direction * pose.roll, 'YXZ');
        // The one-unit actor offset follows all three axes, including a ninety-degree bank.
        entry.body.position.set(0, -1, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch, pose.yaw, pose.roll, 'YXZ')));
      }
      if (medicalPatient) { entry.rig.motion = newMotion(); input.speed = 0; input.turn = 0; }
      this.models.animate(entry.rig, medicalPatient ? 0 : delta * (id === this.playerId && speed > 0 ? 1 : speed), input, dist);
      if (input.maggieDiscovery?.role !== 'maggie') poseHammerPatient(entry.rig, medicalPatient);
      const evacuationHead = entry.rig.hero?.bones.get('head') ?? entry.rig.head;
      if (input.dockEvacuation || input.shaftSeal || input.templeDefense?.phase === 'mounting' || evacuationHead.userData.evacuationHidden) {
        evacuationHead.userData.evacuationHidden = Boolean(id === this.playerId && this.firstPerson && (input.dockEvacuation || input.shaftSeal || input.templeDefense?.phase === 'mounting'));
        evacuationHead.visible = !evacuationHead.userData.evacuationHidden;
      }
      if (input.trainmanChase || input.helGarage || input.helElevator || input.helDanceDoor !== undefined || input.baneInquiry || input.hammerBriefing || input.hammerPilot || input.zionDeployment || input.maggieDiscovery || input.logosBane || pistolView || evacuationHead.userData.trainmanHidden) {
        evacuationHead.userData.trainmanHidden = Boolean(id === this.playerId && this.firstPerson && (input.trainmanChase || input.helGarage || input.helElevator || input.helDanceDoor !== undefined || input.baneInquiry || input.hammerBriefing || input.hammerPilot || input.zionDeployment || input.maggieDiscovery || input.logosBane || pistolView));
        evacuationHead.visible = !evacuationHead.userData.trainmanHidden;
      }
      if (entry.rig.diggerProps) entry.rig.head.visible = !((input.diggers || input.upperDigger || input.templeDefense?.phase === 'mounting') && id === this.playerId && this.firstPerson);
      if (truckPose) {
        const head = entry.rig.hero?.bones.get('head') ?? entry.rig.head;
        head.rotation.x = -1.05 * truckPose.airborne;
      }
      entry.shadow.position.y = floor - entry.group.position.y - .97;
      entry.shadow.visible = !input.oracleRestored && !sixthRoot?.hidden && state.status !== 'disconnected' && !state.currentAction?.parameters.filmDuel && !mountainFlying && !catchFlying && !coma && !pod && !epilogueCarried && !input.truckPassenger && !input.wetwall?.hanging;
      entry.shadow.scale.setScalar(1 + Math.max(0, entry.group.position.y - floor) * .04);
      const selected = id === this.selected;
      entry.label.visible = !physical && !sixthRoot?.hidden && id !== this.playerId && state.status === 'alive' && !state.currentAction?.parameters.filmDuel && (selected || (!this.playerId && dist < 90 && (['neo', 'trinity', 'smith', 'morpheus'].includes(id) || state.currentAction?.type === 'talk_to')));
      const labelWidth = this.playerId ? Math.min(7, Math.max(2.5, dist * 0.13)) : 17;
      entry.label.scale.set(labelWidth, labelWidth / 4, 1);
      entry.label.position.y = this.playerId ? 4.4 : 7;
      entry.label.material.depthTest = this.playerId !== null;
      entry.marker.scale.setScalar((selected ? 1.8 : 1) * Math.max(1, dist / 180));
      if (this.playerId) entry.marker.scale.setScalar(0.65);
      (entry.marker.material as THREE.MeshBasicMaterial).opacity = state.status === 'dead' ? 0.2 : selected ? 1 : 0.65;
      if (entry.speech) {
        entry.speech.age += delta;
        entry.speech.sprite.visible = !this.playerId && (dist < 240 || selected);
        if (entry.speech.age > 8) { this.disposeSprite(entry.speech.sprite); entry.speech = undefined; }
      }
    }
    if (upperSupport) {
      const belt = this.agents.get('charra')?.rig.diggerProps?.belt;
      if (belt) {
        const contacts = [-1, 1].map(side => belt.localToWorld(new THREE.Vector3(side * .23, 0, -.27)));
        poseUpperDigger(upperSupport.entry.rig, { ...upperSupport.gesture, contacts });
      }
    }
    const reunionLink = this.agents.get('link'), reunionZee = this.agents.get('zee');
    for (const roles of [['morpheus', 'niobe'], ['link', 'zee']] as const) {
      const a = this.agents.get(roles[0]), b = this.agents.get(roles[1]);
      const clock = reunionClock ?? a?.state.currentAction?.parameters.epilogue as MotionInput['epilogue'];
      if (clock?.kind === 'ceasefire' && a && b && !a.state.controller && !b.state.controller
        && a.state.status === 'alive' && b.state.status === 'alive'
        && a.state.currentAction?.parameters.epilogue && b.state.currentAction?.parameters.epilogue)
        poseCeasefireReunionPair(a.rig, b.rig, clock, roles);
    }
    const reunion = (this.playerId === 'link' ? this.playerMotion?.dockReunion : reunionLink?.state.currentAction?.parameters.dockReunion) as MotionInput['dockReunion'];
    const reunionNeo = this.agents.get('neo'), reunionTrinity = this.agents.get('trinity');
    const mobilReunion = (this.playerId === 'neo' ? this.playerMotion?.mobilReunion : reunionNeo?.state.currentAction?.parameters.mobilReunion) as MotionInput['mobilReunion'];
    if (reunionNeo && reunionTrinity && mobilReunion?.reunion.phase === 'embracing'
      && reunionNeo.state.status === 'alive' && reunionTrinity.state.status === 'alive' && !reunionTrinity.state.controller)
      poseMobilReunionPair(reunionNeo.rig, reunionTrinity.rig, mobilReunion);
    if (reunionLink && reunion) {
      const partner = reunionZee && !reunionZee.state.controller && reunionZee.state.status === 'alive'
        && reunionZee.state.currentAction?.parameters.dockReunion ? reunionZee.rig : undefined;
      poseDockReunion(reunionLink.rig, reunion, partner);
      if (partner) poseDockReunion(partner, { ...reunion, role: 'zee' }, reunionLink.rig);
    }
    const temple = reunionLink?.state.currentAction?.parameters.templeDefense as MotionInput['templeDefense'];
    if (temple?.phase === 'waiting' && reunionLink && reunionZee && !reunionLink.state.controller && !reunionZee.state.controller
      && reunionLink.state.status === 'alive' && reunionZee.state.status === 'alive' && reunionZee.state.currentAction?.parameters.templeDefense) {
      poseTempleDefense(reunionLink.rig, temple, reunionZee.rig);
      poseTempleDefense(reunionZee.rig, { ...temple, role: 'zee' }, reunionLink.rig);
    }
    for (const role of ['colt', 'roland'] as const) {
      const entry = this.agents.get(role), other = this.agents.get(role === 'colt' ? 'roland' : 'colt');
      const gesture = entry?.state.currentAction?.parameters.dockDeparture as MotionInput['dockDeparture'];
      if (entry && gesture) poseDockDeparture(entry.rig, gesture,
        other?.state.status === 'alive' && !other.state.controller && other.state.currentAction?.parameters.dockDeparture ? other.rig : undefined);
    }
    // Both base poses must exist before either hand reads the other actor's bones.
    for (const { entry, gesture } of farewellFrames) {
      const other = this.agents.get(gesture.role === 'neo' ? 'trinity' : 'neo');
      const targetBone = other?.rig.hero?.bones.get(gesture.role === 'neo' ? 'wrist_R' : 'head');
      if (!other || !targetBone) continue;
      other.group.updateMatrixWorld(true);
      const offset = gesture.role === 'neo' ? new THREE.Vector3(0, -.08, .04) : new THREE.Vector3(0, .1, .08);
      const target = targetBone.localToWorld(offset);
      let normal: THREE.Vector3 | undefined;
      let up: THREE.Vector3 | undefined;
      if (gesture.role === 'trinity') {
        let cheek = targetBone.userData.farewellCheek as { point: THREE.Vector3; normal: THREE.Vector3 } | undefined;
        if (!cheek) {
          const ray = new THREE.Ray(new THREE.Vector3(-1.2, -.05, .17), new THREE.Vector3(1, 0, 0));
          let distance = Infinity;
          for (const part of other.rig.hero!.wardrobe) {
            if (!(part.mesh instanceof THREE.SkinnedMesh) || (part.mesh.material as THREE.Material).name !== 'Skin') continue;
            const mesh = part.mesh, index = mesh.geometry.index!, ids = mesh.geometry.attributes.skinIndex, weights = mesh.geometry.attributes.skinWeight;
            const bone = mesh.skeleton.bones.indexOf(targetBone as THREE.Bone), points = new Map<number, THREE.Vector3>();
            // Read the delivered cheek in bind space so its landmark is identical on every saved frame.
            for (let i = 0; i < ids.count; i++) {
              let weight = 0;
              for (let k = 0; k < 4; k++) if (ids.getComponent(i, k) === bone) weight += weights.getComponent(i, k);
              if (weight > .999) points.set(i, new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i)
                .applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[bone]));
            }
            for (let i = 0; i < index.count; i += 3) {
              const a = points.get(index.getX(i)), b = points.get(index.getX(i + 1)), c = points.get(index.getX(i + 2));
              if (!a || !b || !c) continue;
              const hit = ray.intersectTriangle(a, b, c, false, new THREE.Vector3());
              if (hit && hit.distanceTo(ray.origin) < distance) {
                distance = hit.distanceTo(ray.origin); cheek = { point: hit, normal: THREE.Triangle.getNormal(a, b, c, new THREE.Vector3()) };
              }
            }
          }
          targetBone.userData.farewellCheek = cheek;
        }
        if (cheek) {
          target.copy(targetBone.localToWorld(cheek.point.clone()));
          normal = cheek.normal.clone().applyQuaternion(targetBone.getWorldQuaternion(new THREE.Quaternion()));
          up = new THREE.Vector3(0, 1, 0).applyQuaternion(targetBone.getWorldQuaternion(new THREE.Quaternion()));
        }
      }
      this.models.refreshFarewellContact(entry.rig, { ...gesture, target: { x: target.x, y: target.y, z: target.z } }, normal, up);
    }
    const morpheus = this.agents.get('morpheus'), smith = this.agents.get('smith');
    const neo = this.agents.get('neo'), keymaker = this.agents.get('keymaker');
    const oracle = this.agents.get('oracle'), absorption = oracle?.state.currentAction?.parameters.oracleAbsorption as MotionInput['oracleAbsorption'];
    if (absorption && oracle && smith?.rig.hero) {
      contactOracleAbsorption(oracle.rig, smith.rig, absorption);
      this.oracleSmith ??= new OracleSmithAppearance(oracle.rig, smith.rig.hero, this.scene);
      this.oracleSmith.update(absorption, this.playerId === 'oracle' && this.firstPerson);
    } else if (this.oracleSmith) { this.oracleSmith.dispose(); this.oracleSmith = undefined; }
    const smithFinale = (this.playerId === 'neo' ? this.playerMotion?.smithFinale : neo?.state.currentAction?.parameters.smithFinale) as MotionInput['smithFinale'];
    if (smithFinale && neo?.rig.hero && smith?.rig.hero && smith.state.currentAction?.parameters.smithFinale) {
      poseSmithFinaleContact(neo.rig.hero, smith.rig.hero, smithFinale);
      this.smithEnding ??= new SmithEndingAppearance(neo.rig.hero, smith.rig.hero);
      this.smithEnding.update(smithFinale, this.playerId === 'neo' && this.firstPerson);
      if (smithFinale.phase === 'done') { neo.shadow.visible = false; smith.shadow.visible = false; }
    } else if (this.smithEnding) {
      this.smithEnding.dispose(); this.smithEnding = undefined;
    }
    if (handoffClock && morpheus && keymaker && !morpheus.state.controller && !keymaker.state.controller) poseFreewayTransferContact(morpheus.rig, keymaker.rig, handoffClock);
    const truckRescue = morpheus?.state.currentAction?.parameters.truckRescue as MotionInput['truckRescue'];
    if (truckRescue && neo?.rig.hero && morpheus && keymaker
      && neo.state.currentAction?.parameters.truckRescue && keymaker.state.currentAction?.parameters.truckRescue) {
      poseTruckRescue(neo.rig.hero, morpheus.rig, keymaker.rig, truckRescue);
    }
    const rescued = this.agents.get('trinity'), catchGesture = (this.playerId === 'neo' ? this.playerMotion?.catch : neo?.state.currentAction?.parameters.catch) as MotionInput['catch'];
    if (neo && rescued && catchGesture && rescued.state.currentAction?.parameters.catch && !rescued.state.controller) poseReloadedCatchContact(neo.rig, rescued.rig, catchGesture);
    const custody = officeCustodyActive(journey) ? journey!.office!.custody : undefined;
    const front = custody && Object.keys(custody.bodies).find(role => role !== custody.leader && role !== custody.catcher);
    const lookout = this.agents.get('trinity');
    const clubActor = lookout?.state.currentAction?.parameters.club ? lookout : this.agents.get('neo');
    const club = clubActor?.state.currentAction?.parameters.club as MotionInput['club'];
    poseClub(this.agents.get('neo')?.state.currentAction?.parameters.club ? this.agents.get('neo')?.rig.hero : undefined, club && !lookout?.state.controller ? lookout?.rig.hero : undefined,
      club && { ...club, phase: clubActor?.clubGuide?.phase ?? club.phase, elapsed: clubActor?.clubGuide?.progress ?? club.elapsed });
    this.custody.update(this.agents.get('neo')?.rig.hero, custody ? this.agents.get(custody.catcher)?.rig.hero : undefined, custody, custody ? this.agents.get(custody.leader)?.rig.hero : undefined,
      front ? this.agents.get(front)?.rig.hero : undefined, lookout?.state.status === 'alive' && !lookout.state.controller ? lookout.rig.hero : undefined);
    const mobil = journey?.scene === 'm3_trainman' && !journey.visiting ? journey.mobil : undefined;
    const mobilNeo = this.agents.get('neo'), trainman = this.agents.get('trainman');
    if (mobil?.phase === 'refusing' && mobilNeo && trainman) contactMobilStrike(trainman.rig, mobilNeo.rig, mobil.elapsed);
    if (journey?.scene === 'm3_family' && !journey.visiting) {
      const rama = this.agents.get('rama_kandra'), sati = this.agents.get('sati');
      if (rama?.state.status === 'alive' && sati?.state.status === 'alive' && !rama.state.controller && !sati.state.controller)
        contactMobilFamily(rama.rig, sati.rig);
    }
    if (morpheus?.rig.hero && smith?.rig.hero) {
      const bathroom = (this.playerId === 'morpheus' ? this.playerMotion?.bathroom : morpheus.state.currentAction?.parameters.bathroom) as MotionInput['bathroom'];
      const sixth = morpheus.state.currentAction?.parameters.sixth as MotionInput['sixth'];
      if (bathroom || sixth && ['breach', 'done'].includes(sixth.phase)) {
        smith.group.updateWorldMatrix(true, true);
        const neck = bathroom?.phase === 'counter' ? smith.rig.hero.bones.get('chest')!.localToWorld(new THREE.Vector3(0, .08, .23))
          : smith.rig.hero.bones.get('head')!.localToWorld(new THREE.Vector3(0, -.17, .04));
        poseBathroom(morpheus.rig, { ...(bathroom ?? { phase: 'ready', elapsed: 0, held: 0, grip: 1, counters: 0, evaded: false, headbutt: false, cooldown: 0 }),
          elapsed: this.playerId === 'morpheus' ? bathroom?.elapsed ?? 0 : morpheus.bathroomElapsed ?? bathroom?.elapsed ?? 0,
          role: 'morpheus', contact: { x: neck.x, y: neck.y, z: neck.z } }, sixth);
      }
    }
  }

  showSpeechBubble(id: string, _name: string, text: string): void {
    const entry = this.agents.get(id);
    if (!entry) return;
    if (entry.speech) this.disposeSprite(entry.speech.sprite);
    const sprite = this.label(text, '#d7eadb', true);
    sprite.position.y = 12;
    entry.group.add(sprite);
    entry.speech = { sprite, age: 0 };
  }

  private label(text: string, color: string, bubble: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = bubble ? 512 : 256; canvas.height = bubble ? 150 : 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(4, 15, 11, 0.86)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = bubble ? '#325244' : '#395e4b'; ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.fillStyle = color; ctx.font = bubble ? '22px sans-serif' : '22px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (bubble) {
      const characters = [...text.slice(0, 64)];
      for (let i = 0; i < 3; i++) ctx.fillText(characters.slice(i * 20, i * 20 + 20).join(''), 256, 30 + i * 40, 480);
    } else ctx.fillText(text, 128, 32, 240);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }));
    sprite.scale.set(bubble ? 30 : 17, bubble ? 9 : 4.25, 1);
    return sprite;
  }
  private disposeSprite(sprite: THREE.Sprite): void {
    sprite.removeFromParent(); sprite.material.map?.dispose(); sprite.material.dispose();
  }
  removeAgent(id: string): void {
    const entry = this.agents.get(id);
    if (!entry) return;
    if (this.smithEnding && (id === 'neo' || id === 'smith')) {
      this.smithEnding.dispose(); this.smithEnding = undefined;
    }
    if (this.oracleSmith && (id === 'oracle' || id === 'smith')) { this.oracleSmith.dispose(); this.oracleSmith = undefined; }
    this.scene.remove(entry.group);
    this.disposeSprite(entry.label);
    if (entry.speech) this.disposeSprite(entry.speech.sprite);
    (entry.marker.material as THREE.Material).dispose();
    this.agents.delete(id);
  }
  dispose(): void {
    this.smithEnding?.dispose(); this.smithEnding = undefined;
    this.oracleSmith?.dispose(); this.oracleSmith = undefined;
    this.custody.dispose();
    for (const id of this.agents.keys()) this.removeAgent(id);
    this.models.dispose(); this.markerGeometry.dispose(); this.shadowGeometry.dispose(); this.shadowMaterial.dispose(); this.shadowTexture.dispose();
  }
}
