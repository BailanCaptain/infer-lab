import { useEffect, useState } from "react";

const OPERATIONS = ["All-Gather", "All-Reduce", "Reduce-Scatter", "All-to-All"] as const;
type Operation = (typeof OPERATIONS)[number];

/** 两 rank、等长分片的教学语义；不模拟后端路由或浮点归约顺序。 */
export function collectiveResult(operation: Operation, a: number[], b: number[]): [number[], number[]] {
  if (a.length !== b.length) throw new Error("需要两个等长输入");
  if ((operation === "Reduce-Scatter" || operation === "All-to-All") && a.length % 2 !== 0) {
    throw new Error("两 rank 等分需要偶数长度的输入");
  }
  const half = a.length / 2;
  const sum = a.map((value, i) => value + (b[i] ?? 0));
  switch (operation) {
    case "All-Gather":
      return [
        [...a, ...b],
        [...a, ...b],
      ];
    case "All-Reduce":
      return [sum, [...sum]];
    case "Reduce-Scatter":
      return [sum.slice(0, half), sum.slice(half)];
    case "All-to-All":
      return [
        [...a.slice(0, half), ...b.slice(0, half)],
        [...a.slice(half), ...b.slice(half)],
      ];
  }
}

const EXCHANGE: Record<Operation, [string, string]> = {
  "All-Gather": ["发送分片 [1, 2]", "发送分片 [10, 20]"],
  "All-Reduce": ["贡献 [1, 2]", "贡献 [10, 20]"],
  "Reduce-Scatter": ["目的 Rank 1：[2]", "目的 Rank 0：[10]"],
  "All-to-All": ["目的 Rank 1：[2]", "目的 Rank 0：[10]"],
};
const COMBINE: Record<Operation, string> = {
  "All-Gather": "两个 rank 都按来源顺序拼接，保留所有元素。",
  "All-Reduce": "逐元素求和：1 + 10 = 11，2 + 20 = 22；两者获得完整结果。",
  "Reduce-Scatter": "Rank 0：1 + 10 = 11；Rank 1：2 + 20 = 22。每者只保留归约结果的一片。",
  "All-to-All": "Rank 0 拼接本地 1 与收到的 10；Rank 1 拼接收到的 2 与本地 20。",
};
const STAGES = ["初始持有", "交换与组合", "最终持有"];

export function CollectiveDemo() {
  const [operation, setOperation] = useState<Operation>("All-Gather");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setStep((current) => current + 1);
      if (step === 1) setPlaying(false);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [playing, step]);
  const values =
    step === 2
      ? collectiveResult(operation, [1, 2], [10, 20])
      : [
          [1, 2],
          [10, 20],
        ];
  const move = (next: number) => {
    setPlaying(false);
    setStep(next);
  };
  return (
    <section className="wiki-collective" aria-label="集合通信分步演示">
      <label>
        通信操作
        <select
          value={operation}
          onChange={(event) => {
            setOperation(event.target.value as Operation);
            move(0);
          }}
        >
          {OPERATIONS.map((name) => (
            <option key={name} value={name}>
              {name}
              {name.includes("Reduce") ? " (SUM)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="wiki-collective-controls">
        <button type="button" disabled={step === 0} onClick={() => move(step - 1)}>
          上一步
        </button>
        <button
          type="button"
          onClick={() => {
            if (step === 2) setStep(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "暂停" : step === 2 ? "重新播放" : "播放"}
        </button>
        <button type="button" disabled={step === 2} onClick={() => move(step + 1)}>
          下一步
        </button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <p className="wiki-collective-stage">
          {step + 1} / 3 · {STAGES[step]}
        </p>
        <div className="wiki-collective-ranks">
          {values.map((items, rank) => (
            <div className="wiki-collective-rank" key={rank === 0 ? "rank0" : "rank1"}>
              <strong>Rank {rank}</strong>
              <span>{step === 2 ? "输出" : "输入"}</span>
              <div className="wiki-collective-values">
                {items.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {step === 1 ? (
          <div className={`wiki-collective-transfer${playing ? " is-playing" : ""}`}>
            <p>
              Rank 0 <span aria-hidden="true">⟶</span> Rank 1：{EXCHANGE[operation][0]}
            </p>
            <p>
              Rank 1 <span aria-hidden="true">⟶</span> Rank 0：{EXCHANGE[operation][1]}
            </p>
          </div>
        ) : null}
        <p>
          {step === 0 ? "两个 rank 各持有两个元素。点击下一步，查看数据如何交换和组合。" : COMBINE[operation]}
        </p>
      </div>
      <small>箭头表示数据依赖；未展开后端路由、通信轮次和耗时。</small>
    </section>
  );
}
