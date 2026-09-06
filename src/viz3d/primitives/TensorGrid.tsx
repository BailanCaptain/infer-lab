/**
 * TensorGrid：一个张量的完整教学呈现 = 全幅平面（体量与值场）+ 放大窗口（真实数值）+ 标签车道。
 *
 * 硬约束：
 * - 平面按压缩后的显示比例铺开，**真实 shape 与真实比例必须出现在标签上**（scale.ts 只是显示手段）；
 * - 权重没有全量数据，全幅走 96×96 缩略图，放大窗口逐元素走 weightAt，标签写明是采样；
 * - 标签只走四条固定车道（窗口上/窗口两侧/平面左/平面下），不做运行时碰撞检测。
 */
import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { shapeLabel } from "../../sim/tensor/tensor";
import { planeView } from "../../sim/timeline/plane";
import type { Highlight, TensorRecord } from "../../sim/timeline/types";
import { Label } from "../labels/Label";
import { fmtAspect, fmtCell, type PlaneBox, robustScale } from "../scale";
import { vizTheme } from "../theme";
import { CellWindow } from "./CellWindow";
import { gridLayout } from "./layout";
import { TensorPlane, textureShape } from "./TensorPlane";

export const DEFAULT_BOX: PlaneBox = { maxW: 8.4, maxH: 2.6 };
export const DEFAULT_WINDOW = { rows: 6, cols: 12 };
/** 分类张量的色阶基准：任何编号都落在 0 色，不出现"id 越大越亮"的误导 */
const CATEGORICAL_SCALE = 1e30;
const fmtInt = (v: number) => String(Math.round(v));

export interface TensorGridProps {
  record: TensorRecord;
  /** 上一步在同一位置显示的张量：形状相同则做 from→to 插值 */
  prev?: TensorRecord | null | undefined;
  highlight?: Highlight | undefined;
  prevHighlight?: Highlight | undefined;
  /** 显示哪个头；默认跟随高亮 */
  head?: number | undefined;
  /** 四维张量的额外轴下标（如 KV 的 K|V 轴） */
  picks?: number[] | undefined;
  box?: PlaneBox | undefined;
  window?: { rows: number; cols: number } | undefined;
  cellSize?: number | undefined;
  showValues?: boolean | undefined;
  /** 覆盖标题（默认用张量的教学名） */
  title?: string | undefined;
  labelKey?: string | undefined;
  position?: [number, number, number] | undefined;
  /** 换步重写实例缓冲的耗时（ms） */
  onCost?: ((ms: number) => void) | undefined;
}

