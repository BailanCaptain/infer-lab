#!/usr/bin/env python3
"""Colab GPU Headless Blender 4.2 Cycles (OPTIX/CUDA + OIDN) exploded PLATE renderer from official Ascend .glb masters."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import uuid


BLENDER_SCRIPT = r"""
import bpy
import bmesh
import json
import math
import os
import re
import sys
import tempfile
from mathutils import Vector

RUN_ID = os.environ.get('PLATE_RUN_ID', '')
RUN_DIR = os.environ.get('PLATE_RUN_DIR', '/content')
if not RUN_ID:
    raise RuntimeError('PLATE_RUN_ID environment variable is required')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 4
scene.cycles.transparent_max_bounces = 8
scene.cycles.sample_clamp_indirect = 10.0

scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

prefs = bpy.context.preferences.addons['cycles'].preferences


def _configure_denoiser_for_backend(backend):
    order = ('OPENIMAGEDENOISE', 'OPTIX') if backend == 'OPTIX' else ('OPENIMAGEDENOISE',)
    scene.cycles.use_denoising = True
    for denoiser_cand in order:
        try:
            scene.cycles.denoiser = denoiser_cand
            input_passes = 'RGB_ALBEDO_NORMAL'
            try:
                scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
            except Exception as e:
                input_passes = 'DEFAULT'
                print('denoising_input_passes check failed:', e)
            try:
                scene.cycles.denoising_prefilter = 'ACCURATE'
            except Exception:
                pass
            return True, denoiser_cand, input_passes
        except Exception as e:
            print('Denoiser check failed:', denoiser_cand, e)
    scene.cycles.use_denoising = False
    return False, 'NONE', 'NONE'


def _reset_cycles_backend_state():
    scene.cycles.device = 'CPU'
    try:
        prefs.compute_device_type = 'NONE'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = False
    except Exception:
        pass
    scene.cycles.use_denoising = False


def _probe_render_once(probe_path):
    # Minimal camera + cube probe to verify Cycles backend and denoiser actually produce a non-empty PNG
    probe_mesh = bpy.data.meshes.new('_ProbeCubeMesh')
    bm_p = bmesh.new()
    bmesh.ops.create_cube(bm_p, size=0.5)
    bm_p.to_mesh(probe_mesh)
    bm_p.free()
    probe_obj = bpy.data.objects.new('_ProbeCube', probe_mesh)
    scene.collection.objects.link(probe_obj)

    cam_d = bpy.data.cameras.new('_ProbeCam')
    cam_o = bpy.data.objects.new('_ProbeCam', cam_d)
    scene.collection.objects.link(cam_o)
    cam_o.location = Vector((0.0, -3.0, 0.0))
    cam_o.rotation_euler = (Vector((0.0, 0.0, 0.0)) - cam_o.location).to_track_quat('-Z', 'Y').to_euler()
    prev_cam = scene.camera
    scene.camera = cam_o
    scene.render.resolution_x = 16
    scene.render.resolution_y = 16
    scene.cycles.samples = 1
    scene.cycles.use_adaptive_sampling = False
    scene.render.filepath = probe_path
    if os.path.exists(probe_path):
        try:
            os.remove(probe_path)
        except OSError:
            pass
    try:
        res = bpy.ops.render.render(write_still=True)
        if 'FINISHED' not in res:
            raise RuntimeError(f'Probe render did not finish cleanly: {res!r}')
        if not os.path.isfile(probe_path) or os.path.getsize(probe_path) <= 0:
            raise RuntimeError(f'Probe render produced no non-empty output file: {probe_path}')
    finally:
        scene.camera = prev_cam
        bpy.data.objects.remove(cam_o, do_unlink=True)
        bpy.data.cameras.remove(cam_d)
        bpy.data.objects.remove(probe_obj, do_unlink=True)
        bpy.data.meshes.remove(probe_mesh)
        if os.path.exists(probe_path):
            try:
                os.remove(probe_path)
            except OSError:
                pass


def _select_cycles_backend(cand):
    _reset_cycles_backend_state()
    if cand in ('OPTIX', 'CUDA'):
        prefs.compute_device_type = cand
        prefs.get_devices()
        usable = [d for d in prefs.devices if d.type == cand]
        if not usable:
            return None
        for d in prefs.devices:
            d.use = (d.type == cand)
        scene.cycles.device = 'GPU'
        return [d.name for d in usable]
    return ['CPU']


FORCE_BACKEND = os.environ.get('PLATE_FORCE_BACKEND', '').strip().upper()
if FORCE_BACKEND and FORCE_BACKEND not in ('OPTIX', 'CUDA', 'CPU'):
    raise RuntimeError(f'Unsupported PLATE_FORCE_BACKEND={FORCE_BACKEND!r}')
_BACKEND_SEQUENCE = (FORCE_BACKEND,) if FORCE_BACKEND else ('OPTIX', 'CUDA', 'CPU')

gpu_backend = 'CPU'
gpu_devices = []
active_denoiser = 'NONE'
active_input_passes = 'NONE'
use_denoising_actual = False
backend_probe_notes = []
probe_png = os.path.join(RUN_DIR, f'_probe_{RUN_ID}.png')

for cand in _BACKEND_SEQUENCE:
    try:
        cand_devices = _select_cycles_backend(cand)
        if cand_devices is None:
            backend_probe_notes.append(f'{cand}:no_devices')
            continue

        use_dn, dn_name, dn_passes = _configure_denoiser_for_backend(cand)
        try:
            _probe_render_once(probe_png)
        except Exception as probe_exc:
            if use_dn:
                backend_probe_notes.append(f'{cand}+{dn_name}:probe_failed({probe_exc})')
                scene.cycles.use_denoising = False
                dn_name = 'NONE'
                dn_passes = 'NONE'
                use_dn = False
                _probe_render_once(probe_png)
            else:
                raise

        gpu_backend = cand
        gpu_devices = cand_devices
        use_denoising_actual = use_dn
        active_denoiser = dn_name
        active_input_passes = dn_passes
        break
    except Exception as exc:
        backend_probe_notes.append(f'{cand}:failed({exc})')
        _reset_cycles_backend_state()
else:
    raise RuntimeError(
        f'All Cycles backends {_BACKEND_SEQUENCE} failed render probe: ' + '; '.join(backend_probe_notes)
    )

scene.cycles.samples = 512
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.005
scene.cycles.use_denoising = use_denoising_actual
scene.render.resolution_x = 1920
scene.render.resolution_y = 920

# Subtle ambient dome bounce while film_transparent keeps primary camera background alpha == 0
world = bpy.data.worlds.new('StudioWorld')
scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get('Background')
if bg_node is not None:
    bg_node.inputs['Color'].default_value = (0.95, 0.96, 0.99, 1.0)
    bg_node.inputs['Strength'].default_value = 0.18


def hide_tree(obj):
    obj.hide_render = True
    obj.hide_viewport = True
    for ch in obj.children_recursive:
        ch.hide_render = True
        ch.hide_viewport = True


def _hide_single_obj(obj):
    obj.hide_render = True
    obj.hide_viewport = True


def _write_bm_to_obj(obj, bm, mw_inv, is_mirrored=False, mw=None):
    # Preserve original material_index, sharp/smooth shading, and supplied corner normals on surviving faces
    bm.normal_update()
    if is_mirrored and len(bm.faces) > 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
        bm.normal_update()
    loop_vec_layers = getattr(getattr(bm.loops, 'layers', None), 'float_vector', None)
    cnorm_layer = loop_vec_layers.get('_plate_cnorm') if loop_vec_layers is not None else None
    custom_world_normals = []
    if cnorm_layer is not None:
        has_any_custom = False
        for f in bm.faces:
            for l in f.loops:
                nv = l[cnorm_layer]
                if nv.length > 0.1:
                    has_any_custom = True
                    custom_world_normals.append(nv.normalized())
                else:
                    custom_world_normals.append((-f.normal if is_mirrored else f.normal).copy())
        loop_vec_layers.remove(cnorm_layer)
        if not has_any_custom:
            custom_world_normals = []

    bmesh.ops.transform(bm, matrix=mw_inv, verts=bm.verts)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    if custom_world_normals and mw is not None and len(getattr(obj.data, 'loops', ())) == len(custom_world_normals):
        mw3_t = mw.to_3x3().transposed()
        local_normals = []
        for idx, nw in enumerate(custom_world_normals):
            nl = mw3_t @ nw
            if nl.length > 1e-8:
                local_normals.append(tuple(nl.normalized()))
            else:
                local_normals.append((0.0, 0.0, 1.0))
        try:
            if hasattr(obj.data, 'normals_split_custom_set'):
                obj.data.normals_split_custom_set(local_normals)
        except Exception as exc:
            print(f'[plate] Warning: could not restore custom corner normals on {obj.name}: {exc}', file=sys.stderr)
    if len(obj.data.polygons) == 0:
        _hide_single_obj(obj)


def _merge_bmesh_into(dst_bm, src_bm):
    if len(src_bm.faces) == 0:
        return
    tmp = bpy.data.meshes.new('_tmp_cut')
    try:
        src_bm.to_mesh(tmp)
        dst_bm.from_mesh(tmp)
    finally:
        bpy.data.meshes.remove(tmp)


def _infer_cap_material_index(bm_part, cut_edges):
    for e in cut_edges:
        for f in e.link_faces:
            return f.material_index
    for f in bm_part.faces:
        return f.material_index
    return 0


def _proj_2d(co, plane_axis):
    if plane_axis == 0:
        return (float(co.y), float(co.z))
    if plane_axis == 1:
        return (float(co.x), float(co.z))
    return (float(co.x), float(co.y))


def _point_in_poly_2d(pt, poly):
    px, py = pt
    inside = False
    n = len(poly)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-18) + xi):
            inside = not inside
        j = i
    return inside


def _extract_planar_loops_2d(cut_edges, plane_axis):
    adj = {}
    pts_by_k = {}
    for e in cut_edges:
        k0 = (round(e.verts[0].co.x, 5), round(e.verts[0].co.y, 5), round(e.verts[0].co.z, 5))
        k1 = (round(e.verts[1].co.x, 5), round(e.verts[1].co.y, 5), round(e.verts[1].co.z, 5))
        if k0 == k1:
            continue
        pts_by_k[k0] = _proj_2d(e.verts[0].co, plane_axis)
        pts_by_k[k1] = _proj_2d(e.verts[1].co, plane_axis)
        adj.setdefault(k0, []).append(k1)
        adj.setdefault(k1, []).append(k0)
    used_edges = set()
    loops = []
    for start in adj:
        for nxt in adj[start]:
            ek = (start, nxt) if start <= nxt else (nxt, start)
            if ek in used_edges:
                continue
            poly = [pts_by_k[start]]
            used_edges.add(ek)
            prev_k = start
            cur_k = nxt
            guard = 0
            while cur_k != start and guard < len(cut_edges) + 4:
                guard += 1
                poly.append(pts_by_k[cur_k])
                cand_next = None
                for nb in adj.get(cur_k, ()):
                    ek2 = (cur_k, nb) if cur_k <= nb else (nb, cur_k)
                    if ek2 not in used_edges:
                        cand_next = (nb, ek2)
                        break
                if cand_next is None:
                    break
                used_edges.add(cand_next[1])
                prev_k, cur_k = cur_k, cand_next[0]
            if cur_k == start and len(poly) >= 3:
                loops.append(poly)
    return loops


def _filter_cap_faces_by_parity(bm_part, created_faces, loops_2d, plane_axis):
    if not created_faces or len(loops_2d) <= 1:
        return created_faces
    bogus = []
    kept = []
    for f in created_faces:
        c2 = _proj_2d(f.calc_center_median(), plane_axis)
        depth = sum(1 for poly in loops_2d if _point_in_poly_2d(c2, poly))
        if depth % 2 == 0:
            bogus.append(f)
        else:
            kept.append(f)
    if bogus:
        bmesh.ops.delete(bm_part, geom=bogus, context='FACES')
    return kept


