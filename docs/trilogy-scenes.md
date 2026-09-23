# 三部曲场景与剧情实施记录

更新：2026-09-23。

最新范围已调整为选取关键电影段落，优先做好可玩性与布景，不要求穷举影片所有镜头。大堂营救已增加专用枪战与布景；后续优先级、验收证据和限制见 [关键片段制作记录](key-scenes.md)。下面的 103 段是当前剧情索引（原 102 段加一段先知送信衔接）。

## 当前完成度

这是可运行的三部曲场景原型：103 个剧情段落、58 个可进入场景、38 类建筑布局。计数按本项目任务粒度划分，不是电影逐镜头统计，也不代表原片所有室内房间、镜头与动作已经一比一复现。当前空间主要由程序生成的几何与 PBR 材质组成，尚未达到电影级美术验收标准。

三部影片的事件顺序、主要人物所在地点、营救与背叛、建筑师的选择、停战结局已串成连续路线。成片事件是路线依据；日常养成、蓝色药丸分支、哲学反思记录、场景回访与下一轮生活属于游戏扩展。非 Neo 出场的情节由对应人物游玩，例如 Trinity 的序幕、Morpheus 的营救、Niobe 的电站与归航、Kid 的闸门；角色已被另一玩家控制时保留进度并拒绝强占。

## 如何体验

以 Neo 继续原有存档。生活异常引出联系后，按 J，在生活手记选择「进入电影序幕」。WASD 移动，金色圆环标示当前目标；走近后 G 互动，J 记录反思；F 连击、X 闪避、1 医疗包。每段全部目标完成后 G 继续。J 或 M 可查看三部曲场景手记，完成过的场景可以回访并返回原位置。死亡重建返回当前目标检查点。完成日出尾声后保存通关，再开始下一轮生活。

原有生活进度不被自动重置；旧 29 章数据保留以兼容存档。首次选择电影序幕会从 Trinity 的 303 房间开始，之后保存到具体场景、目标、当前人物和战斗。

## 实现入口

| 内容 | 文件 |
| --- | --- |
| 场景名称、尺寸、世界、光线与共享碰撞 | packages/shared/src/constants/film-sets.ts |
| 103 段剧情、角色、目标、叙述与音乐匹配 | packages/shared/src/constants/film-story.ts |
| 步骤验证、战斗、检查点、回访与角色交接 | packages/server/src/story/FilmStorySystem.ts |
| 日常生活、蓝色药丸与循环衔接 | packages/server/src/story/NeoLifeSystem.ts |
| 建筑、道具、材质、局部灯光与列车动画 | packages/client/src/engine/FilmSetRenderer.ts |
| 锡安回港六处专用布景与动态人群 | packages/client/src/engine/ZionHomecomingRenderer.ts |
| 工业阁楼、出口电话与 Smith 复制视觉 | packages/client/src/engine/BaneCopyRenderer.ts |
| 场景手记 | packages/client/src/player/FilmJourneyPanel.ts |
| 运行时贴图与来源 | packages/client/public/assets/film-materials/ |
| 剧情路由测试、地图边界与楼梯测试 | tests/film-story.test.mts / tests/film-world.test.mts |

新区域按当前人物位置加载，离开时释放自身几何、材质与纹理；旧城市继续作为日常生活区域。58 个地点均有对应场景实现，但部分地点仍共用建筑家族，不能据此宣称美术已经逐场验收。

## 素材与研究依据

本次通过成片台词转录、制作者访谈、摄影资料与外景资料核对，没有直接在工作区观看三部完整影片。转录用于事件顺序，制作访谈用于布局与材质方向；取景地并不等于故事地点。没有把早期剧本里的删除桥段当作已上映剧情。任务说明为自行撰写的中文概述，没有导入整段电影台词或电影视频。

