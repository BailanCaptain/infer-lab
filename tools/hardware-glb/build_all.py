"""Builds all 9 high-detail hardware .glb models into public/experiences/whole/assets/."""

from __future__ import annotations

import hashlib
import json
import math
import pathlib
import struct
from typing import Dict, List, Optional, Sequence
import numpy as np

from glb_core import (
    M_BRASS,
    M_CHAMPAGNE,
    M_CHARCOAL,
    M_COOLANT,
    M_COPPER,
    M_CREAM,
    M_IVORY,
    M_MOSS,
    M_PCB,
    M_RECESS,
    M_SAGE,
    M_SILICON,
    M_SILVER,
    M_SUBSTRATE,
    M_VERMILION,
    NodeBuilder,
    export_glb,
)
from parts_lib import (
    add_osfp_bank,
    add_qsfp_bank,
    build_drive_bay,
    build_grace_superchip_cpu,
    build_host_board,
    build_oam_module,
    build_open_fan_wall,
    build_pcie_300i_duo_card,
    build_pcie_h100_nvl_card,
    build_psu_bank,
)

ASSETS_DIR = pathlib.Path(__file__).resolve().parents[2] / "public" / "experiences" / "whole" / "assets"


def _add_chassis_shell(
    root: NodeBuilder,
    prefix: str,
    width: float,
    height: float,
    depth: float,
    lid_label_text: str,
    accent_mat: str = M_VERMILION,
    front_style: str = "atlas_4u",
) -> NodeBuilder:
    """Builds detailed server chassis lower tub, rack ears, side rails, front bezel, rear bulkhead, and removable top lid."""
    hw = width * 0.5
    hd = depth * 0.5
    wall = 0.065
    floor_h = 0.075

    # Bottom structural pan + internal cross-bulkhead stiffeners (inset inside Sage side walls)
    root.add_chamfer_box(M_CHARCOAL, 0.0, floor_h * 0.5, 0.0, width - 0.30, floor_h, depth - 0.14, bevel=0.010)
    for bz in (-hd * 0.35, hd * 0.25):
        root.add_box(M_SILVER, 0.0, floor_h + 0.018, bz, width - 0.34, 0.032, 0.08)

    # Left & right double-wall side panels + telescopic slide-rail channels
    side_h = height - 0.08
    for sx in (-1.0, 1.0):
        wx = sx * (hw - 0.11)
        root.add_chamfer_box(M_SAGE, wx, side_h * 0.5 + 0.02, 0.04, wall, side_h, depth - 0.30, bevel=0.008)
        # Slide rail inner bar + locking clip (strictly stepped X layers)
        root.add_chamfer_box(M_SILVER, sx * (hw - 0.056), height * 0.44, -0.25, 0.040, 0.22, depth * 0.72, bevel=0.006)
        root.add_box(M_CHARCOAL, sx * (hw - 0.030), height * 0.44, 0.85, 0.012, 0.085, 0.42)
        # Front 19-inch rack mounting ear + captive thumbscrews + pull handle
        ear_x = sx * (hw + 0.045)
        ear_z = hd - 0.06
        root.add_chamfer_box(M_SILVER, ear_x, height * 0.5, ear_z, 0.17, height * 0.94, 0.055, bevel=0.008)
        for ky in (0.22, 0.78):
            root.add_cylinder(M_CHARCOAL, ear_x, height * ky, ear_z + 0.055, 0.036, 0.036, 0.052, axis="z", segs=10)
            root.add_cylinder(M_SILVER, ear_x, height * ky, ear_z + 0.091, 0.022, 0.022, 0.020, axis="z", segs=8)
        # Front pull-loop handle on outer edge of ear + status LED pips beside it (non-overlapping XY)
        root.add_chamfer_box(M_CHARCOAL, ear_x + sx * 0.026, height * 0.5, ear_z + 0.085, 0.042, min(0.62, height * 0.36), 0.11, bevel=0.006)
        if sx > 0:
            for li, lmat in enumerate((M_MOSS, M_CHAMPAGNE, accent_mat)):
                root.add_box(lmat, ear_x - 0.042, height * 0.5 + (li - 1) * 0.075, ear_z + 0.035, 0.028, 0.024, 0.014)

    # Rear structural frame pillars & top perimeter header (leaves rear optical/PCIe/PSU bays completely open!)
    rz = -hd + 0.05
    root.add_box(M_SILVER, -hw + 0.16, side_h * 0.5 + 0.02, rz, 0.14, side_h, 0.08)
    root.add_box(M_SILVER, hw - 0.16, side_h * 0.5 + 0.02, rz, 0.14, side_h, 0.08)
    root.add_box(M_SILVER, 0.0, height - 0.11, rz, width - 0.62, 0.08, 0.08)
    # Rear upper PCIe expansion slot ventilated brackets on tall 8U/10U chassis (above I/O bay)
    if height >= 3.0:
        for bi in range(3):
            bx = 1.28 + bi * 0.24
            by = height - 0.48
            root.add_chamfer_box(M_SILVER, bx, by, rz - 0.01, 0.18, 0.42, 0.028, bevel=0.004)
            vents = np.array([[bx, by + (r - 2) * 0.068, rz - 0.028] for r in range(5)], dtype=np.float32)
            root.add_boxes_grid(M_RECESS, vents, 0.12, 0.026, 0.008)

    # Front sculpted bezel (+Z)
    fz = hd
    if front_style == "dgx_8u":
        # Sculpted DGX H100 split champagne-gold hexagonal louver bezel
        root.add_chamfer_box(M_CHARCOAL, 0.0, height * 0.52, fz - 0.04, width - 0.22, height * 0.92, 0.09, bevel=0.014)
        root.add_chamfer_box(M_CHAMPAGNE, 0.0, height * 0.62, fz + 0.022, width - 0.28, height * 0.64, 0.034, bevel=0.012)
        # Hex/diamond architectural louver pockets across champagne bezel
        pts = []
        for r in range(7):
            y = height * 0.36 + r * 0.27
            for c in range(16):
                x = (c - 7.5) * 0.255 + (0.12 if r % 2 else 0.0)
                if abs(x) < (hw - 0.34) and not (x < -0.78 and y > height * 0.72) and not (x > 1.75 and y > height * 0.76):
                    pts.append([x, y, fz + 0.044])
        root.add_boxes_grid(M_RECESS, np.asarray(pts, dtype=np.float32), 0.165, 0.155, 0.010)
        root.add_chamfer_box(M_CHARCOAL, -1.45, height * 0.84, fz + 0.052, 1.15, 0.22, 0.024, bevel=0.006)
        root.add_text(M_CHAMPAGNE, "DGX H100", -1.45, height * 0.84, fz + 0.064, height=0.095, thickness=0.008, plane="xy")
        root.add_box(M_MOSS, 1.92, height * 0.84, fz + 0.046, 0.14, 0.055, 0.014)
    elif front_style == "dgx_b200_10u":
        # Tall 10U DGX B200 three-tier champagne-gold geometric honeycomb fascia
        root.add_chamfer_box(M_CHARCOAL, 0.0, height * 0.51, fz - 0.03, width - 0.22, height * 0.94, 0.08, bevel=0.014)
        for zy, zh in ((height * 0.77, height * 0.34), (height * 0.36, height * 0.34)):
            root.add_chamfer_box(M_CHAMPAGNE, 0.0, zy, fz + 0.022, width - 0.30, zh, 0.026, bevel=0.010)
            pts = [
                [x + (0.11 if r % 2 else 0.0), y, fz + 0.041]
                for r, y in enumerate(np.linspace(zy - zh * 0.36, zy + zh * 0.36, 5))
                for x in np.linspace(-hw + 0.44, hw - 0.44, 15)
            ]
            root.add_boxes_grid(M_RECESS, np.asarray(pts, dtype=np.float32), 0.175, 0.135, 0.010)
        mid_y = height * 0.565
        root.add_chamfer_box(M_CHARCOAL, 0.0, mid_y, fz + 0.032, width - 0.28, 0.30, 0.042, bevel=0.008)
        root.add_box(M_MOSS, 0.0, mid_y + 0.125, fz + 0.059, width - 0.36, 0.024, 0.012)
        root.add_text(M_CHAMPAGNE, "NVIDIA DGX B200", -0.88, mid_y, fz + 0.053, height=0.102, thickness=0.008, plane="xy")
        root.add_text(M_CREAM, "BLACKWELL NVLINK 5", 1.18, mid_y, fz + 0.053, height=0.066, thickness=0.008, plane="xy")
    elif front_style == "gb200_1u":
        # Ultra-dense 1U GB200 NVL72 Compute Tray header strip (leaves lower/side front open for QDCs, OSFP & E1.S)
        root.add_chamfer_box(M_CHARCOAL, 0.0, height * 0.80, fz + 0.012, width - 0.24, 0.16, 0.055, bevel=0.006)
        root.add_box(M_CHAMPAGNE, 0.0, height * 0.90, fz + 0.046, width - 0.32, 0.020, 0.012)
        root.add_text(M_CHAMPAGNE, "GB200 NVL72 TRAY", -1.12, height * 0.77, fz + 0.040, height=0.058, thickness=0.007, plane="xy")
        root.add_text(M_CREAM, "2X GRACE + 4X B200 DLC", 1.05, height * 0.77, fz + 0.040, height=0.050, thickness=0.007, plane="xy")
    elif front_style == "nvidia_4u_pcie":
        # Enterprise 4U NVIDIA-certified H100 NVL PCIe inference server bezel
        root.add_chamfer_box(M_CHARCOAL, 0.0, height * 0.63, fz - 0.02, width - 0.24, height * 0.60, 0.07, bevel=0.012)
        root.add_chamfer_box(M_SILVER, 0.0, height * 0.61, fz + 0.025, width - 0.34, height * 0.44, 0.022, bevel=0.008)
        pts = [
            [x, y, fz + 0.042]
            for y in np.linspace(height * 0.45, height * 0.77, 4)
            for x in np.linspace(-hw + 0.40, hw - 0.40, 15)
            if not (x < -0.42 and abs(y - height * 0.62) < 0.16)
        ]
        root.add_boxes_grid(M_RECESS, np.asarray(pts, dtype=np.float32), 0.18, 0.090, 0.010)
        root.add_box(M_CHAMPAGNE, 0.0, height * 0.90, fz + 0.024, width - 0.32, 0.030, 0.016)
        root.add_chamfer_box(M_CHARCOAL, -1.20, height * 0.62, fz + 0.048, 1.56, 0.22, 0.024, bevel=0.006)
        root.add_text(M_CHAMPAGNE, "H100 NVL PCIE", -1.20, height * 0.62, fz + 0.060, height=0.082, thickness=0.008, plane="xy")
    elif front_style == "atlas_10u":
        # Tall 10U Atlas 800I A3 Supernode fascia: upper LAAC condenser intake + middle telemetry bar + lower accelerator intake
        root.add_chamfer_box(M_CHARCOAL, 0.0, height * 0.50, fz - 0.03, width - 0.22, height * 0.94, 0.08, bevel=0.014)
        # Upper condenser & lower accelerator louver grilles
        for zone_y, zh in ((height * 0.75, height * 0.34), (height * 0.27, height * 0.30)):
            root.add_chamfer_box(M_SILVER, 0.0, zone_y, fz + 0.022, width - 0.32, zh, 0.024, bevel=0.010)
            pts = [
                [x, y, fz + 0.039]
                for y in np.linspace(zone_y - zh * 0.38, zone_y + zh * 0.38, 6)
                for x in np.linspace(-hw + 0.42, hw - 0.42, 15)
            ]
            root.add_boxes_grid(M_RECESS, np.asarray(pts, dtype=np.float32), 0.19, 0.11, 0.010)
        # Central telemetry & branding trim bar with dual vermilion & slate coolant stripes
        mid_y = height * 0.51
        root.add_chamfer_box(M_CHARCOAL, 0.0, mid_y, fz + 0.032, width - 0.28, 0.32, 0.044, bevel=0.008)
        root.add_box(M_VERMILION, 0.0, mid_y + 0.13, fz + 0.060, width - 0.36, 0.028, 0.012)
        root.add_box(M_COOLANT, 0.0, mid_y - 0.13, fz + 0.060, width - 0.36, 0.024, 0.012)
        root.add_text(M_CREAM, "ATLAS 800I A3", -0.82, mid_y, fz + 0.054, height=0.105, thickness=0.008, plane="xy")
        root.add_text(M_CHAMPAGNE, "LINGQU UB + LAAC", 1.15, mid_y, fz + 0.054, height=0.068, thickness=0.008, plane="xy")
    elif front_style == "atlas_2u":
        # Sleek 2U Atlas 800 (Model 3000) enterprise bezel framing the 12-drive bay
        root.add_chamfer_box(M_CHARCOAL, 0.0, height * 0.80, fz + 0.01, width - 0.24, 0.22, 0.06, bevel=0.008)
        root.add_box(M_VERMILION, 0.0, height * 0.89, fz + 0.046, width - 0.32, 0.024, 0.012)
        root.add_text(M_CREAM, "ATLAS 800 3000", -1.15, height * 0.77, fz + 0.040, height=0.068, thickness=0.008, plane="xy")
        root.add_text(M_SILVER, "300I DUO X4", 1.25, height * 0.77, fz + 0.040, height=0.060, thickness=0.008, plane="xy")
    elif front_style == "ascend_950":
        # Architectural 4U Ascend 950DT bezel with copper + vermilion dual horizon trim & fine intake matrix
        root.add_chamfer_box(M_CHARCOAL, 0.0, height * 0.62, fz - 0.02, width - 0.24, height * 0.62, 0.07, bevel=0.012)
        pts = [
            [x, y, fz + 0.020]
            for y in np.linspace(height * 0.40, height * 0.80, 5)
            for x in np.linspace(-hw + 0.38, hw - 0.38, 16)
            if not (x < -0.45 and abs(y - height * 0.60) < 0.16)
        ]
        root.add_boxes_grid(M_RECESS, np.asarray(pts, dtype=np.float32), 0.18, 0.092, 0.010)
        root.add_box(M_COPPER, 0.0, height * 0.915, fz + 0.022, width - 0.30, 0.024, 0.014)
        root.add_box(M_VERMILION, -1.35, height * 0.880, fz + 0.024, 1.15, 0.022, 0.018)
        root.add_chamfer_box(M_CHARCOAL, -1.25, height * 0.60, fz + 0.028, 1.48, 0.22, 0.026, bevel=0.006)
        root.add_text(M_CREAM, "ASCEND 950DT", -1.25, height * 0.60, fz + 0.041, height=0.088, thickness=0.008, plane="xy")
    else:
        # Classic 4U Huawei Atlas 800T A2 two-tier sculpted bezel (upper intake louver + vermilion accent, lower 10-drive recess)
        root.add_chamfer_box(M_CHARCOAL, 0.0, height * 0.64, fz - 0.02, width - 0.24, height * 0.58, 0.07, bevel=0.012)
        root.add_chamfer_box(M_SILVER, 0.0, height * 0.62, fz + 0.026, width - 0.34, height * 0.44, 0.022, bevel=0.008)
        pts = [
            [x, y, fz + 0.042]
            for y in np.linspace(height * 0.46, height * 0.78, 4)
            for x in np.linspace(-hw + 0.40, hw - 0.40, 15)
            if not (x < -0.50 and abs(y - height * 0.64) < 0.16)
        ]
        root.add_boxes_grid(M_RECESS, np.asarray(pts, dtype=np.float32), 0.185, 0.090, 0.010)
        root.add_box(M_VERMILION, 0.0, height * 0.90, fz + 0.023, width - 0.32, 0.032, 0.016)
        root.add_chamfer_box(M_CHARCOAL, -1.28, height * 0.64, fz + 0.050, 1.42, 0.22, 0.024, bevel=0.006)
        root.add_text(M_CREAM, "ATLAS 800T A2", -1.28, height * 0.64, fz + 0.062, height=0.082, thickness=0.008, plane="xy")

    # Removable Top Service Lid (kind='lid', hidden at level===2!)
    lid = root.child(
        f"{prefix}_lid",
        extras={"kind": "lid", "label": "机箱上盖", "explodeZ": 3.0},
    )
    lid_y = height - 0.022
    lid.add_chamfer_box(M_SAGE, 0.0, lid_y, -0.04, width - 0.26, 0.044, depth - 0.22, bevel=0.010)
    # Stamped structural stiffening ribs & recessed T-latch service handle (non-overlapping Z zones)
    for rz_rib in (-depth * 0.28, -depth * 0.05, depth * 0.24):
        lid.add_chamfer_box(M_SILVER, 0.0, height + 0.006, rz_rib, width - 0.72, 0.012, 0.24, bevel=0.005)
    lid.add_box(M_RECESS, 0.0, height + 0.005, depth * 0.11, 0.68, 0.010, 0.24)
    lid.add_chamfer_box(M_SILVER, 0.0, height + 0.018, depth * 0.11, 0.52, 0.016, 0.11, bevel=0.005)
    lid.add_box(accent_mat, 0.0, height + 0.005, depth * 0.40, 0.24, 0.010, 0.045)
    lid.add_text(M_CREAM, lid_label_text, 0.0, height, depth * 0.33, height=0.115, thickness=0.008, plane="xz")
    return lid