def _fill_planar_loops(bm_part, plane_axis, plane_val, flip_if_pos, obj_name='<mesh>'):
    cut_edges = [
        e for e in bm_part.edges
        if len(e.link_faces) == 1
        and abs(e.verts[0].co[plane_axis] - plane_val) < 2e-4
        and abs(e.verts[1].co[plane_axis] - plane_val) < 2e-4
    ]
    if not cut_edges:
        return []
    loops_2d = _extract_planar_loops_2d(cut_edges, plane_axis)
    cap_mat_idx = _infer_cap_material_index(bm_part, cut_edges)
    normal_vec = [0.0, 0.0, 0.0]
    normal_vec[plane_axis] = -1.0 if flip_if_pos else 1.0
    try:
        res = bmesh.ops.triangle_fill(
            bm_part,
            use_beauty=True,
            use_dissolve=False,
            edges=cut_edges,
            normal=Vector(normal_vec),
        )
        geom_items = res.get('geom') if res.get('geom') is not None else res.get('faces', [])
        created = [g for g in geom_items if hasattr(g, 'material_index') and hasattr(g, 'normal')]
        created = _filter_cap_faces_by_parity(bm_part, created, loops_2d, plane_axis)
        if not created:
            raise RuntimeError(f'triangle_fill produced 0 valid cap faces on {obj_name} axis={plane_axis} val={plane_val}')
        for f in created:
            f.smooth = False
            f.material_index = cap_mat_idx
            if (f.normal[plane_axis] > 0) == flip_if_pos:
                f.normal_flip()
        return created
    except Exception as exc:
        raise RuntimeError(f'Planar loop capping failed on {obj_name} axis={plane_axis} val={plane_val}: {exc}') from exc


def _build_spatial_vert_cids(bm, tol=1e-4, adaptive=False):
    verts = list(bm.verts)
    n = len(verts)
    if n == 0:
        return {}
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            if ra < rb:
                parent[rb] = ra
            else:
                parent[ra] = rb

    cell_sz = float(tol)
    v_tols = None
    if adaptive:
        v_min_sq = {}
        for e in bm.edges:
            ev0, ev1 = e.verts[0], e.verts[1]
            dx = float(ev0.co.x - ev1.co.x)
            dy = float(ev0.co.y - ev1.co.y)
            dz = float(ev0.co.z - ev1.co.z)
            sq = dx * dx + dy * dy + dz * dz
            if sq > 1e-16:
                p0 = v_min_sq.get(ev0)
                if p0 is None or sq < p0:
                    v_min_sq[ev0] = sq
                p1 = v_min_sq.get(ev1)
                if p1 is None or sq < p1:
                    v_min_sq[ev1] = sq
        co_tol = min(cell_sz, 1e-7)
        co_tol_sq = (co_tol + 1e-12) * (co_tol + 1e-12)
        co_cell = max(co_tol, 1e-7)
        co_parent = list(range(n))

        def _co_find(x):
            while co_parent[x] != x:
                co_parent[x] = co_parent[co_parent[x]]
                x = co_parent[x]
            return x

        co_grid = {}
        for idx, v in enumerate(verts):
            co = v.co
            cx = math.floor(float(co.x) / co_cell)
            cy = math.floor(float(co.y) / co_cell)
            cz = math.floor(float(co.z) / co_cell)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for dz in (-1, 0, 1):
                        for o_idx in co_grid.get((cx + dx, cy + dy, cz + dz), ()):
                            ov = verts[o_idx]
                            dvx = float(co.x - ov.co.x)
                            dvy = float(co.y - ov.co.y)
                            dvz = float(co.z - ov.co.z)
                            if (dvx * dvx + dvy * dvy + dvz * dvz) <= co_tol_sq:
                                ra, rb = _co_find(idx), _co_find(o_idx)
                                if ra != rb:
                                    if ra < rb:
                                        co_parent[rb] = ra
                                    else:
                                        co_parent[ra] = rb
            co_grid.setdefault((cx, cy, cz), []).append(idx)
        cluster_min_sq = {}
        for idx, v in enumerate(verts):
            sq = v_min_sq.get(v)
            if sq is not None:
                rt = _co_find(idx)
                prev_sq = cluster_min_sq.get(rt)
                if prev_sq is None or sq < prev_sq:
                    cluster_min_sq[rt] = sq
        v_tols = [
            min(cell_sz, max(1e-7, math.sqrt(cluster_min_sq[_co_find(idx)]) * 0.15))
            if _co_find(idx) in cluster_min_sq
            else cell_sz
            for idx in range(n)
        ]
    grid = {}
    tol_sq = (tol + 1e-12) * (tol + 1e-12)
    for idx, v in enumerate(verts):
        co = v.co
        cx = math.floor(float(co.x) / cell_sz)
        cy = math.floor(float(co.y) / cell_sz)
        cz = math.floor(float(co.z) / cell_sz)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for other_idx in grid.get((cx + dx, cy + dy, cz + dz), ()):
                        ov = verts[other_idx]
                        dvx = float(co.x - ov.co.x)
                        dvy = float(co.y - ov.co.y)
                        dvz = float(co.z - ov.co.z)
                        if v_tols is not None:
                            pt = v_tols[idx] if v_tols[idx] <= v_tols[other_idx] else v_tols[other_idx]
                            limit_sq = (pt + 1e-12) * (pt + 1e-12)
                        else:
                            limit_sq = tol_sq
                        if (dvx * dvx + dvy * dvy + dvz * dvz) <= limit_sq:
                            union(idx, other_idx)
        grid.setdefault((cx, cy, cz), []).append(idx)
    return {v: find(i) for i, v in enumerate(verts)}


def _cid_edge_key(v0, v1, vert_to_cid):
    c0 = vert_to_cid[v0]
    c1 = vert_to_cid[v1]
    if c0 == c1:
        return None
    return (c0, c1) if c0 <= c1 else (c1, c0)


def _copy_custom_layers_pair(src_group, dst_group):
    pairs = []
    if src_group is None or dst_group is None:
        return pairs
    for src_layer in list(src_group):
        dst_layer = dst_group.get(src_layer.name)
        if dst_layer is None:
            dst_layer = dst_group.new(src_layer.name)
        pairs.append((src_layer, dst_layer))
    return pairs


_LAYER_DOMAIN_SPECS = {
    'verts': ('color', 'float_color', 'int', 'float', 'string', 'float_vector', 'bool', 'crease', 'bevel_weight', 'skin', 'deform', 'shape'),
    'edges': ('color', 'float_color', 'int', 'float', 'string', 'float_vector', 'bool', 'crease', 'bevel_weight'),
    'faces': ('int', 'float', 'string', 'float_vector', 'bool', 'face_map', 'color', 'float_color'),
    'loops': ('uv', 'color', 'float_color', 'int', 'float', 'string', 'float_vector', 'bool'),
}


def _collect_all_layer_pairs(src_layers, dst_layers, domain):
    all_pairs = []
    if src_layers is None or dst_layers is None:
        return all_pairs
    for gname in _LAYER_DOMAIN_SPECS[domain]:
        sg = getattr(src_layers, gname, None)
        if not sg:
            continue
        dg = getattr(dst_layers, gname, None)
        for sl, dl in _copy_custom_layers_pair(sg, dg):
            all_pairs.append((gname, sl, dl))
    return all_pairs


def _copy_layer_entry(dst_elem, dst_l, src_elem, src_l, gname):
    val = src_elem[src_l]
    if gname == 'uv':
        dst_uv = dst_elem[dst_l]
        dst_uv.uv = val.uv.copy()
        for uv_flag in ('pin_uv', 'select', 'select_edge'):
            if hasattr(val, uv_flag) and hasattr(dst_uv, uv_flag):
                setattr(dst_uv, uv_flag, getattr(val, uv_flag))
    elif gname == 'deform':
        d = dst_elem[dst_l]
        for k, w in val.items():
            d[k] = w
    else:
        dst_elem[dst_l] = val.copy() if hasattr(val, 'copy') else val


def _adaptive_spatial_tol(bm, max_tol=1e-4):
    min_edge = None
    for e in bm.edges:
        v0, v1 = e.verts[0].co, e.verts[1].co
        dx = float(v0.x - v1.x)
        dy = float(v0.y - v1.y)
        dz = float(v0.z - v1.z)
        sq = dx * dx + dy * dy + dz * dz
        if sq > 1e-16:
            d = math.sqrt(sq)
            if min_edge is None or d < min_edge:
                min_edge = d
    if min_edge is None:
        return float(max_tol)
    return min(float(max_tol), max(1e-7, min_edge * 0.15))


def _mark_sharp_seams_before_weld(bm_isl, tol=1e-4):
    isl_cids = _build_spatial_vert_cids(bm_isl, tol=tol)
    boundary_by_ek = {}
    for e in bm_isl.edges:
        if len(e.link_faces) == 1:
            ek = _cid_edge_key(e.verts[0], e.verts[1], isl_cids)
            if ek is not None:
                boundary_by_ek.setdefault(ek, []).append(e)
    for es in boundary_by_ek.values():
        if len(es) == 2:
            e0, e1 = es[0], es[1]
            f0, f1 = e0.link_faces[0], e1.link_faces[0]
            if not e0.smooth or not e1.smooth or float(f0.normal.dot(f1.normal)) < 0.985:
                e0.smooth = False
                e1.smooth = False
            if e0.seam or e1.seam:
                e0.seam = True
                e1.seam = True


