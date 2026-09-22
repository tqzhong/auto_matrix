import type { Vector3 } from './agent.js';
import type { MissionProgress } from './sandbox.js';

export type Philosophy = 'agency' | 'care' | 'trust';
export interface LifeEntry { day: number; time: number; title: string; text: string }
export interface NeoCycle {
  cycle: number; days: number; ending: string; philosophy: Record<Philosophy, number>;
  choices: Record<string, string>; evidence: string[];
}
export interface NeoLifeState {
  journey?: import('../constants/film-story.js').FilmJourney;
  contactSignal?: boolean;
  deferredContact?: import('../constants/film-story.js').FilmJourney;
  version: 1;
  cycle: number;
  startedDay: number;
  day: number;
  lastMinute: number;
  seed: number;
  chapter: number;
  money: number;
  energy: number;
  satiety: number;
  social: number;
  career: number;
  doubt: number;
  friends: number;
  philosophy: Record<Philosophy, number>;
  done: Record<string, number>;
  evidence: string[];
  clues: string[];
  quietActions: number;
  lastAnomalyDay: number;
  contactAfterDay: number;
  nextStreetAt: number;
  lastStreetPosition: Vector3;
  choices: Record<string, string>;
  journal: LifeEntry[];
  cycles: NeoCycle[];
  missions: Record<string, MissionProgress>;
  appointment?: { day: number; hour: number; location: string };
  anomaly?: { id: string; location: string; position: Vector3 };
  activity?: { id: string; position: Vector3; startedAt: number; endsAt: number };
  ending?: 'peace' | 'reboot' | 'liberation';
}