def build_cabinet_42u() -> Dict:
    """Builds upgraded 42U exhibition rack with perforated mesh door, EIA U-rails, split side panels, rear PDUs & cable raceways."""
    cab = NodeBuilder(
        "Cabinet_42U",
        extras={
            "kind": "rack",
            "label": "42U 展示机柜",
            "description": "通用 42U 标准 19 英寸服务器机柜示意，含打孔网门、EIA 立柱导轨、双路竖装 PDU 与背部理线槽。装机数量为展示编排。",
        },
    )
    # Base plinth + 4 leveling feet + top roof canopy with brush cable entries & exhaust fan grilles
    cab.add_chamfer_box(M_CHARCOAL, 0.0, 0.22, 0.0, 6.24, 0.42, 10.80, bevel=0.025)
    cab.add_box(M_RECESS, 0.0, -0.06, 0.0, 5.72, 0.18, 9.60)
    for fx in (-2.75, 2.75):
        for fz in (-4.85, 4.85):
            cab.add_cylinder(M_SILVER, fx, -0.10, fz, 0.14, 0.18, 0.20, axis="y", segs=12)
    cab.add_chamfer_box(M_CHARCOAL, 0.0, 19.52, 0.0, 6.26, 0.48, 10.82, bevel=0.025)
    # Top header brand plate
    cab.add_text(M_CREAM, "AI INFRA RACK 42U", 0.0, 19.52, 5.41, height=0.16, thickness=0.009, plane="xy")
    # Roof dual fan grilles + rear cable brush openings (strictly stacked Y layers: 19.760 -> 19.774 -> 19.786 -> 19.798)
    for rx in (-1.35, 1.35):
        cab.add_cylinder(M_RECESS, rx, 19.767, 0.4, 0.85, 0.85, 0.014, axis="y", segs=16)
        cab.add_box(M_SILVER, rx, 19.780, 0.4, 1.62, 0.012, 0.04)
        cab.add_box(M_SILVER, rx, 19.792, 0.4, 0.04, 0.012, 1.62)
    cab.add_box(M_RECESS, 0.0, 19.767, -3.95, 4.20, 0.014, 0.75)

    # 4 corner structural vertical posts + front/rear top/bottom crossbeams
    for px in (-2.96, 2.96):
        for pz in (-5.22, 5.22):
            cab.add_chamfer_box(M_CHARCOAL, px, 9.88, pz, 0.32, 19.0, 0.34, bevel=0.015)

    # Split upper/lower sage-grey removable side panels with non-overlapping seam, slam-latches & louver vents
    for sx in (-1.0, 1.0):
        px = sx * 3.04
        for py, ph in ((5.12, 8.88), (14.48, 8.96)):
            cab.add_chamfer_box(M_SAGE, px, py, 0.0, 0.09, ph, 10.02, bevel=0.015)
            # 2 flush slam-latches near top of each half-panel (proud of ±3.085 outer panel face)
            for lz in (-2.6, 2.6):
                cab.add_chamfer_box(M_CHARCOAL, px + sx * 0.053, py + ph * 0.38, lz, 0.016, 0.28, 0.48, bevel=0.005)
                cab.add_box(M_SILVER, px + sx * 0.066, py + ph * 0.38, lz, 0.010, 0.12, 0.24)
        # Side panel horizontal seam shadow groove seated in the [9.56, 10.00] gap between panels
        cab.add_box(M_RECESS, px, 9.78, 0.0, 0.07, 0.38, 10.00)
        # Upper & lower side ventilation louver arrays (centered cleanly away from slam-latches)
        louvers = [
            [px + sx * 0.051, ly, lz]
            for ly in (3.20, 12.60)
            for lz in np.linspace(-3.9, -1.6, 12)
        ]
        cab.add_boxes_grid(M_RECESS, np.asarray(louvers, dtype=np.float32), 0.012, 0.72, 0.085)

    # 4 Internal EIA-310 19-inch Mounting Rails with cage-nut holes & U-tick marks + shelf support L-brackets
    for rx in (-2.48, 2.48):
        for rz in (-4.15, 4.22):
            cab.add_box(M_SILVER, rx, 9.88, rz, 0.14, 18.75, 0.16)
            # Cage-nut square holes every 1U (42 ticks)
            holes = np.array([[rx, 0.75 + u * 0.4445, rz + (0.075 if rz > 0 else -0.075)] for u in range(42)], dtype=np.float32)
            cab.add_boxes_grid(M_RECESS, holes, 0.055, 0.12, 0.025)
            # Cream silkscreen U markers every 6U on front rails
            if rz > 0:
                for u_mark in range(6, 43, 6):
                    cab.add_box(M_CHAMPAGNE, rx, 0.75 + u_mark * 0.4445 - 0.12, rz + 0.082, 0.11, 0.025, 0.012)

    # Rear Dual Vertical Metered PDUs & Optical/DAC Cable Management Raceways!
    for sx, trunk_mat in ((-1.0, M_COPPER), (1.0, M_COOLANT)):
        pdu_x = sx * 2.72
        cab.add_chamfer_box(M_CHARCOAL, pdu_x, 9.85, -4.82, 0.24, 17.8, 0.20, bevel=0.010)
        # Breaker + OLED meter window in middle of PDU
        cab.add_box(M_VERMILION, pdu_x, 10.2, -4.70, 0.14, 0.28, 0.04)
        cab.add_box(M_COOLANT, pdu_x, 9.55, -4.70, 0.15, 0.42, 0.03)
        # 24 C13/C19 power outlets along PDU
        outlets = np.array(
            [[pdu_x, y, -4.71] for y in np.linspace(1.6, 17.9, 24) if abs(y - 9.85) > 0.75],
            dtype=np.float32,
        )
        cab.add_boxes_grid(M_IVORY, outlets, 0.13, 0.22, 0.03)
        cab.add_boxes_grid(M_BRASS, outlets + np.array([0.0, 0.0, 0.012], dtype=np.float32), 0.08, 0.09, 0.015)
        # Vertical bundled cable trunk with Velcro cable-ties along z = -4.45
        for c_off in (-0.045, 0.0, 0.045):
            cab.add_cylinder(trunk_mat, sx * 2.60 + c_off, 9.85, -4.46, 0.026, 0.026, 17.4, axis="y", segs=8)
        ties = np.array([[sx * 2.60, y, -4.46] for y in np.linspace(1.8, 17.6, 14)], dtype=np.float32)
        cab.add_boxes_grid(M_CHARCOAL, ties, 0.16, 0.06, 0.10)

    # Hinged Front Perforated Mesh Door (pivot at [-3.0, 0.5, 5.38], opens via rotation.y = -Math.PI * 0.40)
    door = cab.child(
        "Cabinet_door",
        translation=[-3.0, 0.5, 5.38],
        extras={"kind": "door", "label": "机柜前门"},
    )
    # Extruded beveled door stiles & rails (x in [0.04, 5.96], y in [0.0, 18.65])
    door.add_chamfer_box(M_CHARCOAL, 0.18, 9.32, 0.0, 0.28, 18.68, 0.16, bevel=0.012)
    door.add_chamfer_box(M_CHARCOAL, 5.82, 9.32, 0.0, 0.28, 18.68, 0.16, bevel=0.012)
    door.add_chamfer_box(M_CHARCOAL, 3.00, 0.16, 0.0, 5.40, 0.30, 0.16, bevel=0.012)
    door.add_chamfer_box(M_CHARCOAL, 3.00, 18.48, 0.0, 5.40, 0.30, 0.16, bevel=0.012)
    # Champagne inner architectural bezel strips
    door.add_box(M_CHAMPAGNE, 0.34, 9.32, 0.02, 0.038, 18.12, 0.08)
    door.add_box(M_CHAMPAGNE, 5.66, 9.32, 0.02, 0.038, 18.12, 0.08)
    # 3 Heavy-duty barrel hinges along left stile (x = 0.03)
    for hy in (2.2, 9.32, 16.45):
        door.add_cylinder(M_SILVER, 0.03, hy, 0.02, 0.068, 0.068, 0.48, axis="y", segs=12)
        door.add_cylinder(M_BRASS, 0.03, hy, 0.02, 0.076, 0.076, 0.06, axis="y", segs=12)
    # Right-side swing-handle lock escutcheon + key cylinder
    door.add_chamfer_box(M_RECESS, 5.82, 9.32, 0.06, 0.20, 1.38, 0.08, bevel=0.008)
    door.add_chamfer_box(M_CHAMPAGNE, 5.82, 9.38, 0.12, 0.12, 1.06, 0.075, bevel=0.008)
    door.add_cylinder(M_VERMILION, 5.82, 8.76, 0.11, 0.042, 0.042, 0.05, axis="z", segs=10)
    # Fine Cross-Woven Architectural Perforated Lattice Mesh (distinct Z thicknesses so 0.008 clearance on both ±Z!)
    h_ribs = np.array([[3.00, y, 0.0] for y in np.linspace(0.55, 18.08, 40)], dtype=np.float32)
    v_ribs = np.array([[x, 9.32, 0.0] for x in np.linspace(0.58, 5.42, 15)], dtype=np.float32)
    door.add_boxes_grid(M_CHARCOAL, h_ribs, 5.26, 0.030, 0.038)
    door.add_boxes_grid(M_SAGE, v_ribs, 0.026, 17.98, 0.022)

    return export_glb(cab, ASSETS_DIR / "cabinet-42u.glb")


