# 墨菲斯肩领退出与布料求解修正

2026-10-20，离线人物制作。**完整脱外套仍未通过，不是游戏成品，也没有发布新的运行版本。** 本轮没有新增三部曲高质量完成组；游戏代码、人物 GLB、贴图及存档未改动。最后确认的线上运行版本仍为 `1ce32d6`，本轮未重新做线上验收。

## 已得到的制作改进

- 领口采用原有 67 个边界点，逐段展开后移，保留边长。73 个时刻未检测到领口边切穿实际人体；最小顶点间距约 3.55mm。该检查只覆盖领口曲线，整件衣物的最初对照仍失败。
- 发现原有高分辨率直接模拟不能可靠地下落：总质量参数为 3、13,386 个顶点、空气阻尼 2 时，松开全部约束后 0.3 秒仅下落 **0.95mm**。按顶点质量归一阻尼后约 28.8mm，且每帧出现 `NO_CONVERGENCE`、达到 100 次迭代上限。不能把这些结果当作可靠的衣物动作。
- 新建独立物理网格，显示端仍保留全部 **25,796 个原始三角面**。普通简化网格虽然自身无交叉，却与人体有 1,002 组起始交叉；按真实接触区域逐次加密并贴回原衣面，四次结果为 514 → 116 → 14 → **0**，自身交叉也为 0。最终物理网格 3,005 点、5,534 面；完整双袖口与领口的 **189 个原控制点**未移动。
- 新物理网格配合工作材质参数后，完整显示衣物在下落控制中 0.3 秒下降约 **329.67mm**，末帧相对形变最大约 **0.0043mm**，各模拟帧均为 `SUCCESS`。这些是该模型的数值校准，不是实测皮革材质参数。调校后的拉伸/压缩/剪切值为 35/35/15，制作尺度 100；不能仅将旧值 3500/3500/1500 称为单位换算错误。
- 在完整退袖的 0.8–1.6 秒、25 帧中，求解器同样正常收敛。显示绑定的最大袖口偏移约 **0.00034mm**、领口偏移约 **0.00334mm**，没有破坏此前通过的原袖口路线。

