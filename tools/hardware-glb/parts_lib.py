"""Reusable high-craftsmanship 3D hardware subassemblies for Ascend & NVIDIA servers."""

from __future__ import annotations

from typing import List, Optional, Sequence, Tuple
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
)


def build_dimm_stick(
    mem_bank: NodeBuilder,
    tx: float,
    ty: float,
    tz: float,
    ddr5: bool = False,
) -> None:
    """Appends one detailed RDIMM slot + stick into the shared host memory-bank node (batches all 32 DIMMs into 6 primitives)."""
    # Slot base + central key bridge
    mem_bank.add_box(M_CHARCOAL, tx, ty + 0.020, tz, 0.048, 0.040, 0.88)
    # Dual ejector latches at Z ends (0.007 wider per side than slot so zero ±X coplanarity)
    for sz in (-0.438, 0.438):
        mem_bank.add_chamfer_box(M_IVORY, tx, ty + 0.072, tz + sz, 0.062, 0.112, 0.042, bevel=0.006)
        mem_bank.add_box(M_IVORY, tx, ty + 0.136, tz + sz + (0.014 if sz > 0 else -0.014), 0.062, 0.016, 0.032)
    # Gold contact strip
    mem_bank.add_box(M_BRASS, tx, ty + 0.046, tz, 0.032, 0.012, 0.78)
    # Module PCB
    mem_bank.add_box(M_PCB, tx, ty + 0.180, tz, 0.020, 0.256, 0.80)
    # Central RCD + PMIC chips (cleanly proud of PCB ±0.010 faces by 0.008)
    mem_bank.add_box(M_SILICON, tx, ty + 0.182, tz, 0.036, 0.076, 0.070)
    if ddr5:
        mem_bank.add_box(M_COPPER, tx, ty + 0.256, tz, 0.036, 0.032, 0.058)
    # 8 DRAM packages on both faces (4 below center, 4 above center)
    ic_centers = [[tx, ty + 0.182, tz + z_off] for z_off in (-0.31, -0.225, -0.14, -0.068, 0.068, 0.14, 0.225, 0.31)]
    mem_bank.add_boxes_grid(M_RECESS, np.asarray(ic_centers, dtype=np.float32), 0.035, 0.135, 0.056)
    # Top subtle metallic trim line on DDR5 (seated cleanly above PCB top 0.308)
    if ddr5:
        mem_bank.add_box(M_SILVER, tx, ty + 0.314, tz, 0.020, 0.012, 0.79)


def build_cpu_socket(
    host: NodeBuilder,
    prefix: str,
    idx_1based: int,
    tx: float,
    ty: float,
    tz: float,
    chip_tag: str,
    desc: str,
    source: str,
    cooler_h: float = 0.30,
) -> NodeBuilder:
    """Builds a detailed server CPU socket (ILM frame, substrate, IHS, heatpipe finned cooler)."""
    c = host.child(
        f"{prefix}_cpu{idx_1based - 1}",
        translation=[tx, ty, tz],
        extras={
            "kind": "cpu",
            "label": f"CPU {idx_1based}",
            "explodeZ": 0.35,
            "explodeY": 0,
            "description": desc,
            "source": source,
        },
    )
    # Socket bolster plate & retention frame (cleanly stacked Y intervals, clear of VRM chokes)
    c.add_chamfer_box(M_CHARCOAL, 0.0, 0.028, 0.0, 0.70, 0.056, 0.70, bevel=0.012)
    c.add_chamfer_box(M_SILVER, 0.0, 0.068, 0.0, 0.64, 0.024, 0.66, bevel=0.010)
    # 4 corner torx studs + retention lever wire beside bolster
    for sx in (-0.28, 0.28):
        for sz in (-0.29, 0.29):
            c.add_cylinder(M_BRASS, sx, 0.090, sz, 0.022, 0.022, 0.020, axis="y", segs=8)
    c.add_box(M_SILVER, 0.368, 0.058, 0.0, 0.016, 0.016, 0.64)
    # Organic substrate + multi-step IHS (cleanly inside corner torx studs)
    c.add_box(M_SUBSTRATE, 0.0, 0.090, 0.0, 0.48, 0.020, 0.50)
    c.add_chamfer_box(M_SILVER, 0.0, 0.121, 0.0, 0.44, 0.042, 0.46, bevel=0.012)
    c.add_chamfer_box(M_SILVER, 0.0, 0.150, 0.0, 0.36, 0.016, 0.38, bevel=0.008)
    c.add_text(M_CHARCOAL, chip_tag, 0.0, 0.158, 0.0, height=0.052, thickness=0.008, plane="xz")

    # CPU Heatsink child (kind='cooler', stays mounted on CPU in Level 2 and lifts in Level 3)
    cl = c.child(
        f"{prefix}_cpu{idx_1based - 1}_cooler",
        translation=[0.0, 0.185, 0.0],
        extras={
            "kind": "cooler",
            "label": "CPU 散热器",
            "explodeZ": 0,
            "explodeY": 0,
            "description": "铜底热管鳍片式服务器 CPU 散热器。",
            "source": source,
        },
    )
    cl.add_chamfer_box(M_COPPER, 0.0, 0.016, 0.0, 0.52, 0.032, 0.56, bevel=0.008)
    # 2 embedded copper heatpipes curving from base into fin stack
    for hx in (-0.16, 0.16):
        cl.add_tube(
            M_COPPER,
            [
                (hx, 0.022, -0.31),
                (hx, 0.055, -0.34),
                (hx, cooler_h * 0.62, -0.28),
                (hx, cooler_h * 0.62, 0.28),
                (hx, 0.055, 0.34),
                (hx, 0.022, 0.31),
            ],
            radius=0.018,
            segs=8,
        )
    # Fin array (18 fins)
    fin_count = 18
    xs = np.linspace(-0.32, 0.32, fin_count)
    centers = np.array([[x, 0.032 + (cooler_h - 0.04) * 0.5, 0.0] for x in xs], dtype=np.float32)
    cl.add_boxes_grid(M_SILVER, centers, 0.011, cooler_h - 0.04, 0.68)
    # Top stamped tie-straps + captive spring screws
    for sz in (-0.22, 0.22):
        cl.add_chamfer_box(M_SILVER, 0.0, cooler_h, sz, 0.67, 0.018, 0.085, bevel=0.005)
    for sx, sz in ((-0.29, -0.29), (0.29, -0.29), (-0.29, 0.29), (0.29, 0.29)):
        cl.add_cylinder(M_SILVER, sx, 0.045, sz, 0.020, 0.020, 0.075, axis="y", segs=8)
    return c


