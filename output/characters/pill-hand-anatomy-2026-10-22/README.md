# 红蓝药丸的手部与交接 · 2026-10-22

修正 Neo 捏取、吞服红蓝药丸和握杯时的手面折叠，以及递药与起身的动作跳变。本轮为 P0 关键路线的局部动作修正；人物相似度、布景、表演和整体性能仍在制作，42组高质量场景验收仍为0。Render 已永久删除，Supabase 保留，最新试玩继续使用 <http://localhost:5173/>。

## 实际采用

只在 Neo 的药丸专用姿态中启用连续指节形变，保留专用骨骼与道具 IK，不套用普通战斗拳形。每只手原有6,673点、12,472面、UV、指骨长度和既有弯曲上限全部保留；完整手面和法线一同更新。墨菲斯保留已能通过自交检查的原张掌蒙皮，避免给两人都增加同样的逐帧形变成本。电话、其他杯具、握枪和其他剧情沿用原计算。

Neo 的捏药点从指根前方移至指腹可达区域，非持物三指放松；交接后的抬药逐渐发生，避免更换药丸所属人物时跳位。吞服之后的空手回收由0.5秒改为0.6秒，结束与拿杯时点保持。起身时手指和肘部平面一起淡出，不在动作末帧突然释放。墨菲斯的手掌接触偏移另增加0.004世界单位，使胶囊圆侧面离开掌面；手部 IK 保持原药丸世界目标和交接时点，没有缩小药丸或伸长指骨。

## 失败记录与回归

- 原有[37项药丸检查](pill-baseline.log)先通过，但新增完整手面检查[先失败](pill-hand-red.log.gz)。[原手面测量](pill-hand-baseline-survey.json)中，红/蓝药丸交接姿态分别有328/348次手面自交，含双向计数。只加连续指节仍有穿插，保留[该失败](pill-hand-c2.log.gz)，没有以优化法线代替接触修正。
- 捏药点首次调整后，[既有37项中两项前臂检查失败](pill-regression-pinch-fit.log)。[原返回过程](forearm-step-candidate.json)峰值发生于4.04→4.05秒，超过原0.05门槛；延长吞服后的回收后通过，没有提高门槛。
- 药丸换手的[新增检查先失败](pill-handoff-red.log)，原世界位置跳约0.0222；最终仍按小于0.002的世界位置门槛检查红/蓝两色，以及同一时刻只有一人显示所选药丸。
- 起身[首轮失败](before-seat-blend-pill-hand-history.log)，只混合手指后[仍失败](finger-blend-only-pill-hand-final.log)。[逐点诊断](seat-boundary-diagnosis.json)定位到零权重附近仍完整施加的肘部 IK 平面；修正后[两项定向检查通过](pill-seat-elbow-green.log)，继续保持原0.002突变门槛。
- 全流程扫描后来发现墨菲斯张掌中途有0.00359世界单位胶囊穿入掌面。[原扫描失败](morpheus-capsule-red-pill-path-verification.log)和[新增回归失败](morpheus-capsule-test-red.log)均保留；掌面接触修正后[递药/换手两项通过](morpheus-capsule-test-green.log)。胶囊与杯壁仍分别按原0.003/0.004接触容差检查。
- 一项普通动作释放对照首轮出现严格数组差异，[旧版同样失败](pill-release-test-baseline-case.log.gz)。先对齐两个对照人物的世界站位，继续做严格数组比较；[旧版2/2](pill-release-test-baseline-aligned.log)与[新版本2/2](pill-release-test-aligned.log)通过。保留原[6/7失败日志](pill-hand-final-v3.log.gz)，没有通过放宽数组误差跳过失败。
- 最终[新增8/8](pill-hand-final-v5.log)，覆盖双手完整面、关节、UV闭合、有限单位法线和非负归一权重、连续交接、冷恢复、暂停、另一颜色/电话后恢复、第一人称、起身、普通握拳恢复与原张掌绑定。相关[37/37](pill-final-regression-v5.log)、普通手部恢复/道具隔离[5/5](pill-ordinary-regression.log)、部署[75/75](pill-deploy-tests.log)通过。

