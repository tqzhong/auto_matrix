# 墨菲斯旧楼袖子肘弯修正（2026-10-22）

本单元只处理已交付旧楼服装的肘部折叠。三部曲42组高质量验收仍为0；完整连招还存在肩窝接触，不能将本次局部修正描述为全身无穿模或电影质量完成。

## 原因与修正

在已提交基线 `21bc5d4` 的真实正蹬第15帧，完整外套有420次自交计数、完整衬衫288次，两层之间580次。自交含双向计数。袖子原有线性混合蒙皮在约90度肘弯处折叠；单换双四元数、或只挪开肩膀，都不能解决。`elbow-red.log` 保存两个新回归先失败的输出，`dual-skin-probe.json` 保存未采用的算法对照。

按真实肩、肘、腕的中心线建立半径 .22、半长 .5 模型单位的圆弧过渡，两层衣服沿同一材料坐标弯曲。实际袖子半径上界约 .186；半径随极端夹角限制在可用长度内。保持原袖口、面索引、绕向、UV、权重与手部骨骼，由实际混合蒙皮矩阵反解位置修正，并重建局部法线。普通小幅动作平滑退出，暂停不推进模拟或重新上传衣面；离开服装恢复原属性。

保留站立时原有 .09 弧度的衣身余量作为非持物战斗下限，减少收拳时的衣袖/躯干挤压。持枪、护送和电话动作沿用各自原姿势，不增加该偏移。修正作用于最终手持/IK姿态之后，不通过移动手腕来隐藏衣物问题。没有新依赖、GLB、纹理、服务端或存档格式变化。

## 实际验证范围

- `elbow-final-focused.log`、`elbow-cached-focused.log`：修正与缓存版各6/6，通过真实整衣护手、四个正蹬姿态的完整两层/自交/渲染边界/拓扑、暂停/冷重建/退出恢复，以及原袖口手指独立性回归。
- `elbow-complete-skin-gate.log`：上述正蹬检查再强化为两层整衣对实际61,552面人体的接触检查，四个时刻通过；属于已计数的一项复测。
- `elbow-cache-equivalence.json`：九种输入各60帧，共540帧，缓存前后的原始位置/法线/骨骼索引/权重属性及网格变换逐字节相同。手腕/指端骨骼矩阵另由冷恢复回归检查。这不是540帧全身三角面无交叉证明。
- `elbow-sweep.json`、`elbow-sweep-summary.json`：三种真实连招各12个时刻，共36采样，完整衣物检查仍有10个失败姿态。所有涉及肩/肘混合顶点的完整肘部三角面，对各自整衣及另一层均零交叉；肩窝及两层衣物的剩余接触全部保留在汇总中，没有用前几个示例代替完整计数。
- `elbow-skin-contact.json`：原基线与新修正在第15帧，两件完整衣服对实际人体均为零交叉。

整衣、电话和部署的长测结果及实际采用版本见 `verification.json`。早期 .04 弧度肩余量候选留下了更多收拳接触，未采用；日志/图像属于哪个构建不能混用。

## 开销与实机

原始修正的配对跑步CPU中位为27.125→38.712ms。共享同一绑定的UV顶点与两件衣物后，另一轮同进程配对跑步为27.203→36.720ms，护手为25.946→35.682ms。最终仍新增约9.5–9.7ms；两轮有并发负载，不能将其当作严格提速或浏览器FPS结论。见 `elbow-cpu-before-cache-*.json`、`elbow-cpu-run.json`、`elbow-cpu-guard.json`。

5199临时原生页面检查过正面/侧面连招和行走，初始构建 `index-CiEsIve1.js`，截图为 `native-elbow-*.png`。缓存只复用相同的蒙皮计算；最后的实际本机构建及截图记录在 `verification.json` 和 `local-update-verification.json`。临时服务器与页面已经关闭。截图仍可见皮革过亮、衣摆僵硬及人物造型差距，不作为自然服装或演员还原验收。

## 复测与源码

正式回归直接使用仓库素材，不依赖本地诊断文件：

```bash
node --import tsx --test tests/ambush-elbow-fit.test.mts tests/ambush-cuff-skinning.test.mts
node --import tsx --test tests/ambush-coat-tail.test.mts tests/ambush-upper-fit.test.mts tests/ambush-crouch-fit.test.mts tests/ambush-crouch-transition.test.mts
node --import tsx --test tests/ambush-covered-shirt.test.mts tests/ambush-hem-wardrobe.test.mts tests/ambush-call-renderer.test.mts
npm run test:deploy
npm run build
```

诊断脚本的 `release/` 为本次独立运行副本；`baseline-release/` 应从 `21bc5d4` 的 `packages/` 建立，并连接项目已有依赖。缓存对照的 `before-cache-release/` 与当前副本相同，仅将袖子模块替换为保留的 `AmbushSleeveBend-before-cache.ts`。这些工作目录、原始世界和大体积网格不入Git；`source-audit.json` 核对运行源码与11份原有未完成文件。

下一项是修复剩余肩窝衣面及自然服装表现；完整脱衣与三部曲连续体验继续未完成。不重新接入Render，固定本机试玩入口仍为 <http://localhost:5173/>。
