import type { FilmJourney } from './film-story.js';

export type BookDoorPhase = 'ready'|'approaching'|'reaching'|'unlatching'|'grasping'|'opening'|'releasing'|'clearing'|'done';
export interface BookDoorBody { x:number; z:number; yaw:number }
export interface BookDoorEncounter {
  phase:BookDoorPhase; elapsed:number; door:number; book:number;
  neo:BookDoorBody; persephone:BookDoorBody; route:{x:number;z:number}[]; cursor:number;
}
export type BookDoorGesture=Pick<BookDoorEncounter,'phase'|'elapsed'|'door'|'book'|'persephone'>&{role:'neo'|'persephone'};
export const BOOK_DOOR={set:'film_keymaker_workshop',hinge:{x:-10.5,z:-18},width:5,depth:.6,height:13,radius:1.2,speed:3.1,
  anchor:{x:-8,z:-14.8},stance:{x:3.6,z:1.65},reaching:.6,unlatching:.75,grasping:.65,opening:3,releasing:.5,
  book:{x:3.9,y:1.35,z:.47,width:.56,height:2.1,depth:.38,angle:.22,grip:1.8},rail:{x:3.9,y:3.7,z:.5},
  clear:[{x:-8.85,z:-24.5},{x:-12,z:-24.5}]}as const;
export function bookDoorActive(j?:FilmJourney):boolean{return Boolean(j&&!j.visiting&&j.scene==='m2_library'&&j.step>=2);}
export function bookDoorLocked(s?:Pick<BookDoorEncounter,'phase'>):boolean{return Boolean(s&&s.phase!=='ready'&&s.phase!=='done');}
export function bookDoorAngle(door:number):number{return door===0?0:Math.PI/2*door;}
export function bookDoorProgress(j?:FilmJourney):number{return j?.scene==='m2_library'&&!j.visiting&&j.bookDoor?j.bookDoor.door:j?.completed.includes('m2_library')||j?.scene==='m2_library'&&j.step>=3?1:0;}
export function bookDoorPoint(x:number,y:number,z:number,door:number){const a=bookDoorAngle(door),c=Math.cos(a),s=Math.sin(a);return{x:BOOK_DOOR.hinge.x+x*c+z*s,y,z:BOOK_DOOR.hinge.z-x*s+z*c};}
export function bookDoorStance(door:number):BookDoorBody{const p=bookDoorPoint(BOOK_DOOR.stance.x,0,BOOK_DOOR.stance.z,door);return{x:p.x,z:p.z,yaw:Math.PI+bookDoorAngle(door)};}
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
export function bookDoorPalm(s:BookDoorGesture){
  const b=BOOK_DOOR.book,a=b.angle*s.book,c=Math.cos(a),sine=Math.sin(a),rail=bookDoorPoint(BOOK_DOOR.rail.x,BOOK_DOOR.rail.y,BOOK_DOOR.rail.z,s.door);
  const grip=bookDoorPoint(b.x,b.y+b.grip*c-b.depth/2*sine,b.z+b.grip*sine+b.depth/2*c,s.door);
  const blend=s.phase==='grasping'?smooth(s.elapsed/BOOK_DOOR.grasping):['opening','releasing'].includes(s.phase)?1:0;
  return{x:grip.x+(rail.x-grip.x)*blend,y:grip.y+(rail.y-grip.y)*blend,z:grip.z+(rail.z-grip.z)*blend,
    weight:s.phase==='reaching'?smooth(s.elapsed/BOOK_DOOR.reaching):s.phase==='releasing'?1-smooth(s.elapsed/BOOK_DOOR.releasing):['unlatching','grasping','opening'].includes(s.phase)?1:0};
}
export function bookDoorText(s:BookDoorEncounter):string{
  if(s.phase==='ready')return'走近书墙的金色标记，按 G 请 Persephone 开门。';
  if(s.phase==='approaching')return'Persephone 正沿通道走到书架前，Neo 让出操作的位置。';
  if(s.phase==='reaching')return'Persephone 伸手握住书脊。';
  if(s.phase==='unlatching')return'她扳动书脊，松开书墙的暗扣。';
  if(s.phase==='grasping')return'她合回书本，将手掌移到书架横档。';
  if(s.phase==='opening')return'Persephone 沿铰链推开书墙。';
  if(s.phase==='releasing'||s.phase==='clearing')return'书墙已打开。Persephone 松手并让出门道。';
  return'通往工坊的门道已经让开。走进去，亲自确认钥匙匠的身份。';
}