def build_atlas_800t_a2() -> Dict:
    """Builds upgraded 4U Huawei Atlas 800T A2 while preserving 100% node & bounds contracts."""
    src = "https://e.huawei.com/cn/products/computing/ascend/atlas-800t-a2"
    root = NodeBuilder(
        "Atlas_800T_A2",
        extras={
            "label": "Huawei Atlas 800T A2",
            "scope": "whole exterior / stylized",
            "source": src,
            "platform": "ascend",
            "cpuCount": 4,
            "dimmCount": 32,
            "acceleratorCount": 8,
            "fanCount": 8,
            "psuCount": 4,
            "driveCount": 10,
        },
    )
    _add_chassis_shell(root, "Atlas_800T_A2", width=4.81, height=1.75, depth=8.45, lid_label_text="ATLAS 800T A2", accent_mat=M_VERMILION, front_style="atlas_4u")

    # NPU Carrier Board (kind='board', tr=[0, 0.16, 0.5]) + 8 NPU Modules (exact positions!)
    board = root.child(
        "Atlas_800T_A2_accelerator_board",
        translation=[0.0, 0.16, 0.50],
        extras={
            "kind": "board",
            "label": "NPU 载板",
            "explodeZ": 0.75,
            "explodeY": 0,
            "description": "承载 8 颗昇腾 NPU 模组的高速互联载板：白皮书标明每路处理器通过 7 条 HCCS 链路组成 8P Full Mesh（峰值 392 GB/s）。板面铜线为架构示意。",
            "source": src,
        },
    )
    board.add_chamfer_box(M_PCB, 0.0, 0.020, 0.0, 4.13, 0.060, 3.50, bevel=0.012)
    # Stylized HCCS board interconnect trace bus highways between front & rear rows
    for tx in (-1.5, -0.5, 0.5, 1.5):
        board.add_box(M_BRASS, tx, 0.054, 0.58, 0.055, 0.008, 1.55)
    for tz in (-0.25, 0.58, 1.42):
        board.add_box(M_BRASS, 0.0, 0.054, tz, 3.20, 0.008, 0.048)
    # Perimeter polymer caps & mezzanine risers on carrier board
    for px in np.linspace(-1.85, 1.85, 12):
        board.add_cylinder(M_SILVER, px, 0.075, -1.62, 0.026, 0.026, 0.050, axis="y", segs=8)
    for bx in (-1.2, 0.0, 1.2):
        board.add_chamfer_box(M_CHARCOAL, bx, 0.080, -1.50, 0.52, 0.060, 0.14, bevel=0.006)
        board.add_box(M_BRASS, bx, 0.114, -1.50, 0.46, 0.008, 0.06)

    npu_slots = [
        (-1.5, 1.42),
        (-0.5, 1.42),
        (0.5, 1.42),
        (1.5, 1.42),
        (-1.5, -0.25),
        (-0.5, -0.25),
        (0.5, -0.25),
        (1.5, -0.25),
    ]
    for i, (nx, nz) in enumerate(npu_slots):
        build_oam_module(
            board,
            f"Atlas_800T_A2_accelerator_board_npu{i}",
            "npu",
            f"NPU 模组 {i + 1}",
            nx,
            0.09,
            nz,
            variant="910b",
            desc="昇腾 910B 系列 OAM 加速模组（64 GB HBM）：抬起 3D 均热板铜热管散热器与金属顶盖，可观察内部计算晶粒、4 颗 HBM 堆栈与多相 VRM 供电示意。",
            source=src,
            idx_1based=i + 1,
        )

    # Heavy Laminated Power Busbar (kind='bus', cleanly seated below accelerator_board)
    bus = root.child(
        "Atlas_800T_A2_busbar",
        translation=[0.0, 0.085, -0.10],
        extras={
            "kind": "bus",
            "label": "供电铜排",
            "explodeZ": 0.25,
            "explodeY": 0,
            "description": "连接后置热插拔电源与前部加速载板的大电流层叠紫铜/黄铜母排与绝缘端子。",
            "source": src,
        },
    )
    for bx in (-1.88, -0.62, 0.62, 1.88):
        bus.add_chamfer_box(M_COPPER, bx, 0.018, 0.0, 0.12, 0.028, 4.30, bevel=0.005)
        bus.add_box(M_BRASS, bx + 0.03, 0.037, 0.0, 0.06, 0.010, 4.18)
        for bz in (-1.9, -0.8, 0.8, 1.9):
            bus.add_cylinder(M_SILVER, bx, 0.047, bz, 0.024, 0.024, 0.010, axis="y", segs=8)
    bus.add_chamfer_box(M_CHARCOAL, 0.0, 0.026, -2.28, 3.92, 0.042, 0.18, bevel=0.006)

    # 10x 2.5" NVMe/SATA Drives + Backplane
    build_drive_bay(
        root,
        "Atlas_800T_A2",
        [0.0, 0.16, 3.72],
        count=10,
        total_w=3.74,
        caddy_h=0.22,
        source=src,
        desc="前部 10 个 2.5 英寸热插拔 NVMe/SATA 硬盘托架与背板 PCB。",
        accent_mat=M_VERMILION,
        explode_z=0.15,
        explode_y=-2.75,
    )

    # 8x Hot-Swap Counter-Rotating Fans in Open-Lattice Cage (4 columns x 2 tiers)
    build_open_fan_wall(
        root,
        "Atlas_800T_A2_fans",
        "风扇阵列",
        [0.0, 0.22, 3.16],
        col_xs=(-1.32, -0.44, 0.44, 1.32),
        row_ys=(0.34, 0.94),
        cage_w=3.68,
        cage_y0=0.0,
        cage_h=1.28,
        cage_d=0.44,
        rotor_size=0.58,
        rotor_depth=0.38,
        source=src,
        desc="8 个热插拔对旋风扇模组（支持 N+1 冗余），置于镂空导流金属笼架内，顶部带朱砂色免工具快拆提手。",
        top_latch_mat=M_VERMILION,
        explode_z=0.75,
        explode_y=-2.20,
    )

    # 4-Socket Kunpeng 920 + 32 DDR4 RDIMMs Host Board on upper rear deck
    build_host_board(
        root,
        "Atlas_800T_A2",
        [0.0, 0.92, -1.86],
        cpu_count=4,
        source=src,
        cpu_tag="KP920",
        cpu_desc="华为鲲鹏 920 处理器（4 路共 32 条 DDR4 插槽）：负责主机调度、请求编排与设备驱动。",
        ddr5=False,
        explode_z=2.35,
        explode_y=1.25,
    )

    # RoCE Direct-Out 8x 200GE QSFP56 Network & Management I/O Mezzanine
    net = root.child(
        "Atlas_800T_A2_network",
        translation=[0.0, 0.68, -3.56],
        extras={
            "kind": "network",
            "label": "RoCE 参数面接口",
            "explodeZ": 1.45,
            "explodeY": 1.85,
            "description": "整机提供 8 个 200GE QSFP56 RoCE 高速参数面直出光口（单口规格峰值 25 GB/s）及 iBMC/GE 管理接口。",
            "source": src,
        },
    )
    net.add_chamfer_box(M_PCB, 0.0, 0.0, -0.10, 3.86, 0.048, 0.50, bevel=0.008)
    add_qsfp_bank(net, np.linspace(-1.58, 0.66, 8), [0.11], z_face=-0.60, port_w=0.23, port_h=0.115, depth=0.36, tab_mat=M_VERMILION)
    # 4 Retimer heatsinks on network PCB
    for rx in (-1.35, -0.65, 0.05, 0.55):
        net.add_chamfer_box(M_COPPER, rx, 0.056, -0.06, 0.24, 0.064, 0.22, bevel=0.006)
    # Management I/O block (iBMC + dual RJ45 + VGA + dual USB) on right
    for mx in (1.18, 1.48):
        net.add_chamfer_box(M_SILVER, mx, 0.12, -0.44, 0.22, 0.16, 0.30, bevel=0.005)
        net.add_box(M_RECESS, mx, 0.12, -0.598, 0.16, 0.10, 0.016)

    # 4x 2.6kW Hot-Swap PSUs
    build_psu_bank(
        root,
        "Atlas_800T_A2",
        [0.0, 0.14, -3.72],
        count=4,
        total_w=3.84,
        psu_h=0.44,
        psu_d=0.92,
        source=src,
        desc="4 个 2.6 kW 热插拔电源模块（支持 2+2 冗余），含散热风扇网孔、C19 电源座与防脱拉手。",
        latch_mat=M_VERMILION,
        explode_z=0.25,
        explode_y=1.85,
    )

    return export_glb(root, ASSETS_DIR / "atlas-800t-a2.glb")


