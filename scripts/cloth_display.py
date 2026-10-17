"""Bind a detailed display mesh to its offline simulation cage in Blender."""
import bpy


def bind_display_to_cage(display, cage):
    """Bind the current reference pose; the cage must already be valid geometry."""
    modifier = display.modifiers.new('Cloth display cage', 'SURFACE_DEFORM')
    modifier.target = cage
    bpy.context.view_layer.objects.active = display
    display.select_set(True)
    result = bpy.ops.object.surfacedeform_bind(modifier=modifier.name)
    if result != {'FINISHED'} or not modifier.is_bound:
        raise RuntimeError(f'Cannot bind {display.name} to {cage.name}: {result}')
    return modifier
