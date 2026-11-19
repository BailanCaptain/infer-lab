import { expect, it } from "vitest";
import { parseFade, parseKeys, pointAt, shownAt } from "../../src/content/wiki/animTimeline";
import { diagramSpecSchema, renderDiagram } from "./diagrams";
import {
  exchangeStates,
  figureAdvisories,
  figureProblems,
  figureSpecSchema,
  renderFigure,
  resolveLinkGeometry,
  sketchUsage,
} from "./figure";

const BASE = { layout: "figure", id: "f", caption: "说明", size: [400, 200] } as const;

it("figure 版式和 scene 版式都能按 layout 解析，figure 走自己的渲染器", () => {
  const spec = diagramSpecSchema.parse({
    ...BASE,
    items: [{ at: [10, 10], size: [80, 40], text: "token", tone: "token" }],
    links: [{ from: [90, 30], to: [150, 30], tone: "comm" }],
  });
  expect("layout" in spec && spec.layout).toBe("figure");
  const svg = renderDiagram(spec);
  // 箭头的 marker 带图的 id 前缀：同一页内联好几张图时 id 不会撞
  expect(svg).toContain('id="f-ah-comm"');
  expect(svg).toContain("var(--color-token, #087f73)");
});

it("figure 只收语义色，旧的地盘色名进不来", () => {
  const bad = figureSpecSchema.safeParse({
    ...BASE,
    items: [{ at: [0, 0], size: [10, 10], tone: "ascend" }],
  });
  expect(bad.success).toBe(false);
});

it("估算的部分画成斜线填充，pattern 同样带图的 id 前缀", () => {
  const svg = renderDiagram(
    figureSpecSchema.parse({
      ...BASE,
      bars: [{ at: [10, 40], scale: 2, segments: [{ value: 50 }, { value: 10, style: "hatch" }] }],
    }),
  );
  expect(svg).toContain('<pattern id="f-hatch"');
  expect(svg).toContain('fill="url(#f-hatch)"');
});

it("两块墨压在一起、字出了画布、物体里的字放不下，都会报出来", () => {
  const problems = figureProblems(
    figureSpecSchema.parse({
      ...BASE,
      items: [
        { at: [10, 10], size: [100, 40], text: "甲" },
        { at: [60, 20], size: [100, 40], text: "乙" },
        { at: [200, 100], size: [40, 30], text: "这几个字放不进去" },
      ],
      texts: [{ at: [380, 180], text: "伸出画布外面去了" }],
    }),
  );
  expect(problems.some((p) => p.includes("items[0] 压住 items[1]"))).toBe(true);
  expect(problems.some((p) => p.includes("放不下"))).toBe(true);
  expect(problems.some((p) => p.includes("画布外"))).toBe(true);
});

it("步骤编号故意压在物体角上，不算压叠", () => {
  const problems = figureProblems(
    figureSpecSchema.parse({
      ...BASE,
      items: [{ at: [20, 20], size: [60, 60], text: "3" }],
      badges: [{ at: [20, 20], n: 3 }],
    }),
  );
  expect(problems).toEqual([]);
});

it("移除段数、长句、代码名三类机械提醒，保留自由画板复杂度提醒", () => {
  const advice = figureAdvisories(
    figureSpecSchema.parse({
      ...BASE,
      texts: [
        ...Array.from({ length: 9 }, (_, i) => ({ at: [0, i * 10], text: `第 ${i} 段` })),
        { at: [0, 190], text: "这是一整句很长很长的说明文字，图上空间足够时不再触发机械提醒" },
      ],
      items: [{ at: [100, 100], size: [200, 40], text: "select_moe_comm_method" }],
    }),
  );
  expect(advice).toEqual([]);

  const complexSketch = figureAdvisories(
    figureSpecSchema.parse({
      ...BASE,
      sketches: [
        {
          name: "复杂手绘",
          note: "超过 24 个形状仍提醒沉淀为零件",
          at: [10, 10],
          size: [200, 150],
          shapes: Array.from({ length: 25 }, (_, i) => ({
            kind: "circle" as const,
            at: [20 + (i % 5) * 20, 20 + Math.floor(i / 5) * 20] as [number, number],
            r: 4,
          })),
        },
      ],
    }),
  );
  expect(complexSketch).toHaveLength(1);
  expect(complexSketch[0]).toContain("手画了 25 个形状");
});

// ---- 2026-09-25 补齐的常见形状：每个零件至少证明「画得出来」和「画错了会报」

const fig = (extra: Record<string, unknown>, size: [number, number] = [600, 400]) =>
  figureSpecSchema.parse({ ...BASE, size, ...extra });

it("连接可以表达单向数据流、双向通路与无向关系，旧图默认保留单向箭头", () => {
  const link = { from: [30, 50], to: [200, 50], tone: "comm" };
  const one = renderFigure(fig({ links: [link] }));
  const both = renderFigure(fig({ links: [{ ...link, ends: "both" }] }));
  const none = renderFigure(fig({ links: [{ ...link, ends: "none" }] }));
  expect(one).toContain('marker-end="url(#f-ah-comm)"');
  expect(one).not.toContain("marker-start=");
  expect(both).toContain('marker-start="url(#f-ah-comm)"');
  expect(both).toContain('marker-end="url(#f-ah-comm)"');
  expect(none).not.toContain("marker-start=");
  expect(none).not.toContain("marker-end=");
  expect(
    figureProblems(fig({ links: [{ ...link, to: [700, 50], ends: "none" }] })).some((p) =>
      p.includes("出了画布"),
    ),
  ).toBe(true);
});

it("硬件、时间轴与驼峰代码标识符不再触发机械提醒", () => {
  expect(
    figureAdvisories(
      fig({
        hardware: [{ kind: "server", at: [30, 50], size: [320, 150], label: "select_moe_comm_method" }],
        timelines: [{ at: [20, 220], scale: 10, end: 10, lanes: [{ label: "execute_model" }] }],
        texts: [{ at: [20, 340], text: "isPrefill 为真时走预填充" }],
      }),
    ),
  ).toEqual([]);
});

it("硬件零件可以表达机柜内的服务器与芯片，同时检查边框碰撞和出界", () => {
  const hardware = [
    { kind: "rack", at: [20, 40], size: [400, 310], label: "机柜" },
    { kind: "server", at: [55, 100], size: [330, 190], label: "服务器" },
    { kind: "chip", at: [95, 160], size: [100, 80], label: "NPU" },
  ];
  expect(figureProblems(fig({ hardware }))).toEqual([]);
  expect(renderFigure(fig({ hardware }))).toContain(">NPU</text>");
  expect(
    figureProblems(
      fig({ hardware: [...hardware, { kind: "memory", at: [375, 150], size: [70, 55], label: "HBM" }] }),
    ).some((p) => p.includes("重叠")),
  ).toBe(true);
  expect(
    figureProblems(fig({ hardware: [{ ...hardware[0], at: [300, 40] }] })).some((p) => p.includes("画布外")),
  ).toBe(true);
});

