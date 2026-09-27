/**
 * 教学图版式 figure（2026-09-24）：一张图只讲一件事，画的是东西本身。
 *
 * 为什么另起一个版式：scene 版式的零件是「底板、卡片、胶囊、小方格」，画出来像仪表盘——
 * 大块底色铺满画面、满屏小灰字、没选中的东西和选中的一样重。用户看了三轮都说「不咋地」。
 * 参照（Grootendorst 的 MoE 图解、JAX scaling book）的做法是：少底色多留白，物体画大、
 * 描深边，标签写在物体上，没选中的淡下去，一张图围绕一条流程。
 *
 * 这个版式把这些做法写死在渲染器里，作者只能说「这是什么」，改不了线粗、字号、留白：
 * - 颜色只有语义色（token 青、权重琥珀、KV 蓝、通信紫、调度灰、出错红，和 src/design 同一套）；
 * - 硬件用中性轮廓，内存与接口沿用语义色；
 * - 物体（items / rows / matrices）一律描深边，选中是实色、没选中是淡色虚线；
 * - 跨设备的线用通信色，其余用墨色。
 * 这样后面的图不管谁画，长得都一样。坐标仍然手写，重叠和出界照样能失败。
 *
 * 2026-09-25 补齐常见形状（用户担心「会不会把图局限住」）：固定的是画风，不是能画什么。
 * 分层、分界线、多行格子、时间轴、坐标图、节点图、公式、热力图各有一个零件；
 * 零件都没有的形状画在受限自由画板（sketches）里——仍然只许语义色，线粗字号仍由这里定，
 * 必须写一句说明；同一种形状在几张图里反复手画，就由 sketchUsage 提醒升级成零件。
 */

import { z } from "zod";
import { esc, type InkBox, round, textWidth, wrap } from "./scene";

const point = z.tuple([z.number(), z.number()]);
const int = z.number().int();

export const FIGURE_TONES = ["token", "weight", "kv", "comm", "control", "danger", "ink"] as const;
type FigureTone = (typeof FIGURE_TONES)[number];
const tone = z.enum(FIGURE_TONES);

/**
 * 新零件共用的填法：solid 是这一步的主角；faded 参与了但不是主角；plain 是灰底旁观者；
 * empty 是表里还空着的位置；ghost 是补出来的空位；outline 只描一道边（自由画板用）。
 */
type Fill = "solid" | "faded" | "plain" | "empty" | "ghost" | "outline";

/** 矩阵：按比例的长方形加格子线。matrices 和 equations 共用 */
const matrixShape = {
  w: z.number(),
  h: z.number(),
  cols: int.min(1).default(8),
  rows: int.min(1).default(1),
  tone: tone.default("weight"),
  style: z.enum(["solid", "faded"]).default("solid"),
  label: z.string().optional(),
  dims: z.string().optional(),
  /** 圈出一行 / 一列 / 一格：「这一行乘这一列，得到这一格」 */
  mark: z
    .object({ row: int.min(0).optional(), col: int.min(0).optional() })
    .strict()
    .optional(),
};
const matrixTerm = z.object(matrixShape).strict();
type MatrixShape = z.infer<typeof matrixTerm>;

const axis = z
  .object({
    label: z.string().min(1),
    min: z.number(),
    max: z.number(),
    ticks: z.array(z.number()).default([]),
  })
  .strict();
const categoryAxis = z
  .object({ label: z.string().min(1), categories: z.array(z.string().min(1)).min(1) })
  .strict();

const arrowEnds = z.enum(["none", "end", "both"]).default("none");
const sketchFill = z.enum(["outline", "solid", "faded", "plain"]).default("outline");
/** 自由画板里的形状：坐标相对画板左上角，颜色只有语义色，线粗字号不开放 */
const sketchShape = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("rect"), at: point, size: point, tone: tone.default("ink"), style: sketchFill })
    .strict(),
  z
    .object({
      kind: z.literal("circle"),
      at: point,
      r: z.number().positive(),
      tone: tone.default("ink"),
      style: sketchFill,
    })
    .strict(),
  z
    .object({
      kind: z.literal("polygon"),
      points: z.array(point).min(3),
      tone: tone.default("ink"),
      style: sketchFill,
    })
    .strict(),
  z
    .object({
      kind: z.literal("line"),
      points: z.array(point).min(2),
      tone: tone.default("ink"),
      dashed: z.boolean().default(false),
      arrow: arrowEnds,
    })
    .strict(),
  z
    .object({
      kind: z.literal("curve"),
      from: point,
      c1: point,
      c2: point,
      to: point,
      tone: tone.default("ink"),
      dashed: z.boolean().default(false),
      arrow: arrowEnds,
    })
    .strict(),
  z
    .object({
      kind: z.literal("text"),
      at: point,
      text: z.string().min(1),
      size: z.enum(["small", "normal", "large"]).default("normal"),
      strong: z.boolean().default(false),
      tone: tone.optional(),
      /** 写在实色形状上时用反白字 */
      inverse: z.boolean().default(false),
      anchor: z.enum(["start", "middle", "end"]).default("start"),
    })
    .strict(),
]);
const SKETCH_TEXT = { small: 12, normal: 13.5, large: 16 } as const;

