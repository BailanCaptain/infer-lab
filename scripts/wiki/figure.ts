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
import { esc, type InkBox, MONO, monoTextWidth, round, textWidth, wrap } from "./scene";

const point = z.tuple([z.number(), z.number()]);
const int = z.number().int();
const fontChoice = z.enum(["sans", "mono"]).default("sans");

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
      font: fontChoice,
      tone: tone.optional(),
      /** 写在实色形状上时用反白字 */
      inverse: z.boolean().default(false),
      anchor: z.enum(["start", "middle", "end"]).default("start"),
    })
    .strict(),
]);
const SKETCH_TEXT = { small: 13, normal: 13.5, large: 16 } as const;

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
            font: fontChoice,
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
    /**
     * 集合通信分镜（2026-09-29）：几张卡，每卡一个张量切成一排块；每一步写清谁把哪一块发给谁，
     * copy 是覆盖目的块，add 是加进目的块。块里的数由渲染器按步骤算出来，作者只写初值和收发。
     * 渲染成一步一格、从上往下排的分镜：每格画「这一步之前各卡手里有什么 + 要发的块停在箭头上」，
     * 最后一格画结果。页面上由播放器一次只显示一格，播放时每个块沿箭头从源块飞到目的块
     * （src/content/wiki/DiagramPlayer.tsx）。一张图最多一个分镜，也不和别的零件同图：播放器按格裁切。
     */
    exchanges: z
      .array(
        z
          .object({
            at: point,
            /** 卡的名字，按环的顺序：第一排从左往右，第二排从右往左，正好顺时针一圈 */
            cards: z.array(z.string().min(1)).min(2).max(8),
            /** 每排几张卡；不给时 3 张以内排一排，再多分两排 */
            perRow: int.min(1).max(8).optional(),
            /** 每卡切成几块，每块画多宽多高。一排最多 8 块；用 rows 排成多行时最多 16 块（比如 4 个 token × 4 维） */
            slots: int.min(1).max(16),
            cell: point.default([52, 34]),
            /** 卡与卡之间的横、竖间距：箭头和路上的块画在这里 */
            gap: point.default([150, 96]),
            /** 每卡每块的初值；null 是空着的接收位置 */
            start: z.array(z.array(z.number().nullable()).min(1)).min(2),
            /** 每块下面一排小圆点，一张卡一个：实心表示这块里已经加进了那张卡的数 */
            dots: z.boolean().default(false),
            /** 每格标题右边的小字，比如「数为示意」 */
            tag: z.string().optional(),
            /** 每块下面的小字，每张卡相同，写这一格装的是谁（2026-09-29 EP 页加，比如一格一个 token） */
            labels: z.array(z.string().min(1)).optional(),
            /**
             * 每卡的张量排成几行（2026-09-29 SP 页加）：给了就把 slots 块排成 rows 行、每行 slots / rows 块，
             * 第 k 块落在第 floor(k / 每行块数) 行。一行一个 token、一列一个隐藏维时用它；不给就是一排。
             * 多行时不能再用 dots 和 labels（它们画在每块下面，会压到下一行）。
             */
            rows: int.min(1).max(8).optional(),
            /** 多行时每行左边的小字，写这一行是谁（比如 token 0）；个数等于 rows */
            rowLabels: z.array(z.string().min(1)).optional(),
            /**
             * 每张卡上放着的专家（2026-09-29 EP 页加）：画成卡里块上方的一排权重色小框，个数等于卡数。
             * 本卡计算（sets）写了 expert 时，块和这个专家之间连一条线，播放时块飞进专家。
             */
            experts: z.array(z.array(z.string().min(1)).min(1)).optional(),
            /**
             * 逐张卡演（2026-09-29 all-reduce 样品加）：不画箭头，块从源块出发，只在两排卡之间的空地里横平竖直地走；
             * 一步里的收发按卡分批，一批演完再演下一批，任何时刻路上的块都不互相压住。
             * 全是 add / sum 的一步按目的卡分批：发来的块在目的块旁边排成一列、左边出现「+」，停一下再一起并进目的块，
             * 目的块换成加出来的和（青色实心）；其余的步按源卡分批：块沿竖线走向正对面的卡，经过哪条横道就在那里分出一份拐过去，
             * 收到的副本保持浅青（不是新算出来的）。下排的卡名写在块下面，两排的块都朝着中间的空地。
             * 只支持 4 张卡排两排、每排两张，两排之间的竖向间距要放得下一列加法。
             */
            waves: z.boolean().default(false),
            steps: z
              .array(
                z
                  .object({
                    title: z.string().min(1),
                    moves: z
                      .array(
                        z
                          .object({
                            from: z.tuple([int.min(0), int.min(0)]),
                            to: z.tuple([int.min(0), int.min(0)]),
                            /**
                             * copy 覆盖目的块；add 加进目的块（目的块不能空）；
                             * sum（2026-09-29 EP 页加）也是加进目的块，但目的块空着时从 0 开始加，用于「结果送回原卡加起来」
                             */
                            op: z.enum(["copy", "add", "sum"]).default("copy"),
                          })
                          .strict(),
                      )
                      .default([]),
                    /**
                     * 本卡计算（2026-09-29 EP 页加）：这一步不通信，卡把自己手里的某一块换成算出来的数，
                     * null 是清空。和 moves 至少写一样；同一块在同一步里不能既收数又计算。
                     */
                    sets: z
                      .array(
                        z
                          .object({
                            at: z.tuple([int.min(0), int.min(0)]),
                            value: z.number().nullable(),
                            /** 用本卡哪个专家算（名字要在 experts 里这张卡那一行） */
                            expert: z.string().min(1).optional(),
                            /** 这一格里写在这块标签下面的短注，比如乘了什么「×3 ×0.5」 */
                            note: z.string().min(1).optional(),
                          })
                          .strict(),
                      )
                      .default([]),
                    /** 这一步之后清空的块（2026-09-29 EP 页加）：不参与后面的计算，不画计算框，下一格空着 */
                    drop: z.array(z.tuple([int.min(0), int.min(0)])).optional(),
                    /**
                     * 这一格里写在块下面的淡色短注（2026-09-29 EP 页加），比如「这个数是怎么算来的」；
                     * 和 sets 的 note 画在同一行，同一块只能有一条
                     */
                    notes: z
                      .array(
                        z.object({ at: z.tuple([int.min(0), int.min(0)]), text: z.string().min(1) }).strict(),
                      )
                      .optional(),
                    /** 这一步之后算「结果」的块；给了就把其余有数的块淡掉（只是用过的输入） */
                    keep: z.array(z.tuple([int.min(0), int.min(0)])).optional(),
                  })
                  .strict(),
              )
              .min(1),
            /** 最后一格（结果）的标题 */
            end: z.string().min(1),
          })
          .strict(),
      )
      .max(1)
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
    /** 箭头：直线 / 折线（via）/ 单参数弧线（bend，右手法向中点偏移）/ 三次曲线（curve 给两个控制点） */
    links: z
      .array(
        z
          .object({
            from: point,
            to: point,
            via: z.array(point).default([]),
            curve: z.tuple([point, point]).optional(),
            bend: z.number().finite().optional(),
            ends: z.enum(["none", "end", "both"]).default("end"),
            tone: tone.default("ink"),
            dashed: z.boolean().default(false),
          })
          .strict()
          .superRefine((l, ctx) => {
            if (l.bend !== undefined && l.curve !== undefined)
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "bend 与 curve 不能同时指定",
                path: ["bend"],
              });
            if (l.bend !== undefined && l.via.length > 0)
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "bend 与 via 不能同时指定",
                path: ["bend"],
              });
            if (l.curve !== undefined && l.via.length > 0)
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "curve 与 via 不能同时指定",
                path: ["curve"],
              });
          }),
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
            font: fontChoice,
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
  comm: "var(--color-comm-soft, #f5e6f0)",
  control: "var(--color-control-soft, #f1efe8)",
  danger: "var(--color-danger-soft, #fbe5e2)",
  ink: "var(--color-control-soft, #f1efe8)",
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