it("硬件类型与端口数量有约束，文字转义并检查标签空间", () => {
  expect(
    figureSpecSchema.safeParse({
      ...BASE,
      hardware: [{ kind: "unknown", at: [20, 40], size: [100, 60], label: "x" }],
    }).success,
  ).toBe(false);
  const sw = { kind: "switch", at: [20, 40], size: [260, 80], label: "交换机 <A>", ports: 4 };
  const spec = fig({ hardware: [sw] });
  expect(figureProblems(spec)).toEqual([]);
  const svg = renderFigure(spec);
  expect(svg).toContain("交换机 &lt;A&gt;");
  expect(svg.match(/data-port=/g)).toHaveLength(4);
  expect(figureSpecSchema.safeParse({ ...BASE, hardware: [{ ...sw, ports: 0 }] }).success).toBe(false);
  expect(figureSpecSchema.safeParse({ ...BASE, hardware: [{ ...sw, ports: undefined }] }).success).toBe(
    false,
  );
  expect(
    figureProblems(fig({ hardware: [{ ...sw, size: [60, 50] }] })).some((p) => p.includes("放不下")),
  ).toBe(true);
});

it("多行格子：前 fill 格实色、格子里能写字；字放不下、格子坐标越界都会报", () => {
  const ok = fig({
    grids: [{ at: [60, 40], rows: 2, cols: 4, cell: [40, 30], fill: 5, cells: [{ at: [0, 0], text: "0" }] }],
  });
  const svg = renderFigure(ok);
  expect(svg.match(/fill="var\(--color-kv-soft, #e8edff\)"/g)?.length).toBe(5);
  expect(svg).toContain(">0</text>");
  expect(figureProblems(ok)).toEqual([]);

  const bad = fig({
    grids: [
      {
        at: [60, 40],
        rows: 2,
        cols: 4,
        cell: [40, 30],
        cells: [
          { at: [0, 1], text: "放不下的一长串字" },
          { at: [5, 0], text: "x" },
        ],
      },
    ],
  });
  const problems = figureProblems(bad);
  expect(problems.some((p) => p.includes("放不下"))).toBe(true);
  expect(problems.some((p) => p.includes("不在 2×4 的表里"))).toBe(true);
});

it("叠放的层：从上往下一层一条；名字连同右侧说明放不下会报", () => {
  const ok = fig({
    layers: [
      { at: [20, 20], width: 400, bands: [{ text: "上层" }, { text: "下层", sub: "说明", style: "solid" }] },
    ],
  });
  expect(figureProblems(ok)).toEqual([]);
  // 第二层：20 + 44 + 8
  expect(renderFigure(ok)).toContain('y="72"');
  const bad = fig({
    layers: [{ at: [20, 20], width: 120, bands: [{ text: "很长很长的一层名字", sub: "外加说明" }] }],
  });
  expect(figureProblems(bad).some((p) => p.includes("这一层只有 120px 宽"))).toBe(true);
});

it("分界线：两侧写名字；线头出了画布会报", () => {
  const ok = fig({ dividers: [{ from: [300, 20], to: [300, 380], sides: ["调度进程", "执行进程"] }] });
  const svg = renderFigure(ok);
  expect(svg).toContain("调度进程");
  expect(svg).toContain('stroke-dasharray="6 5"');
  expect(figureProblems(ok)).toEqual([]);
  const out = figureProblems(fig({ dividers: [{ from: [300, 20], to: [300, 460] }] }));
  expect(out.some((p) => p.includes("出了画布"))).toBe(true);
});

it("时间轴：几条泳道并排、最后一个刻度带单位；段不在轴上、段里的字放不下都会报", () => {
  const ok = fig({
    timelines: [
      {
        at: [20, 40],
        scale: 10,
        end: 40,
        unit: "ms",
        ticks: 10,
        lanes: [
          { label: "计算", spans: [{ from: 0, to: 30, text: "算" }] },
          { label: "通信", spans: [{ from: 10, to: 40, tone: "comm" }] },
        ],
        marks: [{ t: 30, label: "出结果" }],
      },
    ],
  });
  const svg = renderFigure(ok);
  expect(svg).toContain(">40 ms</text>");
  expect(svg).toContain(">出结果</text>");
  expect(figureProblems(ok)).toEqual([]);

  const bad = fig({
    timelines: [
      {
        at: [20, 40],
        scale: 10,
        end: 40,
        lanes: [
          {
            label: "计算",
            spans: [
              { from: 30, to: 50 },
              { from: 0, to: 2, text: "这段太短写不下" },
            ],
          },
        ],
      },
    ],
  });
  const problems = figureProblems(bad);
  expect(problems.some((p) => p.includes("不在时间轴 0–40 里"))).toBe(true);
  expect(problems.some((p) => p.includes("放不下"))).toBe(true);
});

it("坐标图：折线和分类柱子都能画，图下写数据出处；点不在坐标范围里会报；不写出处进不来", () => {
  const ok = fig({
    charts: [
      {
        at: [80, 40],
        size: [400, 240],
        x: { label: "并发请求数", categories: ["1", "8", "32"] },
        y: { label: "吞吐", min: 0, max: 100, ticks: [0, 50, 100] },
        series: [
          {
            kind: "bar",
            points: [
              [1, 20],
              [2, 60],
              [3, 90],
            ],
          },
          {
            kind: "line",
            tone: "kv",
            points: [
              [1, 30],
              [2, 50],
              [3, 70],
            ],
            label: "开了",
          },
        ],
        source: "某次实测",
      },
    ],
  });
  const svg = renderFigure(ok);
  expect(svg).toContain("数据：某次实测");
  expect(svg.match(/<circle [^>]*r="3.5"/g)?.length).toBe(3);
  expect(figureProblems(ok)).toEqual([]);

  const chart = {
    at: [80, 40],
    size: [400, 240],
    x: { label: "x", min: 0, max: 10 },
    y: { label: "y", min: 0, max: 1 },
    series: [{ points: [[5, 2]] }],
  };
  expect(
    figureProblems(fig({ charts: [{ ...chart, source: "某次实测" }] })).some((p) =>
      p.includes("不在坐标范围里"),
    ),
  ).toBe(true);
  expect(figureSpecSchema.safeParse({ ...BASE, charts: [chart] }).success).toBe(false);
});

it("节点图：环是 n 条单向边，两两互发是 n(n-1)/2 条双头边；两台设备互发各让开一点", () => {
  const ring = renderFigure(fig({ graphs: [{ at: [300, 200], r: 120, count: 4 }] }));
  expect(ring.match(/marker-end=/g)?.length).toBe(4);
  expect(ring).not.toContain("marker-start=");
  const all = renderFigure(fig({ graphs: [{ at: [300, 200], r: 120, count: 4, edges: "all" }] }));
  expect(all.match(/marker-start=/g)?.length).toBe(6);
  const pair = renderFigure(fig({ graphs: [{ at: [300, 200], r: 100, count: 2 }] }));
  // 只数边，不数 defs 里箭头头的那个 path
  const paths = pair.match(/<path d="M[^"]+" fill="none"/g) ?? [];
  expect(paths.length).toBe(2);
  expect(paths[0]).not.toBe(paths[1]);
  const bad = figureProblems(fig({ graphs: [{ at: [300, 200], r: 100, count: 3, edges: [[0, 5]] }] }));
  expect(bad.some((p) => p.includes("边 0→5 不成立"))).toBe(true);
});

