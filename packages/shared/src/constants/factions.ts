// 阵营定义
export interface Faction {
  id: string;
  name: string;
  description: string;
  defaultAlignment: 'good' | 'evil' | 'neutral';
}

export const FACTIONS: Record<string, Faction> = {
  zion: {
    id: 'zion',
    name: '锡安反抗军',
    description: '人类反抗军，致力于从Matrix中解放人类',
    defaultAlignment: 'good',
  },
  machines: {
    id: 'machines',
    name: '机器帝国',
    description: '控制Matrix的机器势力，圈养人类获取能源',
    defaultAlignment: 'evil',
  },
  merovingian: {
    id: 'merovingian',
    name: '梅罗文加势力',
    description: '流亡程序头目，掌控信息交易和后门',
    defaultAlignment: 'neutral',
  },
  exiles: {
    id: 'exiles',
    name: '流亡程序',
    description: '脱离系统控制的程序，各自为战',
    defaultAlignment: 'neutral',
  },
  civilians: {
    id: 'civilians',
    name: '普通市民',
    description: '在Matrix中生活的普通人类，不知道真相',
    defaultAlignment: 'neutral',
  },
  oracle: {
    id: 'oracle',
    name: '先知阵营',
    description: 'Oracle及其守护者，引导人类与程序的平衡',
    defaultAlignment: 'good',
  },
};
