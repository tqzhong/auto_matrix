# Auto Matrix 电影原声

本目录仅包含 `originals/` 中的 14 段三部曲原版录音。旧的 19 段合成配乐及其生成脚本已移除；不存在备用 BGM 回退。

- `packages/client/src/engine/film-score.json`：来源、文件、时长与 SHA-256。
- `OriginalScore.ts`：全部 26 个音乐场景的原声对应关系。
- `Soundtrack.ts`：生活、章节与战斗的选曲逻辑和场景音量。
- `GameAudio.ts`：加载、同曲连续播放、渐变、音量、静音和录像混音。
- `docs/original-soundtrack-plan.md`：实际场景配曲表。

14 个游戏用 MP3 随仓库提交，拉取后可直接播放。运行 `npm run music:originals` 可恢复并校验原声音频。加载失败只提示重试，不播放替代曲；旧浏览器导入曲不再使用。来源说明见 [originals/README.md](originals/README.md)。