def build_host_board(
    root: NodeBuilder,
    prefix: str,
    translation: Sequence[float],
    cpu_count: int,
    source: str,
    cpu_tag: str = "KUNPENG",
    cpu_desc: str = "华为鲲鹏 920 处理器：承担主机侧调度、分词、算子下发与系统控制。",
    ddr5: bool = False,
    explode_z: float = 3.5,
    explode_y: float = 1.0,
    board_z: float = 2.70,
    cooler_h: float = 0.30,
) -> NodeBuilder:
    """Builds a complete server host motherboard with 2 or 4 CPUs, 32 DIMMs, VRMs, M.2 SSDs, BMC & PCIe slots."""
    host = root.child(
        f"{prefix}_host",
        translation=translation,
        extras={
            "kind": "host",
            "label": "CPU 主板与内存",
            "explodeZ": explode_z,
            "explodeY": explode_y,
            "description": f"{cpu_count} 路处理器与 32 条 {'DDR5' if ddr5 else 'DDR4'} RDIMM 主机内存板，含多相 VRM 供电、M.2 启动盘与 BMC 管理单元示意。",
            "source": source,
        },
    )
    # Main multi-layer jade PCB + perimeter ground trim + mounting standoffs
    host.add_chamfer_box(M_PCB, 0.0, 0.020, 0.0, 4.12, 0.060, board_z, bevel=0.012)
    host.add_box(M_BRASS, 0.0, 0.054, board_z * 0.5 - 0.045, 3.96, 0.008, 0.025)
    host.add_box(M_BRASS, 0.0, 0.054, -board_z * 0.5 + 0.045, 3.96, 0.008, 0.025)
    for sx in (-1.96, 0.0, 1.96):
        for sz in (-board_z * 0.45, board_z * 0.45):
            host.add_cylinder(M_BRASS, sx, 0.032, sz, 0.032, 0.032, 0.072, axis="y", segs=10)

    mem_bank = host.child(
        f"{prefix}_memory",
        extras={
            "kind": "memory",
            "label": "RDIMM 主机内存阵列 ×32",
            "explodeZ": 0.22,
            "explodeY": 0,
            "description": (
                "32 条 DDR5 RDIMM 内存条与插槽，含两侧卡扣、寄存时钟驱动芯片（RCD/PMIC）与双面颗粒示意。"
                if ddr5
                else "32 条 DDR4 RDIMM 内存条与插槽，含两侧象牙白锁扣、金手指触点与双面颗粒示意。"
            ),
            "source": source,
        },
    )
    if cpu_count == 4:
        # 4 sockets at [-0.97, +0.97] x [+0.64, -0.66], 8 DIMMs per socket (4 left, 4 right)
        socket_coords = [(-0.97, 0.64), (0.97, 0.64), (-0.97, -0.66), (0.97, -0.66)]
        for ci, (cx, cz) in enumerate(socket_coords):
            build_cpu_socket(host, prefix, ci + 1, cx, 0.050, cz, cpu_tag, cpu_desc, source, cooler_h=cooler_h)
            # 6-phase VRM choke + capacitor bank north/south of each CPU (clear of rear connectors)
            vrm_z = cz + (0.44 if cz > 0 else -0.40)
            chokes = np.array([[cx + (k - 2.5) * 0.095, 0.072, vrm_z] for k in range(6)], dtype=np.float32)
            host.add_boxes_grid(M_CHARCOAL, chokes, 0.068, 0.044, 0.068)
            for k in range(6):
                host.add_cylinder(
                    M_SILVER,
                    cx + (k - 2.5) * 0.095,
                    0.078,
                    vrm_z + (0.064 if cz > 0 else -0.064),
                    0.022,
                    0.022,
                    0.056,
                    axis="y",
                    segs=8,
                )
            left_xs = [cx - 0.47 - k * 0.088 for k in range(4)]
            right_xs = [cx + 0.47 + k * 0.088 for k in range(4)]
            for dx in left_xs + right_xs:
                build_dimm_stick(mem_bank, dx, 0.050, cz, ddr5=ddr5)
    else:
        # 2 sockets at [-0.98, +0.98] x [0.08], 16 DIMMs per socket (2 banks of 8, clear of rear connectors)
        socket_coords = [(-0.98, 0.08), (0.98, 0.08)]
        for ci, (cx, cz) in enumerate(socket_coords):
            build_cpu_socket(host, prefix, ci + 1, cx, 0.050, cz, cpu_tag, cpu_desc, source, cooler_h=cooler_h)
            chokes = np.array([[cx + (k - 3.5) * 0.088, 0.072, cz + 0.56] for k in range(8)], dtype=np.float32)
            host.add_boxes_grid(M_CHARCOAL, chokes, 0.065, 0.044, 0.065)
            for row_z in (0.54, -0.48):
                xs = [cx - 0.48 - k * 0.082 for k in range(4)] + [cx + 0.48 + k * 0.082 for k in range(4)]
                for dx in xs:
                    build_dimm_stick(mem_bank, dx, 0.050, row_z, ddr5=ddr5)

    # Central service components: iBMC chip + mini heatsink, dual M.2 NVMe SSDs, CMOS battery, power headers
    host.add_chamfer_box(M_CHARCOAL, 0.0, 0.074, -0.02, 0.24, 0.048, 0.24, bevel=0.008)
    bmc_fins = np.array([[x, 0.120, -0.02] for x in np.linspace(-0.10, 0.10, 7)], dtype=np.float32)
    host.add_boxes_grid(M_COPPER, bmc_fins, 0.012, 0.044, 0.22)
    # Dual M.2 2280 boot SSDs (standoff sits just past PCB end so zero -Y overlap)
    for mx in (-0.12, 0.12):
        host.add_box(M_SUBSTRATE, mx, 0.066, 0.58, 0.085, 0.016, 0.44)
        host.add_chamfer_box(M_CHARCOAL, mx, 0.084, 0.58, 0.076, 0.020, 0.38, bevel=0.005)
        host.add_cylinder(M_SILVER, mx, 0.068, 0.83, 0.018, 0.018, 0.036, axis="y", segs=8)
    # CMOS coin cell
    host.add_cylinder(M_CHARCOAL, 0.0, 0.064, -0.58, 0.068, 0.068, 0.028, axis="y", segs=12)
    host.add_cylinder(M_SILVER, 0.0, 0.085, -0.58, 0.054, 0.054, 0.014, axis="y", segs=12)
    # Rear high-speed PCIe / power connectors along -Z edge
    for px in (-1.55, -0.75, 0.75, 1.55):
        host.add_chamfer_box(M_CHARCOAL, px, 0.080, -board_z * 0.5 + 0.11, 0.52, 0.060, 0.070, bevel=0.006)
        host.add_box(M_BRASS, px, 0.114, -board_z * 0.5 + 0.11, 0.46, 0.008, 0.026)
    # Dual 24-pin / 12V power headers on left/right edges
    for sx in (-1.98, 1.98):
        host.add_chamfer_box(M_IVORY, sx, 0.088, 0.0, 0.085, 0.076, 0.42, bevel=0.006)
    return host


def build_psu_bank(
    root: NodeBuilder,
    prefix: str,
    translation: Sequence[float],
    count: int,
    total_w: float,
    psu_h: float,
    psu_d: float,
    source: str,
    desc: str,
    latch_mat: str = M_VERMILION,
    explode_z: float = 1.7,
    explode_y: float = 1.4,
) -> NodeBuilder:
    """Builds a row of hot-swap server PSUs with exhaust honeycomb, IEC C19 inlet, handle, latch, and LEDs."""
    psu = root.child(
        f"{prefix}_power",
        translation=translation,
        extras={
            "kind": "psu",
            "label": "电源模块",
            "explodeZ": explode_z,
            "explodeY": explode_y,
            "description": desc,
            "source": source,
        },
    )
    pitch = total_w / count
    unit_w = pitch * 0.92
    rear_z = -psu_d * 0.5
    for i in range(count):
        ux = (i - (count - 1) * 0.5) * pitch
        # Satin metal PSU casing + front golden blind-mate power blade (stacked Y layers)
        psu.add_chamfer_box(M_SILVER, ux, psu_h * 0.5, 0.0, unit_w, psu_h, psu_d, bevel=0.014)
        psu.add_box(M_PCB, ux, 0.052, psu_d * 0.5 + 0.036, unit_w * 0.52, 0.020, 0.072)
        psu.add_box(M_BRASS, ux, 0.066, psu_d * 0.5 + 0.044, unit_w * 0.46, 0.008, 0.052)
        # Rear dark faceplate inset (cleanly proud of Silver rear_z)
        psu.add_box(M_CHARCOAL, ux, psu_h * 0.5, rear_z - 0.010, unit_w * 0.92, psu_h * 0.84, 0.016)
        # Exhaust mini-fan / perforated vent on upper-left of PSU face (strictly layered -Z offsets, clear of lower handle)
        vent_x = ux - unit_w * 0.22
        vent_r = min(psu_h * 0.22, unit_w * 0.18)
        psu.add_cylinder(M_RECESS, vent_x, psu_h * 0.60, rear_z - 0.024, vent_r, vent_r, 0.012, axis="z", segs=12)
        psu.add_box(M_SILVER, vent_x, psu_h * 0.60, rear_z - 0.035, vent_r * 1.85, 0.012, 0.008)
        psu.add_box(M_SILVER, vent_x, psu_h * 0.60, rear_z - 0.044, 0.012, vent_r * 1.85, 0.008)
        # IEC C19 AC receptacle + 3 brass pins on upper-right half
        ac_x = ux + unit_w * 0.18
        psu.add_chamfer_box(M_RECESS, ac_x, psu_h * 0.60, rear_z - 0.024, unit_w * 0.28, psu_h * 0.34, 0.012, bevel=0.004)
        for px in (-0.032, 0.0, 0.032):
            psu.add_box(M_BRASS, ac_x + px, psu_h * 0.60, rear_z - 0.036, 0.012, 0.026, 0.012)
        # Pull handle U-loop + hot-swap release tab + green status LED on lower strip (zero XY overlap with Recess!)
        hx0 = ux - unit_w * 0.32
        hx1 = ux + unit_w * 0.04
        hy = psu_h * 0.20
        psu.add_box(M_CHARCOAL, hx0, hy, rear_z - 0.056, 0.028, 0.032, 0.076)
        psu.add_box(M_CHARCOAL, hx1, hy, rear_z - 0.056, 0.028, 0.032, 0.076)
        psu.add_chamfer_box(M_CHARCOAL, (hx0 + hx1) * 0.5, hy, rear_z - 0.102, abs(hx1 - hx0) + 0.03, 0.036, 0.032, bevel=0.006)
        psu.add_chamfer_box(latch_mat, ux + unit_w * 0.34, psu_h * 0.22, rear_z - 0.046, 0.055, 0.048, 0.056, bevel=0.006)
        psu.add_box(M_MOSS, ux + unit_w * 0.36, psu_h * 0.78, rear_z - 0.024, 0.024, 0.024, 0.012)
    return psu


