import { LOCATIONS } from './locations.js';
import type { Vector3 } from '../types/agent.js';

// Walkable ground floors share their dimensions with building collision.
export const LIFE_ROOMS: Record<string, { width: number; depth: number; theme: 'home' | 'office' | 'cafe' | 'bar' | 'oracle' }> = {
  neo_apartment: { width: 28, depth: 24, theme: 'home' },
  metacortex_office: { width: 32, depth: 26, theme: 'office' },
  corner_cafe: { width: 28, depth: 24, theme: 'cafe' },
  nightclub: { width: 32, depth: 26, theme: 'bar' },
  oracles_apartment: { width: 28, depth: 24, theme: 'oracle' },
};
export function lifeRoomCenter(location: string): Vector3 | undefined {
  const room = LIFE_ROOMS[location]; const site = LOCATIONS[location];
  return room && site ? { x: (site.bounds.min.x + site.bounds.max.x) / 2, y: 1, z: site.bounds.max.z - room.depth / 2 } : undefined;
}
export function insideLifeRoom(position: Vector3): string | undefined {
  return Object.keys(LIFE_ROOMS).find(id => {
    const center = lifeRoomCenter(id)!; const room = LIFE_ROOMS[id];
    return position.y >= 0 && position.y < 9 && Math.abs(position.x - center.x) < room.width / 2 && Math.abs(position.z - center.z) < room.depth / 2;
  });
}
export const LIFE_DESTINATIONS = ['neo_apartment', 'metacortex_office', 'corner_cafe', 'times_square', 'central_park', 'nightclub', 'subway_station'];
export interface LifeAction {
  id: string; name: string; location: string; minutes: number; cost: number;
  energy: number; satiety: number; social: number; window?: [number, number]; once?: boolean;
  description: string; result: string;
}
export const LIFE_ACTIONS: LifeAction[] = [
  { id: 'breakfast', name: '做一份早餐', location: 'neo_apartment', minutes: 30, cost: 4, energy: 8, satiety: 40, social: 0, description: '厨房 · 30 分钟 · $4', result: '烤面包的气味填满了房间。电视里是普通的早间新闻。' },
  { id: 'computer', name: '浏览电脑与邮件', location: 'neo_apartment', minutes: 45, cost: 0, energy: -8, satiety: -3, social: -3, once: true, description: '书桌 · 45 分钟 · 每天一次', result: '收件箱里有账单、广告和一封朋友的邮件。你清理了桌面，记下几段想继续追查的文字。' },
  { id: 'sleep', name: '睡到明早 07:30', location: 'neo_apartment', minutes: 480, cost: 0, energy: 100, satiety: -15, social: -5, description: '卧室 · 休息到次日早晨', result: '窗外传来第一班车的声音。闹钟响起，又是一个工作日。' },
  { id: 'work', name: '完成今天的班次', location: 'metacortex_office', minutes: 420, cost: -95, energy: -32, satiety: -35, social: 8, window: [8, 11], once: true, description: '工位 · 08:00–11:00 开始 · 7 小时 · +$95', result: '你修复了一个报表程序，参加例会，听同事抱怨通勤。薪水入账，下班后的时间属于你。' },
  { id: 'coworker', name: '与同事聊一会儿', location: 'metacortex_office', minutes: 25, cost: 0, energy: 3, satiety: -2, social: 20, window: [8, 18], once: true, description: '休息区 · 08:00–18:00 · 25 分钟', result: '同事谈起周末的计划，顺便夸了你的代码。人与人的关系，也在这些琐事里生长。' },
  { id: 'coffee', name: '咖啡与午餐', location: 'corner_cafe', minutes: 40, cost: 12, energy: 18, satiety: 55, social: 8, window: [6, 22], description: '咖啡馆 · 06:00–22:00 · $12', result: '咖啡、热汤、隔壁桌的闲谈。窗外的行人各自奔向不同的目的地。' },
  { id: 'shop', name: '逛街买些日用品', location: 'times_square', minutes: 60, cost: 18, energy: -8, satiety: 20, social: 12, window: [9, 22], once: true, description: '商业街 · 09:00–22:00 · $18', result: '你挑了新笔记本和晚餐材料。收银员递来小票，城市照常营业。' },
  { id: 'walk', name: '在公园散步', location: 'central_park', minutes: 45, cost: 0, energy: 15, satiety: -6, social: 10, once: true, description: '公园步道 · 45 分钟 · 免费', result: '树叶在阳光里晃动。暂时离开屏幕后，你注意到了城市里许多微小的声音。' },
  { id: 'bar', name: '在酒吧坐一会儿', location: 'nightclub', minutes: 75, cost: 16, energy: -10, satiety: 8, social: 30, window: [18, 24], once: true, description: '酒吧 · 18:00–24:00 · $16', result: '低音穿过地板，有人谈音乐，有人谈一场奇怪的梦。你未必赞同他们，却愿意多听一会儿。' },
  { id: 'invite', name: '给朋友打电话，约今晚见面', location: 'neo_apartment', minutes: 10, cost: 0, energy: 0, satiety: 0, social: 8, window: [6, 19], once: true, description: '家中电话 · 预约今日 19:00 咖啡馆', result: '朋友 Choi 答应今晚七点见面。他说，最近你似乎总在想别的事。' },
  { id: 'meet', name: '赴朋友的约', location: 'corner_cafe', minutes: 60, cost: 10, energy: 10, satiety: 25, social: 45, window: [18.5, 20.5], once: true, description: '咖啡馆 · 18:30–20:30 · 需要预约 · $10', result: '你和 Choi 聊工作、关系与未来。他愿意相信你的经历，也提醒你照顾好自己。' },
  { id: 'rest', name: '在长椅上休息', location: 'central_park', minutes: 60, cost: 0, energy: 30, satiety: -4, social: 0, description: '公园 · 1 小时 · 免费', result: '坐了一会儿，疲惫渐渐散去。世界不会因为你慢下来就停止。' },
  { id: 'wait', name: '等一小时', location: '', minutes: 60, cost: 0, energy: -2, satiety: -3, social: -2, description: '原地 · 1 小时', result: '时针继续向前，街上的人流换了一批。' },
];
export function lifeActionPosition(action: LifeAction): Vector3 {
  const site = LOCATIONS[action.location];
  return lifeRoomCenter(action.location) ?? { x: (site.bounds.min.x + site.bounds.max.x) / 2, y: 1, z: site.bounds.max.z + 9 };
}
