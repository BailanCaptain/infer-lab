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
import { planeView } from "../../sim/timeline/plane";
import type { Highlight, TensorRecord } from "../../sim/timeline/types";
import { LABEL_SIZE, Label } from "../labels/Label";
import { fmtCell, type PlaneBox, robustScale, windowRect } from "../scale";
import { vizTheme } from "../theme";
import { CellWindow } from "./CellWindow";
import { gridLayout, gridTexts } from "./layout";
import { TensorPlane } from "./TensorPlane";

export const DEFAULT_BOX: PlaneBox = { maxW: 8.4, maxH: 2.6 };
export const DEFAULT_WINDOW = { rows: 6, cols: 12 };
/** 分类张量的色阶基准：任何编号都落在 0 色，不出现"id 越大越亮"的误导 */
const CATEGORICAL_SCALE = 1e30;
const fmtInt = (v: number) => String(Math.round(v));
const FULL_WINDOW: [number, number] = [0, 1];

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
  /** 高亮在步内的渐入区间（按 progress.t），matmul 用它分节拍：先 B 列、再 A 行、最后 C 格 */
  hiWindow?: [number, number] | undefined;
  /** 换步重写实例缓冲的耗时（ms） */
  onCost?: ((ms: number) => void) | undefined;
  /** 标签放大倍数（由场景按相机距离给出） */
  labelScale?: number | undefined;
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
  hiWindow = FULL_WINDOW,
  onCost,
  labelScale: ls = 1,
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

  const rectPre = useMemo(() => windowRect(view, highlight, win), [view, highlight, win]);
  const texts = useMemo(
    () => gridTexts({ record, view, rect: rectPre, title }),
    [record, view, rectPre, title],
  );
  const layout = useMemo(
    () => gridLayout(view, highlight, box, win, cellSize, ls, texts),
    [view, highlight, box, win, cellSize, ls, texts],
  );
  const { size, rect, winW, winH, winY } = layout;
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

  const viewKey = `${record.id}|${headIdx}|${picksKey}`;
  const winBottom = winY - winH / 2;

  // 取景框四角在平面局部坐标里的位置（左上原点 → 世界 y 向上）
  const px = (c: number) => (c / view.cols - 0.5) * size.w;
  const py = (r: number) => (0.5 - r / view.rows) * size.h;
  const rectL = px(rect.c0);
  const rectR = px(rect.c0 + rect.cols);
  const rectT = py(rect.r0);

  return (
    <group position={position}>
      <TensorPlane
        view={view}
        viewKey={viewKey}
        size={size}
        scale={colorScale}
        highlight={highlight}
        rect={rect}
        hiWindow={hiWindow}
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
          hiWindow={hiWindow}
          onCost={onCost}
          labelKey={labelKey}
        />
        {/* 车道①：窗口正上方 = 标题与真实形状 */}
        <Label
          id={`${labelKey}.title`}
          position={[0, winH / 2 + 0.5 * ls, 0]}
          size={LABEL_SIZE.title * ls}
          color="ink"
        >
          {texts.title}
        </Label>
        <Label
          id={`${labelKey}.shape`}
          position={[0, winH / 2 + 0.26 * ls, 0]}
          size={LABEL_SIZE.micro * ls}
          color="inkMuted"
          mono
        >
          {texts.shape}
        </Label>
        {/* 车道②：窗口正下方 = 窗口覆盖范围与切片 */}
        <Label
          id={`${labelKey}.range`}
          position={[0, -winH / 2 - 0.2 * ls, 0]}
          size={LABEL_SIZE.micro * ls}
          color="inkMuted"
        >
          {texts.range}
        </Label>
      </group>

      {/* 车道③④：平面左侧 = 行维；平面下方 = 列维 */}
      <Label
        id={`${labelKey}.rowdim`}
        position={[-size.w / 2 - 0.22 * ls, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        size={LABEL_SIZE.micro * ls}
        color="inkMuted"
        mono
      >
        {`${view.rowDim}=${view.rows}`}
      </Label>
      <Label
        id={`${labelKey}.coldim`}
        position={[0, -size.h / 2 - 0.22 * ls, 0]}
        size={LABEL_SIZE.micro * ls}
        color="inkMuted"
        mono
      >
        {`${view.colDim}=${view.cols}`}
      </Label>
    </group>
  );
}
