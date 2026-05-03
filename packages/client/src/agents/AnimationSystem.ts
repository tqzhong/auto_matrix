import * as THREE from 'three';

export type AnimationState = 'idle' | 'walk' | 'fight';

interface AgentAnimation {
  state: AnimationState;
  elapsed: number;
  leftLeg: THREE.Object3D | null;
  rightLeg: THREE.Object3D | null;
  leftArm: THREE.Object3D | null;
  rightArm: THREE.Object3D | null;
  body: THREE.Object3D | null;
  baseY: number;
}

export class AnimationSystem {
  private agents: Map<string, AgentAnimation> = new Map();

  registerAgent(
    id: string,
    group: THREE.Group,
    initialState: AnimationState = 'idle',
  ): void {
    const children = group.children;
    const anim: AgentAnimation = {
      state: initialState,
      elapsed: Math.random() * 10,
      leftLeg: children[2] ?? null,
      rightLeg: children[3] ?? null,
      leftArm: null,
      rightArm: null,
      body: children[1] ?? null,
      baseY: group.position.y,
    };
    this.agents.set(id, anim);
  }

  removeAgent(id: string): void {
    this.agents.delete(id);
  }

  setState(id: string, state: AnimationState): void {
    const anim = this.agents.get(id);
    if (anim) {
      anim.state = state;
    }
  }

  update(delta: number): void {
    for (const anim of this.agents.values()) {
      anim.elapsed += delta;
      const t = anim.elapsed;

      switch (anim.state) {
        case 'walk':
          this.animateWalk(anim, t);
          break;
        case 'fight':
          this.animateFight(anim, t);
          break;
        case 'idle':
        default:
          this.animateIdle(anim, t);
          break;
      }
    }
  }

  private animateIdle(anim: AgentAnimation, t: number): void {
    const sway = Math.sin(t * 1.5) * 0.02;
    if (anim.body) {
      anim.body.rotation.z = sway;
    }

    if (anim.leftLeg) {
      anim.leftLeg.rotation.x = 0;
      anim.leftLeg.position.y = 0.5;
    }
    if (anim.rightLeg) {
      anim.rightLeg.rotation.x = 0;
      anim.rightLeg.position.y = 0.5;
    }
  }

  private animateWalk(anim: AgentAnimation, t: number): void {
    const walkSpeed = 8;
    const legSwing = Math.sin(t * walkSpeed) * 0.4;
    const bob = Math.abs(Math.sin(t * walkSpeed)) * 0.15;

    if (anim.leftLeg) {
      anim.leftLeg.rotation.x = legSwing;
    }
    if (anim.rightLeg) {
      anim.rightLeg.rotation.x = -legSwing;
    }
    if (anim.body) {
      anim.body.position.y = 3 + bob * 0.3;
      anim.body.rotation.z = Math.sin(t * walkSpeed) * 0.03;
    }
  }

  private animateFight(anim: AgentAnimation, t: number): void {
    const punchSpeed = 6;
    const punchSwing = Math.sin(t * punchSpeed) * 0.6;
    const dodge = Math.sin(t * 3) * 0.1;

    if (anim.body) {
      anim.body.rotation.z = dodge;
      anim.body.rotation.x = Math.sin(t * punchSpeed * 0.5) * 0.1;
    }

    if (anim.leftLeg) {
      anim.leftLeg.rotation.x = Math.sin(t * 4) * 0.2;
    }
    if (anim.rightLeg) {
      anim.rightLeg.rotation.x = Math.sin(t * 4 + 1) * 0.2;
    }
  }
}
