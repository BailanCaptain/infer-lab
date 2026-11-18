"""Core procedural geometry and glTF 2.0 binary (.glb) writer for hardware exploration."""

from __future__ import annotations

import json
import math
import pathlib
import struct
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np

# Palette preserving the warm-paper / muted-mineral diorama language of whole/.
MATERIALS: List[Dict] = [
    {
        "name": "Atlas / vermilion accent",
        "baseColor": [0.4125, 0.0723, 0.0482, 1.0],
        "metallic": 0.14,
        "roughness": 0.56,
    },
    {
        "name": "Charcoal / soft enamel",
        "baseColor": [0.036, 0.050, 0.045, 1.0],
        "metallic": 0.15,
        "roughness": 0.62,
    },
    {
        "name": "Recess / warm shadow",
        "baseColor": [0.016, 0.024, 0.022, 1.0],
        "metallic": 0.08,
        "roughness": 0.72,
    },
    {
        "name": "Silver / warm satin",
        "baseColor": [0.505, 0.528, 0.488, 1.0],
        "metallic": 0.38,
        "roughness": 0.46,
    },
    {
        "name": "Lid / sage grey",
        "baseColor": [0.2307, 0.3005, 0.2664, 1.0],
        "metallic": 0.14,
        "roughness": 0.62,
    },
    {
        "name": "PCB / jade enamel",
        "baseColor": [0.0545, 0.1590, 0.1170, 1.0],
        "metallic": 0.12,
        "roughness": 0.58,
    },
    {
        "name": "Contacts / antique brass",
        "baseColor": [0.465, 0.320, 0.125, 1.0],
        "metallic": 0.54,
        "roughness": 0.38,
    },
    {
        "name": "Copper / brushed heatpipe",
        "baseColor": [0.495, 0.212, 0.116, 1.0],
        "metallic": 0.58,
        "roughness": 0.35,
    },
    {
        "name": "Silicon / mirror die",
        "baseColor": [0.068, 0.098, 0.112, 1.0],
        "metallic": 0.62,
        "roughness": 0.18,
    },
    {
        "name": "Substrate / olive",
        "baseColor": [0.092, 0.132, 0.102, 1.0],
        "metallic": 0.10,
        "roughness": 0.66,
    },
    {
        "name": "Porcelain / warm ivory",
        "baseColor": [0.7682, 0.7379, 0.6172, 1.0],
        "metallic": 0.02,
        "roughness": 0.80,
    },
    {
        "name": "Lettering / cream",
        "baseColor": [0.745, 0.715, 0.592, 1.0],
        "metallic": 0.0,
        "roughness": 0.78,
    },
    {
        "name": "Champagne / satin",
        "baseColor": [0.4621, 0.4020, 0.1981, 1.0],
        "metallic": 0.36,
        "roughness": 0.48,
    },
    {
        "name": "DGX / moss accent",
        "baseColor": [0.1981, 0.2874, 0.0844, 1.0],
        "metallic": 0.14,
        "roughness": 0.58,
    },
    {
        "name": "Coolant / mineral slate",
        "baseColor": [0.132, 0.262, 0.312, 1.0],
        "metallic": 0.22,
        "roughness": 0.46,
    },
]

MAT_INDEX: Dict[str, int] = {m["name"]: i for i, m in enumerate(MATERIALS)}

# Short aliases for ergonomic part construction
M_VERMILION = "Atlas / vermilion accent"
M_CHARCOAL = "Charcoal / soft enamel"
M_RECESS = "Recess / warm shadow"
M_SILVER = "Silver / warm satin"
M_SAGE = "Lid / sage grey"
M_PCB = "PCB / jade enamel"
M_BRASS = "Contacts / antique brass"
M_COPPER = "Copper / brushed heatpipe"
M_SILICON = "Silicon / mirror die"
M_SUBSTRATE = "Substrate / olive"
M_IVORY = "Porcelain / warm ivory"
M_CREAM = "Lettering / cream"
M_CHAMPAGNE = "Champagne / satin"
M_MOSS = "DGX / moss accent"
M_COOLANT = "Coolant / mineral slate"


