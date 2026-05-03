import type { AgentState, StoryPhaseId } from '@auto_matrix/shared';

export function buildDecisionPrompt(
  agent: AgentState,
  nearby: AgentState[],
  memories: string,
  phase: StoryPhaseId,
): string {
  const nearbyDesc = nearby.map(a =>
    `- ${a.name} (${a.faction}): ${a.currentAction?.type || 'idle'}, mood=${a.mood}`
  ).join('\n');

  return `You are ${agent.name} in the Matrix universe.

## Current State
- Location: ${agent.currentLocation}
- Health: ${agent.health}/100
- Mood: ${agent.mood}
- Goal: ${agent.currentGoal}
- Awakened: ${agent.isAwakened ? 'YES' : 'NO'}
- Story phase: ${phase}

## Nearby Characters
${nearbyDesc || '(nobody nearby)'}

## Recent Memories
${memories || '(nothing notable happened)'}

## Instructions
Choose ONE action. Stay in character. Respond in this exact format:
ACTION: <action_type>
TARGET: <target_id or none>
REASON: <one sentence why>

Available actions: idle, move_to, talk_to, attack, observe, defend, use_ability`;
}

export function buildConversationPrompt(
  speaker: AgentState,
  listener: AgentState,
  topic: string,
  speakerMemories: string,
  listenerMemories: string,
): string {
  return `A conversation between ${speaker.name} and ${listener.name} in the Matrix universe.

## ${speaker.name}
- Faction: ${speaker.faction}
- Mood: ${speaker.mood}
- Goal: ${speaker.currentGoal}
- Recent: ${speakerMemories || '(nothing)'}

## ${listener.name}
- Faction: ${listener.faction}
- Mood: ${listener.mood}
- Goal: ${listener.currentGoal}
- Recent: ${listenerMemories || '(nothing)'}

## Topic
${topic}

Generate a short dialogue (3-5 lines) between them. Each line should start with the speaker's name and a colon.
Stay in character. Be concise.`;
}
