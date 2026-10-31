# 当前墨菲斯外套的物理校准

2026-11-01，离线衣物制作。**完整脱外套仍未通过，未接入正常剧情，三部曲综合高质量验收仍为 0/42。** 本目录交付起始物理网格、完整显示绑定、自由下落控制，以及覆盖至八秒的身体输入和袖口释放检查；整件衣物的结束状态与连续接触仍失败。

## 已完成的控制

- 使用当前人物实际导出的全部 **13,960 个焊接点、26,916 个显示面**和 **13 个可见内层**。物理网格为 **3,077 点、5,657 面**；起始姿态自身、人体交叉均为零。
- 原双袖口各 61 点和颈口 67 点，共 **189 个制作控制点**保持原位置。显示网格保留完整翻领及两片衣摆，没有删除衣面。
- 物理网格的 231 条非显示结构边连接翻领和衣摆；完整密度对照保留原来的 648 条连接。构造这些边时先去除上衣顶点列表中的重复编号，避免三个最近邻实际只连接到同一顶点。
- 旧参数的完整密度自由下落对照在 0.3 秒只下降约 **0.893 mm**，检查明确失败。按顶点质量归一阻力、使用工作材质及当前物理网格后，完整显示衣物下降约 **329.673 mm**，末帧最大相对形变约 **0.0038 mm**，九个模拟帧均报告 `SUCCESS`。
- 初始显示绑定的最大坐标误差约 **1.804 μm**，不是逐位相同；按项目已有的 10 μm 显示绑定精度检查。另对实际绑定后的完整显示面重新检查，仍为自身／人体零交叉，穿模检查的阈值未改变。
- `cage-rest.test.mts` **3/3 通过**，检查物理网格、完整制作控制以及实际绑定后的完整显示面；绑定测试同时核对生成输入、制作源码及原生输出的 SHA-256，不能在输入变更后静默复用旧绑定。
- 实际制作工程重开后，51,490 个内层顶点在四个指定整数帧与输入逐字节相同，一个子帧检查通过；PC2 使用相对侧文件。该检查范围为制作碰撞体恢复，游戏读档仍未验收。

参数是本衣物的工作标定，不是实测皮革常数，也不是通用单位换算公式。原生完整报告及输入摘要见 `verification.json`、`full-sewn-fall-original.json` 和 `sewn-cage-fall-normalized-material.json`。

## 完整时段与退肩控制

`export-clearance-input.mts --full-removal` 将原 0.8–3.2 秒的 73 帧输入延长到 `AMBUSH_DOFF.duration` 的八秒，共 217 个 30 Hz 样本。原 73 帧的身体二进制和袖口数据保持，最后恢复原站姿；`full-body-input.test.mts` 的三项检查通过。最终源码另在临时目录重新执行两条完整导出，各 217 个身体文件和清单与保留输入逐字节相同，见 `body-export-equivalence.json`。旧身体准备测试的面数预期已从过时的 25,796 更新为当前实际的 26,916，没有减少显示面。

新增可选的 `--shoulder-release` 身体控制，在收臂时向前俯身退肩，结束时恢复原站姿。原路线和退肩路线的身体检查各五项通过，包含完整准备衣物、指定退袖／恢复姿态、481 个 60 Hz 身体连续性样本、固定脚底、手腕可达和变换后的冷恢复。两份输入各 217 帧的完整衬衫自身及与其他十二个可见内层的检查均为零交叉。这些是有限身体检查，不代表外套或任意帧间路径通过。

原生完整烘焙在 1.7 秒之后解除全部 122 个袖口点的固定；每帧读取实际求值后的顶点组权重，并检查完整显示袖口确实离开引导路径。原路线和退肩路线各两项释放检查通过。手与衣口距离审计确认，原路线 1.7 秒时右拇指距袖口约 121 mm、右食指约 67 mm，不能据此称为真实抓衣。

