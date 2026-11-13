import { FILM_SCENE_BY_ID, FILM_SETS, OPENING_ESCAPE, OPENING_HOTEL, OPENING_PHONE, OPENING_ROOF_EXIT, WELLS_AFTERMATH, WELLS_BOOTH, openingBoothCrush,
  openingHotelBootContact, openingHotelClimbed, openingHotelDoorHit, openingHotelGlassBroken, openingHotelHallOfficer, openingHotelLanded, openingHotelTraceTime, openingRoofGlassBroken, openingTruckPose, wellsAftermathDoor,
  type AgentState, type FilmJourney, type OpeningHotelEncounter, type OpeningPhoneEncounter, type OpeningRoofExit } from '@auto_matrix/shared';
import type { GameAudio } from './GameAudio.js';

type OpeningSounds = Pick<GameAudio, 'landlineSound' | 'meetingSound' | 'governmentSound' | 'matrixEscapeSound'
  | 'phoneSound' | 'windowSound'>;

export type OpeningAudioState = {
  journey: FilmJourney;
  tick: number;
  height: number;
  roofExit?: number;
  trace?: number;
  hotelClimb?: number;
  lastRing?: number;
  truck?: { speed: number; level: number };
};

function hotelSounds(audio: OpeningSounds, previous: OpeningHotelEncounter, hotel: OpeningHotelEncounter,
  previousClimb?: number, climbed?: number): void {
  if (previous.phase === 'trace' && hotel.phase === 'breach') audio.landlineSound('hangup');
  if (previous.phase === 'breach' && !openingHotelDoorHit(previous) && openingHotelDoorHit(hotel)) audio.governmentSound('door-kick');
  const phone = OPENING_HOTEL.phone;
  const before = previous.phase === 'answering' ? previous.elapsed : 0;
  if (hotel.phase === 'answering' && before < phone.grasp && hotel.elapsed >= phone.grasp) audio.landlineSound('pickup');
  if (previous.phase === 'answering' && before < phone.release
    && (hotel.phase === 'answering' && hotel.elapsed >= phone.release || hotel.phase === 'corridor')) audio.landlineSound('hangup');
  if (!openingHotelGlassBroken(previous) && openingHotelGlassBroken(hotel)) audio.governmentSound('glass');
  if (previous.phase === 'dive' && !openingHotelLanded(previous) && openingHotelLanded(hotel)) audio.governmentSound('body');
  if (previous.phase === 'ladder_ready' && hotel.phase === 'climbing') audio.governmentSound('ladder-grab');
  if (previous.phase === 'climbing' && hotel.phase === 'done') audio.governmentSound('ladder-deck');
  if (previous.phase === 'climbing' && hotel.phase === 'climbing' && previousClimb !== undefined && climbed !== undefined
    && openingHotelBootContact(previousClimb, climbed)) audio.governmentSound('ladder-step');
}

function roofSounds(audio: OpeningSounds, previous: OpeningAudioState, current: OpeningAudioState, exit?: OpeningRoofExit): void {
  const roof = current.journey.openingRoof, old = previous.journey.openingRoof;
  const floor = FILM_SETS.film_hotel_roofs.center.y;
  if (roof?.phase === 'running' && current.roofExit === undefined && previous.roofExit === undefined
    && previous.height > floor + .12 && current.height >= floor - .1 && current.height <= floor + .08) audio.governmentSound('body');
  if (roof?.phase === 'running' && roof.crossed && old?.leap && !old.crossed) audio.governmentSound('body');
  if (!openingRoofGlassBroken(old, previous.roofExit) && openingRoofGlassBroken(roof, current.roofExit)) audio.governmentSound('glass');
  if (exit?.stairwell) {
    const before = previous.roofExit ?? 0;
    if (before < OPENING_ROOF_EXIT.land && exit.elapsed >= OPENING_ROOF_EXIT.land) audio.governmentSound('body');
    if (before < OPENING_ROOF_EXIT.rollEnd && exit.elapsed >= OPENING_ROOF_EXIT.rollEnd) audio.windowSound(true);
  }
}

function wellsSounds(audio: OpeningSounds, previous: OpeningPhoneEncounter, phone: OpeningPhoneEncounter): void {
  const turnYaw = 1.35;
  if ((phone.phase === 'running' || phone.phase === 'answering') && previous.remaining !== phone.remaining
    && openingTruckPose(previous).yaw > turnYaw && openingTruckPose(phone).yaw <= turnYaw) audio.matrixEscapeSound('truck-turn');
  if (phone.answer && (previous.answer?.elapsed ?? 0) < OPENING_PHONE.graspSeconds && phone.answer.elapsed >= OPENING_PHONE.graspSeconds)
    audio.landlineSound('pickup');
  if (previous.phase === 'answering' && phone.phase === 'connected') audio.phoneSound(true);
  if (phone.hit && !previous.hit) audio.governmentSound('body');
  if (phone.impactElapsed !== previous.impactElapsed || phone.phase !== previous.phase) {
    const before = openingBoothCrush(openingTruckPose(previous)), crush = openingBoothCrush(openingTruckPose(phone));
    if (before === 0 && crush > 0) audio.matrixEscapeSound('truck-impact');
    if (before <= WELLS_BOOTH.glassBreakCrush && crush > WELLS_BOOTH.glassBreakCrush) audio.governmentSound('glass');
  }
  const elapsed = phone.aftermath?.elapsed, earlier = previous.aftermath?.elapsed;
  if (elapsed !== undefined && elapsed > (earlier ?? 0)) {
    const door = wellsAftermathDoor(elapsed), oldDoor = wellsAftermathDoor(earlier);
    if ((door === 0) !== (oldDoor === 0)) audio.meetingSound('door');
    if ((earlier ?? 0) < WELLS_AFTERMATH.firstFoot && elapsed >= WELLS_AFTERMATH.firstFoot) audio.matrixEscapeSound('truck-step');
  }
}