export const figureSpecSchema = z
  .object({
    layout: z.literal("figure"),
    id: z.string().min(1),
    caption: z.string().min(1),
    size: point,
    /** 硬件轮廓；板卡、服务器、机柜是可嵌套容器。端口数须由作者明确给出。 */
    hardware: z
      .array(
        z
          .object({
            kind: z.enum(["chip", "board", "server", "switch", "rack", "memory", "port"]),
            at: point,
            size: z.tuple([z.number().positive(), z.number().positive()]),
            label: z.string().min(1),
            ports: int.min(1).max(32).optional(),
          })
          .strict()
          .superRefine((h, ctx) => {
            if ((h.kind === "switch") !== (h.ports !== undefined))
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "只有交换机需要 ports，且必须明确端口数量",
                path: ["ports"],
              });
          }),
      )
      .default([]),
    /** 设备或分组：一道浅框，不铺底色。名字默认写在框的左上角外面 */
    frames: z
      .array(
        z
          .object({ label: z.string().min(1), at: point, size: point, inside: z.boolean().default(false) })
          .strict(),
      )
      .default([]),
    /** 分界线：跨过它就换了进程 / 换了责任方。sides 是线两侧的名字（竖线左右、横线上下） */
    dividers: z
      .array(
        z.object({ from: point, to: point, sides: z.tuple([z.string(), z.string()]).optional() }).strict(),
      )
      .default([]),
    /** 一个东西：token、专家、路由器、输出……solid 实色、faded 淡色虚线、plain 灰底。depth 是身后叠着的份数 */
    items: z
      .array(
        z
          .object({
            at: point,
            size: point,
            text: z.string().optional(),
            sub: z.string().optional(),
            tone: tone.default("ink"),
            style: z.enum(["solid", "faded", "plain"]).default("solid"),
            depth: int.min(0).max(6).default(0),
          })
          .strict(),
      )
      .default([]),
    /** 一排同样的东西，个数就是真实数量；ghost 是补出来的空位 */
    rows: z
      .array(
        z
          .object({
            at: point,
            count: int.min(1),
            w: z.number(),
            h: z.number(),
            gap: z.number().default(3),
            tone: tone,
            faded: z.array(int).default([]),
            ghost: z.array(int).default([]),
          })
          .strict(),
      )
      .default([]),
    /** 多行格子：块表、槽位表。gap 为 0 时连成一张表，大于 0 时是一个个分开的格子 */
    grids: z
      .array(
        z
          .object({
            at: point,
            rows: int.min(1),
            cols: int.min(1),
            cell: point,
            gap: z.number().min(0).default(0),
            tone: tone.default("kv"),
            style: z.enum(["solid", "faded", "plain", "empty"]).default("empty"),
            /** 从左上角按行数，前 fill 格画成实色（比如「这个块用掉了几个位置」） */
            fill: int.min(0).optional(),
            cells: z
              .array(
                z
                  .object({
                    at: z.tuple([int.min(0), int.min(0)]),
                    text: z.string().optional(),
                    tone: tone.optional(),
                    style: z.enum(["solid", "faded", "plain", "empty", "ghost"]).optional(),
                  })
                  .strict(),
              )
              .default([]),
            rowLabels: z.array(z.string()).default([]),
            colLabels: z.array(z.string()).default([]),
            label: z.string().optional(),
          })
          .strict(),
      )
      .default([]),
    /** 叠放的层：从上往下是「谁在谁之上」（软件栈、调用层次） */
    layers: z
      .array(
        z
          .object({
            at: point,
            width: z.number(),
            h: z.number().default(44),
            gap: z.number().default(8),
            bands: z
              .array(
                z
                  .object({
                    text: z.string().min(1),
                    sub: z.string().optional(),
                    tone: tone.default("control"),
                    style: z.enum(["solid", "faded", "plain"]).default("plain"),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .default([]),
    /** 一块矩阵：按比例的长方形加格子线，名字写在正下方 */
    matrices: z.array(z.object({ at: point, ...matrixShape }).strict()).default([]),
    /** 公式：矩阵和运算符从左往右排，竖直方向按 at 的 y 居中（矩阵 × 矩阵 = 矩阵） */
    equations: z
      .array(
        z
          .object({
            at: point,
            gap: z.number().default(18),
            terms: z.array(z.union([z.object({ op: z.string().min(1).max(3) }).strict(), matrixTerm])).min(3),
          })
          .strict(),
      )
      .default([]),
    /** 按比例的长条：segments 依次排开，frame 是容量框（比如一颗 NPU 的显存） */
    bars: z
      .array(
        z
          .object({
            at: point,
            h: z.number().default(26),
            /** 每一个单位画多少像素 */
            scale: z.number(),
            frame: z
              .object({ value: z.number(), label: z.string().optional(), tone: tone.default("kv") })
              .optional(),
            segments: z
              .array(
                z
                  .object({
                    value: z.number(),
                    tone: tone.default("weight"),
                    style: z.enum(["solid", "hatch"]).default("solid"),
                    text: z.string().optional(),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .default([]),
    /** 时间轴：每条泳道一行，span 是一段时间里在干的事；几条泳道并排就是「重叠了多少」 */
    timelines: z
      .array(
        z
          .object({
            at: point,
            /** 每一个时间单位画多少像素 */
            scale: z.number().positive(),
            start: z.number().default(0),
            end: z.number(),
            unit: z.string().optional(),
            /** 刻度间隔；不给就只标起点和终点 */
            ticks: z.number().positive().optional(),
            labelW: z.number().default(96),
            laneH: z.number().default(28),
            gap: z.number().default(10),
            lanes: z
              .array(
                z
                  .object({
                    label: z.string(),
                    spans: z
                      .array(
                        z
                          .object({
                            from: z.number(),
                            to: z.number(),
                            tone: tone.default("token"),
                            style: z.enum(["solid", "faded", "hatch"]).default("solid"),
                            text: z.string().optional(),
                          })
                          .strict(),
                      )
                      .default([]),
                  })
                  .strict(),
              )
              .min(1),
            /** 竖虚线标一个时刻，比如「第一个 token 出来」 */
            marks: z.array(z.object({ t: z.number(), label: z.string().optional() }).strict()).default([]),
          })
          .strict(),
      )
      .default([]),
    /** 带坐标轴的图：折线或柱子。数据必须是真实的，source 写数据出处，画在图下面 */
    charts: z
      .array(
        z
          .object({
            at: point,
            /** 绘图区的宽高，不含刻度字 */
            size: point,
            x: z.union([axis, categoryAxis]),
            y: axis,
            series: z
              .array(
                z
                  .object({
                    kind: z.enum(["line", "bar"]).default("line"),
                    tone: tone.default("token"),
                    points: z.array(point).min(1),
                    label: z.string().optional(),
                    dashed: z.boolean().default(false),
                  })
                  .strict(),
              )
              .min(1),
            source: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    /** 节点图：count 个设备排成一圈，edges 是谁发给谁（ring 环、all 两两互发、star 从 0 号发出去） */
    graphs: z
      .array(
        z
          .object({
            at: point,
            r: z.number().positive(),
            count: int.min(2),
            nodeR: z.number().default(22),
            labels: z.array(z.string()).default([]),
            tone: tone.default("ink"),
            style: z.enum(["plain", "solid"]).default("plain"),
            faded: z.array(int).default([]),
            edges: z
              .union([z.enum(["ring", "all", "star", "none"]), z.array(z.tuple([int, int])).min(1)])
              .default("ring"),
            edgeTone: tone.default("comm"),
            /** 每条边两头都带箭头；all 默认就是 */
            both: z.boolean().default(false),
          })
          .strict(),
      )
      .default([]),
    /** 热力图：一格一个真实数值，颜色越深数越大 */
    heatmaps: z
      .array(
        z
          .object({
            at: point,
            cell: point,
            values: z.array(z.array(z.number()).min(1)).min(1),
            tone: tone.default("kv"),
            min: z.number().optional(),
            max: z.number().optional(),
            showValues: z.boolean().default(false),
            rowLabels: z.array(z.string()).default([]),
            colLabels: z.array(z.string()).default([]),
            label: z.string().optional(),
            /** 色阶两端的名字，比如 ["少", "多"] */
            legend: z.tuple([z.string(), z.string()]).optional(),
          })
          .strict(),
      )
      .default([]),
    /** 受限自由画板：零件里没有的形状画在这里。name 用来跨图统计，note 一句话说清画的是什么 */
    sketches: z
      .array(
        z
          .object({
            name: z.string().min(1),
            note: z.string().min(1),
            at: point,
            size: point,
            shapes: z.array(sketchShape).min(1),
          })
          .strict(),
      )
      .default([]),
    /** 圆节点，比如加权相加的 ⊕ */
    nodes: z.array(z.object({ at: point, r: z.number().default(18), text: z.string() }).strict()).default([]),
    /** 箭头：直线 / 折线（via）/ 三次曲线（curve 给两个控制点） */
    links: z
      .array(
        z
          .object({
            from: point,
            to: point,
            via: z.array(point).default([]),
            curve: z.tuple([point, point]).optional(),
            ends: z.enum(["none", "end", "both"]).default("end"),
            tone: tone.default("ink"),
            dashed: z.boolean().default(false),
          })
          .strict(),
      )
      .default([]),
    /** 一对多或多对一的一束箭头 */
    fans: z
      .array(
        z
          .object({
            from: z.union([point, z.array(point).min(1)]),
            to: z.union([point, z.array(point).min(1)]),
            tone: tone.default("ink"),
          })
          .strict(),
      )
      .default([]),
    /** 步骤编号：圆里一个数字，和正文的编号一一对应。可以压在物体的角上 */
    badges: z.array(z.object({ at: point, n: int, tone: tone.default("ink") }).strict()).default([]),
    /** 文字：标题（strong）、说明、斜体旁注（note） */
    texts: z
      .array(
        z
          .object({
            at: point,
            text: z.string().min(1),
            size: z.number().default(13.5),
            strong: z.boolean().default(false),
            note: z.boolean().default(false),
            tone: tone.optional(),
            width: z.number().optional(),
            anchor: z.enum(["start", "middle", "end"]).default("start"),
          })
          .strict(),
      )
      .default([]),
    /** 醒目的小标签，比如「装不下」 */
    tags: z
      .array(z.object({ at: point, text: z.string().min(1), tone: tone.default("danger") }).strict())
      .default([]),
    /** 下括号：圈住一段范围，名字写在下面 */
    brackets: z
      .array(z.object({ from: z.number(), to: z.number(), y: z.number(), label: z.string().min(1) }).strict())
      .default([]),
    pins: z
      .array(z.object({ source: z.string().min(1), symbols: z.array(z.string().min(1)).min(1) }).strict())
      .default([]),
  })
  .strict();

export type FigureSpec = z.infer<typeof figureSpecSchema>;

const FONT = "'Inter Variable','Noto Sans SC',system-ui,sans-serif";
const INK = "var(--color-ink, #17211f)";
const MUTED = "var(--color-ink-muted, #66716d)";
const FRAME = "var(--color-line-strong, #b8bcb5)";
const SURFACE = "var(--color-surface, #fbfaf6)";
const INVERSE = "var(--color-ink-inverse, #ffffff)";

const COLOR: Record<FigureTone, string> = {
  token: "var(--color-token, #087f73)",
  weight: "var(--color-weight, #c78300)",
  kv: "var(--color-kv, #4c65b6)",
  comm: "var(--color-comm, #9a4b86)",
  control: "var(--color-control, #66716d)",
  danger: "var(--color-danger, #b54237)",
  ink: INK,
};
const SOFT: Record<FigureTone, string> = {
  token: "var(--color-token-soft, #ddf4ef)",
  weight: "var(--color-weight-soft, #fff4cf)",
  kv: "var(--color-kv-soft, #e8edff)",
  comm: "var(--color-comm-soft, #f7e7f2)",
  control: "var(--color-surface-sunken, #ece9df)",
  danger: "var(--color-accent-soft, #fff0e9)",
  ink: "var(--color-surface-sunken, #ece9df)",
};
/** 淡色底上写字要比本色深一档，否则琥珀字压在浅琥珀底上看不清 */
const DEEP: Record<FigureTone, string> = {
  token: "#065f56",
  weight: "#936300",
  kv: "#3a4f93",
  comm: "#7a3a6a",
  control: "#4d5652",
  danger: "#8f3229",
  ink: INK,
};

/** 新零件的填法。老零件（items / rows / matrices）的画法不动，免得存量 SVG 跟着改写 */
function look(t: FigureTone, style: Fill): { attrs: string; ink: string } {
  switch (style) {
    case "solid":
      return { attrs: `fill="${COLOR[t]}" stroke="${INK}" stroke-width="1.3"`, ink: INVERSE };
    case "faded":
      return {
        attrs: `fill="${SOFT[t]}" stroke="${COLOR[t]}" stroke-opacity="0.4" stroke-width="1.3"`,
        ink: DEEP[t],
      };
    case "plain":
      return { attrs: `fill="${SOFT.control}" stroke="${INK}" stroke-width="1.3"`, ink: INK };
    case "empty":
      return {
        attrs: `fill="${SURFACE}" stroke="${INK}" stroke-opacity="0.45" stroke-width="1.2"`,
        ink: INK,
      };
    case "ghost":
      return {
        attrs: `fill="none" stroke="${COLOR[t]}" stroke-width="1.3" stroke-dasharray="3 3"`,
        ink: DEEP[t],
      };
    case "outline":
      return { attrs: `fill="none" stroke="${COLOR[t]}" stroke-width="1.5"`, ink: DEEP[t] };
  }
}

/** 连成一张表时每格只填色，格线另画 */
function tableFill(t: FigureTone, style: Fill): string {
  if (style === "solid") return COLOR[t];
  if (style === "faded") return SOFT[t];
  if (style === "plain") return SOFT.control;
  if (style === "ghost") return "none";
  return SURFACE;
}

/** 刻度上的数：去掉浮点尾巴 */
function num(n: number): string {
  return String(Number(n.toFixed(4)));
}

interface Run {
  parts: string[];
  ink: InkBox[];
  /** 箭头经过的点：线可以穿过留白，不算墨，只拿来查出界 */
  points: { where: string; x: number; y: number }[];
  /** 零件自己发现的问题：字放不下、数不在坐标范围里、画出了自由画板…… */
  tight: string[];
  used: Set<FigureTone>;
  hatch: boolean;
  /** 自由画板的说明，写进 SVG 的 desc */
  descs: string[];
  where: string;
}

function text(
  r: Run,
  x: number,
  y: number,
  s: string,
  o: { size?: number; weight?: number; fill?: string; italic?: boolean; anchor?: string; ink?: boolean } = {},
): void {
  const size = o.size ?? 13.5;
  const w = textWidth(s, size);
  const left = o.anchor === "end" ? x - w : o.anchor === "middle" ? x - w / 2 : x;
  if (o.ink !== false) r.ink.push({ where: r.where, what: s, x: left, y: y - size * 0.78, w, h: size });
  const anchor = o.anchor && o.anchor !== "start" ? ` text-anchor="${o.anchor}"` : "";
  const italic = o.italic ? ' font-style="italic"' : "";
  r.parts.push(
    `<text x="${round(x)}" y="${round(y)}" font-family="${FONT}" font-size="${size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? INK}"${anchor}${italic}>${esc(s)}</text>`,
  );
}

function box(r: Run, what: string, x: number, y: number, w: number, h: number): void {
  r.ink.push({ where: r.where, what, x, y, w, h });
}

/** 写在格子 / 色块里的字：放不下就记一条问题 */
function fitted(r: Run, what: string, s: string, size: number, room: number): void {
  const need = textWidth(s, size);
  if (need > room)
    r.tight.push(`${what}：「${s}」约 ${Math.round(need)}px，框里放不下（只有 ${Math.round(room)}px）`);
}

function marker(id: string, t: FigureTone): string {
  return `${id}-ah-${t}`;
}

/** 一条线。通信线粗一档；ends 决定箭头画在哪头 */
function stroke(
  r: Run,
  id: string,
  d: string,
  t: FigureTone,
  dashed: boolean,
  ends: "none" | "end" | "both",
): string {
  const w = t === "comm" ? 2.2 : 1.4;
  let heads = "";
  if (ends !== "none") {
    r.used.add(t);
    const u = `url(#${marker(id, t)})`;
    heads = ends === "both" ? ` marker-start="${u}" marker-end="${u}"` : ` marker-end="${u}"`;
  }
  return `<path d="${d}" fill="none" stroke="${COLOR[t]}" stroke-width="${w}"${dashed ? ' stroke-dasharray="7 5"' : ""}${heads}/>`;
}

/** 三次曲线上取 9 个点，留给出界检查 */
function cubicPoints(p0: number[], c1: number[], c2: number[], p3: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0]! + 3 * u * u * t * c1[0]! + 3 * u * t * t * c2[0]! + t * t * t * p3[0]!,
      u * u * u * p0[1]! + 3 * u * u * t * c1[1]! + 3 * u * t * t * c2[1]! + t * t * t * p3[1]!,
    ]);
  }
  return out;
}

function drawMatrix(r: Run, x: number, y: number, m: MatrixShape): void {
  const grid: string[] = [];
  for (let c = 1; c < m.cols; c++) grid.push(`M${round(x + (m.w * c) / m.cols)} ${y}v${m.h}`);
  for (let k = 1; k < m.rows; k++) grid.push(`M${x} ${round(y + (m.h * k) / m.rows)}h${m.w}`);
  if (m.style === "faded")
    r.parts.push(
      `<rect x="${x}" y="${y}" width="${m.w}" height="${m.h}" fill="${SOFT[m.tone]}" stroke="${COLOR[m.tone]}" stroke-opacity="0.5" stroke-width="1.3"/>`,
    );
  else
    r.parts.push(
      `<rect x="${x}" y="${y}" width="${m.w}" height="${m.h}" fill="${COLOR[m.tone]}" stroke="${INK}" stroke-width="1.3"/>`,
    );
  if (grid.length)
    r.parts.push(
      m.style === "faded"
        ? `<path d="${grid.join("")}" stroke="${COLOR[m.tone]}" stroke-opacity="0.3" stroke-width="1" fill="none"/>`
        : `<path d="${grid.join("")}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1" fill="none"/>`,
    );
  if (m.mark) {
    const { row, col } = m.mark;
    if ((row !== undefined && row >= m.rows) || (col !== undefined && col >= m.cols))
      r.tight.push(`${r.where}：圈出的行 / 列超出了 ${m.rows}×${m.cols} 的格子`);
    const cw = m.w / m.cols;
    const rh = m.h / m.rows;
    const mx = col === undefined ? x : x + col * cw;
    const my = row === undefined ? y : y + row * rh;
    const mw = col === undefined ? m.w : cw;
    const mh = row === undefined ? m.h : rh;
    r.parts.push(
      `<rect x="${round(mx)}" y="${round(my)}" width="${round(mw)}" height="${round(mh)}" fill="none" stroke="${INK}" stroke-width="2.8"/>`,
    );
  }
  box(r, "矩阵", x, y, m.w, m.h);
  if (m.label)
    text(r, x + m.w / 2, y + m.h + 20, m.label, { size: 13, fill: DEEP[m.tone], anchor: "middle" });
  if (m.dims)
    text(r, x + m.w / 2, y + m.h + 40, m.dims, { size: 13, fill: MUTED, italic: true, anchor: "middle" });
}

/** 行名写在左边、列名写在上面：格子表和热力图共用 */
function axisLabels(
  r: Run,
  x0: number,
  y0: number,
  cw: number,
  ch: number,
  gap: number,
  rowLabels: string[],
  colLabels: string[],
): void {
  for (const [k, s] of rowLabels.entries())
    if (s) text(r, x0 - 10, y0 + k * (ch + gap) + ch / 2 + 4.5, s, { size: 13, anchor: "end" });
  for (const [k, s] of colLabels.entries())
    if (s) text(r, x0 + k * (cw + gap) + cw / 2, y0 - 10, s, { size: 12.5, fill: MUTED, anchor: "middle" });
}

function paint(spec: FigureSpec): Run {
  const r: Run = {
    parts: [],
    ink: [],
    points: [],
    tight: [],
    used: new Set(),
    hatch: false,
    descs: [],
    where: "",
  };
  const id = spec.id;
  const lines: string[] = [];

  // ---- 设备框：一道浅框，名字在框外左上角（小框写在框内）
  for (const [i, f] of spec.frames.entries()) {
    r.where = `frames[${i}]`;
    const [x, y] = f.at;
    const [w, h] = f.size;
    r.parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="none" stroke="${FRAME}" stroke-width="1.5"/>`,
    );
    if (f.inside) text(r, x + 16, y + 24, f.label, { size: 13, weight: 700 });
    else text(r, x + 16, y - 12, f.label, { size: 15, weight: 700 });
  }

  // 硬件轮廓保持中性色，内存与接口沿用内存蓝、通信紫。
  // 容器只登记实际边缘的墨迹，内部可放芯片、内存或另一层设备。
  for (const [i, hw] of spec.hardware.entries()) {
    r.where = `hardware[${i}]`;
    const [x, y] = hw.at;
    const [w, h] = hw.size;
    const container = ["board", "server", "rack"].includes(hw.kind);
    const rect = (dx: number, dy: number, rw: number, rh: number, fill = "none", color = INK, radius = 2) =>
      `<rect x="${round(x + dx)}" y="${round(y + dy)}" width="${round(rw)}" height="${round(rh)}" rx="${radius}" fill="${fill}" stroke="${color}" stroke-width="1.5"/>`;
    const path = (d: string, color = INK) =>
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    const minW = hw.kind === "chip" ? 52 : 60;
    if (w < minW || h < 40) r.tight.push(`${r.where}：硬件轮廓至少需要 ${minW}×40px`);
    r.parts.push(`<g data-hardware="${hw.kind}">`);
    if (container) {
      r.parts.push(rect(0, 0, w, h, "none", INK, hw.kind === "rack" ? 3 : 8));
      const side = hw.kind === "rack" ? 14 : 8;
      const bottom = hw.kind === "board" ? 14 : 8;
      box(r, hw.label, x, y, w, 8);
      box(r, hw.label, x, y + h - bottom, w, bottom);
      box(r, hw.label, x, y, side, h);
      box(r, hw.label, x + w - side, y, side, h);
      if (hw.kind === "rack") {
        r.parts.push(path(`M${x + 14} ${y}v${h}M${x + w - 14} ${y}v${h}`));
        for (let sy = 18; sy < h - 10; sy += 20) {
          r.parts.push(rect(5, sy, 4, 4, SOFT.control), rect(w - 9, sy, 4, 4, SOFT.control));
        }
      } else if (hw.kind === "board") {
        for (let sx = 20; sx < w - 20; sx += 12) r.parts.push(rect(sx, h - 12, 6, 10, SOFT.control));
      } else {
        r.parts.push(path(`M${x + 4} ${y + 12}v${h - 24}M${x + w - 4} ${y + 12}v${h - 24}`));
      }
    } else {
      box(r, hw.label, x, y, w, h);
      if (hw.kind === "chip") {
        r.parts.push(rect(8, 8, w - 16, h - 16, SURFACE, INK, 5));
        for (let t = 0.25; t <= 0.75; t += 0.25) {
          const px = round(x + w * t);
          const py = round(y + h * t);
          r.parts.push(path(`M${px} ${y}v8M${px} ${y + h - 8}v8M${x} ${py}h8M${x + w - 8} ${py}h8`));
        }
      } else if (hw.kind === "memory") {
        r.parts.push(rect(0, 0, w, h, SOFT.kv, COLOR.kv, 3));
        r.parts.push(path(`M${x + 5} ${y + h - 8}h${w - 10}M${x + 5} ${y + h - 4}h${w - 10}`, COLOR.kv));
      } else if (hw.kind === "port") {
        r.parts.push(rect(0, 0, w, h, SURFACE, COLOR.comm, 4));
        r.parts.push(rect(8, 8, w - 16, h - 16, SOFT.comm, COLOR.comm));
      } else {
        r.parts.push(rect(0, 0, w, h, SURFACE, INK, 6));
        const pitch = (w - 24) / hw.ports!;
        if (pitch < 16) r.tight.push(`${r.where}：${hw.ports} 个端口放不下`);
        for (let port = 0; port < hw.ports!; port++)
          r.parts.push(
            `<g data-port="${port}">${rect(12 + port * pitch, h * 0.35, pitch - 6, h * 0.4, SOFT.comm, COLOR.comm)}</g>`,
          );
        r.parts.push(`<circle cx="${x + w - 10}" cy="${y + 10}" r="2.5" fill="${INK}"/>`);
      }
    }
    const inside = hw.kind === "chip" || hw.kind === "memory";
    fitted(r, r.where, hw.label, 13, w - (inside ? 22 : 0));
    text(r, x + w / 2, inside ? y + h / 2 + 4 : y - 10, hw.label, {
      size: 13,
      weight: 700,
      anchor: "middle",
      ink: !inside,
    });
    r.parts.push("</g>");
  }

  // ---- 分界线：淡灰虚线，两侧的名字写在线头旁边
  for (const [i, d] of spec.dividers.entries()) {
    r.where = `dividers[${i}]`;
    const [fx, fy] = d.from;
    const [tx, ty] = d.to;
    r.parts.push(
      `<path d="M${fx} ${fy} L${tx} ${ty}" fill="none" stroke="${MUTED}" stroke-width="1.4" stroke-dasharray="6 5"/>`,
    );
    r.points.push({ where: r.where, x: fx, y: fy }, { where: r.where, x: tx, y: ty });
    if (!d.sides) continue;
    const [a, b] = d.sides;
    const o = { size: 13, weight: 700, fill: MUTED };
    if (Math.abs(tx - fx) < Math.abs(ty - fy)) {
      const [x, y] = fy < ty ? d.from : d.to;
      if (a) text(r, x - 12, y + 14, a, { ...o, anchor: "end" });
      if (b) text(r, x + 12, y + 14, b, o);
    } else {
      const [x, y] = fx < tx ? d.from : d.to;
      if (a) text(r, x, y - 10, a, o);
      if (b) text(r, x, y + 22, b, o);
    }
  }

  // ---- 箭头先画，物体盖在上面
  const arrow = (
    from: number[],
    to: number[],
    via: number[][],
    curve: number[][] | undefined,
    t: FigureTone,
    dashed: boolean,
    ends: "none" | "end" | "both" = "end",
  ) => {
    const d = curve
      ? `M${from[0]} ${from[1]} C ${curve[0]![0]} ${curve[0]![1]}, ${curve[1]![0]} ${curve[1]![1]}, ${to[0]} ${to[1]}`
      : [from, ...via, to].map(([x, y], k) => `${k === 0 ? "M" : "L"}${x} ${y}`).join(" ");
    lines.push(stroke(r, id, d, t, dashed, ends));
    const pts = curve ? cubicPoints(from, curve[0]!, curve[1]!, to) : [from, ...via, to];
    for (const p of pts) r.points.push({ where: r.where, x: p[0]!, y: p[1]! });
  };
  for (const [i, l] of spec.links.entries()) {
    r.where = `links[${i}]`;
    arrow(l.from, l.to, l.via, l.curve, l.tone, l.dashed, l.ends);
  }
  for (const [i, f] of spec.fans.entries()) {
    r.where = `fans[${i}]`;
    const froms = Array.isArray(f.from[0]) ? (f.from as number[][]) : [f.from as number[]];
    const tos = Array.isArray(f.to[0]) ? (f.to as number[][]) : [f.to as number[]];
    for (const a of froms) for (const b of tos) arrow(a, b, [], undefined, f.tone, false);
  }
  r.parts.push(...lines);

  // ---- 比例长条
  for (const [i, b] of spec.bars.entries()) {
    r.where = `bars[${i}]`;
    const [x0, y] = b.at;
    let x = x0;
    for (const s of b.segments) {
      const w = s.value * b.scale;
      if (s.style === "hatch") {
        r.hatch = true;
        r.parts.push(
          `<rect x="${round(x)}" y="${y}" width="${round(w)}" height="${b.h}" rx="4" fill="url(#${id}-hatch)" stroke="${MUTED}" stroke-width="1.3"/>`,
        );
        // 斜纹段是浅底，文字用正色——反白在这里看不见
        if (s.text) text(r, x + 16, y + b.h / 2 + 5, s.text, { size: 13, weight: 700, fill: INK });
      } else {
        r.parts.push(
          `<rect x="${round(x)}" y="${y}" width="${round(w)}" height="${b.h}" rx="4" fill="${COLOR[s.tone]}" stroke="${INK}" stroke-width="1.3"/>`,
        );
        if (s.text) text(r, x + 16, y + b.h / 2 + 5, s.text, { size: 13, weight: 700, fill: INVERSE });
      }
      box(r, "长条", x, y, w, b.h);
      x += w;
    }
    if (b.frame) {
      const fw = b.frame.value * b.scale;
      r.parts.push(
        `<rect x="${x0}" y="${y - 6}" width="${round(fw)}" height="${b.h + 12}" rx="7" fill="none" stroke="${COLOR[b.frame.tone]}" stroke-width="2.2"/>`,
      );
      if (b.frame.label)
        text(r, x0 + fw, y - 16, b.frame.label, {
          size: 13,
          weight: 700,
          fill: COLOR[b.frame.tone],
          anchor: "end",
        });
    }
  }

  // ---- 一排同样的东西
  for (const [i, row] of spec.rows.entries()) {
    r.where = `rows[${i}]`;
    const faded = new Set(row.faded);
    const ghost = new Set(row.ghost);
    for (let k = 0; k < row.count; k++) {
      const x = row.at[0] + k * (row.w + row.gap);
      const y = row.at[1];
      if (ghost.has(k))
        r.parts.push(
          `<rect x="${round(x)}" y="${y}" width="${row.w}" height="${row.h}" rx="4" fill="none" stroke="${COLOR[row.tone]}" stroke-width="1.5" stroke-dasharray="3 3"/>`,
        );
      else if (faded.has(k))
        r.parts.push(
          `<rect x="${round(x)}" y="${y}" width="${row.w}" height="${row.h}" rx="4" fill="${SOFT[row.tone]}" stroke="${COLOR[row.tone]}" stroke-opacity="0.35" stroke-width="1.2"/>`,
        );
      else
        r.parts.push(
          `<rect x="${round(x)}" y="${y}" width="${row.w}" height="${row.h}" rx="4" fill="${COLOR[row.tone]}" stroke="${INK}" stroke-width="1.2"/>`,
        );
    }
    box(r, `${row.count} 个`, row.at[0], row.at[1], row.count * (row.w + row.gap) - row.gap, row.h);
  }

  // ---- 矩阵：按比例的长方形 + 格子线
  for (const [i, m] of spec.matrices.entries()) {
    r.where = `matrices[${i}]`;
    drawMatrix(r, m.at[0], m.at[1], m);
  }

  // ---- 公式：矩阵和运算符排成一行，竖直居中
  for (const [i, e] of spec.equations.entries()) {
    r.where = `equations[${i}]`;
    let x = e.at[0];
    const mid = e.at[1];
    for (const t of e.terms) {
      if ("op" in t) {
        const w = textWidth(t.op, 26);
        text(r, x + w / 2, mid + 9, t.op, { size: 26, anchor: "middle" });
        x += w + e.gap;
      } else {
        drawMatrix(r, x, mid - t.h / 2, t);
        x += t.w + e.gap;
      }
    }
  }

  // ---- 叠放的层：一层一条，从上往下
  for (const [i, L] of spec.layers.entries()) {
    r.where = `layers[${i}]`;
    const [x, y0] = L.at;
    for (const [k, b] of L.bands.entries()) {
      const y = y0 + k * (L.h + L.gap);
      const { attrs, ink } = look(b.tone, b.style);
      r.parts.push(`<rect x="${x}" y="${round(y)}" width="${L.width}" height="${L.h}" rx="8" ${attrs}/>`);
      text(r, x + 18, y + L.h / 2 + 5, b.text, { size: 14, weight: 700, fill: ink, ink: false });
      if (b.sub)
        text(r, x + L.width - 18, y + L.h / 2 + 5, b.sub, { size: 13, fill: ink, anchor: "end", ink: false });
      const need = textWidth(b.text, 14, 0.62) + (b.sub ? textWidth(b.sub, 13) + 24 : 0) + 36;
      if (need > L.width)
        r.tight.push(
          `${r.where}.bands[${k}]：「${b.text}」连同右侧说明约 ${Math.round(need)}px，这一层只有 ${L.width}px 宽`,
        );
    }
    box(r, "分层", x, y0, L.width, L.bands.length * (L.h + L.gap) - L.gap);
  }

  // ---- 多行格子
  for (const [i, g] of spec.grids.entries()) {
    r.where = `grids[${i}]`;
    const [x0, y0] = g.at;
    const [cw, ch] = g.cell;
    const W = g.cols * cw + (g.cols - 1) * g.gap;
    const H = g.rows * ch + (g.rows - 1) * g.gap;
    const joined = g.gap === 0;
    const over = new Map<string, (typeof g.cells)[number]>();
    for (const c of g.cells) {
      if (c.at[0] >= g.rows || c.at[1] >= g.cols)
        r.tight.push(`${r.where}：格子 (${c.at[0]}, ${c.at[1]}) 不在 ${g.rows}×${g.cols} 的表里`);
      over.set(`${c.at[0]},${c.at[1]}`, c);
    }
    const size = ch < 28 ? 12.5 : 13;
    for (let row = 0; row < g.rows; row++)
      for (let col = 0; col < g.cols; col++) {
        const c = over.get(`${row},${col}`);
        const style: Fill =
          c?.style ?? (g.fill !== undefined && row * g.cols + col < g.fill ? "solid" : g.style);
        const t = c?.tone ?? g.tone;
        const x = x0 + col * (cw + g.gap);
        const y = y0 + row * (ch + g.gap);
        if (joined) {
          r.parts.push(
            `<rect x="${round(x)}" y="${round(y)}" width="${cw}" height="${ch}" fill="${tableFill(t, style)}"/>`,
          );
          // 连成表时空位和空格长得一样，往里缩一圈画虚线框才分得出来
          if (style === "ghost")
            r.parts.push(
              `<rect x="${round(x + 3)}" y="${round(y + 3)}" width="${cw - 6}" height="${ch - 6}" rx="3" ${look(t, "ghost").attrs}/>`,
            );
        } else
          r.parts.push(
            `<rect x="${round(x)}" y="${round(y)}" width="${cw}" height="${ch}" rx="4" ${look(t, style).attrs}/>`,
          );
        if (c?.text) {
          fitted(r, `${r.where} 格子 (${row}, ${col})`, c.text, size, cw - 6);
          text(r, x + cw / 2, y + ch / 2 + size * 0.36, c.text, {
            size,
            weight: 700,
            fill: look(t, style).ink,
            anchor: "middle",
            ink: false,
          });
        }
      }
    if (joined) {
      const grid: string[] = [];
      for (let c = 1; c < g.cols; c++) grid.push(`M${round(x0 + c * cw)} ${y0}v${H}`);
      for (let k = 1; k < g.rows; k++) grid.push(`M${x0} ${round(y0 + k * ch)}h${W}`);
      if (grid.length)
        r.parts.push(
          `<path d="${grid.join("")}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1" fill="none"/>`,
        );
      r.parts.push(
        `<rect x="${x0}" y="${y0}" width="${round(W)}" height="${round(H)}" fill="none" stroke="${INK}" stroke-width="1.3"/>`,
      );
    }
    box(r, `${g.rows}×${g.cols} 格`, x0, y0, W, H);
    axisLabels(r, x0, y0, cw, ch, g.gap, g.rowLabels, g.colLabels);
    if (g.label)
      text(r, x0 + W / 2, y0 + H + 22, g.label, { size: 13, fill: DEEP[g.tone], anchor: "middle" });
  }

  // ---- 热力图
  for (const [i, hm] of spec.heatmaps.entries()) {
    r.where = `heatmaps[${i}]`;
    const [x0, y0] = hm.at;
    const [cw, ch] = hm.cell;
    const flat = hm.values.flat();
    const lo = hm.min ?? Math.min(...flat);
    const hi = hm.max ?? Math.max(...flat);
    const cols = hm.values[0]!.length;
    for (const [k, row] of hm.values.entries()) {
      if (row.length !== cols)
        r.tight.push(`${r.where}：第 ${k} 行有 ${row.length} 个数，第 0 行有 ${cols} 个`);
      for (const [c, v] of row.entries()) {
        const a = hi === lo ? 1 : (v - lo) / (hi - lo);
        if (a < -1e-9 || a > 1 + 1e-9) r.tight.push(`${r.where}：数值 ${v} 超出色阶 [${lo}, ${hi}]`);
        const op = 0.08 + 0.92 * Math.min(1, Math.max(0, a));
        const x = x0 + c * cw;
        const y = y0 + k * ch;
        r.parts.push(
          `<rect x="${round(x)}" y="${round(y)}" width="${cw}" height="${ch}" fill="${COLOR[hm.tone]}" fill-opacity="${Math.round(op * 100) / 100}" stroke="${SURFACE}" stroke-width="1.5"/>`,
        );
        if (hm.showValues) {
          const s = num(v);
          fitted(r, `${r.where} 格子 (${k}, ${c})`, s, 12, cw - 4);
          text(r, x + cw / 2, y + ch / 2 + 4.3, s, {
            size: 12,
            fill: op > 0.55 ? INVERSE : INK,
            anchor: "middle",
            ink: false,
          });
        }
      }
    }
    const W = cols * cw;
    const H = hm.values.length * ch;
    r.parts.push(
      `<rect x="${x0}" y="${y0}" width="${round(W)}" height="${round(H)}" fill="none" stroke="${INK}" stroke-width="1.3"/>`,
    );
    box(r, "热力图", x0, y0, W, H);
    axisLabels(r, x0, y0, cw, ch, 0, hm.rowLabels, hm.colLabels);
    let yb = y0 + H;
    if (hm.label) {
      text(r, x0 + W / 2, yb + 22, hm.label, { size: 13, fill: DEEP[hm.tone], anchor: "middle" });
      yb += 22;
    }
    if (hm.legend) {
      const ly = yb + 14;
      text(r, x0, ly + 9, hm.legend[0], { size: 12, fill: MUTED });
      const lx = x0 + textWidth(hm.legend[0], 12) + 8;
      for (let k = 0; k < 5; k++)
        r.parts.push(
          `<rect x="${round(lx + k * 17)}" y="${round(ly)}" width="16" height="10" fill="${COLOR[hm.tone]}" fill-opacity="${Math.round((0.08 + 0.23 * k) * 100) / 100}"/>`,
        );
      box(r, "色阶", lx, ly, 84, 10);
      text(r, lx + 84 + 8, ly + 9, hm.legend[1], { size: 12, fill: MUTED });
    }
  }

  // ---- 时间轴
  for (const [i, tl] of spec.timelines.entries()) {
    r.where = `timelines[${i}]`;
    const [ax, ay] = tl.at;
    const x0 = ax + tl.labelW;
    const X = (t: number) => x0 + (t - tl.start) * tl.scale;
    const x1 = X(tl.end);
    for (const [k, lane] of tl.lanes.entries()) {
      const y = ay + k * (tl.laneH + tl.gap);
      if (lane.label)
        text(r, x0 - 12, y + tl.laneH / 2 + 4.5, lane.label, { size: 13, weight: 700, anchor: "end" });
      // 泳道之间一道淡线；最后一条下面就是坐标轴，不再画
      if (k < tl.lanes.length - 1)
        r.parts.push(
          `<path d="M${round(x0)} ${round(y + tl.laneH)}H${round(x1)}" stroke="${FRAME}" stroke-width="1"/>`,
        );
      for (const [s, sp] of lane.spans.entries()) {
        if (sp.from < tl.start || sp.to > tl.end || sp.to <= sp.from)
          r.tight.push(
            `${r.where}.lanes[${k}].spans[${s}]：${sp.from}–${sp.to} 不在时间轴 ${tl.start}–${tl.end} 里`,
          );
        const sx = X(sp.from);
        const w = (sp.to - sp.from) * tl.scale;
        let ink: string;
        if (sp.style === "hatch") {
          r.hatch = true;
          ink = INK;
          r.parts.push(
            `<rect x="${round(sx)}" y="${round(y)}" width="${round(w)}" height="${tl.laneH}" rx="4" fill="url(#${id}-hatch)" stroke="${MUTED}" stroke-width="1.3"/>`,
          );
        } else {
          const l = look(sp.tone, sp.style);
          ink = l.ink;
          r.parts.push(
            `<rect x="${round(sx)}" y="${round(y)}" width="${round(w)}" height="${tl.laneH}" rx="4" ${l.attrs}/>`,
          );
        }
        if (sp.text) {
          fitted(r, `${r.where}.lanes[${k}].spans[${s}]`, sp.text, 12.5, w - 8);
          text(r, sx + w / 2, y + tl.laneH / 2 + 4.5, sp.text, {
            size: 12.5,
            weight: 700,
            fill: ink,
            anchor: "middle",
            ink: false,
          });
        }
      }
    }
    const lanesH = tl.lanes.length * (tl.laneH + tl.gap) - tl.gap;
    box(r, "时间轴", x0, ay, x1 - x0, lanesH);
    const yAxis = ay + lanesH + 12;
    r.parts.push(`<path d="M${round(x0)} ${round(yAxis)}H${round(x1)}" stroke="${INK}" stroke-width="1.3"/>`);
    const ticks: number[] = [];
    if (tl.ticks)
      for (let k = 0; tl.start + k * tl.ticks <= tl.end + 1e-9; k++) ticks.push(tl.start + k * tl.ticks);
    else ticks.push(tl.start, tl.end);
    for (const [k, t] of ticks.entries()) {
      const x = X(t);
      r.parts.push(`<path d="M${round(x)} ${round(yAxis)}v5" stroke="${INK}" stroke-width="1.3"/>`);
      const label = k === ticks.length - 1 && tl.unit ? `${num(t)} ${tl.unit}` : num(t);
      text(r, x, yAxis + 20, label, { size: 12, fill: MUTED, anchor: "middle" });
    }
    for (const m of tl.marks) {
      const x = X(m.t);
      r.parts.push(
        `<path d="M${round(x)} ${round(ay - 4)}V${round(yAxis)}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="3 4"/>`,
      );
      if (m.label) text(r, x, ay - 10, m.label, { size: 12.5, weight: 700, anchor: "middle" });
    }
  }

  // ---- 坐标图
  for (const [i, c] of spec.charts.entries()) {
    r.where = `charts[${i}]`;
    const [X, Y] = c.at;
    const [W, H] = c.size;
    const cats = "categories" in c.x ? c.x.categories : null;
    const xmin = "categories" in c.x ? 0.5 : c.x.min;
    const xmax = "categories" in c.x ? c.x.categories.length + 0.5 : c.x.max;
    const sx = (v: number) => X + ((v - xmin) / (xmax - xmin)) * W;
    const sy = (v: number) => Y + H - ((v - c.y.min) / (c.y.max - c.y.min)) * H;
    for (const t of c.y.ticks) {
      if (t !== c.y.min)
        r.parts.push(
          `<path d="M${X} ${round(sy(t))}h${W}" stroke="${FRAME}" stroke-opacity="0.6" stroke-width="1"/>`,
        );
      r.parts.push(`<path d="M${X} ${round(sy(t))}h-5" stroke="${INK}" stroke-width="1.3"/>`);
      text(r, X - 9, sy(t) + 4, num(t), { size: 12, fill: MUTED, anchor: "end" });
    }
    const xt: [number, string][] = cats
      ? cats.map((s, k) => [k + 1, s])
      : "ticks" in c.x
        ? c.x.ticks.map((t) => [t, num(t)])
        : [];
    for (const [v, s] of xt) {
      r.parts.push(`<path d="M${round(sx(v))} ${Y + H}v5" stroke="${INK}" stroke-width="1.3"/>`);
      text(r, sx(v), Y + H + 19, s, { size: 12, fill: MUTED, anchor: "middle" });
    }
    r.parts.push(`<path d="M${X} ${Y}V${Y + H}H${X + W}" fill="none" stroke="${INK}" stroke-width="1.3"/>`);
    box(r, "绘图区", X, Y, W, H);
    text(r, X + W / 2, Y + H + 40, c.x.label, { size: 13, anchor: "middle" });
    text(r, X, Y - 14, c.y.label, { size: 13 });

    const bars = c.series.filter((s) => s.kind === "bar");
    let slot = W / 10;
    if (cats) slot = W / cats.length;
    else {
      const xs = [...new Set(bars.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b);
      const gaps = xs.slice(1).map((v, k) => v - xs[k]!);
      if (gaps.length) slot = (Math.min(...gaps) / (xmax - xmin)) * W;
    }
    const bw = (slot * 0.6) / Math.max(1, bars.length);
    const base = sy(Math.min(Math.max(0, c.y.min), c.y.max));
    for (const [j, s] of c.series.entries()) {
      for (const [px, py] of s.points)
        if (px < xmin || px > xmax || py < c.y.min || py > c.y.max)
          r.tight.push(`${r.where}.series[${j}]：点 (${px}, ${py}) 不在坐标范围里`);
      if (s.kind === "line") {
        const d = s.points
          .map(([px, py], k) => `${k === 0 ? "M" : "L"}${round(sx(px))} ${round(sy(py))}`)
          .join(" ");
        r.parts.push(
          `<path d="${d}" fill="none" stroke="${COLOR[s.tone]}" stroke-width="2.4"${s.dashed ? ' stroke-dasharray="7 5"' : ""}/>`,
        );
        for (const [px, py] of s.points)
          r.parts.push(
            `<circle cx="${round(sx(px))}" cy="${round(sy(py))}" r="3.5" fill="${COLOR[s.tone]}"/>`,
          );
        const last = s.points[s.points.length - 1]!;
        if (s.label)
          text(r, sx(last[0]) + 8, sy(last[1]) + 4.5, s.label, { size: 13, weight: 700, fill: DEEP[s.tone] });
      } else {
        const k = bars.indexOf(s);
        const shift = (k - (bars.length - 1) / 2) * bw;
        let top = base;
        let cx = X;
        for (const [px, py] of s.points) {
          cx = sx(px) + shift;
          top = Math.min(sy(py), base);
          r.parts.push(
            `<rect x="${round(cx - bw / 2)}" y="${round(top)}" width="${round(bw)}" height="${round(Math.abs(base - sy(py)))}" fill="${COLOR[s.tone]}" stroke="${INK}" stroke-width="1.2"/>`,
          );
        }
        if (s.label)
          text(r, cx, top - 8, s.label, { size: 13, weight: 700, fill: DEEP[s.tone], anchor: "middle" });
      }
    }
    text(r, X, Y + H + 62, `数据：${c.source}`, { size: 12, fill: MUTED, italic: true });
  }

  // ---- 节点图：设备排成一圈，先画边再画点
  for (const [i, g] of spec.graphs.entries()) {
    r.where = `graphs[${i}]`;
    const [cx, cy] = g.at;
    const pos = Array.from({ length: g.count }, (_, k) => {
      const a = -Math.PI / 2 + (2 * Math.PI * k) / g.count;
      return [cx + g.r * Math.cos(a), cy + g.r * Math.sin(a)] as const;
    });
    const n = g.count;
    let pairs: [number, number][] = [];
    if (g.edges === "ring") pairs = pos.map((_, k) => [k, (k + 1) % n]);
    else if (g.edges === "all")
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
    else if (g.edges === "star") pairs = pos.slice(1).map((_, k) => [0, k + 1]);
    else if (g.edges !== "none") pairs = g.edges;
    const both = g.edges === "all" || g.both;
    const has = new Set(pairs.map(([a, b]) => `${a}>${b}`));
    for (const [a, b] of pairs) {
      if (a >= n || b >= n || a === b) {
        r.tight.push(`${r.where}：边 ${a}→${b} 不成立（只有 0–${n - 1} 号）`);
        continue;
      }
      const [ax, ay] = pos[a]!;
      const [bx, by] = pos[b]!;
      const len = Math.hypot(bx - ax, by - ay);
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      // 两个方向都有边：各往自己右手边让 5px，不叠成一根
      const off = has.has(`${b}>${a}`) && !both ? 5 : 0;
      const px = -uy * off;
      const py = ux * off;
      const s0 = both ? g.nodeR + 7 : g.nodeR + 3;
      const s1 = g.nodeR + 7;
      const d = `M${round(ax + ux * s0 + px)} ${round(ay + uy * s0 + py)} L${round(bx - ux * s1 + px)} ${round(by - uy * s1 + py)}`;
      r.parts.push(stroke(r, id, d, g.edgeTone, false, both ? "both" : "end"));
    }
    const faded = new Set(g.faded);
    for (const [k, [x, y]] of pos.entries()) {
      const label = g.labels[k] ?? String(k);
      const { attrs, ink } = look(g.tone, faded.has(k) ? "faded" : g.style);
      r.parts.push(`<circle cx="${round(x)}" cy="${round(y)}" r="${g.nodeR}" ${attrs}/>`);
      fitted(r, `${r.where} 节点 ${k}`, label, 13, g.nodeR * 2 - 8);
      text(r, x, y + 4.7, label, { size: 13, weight: 700, fill: ink, anchor: "middle", ink: false });
      box(r, label, x - g.nodeR, y - g.nodeR, g.nodeR * 2, g.nodeR * 2);
    }
  }

  // ---- 受限自由画板
  for (const [i, sk] of spec.sketches.entries()) {
    r.where = `sketches[${i}]`;
    r.descs.push(sk.note);
    const [ox, oy] = sk.at;
    const [sw, sh] = sk.size;
    const words: InkBox[] = [];
    const inside = (j: number, xs: number[], ys: number[]) => {
      if (
        Math.min(...xs) < -0.5 ||
        Math.min(...ys) < -0.5 ||
        Math.max(...xs) > sw + 0.5 ||
        Math.max(...ys) > sh + 0.5
      )
        r.tight.push(`${r.where}.shapes[${j}]：画出了自由画板（${sw}×${sh}）`);
    };
    const pts = (ps: number[][]) => ps.map(([x, y]) => `${round(ox + x!)},${round(oy + y!)}`).join(" ");
    for (const [j, s] of sk.shapes.entries()) {
      if (s.kind === "rect") {
        const [x, y] = s.at;
        const [w, h] = s.size;
        r.parts.push(
          `<rect x="${round(ox + x)}" y="${round(oy + y)}" width="${w}" height="${h}" rx="6" ${look(s.tone, s.style).attrs}/>`,
        );
        inside(j, [x, x + w], [y, y + h]);
      } else if (s.kind === "circle") {
        const [x, y] = s.at;
        r.parts.push(
          `<circle cx="${round(ox + x)}" cy="${round(oy + y)}" r="${s.r}" ${look(s.tone, s.style).attrs}/>`,
        );
        inside(j, [x - s.r, x + s.r], [y - s.r, y + s.r]);
      } else if (s.kind === "polygon") {
        r.parts.push(`<polygon points="${pts(s.points)}" ${look(s.tone, s.style).attrs}/>`);
        inside(
          j,
          s.points.map((p) => p[0]),
          s.points.map((p) => p[1]),
        );
      } else if (s.kind === "line") {
        const d = s.points
          .map(([x, y], k) => `${k === 0 ? "M" : "L"}${round(ox + x)} ${round(oy + y)}`)
          .join(" ");
        r.parts.push(stroke(r, id, d, s.tone, s.dashed, s.arrow));
        inside(
          j,
          s.points.map((p) => p[0]),
          s.points.map((p) => p[1]),
        );
      } else if (s.kind === "curve") {
        const at = (p: number[]) => `${round(ox + p[0]!)} ${round(oy + p[1]!)}`;
        const d = `M${at(s.from)} C ${at(s.c1)}, ${at(s.c2)}, ${at(s.to)}`;
        r.parts.push(stroke(r, id, d, s.tone, s.dashed, s.arrow));
        const cp = cubicPoints(s.from, s.c1, s.c2, s.to);
        inside(
          j,
          cp.map((p) => p[0]),
          cp.map((p) => p[1]),
        );
      } else {
        const size = SKETCH_TEXT[s.size];
        const [x, y] = s.at;
        const w = textWidth(s.text, size);
        const left = s.anchor === "end" ? x - w : s.anchor === "middle" ? x - w / 2 : x;
        words.push({
          where: `${r.where}.shapes[${j}]`,
          what: s.text,
          x: left,
          y: y - size * 0.78,
          w,
          h: size,
        });
        inside(j, [left, left + w], [y - size * 0.78, y + size * 0.22]);
        const fill = s.inverse ? INVERSE : s.tone ? DEEP[s.tone] : INK;
        text(r, ox + x, oy + y, s.text, {
          size,
          weight: s.strong ? 700 : 400,
          fill,
          anchor: s.anchor,
          ink: false,
        });
      }
    }
    // 画板里的形状可以互相叠（字写在方块上），但两段字不能压在一起
    for (let a = 0; a < words.length; a++)
      for (let b = a + 1; b < words.length; b++) {
        const p = words[a]!;
        const q = words[b]!;
        const ox2 = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x);
        const oy2 = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
        if (ox2 > 1 && oy2 > 1) r.tight.push(`${p.where} 压住 ${q.where}：「${p.what}」与「${q.what}」重叠`);
      }
    box(r, sk.name, ox, oy, sw, sh);
  }

  // ---- 物体
  for (const [i, it] of spec.items.entries()) {
    r.where = `items[${i}]`;
    const [x, y] = it.at;
    const [w, h] = it.size;
    const t = it.tone;
    const rect = (dx: number, dy: number) => {
      const X = x + dx;
      const Y = y + dy;
      // 身后那几份不画虚线：几层虚线错开叠在一起会糊成一团
      if (it.style === "faded" && dx > 0)
        return `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="8" fill="${SOFT[t]}" stroke="${COLOR[t]}" stroke-opacity="0.4" stroke-width="1.5"/>`;
      if (it.style === "faded")
        return `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="8" fill="${SOFT[t]}" stroke="${COLOR[t]}" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="5 4"/>`;
      if (it.style === "plain")
        return `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="8" fill="${SOFT.control}" stroke="${INK}" stroke-width="1.5"/>`;
      return `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="8" fill="${COLOR[t]}" stroke="${INK}" stroke-width="1.5"/>`;
    };
    // 身后叠着的几份：往右上错开，最远的先画
    for (let d = it.depth; d >= 1; d--) r.parts.push(rect(d * 7, -d * 7));
    r.parts.push(rect(0, 0));
    box(r, it.text ?? "物体", x, y - it.depth * 7, w + it.depth * 7, h + it.depth * 7);
    const fill = it.style === "solid" ? INVERSE : it.style === "faded" ? DEEP[t] : INK;
    const weight = it.style === "faded" ? 400 : 700;
    const size = it.style === "faded" ? 13 : 14;
    const cx = x + w / 2;
    const cy = y + h / 2;
    if (it.text && it.sub) {
      text(r, cx, cy - 4, it.text, { size, weight, fill, anchor: "middle", ink: false });
      text(r, cx, cy + 15, it.sub, { size: 13, fill, anchor: "middle", ink: false });
    } else if (it.text) text(r, cx, cy + 5, it.text, { size, weight, fill, anchor: "middle", ink: false });
  }

  // ---- 圆节点
  for (const [i, n] of spec.nodes.entries()) {
    r.where = `nodes[${i}]`;
    const [cx, cy] = n.at;
    r.parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${n.r}" fill="${SURFACE}" stroke="${INK}" stroke-width="1.5"/>`,
    );
    text(r, cx, cy + 6, n.text, { size: 20, weight: 700, anchor: "middle", ink: false });
    box(r, n.text, cx - n.r, cy - n.r, n.r * 2, n.r * 2);
  }

  // ---- 下括号
  for (const [i, b] of spec.brackets.entries()) {
    r.where = `brackets[${i}]`;
    r.parts.push(
      `<path d="M${b.from} ${b.y} v8 h${b.to - b.from} v-8" fill="none" stroke="${INK}" stroke-width="1.5"/>`,
    );
    text(r, (b.from + b.to) / 2, b.y + 30, b.label, { size: 14, weight: 700, anchor: "middle" });
  }

  // ---- 文字
  for (const [i, t] of spec.texts.entries()) {
    r.where = `texts[${i}]`;
    const fill = t.tone ? DEEP[t.tone] : t.note ? MUTED : INK;
    const rows = t.width ? wrap(t.text, t.size, t.width) : [t.text];
    for (const [k, line] of rows.entries())
      text(r, t.at[0], t.at[1] + k * t.size * 1.6, line, {
        size: t.size,
        weight: t.strong ? 700 : 400,
        fill,
        italic: t.note,
        anchor: t.anchor,
      });
  }

  // ---- 小标签
  for (const [i, g] of spec.tags.entries()) {
    r.where = `tags[${i}]`;
    const w = textWidth(g.text, 13) + 24;
    const [x, y] = g.at;
    r.parts.push(`<rect x="${x}" y="${y}" width="${round(w)}" height="24" rx="12" fill="${COLOR[g.tone]}"/>`);
    text(r, x + w / 2, y + 17, g.text, {
      size: 13,
      weight: 700,
      fill: INVERSE,
      anchor: "middle",
      ink: false,
    });
    box(r, g.text, x, y, w, 24);
  }

  // ---- 步骤编号：故意压在物体的角上，不参加撞墨检查
  const badges: string[] = [];
  for (const b of spec.badges) {
    const [cx, cy] = b.at;
    badges.push(
      `<circle cx="${cx}" cy="${cy}" r="11" fill="${COLOR[b.tone]}"/><text x="${cx}" y="${cy + 5}" font-family="${FONT}" font-size="13" font-weight="700" fill="${INVERSE}" text-anchor="middle">${b.n}</text>`,
    );
  }
  r.parts.push(...badges);

  const defs = [...r.used].map(
    (t) =>
      `<marker id="${marker(id, t)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COLOR[t]}"/></marker>`,
  );
  if (r.hatch)
    defs.push(
      `<pattern id="${id}-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${SOFT.control}"/><line x1="0" y1="0" x2="0" y2="7" stroke="${MUTED}" stroke-width="2"/></pattern>`,
    );
  r.parts.unshift(`<defs>${defs.join("")}</defs>`);
  return r;
}

export function renderFigure(spec: FigureSpec): string {
  const [W, H] = spec.size;
  const { parts, descs } = paint(spec);
  const desc = descs.length ? `\n  <desc>${esc(descs.join("；"))}</desc>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.caption)}">
  <title>${esc(spec.caption)}</title>${desc}
  ${parts.join("\n  ")}
</svg>
`;
}

/**
 * 出界和撞墨两项检查。和 scene 版式同一条纪律：坐标手写就一定会撞，撞了要能失败。
 * 物体里的字算物体自己的，不单独查；步骤编号故意压角，不查。
 * 各零件自己发现的问题（字放不下、数不在坐标范围里、画出自由画板）一并报出。
 */
export function figureProblems(spec: FigureSpec): string[] {
  const [W, H] = spec.size;
  const { ink, points, tight } = paint(spec);
  const out: string[] = [];
  for (const p of points)
    if (p.x < 0 || p.y < 0 || p.x > W || p.y > H)
      out.push(`${p.where}：箭头经过 (${Math.round(p.x)}, ${Math.round(p.y)})，出了画布`);
  for (const b of ink)
    if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > W + 0.5 || b.y + b.h > H + 0.5)
      out.push(`${b.where}：「${b.what.slice(0, 16)}」画到了画布外（画布 ${W}×${H}）`);
  // 物体里写的字要放得下
  for (const [i, it] of spec.items.entries()) {
    const size = it.style === "faded" ? 13 : 14;
    for (const s of [it.text, it.sub])
      if (s && textWidth(s, size) > it.size[0] - 12)
        out.push(
          `items[${i}]：「${s}」约 ${Math.round(textWidth(s, size))}px，框里放不下（只有 ${it.size[0] - 12}px）`,
        );
  }
  out.push(...tight);
  const seen = new Set<string>();
  for (let i = 0; i < ink.length; i++)
    for (let j = i + 1; j < ink.length; j++) {
      const a = ink[i]!;
      const b = ink[j]!;
      if (a.where === b.where) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 1 || oy <= 1) continue;
      const key = `${a.where}|${b.where}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        `${a.where} 压住 ${b.where}：「${a.what.slice(0, 14)}」与「${b.what.slice(0, 14)}」重叠 ${Math.round(ox)}×${Math.round(oy)}px`,
      );
    }
  return out;
}

/** 图上所有给读者看的字（数据出处除外），用来查代码名 */
function figureWords(spec: FigureSpec): string[] {
  const matrixWords = (m: MatrixShape) => [m.label, m.dims];
  return [
    ...spec.texts.map((t) => t.text),
    ...spec.items.flatMap((it) => [it.text, it.sub]),
    ...spec.frames.map((f) => f.label),
    ...spec.hardware.map((h) => h.label),
    ...spec.matrices.flatMap(matrixWords),
    ...spec.equations.flatMap((e) => e.terms.flatMap((t) => ("op" in t ? [] : matrixWords(t)))),
    ...spec.brackets.map((b) => b.label),
    ...spec.dividers.flatMap((d) => d.sides ?? []),
    ...spec.layers.flatMap((l) => l.bands.flatMap((b) => [b.text, b.sub])),
    ...spec.grids.flatMap((g) => [...g.cells.map((c) => c.text), ...g.rowLabels, ...g.colLabels, g.label]),
    ...spec.heatmaps.flatMap((h) => [...h.rowLabels, ...h.colLabels, h.label]),
    ...spec.timelines.flatMap((t) => [
      ...t.lanes.flatMap((l) => [l.label, ...l.spans.map((s) => s.text)]),
      ...t.marks.map((m) => m.label),
    ]),
    ...spec.charts.flatMap((c) => [
      c.x.label,
      c.y.label,
      ...("categories" in c.x ? c.x.categories : []),
      ...c.series.map((s) => s.label),
    ]),
    ...spec.graphs.flatMap((g) => g.labels),
    ...spec.sketches.flatMap((s) => s.shapes.flatMap((sh) => (sh.kind === "text" ? [sh.text] : []))),
  ].filter((s): s is string => Boolean(s));
}

/**
 * 不阻塞的提醒：图上文字太多、句子放进了图里、讲解图里出现代码名、自由画板画得太多。
 * 这几样画出来不会「错」，但会把图重新变回满屏小字的仪表盘，所以每次出图都列出来。
 */
export function figureAdvisories(spec: FigureSpec): string[] {
  const out: string[] = [];
  if (spec.texts.length > 8)
    out.push(`图上有 ${spec.texts.length} 段文字，超过 8 段：说明挪回正文，图上只留短语`);
  for (const [i, t] of spec.texts.entries())
    if (!t.width && [...t.text].length > 30)
      out.push(`texts[${i}]：「${t.text.slice(0, 16)}…」是一整句，放回正文`);
  // 驼峰要求大写后面跟小写：isPrefill 算代码名，vLLM 这种产品名不算
  const code = /[A-Za-z]+_[A-Za-z_]+|\b[a-z]+[A-Z][a-z][A-Za-z0-9]*|\w+\(\)/;
  for (const w of figureWords(spec)) {
    const m = code.exec(w);
    if (m) out.push(`图上出现代码名「${m[0]}」：讲解图不放代码名，源码细节放「对照源码」`);
  }
  for (const [i, s] of spec.sketches.entries())
    if (s.shapes.length > 24)
      out.push(`sketches[${i}]「${s.name}」手画了 ${s.shapes.length} 个形状：这么复杂的形状该做成零件`);
  return out;
}

/** 同一种形状在这么多张图里手画过，就该升级成零件 */
export const SKETCH_PROMOTE_AT = 3;

/**
 * 跨图统计自由画板：按 name 归类，数它出现在几张图里。
 * 自由画板是零件的试验田——反复出现的形状要升级成零件，不能一直手画下去。
 */
export function sketchUsage(specs: FigureSpec[]): { total: number; figures: number; promote: string[] } {
  const byName = new Map<string, Set<string>>();
  let total = 0;
  let figures = 0;
  for (const s of specs) {
    if (s.sketches.length) figures++;
    for (const k of s.sketches) {
      total++;
      const name = k.name.trim();
      const ids = byName.get(name) ?? new Set<string>();
      ids.add(s.id);
      byName.set(name, ids);
    }
  }
  const promote = [...byName]
    .filter(([, ids]) => ids.size >= SKETCH_PROMOTE_AT)
    .map(
      ([name, ids]) =>
        `自由画板「${name}」已在 ${ids.size} 张图里手画（${[...ids].join("、")}），该升级成零件了`,
    );
  return { total, figures, promote };
}
