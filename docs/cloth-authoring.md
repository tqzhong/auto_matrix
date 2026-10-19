# Blender 衣物制作

验证版本：Blender 4.5.3 LTS。这里只描述离线制作工具，不代表游戏中的衣物、完整脱衣或三部曲场景已验收。

动画碰撞网格使用 `scripts/cloth_collision.py` 的 `keyframe_collider_vertices`，在添加 Collision 修改器之前，把同一顶点顺序的逐帧坐标写为绝对形状关键帧。输入为新的碰撞对象及按时间排列的 `(scene_frame, flat_xyz)` 样本；坐标使用 Blender 的米制、Z 向上空间。该工具只依赖 Blender 自带的接口。

修复前的最小复现中，在 `frame_change_pre` 直接更新网格坐标，虽然读取的碰撞平面确实从 0 升至 1 米，零重力布片仍停在 0.5 米。正常位移关键帧能将布片托起。使用绝对形状关键帧后，同一碰撞测试也能托起布片；测试检查实际物理响应和逐帧输入位置，不能只检查网格外观。原失败证据保留在项目 `output/characters/morpheus-ambush-doff-2026-10-17/cloth-tail-grid/before-key-cache-*`。

在项目根目录运行：

```sh
output/tools/blender-4.5.3-arm64/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --threads 2 --python-exit-code 1 \
  --python tests/blender/cloth_collider_cache.py \
  -- --output output/tests/cloth-collider-cache.json
```

这是单独的 Blender 集成检查，不会被 `npm test` 执行。它不写游戏资源或存档。实际人物制作仍需对完整服装、全部人体与内层、重力、完整动作及实机逐段检查；这个工具修复不增加高质量场景完成数。

显示细节与模拟网格可以分开制作。`scripts/cloth_display.py` 的 `bind_display_to_cage(display, cage)` 在当前参考姿态建立 Surface Deform 绑定，让完整显示网格跟随已验证的模拟网格；调用时两者须在当前视图层、处于对象模式，函数会将显示对象设为活动并选中。模拟网格需先解决自交、开口及拓扑问题，绑定后保持目标拓扑和顶点顺序不变。绑定后再进行动画或添加模拟，完整显示网格仍须参加实际身体/衣物接触检查。

显示绑定的独立检查使用有细节起伏的完整袖管，检查参考形状、逐顶点刚体变形跟随、返回及保存 `.blend` 后重新打开：

```sh
output/tools/blender-4.5.3-arm64/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --threads 2 --python-exit-code 1 \
  --python tests/blender/cloth_display_binding.py \
  -- --output output/tests/cloth-display-binding.json
```

这项检查验证制作工具的绑定与恢复，不验证自然布料、完整人物动作、游戏读档或实机质量；同样不由 `npm test` 执行，不增加运行依赖。

高密度角色衣物在开始动作前还需要静止控制：冻结人体和约束、关闭重力，分别检查无碰撞及启用碰撞时的漂移。2026-10-19 的完整墨菲斯外套对照发现，每点质量约 0.000224 kg 时原弯曲阻尼 0.5 使无碰撞静止衣物漂移约 4.36 cm；仅改为 0.003 后降到约 0.00048 mm。该值仅在本输入中验证，不是通用皮革参数。

同时读取 Blender 实际接受的参数，不能只检查赋值脚本：4.5.3 将小于 0.001 的人体/自碰撞距离截到下限。当前高密度装饰折面间距小于该值，直接减小参数没有效果。放大制作尺度并对应处理约束、重力、刚度及输出坐标后，一秒静止控制通过，但 3.2 秒退袖动态仍有大量穿插，未作为游戏资产采用。具体失败对照、几何范围、转换误差和后续要求见[完整记录](../output/characters/morpheus-doff-2026-10-19/README.md)。实际动态网格和最终显示网格均必须继续检查。
