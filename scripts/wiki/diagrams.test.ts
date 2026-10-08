import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  diagramRefs,
  diagramSpecSchema,
  loadDiagrams,
  renderDiagram,
  sceneSpecSchema,
  specPins,
} from "./diagrams";
import { sceneCollisions, sceneOverflows } from "./scene";
import { wikiFixture } from "./test-fixture";

const SPEC = [
  "layout: scene",
  "id: demo",
  "caption: 演示",
  "size: [400, 200]",
  "regions:",
  "  - { label: vLLM, at: [0, 0], size: [200, 200], tone: upstream }",
  "boxes:",
  "  - { at: [20, 20], size: [160, 40], title: 入口, tone: neutral }",
  "pins:",
  "  - { source: r@abcdef0:a.py#L1-L9, symbols: [Scheduler] }",
  "",
].join("\n");

const SCENE = {
  layout: "scene" as const,
  id: "demo",
  caption: "一条请求横穿两块地盘",
  size: [900, 372] as [number, number],
  regions: [
    {
      label: "vLLM",
      note: "选择与分配",
      at: [20, 34] as [number, number],
      size: [500, 300] as [number, number],
      tone: "upstream" as const,
    },
  ],
  boundaries: [{ at: 520, from: 34, to: 334, label: "SchedulerOutput 交接" }],
  spines: [
    { y: 228, from: 20, to: 880, tone: "ascend" as const, segments: [{ x: 520, tone: "upstream" as const }] },
  ],
  stops: [
    { x: 150, side: "above" as const, title: "排队与抢占", fn: "EngineCore", tone: "upstream" as const },
    { x: 600, side: "below" as const, title: "选后端", fn: "get_attn_backend_cls", tone: "ascend" as const },
  ],
  strips: [
    {
      at: [355, 86] as [number, number],
      cells: 6,
      highlight: 2,
      label: "6 块",
      tone: "ascend" as const,
    },
  ],
  pills: [{ at: [62, 228] as [number, number], text: "请求", tone: "upstream" as const }],
  pins: [{ source: "vllm@abcdef0:a.py#L1-L9", symbols: ["Scheduler"] }],
};

it("spec 校验：图元名写错、tone 写错都要当场拒绝，不许悄悄画出一张少东西的图", () => {
  const unknownKey = diagramSpecSchema.safeParse({
    layout: "scene",
    id: "demo",
    caption: "c",
    size: [10, 10],
    node: [{ id: "a" }],
  });
  expect(unknownKey.success).toBe(false);
  expect(JSON.stringify(unknownKey.error?.issues)).toContain("node");

  const badTone = diagramSpecSchema.safeParse({
    layout: "scene",
    id: "demo",
    caption: "c",
    size: [10, 10],
    regions: [{ label: "A", at: [0, 0], size: [1, 1], tone: "rainbow" }],
  });
  expect(badTone.success).toBe(false);
});

it("renderDiagram 是确定性的，同一份 spec 两次渲染字节相同", () => {
  const spec = diagramSpecSchema.parse(SCENE);
  const svg = renderDiagram(spec);
  expect(svg).toBe(renderDiagram(spec));
  expect(svg).toContain("<title>一条请求横穿两块地盘</title>");
  expect(svg).toContain('viewBox="0 0 900 372"');
  expect(svg).toContain("get_attn_backend_cls");
  expect(svg).toContain("JetBrains Mono");
  expect(svg).not.toContain("<script");
});

it("几何有语义：地盘是有面积的底色，格子数就是真实数量", () => {
  const svg = renderDiagram(diagramSpecSchema.parse(SCENE));
  // 地盘：一整块底色，不是一个边框
  expect(svg).toContain('width="500" height="300"');
  // 六个格子就画六个，不是一个带「6」字的方块
  expect(svg.match(/<rect x="\d+(\.\d+)?" y="86"/g)?.length).toBe(6);
  // 界线是实打实一条虚线
  expect(svg).toContain('stroke-dasharray="7 5"');
});

it("时间轴在 segments 给的坐标处换色——换色点就是责任交接点，这条线本身携带信息", () => {
  const svg = renderDiagram(diagramSpecSchema.parse(SCENE));
  const spine = [...svg.matchAll(/<line x1="(\d+)" y1="228" x2="(\d+)" y2="228" stroke="([^"]+)"/g)];
  expect(spine.map((m) => [m[1], m[2]])).toEqual([
    ["20", "520"],
    ["520", "880"],
  ]);
  expect(spine[0]![3]).not.toBe(spine[1]![3]);
});

it("反引号一律去掉——漏出来会原样画在图上", () => {
  const svg = renderDiagram(
    diagramSpecSchema.parse({
      layout: "scene",
      id: "demo",
      caption: "c",
      size: [200, 100],
      notes: [{ at: [10, 10], text: "装完 `vllm-ascend` 就在了" }],
    }),
  );
  expect(svg).toContain("装完 vllm-ascend 就在了");
  expect(svg).not.toContain("`");
});