it("公式：矩阵和运算符从左往右排、竖直居中；圈出的行列画成粗框，越界会报", () => {
  const spec = fig({
    equations: [
      {
        at: [20, 150],
        terms: [
          { w: 60, h: 80, cols: 3, rows: 4, tone: "token", mark: { row: 1 } },
          { op: "×" },
          { w: 40, h: 60, cols: 2, rows: 3 },
          { op: "=" },
          { w: 40, h: 80, cols: 2, rows: 4, tone: "kv", mark: { row: 1, col: 0 } },
        ],
      },
    ],
  });
  const svg = renderFigure(spec);
  // 第一块矩阵竖直居中：150 - 80/2 = 110
  expect(svg).toContain('<rect x="20" y="110" width="60" height="80"');
  expect(svg.match(/stroke-width="2.8"/g)?.length).toBe(2);
  expect(figureProblems(spec)).toEqual([]);
  const bad = fig({
    equations: [
      { at: [20, 150], terms: [{ w: 60, h: 80, rows: 2, mark: { row: 3 } }, { op: "=" }, { w: 60, h: 80 }] },
    ],
  });
  expect(figureProblems(bad).some((p) => p.includes("超出了"))).toBe(true);
});

it("热力图：最小值最淡、最大值最深；行长短不一、数超出给定色阶都会报", () => {
  const svg = renderFigure(
    fig({
      heatmaps: [
        {
          at: [60, 40],
          cell: [30, 30],
          values: [
            [0, 5],
            [10, 2],
          ],
          legend: ["少", "多"],
        },
      ],
    }),
  );
  expect(svg).toContain('fill-opacity="0.08"');
  expect(svg).toContain('fill-opacity="1"');
  expect(svg).toContain(">多</text>");
  const problems = figureProblems(
    fig({ heatmaps: [{ at: [60, 40], cell: [30, 30], values: [[0, 5], [10]], max: 8 }] }),
  );
  expect(problems.some((p) => p.includes("第 1 行有 1 个数"))).toBe(true);
  expect(problems.some((p) => p.includes("超出色阶"))).toBe(true);
});

it("自由画板：说明写进 desc；只收语义色和固定几种形状；画出画板、两段字压在一起都会报", () => {
  const ok = fig({
    sketches: [
      {
        name: "环形缓冲区",
        note: "一圈槽位，写指针追着读指针转",
        at: [100, 100],
        size: [200, 160],
        shapes: [
          { kind: "circle", at: [100, 80], r: 60, style: "outline", tone: "kv" },
          {
            kind: "curve",
            from: [40, 80],
            c1: [40, 20],
            c2: [160, 20],
            to: [160, 80],
            tone: "token",
            arrow: "end",
          },
          { kind: "text", at: [100, 150], text: "写到这里", anchor: "middle", size: "small" },
        ],
      },
    ],
  });
  const svg = renderFigure(ok);
  expect(svg).toContain("<desc>一圈槽位，写指针追着读指针转</desc>");
  expect(svg).toContain('marker-end="url(#f-ah-token)"');
  expect(figureProblems(ok)).toEqual([]);

  // 自己挑颜色、写任意 path 都进不来
  const board = { name: "x", note: "y", at: [0, 0], size: [100, 100] };
  const ownColor = { ...board, shapes: [{ kind: "rect", at: [0, 0], size: [5, 5], tone: "#ff0000" }] };
  expect(figureSpecSchema.safeParse({ ...BASE, sketches: [ownColor] }).success).toBe(false);
  const rawPath = { ...board, shapes: [{ kind: "path", d: "M0 0" }] };
  expect(figureSpecSchema.safeParse({ ...BASE, sketches: [rawPath] }).success).toBe(false);

  const problems = figureProblems(
    fig({
      sketches: [
        {
          ...board,
          at: [10, 10],
          shapes: [
            { kind: "rect", at: [50, 50], size: [80, 20] },
            { kind: "text", at: [10, 30], text: "甲乙丙" },
            { kind: "text", at: [14, 32], text: "丁戊己" },
          ],
        },
      ],
    }),
  );
  expect(problems.some((p) => p.includes("画出了自由画板"))).toBe(true);
  expect(problems.some((p) => p.includes("「甲乙丙」与「丁戊己」重叠"))).toBe(true);
});

it("同一种形状在 3 张图里手画，提醒升级成零件；2 张还不提醒", () => {
  const board = (id: string) =>
    fig({
      id,
      sketches: [
        {
          name: "环形缓冲区",
          note: "说明",
          at: [0, 0],
          size: [100, 100],
          shapes: [{ kind: "circle", at: [50, 50], r: 20 }],
        },
      ],
    });
  expect(sketchUsage([board("a"), board("b")]).promote).toEqual([]);
  const three = sketchUsage([board("a"), board("b"), board("c"), fig({})]);
  expect(three.total).toBe(3);
  expect(three.figures).toBe(3);
  expect(three.promote[0]).toContain("「环形缓冲区」已在 3 张图里手画");
});

it("物体身后叠几份：往右上错开，叠出来的部分也算墨", () => {
  const spec = fig({
    items: [{ at: [100, 100], size: [80, 50], text: "第 1 层", depth: 3 }],
    texts: [{ at: [185, 90], text: "旁注" }],
  });
  expect(renderFigure(spec).match(/rx="8"/g)?.length).toBe(4);
  expect(figureProblems(spec).some((p) => p.includes("items[0] 压住 texts[0]"))).toBe(true);
});

/** 4 张卡、每卡 4 块的 ring All-Reduce：前 3 步 Reduce-Scatter（add），后 3 步 All-Gather（copy） */
const RING = (() => {
  const next = (i: number) => (i + 1) % 4;
  const step = (op: "add" | "copy", chunk: (i: number) => number) => ({
    title: "一步",
    moves: [0, 1, 2, 3].map((i) => ({ from: [i, chunk(i)], to: [next(i), chunk(i)], op })),
  });
  return {
    at: [10, 10],
    cards: ["卡 0", "卡 1", "卡 2", "卡 3"],
    slots: 4,
    dots: true,
    start: [0, 1, 2, 3].map((c) => [1, 2, 3, 4].map((v) => v * 10 ** c)),
    steps: [
      ...[0, 1, 2].map((s) => step("add", (i) => (i - s + 4) % 4)),
      ...[0, 1, 2].map((s) => step("copy", (i) => (i + 1 - s + 4) % 4)),
    ],
    end: "结束",
  };
})();

it("集合通信分镜：按步骤算出每卡手里的块，ring 做完每卡都是各位置之和、加进了全部 4 张卡", () => {
  const spec = fig({ exchanges: [RING] }, [880, 2416]);
  const { states, problems } = exchangeStates(spec.exchanges[0]!);
  expect(problems).toEqual([]);
  expect(states).toHaveLength(7);
  // Reduce-Scatter 3 步后：卡 i 手里第 i+1 块加齐
  expect(states[3]![0]![1]).toMatchObject({ value: 2222, from: [0, 1, 2, 3] });
  expect(states[3]![3]![0]).toMatchObject({ value: 1111, from: [0, 1, 2, 3] });
  // 第 1 步只加了一次：卡 1 的第 0 块是 1 + 10
  expect(states[1]![1]![0]).toMatchObject({ value: 11, from: [0, 1], fresh: true });
  for (const row of states[6]!) expect(row.map((s) => s.value)).toEqual([1111, 2222, 3333, 4444]);
  expect(states[6]!.flat().every((s) => s.from.length === 4)).toBe(true);
});

