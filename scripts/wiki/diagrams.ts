import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ID_RE } from "../../src/content/wiki/schema";
import { type FigureSpec, figureSpecSchema, renderFigure } from "./figure";
import { validateNativeSvg } from "./native-svg";
import { renderScene } from "./scene";

/**
 * 正文里的图：`wiki/diagrams/<id>.yaml` 是手写的真相源，`<id>.svg` 由本文件渲染。
 *
 * 只有一种版式（scene）：图元本身带语义，坐标手写，见 scene.ts 开头。
 * 2026-09-19 从 mermaid 换过来的理由有两条，缺一条都不值得换：
 * 1. 画面。mermaid 的版面由它自己排，调不动；这里每个方块的坐标都是手写的。
 * 2. 可读性。手画的 SVG 直接丢给 agent 读是个退步——箭头是 `<path d="M120 84 L260 84"/>`
 *    这样的坐标，agent 读得出方块上的字，说不准谁指向谁。所以真相源是 spec：
 *    nodes / edges 是显式的，语义不比 mermaid 弱，而 SVG 只是派生物。
 *
 * spec 里的 `source` + `symbols` 是 AC11 图符号来源检查的输入：symbols 必须在
 * source 指向的那个钉住 commit 的 blob 里真实存在，见 diagram-audit.ts。
 */

const point = z.tuple([z.number(), z.number()]);

/** 方块的语义配色。tone 表达「这是谁的代码」，不表达好看。 */
/**
 * 前五个是旧名字，按「谁的地盘」取色，留给存量图。
 * 后六个按「这是什么东西」取色，和全站设计令牌同一套（src/design：--color-token 等）：
 * token / 激活 = 青、权重 / 计算 = 琥珀、KV Cache / 显存 = 蓝、通信 = 紫、调度 = 灰、出错 = 红。
 * 新图只用后六个，同一种颜色在全库只表示同一种东西。
 */
export const TONES = [
  "upstream",
  "ascend",
  "accent",
  "neutral",
  "muted",
  "token",
  "weight",
  "kv",
  "comm",
  "control",
  "danger",
] as const;
export type Tone = (typeof TONES)[number];

/** 图标名。画在 24×24 格子里的极简线条，定义在 scene.ts。 */
export const ICONS = [
  "queue",
  "split",
  "grid",
  "pick",
  "slot",
  "chip",
  "plug",
  "patch",
  "proc",
  "file",
  "layers",
  "graph",
  "search",
  "diff",
  "clock",
  "calc",
  "gear",
  "bolt",
  "box",
  "text",
] as const;

/**
 * scene 版式：几何有语义的图。地盘 / 分层带 / 界线 / 时间轴 / 真实格子 / 卡片，
 * 位置和面积本身携带信息，每张图自己摆坐标，见 scene.ts 开头。
 */