def build_atlas_800i_a3() -> Dict:
    """Builds NEW 10U Huawei Atlas 800I A3 Supernode Server (LingQu UB 784 GB/s + LAAC Liquid-Assisted Air Cooling + 64x 400GE)."""
    src = "https://e.huawei.com/cn/products/computing/ascend"
    root = NodeBuilder(
        "Atlas_800I_A3",
        extras={
            "label": "Huawei Atlas 800I A3",
            "scope": "whole exterior / stylized",
            "source": src,
            "platform": "ascend",
            "cpuCount": 4,
            "dimmCount": 32,
            "acceleratorCount": 8,
            "fanCount": 10,
            "psuCount": 6,
            "driveCount": 8,
        },
    )
    # 10U tall powerhouse: height = 4.42, depth = 9.0
    _add_chassis_shell(root, "Atlas_800I_A3", width=4.81, height=4.42, depth=9.00, lid_label_text="ATLAS 800I A3 10U", accent_mat=M_VERMILION, front_style="atlas_10u")

    # LingQu Interconnect Baseboard + 8x Dual-Die 128 GB NPU Modules in lower compute chamber
    board = root.child(
        "Atlas_800I_A3_accelerator_board",
        translation=[0.0, 0.24, 0.65],
        extras={
            "kind": "board",
            "label": "灵衢互联载板",
            "explodeZ": 0.75,
            "explodeY": 0,
            "description": "Atlas A3 超节点高速载板：单机 8 颗双晶粒模组（8×128 GB = 1 TB 显存），单模组支持 7 路灵衢互联 + 1 路 RoCE，双向互联带宽 784 GB/s。",
            "source": src,
        },
    )
    board.add_chamfer_box(M_PCB, 0.0, 0.025, 0.0, 4.18, 0.070, 3.75, bevel=0.014)
    # Dense LingQu differential bus mesh (staggered 2-layer Y heights so crossing traces never Z-fight!)
    for tz in (-0.35, 0.55, 1.45):
        board.add_box(M_BRASS, 0.0, 0.064, tz, 3.45, 0.008, 0.065)
    for tx in (-1.5, -0.5, 0.5, 1.5):
        board.add_box(M_COPPER, tx, 0.072, 0.45, 0.075, 0.008, 2.85)

    npu_slots = [
        (-1.5, 1.45),
        (-0.5, 1.45),
        (0.5, 1.45),
        (1.5, 1.45),
        (-1.5, -0.32),
        (-0.5, -0.32),
        (0.5, -0.32),
        (1.5, -0.32),
    ]
    for i, (nx, nz) in enumerate(npu_slots):
        build_oam_module(
            board,
            f"Atlas_800I_A3_npu{i}",
            "npu",
            f"A3 NPU 模组 {i + 1}",
            nx,
            0.095,
            nz,
            variant="a3_dual",
            desc="Atlas A3 超节点加速模组（128 GB 高带宽内存，3.2 TB/s）：采用微通道液冷冷板与双计算晶粒 + 8 堆栈存储架构示意。",
            source=src,
            idx_1based=i + 1,
        )

    # LAAC (Liquid-Assisted Air Cooling) Closed-Loop Thermal Module (kind='cooling') in upper chamber!
    cool = root.child(
        "Atlas_800I_A3_laac",
        translation=[0.0, 1.35, 0.55],
        extras={
            "kind": "cooling",
            "label": "LAAC 液冷辅助风冷回路",
            "explodeZ": 2.15,
            "explodeY": -0.15,
            "description": "封闭式液冷辅助风冷（LAAC）系统：储液泵组驱动冷却工质经红/蓝分液歧管进入 8 块 NPU 冷板吸热，再送往上部高密翅片冷凝器由风冷带走热量，适配通用风冷机房。",
            "source": src,
        },
    )
    # Open-frame multi-pass copper/aluminum condenser radiator block (exposes all 38 silver fins & copper tubes!)
    for sx in (-1.98, 1.98):
        cool.add_chamfer_box(M_CHARCOAL, sx, 1.95, 0.35, 0.14, 0.84, 2.52, bevel=0.012)
    for sy in (1.55, 2.35):
        for sz in (-0.86, 1.56):
            cool.add_chamfer_box(M_CHARCOAL, 0.0, sy, sz, 4.08, 0.06, 0.10, bevel=0.008)
    for ry in (1.72, 1.95, 2.18):
        for rz in (-0.45, 0.35, 1.15):
            cool.add_cylinder(M_COPPER, 0.0, ry, rz, 0.024, 0.024, 4.16, axis="x", segs=8)
    rad_fins = np.array([[x, 1.95, 0.35] for x in np.linspace(-1.84, 1.84, 38)], dtype=np.float32)
    cool.add_boxes_grid(M_SILVER, rad_fins, 0.014, 0.76, 2.38)
    # Copper U-bend return hairpins protruding on left/right end-tanks
    for ry in (1.72, 1.95, 2.18):
        for rz in (-0.45, 0.35, 1.15):
            cool.add_cylinder(M_COPPER, -2.09, ry, rz, 0.038, 0.038, 0.08, axis="x", segs=8)
            cool.add_cylinder(M_COPPER, 2.09, ry, rz, 0.038, 0.038, 0.08, axis="x", segs=8)
    # Dual Redundant Circulation Pumps + Stainless Reservoir Tank at rear of LAAC deck
    cool.add_cylinder(M_SILVER, -1.15, 1.82, -1.35, 0.28, 0.28, 1.35, axis="x", segs=16)
    cool.add_text(M_CHARCOAL, "LAAC TANK", -1.15, 2.10, -1.35, height=0.068, thickness=0.008, plane="xz")
    for px in (0.55, 1.35):
        cool.add_cylinder(M_CHARCOAL, px, 1.82, -1.35, 0.24, 0.24, 0.42, axis="z", segs=14)
        cool.add_cylinder(M_COPPER, px, 1.82, -1.08, 0.16, 0.16, 0.12, axis="z", segs=12)
    # Supply (Vermilion-Copper) & Return (Mineral Slate) horizontal manifolds + 16 vertical drop risers to the 8 NPUs!
    for row_z in (1.30, -0.47):
        cool.add_cylinder(M_VERMILION, 0.0, 0.62, row_z - 0.14, 0.052, 0.052, 3.65, axis="x", segs=12)
        cool.add_cylinder(M_COOLANT, 0.0, 0.78, row_z + 0.08, 0.052, 0.052, 3.65, axis="x", segs=12)
        for nx in (-1.5, -0.5, 0.5, 1.5):
            cool.add_tube(M_VERMILION, [(nx - 0.18, -0.47, row_z - 0.14), (nx - 0.18, 0.62, row_z - 0.14)], radius=0.026, segs=8)
            cool.add_tube(M_COOLANT, [(nx + 0.18, -0.47, row_z - 0.14), (nx + 0.18, 0.15, row_z + 0.08), (nx + 0.18, 0.78, row_z + 0.08)], radius=0.026, segs=8)
    # Main vertical trunk risers from manifolds up into condenser & pumps
    cool.add_tube(M_VERMILION, [(-1.78, 0.62, -0.61), (-1.78, 0.62, 1.16), (-1.78, 1.72, 1.16)], radius=0.048, segs=10)
    cool.add_tube(M_COOLANT, [(1.78, 0.78, 1.38), (1.78, 0.78, -1.35), (1.35, 1.65, -1.35)], radius=0.048, segs=10)

    # Multi-tier Open-Lattice Condenser & Chassis Fan Wall (5 upper condenser fans + 5 lower chassis fans)
    build_open_fan_wall(
        root,
        "Atlas_800I_A3_fans",
        "高风压风扇墙",
        [0.0, 0.32, 3.55],
        col_xs=[float(x) for x in np.linspace(-1.48, 1.48, 5)],
        row_ys=(1.05, 2.85),
        cage_w=3.96,
        cage_y0=0.45,
        cage_h=2.98,
        cage_d=0.48,
        rotor_size=0.70,
        rotor_depth=0.42,
        source=src,
        desc="支持冗余热插拔的双层镂空高静压风扇墙：上层吹透 LAAC 冷凝器翅片，下层冷却主板、存储与供电仓。",
        top_latch_mat=M_VERMILION,
        lower_latch_mat=M_COOLANT,
        explode_z=0.35,
        explode_y=-2.15,
    )

    # 8x NVMe Drives at front bottom
    build_drive_bay(
        root,
        "Atlas_800I_A3",
        [0.0, 0.18, 4.08],
        count=8,
        total_w=3.68,
        caddy_h=0.22,
        source=src,
        desc="前部 8 个热插拔 NVMe SSD 盘位与高速背板。",
        accent_mat=M_VERMILION,
        explode_z=0.05,
        explode_y=-2.70,
    )

    # 4-Socket Kunpeng 920 + 32 DDR5 Host Tray in upper-rear deck
    build_host_board(
        root,
        "Atlas_800I_A3",
        [0.0, 2.15, -2.05],
        cpu_count=4,
        source=src,
        cpu_tag="KP920",
        cpu_desc="4 路鲲鹏 920 处理器与 32 条 DDR5-5200 内存插槽，协同调度 1 TB 显存池。",
        ddr5=True,
        explode_z=3.25,
        explode_y=1.45,
    )

    # Rear Ultra-Dense 64-Port 400GE QSFP-DD Optical Interconnect Matrix (56 LingQu UB + 8 RoCE!)
    net = root.child(
        "Atlas_800I_A3_network",
        translation=[0.0, 1.05, -3.85],
        extras={
            "kind": "network",
            "label": "64口 400GE 灵衢与 RoCE 光阵列",
            "explodeZ": 1.35,
            "explodeY": 1.95,
            "description": "背部直出 56 个 400GE QSFP-DD 灵衢（UB）总线协议接口与 8 个 400GE QSFP-DD RoCE 接口，可无收敛接入超节点交换柜扩展至最大 384 卡。",
            "source": src,
        },
    )
    net.add_chamfer_box(M_CHARCOAL, 0.0, 0.48, 0.16, 4.02, 1.08, 0.56, bevel=0.012)
    net.add_box(M_PCB, 0.0, -0.09, 0.22, 3.92, 0.05, 0.62)
    # 4 rows x 14 columns = 56 LingQu UB 400GE QSFP-DD cages (mineral-slate pull tabs)
    ub_xs = np.linspace(-1.78, 1.78, 14)
    ub_ys = [0.06, 0.24, 0.42, 0.60]
    add_qsfp_bank(net, ub_xs, ub_ys, z_face=-0.62, port_w=0.22, port_h=0.11, depth=0.34, tab_mat=M_COOLANT)
    # Top row of 8x 400GE QSFP-DD RoCE ports (vermilion pull tabs)
    roce_xs = np.linspace(-1.55, 1.55, 8)
    add_qsfp_bank(net, roce_xs, [0.84], z_face=-0.62, port_w=0.26, port_h=0.12, depth=0.36, tab_mat=M_VERMILION)

    # 6x High-Efficiency AC/HVDC PSUs at rear bottom (low explodeZ so PSUs stay cleanly below optical array!)
    build_psu_bank(
        root,
        "Atlas_800I_A3",
        [0.0, 0.16, -3.96],
        count=6,
        total_w=3.96,
        psu_h=0.52,
        psu_d=0.96,
        source=src,
        desc="6 个高效率热插拔电源模块（支持 220VAC / 336HVDC 双输入，整机峰值输入 16.2 kW）。",
        latch_mat=M_VERMILION,
        explode_z=0.25,
        explode_y=1.95,
    )

    return export_glb(root, ASSETS_DIR / "atlas-800i-a3.glb")


