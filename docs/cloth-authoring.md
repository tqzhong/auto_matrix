# Blender 衣物碰撞制作

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
