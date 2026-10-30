# 主角团人物精修审查 · 2026-10-25

验收采用用户确认的标准：电影时期演员的正面、侧面、四分之三视角，加实机动作对照，由用户最终确认。不得自行生成“95% 相似度”分数。用户已否决当前四人版本，确认数为 0/4；这不是仅等待评分。后续改为真实多视图共同拟合中性身份头模，先审灰模再做材质、发型和动画，研究依据与修订方法见[执行计划](character-refinement-six-hour-plan.md)。

用户追加的本轮硬上限为北京时间 2026-10-25 16:24，工作安排和人工评分定义见[六小时交付约束](character-refinement-six-hour-plan.md)。到点必须交付真实结果，不能自动把候选记为通过。

## 六小时精修当前结果

| 项目 | 当前状态 |
| --- | --- |
| Neo 面部 | 当前为 ear-candidate：细化发际线、收束额角及耳廓，补充眼部遮蔽与角膜；眼型、鼻唇、下颌辨识度待确认；真实面数仍超预算 |
| Trinity 面部与发型 | 当前为 collar-candidate：调整外眉、发顶与发根，补充眼部；九个采样姿态的领口皮肤交叉由 42 处降为 0；湿发剧情造型未制作 |
| Morpheus 面部 | 当前为 ear-candidate：修正头顶比例、耳根／耳廓和上眼睑；托腮改为解剖握姿并按真实下巴表面定位；脸颊、鼻唇辨识度待确认 |
| Smith 面部与发型 | 当前为 film1999-candidate：按原片降低额前发际边界与发顶体积，保留眉弓／额纹；2003 发型单独保留，均未验收 |
| 四个核心角色的手部 | 最新完整握拳、插接头与救援表面专项 17/17；托腮、座机和枕头有独立接触／恢复复查；不能外推全部剧情零穿模 |
| 后续主角及船员 | 尚未进入本轮逐人相似度验收；三部曲全体人物建模目标仍保留 |
| 接触与读档 | 下载、审讯、触镜已做实际场景抽查与冷加载；最新下载模型真正重启独立后端后完整世界相同；版本边界与未覆盖失败分支保留 |
| 95% 目标 | 未完成；当前四人已被用户否决，制作方法正在修正 |