def build_drive_bay(
    root: NodeBuilder,
    prefix: str,
    translation: Sequence[float],
    count: int,
    total_w: float,
    caddy_h: float,
    source: str,
    desc: str,
    accent_mat: str = M_VERMILION,
    explode_z: float = 0.2,
    explode_y: float = -2.0,
) -> NodeBuilder:
    """Builds hot-swap 2.5-inch NVMe/SAS storage caddies + rear backplane PCB."""
    drv = root.child(
        f"{prefix}_drives",
        translation=translation,
        extras={
            "kind": "drives",
            "label": "存储盘位",
            "explodeZ": explode_z,
            "explodeY": explode_y,
            "description": desc,
            "source": source,
        },
    )
    pitch = total_w / count
    cw = pitch * 0.88
    # Backplane PCB behind the drives
    drv.add_chamfer_box(M_PCB, 0.0, 0.02, -0.26, total_w + 0.08, caddy_h * 1.18, 0.035, bevel=0.006)
    for i in range(count):
        cx = (i - (count - 1) * 0.5) * pitch
        # U.2 connector on backplane
        drv.add_box(M_CHARCOAL, cx, 0.02, -0.228, cw * 0.72, caddy_h * 0.42, 0.035)
        drv.add_box(M_BRASS, cx, 0.02, -0.208, cw * 0.60, 0.012, 0.016)
        # SSD body + satin caddy rails
        drv.add_chamfer_box(M_SILVER, cx, 0.0, 0.0, cw, caddy_h, 0.42, bevel=0.008)
        drv.add_box(M_RECESS, cx, 0.012, -0.02, cw * 0.82, caddy_h * 0.72, 0.36)
        # Front caddy latch handle + release button + micro-vent slots + LED
        drv.add_chamfer_box(M_CHARCOAL, cx, 0.0, 0.222, cw * 0.94, caddy_h * 0.90, 0.036, bevel=0.005)
        drv.add_box(M_SILVER, cx - cw * 0.08, 0.0, 0.244, cw * 0.58, caddy_h * 0.38, 0.016)
        drv.add_chamfer_box(accent_mat, cx + cw * 0.30, 0.0, 0.246, cw * 0.20, caddy_h * 0.46, 0.020, bevel=0.004)
        drv.add_box(M_MOSS, cx + cw * 0.32, caddy_h * 0.32, 0.244, 0.018, 0.014, 0.012)
    return drv


def add_qsfp_bank(
    node: NodeBuilder,
    xs: Sequence[float],
    ys: Sequence[float],
    z_face: float,
    port_w: float = 0.21,
    port_h: float = 0.105,
    depth: float = 0.30,
    tab_mat: str = M_VERMILION,
) -> None:
    """Adds detailed QSFP56 / QSFP-DD / OSFP optical cages facing -Z (rear panel) with non-overlapping Z layers."""
    for y in ys:
        for idx, x in enumerate(xs):
            # Satin EMI cage shell: [z_face, z_face + depth]
            node.add_chamfer_box(M_SILVER, x, y, z_face + depth * 0.5, port_w, port_h, depth, bevel=0.006)
            # Dark optical port bore: [z_face - 0.016, z_face]
            node.add_box(M_RECESS, x, y, z_face - 0.008, port_w * 0.78, port_h * 0.62, 0.016)
            # Internal brass optical/electrical tongue: [z_face - 0.026, z_face - 0.016]
            node.add_box(M_BRASS, x, y - port_h * 0.06, z_face - 0.021, port_w * 0.56, 0.012, 0.010)
            # Pull-tab handle cleanly proud in -Z: [z_face - 0.052, z_face - 0.026]
            node.add_box(tab_mat, x + port_w * 0.34, y, z_face - 0.039, 0.022, port_h * 0.52, 0.026)
            # Link LED pip mounted above Recess bore on cage upper lip
            node.add_box(M_MOSS if idx % 2 == 0 else M_CHAMPAGNE, x - port_w * 0.34, y + port_h * 0.39, z_face - 0.008, 0.018, 0.014, 0.016)


def add_osfp_bank(
    node: NodeBuilder,
    xs: Sequence[float],
    ys: Sequence[float],
    z_face: float,
    port_w: float = 0.28,
    port_h: float = 0.13,
    depth: float = 0.38,
    tab_mat: str = M_CHAMPAGNE,
    facing_front: bool = False,
) -> None:
    """Adds sculpted NVIDIA finned OSFP 400G/800G optical cages with top heatsink fins & dual-MPO ferrules."""
    s = 1.0 if facing_front else -1.0
    cage_zc = z_face - s * depth * 0.5
    for y in ys:
        for idx, x in enumerate(xs):
            # Satin EMI cage shell
            node.add_chamfer_box(M_SILVER, x, y, cage_zc, port_w, port_h, depth, bevel=0.006)
            # Integrated OSFP top longitudinal micro-fins (recessed from ±Z cage faces so zero coplanarity)
            fin_pts = np.array(
                [[x + (k - 2) * (port_w * 0.17), y + port_h * 0.5 + 0.014, cage_zc] for k in range(5)],
                dtype=np.float32,
            )
            node.add_boxes_grid(M_SILVER, fin_pts, 0.012, 0.028, depth * 0.84)
            # Dark optical Dual-MPO bore
            node.add_box(M_RECESS, x, y, z_face + s * 0.008, port_w * 0.80, port_h * 0.58, 0.016)
            # Dual brass MPO optical ferrules
            for fx_off in (-port_w * 0.18, port_w * 0.18):
                node.add_box(M_BRASS, x + fx_off, y - port_h * 0.05, z_face + s * 0.021, port_w * 0.22, 0.014, 0.010)
            # Sculpted pull-latch bail
            node.add_box(tab_mat, x + port_w * 0.35, y, z_face + s * 0.040, 0.024, port_h * 0.54, 0.028)
            # Activity/Link LED pip on upper cage lip (disjoint in Y from Recess bore)
            node.add_box(
                M_MOSS if idx % 2 == 0 else M_CHAMPAGNE,
                x - port_w * 0.34,
                y + port_h * 0.38,
                z_face + s * 0.008,
                0.020,
                0.014,
                0.016,
            )