export function TensorGrid({
  record,
  prev,
  highlight,
  prevHighlight,
  head,
  picks,
  box = DEFAULT_BOX,
  window: win = DEFAULT_WINDOW,
  cellSize = 0.17,
  showValues = true,
  title,
  labelKey = "tg",
  position = [0, 0, 0],
  onCost,
}: TensorGridProps) {
  const theme = vizTheme();
  const headIdx = highlight?.head ?? head ?? 0;
  const picksKey = (picks ?? []).join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: picksKey 代表 picks 的内容
  const sel = useMemo(
    () => (picks ? { head: headIdx, picks } : { head: headIdx }),
    [headIdx, picksKey, picks],
  );
  const view = useMemo(() => planeView(record, sel), [record, sel]);
  const prevView = useMemo(
    () => (prev ? planeView(prev, { ...sel, head: prevHighlight?.head ?? headIdx }) : null),
    [prev, prevHighlight?.head, headIdx, sel],
  );

  const layout = useMemo(
    () => gridLayout(view, highlight, box, win, cellSize),
    [view, highlight, box, win, cellSize],
  );
  const { size, rect, winW, winH, winY } = layout;
  const tex = useMemo(() => textureShape(view), [view]);
  const vscale = useMemo(() => {
    // 权重优先用缩略图估色阶：它已经是全矩阵的均匀采样
    if (view.thumb) {
      const t = view.thumb;
      return robustScale((i) => t.data[i] ?? 0, t.data.length);
    }
    const cols = view.cols;
    return robustScale((i) => view.at(Math.floor(i / cols), i % cols), view.rows * view.cols);
  }, [view]);

  // token id 序列是分类量，不是数值场：不按大小着色，格值按整数显示
  const categorical = record.role === "input";
  const colorScale = categorical ? CATEGORICAL_SCALE : vscale.scale;
  const format = categorical ? fmtInt : fmtCell;
  // 切片说明：头下标 + 额外轴（如 KV 块的 K|V）
  const sliceParts: string[] = [];
  if (view.heads > 0) sliceParts.push(`头 ${view.head}/${view.heads - 1}`);
  view.axes.extra.forEach((axis, i) => {
    sliceParts.push(`${record.dims[axis] ?? "轴"}=${view.picks[i] ?? 0}`);
  });

  const viewKey = `${record.id}|${headIdx}|${picksKey}`;
  const winBottom = winY - winH / 2;

  // 取景框四角在平面局部坐标里的位置（左上原点 → 世界 y 向上）
  const px = (c: number) => (c / view.cols - 0.5) * size.w;
  const py = (r: number) => (0.5 - r / view.rows) * size.h;
  const rectL = px(rect.c0);
  const rectR = px(rect.c0 + rect.cols);
  const rectT = py(rect.r0);

  const rowText =
    rect.rows < view.rows
      ? `行 ${rect.r0}–${rect.r0 + rect.rows - 1} ⋯ 共 ${view.rows}`
      : `行 0–${view.rows - 1}`;
  const colText =
    rect.cols < view.cols
      ? `列 ${rect.c0}–${rect.c0 + rect.cols - 1} ⋯ 共 ${view.cols}`
      : `列 0–${view.cols - 1}`;

  const notes: string[] = [];
  if (size.compressed) notes.push(`显示比例已压缩，真实 ${fmtAspect(size.trueAspect)}`);
  if (!tex.exact) notes.push(`全幅是 ${tex.cols}×${tex.rows} 采样，放大窗口是真值`);
  if (vscale.hasMask && !categorical) notes.push("含 −∞ 掩码格，不参与色阶");
  if (categorical) notes.push("token id 是编号，不按大小着色");

  return (
    <group position={position}>
      <TensorPlane
        view={view}
        viewKey={viewKey}
        size={size}
        scale={colorScale}
        highlight={highlight}
        rect={rect}
      />

      {/* 取景框 → 放大窗口的引线 */}
      <Line
        points={[
          [rectL, rectT, 0.02],
          [-winW / 2, winBottom, 0.02],
        ]}
        color={theme.accent}
        lineWidth={1}
        transparent
        opacity={0.55}
      />
      <Line
        points={[
          [rectR, rectT, 0.02],
          [winW / 2, winBottom, 0.02],
        ]}
        color={theme.accent}
        lineWidth={1}
        transparent
        opacity={0.55}
      />

      <group position={[0, winY, 0]}>
        <CellWindow
          view={view}
          prevView={prevView}
          rect={rect}
          scale={colorScale}
          highlight={highlight}
          prevHighlight={prevHighlight}
          cellSize={cellSize}
          showValues={showValues}
          format={format}
          onCost={onCost}
          labelKey={labelKey}
        />
        {/* 车道①：窗口正上方 = 标题与真实形状 */}
        <Label id={`${labelKey}.title`} position={[0, winH / 2 + 0.5, 0]} size="title" color="ink">
          {title ?? record.name}
        </Label>
        <Label id={`${labelKey}.shape`} position={[0, winH / 2 + 0.26, 0]} size="micro" color="inkMuted">
          {shapeLabel(record)}
        </Label>
        {/* 车道②③：窗口左右 = 窗口覆盖范围与头下标 */}
        <Label
          id={`${labelKey}.rows`}
          position={[-winW / 2 - 0.18, 0, 0]}
          size="micro"
          color="inkMuted"
          anchorX="right"
        >
          {rowText}
        </Label>
        {sliceParts.length > 0 && (
          <Label
            id={`${labelKey}.slice`}
            position={[winW / 2 + 0.18, 0, 0]}
            size="micro"
            color="inkMuted"
            anchorX="left"
          >
            {sliceParts.join(" · ")}
          </Label>
        )}
        <Label id={`${labelKey}.cols`} position={[0, -winH / 2 - 0.2, 0]} size="micro" color="inkMuted">
          {colText}
        </Label>
      </group>

      {/* 车道④：平面左侧 = 行维；平面下方 = 列维与显示说明 */}
      <Label
        id={`${labelKey}.rowdim`}
        position={[-size.w / 2 - 0.24, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        size="micro"
        color="inkMuted"
      >
        {`${view.rowDim}=${view.rows}`}
      </Label>
      <Label id={`${labelKey}.coldim`} position={[0, -size.h / 2 - 0.24, 0]} size="micro" color="inkMuted">
        {`${view.colDim}=${view.cols}`}
      </Label>
      {notes.map((n, i) => (
        <Label
          key={n}
          id={`${labelKey}.note${i}`}
          position={[0, -size.h / 2 - 0.52 - i * 0.26, 0]}
          size="micro"
          color="inkMuted"
        >
          {n}
        </Label>
      ))}
    </group>
  );
}
