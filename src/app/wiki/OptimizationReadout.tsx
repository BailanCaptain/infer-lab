import {
  layoutState,
  OPTIMIZATION_LESSONS,
  offloadState,
  optimizationFrame,
  QUANT,
  quantState,
  SCHEDULE_C,
  SCHEDULE_STARTS,
  scheduleState,
} from "./scene-optimization";
import "./WikiOptimizationScene.css";

export function OptimizationReadout({
  kind,
  progress,
  onSeek,
}: {
  kind: number;
  progress: number;
  onSeek: (p: number) => void;
}) {
  const lesson = OPTIMIZATION_LESSONS[kind]!,
    f = optimizationFrame(kind, progress);
  const layout = layoutState(progress),
    quant = quantState(progress),
    offload = offloadState(progress),
    schedule = scheduleState(progress);
  return (
    <aside
      className="wiki-inference-readout wiki-optimization-readout"
      aria-label={`${lesson.label} 当前讲解`}
    >
      <nav className="wiki-inference-chapters" aria-label={`${lesson.label} 图解阶段`}>
        {lesson.stages.map((name, i) => (
          <button
            type="button"
            key={name}
            aria-pressed={i === f.phase}
            onClick={() => onSeek((i + 0.001) / lesson.stages.length)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            {name}
          </button>
        ))}
      </nav>
      <div className="wiki-inference-current">
        <span className="wiki-inference-eyebrow">
          {lesson.label} · {f.phase + 1} / {lesson.stages.length}
        </span>
        <h4>{lesson.stages[f.phase]}</h4>
        <p>{lesson.details[f.phase]}</p>
      </div>
      <div className="wiki-inference-ledger">
        {kind === 0 && (
          <>
            <strong>同一份数，三种观察位置</strong>
            <dl>
              <div>
                <dt>逻辑矩阵</dt>
                <dd>4 行 × 4 列</dd>
              </div>
              <div>
                <dt>教学小块</dt>
                <dd>2 行 × 2 列</dd>
              </div>
              <div>
                <dt>NZ 已写入</dt>
                <dd>{layout.written} / 4 块</dd>
              </div>
              <div>
                <dt>数值 5 的逻辑位置</dt>
                <dd>第 2 行，第 1 列</dd>
              </div>
              <div>
                <dt>ND 地址 → NZ 地址</dt>
                <dd>4 → {layout.written > 0 ? "2" : "待写入"}</dd>
              </div>
            </dl>
            <p className="wiki-inference-outcome">
              地址以元素为单位，从 0 开始；格内数字是数值。颜色跟随完整小块，转格式不会改数值。
            </p>
          </>
        )}
        {kind === 1 && (
          <>
            <strong>每个结果都有对应的行、列系数</strong>
            <dl>
              <div>
                <dt>激活行系数</dt>
                <dd>0.01</dd>
              </div>
              <div>
                <dt>权重列系数</dt>
                <dd>0.02</dd>
              </div>
              <div>
                <dt>宽整数累加</dt>
                <dd>{quant.summed ? QUANT.sum : "尚未完成"}</dd>
              </div>
              <div>
                <dt>量化数学结果</dt>
                <dd>{quant.restored ? QUANT.restored.toFixed(4) : "等待乘回系数"}</dd>
              </div>
              <div>
                <dt>原数直接点积</dt>
                <dd>{QUANT.original.toFixed(4)}</dd>
              </div>
              <div>
                <dt>绝对误差</dt>
                <dd>{quant.restored ? QUANT.error.toFixed(4) : "待比较"}</dd>
              </div>
            </dl>
            <div className="wiki-optimization-bytes">
              <span>
                <i style={{ width: "100%" }} />
                BF16 元素 · 12 B
              </span>
              <span>
                <i style={{ width: "50%" }} />
                INT8 元素 · 6 B
              </span>
            </div>
            <p>缩放系数、宽整数累加区与工作区另计；这不是整个算子的显存占用。</p>
          </>
        )}
        {kind === 2 && (
          <>
            <strong>“有数”与“可以恢复”分开看</strong>
            <dl>
              <div>
                <dt>A 的显存原页</dt>
                <dd>{offload.reclaimed ? "已归还" : "仍保留"}</dd>
              </div>
              <div>
                <dt>主机副本</dt>
                <dd>
                  {offload.hostReady ? "完整段已就绪" : `${offload.saved.filter(Boolean).length} / 2 页到达`}
                </dd>
              </div>
              <div>
                <dt>B 的新页</dt>
                <dd>{offload.allocated ? "页 9、10" : "尚未分配"}</dd>
              </div>
              <div>
                <dt>B 收到的内容</dt>
                <dd>{offload.loaded.filter(Boolean).length} / 2 页</dd>
              </div>
              <div>
                <dt>B 能否继续前向</dt>
                <dd>{offload.ready ? "完成通知已到达" : "等待加载完成"}</dd>
              </div>
            </dl>
            <p className="wiki-inference-outcome">
              主机副本和显存页分别管理。回收其中一份，不等于删除另一份。
            </p>
          </>
        )}
        {kind === 3 && (
          <>
            <strong>本步的位置预算</strong>
            <dl>
              <div>
                <dt>总预算</dt>
                <dd>8 个位置</dd>
              </div>
              <div>
                <dt>A + B</dt>
                <dd>{f.phase === 0 ? "待排" : "1 + 1"}</dd>
              </div>
              <div>
                <dt>C</dt>
                <dd>{f.phase === 0 ? "待排" : SCHEDULE_C[schedule.step]}</dd>
              </div>
              <div>
                <dt>空余</dt>
                <dd>{f.phase === 0 ? 8 : 6 - SCHEDULE_C[schedule.step]!}</dd>
              </div>
              <div>
                <dt>C 已排到</dt>
                <dd>
                  {schedule.planned
                    ? SCHEDULE_STARTS[schedule.planned - 1]! + SCHEDULE_C[schedule.planned - 1]!
                    : 0}{" "}
                  个位置
                </dd>
              </div>
              <div>
                <dt>C 提示词历史已就绪</dt>
                <dd>{schedule.prefix} / 14</dd>
              </div>
              <div>
                <dt>C 第一个回答 y₀</dt>
                <dd>{schedule.firstToken ? "已交付" : "尚未交付"}</dd>
              </div>
            </dl>
            <p className="wiki-inference-outcome">
              预算数的是位置，不是请求数，也不是毫秒。历史与位置号跨步延续。
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
