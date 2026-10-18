# matrixai.online 免费部署

使用 Render 的 **Hobby 工作区 + Free Web Service** 运行现有 Node.js 游戏，Supabase **Free** 项目保存世界。域名 DNS 留在阿里云。网页、模型、音乐、API 和 Socket.IO 由同一个 HTTPS 域名提供，玩家的浏览器负责 3D 渲染。部署配置见根目录 `render.yaml`，不购买服务器或持久磁盘，不使用付费语言模型。

## 已上线版本（2026-10-18）

- 正式入口：<https://matrixai.online>；`www.matrixai.online` 自动跳转到根域名。两者均已验证并签发 HTTPS 证书。
- Render 服务：`matrixai` / `srv-dba4redg1s2s73apj6c0`，Singapore，Free；备用入口 <https://matrixai-s0sd.onrender.com>。自动部署关闭，已发布提交 `affacb09efabecfc2d8d3b566860b6dc089417fb`。
- Supabase 项目：`matrixai` / `kywbietilqfwuvvpyooe`，Singapore，Free。连接密钥仅保存在 Render 的私密环境变量中。
- 阿里云 DNS：`@ A 216.24.57.1`，`www CNAME matrixai-s0sd.onrender.com`，TTL 10 分钟。原来的三个额外 GitHub Pages A 记录已暂停保留；旧主 A 值为 `185.199.108.153`，旧 www 值为 `tqzhong.github.io`。其他记录未改动。
- 验收：HTTPS、Socket.IO 世界快照、224 个素材及模型/音乐分段请求通过；正式域名中 Neo 接管、日常活动面板和原声播放正常。重新发布后服务器从云存档恢复到 tick 4364，保留暂停状态。依赖补丁后生产构建及 49 项回归测试通过，生产依赖审计为 0 项已知漏洞。
- 试玩前点击进入 Neo，再点击“继续时间”。当前是共享世界，其他访客会进入同一个世界。Render 工作区自定义域名额度已用满（2 / 2），本次未添加付费服务。

线上使用的是上述已验证提交。本地未完成的剧情、衣物动作实验不包含在此次发布中。后续代码推送不会自动更新网站，需完成验证后手动发布。

## 免费额度与体验

- Render 无请求 15 分钟后休眠，下一次访问约需一分钟唤醒；休眠期间世界停止推进。服务重启或更新会清空本地磁盘，因此线上必须启用云存档。
- Hobby 工作区每月共享 750 小时免费实例运行时间、5 GB 出站流量、500 分钟构建时间、2 个自定义域名。现有其他服务也消耗这些额度。保持账户不绑定支付方式：额度耗尽会暂停服务或构建，而非进入付费超额计费。
- 游戏完整素材约 330 MiB，实际访问流量还包括实时同步。免费方案适合个人试玩，不能保证大量玩家或整月持续在线。不要设置保活请求规避休眠。
- Supabase Free 提供 500 MB 数据库空间、5 GB 出站流量；一周不活跃可能暂停项目，需要在控制台恢复。它没有自动备份保障，应在重要进度后自行导出存档表。

以上按 2026-10-18 官方文档核对；上线前仍需确认账号页面的实际套餐和额度。参考：[Render 免费规则](https://render.com/docs/free)、[流量](https://render.com/docs/outbound-bandwidth)、[Supabase 定价](https://supabase.com/pricing)。

## 首次部署

1. 创建独立的 Supabase Free 项目，选择 Singapore，保留 Data API，关闭自动公开新表，开启自动 RLS。在 SQL Editor 执行 `deploy/supabase.sql`。该表只允许服务端的 `service_role` 读写，浏览器不持有数据库密钥。
2. 在 Supabase 项目的 API Keys 页面获取 **secret key**（`sb_secret_…`）和项目 URL。在 Render 新建 Web Service，连接 `tqzhong/auto_matrix` 的 `main`，选择 **Free / $0**、Singapore、Node。
3. 使用构建命令 `npm ci --include=dev && npm run build && npm prune --omit=dev`，启动命令 `node packages/server/dist/index.js`，健康检查 `/api/status`。环境变量按 `render.yaml` 设置，`SUPABASE_URL` 与 `SUPABASE_SECRET_KEY` 只填在服务端环境变量中，不能提交到 Git。`LLM_API_KEY` 留空使用现有规则模拟和剧情。
4. 部署经过验证的提交。确认 `onrender.com` 地址通过网页、API、实时连接和素材检查，再添加 `matrixai.online` 自定义域名。按 Render 控制台给出的记录修改阿里云 DNS；先记录旧 A/CNAME 值，不改其他子域名。Render 自动签发 HTTPS 证书。Hobby 的域名额度只有两项；不要在没有额度时额外启用 `www`。
5. 网站首次创建一个独立世界，不上传开发机的 `.env`、原存档、录屏或参考影片。既有本地进度保持独立。线上仍是现有的共享世界，没有新增个人账号与个人存档。

## 存档与更新

启用 `MATRIX_CLOUD_SAVE=supabase` 后，世界、剧情、时间控制和所有角色记忆在同一份 gzip 压缩快照中原子保存，数据库只保留当前快照。未配置云模式时继续使用原来的本地文件存档。

云存档连接失败、内容损坏或缺少密钥时拒绝以空世界启动。只有数据库成功返回“没有存档”才新建世界。保存沿用现有的每 60 个模拟 tick、暂停/继续等控制边界、正常退出触发；异常中断最多丢失最近一次成功保存后的进度。不要把断线等同于立即存档。

每次上线更新前：

1. 在游戏内暂停，等待云存档表的 `updated_at` 和 `revision` 更新，再从 Supabase 导出 `matrix_checkpoints` 表作为备份。
2. 保持自动部署关闭，停止旧实例，再发布指定的已验证提交。新服务读回同一份云存档，并保持暂停状态。确认位置、剧情、记忆和时间都正确后继续游戏。
3. 不得启动两个服务共同写入同一个存档。版本条件写入会拒绝旧实例覆盖新存档；出现 `changed in another instance` 时应停止旧进程并重启唯一的保留实例，从云端重新读档。

回滚代码仍读取当前云存档。需要恢复备份时先停止服务，保存当前行的副本，再明确选择备份恢复；不要在线覆盖仍在使用的存档。模型、音乐和代码更新不会自动重置数据库。

## 验收

在安装了项目依赖的工作区执行：

```bash
node scripts/check-deployment.mjs https://matrixai.online
```

先在浏览器唤醒已休眠的服务，再运行检查。此脚本只读取网页、服务状态、实时世界快照和静态资源，不接管角色或发送游玩指令。它核对 224 个本地游戏素材的线上大小，并抽查 GLB 与 MP3 分段下载内容。

首次上线还需实际确认 Neo 可接管、人物与场景能渲染、音乐播放、移动和剧情交互正常，再验证停止服务和重启后能恢复存档。离线测试使用模拟的 Supabase REST 服务，不等同于线上验收。部署记录保存在本地 `output/deployment/`；完成这些检查之前，不能将“代码已准备好”描述为“网站已上线”。
