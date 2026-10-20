# 墨菲斯退袖：解除手腕拖拽与真实释放对照

2026-10-20。**完整脱外套仍未通过；本单元是离线制作源码、回归与失败证据。** 没有替换人物 GLB、游戏动画或线上素材，没有新增三部曲高质量完成组。当前线上运行版本仍为 `1ce32d6`。

## 已修正的制作问题

`WithdrawalCuffs` 原来在 1.7 秒后仍读取实时手腕，再逐渐混合到下落轨迹。手指已经离开袖口，手臂仍会拖动衣服，与“独立下落”的旧注释不符。

现在保存 1.7 秒释放时的姿势和速度；释放后的轨迹不再读取手腕。复现测试先为 **0/1**，修正后连同人体、手指、袖口尺寸、连续性和冷恢复检查 **10/10**。释放前后速度变化约 `3.06e-6` 模型单位/秒；原袖口没有放大，身体动作恢复为已提交的原路线。73 帧真实身体缓存与原输入逐字节相同，衣物初始网格、13 个身体层也相同。

这些检查只证明制作约束与人体动作，不能证明整件衣物已经脱下。

## 领口需要碰撞余量，不只是没有切穿

原检查只看边穿越和顶点距离，没有保证整条边离开身体达到模拟所需的 3.5mm。较早的 0.8–3 秒下降路径虽然没有检出边穿越，保守边间距仅约 0.305mm。

改为 1.05–3 秒下降，在 0.8–1.2 秒间增加最多 0.8mm 的短暂抬升，保留原来的 67 点、边长和后移展开。新检查沿边以不大于 0.5mm 间隔采样，并扣除半个采样间隔，约束边内部的最小距离。对导出的身体与曲线做线性插值后，120Hz 共 289 个时刻：最小保守边间距 **3.673mm**，未检出边穿越。它不是连续时间或完整衣面的无穿模证明。

## 没有采用的改法

- 独立翻领物理层改为随前衣片运动，仍保留全部可见翻领面：人体交叉反而增多，未采用。
- 子步 20→200：部分交叉减少，但完整接触仍失败，物理约束点出现约 0.1–0.2mm 偏移，超过原来的 0.1mm 检查线。未放宽该阈值。
- 双手向外摊开：对冻结的旧衣物数据，12 个手部样本通过；重新模拟身体与衣物后，仅 1/12 通过。冻结衣物不能代替耦合模拟。
- 从上方抽手：新增衬衫自交，人体/袖口检查 8/10；冻结衣物检查 7/12。未采用。

两种失败的手臂路线保留在本地 `WithdrawalBody-*-control.mts`，输入哈希见汇总。正式制作源 `WithdrawalBody.mts` 与本轮开始时一致。

## 真实松开袖口与肩领

只让袖口轨迹独立，仍相当于把袖口固定在空中的指定位置。增加两个单变量物理对照：第 28 帧（1.7 秒）保留约束，第 29 帧起解除整圈袖口；再在后一对照中同时解除已展开肩领的约束。

使用 Cloth 前的原生 Vertex Weight Mix 修改钉住权重。每帧检查 Blender 实际求值网格中的全部 122 个袖口点和 67 个领口点：释放前为 1，释放后为 0；未释放的领口保持 1。释放前 28 帧的完整显示衣物与物理网格均逐字节相同，全部 73 帧身体也相同。显示边界仍需在 0.1mm 内跟随真实物理边界，松开后不再强迫它跟随失去接触的手腕路线。

