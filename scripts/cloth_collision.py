"""Key an imported vertex cache before Blender's Collision modifier.

Use a fresh collision mesh with the same vertex order in every sample. Direct
mesh writes in frame_change_pre can move the evaluated surface without moving
the collision response; native keyed deformation avoids that authoring failure.
"""


def keyframe_collider_vertices(body, frames):
    """Install ordered (scene frame, flat xyz coordinates) samples and return the Key."""
    basis = body.shape_key_add(name='Collider frame 1')
    keys = body.data.shape_keys
    keys.use_relative = False
    for index, (frame, coordinates) in enumerate(frames):
        block = basis if index == 0 else body.shape_key_add(name=f'Collider frame {frame}')
        block.data.foreach_set('co', coordinates)
        block.interpolation = 'KEY_LINEAR'
        keys.eval_time = block.frame
        keys.keyframe_insert(data_path='eval_time', frame=frame)
    return keys
