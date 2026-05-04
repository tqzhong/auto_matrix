import * as THREE from 'three';
import type { AgentState, AgentId, FactionId } from '@auto_matrix/shared';
import { VoxelCharacterModel } from './VoxelCharacterModel.js';
import { AnimationSystem, type AnimationState } from './AnimationSystem.js';
import { lerpVector3, lerpAngle } from '../network/StateInterpolator.js';

// ── Faction colours ──────────────────────────────────────────────────────

const FACTION_COLORS: Record<string, string> = {
  zion: '#00ccff',
  machines: '#ffffff',
  merovingian: '#ffcc00',
  oracle: '#ff8844',
  exiles: '#bb66ff',
  civilians: '#888888',
};

const FACTION_ABBR: Record<string, string> = {
  zion: 'ZION',
  machines: 'MCH',
  merovingian: 'MRV',
  oracle: 'ORC',
  exiles: 'EXL',
  civilians: 'CVL',
};

// ── Action indicator config ──────────────────────────────────────────────

interface ActionIndicatorDef {
  text: string;
  color: string;
  bgColor: string;
}

const ACTION_INDICATORS: Record<string, ActionIndicatorDef> = {
  move_to: { text: '→', color: '#00ff41', bgColor: 'rgba(0,40,0,0.7)' },
  talk_to: { text: '\u{1F4AC}', color: '#00ccff', bgColor: 'rgba(0,20,40,0.7)' },
  attack: { text: '⚠', color: '#ff2200', bgColor: 'rgba(40,0,0,0.8)' },
  defend: { text: '\u{1F6E1}', color: '#ffaa00', bgColor: 'rgba(40,30,0,0.7)' },
  observe: { text: '…', color: '#888888', bgColor: 'rgba(20,20,20,0.6)' },
  use_ability: { text: '⚡', color: '#bb66ff', bgColor: 'rgba(30,0,50,0.7)' },
  hack: { text: '⌨', color: '#00ff41', bgColor: 'rgba(0,40,0,0.7)' },
  train: { text: '\u{1F3CB}', color: '#00ccff', bgColor: 'rgba(0,20,40,0.6)' },
  hide: { text: '\u{1F576}', color: '#555555', bgColor: 'rgba(20,20,20,0.6)' },
};

// ── Speech bubble tracking ───────────────────────────────────────────────

interface SpeechBubble {
  sprite: THREE.Sprite;
  age: number;
  stackIndex: number;
}

// ── Agent entry ──────────────────────────────────────────────────────────

interface AgentEntry {
  group: THREE.Group;
  targetPosition: THREE.Vector3;
  currentRotation: number;
  targetRotation: number;
  nameLabel: THREE.Sprite;
  factionLabel: THREE.Sprite;
  healthBar: THREE.Mesh;
  healthBarBg: THREE.Mesh;
  lastState: AgentState;
  faction: FactionId;
  speechBubbles: SpeechBubble[];
  actionIndicator: THREE.Sprite | null;
  currentActionType: string | null;
}

// ── AgentRenderer ────────────────────────────────────────────────────────

