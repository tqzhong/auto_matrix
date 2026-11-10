import { FILM_SETS,filmSetAt,type AgentState,type FilmJourney,type MountainFlight }from '@auto_matrix/shared';

export function savedChateauAction(journey:FilmJourney|undefined,actor:AgentState):boolean{
  const action=actor.currentAction,encounter=journey?.chateau;
  return Boolean(journey&&!journey.visiting&&journey.scene==='m2_chateau'&&journey.actor==='neo'&&actor.id==='neo'&&journey.step>=0&&journey.step<=2&&encounter?.weapon
    &&actor.status==='alive'&&actor.health>0&&actor.isInMatrix&&actor.currentLocation==='film_chateau_hall'&&filmSetAt(actor.position,true)?.id==='film_chateau_hall'
    &&action&&action.parameters.player===true&&action.parameters.resolved===true&&action.parameters.chateauWeapon===encounter.weapon
    &&(action.type==='idle'||action.type==='move_to'||action.type==='attack'&&!['ready','failed'].includes(encounter.phase)));
}

export function savedMountainAction(journey:FilmJourney|undefined,actor:AgentState):boolean{
  const action=actor.currentAction,saved=action?.parameters.mountainFlight as MountainFlight|undefined;
  if(!journey||journey.visiting||actor.id!=='neo'||!saved)return false;
  const active=journey.scene==='m2_mountain'&&journey.actor==='neo';
  const offstage=!actor.controller&&['m2_garage','m2_freeway','m2_trucks'].includes(journey.scene)&&journey.completed.includes('m2_mountain')&&saved.phase==='arrived';
  const flight=active?journey.mountain:offstage?saved:undefined;
  if(!flight||!['takeoff','flying','arrived'].includes(flight.phase)||active&&journey.step!==(flight.phase==='arrived'?3:2))return false;
  const center=FILM_SETS.film_mountain_range.center;
  return Boolean(actor.status==='alive'&&actor.health>0&&actor.currentLocation==='film_mountain_range'&&actor.isInMatrix&&action?.type==='move_to'&&action.parameters.player===true&&action.parameters.resolved===true
    &&saved.phase===flight.phase&&saved.elapsed===flight.elapsed&&saved.x===flight.x&&saved.z===flight.z&&saved.altitude===flight.altitude&&saved.attempt===flight.attempt
    &&Math.hypot(actor.position.x-center.x-flight.x,actor.position.y-center.y-flight.altitude,actor.position.z-center.z-flight.z)<1e-8);
}
