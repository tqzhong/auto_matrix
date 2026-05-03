import type { AgentState, AgentAction, Memory, Ability, Vector3 } from '@auto_matrix/shared';
import { generateId, distance, lerpVector3, clamp } from '@auto_matrix/shared';

export class Agent {
  readonly id: string;
  state: AgentState;
  personalityPrompt: string;
  shortTermMemory: Memory[] = [];
  private readonly maxMemories = 20;

  constructor(state: AgentState, personalityPrompt: string) {
    this.id = state.id;
    this.state = { ...state };
    this.personalityPrompt = personalityPrompt;
  }

  update(tick: number): void {
    this.updateAction(tick);
    this.updateMovement();
    this.updateEffects();
    this.updateCooldowns();
  }

  private updateAction(tick: number): void {
    if (!this.state.currentAction) return;
    if (this.state.currentAction.progress >= 1) {
      this.state.currentAction = null;
      return;
    }
    const elapsed = tick - this.state.currentAction.startedAt;
    this.state.currentAction.progress = clamp(elapsed / this.state.currentAction.duration, 0, 1);
  }

  private updateMovement(): void {
    if (!this.state.targetPosition) return;
    const dist = distance(this.state.position, this.state.targetPosition);
    if (dist < 0.5) {
      this.state.position = { ...this.state.targetPosition };
      this.state.targetPosition = null;
      this.state.currentPath = [];
      this.state.velocity = { x: 0, y: 0, z: 0 };
      return;
    }

    // Move toward target along path or direct
    let nextTarget: Vector3;
    if (this.state.currentPath.length > 0) {
      nextTarget = this.state.currentPath[0];
    } else {
      nextTarget = this.state.targetPosition;
    }

    const stepSize = 0.5; // blocks per tick
    const dir: Vector3 = {
      x: nextTarget.x - this.state.position.x,
      y: nextTarget.y - this.state.position.y,
      z: nextTarget.z - this.state.position.z,
    };
    const dirDist = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);

    if (dirDist < 0.5) {
      this.state.position = { ...nextTarget };
      if (this.state.currentPath.length > 0) {
        this.state.currentPath = this.state.currentPath.slice(1);
      }
      return;
    }

    const scale = stepSize / dirDist;
    this.state.position = {
      x: this.state.position.x + dir.x * scale,
      y: this.state.position.y + dir.y * scale,
      z: this.state.position.z + dir.z * scale,
    };
    this.state.velocity = {
      x: dir.x * scale,
      y: dir.y * scale,
      z: dir.z * scale,
    };

    // Update rotation to face movement direction
    this.state.rotation = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
  }

  private updateEffects(): void {
    this.state.activeEffects = this.state.activeEffects
      .map((e) => ({ ...e, remainingTicks: e.remainingTicks - 1 }))
      .filter((e) => e.remainingTicks > 0);
  }

  private updateCooldowns(): void {
    this.state.abilities = this.state.abilities.map((a) => ({
      ...a,
      currentCooldown: Math.max(0, a.currentCooldown - 1),
    }));
  }

  addMemory(memory: Memory): void {
    this.shortTermMemory.push(memory);
    if (this.shortTermMemory.length > this.maxMemories) {
      this.shortTermMemory = this.shortTermMemory.slice(-this.maxMemories);
    }
  }

  getRecentMemories(count: number): Memory[] {
    return this.shortTermMemory.slice(-count);
  }

  getCurrentContext(): string {
    const action = this.state.currentAction
      ? `${this.state.currentAction.type} (progress: ${Math.round(this.state.currentAction.progress * 100)}%)`
      : 'idle';

    return [
      `Name: ${this.state.name}`,
      `Location: ${this.state.currentLocation}`,
      `Goal: ${this.state.currentGoal}`,
      `Mood: ${this.state.mood}`,
      `Alertness: ${this.state.alertness}`,
      `Current action: ${action}`,
      `Health: ${this.state.health}/${this.state.maxHealth}`,
    ].join('\n');
  }

  setGoal(goal: string): void {
    this.state.currentGoal = goal;
  }

  setAction(action: AgentAction): void {
    this.state.currentAction = { ...action };
  }

  moveTo(target: Vector3, path?: Vector3[]): void {
    this.state.targetPosition = { ...target };
    this.state.currentPath = path ? path.map((p) => ({ ...p })) : [];
  }

  takeDamage(amount: number): number {
    const actualDamage = Math.max(0, amount);
    this.state.health = clamp(this.state.health - actualDamage, 0, this.state.maxHealth);
    if (this.state.health <= 0) {
      this.state.status = 'dead';
    }
    return actualDamage;
  }

  heal(amount: number): void {
    this.state.health = clamp(this.state.health + amount, 0, this.state.maxHealth);
  }

  canUseAbility(abilityId: string): boolean {
    const ability = this.state.abilities.find((a) => a.id === abilityId);
    if (!ability) return false;
    if (ability.requiredAwakened && !this.state.isAwakened) return false;
    if (ability.currentCooldown > 0) return false;
    return true;
  }

  activateAbility(abilityId: string, duration: number): boolean {
    if (!this.canUseAbility(abilityId)) return false;
    const abilityIdx = this.state.abilities.findIndex((a) => a.id === abilityId);
    if (abilityIdx === -1) return false;

    const ability = this.state.abilities[abilityIdx];
    const updatedAbilities = this.state.abilities.map((a, i) =>
      i === abilityIdx ? { ...a, currentCooldown: a.cooldownTicks } : a
    );
    this.state.abilities = updatedAbilities;

    const effect = {
      abilityId,
      remainingTicks: duration,
      visualEffect: ability.visualEffect,
    };
    this.state.activeEffects = [...this.state.activeEffects, effect];
    return true;
  }
}
