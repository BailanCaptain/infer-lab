import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const TENSOR_LAYOUT_ND_NZ_CUBE_APPROVED_SHA256 =
  "7eb7193b88df4024e0c5b3e11f51d7ac2528dc1937cb86b890ab8683d35240a4";
export const TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256 = TENSOR_LAYOUT_ND_NZ_CUBE_APPROVED_SHA256;

export const TENSOR_FOCUS_MODES = ["block-0", "block-1", "block-2", "block-3", "row-0"] as const;
export type TensorFocusMode = (typeof TENSOR_FOCUS_MODES)[number];
export type TensorLayoutDiagramMode = "sandbox" | "svg";

export interface MatrixCellInfo {
  readonly value: number;
  readonly row: number;
  readonly col: number;
  readonly blockIdx: 0 | 1 | 2 | 3;
  readonly ndOffset: number;
  readonly nzOffset: number;
}

/**
 * 4×4 教学矩阵（小块 m₀=n₀=2）：
 * 逻辑坐标 (i, j) -> ND 偏移 = 4*i + j
 * 物理四维 (⌊j/2⌋, ⌊i/2⌋, i mod 2, j mod 2) -> 块间按列（大 N）、块内按行（小 z）
 */
export function ndOffset4x4(row: number, col: number): number {
  return row * 4 + col;
}

export function nzOffset4x4(row: number, col: number): number {
  const n1 = Math.floor(col / 2);
  const m1 = Math.floor(row / 2);
  const i0 = row % 2;
  const j0 = col % 2;
  return n1 * 8 + m1 * 4 + i0 * 2 + j0;
}

export interface NzPaddingAccounting {
  readonly rows: number;
  readonly cols: number;
  readonly paddedRows: number;
  readonly paddedCols: number;
  readonly validBytes: number;
  readonly totalBytes: number;
  readonly extraPadBytes: number;
  readonly padSharePct: number;
}

export function computeNzPaddingBytes(
  rows: number,
  cols: number,
  tileM = 16,
  tileN = 16,
  elemBytes = 2,
): NzPaddingAccounting {
  const paddedRows = Math.ceil(rows / tileM) * tileM;
  const paddedCols = Math.ceil(cols / tileN) * tileN;
  const validBytes = rows * cols * elemBytes;
  const totalBytes = paddedRows * paddedCols * elemBytes;
  const extraPadBytes = totalBytes - validBytes;
  const padSharePct = Number(((extraPadBytes / totalBytes) * 100).toFixed(1));
  return {
    rows,
    cols,
    paddedRows,
    paddedCols,
    validBytes,
    totalBytes,
    extraPadBytes,
    padSharePct,
  };
}

export const MATRIX_4X4_CELLS: readonly MatrixCellInfo[] = Array.from({ length: 16 }, (_, idx) => {
  const row = Math.floor(idx / 4);
  const col = idx % 4;
  const value = idx + 1;
  const blockIdx = (Math.floor(col / 2) * 2 + Math.floor(row / 2)) as 0 | 1 | 2 | 3;
  return {
    value,
    row,
    col,
    blockIdx,
    ndOffset: ndOffset4x4(row, col),
    nzOffset: nzOffset4x4(row, col),
  };
});

export const ND_MEMORY_ORDER: readonly MatrixCellInfo[] = [...MATRIX_4X4_CELLS].sort(
  (a, b) => a.ndOffset - b.ndOffset,
);
export const NZ_MEMORY_ORDER: readonly MatrixCellInfo[] = [...MATRIX_4X4_CELLS].sort(
  (a, b) => a.nzOffset - b.nzOffset,
);

export interface TensorFocusSpec {
  readonly id: TensorFocusMode;
  readonly shortBtn: string;
  readonly title: string;
  readonly values: readonly number[];
  readonly ndOffsets: readonly number[];
  readonly nzOffsets: readonly number[];
  readonly ndContiguous: boolean;
  readonly nzContiguous: boolean;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn";
  readonly takeaway: string;
  readonly kpi: string;
}