export class AgentRenderer {
  private scene: THREE.Scene;
  private agents: Map<AgentId, AgentEntry> = new Map();
  private animationSystem: AnimationSystem;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.animationSystem = new AnimationSystem();
  }

  // ── Public API ───────────────────────────────────────────────────────

  updateAgent(id: AgentId, state: AgentState): void {
    let entry = this.agents.get(id);

    if (!entry) {
      entry = this.createAgentEntry(id, state);
      this.agents.set(id, entry);
    }

    entry.targetPosition.set(state.position.x, state.position.y, state.position.z);
    entry.targetRotation = state.rotation;
    entry.lastState = state;

    // Rebuild name label if faction changed
    if (entry.faction !== state.faction) {
      entry.faction = state.faction;
      this.scene.remove(entry.nameLabel);
      this.scene.remove(entry.factionLabel);
      entry.nameLabel = this.createNameLabel(state.name, state.faction);
      entry.factionLabel = this.createFactionLabel(state.faction);
      this.scene.add(entry.nameLabel);
      this.scene.add(entry.factionLabel);
    }

    this.updateHealthBar(entry, state);

    let animState: AnimationState = 'idle';
    if (state.currentAction) {
      switch (state.currentAction.type) {
        case 'move_to':
          animState = 'walk';
          break;
        case 'attack':
        case 'defend':
          animState = 'fight';
          break;
        default:
          animState = 'idle';
          break;
      }
    }
    this.animationSystem.setState(id, animState);

    // Update action indicator
    const actionType = state.currentAction?.type ?? null;
    if (actionType !== entry.currentActionType) {
      this.updateActionIndicator(id, actionType ?? 'idle');
      entry.currentActionType = actionType;
    }
  }

  removeAgent(id: AgentId): void {
    const entry = this.agents.get(id);
    if (!entry) return;
    this.scene.remove(entry.group);
    this.scene.remove(entry.nameLabel);
    this.scene.remove(entry.factionLabel);
    this.scene.remove(entry.healthBar);
    this.scene.remove(entry.healthBarBg);
    for (const bubble of entry.speechBubbles) {
      this.scene.remove(bubble.sprite);
      this.disposeSprite(bubble.sprite);
    }
    if (entry.actionIndicator) {
      this.scene.remove(entry.actionIndicator);
      this.disposeSprite(entry.actionIndicator);
    }
    this.animationSystem.removeAgent(id);
    this.agents.delete(id);
  }

  getAgent(id: AgentId): THREE.Group | null {
    return this.agents.get(id)?.group ?? null;
  }

  getAgentState(id: AgentId): AgentState | null {
    return this.agents.get(id)?.lastState ?? null;
  }

  getAgentIds(): AgentId[] {
    return [...this.agents.keys()];
  }

  showSpeechBubble(agentId: AgentId, speakerName: string, text: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;

    // Determine max active bubbles per agent
    const MAX_BUBBLES_PER_AGENT = 3;

    // If at limit, remove oldest
    if (entry.speechBubbles.length >= MAX_BUBBLES_PER_AGENT) {
      const oldest = entry.speechBubbles.shift()!;
      this.scene.remove(oldest.sprite);
      this.disposeSprite(oldest.sprite);
    }

    const stackIndex = entry.speechBubbles.length;
    const sprite = this.createSpeechBubbleSprite(speakerName, text);
    this.scene.add(sprite);

    entry.speechBubbles.push({
      sprite,
      age: 0,
      stackIndex,
    });
  }

  updateActionIndicator(agentId: AgentId, actionType: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;

    // Remove old indicator
    if (entry.actionIndicator) {
      this.scene.remove(entry.actionIndicator);
      this.disposeSprite(entry.actionIndicator);
      entry.actionIndicator = null;
    }

    // No indicator for idle
    if (actionType === 'idle' || actionType === null) return;

    const def = ACTION_INDICATORS[actionType];
    if (!def) return;

    const sprite = this.createActionIndicatorSprite(def);
    this.scene.add(sprite);
    entry.actionIndicator = sprite;
  }

  update(delta: number): void {
    for (const [_id, entry] of this.agents) {
      entry.group.position.lerp(entry.targetPosition, 1 - Math.exp(-8 * delta));

      entry.currentRotation = lerpAngle(entry.currentRotation, entry.targetRotation, delta);
      entry.group.rotation.y = entry.currentRotation;

      // Name label position: above agent (characters are now ~20 units tall)
      entry.nameLabel.position.copy(entry.group.position);
      entry.nameLabel.position.y += 22;

      // Faction label: directly below name
      entry.factionLabel.position.copy(entry.group.position);
      entry.factionLabel.position.y += 20.5;

      // Health bar
      entry.healthBar.position.copy(entry.group.position);
      entry.healthBar.position.y += 20;
      entry.healthBarBg.position.copy(entry.healthBar.position);

      // Action indicator: between head and faction label
      if (entry.actionIndicator) {
        entry.actionIndicator.position.copy(entry.group.position);
        entry.actionIndicator.position.y += 19;
      }

      // Speech bubbles: stack above name label
      const bubblesToRemove: number[] = [];
      for (let i = 0; i < entry.speechBubbles.length; i++) {
        const bubble = entry.speechBubbles[i];
        bubble.age += delta;

        // Position: above name label, stacked
        const baseY = 24;
        const stackOffset = bubble.stackIndex * 4.5;
        bubble.sprite.position.copy(entry.group.position);
        bubble.sprite.position.y += baseY + stackOffset;

        // Fade out between 8-10 seconds
        const mat = bubble.sprite.material as THREE.SpriteMaterial;
        if (bubble.age > 8) {
          mat.opacity = Math.max(0, 1 - (bubble.age - 8) / 2);
        }
        if (bubble.age > 10) {
          this.scene.remove(bubble.sprite);
          this.disposeSprite(bubble.sprite);
          bubblesToRemove.push(i);
        }
      }

      // Remove expired bubbles and re-index the rest
      for (let i = bubblesToRemove.length - 1; i >= 0; i--) {
        entry.speechBubbles.splice(bubblesToRemove[i], 1);
      }
      for (let i = 0; i < entry.speechBubbles.length; i++) {
        entry.speechBubbles[i].stackIndex = i;
      }
    }

    this.animationSystem.update(delta);
  }

  dispose(): void {
    for (const [_id, entry] of this.agents) {
      this.scene.remove(entry.group);
      this.scene.remove(entry.nameLabel);
      this.scene.remove(entry.factionLabel);
      this.scene.remove(entry.healthBar);
      this.scene.remove(entry.healthBarBg);
      for (const bubble of entry.speechBubbles) {
        this.scene.remove(bubble.sprite);
        this.disposeSprite(bubble.sprite);
      }
      if (entry.actionIndicator) {
        this.scene.remove(entry.actionIndicator);
        this.disposeSprite(entry.actionIndicator);
      }
    }
    this.agents.clear();
  }

  // ── Agent entry creation ─────────────────────────────────────────────

  private createAgentEntry(id: AgentId, state: AgentState): AgentEntry {
    const group = VoxelCharacterModel.buildFromConfig(state.appearance, id);
    group.position.set(state.position.x, state.position.y, state.position.z);
    this.scene.add(group);

    const nameLabel = this.createNameLabel(state.name, state.faction);
    this.scene.add(nameLabel);

    const factionLabel = this.createFactionLabel(state.faction);
    this.scene.add(factionLabel);

    const { bar: healthBar, bg: healthBarBg } = this.createHealthBar();
    this.scene.add(healthBarBg);
    this.scene.add(healthBar);

    this.animationSystem.registerAgent(id, group);

    return {
      group,
      targetPosition: new THREE.Vector3(state.position.x, state.position.y, state.position.z),
      currentRotation: state.rotation,
      targetRotation: state.rotation,
      nameLabel,
      factionLabel,
      healthBar,
      healthBarBg,
      lastState: state,
      faction: state.faction,
      speechBubbles: [],
      actionIndicator: null,
      currentActionType: null,
    };
  }

  // ── Name label (faction-colored) ─────────────────────────────────────

  private createNameLabel(name: string, faction: FactionId): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 64);

    const color = FACTION_COLORS[faction] ?? '#00ff41';

    ctx.font = 'bold 28px Courier New';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(14, 3.5, 1);
    return sprite;
  }

  // ── Faction abbreviation label ───────────────────────────────────────

  private createFactionLabel(faction: FactionId): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 32);

    const color = FACTION_COLORS[faction] ?? '#00ff41';
    const abbr = FACTION_ABBR[faction] ?? faction.toUpperCase();

    ctx.font = 'bold 16px Courier New';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.7;
    ctx.fillText(`[ ${abbr} ]`, 64, 16);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(7, 1.75, 1);
    return sprite;
  }

  // ── Health bar ───────────────────────────────────────────────────────

  private createHealthBar(): { bar: THREE.Mesh; bg: THREE.Mesh } {
    const bgGeom = new THREE.PlaneGeometry(6, 0.6);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x220000, side: THREE.DoubleSide });
    const bg = new THREE.Mesh(bgGeom, bgMat);

    const barGeom = new THREE.PlaneGeometry(6, 0.6);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00ff41, side: THREE.DoubleSide });
    const bar = new THREE.Mesh(barGeom, barMat);

    return { bar, bg };
  }

  private updateHealthBar(entry: AgentEntry, state: AgentState): void {
    const ratio = state.maxHealth > 0 ? state.health / state.maxHealth : 1;
    entry.healthBar.scale.x = Math.max(0, ratio);
    entry.healthBar.position.x -= (1 - ratio) * 1.5 * 0.5;

    const mat = entry.healthBar.material as THREE.MeshBasicMaterial;
    if (ratio > 0.6) {
      mat.color.setHex(0x00ff41);
    } else if (ratio > 0.3) {
      mat.color.setHex(0xffaa00);
    } else {
      mat.color.setHex(0xff2200);
    }
  }

  // ── Speech bubble sprite ─────────────────────────────────────────────

  private createSpeechBubbleSprite(speakerName: string, text: string): THREE.Sprite {
    const maxWidth = 280;
    const padding = 12;
    const lineHeight = 20;
    const headerHeight = 22;
    const cornerRadius = 8;

    // Measure and word-wrap text
    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d')!;
    mCtx.font = '16px Courier New';

    const wrappedLines = this.wordWrap(mCtx, text, maxWidth - padding * 2);
    const totalHeight = headerHeight + wrappedLines.length * lineHeight + padding * 2;

    const canvasWidth = maxWidth + 8; // small margin for border
    const canvasHeight = totalHeight + 8;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // Background with rounded rect
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    this.roundRect(ctx, 4, 4, maxWidth, totalHeight, cornerRadius);
    ctx.fill();

    // Green border
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 4, 4, maxWidth, totalHeight, cornerRadius);
    ctx.stroke();

    // Speaker name (cyan)
    ctx.font = 'bold 15px Courier New';
    ctx.fillStyle = '#00ccff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(speakerName, padding + 4, padding + 4);

    // Separator line
    ctx.strokeStyle = 'rgba(0,255,65,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding + 4, padding + headerHeight);
    ctx.lineTo(maxWidth - padding, padding + headerHeight);
    ctx.stroke();

    // Dialogue text (white)
    ctx.font = '16px Courier New';
    ctx.fillStyle = '#ffffff';
    let y = padding + headerHeight + 6;
    for (const line of wrappedLines) {
      ctx.fillText(line, padding + 4, y);
      y += lineHeight;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      opacity: 1,
    });
    const sprite = new THREE.Sprite(material);

    // Scale sprite to world units (roughly match visual size)
    const aspect = canvasWidth / canvasHeight;
    const spriteHeight = 3.5;
    sprite.scale.set(spriteHeight * aspect, spriteHeight, 1);

    return sprite;
  }

  private wordWrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Action indicator sprite ──────────────────────────────────────────

  private createActionIndicatorSprite(def: ActionIndicatorDef): THREE.Sprite {
    const canvasSize = 48;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d')!;

    // Background circle
    ctx.fillStyle = def.bgColor;
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Icon / text
    ctx.font = '22px Courier New';
    ctx.fillStyle = def.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.text, canvasSize / 2, canvasSize / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 4, 1);
    return sprite;
  }

  // ── Utility ──────────────────────────────────────────────────────────

  private disposeSprite(sprite: THREE.Sprite): void {
    const mat = sprite.material as THREE.SpriteMaterial;
    if (mat.map) {
      mat.map.dispose();
    }
    mat.dispose();
  }
}