质量与阻力的解释核对了 Blender 4.5.3 的[逐顶点质量设置](https://github.com/blender/blender/blob/v4.5.3/source/blender/blenkernel/intern/cloth.cc)、[空气阻力实现](https://github.com/blender/blender/blob/v4.5.3/source/blender/simulation/intern/implicit_blender.cc)和[弹簧/重力装配](https://github.com/blender/blender/blob/v4.5.3/source/blender/simulation/intern/SIM_mass_spring.cc)。阻力逐顶点施加，拉伸刚度除以平均边长；本项目的控制实验才是上述数值结果的依据。

## 完整衣物仍有明确失败

所有下表检查都使用完整显示衣物和全部 13 个实际身体/内衣层。数量为相交三角面对数，不是穿入深度；不同物理网格的面数也不能直接当作视觉质量分数。

| 对照 | 1.1 秒：自身 / 人体 | 1.3 秒：自身 / 人体 | 1.6 秒：自身 / 人体 |
| --- | ---: | ---: | ---: |
| 全网格，仅增加领口路径 | 66 / 1,392 | 193 / 1,373 | 243 / 618 |
| 全网格，归一阻尼并增加到 100 子步 | 685 / 363 | 3,047 / 1,304 | 993 / 0 |
| 起始无交叉的物理网格，原碰撞间距 | 137 / 70 | 835 / 499 | 897 / 1,058 |
| 同一网格，补足显示细节所需人体间距 | 202 / 30 | 703 / 65 | 969 / 161 |

测得显示细节最多位于物理网格内侧约 2.01mm，原约 1mm 的总人体碰撞间距不足。本轮最后一个控制仅把衣物侧间距由 0.5mm 改为 3mm，人体侧仍为 0.5mm。人体交叉减少，**衣物自身交叉没有解决**，不能接受为修复完成。

物理网格原间距控制在 1.1 秒人体交叉为 0，而显示网格为 70；1.3/1.6 秒物理网格自身也有 125/81 组交叉、人体 47/70 组交叉。因此剩余问题同时涉及模拟中的袖片/翻领接触和显示细节，不能只调整显示绑定。物理网格自身交叉中既有翻领—主体，也有主体—主体，不能通过删去翻领或隐藏衣面宣布通过。

[1.3 秒背面](cage-clearance-1p3-rear.png)与[1.6 秒正面](cage-clearance-1p6-front.png)是完整实际网格的**离线诊断图**，使用诊断材质，不是实机截图或最终皮革画质。

下一步继续处理袖片和翻领的接触、肩领剥离时序，再扩展到完整 0–8 秒、抓衣/松手/落地，接入世界衣物与读档恢复并做原生游玩验收。原片遮挡处的袖口先后、接衣人和落点仍没有新增证据；这组制作动作不是逐帧原片复现。

最后的离线画面仍显示肩部、袖片过度堆叠，领口在 1.6 秒仍偏高。下一项可检验假设是领口的下降晚于身体退袖：当前领口使用 1.35–2.8 秒下降段，身体退出使用 0.8–3 秒。应先检查更早下降的完整领口曲线，再做单项完整衣物对照；本轮尚未执行该改变，不能宣称它已经解决问题。

## 验证与复现

- 本轮当前身体/手指/袖口基线 **8/8**；没有修改这些输入。
- 起始物理网格与完整显示绑定专项 **2/2**；已覆盖全部 25 帧的原双袖口及领口路径。
- 最终自由下落控制通过位置、形状与收敛检查。
- 完整衣物接触专项仍为 **1/4 通过、3/4 失败**。失败记录保留；没有跳过或放宽相交判定。
- 没有修改运行代码，因此未重复运行游戏生产构建、全剧情回归或原生性能验收。之前尚未通过的世界外套渲染项仍未实现。

完整结果、各控制的末帧数据及输入/输出 SHA-256 见 [verification.json](verification.json)。大体积逐帧坐标、`.blend`、原始日志和失败控制脚本保留在本地同目录；最终静态物理网格及制作源码入库。

在项目根目录使用已有 Node 依赖与 Blender 4.5.3。下列过程会重新生成本单元缓存，因此应先保留需要比较的旧结果：

```sh
npm run build -w packages/shared
node --import tsx output/characters/morpheus-withdrawal-path-2026-10-20/export-clearance-input.mts
export MATRIX_CLOTH_BLENDER=output/tools/blender-4.5.3-arm64/Blender.app/Contents/MacOS/Blender
export MATRIX_CLOTH_WORK=output/characters/morpheus-shoulder-release-2026-10-20
"$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/export-collar-guide.py"
"$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/check-collar-guide.py"
"$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/bake-shoulder.py"
"$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/build-cage.py"
node --import tsx "$MATRIX_CLOTH_WORK/audit-cage.mts" cage-rest
for iteration in 1 2 3 4; do
  "$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/fit-cage.py" -- "$iteration"
  node --import tsx "$MATRIX_CLOTH_WORK/audit-cage.mts" "cage-fit-$iteration"
done
"$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/free-fall.py" -- --mass-normalized --cage --working-material --fitted-cage
"$MATRIX_CLOTH_BLENDER" -b --factory-startup --threads 2 --python-exit-code 1 --python "$MATRIX_CLOTH_WORK/bake-cage-clearance.py"
MORPHEUS_CAGE_RESULT=cage-clearance-physics node --import tsx --test "$MATRIX_CLOTH_WORK/cage-binding.test.mts"
# 以下完整接触检查目前应报告失败，不能跳过它：
MORPHEUS_CLOTH_RESULT=./cage-clearance-physics/ node --import tsx --test "$MATRIX_CLOTH_WORK/shoulder-contact.test.mts"
```

`review-sleeves.mts` 同时修正了跨制作目录的图片文件名：输入目录仍按真实相对路径读取，图片文件名只使用目录末级名称，避免把 `../` 嵌入输出文件名导致 `ENOENT`。已实际导出并渲染上述完整衣物控制。