const FOCUS_SPECS: Record<TensorFocusMode, TensorFocusSpec> = {
  "block-0": {
    id: "block-0",
    shortBtn: "① 左上块 (1,2,5,6)",
    title: "大 N 第 1 站 · 左上 2×2 分块",
    values: [1, 2, 5, 6],
    ndOffsets: [0, 1, 4, 5],
    nzOffsets: [0, 1, 2, 3],
    ndContiguous: false,
    nzContiguous: true,
    badgeText: "大 N 第 1 站 · 元素 5 迁址",
    takeawayTone: "default",
    takeaway:
      "要抓左上小块 (1,2,5,6)，在 ND 里读完 1,2 必须跨过 3,4 去抓 5,6；转成 NZ 后紧挨在物理偏移 0..3（元素 5 从偏移 4 挪到偏移 2，逻辑第 2 行第 1 列不变）！",
    kpi: "ND 偏移 [0,1, 4,5] 跳读 → NZ [0,1,2,3] 连续",
  },
  "block-1": {
    id: "block-1",
    shortBtn: "② 左下块 (9,10,13,14)",
    title: "大 N 第 2 站 · 沿首列向下抓左下块",
    values: [9, 10, 13, 14],
    ndOffsets: [8, 9, 12, 13],
    nzOffsets: [4, 5, 6, 7],
    ndContiguous: false,
    nzContiguous: true,
    badgeText: "大 N 第 2 站 · 外层先竖走",
    takeawayTone: "default",
    takeaway:
      "块与块之间先沿第 1 列向下走（画大写 N 的左竖）：左下块 (9,10,13,14) 紧跟在左上块后面落入 NZ 偏移 4..7，Cube 顺着地址就能连吃整列分块！",
    kpi: "ND 偏移 [8,9, 12,13] 跳读 → NZ [4,5,6,7] 连续",
  },
  "block-2": {
    id: "block-2",
    shortBtn: "③ 右上块 (3,4,7,8)",
    title: "大 N 第 3 站 · 斜跨到第 2 列顶右上块",
    values: [3, 4, 7, 8],
    ndOffsets: [2, 3, 6, 7],
    nzOffsets: [8, 9, 10, 11],
    ndContiguous: false,
    nzContiguous: true,
    badgeText: "大 N 第 3 站 · 斜跨次列顶",
    takeawayTone: "accent",
    takeaway:
      "扫完左列两个分块后，路径斜向上跳到第 2 列顶部（画大写 N 的斜杠），块内仍按小 z 从左到右、从上到下依次写入 3,4,7,8（NZ 偏移 8..11）。",
    kpi: "ND 偏移 [2,3, 6,7] 跳读 → NZ [8,9,10,11] 连续",
  },
  "block-3": {
    id: "block-3",
    shortBtn: "④ 右下块 (11,12,15,16)",
    title: "大 N 第 4 站 · 沿第 2 列向下收尾",
    values: [11, 12, 15, 16],
    ndOffsets: [10, 11, 14, 15],
    nzOffsets: [12, 13, 14, 15],
    ndContiguous: false,
    nzContiguous: true,
    badgeText: "大 N 第 4 站 · 全表整盒齐",
    takeawayTone: "default",
    takeaway:
      "最后沿第 2 列向下收尾（画完大写 N 的右竖）：四个 2×2 便当盒全部按整块排齐，加载期转好一次，后续千百步前向直接整块送进矩阵核！",
    kpi: "ND 偏移 [10,11, 14,15] → NZ [12,13,14,15] 连续",
  },
  "row-0": {
    id: "row-0",
    shortBtn: "⑤ 首行对比 & 补齐账",
    title: "按单行读 vs 按块读 + 17×17 尾部补齐代价",
    values: [1, 2, 3, 4],
    ndOffsets: [0, 1, 2, 3],
    nzOffsets: [0, 1, 8, 9],
    ndContiguous: true,
    nzContiguous: false,
    badgeText: "权衡边界 · 补零与休眠互斥",
    takeawayTone: "warn",
    takeaway:
      "若只读单行 (1,2,3,4)，ND 连续而 NZ 反被拆到 [0,1] 与 [8,9]；且 17×17 FP16 矩阵转 16×16 分块须补齐到 32×32（有效 578B + 补零 1,470B），并非无脑省空间！",
    kpi: "17×17 FP16 补齐：578 B → 2,048 B（补零占 71.8%）",
  },
};