it("集合通信分镜：同一步同时发生、keep 把其余块淡掉，收发不成立都会报", () => {
  const base = {
    at: [10, 10],
    cards: ["卡 0", "卡 1"],
    slots: 2,
    start: [
      [1, 2],
      [10, 20],
    ],
    end: "结束",
  };
  // 互相交换：两边都按这一步之前的值算，不会先换过去再换回来
  const swap = exchangeStates(
    fig({
      exchanges: [
        {
          ...base,
          steps: [
            {
              title: "换",
              moves: [
                { from: [0, 0], to: [1, 0] },
                { from: [1, 0], to: [0, 0] },
              ],
              keep: [[0, 0]],
            },
          ],
        },
      ],
    }).exchanges[0]!,
  );
  expect(swap.states[1]!.map((row) => row[0]!.value)).toEqual([10, 1]);
  expect(swap.states[1]![1]![1]!.dim).toBe(true);
  expect(swap.states[1]![0]![0]!.dim).toBe(false);
  const bad = exchangeStates(
    fig({
      exchanges: [
        {
          ...base,
          start: [
            [1, null],
            [10, 20],
          ],
          steps: [
            {
              title: "错",
              moves: [
                { from: [0, 0], to: [0, 1] },
                { from: [0, 1], to: [1, 1] },
                { from: [1, 0], to: [0, 1], op: "add" },
                { from: [0, 0], to: [1, 0] },
                { from: [0, 0], to: [1, 0] },
                { from: [0, 0], to: [3, 0] },
              ],
            },
          ],
        },
      ],
    }).exchanges[0]!,
  ).problems;
  expect(bad.some((p) => p.includes("自己发给自己"))).toBe(true);
  expect(bad.some((p) => p.includes("源块是空的"))).toBe(true);
  expect(bad.some((p) => p.includes("add 的目的块是空的"))).toBe(true);
  expect(bad.some((p) => p.includes("写了两次"))).toBe(true);
  expect(bad.some((p) => p.includes("越界"))).toBe(true);
});

it("集合通信分镜：一步一格，每格有裁切框和标题，要发的块带着从源块出发的路线", () => {
  const svg = renderFigure(fig({ exchanges: [RING] }, [880, 2416]));
  expect(svg.match(/class="wiki-anim-band"/g)).toHaveLength(7);
  expect(svg.match(/class="wiki-anim-box"/g)).toHaveLength(7);
  expect(svg.match(/class="wiki-anim-move"/g)).toHaveLength(24);
  // 第一格第一块从卡 0 第 0 块中心出发：卡框 x=10、左内边距 16、半块 26；卡框 y=10+36、标题下 32、半块 17
  expect(svg).toContain('class="wiki-anim-route" d="M52 95');
  expect(figureProblems(fig({ exchanges: [RING] }, [880, 2416]))).toEqual([]);
});

it("集合通信分镜不和别的零件同图，画不下也会报", () => {
  const mixed = figureProblems(
    fig({ exchanges: [RING], texts: [{ at: [10, 10], text: "标题" }] }, [880, 2416]),
  );
  expect(mixed.some((p) => p.includes("分镜图不能再放别的零件（texts）"))).toBe(true);
  const small = figureProblems(fig({ exchanges: [RING] }, [880, 600]));
  expect(small.some((p) => p.includes("画到了画布外"))).toBe(true);
});

/** EP 的派发与收回：两张卡、每卡一格一个 token；中间一步是本卡计算（sets），不通信 */
const EP_TWO = {
  at: [10, 10],
  cards: ["卡 0", "卡 1"],
  slots: 2,
  labels: ["甲", "乙"],
  start: [
    [2, null],
    [null, 5],
  ],
  steps: [
    {
      title: "派发",
      moves: [{ from: [0, 0], to: [1, 0] }],
      keep: [
        [1, 0],
        [1, 1],
      ],
    },
    {
      title: "本卡算",
      sets: [
        { at: [1, 0], value: 4 },
        { at: [1, 1], value: 10 },
        { at: [0, 0], value: 0 },
      ],
    },
    {
      title: "收回",
      moves: [{ from: [1, 0], to: [0, 0], op: "add" }],
      keep: [
        [0, 0],
        [1, 1],
      ],
    },
  ],
  end: "结束",
};

it("集合通信分镜：sets 是本卡计算，不通信也能占一格；换数、标成刚写入、保留来源", () => {
  const { states, problems } = exchangeStates(fig({ exchanges: [EP_TWO] }, [880, 1200]).exchanges[0]!);
  expect(problems).toEqual([]);
  expect(states).toHaveLength(4);
  // 派发后卡 0 的原块只是用过的输入，被淡掉
  expect(states[1]![0]![0]).toMatchObject({ value: 2, dim: true });
  // 本卡算：卡 1 两块换成新数，来源不变；卡 0 的原块清成 0 等着收结果
  expect(states[2]![1]![0]).toMatchObject({ value: 4, from: [0], fresh: true, dim: false });
  expect(states[2]![1]![1]).toMatchObject({ value: 10, from: [1], fresh: true });
  expect(states[2]![0]![0]).toMatchObject({ value: 0, fresh: true, dim: false });
  // 收回：加进原卡那一格
  expect(states[3]![0]![0]).toMatchObject({ value: 4, fresh: true });
  expect(states[3]![1]![0]!.dim).toBe(true);
});

it("集合通信分镜：本卡计算越界、同一块算两次、和收到的数撞车、整步空着都会报", () => {
  const bad = exchangeStates(
    fig({
      exchanges: [
        {
          ...EP_TWO,
          steps: [
            {
              title: "错",
              moves: [{ from: [0, 0], to: [1, 0] }],
              sets: [
                { at: [1, 0], value: 1 },
                { at: [0, 1], value: 1 },
                { at: [0, 1], value: 2 },
                { at: [5, 0], value: 1 },
              ],
            },
            { title: "空" },
          ],
        },
      ],
    }).exchanges[0]!,
  ).problems;
  expect(bad.some((p) => p.includes("同时收到别的卡发来的数"))).toBe(true);
  expect(bad.some((p) => p.includes("算了两次"))).toBe(true);
  expect(bad.some((p) => p.includes("越界"))).toBe(true);
  expect(bad.some((p) => p.includes("既没有收发也没有本卡计算"))).toBe(true);
});

it("集合通信分镜：labels 写在每块下面，本卡计算的块描权重色框，不通信的一格没有飞行的块", () => {
  const spec = fig({ exchanges: [EP_TWO] }, [880, 1200]);
  const svg = renderFigure(spec);
  expect(svg.match(/class="wiki-anim-band"/g)).toHaveLength(4);
  expect(svg.match(/class="wiki-anim-move"/g)).toHaveLength(2);
  expect(svg.match(/>甲</g)).toHaveLength(8);
  expect(svg).toContain('stroke="var(--color-weight, #c78300)" stroke-width="2.6"');
  expect(figureProblems(spec)).toEqual([]);
  const wrong = figureProblems(fig({ exchanges: [{ ...EP_TWO, labels: ["甲"] }] }, [880, 1200]));
  expect(wrong.some((p) => p.includes("labels 有 1 个"))).toBe(true);
});

/** EP 分镜的完整画法：卡里画专家、本卡计算写用哪个专家和短注、派发后原卡不参与的块清空、结果用 sum 送回 */
const EP_FULL = {
  at: [10, 10],
  cards: ["卡 0", "卡 1"],
  slots: 2,
  labels: ["甲", "乙"],
  experts: [["E0"], ["E1"]],
  start: [
    [2, null],
    [null, 5],
  ],
  steps: [
    { title: "派发", moves: [{ from: [0, 0], to: [1, 0] }], drop: [[0, 0]] },
    {
      title: "本卡算",
      sets: [
        { at: [1, 0], value: 3, expert: "E1", note: "×3 ×0.5" },
        { at: [1, 1], value: 10, expert: "E1", note: "×2" },
      ],
    },
    {
      title: "收回",
      moves: [{ from: [1, 0], to: [0, 0], op: "sum" }],
      keep: [
        [0, 0],
        [1, 1],
      ],
    },
  ],
  end: "结束",
};

