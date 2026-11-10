import { BOOK_DOOR,FILM_SETS,bookDoorActive,bookDoorAngle,bookDoorLocked,bookDoorProgress,bookDoorStance,bookDoorText,distance,filmPosition,playerBlocked,
  type AgentState,type BookDoorBody,type BookDoorEncounter,type BookDoorGesture,type FilmJourney,type SandboxState }from '@auto_matrix/shared';
import type { WorldState }from '../world/WorldState.js';

export function savedBookDoorAction(j:FilmJourney|undefined,actor:AgentState):boolean{
  const s=j?.bookDoor,a=actor.currentAction,g=a?.parameters.bookDoor as BookDoorGesture|undefined;
  if(!bookDoorActive(j)||!s||!g||!['neo','persephone'].includes(actor.id)||g.role!==actor.id||actor.id==='neo'&&!bookDoorLocked(s))return false;
  const b=actor.id==='neo'?s.neo:s.persephone,c=FILM_SETS[BOOK_DOOR.set].center;
  return Boolean((a?.type==='idle'||a?.type==='move_to')&&a.parameters.resolved===true&&g.phase===s.phase&&g.elapsed===s.elapsed&&g.door===s.door&&g.book===s.book
    &&g.persephone.x===s.persephone.x&&g.persephone.z===s.persephone.z&&g.persephone.yaw===s.persephone.yaw&&actor.currentLocation===BOOK_DOOR.set&&actor.isInMatrix
    &&Math.hypot(actor.position.x-c.x-b.x,actor.position.z-c.z-b.z)<1e-8&&actor.rotation===b.yaw);
}
export class BookDoorSystem{
  onAdvance?:(text:string,actor:AgentState,tick:number)=>void;
  constructor(private world:WorldState,private sandbox:()=>SandboxState){}
  private get journey(){return this.sandbox().neoLife?.journey;}
  active(actor:AgentState):boolean{return bookDoorActive(this.journey)&&actor.id===this.journey!.actor;}
  private body(actor:AgentState):BookDoorBody{const c=FILM_SETS[BOOK_DOOR.set].center;return{x:actor.position.x-c.x,z:actor.position.z-c.z,yaw:actor.rotation};}
  private available():boolean{const p=this.world.agents.get('persephone')!;return !p.controller&&p.status==='alive'&&p.health>0&&p.currentLocation===BOOK_DOOR.set&&p.isInMatrix;}
  private plan(s:BookDoorEncounter):void{s.route=[{x:-4,z:-12},bookDoorStance(0)];s.cursor=0;}
  private ensure():BookDoorEncounter{
    const j=this.journey!;
    if(!j.bookDoor){j.bookDoor={phase:j.step>=3?'done':j.started!==undefined?'approaching':'ready',elapsed:0,door:j.step>=3?1:0,book:0,
      neo:this.body(this.world.agents.get('neo')!),persephone:this.body(this.world.agents.get('persephone')!),route:[],cursor:0};
      if(j.bookDoor.phase==='approaching')this.plan(j.bookDoor);
      if(j.bookDoor.phase==='done')this.clearLegacyOverlap(j.bookDoor);
    }
    if(j.step===2)delete j.started;return j.bookDoor;
  }
  stage():void{if(bookDoorActive(this.journey))this.ensure();this.seal();}
  private clearLegacyOverlap(s:BookDoorEncounter):void{
    this.seal();const c=FILM_SETS[BOOK_DOOR.set].center,leaf=this.sandbox().structures.find(a=>a.id==='film:library:bookdoor')!;
    for(const role of ['neo','persephone','keymaker']as const){
      const a=this.world.agents.get(role)!;if(a.status!=='alive'||a.currentLocation!==BOOK_DOOR.set||a.controller&&role!=='neo')continue;
      const radius=role==='neo'?1.1:.8,x=a.position.x-leaf.position.x,z=a.position.z-leaf.position.z;
      if(Math.abs(z)>=BOOK_DOOR.width/2+radius||Math.abs(x)>=BOOK_DOOR.depth/2+radius)continue;
      for(const sign of [x<0?-1:1,x<0?1:-1]){
        const point={...a.position,x:leaf.position.x+sign*(BOOK_DOOR.depth/2+radius+.05)};
        if(playerBlocked(point,true,radius,this.sandbox().structures))continue;
        const before=a.position;a.position=point;
        if(role==='keymaker'&&this.journey!.keymaker){this.journey!.keymaker!.x=point.x-c.x;this.journey!.keymaker!.z=point.z-c.z;}
        else if(role==='neo'||role==='persephone')s[role]=this.body(a);
        if(role==='neo'&&distance(this.journey!.checkpoint,before)<1e-8)this.journey!.checkpoint={...point};break;
      }
    }
  }
  clear():void{for(const a of this.world.agents.values())if(!a.controller&&a.currentAction?.parameters.bookDoor)a.currentAction=null;this.sandbox().structures=this.sandbox().structures.filter(s=>s.id!=='film:library:bookdoor');}
  seal():void{
    const j=this.journey,id='film:library:bookdoor';
    if(!j||(j.visiting??j.scene)!=='m2_library'){this.sandbox().structures=this.sandbox().structures.filter(s=>s.id!==id);return;}
    const angle=bookDoorAngle(bookDoorProgress(j)),h=BOOK_DOOR.hinge;
    const leaf={id,kind:'barricade'as const,owner:'persephone',position:filmPosition(BOOK_DOOR.set,h.x+BOOK_DOOR.width/2*Math.cos(angle),h.z-BOOK_DOOR.width/2*Math.sin(angle)),matrix:true,health:999,
      film:{scene:'m2_library',width:BOOK_DOOR.width,depth:BOOK_DOOR.depth,height:BOOK_DOOR.height,yaw:angle}};
    const index=this.sandbox().structures.findIndex(s=>s.id===id);if(index<0)this.sandbox().structures.push(leaf);else this.sandbox().structures[index]=leaf;
  }
  private face(b:BookDoorBody,yaw:number,dt:number):boolean{const d=Math.atan2(Math.sin(yaw-b.yaw),Math.cos(yaw-b.yaw));b.yaw+=Math.max(-3.2*dt,Math.min(3.2*dt,d));return Math.abs(d)<.02;}
  private move(b:BookDoorBody,to:{x:number;z:number},speed:number,dt:number,radius:number):boolean{
    const x=to.x-b.x,z=to.z-b.z,gap=Math.hypot(x,z),scale=Math.min(1,speed*dt/Math.max(.001,gap)),next={x:b.x+x*scale,z:b.z+z*scale};
    if(gap>.01)this.face(b,Math.atan2(x,z),dt);
    if(playerBlocked(filmPosition(BOOK_DOOR.set,next.x,next.z),true,radius,this.sandbox().structures))return false;
    b.x=next.x;b.z=next.z;return gap<=speed*dt;
  }
  private phase(s:BookDoorEncounter,phase:BookDoorEncounter['phase']):void{s.phase=phase;s.elapsed=0;}
  private actors(s:BookDoorEncounter,dt:number):void{
    for(const role of ['neo','persephone']as const){const a=this.world.agents.get(role)!;if(role==='neo'&&!bookDoorLocked(s))continue;
      const before=a.position,b=s[role];a.position=filmPosition(BOOK_DOOR.set,b.x,b.z);a.rotation=b.yaw;a.targetPosition=null;a.currentPath=[];
      a.velocity=s.phase==='done'?{x:0,y:0,z:0}:{x:(a.position.x-before.x)/dt,y:0,z:(a.position.z-before.z)/dt};
      a.currentAction={type:Math.hypot(a.velocity.x,a.velocity.z)>.01?'move_to':'idle',parameters:{resolved:true,player:role==='neo',bookDoor:{phase:s.phase,elapsed:s.elapsed,door:s.door,book:s.book,persephone:{...s.persephone},role}},startedAt:this.journey!.enteredAt,duration:1e9,progress:0};
    }
  }
  frame(actor:AgentState,dt:number,tick:number):boolean{
    if(!this.active(actor))return false;const j=this.journey!,s=this.ensure();this.seal();if(dt<=0||s.phase==='ready'||s.phase==='done')return bookDoorLocked(s);
    if(!this.available()){j.lastText='Persephone 目前无法参与；书脊、门角和操作进度停在原处。';return true;}
    dt=Math.min(.1,dt);s.elapsed+=dt;
    if(s.phase==='approaching'){
      const p=this.world.agents.get('persephone')!;if(!p.currentAction?.parameters.bookDoor){s.persephone=this.body(p);this.plan(s);}
      if(s.cursor<s.route.length&&this.move(s.persephone,s.route[s.cursor],BOOK_DOOR.speed,dt,.8))s.cursor++;
      const arrived=this.move(s.neo,BOOK_DOOR.anchor,4.2,dt,1.1),stance=bookDoorStance(0);
      const a=arrived&&this.face(s.neo,Math.atan2(BOOK_DOOR.hinge.x+BOOK_DOOR.book.x-BOOK_DOOR.anchor.x,BOOK_DOOR.hinge.z-BOOK_DOOR.anchor.z),dt);
      const b=s.cursor>=s.route.length&&this.face(s.persephone,stance.yaw,dt);if(a&&b)this.phase(s,'reaching');
    }else if(s.phase==='clearing'){
      if(s.cursor<s.route.length&&this.move(s.persephone,s.route[s.cursor],BOOK_DOOR.speed,dt,.8))s.cursor++;
      if(s.cursor>=s.route.length&&this.face(s.persephone,Math.atan2(s.neo.x-s.persephone.x,s.neo.z-s.persephone.z),dt)){this.phase(s,'done');this.onAdvance?.('Persephone 扳动书脊、松开暗扣并推开书墙，随后让出了通往工坊的门道。',actor,tick);}
    }else{
      const phases=['reaching','unlatching','grasping','opening','releasing']as const,index=phases.indexOf(s.phase as typeof phases[number]);
      if(s.phase==='unlatching')s.book=Math.min(1,s.elapsed/BOOK_DOOR.unlatching);
      if(s.phase==='grasping')s.book=Math.max(0,1-s.elapsed/BOOK_DOOR.grasping);
      if(s.phase==='opening'){s.door=Math.min(1,s.elapsed/BOOK_DOOR.opening);s.persephone=bookDoorStance(s.door);}
      if(index>=0&&s.elapsed>=BOOK_DOOR[phases[index]]){const next=index===phases.length-1?'clearing':phases[index+1];this.phase(s,next);if(next==='clearing'){s.route=BOOK_DOOR.clear.map(p=>({...p}));s.cursor=0;}}
    }
    this.actors(s,dt);this.seal();j.lastText=bookDoorText(s);
    if(!bookDoorLocked(s)&&actor.currentAction?.parameters.bookDoor){actor.currentAction=null;actor.velocity={x:0,y:0,z:0};}
    return bookDoorLocked(s);
  }
  command(actor:AgentState,target:string):string|undefined{
    if(!this.active(actor)||this.journey!.step!==2)return;const j=this.journey!,s=this.ensure();
    if(target==='retry'){actor.status='alive';actor.health=actor.maxHealth;actor.activeEffects=[];actor.position=bookDoorLocked(s)?filmPosition(BOOK_DOOR.set,s.neo.x,s.neo.z):{...j.checkpoint};if(bookDoorLocked(s))actor.rotation=s.neo.yaw;actor.velocity={x:0,y:0,z:0};return j.lastText='已接回书墙检查点；机关、门角、Persephone 的位置与伤势保留。';}
    if(target!=='act')return;if(bookDoorLocked(s))return j.lastText=bookDoorText(s);
    if(!this.available())return 'Persephone 目前无法操作书墙；等待她回到队伍。';
    if(distance(actor.position,filmPosition(BOOK_DOOR.set,BOOK_DOOR.anchor.x,BOOK_DOOR.anchor.z))>BOOK_DOOR.radius)return '先走近书墙前的金色标记，再按 G。';
    s.neo=this.body(actor);s.persephone=this.body(this.world.agents.get('persephone')!);this.plan(s);this.phase(s,'approaching');j.checkpoint={...actor.position};return j.lastText=bookDoorText(s);
  }
}