def build_atlas_800_3000() -> Dict:
    """Builds NEW 2U Huawei Atlas 800 (Model 3000) Inference Server with 4x Atlas 300I Duo Full-Height Full-Length Dual-Chip PCIe Cards."""
    src = "https://e.huawei.com/cn/products/computing/ascend"
    root = NodeBuilder(
        "Atlas_800_3000",
        extras={
            "label": "Huawei Atlas 800 (型号 3000)",
            "scope": "whole exterior / stylized",
            "source": src,
            "platform": "ascend",
            "cpuCount": 2,
            "dimmCount": 32,
            "acceleratorCount": 4,
            "visibleDevices": 8,
            "fanCount": 4,
            "psuCount": 2,
            "driveCount": 12,
        },
    )
    # Sleek 2U chassis: height = 0.89, depth = 8.10
    _add_chassis_shell(root, "Atlas_800_3000", width=4.81, height=0.89, depth=8.10, lid_label_text="ATLAS 800 MODEL 3000", accent_mat=M_VERMILION, front_style="atlas_2u")

    # 12x 2.5" Front Hot-Swap Drives across 2U front bay
    build_drive_bay(
        root,
        "Atlas_800_3000",
        [0.0, 0.30, 3.68],
        count=12,
        total_w=3.96,
        caddy_h=0.40,
        source=src,
        desc="前部 12 个 2.5 英寸 SAS/SATA/NVMe 热插拔盘位与 RAID 背板。",
        accent_mat=M_VERMILION,
        explode_z=0.12,
        explode_y=-2.95,
    )

    # 4x 2U High-Speed Hot-Swap Fans in Open-Lattice Cage behind drive backplane
    build_open_fan_wall(
        root,
        "Atlas_800_3000_fans",
        "2U 热插拔风扇组",
        [0.0, 0.12, 2.75],
        col_xs=(-1.42, -0.47, 0.47, 1.42),
        row_ys=(0.33,),
        cage_w=3.88,
        cage_y0=0.0,
        cage_h=0.66,
        cage_d=0.42,
        rotor_size=0.56,
        rotor_depth=0.36,
        source=src,
        desc="4 个 2U 高风压热插拔风扇模组（N+1 冗余），为双路鲲鹏 CPU 与后置被动散热 PCIe 推理卡提供贯穿风道。",
        top_latch_mat=M_VERMILION,
        explode_z=0.70,
        explode_y=-2.60,
    )

    # Dual-Socket Kunpeng 920 + 32 DDR4 DIMM Host Motherboard in front-mid chassis!
    build_host_board(
        root,
        "Atlas_800_3000",
        [0.0, 0.11, 0.92],
        cpu_count=2,
        source=src,
        cpu_tag="KP920",
        cpu_desc="2 颗华为鲲鹏 920 多核处理器（共 32 个 DDR4 插槽），承载中心侧推理与多路并发预处理。",
        ddr5=False,
        explode_z=1.25,
        explode_y=0.0,
        board_z=2.35,
        cooler_h=0.22,
    )

    # Rear PCIe Gen4 Riser Matrix (kind='board') + 4x Atlas 300I Duo Full-Length Dual-Chip PCIe Cards!
    riser = root.child(
        "Atlas_800_3000_riser_board",
        translation=[0.0, 0.11, -1.58],
        extras={
            "kind": "board",
            "label": "PCIe Riser 扩展模组",
            "explodeZ": 1.85,
            "explodeY": 0.75,
            "description": "2U 横向 PCIe 4.0×16 Riser 转接桥架，将主板纵向插槽转为水平层叠仓位，容纳 4 张全高全长 Atlas 300I Duo 双芯推理卡。",
            "source": src,
        },
    )
    # Central & side Riser PCBs with golden x16 slots (placed cleanly outside PCIe card footprints)
    for rx in (-1.92, 0.06):
        riser.add_chamfer_box(M_PCB, rx, 0.30, 0.18, 0.055, 0.54, 1.95, bevel=0.006)
        riser.add_chamfer_box(M_SILVER, rx - 0.03, 0.59, 0.18, 0.11, 0.032, 1.98, bevel=0.005)
        for ry in (0.09, 0.42):
            riser.add_box(M_CHARCOAL, rx + 0.055, ry, 0.22, 0.055, 0.064, 0.86)
            riser.add_box(M_BRASS, rx + 0.088, ry, 0.22, 0.012, 0.038, 0.78)

    # 4x Atlas 300I Duo PCIe Cards (2 left stack + 2 right stack, non-overlapping closed & exploded Y tiers)
    card_slots = [
        (-1.26, 0.06, -0.18),
        (-1.26, 0.39, -0.18),
        (0.72, 0.06, -0.18),
        (0.72, 0.39, -0.18),
    ]
    for ci, (cx, cy, cz) in enumerate(card_slots):
        c_node = build_pcie_300i_duo_card(
            riser,
            f"Atlas_800_3000_card{ci}",
            ci + 1,
            cx,
            cy,
            cz,
            source=src,
        )
        c_node.extras["explodeZ"] = 0.35 if cy < 0.25 else 0.95

    # OCP 3.0 Network Mezzanine & Management Ports
    net = root.child(
        "Atlas_800_3000_network",
        translation=[0.0, 0.14, -3.55],
        extras={
            "kind": "network",
            "label": "OCP 网络与管理接口",
            "explodeZ": 0.75,
            "explodeY": 1.65,
            "description": "OCP 3.0 高速以太网扣卡（4×25GE SFP28）与 iBMC 远程管理、VGA/USB 维护接口。",
            "source": src,
        },
    )
    net.add_chamfer_box(M_PCB, -0.25, 0.04, 0.08, 1.35, 0.042, 0.56, bevel=0.006)
    add_qsfp_bank(net, [-0.68, -0.44, -0.20, 0.04], [0.12], z_face=-0.46, port_w=0.18, port_h=0.095, depth=0.28, tab_mat=M_COOLANT)
    net.add_chamfer_box(M_COPPER, -0.32, 0.095, 0.12, 0.32, 0.064, 0.28, bevel=0.005)

    # 2x 2000W 1+1 Redundant Hot-Swap PSUs on rear right
    build_psu_bank(
        root,
        "Atlas_800_3000",
        [1.52, 0.11, -3.54],
        count=2,
        total_w=1.32,
        psu_h=0.38,
        psu_d=0.92,
        source=src,
        desc="2 个 2000W 热插拔交流/直流电源模块（1+1 冗余备份）。",
        latch_mat=M_VERMILION,
        explode_z=0.35,
        explode_y=1.90,
    )

    return export_glb(root, ASSETS_DIR / "atlas-800-3000.glb")


def build_ascend_950dt() -> Dict:
    """Builds NEW 4U Ascend 950DT Architecture Showcase Node grounded in Huawei Ascend 950 Whitepaper."""
    src = "https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/%E6%98%87%E8%85%BE950%20NPU%E6%9E%B6%E6%9E%84%E7%99%BD%E7%9A%AE%E4%B9%A6.pdf"
    root = NodeBuilder(
        "Ascend_950DT_Node",
        extras={
            "label": "昇腾 950DT 架构节点",
            "scope": "architecture showcase / stylized",
            "source": src,
            "platform": "ascend",
            "cpuCount": 4,
            "dimmCount": 32,
            "acceleratorCount": 8,
            "fanCount": 8,
            "psuCount": 4,
            "driveCount": 8,
        },
    )
    _add_chassis_shell(root, "Ascend_950DT", width=4.81, height=1.75, depth=8.55, lid_label_text="ASCEND 950DT UMA", accent_mat=M_COPPER, front_style="ascend_950")

    # Unified Bus High-Speed Carrier Board + 8x Ascend 950DT UMA Modules
    board = root.child(
        "Ascend_950DT_accelerator_board",
        translation=[0.0, 0.16, 0.52],
        extras={
            "kind": "board",
            "label": "Unified Bus 互联载板",
            "explodeZ": 0.70,
            "explodeY": 0,
            "description": "面向昇腾 950DT 的 Unified Bus 高速互联承载板示意：白皮书列出单颗 950DT 具备 72 路 112 Gbps HiLink（18 端口，双向标称 2016 GB/s），并可与 UBoE（2×400G）、PCIe 5.0×16 共用端口。",
            "source": src,
        },
    )
    board.add_chamfer_box(M_PCB, 0.0, 0.022, 0.0, 4.16, 0.062, 3.58, bevel=0.012)
    # Unified Bus copper & brass differential mesh lanes (staggered Y heights so crossings never Z-fight!)
    for tz in np.linspace(-0.85, 1.55, 6):
        board.add_box(M_BRASS, 0.0, 0.057, tz, 3.55, 0.008, 0.036)
    for tx in np.linspace(-1.6, 1.6, 9):
        board.add_box(M_COPPER, tx, 0.065, 0.45, 0.036, 0.008, 2.65)

    npu_slots = [
        (-1.5, 1.42),
        (-0.5, 1.42),
        (0.5, 1.42),
        (1.5, 1.42),
        (-1.5, -0.25),
        (-0.5, -0.25),
        (0.5, -0.25),
        (1.5, -0.25),
    ]
    for i, (nx, nz) in enumerate(npu_slots):
        build_oam_module(
            board,
            f"Ascend_950DT_npu{i}",
            "npu",
            f"昇腾 950DT 模组 {i + 1}",
            nx,
            0.09,
            nz,
            variant="950dt",
            desc="依据《昇腾 950 NPU 架构白皮书》构建的 UMA 封装示意：2 颗计算晶粒（AI Die，含 Cube/Vector 子系统、128 MB L2、NDDMA）+ 2 颗通信晶粒（IO Die）+ 4 颗高速内存模块（144/96 GB，4 TB/s）。",
            source=src,
            idx_1based=i + 1,
        )

    # Hybrid Manifold Loop cleanly seated above the 8x 950DT modules (kind='cooling')
    cool = root.child(
        "Ascend_950DT_manifold",
        translation=[0.0, 1.04, 0.30],
        extras={
            "kind": "cooling",
            "label": "混冷分液歧管",
            "explodeZ": 2.15,
            "explodeY": -0.08,
            "description": "面向高热流密度多晶粒封装的冷板分液歧管示意（整机机箱与管路为风格化承载示意，非商用整机 CAD）。",
            "source": src,
        },
    )
    for rz, acc in ((1.15, M_VERMILION), (-0.52, M_COOLANT)):
        cool.add_cylinder(M_COPPER, 0.0, 0.12, rz, 0.042, 0.042, 3.72, axis="x", segs=12)
        for nx in (-1.5, -0.5, 0.5, 1.5):
            cool.add_cylinder(acc, nx, 0.04, rz, 0.032, 0.032, 0.12, axis="y", segs=10)
    cool.add_tube(M_COPPER, [(-1.86, 0.12, -0.52), (-1.86, 0.12, 1.15)], radius=0.042, segs=10)
    cool.add_tube(M_COOLANT, [(1.86, 0.12, 1.15), (1.86, 0.12, -0.68)], radius=0.040, segs=10)

    # 8x Front Hot-Swap Fans + 8x NVMe Drives
    build_drive_bay(
        root,
        "Ascend_950DT",
        [0.0, 0.16, 3.78],
        count=8,
        total_w=3.68,
        caddy_h=0.22,
        source=src,
        desc="前部 8 个 PCIe 5.0 NVMe 高速存储托架示意。",
        accent_mat=M_COPPER,
        explode_z=0.15,
        explode_y=-2.75,
    )
    build_open_fan_wall(
        root,
        "Ascend_950DT_fans",
        "风扇阵列",
        [0.0, 0.22, 3.20],
        col_xs=(-1.32, -0.44, 0.44, 1.32),
        row_ys=(0.34, 0.94),
        cage_w=3.68,
        cage_y0=0.0,
        cage_h=1.28,
        cage_d=0.44,
        rotor_size=0.58,
        rotor_depth=0.38,
        source=src,
        desc="8 个热插拔对旋风扇模组，辅助带走载板 VRM、内存与光模块热量。",
        top_latch_mat=M_COPPER,
        explode_z=0.75,
        explode_y=-2.25,
    )

    # 4-Socket Host Board + 32 DDR5 DIMMs on upper rear deck
    build_host_board(
        root,
        "Ascend_950DT",
        [0.0, 0.92, -1.88],
        cpu_count=4,
        source=src,
        cpu_tag="HOST CPU",
        cpu_desc="主机处理器与 DDR5 内存子系统（经 PCIe 5.0×16 128 GB/s 双向连接昇腾 950DT 设备）。",
        ddr5=True,
        explode_z=2.65,
        explode_y=1.35,
    )

    # Rear 18-Port Unified Bus / UBoE Optical Interconnect Shelf
    net = root.child(
        "Ascend_950DT_network",
        translation=[0.0, 0.68, -3.60],
        extras={
            "kind": "network",
            "label": "Unified Bus / UBoE 光互连组",
            "explodeZ": 1.45,
            "explodeY": 1.85,
            "description": "白皮书定义单芯片 72 路 112G HiLink 划分为 18 个 Unified Bus 端口（其中 2 口可共用 UBoE 2×400G，4 口可共用 PCIe 5.0×16）；出框速率受光模块约束。",
            "source": src,
        },
    )
    net.add_chamfer_box(M_PCB, 0.0, 0.0, -0.08, 3.92, 0.050, 0.50, bevel=0.008)
    # 18 optical cages (2 rows x 9 ports: 16 UB copper-tabbed + 2 UBoE slate-tabbed)
    ub9_xs = np.linspace(-1.68, 1.68, 9)
    add_qsfp_bank(net, ub9_xs, [0.09], z_face=-0.58, port_w=0.26, port_h=0.105, depth=0.34, tab_mat=M_COPPER)
    add_qsfp_bank(net, ub9_xs[:7], [0.24], z_face=-0.58, port_w=0.26, port_h=0.105, depth=0.34, tab_mat=M_COPPER)
    add_qsfp_bank(net, ub9_xs[7:], [0.24], z_face=-0.58, port_w=0.26, port_h=0.105, depth=0.34, tab_mat=M_COOLANT)

    # 4x Hot-Swap PSUs
    build_psu_bank(
        root,
        "Ascend_950DT",
        [0.0, 0.14, -3.78],
        count=4,
        total_w=3.86,
        psu_h=0.44,
        psu_d=0.92,
        source=src,
        desc="4 个高功率热插拔电源模块（整机外观为架构承载示意）。",
        latch_mat=M_COPPER,
        explode_z=0.25,
        explode_y=1.85,
    )

    return export_glb(root, ASSETS_DIR / "ascend-950dt.glb")