def build_open_fan_wall(
    root: NodeBuilder,
    name: str,
    label: str,
    translation: Sequence[float],
    col_xs: Sequence[float],
    row_ys: Sequence[float],
    cage_w: float,
    cage_y0: float,
    cage_h: float,
    cage_d: float,
    rotor_size: float,
    rotor_depth: float,
    source: str,
    desc: str,
    top_latch_mat: str = M_VERMILION,
    lower_latch_mat: Optional[str] = None,
    explode_z: float = 0.9,
    explode_y: float = -1.4,
) -> NodeBuilder:
    """
    Builds an open-lattice hot-swap fan wall cage where every fan bore is 100% open air
    (perimeter sheet-metal frame + recessed inter-bay mullions, zero solid wall slabs or Z-fighting).
    """
    fans = root.child(
        name,
        translation=translation,
        extras={
            "kind": "fans",
            "label": label,
            "explodeZ": explode_z,
            "explodeY": explode_y,
            "description": desc,
            "source": source,
        },
    )
    frame_d = cage_d * 0.72
    rail_h = 0.055
    post_w = 0.065
    y_bot = cage_y0 + rail_h * 0.5
    y_top = cage_y0 + cage_h - rail_h * 0.5
    y_mid = cage_y0 + cage_h * 0.5
    inner_h = max(0.08, cage_h - rail_h * 2.04)

    # Perimeter sheet-metal rails & side posts (recessed behind rotor front face so zero coplanarity!)
    fans.add_chamfer_box(M_SILVER, 0.0, y_bot, -0.02, cage_w, rail_h, frame_d, bevel=0.006)
    fans.add_chamfer_box(M_SILVER, 0.0, y_top, -0.02, cage_w, rail_h, frame_d, bevel=0.006)
    for sx in (-1.0, 1.0):
        px = sx * (cage_w * 0.5 - post_w * 0.5)
        fans.add_chamfer_box(M_SILVER, px, y_mid, -0.02, post_w, inner_h, frame_d, bevel=0.006)
        # Side guide ear latch
        fans.add_box(M_CHARCOAL, sx * (cage_w * 0.5 + 0.018), y_mid, 0.0, 0.028, min(0.45, inner_h * 0.45), frame_d * 0.65)

    # Vertical inter-column mullions between adjacent fan bays
    sorted_xs = sorted(col_xs)
    for i in range(len(sorted_xs) - 1):
        mx = 0.5 * (sorted_xs[i] + sorted_xs[i + 1])
        fans.add_box(M_SILVER, mx, y_mid, -0.02, 0.044, inner_h, frame_d * 0.92)

    # Horizontal inter-row shelves between stacked fan tiers
    sorted_ys = sorted(row_ys)
    for j in range(len(sorted_ys) - 1):
        my = 0.5 * (sorted_ys[j] + sorted_ys[j + 1])
        fans.add_box(M_SILVER, 0.0, my, -0.02, cage_w - post_w * 2.04, 0.044, frame_d * 0.88)

    # Bottom fan power-distribution PCB strip tucked at rear
    fans.add_box(M_PCB, 0.0, cage_y0 + 0.032, -frame_d * 0.5 - 0.028, cage_w * 0.94, 0.055, 0.032)

    # Populate individual sculpted counter-rotating fan modules in each open cell
    top_y = max(row_ys)
    for fx in col_xs:
        for fy in row_ys:
            lmat = top_latch_mat if abs(fy - top_y) < 1e-4 else lower_latch_mat
            fans.add_fan_rotor(fx, fy, 0.02, size=rotor_size, depth=rotor_depth, blades=7, latch_mat=lmat)
    return fans


def _add_module_base_pcb(
    mod: NodeBuilder,
    hx: float = 0.455,
    hz: float = 0.725,
    vrm_phases: int = 6,
    connector_count: int = 3,
) -> None:
    """Builds high-detail OAM/SXM mezzanine PCB base within exact [-hx, hx] x [-hz, hz], y in [0.003, 0.180]."""
    # Multi-layer jade PCB: y in [0.003, 0.057]
    mod.add_chamfer_box(M_PCB, 0.0, 0.030, 0.0, hx * 2.0, 0.054, hz * 2.0, bevel=0.010)
    # 4 corner brass grounding rings + spring-loaded captive mounting standoffs (stacked Y layers)
    for sx in (-hx + 0.068, hx - 0.068):
        for sz in (-hz + 0.075, hz - 0.075):
            mod.add_cylinder(M_BRASS, sx, 0.061, sz, 0.042, 0.042, 0.008, axis="y", segs=12)
            mod.add_cylinder(M_SILVER, sx, 0.110, sz, 0.024, 0.024, 0.090, axis="y", segs=10)
            mod.add_cylinder(M_CHARCOAL, sx, 0.160, sz, 0.012, 0.012, 0.010, axis="y", segs=8)
    # Dual multi-phase VRM rows flanking the central package
    z_lo, z_hi = (-0.42, 0.36) if vrm_phases >= 8 else (-0.34, 0.28)
    zs = np.linspace(z_lo, z_hi, vrm_phases)
    choke_centers = []
    drmos_centers = []
    for sx in (-hx + 0.082, hx - 0.082):
        inner_x = sx + (0.062 if sx < 0 else -0.062)
        for z in zs:
            choke_centers.append([sx, 0.083, z])
            drmos_centers.append([inner_x, 0.068, z])
            mod.add_cylinder(
                M_SILVER,
                sx,
                0.081,
                z + 0.048,
                0.016,
                0.016,
                0.048,
                axis="y",
                segs=8,
            )
    mod.add_boxes_grid(M_CHARCOAL, np.asarray(choke_centers, dtype=np.float32), 0.066, 0.052, 0.056)
    mod.add_boxes_grid(M_RECESS, np.asarray(drmos_centers, dtype=np.float32), 0.038, 0.022, 0.038)

    # High-density front & rear mezzanine/power/signal connectors (strictly stacked Y intervals)
    if connector_count > 0:
        c_xs = np.linspace(-hx * 0.56, hx * 0.56, connector_count)
        for cx in c_xs:
            mod.add_chamfer_box(M_IVORY, cx, 0.087, hz - 0.105, 0.19, 0.060, 0.11, bevel=0.006)
            mod.add_box(M_RECESS, cx, 0.121, hz - 0.105, 0.145, 0.008, 0.052)
            mod.add_box(M_BRASS, cx, 0.129, hz - 0.105, 0.130, 0.008, 0.022)
        # Rear low-profile power/sense header + golden differential trace lanes
        for cx in (-0.22, 0.22):
            mod.add_chamfer_box(M_CHARCOAL, cx, 0.079, -hz + 0.105, 0.24, 0.044, 0.085, bevel=0.005)
            mod.add_box(M_BRASS, cx, 0.105, -hz + 0.105, 0.20, 0.008, 0.032)
    for tx in np.linspace(-0.24, 0.24, 9):
        mod.add_box(M_BRASS, tx, 0.061, hz * 0.66, 0.008, 0.008, 0.14)
        mod.add_box(M_BRASS, tx, 0.061, -hz * 0.66, 0.008, 0.008, 0.14)


def _add_mlcc_ring(mod: NodeBuilder, cx: float, cz: float, rx: float, rz: float, y: float = 0.094) -> None:
    """Adds a ring of ivory SMD decoupling micro-capacitors around the silicon die(s) on the substrate."""
    pts = []
    for x in np.linspace(-rx, rx, 8):
        pts.append([cx + x, y, cz - rz])
        pts.append([cx + x, y, cz + rz])
    for z in np.linspace(-rz + 0.05, rz - 0.05, 6):
        pts.append([cx - rx, y, cz + z])
        pts.append([cx + rx, y, cz + z])
    mod.add_boxes_grid(M_IVORY, np.asarray(pts, dtype=np.float32), 0.020, 0.014, 0.014)


def _add_die_core_grid(
    mod: NodeBuilder,
    cx: float,
    y_top: float,
    cz: float,
    sx: float,
    sz: float,
    rows: int = 4,
    cols: int = 4,
    spine: bool = True,
) -> None:
    """Etches subtle architectural AI Core (Cube/Vector) + L2 Cache relief blocks onto a silicon die."""
    if spine:
        # Central L2 / NoC spine in subtle antique brass ([y_top, y_top + 0.007])
        mod.add_box(M_BRASS, cx, y_top + 0.0035, cz, sx * 0.86, 0.007, sz * 0.10)
    cell_x = (sx * 0.82) / cols
    cell_z = (sz * 0.72) / rows
    pts = []
    for r in range(rows):
        z_off = (r - (rows - 1) * 0.5) * cell_z
        if spine and abs(z_off) < sz * 0.08 + cell_z * 0.34:
            z_off += 0.018 if z_off >= 0 else -0.018
        for c in range(cols):
            x_off = (c - (cols - 1) * 0.5) * cell_x
            pts.append([cx + x_off, y_top + 0.0035, cz + z_off])
    mod.add_boxes_grid(M_SILVER, np.asarray(pts, dtype=np.float32), cell_x * 0.72, 0.007, cell_z * 0.62)