/** 统一柔和矿物浅底 + 1.4px 同色系描边 + 深墨文字，与 native-svg 风格无缝一致 */
function look(t: FigureTone, style: Fill): { attrs: string; ink: string } {
  switch (style) {
    case "solid":
      return { attrs: `fill="${SOFT[t]}" stroke="${COLOR[t]}" stroke-width="1.4"`, ink: INK };
    case "faded":
      return {
        attrs: `fill="${SURFACE}" stroke="${COLOR[t]}" stroke-opacity="0.45" stroke-width="1.3" stroke-dasharray="4 3"`,
        ink: DEEP[t],
      };
    case "plain":
      return { attrs: `fill="${SOFT.control}" stroke="${FRAME}" stroke-width="1.4"`, ink: INK };
    case "empty":
      return {
        attrs: `fill="${SURFACE}" stroke="${FRAME}" stroke-width="1.2"`,
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
  if (style === "solid") return SOFT[t];
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
  o: {
    size?: number;
    weight?: number;
    fill?: string;
    italic?: boolean;
    mono?: boolean;
    anchor?: string;
    ink?: boolean;
  } = {},
): void {
  const size = o.size ?? 13.5;
  const w = o.mono ? monoTextWidth(s, size) : textWidth(s, size);
  const left = o.anchor === "end" ? x - w : o.anchor === "middle" ? x - w / 2 : x;
  if (o.ink !== false) r.ink.push({ where: r.where, what: s, x: left, y: y - size * 0.78, w, h: size });
  const anchor = o.anchor && o.anchor !== "start" ? ` text-anchor="${o.anchor}"` : "";
  const italic = o.italic ? ' font-style="italic"' : "";
  r.parts.push(
    `<text x="${round(x)}" y="${round(y)}" font-family="${o.mono ? MONO : FONT}" font-size="${size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? INK}"${anchor}${italic}>${esc(s)}</text>`,
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

/** 三次曲线上均匀取 17 个点（含 t = 0.5 精确弧顶），留给出界与画板边界检查 */
function cubicPoints(p0: number[], c1: number[], c2: number[], p3: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0]! + 3 * u * u * t * c1[0]! + 3 * u * t * t * c2[0]! + t * t * t * p3[0]!,
      u * u * u * p0[1]! + 3 * u * u * t * c1[1]! + 3 * u * t * t * c2[1]! + t * t * t * p3[1]!,
    ]);
  }
  return out;
}

export interface LinkGeometry {
  kind: "polyline" | "cubic";
  pathD: string;
  samples: [number, number][];
  startTangent: [number, number];
  endTangent: [number, number];
  controlPoints?: [[number, number], [number, number]];
  problem?: string;
}

function unitVec(dx: number, dy: number): [number, number] | null {
  const len = Math.hypot(dx, dy);
  return len < 1e-6 ? null : [dx / len, dy / len];
}

/**
 * 箭头几何唯一真相源：SVG <path d>、画布边界采样与两端箭头切向均由同一组点/控制点派生，
 * 杜绝「渲染画弯、校验按直线算」或零长度产生 NaN。
 */
export function resolveLinkGeometry(link: {
  from: readonly [number, number] | number[];
  to: readonly [number, number] | number[];
  via?: readonly (readonly [number, number] | number[])[];
  curve?: readonly [readonly [number, number] | number[], readonly [number, number] | number[]];
  bend?: number | undefined;
}): LinkGeometry {
  const p0: [number, number] = [link.from[0]!, link.from[1]!];
  const p3: [number, number] = [link.to[0]!, link.to[1]!];
  if (link.curve) {
    const c1: [number, number] = [link.curve[0][0]!, link.curve[0][1]!];
    const c2: [number, number] = [link.curve[1][0]!, link.curve[1][1]!];
    const sTan =
      unitVec(c1[0] - p0[0], c1[1] - p0[1]) ??
      unitVec(c2[0] - p0[0], c2[1] - p0[1]) ??
      unitVec(p3[0] - p0[0], p3[1] - p0[1]);
    const eTan =
      unitVec(p3[0] - c2[0], p3[1] - c2[1]) ??
      unitVec(p3[0] - c1[0], p3[1] - c1[1]) ??
      unitVec(p3[0] - p0[0], p3[1] - p0[1]);
    return {
      kind: "cubic",
      pathD: `M${p0[0]} ${p0[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p3[0]} ${p3[1]}`,
      samples: cubicPoints(p0, c1, c2, p3),
      startTangent: sTan ?? [0, 0],
      endTangent: eTan ?? [0, 0],
      controlPoints: [c1, c2],
      ...(sTan && eTan ? {} : { problem: "起点、终点与控制点重合，连线长度为 0" }),
    };
  }
  if (link.bend !== undefined && link.bend !== 0) {
    const dx = p3[0] - p0[0];
    const dy = p3[1] - p0[1];
    const chord = unitVec(dx, dy);
    if (!chord) {
      return {
        kind: "polyline",
        pathD: `M${round(p0[0])} ${round(p0[1])} L${round(p3[0])} ${round(p3[1])}`,
        samples: [p0, p3],
        startTangent: [0, 0],
        endTangent: [0, 0],
        problem: "起点与终点重合，无法按 bend 计算法向弧线与箭头方向",
      };
    }
    const [ux, uy] = chord;
    const nx = -uy;
    const ny = ux;
    const h = (4 / 3) * link.bend;
    const r0: [number, number] = [round(p0[0]), round(p0[1])];
    const r3: [number, number] = [round(p3[0]), round(p3[1])];
    const c1: [number, number] = [round(p0[0] + dx / 3 + nx * h), round(p0[1] + dy / 3 + ny * h)];
    const c2: [number, number] = [round(p0[0] + (2 * dx) / 3 + nx * h), round(p0[1] + (2 * dy) / 3 + ny * h)];
    return {
      kind: "cubic",
      pathD: `M${r0[0]} ${r0[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${r3[0]} ${r3[1]}`,
      samples: cubicPoints(r0, c1, c2, r3),
      startTangent: unitVec(c1[0] - r0[0], c1[1] - r0[1]) ?? chord,
      endTangent: unitVec(r3[0] - c2[0], r3[1] - c2[1]) ?? chord,
      controlPoints: [c1, c2],
    };
  }
  const via: [number, number][] = (link.via ?? []).map((p) => [p[0]!, p[1]!]);
  const pts: [number, number][] = [p0, ...via, p3];
  let firstSeg: [number, number] | null = null;
  let lastSeg: [number, number] | null = null;
  for (let k = 0; k + 1 < pts.length; k++) {
    const seg = unitVec(pts[k + 1]![0] - pts[k]![0], pts[k + 1]![1] - pts[k]![1]);
    if (seg) {
      firstSeg ??= seg;
      lastSeg = seg;
    }
  }
  return {
    kind: "polyline",
    pathD: pts.map(([x, y], k) => `${k === 0 ? "M" : "L"}${x} ${y}`).join(" "),
    samples: pts,
    startTangent: firstSeg ?? [0, 0],
    endTangent: lastSeg ?? [0, 0],
    ...(firstSeg && lastSeg ? {} : { problem: "起点与终点重合，连线长度为 0" }),
  };
}

