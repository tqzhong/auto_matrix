# 墨菲斯旧楼外套：接缝与正蹬余量（2026-10-22）

已合入运行源码并更新固定本机入口 <http://localhost:5173/>。生产构建为 `index-py2UkB9Q.js`；原生5199页面已检查走跑、蹲行和新增“旧楼 · 连招”，检查时控制台无警告或错误。

## 实际改动

原实现24个站立、走跑、转向和蹲起姿态的82点上缘测量，最大分离约26.12厘米；新回归在当前已提交基线先失败。上缘现跟随真实衣身下边界，再沿实际切向留出毫米级厚度。第一段自由衣片分成八段，按真实内层三角面相交范围约束其高度，保留原身体及完整衣物碰撞对象。24姿态最大分离约1.783毫米，门槛仍为3毫米。

原两片尾摆共5,120面，其中最上方160面细分为1,280面，合计6,240面。下方4,960个原三角面的连接、顺序、绕向和UV完全保留；其他服装仍使用原几何，离开旧楼外套即恢复。新增保留测试先发现一侧衣片绕向错误，修正后通过，没有靠双面材质隐藏该错误。

补查正蹬时，新接缝先因固定上缘进入长裤而失败。保留战斗中的抬腿衣物余量，将原动作抑制仅留给放松手臂偏移；髋部大幅弯曲时平滑展开更多外衣，普通跑步仍使用原余量。先复现失败，再通过54帧正蹬与五个时刻的完整尾摆/所有真实内层、自交及上衣/长裤检查。另八类动作各90帧的有限运行检查通过，不等于它们全部通过三角面无穿模验收。

不新增依赖、GLB或纹理，不改服务端和存档格式。此处是确定性姿态修正，不是通用布料物理系统；暂停与冷恢复不依靠重新模拟等待稳定。旧离线脱衣缓存的初始几何不同，不能用于证明这份新接缝有效。

## 验证记录

- `sewn-current-rim-red.log`：当前基线的接缝距离回归先失败。
- `sewn-topology-first-summary.log`、`sewn-topology-final.log`：发现并修正一侧衣片绕向，保留下半部完整拓扑与UV。
- `sewn-complete-gate.log`：正蹬修正前，走跑、蹲起、接缝距离、暂停与冷恢复15/15通过；不能代表之后新增的正蹬检查。
- `sewn-kick-red.log`、`sewn-kick-first.log`、`sewn-kick-complete-contact.log`：正蹬先后失败，最终强化接触检查1/1通过。
- `sewn-final-complete-gate.log`、`sewn-final-wardrobe-gate.log`：最终版本完整整衣16/16、换装/电话交接16/16通过。连同部署75项，共107项不同测试；强化后的正蹬复测属于其中一项，不重复计数。
- `sewn-deploy-gate.log`：75/75通过；`sewn-final-typecheck.log`、`sewn-final-build.log`：类型与生产构建通过，保留原有大JS包警告。
- `sewn-action-red.json`、`sewn-action-smoke.json`：初次正蹬失败及最后八类动作各90帧的运行检查。

同一Node进程交替测量，每版90个热身后调用，CPU中位22.651→27.838ms，P95为28.738→53.173ms；这是约5.187ms新增中位开销，受并发负载影响，不是浏览器FPS或性能提升。见 `measure-sewn-cpu.mts` 和 `sewn-cpu-comparison.json`。

独立副本对比 `cd28543` 的700个运行文件，四份人物源码改变，新增接缝模块，其他696份及全部素材/服务端保持。根工作区11份未完成文件哈希保持，见 `source-audit.json`。验证后的候选已写回根目录和本地试玩；不重新接入Render，不覆盖云端或其他世界。更新仅替换客户端，280个服务端构建文件相同，后端未重启，更新前后的完整世界快照相同，暂停/tick3757保留。见 `local-update-verification.json`。

复测命令：

```bash
node --import tsx --test tests/ambush-coat-tail.test.mts tests/ambush-upper-fit.test.mts tests/ambush-crouch-fit.test.mts tests/ambush-crouch-transition.test.mts
node --import tsx --test tests/ambush-covered-shirt.test.mts tests/ambush-hem-wardrobe.test.mts tests/ambush-call-renderer.test.mts
npm run test:deploy
npm run typecheck
npm run build
```

## 真实剩余问题

原生画面仍可见腰部明暗接头、过亮皮革和大幅抬腿时僵硬的衣摆，尚非自然电影服装。正蹬第15帧的完整上衣还有420次自交计数（含双向计数），在原已提交模型同样复现；最大相交位于左肘弯的两片袖面。肩外移0.06至0.3弧度后仍有304次，不能以挪开手臂替代肘弯的真实几何修复。见 `kick-armspace-baseline.json`、`kick-armspace-probe.json`。这项没有被当前尾摆/长裤通过结果覆盖，下一项须处理袖子肘弯与自然手臂动作。

此前接缝失败日志的完整计数为5个姿态，异常文本只列前三示例；上轮误报3个的说明已在 `d1ed6f4` 纠正。本轮首批90完整姿态已没有接触失败，并输出全部失败列表以避免漏计。完整脱衣、自然人物/衣物、实际浏览器性能及三部连续体验继续未完成，42组高质量验收数仍为0。

最终固定入口实机检查与截图保存在 `local-sewn-preview.png`、`local-native-console.json`；原生QA最终连招画面为 `native-current-combat.png`。早期 `native-sewn-*.png` 来自第一轮候选，只留本地作过程诊断。原始世界快照和大体积几何诊断不入Git。

绕向失败的完整索引差异较长，入库保留开头/结尾节选，SHA256与原日志位置见汇总JSON；原日志完整保留本地。其他入库日志只清理行尾空格与末尾多余空行，对应原输出以 `raw-` 前缀留本地。