it("diagramRefs 从正文围栏里取出图 id", () => {
  const body = "文字\n\n```wiki-diagram\nfile: plugin-registration\n```\n\n```mermaid\nflowchart LR\n```\n";
  expect(diagramRefs(body)).toEqual(["plugin-registration"]);
  expect(diagramRefs("```wiki-diagram\nfile: repo-map.yaml\n```")).toEqual(["repo-map"]);
  expect(diagramRefs("没有围栏")).toEqual([]);
});

it("loadDiagrams 报不合法 spec 与文件名不一致，而不是抛异常", () => {
  const f = wikiFixture();
  try {
    mkdirSync(join(f.root, "wiki/diagrams"), { recursive: true });
    writeFileSync(join(f.root, "wiki/diagrams/demo.yaml"), SPEC);
    writeFileSync(join(f.root, "wiki/diagrams/broken.yaml"), "id: broken\ncaption: c\nsize: [1, 1]\n");
    writeFileSync(join(f.root, "wiki/diagrams/misnamed.yaml"), SPEC);
    const { diagrams, problems } = loadDiagrams(join(f.root, "wiki"));
    expect([...diagrams.keys()]).toEqual(["demo", "misnamed"]);
    expect(problems.map((p) => `${p.file} ${p.rule}`)).toEqual([
      "diagrams/broken.yaml diagram-spec",
      "diagrams/misnamed.yaml diagram-spec",
    ]);
    expect(problems[1]!.message).toContain("id demo 不一致");
  } finally {
    f.cleanup();
  }
});

it("specPins 是「这张图声明了哪些源码符号」的唯一出口", () => {
  expect(specPins(diagramSpecSchema.parse(SCENE))).toEqual([
    { where: "pins[0]", source: "vllm@abcdef0:a.py#L1-L9", symbols: ["Scheduler"] },
  ]);
  expect(specPins(diagramSpecSchema.parse({ layout: "scene", id: "d", caption: "c", size: [1, 1] }))).toEqual(
    [],
  );
});

it("sceneOverflows 抓住画到框外的字——渲染本身不会报错，所以要单独查", () => {
  const spec = (sub: string) =>
    sceneSpecSchema.parse({
      layout: "scene",
      id: "d",
      caption: "c",
      size: [400, 200],
      boxes: [{ at: [0, 0], size: [160, 50], title: "标题", sub, tone: "neutral" }],
    });
  expect(sceneOverflows(spec("短"))).toEqual([]);
  const tooLong = sceneOverflows(spec("这一句明显放不进一个一百六十像素宽的方块里"));
  expect(tooLong).toHaveLength(1);
  expect(tooLong[0]).toContain("boxes[0].sub");

  // 站点的字以 x 为中心往两边摊，贴着画布边就会伸出去
  const edge = sceneOverflows(
    sceneSpecSchema.parse({
      layout: "scene",
      id: "d",
      caption: "c",
      size: [400, 200],
      spines: [{ y: 100, from: 0, to: 400 }],
      stops: [{ x: 20, side: "above", title: "贴着左边的一个长标题", tone: "ascend" }],
    }),
  );
  expect(edge[0]).toContain("stops[0].title");
});

it("sceneCollisions 抓住压在一起的两块东西——engine-core-loop 就是这么糊掉的", () => {
  // 轴上站点朝上堆，地盘的标题胶囊在上面：轴压得越高，两者越容易撞在一起
  const spec = (axis: number) =>
    sceneSpecSchema.parse({
      layout: "scene",
      id: "d",
      caption: "c",
      size: [900, 470],
      regions: [{ label: "EngineCore 进程", at: [20, 40], size: [860, 382], tone: "upstream" }],
      spines: [{ y: axis, from: 66, to: 790, tone: "upstream" }],
      stops: [
        {
          x: 150,
          side: "above",
          title: "有活干吗",
          detail: "没有就阻塞在这里等",
          fn: "_process_input_queue",
          tone: "upstream",
        },
      ],
    });

  const hit = sceneCollisions(spec(196));
  expect(hit).toHaveLength(1);
  expect(hit[0]).toContain("regions[0]");
  expect(hit[0]).toContain("stops[0]");

  // 轴放到 250，站点朝上那一摞就落在地盘标题下面了
  expect(sceneCollisions(spec(250))).toEqual([]);
});

it("刻度条上的填充标了 overlay 就不算撞——它本来就该盖在上面", () => {
  const spec = (overlay: boolean) =>
    sceneSpecSchema.parse({
      layout: "scene",
      id: "d",
      caption: "c",
      size: [400, 100],
      strips: [
        { at: [20, 40], cells: 1, cell: 300, h: 22, tone: "muted" },
        { at: [20, 40], cells: 1, cell: 50, h: 22, overlay, tone: "neutral" },
      ],
    });

  expect(sceneCollisions(spec(false))).toHaveLength(1);
  expect(sceneCollisions(spec(true))).toEqual([]);
});
