import type { Vector3 } from './agent.js';

export type ItemId = 'code' | 'scrap' | 'medkit' | 'decoder' | 'emp' | 'beacon' | 'barricade';
export type SkillId = 'combat' | 'hacking' | 'survival';
export interface SurvivorProfile {
  inventory: Record<ItemId, number>;
  xp: number;
  skills: Record<SkillId, number>;
  trace: number;
  trackedMission: string;
  visited: string[];
  lastAttack: number;
  lastUse: number;
  job?: { target: string; endsAt: number; startedAt: number; position: Vector3 };
}
export interface WorldNode {
  id: string;
  kind: 'cache' | 'terminal' | 'phone' | 'mission';
  name: string;
  location: string;
  position: Vector3;
  matrix: boolean;
  availableAt: number;
}
export interface WorldStructure {
  id: string;
  kind: 'beacon' | 'barricade';
  owner: string;
  position: Vector3;
  matrix: boolean;
  health: number;
  film?: { scene: string; width: number; depth: number; height: number };
}
export interface SandboxThreat {
  character?: string;
  combo?: number;
  patrol?: boolean;
  yaw?: number;
  scene?: string;
  campaign?: 'neo';
  id: string;
  kind: 'agent' | 'sentinel' | 'smith' | 'training' | 'soldier';
  position: Vector3;
  matrix: boolean;
  health: number;
  maxHealth: number;
  target: string;
  mission?: string;
  incident?: string;
  stunUntil: number;
  lastStrike: number;
  attackAt?: number;
  aim?: Vector3;
  infection?: { source: string; until: number; nextAt: number };
}
export interface WorldIncident {
  id: string;
  kind: 'cache' | 'distress' | 'glitch' | 'raid';
  name: string;
  description: string;
  position: Vector3;
  matrix: boolean;
  location: string;
  expiresAt: number;
}
export interface MissionProgress {
  status: 'locked' | 'available' | 'active' | 'complete';
  stage: 'ready' | 'combat' | 'escort' | 'choice';
  actor?: string;
  progress: number;
  startedAt: number;
  outcome?: string;
  escort?: { position: Vector3; health: number };
}
export interface SandboxState {
  neoLife?: import('./neo-life.js').NeoLifeState;
  version: 1;
  seed: number;
  serial: number;
  weather: 'clear' | 'rain' | 'code_storm';
  weatherUntil: number;
  nextIncidentAt: number;
  security: number;
  corruption: number;
  zion: number;
  ending: 'open' | 'peace' | 'reboot' | 'liberation';
  profiles: Record<string, SurvivorProfile>;
  nodes: WorldNode[];
  structures: WorldStructure[];
  threats: SandboxThreat[];
  incidents: WorldIncident[];
  missions: Record<string, MissionProgress>;
}

export interface SandboxCommand {
  kind: 'interact' | 'craft' | 'use' | 'build' | 'dismantle' | 'upgrade' | 'track' | 'choose' | 'transit' | 'life';
  target?: string;
}