[统一审查页](http://127.0.0.1:5200/output/characters/core-cast-six-hour-2026-10-25/review.html)提供原片／修改前／当前模型和空白人工评分表。[本轮完整记录](../output/characters/core-cast-six-hour-2026-10-25/README.md)保留最新模型哈希、实机帧、81/87 综合检查、六项失败解释和性能限制。四个正式 GLB 与 5173 运行包未被本轮候选替换。

以下为六小时精修前的阶段记录；其中的“当前候选”和检查结果属于当时版本，不覆盖上表及本轮版本清单。

## 此前已修复的手指问题

原算法把小角度弯曲压缩到越来越窄的区域，仍保留接近握拳时的局部曲率；另将已随原始手指弯曲的皮肤再次压缩。实机待机手指产生了像被切开一样的夹痕。

新增测试先复现失败：骨骼不改变时，皮肤仍被额外移动约 0.01097 个世界单位。修复为小角度保留足够宽的皮肤弯曲区域，并在绑定时还原内侧压缩，再于动作阶段施加。没有增加骨骼、网格或贴图。

- [修复前实机手部](../output/characters/neo-likeness-2026-10-25/baseline-hands.png)
- [修复后实机手部](../output/characters/neo-likeness-2026-10-25/corrected-hands.png)
- [动作中的手部](../output/characters/neo-likeness-2026-10-25/corrected-combat-hand.png)
- [失败复现日志](../output/characters/neo-likeness-2026-10-25/hand-rest-before.log)
- [29 项回归日志](../output/characters/neo-likeness-2026-10-25/hand-regression.log)

回归包含四个核心角色完整握拳过程的皮肤自交、UV 接缝、蒙皮权重、保存姿态恢复、多个角色实例隔离、缓存一致性，以及 Neo 镜面触碰和药丸抓握。`npm run typecheck` 通过。这些结果证明本次几何修复的行为，不代表所有剧情中的手部或穿模问题均已解决。

修改前的 `character-asset` / `character-detail` 基线是 89 项中 82 通过、7 失败：镜面前臂、救援承托、船舱枕头、Dozer/颈部接口、座机拿放，以及 Neo/Morpheus 几何预算。原始失败保存在 [baseline-tests.log](../output/characters/neo-likeness-2026-10-25/baseline-tests.log)，未降低阈值或改成通过。

## 此前 Neo 候选与限制

当前候选：[groom-candidate/neo.glb](../output/characters/neo-likeness-2026-10-25/groom-candidate/neo.glb)。SHA-256 为 `37807c796ff3d422295d6fd073606ac6a353b4e7994a02caf15218593909ee3a`；其皮肤贴图引用 `profile-candidate/neo-portrait-albedo.png`，完整资产哈希见 [latest-artifacts.json](../output/characters/neo-likeness-2026-10-25/latest-artifacts.json)。GLB 哈希不包含外置贴图，审查时必须同时核对两者。

- [当前三视图与动作审查](http://127.0.0.1:5200/output/characters/neo-likeness-2026-10-25/review.html?variant=groom)
- [实际触脸／进食动作审查](http://127.0.0.1:5200/output/characters/neo-likeness-2026-10-25/contact-review.html?variant=mouth)
- [当前三视图画面](../output/characters/neo-likeness-2026-10-25/neo-groom-multiview.png)
- [当前进食画面](../output/characters/neo-likeness-2026-10-25/neo-meal-candidate.png)
- [结构与形变校验](../output/characters/neo-likeness-2026-10-25/groom-candidate/candidate-validation.json)
- [面部拟合报告](../output/characters/neo-likeness-2026-10-25/profile-candidate/fit-report.json)
- [口腔修正报告](../output/characters/neo-likeness-2026-10-25/mouth-candidate/occlusion-report.json)

[fit-neo-portrait.py](../scripts/fit-neo-portrait.py) 将生成的中性正面参考与现有模型的正交视图进行标志点配准，再烘焙回原 UV。原片正面比例核对显示，最初的“加宽嘴部”方向并不合适，首轮手工雕刻已降为历史试样，不能作为当前成果。当前候选调整眼睛到嘴部的距离、嘴部宽度、下颌和五官布局，并同步调整眼球、牙齿与张嘴形变。

另用原片斜侧镜头拟合相机后约束可见五官的深度；估计偏航约 56°，并非标准 90° 侧脸。只采用可对应的可见五官及中线，不把转头后的脸部轮廓误当成同一组顶点。标志点误差是二维投影拟合误差，**不是演员相似度分数，也不是摄影测量重建精度**。高质量标准侧脸和最终发型仍需继续核对。

[refine-neo-mouth.py](../scripts/refine-neo-mouth.py) 对照已核验 SHA 的原始 CC0 舌头网格，修正口腔拟合中约 20.16° 的额外俯仰，同时保留舌尖位置和原下颌旋转关系；给牙齿、舌头补充标准 glTF 环境遮蔽。单独加遮蔽的早期试样没有解决舌面朝向问题，不能算完成。当前口腔仍需进一步改善形状、材质和表情观感。

进食视角还揭示了原模型头皮上的深色贴图残影，Matrix 发型会遮住该问题。当前烘焙使用已配准额头的肤色清理头顶并保留细微表面变化，覆盖恢复／船舱剃发造型；[原模型问题留证](../output/characters/neo-likeness-2026-10-25/neo-meal-baseline-scalp.png)。

[refine-neo-groom.py](../scripts/refine-neo-groom.py) 在现有 3,000 束发丝上调整头顶体积、发束起伏和少量发梢，不增加顶点或面片。全部实际发丝顶点的径向头皮间隙为正；只修改头发的四个位置／法线属性，脸、眼睛、口腔、手、服装及权重与前一口腔候选完全相同。[发型报告](../output/characters/neo-likeness-2026-10-25/groom-candidate/groom-report.json)、[奔跑近景](../output/characters/neo-likeness-2026-10-25/neo-groom-run.png)、[连拳近景](../output/characters/neo-likeness-2026-10-25/neo-groom-combat.png)。动态近景现跟随头部位置，避免动作时脸部离开审查画面。

重新检测当前正交渲染后，左右眼裂高宽比约为 0.367／0.377；所用原片正面图约为 0.357／0.348。原片存在俯仰和表情差异，这些数值仅用于排查比例，尚不足以把“压窄眼睛”当作确定的精修方向。没有据此生成相似度百分比。

校验保留原有 46 个关节、权重、拓扑、服装和原 UV，手部与下颈顶点不变；静止及张嘴 0.25／0.5／0.75／1 权重未发现面片翻转。口腔遮蔽只新增三个口腔网格的 UV 和材质引用。审查页共用 CharacterModels、HeroModels、实际剧情接触算法和材质，提供固定 0°／45°／90° 及动作检查。它们是独立模型检查环境，**不能替代各剧情场景成功／失败／读档的完整实机验收**。

## 此前 Trinity 候选与限制

当前候选：[profile-groom-candidate/trinity.glb](../output/characters/trinity-likeness-2026-10-25/profile-groom-candidate/trinity.glb)，SHA-256 为 `35be64444b3ca077dad8187184d8d4559512fd263bdc1924a957eccf9e52f260`；外置皮肤贴图 SHA 为 `7458895181a729965c902cd6faba1ebe4d38b9301dfff4fe6afe2c7a76353bb8`。完整记录见 [latest-artifacts.json](../output/characters/trinity-likeness-2026-10-25/latest-artifacts.json)。正式 Trinity 资产保持不变。

[fit-trinity-portrait.py](../scripts/fit-trinity-portrait.py) 按中性正面制作素材配准眼睑、眉眼、嘴部及下颌，并同步变形眼球。再依据实际原片镜头的可见五官做小幅深度修正；该镜头估计偏航约 22°，不等于标准侧面，也不足以唯一恢复三维结构。深度修正限制在 0.018 世界单位以内，轮廓点不当作固定顶点对应。两张原片参考均为斜侧镜头，来源和哈希见 [sources.json](../output/characters/trinity-likeness-2026-10-25/references/sources.json)。

原发际线存在锯齿发片，额角皮肤也残留深色头发贴图。先更换发型后黑斑仍在，实机拾取确认位于皮肤上；扩大额头肤色清理范围后重新烘焙，已在当前三视图中复查。[首轮问题留证](../output/characters/trinity-likeness-2026-10-25/trinity-groom-multiview.png)。

[refine-trinity-groom.py](../scripts/refine-trinity-groom.py) 以现有头部表面制作 2,200 束向后侧梳的发丝。检查所有新发丝／底层网格顶点及三角形中心，采样点均位于头皮外；Matrix 造型为 138,732 个三角形，低于原测试的 160,000 上限。该采样检查不等于任意位置、任意剧情动作绝对零相交。

- [三视图与动作审查](http://127.0.0.1:5200/output/characters/trinity-likeness-2026-10-25/review.html?variant=profile)
- [当前三视图](../output/characters/trinity-likeness-2026-10-25/trinity-current-multiview.png)
- [连拳手部检查](../output/characters/trinity-likeness-2026-10-25/trinity-combat-hands.png)
- [奔跑全身检查](../output/characters/trinity-likeness-2026-10-25/trinity-run-body.png)：身体与服装仍为原资产，其轮廓和材质不因本轮脸部／发型变化而视作完成。
- [结构校验](../output/characters/trinity-likeness-2026-10-25/profile-groom-candidate/candidate-validation.json)：46 关节不变，手、下颈、服装、权重和原 UV 不变；头部及眼球没有翻转面。
- 相关 8 项原资产基线和最新候选回归均通过：[基线](../output/characters/trinity-likeness-2026-10-25/asset-baseline.log)、[最新候选](../output/characters/trinity-likeness-2026-10-25/asset-profile-candidate.log)。覆盖网格预算与蒙皮、眼球透明材质、跑跳连拳、肩部衣服覆盖、夜店换装／腰线／肩腕衔接、车内空间与扫描器抓握。未改断言或阈值；[复测来源](../output/characters/trinity-likeness-2026-10-25/candidate-tests/replay-provenance.json)。

当前还需精修眼周／表情、手形细节、不同剧情中的发型，以及更强的标准侧面参考和实际接触检查。没有新增 Trinity 嘴部表情系统，也没有把独立模型检查记作三部曲剧情成功／失败／读档验收。

中性制作素材由内置 imagegen 生成，已保存为 [trinity-frontal-diffuse-v1.png](../output/characters/trinity-likeness-2026-10-25/references/trinity-frontal-diffuse-v1.png)，[完整提示词](../output/characters/trinity-likeness-2026-10-25/portrait-prompt.txt)。它用于建模与贴图，不能充当电影原始证据。构建与检查步骤见 [REPRODUCE.md](../output/characters/trinity-likeness-2026-10-25/REPRODUCE.md)。

## 此前 Morpheus 候选与限制

当前候选：[scalp-candidate/morpheus.glb](../output/characters/morpheus-likeness-2026-10-25/scalp-candidate/morpheus.glb)，SHA-256 为 `78f9013a95df8a840e63f7b95f0f57b90af4d6ba4bd86bb8e8a0ceaad82f3fe7`；皮肤贴图 SHA 为 `4c3d70c3507fa20e65c5cca1bae31ff6cf2caca99a2f0bf7d406284664a68b48`，法线贴图 SHA 为 `1131aa86981ce2f22a7edc29114cfe904bfec5144d340904e5fcb07e5d58f482`。`profile-candidate` 保留为本轮修改前版本。完整来源见 [latest-artifacts.json](../output/characters/morpheus-likeness-2026-10-25/latest-artifacts.json)，构建步骤见 [REPRODUCE.md](../output/characters/morpheus-likeness-2026-10-25/REPRODUCE.md)。

原资产带有明显山羊胡，与本轮核对的 1999 道场和 2003 船内剧照不符。新候选使用剃净的中性制作素材，调整眉眼、嘴部、下颌及眼球，并给完整光头拟合平滑轮廓。首轮局部插值造成头顶尖角，已改用连续超椭圆；侧面颜色采样曾产生横纹，随后改为双侧皮肤取样与平滑过渡。当前头型和五官的整体辨识度仍未达到验收标准。

[refine-morpheus-skin.py](../scripts/refine-morpheus-skin.py) 本轮只修头部材质：给脸侧与后脑补充连续底色和细微法线，并清除下颌处投影进来的灰色背景。制作过程中纠正了 sRGB／线性颜色处理导致的过亮首版；该失败画面保留。全部 **9,793,476 字节**几何、蒙皮、形变和 UV 二进制数据不变，255,254 个手部／下颈保护贴图像素不变：[严格校验](../output/characters/morpheus-likeness-2026-10-25/scalp-candidate/integrity-validation.json)。左右及后脑每面 961 个实际 UV 法线采样从平面法线失败变为通过，只有材质细节含义，不是相似度测量。新增 2048² 法线贴图的 RGBA8 加 mipmaps 理论显存约 21.3 MiB／渲染上下文；没有新增面片，也没有新的帧率验收。

[fit-morpheus-portrait.py](../scripts/fit-morpheus-portrait.py) 使用原始 UV 烘焙，保留 46 关节、手、下颈、服装、原蒙皮权重及已有毛衣形变。原片斜侧估计偏航约 29°，可见五官深度修正限于 0.018 世界单位；不能当作标准侧脸重建或相似度分数。[结构校验](../output/characters/morpheus-likeness-2026-10-25/profile-candidate/candidate-validation.json) 检查没有头部／眼球翻转面。

实机托腮检查发现旧动作将右肘抬到肩上约 0.574 世界单位，前臂横过脸前。新增姿态测试先失败，再将该动作的肘部弯曲方向改为向下、向前；其他医疗／插头动作分支不改。原有下巴接触测试保持原断言，不能将其 0.025 世界单位的穿入容差描述成绝对零穿模。

- [三视图与动作审查](http://127.0.0.1:5200/output/characters/morpheus-likeness-2026-10-25/review.html?variant=scalp)、[当前面部](../output/characters/morpheus-likeness-2026-10-25/morpheus-scalp-multiview.png)、[1999 年原片侧脸对照](http://127.0.0.1:5200/output/characters/morpheus-likeness-2026-10-25/film-skin-review.html)。后者使用可见五官估计镜头，伤妆、俯仰和光照仍不同。
- [托腮修复前](../output/characters/morpheus-likeness-2026-10-25/morpheus-chin-contact.png)、[修复后](../output/characters/morpheus-likeness-2026-10-25/morpheus-chin-elbow-corrected.png)、[失败复现](../output/characters/morpheus-likeness-2026-10-25/chin-elbow-before.log)。
- [奔跑全身](../output/characters/morpheus-likeness-2026-10-25/morpheus-run-body.png)、[连拳手部](../output/characters/morpheus-likeness-2026-10-25/morpheus-combat-hands.png)。审查近景跟随实际手腕与中指位置，避免抬手时指尖超出画面。
- 原资产与候选的 8 项模型回归均为 **7 通过、1 失败**；失败都是原有 Matrix 服装网格预算超限：[基线](../output/characters/morpheus-likeness-2026-10-25/asset-baseline.log)、[候选](../output/characters/morpheus-likeness-2026-10-25/asset-profile-candidate.log)。
- 最新肤质候选包含肘部检查的 9 项回归为 **8 通过、1 个同样的原有预算失败**：[基线](../output/characters/morpheus-likeness-2026-10-25/scalp-baseline-tests.log)、[完整候选日志](../output/characters/morpheus-likeness-2026-10-25/scalp-candidate-tests.log)、[测试来源](../output/characters/morpheus-likeness-2026-10-25/scalp-tests/replay-provenance.json)。这与前述批次重叠，不能累加。
- 托腮修复后的原资产接触批次 **3 通过、1 失败**；旧核心插头抓握误差仍为 0.1813835714721712，与修改前日志相同：[日志](../output/characters/morpheus-likeness-2026-10-25/chin-contact-after.log)。新候选的肘部姿态与下巴接触 **2 项通过**：[日志](../output/characters/morpheus-likeness-2026-10-25/chin-profile-candidate.log)。各批次有重叠，不累加成独立测试总数。类型检查通过。

参考照片及年份、URL、哈希见 [sources.json](../output/characters/morpheus-likeness-2026-10-25/references/sources.json)。内置 imagegen 生成的 [中性正面素材](../output/characters/morpheus-likeness-2026-10-25/references/morpheus-frontal-diffuse-v1.png) 和 [完整提示词](../output/characters/morpheus-likeness-2026-10-25/portrait-prompt.txt) 只用于制作。当前头型、眼周、表情、耳朵、手形及服装质感仍需精修。托腮手形明显不自然；四个时刻手皮肤未检出自交不代表其姿势合格：[当前手形](../output/characters/morpheus-likeness-2026-10-25/morpheus-scalp-chin-hands.png)、[诊断](../output/characters/morpheus-likeness-2026-10-25/chin-shape-before.jsonl)。没有完成用户相似度确认或整段剧情验收，新资产及托腮修复尚未发布到 5173。

## 此前 Smith 候选与限制

当前候选：[eyelid-candidate/smith.glb](../output/characters/smith-likeness-2026-10-25/eyelid-candidate/smith.glb)，SHA-256 为 `76883759ca2aa594c8e48c8d3d7609cf6257addb4f92ad1b72e82bce98bb605b`；外置皮肤贴图 SHA 为 `07b34d2963169952fe30ad2ae039530b09edf01b0383ec243506178d898d92c0`，眼部遮蔽沿用已按新眼睑重烘焙的版本。`wrinkle-candidate` 保留作本轮眼睑肤色对照；`brow-candidate` 保留作无额纹几何的抬眉对照，`cornea-candidate` 保留为无抬眉形变的对照，`film-face-candidate` 保留作无角膜反光的对照。正式 Smith 资产不变。完整记录见 [latest-artifacts.json](../output/characters/smith-likeness-2026-10-25/latest-artifacts.json)，制作和复测步骤见 [REPRODUCE.md](../output/characters/smith-likeness-2026-10-25/REPRODUCE.md)。

[fit-smith-portrait.py](../scripts/fit-smith-portrait.py) 配准中性正面制作素材，调整眉眼、嘴部和下颌，并同步眼球。额头清理保留皱纹，去除原有头皮深色残影。随后增加 2003 年原片中性斜侧剧照，拟合约 48.41° 镜头，对鼻尖、唇部、下巴等可见特征做不超过 0.018 世界单位的深度修正；正面顶点坐标不变。墨镜遮住的眼部、远侧、嘴内和随视角变化的外轮廓不参与拟合，1999 年张嘴近景只作人工辅助观察。

固定同一镜头重投影深度候选，所用制作点的加权坐标 RMS 由 5.19 降为 2.75 像素；[测量记录](../output/characters/smith-likeness-2026-10-25/profile-groom-candidate/depth-validation.json)。这是同一批制作约束的残差，不是独立相似度验证或百分比分数，也未完成整个头部重建。[发型阶段原片对照](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/film-camera-review.html?before=hairline-candidate&after=sweep-candidate)保留头顶、后脑、侧后梳走向和鬓角修改前后。当前为 `variant=eyelids`；`variant=wrinkles`、`variant=brow`、`variant=cornea`、`variant=face`、`variant=sweep`、`variant=hairline` 及其他变体保留历史候选。

[refine-smith-groom.py](../scripts/refine-smith-groom.py) 此前制作了 2,200 束后梳发丝；`--film-volume` 增加顶部与后梳体积、收窄鬓角，并延长后颈发际线。该版使用插值头皮法线、重算法束表面方向，改善增加体积后的亮边，总计 134,922 个三角形：[报告](../output/characters/smith-likeness-2026-10-25/refined-candidate/groom-report.json)。[结构校验](../output/characters/smith-likeness-2026-10-25/refined-candidate/candidate-validation.json) 保留 46 关节、原手部、下颈、服装、权重和 UV，头部／眼球没有翻转面。[首轮亮边问题](../output/characters/smith-likeness-2026-10-25/smith-film-groom-first.png)继续作为历史证据，最新发根修订见下文。

无光照的肤色检查显示，旧烘焙还混入了上一版肖像。当前 `--clean-head-base` 从已核验哈希的原始 CC0 皮肤纹理重建头部底色，匹配中性制作肖像后再烘焙，改善侧面肤色衔接。只从恢复档案取回所需的 3.7 MB 单文件。手部／下颈的 13,999 个顶点 UV 采样颜色差为 0：[记录](../output/characters/smith-likeness-2026-10-25/skin-candidate/protected-albedo-check.json)。当时眼周深色仍然存在，未将该次底图替换记作眼周问题全部解决。

发型修订阶段的脸部、身体与手部原有 4,143,512 字节几何缓冲相对前一轮深度候选严格一致：[记录](../output/characters/smith-likeness-2026-10-25/refined-candidate/refinement-validation.json)。当时没有根据主观观感继续压窄眼睛；无光照渲染检测的眼裂高宽比约 0.335／0.333，中性生成制作素材约 0.323／0.324，[诊断](../output/characters/smith-likeness-2026-10-25/eye-proportion-check.json)只用于排查比例，不是原片演员相似度证据。本轮局部脸型变化见下文，不再沿用该阶段“整个身体缓冲不变”的结论。

本轮对无光照肤色与投影采样逐点检查后，确认大部分眼周深色继承自制作肖像的光照。使用内置 imagegen 对原制作肖像做去光照修订，保留[素材](../output/characters/smith-likeness-2026-10-25/references/smith-frontal-delit-v2.png)及[完整提示词](../output/characters/smith-likeness-2026-10-25/delit-prompt.txt)。`--albedo-portrait` 与 `--albedo-landmarks` 只重新配准颜色投影，不重新拟合脸型；这张生成图仍不是原片证据。新素材的少量标记漂移经纹理坐标配准后，制作点坐标残差约 0.335 像素，不能当成相似度分数。实机眼周和下巴的大片烘焙阴影减轻，皮肤光学与真实演员的表情仍需继续精修。

[refine-smith-eyes.py](../scripts/refine-smith-eyes.py) 用实际头部／眼睑三角形计算眼球环境可见度：每顶点 256 条射线，距离 0.16 世界单位，通过标准 glTF `occlusionTexture` 和第二组 UV 加入遮蔽。没有改变眼睛颜色、透明角膜、原 UV、位置、法线或蒙皮。该遮蔽基于静止眼睑关系，未来加入独立眼球转动或眨眼时需重新评估。该阶段的 `eye-candidate` 保留此前全部 **8,210,112 字节**几何缓冲，只追加遮蔽采样 UV；13,999 个手部／下颈 UV 采样 RGB 差为 0：[严格差异校验](../output/characters/smith-likeness-2026-10-25/eye-candidate/refinement-validation.json)。后续发型修订保持这套眼部数据不变。

实机发现旧追踪器动作把食指末节折到约 138°，并有手部自交。旧求解器从前一指节猜测指尖方向，且把拇指和食指放在道具纵轴两端。现在从真实指尖皮肤提取末节方向，用有界关节弯曲和统一轴向夹持外壳；拇指也使用连续的皮肤弯曲修正。仅修正指尖中心仍会让食指根部和道具金属足相交，因此进一步改为在足部铰链下方夹持，并在抬手时让道具跟随手腕。

释放检查还发现手臂超过可达范围，道具离手时跳动约 0.058 世界单位。补足躯干前倾后能实际到达释放点；松手后向侧下方收手，避免外壳转向时扫过手指。道具尺寸和碰撞断言没有缩小或放宽。手部修正限定在 Smith 的追踪器段，保留左手原有动作。

- [上一轮肤色与眼部审查](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/review.html?variant=eyes)、[当时面部](../output/characters/smith-likeness-2026-10-25/smith-eye-multiview.png)、[原片对照截图](../output/characters/smith-likeness-2026-10-25/smith-eye-film-comparison.png)。审讯时间轴可检查抬手、展示、松手及收手。
- 去光照肤色与眼部遮蔽完成时，候选的 6 项模型回归、4 项审讯检查及 1 项发型接触检查通过：[模型日志](../output/characters/smith-likeness-2026-10-25/eye-model-tests.log)、[接触日志](../output/characters/smith-likeness-2026-10-25/eye-contact-tests.log)。原断言及阈值保持不变；无图像解码器的几何复测仅额外移除遮蔽贴图引用，真实材质在浏览器中检查，[复测来源](../output/characters/smith-likeness-2026-10-25/eye-tests/replay-provenance.json)。检查覆盖 30 个手部时间点、5 个头部／发型与道具接触时间点及冷启动恢复，沿用原有 `1e-5` 交线阈值。该阶段实机复查[展示时的脸部](../output/characters/smith-likeness-2026-10-25/smith-eye-tracker-head.png)、[夹持](../output/characters/smith-likeness-2026-10-25/smith-eye-tracker-hands.png)、[收手](../output/characters/smith-likeness-2026-10-25/smith-eye-release-hands.png)及[奔跑面部](../output/characters/smith-likeness-2026-10-25/smith-eye-run-face.png)。浏览器无警告或错误；这些日志早于下述眼镜运行时代码修复。
- 前一轮深度候选的 6 项模型回归和完整 4 项审讯检查通过：[模型日志](../output/characters/smith-likeness-2026-10-25/depth-candidate-model-tests.log)、[接触与恢复日志](../output/characters/smith-likeness-2026-10-25/depth-tracker-tests.log)。正式资产的相同 6 项也通过：[基线日志](../output/characters/smith-likeness-2026-10-25/depth-formal-model-tests.log)。原有深度候选截图与测试历史保留；以下为前几轮动作修复及其留证。
- [原夹持问题](../output/characters/smith-likeness-2026-10-25/smith-tracker-hands.png)、[当前夹持](../output/characters/smith-likeness-2026-10-25/smith-tracker-hands-corrected.png)、[收手画面](../output/characters/smith-likeness-2026-10-25/smith-tracker-release-hands.png)、[奔跑全身](../output/characters/smith-likeness-2026-10-25/smith-run-body.png)、[连拳手部](../output/characters/smith-likeness-2026-10-25/smith-combat-hands.png)。浏览器没有记录渲染警告或错误。
- 新动作 3 项测试覆盖 30 个时间点的关节弯曲、真实手部自交、全部道具网格接触、指腹与外壳间隙、松手连续性，以及战斗切换／冷启动恢复：[原资产](../output/characters/smith-likeness-2026-10-25/tracker-release-after.log)、[前一轮候选](../output/characters/smith-likeness-2026-10-25/tracker-candidate-after.log)，均通过。保留[初始弯曲失败](../output/characters/smith-likeness-2026-10-25/tracker-pinch-before.log)和[释放穿模失败](../output/characters/smith-likeness-2026-10-25/tracker-release-before.log)。
- 另补查展示时的实际头部与道具表面：5 个时间点，原资产和候选各 1 项通过，[原资产](../output/characters/smith-likeness-2026-10-25/tracker-head-check.log)、[候选](../output/characters/smith-likeness-2026-10-25/tracker-head-candidate.log)。相交检查沿用 `1e-5` 交线阈值，采样通过不等于所有时刻绝对零相交。
- 原资产与候选各 6 项相关模型／审讯回归通过：[最终日志](../output/characters/smith-likeness-2026-10-25/asset-final-after.log)。手部静止表面、缓存及四人持枪的 12 项回归通过：[日志](../output/characters/smith-likeness-2026-10-25/hand-regression-after.log)。[类型检查](../output/characters/smith-likeness-2026-10-25/typecheck-after.log)通过；各批次不累加成独立验收总数。

眼镜修复先用真实网格复现失败：镜桥端点离镜框约 0.01852 世界单位，镜腿进入头部且未经过耳上方；镜片原为零厚度曲面。[原资产失败](../output/characters/smith-likeness-2026-10-25/glasses-fit-before.log)、[候选失败](../output/characters/smith-likeness-2026-10-25/glasses-candidate-before.log)、[镜片厚度失败](../output/characters/smith-likeness-2026-10-25/glasses-lens-before.log)均保留。[HeroModel.ts](../packages/client/src/agents/HeroModel.ts) 现在根据实际蒙皮头部和耳廓一次性拟合 Smith 镜腿，连接实际镜框上的端点；细化金属线框，镜片改为带薄边缘的闭合曲面。拟合发生在角色创建时，没有逐帧表面搜索。

- 正式资产的 3 项眼镜检查通过：[日志](../output/characters/smith-likeness-2026-10-25/glasses-fit-after.log)。覆盖镜桥／镜腿连接、耳上贴合、待机／转头／奔跑／审讯两个时刻的真实头部和耳朵表面，以及前后镜片厚度。
- `eye-candidate` 同样的 3 项检查，加镜框与全部发束／底层表面相交检查，合计 4 项通过：[日志](../output/characters/smith-likeness-2026-10-25/glasses-candidate-final.log)。保持 `1e-5` 交线阈值，不将采样结果描述成所有时刻绝对零穿模。
- 首轮眼镜修复源码下，正式资产和候选的 6 项模型回归各自通过：[正式资产](../output/characters/smith-likeness-2026-10-25/glasses-formal-model.log)、[候选](../output/characters/smith-likeness-2026-10-25/glasses-candidate-model.log)。Mouse 镜腿与 Smith 终局墨镜显隐的 2 项回归也通过：[共享行为日志](../output/characters/smith-likeness-2026-10-25/glasses-shared-final.log)。各批次有重复覆盖，不累计为剧情验收数。
- [首轮眼镜修复三视图](../output/characters/smith-likeness-2026-10-25/smith-glasses-fitted-multiview.png)、[奔跑](../output/characters/smith-likeness-2026-10-25/smith-glasses-fitted-run.png)、[展示追踪器](../output/characters/smith-likeness-2026-10-25/smith-glasses-fitted-tracker.png)、[收手](../output/characters/smith-likeness-2026-10-25/smith-glasses-fitted-release.png)已在共用运行时代码的审查页检查，浏览器无警告或错误。[类型检查](../output/characters/smith-likeness-2026-10-25/glasses-typecheck.log)通过；源码快照、独立补丁及复测范围见[来源记录](../output/characters/smith-likeness-2026-10-25/glasses-tests/replay-provenance.json)。

上一轮 `--fine-hairline` 候选为 3,000 束，其中 1,550 束使用细发根，包含 400 束较短鬓角。底层改为细分后的真实头皮拓扑，全部头顶体积在发际线逐渐回落至头皮；修剪区降低底层密度，改善浓黑条带。[三视图](../output/characters/smith-likeness-2026-10-25/smith-hairline-multiview.png)、[原片对照](../output/characters/smith-likeness-2026-10-25/smith-hairline-film-comparison.png)、[当前动作审查](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/review.html?variant=hairline)。当前 GLB 共 146,502 个三角形；所有新发丝和底层顶点、面心的头皮间隙采样为正。[制作报告](../output/characters/smith-likeness-2026-10-25/hairline-candidate/groom-report.json)记录眼部遮蔽重新附加前的制作阶段，最终 GLB 哈希见[严格差异校验](../output/characters/smith-likeness-2026-10-25/hairline-candidate/refinement-validation.json)：非头发网格、眼部遮蔽、骨骼、权重和纹理不变，原身体 4,143,512 字节逐字节相同。

延长鬓角的早期网格确实穿入耳前皮肤，原经纬网格跨过凹凸，即使加密也未解决；[首次失败](../output/characters/smith-likeness-2026-10-25/hairline-sideburn-penetration-before.log)、[加密仍失败](../output/characters/smith-likeness-2026-10-25/hairline-grid-penetration-before.log)均保留。真实头皮拓扑解决该问题后，镜腿与新鬓角又有实际相交：[失败日志](../output/characters/smith-likeness-2026-10-25/hairline-final-glasses-before.log)。运行时拟合现同时纳入真实发束和底层，并覆盖相邻镜腿截面之间的细发丝；没有降低测试阈值。

细发根阶段的候选 [6 项模型回归](../output/characters/smith-likeness-2026-10-25/hairline-final-model-tests.log)、[9 项眼镜／头部／发束／手部接触及恢复检查](../output/characters/smith-likeness-2026-10-25/hairline-final-contact-tests.log)通过；正式资产与前一 `eye-candidate` 的 [7 项眼镜复测](../output/characters/smith-likeness-2026-10-25/hairline-previous-model-glasses.log)也通过。[类型检查](../output/characters/smith-likeness-2026-10-25/hairline-typecheck.log)通过。实机证据、脚本及运行时快照见[复测来源](../output/characters/smith-likeness-2026-10-25/hairline-tests/replay-provenance.json)。这不是整段剧情验收；发型整体轮廓、发丝质感、脸部和眼球光学仍与原片有差异，继续保留为未完成项。

上一轮 `--film-sweep` 在同一个原片镜头下补充头顶与后脑体积，把额前发束改为向侧后方梳开；较短鬓角改用向下的生长方向，并降低底层密度。共 3,300 束、151,888 个三角形，仍低于原有预算。[三视图](../output/characters/smith-likeness-2026-10-25/smith-sweep-multiview.png)、[原片对照](../output/characters/smith-likeness-2026-10-25/smith-sweep-film-comparison.png)。该阶段只改两个头发网格，所有非头发网格、眼部遮蔽、材质、纹理、骨骼和权重与前一候选严格相同：[差异校验](../output/characters/smith-likeness-2026-10-25/sweep-candidate/refinement-validation.json)。

修改前的 [9 项接触基线](../output/characters/smith-likeness-2026-10-25/sweep-baseline-contact.log)通过；最终新候选的 [6 项模型检查](../output/characters/smith-likeness-2026-10-25/sweep-model-tests.log)和 [9 项接触／恢复检查](../output/characters/smith-likeness-2026-10-25/sweep-contact-tests.log)均通过，断言与阈值未改。实机复查[奔跑](../output/characters/smith-likeness-2026-10-25/smith-sweep-run.png)、[低头展示](../output/characters/smith-likeness-2026-10-25/smith-sweep-tracker-head.png)、[抓握](../output/characters/smith-likeness-2026-10-25/smith-sweep-tracker-hands.png)和[收手](../output/characters/smith-likeness-2026-10-25/smith-sweep-release-hands.png)，浏览器无警告或错误。低头审查镜头上移并拉远，纠正原先发顶超出画面的检查盲区。发束根部仍有规则感，材质、脸部神态及最终相似度继续待精修；没有更新运行时代码或发布正式资产。[复测来源](../output/characters/smith-likeness-2026-10-25/sweep-tests/replay-provenance.json)。

本轮补充 1999 年审讯的三张眼睛可见原片帧，来源为 [Movie Screencaps](https://movie-screencaps.com/the-matrix-1999-4k/page/9)，原文件及哈希见 [新增参考清单](../output/characters/smith-likeness-2026-10-25/references/interrogation-4k-sources.json)。当前模型重新做正交渲染／标定，再把眼角、鼻翼等可见点绑定到实际三角形；分别拟合约 6.16°、5.01°、12.81° 偏航的弱透视镜头。眉毛、瞳孔视线、眼裂开合、视角相关轮廓不约束镜头，说话帧也排除嘴和下巴。三帧不是完整扫描，测量结果不能计算演员相似度。

[refine-smith-face.py](../scripts/refine-smith-face.py) 只采用三帧共同支持的对称中位数：眼角略向外、内眼角略向下、鼻翼略加宽；外眼角和鼻翼的上下差异随表情变化，没有用于修正。实际最大位移约 0.00393 世界单位，保留深度、手部、服装、头发、原 UV、材质、骨骼和权重。眼球随局部场一起调整，随后重新计算眼睑遮蔽。[几何校验](../output/characters/smith-likeness-2026-10-25/film-face-candidate/refinement-validation.json) 检查目标点、面片翻转、局部范围和不变属性；[表面检查](../output/characters/smith-likeness-2026-10-25/film-face-candidate/surface-check.json) 复查全部头发顶点／面心的正头皮间隙，以及两眼正面可见区域的连续性。它们不证明任意视角或动态时刻绝对零穿模。

修改前和修改后均运行相同的 6 项模型、9 项接触／恢复检查，全部通过，断言与阈值不变：[新模型日志](../output/characters/smith-likeness-2026-10-25/film-face-model-tests.log)、[新接触日志](../output/characters/smith-likeness-2026-10-25/film-face-contact-tests.log)、[来源记录](../output/characters/smith-likeness-2026-10-25/film-face-tests/replay-provenance.json)。当前 [三视图与实机动作页](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/review.html?variant=face) 和 [三帧原片对照页](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/film-eyes-review.html) 已复查；截图为 `smith-film-face-*`。对照页切换曾短暂显示旧照片配新镜头，已改成图像解码完成后同步更新；`smith-film-face-1552-loading-mismatch.png` 保留为该问题，不作有效对照。

这次是幅度很小的比例修订，原片对照仍清楚显示眼球光学、皱纹／肤质、眉眼表情和整体神态的差距。没有新图像生成、新依赖或运行时 TypeScript 修改，未发布候选，0 位角色通过最终相似度确认。

最新眼部诊断发现，之前文中所谓“透明角膜”实际没有反光：外层 980 个三角形的纹理 alpha 全为 0，全部被 `MASK` 裁掉；旧的透明模式断言只能检查配置，不能证明光学表面存在。[诊断记录](../output/characters/smith-likeness-2026-10-25/eye-surface-inspection.json)。[refine-smith-cornea.py](../scripts/refine-smith-cornea.py) 将现有外层面片分为独立蒙皮网格，使用标准 glTF 透射材质；内层保留原虹膜纹理和眼睑遮蔽。原 9,709,216 字节二进制数据逐字节保留，总三角形仍为 151,888，没有新增纹理或移动顶点：[完整性检查](../output/characters/smith-likeness-2026-10-25/cornea-candidate/integrity-validation.json)。这是薄表面近似，IOR 1.4 是制作参数，没有实现体积折射或泪膜动态。

运行时仅补上透射表面不投实心阴影，以及第一人称隐藏头部时同步隐藏角膜。[两个新增回归](../tests/eye-surface.test.mts) 先失败后通过：[修复前](../output/characters/smith-likeness-2026-10-25/cornea-runtime-before.log)、[修复后](../output/characters/smith-likeness-2026-10-25/cornea-runtime-after.log)。最终候选 [6 项模型](../output/characters/smith-likeness-2026-10-25/cornea-model-tests.log)、[10 项接触／绑定](../output/characters/smith-likeness-2026-10-25/cornea-contact-tests.log)通过；后者包含原 9 项及新增的真实角膜／虹膜五种姿态蒙皮一致性。客户端类型检查及原有第一人称手部恢复回归通过。没有重跑全库，也不改变此前保留的 7 个旧失败状态。

[表面采样](../output/characters/smith-likeness-2026-10-25/cornea-candidate/surface-check.json) 在 0°／45°／90°、每眼 192×128 射线中未发现暴露虹膜缺少外层覆盖；可见角膜均为连续区域，侧面远眼正常被遮挡。外层边缘略超出内层，不能将该检查描述成所有角度零穿模。[眼部近景](../output/characters/smith-likeness-2026-10-25/smith-cornea-closeup.png)、[三视图与动作页](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/review.html?variant=cornea)、[三帧原片对照](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/film-eyes-review.html?before=film-face-candidate&after=cornea-candidate)已复查；包含奔跑、审讯低头、夹持、松手和墨镜的 `smith-cornea-*` 截图保留。两页警告／错误均为 0。

透射代价仍未解决：在其他检查结束后，1280×510、像素比 2 的静态三视图中，CPU 提交 p50/p95 从 1.10/3.60 ms 增为 4.50/8.50 ms；帧间隔从 16.70/33.30 ms 增为 18.00/82.90 ms。[修改前](../output/characters/smith-likeness-2026-10-25/cornea-performance-isolated-before.txt)、[修改后](../output/characters/smith-likeness-2026-10-25/cornea-performance-isolated-after.txt)。每次预热 30 帧再测 120 帧；这是浏览器三视图诊断，不是完整游戏 FPS 或独立 GPU 计时，不能据此宣称性能达标。下一步需优化并在实际场景验证。眼睑／虹膜质感、表情、皱纹、整体神态和最终相似度继续未完成，当前 0 位角色通过用户确认，未发布到 5173。[本轮来源与复测范围](../output/characters/smith-likeness-2026-10-25/cornea-tests/replay-provenance.json)。

上一阶段眉弓形变使用已有 1543／1544 两帧的可见眉部约束，1552 帧仅核对较小幅度；镜头沿用排除眉部约束的既有拟合。眉头上抬约 0.018–0.020、眉尾约 0.008–0.013 世界单位。[制作脚本](../scripts/refine-smith-brow.py) 在原 GLB 中追加默认权重为 0 的 `smithBrowRaise`，保留原始二进制、纹理、骨骼和其他网格。该阶段 2,879 个顶点移动，最大约 0.02072，仍为 151,888 个三角形；没有补做细皱纹，也没有从正面照片推断新的深度。

首版数值检查没有翻面，但[实机网格近景](../output/characters/smith-likeness-2026-10-25/smith-brow-first-clay.png)出现上眼睑尖折，局部边长拉伸到 4.448 倍。扩大过渡带并让位移斜率连续后，最大降到 2.110 倍，99 分位降到 1.989 倍；21 档权重均无翻面。[失败日志](../output/characters/smith-likeness-2026-10-25/brow-strain-before.log)、[修正后检查](../output/characters/smith-likeness-2026-10-25/brow-candidate/strain.json)保留。该约束用于防止本次局部过度拉伸，不代表生物力学或演员相似度达标；眼睑贴图的折痕仍需精修。

[InterrogationPerformance.ts](../packages/client/src/agents/InterrogationPerformance.ts) 用既有审讯时钟恢复抬眉幅度，离场和动作结束归零。[SmithFaceImpact.ts](../packages/client/src/agents/SmithFaceImpact.ts) 现在追加受击形变并保留原表情、名称和权重。最初的合成测试未覆盖 GLTFLoader 从 `extras.targetNames` 写入名称的方式，真实候选测试暴露名称丢失；补齐夹具后先复现两项失败，再修复。[最终 5 项行为检查](../output/characters/smith-likeness-2026-10-25/brow-dictionary-after.log)覆盖相对／绝对形变、实际候选的冷加载表面一致性、手和下半脸不受眉部影响、实例隔离及受击叠加；原正式资产受击接触回归和客户端类型检查通过。表情节奏为当前审讯阶段的制作时序，尚非原片逐帧表演复原。

新候选 [6 项模型检查](../output/characters/smith-likeness-2026-10-25/brow-model-tests.log)和 [10 项接触／绑定检查](../output/characters/smith-likeness-2026-10-25/brow-contact-tests.log)通过，原断言及穿模阈值不变。[五档形变表面检查](../output/characters/smith-likeness-2026-10-25/brow-candidate/surface-check.json)复查头发全部顶点／面心和双眼三方向射线：头皮间隙仍为正，眼球开口采样变化低于 1.9%，未出现新的分离暴露区域或缺少角膜覆盖的虹膜；这不证明所有时刻零相交。

[眉弓阶段三视图与动作](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/review.html?variant=brow)、[原片对照](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/film-eyes-review.html?before=cornea-candidate&after=brow-candidate)、[抬眉](../output/characters/smith-likeness-2026-10-25/smith-brow-multiview.png)、[恢复中性](../output/characters/smith-likeness-2026-10-25/smith-brow-restored.png)、[夹持](../output/characters/smith-likeness-2026-10-25/smith-brow-tracker-hands.png)和[收手](../output/characters/smith-likeness-2026-10-25/smith-brow-release-hands.png)已检查。审查页修正了加载期间切换动作导致时间值超界的问题，按实际角色朝向固定三视图。两页无警告／错误。额头细皱纹、眼睑贴图、整体神态、手形细节及角膜性能仍未完成；本轮只查明 Three.js 透射会额外重绘不透明场景，未宣称已提帧。没有新图像生成、依赖或正式发布，0 位角色通过用户确认。[本轮复测来源](../output/characters/smith-likeness-2026-10-25/brow-tests/replay-provenance.json)。

本轮在 1543 原片上记录六条主要额纹及其分叉，将像素轨迹投到实际抬眉后的皮肤表面；[原片制作标记](../output/characters/smith-likeness-2026-10-25/smith-wrinkle-source-traces.png)、[三维轨迹](../output/characters/smith-likeness-2026-10-25/wrinkle-diagnostic.json)可复核。[额纹制作脚本](../scripts/refine-smith-wrinkles.py) 按表面误差局部细分，增加 3,535 个顶点、7,070 个三角形和 410,212 字节，角色总面数 158,958，未放宽原 160,000 面预算。褶皱深度是制作参数，不是从单张照片测得的真实深度；纹理未新增或改写。

原有 32,124 个皮肤顶点属性严格保持，24,375 个下半脸／手部顶点和 45,962 个对应面片保持；新顶点落在原始中性表面，最大误差约 0.000000511 世界单位。[几何校验](../output/characters/smith-likeness-2026-10-25/wrinkle-candidate/validation.json)未发现新的开放边界、非流形边或 21 档形变翻面；眉部制作标记已重新绑定到加密后的三角形，不能混用旧面片索引。[54 个真实凹陷采样](../output/characters/smith-likeness-2026-10-25/wrinkle-candidate-relief-check.json)均向内，深度中位数约 0.001994，恢复中性误差小于 0.000001。旧候选的无额纹失败结果与两次细分不收敛记录均保留。

新候选 [6 项模型检查](../output/characters/smith-likeness-2026-10-25/wrinkle-model-tests.log)、[12 项接触／绑定／冷加载表情检查](../output/characters/smith-likeness-2026-10-25/wrinkle-contact-runtime-tests.log)以及 [21 档额头自交检查](../output/characters/smith-likeness-2026-10-25/wrinkle-self-contact.log)均通过。自交沿用真实三角形交线大于 0.00001 的既有阈值，不代表任意精度下绝对零接触。[五档头皮／双眼采样](../output/characters/smith-likeness-2026-10-25/wrinkle-candidate/surface-check.json)和[眼睑拉伸回归](../output/characters/smith-likeness-2026-10-25/wrinkle-candidate/strain.json)通过，原阈值未改。未重跑全库，既有失败继续保留。

[额纹阶段三视图与实机动作](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/review.html?variant=wrinkles)新增额头近景；[原片前后对照](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/film-eyes-review.html?before=brow-candidate&after=wrinkle-candidate)让两栏使用相同抬眉幅度，分别使用各自拓扑的标记。已检查三帧原片、0°／45°／90°、半幅／恢复中性、灰模、抓握／收手及奔跑墨镜。额纹已经形成几何起伏，但边缘和宽度仍偏规则，缺少细小分叉与自然肤质；眼睑、视线、整体神态和角膜性能仍未完成。当前 0 位角色通过用户确认，不提高三部曲验收数；没有更改运行时 TypeScript、正式 GLB 或 5173 发布。[复测来源](../output/characters/smith-likeness-2026-10-25/wrinkle-tests/replay-provenance.json)。

最新眼睑近景检查确认：旧肤色投影把部分眼白／虹膜颜色采到了眼睑边缘，自动轮廓也有偏差。按原制作肖像的可见睫毛根部及下睑边缘逐点核对，制作源像素记录见 [标定文件](../output/characters/smith-likeness-2026-10-25/eyelid-color-traces.json)；该生成肖像仅用于颜色配准，不是演员相似度证据。原肖像文件保持不变。[制作脚本](../scripts/refine-smith-eyelid-projection.py) 在实际网格上校正投影，使用 Blender 烘焙窄眼睑区域，最终只有 **2,141 个贴图像素**变化；全部 10,914,732 字节模型二进制、原 UV、骨骼、手部、眉弓／额纹形变及材质均相同，总面数仍为 158,958。[完整性检查](../output/characters/smith-likeness-2026-10-25/eyelid-candidate/integrity-validation.json)确认上睑保护区和下半脸／手部贴图没有变化。

首轮只移动 UV 时，采样跳入眼窝内部的另一个图块，未采用；随后范围过宽的颜色投影虽然通过边界颜色检查，却在实机抬眉时把上睑折痕变成波浪状。该失败保留在 [首版画面](../output/characters/smith-likeness-2026-10-25/smith-eyelid-first-raised.png)和[保护区失败日志](../output/characters/smith-likeness-2026-10-25/eyelid-fold-before.log)：1,903 个上睑保护像素变化。最终修正限定在受污染的眼睑边缘，保护区变化回到 0；[当前抬眉近景](../output/characters/smith-likeness-2026-10-25/smith-eyelid-raised.png)已复查，没有将数值通过代替画面验收。

352 个眼裂边界样本的线性 RGB 最大通道差均值从 0.14845 降到 0.01453，95 分位从 0.26322 降到 0.04446：[修正前](../output/characters/smith-likeness-2026-10-25/eyelid-color-before.log)、[修正后](../output/characters/smith-likeness-2026-10-25/eyelid-color-after.log)。92 点用于配准，另 260 点的投影误差 RMS 为 0.26045 原素材像素、最大 1.17435；这些是颜色／坐标误差，不是相似度分数。最终脚本重建所得 GLB 与贴图哈希完全相同。

修改前后各运行相同的 [6 项模型](../output/characters/smith-likeness-2026-10-25/eyelid-model-tests.log)及 [6 项表情／手部接触／冷加载恢复检查](../output/characters/smith-likeness-2026-10-25/eyelid-expression-hand-tests.log)，均通过，断言与阈值不变。[当前三视图与动作](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/review.html?variant=eyelids)、[三帧原片对照](http://127.0.0.1:5200/output/characters/smith-likeness-2026-10-25/film-eyes-review.html?before=wrinkle-candidate&after=eyelid-candidate)已检查中性／抬眉／恢复中途、灰模、抓握／松手及奔跑墨镜；两页无渲染警告或错误。诊断页早期一次缺字段错误另有保留，最终重载正常。没有新增运行时逻辑或依赖，没有重跑全库；原有失败、眼球光学／独立视线与眨眼、肤质、皱褶自然度、手形细节及角膜性能仍未完成，0 位角色通过用户确认。来源和复测范围见 [记录](../output/characters/smith-likeness-2026-10-25/eyelid-tests/replay-provenance.json)。

眼镜是运行时生成的网格，未改上述候选 GLB；现在所有 `review.html` 历史变体都使用新运行时眼镜及当前显隐逻辑，旧代码仅保留在历史截图及源码快照中。静态 `film-camera-review.html` 与 `film-eyes-review.html` 直接加载 GLB，不含运行时眼镜，不能拿来验收眼镜修改。预烘焙 Smith 群众资产尚未重建。

原片参考及哈希见 [sources.json](../output/characters/smith-likeness-2026-10-25/references/sources.json)。[中性正面素材](../output/characters/smith-likeness-2026-10-25/references/smith-frontal-diffuse-v1.png)由内置 imagegen 生成，[完整提示词](../output/characters/smith-likeness-2026-10-25/portrait-prompt.txt)已保存，仅用于制作。头顶体积、眼球光学与表情、耳朵、发际线、墨镜款式与材质、手部细节及服装材质仍需精修；[旧墨镜图](../output/characters/smith-likeness-2026-10-25/smith-eye-glasses.png)保留为镜腿问题证据。独立模型审查没有完成用户相似度确认，也不替代整段剧情成功／失败／读档验收；当前候选、追踪器及眼镜修复均未发布到 5173。

## 新脸型的接触回归

新脸型暴露了两处真实穿模，均在修复前留有失败日志：

1. 嘴部移位后，进食算法仍按旧的固定高度选择嘴唇顶点，导致满勺食物穿过脸部。现在在资产中保留原嘴唇顶点身份，勺子跟随这些顶点的实际变形；旧资产仍使用原选择方式。新增回归先失败、修复后通过，没有缩小食物或放宽穿模阈值。
2. 先知手指仅按指腹中心拟合时，新脸型的局部曲率会穿入手指侧面。现在初始化贴合时检查实际蒙皮表面并调整手指间隙，结果按目标头部缓存。完整回归随后发现冷启动与连续播放角度不一致：远离原点时，浮点权重的微小误差污染了世界坐标下的贴合。改为手腕局部坐标蒙皮后，原有读档一致性测试恢复通过。

- 完整进食／先知检查：**26 通过，0 失败**，[日志](../output/characters/neo-likeness-2026-10-25/contact-full-after.log)。保留[修复前 25 通过、1 失败](../output/characters/neo-likeness-2026-10-25/contact-full-regression.log)。
- 新脸型实际资产：满勺接触、双手在脸外、连续播放／暂停／冷启动一致性 **3 通过**，[日志](../output/characters/neo-likeness-2026-10-25/contact-candidate-cold-after.log)。
- 最新口腔资产：将真实舌面也加入勺子／食物碰撞检查，连同进食冷启动 **2 通过**，[日志](../output/characters/neo-likeness-2026-10-25/mouth-contact.log)。
- `npm run typecheck` 通过，[日志](../output/characters/neo-likeness-2026-10-25/contact-typecheck-after.log)。

这些批次包含重叠检查，不将其简单相加作为独立测试总数。先知手部表面检查沿用原来的 `-0.003` 世界单位容差，不能把测试通过描述为任意精度下绝对零相交。当前没有宣称全部动作不存在穿模，先知和其他演员的建模验收也没有因这些接触测试而自动完成。

## 参考与生成资产来源

实际原片参考的 URL、SHA-256 和用途见 [references/sources.json](../output/characters/neo-likeness-2026-10-25/references/sources.json)，包括 [Warner Bros. 原片页面](https://www.warnerbros.com/movies/matrix)剧照与原片近景。生成的中性肖像仅用于建模与贴图制作，不充当原片证据或相似度验收截图。

本轮图像生成使用 **内置 imagegen**：

- 使用的正面参考：[neo-frontal-diffuse-v3.png](../output/characters/neo-likeness-2026-10-25/references/neo-frontal-diffuse-v3.png)，[完整最终提示词](../output/characters/neo-likeness-2026-10-25/portrait-prompt.txt)。先生成中性肖像，再按实际网格配准和烘焙，避免直接猜测 UV 布局。
- 拒绝的 UV 编辑试样：[neo-albedo-v2.png](../output/characters/neo-likeness-2026-10-25/rejected/neo-albedo-v2.png)，[完整提示词](../output/characters/neo-likeness-2026-10-25/texture-prompt.txt)。输出降为 1254×1254，鼻翼、嘴唇与原 UV 错位，未采用。

复现步骤见 [REPRODUCE.md](../output/characters/neo-likeness-2026-10-25/REPRODUCE.md)。本轮作者工具使用本地 Blender 和独立 MediaPipe 运行目录，没有新增游戏运行依赖。

## 此前运行版发布

当前 5173 客户端已单独接入 FightingHands / HandCurve 两处修复，新入口为 `index-DSZfi2w2.js`。构建使用核验恢复的原运行版客户端源码与其原 shared/dist，未混入工作区的其他服装实验，也未发布 Neo 脸部／口腔候选，以及本轮新增的进食／先知接触修复。

服务器没有重启。HTTP 校验确认新入口和 bundle 哈希正确，四个核心角色的正式 GLB 均未改变；服务器继续运行、85 个角色正常，浏览器战斗动作检查没有控制台错误。

- [发布记录](../output/characters/neo-likeness-2026-10-25/runtime-publish.json)
- [源码差异与哈希](../output/characters/neo-likeness-2026-10-25/runtime-changes.json)
- [仅两文件修复补丁](../output/characters/neo-likeness-2026-10-25/runtime-hand-surface.diff)
- [正式版画面检查](../output/characters/neo-likeness-2026-10-25/runtime-combat-check.png)

Neo、Trinity、Morpheus、Smith 现有候选均未通过用户最终验收，后续主角和船员尚待本轮逐人精修。所有未完成的相似度、人物动作、手部、穿模及三部曲剧情验收项继续保留。新增候选没有发布到 5173 运行版。