最终[完整手面扫描](pill-path-verification.json)完成415个人物帧、830个双手姿态，原面全部保留，自交为0，UV接缝最大间距为0；PIP/DIP最大约82.26°/81.41°，仍在原上限内。检查了4,567个胶囊附近三角面及154,638个杯壁附近三角面；最深胶囊接触约0.001282世界单位，仍在原0.003容差内，杯壁保守间距最小约0.001577。没有宣称道具重叠严格为0。逐姿态见[原始记录](pill-path-samples.ndjson)。覆盖Neo两色take时间线，以及墨菲斯递药、服药过程中的手势、首段对话与选择/结束姿态；Neo入座和全部对话节拍未按同密度扫描。

离线接触扫描对每一原面建立完整包围盒，继续使用原1e-5交线门槛，只忽略确实共享边的面。[12组失败/成功姿态对照](contact-grid-sweep-final-parity.json)中，原检查器与优化后的检查器的全部双向面配对、交线长度完全相同。胶囊检查有限中心线到整个三角面的距离；杯壁先按真实玻璃高度裁切，再用外轮廓的保守界检查完整三角面，歧义不会当作通过。[六项几何控制检查](prop-surface-tests.log)保留。这些有限采样不是任意连续姿态无穿模的数学证明，也没有检查完整人物之间的全部身体、衣物和布景接触。

## 实机与成本

[修改前Neo捏药](native-before-red-pinch.png)、修改后的[红色](native-after-red-pinch.png)、[蓝色](native-after-blue-pinch.png)、[杯具正面](native-after-cup.png)/[反面](native-after-cup-back.png)、[最终墨菲斯张掌](native-after-morpheus-offering.png)及[连续Neo动作](native-after-continuous-neo.png)来自原生浏览器的真实游戏GLB、纹理和专用动作。该制作舞台没有家具，未推进玩家存档，不能当作旧楼整场游玩视频或电影级验收。[制作页控制台记录](native-candidate-check.json)保留。

[最终CPU局部采样](pill-runtime-cost-candidate.json)中，Neo暂停姿态中位约1.52ms，改变捏药/握杯约31.46–36.65ms；墨菲斯约0.64–0.85ms。它包含基础人物计算，来自Node，且同时有其他验证任务；此前另一负载下Neo为17.29–22.09ms，见[该记录](pill-runtime-cost-before-offer.json)。这些数值不是浏览器FPS或稳定前后提速证明。动态手部形变的额外计算成本仍是明确未完成项；没有把画面修正说成整体流畅度已达标。类型检查与[生产构建](build-final-v5.log)通过，既有的大JS分块提示保留。

参考核对沿用项目已保存的 Warner Bros. 25周年红蓝药丸片段与原生截图，实际查看了Neo面部、Morpheus交谈和合掌画面；这些画面不足以证明具体捏药指法、手侧或全部镜头已逐一还原。本轮保留游戏原有红/蓝手侧分支，没有下载整部影片或将电影截图作为游戏贴图。

## 发布与复核

[源文件审计](source-audit.json)以6e3235f为基线，逐个Git blob核对1,146份包、测试和脚本原文件；只修改两份人物运行源码，新增两份相关测试/辅助文件。704份包文件中其余702份不变，没有修改模型素材、依赖、共享剧情时点或服务器；11份既有未完成脱衣工作保持原样。

固定入口已更新为 **index-AWO4j4d3.js**。[发布核对](local-update-verification.json)确认704份包文件与隔离候选一致，280份后端构建文件和PID82106未变；更新及原生重载后的完整世界快照相同，仍为tick3757、暂停。只新增JS并原子替换网页入口，保留旧JS，没有重启服务器。原生暂停入口实际加载新构建，[画面](native-local-updated.png)和[控制台记录](native-local-check.json)保留，本次入口检查有0条警告、0条错误；它不是完整剧情长玩或素材加载验收。临时5199/5200检查页与服务已关闭，试玩标签页保留。

复核完整手面与真实胶囊/杯壁时，在项目根目录运行：

```bash
npm run build -w packages/shared
node --import tsx output/characters/pill-hand-anatomy-2026-10-22/verify-pill-hand-path.mts
node --import tsx --test tests/pill-hand-surface.test.mts
```

脚本默认读取已提交的项目代码；本次隔离验证用了 `--candidate`。完整源副本、依赖目录、原世界快照和参考电影截图仅留本机，没有作为本轮提交内容。