it("集合通信分镜：drop 把块清空且不描计算框，sum 能落在空块上从 0 开始加、也能叠加", () => {
  const { states, problems } = exchangeStates(fig({ exchanges: [EP_FULL] }, [880, 1600]).exchanges[0]!);
  expect(problems).toEqual([]);
  // 派发后原卡那一格清空：不参与本卡计算
  expect(states[1]![0]![0]).toEqual({ value: null, from: [], dim: false, fresh: false });
  expect(states[1]![1]![0]).toMatchObject({ value: 2, fresh: true });
  // 空块上 sum 从 0 开始
  expect(states[3]![0]![0]).toMatchObject({ value: 3, fresh: true, from: [0] });
  // 两个 sum 落同一块叠加，落在有数的块上加进去
  const stack = exchangeStates(
    fig({
      exchanges: [
        {
          ...EP_TWO,
          start: [
            [1, 2],
            [10, null],
          ],
          steps: [
            {
              title: "叠",
              moves: [
                { from: [0, 0], to: [1, 1], op: "sum" },
                { from: [0, 1], to: [1, 1], op: "sum" },
                { from: [0, 0], to: [1, 0], op: "sum" },
              ],
            },
          ],
        },
      ],
    }).exchanges[0]!,
  );
  expect(stack.problems).toEqual([]);
  expect(stack.states[1]![1]!.map((s) => s.value)).toEqual([11, 3]);
  // null 的本卡计算就是把块置空
  const cleared = exchangeStates(
    fig({ exchanges: [{ ...EP_TWO, steps: [{ title: "空", sets: [{ at: [0, 0], value: null }] }] }] })
      .exchanges[0]!,
  );
  expect(cleared.states[1]![0]![0]).toMatchObject({ value: null, from: [], fresh: false });
});

it("集合通信分镜：专家名、drop、sum 用错都会报", () => {
  const bad = exchangeStates(
    fig({
      exchanges: [
        {
          ...EP_FULL,
          steps: [
            {
              title: "错",
              moves: [
                { from: [0, 0], to: [1, 0] },
                { from: [0, 0], to: [1, 1], op: "sum" },
                { from: [1, 1], to: [0, 1] },
              ],
              sets: [{ at: [0, 0], value: 1, expert: "E9" }],
              drop: [
                [1, 0],
                [4, 0],
              ],
            },
          ],
        },
      ],
    }).exchanges[0]!,
  ).problems;
  expect(bad.some((p) => p.includes("没有专家「E9」"))).toBe(true);
  expect(bad.some((p) => p.includes("不能同时清空"))).toBe(true);
  expect(bad.some((p) => p.includes("清空：卡号或块号越界"))).toBe(true);
  const rows = figureProblems(fig({ exchanges: [{ ...EP_FULL, experts: [["E0"]] }] }, [880, 1600]));
  expect(rows.some((p) => p.includes("experts 有 1 行"))).toBe(true);
});

it("集合通信分镜：卡里画专家框，本卡计算连线到专家、块飞进专家，短注只在那一格出现", () => {
  const spec = fig({ exchanges: [EP_FULL] }, [880, 1600]);
  const svg = renderFigure(spec);
  expect(figureProblems(spec)).toEqual([]);
  // 4 格 × 2 张卡，每张卡一个专家框
  expect(svg.match(/>E1</g)).toHaveLength(4);
  // 第 1 格一块跨卡飞，第 2 格两块飞进专家，第 3 格一块送回
  expect(svg.match(/class="wiki-anim-move"/g)).toHaveLength(4);
  expect(svg.match(/>×3 ×0\.5</g)).toHaveLength(1);
  // 块在专家框下方：卡框 y=10+36=46，专家框 46+32=78 到 102，块从 46+90=136 开始
  expect(svg).toContain('y="136"');
  // 清空的块不描计算框：第 1 格只有要发出的紫框，没有权重色粗框
  const band1 = svg.split('class="wiki-anim-band"')[1]!;
  expect(band1).not.toContain('stroke="var(--color-weight, #c78300)" stroke-width="2.6"');
});

it("集合通信分镜：labels 和 dots 同时开时各占一行，不重叠", () => {
  expect(figureProblems(fig({ exchanges: [{ ...EP_TWO, dots: true }] }, [880, 1300]))).toEqual([]);
});

it("集合通信分镜：同一块混用 add 和 sum 会单独报出来", () => {
  const mixed = exchangeStates(
    fig({
      exchanges: [
        {
          ...EP_TWO,
          start: [
            [1, 2],
            [10, null],
          ],
          steps: [
            {
              title: "混",
              moves: [
                { from: [0, 0], to: [1, 0], op: "add" },
                { from: [0, 1], to: [1, 0], op: "sum" },
              ],
            },
          ],
        },
      ],
    }).exchanges[0]!,
  ).problems;
  expect(mixed.some((p) => p.includes("混用了 add 和 sum"))).toBe(true);
});