function truckEngine(phone: OpeningPhoneEncounter, actor: AgentState): OpeningAudioState['truck'] {
  const approaching = phone.phase === 'running' || phone.phase === 'answering' || phone.phase === 'failed' && phone.remaining > 0;
  const colliding = phone.phase === 'failed' && phone.impactElapsed !== undefined
    && phone.impactElapsed < OPENING_ESCAPE.truckImpactSeconds;
  if (!approaching && !colliding) return;
  const { center } = FILM_SETS.film_wells_phone, truck = openingTruckPose(phone);
  const distance = Math.hypot(actor.position.x - center.x - truck.x, actor.position.z - center.z - truck.z);
  return { speed: approaching ? 4 + 7 * (1 - phone.remaining / OPENING_ESCAPE.phoneSeconds) : 16, level: 7 / Math.max(7, distance) };
}

export function updateOpeningAudio(audio: OpeningSounds, previous: OpeningAudioState | undefined, journey: FilmJourney | undefined,
  actor: AgentState | undefined, running: boolean, tick: number): OpeningAudioState | undefined {
  if (!journey || journey.visiting || !actor?.isInMatrix || actor.id !== journey.actor
    || !['m1_room303', 'm1_roofs', 'm1_phone_escape'].includes(journey.scene)
    || actor.currentLocation !== FILM_SCENE_BY_ID[journey.scene].set) return;
  const hotel = journey.scene === 'm1_room303' ? journey.openingHotel : undefined;
  const roof = journey.scene === 'm1_roofs' ? journey.openingRoof : undefined;
  const phone = journey.scene === 'm1_phone_escape' ? journey.openingPhone : undefined;
  // Completion refreshes enteredAt before the camera leaves the scene.
  const before = previous?.journey.scene === journey.scene && previous.journey.actor === journey.actor && tick >= previous.tick ? previous : undefined;
  const old = before?.journey;
  const sameAttempt = old && (!hotel || hotel.attempts === old.openingHotel?.attempts)
    && (!roof || roof.attempts === old.openingRoof?.attempts) && (!phone || phone.attempts === old.openingPhone?.attempts);
  const exit = roof ? actor.currentAction?.parameters.roofExit as OpeningRoofExit | undefined : undefined;
  const trace = openingHotelTraceTime(hotel, actor);
  const next: OpeningAudioState = { journey, tick, height: actor.position.y, roofExit: exit?.elapsed, trace,
    hotelClimb: openingHotelClimbed(hotel, actor) };
  if (hotel?.phase === 'phone' || hotel?.phase === 'answering' && hotel.elapsed < OPENING_HOTEL.phone.grasp || phone?.phase === 'running'
    || phone?.phase === 'answering' && (phone.answer?.elapsed ?? 0) < OPENING_PHONE.graspSeconds) {
    next.lastRing = sameAttempt ? before?.lastRing : undefined;
    if (running && (next.lastRing === undefined || tick - next.lastRing >= 7)) {
      next.lastRing = tick; audio.landlineSound('ring');
    }
  }
  // Paused and first-delivered states establish the baseline for one-shot cues.
  if (!running) return next;
  if (phone) next.truck = truckEngine(phone, actor);
  if (roof?.phase === 'running' && previous?.journey.scene === 'm1_room303') audio.windowSound(true);
  if (!sameAttempt || !before || !old) return next;
  if (trace !== undefined && before.trace !== undefined) {
    const beats = OPENING_HOTEL.trace;
    if (before.trace < beats.ring && trace >= beats.ring) audio.landlineSound('ring');
    if (before.trace < beats.pickup && trace >= beats.pickup) audio.landlineSound('pickup');
    if (before.trace < beats.located && trace >= beats.located) audio.phoneSound(true);
    if (hotel?.traceHall && trace >= beats.room) {
      const from = openingHotelHallOfficer(0, before.trace - beats.room).travel;
      const to = openingHotelHallOfficer(0, trace - beats.room).travel;
      // The staged gait advances one footfall per half stride.
      if (Math.floor(to / 1.6) > Math.floor(from / 1.6)) audio.governmentSound('hall-step');
    }
  }
  if (hotel && old.openingHotel) hotelSounds(audio, old.openingHotel, hotel, before.hotelClimb, next.hotelClimb);
  if (roof && old.openingRoof) roofSounds(audio, before, next, exit);
  if (phone && old.openingPhone) wellsSounds(audio, old.openingPhone, phone);
  return next;
}