export const sceneSpecSchema = z
  .object({
    layout: z.literal("scene"),
    id: z.string().regex(ID_RE),
    caption: z.string().min(1),
    size: point,
    /** 地盘：落在哪块地里就代表归谁 */
    regions: z
      .array(
        z
          .object({
            label: z.string().min(1),
            note: z.string().optional(),
            at: point,
            size: point,
            tone: z.enum(TONES),
            /** 名字胶囊摆哪儿；none = 只要底色不要名字 */
            chip: z.enum(["top", "bottom", "none"]).default("top"),
          })
          .strict(),
      )
      .default([]),
    /** 分层带：上下关系就是「谁在谁之上」 */
    bands: z
      .array(
        z
          .object({
            label: z.string().min(1),
            sub: z.string().optional(),
            /** 右端的等宽小胶囊，放这一层的代表函数 / 文件 */
            fn: z.string().optional(),
            /** 右端的普通说明，和 fn 二选一 */
            right: z.string().optional(),
            icon: z.enum(ICONS).optional(),
            at: point,
            size: point,
            tone: z.enum(TONES),
          })
          .strict(),
      )
      .default([]),
    /** 界线：跨过它就换了责任方 / 换了进程 */
    boundaries: z
      .array(
        z
          .object({
            /** 竖线是 x，横线是 y */
            at: z.number(),
            from: z.number(),
            to: z.number(),
            label: z.string().min(1),
            vertical: z.boolean().default(true),
          })
          .strict(),
      )
      .default([]),
    /** 时间轴。segments 在给定坐标处换色——换色点就是责任交接点 */
    spines: z
      .array(
        z
          .object({
            y: z.number(),
            from: z.number(),
            to: z.number(),
            tone: z.enum(TONES).default("muted"),
            segments: z.array(z.object({ x: z.number(), tone: z.enum(TONES) }).strict()).default([]),
            vertical: z.boolean().default(false),
            arrow: z.boolean().default(true),
          })
          .strict(),
      )
      .default([]),
    /** 轴上的站点。spine 指第几条轴 */
    stops: z
      .array(
        z
          .object({
            x: z.number(),
            spine: z.number().int().min(0).default(0),
            side: z.enum(["above", "below"]),
            title: z.string().min(1),
            detail: z.string().optional(),
            fn: z.string().optional(),
            icon: z.enum(ICONS).optional(),
            tone: z.enum(TONES),
          })
          .strict(),
      )
      .default([]),
    /** 一排真实格子：格子数就是真实数量 */
    strips: z
      .array(
        z
          .object({
            at: point,
            cells: z.number().int().min(1),
            cell: z.number().optional(),
            /** 格子高度，默认与宽相等。给了就是条形图：宽表示数量，高表示这排东西本身 */
            h: z.number().optional(),
            gap: z.number().optional(),
            highlight: z.number().int().optional(),
            highlights: z.array(z.number().int()).default([]),
            /** 故意盖在上一条格子上：底下那条是刻度，这条是填到哪儿。碰撞检查会跳过它 */
            overlay: z.boolean().default(false),
            /** 没选中的格子淡下去（不描边），让选中的那几格跳出来 */
            dim: z.boolean().default(false),
            /** 画一条淡虚线连到某个坐标，指明这排格子在讲哪一步 */
            linkTo: point.optional(),
            label: z.string().optional(),
            vertical: z.boolean().default(false),
            tone: z.enum(TONES),
          })
          .strict(),
      )
      .default([]),
    /** 卡片 */
    boxes: z
      .array(
        z
          .object({
            at: point,
            size: point,
            title: z.string().min(1),
            sub: z.string().optional(),
            fn: z.string().optional(),
            icon: z.enum(ICONS).optional(),
            tone: z.enum(TONES),
          })
          .strict(),
      )
      .default([]),
    arrows: z
      .array(
        z
          .object({
            from: point,
            to: point,
            via: z.array(point).default([]),
            label: z.string().optional(),
            style: z.enum(["solid", "dashed"]).default("solid"),
            tone: z.enum(TONES).default("muted"),
          })
          .strict(),
      )
      .default([]),
    /** 括号：圈住一段范围并给它一个名字 */
    brackets: z
      .array(
        z
          .object({
            at: point,
            span: z.number(),
            label: z.string().min(1),
            dir: z.enum(["down", "up", "left"]).default("down"),
            tone: z.enum(TONES).default("muted"),
          })
          .strict(),
      )
      .default([]),
    pills: z
      .array(z.object({ at: point, text: z.string().min(1), tone: z.enum(TONES) }).strict())
      .default([]),
    notes: z
      .array(
        z
          .object({
            at: point,
            text: z.string().min(1),
            size: z.number().optional(),
            width: z.number().optional(),
            strong: z.boolean().default(false),
            anchor: z.enum(["start", "middle", "end"]).optional(),
          })
          .strict(),
      )
      .default([]),
    pins: z
      .array(z.object({ source: z.string().min(1), symbols: z.array(z.string().min(1)).min(1) }).strict())
      .default([]),
  })
  .strict();

/**
 * 三种图规格契约：
 * - layout: scene（存量旧版式）与 layout: figure（确定性教学图版式）由 spec 渲染出 .svg；
 * - mode: native-svg 为人工编写同名 .svg 的伴生元数据契约，保留原 SVG 字节，共用严格 XML + 正向白名单 + AC11。
 */
export const nativeSvgSpecSchema = z
  .object({
    mode: z.literal("native-svg"),
    id: z.string().regex(ID_RE),
    caption: z.string().min(1),
    size: z.tuple([z.number().positive().max(900), z.number().positive()]),
    pins: z
      .array(z.object({ source: z.string().min(1), symbols: z.array(z.string().min(1)).min(1) }).strict())
      .default([]),
  })
  .strict();

const renderedDiagramSpecSchema = z.discriminatedUnion("layout", [sceneSpecSchema, figureSpecSchema]);

export type SceneSpec = z.infer<typeof sceneSpecSchema>;
export type NativeSvgSpec = z.infer<typeof nativeSvgSpecSchema>;
export type { FigureSpec };
export type RenderedDiagramSpec = SceneSpec | FigureSpec;
export type DiagramSpec = RenderedDiagramSpec | NativeSvgSpec;

export const diagramSpecSchema: z.ZodType<DiagramSpec, z.ZodTypeDef, unknown> = z
  .unknown()
  .superRefine((val, ctx) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val) && "mode" in val) {
      const r = nativeSvgSpecSchema.safeParse(val);
      if (!r.success) for (const issue of r.error.issues) ctx.addIssue(issue);
      return;
    }
    const r = renderedDiagramSpecSchema.safeParse(val);
    if (!r.success) for (const issue of r.error.issues) ctx.addIssue(issue);
  })
  .transform((val) =>
    val !== null && typeof val === "object" && !Array.isArray(val) && "mode" in val
      ? nativeSvgSpecSchema.parse(val)
      : renderedDiagramSpecSchema.parse(val),
  );

