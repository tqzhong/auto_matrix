# 旧楼皮革材质调整与未通过的肩部诊断（2026-10-22）

本次实际采用的运行改动只有 `AmbushWardrobeAppearance.ts` 两行材质参数。肩部几何候选均未采用；三部曲42组高质量验收仍为0，不能把本次描述为肩窝修复或人物制作完成。

## 已采用的材质调整

原生人物检视中的旧楼皮衣有很强的亮漆感。参照本地原片旧楼画面 `output/gameplay/trilogy-ambush-phone-reference-2026-10-16/reference/coat-3.5.jpg` 与 `coat-9.25.jpg`，降低上衣/翻领的涂层强度和凹凸幅度，并同步衣摆的粗糙度及凹凸幅度。数值是本轮美术调整，不是对原片进行光学测量后的材质重建。

- 上衣/翻领：roughness `.3 → .46`，clearcoat `.65 → .12`，clearcoatRoughness `.28 → .48`，bumpScale `.006 → .0016`。
- 衣摆：roughness `.3 → .46`，bumpScale `.006 → .0016`，继续使用原有皮革纹理。
- 没有新依赖、GLB、贴图或剧情/存档修改。与 `82e59f7` 的702个运行文件比较，701份逐字节保持，仅上述人物源码变化。11份原未完成文件保持，见 [源码核对](source-audit.json)。

原生5199人物检视检查了旧楼连招与旋转后的衣身/衣摆，实际加载 `index-DeK3mGvM.js`，控制台无警告或错误。`native-leather-before.png` 与 `local-leather-preview.png` 是原生截图；连招循环截取的时刻不同，不能当作逐像素或同一姿态的严格A/B比较。人物相似度、僵硬衣摆、腰部明暗接头和肩窝问题仍可见。

## 验证与本机入口

在独立发布副本中，换装流程基线6/6、材质修改后6/6，部署相关75/75，类型检查与三包构建通过。构建仍保留原有大JS包提示；没有把这些状态检查当作几何质量验收，也没有重新声称整套战斗无穿模。见 `material-wardrobe-baseline.log`、`material-wardrobe-final.log`、`material-deploy-final.log`、`material-typecheck.log`、`material-build.log`。

固定入口继续为 <http://localhost:5173/>。仅添加新JS并原子替换HTML，旧JS保留。280份服务端构建文件与进程保持，更新前后的完整世界快照相同，tick3757、暂停不变。没有重新接入Render或连接云端存档。版本和原生检查见 [本机更新](local-update-verification.json) 与 [验证汇总](verification.json)。

入库日志只清理行尾空白和末尾多余空行，原始输出以 `raw-` 前缀保留本地，对应哈希见 `log-normalization.json`。未改变测试结果或计数。

## 肩部：已复现，仍未修复

在 `82e59f7` 的真实完整模型上新增三个独立回归，分别复现刺拳第12帧外套146次自交、镜像直拳第12帧衬衫96次自交，以及刺拳第6帧两层之间18次交叉。自交包含双向计数；异常中的少量示例不是完整数量。原袖口两项同时通过，见 `shoulder-red-and-baseline.log`。

`shoulder-red.test.mts` 是保存于诊断目录的待修复回归，当前应失败，未加入默认测试集。它使用实际素材、真实动画与完整衣物，包含平移和转向。此处没有删除交叉面、隐藏衣片或提高原交叉容差。

后续诊断均在隔离副本进行。下表为同一真实刺拳第12帧的部分代表，均未采用；这些是冻结姿态的离线三角面检查，不是连续动画或原生游玩验收。

| 候选 | 外套自交 | 衬衫自交 | 两层交叉 | 外套/人体 | 衬衫/人体 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 局部刚性拟合、保留一半细节、仅抬起的肩 | 6 | 0 | 57 | 0 | 0 |
| 上述内层加精确逐点间距约束 | 164 | 0 | 35 | 0 | 0 |
| 保留凸起细节与间距约束 | 196 | 0 | 114 | 0 | 0 |
| 更宽的权重过渡加双四元数 | 176 | 134 | 255 | 0 | 0 |
| 20轮Taubin平滑 | 138 | 88 | 163 | 0 | 0 |
| 肩部外展偏移改为 `.3` | 0 | 0 | 96 | 0 | 0 |

间距半空间残差接近零，也不能证明最终三角面不自交。把肩膀外移到让单层自交为零，仍留下两层接触，不能以这种姿势更改替代衣物修复。[完整候选计数汇总](shoulder-rejected-summary.json) 保留43个诊断案例（包括基线与控制项），并非43种独立算法。其余脚本与大体积姿态数组仅保留本地，没有进入运行源码。

研究参考均为原作者来源：[Direct Delta Mush](https://libigl.github.io/tutorial/#direct-delta-mush)、[Taubin原论文](https://graphics.stanford.edu/courses/cs468-01-fall/Papers/taubin-fair-surface.pdf)、[Implicit Skinning作者项目页](https://imagine.inrialpes.fr/people/Damien.Rohmer/documents/publications/13_siggraph_implicit_skinning/13_siggraph_implicit_skinning.html)。未复制这些实现到游戏，也未把当前实验称为完整物理布料系统。

下一项仍是肩窝与两层衣物的真实几何修复，随后继续完整脱衣和剧情连续体验。已有36个连招采样中10个整衣失败姿态仍未消除，42组高质量验收不增加。

## 复现

`release/` 为本次独立副本，运行源码基于 `82e59f7`，只加入上述材质调整；依赖使用项目已有版本，不包含根目录未完成WIP。诊断回归可用相同提交的 `packages/` 和已有依赖重建副本后运行：

```bash
node --import tsx --test output/characters/morpheus-shoulder-volume-2026-10-22/shoulder-red.test.mts
```

该命令当前预期3项失败；用于后续修复变绿，不是本次材质发布的通过记录。常规通过项在独立副本中运行：

```bash
node --import tsx --test tests/ambush-wardrobe-flow.test.mts
npm run test:deploy
npm run typecheck
npm run build
```
