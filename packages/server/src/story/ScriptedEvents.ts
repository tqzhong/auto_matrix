import type { StoryPhaseId } from '@auto_matrix/shared';

export interface ScriptedEventDef {
  id: string;
  name: string;
  phase: StoryPhaseId;
  triggerTick: number;
  actions: Array<{
    type: string;
    parameters: Record<string, unknown>;
  }>;
}

export class ScriptedEvents {
  private events: ScriptedEventDef[] = [
    // === Phase 1: Normal Life ===
    {
      id: 'neo_sells_disc',
      name: 'Neo Sells Disc',
      phase: 'phase1_normal_life',
      triggerTick: 30,
      actions: [
        { type: 'trigger_dialogue', parameters: { speakers: ['neo', 'choi'], topic: 'Neo sells a black market disc to Choi' } },
        { type: 'narrate', parameters: { text: 'Neo在公寓里卖碟给Choi... "你有没有那种感觉，分不清自己是醒着还是在做梦？"' } },
      ],
    },
    {
      id: 'trinity_escapes',
      name: 'Trinity Escapes Agents',
      phase: 'phase1_normal_life',
      triggerTick: 80,
      actions: [
        { type: 'move_agent', parameters: { agentId: 'trinity', destination: 'rooftop_A' } },
        { type: 'narrate', parameters: { text: 'Trinity在屋顶被特工包围... "你们都会死在这里。" 但她通过电话逃脱了。' } },
      ],
    },
    {
      id: 'neo_white_rabbit',
      name: 'Neo Follows White Rabbit',
      phase: 'phase1_normal_life',
      triggerTick: 120,
      actions: [
        { type: 'narrate', parameters: { text: '"跟着白兔走。" Neo看到Dujour身上的白兔纹身，决定跟随他们去夜店...' } },
      ],
    },
    {
      id: 'neo_meets_trinity_club',
      name: 'Neo Meets Trinity at Club',
      phase: 'phase1_normal_life',
      triggerTick: 160,
      actions: [
        { type: 'trigger_dialogue', parameters: { speakers: ['neo', 'trinity'], topic: 'Trinity tells Neo she knows his hacker name' } },
        { type: 'narrate', parameters: { text: '在夜店里，Trinity找到了Neo... "我认识你。你是Neo。我一直在找你。"' } },
      ],
    },
    {
      id: 'agents_hunt_neo',
      name: 'Agents Hunt Neo',
      phase: 'phase1_normal_life',
      triggerTick: 250,
      actions: [
        { type: 'set_goal', parameters: { agentId: 'agent_smith', goal: '追踪并逮捕Thomas Anderson' } },
        { type: 'narrate', parameters: { text: '特工们注意到了Neo的异常活动。Agent Smith被派去追踪他...' } },
      ],
    },

    // === Phase 2: Awakening ===
    {
      id: 'morpheus_offers_choice',
      name: 'Morpheus Offers the Red Pill',
      phase: 'phase2_awakening',
      triggerTick: 50,
      actions: [
        { type: 'trigger_dialogue', parameters: { speakers: ['morpheus', 'neo'], topic: 'Morpheus offers Neo the choice between red and blue pill' } },
        { type: 'narrate', parameters: { text: '"我只能给你指路，走路的人是你自己。" Morpheus伸出手，左手是红色药丸，右手是蓝色药丸...' } },
      ],
    },
    {
      id: 'neo_takes_red_pill',
      name: 'Neo Takes the Red Pill',
      phase: 'phase2_awakening',
      triggerTick: 90,
      actions: [
        { type: 'awaken_agent', parameters: { agentId: 'neo' } },
        { type: 'narrate', parameters: { text: 'Neo吞下了红色药丸... Matrix开始在他周围溶解。他第一次睁开了真实的眼睛。' } },
      ],
    },
    {
      id: 'morpheus_speech',
      name: 'Morpheus Explains the Matrix',
      phase: 'phase2_awakening',
      triggerTick: 130,
      actions: [
        { type: 'trigger_dialogue', parameters: { speakers: ['morpheus', 'neo'], topic: 'Morpheus explains what the Matrix really is' } },
        { type: 'narrate', parameters: { text: '"Matrix无处不在，它就在我们周围。你上班时、去教堂时、纳税时，它都在。"' } },
      ],
    },
    {
      id: 'sparring_program',
      name: 'Sparring Training',
      phase: 'phase2_awakening',
      triggerTick: 250,
      actions: [
        { type: 'set_goal', parameters: { agentId: 'neo', goal: '和Morpheus在搏击程序中训练' } },
        { type: 'narrate', parameters: { text: '"你以为你在呼吸的空气是什么？" Morpheus在搏击程序中训练Neo。Neo开始相信。' } },
      ],
    },
    {
      id: 'oracle_visit',
      name: 'Visit the Oracle',
      phase: 'phase2_awakening',
      triggerTick: 450,
      actions: [
        { type: 'set_goal', parameters: { agentId: 'neo', goal: '去拜访Oracle' } },
        { type: 'set_goal', parameters: { agentId: 'morpheus', goal: '带Neo去见Oracle' } },
        { type: 'narrate', parameters: { text: 'Morpheus带Neo去见先知... "别担心那个花瓶。" "什么花瓶？" *啪*' } },
      ],
    },
    {
      id: 'cypher_betrayal',
      name: "Cypher's Betrayal",
      phase: 'phase2_awakening',
      triggerTick: 550,
      actions: [
        { type: 'narrate', parameters: { text: '赛弗与特工秘密接触... "无知是福。我要回到Matrix里去。"' } },
      ],
    },
    {
      id: 'lobby_shootout',
      name: 'The Lobby Shootout',
      phase: 'phase2_awakening',
      triggerTick: 700,
      actions: [
        { type: 'set_goal', parameters: { agentId: 'neo', goal: '突入大楼营救Morpheus' } },
        { type: 'set_goal', parameters: { agentId: 'trinity', goal: '配合Neo营救Morpheus' } },
        { type: 'narrate', parameters: { text: 'Neo和Trinity冲入大楼大厅...枪林弹雨中，Neo不再是那个Thomas Anderson了。' } },
      ],
    },
    {
      id: 'neo_vs_smith_subway',
      name: 'Neo vs Smith - Subway Fight',
      phase: 'phase2_awakening',
      triggerTick: 850,
      actions: [
        { type: 'set_goal', parameters: { agentId: 'neo', goal: '和Agent Smith战斗' } },
        { type: 'set_goal', parameters: { agentId: 'agent_smith', goal: '消灭Neo' } },
        { type: 'narrate', parameters: { text: '地铁站里，Neo和Smith第一次正面对决...这是两个世界之间的碰撞。' } },
      ],
    },

    // === Phase 3: War ===
    {
      id: 'smith_goes_rogue',
      name: 'Smith Breaks Free',
      phase: 'phase3_war',
      triggerTick: 30,
      actions: [
        { type: 'narrate', parameters: { text: 'Agent Smith挣脱了程序的束缚...他不再服从任何人。他开始复制自己...' } },
      ],
    },
    {
      id: 'smith_clones',
      name: 'Smith Clones Multiply',
      phase: 'phase3_war',
      triggerTick: 200,
      actions: [
        { type: 'spawn_smith_copy', parameters: { position: { x: 300, y: 0, z: 200 } } },
        { type: 'spawn_smith_copy', parameters: { position: { x: 310, y: 0, z: 200 } } },
        { type: 'narrate', parameters: { text: 'Smith的复制品在城市中蔓延...他们排成整齐的队列行走。一切都是他。' } },
      ],
    },
    {
      id: 'zion_siege',
      name: 'Machines Attack Zion',
      phase: 'phase3_war',
      triggerTick: 600,
      actions: [
        { type: 'set_goal', parameters: { agentId: 'commander_lock', goal: '指挥锡安防卫战' } },
        { type: 'set_goal', parameters: { agentId: 'captain_mifune', goal: '守住码头防线' } },
        { type: 'narrate', parameters: { text: '机器大军向锡安发起进攻...数以千计的哨兵涌入地下通道。人类最后的堡垒岌岌可危。' } },
      ],
    },
    {
      id: 'neo_sees_code',
      name: 'Neo Sees the Source',
      phase: 'phase3_war',
      triggerTick: 900,
      actions: [
        { type: 'narrate', parameters: { text: 'Neo在现实世界中举起手...他感受到了机器的存在。他看到了代码。一切开始清晰。' } },
      ],
    },
    {
      id: 'neo_enters_machine_city',
      name: 'Neo Enters Machine City',
      phase: 'phase3_war',
      triggerTick: 1400,
      actions: [
        { type: 'set_goal', parameters: { agentId: 'neo', goal: '前往机器城，寻找和平' } },
        { type: 'narrate', parameters: { text: 'Neo驾驶Logos号冲向机器城...Trinity在他身边。在那片黑暗的天空下，他准备面对一切。' } },
      ],
    },

    // === Phase 4: Resolution ===
    {
      id: 'neo_confronts_source',
      name: 'Neo Faces the Source',
      phase: 'phase4_resolution',
      triggerTick: 50,
      actions: [
        { type: 'trigger_dialogue', parameters: { speakers: ['neo', 'deus_ex_machina'], topic: 'Neo offers to stop Smith in exchange for peace' } },
        { type: 'narrate', parameters: { text: '"我来是为了谈条件。" Neo站在机械主宰面前，提出交易：他消灭Smith，换取人类与机器的和平。' } },
      ],
    },
    {
      id: 'final_battle',
      name: 'The Final Battle',
      phase: 'phase4_resolution',
      triggerTick: 300,
      actions: [
        { type: 'set_goal', parameters: { agentId: 'neo', goal: '在Matrix中与Smith进行最终决战' } },
        { type: 'set_goal', parameters: { agentId: 'agent_smith', goal: '消灭Neo，吞噬一切' } },
        { type: 'narrate', parameters: { text: '大雨倾盆...Neo和Smith在城市上空对峙。一切都指向这一刻。"' } },
      ],
    },
    {
      id: 'smith_destroyed',
      name: 'Smith is Destroyed',
      phase: 'phase4_resolution',
      triggerTick: 700,
      actions: [
        { type: 'narrate', parameters: { text: '"万物皆有终结。" Neo让Smith感染自己，从内部摧毁了病毒...所有Smith的复制品消失了。' } },
      ],
    },
    {
      id: 'peace_declared',
      name: 'Peace Between Worlds',
      phase: 'phase4_resolution',
      triggerTick: 900,
      actions: [
        { type: 'narrate', parameters: { text: '"我希望人类能够和平。" 机械主宰答应了Neo的条件...机器撤退了。战争结束了。一个新的时代开始了。' } },
      ],
    },
  ];

  getReady(tick: number, phaseId: StoryPhaseId, fired: Set<string>): ScriptedEventDef[] {
    return this.events.filter(e =>
      e.phase === phaseId &&
      e.triggerTick <= tick &&
      !fired.has(e.id)
    );
  }

  getById(eventId: string): ScriptedEventDef | undefined {
    return this.events.find(e => e.id === eventId);
  }

  getByPhase(phaseId: StoryPhaseId): ScriptedEventDef[] {
    return this.events.filter(e => e.phase === phaseId);
  }
}
