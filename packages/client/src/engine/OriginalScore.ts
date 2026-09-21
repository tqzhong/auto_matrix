import manifest from './film-score.json';
import type { MusicCue } from './Soundtrack.js';

export type FilmTrack = typeof manifest.tracks[number];
export const FILM_TRACKS: readonly FilmTrack[] = manifest.tracks;
const track = (title: string): FilmTrack => manifest.tracks.find(item => item.title === title)!;

// Scene choices for this game, not a claim that each cue appeared there in the film.
// Every scene must resolve to one of these original recordings, including quiet daily life.
export const FILM_MUSIC: Record<MusicCue, FilmTrack> = {
  ordinary: track('Niaiserie'), office: track('Niaiserie'), cafe: track('Niaiserie'),
  club: track('Niaiserie'), restaurant: track('Niaiserie'), contact: track('Trinity Infinity'),
  night: track('The Logos Location'), anomaly: track('Unable to Speak'),
  awakening: track('The Lafayette Mirror'), the_one: track('Anything is Possible'),
  matrix: track('Trinity Infinity'), oracle: track('Neovision'),
  combat: track('The Subway Fight'), training: track('The Subway Fight'),
  chateau: track('Chateau Swashbuckling'), infiltration: track('Das Banegold'), chase: track('Multiple Replication'),
  swarm: track('Multiple Replication'), zion: track('Das Banegold'), siege: track('Chateau Swashbuckling'),
  mobil: track('The Logos Location'), bane: track('The Bane Revelation'),
  farewell: track('Neovision'), source: track('Deus Ex Machina'), final: track('Neodämmerung'),
  dawn: track('Anything is Possible'),
};

export function filmCredit(track: FilmTrack): string {
  const duration = `${Math.floor(track.seconds / 60)}:${String(Math.floor(track.seconds % 60)).padStart(2, '0')}`;
  return `Don Davis · ${track.film} · 原声片段 ${duration}`;
}