def _split_connected_islands(bm):
    '''Partition BMesh cleanly, preserving topologically closed shells before 2-way spatial seam stitching.'''
    vert_to_cid = _build_spatial_vert_cids(bm, tol=1e-4, adaptive=True)
    visited = set()
    topo_comps = []
    for start_f in bm.faces:
        if start_f in visited:
            continue
        comp_faces = []
        stack = [start_f]
        visited.add(start_f)
        while stack:
            cur = stack.pop()
            comp_faces.append(cur)
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf not in visited:
                        visited.add(nf)
                        stack.append(nf)
        comp_edges = {e for f in comp_faces for e in f.edges}
        topo_closed = len(comp_edges) > 0 and all(len(e.link_faces) == 2 for e in comp_edges)
        topo_comps.append((comp_faces, topo_closed))

    raw_groups = []
    rem_faces = []
    for comp_faces, topo_closed in topo_comps:
        if topo_closed:
            raw_groups.append(comp_faces)
        else:
            rem_faces.extend(comp_faces)

    if rem_faces:
        rem_set = set(rem_faces)
        spatial_edge_faces_rem = {}
        for f in rem_faces:
            for e in f.edges:
                if len(e.link_faces) == 1:
                    ek = _cid_edge_key(e.verts[0], e.verts[1], vert_to_cid)
                    if ek is not None:
                        spatial_edge_faces_rem.setdefault(ek, []).append(f)
        vis_rem = set()
        for start_f in rem_faces:
            if start_f in vis_rem:
                continue
            comp_faces = []
            stack = [start_f]
            vis_rem.add(start_f)
            while stack:
                cur = stack.pop()
                comp_faces.append(cur)
                for e in cur.edges:
                    for nf in e.link_faces:
                        if nf in rem_set and nf not in vis_rem:
                            vis_rem.add(nf)
                            stack.append(nf)
                    if len(e.link_faces) == 1:
                        ek = _cid_edge_key(e.verts[0], e.verts[1], vert_to_cid)
                        if ek is not None and len(spatial_edge_faces_rem.get(ek, ())) == 2:
                            for nf in spatial_edge_faces_rem[ek]:
                                if nf not in vis_rem:
                                    vis_rem.add(nf)
                                    stack.append(nf)
            raw_groups.append(comp_faces)

    islands = []
    bm_vert_layers = getattr(bm.verts, 'layers', None)
    bm_edge_layers = getattr(bm.edges, 'layers', None)
    bm_face_layers = getattr(bm.faces, 'layers', None)
    bm_loop_layers = getattr(bm.loops, 'layers', None)

    for comp_faces in raw_groups:

        bm_isl = bmesh.new()
        vert_pairs = _collect_all_layer_pairs(bm_vert_layers, getattr(bm_isl.verts, 'layers', None), 'verts')
        edge_pairs = _collect_all_layer_pairs(bm_edge_layers, getattr(bm_isl.edges, 'layers', None), 'edges')
        face_pairs = _collect_all_layer_pairs(bm_face_layers, getattr(bm_isl.faces, 'layers', None), 'faces')
        loop_pairs = _collect_all_layer_pairs(bm_loop_layers, getattr(bm_isl.loops, 'layers', None), 'loops')

        vmap = {}
        copied_edges = set()
        spatial_edge_counts = {}
        for f in comp_faces:
            new_vs = []
            for v in f.verts:
                nv = vmap.get(v)
                if nv is None:
                    nv = bm_isl.verts.new(v.co)
                    vmap[v] = nv
                    for gname, sl, dl in vert_pairs:
                        _copy_layer_entry(nv, dl, v, sl, gname)
                new_vs.append(nv)
            nf = bm_isl.faces.new(new_vs)
            nf.material_index = f.material_index
            nf.smooth = f.smooth
            for gname, sl, dl in face_pairs:
                _copy_layer_entry(nf, dl, f, sl, gname)
            for gname, sl, dl in loop_pairs:
                for ls, ld in zip(f.loops, nf.loops):
                    _copy_layer_entry(ld, dl, ls, sl, gname)
            n_fv = len(f.verts)
            for i in range(n_fv):
                sv0 = f.verts[i]
                sv1 = f.verts[(i + 1) % n_fv]
                orig_e = bm.edges.get((sv0, sv1))
                new_e = bm_isl.edges.get((vmap[sv0], vmap[sv1]))
                if orig_e is not None and new_e is not None and new_e not in copied_edges:
                    copied_edges.add(new_e)
                    new_e.smooth = orig_e.smooth
                    new_e.seam = orig_e.seam
                    for gname, sl, dl in edge_pairs:
                        _copy_layer_entry(new_e, dl, orig_e, sl, gname)
                ek = _cid_edge_key(sv0, sv1, vert_to_cid)
                if ek is not None:
                    spatial_edge_counts[ek] = spatial_edge_counts.get(ek, 0) + 1

        topo_closed_isl = len(bm_isl.edges) > 0 and all(len(e.link_faces) == 2 for e in bm_isl.edges)
        if topo_closed_isl:
            is_closed = True
        else:
            is_closed = len(spatial_edge_counts) > 0 and all(cnt == 2 for cnt in spatial_edge_counts.values())
            if is_closed:
                if any(len(e.link_faces) != 2 for e in bm_isl.edges):
                    isl_tol = _adaptive_spatial_tol(bm_isl, max_tol=1e-4)
                    _mark_sharp_seams_before_weld(bm_isl, tol=isl_tol)
                    bmesh.ops.remove_doubles(bm_isl, verts=list(bm_isl.verts), dist=isl_tol)
                is_closed = len(bm_isl.edges) > 0 and all(len(e.link_faces) == 2 for e in bm_isl.edges)
        for seq_obj in (bm_isl.verts, bm_isl.edges, bm_isl.faces):
            elt_fn = getattr(seq_obj, 'ensure_lookup_table', None)
            if callable(elt_fn):
                elt_fn()
        islands.append((bm_isl, is_closed))
    return islands


def _cleanup_orphans(bm):
    unused_edges = [e for e in bm.edges if len(e.link_faces) == 0]
    if unused_edges:
        bmesh.ops.delete(bm, geom=unused_edges, context='EDGES')
    unused_verts = [v for v in bm.verts if len(v.link_edges) == 0]
    if unused_verts:
        bmesh.ops.delete(bm, geom=unused_verts, context='VERTS')


def _weld_step_crease_tjunctions(bm, y_cut, z_cut, tol=2e-4):
    '''Split every boundary edge along (Y=y_cut, Z=z_cut) at all interior crease vertices in sorted X order.'''
    crease_verts = [
        v for v in bm.verts
        if abs(v.co.y - y_cut) < tol and abs(v.co.z - z_cut) < tol
    ]
    if len(crease_verts) < 2:
        return
    # Collect static snapshot of boundary crease edge endpoints before splitting
    target_edges = []
    for e in list(bm.edges):
        if len(e.link_faces) != 1:
            continue
        v0, v1 = e.verts[0], e.verts[1]
        if (
            abs(v0.co.y - y_cut) < tol and abs(v0.co.z - z_cut) < tol
            and abs(v1.co.y - y_cut) < tol and abs(v1.co.z - z_cut) < tol
        ):
            target_edges.append((e, v0, v1))

    for e, v0, v1 in target_edges:
        if not e.is_valid or not v0.is_valid or not v1.is_valid:
            continue
        lo_x = min(v0.co.x, v1.co.x)
        hi_x = max(v0.co.x, v1.co.x)
        if hi_x - lo_x < 1e-5:
            continue
        dir_x = v1.co.x - v0.co.x
        inner = sorted(
            [v for v in crease_verts if v.is_valid and lo_x + 1e-5 < v.co.x < hi_x - 1e-5],
            key=lambda v: abs(v.co.x - v0.co.x),
        )
        if not inner:
            continue
        cur_e = e
        cur_v0 = v0
        for tv in inner:
            if not cur_e.is_valid or not cur_v0.is_valid or not tv.is_valid:
                break
            other = cur_e.other_vert(cur_v0)
            if other is None or not other.is_valid:
                break
            rem_dx = other.co.x - cur_v0.co.x
            if abs(rem_dx) < 1e-5 or (rem_dx * dir_x) < 0:
                break
            fac = (tv.co.x - cur_v0.co.x) / rem_dx
            if 1e-5 < fac < 1.0 - 1e-5:
                ne, nv = bmesh.utils.edge_split(cur_e, cur_v0, fac)
                # Continue splitting whichever segment connects the new vertex to `other`
                cur_v0 = nv
                if other not in cur_e.verts and ne is not None and other in ne.verts:
                    cur_e = ne


def _drop_exposed_coplanar_cut_faces(bm, axis, coord, drop_pos_normal, tol=1e-5):
    '''Remove coplanar solid/cavity faces whose solid side was sliced away, exposing inner loop edges for capping.'''
    bm.normal_update()
    drop = []
    for f in bm.faces:
        if all(abs(v.co[axis] - coord) <= tol for v in f.verts):
            ncomp = f.normal[axis]
            if (ncomp > 0.5) if drop_pos_normal else (ncomp < -0.5):
                drop.append(f)
    if drop:
        bmesh.ops.delete(bm, geom=drop, context='FACES')
        _cleanup_orphans(bm)


def _cut_island_stepped(bm_isl, is_closed, y_cut, z_cut, obj_name='<mesh>'):
    if len(bm_isl.faces) == 0:
        return bm_isl, False
    ys = [v.co.y for v in bm_isl.verts]
    zs = [v.co.z for v in bm_isl.verts]
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)
    if min_y >= y_cut - 1e-5 or max_z <= z_cut + 1e-5:
        return bm_isl, False
    if max_y <= y_cut + 1e-5 and min_z >= z_cut - 1e-5:
        bm_isl.free()
        return bmesh.new(), True
    if max_y <= y_cut + 1e-5:
        bmesh.ops.bisect_plane(
            bm_isl,
            geom=list(bm_isl.verts) + list(bm_isl.edges) + list(bm_isl.faces),
            dist=1e-5,
            plane_co=Vector((0.0, 0.0, z_cut)),
            plane_no=Vector((0.0, 0.0, 1.0)),
            use_snap_center=False,
            clear_inner=False,
            clear_outer=True,
        )
        _cleanup_orphans(bm_isl)
        if is_closed and len(bm_isl.faces) > 0:
            _drop_exposed_coplanar_cut_faces(bm_isl, 2, z_cut, False)
            if len(bm_isl.faces) > 0:
                _fill_planar_loops(bm_isl, 2, z_cut, False, obj_name=obj_name)
        bmesh.ops.remove_doubles(bm_isl, verts=bm_isl.verts, dist=1e-5)
        if is_closed and len(bm_isl.faces) > 0:
            bad_edges = [e for e in bm_isl.edges if len(e.link_faces) != 2]
            if bad_edges:
                raise RuntimeError(
                    f'Non-manifold or open cut seam on Z-plane boundary island of {obj_name}: {len(bad_edges)} bad edges'
                )
        return bm_isl, True
    if min_z >= z_cut - 1e-5:
        bmesh.ops.bisect_plane(
            bm_isl,
            geom=list(bm_isl.verts) + list(bm_isl.edges) + list(bm_isl.faces),
            dist=1e-5,
            plane_co=Vector((0.0, y_cut, 0.0)),
            plane_no=Vector((0.0, 1.0, 0.0)),
            use_snap_center=False,
            clear_inner=True,
            clear_outer=False,
        )
        _cleanup_orphans(bm_isl)
        if is_closed and len(bm_isl.faces) > 0:
            _drop_exposed_coplanar_cut_faces(bm_isl, 1, y_cut, True)
            if len(bm_isl.faces) > 0:
                _fill_planar_loops(bm_isl, 1, y_cut, True, obj_name=obj_name)
        bmesh.ops.remove_doubles(bm_isl, verts=bm_isl.verts, dist=1e-5)
        if is_closed and len(bm_isl.faces) > 0:
            bad_edges = [e for e in bm_isl.edges if len(e.link_faces) != 2]
            if bad_edges:
                raise RuntimeError(
                    f'Non-manifold or open cut seam on Y-plane boundary island of {obj_name}: {len(bad_edges)} bad edges'
                )
        return bm_isl, True

    bm_y = None
    bm_z = None
    if is_closed:
        bm_y = bm_isl.copy()
        bmesh.ops.bisect_plane(
            bm_y,
            geom=list(bm_y.verts) + list(bm_y.edges) + list(bm_y.faces),
            dist=1e-5,
            plane_co=Vector((0.0, y_cut, 0.0)),
            plane_no=Vector((0.0, 1.0, 0.0)),
            use_snap_center=False,
            clear_inner=True,
            clear_outer=False,
        )
        _drop_exposed_coplanar_cut_faces(bm_y, 1, y_cut, True)
        old_y = set(bm_y.faces)
        _fill_planar_loops(bm_y, 1, y_cut, True, obj_name=obj_name)
        if old_y:
            bmesh.ops.delete(bm_y, geom=list(old_y), context='FACES')
            _cleanup_orphans(bm_y)
        if len(bm_y.faces) > 0:
            bmesh.ops.bisect_plane(
                bm_y,
                geom=list(bm_y.verts) + list(bm_y.edges) + list(bm_y.faces),
                dist=1e-5,
                plane_co=Vector((0.0, 0.0, z_cut)),
                plane_no=Vector((0.0, 0.0, 1.0)),
                use_snap_center=False,
                clear_inner=True,
                clear_outer=False,
            )

        bm_z = bm_isl.copy()
        bmesh.ops.bisect_plane(
            bm_z,
            geom=list(bm_z.verts) + list(bm_z.edges) + list(bm_z.faces),
            dist=1e-5,
            plane_co=Vector((0.0, 0.0, z_cut)),
            plane_no=Vector((0.0, 0.0, 1.0)),
            use_snap_center=False,
            clear_inner=False,
            clear_outer=True,
        )
        _drop_exposed_coplanar_cut_faces(bm_z, 2, z_cut, False)
        old_z = set(bm_z.faces)
        _fill_planar_loops(bm_z, 2, z_cut, False, obj_name=obj_name)
        if old_z:
            bmesh.ops.delete(bm_z, geom=list(old_z), context='FACES')
            _cleanup_orphans(bm_z)
        if len(bm_z.faces) > 0:
            bmesh.ops.bisect_plane(
                bm_z,
                geom=list(bm_z.verts) + list(bm_z.edges) + list(bm_z.faces),
                dist=1e-5,
                plane_co=Vector((0.0, y_cut, 0.0)),
                plane_no=Vector((0.0, 1.0, 0.0)),
                use_snap_center=False,
                clear_inner=False,
                clear_outer=True,
            )

    # Slice surviving shell along both planes and discard only the removed quadrant (Y < y_cut and Z > z_cut)
    bmesh.ops.bisect_plane(
        bm_isl,
        geom=list(bm_isl.verts) + list(bm_isl.edges) + list(bm_isl.faces),
        dist=1e-5,
        plane_co=Vector((0.0, y_cut, 0.0)),
        plane_no=Vector((0.0, 1.0, 0.0)),
        use_snap_center=False,
        clear_inner=False,
        clear_outer=False,
    )
    bmesh.ops.bisect_plane(
        bm_isl,
        geom=list(bm_isl.verts) + list(bm_isl.edges) + list(bm_isl.faces),
        dist=1e-5,
        plane_co=Vector((0.0, 0.0, z_cut)),
        plane_no=Vector((0.0, 0.0, 1.0)),
        use_snap_center=False,
        clear_inner=False,
        clear_outer=False,
    )
    bm_isl.normal_update()
    drop_faces = []
    for f in bm_isl.faces:
        c = f.calc_center_median()
        if c.y < y_cut and c.z > z_cut:
            drop_faces.append(f)
        elif is_closed and all(abs(v.co.z - z_cut) <= 1e-5 for v in f.verts) and f.normal.z < -0.5 and c.y < y_cut - 1e-5:
            drop_faces.append(f)
        elif is_closed and all(abs(v.co.y - y_cut) <= 1e-5 for v in f.verts) and f.normal.y > 0.5 and c.z > z_cut + 1e-5:
            drop_faces.append(f)
    modified = bool(drop_faces) or (bm_y is not None and len(bm_y.faces) > 0) or (bm_z is not None and len(bm_z.faces) > 0)
    if drop_faces:
        bmesh.ops.delete(bm_isl, geom=drop_faces, context='FACES')
        _cleanup_orphans(bm_isl)

    bm_out = bmesh.new()
    _merge_bmesh_into(bm_out, bm_isl)
    bm_isl.free()
    if bm_y is not None:
        _merge_bmesh_into(bm_out, bm_y)
        bm_y.free()
    if bm_z is not None:
        _merge_bmesh_into(bm_out, bm_z)
        bm_z.free()
    _weld_step_crease_tjunctions(bm_out, y_cut, z_cut)
    bmesh.ops.remove_doubles(bm_out, verts=bm_out.verts, dist=1e-5)
    if is_closed and len(bm_out.faces) > 0:
        bad_edges = [e for e in bm_out.edges if len(e.link_faces) != 2]
        if bad_edges:
            raise RuntimeError(
                f'Non-manifold or open cut seam on closed island of {obj_name}: {len(bad_edges)} bad edges'
            )
    return bm_out, modified


