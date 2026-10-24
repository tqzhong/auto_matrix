import * as THREE from 'three';
import { HeroModels, type HeroRig } from '../agents/HeroModel.js';
import { advanceMotion, newMotion } from '../agents/CharacterMotion.js';
import { RED_DRESS_PLAZA } from '@auto_matrix/shared';

/** Pedestrians reuse the delivered CC0 anatomy and saved program clock. */
export class RedDressCrowd {
  readonly ready: Promise<void>;
  private models?: HeroModels;
  private actors: { group: THREE.Group; rig: HeroRig; base: number; direction: number; phase: number }[] = [];
  private disposed = false;
  private textures: THREE.Texture[] = [];
  private clock = 0;
  private started = false;
  private posedClock = NaN;
  private posedStarted = false;

  constructor(private groups: THREE.Group[]) {
    this.ready = typeof document === 'undefined' ? Promise.resolve() : this.load();
    void this.ready.catch(error => { if (!this.disposed) console.warn('红衣女子程序行人模型加载失败', error); });
  }

  private async load(): Promise<void> {
    const portrait = new THREE.Texture(), fabric = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    fabric.needsUpdate = true; this.textures.push(portrait, fabric);
    this.models = new HeroModels(portrait, fabric);
    await Promise.all(this.groups.map(async (group, index) => {
      const female = index % 3 === 1;
      const rig = await this.models!.create(female ? 'trinity' : 'neo', undefined, 'pedestrian');
      if (!rig || this.disposed) return;
      for (const part of rig.wardrobe) if (part.cloth) {
        part.color.setHex([0x424943, 0x7e7665, 0x585e62, 0x99968a][index % 4]);
        part.roughness = .86; part.metalness = 0;
      }
      group.clear(); group.add(rig.root); rig.root.name = `red-dress-pedestrian-${index}`;
      group.userData.detailed = true;
      this.actors.push({ group, rig, base: Number(group.userData.baseZ), direction: index % 2 ? 1 : -1, phase: index * .77 });
    }));
    if (!this.disposed) { this.posedClock = NaN; this.update(this.clock, this.started); }
  }

  update(clock: number, started: boolean): void {
    this.clock = clock; this.started = started;
    if (clock === this.posedClock && started === this.posedStarted) return;
    for (const actor of this.actors) {
      const travel = started ? clock * 2 : 0;
      const { near, far } = RED_DRESS_PLAZA.crowd, length = far - near;
      actor.group.position.z = ((actor.base + actor.direction * travel - near) % length + length) % length + near;
      actor.group.rotation.set(0, actor.direction > 0 ? 0 : Math.PI, 0);
      const motion = newMotion(); motion.time = clock; motion.phase = travel / 2.8 + actor.phase; motion.speed = started ? 2 : 0;
      const input = { speed: motion.speed, grounded: true, verticalVelocity: 0, turn: 0 };
      this.models!.animate(actor.rig, advanceMotion(motion, input, 0), motion, input, 0);
      actor.rig.glasses.visible = false;
    }
    this.posedClock = clock; this.posedStarted = started;
  }

  dispose(): void {
    this.disposed = true; this.models?.dispose(); this.textures.forEach(texture => texture.dispose());
    this.actors = []; this.textures = [];
  }
}
