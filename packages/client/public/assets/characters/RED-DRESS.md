# 红衣女子训练角色

`red-dress.glb` 用于 `citizen_2`，沿用游戏的 46 关节人体骨架，包括双手各 15 个手指关节。身体、挂脖裙、垂褶、鞋和头发均为三维网格。角色从现有角色加载流程接入，使用训练存档中的时钟。

人体、骨骼、基础皮肤、眼球和长发来自项目原有 MakeHuman CC0 素材：

- [MakeHuman 固定版本](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482)，`base.obj`、`default.mhskel`、`default_weights.mhw` 和 GLB 元数据列出的女性形态参数。
- [MakeHuman CC0 系统素材包](https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip)，SHA-256 `b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107`。复用已发布的 `dujour-skin.png`；新增 `bluegreen_eye.png` 与 `long01-hair.png`，在骨骼绑定前缩短并调整发梢轮廓，运行时着色为金色。

服装根据[红衣女子片段](https://www.youtube.com/watch?v=YgJ5ZEn67tk)约 0:37–0:40 的画面制作：及膝红裙、挂脖带、垂褶领口、裸露肩臂与金色肩长头发。该链接由 Flashback FM 发布，不是本项目的授权或演员扫描来源；电影画面没有用作游戏纹理。

裙摆截面取两腿外侧的包络，再分配髋部权重，避免把内侧腿缝当成衣物外表。鞋子使用包趾鞋面、独立鞋底和实体鞋跟，脚跟抬高 0.18 游戏单位，脚尖留在支撑面。挂脖带先沿完整颈肩表面上升，再绕过颈后；不使用跨在皮肤前方的悬空曲线。手部继续使用现有前臂扭转和指骨姿态。

离线制作使用项目已有 NumPy 工具链，不增加游戏运行依赖：

```sh
python scripts/build-characters.py --character red-dress --source /path/to/cc0-cache --output /path/to/review-staging
```

首次下载可加 `--fetch`。始终先输出到新的暂存目录，检查后再替换游戏资产。服装生成逻辑位于 `scripts/red_dress_costume.py`。

目前是按原片服装制作的独立近似角色，面部仍为 CC0 形态拟合，尚未达到演员级相似度。自然表情、完整转头表演、头发动态和布料物理仍需继续制作；局部穿模测试不等于所有动作、视角或整段电影质量已验收。
