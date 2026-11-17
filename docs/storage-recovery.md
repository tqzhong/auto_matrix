# 制作产物的清理与恢复

## 2026-11-18 本机清理

项目的 `output/` 已清理，卷可用空间从约 29.3 GiB 增至 108.2 GiB。开发录制和测试按需重新创建 `output/`，该目录继续由 Git 忽略。

同级本机目录 `../auto_matrix-recovery-2026-11-18/` 保存第 120 节点暴雨大道续档、第 126 节点和平结局档、89 个经过完整冷读的场景入口，以及不可直接由游戏源码重建的制作资料。制作归档附有路径清单和 SHA-256。序章混音和人物审查所需的原模型、脚本、清单可从归档按原路径提取。人物审查和历史截图链接需要相应的本地文件。

原 5173 试玩从 `output/` 读取预览构建。清理后用已提交源码重建并迁出运行目录和存档，默认端口保持 5173。上述本机目录的 `local-preview-runtime/` 提供客户端和服务端，`local-preview-data/` 保存试玩世界。切换后用 HTTP 核对页面、角色素材和 85 人世界，原保存刻恢复一致。

从项目根目录恢复选定的文件。

```sh
recovery_dir=../auto_matrix-recovery-2026-11-18
tar -xf "$recovery_dir/production-materials.tar.zst" \
  output/gameplay/first-film-office-2026-11-04/machine-pact-live-1118bc
```

## 2026-10-25 历史恢复包

2026-10-25 已将历史副本、逐帧网格、布料工程、录像、实验源码与测试保存点去重归档，并删除原始大文件。游戏源码、正式素材、Git 历史、当前试玩构建和正式存档仍保留。未完成的手型、穿模、服装和电影画面问题没有改为已完成。

2026-11-18 已把原恢复包及清单迁到上述本机目录下的 `legacy/output/audit/storage-cleanup-2026-10-25/final-pass/`。五份压缩包迁出前通过 `archive-sha256.txt` 校验，合计约 7.24 GB。它们包含独有制作资料，应保留一份。

在项目根目录按需恢复某个实验，避免一次恢复整个 output：

```sh
recovery_dir=../auto_matrix-recovery-2026-11-18
python3 "$recovery_dir/legacy/output/audit/storage-cleanup-2026-10-25/final-pass/restore.py" --into . \
  output/characters/morpheus-withdrawal-path-2026-10-20
```

支持多个目录或精确文件路径，也可用 `--into /absolute/path` 恢复到其他位置。恢复工具检查 SHA-256，并拒绝覆盖内容不同的现有文件。`.blend`、`.pc2` 和其原始输入需成套恢复。历史截图和 README 多数留在原位置；历史大文件链接需要先恢复对应路径。

`scripts/build-park-trees.mts` 的默认来源路径未变，重新制作公园树前恢复其输入：

```sh
python3 "$recovery_dir/legacy/output/audit/storage-cleanup-2026-10-25/final-pass/restore.py" --into . \
  output/gameplay/trilogy-park-vegetation-2026-10-07/source
```

手腕蒙皮的未合入修改保存在 `character-matrix-budget-2026-10-24/candidate-release` 的归档中，恢复说明附带与主工作区的差异。原 5200、5201、5202 测试／对照进程已正常停止；继续实验前恢复对应目录，必要时依据其 lockfile 重装依赖，再启动隔离测试。

2026-10-25 清理后曾重新安装 Blender 4.5.3 macOS arm64。制作归档保存定制 Blender 的构建参数、改动源文件及原下载校验记录。再次制作前按需安装，原恢复包的 `RESTORE.md` 有固定版本、安装包校验和布料 Python 环境恢复说明。

本轮独立 MediaPipe 作者工具约 29 MiB；Neo 候选、参考、证据和少量恢复源码合计约 97 MiB，未恢复整套历史实验。

人物精修的新产物集中在 `output/characters/neo-likeness-2026-10-25/`；5200 是本轮新开的三视图审查服务。正式客户端已单独接入两处手指变形修复，构建来源为核验后恢复的现有运行版源码，差异保存在该目录的 `runtime-hand-surface.diff`。原恢复包不包含这轮新修改；后续清理时需连同本轮源码、候选和发布记录一起保留。详见[人物精修审查记录](character-likeness-review-2026-10-25.md)。

后续制作按问题保留当前输入、源脚本、必要的成功／失败／读档证据。需要重用历史素材时恢复具体目录，避免再次复制整套游戏到每个实验目录。
