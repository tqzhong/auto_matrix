import type { AgentState, AgentId, ConversationMessage, StoryPhaseId } from '@auto_matrix/shared';

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
- In Matrix: ${agent.isInMatrix ? 'YES' : 'NO'}
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

/**
 * Build a detailed prompt for generating a single dialogue line in a multi-turn conversation.
 * Includes personality, memories, relationship, previous dialogue history, and story phase context.
 */
export function buildMultiTurnConversationPrompt(
  speaker: AgentState,
  listener: AgentState,
  speakerPersonality: string,
  listenerPersonality: string,
  topic: string,
  speakerMemories: string,
  listenerMemories: string,
  relationshipDesc: string,
  previousConversations: string,
  phase: StoryPhaseId,
  currentDialogue: ConversationMessage[],
  speakerId: AgentId,
): string {
  const dialogueHistory = currentDialogue.length > 0
    ? currentDialogue.map(m => `${m.speaker}: ${m.content}`).join('\n')
    : '(This is the start of the conversation)';

  return `Generate the next line of dialogue for ${speaker.name} in a conversation with ${listener.name}.

## ${speaker.name}'s Personality
${speakerPersonality}

## ${listener.name}'s Personality
${listenerPersonality}

## Relationship
${relationshipDesc}

## Story Phase
${phase}

## Topic
${topic}

## ${speaker.name}'s Recent Memories
${speakerMemories || '(nothing recent)'}

## ${listener.name}'s Recent Memories
${listenerMemories || '(nothing recent)'}

## Previous Conversations Between Them
${previousConversations || '(no prior conversations)'}

## Dialogue So Far
${dialogueHistory}

## Instructions
Write ONE line of dialogue as ${speaker.name} speaking to ${listener.name}.
- Stay completely in character based on the personality above
- Reference memories or past events when natural
- Let the relationship influence the tone (trust = warm, fear = tense, respect = formal)
- Keep it to 1-2 sentences
- Be natural and Matrix-authentic
- Do NOT include the speaker's name, stage directions, or quotation marks`;
}

/**
 * Build a prompt for generating a conversation summary after dialogue completes.
 */
export function buildConversationSummaryPrompt(
  participants: AgentId[],
  topic: string,
  dialogueText: string,
): string {
  return `Summarize the following conversation between ${participants.join(' and ')}.

## Topic
${topic}

## Full Dialogue
${dialogueText}

## Instructions
Write a concise 1-2 sentence summary capturing:
- What was discussed
- Any decisions made or tensions revealed
- The emotional tone of the conversation
Be factual and specific. Do not editorialize.`;
}

/**
 * Build a prompt for an agent to reflect on a conversation they just had.
 */
export function buildReflectionPrompt(
  agent: AgentState,
  personality: string,
  dialogueText: string,
  otherName: string,
): string {
  return `You are ${agent.name}. ${personality}

You just had a conversation with ${otherName}:

${dialogueText}

Reflect on this conversation. Consider:
- What did you learn or realize?
- Did this change your goals or perspective?
- How do you feel about ${otherName} now?

Reply in this exact JSON format:
{
  "insights": ["insight 1", "insight 2"],
  "updatedGoals": ["goal if changed, or empty array"],
  "moodChange": "new mood if changed, or empty string"
}`;
}
