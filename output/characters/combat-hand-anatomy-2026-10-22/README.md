# 四位主角的普通战斗手部 · 2026-10-22

修正 Neo、Trinity、Smith、Morpheus 普通行走和徒手战斗时的指节反折、手指相互切入与指缝折叠。每只手保留完整的6,673点、12,472面及原UV，没有裁掉穿插部分。没有修改GLB、人物脸部、材质或游戏依赖。固定试玩已更新为 <http://localhost:5173/>，构建 **index-CztavNhD.js**；Render保持永久删除，Supabase保留。

## 采用范围

`FightingHands` 使用连续的手指权重、逐渐改变曲率的指节过渡和内侧褶皱压缩；闭拳调整远端关节的过度弯折及手指排列，拇指保留原动作并补足掌骨权重。法线按完整手面重新计算，UV重复点保持闭合。同一握拳状态缓存其几何结果，变化时更新普通Three.js属性；没有新骨骼、着色器或物理依赖。

仅显式列出的普通运动输入启用此组件。拿电话、端杯、握枪、骑乘、攀爬、坐姿和其他剧情/配对动作恢复原属性与原手指计算，不把普通拳形套进这些专用动作。支持人物和普通特工也保留原计算。这是手部几何修正，不能称为肌肉或软组织模拟。

发布前另发现服装/第一人称切换会重新选用共享几何，另一位使用相同素材的人物可能覆盖已摆好的拳头。[多人物复现先失败](shared-hand-red.log)；现在各角色持有自己的服装视图和属性，只有该角色内部的视图共享属性。测试同时模拟了实际素材加载缓存，避免每次重新读取GLB掩盖这一问题。

实际玩家控制器还会持续传入 `mirror=0`。原先将所有陌生数字输入当成专用剧情，会误停用玩家的新手形；[接入复现先失败](player-hand-red.log)，只将这个无效镜面染色值视为普通输入后，[定向检查通过](player-hand-green.log)。非零镜面效果和从0秒开始的 `mirrorBeat` 剧情仍恢复原绑定。

## 验证与保留的失败

- 原16项手部/道具检查通过，但新增完整手面回归[先失败](fighting-hand-red.log)。[原完整手面记录](hand-surface-baseline.json)中，Neo半握和闭拳分别有118及1,846次自交，含双向计数；原闭拳还超过既有DIP弯曲约束。[关节失败日志](combat-fingers-red.log)保留。
- [八项手部检查](final-hand-regression-v2.log)覆盖四人、双手、21个握拳值，共168个完整手面姿态，以及冷恢复、暂停、放手、道具隔离和多人物独立性，另有上述一项玩家接入检查。自交阈值仍为1e-5交线，只忽略真正共享边；检查所有原面、UV接缝、有限单位法线、非负归一权重、实际渲染边界和原弯曲上限。有限采样不是任意连续姿态的数学证明。
- 既有检查首轮[20/22](hand-candidate-regression.log)。两项拇指距离取样只接纳单根指骨权重大于95%的点，遗漏了跨指节蒙皮；改为累加同一食指/中指的所有指骨权重，仍保持原0.07距离门槛。Neo实际完整面距离约0.0560，Morpheus约0.0588。[独立测量](thumb-opposition-measurement.json)、[旧渲染4/4](opposition-baseline.log)及[新渲染4/4](opposition-candidate.log)均保留。首轮另外五项原手部检查已通过，失败没有从日志删除。
- 道具握持[7/7](final-grip-regression.log)，实际CharacterModels握枪[4/4](final-pistol-regression.log)，含四位角色、27组射击/瞄准情况及冷恢复/收放。不是只调用基础骨架后假定握枪有效。
- 服装/袖口/电话首轮[33/34](final-garment-phone-regression.log)。唯一失败是旧检查未计入已提交的肩窝坐标/法线修形；[干净旧渲染同样失败](wardrobe-normal-baseline.log)。现逐点严格比较“原素材加既有肩窝偏移”，UV、面与其他门槛保持，[旧渲染1/1](wardrobe-normal-baseline-updated.log)和[新渲染1/1](wardrobe-normal-candidate.log)通过。这是33项原通过加一项定向复测，不伪称原日志34/34。
- 部署回归[75/75](final-deploy-tests.log)。类型及生产构建记录见最终[汇总](verification.json)；既有大JS分块提示保留。

## 实机与成本

[原手部近景](native-baseline-neo-close.png)和修正后的[Neo](native-candidate-neo-fist.png)、[Trinity](native-candidate-trinity-fist.png)、[Smith](native-candidate-smith-fist.png)、[Morpheus](native-candidate-morpheus-fist.png)来自原生浏览器、实际模型/纹理和真实战斗姿态，没有修改截图。[左手半握](native-candidate-neo-left-half.png)、[手背](native-candidate-neo-fist-back.png)及[连续开合](native-candidate-continuous.png)也有保留。这些制作检查页冻结身体战斗帧，只改变握拳，不冒充整场游戏视频或帧率验收。最终固定入口的核对另见[本机更新记录](local-update-verification.json)和[实际人物检视](native-local-hands.png)。原生页面实际读取新构建，保留[4条纹理尚无图像数据的加载警告](local-native-check.json)，没有错误日志；没有将此轮算作完整素材加载或FPS验收。

[优化前后12组几何对照](cpu-optimization-control-final.json)的位置、法线、权重及实际蒙皮点完全相同。实例隔离后的同一对照另记于[最终对照](cpu-optimization-control-instance-isolation.json)。[CPU局部采样](cpu-benchmark-after.json)中，同状态中位约0.28–0.35ms，改变握拳约10.08–14.98ms；它包含基础人物计算，来自Node且负载不固定，不能据此宣称浏览器FPS、稳定提速或所有场景流畅。初次绑定和动态形变仍有成本。

## 发布边界

[源文件审计](source-audit.json)以9388b80为基线：只改一份现有人物源码、新增两份运行源码，并增加/修正相关测试；素材、后端和11份未完成脱衣工作原样保留。704份包文件的发布核对、280份后端文件、进程及完整世界快照检查见[本机更新记录](local-update-verification.json)。仅更新新JS和原子替换网页入口，保留旧JS，不重启后端。

人物相似度、手部细节与自然材料仍未达到电影水平。剧情/持物/配对动作的手部、其他人物、完整脱衣及42组高质量场景继续制作；高质量整组验收仍为0。没有把本轮局部修正算作全游戏完成。
