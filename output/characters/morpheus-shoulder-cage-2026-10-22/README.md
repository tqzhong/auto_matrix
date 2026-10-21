# 肩窝诊断与逐帧碰撞缓存修正 · 2026-10-22

本轮只采用离线制作工具修正，**没有采用肩部几何候选，没有更新游戏画面，也没有新增已验收场景**。42组高质量验收仍为0。固定试玩仍为 <http://localhost:5173/>，Render保持永久删除。

## 实际采用

`scripts/cloth_collision.py` 新增 `cache_collider_vertices(body, frames, path)`：原生 PC2 缓存放在 Collision 之前，以场景帧驱动准确的采样索引。连续整数帧、逐帧同序的有限 float32 顶点输入，在写文件前检查；写入全新文件，不覆盖已有缓存。保存制作项目需要同时保留 `.pc2`，检查包含相对侧文件保存后重开。没有引入包或游戏依赖。原绝对形状关键帧函数保留兼容。

先增加实际三角面样本回归，旧函数在第16帧等时刻失败：key本身的顶点是准确的，但求值时出现漂移。精度失败日志 [RED](cache-precision-red.log) 和 [完整91帧结果](cache-precision-red.json) 保留，进程以 `--python-exit-code 1` 确认退出1。旧工具的两项既有 Blender 检查原本通过，说明原物理测试的1e-6容差不能代替精确采样检查。

修正后：

- [精度与恢复](cache-precision-green.json)：同一真实三角面的三点，91帧顺序读取及保存 `.blend` 后91帧倒序读取均逐字节相同、拓扑保持；另有4个子帧、3个偏移场景帧、4类无效输入。子帧允许float32插值舍入，整数帧不放宽容差。
- [实际物理响应](collider-final.json)：绝对形状关键帧、正常位移关键帧与PC2三条路径均将零重力布片从0.5米托起。第61帧PC2与位移路径最低点同为1.08771348米；PC2的61个碰撞输入还要求字节一致。不是只检查“碰撞网格看起来会动”。
- [既有显示绑定](display-final.json)：312点袖管驱动2,664点细节网格，参考、刚体运动、返回及保存重开均通过，最大误差约2.56e-7米。
- [当前实际可见头手网格](blender-production-pc2-body-inspection.json)：用正式工具重新读取32,110点的91帧缓存，坐标逐字节相同、索引相同，最大误差0。该对象只含头与手，**不是完整躯干或整个人物接触验证**。

这个微小输入偏移远小于现有厘米级肩窝折叠，不是肩部穿模根因。PC2输入正确，也不能保证布料求解或衣物已经正确。

## 未采用的肩部研究

基线运行代码为 `bf2b8de56fa718348156d9b896beb4b700e00fc3`，保留此前已修肘弯。实际完整外套/衬衫三项肩部回归仍失败：刺拳12帧外套146次自交、镜像直拳12帧衬衫96次自交、刺拳6帧18次层间交叉。自交包含双向计数。完整计数与示例分开，不能只数前四个示例。

[完整拒绝结果汇总](shoulder-rejected-summary.json) 包含16份诊断文件的数据及校验值：

- ARAP局部刚性保持在数值上收敛，但20/60迭代的整衣自交与层间交叉更重，拒绝。
- 从无自交、无层间交叉的真实当前初始衣物开始，使用精确PC2输入做新的Blender物理候选。刺拳12帧的衬衫仍有702次自交和225次可见皮肤交叉，因此停止其外套计算。衬衫91帧输出存在，外套只有部分输出；**没有完成整套或全部动作**。另有24帧人为入姿过渡，只是制作预热，不是正常游戏过程。
- 把源A姿态到低垂绑定的骨骼变换与当前动作先组合，再做四元数混合，5个采样的两层各自均无自交；刺拳/镜像直拳12帧层间仍108/130次。单层通过不能当作整套通过。
- 点平面投影的约束残差接近零，实际整面仍交叉；邻面包络、法线偏移也未通过，全部拒绝。
- 原始MakeHuman来源的11,605个衣物顶点和22,310个三角面成功重建，原始索引顺序相同、最大坐标差1.192e-7模型单位。直接反解成品和从源A姿态重建的衣片，回到低垂或出拳姿态后仍失败；平滑/贴体候选甚至在A姿态已出现自交。新肩部圆弧同样未通过，不进入运行源码。

人体参考的范围必须明确：`Anatomical_head_and_hands` 没有躯干，不能用于宣称全部人体碰撞通过；已有隐藏 `morpheus-dojo-skin` 虽含躯干，自身在静止参考中也有交叉，不能直接当作有效的重绑定基准。骨骼绑定空间一致，未发现“读取了过期boneMatrices”的问题：当前Three.js的CPU蒙皮读取真实骨骼世界矩阵。

下一步应先建立有效的完整人体和肩窝衣片参考，检查肩带/锁骨动作、权重及两层共同的体积变形；必须在初始姿态、完整连招/走跑/换装/暂停和可见内层范围通过，再进入原生游戏检查。不要继续将上述失败缓存换名使用，也不要删去失败衣面或放宽相交门槛来获得通过。

## 验证与采用范围

[运行与工作区核对](unchanged-runtime-verification.json)：5173仍加载 `index-DeK3mGvM.js`，702份运行文件和素材逐一与上一提交匹配；完整世界与上一轮快照相同，tick3757/暂停保持，后端进程未重启。11份预存未完成工作区文件按SHA256保护，没有提交或覆盖。制作工具、精度用例、文档与诊断记录是本轮唯一采用范围；不需要重新构建或发布客户端，也没有重新连接Render。

在仓库根目录运行三个正式Blender检查（固定Blender4.5.3LTS，均包含 `--python-exit-code 1`）：

```sh
output/tools/blender-4.5.3-arm64/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python-exit-code 1 --python tests/blender/cloth_cache_precision.py -- --output output/tests/cloth-cache-precision.json
output/tools/blender-4.5.3-arm64/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python-exit-code 1 --python tests/blender/cloth_collider_cache.py -- --output output/tests/cloth-collider-cache.json
output/tools/blender-4.5.3-arm64/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python-exit-code 1 --python tests/blender/cloth_display_binding.py -- --output output/tests/cloth-display-binding.json
```

这些离线检查不由 `npm test` 执行，不写游戏素材或存档。没有游戏运行修改，因此未重跑整套Node游戏测试或构建，也不宣称新的实机画面验收。人物相似度、衣物自然度、完整脱衣、剩余肩部接触与三部曲高质量场景继续未完成。