def build_oam_module(
    board: NodeBuilder,
    name: str,
    kind: str,
    label: str,
    tx: float,
    ty: float,
    tz: float,
    variant: str,
    desc: str,
    source: str,
    idx_1based: int = 1,
) -> NodeBuilder:
    """
    Builds an accelerator module ('910b', 'a3_dual', '950dt', 'h100_sxm5', 'b200_sxm', or 'b200_coldplate').
    Preserves exact 910b footprint [-0.455, 0.455] x [-0.725, 0.725] when variant == '910b'.
    """
    hz = 0.90 if variant in ("h100_sxm5", "b200_sxm") else 0.725
    hx = 0.455
    mod = board.child(
        name,
        translation=[tx, ty, tz],
        extras={
            "kind": kind,
            "label": label,
            "explodeZ": 0.85,
            "explodeY": 0,
            "variant": variant,
            "description": desc,
            "source": source,
        },
    )
    vrm_n = 8 if variant in ("b200_sxm", "b200_coldplate") else (7 if variant in ("a3_dual", "950dt", "h100_sxm5") else 6)
    _add_module_base_pcb(mod, hx=hx, hz=hz, vrm_phases=vrm_n)

    # Organic package substrate + stiffener ring centered at z = -0.02 (y in [0.057, 0.087])
    pz = -0.02
    if variant in ("b200_sxm", "b200_coldplate"):
        sub_w, sub_d = (0.60, 0.68)
    elif variant in ("a3_dual", "950dt", "h100_sxm5"):
        sub_w, sub_d = (0.58, 0.66)
    else:
        sub_w, sub_d = (0.54, 0.58)
    mod.add_chamfer_box(M_SUBSTRATE, 0.0, 0.072, pz, sub_w, 0.030, sub_d, bevel=0.008)
    # Satin stiffener border around substrate (y in [0.087, 0.103])
    ring_t = 0.026
    mod.add_box(M_SILVER, 0.0, 0.095, pz + sub_d * 0.5 - ring_t * 0.5, sub_w, 0.016, ring_t)
    mod.add_box(M_SILVER, 0.0, 0.095, pz - sub_d * 0.5 + ring_t * 0.5, sub_w, 0.016, ring_t)
    mod.add_box(M_SILVER, -sub_w * 0.5 + ring_t * 0.5, 0.095, pz, ring_t, 0.016, sub_d - ring_t * 2)
    mod.add_box(M_SILVER, sub_w * 0.5 - ring_t * 0.5, 0.095, pz, ring_t, 0.016, sub_d - ring_t * 2)
    _add_mlcc_ring(mod, 0.0, pz, sub_w * 0.40, sub_d * 0.40, y=0.094)

    # Silicon interposer pad (y in [0.087, 0.097])
    mod.add_box(M_CHARCOAL, 0.0, 0.092, pz, sub_w * 0.72, 0.010, sub_d * 0.74)

    if variant == "910b":
        # Central Ascend SoC Die (y in [0.097, 0.119]) + 4 HBM stacks (2 left, 2 right)
        mod.add_chamfer_box(M_SILICON, 0.0, 0.108, pz, 0.22, 0.022, 0.30, bevel=0.005)
        _add_die_core_grid(mod, 0.0, 0.119, pz, 0.20, 0.28, rows=4, cols=4, spine=True)
        for sx in (-0.155, 0.155):
            for sz in (pz - 0.082, pz + 0.082):
                mod.add_chamfer_box(M_SILICON, sx, 0.107, sz, 0.068, 0.020, 0.115, bevel=0.004)
                mod.add_box(M_COPPER, sx, 0.1205, sz, 0.052, 0.007, 0.095)
        ihs_text = f"ASCEND {idx_1based}"
    elif variant == "a3_dual":
        # Dual Compute Dies + 8 HBM stacks (128 GB @ 3.2 TB/s) + D2D bridge
        for sz in (pz - 0.105, pz + 0.105):
            mod.add_chamfer_box(M_SILICON, 0.0, 0.108, sz, 0.23, 0.022, 0.172, bevel=0.005)
            _add_die_core_grid(mod, 0.0, 0.119, sz, 0.21, 0.152, rows=3, cols=4, spine=False)
        mod.add_box(M_BRASS, 0.0, 0.109, pz, 0.18, 0.024, 0.024)
        for sx in (-0.168, 0.168):
            for k in range(4):
                sz = pz + (k - 1.5) * 0.102
                mod.add_chamfer_box(M_SILICON, sx, 0.107, sz, 0.062, 0.020, 0.084, bevel=0.004)
                mod.add_box(M_COOLANT, sx, 0.1205, sz, 0.046, 0.007, 0.068)
        ihs_text = f"A3-128G {idx_1based}"
    elif variant == "950dt":
        # Exact Ascend 950DT Whitepaper UMA Package: 2 Central AI Dies + 2 North/South IO Dies + 4 HBM Modules
        for sz in (pz - 0.082, pz + 0.082):
            mod.add_chamfer_box(M_SILICON, 0.0, 0.108, sz, 0.235, 0.022, 0.145, bevel=0.005)
            _add_die_core_grid(mod, 0.0, 0.119, sz, 0.215, 0.125, rows=2, cols=6, spine=True)
        for sz in (pz - 0.205, pz + 0.205):
            mod.add_chamfer_box(M_SILICON, 0.0, 0.107, sz, 0.34, 0.020, 0.068, bevel=0.004)
            mod.add_box(M_COPPER, 0.0, 0.1205, sz, 0.30, 0.007, 0.042)
        for sx in (-0.168, 0.168):
            for sz in (pz - 0.082, pz + 0.082):
                mod.add_chamfer_box(M_SILICON, sx, 0.107, sz, 0.068, 0.020, 0.125, bevel=0.004)
                mod.add_box(M_BRASS, sx, 0.1205, sz, 0.050, 0.007, 0.102)
        ihs_text = f"950DT {idx_1based}"
    elif variant in ("b200_sxm", "b200_coldplate"):
        # Blackwell B200 CoWoS-L: Dual reticle-limit dies + central 10 TB/s NV-HBI bridge + 8x HBM3e stacks
        for sz in (pz - 0.108, pz + 0.108):
            mod.add_chamfer_box(M_SILICON, 0.0, 0.108, sz, 0.24, 0.022, 0.174, bevel=0.005)
            _add_die_core_grid(mod, 0.0, 0.119, sz, 0.215, 0.150, rows=2, cols=4, spine=False)
        mod.add_box(M_BRASS, 0.0, 0.109, pz, 0.21, 0.024, 0.024)
        for sx in (-0.172, 0.172):
            for k in range(4):
                sz = pz + (k - 1.5) * 0.104
                mod.add_chamfer_box(M_SILICON, sx, 0.107, sz, 0.062, 0.020, 0.084, bevel=0.004)
                mod.add_box(M_CHAMPAGNE, sx, 0.1205, sz, 0.048, 0.007, 0.068)
        ihs_text = f"B200 {idx_1based}"
    else:
        # NVIDIA H100 SXM5: GH100 Die (8 GPCs = 4x2 + L2 spine) + 6 HBM3 stacks (5 active + 1 spare site)
        mod.add_chamfer_box(M_SILICON, 0.0, 0.108, pz, 0.235, 0.022, 0.34, bevel=0.005)
        _add_die_core_grid(mod, 0.0, 0.119, pz, 0.21, 0.31, rows=4, cols=2, spine=True)
        for sx in (-0.165, 0.165):
            for sz in (pz - 0.115, pz, pz + 0.115):
                is_spare = sx > 0 and sz > pz + 0.05
                mod.add_chamfer_box(M_SILICON, sx, 0.107, sz, 0.064, 0.020, 0.092, bevel=0.004)
                mod.add_box(M_CHARCOAL if is_spare else M_CHAMPAGNE, sx, 0.1205, sz, 0.048, 0.007, 0.074)
        ihs_text = f"GH100 {idx_1based}"

    # Removable / liftable IHS heatspreader lid (kind='ihs') — y in [0.137, 0.171] <= 0.180 when closed!
    ihs = mod.child(
        f"{name}_ihs",
        translation=[0.0, 0.150, pz],
        extras={
            "kind": "ihs",
            "label": "封装顶盖 (IHS)",
            "explodeZ": 0,
            "explodeY": 0,
            "description": "镍铜合金封装均热顶盖，抬起后可见基板上的计算晶粒与高带宽内存堆栈示意。",
            "source": source,
        },
    )
    ihs.add_chamfer_box(M_SILVER, 0.0, 0.0, 0.0, sub_w * 0.86, 0.026, sub_d * 0.86, bevel=0.008)
    ihs.add_text(M_CHARCOAL, ihs_text, 0.0, 0.013, 0.0, height=0.046, thickness=0.007, plane="xz")
    # Front silkscreen badge on module frame (kept named Lettering so scene-parallel-hardware isolated check still works!)
    mod.add_text(M_CREAM, f"M{idx_1based}", 0.0, 0.057, hz - 0.21, height=0.048, thickness=0.007, plane="xz")

    # Cooler child (kind='cooler', stays mounted in Level 2 and lifts in Level 3)
    is_coldplate = variant in ("a3_dual", "b200_coldplate")
    cl = mod.child(
        f"{name}_cooler",
        translation=[0.0, 0.190, -0.06 if variant != "b200_coldplate" else -0.02],
        extras={
            "kind": "cooler",
            "label": "液冷板模组" if is_coldplate else "散热器",
            "explodeZ": 0,
            "explodeY": 0,
            "description": (
                "1U 直接芯片液冷（DLC）微通道紫铜冷板与免滴漏分液支路，直接带走双光罩 B200 计算晶粒与 8 颗 HBM3e 热量。"
                if variant == "b200_coldplate"
                else "微通道铜质液冷冷板与快换接头，接入整机 LAAC 液冷辅助风冷回路。"
                if variant == "a3_dual"
                else "均热板铜底、烧结铜热管与高密铝鳍片组成的服务器模组散热器。"
            ),
            "source": source,
        },
    )
    if variant == "a3_dual":
        cl.add_chamfer_box(M_COPPER, 0.0, 0.026, 0.04, 0.68, 0.052, 0.82, bevel=0.010)
        cl.add_chamfer_box(M_SILVER, 0.0, 0.088, 0.04, 0.74, 0.072, 0.88, bevel=0.012)
        cl.add_chamfer_box(M_CHARCOAL, 0.0, 0.133, 0.04, 0.56, 0.018, 0.64, bevel=0.006)
        cl.add_text(M_CREAM, "LAAC COLDPLATE", 0.0, 0.142, 0.04, height=0.042, thickness=0.007, plane="xz")
        for sx, accent in ((-0.18, M_VERMILION), (0.18, M_COOLANT)):
            cl.add_cylinder(M_SILVER, sx, 0.182, -0.18, 0.056, 0.052, 0.080, axis="y", segs=12)
            cl.add_cylinder(accent, sx, 0.238, -0.18, 0.064, 0.064, 0.032, axis="y", segs=12)
            cl.add_cylinder(M_BRASS, sx, 0.280, -0.18, 0.042, 0.042, 0.052, axis="y", segs=12)
    elif variant == "b200_coldplate":
        # Low-profile 1U Direct-to-Chip Copper Micro-Channel Coldplate (y_local in [0.002, 0.118] -> fits 1U tray!)
        cl.add_chamfer_box(M_COPPER, 0.0, 0.022, 0.0, 0.68, 0.040, 0.80, bevel=0.008)
        cl.add_chamfer_box(M_SILVER, 0.0, 0.062, 0.0, 0.74, 0.040, 0.86, bevel=0.008)
        cl.add_chamfer_box(M_CHAMPAGNE, 0.0, 0.092, 0.0, 0.54, 0.018, 0.62, bevel=0.006)
        cl.add_text(M_CHARCOAL, "DLC B200", 0.0, 0.101, 0.0, height=0.042, thickness=0.007, plane="xz")
        for sx, accent in ((-0.18, M_VERMILION), (0.18, M_COOLANT)):
            cl.add_cylinder(accent, sx, 0.062, 0.46, 0.028, 0.028, 0.064, axis="z", segs=10)
            cl.add_cylinder(M_BRASS, sx, 0.062, 0.51, 0.020, 0.020, 0.036, axis="z", segs=10)
    else:
        fin_h = 0.54 if variant == "b200_sxm" else (0.42 if variant == "h100_sxm5" else (0.44 if variant == "950dt" else 0.50))
        fin_d = 1.28 if variant in ("h100_sxm5", "b200_sxm") else 1.02
        cl.add_chamfer_box(M_COPPER, 0.0, 0.020, 0.02, 0.78, 0.038, fin_d * 0.92, bevel=0.008)
        hp_xs = (-0.30, -0.18, -0.06, 0.06, 0.18, 0.30) if variant in ("h100_sxm5", "b200_sxm") else (-0.26, -0.09, 0.09, 0.26)
        for hx_p in hp_xs:
            cl.add_tube(
                M_COPPER,
                [
                    (hx_p, 0.026, -fin_d * 0.44),
                    (hx_p, 0.08, -fin_d * 0.50),
                    (hx_p, fin_h * 0.58, -fin_d * 0.46),
                    (hx_p, fin_h * 0.58, fin_d * 0.48),
                    (hx_p, 0.08, fin_d * 0.52),
                    (hx_p, 0.026, fin_d * 0.46),
                ],
                radius=0.015 if len(hp_xs) == 6 else 0.017,
                segs=8,
            )
        xs = np.linspace(-0.395, 0.395, 26 if variant == "b200_sxm" else 24)
        centers = np.array([[x, 0.039 + fin_h * 0.5, 0.02] for x in xs], dtype=np.float32)
        cl.add_boxes_grid(M_CHARCOAL if variant == "b200_sxm" else M_SILVER, centers, 0.011, fin_h, fin_d)

        if variant == "h100_sxm5":
            cl.add_chamfer_box(M_CHARCOAL, 0.0, fin_h + 0.056, 0.02, 0.78, 0.030, fin_d * 0.90, bevel=0.008)
            cl.add_chamfer_box(M_CHAMPAGNE, 0.0, fin_h + 0.080, 0.02, 0.62, 0.018, fin_d * 0.72, bevel=0.006)
            cl.add_text(M_CHARCOAL, "H100 SXM5", 0.0, fin_h + 0.089, 0.02, height=0.058, thickness=0.008, plane="xz")
        elif variant == "b200_sxm":
            cl.add_chamfer_box(M_SILVER, 0.0, fin_h + 0.056, 0.02, 0.80, 0.030, fin_d * 0.92, bevel=0.008)
            cl.add_chamfer_box(M_CHAMPAGNE, 0.0, fin_h + 0.081, 0.02, 0.66, 0.020, fin_d * 0.76, bevel=0.006)
            cl.add_text(M_CHARCOAL, "B200 1000W", 0.0, fin_h + 0.091, 0.02, height=0.055, thickness=0.008, plane="xz")
        elif variant == "950dt":
            # Hybrid cold-plate manifold bridge across top of 950DT fin stack
            cl.add_chamfer_box(M_SAGE, 0.0, fin_h + 0.053, 0.02, 0.80, 0.028, fin_d * 0.94, bevel=0.008)
            cl.add_chamfer_box(M_COPPER, 0.0, fin_h + 0.081, -0.22, 0.56, 0.028, 0.18, bevel=0.006)
            for sx, acc in ((-0.16, M_VERMILION), (0.16, M_COOLANT)):
                cl.add_cylinder(acc, sx, fin_h + 0.111, -0.22, 0.038, 0.038, 0.032, axis="y", segs=10)
            cl.add_text(M_CREAM, "950DT", 0.0, fin_h + 0.067, 0.22, height=0.062, thickness=0.008, plane="xz")
        else:
            # Atlas 800T A2 slotted top shroud bridge with airflow windows
            for sz in (-0.36, 0.02, 0.40):
                cl.add_chamfer_box(M_SILVER, 0.0, fin_h + 0.050, sz, 0.82, 0.022, 0.16, bevel=0.006)
            for sx in (-0.38, 0.0, 0.38):
                cl.add_box(M_SILVER, sx, fin_h + 0.050, 0.02, 0.055, 0.022, fin_d * 0.98)
    return mod


