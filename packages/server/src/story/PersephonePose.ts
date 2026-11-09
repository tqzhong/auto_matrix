import { distance, filmPosition, type AgentState, type FilmJourney, type PersephoneEncounter } from '@auto_matrix/shared';

export function savedPersephoneAction(journey: FilmJourney | undefined, actor: AgentState): boolean {
  const encounter = journey?.persephone, action = actor.currentAction, saved = action?.parameters.persephone as (PersephoneEncounter & { role: string }) | undefined;
  if (!journey || journey.visiting || journey.scene !== 'm2_persephone' || journey.actor !== 'neo' || journey.step !== 2 || encounter?.phase !== 'enacting'
    || !['neo','persephone'].includes(actor.id) || !['memory','appeal'].includes(encounter.route ?? '')) return false;
  const neo = actor.id === 'neo', point = filmPosition('film_le_vrai',neo ? 22.1 : 23.4,neo ? 21.8 : 22.5);
  return Boolean(action?.type === 'idle' && action.parameters.resolved === true && saved?.role === actor.id && saved.phase === encounter.phase
    && saved.elapsed === encounter.elapsed && saved.attempts === encounter.attempts && saved.route === encounter.route
    && actor.currentLocation === 'film_le_vrai' && actor.isInMatrix && distance(actor.position,point) < 1e-8 && actor.rotation === (neo ? encounter.route === 'memory' ? .9 : 1.5 : -.9));
}
