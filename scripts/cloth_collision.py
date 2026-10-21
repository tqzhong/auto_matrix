"""Import vertex samples before Blender's Collision modifier.

Use a fresh collision mesh with the same vertex order in every sample. Direct
mesh writes in frame_change_pre can move the evaluated surface without moving
the collision response; native keyed deformation or PC2 avoids that failure.
"""
from array import array
import math
from pathlib import Path
import struct
import sys


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


def cache_collider_vertices(body, frames, path):
    """Write consecutive integer-frame float32 samples to a fresh PC2 sidecar.

    Add this modifier before Collision. Keep the cache with the saved .blend;
    absolute shape-key times can round between samples in Blender 4.5.3.
    """
    samples = []
    first = None
    for frame, coordinates in frames:
        if not isinstance(frame, int) or first is not None and frame != first + len(samples):
            raise ValueError('Collider samples must use consecutive integer scene frames')
        if first is None:
            first = frame
        values = array('f', coordinates)
        if len(values) != len(body.data.vertices) * 3 or not all(math.isfinite(value) for value in values):
            raise ValueError('Collider sample must contain finite xyz coordinates for every vertex')
        if sys.byteorder != 'little':
            values.byteswap()
        samples.append(values.tobytes())
    if not samples:
        raise ValueError('Collider cache requires at least one sample')
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as file:
        file.write(struct.pack('<12siiffi', b'POINTCACHE2\0', 1, len(body.data.vertices), 0., 1., len(samples)))
        for sample in samples:
            file.write(sample)
    modifier = body.modifiers.new('Collider vertex cache', 'MESH_CACHE')
    modifier.cache_format = 'PC2'
    modifier.filepath = str(path)
    modifier.time_mode = 'FRAME'
    modifier.play_mode = 'CUSTOM'
    modifier.interpolation = 'LINEAR'
    modifier.forward_axis = 'POS_Y'
    modifier.up_axis = 'POS_Z'
    modifier.driver_add('eval_frame').driver.expression = f'frame - ({first})'
    return modifier