it("集合通信分镜：连到别的专家的线走直角，块升到专家框下沿再横移；步骤短注只在那一格、画成淡色", () => {
  // 卡 1 的第 0 块交给右边的 E2：竖—横—竖三段；第 1 块就在 E2 正下方：一条竖线
  const spec = fig(
    {
      exchanges: [
        {
          ...EP_FULL,
          experts: [["E0"], ["E1", "E2"]],
          steps: [
            EP_FULL.steps[0],
            {
              title: "本卡算",
              sets: [
                { at: [1, 0], value: 3, expert: "E2", note: "×3" },
                { at: [1, 1], value: 10, expert: "E2", note: "×2" },
              ],
            },
            { ...EP_FULL.steps[2], notes: [{ at: [1, 1], text: "=5×2" }] },
          ],
        },
      ],
    },
    [880, 1600],
  );
  expect(figureProblems(spec)).toEqual([]);
  const svg = renderFigure(spec);
  expect(svg).toMatch(
    /<path d="M[\d.]+ [\d.]+ V[\d.]+ H[\d.]+ V[\d.]+" fill="none" stroke="var\(--color-weight/,
  );
  expect(svg).toMatch(/<path d="M[\d.]+ [\d.]+ V[\d.]+" fill="none" stroke="var\(--color-weight/);
  const band3 = svg.split('class="wiki-anim-band"')[3]!;
  expect(band3).toContain(">=5×2<");
  expect(svg.match(/>=5×2</g)).toHaveLength(1);
  // 两条短注撞在同一块、多行时还用专家框，都会报
  const clash = figureProblems(
    fig(
      {
        exchanges: [
          {
            ...EP_FULL,
            steps: [
              EP_FULL.steps[0],
              { ...EP_FULL.steps[1], notes: [{ at: [1, 0], text: "重复" }] },
              EP_FULL.steps[2],
            ],
          },
        ],
      },
      [880, 1600],
    ),
  );
  expect(clash.some((p) => p.includes("有两条短注"))).toBe(true);
  const rows = figureProblems(
    fig({ exchanges: [{ ...EP_FULL, labels: undefined, slots: 2, rows: 2 }] }, [880, 1600]),
  );
  expect(rows.some((p) => p.includes("不能再用 experts 和短注"))).toBe(true);
});

/** SP 的 Reduce-Scatter：两张卡、每卡一个 2 行 × 2 列的张量（一行一个 token），按行交换 */
const SP_TWO = {
  at: [10, 10],
  cards: ["卡 0", "卡 1"],
  slots: 4,
  rows: 2,
  rowLabels: ["token 0", "token 1"],
  gap: [200, 96],
  start: [
    [1, 3, 3, 1],
    [0, 4, 4, 0],
  ],
  steps: [
    {
      title: "按行归约",
      moves: [
        { from: [1, 0], to: [0, 0], op: "add" },
        { from: [1, 1], to: [0, 1], op: "add" },
        { from: [0, 2], to: [1, 2], op: "add" },
        { from: [0, 3], to: [1, 3], op: "add" },
      ],
      keep: [
        [0, 0],
        [0, 1],
        [1, 2],
        [1, 3],
      ],
    },
  ],
  end: "结束",
};

it("集合通信分镜：rows 把一张卡的块排成多行格子，行名写在左边，收发仍按块号算", () => {
  const spec = fig({ exchanges: [SP_TWO] }, [880, 600]);
  const { states, problems } = exchangeStates(spec.exchanges[0]!);
  expect(problems).toEqual([]);
  expect(states[1]![0]!.slice(0, 2).map((s) => s.value)).toEqual([1, 7]);
  expect(states[1]![1]!.slice(2).map((s) => s.value)).toEqual([7, 1]);
  const svg = renderFigure(spec);
  // 两格 × 两张卡，每张卡两个行名；多行时格子线里有横线
  expect(svg.match(/>token 0</g)).toHaveLength(4);
  expect(svg).toMatch(/M\d+(\.\d+)? \d+(\.\d+)?h104/);
  expect(figureProblems(spec)).toEqual([]);
  // 不给 rows 时和一排的画法一样：不出现横向格子线
  expect(renderFigure(fig({ exchanges: [EP_TWO] }, [880, 1200]))).not.toMatch(/M\d+(\.\d+)? \d+(\.\d+)?h\d+/);
  const bad = figureProblems(
    fig({ exchanges: [{ ...SP_TWO, rows: 3, rowLabels: ["甲"], dots: true }] }, [880, 600]),
  );
  expect(bad.some((p) => p.includes("排不成 3 行"))).toBe(true);
  expect(bad.some((p) => p.includes("不能再用 dots 和 labels"))).toBe(true);
  expect(bad.some((p) => p.includes("rowLabels 有 1 个"))).toBe(true);
});

it("集合通信分镜：不给 rows 时卡框和块的坐标与一排的画法一致（锁住 EP_TWO 的关键坐标）", () => {
  const svg = renderFigure(fig({ exchanges: [EP_TWO] }, [880, 1200]));
  // 卡框：宽 32 + 2 × 52 = 136，高 32 + 34 + 16（labels）+ 14 = 96；第 1 格卡 0 在 (10, 46)，卡 1 右移 136 + 150
  expect(svg).toContain('<rect x="10" y="46" width="136" height="96" rx="16"');
  expect(svg).toContain('<rect x="296" y="46" width="136" height="96" rx="16"');
  // 第 0 块：卡框左边 + 16、顶边 + 32
  expect(svg).toMatch(/<rect x="26" y="78" width="52" height="34" fill="[^"]+"\/>/);
});

it("集合通信分镜：rows 时路上的块按源卡的行分组，组间留缝；一排时不留缝；一排最多 8 块", () => {
  const twoRows = {
    ...SP_TWO,
    steps: [
      {
        title: "两行一起发",
        moves: [0, 1, 2, 3].map((s) => ({ from: [1, s], to: [0, s], op: "add" })),
      },
    ],
  };
  const xs = (svg: string) =>
    [...svg.matchAll(/<g class="wiki-anim-payload"><rect x="([\d.]+)"/g)].map((m) => Number(m[1]));
  const rowsX = xs(renderFigure(fig({ exchanges: [twoRows] }, [880, 600])));
  expect(rowsX).toHaveLength(4);
  // 同一行相邻两块挨着（30），跨行多一道 8 的缝
  expect(rowsX[1]! - rowsX[0]!).toBeCloseTo(30);
  expect(rowsX[2]! - rowsX[1]!).toBeCloseTo(38);
  expect(rowsX[3]! - rowsX[2]!).toBeCloseTo(30);
  const flat = xs(
    renderFigure(fig({ exchanges: [{ ...twoRows, rows: undefined, rowLabels: undefined }] }, [880, 600])),
  );
  expect(flat[2]! - flat[1]!).toBeCloseTo(30);
  const wide = figureProblems(
    fig(
      {
        exchanges: [{ ...EP_TWO, slots: 9, labels: undefined, start: [Array(9).fill(1), Array(9).fill(1)] }],
      },
      [880, 1200],
    ),
  );
  expect(wide.some((p) => p.includes("一排最多 8 块"))).toBe(true);
});

/**
 * 逐张卡演（waves）的 All-Reduce：第 1 步第 k 块都送到卡 k 加起来（add），第 2 步卡 k 把和发给其余每张卡（copy）。
 * 卡框 240×80（32 + 4 × 52，标题 32 + 块 34 + 底 14），两排之间留 156 放加法列（离自己的卡 8、离对面 22）；一格高 36 + 80 + 156 + 80 + 24 = 376
 */
const AR_WAVES = {
  at: [10, 10],
  cards: ["卡 0", "卡 1", "卡 2", "卡 3"],
  slots: 4,
  gap: [190, 156],
  waves: true,
  start: [0, 1, 2, 3].map((c) => [1, 2, 3, 4].map((v) => v * 10 ** c)),
  steps: [
    {
      title: "归约",
      moves: [0, 1, 2, 3].flatMap((k) =>
        [0, 1, 2, 3].filter((c) => c !== k).map((c) => ({ from: [c, k], to: [k, k], op: "add" })),
      ),
      keep: [
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
      ],
    },
    {
      title: "收集",
      moves: [0, 1, 2, 3].flatMap((k) =>
        [0, 1, 2, 3].filter((c) => c !== k).map((c) => ({ from: [k, k], to: [c, k] })),
      ),
    },
  ],
  end: "结束",
};
const AR_SIZE: [number, number] = [880, 1138];

/** 从一格的 SVG 里读出路上的块：路线、关键帧、出现 / 消失的时刻、块的大小 */
function waveMovers(band: string) {
  return [
    ...band.matchAll(
      /<g class="wiki-anim-move"([^>]*)><path class="wiki-anim-route" d="([^"]+)"[^>]*\/><g class="wiki-anim-payload"><rect x="[\d.-]+" y="[\d.-]+" width="([\d.]+)" height="([\d.]+)"/g,
    ),
  ].map((m) => {
    const attr = (name: string) => new RegExp(`${name}="([^"]+)"`).exec(m[1]!)?.[1] ?? null;
    const points = [...m[2]!.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map((p) => ({
      x: Number(p[1]),
      y: Number(p[2]),
    }));
    const num = (s: string | null) => (s === null ? null : Number(s));
    return {
      points,
      keys: parseKeys(attr("data-keys"), points.length),
      show: num(attr("data-show")),
      hide: num(attr("data-hide")),
      fade: parseFade(attr("data-fade")),
      w: Number(m[3]),
      h: Number(m[4]),
    };
  });
}