export function getTensorFocusSpec(focus: TensorFocusMode): TensorFocusSpec {
  return FOCUS_SPECS[focus];
}

export interface TensorLayoutNdNzInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: TensorLayoutDiagramMode | undefined;
  readonly initialFocus?: TensorFocusMode | undefined;
}

export function TensorLayoutNdNzInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialFocus = "block-0",
}: TensorLayoutNdNzInteractiveProps) {
  const [mode, setMode] = useState<TensorLayoutDiagramMode>(initialMode);
  const [focus, setFocus] = useState<TensorFocusMode>(initialFocus);
  const [playing, setPlaying] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mBigN = `${id}-${uid}-nz-bign`;

  const spec = useMemo(() => getTensorFocusSpec(focus), [focus]);
  const pad17 = useMemo(() => computeNzPaddingBytes(17, 17, 16, 16, 2), []);
  const focusIdx = TENSOR_FOCUS_MODES.indexOf(focus);
  const activeValSet = useMemo(() => new Set(spec.values), [spec.values]);

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setFocus((prev) => {
        const idx = TENSOR_FOCUS_MODES.indexOf(prev);
        if (idx >= TENSOR_FOCUS_MODES.length - 1) {
          setPlaying(false);
          return TENSOR_FOCUS_MODES[TENSOR_FOCUS_MODES.length - 1]!;
        }
        const nextIdx = idx + 1;
        if (nextIdx >= TENSOR_FOCUS_MODES.length - 1) setPlaying(false);
        return TENSOR_FOCUS_MODES[nextIdx]!;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectFocus = (next: TensorFocusMode) => {
    setPlaying(false);
    setMode("sandbox");
    setFocus(next);
  };

  const toggleAutoPlay = () => {
    setMode("sandbox");
    if (playing) {
      setPlaying(false);
      return;
    }
    if (focusIdx >= TENSOR_FOCUS_MODES.length - 1) setFocus("block-0");
    setPlaying(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (
      scrollable &&
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      event.target.classList.contains("wiki-diagram-svg") &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      return;
    }
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        selectFocus(TENSOR_FOCUS_MODES[Math.min(TENSOR_FOCUS_MODES.length - 1, focusIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectFocus(TENSOR_FOCUS_MODES[Math.max(0, focusIdx - 1)]!);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        event.preventDefault();
        selectFocus(TENSOR_FOCUS_MODES[Number(event.key) - 1]!);
        break;
    }
  };

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      onToggleMode={(next) => {
        setPlaying(false);
        setMode(next);
      }}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 A/B · 分块地址映射"
      kickerTitle="ND 行优先 vs FRACTAL_NZ 大 N 小 z 分形排布"
      question="为什么昇腾算矩阵乘前要把好端端的二维表（ND）切成大 N 小 z 的分形块（NZ）？"
      toolbarLabel="ND 与 FRACTAL_NZ 分块高亮与遍历控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-focus": focus,
        "data-nz-contiguous": spec.nzContiguous ? "true" : "false",
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="tensor-nz-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "dark")}
              onClick={toggleAutoPlay}
            >
              {playing ? "⏸ 暂停遍历" : "▶ 自动演示"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="tensor-nz-prev"
              disabled={focusIdx <= 0}
              style={eduBtnStyle(false)}
              onClick={() => selectFocus(TENSOR_FOCUS_MODES[Math.max(0, focusIdx - 1)]!)}
            >
              ◀ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="tensor-nz-next"
              disabled={focusIdx >= TENSOR_FOCUS_MODES.length - 1}
              style={eduBtnStyle(false)}
              onClick={() =>
                selectFocus(TENSOR_FOCUS_MODES[Math.min(TENSOR_FOCUS_MODES.length - 1, focusIdx + 1)]!)
              }
            >
              下一步 ▶
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="矩阵分块与首行映射切换">
            {TENSOR_FOCUS_MODES.map((m) => {
              const active = mode === "sandbox" && focus === m;
              return (
                <button
                  key={m}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`tensor-focus-${m}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => selectFocus(m)}
                >
                  {FOCUS_SPECS[m].shortBtn}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={spec.takeawayTone}
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（四维映射公式 / 半精度与整数对齐块形 / 权重转换模式与休眠唤醒互斥）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：逻辑坐标 <code>(i, j)</code> 映射到物理四维{" "}
          <code>(⌊j/n₀⌋, ⌊i/m₀⌋, i mod m₀, j mod n₀)</code>；ATB <code>TransdataOperation</code> 约定{" "}
          <code>FP16/BF16</code> 块为 <code>16×16</code>、<code>INT8</code> 块为 <code>16×32</code>
          （转置交换逻辑轴，不等于 <code>FRACTAL_NZ</code> 转换，<code>contiguous</code>{" "}
          亦不等于设备格式变更）。<code>v0.30.0</code> 由 <code>additional_config.weight_nz_mode</code>（
          <code>0/1/2</code>，默认 <code>1</code> 仅转普通 <code>INT8</code>，旧{" "}
          <code>VLLM_ASCEND_ENABLE_NZ</code> 已退役；<code>310P</code> 硬件档案 <code>FORCE_NZ</code> 优先于{" "}
          <code>mode=0</code>，且 W8A8 专家另有直接转换）。注意：启用 <code>Sleep Mode</code> 唤醒须显式设{" "}
          <code>weight_nz_mode=0</code>（<code>rl_config.enabled</code> 也会自动置 <code>0</code>）。
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 逻辑 4×4 矩阵（2×2 便当盒切分）</span>
            <span className="wiki-edu-badge is-mid">{`当前高亮 [${spec.values.join(", ")}]`}</span>
          </div>

          <svg
            viewBox="0 0 380 184"
            width="380"
            height="184"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`4×4 逻辑矩阵与大 N 小 z 遍历：当前高亮 ${spec.values.join(",")}`}
          >
            <defs>
              <marker
                id={mBigN}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#e85b32" />
              </marker>
            </defs>

            <rect
              x="26"
              y="16"
              width="110"
              height="82"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeDasharray="4 3"
            />
            <rect
              x="26"
              y="102"
              width="110"
              height="78"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeDasharray="4 3"
            />
            <rect
              x="142"
              y="16"
              width="110"
              height="82"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeDasharray="4 3"
            />
            <rect
              x="142"
              y="102"
              width="110"
              height="78"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeDasharray="4 3"
            />

            {MATRIX_4X4_CELLS.map((cell) => {
              const x = cell.col < 2 ? 32 + cell.col * 52 : 148 + (cell.col - 2) * 52;
              const y = cell.row < 2 ? 22 + cell.row * 38 : 108 + (cell.row - 2) * 38;
              const isHit = activeValSet.has(cell.value);
              const isElem5 = cell.value === 5 && focus === "block-0";
              return (
                <g key={cell.value}>
                  <rect
                    x={x}
                    y={y}
                    width="46"
                    height="32"
                    rx="6"
                    fill={isElem5 ? "#fff4cf" : isHit ? "#ddf4ef" : "#ffffff"}
                    stroke={isElem5 ? "#e85b32" : isHit ? "#087f73" : "#d8d8cf"}
                    strokeWidth={isHit ? "2" : "1.2"}
                  />
                  <text
                    x={x + 23}
                    y={y + 21}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#17211f"
                  >
                    {cell.value}
                  </text>
                </g>
              );
            })}

            <path
              d="M 81 57 L 81 141 L 197 57 L 197 141"
              fill="none"
              stroke="#e85b32"
              strokeWidth="2"
              strokeDasharray="5 3"
              opacity="0.72"
              markerEnd={`url(#${mBigN})`}
            />

            <rect x="262" y="22" width="110" height="46" rx="7" fill="#fff0e9" stroke="#e85b32" />
            <text x="317" y="42" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              外层：大 N
            </text>
            <text x="317" y="59" textAnchor="middle" fontSize="12" fill="#66716d">
              先竖后斜跨列
            </text>

            <rect x="262" y="78" width="110" height="46" rx="7" fill="#e8edff" stroke="#4c65b6" />
            <text x="317" y="98" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              块内：小 z
            </text>
            <text x="317" y="115" textAnchor="middle" fontSize="12" fill="#66716d">
              块内逐行连排
            </text>

            <rect x="262" y="134" width="110" height="42" rx="7" fill="#ddf4ef" stroke="#087f73" />
            <text x="317" y="160" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              Cube 整块吞吐
            </text>
          </svg>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② 物理内存地址落点（偏移 0..15）</span>
            <span className={`wiki-edu-badge ${spec.nzContiguous ? "is-good" : "is-warn"}`}>
              {spec.nzContiguous ? "NZ 连续 4 格直搬" : "单行读 ND 连续"}
            </span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>ND 行优先内存（1 → 16 顺排）</span>
              <span className="mono">
                {spec.ndContiguous ? "连续 4 格" : `跨行跳地址 [${spec.ndOffsets.join(", ")}]`}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
                gap: "4px",
              }}
            >
              {ND_MEMORY_ORDER.map((cell) => {
                const hit = activeValSet.has(cell.value);
                return (
                  <div
                    key={`nd-${cell.ndOffset}`}
                    style={{
                      padding: "3px 2px",
                      borderRadius: "5px",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: hit ? 800 : 500,
                      border: `1.4px solid ${hit ? (spec.ndContiguous ? "#087f73" : "#b54237") : "#d8d8cf"}`,
                      background: hit ? (spec.ndContiguous ? "#ddf4ef" : "#fff0e9") : "#fbfaf6",
                      color: "#17211f",
                    }}
                  >
                    <div>{cell.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>FRACTAL_NZ 内存（按 2×2 块连续存放）</span>
              <span className="mono">
                {spec.nzContiguous
                  ? `连续偏移 [${spec.nzOffsets.join(", ")}] 一把搬入 L0`
                  : `跨块偏移 [${spec.nzOffsets.join(", ")}]`}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
                gap: "4px",
              }}
            >
              {NZ_MEMORY_ORDER.map((cell) => {
                const hit = activeValSet.has(cell.value);
                return (
                  <div
                    key={`nz-${cell.nzOffset}`}
                    style={{
                      padding: "3px 2px",
                      borderRadius: "5px",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: hit ? 800 : 500,
                      border: `1.4px solid ${hit ? (spec.nzContiguous ? "#087f73" : "#c78300") : "#d8d8cf"}`,
                      background: hit ? (spec.nzContiguous ? "#ddf4ef" : "#fff4cf") : "#fbfaf6",
                      color: "#17211f",
                    }}
                  >
                    <div>{cell.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wiki-edu-tok-pill is-sys">
            <span>{`17×17 FP16 补齐 32×32（有效 ${pad17.validBytes}B）`}</span>
            <span className="wiki-edu-ptr-tag">{`补零 +${pad17.extraPadBytes}B = ${pad17.totalBytes}B`}</span>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