def _capture_mesh_custom_normals_world(obj, bm, mw_inv):
    mesh = obj.data
    has_cn = bool(getattr(mesh, 'has_custom_normals', False))
    cnormals = getattr(mesh, 'corner_normals', None)
    loops = getattr(mesh, 'loops', None)
    if not has_cn or cnormals is None or loops is None or len(cnormals) != len(loops) or len(cnormals) == 0:
        return
    loop_vec_layers = getattr(getattr(bm.loops, 'layers', None), 'float_vector', None)
    if loop_vec_layers is None:
        return
    cnorm_layer = loop_vec_layers.get('_plate_cnorm') or loop_vec_layers.new('_plate_cnorm')
    normal_mat = mw_inv.to_3x3().transposed()
    for poly, bmf in zip(mesh.polygons, bm.faces):
        for l_idx, bml in zip(poly.loop_indices, bmf.loops):
            nv = normal_mat @ Vector(cnormals[l_idx].vector)
            if nv.length > 1e-8:
                nv.normalize()
            bml[cnorm_layer] = nv
    for e in bm.edges:
        if len(e.link_faces) == 2:
            f0, f1 = e.link_faces[0], e.link_faces[1]
            v_ref = e.verts[0]
            l0 = next((l for l in f0.loops if l.vert == v_ref), None)
            l1 = next((l for l in f1.loops if l.vert == v_ref), None)
            if l0 is not None and l1 is not None:
                if float(l0[cnorm_layer].dot(l1[cnorm_layer])) < 0.995:
                    e.smooth = False


def _bm_signed_volume_and_bbox(bm_isl):
    vol6 = 0.0
    min_v = [1e18, 1e18, 1e18]
    max_v = [-1e18, -1e18, -1e18]
    for v in bm_isl.verts:
        co = v.co
        if co.x < min_v[0]:
            min_v[0] = float(co.x)
        if co.y < min_v[1]:
            min_v[1] = float(co.y)
        if co.z < min_v[2]:
            min_v[2] = float(co.z)
        if co.x > max_v[0]:
            max_v[0] = float(co.x)
        if co.y > max_v[1]:
            max_v[1] = float(co.y)
        if co.z > max_v[2]:
            max_v[2] = float(co.z)
    for f in bm_isl.faces:
        vs = [v.co for v in f.verts]
        if len(vs) < 3:
            continue
        v0 = vs[0]
        for idx in range(1, len(vs) - 1):
            vol6 += float(v0.dot(vs[idx].cross(vs[idx + 1])))
    return vol6 / 6.0, (min_v, max_v)


def _point_in_closed_bm_3d(pt, bm_outer, bbox_outer):
    min_b, max_b = bbox_outer
    if (
        pt.x < min_b[0] - 1e-5 or pt.x > max_b[0] + 1e-5
        or pt.y < min_b[1] - 1e-5 or pt.y > max_b[1] + 1e-5
        or pt.z < min_b[2] - 1e-5 or pt.z > max_b[2] + 1e-5
    ):
        return False
    # Exact 3D solid-angle generalized winding number avoids ray-diagonal degeneracy completely
    total_omega = 0.0
    for f in bm_outer.faces:
        vs = [v.co for v in f.verts]
        if len(vs) < 3:
            continue
        va = vs[0] - pt
        la = float(va.length)
        if la < 1e-12:
            continue
        for idx in range(1, len(vs) - 1):
            vb = vs[idx] - pt
            vc = vs[idx + 1] - pt
            lb = float(vb.length)
            lc = float(vc.length)
            if lb < 1e-12 or lc < 1e-12:
                continue
            num = float(va.dot(vb.cross(vc)))
            den = (
                la * lb * lc
                + float(va.dot(vb)) * lc
                + float(vb.dot(vc)) * la
                + float(vc.dot(va)) * lb
            )
            total_omega += 2.0 * math.atan2(num, den)
    return abs(total_omega) > (2.0 * math.pi)


def _group_closed_islands_with_cavities(closed_bms):
    if not closed_bms:
        return []
    if len(closed_bms) == 1:
        return [closed_bms[0]]
    pos_groups = []
    neg_items = []
    for idx, bm_isl in enumerate(closed_bms):
        for seq_obj in (bm_isl.verts, bm_isl.edges, bm_isl.faces):
            elt_fn = getattr(seq_obj, 'ensure_lookup_table', None)
            if callable(elt_fn):
                elt_fn()
        vol, bbox = _bm_signed_volume_and_bbox(bm_isl)
        if vol >= -1e-12:
            pos_groups.append({'idx': idx, 'vol': abs(vol), 'bbox': bbox, 'outer': bm_isl, 'members': [bm_isl]})
        else:
            first_f = next(iter(bm_isl.faces), None)
            if first_f is not None:
                sample_pt = first_f.calc_center_median()
            else:
                first_v = next(iter(bm_isl.verts), None)
                sample_pt = first_v.co if first_v is not None else Vector((0.0, 0.0, 0.0))
            neg_items.append((abs(vol), sample_pt, bm_isl))

    orphan_groups = []
    for _cvol, sample_pt, bm_cav in neg_items:
        containers = [
            g for g in pos_groups
            if _point_in_closed_bm_3d(sample_pt, g['outer'], g['bbox'])
        ]
        if containers:
            containers.sort(key=lambda g: g['vol'])
            containers[0]['members'].append(bm_cav)
        else:
            orphan_groups.append(bm_cav)

    grouped_bms = []
    for g in pos_groups:
        members = g['members']
        if len(members) == 1:
            grouped_bms.append(members[0])
        else:
            bm_grp = bmesh.new()
            for m in members:
                _merge_bmesh_into(bm_grp, m)
                m.free()
            grouped_bms.append(bm_grp)
    grouped_bms.extend(orphan_groups)
    return grouped_bms


def cut_mesh_stepped(obj, y_cut, z_cut):
    '''Slices away world-space region (Y < y_cut and Z > z_cut) per-island with manifold capped seams.'''
    if obj.type != 'MESH' or obj.hide_render or len(obj.data.vertices) == 0:
        return False
    mw = obj.matrix_world.copy()
    det = mw.determinant()
    if abs(det) < 1e-12:
        print(f'[plate] Warning: skipping cut_mesh_stepped on singular transform {obj.name}', file=sys.stderr)
        return False
    is_mirrored = det < 0.0
    pts = [mw @ Vector(c) for c in obj.bound_box]
    if min(p.y for p in pts) >= y_cut or max(p.z for p in pts) <= z_cut:
        return False

    obj.data = obj.data.copy()
    mw_inv = mw.inverted()

    bm_base = bmesh.new()
    bm_base.from_mesh(obj.data)
    _capture_mesh_custom_normals_world(obj, bm_base, mw_inv)
    bmesh.ops.transform(bm_base, matrix=mw, verts=bm_base.verts)
    if is_mirrored and len(bm_base.faces) > 0:
        bmesh.ops.reverse_faces(bm_base, faces=list(bm_base.faces))
    bm_base.normal_update()
    bm_base.faces.index_update()

    islands = _split_connected_islands(bm_base)
    bm_base.free()

    closed_bms = _group_closed_islands_with_cavities([bm_isl for bm_isl, ic in islands if ic])
    open_bms = [bm_isl for bm_isl, ic in islands if not ic]

    bm_merged = bmesh.new()
    any_modified = False
    for bm_isl in closed_bms:
        bm_cut, mod = _cut_island_stepped(bm_isl, True, y_cut, z_cut, obj_name=obj.name)
        any_modified = any_modified or mod
        _merge_bmesh_into(bm_merged, bm_cut)
        bm_cut.free()
    for bm_isl in open_bms:
        bm_cut, mod = _cut_island_stepped(bm_isl, False, y_cut, z_cut, obj_name=obj.name)
        any_modified = any_modified or mod
        _merge_bmesh_into(bm_merged, bm_cut)
        bm_cut.free()
    if not any_modified:
        bm_merged.free()
        return False
    _write_bm_to_obj(obj, bm_merged, mw_inv, is_mirrored=is_mirrored, mw=mw)
    return True


def cut_mesh_z_cap(obj, z_cut):
    '''Slices away world-space geometry above z_cut per-island with clean flat-capped top.'''
    if obj.type != 'MESH' or obj.hide_render or len(obj.data.vertices) == 0:
        return False
    mw = obj.matrix_world.copy()
    det = mw.determinant()
    if abs(det) < 1e-12:
        print(f'[plate] Warning: skipping cut_mesh_z_cap on singular transform {obj.name}', file=sys.stderr)
        return False
    is_mirrored = det < 0.0
    pts = [mw @ Vector(c) for c in obj.bound_box]
    if max(p.z for p in pts) <= z_cut:
        return False

    obj.data = obj.data.copy()
    mw_inv = mw.inverted()
    bm_base = bmesh.new()
    bm_base.from_mesh(obj.data)
    _capture_mesh_custom_normals_world(obj, bm_base, mw_inv)
    bmesh.ops.transform(bm_base, matrix=mw, verts=bm_base.verts)
    if is_mirrored and len(bm_base.faces) > 0:
        bmesh.ops.reverse_faces(bm_base, faces=list(bm_base.faces))
    bm_base.normal_update()
    bm_base.faces.index_update()

    islands = _split_connected_islands(bm_base)
    bm_base.free()

    closed_bms = _group_closed_islands_with_cavities([bm_isl for bm_isl, ic in islands if ic])
    open_bms = [bm_isl for bm_isl, ic in islands if not ic]
    work_groups = [(bm_isl, True) for bm_isl in closed_bms] + [(bm_isl, False) for bm_isl in open_bms]

    bm_merged = bmesh.new()
    any_modified = False
    for bm_isl, is_closed in work_groups:
        if len(bm_isl.faces) > 0:
            max_isl_z = max(v.co.z for v in bm_isl.verts)
            if max_isl_z > z_cut + 1e-5:
                any_modified = True
                bmesh.ops.bisect_plane(
                    bm_isl,
                    geom=list(bm_isl.verts) + list(bm_isl.edges) + list(bm_isl.faces),
                    dist=1e-5,
                    plane_co=Vector((0.0, 0.0, z_cut)),
                    plane_no=Vector((0.0, 0.0, 1.0)),
                    use_snap_center=False,
                    clear_inner=False,
                    clear_outer=True,
                )
                _cleanup_orphans(bm_isl)
                if is_closed and len(bm_isl.faces) > 0:
                    _drop_exposed_coplanar_cut_faces(bm_isl, 2, z_cut, False)
                    if len(bm_isl.faces) > 0:
                        _fill_planar_loops(bm_isl, 2, z_cut, False, obj_name=obj.name)
                    weld_tol = _adaptive_spatial_tol(bm_isl, max_tol=1e-5)
                    bmesh.ops.remove_doubles(bm_isl, verts=bm_isl.verts, dist=weld_tol)
                    bad_edges = [e for e in bm_isl.edges if len(e.link_faces) != 2]
                    if bad_edges:
                        raise RuntimeError(
                            f'Non-manifold z-cap seam on closed island of {obj.name}: {len(bad_edges)} bad edges'
                        )
            _merge_bmesh_into(bm_merged, bm_isl)
        bm_isl.free()
    if not any_modified:
        bm_merged.free()
        return False
    _write_bm_to_obj(obj, bm_merged, mw_inv, is_mirrored=is_mirrored, mw=mw)
    return True


