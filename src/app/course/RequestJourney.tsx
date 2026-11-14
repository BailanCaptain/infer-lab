import { useEffect, useState } from "react";
import { HardwareStage } from "./HardwareStage";
import "./SystemsLessons.css";

const STOPS = [
  {
    name: "入口与分词",
    part: "host",
    where: "CPU · API 前端",
    input: "文本、生成参数",
    output: "请求 A、六个 token ID",
    keep: "模型权重已加载在设备；本轮不搬整套权重。",
    why: "网络接口接收消息，CPU 执行校验、聊天模板和 tokenizer。传给引擎的是编号与请求信息，文字不会直接进入矩阵乘法。",
  },
  {
    name: "队列与调度",
    part: "host",
    where: "CPU · EngineCore / Scheduler",
    input: "等待中的 A",
    output: "本轮算 6 个位置、分配缓存块",
    keep: "请求进度与块表由主机管理。",
    why: "这一步决定谁能开始、能推进多少。队列和调度器是 CPU 上的软件职责，不是 NPU 里的另一个硬件零件。",
  },
  {
    name: "准备与提交",
    part: "memory",
    where: "CPU · Worker / ModelRunner → NPU",
    input: "调度计划",
    output: "input_ids、positions、请求边界、缓存槽位",
    keep: "主机内存保留控制记录；设备侧准备本轮张量。",
    why: "把抽象计划展开成逐行对齐的表，再提交设备工作。主机内存与设备内存是不同位置；CPU 并不在每一层之间把全部激活搬回来。",
  },
  {
    name: "设备计算",
    part: "npu",
    where: "NPU · 权重、历史与计算单元",
    input: "本轮输入张量、本地权重与历史",
    output: "各层新的隐藏表示、新写入的历史",
    keep: "权重常驻；历史留待后续 decode；临时激活继续进入下一层。",
    why: "先查 embedding，再执行所有层。计算单元读取设备内存中的权重和历史，产生本轮结果。多卡协作时还要等必要的集合通信；这里展示承载计算的八个实体模组。",
  },
  {
    name: "输出与采样",
    part: "npu",
    where: "模型输出头 → 采样结果",
    input: "A 的最后一个有效位置",
    output: "被接受的新 token ID：y₀",
    keep: "A 已计算 6 个位置，持有 7 个 token；y₀ 要下一轮才计算。",
    why: "词表投影得到候选分数，再按生成规则选择编号。图示采用设备侧采样路径；具体采样、同步与回传安排由实现决定。尚未通过验证的投机候选不能直接返回。",
  },
  {
    name: "流式返回",
    part: "network",
    where: "CPU 输出处理 → 网络连接",
    input: "被接受的 token ID",
    output: "增量文字 / SSE 片段",
    keep: "请求未结束时，历史与进度继续保留。",
    why: "CPU 反分词并处理停止字符串，再把文字片段交给连接。一次设备执行、一个 token 和一次屏幕更新不保证一一对应。下一轮可直接输入 y₀，不必重新分词整段对话。",
  },
  {
    name: "结束与回收",
    part: "host",
    where: "EngineCore、Worker 与前端",
    input: "结束 token、长度上限或取消事件",
    output: "释放请求资源，关闭输出状态",
    keep: "模型权重继续服务别的请求；可复用缓存按缓存策略管理。",
    why: "释放的是这条请求的使用权和状态，不能把断开浏览器连接等同于引擎已完成回收，也不能理解成每个请求结束都卸载模型。",
  },
] as const;
const routeNodes = [
  [0, 150, 72, "接收文本 → token ID", "API 前端 · CPU"],
  [1, 150, 176, "排队、安排位置与缓存", "EngineCore · CPU"],
  [2, 150, 280, "把计划变成输入张量", "Worker / ModelRunner · CPU"],
  [3, 450, 280, "Embedding → 所有模型层", "NPU · 读权重、读写历史"],
  [4, 450, 410, "词表投影 → 采样", "被接受的 token ID"],
  [5, 150, 410, "反分词 → 流式返回", "CPU → 客户端"],
  [6, 150, 520, "结束后回收请求状态", "权重继续常驻"],
] as const;

