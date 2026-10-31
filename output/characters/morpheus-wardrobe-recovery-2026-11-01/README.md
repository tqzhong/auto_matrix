# 当前墨菲斯外套的物理校准

2026-11-01，离线衣物制作。**完整脱外套仍未通过，未接入正常剧情，三部曲综合高质量验收仍为 0/42。** 本目录交付的是可复现的起始物理网格、完整显示绑定和自由下落控制；不是八秒动画或游戏验收。

## 已完成的控制

- 使用当前人物实际导出的全部 **13,960 个焊接点、26,916 个显示面**和 **13 个可见内层**。物理网格为 **3,077 点、5,657 面**；起始姿态自身、人体交叉均为零。
- 原双袖口各 61 点和颈口 67 点，共 **189 个制作控制点**保持原位置。显示网格保留完整翻领及两片衣摆，没有删除衣面。
- 物理网格的 231 条非显示结构边连接翻领和衣摆；完整密度对照保留原来的 648 条连接。构造这些边时先去除上衣顶点列表中的重复编号，避免三个最近邻实际只连接到同一顶点。
- 旧参数的完整密度自由下落对照在 0.3 秒只下降约 **0.893 mm**，检查明确失败。按顶点质量归一阻力、使用工作材质及当前物理网格后，完整显示衣物下降约 **329.673 mm**，末帧最大相对形变约 **0.0038 mm**，九个模拟帧均报告 `SUCCESS`。
- 初始显示绑定的最大坐标误差约 **1.804 μm**，不是逐位相同；按项目已有的 10 μm 显示绑定精度检查。另对实际绑定后的完整显示面重新检查，仍为自身／人体零交叉，穿模检查的阈值未改变。
- `cage-rest.test.mts` **3/3 通过**，检查物理网格、完整制作控制以及实际绑定后的完整显示面；绑定测试同时核对生成输入、制作源码及原生输出的 SHA-256，不能在输入变更后静默复用旧绑定。
- 实际制作工程重开后，51,490 个内层顶点在四个指定整数帧与输入逐字节相同，一个子帧检查通过；PC2 使用相对侧文件。该检查范围为制作碰撞体恢复，游戏读档仍未验收。

参数是本衣物的工作标定，不是实测皮革常数，也不是通用单位换算公式。原生完整报告及输入摘要见 `verification.json`、`full-sewn-fall-original.json` 和 `sewn-cage-fall-normalized-material.json`。

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