CUTAWAY_EXPOSED_RE = re.compile(r'(?:^|_)(?:npu[0123]|card[13])_(?:ihs|cooler)$', re.IGNORECASE)
MODULE_SUFFIX_RE = re.compile(r'(?:^|_)(npu[0-9]+|card[0-9]+)$', re.IGNORECASE)
SILICON_DIE_NAME_RE = re.compile(r'(?:silicon|mirror[\s_/-]*die|\bdie\b)', re.IGNORECASE)


def import_exploded_glb(
    path,
    offset_x,
    explode_scale,
    expected_exposed_min=1,
    a3_cutaway=False,
    expected_modules=(),
    expected_groups=(),
    expected_root_group=None,
):
    if not os.path.isfile(path):
        raise FileNotFoundError(f'Required GLB asset missing: {path}')
    before = set(bpy.data.objects)
    res_imp = bpy.ops.import_scene.gltf(filepath=path)
    if isinstance(res_imp, set) and 'FINISHED' not in res_imp:
        raise RuntimeError(f'GLB import did not finish cleanly for {path}: {res_imp!r}')
    added = [o for o in bpy.data.objects if o not in before]
    if not added:
        raise RuntimeError(f'GLB import added 0 objects: {path}')
    roots = [o for o in added if o.parent is None]
    container = bpy.data.objects.new(f'grp_{offset_x}', None)
    scene.collection.objects.link(container)
    for r in roots:
        r.parent = container
    container.location = Vector((offset_x, 0.0, 0.0))
    bpy.context.view_layer.update()

    hidden_lid = 0
    hidden_cooling = 0
    hidden_exposed = 0
    for obj in added:
        kind = obj.get('kind')
        if kind == 'lid':
            hide_tree(obj)
            hidden_lid += 1
            continue
        if kind == 'cooling':
            hide_tree(obj)
            hidden_cooling += 1
            continue
        if kind in ('ihs', 'cooler') and CUTAWAY_EXPOSED_RE.search(obj.name):
            hide_tree(obj)
            hidden_exposed += 1
            continue

    if hidden_lid < 1:
        raise RuntimeError(f'Expected at least 1 lid node to hide in {path}, matched {hidden_lid}')
    if hidden_exposed < expected_exposed_min:
        raise RuntimeError(
            f'Expected >= {expected_exposed_min} exposed ihs/cooler nodes to hide in {path}, matched {hidden_exposed}'
        )
    if a3_cutaway and hidden_cooling < 1:
        raise RuntimeError(f'Expected at least 1 cooling node to hide in {path}, matched {hidden_cooling}')

    # Apply explode translation cleanly in Blender world space (+Z up, -Y front, +Y rear)
    part_nodes = [o for o in added if o.get('kind') and not o.hide_render]
    exploded_count = 0
    board_lift_count = 0
    for obj in part_nodes:
        ez = float(obj.get('explodeZ', 0.0) or 0.0)
        ey = float(obj.get('explodeY', 0.0) or 0.0)
        is_a3_board = bool(a3_cutaway and obj.get('kind') == 'board')
        extra_z = 0.28 if is_a3_board else 0.0
        if is_a3_board:
            board_lift_count += 1
        if abs(ez) > 1e-4 or abs(ey) > 1e-4 or abs(extra_z) > 1e-4:
            mw = obj.matrix_world.copy()
            mw.translation += Vector((0.0, ey * explode_scale, ez * explode_scale + extra_z))
            obj.matrix_world = mw
            exploded_count += 1
            bpy.context.view_layer.update()

    if exploded_count < 1:
        raise RuntimeError(f'Expected >= 1 exploded part in {path}, matched {exploded_count}')
    if a3_cutaway and board_lift_count < 1:
        raise RuntimeError(f'Expected A3 accelerator board node in {path}, matched {board_lift_count}')

    step_cut_count = 0
    z_cap_count = 0
    if a3_cutaway:
        for obj in added:
            if obj.type != 'MESH' or obj.hide_render:
                continue
            pname = obj.parent.name if obj.parent else ''
            if pname == 'Atlas_800I_A3':
                if cut_mesh_stepped(obj, y_cut=0.55, z_cut=1.88):
                    step_cut_count += 1
            elif pname == 'Atlas_800I_A3_fans':
                if cut_mesh_z_cap(obj, z_cut=1.88):
                    z_cap_count += 1
        bpy.context.view_layer.update()
        if step_cut_count < 1 or z_cap_count < 1:
            raise RuntimeError(
                f'A3 cutaway modified insufficient objects in {path}: '
                f'step_cut_count={step_cut_count}, z_cap_count={z_cap_count}'
            )

    visible_meshes = [
        o for o in added
        if o.type == 'MESH' and not o.hide_render and len(o.data.polygons) > 0
    ]
    if not visible_meshes:
        raise RuntimeError(f'No visible non-empty meshes remained after importing {path}')

    exposed_npu_names = []
    exposed_node_full_names = []
    npu_by_name = {o.name: o for o in added if o.get('kind') == 'npu' and not o.hide_render}
    for obj in npu_by_name.values():
        m_mod = MODULE_SUFFIX_RE.search(obj.name)
        if m_mod is None:
            continue
        canonical_mod = m_mod.group(1).lower()
        descendants = [obj] + list(obj.children_recursive)
        has_hidden_cap = any(
            ch.hide_render and CUTAWAY_EXPOSED_RE.search(ch.name)
            for ch in obj.children_recursive
        )
        has_visible_die = any(
            d.type == 'MESH'
            and not d.hide_render
            and len(d.data.polygons) > 0
            and SILICON_DIE_NAME_RE.search(d.name)
            for d in descendants
        )
        if has_hidden_cap and has_visible_die:
            if canonical_mod not in exposed_npu_names:
                exposed_npu_names.append(canonical_mod)
            exposed_node_full_names.append(obj.name)
    for exp_name in expected_modules:
        if exp_name.lower() not in exposed_npu_names:
            raise RuntimeError(
                f'Expected exposed module {exp_name!r} with visible Silicon/die mesh + hidden cap in {path}, '
                f'verified={sorted(exposed_npu_names)} nodes={sorted(exposed_node_full_names)}'
            )
    if not exposed_npu_names:
        raise RuntimeError(f'No exposed NPU/card modules with visible die verified in {path}')

    by_name = {o.name: o for o in added}
    root_grp = expected_root_group if expected_root_group is not None else (expected_groups[0] if expected_groups else None)
    for grp_name in expected_groups:
        grp_obj = by_name.get(grp_name)
        if grp_obj is None:
            raise RuntimeError(f'Missing required structural group node {grp_name!r} in {path}')
        if grp_name == root_grp:
            grp_candidates = [grp_obj] + list(grp_obj.children)
            if not any(m.type == 'MESH' and not m.hide_render and len(m.data.polygons) > 0 for m in grp_candidates):
                raise RuntimeError(f'Chassis root group {grp_name!r} has no direct visible mesh geometry in {path}')
        else:
            grp_sub = [grp_obj] + list(grp_obj.children_recursive)
            if not any(m.type == 'MESH' and not m.hide_render and len(m.data.polygons) > 0 for m in grp_sub):
                raise RuntimeError(f'Structural group {grp_name!r} has no visible mesh geometry in {path}')

    stats = {
        'visibleMeshes': len(visible_meshes),
        'hiddenLid': hidden_lid,
        'hiddenCooling': hidden_cooling,
        'hiddenExposed': hidden_exposed,
        'explodedParts': exploded_count,
        'stepCutMeshes': step_cut_count,
        'zCapCutMeshes': z_cap_count,
        'boardLifts': board_lift_count,
        'exposedNodes': sorted(exposed_npu_names),
        'verifiedGroups': list(expected_groups),
    }
    return container, stats


GLB_DIR = os.environ.get('PLATE_GLB_DIR', '/content')
_, stats_a2 = import_exploded_glb(
    os.path.join(GLB_DIR, 'atlas-800t-a2.glb'),
    -5.65,
    0.34,
    expected_exposed_min=8,
    a3_cutaway=False,
    expected_modules=('npu0', 'npu1', 'npu2', 'npu3'),
    expected_root_group='Atlas_800T_A2',
    expected_groups=(
        'Atlas_800T_A2',
        'Atlas_800T_A2_accelerator_board',
        'Atlas_800T_A2_fans',
        'Atlas_800T_A2_host',
        'Atlas_800T_A2_power',
    ),
)
_, stats_a3 = import_exploded_glb(
    os.path.join(GLB_DIR, 'atlas-800i-a3.glb'),
    0.0,
    0.30,
    expected_exposed_min=8,
    a3_cutaway=True,
    expected_modules=('npu0', 'npu1', 'npu2', 'npu3'),
    expected_root_group='Atlas_800I_A3',
    expected_groups=(
        'Atlas_800I_A3',
        'Atlas_800I_A3_accelerator_board',
        'Atlas_800I_A3_fans',
        'Atlas_800I_A3_host',
        'Atlas_800I_A3_power',
    ),
)
_, stats_3000 = import_exploded_glb(
    os.path.join(GLB_DIR, 'atlas-800-3000.glb'),
    5.65,
    0.38,
    expected_exposed_min=4,
    a3_cutaway=False,
    expected_modules=('card1', 'card3'),
    expected_root_group='Atlas_800_3000',
    expected_groups=(
        'Atlas_800_3000',
        'Atlas_800_3000_riser_board',
        'Atlas_800_3000_fans',
        'Atlas_800_3000_host',
        'Atlas_800_3000_power',
    ),
)
bpy.context.view_layer.update()

# Compute exact visible world bounding box to frame isometric orthographic camera cleanly
min_v = Vector((1e9, 1e9, 1e9))
max_v = Vector((-1e9, -1e9, -1e9))
for obj in scene.objects:
    if obj.type == 'MESH' and not obj.hide_render and len(obj.data.vertices) > 0:
        for corner in obj.bound_box:
            wc = obj.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, wc.x)
            min_v.y = min(min_v.y, wc.y)
            min_v.z = min(min_v.z, wc.z)
            max_v.x = max(max_v.x, wc.x)
            max_v.y = max(max_v.y, wc.y)
            max_v.z = max(max_v.z, wc.z)

center = (min_v + max_v) * 0.5


def add_area_light(name, loc, target, energy, size, color, visible_camera=False):
    ldata = bpy.data.lights.new(name=name, type='AREA')
    ldata.energy = float(energy)
    ldata.size = float(size)
    ldata.color = tuple(float(c) for c in color[:3])
    lobj = bpy.data.objects.new(name=name, object_data=ldata)
    scene.collection.objects.link(lobj)
    lobj.location = Vector(loc)
    lobj.rotation_euler = (Vector(target) - lobj.location).to_track_quat('-Z', 'Y').to_euler()
    if hasattr(lobj, 'visible_camera'):
        lobj.visible_camera = bool(visible_camera)
    return lobj