function drawMatrix(r: Run, x: number, y: number, m: MatrixShape): void {
  const grid: string[] = [];
  for (let c = 1; c < m.cols; c++) grid.push(`M${round(x + (m.w * c) / m.cols)} ${y}v${m.h}`);
  for (let k = 1; k < m.rows; k++) grid.push(`M${x} ${round(y + (m.h * k) / m.rows)}h${m.w}`);
  if (m.style === "faded")
    r.parts.push(
      `<rect x="${x}" y="${y}" width="${m.w}" height="${m.h}" fill="${SURFACE}" stroke="${COLOR[m.tone]}" stroke-opacity="0.45" stroke-width="1.3"/>`,
    );
  else
    r.parts.push(
      `<rect x="${x}" y="${y}" width="${m.w}" height="${m.h}" fill="${SOFT[m.tone]}" stroke="${COLOR[m.tone]}" stroke-width="1.4"/>`,
    );
  if (grid.length)
    r.parts.push(
      m.style === "faded"
        ? `<path d="${grid.join("")}" stroke="${COLOR[m.tone]}" stroke-opacity="0.28" stroke-width="1" fill="none"/>`
        : `<path d="${grid.join("")}" stroke="${COLOR[m.tone]}" stroke-opacity="0.35" stroke-width="1" fill="none"/>`,
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
    if (s) text(r, x0 + k * (cw + gap) + cw / 2, y0 - 10, s, { size: 13, fill: MUTED, anchor: "middle" });
}

type ExchangeSpec = FigureSpec["exchanges"][number];

/** 分镜里一块在某一格的样子：数、加进过哪几张卡的数、是否只是用过的输入、是否这一步刚写入 */
export interface ExchangeSlot {
  value: number | null;
  from: number[];
  dim: boolean;
  fresh: boolean;
}

/**
 * 按步骤算出每一格各卡手里的块：第 0 格是初值，第 k 格是做完第 k 步。
 * 同一步里的收发同时发生，全都按这一步之前的值算；几条 add 可以落在同一块上（直接归约），
 * copy 只能写一次。收发不成立（越界、源块空、add 到空块……）记成问题，不抛异常。
 */
export function exchangeStates(ex: ExchangeSpec): { states: ExchangeSlot[][][]; problems: string[] } {
  const problems: string[] = [];
  const n = ex.cards.length;
  if (ex.start.length !== n) problems.push(`初值有 ${ex.start.length} 行，卡有 ${n} 张`);
  for (const [c, row] of ex.start.entries())
    if (row.length !== ex.slots) problems.push(`初值第 ${c} 行有 ${row.length} 块，每卡应有 ${ex.slots} 块`);
  let cur: ExchangeSlot[][] = ex.cards.map((_, c) =>
    Array.from({ length: ex.slots }, (_, s) => {
      const v = ex.start[c]?.[s] ?? null;
      return { value: v, from: v === null ? [] : [c], dim: false, fresh: false };
    }),
  );
  const states = [cur];
  const inRange = (c: number, s: number) => c < n && s < ex.slots;
  for (const [k, step] of ex.steps.entries()) {
    const next = cur.map((row) => row.map((s) => ({ ...s, from: [...s.from], fresh: false })));
    const written = new Map<string, "copy" | "add" | "sum">();
    for (const m of step.moves) {
      const [fc, fs] = m.from;
      const [tc, ts] = m.to;
      const where = `第 ${k + 1} 步 卡${fc}.块${fs} → 卡${tc}.块${ts}`;
      if (!inRange(fc, fs) || !inRange(tc, ts)) {
        problems.push(`${where}：卡号或块号越界`);
        continue;
      }
      if (fc === tc) {
        problems.push(`${where}：卡自己发给自己不算通信`);
        continue;
      }
      const src = cur[fc]![fs]!;
      if (src.value === null) {
        problems.push(`${where}：源块是空的`);
        continue;
      }
      const key = `${tc}.${ts}`;
      const prev = written.get(key);
      if (prev && prev !== m.op && prev !== "copy" && m.op !== "copy") {
        problems.push(`${where}：同一块在这一步混用了 add 和 sum，只能用其中一种`);
        continue;
      }
      if (prev && (prev !== m.op || m.op === "copy")) {
        problems.push(`${where}：同一块在这一步被写了两次（add 可以叠加，copy 不行）`);
        continue;
      }
      written.set(key, m.op);
      const dst = next[tc]![ts]!;
      if (m.op === "add") {
        if (cur[tc]![ts]!.value === null) {
          problems.push(`${where}：add 的目的块是空的，应该用 copy`);
          continue;
        }
        dst.value = (dst.value ?? 0) + src.value;
        dst.from = [...new Set([...dst.from, ...src.from])].sort((a, b) => a - b);
      } else if (m.op === "sum") {
        // 和 add 一样叠加，只是目的块空着时从 0 开始
        dst.value = (dst.value ?? 0) + src.value;
        dst.from = [...new Set([...dst.from, ...src.from])].sort((a, b) => a - b);
      } else {
        dst.value = src.value;
        dst.from = [...src.from];
      }
      dst.fresh = true;
      dst.dim = false;
    }
    // 本卡计算：按这一步之前的值换成新数；和收发一样同时发生
    if (!step.moves.length && !step.sets.length) problems.push(`第 ${k + 1} 步既没有收发也没有本卡计算`);
    const computed = new Set<string>();
    for (const s of step.sets) {
      const [c, i] = s.at;
      const where = `第 ${k + 1} 步 卡${c}.块${i} 本卡计算`;
      if (!inRange(c, i)) {
        problems.push(`${where}：卡号或块号越界`);
        continue;
      }
      const key = `${c}.${i}`;
      if (written.has(key)) {
        problems.push(`${where}：这一块这一步同时收到别的卡发来的数`);
        continue;
      }
      if (computed.has(key)) {
        problems.push(`${where}：同一块在这一步算了两次`);
        continue;
      }
      computed.add(key);
      if (s.expert !== undefined && !ex.experts?.[c]?.includes(s.expert))
        problems.push(`${where}：卡${c} 上没有专家「${s.expert}」（先在 experts 里写上）`);
      const before = cur[c]![i]!;
      const dst = next[c]![i]!;
      dst.value = s.value;
      dst.from = s.value === null ? [] : before.value === null ? [c] : [...before.from];
      dst.fresh = s.value !== null;
      dst.dim = false;
    }
    // 清空：这一块不参与后面的计算，下一格空着
    for (const [c, i] of step.drop ?? []) {
      const where = `第 ${k + 1} 步 卡${c}.块${i} 清空`;
      if (!inRange(c, i)) {
        problems.push(`${where}：卡号或块号越界`);
        continue;
      }
      const key = `${c}.${i}`;
      if (written.has(key) || computed.has(key)) {
        problems.push(`${where}：这一块这一步已经收数或计算，不能同时清空`);
        continue;
      }
      next[c]![i] = { value: null, from: [], dim: false, fresh: false };
    }
    if (step.keep) {
      const keep = new Set<string>();
      for (const [c, s] of step.keep) {
        if (!inRange(c, s)) problems.push(`第 ${k + 1} 步 keep 里的卡${c}.块${s} 越界`);
        keep.add(`${c}.${s}`);
      }
      for (const [c, row] of next.entries())
        for (const [s, slot] of row.entries())
          if (keep.has(`${c}.${s}`)) slot.dim = false;
          else if (slot.value !== null) slot.dim = true;
    }
    states.push(next);
    cur = next;
  }
  return { states, problems };
}

/** 分镜的排布：卡框大小、每格多高、每张卡落在第几排第几列（第二排从右往左，绕成一圈） */
function exchangeLayout(ex: ExchangeSpec) {
  const n = ex.cards.length;
  const perRow = ex.perRow ?? (n <= 3 ? n : Math.ceil(n / 2));
  const rows = Math.ceil(n / perRow);
  const cols = Math.min(n, perRow);
  const [sw, sh] = ex.cell;
  const [hg, vg] = ex.gap;
  // 卡里的张量：gr 行 × gc 列；不给 rows 时 gr=1、gc=slots、lw=0，和一排的画法完全一样
  const gr = ex.rows ?? 1;
  const gc = Math.ceil(ex.slots / gr);
  const lw = ex.rowLabels?.length ? Math.max(...ex.rowLabels.map((s) => textWidth(s, 12))) + 10 : 0;
  const cw = 32 + lw + gc * sw;
  // 专家框一排画在块上方，和块之间留出连线的地方；有短注时每块下面再多一行。都不给时与原来一样
  const top = 32 + (ex.experts ? 58 : 0);
  const noteH = ex.steps.some((s) => s.sets.some((t) => t.note) || s.notes?.length) ? 15 : 0;
  const ch = top + gr * sh + (ex.dots ? 14 : 0) + (ex.labels ? 16 : 0) + noteH + 14;
  const head = 36;
  const bandH = head + rows * ch + (rows - 1) * vg + 24;
  const place = (c: number) => {
    const row = Math.floor(c / perRow);
    const k = c % perRow;
    return { row, col: row % 2 === 0 ? k : perRow - 1 - k };
  };
  /** 第 s 块在卡里张量的哪一格（相对张量左上角的偏移） */
  const cellAt = (s: number) => [(s % gc) * sw, Math.floor(s / gc) * sh] as const;
  return {
    n,
    rows,
    cols,
    sw,
    sh,
    hg,
    vg,
    gr,
    gc,
    lw,
    cw,
    ch,
    top,
    head,
    bandH,
    width: cols * cw + (cols - 1) * hg,
    place,
    cellAt,
  };
}

/**
 * 逐张卡演的节拍（毫秒）：加法批是飞过去、停着让人看清加号、并进目的块；
 * 复制批是主干走一段（leg）、在横道上停一下让副本滑出去（drop）、副本拐到目的块（peel）；两批之间留 gap
 */
const WAVE_MS = { fly: 700, show: 650, fuse: 350, leg: 280, drop: 260, peel: 650, gap: 150 } as const;
/** 加法列离自己的卡 8、离对面那排至少 22：一眼看得出这一列挂在哪张卡上 */
const COLUMN_NEAR = 8;
const COLUMN_FAR = 22;

type XY = readonly [number, number];
/** 一块在路上时和它在源块里的样子一样：底色、字色、字重 */
interface SlotLook {
  fill: string;
  ink: string;
  weight: number;
}
interface WaveMover {
  route: XY[];
  /** 每个折点的时刻（毫秒），null 是中间点 */
  keys: (number | null)[];
  show: number;
  hide: number | null;
  /** 并进目的块的那一段边走边淡掉（毫秒，起止） */
  fade: [number, number] | null;
  look: SlotLook;
  value: string;
}
export interface WavePlan {
  /** 整段播放多长（毫秒）；没有收发时是 0 */
  ms: number;
  movers: string[];
  /** 加号：目的块旁边那一列每块左边一个 */
  cues: string[];
  /** 加完以后盖在目的块上的和，按「卡.块」存，画在那一块的底色之后、格子线之前 */
  sums: Map<string, string>;
  problems: string[];
  points: XY[];
  /** 加法列里每个块位，查出界和撞墨用 */
  columns: { card: number; x: number; y: number }[];
}

/**
 * 逐张卡演：把一步的收发排成一批一批的块路线和提示（exchanges.waves）。
 * 路线只走两排卡之间的空地：先竖着出源卡，再横着走到目标正上 / 正下方，最后竖着进去，
 * 所以不会从别的块上划过；同一批里各块走不同的横道（加法列的每一格一条），不会互相压住。
 */
function planWaves(o: {
  step: FigureSpec["exchanges"][number]["steps"][number];
  n: number;
  sw: number;
  sh: number;
  gapTop: number;
  gapBot: number;
  rowOf: (c: number) => number;
  center: (c: number, s: number) => XY;
  look: (c: number, s: number) => SlotLook;
  valueOf: (c: number, s: number) => number | null;
  sumOf: (c: number, s: number) => number | null;
}): WavePlan {
  const plan: WavePlan = {
    ms: 0,
    movers: [],
    cues: [],
    sums: new Map(),
    problems: [],
    points: [],
    columns: [],
  };
  const moves = o.step.moves.filter((m) => m.from[0] < o.n && m.to[0] < o.n && m.from[0] !== m.to[0]);
  if (!moves.length) return plan;
  const raw: WaveMover[] = [];
  const cues: { x: number; y: number; show: number; hide: number }[] = [];
  const sums: { key: string; x: number; y: number; show: number; value: number }[] = [];
  const allAdd = moves.every((m) => m.op !== "copy");
  if (!allAdd && moves.some((m) => m.op !== "copy"))
    plan.problems.push("逐张卡演：一步里不能既有 add / sum 又有 copy（加法按目的卡分批，复制按源卡分批）");
  const groups = new Map<number, typeof moves>();
  for (const m of moves) {
    const c = allAdd ? m.to[0] : m.from[0];
    groups.set(c, [...(groups.get(c) ?? []), m]);
  }
  const lane = (row: number) =>
    row === 0 ? o.gapTop + COLUMN_NEAR + o.sh / 2 : o.gapBot - COLUMN_NEAR - o.sh / 2;
  let t = 0;
  for (const card of [...groups.keys()].sort((a, b) => a - b)) {
    const list = groups.get(card)!;
    if (allAdd) {
      // 一批：别的卡把块送到卡 card 的同一块上，排成一列、出现加号，再并进去
      const slot = list[0]!.to[1];
      if (list.some((m) => m.to[1] !== slot)) {
        plan.problems.push(`逐张卡演：一步里卡${card} 只能在一块上相加，现在收在好几块上`);
        continue;
      }
      const dst = o.center(card, slot);
      const dir = o.rowOf(card) === 0 ? 1 : -1;
      const edge = dir > 0 ? o.gapTop : o.gapBot;
      const dx = (m: (typeof list)[number]) => Math.abs(o.center(m.from[0], m.from[1])[0] - dst[0]);
      // 同一排的卡离得近，排在列的最里面；另一排的按横向距离从远到近，正对面的走竖直线排在最外面
      const sorted = [...list].sort((a, b) => {
        const ra = o.rowOf(a.from[0]) === o.rowOf(card) ? 0 : 1;
        const rb = o.rowOf(b.from[0]) === o.rowOf(card) ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return ra === 0 ? dx(a) - dx(b) : dx(b) - dx(a);
      });
      const landed = t + WAVE_MS.fly;
      const fuse = landed + WAVE_MS.show;
      const done = fuse + WAVE_MS.fuse;
      for (const [i, m] of sorted.entries()) {
        const src = o.center(m.from[0], m.from[1]);
        const P: XY = [dst[0], edge + dir * (COLUMN_NEAR + o.sh / 2 + i * (o.sh + 8))];
        const straight = Math.abs(src[0] - P[0]) < 0.5;
        const route: XY[] = straight ? [src, P, P, dst] : [src, [src[0], P[1]], P, P, dst];
        const keys = straight ? [t, landed, fuse, done] : [t, null, landed, fuse, done];
        const v = o.valueOf(m.from[0], m.from[1]);
        raw.push({
          route,
          keys,
          show: t,
          hide: done,
          fade: [fuse, done],
          look: o.look(m.from[0], m.from[1]),
          value: num(v ?? 0),
        });
        cues.push({ x: P[0] - o.sw / 2 - 12, y: P[1], show: landed, hide: fuse });
        plan.columns.push({ card, x: P[0] - o.sw / 2, y: P[1] - o.sh / 2 });
      }
      const sum = o.sumOf(card, slot);
      if (sum !== null) sums.push({ key: `${card}.${slot}`, x: dst[0], y: dst[1], show: done, value: sum });
      t = done + WAVE_MS.gap;
    } else {
      // 一批：卡 card 把同一块发给别的卡。块沿竖线走向正对面那张卡，经过横道时分出一份拐过去
      const slot = list[0]!.from[1];
      if (list.some((m) => m.from[1] !== slot)) {
        plan.problems.push(`逐张卡演：一步里卡${card} 只能发出同一块，现在发了好几块`);
        continue;
      }
      const src = o.center(card, slot);
      const across = list.find(
        (m) => o.rowOf(m.to[0]) !== o.rowOf(card) && Math.abs(o.center(m.to[0], m.to[1])[0] - src[0]) < 0.5,
      );
      if (!across) {
        plan.problems.push(`逐张卡演：卡${card} 这一批没有发给正对面的卡，分叉没有主干可走`);
        continue;
      }
      const main = o.center(across.to[0], across.to[1]);
      const v = num(o.valueOf(card, slot) ?? 0);
      const look = o.look(card, slot);
      // 主干沿竖线走，每到一条要分叉的横道就停一下，副本从停住的主干下面横着滑出去（边走边分会摞成台阶）
      const branches = list
        .filter((m) => m !== across)
        .map((m) => ({ m, y: lane(o.rowOf(m.to[0])) }))
        .sort((a, b) => Math.abs(a.y - src[1]) - Math.abs(b.y - src[1]));
      const trunk: XY[] = [src];
      const trunkKeys: number[] = [t];
      let clock = t;
      let end = t;
      const peels: WaveMover[] = [];
      for (const { m, y } of branches) {
        const phi = (y - src[1]) / (main[1] - src[1]);
        if (!(phi > 0 && phi < 1)) {
          plan.problems.push(`逐张卡演：卡${card} 发给卡${m.to[0]} 的横道不在竖线经过的地方`);
          continue;
        }
        clock += WAVE_MS.leg;
        trunk.push([src[0], y], [src[0], y]);
        trunkKeys.push(clock, clock + WAVE_MS.drop);
        const dst = o.center(m.to[0], m.to[1]);
        peels.push({
          route: [[src[0], y], [dst[0], y], dst],
          keys: [clock, null, clock + WAVE_MS.peel],
          show: clock,
          hide: null,
          fade: null,
          look,
          value: v,
        });
        end = Math.max(end, clock + WAVE_MS.peel);
        clock += WAVE_MS.drop;
      }
      clock += WAVE_MS.leg;
      trunk.push(main);
      trunkKeys.push(clock);
      end = Math.max(end, clock);
      // 主干画在最上面：副本从它下面滑出来
      raw.push(...peels, { route: trunk, keys: trunkKeys, show: t, hide: null, fade: null, look, value: v });
      t = end + WAVE_MS.gap;
    }
  }
  const ms = Math.max(t - WAVE_MS.gap, 1);
  plan.ms = Math.round(ms);
  const f = (x: number) => String(Number((x / ms).toFixed(4)));
  for (const m of raw) {
    const [x0, y0] = m.route[0]!;
    const d = m.route.map(([x, y], k) => `${k ? "L" : "M"}${round(x)} ${round(y)}`).join(" ");
    const keys = m.keys.map((k) => (k === null ? "-" : f(k))).join(" ");
    const hide = m.hide === null ? "" : ` data-hide="${f(m.hide)}"`;
    const fade = m.fade === null ? "" : ` data-fade="${f(m.fade[0])} ${f(m.fade[1])}"`;
    plan.points.push(...m.route);
    plan.movers.push(
      `<g class="wiki-anim-move" data-keys="${keys}" data-show="${f(m.show)}"${hide}${fade} opacity="0"><path class="wiki-anim-route" d="${d}" fill="none" stroke="none"/><g class="wiki-anim-payload"><rect x="${round(x0 - o.sw / 2)}" y="${round(y0 - o.sh / 2)}" width="${o.sw}" height="${o.sh}" fill="${m.look.fill}" stroke="${INK}" stroke-width="1.3"/><text x="${round(x0)}" y="${round(y0 + 4.6)}" font-family="${FONT}" font-size="13" font-weight="${m.look.weight}" fill="${m.look.ink}" text-anchor="middle">${esc(m.value)}</text></g></g>`,
    );
  }
  for (const c of cues) {
    plan.points.push([c.x, c.y]);
    plan.cues.push(
      `<g class="wiki-anim-cue" data-show="${f(c.show)}" data-hide="${f(c.hide)}" opacity="0"><text x="${round(c.x)}" y="${round(c.y + 6)}" font-family="${FONT}" font-size="18" font-weight="700" fill="${INK}" text-anchor="middle">+</text></g>`,
    );
  }
  for (const s of sums)
    plan.sums.set(
      s.key,
      `<g class="wiki-anim-cue" data-show="${f(s.show)}" opacity="0"><rect x="${round(s.x - o.sw / 2)}" y="${round(s.y - o.sh / 2)}" width="${o.sw}" height="${o.sh}" fill="${COLOR.token}"/><text x="${round(s.x)}" y="${round(s.y + 4.6)}" font-family="${FONT}" font-size="13" font-weight="700" fill="${INVERSE}" text-anchor="middle">${esc(num(s.value))}</text></g>`,
    );
  return plan;
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
    link: {
      from: number[];
      to: number[];
      via?: number[][];
      curve?: [number[], number[]];
      bend?: number | undefined;
    },
    t: FigureTone,
    dashed: boolean,
    ends: "none" | "end" | "both" = "end",
  ) => {
    const geo = resolveLinkGeometry(link);
    if (geo.problem) r.tight.push(`${r.where}：${geo.problem}`);
    lines.push(stroke(r, id, geo.pathD, t, dashed, ends));
    for (const p of geo.samples) r.points.push({ where: r.where, x: p[0], y: p[1] });
  };
  for (const [i, l] of spec.links.entries()) {
    r.where = `links[${i}]`;
    arrow(l, l.tone, l.dashed, l.ends);
  }
  for (const [i, f] of spec.fans.entries()) {
    r.where = `fans[${i}]`;
    const froms = Array.isArray(f.from[0]) ? (f.from as number[][]) : [f.from as number[]];
    const tos = Array.isArray(f.to[0]) ? (f.to as number[][]) : [f.to as number[]];
    for (const a of froms) for (const b of tos) arrow({ from: a, to: b }, f.tone, false);
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
          `<rect x="${round(x)}" y="${y}" width="${round(w)}" height="${b.h}" rx="4" fill="${SOFT[s.tone]}" stroke="${COLOR[s.tone]}" stroke-width="1.4"/>`,
        );
        if (s.text) text(r, x + 16, y + b.h / 2 + 5, s.text, { size: 13, weight: 700, fill: INK });
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
          `<rect x="${round(x)}" y="${y}" width="${row.w}" height="${row.h}" rx="4" fill="none" stroke="${COLOR[row.tone]}" stroke-width="1.4" stroke-dasharray="3 3"/>`,
        );
      else if (faded.has(k))
        r.parts.push(
          `<rect x="${round(x)}" y="${y}" width="${row.w}" height="${row.h}" rx="4" fill="${SURFACE}" stroke="${COLOR[row.tone]}" stroke-opacity="0.4" stroke-width="1.2"/>`,
        );
      else
        r.parts.push(
          `<rect x="${round(x)}" y="${y}" width="${row.w}" height="${row.h}" rx="4" fill="${SOFT[row.tone]}" stroke="${COLOR[row.tone]}" stroke-width="1.4"/>`,
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
    const size = 13;
    for (let row = 0; row < g.rows; row++)
      for (let col = 0; col < g.cols; col++) {
        const c = over.get(`${row},${col}`);
        const style: Fill =
          c?.style ?? (g.fill !== undefined && row * g.cols + col < g.fill ? "solid" : g.style);
        const t = c?.tone ?? g.tone;
        const x = x0 + col * (cw + g.gap);
        const y = y0 + row * (ch + g.gap);
        if (joined) {
          const op = style === "faded" ? ' fill-opacity="0.45"' : "";
          r.parts.push(
            `<rect x="${round(x)}" y="${round(y)}" width="${cw}" height="${ch}" fill="${tableFill(t, style)}"${op}/>`,
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
          `<path d="${grid.join("")}" stroke="${COLOR[g.tone]}" stroke-opacity="0.3" stroke-width="1" fill="none"/>`,
        );
      r.parts.push(
        `<rect x="${x0}" y="${y0}" width="${round(W)}" height="${round(H)}" fill="none" stroke="${COLOR[g.tone]}" stroke-width="1.4"/>`,
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
          fitted(r, `${r.where} 格子 (${k}, ${c})`, s, 13, cw - 4);
          text(r, x + cw / 2, y + ch / 2 + 4.5, s, {
            size: 13,
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
      text(r, x0, ly + 9, hm.legend[0], { size: 13, fill: MUTED });
      const lx = x0 + textWidth(hm.legend[0], 13) + 8;
      for (let k = 0; k < 5; k++)
        r.parts.push(
          `<rect x="${round(lx + k * 17)}" y="${round(ly)}" width="16" height="10" fill="${COLOR[hm.tone]}" fill-opacity="${Math.round((0.08 + 0.23 * k) * 100) / 100}"/>`,
        );
      box(r, "色阶", lx, ly, 84, 10);
      text(r, lx + 84 + 8, ly + 9, hm.legend[1], { size: 13, fill: MUTED });
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
          fitted(r, `${r.where}.lanes[${k}].spans[${s}]`, sp.text, 13, w - 2);
          text(r, sx + w / 2, y + tl.laneH / 2 + 4.5, sp.text, {
            size: 13,
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
      text(r, x, yAxis + 20, label, { size: 13, fill: MUTED, anchor: "middle" });
    }
    for (const m of tl.marks) {
      const x = X(m.t);
      r.parts.push(
        `<path d="M${round(x)} ${round(ay - 4)}V${round(yAxis)}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="3 4"/>`,
      );
      if (m.label) text(r, x, ay - 10, m.label, { size: 13, weight: 700, anchor: "middle" });
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
      text(r, X - 9, sy(t) + 4, num(t), { size: 13, fill: MUTED, anchor: "end" });
    }
    const xt: [number, string][] = cats
      ? cats.map((s, k) => [k + 1, s])
      : "ticks" in c.x
        ? c.x.ticks.map((t) => [t, num(t)])
        : [];
    for (const [v, s] of xt) {
      r.parts.push(`<path d="M${round(sx(v))} ${Y + H}v5" stroke="${INK}" stroke-width="1.3"/>`);
      text(r, sx(v), Y + H + 19, s, { size: 13, fill: MUTED, anchor: "middle" });
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
            `<rect x="${round(cx - bw / 2)}" y="${round(top)}" width="${round(bw)}" height="${round(Math.abs(base - sy(py)))}" fill="${SOFT[s.tone]}" stroke="${COLOR[s.tone]}" stroke-width="1.4"/>`,
          );
        }
        if (s.label)
          text(r, cx, top - 8, s.label, { size: 13, weight: 700, fill: DEEP[s.tone], anchor: "middle" });
      }
    }
    text(r, X, Y + H + 62, `数据：${c.source}`, { size: 13, fill: MUTED, italic: true });
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

  // ---- 集合通信分镜：一步一格从上往下排。每格先画各卡手里的块，再画箭头，最后画停在箭头上的块
  for (const [i, ex] of spec.exchanges.entries()) {
    const base = `exchanges[${i}]`;
    r.where = base;
    const others = Object.entries(spec).filter(
      ([k, v]) => !["exchanges", "pins", "size"].includes(k) && Array.isArray(v) && v.length > 0,
    );
    if (others.length)
      r.tight.push(
        `${base}：分镜图不能再放别的零件（${others.map(([k]) => k).join("、")}），播放器按格裁切会把它们裁掉`,
      );
    const L = exchangeLayout(ex);
    if (L.rows > 2) r.tight.push(`${base}：卡最多排两排才绕得成一圈，现在要排 ${L.rows} 排`);
    const { states, problems } = exchangeStates(ex);
    for (const p of problems) r.tight.push(`${base}：${p}`);
    if (ex.labels && ex.labels.length !== ex.slots)
      r.tight.push(`${base}：labels 有 ${ex.labels.length} 个，每卡有 ${ex.slots} 块`);
    if (ex.rows !== undefined && ex.slots % ex.rows !== 0)
      r.tight.push(`${base}：${ex.slots} 块排不成 ${ex.rows} 行（要能整除）`);
    if (L.gr > 1 && (ex.dots || ex.labels))
      r.tight.push(`${base}：排成多行时不能再用 dots 和 labels，它们会压到下一行；每行是谁写进 rowLabels`);
    if (L.gr > 1 && (ex.experts || ex.steps.some((s) => s.sets.some((t) => t.note) || s.notes?.length)))
      r.tight.push(`${base}：排成多行时不能再用 experts 和短注：短注会压到下一行，下一行的连线会穿过上一行`);
    for (const [k, s] of ex.steps.entries())
      for (const n of s.notes ?? []) {
        if (n.at[0] >= ex.cards.length || n.at[1] >= ex.slots)
          r.tight.push(`${base}：第 ${k + 1} 步短注的卡${n.at[0]}.块${n.at[1]} 越界`);
        if (s.sets.some((t) => t.note && t.at[0] === n.at[0] && t.at[1] === n.at[1]))
          r.tight.push(`${base}：第 ${k + 1} 步卡${n.at[0]}.块${n.at[1]} 有两条短注`);
      }
    if (ex.rowLabels && ex.rowLabels.length !== L.gr)
      r.tight.push(`${base}：rowLabels 有 ${ex.rowLabels.length} 个，张量有 ${L.gr} 行`);
    if (L.gr === 1 && ex.slots > 8)
      r.tight.push(`${base}：一排最多 8 块，现在 ${ex.slots} 块；多了用 rows 排成几行`);
    const [ax, ay] = ex.at;
    const frameOf = (c: number, by: number) => {
      const { row, col } = L.place(c);
      return { x: ax + col * (L.cw + L.hg), y: by + L.head + row * (L.ch + L.vg) };
    };
    // 逐张卡演时下排卡上下翻过来：块在卡顶下 14，名字写在块下面，两排的块都朝着中间的空地
    const flipped = (c: number) => ex.waves && L.place(c).row === 1;
    const tensorTop = (c: number, by: number) => frameOf(c, by).y + (flipped(c) ? 14 : L.top);
    const slotCenter = (c: number, s: number, by: number) => {
      const f = frameOf(c, by);
      const [dx, dy] = L.cellAt(s);
      return [f.x + 16 + L.lw + dx + L.sw / 2, tensorTop(c, by) + dy + L.sh / 2] as const;
    };
    const wavesOk = ex.waves && L.n === 4 && L.rows === 2 && L.cols === 2 && L.gr === 1 && !ex.experts;
    if (ex.waves && !wavesOk)
      r.tight.push(`${base}：逐张卡演只支持 4 张卡排两排、每排两张，张量一排、不放专家`);
    if (ex.waves && ex.steps.some((s) => s.sets.length))
      r.tight.push(`${base}：逐张卡演还不演本卡计算（sets）`);
    const columnNeed = COLUMN_NEAR + (L.n - 1) * L.sh + (L.n - 2) * 8 + COLUMN_FAR;
    if (wavesOk && L.vg < columnNeed)
      r.tight.push(`${base}：两排卡之间放不下加法列：gap 的竖向间距至少 ${columnNeed}，现在 ${L.vg}`);
    /** 卡 c 的第 j 个专家框：一排居中放在块的正上方 */
    const expertBox = (c: number, j: number, by: number) => {
      const f = frameOf(c, by);
      const m = ex.experts?.[c]?.length ?? 1;
      const inner = L.gc * L.sw;
      const w = Math.min(96, (inner - (m - 1) * 12) / m);
      const x0 = f.x + 16 + L.lw + (inner - (m * w + (m - 1) * 12)) / 2;
      return { x: x0 + j * (w + 12), y: f.y + 32, w, h: 24 };
    };
    if (ex.experts && ex.experts.length !== L.n)
      r.tight.push(`${base}：experts 有 ${ex.experts.length} 行，卡有 ${L.n} 张`);
    /** 从卡框中心出发、平移 (px, py) 的那条线，沿 u 方向走出卡框要走多远 */
    const exit = (ux: number, uy: number, px: number, py: number) =>
      Math.min(
        ux > 0 ? (L.cw / 2 - px) / ux : ux < 0 ? (-L.cw / 2 - px) / ux : Number.POSITIVE_INFINITY,
        uy > 0 ? (L.ch / 2 - py) / uy : uy < 0 ? (-L.ch / 2 - py) / uy : Number.POSITIVE_INFINITY,
      );
    for (const [b, state] of states.entries()) {
      const by = ay + b * L.bandH;
      const step = ex.steps[b];
      const band = `${base} 第 ${b + 1} 格`;
      // 块的样子。逐张卡演时只有加出来、算出来的块是青色实心；上一步 copy 收到的副本不是新算的，保持浅青、字加粗
      const prev = ex.steps[b - 1];
      const copied = new Set(
        ex.waves && prev ? prev.moves.filter((m) => m.op === "copy").map((m) => `${m.to[0]}.${m.to[1]}`) : [],
      );
      const lookOf = (c: number, s: number): SlotLook => {
        const slot = state[c]?.[s];
        if (!slot) return { fill: SURFACE, ink: MUTED, weight: 600 };
        const solid = slot.fresh && !copied.has(`${c}.${s}`);
        return {
          fill: slot.value === null || slot.dim ? SURFACE : solid ? COLOR.token : SOFT.token,
          ink: slot.dim ? MUTED : solid ? INVERSE : DEEP.token,
          weight: slot.fresh ? 700 : 600,
        };
      };
      const gapTop = by + L.head + L.ch;
      const plan =
        wavesOk && step
          ? planWaves({
              step,
              n: L.n,
              sw: L.sw,
              sh: L.sh,
              gapTop,
              gapBot: gapTop + L.vg,
              rowOf: (c) => L.place(c).row,
              center: (c, s) => slotCenter(c, s, by),
              look: lookOf,
              valueOf: (c, s) => state[c]?.[s]?.value ?? null,
              sumOf: (c, s) => states[b + 1]?.[c]?.[s]?.value ?? null,
            })
          : null;
      for (const p of plan?.problems ?? []) r.tight.push(`${band}：${p}`);
      // 逐张卡演的格写明整段播放多长，播放器按它走关键帧
      r.parts.push(
        plan?.ms ? `<g class="wiki-anim-band" data-ms="${plan.ms}">` : `<g class="wiki-anim-band">`,
      );
      r.parts.push(
        `<rect class="wiki-anim-box" x="0" y="${round(by)}" width="${spec.size[0]}" height="${round(L.bandH)}" fill="none"/>`,
      );
      r.where = `${band} 标题`;
      r.parts.push(`<g class="wiki-anim-title">`);
      text(r, ax, by + 22, step ? step.title : ex.end, { size: 14.5, weight: 700 });
      r.parts.push("</g>");
      if (ex.tag) {
        r.where = `${band} 旁注`;
        text(r, ax + L.width, by + 22, ex.tag, { size: 12.5, fill: MUTED, anchor: "end" });
      }
      // 逐张卡演不描发送粗框和接收虚框：块真的从源块飞走、落进目的块，框只会一层层叠在格子线上
      const framed = ex.waves ? [] : (step?.moves ?? []);
      const sending = new Set(framed.map((m) => `${m.from[0]}.${m.from[1]}`));
      const landing = new Set(framed.map((m) => `${m.to[0]}.${m.to[1]}`));
      const computing = new Set(step?.sets.map((s) => `${s.at[0]}.${s.at[1]}`) ?? []);
      // 本卡计算写了用哪个专家：块沿连线飞进专家框（播放器按 wiki-anim-move 统一处理）
      const computeMovers: string[] = [];
      for (const [c, name] of ex.cards.entries()) {
        r.where = `${band} ${name}`;
        const f = frameOf(c, by);
        r.parts.push(
          `<rect x="${round(f.x)}" y="${round(f.y)}" width="${L.cw}" height="${L.ch}" rx="16" fill="none" stroke="${FRAME}" stroke-width="1.5"/>`,
        );
        text(r, f.x + 16, flipped(c) ? f.y + L.ch - 10 : f.y + 22, name, { size: 13, weight: 700 });
        for (const [j, e] of (ex.experts?.[c] ?? []).entries()) {
          r.where = `${band} ${name} 专家 ${e}`;
          const b = expertBox(c, j, by);
          r.parts.push(
            `<rect x="${round(b.x)}" y="${round(b.y)}" width="${round(b.w)}" height="${b.h}" rx="6" fill="${SOFT.weight}" stroke="${COLOR.weight}" stroke-width="1.3"/>`,
          );
          fitted(r, r.where, e, 12.5, b.w - 8);
          text(r, b.x + b.w / 2, b.y + 16.5, e, {
            size: 12.5,
            weight: 700,
            fill: DEEP.weight,
            anchor: "middle",
            ink: false,
          });
          box(r, r.where, b.x, b.y, b.w, b.h);
        }
        r.where = `${band} ${name}`;
        const tx = f.x + 16 + L.lw;
        const ty = tensorTop(c, by);
        const tw = L.gc * L.sw;
        const th = L.gr * L.sh;
        for (const [k, s] of (ex.rowLabels ?? []).entries())
          text(r, tx - 8, ty + k * L.sh + L.sh / 2 + 4.5, s, { size: 12, fill: MUTED, anchor: "end" });
        const row = state[c] ?? [];
        for (const [s, slot] of row.entries()) {
          const x = tx + L.cellAt(s)[0];
          const y = ty + L.cellAt(s)[1];
          const look = lookOf(c, s);
          r.parts.push(
            `<rect x="${round(x)}" y="${round(y)}" width="${L.sw}" height="${L.sh}" fill="${look.fill}"/>`,
          );
          // 逐张卡演：这一块这一步要加出和，和先藏着，并进来那一刻盖在原来的数上（在格子线下面）
          const sum = plan?.sums.get(`${c}.${s}`);
          if (slot.value === null) {
            if (sum) r.parts.push(sum);
            continue;
          }
          const v = num(slot.value);
          fitted(r, `${band} ${name} 第 ${s} 块`, v, 13, L.sw - 6);
          text(r, x + L.sw / 2, y + L.sh / 2 + 4.6, v, {
            size: 13,
            weight: look.weight,
            fill: look.ink,
            anchor: "middle",
            ink: false,
          });
          if (sum) r.parts.push(sum);
        }
        // 一张卡手里的整个张量是一块：外框加格子线，分块只是格子线
        r.parts.push(
          `<rect x="${round(tx)}" y="${round(ty)}" width="${tw}" height="${th}" fill="none" stroke="${INK}" stroke-width="1.3"/>`,
        );
        // 格子线：竖线分列，多行时再加横线分行
        const grid = [
          ...Array.from({ length: L.gc - 1 }, (_, s) => `M${round(tx + (s + 1) * L.sw)} ${round(ty)}v${th}`),
          ...Array.from({ length: L.gr - 1 }, (_, k) => `M${round(tx)} ${round(ty + (k + 1) * L.sh)}h${tw}`),
        ];
        if (grid.length)
          r.parts.push(
            `<path d="${grid.join("")}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1" fill="none"/>`,
          );
        box(r, `${name} 的块`, tx, ty, tw, th);
        for (const [s, slot] of row.entries()) {
          const x = tx + L.cellAt(s)[0];
          const y = ty + L.cellAt(s)[1];
          if (ex.dots) {
            const x0 = x + L.sw / 2 - ((L.n - 1) * 8) / 2;
            for (let k = 0; k < L.n; k++)
              r.parts.push(
                slot.from.includes(k)
                  ? `<circle cx="${round(x0 + k * 8)}" cy="${round(y + L.sh + 9)}" r="3" fill="${slot.dim ? MUTED : COLOR.token}"/>`
                  : `<circle cx="${round(x0 + k * 8)}" cy="${round(y + L.sh + 9)}" r="3" fill="none" stroke="${MUTED}" stroke-opacity="0.7" stroke-width="1"/>`,
              );
          }
          // 这一步要发出去的块描紫色粗框，要落进来的块描紫色虚框
          if (sending.has(`${c}.${s}`))
            r.parts.push(
              `<rect x="${round(x - 1.5)}" y="${round(y - 1.5)}" width="${L.sw + 3}" height="${L.sh + 3}" fill="none" stroke="${COLOR.comm}" stroke-width="2.6"/>`,
            );
          if (landing.has(`${c}.${s}`))
            r.parts.push(
              `<rect x="${round(x + 3)}" y="${round(y + 3)}" width="${L.sw - 6}" height="${L.sh - 6}" fill="none" stroke="${COLOR.comm}" stroke-width="1.6" stroke-dasharray="4 3"/>`,
            );
          // 这一步在本卡上算的块描权重色粗框：不通信，下一格换成算出来的数
          if (computing.has(`${c}.${s}`))
            r.parts.push(
              `<rect x="${round(x - 1.5)}" y="${round(y - 1.5)}" width="${L.sw + 3}" height="${L.sh + 3}" fill="none" stroke="${COLOR.weight}" stroke-width="2.6"/>`,
            );
          const label = ex.labels?.[s];
          if (label) {
            r.where = `${band} ${name} 第 ${s} 块的标签`;
            fitted(r, r.where, label, 12, L.sw - 4);
            text(r, x + L.sw / 2, y + L.sh + (ex.dots ? 14 : 0) + 14, label, {
              size: 12,
              fill: MUTED,
              anchor: "middle",
            });
          }
          const set = step?.sets.find((t) => t.at[0] === c && t.at[1] === s);
          if (set?.note) {
            r.where = `${band} ${name} 第 ${s} 块的短注`;
            fitted(r, r.where, set.note, 11.5, L.sw - 2);
            text(r, x + L.sw / 2, y + L.sh + (ex.dots ? 14 : 0) + (ex.labels ? 16 : 0) + 13, set.note, {
              size: 11.5,
              weight: 700,
              fill: DEEP.weight,
              anchor: "middle",
            });
          }
          const stepNote = step?.notes?.find((t) => t.at[0] === c && t.at[1] === s);
          if (stepNote && !set?.note) {
            r.where = `${band} ${name} 第 ${s} 块的淡色短注`;
            fitted(r, r.where, stepNote.text, 11.5, L.sw - 2);
            text(r, x + L.sw / 2, y + L.sh + (ex.dots ? 14 : 0) + (ex.labels ? 16 : 0) + 13, stepNote.text, {
              size: 11.5,
              weight: 600,
              fill: MUTED,
              anchor: "middle",
            });
          }
          const j = set?.expert === undefined ? -1 : (ex.experts?.[c]?.indexOf(set.expert) ?? -1);
          if (set && j >= 0 && slot.value !== null) {
            // 块上沿竖着往上，到这个专家自己那一层横线再横过去，最后竖着进专家框：
            // 连到不同专家的线只会直角相交，不会斜着交叉看错。播放时块升到专家框下沿再横移过去
            r.where = `${band} ${name} 第 ${s} 块 → ${set.expert}`;
            const b = expertBox(c, j, by);
            const bx = x + L.sw / 2;
            const ax = Math.min(Math.max(bx, b.x + 12), b.x + b.w - 12);
            const under = b.y + b.h;
            const lane = y - 9 - j * 9;
            const d =
              ax === bx
                ? `M${round(bx)} ${round(y)} V${round(under + 3)}`
                : `M${round(bx)} ${round(y)} V${round(lane)} H${round(ax)} V${round(under + 3)}`;
            r.parts.push(stroke(r, id, d, "weight", false, "end"));
            r.points.push({ where: r.where, x: bx, y }, { where: r.where, x: ax, y: under + 3 });
            const dock = under + 2 + L.sh / 2;
            const route = [
              [bx, y + L.sh / 2],
              [bx, dock],
              [ax, dock],
            ]
              .map(([px, py], k) => `${k ? "L" : "M"}${round(px!)} ${round(py!)}`)
              .join(" ");
            const v = num(slot.value);
            computeMovers.push(
              `<g class="wiki-anim-move"><path class="wiki-anim-route" d="${route}" fill="none" stroke="none"/><g class="wiki-anim-payload"><rect x="${round(x)}" y="${round(y)}" width="${L.sw}" height="${L.sh}" fill="${slot.dim ? SURFACE : slot.fresh ? COLOR.token : SOFT.token}" stroke="${COLOR.weight}" stroke-width="2.6"/><text x="${round(x + L.sw / 2)}" y="${round(y + L.sh / 2 + 4.6)}" font-family="${FONT}" font-size="13" font-weight="700" fill="${slot.fresh ? INVERSE : DEEP.token}" text-anchor="middle">${esc(v)}</text></g></g>`,
            );
          }
        }
      }
      if (step && !ex.waves) {
        // 同一对卡之间的块合成一条箭头，块排成一小条停在箭头上；两个方向都有就各让开一点
        const pairs = new Map<string, { a: number; c: number; moves: typeof step.moves }>();
        for (const m of step.moves) {
          if (m.from[0] >= L.n || m.to[0] >= L.n || m.from[0] === m.to[0]) continue;
          const key = `${m.from[0]}>${m.to[0]}`;
          const p = pairs.get(key) ?? { a: m.from[0], c: m.to[0], moves: [] };
          p.moves.push(m);
          pairs.set(key, p);
        }
        const movers: string[] = [];
        for (const { a, c, moves } of pairs.values()) {
          r.where = `${band} ${ex.cards[a]}→${ex.cards[c]}`;
          const fa = frameOf(a, by);
          const fc = frameOf(c, by);
          const A = [fa.x + L.cw / 2, fa.y + L.ch / 2] as const;
          const C = [fc.x + L.cw / 2, fc.y + L.ch / 2] as const;
          const len = Math.hypot(C[0] - A[0], C[1] - A[1]);
          const ux = (C[0] - A[0]) / len;
          const uy = (C[1] - A[1]) / len;
          const both = pairs.has(`${c}>${a}`);
          const px = both ? -uy * 12 : 0;
          const py = both ? ux * 12 : 0;
          const t0 = exit(ux, uy, px, py) + 6;
          const t1 = exit(-ux, -uy, px, py) + 9;
          const s0 = [A[0] + px + ux * t0, A[1] + py + uy * t0] as const;
          const s1 = [C[0] + px - ux * t1, C[1] + py - uy * t1] as const;
          r.parts.push(
            stroke(
              r,
              id,
              `M${round(s0[0])} ${round(s0[1])} L${round(s1[0])} ${round(s1[1])}`,
              "comm",
              false,
              "end",
            ),
          );
          r.points.push({ where: r.where, x: s0[0], y: s0[1] }, { where: r.where, x: s1[0], y: s1[1] });
          // 两头都有块时各靠自己的源端；斜线在中间交叉，再往源端挪一点，免得几条斜线上的块挤在交叉点
          const at = both ? (ux && uy ? 0.2 : 0.3) : 0.5;
          const P = [s0[0] + (s1[0] - s0[0]) * at, s0[1] + (s1[1] - s0[1]) * at];
          const sorted = [...moves].sort((m1, m2) => m1.from[1] - m2.from[1] || m1.to[1] - m2.to[1]);
          const vals = sorted.map((m) => num(state[m.from[0]]?.[m.from[1]]?.value ?? 0));
          const pw = Math.max(30, ...vals.map((v) => textWidth(v, 12) + 12));
          const ph = 22;
          // 多行张量（rows）时，来自源卡不同行的块之间留一道缝，路上也看得出是几行；一排时没有缝
          const rowGap = 8;
          const gapsBefore = sorted.map((_, j) =>
            L.gr > 1
              ? sorted
                  .slice(1, j + 1)
                  .filter((m, k) => Math.floor(m.from[1] / L.gc) !== Math.floor(sorted[k]!.from[1] / L.gc))
                  .length
              : 0,
          );
          const stripW = pw * sorted.length + rowGap * (gapsBefore.at(-1) ?? 0);
          const sx = P[0]! - stripW / 2;
          const sy = P[1]! - ph / 2;
          box(r, "路上的块", sx, sy, stripW, ph);
          for (const [j, m] of sorted.entries()) {
            const src = slotCenter(m.from[0], m.from[1], by);
            const dst = slotCenter(m.to[0], m.to[1], by);
            const route = [src, s0, s1, dst]
              .map(([x, y], k) => `${k ? "L" : "M"}${round(x)} ${round(y)}`)
              .join(" ");
            const bx = sx + j * pw + rowGap * gapsBefore[j]!;
            // 播放器沿 route 把块从源块移到目的块；静态图里块停在箭头上
            movers.push(
              `<g class="wiki-anim-move"><path class="wiki-anim-route" d="${route}" fill="none" stroke="none"/><g class="wiki-anim-payload"><rect x="${round(bx)}" y="${round(sy)}" width="${round(pw)}" height="${ph}" fill="${COLOR.comm}" stroke="${INK}" stroke-width="1.2"/><text x="${round(bx + pw / 2)}" y="${round(sy + 15.5)}" font-family="${FONT}" font-size="12" font-weight="700" fill="${INVERSE}" text-anchor="middle">${esc(vals[j]!)}</text></g></g>`,
            );
          }
        }
        r.parts.push(...movers);
      }
      if (plan) {
        // 逐张卡演：加号先画、路上的块后画；路线拐点和加号只查出界，加法列的块位还查会不会压到别的东西
        for (const [x, y] of plan.points) r.points.push({ where: `${band} 路线`, x, y });
        for (const col of plan.columns) {
          r.where = `${band} ${ex.cards[col.card]} 的加法列`;
          box(r, "加法列", col.x, col.y, L.sw, L.sh);
        }
        r.parts.push(...plan.cues, ...plan.movers);
      }
      r.parts.push(...computeMovers);
      r.parts.push("</g>");
    }
    r.where = base;
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
        const mono = s.font === "mono";
        const w = mono ? monoTextWidth(s.text, size) : textWidth(s.text, size);
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
          mono,
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
        return `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="8" fill="${SURFACE}" stroke="${COLOR[t]}" stroke-opacity="0.45" stroke-width="1.3"/>`;
      if (it.style === "faded")
        return `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="8" fill="${SURFACE}" stroke="${COLOR[t]}" stroke-opacity="0.45" stroke-width="1.3" stroke-dasharray="5 4"/>`;
      if (it.style === "plain")
        return `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="8" fill="${SOFT.control}" stroke="${FRAME}" stroke-width="1.4"/>`;
      return `<rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="8" fill="${SOFT[t]}" stroke="${COLOR[t]}" stroke-width="1.4"/>`;
    };
    // 身后叠着的几份：往右上错开，最远的先画
    for (let d = it.depth; d >= 1; d--) r.parts.push(rect(d * 7, -d * 7));
    r.parts.push(rect(0, 0));
    box(r, it.text ?? "物体", x, y - it.depth * 7, w + it.depth * 7, h + it.depth * 7);
    const fill = it.style === "faded" ? DEEP[t] : INK;
    const subFill = it.style === "faded" ? DEEP[t] : t === "ink" || t === "control" ? MUTED : DEEP[t];
    const weight = it.style === "faded" ? 400 : 700;
    const size = it.style === "faded" ? 13 : 14;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const mono = it.font === "mono";
    if (it.text && it.sub) {
      text(r, cx, cy - 4, it.text, { size, weight, fill, mono, anchor: "middle", ink: false });
      text(r, cx, cy + 15, it.sub, { size: 13, fill: subFill, mono, anchor: "middle", ink: false });
    } else if (it.text)
      text(r, cx, cy + 5, it.text, { size, weight, fill, mono, anchor: "middle", ink: false });
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
    const mono = t.font === "mono";
    const fontSize = Math.max(13, t.size);
    const rows = t.width ? wrap(t.text, fontSize, t.width, mono) : [t.text];
    for (const [k, line] of rows.entries())
      text(r, t.at[0], t.at[1] + k * fontSize * 1.6, line, {
        size: fontSize,
        weight: t.strong ? 700 : 400,
        fill,
        italic: t.note,
        mono,
        anchor: t.anchor,
      });
  }

  // ---- 小标签
  for (const [i, g] of spec.tags.entries()) {
    r.where = `tags[${i}]`;
    const w = textWidth(g.text, 13) + 24;
    const [x, y] = g.at;
    r.parts.push(
      `<rect x="${x}" y="${y}" width="${round(w)}" height="24" rx="12" fill="${SOFT[g.tone]}" stroke="${COLOR[g.tone]}" stroke-width="1.4"/>`,
    );
    text(r, x + w / 2, y + 17, g.text, {
      size: 13,
      weight: 700,
      fill: DEEP[g.tone],
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
    const measure = it.font === "mono" ? monoTextWidth : textWidth;
    for (const s of [it.text, it.sub]) {
      if (!s) continue;
      const need = measure(s, size);
      if (need > it.size[0] - 12)
        out.push(`items[${i}]：「${s}」约 ${Math.round(need)}px，框里放不下（只有 ${it.size[0] - 12}px）`);
    }
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

/**
 * 不阻塞的零件化提醒：移除段数、长句、代码标识符三类机械提醒，
 * 保留自由画板复杂度提醒（跨图复用由 sketchUsage 另行统计）。
 */
export function figureAdvisories(spec: FigureSpec): string[] {
  const out: string[] = [];
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
