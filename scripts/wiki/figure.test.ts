import { expect, it } from "vitest";
import { diagramSpecSchema, renderDiagram } from "./diagrams";
import { figureAdvisories, figureProblems, figureSpecSchema, renderFigure, sketchUsage } from "./figure";

const BASE = { layout: "figure", id: "f", caption: "说明", size: [400, 200] } as const;

it("figure 版式和 scene 版式都能按 layout 解析，figure 走自己的渲染器", () => {
  const spec = diagramSpecSchema.parse({
    ...BASE,
    items: [{ at: [10, 10], size: [80, 40], text: "token", tone: "token" }],
    links: [{ from: [90, 30], to: [150, 30], tone: "comm" }],
  });
  expect(spec.layout).toBe("figure");
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

it("文字太多、整句进图、代码名进图，列为不阻塞的提醒", () => {
  const advice = figureAdvisories(
    figureSpecSchema.parse({
      ...BASE,
      texts: [
        ...Array.from({ length: 9 }, (_, i) => ({ at: [0, i * 10], text: `第 ${i} 段` })),
        { at: [0, 190], text: "这是一整句很长很长的说明文字，本来应该写在正文里而不是塞进图里" },
      ],
      items: [{ at: [100, 100], size: [200, 40], text: "select_moe_comm_method" }],
    }),
  );
  expect(advice.some((a) => a.includes("超过 8 段"))).toBe(true);
  expect(advice.some((a) => a.includes("一整句"))).toBe(true);
  expect(advice.some((a) => a.includes("代码名"))).toBe(true);
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

it("硬件标签仍参与源码符号提示", () => {
  expect(
    figureAdvisories(
      fig({
        hardware: [{ kind: "server", at: [30, 50], size: [320, 150], label: "select_moe_comm_method" }],
      }),
    ).some((a) => a.includes("代码名")),
  ).toBe(true);
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
  expect(svg.match(/fill="var\(--color-kv, #4c65b6\)"/g)?.length).toBe(5);
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

it("新零件里的字同样查代码名", () => {
  const advice = figureAdvisories(
    fig({ timelines: [{ at: [20, 40], scale: 10, end: 10, lanes: [{ label: "execute_model" }] }] }),
  );
  expect(advice.some((a) => a.includes("execute_model"))).toBe(true);
});

it("驼峰代码名要提醒，vLLM 这种产品名不算", () => {
  const advice = (s: string) => figureAdvisories(fig({ texts: [{ at: [20, 40], text: s }] }));
  expect(advice("isPrefill 为真")).not.toEqual([]);
  expect(advice("vLLM 把请求排队")).toEqual([]);
});