动态顶点组支持核对了 [Blender 4.5.3 Cloth 实现](https://github.com/blender/blender/blob/v4.5.3/source/blender/blenkernel/intern/cloth.cc#L273-L281)，并由上述实际权重和模拟运动验证。没有关闭人体、自碰撞或删除衣面。

下表是完整 **25,796 个显示三角面** 对全部 **13 个身体层**的相交三角面对数，写作“自身 / 人体”。数量不是穿入深度或视觉质量评分。

| 对照 | 2.1 秒 | 2.6 秒 | 3.2 秒 | 后段手部样本通过 |
| --- | ---: | ---: | ---: | ---: |
| 原身体，修正领口，旧袖口仍读取手腕 | 1035 / 34 | 726 / 166 | 489 / 238 | 冻结夹具 1/12 |
| 原身体，袖口轨迹不再读取手腕 | 1254 / 126 | 859 / 133 | 478 / 47 | 2/12 |
| 解除袖口物理约束，领口保留 | 938 / 36 | 2778 / 121 | 1621 / 18 | 10/12 |
| 同时解除袖口、领口物理约束 | 469 / 52 | 487 / 42 | 414 / 0 | 3/12 |

所有新对照在释放前仍有相同的失败：1.1 秒 193/30，1.3 秒 837/35，1.6 秒 914/170。完整衣物接触检查均仅 **1/7** 通过；三个新对照的边界绑定检查均 **2/2**，73 帧求解状态均为 `SUCCESS`。求解器收敛和约束正确不能替代接触与动作验收。

同时释放的末帧虽然未检出人体交叉，物理网格仍有 29 组自身交叉，完整显示网格有 414 组；早期物理网格也有衣片—翻领及衣片—衣片交叉。细节绑定扩大了部分问题，但物理表面本身已经交叉，不能只修改贴图或隐藏翻领处理。

## 画面检查与下一步

以下是实际完整网格的离线诊断图，**不是游戏截图，也不是最终皮革材质**：

- [独立袖口轨迹末帧](independent-cuff-end-rear.png)：衣服仍在双手附近堆叠。
- [松开袖口后的末帧](free-cuff-end-rear.png)：手部接触减少，衣片折叠仍不正确。
- [同时松开后的 2.6 秒背面](free-garment-middle-rear.png)、[3.2 秒正面](free-garment-end-front.png)：外套仍挂在上臂，没有完成脱衣。零交叉的末帧不能被算作完成动作。

下一步需要使手臂真正离开衣身开口，并处理早期袖片/翻领的接触；不能继续用冻结衣物中通过的手臂路径当作最终答案。完整 0–8 秒抓衣、松手、落地、世界衣物渲染、读档及原生游玩仍未完成。电影遮挡处的具体袖口先后、接衣人和落点没有新增证据；当前动作属于游戏制作安排。

详细结果和输入/输出 SHA-256 见 [verification.json](verification.json)。完整逐帧缓存、`.blend`、原始日志和失败候选仍在本地本目录；入库内容包含制作代码、压缩后的完整冻结衣物夹具、汇总与上述诊断图。已有未完成的运行时代码保留，未混入本次提交。

## 复现当前对照

在项目根目录使用已有 Node 依赖与 Blender 4.5.3。先保留要比较的旧缓存；导出指定新目录，不覆盖原 `clearance-input`：

```sh
node --import tsx --test output/characters/morpheus-withdrawal-path-2026-10-20/withdrawal-path.test.mts output/characters/morpheus-withdrawal-path-2026-10-20/cuff-passage.test.mts output/characters/morpheus-collar-drop-2026-10-20/cuff-release.test.mts
node --import tsx output/characters/morpheus-withdrawal-path-2026-10-20/export-clearance-input.mts ../morpheus-collar-drop-2026-10-20/independent-cuff-input/
python3 output/characters/morpheus-collar-drop-2026-10-20/export-guide.py --margin --output output/characters/morpheus-collar-drop-2026-10-20/independent-cuff --input ../independent-cuff-input
export MATRIX_CLOTH_BLENDER=output/tools/blender-4.5.3-arm64/Blender.app/Contents/MacOS/Blender
export MATRIX_CLOTH_BASE=output/characters/morpheus-shoulder-release-2026-10-20
export MATRIX_CLOTH_WORK=output/characters/morpheus-collar-drop-2026-10-20
"$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_BASE/check-collar-guide.py" -- "$MATRIX_CLOTH_WORK/independent-cuff" --dense
"$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_BASE/bake-cage-clearance.py" -- "$MATRIX_CLOTH_WORK/independent-cuff" --input "$MATRIX_CLOTH_WORK/independent-cuff-input" --output "$MATRIX_CLOTH_WORK/free-garment-physics" --full-withdrawal --release-cuffs --release-collar
MORPHEUS_CLOTH_INPUT=../morpheus-collar-drop-2026-10-20/independent-cuff-input/ MORPHEUS_CAGE_RESULT=../morpheus-collar-drop-2026-10-20/free-garment-physics MORPHEUS_COLLAR_GUIDE=../morpheus-collar-drop-2026-10-20/independent-cuff/collar-guide.json node --import tsx --test "$MATRIX_CLOTH_BASE/cage-binding.test.mts"
# 以下两项目前会报告失败，不能跳过或作为完成验收：
MORPHEUS_CLOTH_FULL=1 MORPHEUS_CLOTH_INPUT=../morpheus-collar-drop-2026-10-20/independent-cuff-input/ MORPHEUS_CLOTH_RESULT=../morpheus-collar-drop-2026-10-20/free-garment-physics/ node --import tsx --test "$MATRIX_CLOTH_BASE/shoulder-contact.test.mts"
MORPHEUS_CLOTH_RESULT=./free-garment-physics/ node --import tsx --test "$MATRIX_CLOTH_WORK/hand-exit.test.mts"
node --import tsx "$MATRIX_CLOTH_WORK/inspect-panels.mts"
```

去掉 `--release-collar` 可复现只松开袖口；同时去掉两个释放选项则保留全部轨迹约束。不同对照必须使用不同输出目录。`hand-exit.test.mts` 不传缓存路径时使用冻结夹具，只用于手部路线反证，不代表随新动作重新模拟的衣物。