def build_pcie_300i_duo_card(
    board: NodeBuilder,
    name: str,
    idx_1based: int,
    tx: float,
    ty: float,
    tz: float,
    source: str,
) -> NodeBuilder:
    """
    Builds a full-height full-length single-slot Huawei Atlas 300I Duo PCIe Gen4x16 inference card!
    Features PCIe x16 gold fingers, stainless rear bracket, dual Ascend 310-series SoC dies, 8 LPDDR4X chips,
    and liftable passive flow-through shroud heatsink.
    """
    card = board.child(
        name,
        translation=[tx, ty, tz],
        extras={
            "kind": "npu",
            "label": f"Atlas 300I Duo 推理卡 {idx_1based}",
            "explodeZ": 0.65,
            "explodeY": 0,
            "variant": "300i_duo",
            "description": "单槽全高全长 PCIe 4.0×16 双芯片推理卡：单张物理板卡集成 2 颗昇腾处理器与 48/96 GB LPDDR4X，软件侧暴露为 2 个独立可见 NPU Device。",
            "source": source,
        },
    )
    card_w = 0.86
    card_l = 2.16
    # Jade PCIe PCB: y in [0.005, 0.047]
    card.add_chamfer_box(M_PCB, 0.0, 0.026, 0.0, card_w, 0.042, card_l, bevel=0.008)
    # PCIe Gen4 x16 Gold Fingers protruding along left (-X) edge (clean ±X and ±Y step from PCB)
    card.add_box(M_PCB, -card_w * 0.5 - 0.045, 0.026, 0.22, 0.095, 0.030, 0.78)
    finger_zs = [z for z in np.linspace(-0.14, 0.58, 22) if abs(z - 0.44) > 0.035]
    fingers = np.array([[-card_w * 0.5 - 0.042, 0.026, z] for z in finger_zs], dtype=np.float32)
    card.add_boxes_grid(M_BRASS, fingers, 0.066, 0.044, 0.018)

    # Stainless Rear PCIe Full-Height I/O Bracket at -Z end
    bz = -card_l * 0.5 - 0.02
    card.add_chamfer_box(M_SILVER, 0.02, 0.095, bz, card_w + 0.12, 0.22, 0.028, bevel=0.006)
    card.add_box(M_SILVER, card_w * 0.5 + 0.07, 0.16, bz + 0.04, 0.08, 0.035, 0.11)  # PCIe retention tab
    # Exhaust vent cutouts on PCIe bracket (proud of bz - 0.014 by 0.010)
    vents = np.array([[x, y, bz - 0.019] for x in np.linspace(-0.30, 0.34, 7) for y in (0.06, 0.13)], dtype=np.float32)
    card.add_boxes_grid(M_RECESS, vents, 0.062, 0.042, 0.010)

    # PCIe Bridge / Switch IC placed cleanly between the two SoCs + VRM stages at front (+Z) end
    card.add_chamfer_box(M_SUBSTRATE, -0.22, 0.057, -0.06, 0.18, 0.020, 0.18, bevel=0.004)
    card.add_chamfer_box(M_SILICON, -0.22, 0.076, -0.06, 0.11, 0.018, 0.11, bevel=0.003)
    vrms = np.array([[x, 0.071, 0.86] for x in np.linspace(-0.30, 0.30, 6)], dtype=np.float32)
    card.add_boxes_grid(M_CHARCOAL, vrms, 0.065, 0.048, 0.065)
    for x in np.linspace(-0.28, 0.28, 5):
        card.add_cylinder(M_SILVER, x, 0.073, 0.96, 0.022, 0.022, 0.052, axis="y", segs=8)

    # TWO Ascend 310-series SoC Packages (Die 0 at z=-0.48, Die 1 at z=+0.36) + 8 LPDDR4X chips!
    for d_idx, dz in enumerate((-0.48, 0.36)):
        card.add_chamfer_box(M_SUBSTRATE, 0.06, 0.057, dz, 0.34, 0.020, 0.34, bevel=0.006)
        _add_mlcc_ring(card, 0.06, dz, 0.14, 0.14, y=0.074)
        card.add_chamfer_box(M_SILICON, 0.06, 0.076, dz, 0.185, 0.018, 0.185, bevel=0.004)
        _add_die_core_grid(card, 0.06, 0.085, dz, 0.16, 0.16, rows=2, cols=4, spine=True)
        # 4 LPDDR4X memory chips around each SoC (8 total on card = 48/96 GB, seated on PCB top 0.047)
        lp_coords = [
            [0.06 - 0.24, 0.059, dz - 0.09],
            [0.06 - 0.24, 0.059, dz + 0.09],
            [0.06 + 0.24, 0.059, dz - 0.09],
            [0.06 + 0.24, 0.059, dz + 0.09],
        ]
        card.add_boxes_grid(M_RECESS, np.asarray(lp_coords, dtype=np.float32), 0.072, 0.024, 0.115)

    # Dual IHS heatspreader plate (kind='ihs', y in [0.099, 0.126])
    ihs = card.child(
        f"{name}_ihs",
        translation=[0.06, 0.109, -0.06],
        extras={
            "kind": "ihs",
            "label": "双芯均热底座盖",
            "explodeZ": 0,
            "explodeY": 0,
            "description": "覆盖两颗昇腾推理芯片与 LPDDR4X 颗粒的铜铝均热盖。",
            "source": source,
        },
    )
    for dz, tag in ((-0.42, "ASCEND-0"), (0.42, "ASCEND-1")):
        ihs.add_chamfer_box(M_SILVER, 0.0, 0.0, dz, 0.29, 0.020, 0.29, bevel=0.006)
        ihs.add_text(M_CHARCOAL, tag, 0.0, 0.010, dz, height=0.036, thickness=0.007, plane="xz")

    # Single-slot flow-through PCIe Shroud Heatsink (kind='cooler', stays mounted in Level 2 and lifts in Level 3)
    cl = card.child(
        f"{name}_cooler",
        translation=[0.0, 0.134, -0.02],
        extras={
            "kind": "cooler",
            "label": "被动导流散热外罩",
            "explodeZ": 0,
            "explodeY": 0,
            "description": "全高全长单槽直通风道散热鳍片与铝合金导流罩，依赖服务器机箱风扇前后贯通散热。",
            "source": source,
        },
    )
    cl.add_chamfer_box(M_COPPER, 0.04, 0.012, -0.04, 0.56, 0.020, 1.56, bevel=0.006)
    # Longitudinal flow-through fins (14 fins running front-to-back along Z!)
    fin_xs = np.linspace(-0.34, 0.36, 14)
    cl.add_boxes_grid(
        M_SILVER,
        np.array([[x, 0.072, 0.0] for x in fin_xs], dtype=np.float32),
        0.012,
        0.100,
        2.02,
    )
    # Anodized charcoal & satin-silver top shroud cover + Atlas vermilion accent bar
    cl.add_chamfer_box(M_CHARCOAL, 0.0, 0.134, 0.0, card_w * 0.96, 0.024, 2.06, bevel=0.008)
    cl.add_chamfer_box(M_SILVER, -0.16, 0.150, 0.0, 0.42, 0.008, 1.94, bevel=0.004)
    cl.add_box(M_VERMILION, 0.28, 0.150, 0.0, 0.055, 0.008, 1.96)
    cl.add_text(M_CREAM, "ATLAS 300I DUO", -0.16, 0.154, 0.0, height=0.048, thickness=0.007, plane="xz")
    return card