class MeshBucket:
    """Collects non-indexed or indexed triangles per material within one semantic node."""

    def __init__(self) -> None:
        self.pos_chunks: List[np.ndarray] = []
        self.nrm_chunks: List[np.ndarray] = []
        self.idx_chunks: List[np.ndarray] = []
        self.vert_count = 0

    def append(self, pos: np.ndarray, nrm: np.ndarray, idx: np.ndarray) -> None:
        if len(pos) == 0 or len(idx) == 0:
            return
        self.pos_chunks.append(pos.astype(np.float32, copy=False))
        self.nrm_chunks.append(nrm.astype(np.float32, copy=False))
        self.idx_chunks.append(idx.astype(np.uint32, copy=False) + self.vert_count)
        self.vert_count += len(pos)

    def build(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        pos = np.vstack(self.pos_chunks)
        nrm = np.vstack(self.nrm_chunks)
        idx = np.concatenate(self.idx_chunks)
        return pos, nrm, idx


def _quad_mesh(quads: Sequence[Tuple[Sequence[float], Sequence[float], Sequence[float], Sequence[float]]]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Converts a list of (v0, v1, v2, v3) CCW quads into flat-shaded pos, nrm, idx arrays."""
    q = np.asarray(quads, dtype=np.float32)  # (N, 4, 3)
    e1 = q[:, 1] - q[:, 0]
    e2 = q[:, 3] - q[:, 0]
    n = np.cross(e1, e2)
    lengths = np.linalg.norm(n, axis=1, keepdims=True)
    n = np.divide(n, np.maximum(lengths, 1e-8))
    pos = q.reshape(-1, 3)
    nrm = np.repeat(n, 4, axis=0)
    base = (np.arange(len(q), dtype=np.uint32) * 4)[:, None]
    tri = np.array([0, 1, 2, 0, 2, 3], dtype=np.uint32)[None, :]
    idx = (base + tri).reshape(-1)
    return pos, nrm, idx


# Precompute unit box template for fast vectorized box emission
_UNIT_BOX_QUADS = [
    # +Z front
    ([-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]),
    # -Z back
    ([0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]),
    # +X right
    ([0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]),
    # -X left
    ([-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]),
    # +Y top
    ([-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]),
    # -Y bottom
    ([-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]),
]
_UNIT_BOX_POS, _UNIT_BOX_NRM, _UNIT_BOX_IDX = _quad_mesh(_UNIT_BOX_QUADS)


def _oct_ring(hx: float, hz: float, b: float, y: float) -> List[Tuple[float, float, float]]:
    """CCW 8-point octagonal ring in XZ at height y (viewed from +Y looking down: +Z -> +X)."""
    bx = min(b, hx * 0.45)
    bz = min(b, hz * 0.45)
    return [
        (-hx + bx, y, hz),
        (hx - bx, y, hz),
        (hx, y, hz - bz),
        (hx, y, -hz + bz),
        (hx - bx, y, -hz),
        (-hx + bx, y, -hz),
        (-hx, y, -hz + bz),
        (-hx, y, hz - bz),
    ]


# Vector stroke font (coordinates in [0..1] x [0..1], y=0 bottom, y=1 top)
_FONT: Dict[str, List[Tuple[float, float, float, float]]] = {
    "0": [(0.1, 0, 0.9, 0), (0.9, 0, 0.9, 1), (0.9, 1, 0.1, 1), (0.1, 1, 0.1, 0), (0.15, 0.15, 0.85, 0.85)],
    "1": [(0.5, 0, 0.5, 1), (0.25, 0.8, 0.5, 1), (0.2, 0, 0.8, 0)],
    "2": [(0.1, 0.85, 0.25, 1), (0.25, 1, 0.8, 1), (0.8, 1, 0.9, 0.75), (0.9, 0.75, 0.1, 0), (0.1, 0, 0.9, 0)],
    "3": [(0.1, 1, 0.9, 1), (0.9, 1, 0.9, 0), (0.1, 0.52, 0.85, 0.52), (0.1, 0, 0.9, 0)],
    "4": [(0.15, 1, 0.15, 0.45), (0.15, 0.45, 0.9, 0.45), (0.72, 0, 0.72, 1)],
    "5": [(0.9, 1, 0.15, 1), (0.15, 1, 0.15, 0.52), (0.15, 0.52, 0.88, 0.52), (0.88, 0.52, 0.88, 0), (0.88, 0, 0.12, 0)],
    "6": [(0.85, 1, 0.15, 1), (0.15, 1, 0.15, 0), (0.15, 0, 0.88, 0), (0.88, 0, 0.88, 0.5), (0.88, 0.5, 0.15, 0.5)],
    "7": [(0.1, 1, 0.9, 1), (0.9, 1, 0.35, 0)],
    "8": [(0.15, 0, 0.85, 0), (0.85, 0, 0.85, 1), (0.85, 1, 0.15, 1), (0.15, 1, 0.15, 0), (0.15, 0.5, 0.85, 0.5)],
    "9": [(0.15, 0, 0.85, 0), (0.85, 0, 0.85, 1), (0.85, 1, 0.15, 1), (0.15, 1, 0.15, 0.5), (0.15, 0.5, 0.85, 0.5)],
    "A": [(0.1, 0, 0.5, 1), (0.5, 1, 0.9, 0), (0.25, 0.38, 0.75, 0.38)],
    "B": [(0.15, 0, 0.15, 1), (0.15, 1, 0.8, 1), (0.8, 1, 0.85, 0.52), (0.15, 0.52, 0.85, 0.52), (0.85, 0.52, 0.85, 0), (0.85, 0, 0.15, 0)],
    "C": [(0.9, 0.85, 0.75, 1), (0.75, 1, 0.2, 1), (0.2, 1, 0.1, 0.8), (0.1, 0.8, 0.1, 0.2), (0.1, 0.2, 0.2, 0), (0.2, 0, 0.88, 0)],
    "D": [(0.15, 0, 0.15, 1), (0.15, 1, 0.72, 1), (0.72, 1, 0.9, 0.72), (0.9, 0.72, 0.9, 0.28), (0.9, 0.28, 0.72, 0), (0.72, 0, 0.15, 0)],
    "E": [(0.88, 1, 0.15, 1), (0.15, 1, 0.15, 0), (0.15, 0.52, 0.75, 0.52), (0.15, 0, 0.88, 0)],
    "F": [(0.88, 1, 0.15, 1), (0.15, 1, 0.15, 0), (0.15, 0.52, 0.75, 0.52)],
    "G": [(0.88, 1, 0.15, 1), (0.15, 1, 0.15, 0), (0.15, 0, 0.88, 0), (0.88, 0, 0.88, 0.48), (0.52, 0.48, 0.88, 0.48)],
    "H": [(0.15, 0, 0.15, 1), (0.85, 0, 0.85, 1), (0.15, 0.5, 0.85, 0.5)],
    "I": [(0.25, 1, 0.75, 1), (0.5, 0, 0.5, 1), (0.25, 0, 0.75, 0)],
    "K": [(0.15, 0, 0.15, 1), (0.85, 1, 0.2, 0.48), (0.32, 0.55, 0.88, 0)],
    "L": [(0.15, 1, 0.15, 0), (0.15, 0, 0.88, 0)],
    "M": [(0.1, 0, 0.1, 1), (0.1, 1, 0.5, 0.42), (0.5, 0.42, 0.9, 1), (0.9, 1, 0.9, 0)],
    "N": [(0.15, 0, 0.15, 1), (0.15, 1, 0.85, 0), (0.85, 0, 0.85, 1)],
    "O": [(0.15, 0, 0.85, 0), (0.85, 0, 0.85, 1), (0.85, 1, 0.15, 1), (0.15, 1, 0.15, 0)],
    "P": [(0.15, 0, 0.15, 1), (0.15, 1, 0.85, 1), (0.85, 1, 0.85, 0.52), (0.85, 0.52, 0.15, 0.52)],
    "Q": [(0.15, 0.08, 0.82, 0.08), (0.82, 0.08, 0.82, 1), (0.82, 1, 0.15, 1), (0.15, 1, 0.15, 0.08), (0.55, 0.32, 0.92, 0)],
    "R": [(0.15, 0, 0.15, 1), (0.15, 1, 0.85, 1), (0.85, 1, 0.85, 0.52), (0.85, 0.52, 0.15, 0.52), (0.52, 0.52, 0.88, 0)],
    "S": [(0.88, 1, 0.15, 1), (0.15, 1, 0.15, 0.52), (0.15, 0.52, 0.85, 0.52), (0.85, 0.52, 0.85, 0), (0.85, 0, 0.12, 0)],
    "T": [(0.1, 1, 0.9, 1), (0.5, 0, 0.5, 1)],
    "U": [(0.15, 1, 0.15, 0.05), (0.15, 0.05, 0.85, 0.05), (0.85, 0.05, 0.85, 1)],
    "V": [(0.12, 1, 0.5, 0), (0.5, 0, 0.88, 1)],
    "W": [(0.08, 1, 0.28, 0), (0.28, 0, 0.5, 0.55), (0.5, 0.55, 0.72, 0), (0.72, 0, 0.92, 1)],
    "X": [(0.12, 0, 0.88, 1), (0.12, 1, 0.88, 0)],
    "Z": [(0.12, 1, 0.88, 1), (0.88, 1, 0.12, 0), (0.12, 0, 0.88, 0)],
    "-": [(0.2, 0.5, 0.8, 0.5)],
    ".": [(0.42, 0, 0.58, 0.14)],
    "/": [(0.2, 0, 0.8, 1)],
    "+": [(0.5, 0.18, 0.5, 0.82), (0.2, 0.5, 0.8, 0.5)],
}


class NodeBuilder:
    """Semantic scene node with optional translation, extras, child nodes, and merged per-material primitives."""

    def __init__(
        self,
        name: str,
        translation: Optional[Sequence[float]] = None,
        extras: Optional[Dict] = None,
    ) -> None:
        self.name = name
        self.translation = list(translation) if translation is not None else None
        self.extras = extras
        self.buckets: Dict[str, MeshBucket] = {}
        self.children: List["NodeBuilder"] = []

    def child(
        self,
        name: str,
        translation: Optional[Sequence[float]] = None,
        extras: Optional[Dict] = None,
    ) -> "NodeBuilder":
        c = NodeBuilder(name, translation=translation, extras=extras)
        self.children.append(c)
        return c

    def _bucket(self, mat: str) -> MeshBucket:
        assert mat in MAT_INDEX, f"Unknown material: {mat}"
        b = self.buckets.get(mat)
        if b is None:
            b = MeshBucket()
            self.buckets[mat] = b
        return b

    def add_box(self, mat: str, cx: float, cy: float, cz: float, sx: float, sy: float, sz: float) -> None:
        pos = _UNIT_BOX_POS * np.array([sx, sy, sz], dtype=np.float32) + np.array([cx, cy, cz], dtype=np.float32)
        self._bucket(mat).append(pos, _UNIT_BOX_NRM, _UNIT_BOX_IDX)

    def add_boxes_grid(
        self,
        mat: str,
        centers: np.ndarray,
        sx: float,
        sy: float,
        sz: float,
    ) -> None:
        """Fast vectorized batch emission of many identical-sized boxes."""
        if len(centers) == 0:
            return
        n = len(centers)
        scaled = _UNIT_BOX_POS * np.array([sx, sy, sz], dtype=np.float32)
        pos = (scaled[None, :, :] + centers[:, None, :]).reshape(-1, 3)
        nrm = np.tile(_UNIT_BOX_NRM, (n, 1))
        offsets = (np.arange(n, dtype=np.uint32) * len(_UNIT_BOX_POS))[:, None]
        idx = (offsets + _UNIT_BOX_IDX[None, :]).reshape(-1)
        self._bucket(mat).append(pos, nrm, idx)

    def add_chamfer_box(
        self,
        mat: str,
        cx: float,
        cy: float,
        cz: float,
        sx: float,
        sy: float,
        sz: float,
        bevel: float = 0.014,
    ) -> None:
        hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
        by = min(bevel, hy * 0.45)
        b_xz = min(bevel, hx * 0.45, hz * 0.45)
        r0 = _oct_ring(hx - b_xz * 0.85, hz - b_xz * 0.85, b_xz * 0.6, -hy)
        r1 = _oct_ring(hx, hz, b_xz, -hy + by)
        r2 = _oct_ring(hx, hz, b_xz, hy - by)
        r3 = _oct_ring(hx - b_xz * 0.85, hz - b_xz * 0.85, b_xz * 0.6, hy)

        quads = []
        for ring_a, ring_b in [(r0, r1), (r1, r2), (r2, r3)]:
            for i in range(8):
                j = (i + 1) % 8
                quads.append((ring_a[i], ring_a[j], ring_b[j], ring_b[i]))
        # Top cap (2 quads covering the 8-gon)
        quads.append((r3[0], r3[1], r3[2], r3[7]))
        quads.append((r3[7], r3[2], r3[3], r3[6]))
        quads.append((r3[6], r3[3], r3[4], r3[5]))
        # Bottom cap (reversed winding)
        quads.append((r0[7], r0[2], r0[1], r0[0]))
        quads.append((r0[6], r0[3], r0[2], r0[7]))
        quads.append((r0[5], r0[4], r0[3], r0[6]))

        pos, nrm, idx = _quad_mesh(quads)
        pos = pos + np.array([cx, cy, cz], dtype=np.float32)
        self._bucket(mat).append(pos, nrm, idx)

    def add_cylinder(
        self,
        mat: str,
        cx: float,
        cy: float,
        cz: float,
        r0: float,
        r1: float,
        length: float,
        axis: str = "y",
        segs: int = 12,
        caps: bool = True,
    ) -> None:
        angles = np.linspace(0.0, 2.0 * math.pi, segs, endpoint=False)
        ca = np.cos(angles)
        sa = np.sin(angles)
        hl = length * 0.5

        def to_vec(u: float, v: float, w: float) -> Tuple[float, float, float]:
            if axis == "y":
                return (cx + u, cy + w, cz + v)
            if axis == "z":
                return (cx + u, cy + v, cz - w)
            return (cx + w, cy + v, cz + u)

        def to_nrm(u: float, v: float, w: float) -> Tuple[float, float, float]:
            ln = math.sqrt(u * u + v * v + w * w) or 1.0
            u, v, w = u / ln, v / ln, w / ln
            if axis == "y":
                return (u, w, v)
            if axis == "z":
                return (u, v, -w)
            return (w, v, u)

        pos_list: List[Tuple[float, float, float]] = []
        nrm_list: List[Tuple[float, float, float]] = []
        idx_list: List[int] = []
        slope = (r0 - r1) / max(length, 1e-6)

        for i in range(segs):
            j = (i + 1) % segs
            b = len(pos_list)
            pos_list.extend(
                [
                    to_vec(r0 * ca[i], r0 * sa[i], -hl),
                    to_vec(r0 * ca[j], r0 * sa[j], -hl),
                    to_vec(r1 * ca[j], r1 * sa[j], hl),
                    to_vec(r1 * ca[i], r1 * sa[i], hl),
                ]
            )
            nrm_list.extend(
                [
                    to_nrm(ca[i], sa[i], slope),
                    to_nrm(ca[j], sa[j], slope),
                    to_nrm(ca[j], sa[j], slope),
                    to_nrm(ca[i], sa[i], slope),
                ]
            )
            idx_list.extend([b, b + 2, b + 1, b, b + 3, b + 2])

        if caps and r1 > 1e-6:
            c_idx = len(pos_list)
            pos_list.append(to_vec(0.0, 0.0, hl))
            nrm_list.append(to_nrm(0.0, 0.0, 1.0))
            for i in range(segs):
                pos_list.append(to_vec(r1 * ca[i], r1 * sa[i], hl))
                nrm_list.append(to_nrm(0.0, 0.0, 1.0))
            for i in range(segs):
                j = (i + 1) % segs
                idx_list.extend([c_idx, c_idx + 1 + j, c_idx + 1 + i])

        if caps and r0 > 1e-6:
            c_idx = len(pos_list)
            pos_list.append(to_vec(0.0, 0.0, -hl))
            nrm_list.append(to_nrm(0.0, 0.0, -1.0))
            for i in range(segs):
                pos_list.append(to_vec(r0 * ca[i], r0 * sa[i], -hl))
                nrm_list.append(to_nrm(0.0, 0.0, -1.0))
            for i in range(segs):
                j = (i + 1) % segs
                idx_list.extend([c_idx, c_idx + 1 + i, c_idx + 1 + j])

        self._bucket(mat).append(
            np.asarray(pos_list, dtype=np.float32),
            np.asarray(nrm_list, dtype=np.float32),
            np.asarray(idx_list, dtype=np.uint32),
        )

    def add_tube(
        self,
        mat: str,
        points: Sequence[Sequence[float]],
        radius: float,
        segs: int = 8,
        caps: bool = True,
    ) -> None:
        pts = np.asarray(points, dtype=np.float32)
        if len(pts) < 2:
            return
        tangents = np.zeros_like(pts)
        tangents[0] = pts[1] - pts[0]
        tangents[-1] = pts[-1] - pts[-2]
        for i in range(1, len(pts) - 1):
            tangents[i] = pts[i + 1] - pts[i - 1]
        tangents /= np.maximum(np.linalg.norm(tangents, axis=1, keepdims=True), 1e-6)

        # Parallel transport frame
        t0 = tangents[0]
        up = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        if abs(float(np.dot(t0, up))) > 0.9:
            up = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        n0 = np.cross(t0, up)
        n0 /= np.linalg.norm(n0)
        b0 = np.cross(t0, n0)

        angles = np.linspace(0.0, 2.0 * math.pi, segs, endpoint=False)
        ca = np.cos(angles)
        sa = np.sin(angles)

        rings_pos = []
        rings_nrm = []
        cur_n = n0
        cur_b = b0
        for i, p in enumerate(pts):
            if i > 0:
                ti = tangents[i]
                cur_n = cur_n - ti * float(np.dot(cur_n, ti))
                ln = float(np.linalg.norm(cur_n))
                if ln < 1e-5:
                    cur_n = b0
                else:
                    cur_n = cur_n / ln
                cur_b = np.cross(ti, cur_n)
            ring_n = ca[:, None] * cur_n[None, :] + sa[:, None] * cur_b[None, :]
            rings_nrm.append(ring_n)
            rings_pos.append(p[None, :] + radius * ring_n)

        pos_arr = np.vstack(rings_pos).astype(np.float32)
        nrm_arr = np.vstack(rings_nrm).astype(np.float32)
        idx_list: List[int] = []
        for r in range(len(pts) - 1):
            base0 = r * segs
            base1 = (r + 1) * segs
            for s in range(segs):
                sn = (s + 1) % segs
                idx_list.extend(
                    [
                        base0 + s,
                        base0 + sn,
                        base1 + sn,
                        base0 + s,
                        base1 + sn,
                        base1 + s,
                    ]
                )
        pos_list = list(pos_arr)
        nrm_list = list(nrm_arr)
        if caps:
            # Start cap
            c0 = len(pos_list)
            pos_list.append(pts[0])
            nrm_list.append(-tangents[0])
            for s in range(segs):
                pos_list.append(rings_pos[0][s])
                nrm_list.append(-tangents[0])
            for s in range(segs):
                sn = (s + 1) % segs
                idx_list.extend([c0, c0 + 1 + sn, c0 + 1 + s])
            # End cap
            c1 = len(pos_list)
            pos_list.append(pts[-1])
            nrm_list.append(tangents[-1])
            for s in range(segs):
                pos_list.append(rings_pos[-1][s])
                nrm_list.append(tangents[-1])
            for s in range(segs):
                sn = (s + 1) % segs
                idx_list.extend([c1, c1 + 1 + s, c1 + 1 + sn])

        self._bucket(mat).append(
            np.asarray(pos_list, dtype=np.float32),
            np.asarray(nrm_list, dtype=np.float32),
            np.asarray(idx_list, dtype=np.uint32),
        )

    def add_text(
        self,
        mat: str,
        text: str,
        cx: float,
        cy: float,
        cz: float,
        height: float = 0.075,
        thickness: float = 0.008,
        plane: str = "xz",
        stroke_w: Optional[float] = None,
    ) -> None:
        """Vector stroke lettering lying on 'xz' (top surface, +Z down or readable from front) or 'xy' (front bezel)."""
        text = text.upper()
        eff_t = max(thickness, 0.007)
        sw = stroke_w or max(0.007, height * 0.13)
        char_w = height * 0.66
        gap = height * 0.22
        total_w = len(text) * char_w + max(0, len(text) - 1) * gap
        start_x = -total_w * 0.5
        quads = []
        for idx, ch in enumerate(text):
            ox = start_x + idx * (char_w + gap)
            segs = _FONT.get(ch, [])
            for x0, y0, x1, y1 in segs:
                px0, py0 = ox + x0 * char_w, (y0 - 0.5) * height
                px1, py1 = ox + x1 * char_w, (y1 - 0.5) * height
                dx, dy = px1 - px0, py1 - py0
                ln = math.hypot(dx, dy) or 1.0
                nx, ny = -dy / ln * (sw * 0.5), dx / ln * (sw * 0.5)
                tx, ty = dx / ln * (sw * 0.35), dy / ln * (sw * 0.35)
                a0 = (px0 - tx + nx, py0 - ty + ny)
                a1 = (px0 - tx - nx, py0 - ty - ny)
                a2 = (px1 + tx - nx, py1 + ty - ny)
                a3 = (px1 + tx + nx, py1 + ty + ny)
                if plane == "xz":
                    # Readable from +Z looking towards -Z: u -> +X, v -> -Z
                    y_top = cy + eff_t
                    quads.append(
                        (
                            (cx + a1[0], y_top, cz - a1[1]),
                            (cx + a2[0], y_top, cz - a2[1]),
                            (cx + a3[0], y_top, cz - a3[1]),
                            (cx + a0[0], y_top, cz - a0[1]),
                        )
                    )
                elif plane == "xy":
                    # Front bezel (+Z normal): u -> +X, v -> +Y
                    z_front = cz + eff_t
                    quads.append(
                        (
                            (cx + a1[0], cy + a1[1], z_front),
                            (cx + a2[0], cy + a2[1], z_front),
                            (cx + a3[0], cy + a3[1], z_front),
                            (cx + a0[0], cy + a0[1], z_front),
                        )
                    )
        if quads:
            pos, nrm, idx_arr = _quad_mesh(quads)
            self._bucket(mat).append(pos, nrm, idx_arr)

    def add_fan_rotor(
        self,
        cx: float,
        cy: float,
        cz: float,
        size: float,
        depth: float,
        blades: int = 7,
        latch_mat: Optional[str] = M_VERMILION,
    ) -> None:
        """High-detail hot-swap server fan module with chamfered housing, hub, pitched blades, stator & latch."""
        hs = size * 0.5
        hd = depth * 0.5
        wall = size * 0.085
        # Outer shroud frame (4 non-overlapping walls)
        self.add_chamfer_box(M_CHARCOAL, cx, cy + hs - wall * 0.5, cz, size, wall, depth, bevel=0.006)
        self.add_chamfer_box(M_CHARCOAL, cx, cy - hs + wall * 0.5, cz, size, wall, depth, bevel=0.006)
        self.add_chamfer_box(M_CHARCOAL, cx - hs + wall * 0.5, cy, cz, wall, size - wall * 2.02, depth, bevel=0.006)
        self.add_chamfer_box(M_CHARCOAL, cx + hs - wall * 0.5, cy, cz, wall, size - wall * 2.02, depth, bevel=0.006)
        # Inner dark circular bore ring
        bore_r = hs - wall * 0.85
        self.add_cylinder(M_RECESS, cx, cy, cz, bore_r, bore_r, depth * 0.82, axis="z", segs=16, caps=False)
        # Central motor hub + brushed cap
        hub_r = bore_r * 0.34
        self.add_cylinder(M_SAGE, cx, cy, cz + hd * 0.08, hub_r, hub_r * 0.94, depth * 0.62, axis="z", segs=14)
        self.add_cylinder(M_SILVER, cx, cy, cz + hd * 0.42, hub_r * 0.48, hub_r * 0.48, 0.016, axis="z", segs=12)
        # Pitched impeller blades
        quads = []
        for b in range(blades):
            ang = (2.0 * math.pi * b) / blades
            r_in = hub_r * 0.92
            r_out = bore_r * 0.93
            a0 = ang - 0.16
            a1 = ang + 0.22
            b0 = ang + 0.08
            b1 = ang + 0.44
            z_front = cz + depth * 0.24
            z_back = cz - depth * 0.18
            p0 = (cx + r_in * math.cos(a0), cy + r_in * math.sin(a0), z_front)
            p1 = (cx + r_out * math.cos(b0), cy + r_out * math.sin(b0), z_front * 0.5 + cz * 0.5)
            p2 = (cx + r_out * math.cos(b1), cy + r_out * math.sin(b1), z_back)
            p3 = (cx + r_in * math.cos(a1), cy + r_in * math.sin(a1), z_back * 0.7 + cz * 0.3)
            quads.append((p0, p1, p2, p3))
            # Backside of blade so both sides have true outward normals
            quads.append((p3, p2, p1, p0))
        pos, nrm, idx = _quad_mesh(quads)
        self._bucket(M_SAGE).append(pos, nrm, idx)
        # Front finger guard cross-bars (staggered in Z so center intersection never Z-fights)
        self.add_box(M_SILVER, cx, cy, cz + hd + 0.006, bore_r * 1.84, 0.012, 0.010)
        self.add_box(M_SILVER, cx, cy, cz + hd + 0.012, 0.012, bore_r * 1.84, 0.010)
        # Top hot-swap finger tab
        if latch_mat:
            self.add_chamfer_box(latch_mat, cx, cy + hs + 0.022, cz + hd * 0.35, size * 0.36, 0.042, depth * 0.36, bevel=0.006)


def export_glb(root: NodeBuilder, out_path: pathlib.Path) -> Dict:
    """Serializes a NodeBuilder hierarchy into a valid glTF 2.0 binary (.glb) with merged material child meshes."""
    used_materials: List[str] = []
    used_mat_map: Dict[str, int] = {}

    def mat_id(name: str) -> int:
        if name not in used_mat_map:
            used_mat_map[name] = len(used_materials)
            used_materials.append(name)
        return used_mat_map[name]

    nodes_json: List[Dict] = []
    meshes_json: List[Dict] = []
    accessors_json: List[Dict] = []
    buffer_views_json: List[Dict] = []
    bin_chunks: List[bytes] = []
    byte_offset = 0

    def push_bytes(raw: bytes, target: int) -> int:
        nonlocal byte_offset
        pad = (4 - (len(raw) % 4)) % 4
        if pad:
            raw = raw + (b"\x00" * pad)
        bv_idx = len(buffer_views_json)
        buffer_views_json.append(
            {
                "buffer": 0,
                "byteOffset": byte_offset,
                "byteLength": len(raw),
                "target": target,
            }
        )
        bin_chunks.append(raw)
        byte_offset += len(raw)
        return bv_idx

    def add_mesh_primitive(mat_name: str, bucket: MeshBucket, node_label: str) -> int:
        pos, nrm, idx = bucket.build()
        pos_bv = push_bytes(pos.tobytes(), 34962)  # ARRAY_BUFFER
        nrm_bv = push_bytes(nrm.tobytes(), 34962)
        use_u16 = len(pos) < 65535
        idx_arr = idx.astype(np.uint16 if use_u16 else np.uint32)
        idx_bv = push_bytes(idx_arr.tobytes(), 34963)  # ELEMENT_ARRAY_BUFFER

        pos_acc = len(accessors_json)
        accessors_json.append(
            {
                "bufferView": pos_bv,
                "componentType": 5126,
                "count": int(len(pos)),
                "type": "VEC3",
                "min": [float(x) for x in pos.min(axis=0)],
                "max": [float(x) for x in pos.max(axis=0)],
            }
        )
        nrm_acc = len(accessors_json)
        accessors_json.append(
            {
                "bufferView": nrm_bv,
                "componentType": 5126,
                "count": int(len(nrm)),
                "type": "VEC3",
            }
        )
        idx_acc = len(accessors_json)
        accessors_json.append(
            {
                "bufferView": idx_bv,
                "componentType": 5123 if use_u16 else 5125,
                "count": int(len(idx_arr)),
                "type": "SCALAR",
            }
        )
        mesh_idx = len(meshes_json)
        meshes_json.append(
            {
                "name": node_label,
                "primitives": [
                    {
                        "attributes": {"POSITION": pos_acc, "NORMAL": nrm_acc},
                        "indices": idx_acc,
                        "material": mat_id(mat_name),
                    }
                ],
            }
        )
        return mesh_idx

    def emit_node(nb: NodeBuilder) -> int:
        child_indices: List[int] = []
        # Emit one child mesh node per material (matches original Blender export convention!)
        for mat_name in sorted(nb.buckets.keys()):
            bucket = nb.buckets[mat_name]
            if bucket.vert_count == 0:
                continue
            m_label = f"{nb.name} / {mat_name}"
            m_idx = add_mesh_primitive(mat_name, bucket, m_label)
            c_idx = len(nodes_json)
            nodes_json.append({"name": m_label, "mesh": m_idx})
            child_indices.append(c_idx)

        for ch in nb.children:
            child_indices.append(emit_node(ch))

        node_obj: Dict = {"name": nb.name}
        if nb.translation is not None:
            node_obj["translation"] = [round(float(x), 5) for x in nb.translation]
        if nb.extras is not None:
            node_obj["extras"] = nb.extras
        if child_indices:
            node_obj["children"] = child_indices
        my_idx = len(nodes_json)
        nodes_json.append(node_obj)
        return my_idx

    root_idx = emit_node(root)
    materials_json = []
    for m_name in used_materials:
        spec = MATERIALS[MAT_INDEX[m_name]]
        materials_json.append(
            {
                "name": m_name,
                "doubleSided": True,
                "pbrMetallicRoughness": {
                    "baseColorFactor": spec["baseColor"],
                    "metallicFactor": spec["metallic"],
                    "roughnessFactor": spec["roughness"],
                },
            }
        )

    bin_blob = b"".join(bin_chunks)
    pad_bin = (4 - (len(bin_blob) % 4)) % 4
    if pad_bin:
        bin_blob += b"\x00" * pad_bin

    gltf = {
        "asset": {"version": "2.0", "generator": "infer-lab hardware-glb 2.0"},
        "scene": 0,
        "scenes": [{"name": "Scene", "nodes": [root_idx]}],
        "nodes": nodes_json,
        "meshes": meshes_json,
        "materials": materials_json,
        "accessors": accessors_json,
        "bufferViews": buffer_views_json,
        "buffers": [{"byteLength": len(bin_blob)}],
    }

    json_bytes = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    pad_json = (4 - (len(json_bytes) % 4)) % 4
    if pad_json:
        json_bytes += b" " * pad_json

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_blob)
    header = struct.pack("<III", 0x46546C67, 2, total_len)
    json_header = struct.pack("<II", len(json_bytes), 0x4E4F534A)
    bin_header = struct.pack("<II", len(bin_blob), 0x004E4942)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(header + json_header + json_bytes + bin_header + bin_blob)

    total_verts = sum(a["count"] for a in accessors_json if a["type"] == "VEC3" and "min" in a)
    total_tris = sum(a["count"] // 3 for a in accessors_json if a["type"] == "SCALAR")
    return {
        "file": out_path.name,
        "bytes": total_len,
        "nodes": len(nodes_json),
        "meshes": len(meshes_json),
        "materials": len(materials_json),
        "vertices": total_verts,
        "triangles": total_tris,
    }