it("逐张卡演：不画箭头；路上的块平时藏在源块上，路线从源块中心出发；下排的卡块朝上、名字写在下面", () => {
  const spec = fig({ exchanges: [AR_WAVES] }, AR_SIZE);
  expect(figureProblems(spec)).toEqual([]);
  const svg = renderFigure(spec);
  expect(svg).not.toContain("marker-end");
  expect(svg.match(/class="wiki-anim-move"/g)).toHaveLength(24);
  const bands = svg.split('<g class="wiki-anim-band"').slice(1);
  expect(bands).toHaveLength(3);
  // 有收发的格写明整段播放多长；每块都有关键帧、出现时刻，静止时看不见
  for (const b of bands.slice(0, 2)) {
    expect(b).toMatch(/^ data-ms="\d+"/);
    for (const m of waveMovers(b)) {
      expect(m.keys).not.toBeNull();
      expect(m.show).not.toBeNull();
    }
    expect(b.match(/class="wiki-anim-move"[^>]*opacity="0"/g)).toHaveLength(12);
  }
  // 卡 1 第 0 块：卡框 x = 10 + 240 + 190，左内边距 16、半块 26；上排块在标题下 32
  expect(bands[0]).toContain('class="wiki-anim-route" d="M482 95');
  // 卡 3（下排左）第 0 块：下排卡顶 = 10 + 36 + 80 + 156 = 282，块在卡顶下 14；名字写在块下面，基线在卡底上 10
  expect(bands[0]).toContain('class="wiki-anim-route" d="M52 313');
  expect(bands[0]).toMatch(/<text x="26" y="352"[^>]*>卡 3</);
});

it("逐张卡演：加法步按目的卡一批一批演，发来的块排在目的块旁边、左边出现加号，再并进目的块，目的块上出现和", () => {
  const svg = renderFigure(fig({ exchanges: [AR_WAVES] }, AR_SIZE));
  const [rs, ag, end] = svg.split('<g class="wiki-anim-band"').slice(1);
  // 12 个加号全在第 1 格；收集那一格不加，没有加号
  expect(rs!.match(/>\+<\/text>/g)).toHaveLength(12);
  expect(ag).not.toContain(">+</text>");
  // 四个和作为「出现」的提示画在第 1 格里
  for (const v of ["1111", "2222", "3333", "4444"])
    expect(rs).toMatch(
      new RegExp(`<g class="wiki-anim-cue" data-show="[0-9.]+" opacity="0"><rect[^>]*/><text[^>]*>${v}<`),
    );
  // 一批只有一张目的卡：4 批 4 个出发时刻，前一批并完（块消失）才开始下一批
  const movers = waveMovers(rs!);
  const shows = [...new Set(movers.map((m) => m.show!))].sort((a, b) => a - b);
  expect(shows).toHaveLength(4);
  for (let i = 0; i + 1 < shows.length; i++) {
    const hides = movers.filter((m) => m.show === shows[i]).map((m) => m.hide!);
    expect(Math.max(...hides)).toBeLessThanOrEqual(shows[i + 1]!);
  }
  // 并进目的块的那一段（最后一段）边走边淡掉，不在目的块上摞成一叠
  for (const m of movers) expect(m.fade).toEqual([m.keys!.at(-2), m.keys!.at(-1)]);
  // 加出来的和是青色实心；收集时收到的副本不是新算出来的，保持浅青
  const solid = (b: string) =>
    b.match(/width="52" height="34" fill="var\(--color-token, #087f73\)"\/>/g)?.length ?? 0;
  expect(solid(ag!)).toBe(4);
  expect(solid(end!)).toBe(0);
});

it("逐张卡演：路上的块任何时刻都不互相压住，也不从别的块上划过（并成一块、分出一份的那一下除外）", () => {
  const svg = renderFigure(fig({ exchanges: [AR_WAVES] }, AR_SIZE));
  const bands = svg.split('<g class="wiki-anim-band"').slice(1, 3);
  const overlap = (a: number[], b: number[]) =>
    Math.min(a[0]! + a[2]!, b[0]! + b[2]!) - Math.max(a[0]!, b[0]!) > 1 &&
    Math.min(a[1]! + a[3]!, b[1]! + b[3]!) - Math.max(a[1]!, b[1]!) > 1;
  const near = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    Math.abs(p.x - q.x) < 1 && Math.abs(p.y - q.y) < 1;
  for (const [b, band] of bands.entries()) {
    const by = 10 + b * 376;
    // 每格 16 个块位：上排块在卡顶 + 32，下排在卡顶 + 14
    const slots = [0, 1, 2, 3].flatMap((c) => {
      const row = c < 2 ? 0 : 1;
      const col = c === 0 || c === 3 ? 0 : 1;
      const fx = 10 + col * 430;
      const top = by + 36 + row * 236 + (row ? 14 : 32);
      return [0, 1, 2, 3].map((s) => [fx + 16 + s * 52, top, 52, 34]);
    });
    const movers = waveMovers(band);
    const failures: string[] = [];
    for (let i = 0; i <= 600; i++) {
      const u = i / 600;
      const live = movers
        .filter((m) => shownAt(m.show, m.hide, u))
        .map((m) => {
          const p = pointAt(m.points, m.keys!, u);
          return { m, p, box: [p.x - m.w / 2, p.y - m.h / 2, m.w, m.h] };
        });
      for (const a of live) {
        const first = a.m.points[0]!;
        const last = a.m.points.at(-1)!;
        for (const s of slots) {
          const c = { x: s[0]! + 26, y: s[1]! + 17 };
          if (near(c, first) || near(c, last)) continue;
          if (overlap(a.box, s))
            failures.push(`u=${u.toFixed(3)} 块从 (${first.x},${first.y}) 出发，划过块位 (${c.x},${c.y})`);
        }
      }
      for (let x = 0; x < live.length; x++)
        for (let y = x + 1; y < live.length; y++) {
          const A = live[x]!;
          const B = live[y]!;
          if (!overlap(A.box, B.box)) continue;
          // 并成一块：两块都在最后一段、奔向同一个目的块
          const inLast = (m: typeof A.m) => u >= (m.keys!.at(-2) ?? 1);
          if (near(A.m.points.at(-1)!, B.m.points.at(-1)!) && inLast(A.m) && inLast(B.m)) continue;
          // 分出一份：刚出现不久，出现那一刻正好在另一块所在的位置，而且另一块从那时起一直停着没动
          // （副本从停住的主干下面横着滑出去；主干边走边分叉会摞成一道台阶）
          const split = (P: typeof A, Q: typeof A) => {
            if (P.m.show === null || u - P.m.show >= 0.04) return false;
            const at = pointAt(Q.m.points, Q.m.keys!, P.m.show);
            return near(at, P.m.points[0]!) && near(Q.p, at);
          };
          if (split(A, B) || split(B, A)) continue;
          failures.push(
            `u=${u.toFixed(3)} (${A.p.x.toFixed(0)},${A.p.y.toFixed(0)}) 压住 (${B.p.x.toFixed(0)},${B.p.y.toFixed(0)})`,
          );
        }
    }
    expect([...new Set(failures)].slice(0, 5)).toEqual([]);
  }
});