def build_grace_superchip_cpu(
    host: NodeBuilder,
    prefix: str,
    idx_1based: int,
    tx: float,
    ty: float,
    tz: float,
    source: str,
) -> NodeBuilder:
    """Builds 1U liquid-cooled NVIDIA Grace 72-core Arm CPU + 16 soldered LPDDR5X packages for GB200 NVL72."""
    c = host.child(
        f"{prefix}_cpu{idx_1based - 1}",
        translation=[tx, ty, tz],
        extras={
            "kind": "cpu",
            "label": f"Grace CPU {idx_1based}",
            "explodeZ": 0.32,
            "explodeY": 0,
            "description": "NVIDIA Grace 72 核 Arm Neoverse V2 处理器，搭配板载焊装 LPDDR5X 内存颗粒，经 900 GB/s NVLink-C2C 直连本组 2 颗 B200 GPU。",
            "source": source,
        },
    )
    c.add_chamfer_box(M_SUBSTRATE, 0.0, 0.016, 0.0, 0.50, 0.024, 0.56, bevel=0.006)
    c.add_chamfer_box(M_SILICON, 0.0, 0.039, 0.0, 0.30, 0.020, 0.34, bevel=0.004)
    _add_die_core_grid(c, 0.0, 0.049, 0.0, 0.27, 0.30, rows=4, cols=4, spine=True)
    c.add_chamfer_box(M_SILVER, 0.0, 0.072, 0.0, 0.44, 0.020, 0.48, bevel=0.006)
    # 16 soldered LPDDR5X ECC memory packages flanking left & right of Grace substrate (disjoint in X)
    lp_pts = []
    for sx in (-0.36, 0.36):
        for r in range(4):
            for col in (-0.045, 0.045):
                lp_pts.append([sx + col, 0.018, (r - 1.5) * 0.145])
    c.add_boxes_grid(M_RECESS, np.asarray(lp_pts, dtype=np.float32), 0.068, 0.026, 0.105)

    cl = c.child(
        f"{prefix}_cpu{idx_1based - 1}_cooler",
        translation=[0.0, 0.082, 0.0],
        extras={
            "kind": "cooler",
            "label": "Grace 液冷板",
            "explodeZ": 0,
            "explodeY": 0,
            "description": "覆盖 Grace CPU 与板载 LPDDR5X 的 1U 微通道紫铜液冷板。",
            "source": source,
        },
    )
    cl.add_chamfer_box(M_COPPER, 0.0, 0.018, 0.0, 0.62, 0.032, 0.64, bevel=0.006)
    cl.add_chamfer_box(M_SILVER, 0.0, 0.052, 0.0, 0.68, 0.034, 0.68, bevel=0.006)
    cl.add_text(M_CHARCOAL, f"GRACE {idx_1based}", 0.0, 0.069, 0.0, height=0.042, thickness=0.007, plane="xz")
    return c


