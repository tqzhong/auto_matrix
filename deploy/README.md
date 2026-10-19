# matrixai.online 免费部署

使用 Render 的 **Hobby 工作区 + Free Web Service** 运行现有 Node.js 游戏，Supabase **Free** 项目保存世界。域名 DNS 留在阿里云。网页、模型、音乐、API 和 Socket.IO 由同一个 HTTPS 域名提供，玩家的浏览器负责 3D 渲染。部署配置见根目录 `render.yaml`，不购买服务器或持久磁盘，不使用付费语言模型。

## 已上线版本（2026-10-19）

- 正式入口：<https://matrixai.online>；`www.matrixai.online` 自动跳转到根域名。两者均已验证并签发 HTTPS 证书。
- Render 服务：`matrixai` / `srv-dba4redg1s2s73apj6c0`，Singapore，Free；备用入口 <https://matrixai-s0sd.onrender.com>。已发布 `0c4f4d3b3b8a4124730b4edc973299c07b14ae1e`，包含操作延迟修复和发布前测试。发布记录 `dep-dbanfq7btjjs73frv2i0`：由 Codex 触发，Render 上 54 项测试通过，构建成功并显示 Live；新实例从 tick 5062 的云存档恢复。
- Supabase 项目：`matrixai` / `kywbietilqfwuvvpyooe`，Singapore，Free。连接密钥仅保存在 Render 的私密环境变量中。
- 阿里云 DNS：`@ A 216.24.57.1`，`www CNAME matrixai-s0sd.onrender.com`，TTL 10 分钟。原来的三个额外 GitHub Pages A 记录已暂停保留；旧主 A 值为 `185.199.108.153`，旧 www 值为 `tqzhong.github.io`。其他记录未改动。
- 验收：HTTPS、双向 Socket.IO、224 个素材及模型/音乐分段请求通过。正式域名实测 Neo 接管、WASD 移动、V 切换视角、转向、跳跃和 G 日常活动；位置变化约 9 米，跳跃从地面 y=1 上升到约 2.66 后落地。55 秒远端采样的 10 次操作往返为 173–853 毫秒，无超时。睡眠推进到早晨、通勤到咖啡馆正常执行。浏览器曾短暂显示高延迟提示后恢复，仍不能保证免费跨境线路一直流畅。
- 发布回归命令 `npm run test:deploy` 的 54 项检查和生产构建通过，覆盖连接恢复、角色控制、移动、暂停、云存档、模拟与带宽压缩；这不是三部曲全部剧情的完整验收。
- 试玩前点击进入 Neo；存档暂停时，点击显眼的“继续游玩”。当前是共享世界，其他访客会进入同一个世界。Render 工作区自定义域名额度已用满（2 / 2），本次未添加付费服务。

线上使用的是上述已验证提交。本地未完成的剧情、衣物动作实验不包含在此次发布中。用户已授权 Codex 在后续修改验证通过后自行推送、发布并验收，无需反复让用户点击发布。