it("逐张卡演：只支持两排各两张卡，两排之间要放得下加法列；不开时画法不变", () => {
  const low = figureProblems(fig({ exchanges: [{ ...AR_WAVES, gap: [190, 96] }] }, AR_SIZE));
  expect(low.some((p) => p.includes("放不下加法列"))).toBe(true);
  const two = figureProblems(
    fig(
      {
        exchanges: [
          {
            ...AR_WAVES,
            cards: ["卡 0", "卡 1"],
            start: AR_WAVES.start.slice(0, 2),
            steps: [{ title: "发", moves: [{ from: [0, 1], to: [1, 1], op: "add" }] }],
          },
        ],
      },
      AR_SIZE,
    ),
  );
  expect(two.some((p) => p.includes("逐张卡演只支持"))).toBe(true);
  // 不开 waves：照旧画箭头，块停在箭头上
  expect(renderFigure(fig({ exchanges: [RING] }, [880, 2416]))).toContain("marker-end");
});

it("links.bend：正负对称弧线、箭头切向与画布采样共用同一几何定义，0 退化直线，零长度与冲突字段明确拦截", () => {
  const posSpec = fig({ links: [{ from: [100, 100], to: [400, 100], bend: 45, ends: "both" }] });
  const negSpec = fig({ links: [{ from: [100, 100], to: [400, 100], bend: -45, ends: "both" }] });
  const zeroSpec = fig({ links: [{ from: [100, 100], to: [400, 100], bend: 0 }] });
  const plainSpec = fig({ links: [{ from: [100, 100], to: [400, 100] }] });

  const posGeo = resolveLinkGeometry(posSpec.links[0]!);
  const negGeo = resolveLinkGeometry(negSpec.links[0]!);
  const zeroGeo = resolveLinkGeometry(zeroSpec.links[0]!);

  expect(posGeo.kind).toBe("cubic");
  expect(negGeo.kind).toBe("cubic");
  expect(zeroGeo.kind).toBe("polyline");
  expect(renderFigure(zeroSpec)).toBe(renderFigure(plainSpec));

  // 中点峰值精确偏移 ±45px，正负沿弦轴镜像对称，起止切向与 SVG auto-start-reverse 一致
  const posMid = posGeo.samples[Math.floor(posGeo.samples.length / 2)]!;
  const negMid = negGeo.samples[Math.floor(negGeo.samples.length / 2)]!;
  expect(posMid[0]).toBeCloseTo(250, 1);
  expect(posMid[1]).toBeCloseTo(145, 1);
  expect(negMid[0]).toBeCloseTo(250, 1);
  expect(negMid[1]).toBeCloseTo(55, 1);
  expect(posGeo.startTangent[1]).toBeGreaterThan(0);
  expect(posGeo.endTangent[1]).toBeLessThan(0);
  expect(negGeo.startTangent[1]).toBeLessThan(0);
  expect(negGeo.endTangent[1]).toBeGreaterThan(0);
  expect(renderFigure(posSpec)).toContain(`d="${posGeo.pathD}"`);

  // 反向同正 bend 自动向各自右手侧让开，形成不重叠的双向环
  const revSpec = fig({ links: [{ from: [400, 100], to: [100, 100], bend: 45 }] });
  const revMid = resolveLinkGeometry(revSpec.links[0]!).samples[8]!;
  expect(revMid[1]).toBeCloseTo(55, 1);

  // 端点在画布内但弧顶越过画布上沿时，采样与渲染同源并准确报出界
  const arcOverflow = figureProblems(fig({ links: [{ from: [100, 30], to: [400, 30], bend: -45 }] }));
  expect(arcOverflow.some((p) => p.includes("links[0]") && p.includes("出了画布"))).toBe(true);

  // 零长度连线（含 bend 非零与直线）：绝不产出 NaN，且在 figureProblems 报错拦截
  const zeroLenBend = fig({ links: [{ from: [120, 120], to: [120, 120], bend: 30 }] });
  expect(renderFigure(zeroLenBend)).not.toContain("NaN");
  expect(figureProblems(zeroLenBend).some((p) => p.includes("links[0]"))).toBe(true);
  const zeroLenLine = fig({ links: [{ from: [120, 120], to: [120, 120] }] });
  expect(figureProblems(zeroLenLine).some((p) => p.includes("links[0]"))).toBe(true);

  // 冲突字段组合（bend+curve、bend+via、curve+via）在 schema 层当场拒绝；旧 curve / via 单独保留兼容
  expect(
    figureSpecSchema.safeParse({
      ...BASE,
      links: [
        {
          from: [0, 0],
          to: [100, 0],
          bend: 20,
          curve: [
            [30, 20],
            [70, 20],
          ],
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    figureSpecSchema.safeParse({
      ...BASE,
      links: [{ from: [0, 0], to: [100, 0], bend: 20, via: [[50, 10]] }],
    }).success,
  ).toBe(false);
  expect(
    figureSpecSchema.safeParse({
      ...BASE,
      links: [
        {
          from: [0, 0],
          to: [100, 0],
          curve: [
            [30, 20],
            [70, 20],
          ],
          via: [[50, 10]],
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    figureSpecSchema.safeParse({
      ...BASE,
      links: [
        {
          from: [20, 40],
          to: [180, 40],
          curve: [
            [60, 10],
            [140, 10],
          ],
        },
      ],
    }).success,
  ).toBe(true);
});

it("显式等宽文本（font: mono）：SVG 字体与碰撞/框宽/断行估宽一致，默认旧图行为不变", () => {
  const expr = "a = b + c * (d - e)"; // 19 个 ASCII 字符（含空格与运算符）：比例字约 117.6px，14px 等宽字精确 159.6px
  const sansSpec = fig({
    texts: [
      { at: [20, 60], text: expr, size: 14 },
      { at: [155, 60], text: "右侧标签", size: 14 },
    ],
    items: [{ at: [20, 120], size: [145, 40], text: expr }],
  });
  const monoSpec = fig({
    texts: [
      { at: [20, 60], text: expr, size: 14, font: "mono" },
      { at: [155, 60], text: "右侧标签", size: 14 },
    ],
    items: [{ at: [20, 120], size: [145, 40], text: expr, font: "mono" }],
  });

  const sansSvg = renderFigure(sansSpec);
  const monoSvg = renderFigure(monoSpec);
  expect(sansSvg).not.toContain("JetBrains Mono");
  expect(monoSvg).toContain("font-family=\"'JetBrains Mono',ui-monospace,monospace\"");
  expect(figureProblems(sansSpec)).toEqual([]);

  const monoProblems = figureProblems(monoSpec);
  expect(monoProblems.some((p) => p.includes("texts[0] 压住 texts[1]"))).toBe(true);
  expect(monoProblems.some((p) => p.includes("items[0]") && p.includes("放不下"))).toBe(true);

  const wrappedMono = renderFigure(
    fig({
      texts: [{ at: [20, 60], text: "step_0 = a + b + c + d", size: 14, width: 110, font: "mono" }],
    }),
  );
  expect(wrappedMono.match(/font-family="'JetBrains Mono',ui-monospace,monospace"/g)?.length).toBeGreaterThan(
    1,
  );
});

it("figure 块默认使用柔和矿物浅底、1.4px 同色描边、深墨字色，并将标签字号抬升至至少 13px", () => {
  const svg = renderFigure(
    fig({
      items: [{ at: [20, 20], size: [140, 44], text: "核心块", tone: "token" }],
      texts: [{ at: [20, 120], text: "小字标签", size: 11 }],
    }),
  );
  expect(svg).toContain(
    'fill="var(--color-token-soft, #ddf4ef)" stroke="var(--color-token, #087f73)" stroke-width="1.4"',
  );
  expect(svg).toContain('fill="var(--color-ink, #17211f)" text-anchor="middle">核心块</text>');
  expect(svg).toContain('font-size="13"');
  expect(svg).not.toContain('font-size="11"');
});