def build_dgx_h100() -> Dict:
    """Builds upgraded 8U NVIDIA DGX H100 with 8x H100 SXM5, 4x NVSwitch Gen3, Cedar-7 OSFP, 2x Xeon + 32 DDR5, 12 fans, 6 PSUs."""
    src = "https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html"
    root = NodeBuilder(
        "DGX_H100",
        extras={
            "label": "NVIDIA DGX H100",
            "scope": "whole exterior / stylized",
            "source": src,
            "platform": "nvidia",
            "cpuCount": 2,
            "dimmCount": 32,
            "acceleratorCount": 8,
            "nvswitchCount": 4,
            "fanCount": 12,
            "psuCount": 6,
            "driveCount": 8,
        },
    )
    # 8U chassis: height = 3.56, width = 4.81, depth = 9.20
    _add_chassis_shell(root, "DGX_H100", width=4.81, height=3.56, depth=9.20, lid_label_text="NVIDIA DGX H100", accent_mat=M_CHAMPAGNE, front_style="dgx_8u")

    # Delta GPU Baseboard Tray (kind='board') + 8x H100 SXM5 GPUs (cleanly ahead of NVSwitch crossbar!)
    board = root.child(
        "DGX_H100_accelerator_board",
        translation=[0.0, 0.22, 0.95],
        extras={
            "kind": "board",
            "label": "GPU 托盘",
            "explodeZ": 0.65,
            "explodeY": 0,
            "description": "DGX H100 GPU 基板托盘：承载 8 个 H100 SXM5 模组与 4 颗第三代 NVSwitch 互联芯片（机内 NVLink 总带宽 7.2 TB/s）。",
            "source": src,
        },
    )
    board.add_chamfer_box(M_PCB, 0.0, 0.024, 0.0, 4.16, 0.064, 3.90, bevel=0.014)
    # Golden NVLink differential trace highways to rear NVSwitch bank
    for tx in (-1.5, -0.5, 0.5, 1.5):
        board.add_box(M_CHAMPAGNE, tx, 0.060, 0.0, 0.062, 0.008, 3.50)

    gpu_slots = [
        (-1.5, 0.98),
        (-0.5, 0.98),
        (0.5, 0.98),
        (1.5, 0.98),
        (-1.5, -0.98),
        (-0.5, -0.98),
        (0.5, -0.98),
        (1.5, -0.98),
    ]
    for i, (gx, gz) in enumerate(gpu_slots):
        build_oam_module(
            board,
            f"DGX_H100_accelerator_board_gpu{i}",
            "gpu",
            f"H100 GPU 模组 {i + 1}",
            gx,
            0.09,
            gz,
            variant="h100_sxm5",
            desc="NVIDIA H100 SXM5 模组（80 GB HBM3）：抬起均热板热管散热器，可观察 GH100 计算晶粒与两侧 6 颗 HBM3 堆栈（5 颗启用 + 1 颗冗余位）示意。",
            source=src,
            idx_1based=i + 1,
        )

    # 4x NVSwitch Gen3 Modules on dedicated rear NVSwitch Mezzanine Plane (kind='nvswitch' — zero overlap with GPU tray!)
    nvs = root.child(
        "DGX_H100_nvswitch",
        translation=[0.0, 0.26, -1.52],
        extras={
            "kind": "nvswitch",
            "label": "NVSwitch 互联模组 ×4",
            "explodeZ": 1.25,
            "explodeY": 0.55,
            "description": "4 颗第三代 NVSwitch 芯片与铜底散热器，使本机 8 颗 H100 SXM5 组成全互连 NVLink 网络。",
            "source": src,
        },
    )
    nvs.add_chamfer_box(M_PCB, 0.0, 0.018, 0.0, 3.86, 0.042, 0.80, bevel=0.008)
    for ni, nx in enumerate((-1.38, -0.46, 0.46, 1.38)):
        nvs.add_chamfer_box(M_SUBSTRATE, nx, 0.052, 0.0, 0.56, 0.026, 0.52, bevel=0.006)
        nvs.add_chamfer_box(M_SILICON, nx, 0.078, 0.0, 0.28, 0.026, 0.26, bevel=0.004)
        # Low-profile copper + dual-heatpipe satin finned NVSwitch Gen3 cooler
        nvs.add_chamfer_box(M_COPPER, nx, 0.105, 0.0, 0.62, 0.024, 0.58, bevel=0.006)
        for hp_x in (-0.16, 0.16):
            nvs.add_tube(
                M_COPPER,
                [(nx + hp_x, 0.112, -0.26), (nx + hp_x, 0.22, -0.29), (nx + hp_x, 0.22, 0.29), (nx + hp_x, 0.112, 0.26)],
                radius=0.014,
                segs=8,
            )
        fins = np.array([[nx + x, 0.207, 0.0] for x in np.linspace(-0.29, 0.29, 14)], dtype=np.float32)
        nvs.add_boxes_grid(M_SILVER, fins, 0.011, 0.18, 0.58)
        nvs.add_chamfer_box(M_CHAMPAGNE, nx, 0.308, 0.0, 0.58, 0.022, 0.22, bevel=0.005)
        nvs.add_text(M_CHARCOAL, f"NVS{ni + 1}", nx, 0.319, 0.0, height=0.048, thickness=0.008, plane="xz")

    # Laminated 54V DC Copper Busbar Shelf bridging rear PSUs to Delta GPU Tray (kind='bus')
    bus = root.child(
        "DGX_H100_busbar",
        translation=[0.0, 0.88, -2.85],
        extras={
            "kind": "bus",
            "label": "54V 层叠紫铜供电母排",
            "explodeZ": 1.72,
            "explodeY": 0.95,
            "description": "连接后部 6 颗 3.3 kW 电源与前仓 GPU 托盘的 54V 大电流层叠紫铜汇流母排与绝缘夹具。",
            "source": src,
        },
    )
    bus.add_chamfer_box(M_CHARCOAL, 0.0, 0.016, 0.0, 3.62, 0.032, 0.38, bevel=0.006)
    for bi, bz_off in enumerate((-0.09, 0.09)):
        bus.add_chamfer_box(M_COPPER if bi == 0 else M_BRASS, 0.0, 0.052, bz_off, 3.48, 0.026, 0.095, bevel=0.004)
    for sx in (-1.35, -0.45, 0.45, 1.35):
        bus.add_chamfer_box(M_IVORY, sx, 0.076, 0.0, 0.12, 0.018, 0.30, bevel=0.004)

    # 8x U.2 NVMe Cache Drives in lower front bay
    build_drive_bay(
        root,
        "DGX_H100",
        [0.0, 0.20, 4.10],
        count=8,
        total_w=3.68,
        caddy_h=0.24,
        source=src,
        desc="8 个前部热插拔 U.2 NVMe 数据缓存盘位与背板。",
        accent_mat=M_CHAMPAGNE,
        explode_z=0.10,
        explode_y=-3.20,
    )

    # 12x Dual-Stage Hot-Swap Fans in Open-Lattice Cage (4 columns x 3 rows)
    build_open_fan_wall(
        root,
        "DGX_H100_fans",
        "风扇阵列",
        [0.0, 0.48, 3.52],
        col_xs=(-1.34, -0.45, 0.45, 1.34),
        row_ys=(0.38, 1.14, 1.90),
        cage_w=3.76,
        cage_y0=0.0,
        cage_h=2.28,
        cage_d=0.46,
        rotor_size=0.62,
        rotor_depth=0.40,
        source=src,
        desc="12 个高风量热插拔风扇模组（4×3 镂空阵列），分别覆盖 GPU 托盘仓与下部主机/网络仓。",
        top_latch_mat=M_CHAMPAGNE,
        explode_z=0.65,
        explode_y=-2.55,
    )

    # Upper/Rear Dual-Socket Xeon + 32 DDR5 Host Tray
    build_host_board(
        root,
        "DGX_H100",
        [0.0, 1.82, -2.05],
        cpu_count=2,
        source=src,
        cpu_tag="XEON",
        cpu_desc="2 颗 Intel Xeon Scalable 处理器与 32 个 DDR5 内存插槽。",
        ddr5=True,
        explode_z=2.35,
        explode_y=1.25,
    )

    # Cedar-7 Networking & OSFP InfiniBand Tray
    net = root.child(
        "DGX_H100_network",
        translation=[0.0, 1.18, -3.82],
        extras={
            "kind": "network",
            "label": "Cedar-7 OSFP 网络模组",
            "explodeZ": 1.35,
            "explodeY": 2.05,
            "description": "8 个单口/4 个双口 OSFP 400Gb/s InfiniBand / RoCE 计算网光口与双口管理网卡。",
            "source": src,
        },
    )
    net.add_chamfer_box(M_PCB, 0.0, 0.0, 0.14, 3.88, 0.048, 0.68, bevel=0.008)
    add_osfp_bank(net, np.linspace(-1.58, 1.58, 8), [0.14], z_face=-0.66, port_w=0.28, port_h=0.13, depth=0.38, tab_mat=M_CHAMPAGNE)
    for cx in (-1.2, -0.4, 0.4, 1.2):
        net.add_chamfer_box(M_SILVER, cx, 0.068, 0.18, 0.34, 0.075, 0.28, bevel=0.006)

    # 6x Hot-Swap PSUs at rear bottom
    build_psu_bank(
        root,
        "DGX_H100",
        [0.0, 0.16, -3.96],
        count=6,
        total_w=3.94,
        psu_h=0.48,
        psu_d=0.96,
        source=src,
        desc="6 个 3.3 kW 热插拔钛金电源模块，通过 54V 层叠母排向 GPU 托盘与主机仓供电。",
        latch_mat=M_MOSS,
        explode_z=0.25,
        explode_y=2.05,
    )

    return export_glb(root, ASSETS_DIR / "dgx-h100.glb")