Render 的 Auto-Deploy 已设为 **On Commit**，`render.yaml` 与控制台一致。但现有 GitHub 应用连接只包含另一个仓库，尚未包含 `auto_matrix`，此次推送未触发部署；GitHub 要求二次身份验证才能配置仓库访问。不能把打开开关描述为推送自动发布已打通。在该连接完成前，由 Codex 在现有 Render 登录会话中执行 **Manual Deploy → Deploy latest commit**，并核对实际发布的提交。无论触发方式如何，构建流程均先执行部署回归测试，失败时不替换现有线上版本。参考：[Render 自动部署与失败保留机制](https://render.com/docs/deploys)、[仓库连接要求](https://render.com/docs/git-provider)。

## 免费额度与体验

- Render 无请求 15 分钟后休眠，下一次访问约需一分钟唤醒；休眠期间世界停止推进。服务重启或更新会清空本地磁盘，因此线上必须启用云存档。
- Hobby 工作区每月共享 750 小时免费实例运行时间、5 GB 出站流量、500 分钟构建时间、2 个自定义域名。现有其他服务也消耗这些额度。保持账户不绑定支付方式：额度耗尽会暂停服务或构建，而非进入付费超额计费。
- 游戏完整素材约 330 MiB，实际访问流量还包括实时同步。免费方案适合个人试玩，不能保证大量玩家或整月持续在线。不要设置保活请求规避休眠。
- Supabase Free 提供 500 MB 数据库空间、5 GB 出站流量；一周不活跃可能暂停项目，需要在控制台恢复。它没有自动备份保障，应在重要进度后自行导出存档表。

以上按 2026-10-18 官方文档核对；上线前仍需确认账号页面的实际套餐和额度。参考：[Render 免费规则](https://render.com/docs/free)、[流量](https://render.com/docs/outbound-bandwidth)、[Supabase 定价](https://supabase.com/pricing)。

## 首次部署

1. 创建独立的 Supabase Free 项目，选择 Singapore，保留 Data API，关闭自动公开新表，开启自动 RLS。在 SQL Editor 执行 `deploy/supabase.sql`。该表只允许服务端的 `service_role` 读写，浏览器不持有数据库密钥。
2. 在 Supabase 项目的 API Keys 页面获取 **secret key**（`sb_secret_…`）和项目 URL。在 Render 新建 Web Service，连接 `tqzhong/auto_matrix` 的 `main`，选择 **Free / $0**、Singapore、Node。
3. 使用构建命令 `npm ci --include=dev && npm run test:deploy && npm run build && npm prune --omit=dev`，启动命令 `node packages/server/dist/index.js`，健康检查 `/api/status`。环境变量按 `render.yaml` 设置，`SUPABASE_URL` 与 `SUPABASE_SECRET_KEY` 只填在服务端环境变量中，不能提交到 Git。`LLM_API_KEY` 留空使用现有规则模拟和剧情。
4. 部署经过验证的提交。确认 `onrender.com` 地址通过网页、API、实时连接和素材检查，再添加 `matrixai.online` 自定义域名。按 Render 控制台给出的记录修改阿里云 DNS；先记录旧 A/CNAME 值，不改其他子域名。Render 自动签发 HTTPS 证书。Hobby 的域名额度只有两项；不要在没有额度时额外启用 `www`。
5. 网站首次创建一个独立世界，不上传开发机的 `.env`、原存档、录屏或参考影片。既有本地进度保持独立。线上仍是现有的共享世界，没有新增个人账号与个人存档。

## 存档与更新

启用 `MATRIX_CLOUD_SAVE=supabase` 后，世界、剧情、时间控制和所有角色记忆在同一份 gzip 压缩快照中原子保存，数据库只保留当前快照。未配置云模式时继续使用原来的本地文件存档。

云存档连接失败、内容损坏或缺少密钥时拒绝以空世界启动。只有数据库成功返回“没有存档”才新建世界。保存沿用现有的每 60 个模拟 tick、暂停/继续等控制边界、正常退出触发；异常中断最多丢失最近一次成功保存后的进度。不要把断线等同于立即存档。

每次上线更新：

1. 只提交已完成的改动，在不包含本地未完成实验的发布目录中运行相关测试、`npm run test:deploy` 和 `npm run build`，通过后推送 `main`。涉及存档格式或重大剧情迁移时，先暂停并导出云存档备份。
2. 检查 Render 是否收到推送；没有自动触发时由 Codex 发布最新已验证提交。等待控制台显示 Live，并核对提交 SHA。测试或构建失败时修复失败项，不跳过检查。
3. 检查线上双向操作回应、移动与相关交互，以及重启后的进度。更新会短暂断开连接，客户端自动尝试恢复上次确认的角色；不会自动抢回其他页面正在控制的角色。
4. 不得启动两个服务共同写入同一个存档。保存请求的响应丢失时，下次保存先核对那次确切的写入。若确实发现另一实例的新版本，旧进程停止模拟并退出，由 Render 重启后重新读云档，避免持续运行无法保存的分支。需要在发布后观察日志和恢复状态，不能仅凭网页能打开就宣布完成。

回滚代码仍读取当前云存档。需要恢复备份时先停止服务，保存当前行的副本，再明确选择备份恢复；不要在线覆盖仍在使用的存档。模型、音乐和代码更新不会自动重置数据库。

## 验收

在安装了项目依赖的工作区执行：

```bash
node scripts/check-deployment.mjs https://matrixai.online
```

先在浏览器唤醒已休眠的服务，再运行检查。此脚本只读取网页、服务状态、实时世界快照和静态资源，不接管角色或发送游玩指令。它还要求服务器在 4 秒内确认一次连接探测，避免只凭连接建立就认为可以操作；核对 224 个本地游戏素材的线上大小，并抽查 GLB 与 MP3 分段下载内容。

首次上线还需实际确认 Neo 可接管、人物与场景能渲染、音乐播放、移动和剧情交互正常，再验证停止服务和重启后能恢复存档。离线测试使用模拟的 Supabase REST 服务，不等同于线上验收。部署记录保存在本地 `output/deployment/`；完成这些检查之前，不能将“代码已准备好”描述为“网站已上线”。
