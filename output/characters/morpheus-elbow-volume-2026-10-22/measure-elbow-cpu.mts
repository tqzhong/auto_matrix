import { writeFile } from 'node:fs/promises';
const units = [
  { name: 'before', fixture: await import('./baseline-fixture.mjs'), motion: await import('../morpheus-sewn-contact-2026-10-22/release/packages/client/src/agents/CharacterMotion.js') },
  { name: 'after', fixture: await import('./mesh-fixture.mjs'), motion: await import('./release/packages/client/src/agents/CharacterMotion.js') },
];
const actors = [];
for (const unit of units) actors.push({ ...unit, h: await unit.fixture.model(), state: unit.motion.newMotion(), samples: [] as number[] });
try {
  for (const profile of ['run', 'guard'] as const) {
    for (const actor of actors) { actor.state = actor.motion.newMotion(); actor.samples = []; }
    const input = { speed: profile === 'run' ? 8.4 : 0, grounded: true, verticalVelocity: 0, turn: 0, ambushWardrobe: 'coat' as const };
    for (let frame = 0; frame < 120; frame++) for (const actor of frame % 2 ? actors.slice().reverse() : actors) {
      const current = profile === 'guard' ? { ...input, attack: Math.floor(frame / 36), combo: 2 } : input;
      const start = process.cpuUsage();
      actor.h.models.animate(actor.h.rig, actor.motion.advanceMotion(actor.state, current, 1 / 60), actor.state, current, 1 / 60);
      const cpu = process.cpuUsage(start); if (frame >= 30) actor.samples.push((cpu.user + cpu.system) / 1000);
    }
    const result = actors.map(actor => {
      const values = actor.samples.sort((a, b) => a - b), bend = (actor.h.models as any).ambushWardrobes.get(actor.h.rig).sleeveBend;
      return { name: actor.name, samples: values.length, median: values[Math.floor(values.length / 2)], p95: values[Math.floor(values.length * .95)],
        sleeve: bend?.parts.map((part: any) => ({ mesh: part.mesh.name, vertices: part.vertices.length, normalVertices: part.normalVertices.length, faces: part.faces.length / 3 })) ?? null };
    });
    await writeFile(new URL(`elbow-cpu-${profile}.json`, import.meta.url), JSON.stringify({ scope: 'paired synchronous animation CPU in one Node process; not browser FPS; concurrent validation load', result }, null, 2) + '\n');
    console.log(profile, JSON.stringify(result));
  }
} finally { for (const actor of actors) actor.h.models.dispose(); }