export function RequestJourney() {
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  const stop = STOPS[step]!;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setStep((i) => {
          if (i === STOPS.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      4500,
    );
    return () => clearInterval(timer);
  }, [playing]);
  return (
    <section className="systems-visual" aria-label="一次请求的完整软硬件旅程">
      <header>
        <span>01 / 先看 2D 走向</span>
        <h3>交接的是数据，执行发生在具体部件上</h3>
        <p>
          这里跟踪一次常规生成：首轮处理 6 个输入位置，拿到 y₀
          后再进入下一轮。进程边界、主机—设备边界和卡间通信分别理解。
        </p>
      </header>
      <div className="systems-map-scroll">
        <svg
          viewBox="0 0 600 575"
          className="systems-route"
          role="img"
          aria-label="请求从主机控制进入设备计算，再返回主机和客户端；decode 继续使用历史"
        >
          <title>请求经过 CPU 控制、NPU 执行与输出返回</title>
          <defs>
            <marker id="request-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0 0L7 3.5L0 7" fill="#798d80" />
            </marker>
          </defs>
          <path className="route-boundary" d="M300 35V550" />
          <text x="145" y="22">
            主机与连接
          </text>
          <text x="450" y="22">
            设备执行域
          </text>
          <g className="systems-arrows" markerEnd="url(#request-arrow)">
            <path d="M150 104V144" />
            <path d="M150 208V248" />
            <path d="M275 280H325" />
            <path d="M450 312V378" />
            <path d="M325 410H275" />
            <path d="M150 442V488" />
          </g>
          <path
            className="systems-repeat"
            d="M450 442V505Q450 532 478 532H564Q585 532 585 510V220Q585 192 557 192H302Q290 192 290 218V268Q290 280 278 280H275"
            markerEnd="url(#request-arrow)"
          />
          <text x="447" y="552" className="systems-small">
            未结束：新编号进入下一轮，复用历史
          </text>
          {routeNodes.map(([i, x, y, title, note]) => (
            <g key={i} transform={`translate(${x},${y})`} data-active={step === i}>
              <rect x="-125" y="-32" width="250" height="64" rx="7" />
              <text y="-3">{title}</text>
              <text y="18" className="systems-small">
                {note}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <header>
        <span>02 / 对照硬件 3D</span>
        <h3>同一台 Atlas，定位这一步使用的部件</h3>
        <p>
          CPU 主板、DIMM、NPU 载板、8 个 NPU
          模组和网络接口均来自现有硬件母版。高亮框表示职责所在，不表示软件进程固定绑定某颗
          CPU，也不冒充实测走线。
        </p>
      </header>
      <HardwareStage kind="request" focus={stop.part} />
      <nav className="systems-step-buttons" aria-label="请求旅程步骤">
        {STOPS.map((s, i) => (
          <button
            key={s.name}
            type="button"
            aria-current={i === step ? "step" : undefined}
            onClick={() => {
              setPlaying(false);
              setStep(i);
            }}
          >
            {i + 1} · {s.name}
          </button>
        ))}
      </nav>
      <div className="systems-play">
        <button
          type="button"
          onClick={() => {
            if (step === 6) setStep(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "暂停请求旅程" : "播放请求旅程"}
        </button>
        <span>
          {step + 1} / {STOPS.length} · {stop.where}
        </span>
      </div>
      <div className="systems-inspector" aria-live="polite">
        <h4>{stop.name}</h4>
        <p>{stop.why}</p>
        <dl>
          <div>
            <dt>接收</dt>
            <dd>{stop.input}</dd>
          </div>
          <div>
            <dt>交出</dt>
            <dd>{stop.output}</dd>
          </div>
          <div>
            <dt>留下</dt>
            <dd>{stop.keep}</dd>
          </div>
        </dl>
      </div>
      <p className="systems-caption">
        部件外形与分层复用 Atlas 母版；设备内部的 HBM、片上缓存和计算单元未在此封装模型中展开，可接第 07
        章观察。这里的箭头说明逻辑交接，不代表端口到芯片的实际布线。
      </p>
    </section>
  );
}

export function BatchLedger() {
  const [position, setPosition] = useState(6),
    [count, setCount] = useState(3),
    [selected, setSelected] = useState(0);
  const blocks = [7, 2, 5];
  const rows = [
    {
      request: "A",
      position,
      token: position === 6 ? "y₀" : `a${position}`,
      block: blocks[Math.floor(position / 4)]!,
    },
    ...Array.from({ length: count }, (_, i) => ({ request: "B", position: i, token: `b${i}`, block: 9 })),
  ];
  const row = rows[Math.min(selected, rows.length - 1)]!;
  return (
    <section className="systems-visual batch-ledger" aria-label="两条请求的行与缓存槽位">
      <header>
        <span>动手对齐 / 一行是谁的，历史写到哪里</span>
        <h3>改变序列位置，批次行号可以不变</h3>
        <p>
          块长固定为 4；A 的块表为 [7, 2, 5]，B 为 [9]。这是普通逐位置 KV 缓存的教学表，不用于表示 GLM
          的所有缓存类型。
        </p>
      </header>
      <div className="systems-selectors">
        <label>
          A 本轮位置{" "}
          <input
            type="range"
            min="0"
            max="11"
            value={position}
            aria-label="A 本轮序列位置"
            onChange={(e) => setPosition(Number(e.target.value))}
          />
          <output>{position}</output>
        </label>
        <label>
          B 的输入长度{" "}
          <select
            value={count}
            aria-label="B 的输入长度"
            onChange={(e) => {
              setCount(Number(e.target.value));
              setSelected(0);
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="systems-table-scroll">
        <table>
          <caption>点一行，核对它自己的块表与偏移</caption>
          <thead>
            <tr>
              {["批次行", "请求", "token", "序列位置", "物理槽位", "送输出头"].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.request}-${r.position}`} data-selected={i === selected}>
                <td>
                  <button type="button" onClick={() => setSelected(i)} aria-label={`检查批次第 ${i} 行`}>
                    {i}
                  </button>
                </td>
                <td>{r.request}</td>
                <td>{r.token}</td>
                <td>{r.position}</td>
                <td data-slot>{r.block * 4 + (r.position % 4)}</td>
                <td>{i === 0 || i === rows.length - 1 ? "是" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="systems-inspector">
        <p className="systems-equation" data-slot-result={row.block * 4 + (row.position % 4)}>
          {row.request}：位置 {row.position} ÷ 4 → 逻辑块 {Math.floor(row.position / 4)}，偏移{" "}
          {row.position % 4}
          <br />
          查自己的块表 → 物理块 {row.block} → 槽位 {row.block} × 4 + {row.position % 4} ={" "}
          <b>{row.block * 4 + (row.position % 4)}</b>
        </p>
        <p>
          请求边界 [0, 1, {count + 1}]；送输出头的批次行 [0, {count}]。每个请求取本轮最后一行预测自己的后继。
        </p>
      </div>
    </section>
  );
}
