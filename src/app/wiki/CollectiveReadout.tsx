import {
  COLLECTIVE_STEPS,
  COLLECTIVES,
  collectiveFrame,
  collectiveSeconds,
  collectiveTeaching,
} from "./scene-collective";

export function CollectiveReadout({
  kind,
  progress,
  onSeek,
}: {
  kind: number;
  progress: number;
  onSeek: (p: number) => void;
}) {
  const lesson = COLLECTIVES[kind]!,
    f = collectiveFrame(kind, progress),
    teaching = collectiveTeaching(kind, progress);
  const steps = COLLECTIVE_STEPS[kind]!;
  const current = f.current?.transfers[0];
  const move = (action: number) =>
    onSeek(action < 0 ? 0 : action >= steps.length ? 1 : (4 + action * 3.6) / collectiveSeconds(kind));
  return (
    <aside className="wiki-inference-readout wiki-collective-readout" aria-label={`${lesson.name} 当前讲解`}>
      <div className="wiki-inference-current">
        <span className="wiki-inference-eyebrow">
          {lesson.name} · {lesson.rule}
        </span>
        <h4>{teaching.title}</h4>
        <p>{teaching.detail}</p>
        <nav className="wiki-collective-turns" aria-label="逐步查看通信">
          <button type="button" disabled={f.intro} onClick={() => move(f.action - 1)}>
            上一步
          </button>
          <span>
            {f.intro
              ? "输入"
              : f.ended
                ? "结果"
                : kind === 8
                  ? f.action < 4
                    ? `准备 ${f.action + 1} / 4`
                    : `轮次 ${f.action - 3} / 6`
                  : `${f.action + 1} / ${steps.length}`}
          </span>
          <button type="button" disabled={f.ended} onClick={() => move(Math.max(0, f.action + 1))}>
            下一步
          </button>
        </nav>
        {kind === 8 && (
          <nav className="wiki-collective-rounds" aria-label="Ring 六轮通信">
            {[0, 1, 2, 3, 4, 5].map((r) => (
              <button type="button" key={r} aria-pressed={f.action === r + 4} onClick={() => move(r + 4)}>
                {r + 1}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="wiki-inference-ledger">
        <strong>
          {f.current
            ? f.applied
              ? "已写入"
              : f.arrived
                ? "已收到，准备写入"
                : "当前传输"
            : "比较输入与输出"}
        </strong>
        {current ? (
          f.current!.transfers.map((t) => (
            <div className="wiki-collective-transfer" key={`${t.from}-${t.to}`}>
              <span>
                rank {t.from} → rank {t.to}
                {t.from === t.to ? " · 本地" : ""}
              </span>
              <b>
                {t.slots.length === 4 ? "四块" : `块 ${t.slots[0]}`} · [{t.values.join(", ")}]
              </b>
              <small>
                {t.operation === "sum"
                  ? t.targets
                      .map(
                        (b, i) =>
                          `${f.before[t.to]![b] ?? 0} + ${t.values[i]}${f.applied ? ` = ${f.output[t.to]![b]}` : ""}`,
                      )
                      .join("；")
                  : kind === 7
                    ? `放在源 rank ${t.from} 对应的输出槽`
                    : "原值复制，不相加"}
              </small>
            </div>
          ))
        ) : (
          <p>
            {kind === 7
              ? "输入按目的卡分块，输出按来源卡排列；没有相加。"
              : (kind >= 4 && kind <= 6) || kind === 8
                ? "同一块位置汇合，才会相加；完成后保留哪些块，由操作决定。"
                : "块里的值保持不变；区别在于哪些卡要得到哪些块。"}
          </p>
        )}
        {f.current && <p className="wiki-inference-outcome">最终结果：{lesson.output}</p>}
        <details>
          <summary>数值、空格与播放顺序</summary>
          <p>
            四卡示意，每格代表一个块，格内只取一个标量便于手算。需要根卡时取 rank 0，归约选择
            SUM。空格表示尚未写入；没有输出的卡仍保留输入。
          </p>
          <p>
            {kind === 8
              ? "上方保留输入对照，下方跟踪工作区。环是逻辑收发顺序，不表示 NPU 的物理布线；前半段每卡加齐的块号由起始发送块决定。"
              : "逐条播放用来追踪数据归属；真实实现可以同时通信，并使用环或树等算法。这些路线不规定实际包顺序。"}
          </p>
          {kind === 6 && (
            <p>
              第 1–16 步各卡加齐自己的一块，第 17–28 步互相收集。相同分片规则下，结果与 All-Reduce
              的数学定义一致；浮点加法次序可能影响末位。
            </p>
          )}
        </details>
      </div>
    </aside>
  );
}
