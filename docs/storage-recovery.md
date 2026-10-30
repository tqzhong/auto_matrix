# 制作产物的清理与恢复

2026-10-25 已将历史副本、逐帧网格、布料工程、录像、实验源码与测试保存点去重归档，并删除原始大文件。游戏源码、正式素材、Git 历史、当前试玩构建和正式存档仍保留。未完成的手型、穿模、服装和电影画面问题没有改为已完成。

恢复包与完整清单位于 `output/audit/storage-cleanup-2026-10-25/final-pass/`，约 7.24 GB。它们包含独有制作资料，应保留一份；需要清空本机恢复包时，先在其他存储完整备份并核验该目录的 `archive-sha256.txt`。

在项目根目录按需恢复某个实验，避免一次恢复整个 output：

```sh
python3 output/audit/storage-cleanup-2026-10-25/final-pass/restore.py \
  output/characters/morpheus-withdrawal-path-2026-10-20
```

支持多个目录或精确文件路径，也可用 `--into /absolute/path` 恢复到其他位置。恢复工具检查 SHA-256，并拒绝覆盖内容不同的现有文件。`.blend`、`.pc2` 和其原始输入需成套恢复。历史截图和 README 多数留在原位置；历史大文件链接需要先恢复对应路径。

`scripts/build-park-trees.mts` 的默认来源路径未变，重新制作公园树前恢复其输入：

```sh
python3 output/audit/storage-cleanup-2026-10-25/final-pass/restore.py \
  output/gameplay/trilogy-park-vegetation-2026-10-07/source
```

手腕蒙皮的未合入修改保存在 `character-matrix-budget-2026-10-24/candidate-release` 的归档中，恢复说明附带与主工作区的差异。原 5200、5201、5202 测试／对照进程已正常停止；继续实验前恢复对应目录，必要时依据其 lockfile 重装依赖，再启动隔离测试。

Blender 在清理时已移除，随后为用户要求的人物精修重新安装了固定版本 4.5.3 macOS arm64（约 802 MiB），安装包校验后已删除。官方地址、安装包 SHA-256、布料 Python 环境恢复命令和逐项验证见[完整恢复说明](../output/audit/storage-cleanup-2026-10-25/final-pass/RESTORE.md)。当前正式入口仍为 <http://localhost:5173/>。

本轮独立 MediaPipe 作者工具约 29 MiB；Neo 候选、参考、证据和少量恢复源码合计约 97 MiB，未恢复整套历史实验。

人物精修的新产物集中在 `output/characters/neo-likeness-2026-10-25/`；5200 是本轮新开的三视图审查服务。正式客户端已单独接入两处手指变形修复，构建来源为核验后恢复的现有运行版源码，差异保存在该目录的 `runtime-hand-surface.diff`。原恢复包不包含这轮新修改；后续清理时需连同本轮源码、候选和发布记录一起保留。详见[人物精修审查记录](character-likeness-review-2026-10-25.md)。

后续制作按问题保留当前输入、源脚本、必要的成功／失败／读档证据。需要重用历史素材时恢复具体目录，避免再次复制整套游戏到每个实验目录。