- [第一部成片转录](https://www.matrixfans.net/movies/the-matrix/transcript/)、[第二部成片转录](https://www.matrixfans.net/movies/the-matrix-reloaded/transcript/)、[第三部成片转录](https://www.matrixfans.net/movies/the-matrix-revolutions/transcript/)。
- [ASC：Bill Pope 的摄影与布光](https://theasc.com/article/flashback-the-matrix-cinematography/)：用于区分构造体、矩阵与现实环境，以及大堂等场面的照明方向。
- [雕塑师 Belinda Villani 访谈](https://www.matrixfans.net/interview-with-belinda-villani-sculptor-australia-from-the-matrix-reloaded-and-revolutions-2003/)：城堡地面拼花、半身像、楼梯和武器陈设的参考。
- [艺术指导 Catherine Mansill 访谈](https://www.matrixfans.net/interview-with-catherine-mansill-art-director-australia-from-the-matrix-reloaded-2003/)及[制作设计 Owen Paterson 访谈](https://www.matrixfans.net/interview-with-owen-paterson-production-designer-part-2-from-the-matrix-reloaded-and-revolutions-2003/)：续集布景参考。
- [第一部取景地](https://www.movie-locations.com/movies/m/Matrix.php)、[第二部取景地](https://www.movie-locations.com/movies/m/Matrix-Reloaded.php)、[第三部取景地](https://www.movie-locations.com/movies/m/Matrix-Revolutions.php)：辅助核对场所特征，不用取景城市代替虚构的 Matrix 城市设定。
- [Poly Haven 素材许可](https://polyhaven.com/license)：6 套 CC0、1K PBR 材质，共 18 张运行时 JPG，约 10.2 MB；下载地址和 MD5 写在 sources.json。分别用于大理石、木地板、破损墙面、红皮革、金属与白灰泥。

## 仍待完成的电影级还原

1. **逐镜头核对**：需要逐一比对成片的时间码、镜头、空间相邻关系、出场人物与道具。目前的 103 段是剧情索引，不是完整镜头清单。
2. **美术**：细化实际比例、门窗通道、建筑结构与房间分隔，替换部分程序几何为有依据的 GLB 布景、道具和贴图；目前人物模型未在本轮重做。
3. **动作与载具**：跳楼、直升机救援、高速追车、空中营救、Logos 航行、APU 操作和决战飞行等仍由到达目标与定时交互的叙述承接，尚无对应的完整可控机制和镜头演出。除大堂新增的三波持枪战斗外，其他战斗目标使用现有近战与技能系统。
4. **场景交互**：目前碰撞覆盖边界、柱列和城堡楼梯；装饰家具大多没有独立碰撞，尚无全面可破坏环境。叙事角色站位用于呈现当前段落，尚无完整表演、口型或原声配音。
5. **体验调优**：103 段间使用显式继续切换，尚未做到同一无缝大地图。基础验收包含全部路线的服务器测试与部分场景实机检查；不能据此宣称已经手动玩完全部路线或确认所有画面达标。

## 场景清单

下面的「游玩步骤」列出当前已实现的交互类型；定时交互不能等同于其文字所描述的电影动作已经被动画化。

### 1. 黑客帝国（43 段）

| ID | 剧情段落 | 场景 | 操控人物 | 游玩步骤 |
| --- | --- | --- | --- | --- |
| m1_room303 | 追踪中的房间 303 | 城市之心旅馆 · 303 | Trinity | 交互 → 战斗 → 移动 |
| m1_roofs | 屋顶追逐 | 旅馆屋顶与消防梯 | Trinity | 移动 → 移动 → 交互 |
| m1_phone_escape | 卡车前的电话 | Wells & Lake · 电话亭 | Trinity | 移动 → 交互 |
| m1_wake_up | 屏幕上的来信 | Anderson 公寓 · 101 | Neo | 交互 → 交互 |
| m1_club | 白兔与 Trinity | 地下夜店 · 白兔 | Neo | 移动 → 反思 |
| m1_boss | 迟到的员工 | Metacortex · 办公层 | Neo | 交互 → 交互 |
| m1_office_escape | 隔间之间 | Metacortex · 办公层 | Neo | 移动 → 移动 → 交互 |
| m1_ledge | 窗外的恐惧 | Metacortex · 窗外窄台 | Neo | 移动 → 反思 |
| m1_interrogation | 无法开口 | 特工审讯室 | Neo | 移动 → 交互 |
| m1_wake_again | 并非一场梦 | Anderson 公寓 · 101 | Neo | 交互 → 移动 |
| m1_bridge | 桥下的车灯 | Adams Street · 桥下 | Neo | 移动 → 交互 |
| m1_bug | 取出追踪器 | 接头轿车 · 除虫 | Neo | 交互 → 反思 |
| m1_pills | 两把皮椅之间 | Lafayette · 药丸与镜面 | Neo | 移动 → 反思 |
| m1_mirror | 镜面与定位 | Lafayette · 药丸与镜面 | Neo | 交互 → 移动 |
| m1_pod | 第一次睁眼 | 培养舱与收割塔 | Neo | 交互 → 交互 |
| m1_recovery | 从未使用的肌肉 | 尼布甲尼撒号 · 核心与医疗舱 | Neo | 交互 → 移动 |
| m1_construct | 残余自我影像 | 构造体 · 白色空间 | Neo | 交互 → 反思 |
| m1_desert | 真实世界的废墟 | 真实世界的废墟 | Neo | 移动 → 交互 |
| m1_download | 训练下载 | 尼布甲尼撒号 · 核心与医疗舱 | Neo | 交互 |
| m1_dojo | 不要只计算速度 | 武术训练道场 | Neo | 战斗 → 反思 |
| m1_jump | 第一次跳跃 | 跳跃程序 · 双子屋顶 | Neo | 移动 → 交互 |
| m1_red_dress | 红衣女子 | 红衣女子 · 喷泉广场 | Neo | 移动 → 交互 |
| m1_sentinels | 静默的飞船 | 地下隧道 · 舰船撤离 | Neo | 进入前舱 → 静默躲避扫描 → 确认离开 |
| m1_cypher_console | 屏幕旁的一杯酒 | 尼布甲尼撒号 · 核心与医疗舱 | Neo | 交互 → 反思 |
| m1_steak | 舒适的代价 | Cypher 与 Smith · 牛排餐厅 | Agent Smith | 移动 → 交互 |
| m1_meal | 真实世界的一顿饭 | 尼布甲尼撒号 · 核心与医疗舱 | Neo | 交互 → 移动 |
| m1_spoon | 等候室的孩子们 | 先知公寓 · 候诊室与厨房 | Neo | 交互 → 移动 |
| m1_oracle | 厨房里的预言 | 先知公寓 · 候诊室与厨房 | Neo | 交互 → 反思 |
| m1_dejavu | 重复经过的黑猫 | 旧楼 · 黑猫与伏击 | Neo | 交互 → 战斗 → 移动 |
| m1_bathroom | 为同伴争取时间 | 旧楼 · 黑猫与伏击 | Morpheus | 浴室门线坚守/三次击退 → 明确冲撞/破墙/被捕 |
| m1_unplugged | 背叛发生在现实 | 尼布甲尼撒号 · 核心与医疗舱 | Tank | 查看拔线 → 1.5 秒反击窗口 → 分别接回 Neo/Trinity |
| m1_rescue_decision | 仍然选择去救他 | 尼布甲尼撒号 · 核心与医疗舱 | Neo | 反思 → 交互 |
| m1_guns | 加载营救装备 | 构造体 · 白色空间 | Neo | 交互 → 移动 |
| m1_lobby | 政府大楼的大堂 | 政府大楼 · 大堂 | Neo | 移动 → 战斗 → 交互 |
| m1_smith_question | Smith 的独白 | 政府大楼 · 审讯层 | Morpheus | 反思 → 交互 |
| m1_bullet_dodge | 屋顶上的子弹 | 政府大楼 · 屋顶与直升机 | Neo | 战斗 → 交互 |
| m1_helicopter | 破窗与绳索 | 政府大楼 · 审讯层 | Morpheus | 移动 → 交互 |
| m1_rooftop_rescue | 拉住 Trinity | 政府大楼 · 屋顶与直升机 | Neo | 移动 → 交互 |
| m1_subway | 不再逃跑 | 地铁站 · Neo 与 Smith | Neo | 战斗 → 交互 |
| m1_city_chase | Tank 指引的街巷 | 城市街巷 · 接线员撤离路线 | Neo | 移动 → 移动 → 交互 |
| m1_death | 再次回到 303 | 城市之心旅馆 · 303 | Neo | 移动 → 交互 |
| m1_return | 看见代码 | 城市之心旅馆 · 303 | Neo | 交互 → 战斗 → 交互 |
| m1_final_call | 电话之后的天空 | 城市电话亭 · 第一部尾声 | Neo | 反思 → 交互 |

### 2. 重装上阵（32 段）

| ID | 剧情段落 | 场景 | 操控人物 | 游玩步骤 |
| --- | --- | --- | --- | --- |
| m2_dream | 关于坠落的梦 | Trinity 坠落 · 城市高空 | Trinity | 移动 → 交互 |
| m2_meeting | 船长们的秘密会议 | 反抗军船长 · 秘密会议 | Neo | 交互 → 战斗 |
| m2_dock | 回到锡安 | 锡安 · 三号闸门船坞 | Neo | 走过悬桥 → 回应 Kid → 确认补电 |
| m2_lock | 信念与军令 | 锡安 · 金属指挥所 | Morpheus | 进入指挥室 → 核对 72 小时战备 → 反思 |
| m2_residents | 门口的请求 | 锡安 · 居住层 | Neo | 走过廊桥 → 记录 Jacob/Gnosis → 记录 Icarus → 送入联络簿 |
| m2_temple | 洞窟里的集会 | 锡安 · 神庙洞窟 | Morpheus | 走到讲台 → 公布威胁 → 鼓声与舞蹈 |
| m2_room | 房间里的两个人 | 锡安 · Neo 与 Trinity 的房间 | Neo | 回到房间 → 坦白梦境 → 反思 |
| m2_bane_copy | 被带出矩阵的感染 | 工业阁楼 · Bane 的出口 | Bane · 旁观视角 | 护送 Malachi → 交付先知磁盘 → 面对 Smith 同化 → 接起出口电话 |
| m2_hamann | 维持生命的机器 | 锡安 · 工程层 | Neo | 走到维护台 → 检查读数 → 调整备用阀 → 反思 |
| m2_oracle_message | 先知托来的磁盘 | 锡安 · Neo 与 Trinity 的房间 | Neo | 回应 Ballard 与受伤 Malachi → 接收磁盘 |
| m2_departure | 离港前的道别 | 锡安 · 三号闸门船坞 | Neo | Link/Zee 道别 → 留意 Bane → 接过 Kid 的勺子 → 核对放行 → 登船 |
| m2_seraph | 认识一个人的方法 | 赛拉夫 · 茶馆 | Neo | 战斗 → 交互 |
| m2_backdoors | 门连接的另一侧 | 后门通道 · 白色走廊 | Neo | 移动 → 交互 |
| m2_bench | 先知也是程序 | 先知长椅与 Smith 庭院 | Neo | 移动 → 反思 |
| m2_burly | 越来越多的 Smith | 先知长椅与 Smith 庭院 | Neo | 战斗 → 交互 |
| m2_merovingian | Le Vrai 的因果论 | Le Vrai · 餐厅与盥洗室 | Neo | 移动 → 反思 |
| m2_persephone | Persephone 的条件 | Le Vrai · 餐厅与盥洗室 | Neo | 移动 → 交互 |
| m2_library | 书墙后的囚徒 | 城堡 · 图书室与钥匙匠工坊 | Neo | 交互 → 交互 |
| m2_chateau | 双楼梯与古兵器 | 梅罗文加城堡 · 大厅 | Neo | 战斗 → 交互 |
| m2_garage | 车库中的追兵 | 城堡 · 地下车库 | Trinity | 战斗 → 交互 |
| m2_freeway | 逆向的高速路 | 101 高速公路 | Trinity | 移动 → 战斗 → 交互 |
| m2_trucks | 两辆卡车之间 | 101 高速公路 | Morpheus | 战斗 → 交互 |
| m2_plan | 钥匙匠的路线 | 尼布甲尼撒号 · 核心与医疗舱 | Neo | 交互 → 反思 |
| m2_power | 主电网的倒计时 | 发电厂 · 电网行动 | Niobe | 战斗 → 交互 |
| m2_vigilant | 突然失去的联系 | 地下隧道 · 舰船撤离 | Trinity | 交互 → 交互 |
| m2_backup | 最后一条供电线路 | 备用电站 · Trinity 的路线 | Trinity | 战斗 → 交互 |
| m2_key_door | 钥匙匠的最后一扇门 | 后门通道 · 白色走廊 | Neo | 移动 → 交互 |
| m2_architect | 被计算过的救世主 | 建筑师 · 监视器房间 | Neo | 移动 → 听循环解释 → 检查右门 → 查看 Trinity 影像 → 反思 → 限时打开左门 |
| m2_catch | 抓住正在坠落的人 | Trinity 坠落 · 城市高空 | Neo | 冲出左门 → 操控飞行绕楼并接住 Trinity → 屋顶聚焦取弹 → 三次心跳复苏 |
| m2_ship_lost | 尼布甲尼撒号的终点 | 尼布甲尼撒号 · 核心与医疗舱 | Morpheus | 交互 → 移动 |
| m2_stop_sentinels | 触及现实中的连接 | 地下隧道 · 舰船撤离 | Neo | 移动 → 交互 |
| m2_medical | 两个昏迷的人 | Hammer · 医疗舱与舰桥 | Trinity | 交互 |

### 3. 矩阵革命（28 段）

| ID | 剧情段落 | 场景 | 操控人物 | 游玩步骤 |
| --- | --- | --- | --- | --- |
| m3_mobil | 既不在这里，也不在那里 | Mobil Ave · 中间世界 | Neo | 移动 → 交互 |
| m3_family | 没有指定用途的孩子 | Mobil Ave · 中间世界 | Neo | 移动 → 反思 |
| m3_trainman | 列车驶离 | Mobil Ave · 中间世界 | Neo | 交互 → 移动 |
| m3_oracle_request | 另一边的营救 | 先知公寓 · 候诊室与厨房 | Trinity | 交互 → 移动 |
| m3_trainman_chase | 逃走的列车管理员 | 地铁站 · Neo 与 Smith | Seraph | 移动 → 交互 |
| m3_hel_entry | 地狱的衣帽间 | Club Hel · 地下俱乐部 | Trinity | 战斗 → 移动 |
| m3_hel_bargain | 不接受的交换 | Club Hel · 地下俱乐部 | Trinity | 移动 → 交互 |
| m3_mobil_release | 等来同伴 | Mobil Ave · 中间世界 | Neo | 移动 → 交互 |
| m3_oracle_last | 没有保证的未来 | 先知公寓 · 候诊室与厨房 | Neo | 反思 → 交互 |
| m3_bane_questions | 幸存者的说法 | Hammer · 医疗舱与舰桥 | Captain Roland | 交互 → 交互 |
| m3_logos_plan | 分开的两条航线 | 地下隧道 · 舰船撤离 | Neo | 移动 → 反思 |
| m3_oracle_absorbed | 等待 Smith | 先知公寓 · 候诊室与厨房 | The Oracle | 交互 → 反思 |
| m3_zion_prepare | 最后的防守部署 | 锡安 · 指挥所与议事厅 | Commander Lock | 交互 → 移动 |
| m3_bane | Logos 上的 Bane | Logos · 驾驶舱与货舱 | Neo | 移动 → 战斗 → 交互 |
| m3_hammer_tunnels | Hammer 的狭窄航路 | 地下隧道 · 舰船撤离 | Niobe | 交互 → 移动 → 交互 |
| m3_dock_battle | 船坞的弹药与钢铁 | 锡安 · 船坞 | Captain Mifune | 战斗 → 交互 |
| m3_gate | 打开三号闸门 | 锡安 · 船坞 | Kid | 战斗 → 交互 |
| m3_emp | 代价高昂的援军 | Hammer · 医疗舱与舰桥 | Niobe | 交互 → 反思 |
| m3_temple_defense | 神庙最后的门 | 锡安 · 神庙洞窟 | Zee | 移动 → 交互 |
| m3_defense | 机器城的防线 | 机器城 · 防线与乌云 | Trinity | 交互 → 移动 |
| m3_sun | 第一次看见太阳 | 云层之上 · 最后的阳光 | Trinity | 移动 → 交互 |
| m3_farewell | 坠落之后 | 机器城 · 撞毁的 Logos | Neo | 移动 → 反思 |
| m3_deus | 共同的威胁 | 机器核心 · Deus Ex Machina | Neo | 移动 → 反思 → 交互 |
| m3_rain | 暴雨中的大道 | Smith 大道 · 暴雨决战 | Neo | 移动 → 战斗 → 交互 |
| m3_surrender | 理解最后的选择 | Smith 大道 · 暴雨决战 | Neo | 反思 → 交互 |
| m3_ceasefire | 机器退去 | 锡安 · 神庙洞窟 | Kid | 移动 → 交互 |
| m3_neo_carried | 光中的身体 | 机器核心 · Deus Ex Machina | Neo | 交互 |
| m3_dawn | Sati 留下的日出 | 公园 · 新的日出 | The Oracle | 移动 → 反思 → 交互 |

## 独立场景验收存档

命令 `node --import tsx scripts/film-review-fixture.mts m1_lobby` 会生成一个临时目录并打印路径。它开放其他场景的回访，仅用于验收；不要将其复制到用户的 data/world.json。构建后通过 `MATRIX_DATA_DIR=<打印的目录> PORT=3002 HOST=127.0.0.1 LLM_API_KEY= node packages/server/dist/index.js` 启动独立实例，在 http://localhost:3002/ 进入 Neo 即可检查。原服务和原存档可保持不变。

先知局部镜头可在场景参数后使用 `oracle-exam`、`oracle-cookie` 或 `oracle-question`，例如 `node --import tsx scripts/film-review-fixture.mts m1_oracle oracle-question`。这些模式只建立对应动作检查点，不代表从候诊室连续游玩到了该位置。

背叛段可使用 `node --import tsx scripts/film-review-fixture.mts m1_bathroom bathroom-hold`、`bathroom-crash`，以及 `node --import tsx scripts/film-review-fixture.mts m1_unplugged unplug-window`、`unplug-counter`、`unplug-reconnect`。它们分别定位坚守、破墙、反击窗口、反击演出和重连检查点，只用于局部动作/画面验收，不能作为从黑猫到营救决定的连续游玩证据。

## 本轮验证（2026-09-23）

- 类型检查通过，生产构建通过；Vite 仍提示主包超过 500 kB，需要后续按场景拆分以改善加载，这不是编译失败。
- 326 项现有及新增测试全部通过。102 段路线测试已实际执行浴室坚守/击退、Tank 反击/重连等专用机制；其余普通节点仍可能通过测试定位完成，不是手动正常游玩录像。
- 在独立浏览器实例中通过实际菜单切换并截图全部 57 个场景，完成后捕获的控制台错误和警告均为 0。图集和索引保存在 output/trilogy-review/index.html、scenes.json 及 01.jpg–57.jpg。
- 重点人工查看了大堂、城堡、先知公寓、道场、Mobil、Logos 和机器核心的实机画面。修复死亡重建离开剧情、转场镜头方向、城堡楼梯碰撞、先知厨房分隔和真实世界过暗的问题。全部地点成功载入不等于全部地点美术已经达标。
- 原日常生活存档没有替换；3002 端口使用临时验收目录，预先开放场景回访，仅供检查。
- 最新 3002 隔离实机完成浴室破墙、Cypher 反击失败/重试、两路重连、第一人称切换和中途刷新恢复；登陆页也会恢复剧情存档中的 Tank。最终浏览器 warning / error 为 0。演员级人物、正式声音、逐镜头美术和完整连续人工游玩仍未完成。