def build_pcie_h100_nvl_card(
    board: NodeBuilder,
    name: str,
    idx_1based: int,
    tx: float,
    ty: float,
    tz: float,
    source: str,
) -> NodeBuilder:
    """Builds a dual-slot full-height full-length NVIDIA H100 NVL PCIe Gen5x16 card (94 GB HBM3 + 3x NVLink tabs)."""
    card = board.child(
        name,
        translation=[tx, ty, tz],
        extras={
            "kind": "gpu",
            "label": f"H100 NVL PCIe 卡 {idx_1based}",
            "explodeZ": 0.72,
            "explodeY": 0,
            "variant": "h100_nvl",
            "description": "双槽全高全长 H100 NVL PCIe 5.0×16 推理卡：单卡启用全部 6 颗 HBM3 堆栈提供 94 GB 显存与 3.9 TB/s 带宽，顶部经 3 路 NVLink 4 桥接器与邻卡组成 188 GB 显存对（600 GB/s 双向互联）。",
            "source": source,
        },
    )
    card_w, card_l = 0.88, 2.26
    card.add_chamfer_box(M_PCB, 0.0, 0.026, 0.0, card_w, 0.042, card_l, bevel=0.008)

    # Bottom (-X) PCIe Gen5 x16 edge connector + brass fingers
    card.add_box(M_PCB, -card_w * 0.5 - 0.045, 0.026, 0.20, 0.095, 0.030, 0.80)
    f_zs = [z for z in np.linspace(-0.16, 0.56, 22) if abs(z - 0.42) > 0.035]
    card.add_boxes_grid(M_BRASS, np.array([[-card_w * 0.5 - 0.042, 0.026, z] for z in f_zs], dtype=np.float32), 0.066, 0.044, 0.018)

    # Top (+X) 3x NVLink 4 edge bridge finger tabs (paired cards link across these 3 tabs!)
    for tz_tab in (-0.42, -0.10, 0.22):
        card.add_box(M_PCB, card_w * 0.5 + 0.038, 0.026, tz_tab, 0.080, 0.030, 0.21)
        nv_pts = np.array([[card_w * 0.5 + 0.040, 0.026, z] for z in np.linspace(tz_tab - 0.08, tz_tab + 0.08, 7)], dtype=np.float32)
        card.add_boxes_grid(M_BRASS, nv_pts, 0.056, 0.044, 0.016)

    # Dual-slot stainless rear I/O bracket (-Z) with honeycomb exhaust vents
    bz = -card_l * 0.5 - 0.02
    card.add_chamfer_box(M_SILVER, 0.02, 0.180, bz, card_w + 0.12, 0.36, 0.028, bevel=0.006)
    card.add_box(M_SILVER, card_w * 0.5 + 0.07, 0.32, bz + 0.04, 0.08, 0.035, 0.11)
    vents = np.array([[x, y, bz - 0.019] for x in np.linspace(-0.30, 0.34, 8) for y in (0.07, 0.15, 0.23, 0.30)], dtype=np.float32)
    card.add_boxes_grid(M_RECESS, vents, 0.058, 0.044, 0.010)

    # Rear/tail (+Z) 16-pin 12VHPWR PCIe Gen5 power receptacle + 10-phase VRM bank
    card.add_chamfer_box(M_CHARCOAL, 0.22, 0.080, 1.03, 0.18, 0.066, 0.12, bevel=0.004)
    card.add_box(M_RECESS, 0.22, 0.080, 1.096, 0.14, 0.040, 0.012)
    card.add_box(M_BRASS, 0.22, 0.080, 1.106, 0.11, 0.014, 0.010)
    vrms = np.array([[x, 0.072, 0.64] for x in np.linspace(-0.32, 0.32, 8)], dtype=np.float32)
    card.add_boxes_grid(M_CHARCOAL, vrms, 0.058, 0.050, 0.058)

    # Central CoWoS GH100 package + ALL 6 ACTIVE HBM3 stacks (94 GB @ 3.9 TB/s) at z = -0.10
    pz = -0.10
    card.add_chamfer_box(M_SUBSTRATE, 0.0, 0.061, pz, 0.54, 0.028, 0.60, bevel=0.006)
    _add_mlcc_ring(card, 0.0, pz, 0.22, 0.25, y=0.082)
    card.add_box(M_CHARCOAL, 0.0, 0.080, pz, 0.40, 0.010, 0.46)
    card.add_chamfer_box(M_SILICON, 0.0, 0.096, pz, 0.22, 0.022, 0.32, bevel=0.004)
    _add_die_core_grid(card, 0.0, 0.107, pz, 0.195, 0.29, rows=4, cols=2, spine=True)
    for sx in (-0.155, 0.155):
        for sz in (pz - 0.11, pz, pz + 0.11):
            card.add_chamfer_box(M_SILICON, sx, 0.095, sz, 0.060, 0.020, 0.086, bevel=0.004)
            card.add_box(M_CHAMPAGNE, sx, 0.1085, sz, 0.046, 0.007, 0.068)

    ihs = card.child(
        f"{name}_ihs",
        translation=[0.0, 0.128, pz],
        extras={"kind": "ihs", "label": "GH100 封装顶盖", "explodeZ": 0, "explodeY": 0, "description": "覆盖 GH100 计算晶粒与全部 6 颗启用 HBM3 堆栈的均热金属盖。", "source": source},
    )
    ihs.add_chamfer_box(M_SILVER, 0.0, 0.0, 0.0, 0.46, 0.022, 0.52, bevel=0.006)
    ihs.add_text(M_CHARCOAL, f"GH100 NVL {idx_1based}", 0.0, 0.011, 0.0, height=0.036, thickness=0.007, plane="xz")

    cl = card.child(
        f"{name}_cooler",
        translation=[0.0, 0.148, -0.06],
        extras={"kind": "cooler", "label": "双槽直通被动散热器", "explodeZ": 0, "explodeY": 0, "description": "双槽全高全长被动导流鳍片与银色/香槟金阳极氧化导流外罩，露空顶部 3 组 NVLink 桥接金手指与尾部 16-pin 供电口。", "source": source},
    )
    cl.add_chamfer_box(M_COPPER, 0.0, 0.012, -0.04, 0.58, 0.022, 1.52, bevel=0.006)
    fin_xs = np.linspace(-0.36, 0.36, 16)
    cl.add_boxes_grid(M_SILVER, np.array([[x, 0.105, 0.0] for x in fin_xs], dtype=np.float32), 0.012, 0.164, 1.92)
    cl.add_chamfer_box(M_SILVER, 0.0, 0.200, 0.0, card_w * 0.94, 0.024, 1.96, bevel=0.008)
    cl.add_chamfer_box(M_CHAMPAGNE, -0.14, 0.218, 0.0, 0.46, 0.012, 1.84, bevel=0.005)
    cl.add_text(M_CHARCOAL, "NVIDIA H100 NVL", -0.14, 0.224, 0.0, height=0.048, thickness=0.007, plane="xz")
    return card
