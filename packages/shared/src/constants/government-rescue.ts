import type { FilmJourney } from './film-story.js';

export type GovernmentRescueKind = 'questioning' | 'rooftop';
export type GovernmentRescuePhase =
  | 'ready' | 'monologue' | 'alarm_ready' | 'alarm'
  | 'opening' | 'bullet_time' | 'trinity' | 'download_ready' | 'downloading'
  | 'failed' | 'done';

export interface GovernmentRescueEncounter {
  kind: GovernmentRescueKind;
  phase: GovernmentRescuePhase;
  elapsed: number;
  attempt: number;
  resolve?: number;
  answer?: string;
  dodges?: number;
  wounds?: number;
  resolved?: number[];
  trinityShot?: boolean;
}

export type GovernmentRescueRole = 'neo' | 'trinity' | 'morpheus' | 'smith' | 'agent_brown' | 'agent_jones' | 'pilot';
export type GovernmentRescueGesture = GovernmentRescueEncounter & { role: GovernmentRescueRole };

export const GOVERNMENT_RESCUE = {
  questioning: {
    monologue: 12.5,
    failure: 6.5,
    alarm: 7.2,
    roots: {
      morpheus: { x: 0, z: -2.2, yaw: Math.PI },
      smith: { x: 0, z: -6.2, yaw: 0 },
      agent_brown: { x: -5.8, z: -8.4, yaw: .55 },
      agent_jones: { x: 5.8, z: -8.4, yaw: -.55 },
    },
  },
  rooftop: {
    opening: 3.4,
    beats: [1, 2.65, 4.25] as readonly number[],
    window: .55,
    finish: 5.35,
    trinity: 5.4,
    download: 5.2,
    roots: {
      neo: { x: 0, z: 2.5, yaw: Math.PI },
      trinity: { x: -4.2, z: 5.5, yaw: 2.58 },
      agent_jones: { x: 0, z: -8.8, yaw: 0 },
      pilot: { x: 0, z: -8.8, yaw: 0 },
    },
  },
} as const;

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };
const pulse = (time: number, center: number, radius: number): number => smooth(1 - Math.abs(time - center) / radius);

export function governmentLocked(journey: FilmJourney): boolean {
  const encounter = journey.government;
  if (!encounter || journey.visiting) return false;
  if (encounter.kind === 'questioning') return ['ready', 'monologue', 'alarm'].includes(encounter.phase);
  return ['ready', 'opening', 'bullet_time', 'trinity', 'downloading'].includes(encounter.phase);
}

export function governmentRoot(encounter: GovernmentRescueEncounter, role: GovernmentRescueRole) {
  if (encounter.kind === 'questioning') {
    const roots = GOVERNMENT_RESCUE.questioning.roots;
    return roots[role as keyof typeof roots] ?? roots.morpheus;
  }
  const roots = GOVERNMENT_RESCUE.rooftop.roots;
  if (encounter.phase === 'downloading' || encounter.phase === 'done') {
    if (role === 'neo') {
      const progress = smooth(encounter.elapsed / GOVERNMENT_RESCUE.rooftop.download);
      return {
        x: 11.5 + (8.8 - 11.5) * progress,
        z: -15.5 + (-17.5 + 15.5) * progress,
        yaw: -Math.PI * .75 + (Math.PI * .92 + Math.PI * .75) * progress,
      };
    }
    if (role === 'trinity') {
      const progress = smooth(encounter.elapsed / 3.8);
      return {
        x: roots.trinity.x + (5.4 - roots.trinity.x) * progress,
        z: roots.trinity.z + (-16.4 - roots.trinity.z) * progress,
        yaw: roots.trinity.yaw + (.9 - roots.trinity.yaw) * progress,
      };
    }
  }
  return roots[role as keyof typeof roots] ?? roots.neo;
}

