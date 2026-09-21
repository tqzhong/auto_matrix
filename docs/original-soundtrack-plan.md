# 三部曲原声场景安排

更新日期：2026-09-21。所有游戏 BGM 仅使用已经取得的 14 段电影原版录音，全部 26 个音乐场景均有明确匹配。音频来自 [Don Davis 官网](https://www.dondavis.net/audio/)，共约 21 分钟。原始地址、时长与 SHA-256 见 `packages/client/src/engine/film-score.json`。下表为游戏情境适配，不代表电影每个同名场景都使用了这段录音。

## 实际配曲

| 游戏场景 | 电影原声 | 影片 | 场景相对音量 |
| --- | --- | --- | --- |
| 日常生活 | Niaiserie | The Matrix Reloaded | 55% |
| 办公室 | Niaiserie | The Matrix Reloaded | 35% |
| 咖啡与朋友 | Niaiserie | The Matrix Reloaded | 50% |
| 酒吧与夜店 | Niaiserie | The Matrix Reloaded | 60% |
| 梅罗文加的餐厅 | Niaiserie | The Matrix Reloaded | 55% |
| 深夜与休息 | The Logos Location | The Matrix Revolutions | 40% |
| 现实的裂缝 | Unable to Speak | The Matrix | 65% |
| 初见崔尼蒂 | Trinity Infinity | The Matrix | 60% |
| 红蓝药丸与觉醒 | The Lafayette Mirror | The Matrix | 70% |
| 矩阵探索 | Trinity Infinity | The Matrix | 65% |
| 道场 | The Subway Fight | The Matrix | 80% |
| 营救与地铁决斗 | The Subway Fight | The Matrix | 95% |
| 餐厅与城堡交锋 | Chateau Swashbuckling | The Matrix Reloaded | 95% |
| 潜入与封锁 | Das Banegold | The Matrix Revolutions | 65% |
| 高速公路 | Multiple Replication | The Matrix Reloaded | 90% |
| Smith 围攻 | Multiple Replication | The Matrix Reloaded | 95% |
| 先知与哲学选择 | Neovision | The Matrix Revolutions | 45% |
| 锡安与飞船 | Das Banegold | The Matrix Revolutions | 50% |
| Mobil 车站 | The Logos Location | The Matrix Revolutions | 55% |
| 锡安防线 | Chateau Swashbuckling | The Matrix Reloaded | 90% |
| 贝恩遭遇 | The Bane Revelation | The Matrix Revolutions | 95% |
| 崔尼蒂告别 | Neovision | The Matrix Revolutions | 60% |
| 建筑师与机器核心 | Deus Ex Machina | The Matrix Revolutions | 65% |
| 最终决战 | Neodämmerung | The Matrix Revolutions | 100% |
| 救世主觉醒 | Anything is Possible | The Matrix | 85% |
| 循环的终点 | Anything is Possible | The Matrix | 65% |

场景音量叠加玩家的音乐音量设置；阅读、对话、暂停时还会进一步压低，切到后台静音。

## 剧情与切换

- 普通日常、上班、咖啡馆、酒吧共用 Niaiserie，在地点之间保留播放位置，按情境调整音量；第一次与崔尼蒂接头切为 Trinity Infinity。
- 办公室异常用 Unable to Speak，红蓝药丸与醒来用 The Lafayette Mirror；救世主觉醒用 Anything is Possible。
- 餐厅谈判用 Niaiserie，附近的有效敌人或玩家攻击触发 Chateau Swashbuckling。贝恩章节与相应共享任务固定使用 The Bane Revelation；最终战固定使用 Neodämmerung。
- Mobil 车站使用 The Logos Location。先知与哲学选择使用轻声的 Neovision；核心谈判使用 Deus Ex Machina。战斗进入最终选择阶段后结束战斗延续，进入对话配乐。
- 地点稳定两秒后切歌，战斗快速淡入；短暂脱离交战保留八秒。章节、角色和循环变化清除旧战斗状态。剧情曲只在对应目的地生效，远处其他角色的任务与战斗不会改变当前角色的音乐。
- 原声音频按完整文件时长循环，音乐与动作音效进入同一个录像混音。加载失败会淡出上一场景音乐并提示重试；不回退合成曲，也不保留不合时宜的战斗音乐。

## 素材与试听

旧的 19 段合成 BGM、生成脚本与试听合集已从项目移除。游戏不再读取旧浏览器导入曲，也没有外部音频覆盖入口；原有浏览器数据未删除。声音面板按场景列出实际曲名、影片与时长，可以试听，关闭后恢复游戏配乐。

仓库包含游戏实际使用的 14 个原声 MP3，共约 15.23 MB；拉取后无需额外导入。重复的总合集、分部试听文件和试玩录像已清理，`output/` 不纳入版本控制。`npm run music:originals` 可校验并恢复缺失音频；素材来源与使用说明见 `packages/client/public/assets/music/originals/README.md`。