export function isNativeSvgSpec(spec: DiagramSpec): spec is NativeSvgSpec {
  return "mode" in spec && spec.mode === "native-svg";
}

export const DIAGRAM_DIR = "diagrams";

/** spec → SVG。纯函数、无随机、无时间戳；原生 SVG 由人工同名文件提供原字节，禁止伪装渲染覆盖。 */
export function renderDiagram(spec: DiagramSpec): string {
  if (isNativeSvgSpec(spec)) {
    throw new Error(
      `原生 SVG 图 ${spec.id}（mode: native-svg）由同名 .svg 提供原字节，不能调用 renderDiagram 生成`,
    );
  }
  return spec.layout === "figure" ? renderFigure(spec) : renderScene(spec);
}

/** 「这张图声明了哪些源码符号」的唯一出口，AC11 的检查只认它。 */
export function specPins(spec: DiagramSpec): { where: string; source?: string; symbols: string[] }[] {
  return spec.pins.map((pin, i) => ({ where: `pins[${i}]`, source: pin.source, symbols: pin.symbols }));
}

export interface DiagramProblem {
  file: string;
  rule: string;
  message: string;
}

export interface LoadedDiagram {
  id: string;
  spec: DiagramSpec;
  specFile: string;
  svgFile: string;
}

/** 读全部 spec。解析失败不抛异常——它要和页面问题一起汇报给 lint。 */
export function loadDiagrams(wikiRoot: string): {
  diagrams: Map<string, LoadedDiagram>;
  problems: DiagramProblem[];
} {
  const dir = join(wikiRoot, DIAGRAM_DIR);
  const diagrams = new Map<string, LoadedDiagram>();
  const problems: DiagramProblem[] = [];
  if (!existsSync(dir)) return { diagrams, problems };
  const entries = readdirSync(dir).sort();
  const yamlIds = new Set(entries.filter((n) => n.endsWith(".yaml")).map((n) => n.slice(0, -".yaml".length)));
  for (const name of entries) {
    if (name.endsWith(".svg")) {
      const svgId = name.slice(0, -".svg".length);
      if (!yamlIds.has(svgId)) {
        problems.push({
          file: `${DIAGRAM_DIR}/${name}`,
          rule: "diagram-spec",
          message: `SVG 缺少同名伴生元数据 ${DIAGRAM_DIR}/${svgId}.yaml`,
        });
      }
      continue;
    }
    if (!name.endsWith(".yaml")) continue;
    const id = name.slice(0, -".yaml".length);
    const specFile = `${DIAGRAM_DIR}/${name}`;
    const svgFile = `${DIAGRAM_DIR}/${id}.svg`;
    const parsed = diagramSpecSchema.safeParse(parseYaml(readFileSync(join(dir, name), "utf8")));
    if (!parsed.success) {
      problems.push({
        file: specFile,
        rule: "diagram-spec",
        message: parsed.error.issues.map((i) => `${i.path.join(".") || "(根)"}: ${i.message}`).join("；"),
      });
      continue;
    }
    if (parsed.data.id !== id) {
      problems.push({
        file: specFile,
        rule: "diagram-spec",
        message: `文件名 ${id} 与 spec 的 id ${parsed.data.id} 不一致`,
      });
      if (isNativeSvgSpec(parsed.data)) continue;
    }
    if (isNativeSvgSpec(parsed.data)) {
      const svgDiskPath = join(dir, `${id}.svg`);
      if (!existsSync(svgDiskPath)) {
        problems.push({
          file: specFile,
          rule: "diagram-missing",
          message: `原生 SVG 图缺少同名配套文件 ${svgFile}`,
        });
        continue;
      }
      const svgIssues = validateNativeSvg(readFileSync(svgDiskPath, "utf8"), parsed.data.size);
      if (svgIssues.length) {
        problems.push({
          file: svgFile,
          rule: "diagram-spec",
          message: svgIssues.join("；"),
        });
        continue;
      }
    }
    diagrams.set(id, {
      id,
      spec: parsed.data,
      specFile,
      svgFile,
    });
  }
  return { diagrams, problems };
}

/** 正文里 ```wiki-diagram 围栏声明的图 id，按出现顺序 */
export function diagramRefs(body: string): string[] {
  const out: string[] = [];
  for (const block of body.matchAll(/```wiki-diagram\r?\n([\s\S]*?)```/g)) {
    const file = /^\s*file:\s*(\S+)\s*$/m.exec(block[1] ?? "")?.[1];
    if (file) out.push(file.replace(/\.(ya?ml|svg)$/, ""));
  }
  return out;
}
