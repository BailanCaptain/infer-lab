#!/usr/bin/env python3
"""Colab GPU Headless Blender Cycles (OPTIX/CUDA) exploded PLATE renderer from official Ascend .glb masters."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

BLENDER_SCRIPT = r"""
import bpy
import json
import math
import re
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 920
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

prefs = bpy.context.preferences.addons['cycles'].preferences
gpu_backend = 'CPU'
gpu_devices = []
for cand in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = cand
        prefs.get_devices()
        usable = [d for d in prefs.devices if d.type == cand]
        if usable:
            for d in prefs.devices:
                d.use = (d.type == cand)
            scene.cycles.device = 'GPU'
            gpu_backend = cand
            gpu_devices = [d.name for d in usable]
            break
    except Exception as e:
        print('Backend check failed:', cand, e)

def hide_tree(obj):
    obj.hide_render = True
    obj.hide_viewport = True
    for ch in obj.children_recursive:
        ch.hide_render = True
        ch.hide_viewport = True

CUTAWAY_EXPOSED_RE = re.compile(r'(?:npu[0123]|card[13])_(?:ihs|cooler)$', re.IGNORECASE)

def import_exploded_glb(path, offset_x, explode_scale):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    added = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in added if o.parent is None]
    container = bpy.data.objects.new(f"grp_{offset_x}", None)
    scene.collection.objects.link(container)
    for r in roots:
        r.parent = container
    container.location = Vector((offset_x, 0.0, 0.0))
    bpy.context.view_layer.update()

    for obj in added:
        kind = obj.get('kind')
        if kind in ('lid', 'cooling'):
            hide_tree(obj)
            continue
        if kind in ('ihs', 'cooler') and CUTAWAY_EXPOSED_RE.search(obj.name):
            hide_tree(obj)
            continue

    # Apply explode translation cleanly in Blender world space (+Z up, -Y front, +Y rear)
    part_nodes = [o for o in added if o.get('kind') and not o.hide_render]
    for obj in part_nodes:
        ez = float(obj.get('explodeZ', 0.0) or 0.0)
        ey = float(obj.get('explodeY', 0.0) or 0.0)
        if abs(ez) > 1e-4 or abs(ey) > 1e-4:
            mw = obj.matrix_world.copy()
            mw.translation += Vector((0.0, ey * explode_scale, ez * explode_scale))
            obj.matrix_world = mw
            bpy.context.view_layer.update()
    return container

import_exploded_glb('/content/atlas-800t-a2.glb', -5.65, 0.34)
import_exploded_glb('/content/atlas-800i-a3.glb', 0.0, 0.30)
import_exploded_glb('/content/atlas-800-3000.glb', 5.65, 0.38)
bpy.context.view_layer.update()

# Compute exact visible world bounding box to frame isometric orthographic camera cleanly
min_v = Vector((1e9, 1e9, 1e9))
max_v = Vector((-1e9, -1e9, -1e9))
for obj in scene.objects:
    if obj.type == 'MESH' and not obj.hide_render:
        for corner in obj.bound_box:
            wc = obj.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, wc.x)
            min_v.y = min(min_v.y, wc.y)
            min_v.z = min(min_v.z, wc.z)
            max_v.x = max(max_v.x, wc.x)
            max_v.y = max(max_v.y, wc.y)
            max_v.z = max(max_v.z, wc.z)

center = (min_v + max_v) * 0.5

def add_area_light(name, loc, rot_deg, energy, size, color):
    ldata = bpy.data.lights.new(name=name, type='AREA')
    ldata.energy = energy
    ldata.size = size
    ldata.color = color
    lobj = bpy.data.objects.new(name=name, object_data=ldata)
    scene.collection.objects.link(lobj)
    lobj.location = Vector(loc)
    lobj.rotation_euler = tuple(math.radians(a) for a in rot_deg)

add_area_light('KeyWarm', (center.x - 6.0, center.y - 11.0, center.z + 11.5), (46, 0, -22), 1850.0, 8.0, (1.0, 0.96, 0.90))
add_area_light('FillCool', (center.x + 8.5, center.y - 8.5, center.z + 8.0), (52, 0, 30), 920.0, 8.5, (0.90, 0.95, 1.0))
add_area_light('RimTop', (center.x, center.y + 8.0, center.z + 10.0), (-40, 0, 0), 720.0, 9.5, (1.0, 0.98, 0.94))

cam_data = bpy.data.cameras.new('IsoCam')
cam_data.type = 'ORTHO'
cam_obj = bpy.data.objects.new('IsoCam', cam_data)
scene.collection.objects.link(cam_obj)
cam_obj.location = center + Vector((-2.4, -14.0, 11.2))
direction = center - cam_obj.location
cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam_obj
bpy.context.view_layer.update()

# Project visible world corners into camera local space to guarantee 0% clipping
cam_inv = cam_obj.matrix_world.inverted()
max_cx = 1.0
max_cy = 1.0
for obj in scene.objects:
    if obj.type == 'MESH' and not obj.hide_render:
        for corner in obj.bound_box:
            lc = cam_inv @ (obj.matrix_world @ Vector(corner))
            max_cx = max(max_cx, abs(lc.x))
            max_cy = max(max_cy, abs(lc.y))

aspect = scene.render.resolution_x / scene.render.resolution_y
cam_data.ortho_scale = max(max_cx * 2.0, max_cy * 2.0 * aspect) * 1.06

scene.render.filepath = '/content/raw_plate.png'
bpy.ops.render.render(write_still=True)

with open('/content/blender_meta.json', 'w', encoding='utf-8') as f:
    json.dump({'backend': gpu_backend, 'devices': gpu_devices, 'blenderVersion': bpy.app.version_string, 'orthoScale': round(cam_data.ortho_scale, 3)}, f)
"""


def main() -> None:
    t0 = time.time()
    print("[plate] Installing headless blender & pillow...", file=sys.stderr, flush=True)
    subprocess.run(["apt-get", "update", "-qq"], check=True)
    subprocess.run(
        ["apt-get", "install", "-y", "-qq", "blender", "libegl1", "libgl1", "libgomp1"],
        check=True,
    )
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pillow"], check=True)

    Path("/content/run_blender_plate.py").write_text(BLENDER_SCRIPT, encoding="utf-8")
    print("[plate] Launching Blender Cycles GPU render...", file=sys.stderr, flush=True)
    subprocess.run(["blender", "--background", "--python", "/content/run_blender_plate.py"], check=True)

    from PIL import Image

    im = Image.open("/content/raw_plate.png").convert("RGBA")
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("Rendered PNG is completely transparent!")
    pad = 12
    crop_box = (
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(im.width, bbox[2] + pad),
        min(im.height, bbox[3] + pad),
    )
    cropped = im.crop(crop_box)
    if cropped.width > 1680:
        ratio = 1680.0 / cropped.width
        cropped = cropped.resize((1680, round(cropped.height * ratio)), Image.Resampling.LANCZOS)

    out_webp = "/content/atlas-slot-die-cutaway.webp"
    cropped.save(out_webp, "WEBP", quality=90, method=6)
    raw_bytes = Path(out_webp).read_bytes()
    meta = json.loads(Path("/content/blender_meta.json").read_text(encoding="utf-8"))
    meta.update(
        {
            "width": cropped.width,
            "height": cropped.height,
            "bytes": len(raw_bytes),
            "sha256": hashlib.sha256(raw_bytes).hexdigest(),
            "elapsedSec": round(time.time() - t0, 2),
        }
    )
    Path("/content/render_receipt.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(meta), flush=True)


if __name__ == "__main__":
    main()