export function governmentText(encounter: GovernmentRescueEncounter): string {
  if (encounter.kind === 'questioning') {
    if (encounter.phase === 'ready') return 'Smith 留下两名特工看守后走近审讯椅。先在手记中决定 Morpheus 靠什么守住接入密码。';
    if (encounter.phase === 'monologue') {
      const resolve = Math.round((encounter.resolve ?? 0) * 100);
      return `Smith 摘下耳机，隔绝同伴后逼问锡安主机密码。按住 G 对抗药物与压迫；意志 ${resolve}%。`;
    }
    if (encounter.phase === 'failed') return '药物和压迫让 Morpheus 失去意识。按 G 或在手记中选择重试，从审讯检查点恢复。';
    if (encounter.phase === 'alarm_ready') return '大堂枪声已经传到楼上。走近落地窗，按 G 见证警报、喷淋和特工回到房间。';
    if (encounter.phase === 'alarm') return encounter.elapsed < 2.1
      ? '远处爆炸震动玻璃，火警灯亮起，喷淋从天花板落下。'
      : encounter.elapsed < 4.8
        ? 'Brown 与 Jones 冲回房间。Smith 停止独白，重新戴上耳机。'
        : 'Smith 把 Morpheus 留在椅中，三名特工转向正在逼近的营救者。';
    return 'Morpheus 没有交出锡安接入密码；大堂营救迫使特工中断审讯。';
  }
  if (encounter.phase === 'ready') return '屋顶出口被飞行员挡住。按 G 举枪开火，迫使潜伏的特工接管身体。';
  if (encounter.phase === 'opening') return encounter.elapsed < 1.4
    ? '飞行员被系统接管，Agent Jones 转身面对 Neo。'
    : 'Neo 连续开火；Jones 沿弹道之间高速闪避，弹匣很快见底。';
  if (encounter.phase === 'bullet_time') {
    const next = GOVERNMENT_RESCUE.rooftop.beats.findIndex((_, index) => !(encounter.resolved ?? []).includes(index));
    return next < 0 ? '最后一条弹道已经掠过。保持姿势，等待 Trinity 找到射击线。'
      : `弹道正在逼近。看见时间收缩时按 X 闪避；已躲开 ${encounter.dodges ?? 0}/3，擦伤 ${encounter.wounds ?? 0}/1。`;
  }
  if (encounter.phase === 'failed') return 'Neo 被第二条未避开的弹道击倒。按 G 或在手记中重试屋顶交火。';
  if (encounter.phase === 'trinity') return encounter.elapsed < 1.25
    ? 'Jones 站到倒地的 Neo 面前。Trinity 已经绕到他的身后。'
    : encounter.elapsed < 2.4
      ? 'Trinity 在近距离扣动扳机，特工的身体失去控制。'
      : encounter.elapsed < 3.8
        ? 'Jones 的代码退出，倒下的身体重新变回屋顶飞行员。'
        : 'Trinity 拉起 Neo；两人同时看向停机坪上的直升机。';
  if (encounter.phase === 'download_ready') return '走到直升机驾驶舱旁，按 G 让 Trinity 接通 Tank 并请求 B-212 驾驶程序。';
  if (encounter.phase === 'downloading') return encounter.elapsed < 1.6
    ? 'Trinity 接通 Tank，报出屋顶直升机型号。'
    : encounter.elapsed < 3.8
      ? '驾驶程序写入神经接口；仪表、旋翼与操纵步骤依次变得清晰。'
      : 'Trinity 登上驾驶席，Neo 进入机舱，营救路线转向高层外墙。';
  return '屋顶通路已经夺回，B-212 驾驶程序加载完成。';
}

export function governmentPose(gesture: GovernmentRescueGesture) {
  if (gesture.kind === 'questioning') {
    const active = gesture.phase === 'monologue' || gesture.phase === 'alarm';
    const strain = gesture.role === 'morpheus' && active
      ? clamp((1 - (gesture.resolve ?? 1)) * .8 + Math.sin(gesture.elapsed * 1.7) * .12 + .2) : 0;
    const removeEarpiece = gesture.role === 'smith' && gesture.phase === 'monologue'
      ? smooth(gesture.elapsed / 1.4) * (1 - smooth((gesture.elapsed - 10.8) / 1.1)) : 0;
    const grip = gesture.role === 'smith' && gesture.phase === 'monologue' ? pulse(gesture.elapsed, 8.8, 2.2) : 0;
    const returning = ['agent_brown', 'agent_jones'].includes(gesture.role) && gesture.phase === 'alarm'
      ? smooth((gesture.elapsed - 1.8) / 2.2) : 0;
    return { restrained: gesture.role === 'morpheus' ? 1 : 0, strain, removeEarpiece, grip, returning,
      alarm: gesture.phase === 'alarm' ? smooth(gesture.elapsed / .8) : 0, armed: 0, bend: 0, fall: 0, help: 0, phone: 0 };
  }
  const opening = gesture.phase === 'opening'; const bullet = gesture.phase === 'bullet_time';
  const bend = gesture.role === 'neo' && bullet
    ? Math.max(...GOVERNMENT_RESCUE.rooftop.beats.map(beat => pulse(gesture.elapsed, beat, GOVERNMENT_RESCUE.rooftop.window * 1.8))) : 0;
  const jonesDodge = gesture.role === 'agent_jones' && opening ? Math.sin(clamp(gesture.elapsed / GOVERNMENT_RESCUE.rooftop.opening) * Math.PI * 3) ** 2 : 0;
  const fall = (gesture.role === 'agent_jones' || gesture.role === 'pilot') && gesture.phase === 'trinity'
    ? smooth((gesture.elapsed - 1.35) / 1.05) : 0;
  const help = ['neo', 'trinity'].includes(gesture.role) && gesture.phase === 'trinity' ? smooth((gesture.elapsed - 3.35) / 1.25) : 0;
  const phone = gesture.role === 'trinity' && gesture.phase === 'downloading' ? smooth(gesture.elapsed / .8) : 0;
  const aim = gesture.role === 'trinity' && gesture.phase === 'trinity' ? pulse(gesture.elapsed, 1.4, 1.1) : 0;
  return { restrained: 0, strain: 0, removeEarpiece: 0, grip: 0, returning: 0, alarm: 0,
    armed: ['neo', 'agent_jones'].includes(gesture.role) && (opening || bullet) || aim ? 1 : 0,
    bend, jonesDodge, fall, help, phone, aim };
}