add_area_light('KeyWarm', center + Vector((-6.0, -11.0, 11.5)), center, 1850.0, 8.5, (1.0, 0.96, 0.90))
add_area_light('FillCool', center + Vector((8.5, -8.5, 8.0)), center, 900.0, 9.0, (0.90, 0.95, 1.0))
add_area_light('RimTop', center + Vector((0.0, 8.5, 10.0)), center, 680.0, 9.5, (1.0, 0.98, 0.94))
add_area_light('DieSpecularGraze', (center.x + 1.2, 4.5, center.z + 4.6), (center.x, -1.5, 1.2), 260.0, 9.0, (0.96, 0.98, 1.0))
add_area_light('A3LowerBayFill', (-0.4, -5.8, 4.0), (0.0, -1.2, 1.2), 130.0, 3.4, (1.0, 0.96, 0.91))
add_area_light('A2OamBayFill', (-5.8, -5.6, 3.6), (-5.65, -1.1, 0.9), 85.0, 3.0, (1.0, 0.96, 0.91))

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
    if obj.type == 'MESH' and not obj.hide_render and len(obj.data.vertices) > 0:
        for corner in obj.bound_box:
            lc = cam_inv @ (obj.matrix_world @ Vector(corner))
            max_cx = max(max_cx, abs(lc.x))
            max_cy = max(max_cy, abs(lc.y))

aspect = scene.render.resolution_x / scene.render.resolution_y
cam_data.ortho_scale = max(max_cx * 2.0, max_cy * 2.0 * aspect) * 1.06

raw_plate_path = os.path.join(RUN_DIR, f'raw_plate_{RUN_ID}.png')
blender_meta_path = os.path.join(RUN_DIR, f'blender_meta_{RUN_ID}.json')
backend_order = ('OPTIX', 'CUDA', 'CPU')
start_idx = backend_order.index(gpu_backend) if gpu_backend in backend_order else 0
render_candidates = (FORCE_BACKEND,) if FORCE_BACKEND else backend_order[start_idx:]
render_succeeded = False

for cand in render_candidates:
    dn_name = 'UNKNOWN'
    try:
        if cand == gpu_backend:
            cand_devices = gpu_devices
            use_dn, dn_name, dn_passes = use_denoising_actual, active_denoiser, active_input_passes
            scene.cycles.use_denoising = use_dn
        else:
            cand_devices = _select_cycles_backend(cand)
            if cand_devices is None:
                backend_probe_notes.append(f'render:{cand}:no_devices')
                continue
            use_dn, dn_name, dn_passes = _configure_denoiser_for_backend(cand)

        scene.cycles.samples = 512
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.005
        scene.render.resolution_x = 1920
        scene.render.resolution_y = 920
        scene.render.filepath = raw_plate_path

        for attempt_dn in ((True, False) if use_dn else (False,)):
            if not attempt_dn:
                scene.cycles.use_denoising = False
                dn_name = 'NONE'
                dn_passes = 'NONE'
                use_dn = False
            if os.path.exists(raw_plate_path):
                try:
                    os.remove(raw_plate_path)
                except OSError:
                    pass
            try:
                res = bpy.ops.render.render(write_still=True)
                if 'FINISHED' not in res:
                    raise RuntimeError(f'Production render returned {res!r}')
                if not os.path.isfile(raw_plate_path) or os.path.getsize(raw_plate_path) < 32:
                    raise RuntimeError(f'Production render wrote empty/missing file: {raw_plate_path}')
                with open(raw_plate_path, 'rb') as pf:
                    png_head = pf.read(8)
                    pf.seek(-12, os.SEEK_END)
                    png_tail = pf.read(12)
                if png_head != b'\x89PNG\r\n\x1a\n' or png_tail != b'\x00\x00\x00\x00IEND\xaeB`\x82':
                    raise RuntimeError(f'Production render wrote corrupt/truncated PNG: {raw_plate_path}')
                chk_img = bpy.data.images.load(raw_plate_path, check_existing=False)
                try:
                    if chk_img.size[0] <= 0 or chk_img.size[1] <= 0:
                        raise RuntimeError(f'Production render decoded zero dimensions: {tuple(chk_img.size)!r}')
                finally:
                    bpy.data.images.remove(chk_img)
                gpu_backend = cand
                gpu_devices = cand_devices
                use_denoising_actual = use_dn
                active_denoiser = dn_name
                active_input_passes = dn_passes
                render_succeeded = True
                break
            except Exception as render_exc:
                backend_probe_notes.append(f'render:{cand}+{dn_name}:failed({render_exc})')
    except Exception as setup_exc:
        backend_probe_notes.append(f'render:{cand}:setup_failed({setup_exc})')
    if render_succeeded:
        break
    _reset_cycles_backend_state()

if not render_succeeded:
    raise RuntimeError('All Cycles backends failed production render: ' + '; '.join(backend_probe_notes))

cutaway_details = {
    'a3FrontCutY': 0.55,
    'a3FrontCutZ': 1.88,
    'a3BoardLiftZ': 0.28,
    'a3FansCutZ': 1.88,
    'exposedFrontModules': [
        f"atlas-800t-a2:{len(stats_a2['exposedNodes'])}",
        f"atlas-800i-a3:{len(stats_a3['exposedNodes'])}",
        f"atlas-800-3000:{len(stats_3000['exposedNodes'])}",
    ],
    'machineStats': {
        'atlas-800t-a2': stats_a2,
        'atlas-800i-a3': stats_a3,
        'atlas-800-3000': stats_3000,
    },
    'hiddenKinds': ['lid', 'cooling'],
    'lights': ['KeyWarm', 'FillCool', 'RimTop', 'DieSpecularGraze', 'A3LowerBayFill', 'A2OamBayFill', 'StudioWorld'],
}

with open(blender_meta_path, 'w', encoding='utf-8') as f:
    json.dump(
        {
            'runId': RUN_ID,
            'samples': int(scene.cycles.samples),
            'adaptiveSampling': bool(scene.cycles.use_adaptive_sampling),
            'adaptiveThreshold': float(scene.cycles.adaptive_threshold),
            'useDenoising': bool(scene.cycles.use_denoising),
            'denoiser': active_denoiser,
            'denoisingInputPasses': active_input_passes,
            'cutawayDetails': cutaway_details,
            'backend': gpu_backend,
            'devices': gpu_devices,
            'backendProbeNotes': backend_probe_notes,
            'blenderVersion': bpy.app.version_string,
            'orthoScale': round(cam_data.ortho_scale, 3),
        },
        f,
    )