两条路线都没有完成整件脱衣。新增 `full-removal-finish.test.mts` 检查完整显示外套接地，并在结束时低于恢复后的双手；两条路线各自仍为 **0/2**。这只是必要的结束条件，通过后仍须检查全时段接触、抓衣／松手、自然形变与游戏恢复。

| 八秒结束状态 | 原路线 | 俯身退肩控制 |
| --- | ---: | ---: |
| 最低显示点离地 | 129.756 mm | 34.999 mm |
| 最高显示点 | 1.520 m | 1.259 m |
| 原生模拟拒绝 | 第 2 帧含 `NO_CONVERGENCE` | 第 2 帧含 `NO_CONVERGENCE` |

![完整八秒原路线仍穿在身体上的诊断](full-removal-end-diagnostic.png)

![退肩控制的 3.2 秒与八秒诊断，仍卡在手臂](shoulder-release-end-diagnostic.png)

以上均是完整显示面和全部可见内层的离线灰模，不是游戏画面或演员验收。精确落点和八秒编排属于游戏动作设计；现有成片片段遮挡了退袖和落点，不能称为电影已确认的时刻或位置。

231 条连接边按最近源顶点权重分类，未发现手臂权重超过 50% 的锚点；两片衣摆的该权重为零，53 条翻领连接存在不超过 11.302% 的混合手臂影响，不能写成全部零影响。上衣前开口与颈口属于同一个 488 点边界，另有两个完整袖口，未发现被闭合的前襟。Blender 4.5.3 源码的[结构弹簧构造](https://github.com/blender/blender/blob/v4.5.3/source/blender/blenkernel/intern/cloth.cc#L1479)也确认，未开启零长度收缝时，这些边仍以原长结构弹簧工作；没有将它们误改成收缩到零的连接。

向身前退袖的本地候选曾产生衬衫／手腕交叉，已停止对应烘焙（退出 143），未替换上述两份控制输入或游戏模型。解除旧手腕固定朝向后，指定姿态的皮肤交叉降至零，但衬衫自身交叉仍在；现有圆弧袖管修正可清除部分肘部交叉，2.0／2.4 秒仍有肩部交叉。后续需先修正这一条身体／衬衫路径，再烘焙整衣；失败日志和本地候选保留。

两份完整烘焙的原始脚本快照为 `bake-full-control-snapshot.py` 与 `bake-shoulder-control-snapshot.py`，SHA-256 与各自原生元数据一致。退肩烘焙当时漏加 `--python-exit-code 1`，虽然进程退出零，日志中的 Python 断言与第 2 帧仍明确失败，不能记作通过；下列复现命令均带该参数。逐帧大缓存仍只保存在本机，摘要、哈希与准确范围见 `full-duration-verification.json`。

本轮未替换固定 5173 运行包或手工改写主存档，没有新增浏览器成功／失败／读档、电影画面或性能验收。

## 动态制作仍失败

0.8–1.6 秒的完整退袖烘焙仍有一个早期模拟帧未收敛。完整显示面与实际可见内层的检查如下，数字是相交三角面对数，不能当作穿入深度或画质评分：

| 时刻 | 自身交叉 | 人体／内层交叉 |
| --- | ---: | ---: |
| 0.8 s | 0 | 0 |
| 1.1 s | 6 | 210 |
| 1.3 s | 28 | 213 |
| 1.6 s | 32 | 374 |

![0.8 秒与 1.6 秒完整显示网格的离线灰模诊断](sewn-complete-garment-diagnostic.png)

该图保留全部衣面和内层，使用诊断材质；不是游戏截图、电影相似度或演员验收。现有四项世界外套渲染失败、完整 0–8 秒接触、抓衣、松手、落地、成功／失败／读档与实机性能继续保留。后续连续接触修正仍在本地制作，不能以端点无交叉代替完整帧间路径。

## 复现

需要项目已有 Node 依赖和 Blender 4.5.3。工具位置及按需恢复见项目的 `docs/storage-recovery.md`。没有新增运行时依赖或外部素材服务。

在项目根目录执行：

```sh
npm run build -w packages/shared
node --import tsx output/characters/morpheus-withdrawal-path-2026-10-20/export-clearance-input.mts ../morpheus-wardrobe-recovery-2026-11-01/current-input/
export MATRIX_CLOTH_BLENDER=output/tools/blender-4.5.3-arm64/Blender.app/Contents/MacOS/Blender
export MATRIX_CLOTH_WORK=output/characters/morpheus-wardrobe-recovery-2026-11-01
"$MATRIX_CLOTH_BLENDER" --background --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/calibrate-sewn-cage.py" -- --normalized-drag --working-material
node --import tsx --test "$MATRIX_CLOTH_WORK/cage-rest.test.mts"
```

原完整密度参数的对照应以退出码 1 拒绝悬浮衣物：

```sh
"$MATRIX_CLOTH_BLENDER" --background --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/calibrate-sewn-cage.py" -- --full-mesh
```

`bake-sewn-cage.py` 保留动态制作及其失败门槛。它写入新的 `sewn-cage-verified-physics/`，使用原生 PC2 精确驱动全部内层，并将侧文件相对绑定到保存的工程；已有 PC2 不会覆盖。当前输入下该动态命令应失败，不能把完成导出或局部下落控制称为脱衣通过。大体积逐帧缓存、工程和原始日志保留在本地，不随这些制作源码提交。

动态缓存导出后，`node --import tsx "$MATRIX_CLOTH_WORK/audit-dynamic.mts"` 检查上述四个指定时刻的全部显示面和源输入内层，当前同样应以退出码 1 拒绝。`verify-body-cache.py` 可单独检查保存工程中的完整内层缓存；它通过也不能接受衣物动态。

完整时段控制在新的制作工作副本中生成，避免覆盖已有失败缓存：

```sh
node --import tsx output/characters/morpheus-withdrawal-path-2026-10-20/export-clearance-input.mts ../morpheus-wardrobe-recovery-2026-11-01/full-removal-input/ --full-removal
node --import tsx output/characters/morpheus-withdrawal-path-2026-10-20/export-clearance-input.mts ../morpheus-wardrobe-recovery-2026-11-01/shoulder-release-input/ --full-removal --shoulder-release
node --import tsx --test "$MATRIX_CLOTH_WORK/full-body-input.test.mts"
MORPHEUS_SHOULDER_RELEASE=1 node --import tsx --test output/characters/morpheus-withdrawal-path-2026-10-20/withdrawal-path.test.mts
MORPHEUS_BODY_INPUT=shoulder-release-input node --import tsx "$MATRIX_CLOTH_WORK/audit-inner-body.mts" --all-frames
"$MATRIX_CLOTH_BLENDER" --background --factory-startup --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/bake-sewn-cage.py" -- --full-removal
"$MATRIX_CLOTH_BLENDER" --background --factory-startup --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/bake-sewn-cage.py" -- --full-removal --shoulder-release
```

两条完整烘焙当前均应拒绝未收敛的模拟。导出后可以独立检查释放与结束，不将两个门槛互相替代：

```sh
node --import tsx --test "$MATRIX_CLOTH_WORK/full-release.test.mts"
MORPHEUS_BODY_INPUT=shoulder-release-input MORPHEUS_CAGE_RESULT=shoulder-release-physics node --import tsx --test "$MATRIX_CLOTH_WORK/full-release.test.mts"
node --import tsx --test "$MATRIX_CLOTH_WORK/full-removal-finish.test.mts"
MORPHEUS_BODY_INPUT=shoulder-release-input MORPHEUS_CAGE_RESULT=shoulder-release-physics node --import tsx --test "$MATRIX_CLOTH_WORK/full-removal-finish.test.mts"
```

两个结束命令当前各有两项明确失败。`FrontExitBody.mts`、`front-exit-path.test.mts` 与 `diagnose-front-sleeves.mts` 保存前伸候选及圆弧袖管对照；前伸候选的身体测试也应失败，尚不能用于有效整衣烘焙。