def build_dgx_b200() -> Dict:
    """Builds NEW 10U NVIDIA DGX B200 with 8x B200 dual-reticle SXM, 2x 5th-Gen NVSwitch, 8x OSFP, 2x Xeon 8570, 15 fans, 6 PSUs."""
    src = "https://docs.nvidia.com/dgx/dgxb200-user-guide/introduction-to-dgxb200.html"
    root = NodeBuilder(
        "DGX_B200",
        extras={
            "label": "NVIDIA DGX B200",
            "scope": "whole exterior / stylized",
            "source": src,
            "platform": "nvidia",
            "cpuCount": 2,
            "dimmCount": 32,
            "acceleratorCount": 8,
            "nvswitchCount": 2,
            "fanCount": 15,
            "psuCount": 6,
            "driveCount": 8,
        },
    )
    _add_chassis_shell(root, "DGX_B200", width=4.81, height=4.42, depth=9.20, lid_label_text="NVIDIA DGX B200 10U", accent_mat=M_CHAMPAGNE, front_style="dgx_b200_10u")

    board = root.child(
        "DGX_B200_accelerator_board",
        translation=[0.0, 0.24, 0.92],
        extras={
            "kind": "board",
            "label": "Blackwell GPU 基板托盘",
            "explodeZ": 0.72,
            "explodeY": 0,
            "description": "DGX B200 高功率 GPU 托盘：承载 8 颗 B200 双光罩模组（整机 1,440 GB HBM3e），单卡 NVLink 5 双向带宽 1.8 TB/s。",
            "source": src,
        },
    )
    board.add_chamfer_box(M_PCB, 0.0, 0.025, 0.0, 4.18, 0.068, 3.92, bevel=0.014)
    for tx in (-1.5, -0.5, 0.5, 1.5):
        board.add_box(M_CHAMPAGNE, tx, 0.063, 0.0, 0.072, 0.008, 3.56)

    for i, (gx, gz) in enumerate([(-1.5, 0.98), (-0.5, 0.98), (0.5, 0.98), (1.5, 0.98), (-1.5, -0.98), (-0.5, -0.98), (0.5, -0.98), (1.5, -0.98)]):
        build_oam_module(
            board,
            f"DGX_B200_gpu{i}",
            "gpu",
            f"B200 GPU 模组 {i + 1}",
            gx,
            0.092,
            gz,
            variant="b200_sxm",
            desc="NVIDIA Blackwell B200 模组（180 GB HBM3e，8 TB/s）：采用 CoWoS-L 双光罩计算晶粒 + 10 TB/s NV-HBI 片间桥接与 8 颗 HBM3e 堆栈。",
            source=src,
            idx_1based=i + 1,
        )

    # 2x NVLink 5 Switch Modules (NVSwitch) delivering 14.4 TB/s aggregate NVLink 5 bandwidth
    nvs = root.child(
        "DGX_B200_nvswitch",
        translation=[0.0, 0.28, -1.55],
        extras={
            "kind": "nvswitch",
            "label": "NVLink 5 交换芯片模组（NVSwitch）×2",
            "explodeZ": 1.35,
            "explodeY": 0.55,
            "description": "2 颗 NVLink 5 交换芯片（NVSwitch）模组，支撑整机 8 颗 B200 达成 14.4 TB/s 全互连聚合带宽。",
            "source": src,
        },
    )
    nvs.add_chamfer_box(M_PCB, 0.0, 0.020, 0.0, 3.86, 0.044, 0.84, bevel=0.008)
    for ni, nx in enumerate((-0.95, 0.95)):
        nvs.add_chamfer_box(M_SUBSTRATE, nx, 0.056, 0.0, 0.88, 0.028, 0.62, bevel=0.006)
        nvs.add_chamfer_box(M_SILICON, nx, 0.084, 0.0, 0.46, 0.026, 0.34, bevel=0.004)
        nvs.add_chamfer_box(M_COPPER, nx, 0.114, 0.0, 0.96, 0.026, 0.66, bevel=0.006)
        fins = np.array([[nx + x, 0.232, 0.0] for x in np.linspace(-0.45, 0.45, 20)], dtype=np.float32)
        nvs.add_boxes_grid(M_SILVER, fins, 0.012, 0.21, 0.64)
        nvs.add_chamfer_box(M_CHAMPAGNE, nx, 0.348, 0.0, 0.86, 0.022, 0.28, bevel=0.005)
        nvs.add_text(M_CHARCOAL, f"NVLINK5 SW {ni + 1}", nx, 0.359, 0.0, height=0.046, thickness=0.008, plane="xz")

    bus = root.child(
        "DGX_B200_busbar",
        translation=[0.0, 0.98, -2.85],
        extras={"kind": "bus", "label": "54V 高功率供电母排", "explodeZ": 1.85, "explodeY": 0.95, "description": "承载千瓦级 B200 模组瞬态负载的 54V 层叠紫铜供电汇流排。", "source": src},
    )
    bus.add_chamfer_box(M_CHARCOAL, 0.0, 0.016, 0.0, 3.68, 0.032, 0.40, bevel=0.006)
    for bi, bz_off in enumerate((-0.095, 0.095)):
        bus.add_chamfer_box(M_COPPER if bi == 0 else M_BRASS, 0.0, 0.052, bz_off, 3.54, 0.028, 0.10, bevel=0.004)

    build_drive_bay(root, "DGX_B200", [0.0, 0.20, 4.10], count=8, total_w=3.68, caddy_h=0.24, source=src, desc="前部 8 个热插拔 U.2 / E.3 NVMe 高速缓存盘位。", accent_mat=M_CHAMPAGNE, explode_z=0.08, explode_y=-3.20)
    build_open_fan_wall(
        root,
        "DGX_B200_fans",
        "三层镂空风扇墙",
        [0.0, 0.38, 3.52],
        col_xs=[float(x) for x in np.linspace(-1.48, 1.48, 5)],
        row_ys=(0.98, 1.90, 2.82),
        cage_w=3.96,
        cage_y0=0.46,
        cage_h=2.88,
        cage_d=0.48,
        rotor_size=0.66,
        rotor_depth=0.42,
        source=src,
        desc="15 个热插拔对旋风扇模组（5×3 镂空阵列），为 10U 风冷 B200 散热塔与双路 Xeon 仓提供贯穿高风压。",
        top_latch_mat=M_CHAMPAGNE,
        lower_latch_mat=M_MOSS,
        explode_z=0.55,
        explode_y=-2.55,
    )
    build_host_board(root, "DGX_B200", [0.0, 2.25, -2.05], cpu_count=2, source=src, cpu_tag="XEON 8570", cpu_desc="2 颗 Intel Xeon Platinum 8570 处理器与 32 条 DDR5 主机内存。", ddr5=True, explode_z=2.95, explode_y=1.35)

    net = root.child(
        "DGX_B200_network",
        translation=[0.0, 1.28, -3.82],
        extras={"kind": "network", "label": "ConnectX-7 OSFP + BlueField-3 网络仓", "explodeZ": 1.42, "explodeY": 2.05, "description": "8 路 ConnectX-7 400Gb/s InfiniBand/以太网计算通道（OSFP 带散热齿光笼）与双 BlueField-3 DPU。", "source": src},
    )
    net.add_chamfer_box(M_PCB, 0.0, 0.0, 0.14, 3.90, 0.048, 0.68, bevel=0.008)
    add_osfp_bank(net, np.linspace(-1.58, 1.58, 8), [0.14], z_face=-0.66, port_w=0.28, port_h=0.13, depth=0.38, tab_mat=M_CHAMPAGNE)
    for cx in (-1.35, -0.45, 0.45, 1.35):
        net.add_chamfer_box(M_COPPER, cx, 0.070, 0.18, 0.36, 0.078, 0.30, bevel=0.006)

    build_psu_bank(root, "DGX_B200", [0.0, 0.16, -3.96], count=6, total_w=3.96, psu_h=0.50, psu_d=0.96, source=src, desc="6 个 3.3 kW 热插拔钛金电源模块，支撑 10U Blackwell 整机高功耗运行。", latch_mat=M_MOSS, explode_z=0.25, explode_y=2.05)
    return export_glb(root, ASSETS_DIR / "dgx-b200.glb")


def build_gb200_nvl72() -> Dict:
    """Builds NEW 1U Liquid-Cooled NVIDIA GB200 NVL72 Compute Tray (2x Grace CPU + 4x B200 + NVLink-C2C + DLC + Blind-Mate NVLink 5)."""
    src = "https://www.nvidia.com/en-us/data-center/gb200-nvl72/"
    root = NodeBuilder(
        "GB200_NVL72",
        extras={
            "label": "NVIDIA GB200 NVL72 计算托盘",
            "scope": "whole exterior / stylized",
            "source": src,
            "platform": "nvidia",
            "cpuCount": 2,
            "dimmCount": 0,
            "acceleratorCount": 4,
            "fanCount": 4,
            "psuCount": 2,
            "driveCount": 8,
        },
    )
    _add_chassis_shell(root, "GB200_NVL72", width=4.81, height=0.52, depth=8.60, lid_label_text="GB200 NVL72 1U COMPUTE TRAY", accent_mat=M_CHAMPAGNE, front_style="gb200_1u")

    # Front Dual-Grace Superchip CPU & Soldered LPDDR5X Host Section + NVLink-C2C golden lanes
    host = root.child(
        "GB200_NVL72_host",
        translation=[0.0, 0.085, 1.48],
        extras={
            "kind": "host",
            "label": "双路 Grace CPU 与 LPDDR5X 基板",
            "explodeZ": 0.90,
            "explodeY": -0.55,
            "description": "2 颗 72 核 NVIDIA Grace CPU 与板载焊装 LPDDR5X 高速内存（单托盘最高约 960 GB），经 900 GB/s NVLink-C2C 一致性互连直通后排 B200 GPU。",
            "source": src,
        },
    )
    host.add_chamfer_box(M_PCB, 0.0, 0.022, 0.0, 4.14, 0.044, 1.96, bevel=0.010)
    for gx_i, gx_pos in enumerate((-1.02, 1.02)):
        build_grace_superchip_cpu(host, "GB200", gx_i + 1, gx_pos, 0.046, 0.06, src)
        # Golden 900 GB/s NVLink-C2C trace bundles heading -Z toward paired B200 GPUs
        for off in (-0.28, -0.10, 0.10, 0.28):
            host.add_box(M_CHAMPAGNE, gx_pos + off, 0.048, -0.68, 0.036, 0.008, 0.52)

    # Rear Quad-B200 GPU Liquid-Cooled Baseboard (2x GB200 Superchip compute domains = 4x B200 GPUs)
    board = root.child(
        "GB200_NVL72_accelerator_board",
        translation=[0.0, 0.085, -1.12],
        extras={
            "kind": "board",
            "label": "4×B200 液冷加速载板",
            "explodeZ": 1.75,
            "explodeY": 0.15,
            "description": "单台 1U 托盘集成 2 组 GB200 Superchip 共 4 颗 Blackwell B200 GPU（整柜 18 台计算托盘共 72 颗 B200），由直接芯片液冷冷板直冷。",
            "source": src,
        },
    )
    board.add_chamfer_box(M_PCB, 0.0, 0.022, 0.0, 4.16, 0.046, 2.04, bevel=0.010)
    for tx in (-1.50, -0.50, 0.50, 1.50):
        board.add_box(M_BRASS, tx, 0.049, -0.68, 0.068, 0.008, 0.56)
    for i, gx in enumerate((-1.50, -0.50, 0.50, 1.50)):
        build_oam_module(
            board,
            f"GB200_NVL72_gpu{i}",
            "gpu",
            f"B200 液冷模组 {i + 1}",
            gx,
            0.052,
            0.04,
            variant="b200_coldplate",
            desc="GB200 NVL72 液冷 B200 GPU 模组：单颗配备 8 堆栈 HBM3e（8 TB/s），由微通道紫铜冷板直接带走热量，经背部盲插连接器汇入机柜 9 台 NVLink Switch 托盘。",
            source=src,
            idx_1based=i + 1,
        )

    # Direct-to-Chip Liquid Cooling Loop + Front Blind-Mate Quick-Disconnect Couplings (QDC)
    cool = root.child(
        "GB200_NVL72_cooling",
        translation=[0.0, 0.28, 0.72],
        extras={
            "kind": "cooling",
            "label": "DLC 液冷分液管路与免滴漏快换头",
            "explodeZ": 2.65,
            "explodeY": -0.45,
            "description": "直接芯片液冷（DLC）管网：前部红/蓝免滴漏快换接头（QDC）接入机柜竖装液冷歧管，并联直冷高功耗的 2 颗 Grace CPU 与 4 颗 B200 GPU。",
            "source": src,
        },
    )
    cool.add_cylinder(M_VERMILION, 0.0, 0.08, -0.95, 0.032, 0.032, 3.56, axis="x", segs=10)
    cool.add_cylinder(M_COOLANT, 0.0, 0.13, -0.78, 0.032, 0.032, 3.56, axis="x", segs=10)
    cool.add_tube(M_VERMILION, [(-1.82, 0.08, 3.45), (-1.82, 0.08, -0.95)], radius=0.034, segs=10)
    cool.add_tube(M_COOLANT, [(-1.58, 0.13, 3.45), (-1.58, 0.13, -0.78)], radius=0.034, segs=10)
    for qx, qmat in ((-1.82, M_VERMILION), (-1.58, M_COOLANT)):
        cool.add_cylinder(M_SILVER, qx, 0.10, 3.54, 0.048, 0.048, 0.12, axis="z", segs=12)
        cool.add_cylinder(qmat, qx, 0.10, 3.63, 0.054, 0.054, 0.04, axis="z", segs=12)

    # 1U Auxiliary Fan Row behind front NICs & E1.S NVMe drives (per DGX GB Rack Scale User Guide: NICs & storage are air-cooled!)
    build_open_fan_wall(
        root,
        "GB200_NVL72_fans",
        "1U 外围辅助风冷风扇排",
        [0.35, 0.08, 2.92],
        col_xs=[-1.05, -0.35, 0.35, 1.05],
        row_ys=(0.18,),
        cage_w=2.92,
        cage_y0=0.0,
        cage_h=0.36,
        cage_d=0.34,
        rotor_size=0.22,
        rotor_depth=0.28,
        source=src,
        desc="依据 NVIDIA DGX GB 机柜用户指南，高热流密度的 Grace CPU 与 B200 GPU 由液冷冷板直冷，前仓 ConnectX-7/BlueField-3 网卡与 E1.S NVMe 存储仍由托盘内置风扇推动风道散热。",
        top_latch_mat=M_CHAMPAGNE,
        explode_z=1.65,
        explode_y=-1.05,
    )

    # Front-accessible ConnectX-7 / BlueField-3 OSFP I/O Mezzanine (left-center) + 8x E1.S NVMe drives (right)
    net = root.child(
        "GB200_NVL72_front_net",
        translation=[-0.42, 0.12, 3.72],
        extras={
            "kind": "network",
            "label": "前置 ConnectX-7 / BlueField-3 光口",
            "explodeZ": 0.95,
            "explodeY": -1.55,
            "description": "前置冷通道可维护的 4 口 400G/800G OSFP 计算网接口与双口 BlueField-3 DPU 管理/存储高速口。",
            "source": src,
        },
    )
    net.add_chamfer_box(M_PCB, 0.0, 0.02, -0.14, 1.56, 0.038, 0.56, bevel=0.006)
    add_osfp_bank(net, [-0.54, -0.18, 0.18, 0.54], [0.11], z_face=0.46, port_w=0.25, port_h=0.11, depth=0.34, tab_mat=M_CHAMPAGNE, facing_front=True)

    build_drive_bay(root, "GB200_NVL72", [1.32, 0.18, 3.92], count=8, total_w=1.52, caddy_h=0.20, source=src, desc="前置 8 个 E1.S NVMe 固态盘位，承载操作系统与本地高速快照。", accent_mat=M_CHAMPAGNE, explode_z=0.95, explode_y=-2.45)

    # Rear Blind-Mate NVLink 5 Cable Cartridge Backplane (7.2 TB/s per compute tray into rack NVLink spine!)
    nvs = root.child(
        "GB200_NVL72_nvlink_cartridge",
        translation=[-0.62, 0.09, -3.86],
        extras={
            "kind": "nvswitch",
            "label": "NVLink 5 盲插背板卡匣",
            "explodeZ": 0.95,
            "explodeY": 1.55,
            "description": "背部高密度 NVLink 5 盲插连接器阵列（单托盘聚合 7.2 TB/s），推入机柜即与背部 5,000+ 根同轴铜缆背板盲插导通，直连中置 9 台 NVLink Switch 交换托盘。",
            "source": src,
        },
    )
    nvs.add_chamfer_box(M_SILVER, 0.0, 0.13, 0.0, 2.52, 0.24, 0.52, bevel=0.008)
    for kx in np.linspace(-1.02, 1.02, 8):
        nvs.add_box(M_CHARCOAL, kx, 0.13, -0.268, 0.22, 0.18, 0.016)
        nvs.add_box(M_BRASS, kx, 0.13, -0.282, 0.16, 0.12, 0.012)

    build_psu_bank(root, "GB200_NVL72", [1.42, 0.09, -3.84], count=2, total_w=1.18, psu_h=0.26, psu_d=0.68, source=src, desc="背部 50V 机柜直流母排盲插供电与稳压转换模块。", latch_mat=M_MOSS, explode_z=0.95, explode_y=1.55)
    return export_glb(root, ASSETS_DIR / "gb200-nvl72.glb")