"""

BLENDER_INSTALL_DIR = Path("/opt/blender-4.2.4")
BLENDER_TAR_PATH = Path("/tmp/blender-4.2.4-linux-x64.tar.xz")
BLENDER_SHA256 = "9f2196f3a471262ec974260192e2e06af443d3451d20d3232b6c0a4488ecfb2a"
BLENDER_URLS = (
    "https://download.blender.org/release/Blender4.2/blender-4.2.4-linux-x64.tar.xz",
    "https://mirrors.aliyun.com/blender/release/Blender4.2/blender-4.2.4-linux-x64.tar.xz",
)
HEADLESS_GL_LIBS = (
    "libxrender1",
    "libxi6",
    "libxxf86vm1",
    "libxfixes3",
    "libxkbcommon0",
    "libsm6",
    "libgl1",
    "libegl1",
    "libgomp1",
    "curl",
    "xz-utils",
)


def _silence_broken_stdout() -> None:
    try:
        devnull_fd = os.open(os.devnull, os.O_WRONLY)
        try:
            os.dup2(devnull_fd, 1)
        finally:
            os.close(devnull_fd)
    except OSError:
        pass
    try:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")  # noqa: SIM115
    except OSError:
        pass


def safe_stdout_print(msg: str) -> None:
    out = getattr(sys, "stdout", None)
    if out is None or getattr(out, "closed", False):
        return
    try:
        print(msg, flush=True)
    except (BrokenPipeError, OSError, ValueError):
        _silence_broken_stdout()
    except UnicodeEncodeError:
        enc = getattr(out, "encoding", None) or "ascii"
        try:
            print(msg.encode(enc, errors="replace").decode(enc, errors="replace"), flush=True)
        except (BrokenPipeError, OSError, ValueError, UnicodeEncodeError):
            _silence_broken_stdout()


def verify_file_sha256(path: Path, expected_sha256: str) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            blk = f.read(1048576)
            if not blk:
                break
            h.update(blk)
    digest = h.hexdigest()
    if digest.lower() != expected_sha256.lower():
        raise RuntimeError(
            f"SHA256 mismatch for {path}: expected {expected_sha256}, got {digest}"
        )
    return digest


def _parse_blender_version(stdout_text: str) -> tuple[int, int, int] | None:
    for line in stdout_text.splitlines():
        if "Blender " in line:
            parts = line.strip().split()
            for idx, tok in enumerate(parts):
                if tok == "Blender" and idx + 1 < len(parts):
                    nums = parts[idx + 1].split(".")
                    if len(nums) >= 2 and nums[0].isdigit() and nums[1].isdigit():
                        patch = int(nums[2]) if len(nums) >= 3 and nums[2].isdigit() else 0
                        return (int(nums[0]), int(nums[1]), patch)
    return None


def _probe_blender_capabilities(
    blender_exe: str,
    *,
    require_version_prefix: str | None = None,
    min_version: tuple[int, int, int] = (3, 6, 0),
) -> tuple[bool, str, bool]:
    """Return (ok, detail, missing_shared_libs)."""
    try:
        ver_res = subprocess.run(
            [blender_exe, "--version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30.0,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"Failed to run {blender_exe} --version: {exc}", False

    combined_ver = f"{ver_res.stdout or ''}\n{ver_res.stderr or ''}".strip()
    if ver_res.returncode != 0:
        missing_libs = "error while loading shared libraries" in combined_ver.lower()
        return False, f"{blender_exe} --version exited {ver_res.returncode}: {combined_ver}", missing_libs

    if require_version_prefix and require_version_prefix not in (ver_res.stdout or ""):
        return False, f"Expected {require_version_prefix!r}, got: {combined_ver}", False

    ver_tuple = _parse_blender_version(ver_res.stdout or "")
    if ver_tuple is None or ver_tuple < min_version:
        return False, f"Unsupported Blender version {ver_tuple} (< {min_version}): {combined_ver}", False

    cap_expr = (
        "import bpy; "
        "assert 'cycles' in bpy.context.preferences.addons, 'cycles addon missing'; "
        "assert bpy.ops.import_scene.gltf.get_rna_type() is not None, 'gltf importer operator not registered'; "
        "print('CAP_OK')"
    )
    try:
        cap_res = subprocess.run(
            [blender_exe, "--background", "--python-exit-code", "1", "--python-expr", cap_expr],
            check=False,
            capture_output=True,
            text=True,
            timeout=60.0,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"Blender capability probe failed: {exc}", False

    cap_out = f"{cap_res.stdout or ''}\n{cap_res.stderr or ''}".strip()
    if cap_res.returncode != 0 or "CAP_OK" not in (cap_res.stdout or ""):
        missing_libs = "error while loading shared libraries" in cap_out.lower()
        return False, f"Blender capability probe failed: {cap_out}", missing_libs

    first_line = (ver_res.stdout or "").splitlines()[0] if (ver_res.stdout or "").splitlines() else blender_exe
    return True, first_line, False


def _install_headless_libs(env: dict[str, str]) -> None:
    print("[plate] Installing headless X11/GL shared libraries...", file=sys.stderr, flush=True)
    subprocess.run(["apt-get", "update", "-qq"], check=True, env=env, timeout=180.0)
    subprocess.run(["apt-get", "install", "-y", "-qq", *HEADLESS_GL_LIBS], check=True, env=env, timeout=300.0)


def _try_lock_fd(fd: int) -> bool:
    if os.name == "nt":
        import msvcrt

        try:
            os.lseek(fd, 0, os.SEEK_SET)
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            return True
        except OSError:
            return False
    else:
        import fcntl

        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            return False


def _unlock_fd(fd: int) -> None:
    if os.name == "nt":
        import msvcrt

        try:
            os.lseek(fd, 0, os.SEEK_SET)
            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        except OSError:
            pass
    else:
        import fcntl

        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        except OSError:
            pass


def _acquire_path_lock(lock_path: Path, timeout_sec: float = 60.0):
    from contextlib import contextmanager

    @contextmanager
    def _mgr():
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o666)
        acquired = False
        deadline = time.monotonic() + timeout_sec
        try:
            while True:
                if _try_lock_fd(fd):
                    acquired = True
                    break
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"Timed out acquiring lock {lock_path} after {timeout_sec}s")
                time.sleep(0.05)
            yield
        finally:
            if acquired:
                _unlock_fd(fd)
            try:
                os.close(fd)
            except OSError:
                pass

    return _mgr()


import re as _host_re


_VERSIONED_WEBP_RE = _host_re.compile(r"^atlas-slot-die-cutaway\.([0-9a-f]{32})\.webp$")
_VERSIONED_RECEIPT_RE = _host_re.compile(r"^render_receipt\.([0-9a-f]{32})\.json$")


def _prune_versioned_outputs(out_dir: Path, keep_names: set[str], max_keep: int = 3) -> None:
    """Prune stale versioned render generations while keeping active manifest and newest snapshots."""
    keep_limit = max(2, int(max_keep))
    gen_mtimes: dict[str, float] = {}
    gen_files: dict[str, list[Path]] = {}
    for entry in out_dir.iterdir():
        if not entry.is_file():
            continue
        m = _VERSIONED_WEBP_RE.fullmatch(entry.name) or _VERSIONED_RECEIPT_RE.fullmatch(entry.name)
        if not m:
            continue
        gen = m.group(1)
        gen_files.setdefault(gen, []).append(entry)
        try:
            mt = entry.stat().st_mtime
        except OSError:
            mt = 0.0
        if gen not in gen_mtimes or mt > gen_mtimes[gen]:
            gen_mtimes[gen] = mt

    protected_gens = {
        gen for gen, paths in gen_files.items() if any(p.name in keep_names for p in paths)
    }
    ordered_gens = sorted(gen_files.keys(), key=lambda g: (gen_mtimes.get(g, 0.0), g), reverse=True)
    kept_gens = set(protected_gens)
    for gen in ordered_gens:
        if len(kept_gens) >= keep_limit:
            break
        kept_gens.add(gen)
    for gen, paths in gen_files.items():
        if gen in kept_gens:
            continue
        for p in paths:
            p.unlink(missing_ok=True)


def ensure_blender_binary() -> str:
    """Probes cached/preinstalled Blender first, then installs verified Blender 4.2.4 LTS under lock+staging."""
    env = {**os.environ, "DEBIAN_FRONTEND": "noninteractive"}
    blender_bin = BLENDER_INSTALL_DIR / "blender"
    lock_path = BLENDER_TAR_PATH.with_name("blender-install.lock")
    with _acquire_path_lock(lock_path, timeout_sec=600.0):
        libs_installed = False

        cached_ok = False
        cached_detail = ""
        cached_missing_libs = False
        if blender_bin.is_file():
            cached_ok, cached_detail, cached_missing_libs = _probe_blender_capabilities(
                str(blender_bin), require_version_prefix="Blender 4.2", min_version=(4, 2, 0)
            )
            if cached_ok:
                print(f"[plate] Reusing cached {cached_detail}", file=sys.stderr, flush=True)
                return str(blender_bin)

        path_blender = shutil.which("blender")
        path_same_as_cached = False
        path_missing_libs = False
        if path_blender:
            try:
                path_same_as_cached = blender_bin.is_file() and Path(path_blender).resolve() == blender_bin.resolve()
            except OSError:
                path_same_as_cached = False
            if not path_same_as_cached:
                ok, detail, path_missing_libs = _probe_blender_capabilities(path_blender, min_version=(3, 6, 0))
                if ok:
                    print(f"[plate] Reusing preinstalled {detail} ({path_blender})", file=sys.stderr, flush=True)
                    return path_blender

        if (cached_missing_libs or path_missing_libs) and not libs_installed:
            _install_headless_libs(env)
            libs_installed = True
            if blender_bin.is_file() and cached_missing_libs:
                ok, detail, _ = _probe_blender_capabilities(
                    str(blender_bin), require_version_prefix="Blender 4.2", min_version=(4, 2, 0)
                )
                if ok:
                    print(f"[plate] Reusing cached {detail}", file=sys.stderr, flush=True)
                    return str(blender_bin)
            if path_blender and not path_same_as_cached and path_missing_libs:
                ok, detail, _ = _probe_blender_capabilities(path_blender, min_version=(3, 6, 0))
                if ok:
                    print(f"[plate] Reusing preinstalled {detail} ({path_blender})", file=sys.stderr, flush=True)
                    return path_blender

        if blender_bin.is_file() and not cached_ok:
            print(
                f"[plate] Cached blender binary invalid ({cached_detail}); checking/downloading Blender 4.2.4 LTS...",
                file=sys.stderr,
                flush=True,
            )

        if not libs_installed:
            _install_headless_libs(env)
            libs_installed = True

        tar_tmp = BLENDER_TAR_PATH.with_name(f".{BLENDER_TAR_PATH.name}.{uuid.uuid4().hex[:8]}.tmp")
        for url in BLENDER_URLS:
            stage_dir = BLENDER_INSTALL_DIR.parent / f".{BLENDER_INSTALL_DIR.name}.{uuid.uuid4().hex[:8]}.tmp"
            old_backup = BLENDER_INSTALL_DIR.parent / f".{BLENDER_INSTALL_DIR.name}.{uuid.uuid4().hex[:8]}.bak"
            try:
                print(f"[plate] Downloading Blender 4.2.4 LTS from {url}...", file=sys.stderr, flush=True)
                tar_tmp.unlink(missing_ok=True)
                subprocess.run(
                    [
                        "curl", "-fSL", "--retry", "2", "--retry-delay", "3",
                        "--connect-timeout", "20", "--max-time", "300",
                        "-o", str(tar_tmp), url,
                    ],
                    check=True,
                    timeout=330.0,
                )
                if not tar_tmp.exists() or tar_tmp.stat().st_size < 50_000_000:
                    raise RuntimeError("Downloaded archive is unexpectedly small")
                verify_file_sha256(tar_tmp, BLENDER_SHA256)
                stage_dir.mkdir(parents=True, exist_ok=True)
                subprocess.run(
                    ["tar", "-xJf", str(tar_tmp), "-C", str(stage_dir), "--strip-components=1"],
                    check=True,
                    timeout=180.0,
                )
                tar_tmp.unlink(missing_ok=True)
                stage_bin = stage_dir / "blender"
                ok, detail, _ = _probe_blender_capabilities(
                    str(stage_bin), require_version_prefix="Blender 4.2", min_version=(4, 2, 0)
                )
                if not ok:
                    raise RuntimeError(f"Extracted Blender failed verification: {detail}")
                moved_old = False
                if BLENDER_INSTALL_DIR.exists():
                    BLENDER_INSTALL_DIR.replace(old_backup)
                    moved_old = True
                try:
                    stage_dir.replace(BLENDER_INSTALL_DIR)
                except Exception:
                    if moved_old and old_backup.exists() and not BLENDER_INSTALL_DIR.exists():
                        old_backup.replace(BLENDER_INSTALL_DIR)
                    raise
                if moved_old:
                    shutil.rmtree(old_backup, ignore_errors=True)
                print(f"[plate] Installed {detail}", file=sys.stderr, flush=True)
                return str(blender_bin)
            except Exception as exc:
                print(f"[plate] Blender 4.2.4 fetch failed ({url}): {exc}", file=sys.stderr, flush=True)
                tar_tmp.unlink(missing_ok=True)
                shutil.rmtree(stage_dir, ignore_errors=True)

        print("[plate] Warning: both Blender 4.2.4 downloads failed; falling back to apt blender.", file=sys.stderr, flush=True)
        subprocess.run(["apt-get", "install", "-y", "-qq", "blender"], check=True, env=env, timeout=300.0)
        ok, detail, _ = _probe_blender_capabilities("blender", min_version=(3, 6, 0))
        if not ok:
            raise RuntimeError(f"Fallback apt blender failed version/Cycles/glTF verification: {detail}")
        print(f"[plate] Using verified fallback {detail}", file=sys.stderr, flush=True)
        return "blender"


def _parse_webp_riff_chunks(raw: bytes) -> list[tuple[bytes, bytes]]:
    if len(raw) < 12 or raw[:4] != b"RIFF" or raw[8:12] != b"WEBP":
        raise ValueError("Invalid WebP RIFF container header")
    riff_sz = struct.unpack("<I", raw[4:8])[0]
    if riff_sz < 4 or 8 + riff_sz > len(raw):
        raise ValueError(f"Truncated or invalid WebP RIFF length {riff_sz} vs {len(raw)} bytes")
    riff_end = 8 + riff_sz
    if riff_end != len(raw):
        raise ValueError(f"Trailing bytes outside WebP RIFF container ({riff_end} != {len(raw)})")
    pos = 12
    chunks: list[tuple[bytes, bytes]] = []
    while pos + 8 <= riff_end:
        tag = raw[pos : pos + 4]
        sz = struct.unpack("<I", raw[pos + 4 : pos + 8])[0]
        if pos + 8 + sz > riff_end:
            raise ValueError(f"WebP RIFF chunk {tag!r} extends past declared RIFF end ({riff_end})")
        payload = raw[pos + 8 : pos + 8 + sz]
        chunks.append((tag, payload))
        pos += 8 + sz + (sz % 2)
    if pos != riff_end:
        raise ValueError(f"Unaligned trailing bytes inside WebP RIFF container ({pos} != {riff_end})")
    return chunks


def _pack_webp_riff_chunk(tag: bytes, payload: bytes) -> bytes:
    pad = b"\x00" if (len(payload) % 2) else b""
    return tag + struct.pack("<I", len(payload)) + payload + pad


def _embed_webp_exif_riff(raw: bytes, exif_bytes: bytes, width: int, height: int) -> bytes:
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid WebP dimensions for VP8X: {width}x{height}")
    exif_payload = exif_bytes[6:] if exif_bytes.startswith(b"Exif\x00\x00") else exif_bytes
    chunks = _parse_webp_riff_chunks(raw)
    has_vp8x = any(t == b"VP8X" for t, _ in chunks)
    has_alpha = any(t == b"ALPH" for t, _ in chunks) or any(
        t == b"VP8L" and len(p) >= 5 and (p[4] & 0x10) for t, p in chunks
    )
    out_chunks: list[tuple[bytes, bytes]] = []
    if has_vp8x:
        for tag, payload in chunks:
            if tag == b"VP8X":
                if len(payload) < 10:
                    raise ValueError(f"Corrupt VP8X chunk length {len(payload)}")
                flags = struct.unpack("<I", payload[:4])[0] | 0x08 | (0x10 if has_alpha else 0)
                out_chunks.append((tag, struct.pack("<I", flags) + payload[4:]))
            elif tag != b"EXIF":
                out_chunks.append((tag, payload))
    else:
        flags = 0x08 | (0x10 if has_alpha else 0)
        vp8x_payload = struct.pack("<I", flags) + (width - 1).to_bytes(3, "little") + (height - 1).to_bytes(3, "little")
        out_chunks.append((b"VP8X", vp8x_payload))
        for tag, payload in chunks:
            if tag != b"EXIF":
                out_chunks.append((tag, payload))
    out_chunks.append((b"EXIF", exif_payload))
    body = b"".join(_pack_webp_riff_chunk(t, p) for t, p in out_chunks)
    return b"RIFF" + struct.pack("<I", 4 + len(body)) + b"WEBP" + body


def _verify_webp_run_id(webp_path: Path, expected_run_id: str, expected_size: tuple[int, int]) -> bytes:
    import io
    from PIL import Image, features

    raw_bytes = webp_path.read_bytes()
    chunks = _parse_webp_riff_chunks(raw_bytes)
    exif_chunks = [p for t, p in chunks if t == b"EXIF"]
    if not exif_chunks:
        raise RuntimeError(f"Encoded WebP lacks RIFF EXIF chunk: {webp_path}")
    exif_raw = exif_chunks[-1]
    if exif_raw.startswith(b"Exif\x00\x00"):
        exif_raw = exif_raw[6:]
    ex = Image.Exif()
    ex.load(exif_raw)
    expected_desc = f"runId={expected_run_id}"
    got_desc = ex.get(0x010E)
    if got_desc != expected_desc:
        raise RuntimeError(
            f"Encoded WebP EXIF runId mismatch in {webp_path}: expected {expected_desc!r}, got {got_desc!r}"
        )
    with io.BytesIO(raw_bytes) as bio, Image.open(bio) as im_chk:
        im_chk.load()
        if im_chk.size != expected_size:
            raise RuntimeError(
                f"Encoded WebP dimensions mismatch in {webp_path}: expected {expected_size}, got {im_chk.size}"
            )
        if features.check("webp_mux"):
            mux_desc = im_chk.getexif().get(0x010E)
            if mux_desc != expected_desc:
                raise RuntimeError(
                    f"Pillow webp_mux EXIF readback mismatch in {webp_path}: expected {expected_desc!r}, got {mux_desc!r}"
                )
    return raw_bytes


def main() -> None:
    t0 = time.time()
    blender_cmd = ensure_blender_binary()
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pillow"], check=True, timeout=180.0)

    run_id = uuid.uuid4().hex
    out_dir = Path(os.environ.get("PLATE_OUT_DIR", "/content"))
    glb_dir = os.environ.get("PLATE_GLB_DIR", "/content")
    out_dir.mkdir(parents=True, exist_ok=True)
    run_dir = Path(tempfile.mkdtemp(prefix=f"plate_run_{run_id}_", dir=str(out_dir)))

    try:
        run_script = run_dir / "run_blender_plate.py"
        run_script.write_text(BLENDER_SCRIPT, encoding="utf-8")
        forced_backend = os.environ.get("PLATE_FORCE_BACKEND", "").strip().upper()
        if forced_backend:
            if forced_backend not in ("OPTIX", "CUDA", "CPU"):
                raise RuntimeError(f"Unsupported PLATE_FORCE_BACKEND={forced_backend!r}")
            backends_to_try: tuple[str, ...] = (forced_backend,)
        else:
            backends_to_try = ("OPTIX", "CUDA", "CPU")

        from PIL import Image

        raw_plate = run_dir / f"raw_plate_{run_id}.png"
        blender_meta = run_dir / f"blender_meta_{run_id}.json"
        meta: dict[str, object] | None = None
        validated_im: Image.Image | None = None
        backend_failures: list[str] = []
        last_exc: BaseException | None = None

        for cand_backend in backends_to_try:
            raw_plate.unlink(missing_ok=True)
            blender_meta.unlink(missing_ok=True)
            blender_env = {
                **os.environ,
                "PLATE_RUN_ID": run_id,
                "PLATE_RUN_DIR": str(run_dir),
                "PLATE_GLB_DIR": glb_dir,
                "PLATE_FORCE_BACKEND": cand_backend,
            }
            print(
                f"[plate] Launching Blender Cycles render backend={cand_backend} (runId={run_id})...",
                file=sys.stderr,
                flush=True,
            )
            try:
                subprocess.run(
                    [blender_cmd, "--background", "--python-exit-code", "1", "--python", str(run_script)],
                    check=True,
                    env=blender_env,
                    timeout=1800.0,
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
                last_exc = exc
                backend_failures.append(f"{cand_backend}:{exc}")
                print(f"[plate] Warning: Blender backend {cand_backend} failed ({exc})", file=sys.stderr, flush=True)
                continue

            if not raw_plate.is_file() or not blender_meta.is_file():
                msg = f"Blender exited 0 ({cand_backend}) without producing run outputs ({raw_plate}, {blender_meta})"
                last_exc = RuntimeError(msg)
                backend_failures.append(f"{cand_backend}:missing_outputs")
                continue

            loaded_meta = json.loads(blender_meta.read_text(encoding="utf-8"))
            if not isinstance(loaded_meta, dict) or loaded_meta.get("runId") != run_id:
                raise RuntimeError(f"blender_meta runId mismatch: expected {run_id!r}, got {loaded_meta!r}")

            try:
                with Image.open(raw_plate) as opened_im:
                    cand_im = opened_im.convert("RGBA")
                alpha = cand_im.getchannel("A")
                if not alpha.getbbox():
                    raise RuntimeError("Rendered PNG is completely transparent!")
            except Exception as img_exc:
                last_exc = img_exc
                backend_failures.append(f"{cand_backend}:bad_image({img_exc})")
                print(
                    f"[plate] Warning: Blender backend {cand_backend} wrote unusable image ({img_exc})",
                    file=sys.stderr,
                    flush=True,
                )
                continue

            meta = loaded_meta
            validated_im = cand_im
            break

        if meta is None or validated_im is None:
            detail = "; ".join(backend_failures) if backend_failures else "no backends tried"
            raise RuntimeError(f"All Cycles backends failed across supervised runs: {detail}") from last_exc
        if backend_failures:
            prior_notes = meta.get("backendProbeNotes")
            notes_list = list(prior_notes) if isinstance(prior_notes, list) else []
            notes_list.extend(backend_failures)
            meta["backendProbeNotes"] = notes_list

        im = validated_im
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

        out_webp = out_dir / "atlas-slot-die-cutaway.webp"
        out_receipt = out_dir / "render_receipt.json"
        out_manifest = out_dir / "render_manifest.json"
        versioned_webp = out_dir / f"atlas-slot-die-cutaway.{run_id}.webp"
        versioned_receipt = out_dir / f"render_receipt.{run_id}.json"
        tmp_webp = out_dir / f".atlas-slot-die-cutaway.{run_id}.tmp.webp"
        tmp_receipt = out_dir / f".render_receipt.{run_id}.tmp.json"
        tmp_manifest = out_dir / f".render_manifest.{run_id}.tmp.json"
        bak_webp = out_dir / f".atlas-slot-die-cutaway.{run_id}.bak.webp"
        bak_receipt = out_dir / f".render_receipt.{run_id}.bak.json"
        bak_manifest = out_dir / f".render_manifest.{run_id}.bak.json"

        with _acquire_path_lock(out_dir / ".render_publish.lock", timeout_sec=60.0):
            attempt_webp = False
            attempt_receipt = False
            attempt_manifest = False
            existed_webp = out_webp.exists()
            existed_receipt = out_receipt.exists()
            existed_manifest = out_manifest.exists()
            committed = False
            try:
                exif = Image.Exif()
                exif[0x010E] = f"runId={run_id}"
                exif_bytes = exif.tobytes()
                cropped.save(tmp_webp, "WEBP", quality=92, method=6, exif=exif_bytes)
                raw_saved = tmp_webp.read_bytes()
                if not any(t == b"EXIF" for t, _ in _parse_webp_riff_chunks(raw_saved)):
                    tmp_webp.write_bytes(
                        _embed_webp_exif_riff(raw_saved, exif_bytes, cropped.width, cropped.height)
                    )
                raw_bytes = _verify_webp_run_id(tmp_webp, run_id, (cropped.width, cropped.height))
                raw_sha256 = hashlib.sha256(raw_bytes).hexdigest()
                meta.update(
                    {
                        "runId": run_id,
                        "width": cropped.width,
                        "height": cropped.height,
                        "bytes": len(raw_bytes),
                        "sha256": raw_sha256,
                        "versionedWebp": versioned_webp.name,
                        "versionedReceipt": versioned_receipt.name,
                        "elapsedSec": round(time.time() - t0, 2),
                    }
                )
                receipt_text = json.dumps(meta, indent=2) + "\n"
                tmp_receipt.write_text(receipt_text, encoding="utf-8")

                manifest_payload = {
                    "runId": run_id,
                    "webp": versioned_webp.name,
                    "receipt": versioned_receipt.name,
                    "canonicalWebp": out_webp.name,
                    "canonicalReceipt": out_receipt.name,
                    "sha256": raw_sha256,
                }
                tmp_manifest.write_text(json.dumps(manifest_payload, indent=2) + "\n", encoding="utf-8")

                shutil.copy2(tmp_webp, versioned_webp)
                shutil.copy2(tmp_receipt, versioned_receipt)

                if existed_webp:
                    bak_webp.write_bytes(out_webp.read_bytes())
                if existed_receipt:
                    bak_receipt.write_bytes(out_receipt.read_bytes())
                if existed_manifest:
                    bak_manifest.write_bytes(out_manifest.read_bytes())

                attempt_webp = True
                tmp_webp.replace(out_webp)
                attempt_receipt = True
                tmp_receipt.replace(out_receipt)
                attempt_manifest = True
                tmp_manifest.replace(out_manifest)
                committed = True
            except BaseException as exc:
                rollback_errors: list[str] = []
                need_rb_manifest = attempt_manifest and not tmp_manifest.exists()
                need_rb_receipt = attempt_receipt and not tmp_receipt.exists()
                need_rb_webp = attempt_webp and not tmp_webp.exists()
                manifest_live_new = False
                if not committed:
                    if need_rb_manifest:
                        if bak_manifest.exists():
                            try:
                                bak_manifest.replace(out_manifest)
                            except OSError as rb_exc:
                                manifest_live_new = True
                                rollback_errors.append(f"restore {out_manifest}: {rb_exc}")
                        elif not existed_manifest:
                            try:
                                out_manifest.unlink(missing_ok=True)
                            except OSError as rb_exc:
                                manifest_live_new = True
                                rollback_errors.append(f"unlink {out_manifest}: {rb_exc}")
                        else:
                            manifest_live_new = True
                    if need_rb_receipt:
                        if bak_receipt.exists():
                            try:
                                bak_receipt.replace(out_receipt)
                            except OSError as rb_exc:
                                rollback_errors.append(f"restore {out_receipt}: {rb_exc}")
                        elif not existed_receipt:
                            try:
                                out_receipt.unlink(missing_ok=True)
                            except OSError as rb_exc:
                                rollback_errors.append(f"unlink {out_receipt}: {rb_exc}")
                    if need_rb_webp:
                        if bak_webp.exists():
                            try:
                                bak_webp.replace(out_webp)
                            except OSError as rb_exc:
                                rollback_errors.append(f"restore {out_webp}: {rb_exc}")
                        elif not existed_webp:
                            try:
                                out_webp.unlink(missing_ok=True)
                            except OSError as rb_exc:
                                rollback_errors.append(f"unlink {out_webp}: {rb_exc}")
                    if not manifest_live_new:
                        versioned_webp.unlink(missing_ok=True)
                        versioned_receipt.unlink(missing_ok=True)
                    tmp_webp.unlink(missing_ok=True)
                    tmp_receipt.unlink(missing_ok=True)
                    tmp_manifest.unlink(missing_ok=True)
                if not rollback_errors:
                    if not need_rb_webp:
                        bak_webp.unlink(missing_ok=True)
                    if not need_rb_receipt:
                        bak_receipt.unlink(missing_ok=True)
                    if not need_rb_manifest:
                        bak_manifest.unlink(missing_ok=True)
                else:
                    raise RuntimeError(
                        f"Atomic publish failed ({exc!r}) AND rollback failed ({'; '.join(rollback_errors)})"
                    ) from exc
                raise

            try:
                bak_webp.unlink(missing_ok=True)
                bak_receipt.unlink(missing_ok=True)
                bak_manifest.unlink(missing_ok=True)
                _prune_versioned_outputs(
                    out_dir,
                    keep_names={versioned_webp.name, versioned_receipt.name},
                    max_keep=3,
                )
            except OSError as cleanup_exc:
                print(
                    f"[plate] Warning: post-commit cleanup/retention skipped: {cleanup_exc}",
                    file=sys.stderr,
                    flush=True,
                )

        safe_stdout_print(json.dumps(meta))
    finally:
        shutil.rmtree(run_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
    out = getattr(sys, "stdout", None)
    if out is not None and not getattr(out, "closed", False):
        try:
            out.flush()
        except (BrokenPipeError, OSError, ValueError):
            _silence_broken_stdout()
