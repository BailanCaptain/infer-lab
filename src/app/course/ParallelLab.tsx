import { useState } from "react";
import { HardwareStage, type ParallelLayout } from "./HardwareStage";
import { EXAMPLE_WEIGHT, parallelGroups, pipelineCell, splitProjection } from "./parallel-example";
import "./SystemsLessons.css";

const letters = ["A", "B", "C", "D"];
function MatrixNumbers({ rows, split }: { rows: readonly (readonly number[])[]; split?: "row" | "column" }) {
  return (
    <div className="parallel-numbers" style={{ gridTemplateColumns: `repeat(${rows[0]!.length},1fr)` }}>
      {rows.flatMap((row, r) =>
        row.map((n, c) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the fixed matrix coordinate is the identity of a changing cell.
            key={`${r}-${c}`}
            data-group={split === "column" ? Math.floor(c / 2) : split === "row" ? r : undefined}
          >
            {n}
          </span>
        )),
      )}
    </div>
  );
}
function TensorSplit() {
  const [split, setSplit] = useState<"column" | "row">("column");
  const [x, setX] = useState([1, 2]);
  const result = splitProjection(x);
  return (
    <section className="parallel-teaching" aria-label="两张卡的矩阵切分">
      <p>
        先把一个真实可手算的乘法分给两张卡。数学记法为 Y = XW，W
        的行是输入维，列是输出维。两种切法必须还原同一个 Y。
      </p>
      <div className="systems-selectors">
        <label>
          切分方向{" "}
          <select
            value={split}
            aria-label="矩阵切分方向"
            onChange={(e) => setSplit(e.target.value as "column" | "row")}
          >
            <option value="column">按输出列切 · 最后拼接</option>
            <option value="row">按输入行切 · 最后求和</option>
          </select>
        </label>
        {x.map((n, i) => (
          <label key={i === 0 ? "x0" : "x1"}>
            x{i}
            <input
              type="number"
              min="-9"
              max="9"
              value={n}
              aria-label={`输入 x${i}`}
              onChange={(e) =>
                setX(x.map((v, j) => (i === j ? Math.max(-9, Math.min(9, Number(e.target.value))) : v)))
              }
            />
          </label>
        ))}
      </div>
      <div className="parallel-equation">
        <div>
          <small>完整输入 X</small>
          <MatrixNumbers rows={[x]} />
        </div>
        <b>×</b>
        <div>
          <small>完整权重 W · 两种颜色对应两张卡</small>
          <MatrixNumbers rows={EXAMPLE_WEIGHT} split={split} />
        </div>
        <b>=</b>
        <div>
          <small>未切分的答案 Y</small>
          <MatrixNumbers rows={[result.complete]} />
        </div>
      </div>
      <div className="parallel-workers">
        {[0, 1].map((rank) => (
          <div key={rank} data-group={rank}>
            <h4>卡 {rank} 拿到什么</h4>
            <p>
              {split === "column"
                ? `完整 X = [${x.join(", ")}]，以及 W 的第 ${rank * 2 + 1}–${rank * 2 + 2} 列`
                : `X 的第 ${rank + 1} 项 ${x[rank]}，以及 W 的第 ${rank + 1} 行`}
            </p>
            <MatrixNumbers
              rows={
                split === "column"
                  ? EXAMPLE_WEIGHT.map((row) => row.slice(rank * 2, rank * 2 + 2))
                  : [EXAMPLE_WEIGHT[rank]!]
              }
            />
            <span className="parallel-down">↓ 本地相乘、相加</span>
            <MatrixNumbers rows={[split === "column" ? result.columns[rank]! : result.partial[rank]!]} />
            <p>
              {split === "column"
                ? "这些数已完整，只拥有一半输出列。"
                : "形状虽完整，每个数仍只是一部分乘积的和。"}
            </p>
          </div>
        ))}
      </div>
      <div className="systems-inspector">
        <strong>
          {split === "column" ? "All-Gather：按列拼接分片" : "All-Reduce（sum）：逐元素相加部分和"}
        </strong>
        <p className="systems-equation" data-complete={result.complete.join(",")}>
          [{(split === "column" ? result.columns : result.partial)[0]!.join(", ")}]{" "}
          {split === "column" ? "拼" : "＋"} [
          {(split === "column" ? result.columns : result.partial)[1]!.join(", ")}] = [
          {result.complete.join(", ")}]
        </p>
        <p>
          {split === "column"
            ? "如果下一层可以直接消费分片，就不必在这里先收齐。常见前馈采用列切 → 本地激活 → 行切，在最后合部分和。"
            : "非线性要等完整数值。例如部分和 2 与 −4：ReLU(2 − 4) = 0，而 ReLU(2) + ReLU(−4) = 2；不能提前各自激活。"}
        </p>
      </div>
    </section>
  );
}
function PipelineSchedule() {
  const [batches, setBatches] = useState(1),
    [tick, setTick] = useState(0);
  const ticks = batches + 3;
  return (
    <section className="parallel-teaching" aria-label="流水线阶段与气泡">
      <p>
        把一个 8 层教学模型分成 4 段，每段 2 层，各段由 4 张卡 TP
        合算。下图每格代表相同执行时间，暂不计传输。A–D 是独立批次，不能把同一请求尚未生成的后继 token
        当成现成输入。
      </p>
      <div className="systems-selectors">
        <label>
          独立批次数{" "}
          <select
            aria-label="流水线批次数"
            value={batches}
            onChange={(e) => {
              setBatches(Number(e.target.value));
              setTick(0);
            }}
          >
            <option value={1}>1 个批次</option>
            <option value={4}>4 个批次</option>
          </select>
        </label>
        <label>
          观察时刻{" "}
          <input
            aria-label="流水线时刻"
            type="range"
            min="0"
            max={ticks - 1}
            value={tick}
            onChange={(e) => setTick(Number(e.target.value))}
          />
          <output>{tick + 1}</output>
        </label>
      </div>
      <div className="systems-table-scroll">
        <table className="pipeline-timeline">
          <caption>层的权重与历史留在所属阶段；沿对角线传递隐藏表示</caption>
          <thead>
            <tr>
              <th>阶段 / 层</th>
              {Array.from({ length: ticks }, (_, tickIndex) => tickIndex).map((t) => (
                <th key={t + 1}>时刻 {t + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((stage) => (
              <tr key={stage}>
                <th>
                  阶段 {stage}
                  <small>
                    L{stage * 2}–L{stage * 2 + 1}
                  </small>
                </th>
                {Array.from({ length: ticks }, (_, tickIndex) => tickIndex).map((t) => {
                  const batch = pipelineCell(stage, t, batches);
                  return (
                    <td key={t + 1} data-now={t === tick} data-batch={batch ?? "idle"}>
                      {batch === null ? "空闲" : letters[batch]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="systems-inspector">
        <p>
          此刻在工作的阶段：{[0, 1, 2, 3].filter((s) => pipelineCell(s, tick, batches) !== null).join("、")}。
          <strong>首批仍要走 4 格</strong>，
          {batches === 1
            ? "一个批次让四段依次忙，各卡约 1/4 时间有活。"
            : "四个批次共 7 格结束；中间能填满，开头和末尾仍有气泡。"}
        </p>
        <p data-utilization={(batches / (batches + 3)).toFixed(4)}>
          本图整个观察窗口的忙碌比例 = {4 * batches} / {4 * ticks} = {((100 * batches) / ticks).toFixed(1)}
          %。这是等时、无通信的教学推导，不是部署性能预测。
        </p>
      </div>
    </section>
  );
}
function DataParallel() {
  const [destinations, setDestinations] = useState([0, 1, 2, 3]);
  return (
    <section className="parallel-teaching" aria-label="数据并行的独立请求与历史">
      <p>
        用稠密模型作基准：16 张卡组成 4 个执行组，每组用 TP4
        放下一份完整模型。分配的是请求，组内各卡才合算该请求的矩阵。改变 A 的去向，B、C、D 的历史不随它搬走。
      </p>
      <div className="parallel-requests">
        {letters.map((name, i) => (
          <label key={name}>
            请求 {name} →{" "}
            <select
              aria-label={`请求 ${name} 的执行组`}
              value={destinations[i]}
              onChange={(e) =>
                setDestinations((ds) => ds.map((v, j) => (i === j ? Number(e.target.value) : v)))
              }
            >
              {[0, 1, 2, 3].map((g) => (
                <option key={g} value={g}>
                  DP 组 {g}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="parallel-replicas">
        {[0, 1, 2, 3].map((group) => (
          <div key={group} data-group={group}>
            <h4>DP 组 {group} · TP4</h4>
            <small>
              rank {group * 4}–{group * 4 + 3}
            </small>
            <p>
              完整模型一份
              <br />
              组内独立队列与请求历史
            </p>
            <strong>{letters.filter((_, i) => destinations[i] === group).join("、") || "无请求"}</strong>
          </div>
        ))}
      </div>
      <div className="systems-inspector">
        <p>
          单个请求不会自动分给四个 DP 组；增加副本主要增加服务容量。这里不画训练中的梯度同步。GLM 的 DP
          attention 与跨组共享的 EP 专家有不同关系，不能直接套用“完全独立的稠密副本”，具体放置见正文与第 14
          章。
        </p>
      </div>
    </section>
  );
}

export function ParallelLab() {
  const [mode, setMode] = useState<ParallelLayout>("tp"),
    [rank, setRank] = useState(0);
  const groups = parallelGroups(mode),
    group = Math.floor(rank / (mode === "tp" ? 8 : 4));
  return (
    <section className="systems-visual" aria-label="TP PP DP 的计算与硬件对照">
      <header>
        <span>01 / 先看分工与数据走向</span>
        <h3>先确定分的是什么，再看这些卡怎样协作</h3>
      </header>
      <fieldset className="systems-mode" aria-label="并行方式">
        {(
          [
            ["tp", "TP · 切矩阵"],
            ["pp", "PP · 分层接力"],
            ["dp", "DP · 分请求"],
          ] as const
        ).map(([id, name]) => (
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>
            {name}
          </button>
        ))}
      </fieldset>
      {mode === "tp" ? <TensorSplit /> : mode === "pp" ? <PipelineSchedule /> : <DataParallel />}
      <header>
        <span>02 / 把分工落到实体 NPU</span>
        <h3>固定 16 个模组，观察同一批卡的不同分组</h3>
        <p>
          {mode === "tp"
            ? "TP8 × DP2：同色 8 张卡合算同一批输入；两组分别接请求。对照 GLM 稠密 MLP，注意全局 EP 的专家共享仍是额外一层分工。"
            : mode === "pp"
              ? "教学布局 PP4 × TP4：同色 4 张卡负责一段，四段顺序接力。服务器 0 放阶段 0、1，服务器 1 放阶段 2、3；阶段 1 → 2 的交接跨机。"
              : "稠密模型教学布局 DP4 × TP4：同色 4 张卡是一份完整执行组。服务器 0 放组 0、1，服务器 1 放组 2、3；请求可以分别送入四组。"}
        </p>
      </header>
      <HardwareStage kind="parallel" layout={mode} selected={rank} onSelect={setRank} />
      <div className="systems-selectors">
        <label>
          检查一个 rank{" "}
          <select aria-label="检查硬件 rank" value={rank} onChange={(e) => setRank(Number(e.target.value))}>
            {Array.from({ length: 16 }, (_, rankIndex) => rankIndex).map((n) => (
              <option key={n} value={n}>
                rank {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="systems-inspector">
        <h4>
          rank {rank} · 服务器 {Math.floor(rank / 8)} · 本机编号 {rank % 8}
        </h4>
        <p data-members>
          同一 {mode === "pp" ? "PP 阶段内的 TP" : "TP"} 组：{groups[group]!.join("、")}
        </p>
        <p>
          {mode === "tp"
            ? `这组属于 DP ${group}。稠密 MLP 中每卡负责 12,288 ÷ 8 = 1,536 个中间通道；down 投影后得到 [T,4096] 的部分和，八卡相加才完整。`
            : mode === "pp"
              ? `属于阶段 ${group}，保存教学模型 L${group * 2}、L${group * 2 + 1} 的权重与历史。${group < 3 ? `本段完成后，把中间表示交给阶段 ${group + 1}。` : "这是末段，完成输出头与结果交接。"}`
              : `属于 DP ${group}，它与组内另外三张卡合算该组的请求；另外三组持有自己的模型副本和历史。`}
        </p>
      </div>
      <p className="systems-caption">
        模组来自 Atlas 硬件母版；为读清 rank 而抽出排列，服务器归属不变。颜色和外框表示逻辑通信组，未虚构实际
        HCCS／RoCE 布线。三种布局不是可随意切换的部署命令，也不代表同等吞吐。
      </p>
    </section>
  );
}