def build_h100_nvl_pcie() -> Dict:
    """Builds NEW 4U NVIDIA H100 NVL PCIe Inference Node (4x Dual-Slot 94GB H100 NVL PCIe Gen5 + 2x 3-Way NVLink 4 Bridges)."""
    src = "https://www.nvidia.com/en-us/data-center/h100/"
    root = NodeBuilder(
        "H100_NVL_PCIe",
        extras={
            "label": "NVIDIA H100 NVL PCIe 推理节点",
            "scope": "whole exterior / stylized",
            "source": src,
            "platform": "nvidia",
            "cpuCount": 2,
            "dimmCount": 32,
            "acceleratorCount": 4,
            "nvswitchCount": 2,
            "fanCount": 8,
            "psuCount": 4,
            "driveCount": 10,
        },
    )
    _add_chassis_shell(root, "H100_NVL", width=4.81, height=1.75, depth=8.40, lid_label_text="NVIDIA H100 NVL PCIE 4U", accent_mat=M_CHAMPAGNE, front_style="nvidia_4u_pcie")

    build_drive_bay(root, "H100_NVL", [0.0, 0.22, 3.82], count=10, total_w=3.86, caddy_h=0.26, source=src, desc="前部 10 个 2.5 英寸 U.2 NVMe 热插拔盘位与高速缓存背板。", accent_mat=M_CHAMPAGNE, explode_z=0.10, explode_y=-2.80)
    build_open_fan_wall(
        root,
        "H100_NVL_fans",
        "4U 对旋风扇墙",
        [0.0, 0.26, 2.92],
        col_xs=(-1.32, -0.44, 0.44, 1.32),
        row_ys=(0.34, 0.94),
        cage_w=3.74,
        cage_y0=0.0,
        cage_h=1.28,
        cage_d=0.44,
        rotor_size=0.58,
        rotor_depth=0.38,
        source=src,
        desc="8 个 4U 高静压热插拔风扇模组（4×2 镂空阵列），强力吹透后仓 4 张双槽被动散热 H100 NVL PCIe 卡。",
        top_latch_mat=M_CHAMPAGNE,
        lower_latch_mat=M_MOSS,
        explode_z=0.65,
        explode_y=-2.45,
    )
    build_host_board(root, "H100_NVL", [0.0, 0.14, 1.02], cpu_count=2, source=src, cpu_tag="XEON GEN5", cpu_desc="2 颗 PCIe 5.0 双路处理器与 32 条 DDR5 内存，提供高吞吐 PCIe 5.0×16 根复合体通道。", ddr5=True, explode_z=2.35, explode_y=-0.15, board_z=2.32, cooler_h=0.26)

    riser = root.child(
        "H100_NVL_riser_board",
        translation=[0.0, 0.14, -1.58],
        extras={
            "kind": "board",
            "label": "PCIe 5.0 Riser 扩展模组",
            "explodeZ": 0.85,
            "explodeY": 0.55,
            "description": "双组 4U PCIe 5.0×16 Riser 扩展笼，水平层叠装载 4 张双槽全高全长 H100 NVL（2 对桥接卡组，整机 376 GB HBM3）。",
            "source": src,
        },
    )
    for rx in (-1.92, 0.08):
        riser.add_chamfer_box(M_PCB, rx, 0.52, 0.16, 0.056, 0.96, 2.02, bevel=0.006)
        riser.add_chamfer_box(M_SILVER, rx - 0.03, 1.02, 0.16, 0.11, 0.034, 2.04, bevel=0.005)
        for ry in (0.11, 0.71):
            riser.add_box(M_CHARCOAL, rx + 0.056, ry, 0.04, 0.056, 0.068, 0.88)
            riser.add_box(M_BRASS, rx + 0.090, ry, 0.04, 0.012, 0.040, 0.80)

    card_slots = [(-1.24, 0.08, -0.16), (-1.24, 0.68, -0.16), (0.76, 0.08, -0.16), (0.76, 0.68, -0.16)]
    for ci, (cx, cy, cz) in enumerate(card_slots):
        c_node = build_pcie_h100_nvl_card(riser, f"H100_NVL_card{ci}", ci + 1, cx, cy, cz, source=src)
        c_node.extras["explodeZ"] = 0.35 if cy < 0.40 else 0.95

    # Paired 3-Slot NVLink 4 Bridge Clamps spanning each pair of H100 NVL PCIe cards (600 GB/s bidirectional per pair!)
    br = root.child(
        "H100_NVL_bridges",
        translation=[0.0, 0.14, -1.58],
        extras={
            "kind": "nvswitch",
            "label": "三路 NVLink 4 桥接器 ×2组",
            "explodeZ": 3.55,
            "explodeY": 0.55,
            "description": "每对 H100 NVL 顶部跨接 3 组 NVLink 4 桥接夹具，在标准 PCIe 服务器内拼出 600 GB/s 双向带宽（约为 PCIe 5.0 的近 5 倍）与 188 GB 合并显存池。",
            "source": src,
        },
    )
    for pair_idx, bx in enumerate((-0.64, 1.36)):
        br.add_chamfer_box(M_CHAMPAGNE, bx, 0.41, -0.26, 0.092, 0.70, 0.84, bevel=0.008)
        br.add_chamfer_box(M_SILVER, bx + 0.054, 0.41, -0.26, 0.016, 0.56, 0.72, bevel=0.004)
        for tz_tab in (-0.58, -0.26, 0.06):
            br.add_box(M_SILVER, bx - 0.055, 0.41, tz_tab, 0.018, 0.64, 0.19)
        br.add_text(M_CHARCOAL, f"NVLINK X3 P{pair_idx + 1}", bx + 0.062, 0.41, -0.26, height=0.040, thickness=0.007, plane="yz")

    net = root.child(
        "H100_NVL_network",
        translation=[-1.08, 0.18, -3.72],
        extras={"kind": "network", "label": "ConnectX-7 RoCE/IB 与管理口", "explodeZ": 1.85, "explodeY": 2.35, "description": "4 口 ConnectX-7 400G QSFP112 / OSFP 高速网卡与 OCP 3.0 带外管理接口。", "source": src},
    )
    net.add_chamfer_box(M_PCB, 0.0, 0.03, 0.10, 1.56, 0.042, 0.56, bevel=0.006)
    add_qsfp_bank(net, [-0.54, -0.18, 0.18, 0.54], [0.11], z_face=-0.46, port_w=0.22, port_h=0.105, depth=0.30, tab_mat=M_CHAMPAGNE)

    build_psu_bank(root, "H100_NVL", [1.08, 0.14, -3.70], count=4, total_w=1.96, psu_h=0.44, psu_d=0.90, source=src, desc="4 个 2.4 kW 热插拔钛金冗余电源模块（2+2 冗余），支撑 4 张 400W H100 NVL 满载推理。", latch_mat=M_MOSS, explode_z=0.25, explode_y=2.35)
    return export_glb(root, ASSETS_DIR / "h100-nvl-pcie.glb")


def verify_glb(path: pathlib.Path, expected_accel_kind: Optional[str], expected_accel_count: int) -> Dict:
    """Verifies GLB binary header, finite accessor min/max bounds, and expected semantic nodes."""
    data = path.read_bytes()
    magic, ver, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67 and ver == 2 and length == len(data), f"Invalid GLB header in {path}"
    clen, ctype = struct.unpack_from("<II", data, 12)
    assert ctype == 0x4E4F534A
    gltf = json.loads(data[20 : 20 + clen].decode("utf-8"))
    for acc in gltf["accessors"]:
        for key in ("min", "max"):
            if key in acc:
                assert all(math.isfinite(x) for x in acc[key]), f"Non-finite bounds in {path}"
    kinds: Dict[str, int] = {}
    for n in gltf["nodes"]:
        ex = n.get("extras") or {}
        k = ex.get("kind")
        if k:
            kinds[k] = kinds.get(k, 0) + 1
    if expected_accel_kind:
        assert kinds.get(expected_accel_kind, 0) == expected_accel_count, (
            f"{path.name}: expected {expected_accel_count} '{expected_accel_kind}', got {kinds}"
        )
    return {"file": path.name, "bytes": len(data), "kinds": kinds}


def sync_manifest() -> None:
    """Keeps public/experiences/manifest.json synchronized with whole/ assets & scripts."""
    exp_root = ASSETS_DIR.parents[1]
    manifest_path = exp_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    prior = {entry["path"]: entry for entry in manifest["files"] if not entry["path"].startswith("whole/")}
    orig_adapted = {
        entry["path"]: entry["sourceSha256"]
        for entry in manifest["files"]
        if entry["path"] in ("whole/index.html", "whole/viewer.js")
    }
    whole_dir = exp_root / "whole"
    for f in sorted(whole_dir.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(exp_root).as_posix()
        raw = f.read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        prior[rel] = {
            "path": rel,
            "bytes": len(raw),
            "sourceSha256": orig_adapted.get(rel, sha),
            "sha256": sha,
        }
    manifest["files"] = [prior[k] for k in sorted(prior.keys(), key=lambda s: (s.lower(), s))]
    manifest_path.write_bytes((json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))


def main() -> None:
    summaries = [
        build_cabinet_42u(),
        build_atlas_800t_a2(),
        build_atlas_800i_a3(),
        build_atlas_800_3000(),
        build_ascend_950dt(),
        build_dgx_h100(),
        build_dgx_b200(),
        build_gb200_nvl72(),
        build_h100_nvl_pcie(),
    ]
    checks = [
        verify_glb(ASSETS_DIR / "cabinet-42u.glb", "rack", 1),
        verify_glb(ASSETS_DIR / "atlas-800t-a2.glb", "npu", 8),
        verify_glb(ASSETS_DIR / "atlas-800i-a3.glb", "npu", 8),
        verify_glb(ASSETS_DIR / "atlas-800-3000.glb", "npu", 4),
        verify_glb(ASSETS_DIR / "ascend-950dt.glb", "npu", 8),
        verify_glb(ASSETS_DIR / "dgx-h100.glb", "gpu", 8),
        verify_glb(ASSETS_DIR / "dgx-b200.glb", "gpu", 8),
        verify_glb(ASSETS_DIR / "gb200-nvl72.glb", "gpu", 4),
        verify_glb(ASSETS_DIR / "h100-nvl-pcie.glb", "gpu", 4),
    ]
    sync_manifest()
    for s, c in zip(summaries, checks):
        print(
            f"OK {s['file']:20s} | {s['bytes']/1048576:5.2f} MiB | verts={s['vertices']:7d} | tris={s['triangles']:7d} | kinds={c['kinds']}"
        )


if __name__ == "__main__":
    main()
