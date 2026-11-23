import { Link } from "react-router";
import { CacheReadout } from "./CacheReadout";
import { OptimizationReadout } from "./OptimizationReadout";
import {
  ATTENTION,
  ATTENTION_GROUPS,
  ATTENTION_OUTPUT,
  ATTENTION_TOTAL,
  attentionSum,
  CORE_OUTPUT,
  CORE_PRODUCT,
  INFERENCE_LESSONS,
  inferenceFrame,
  inferenceTeaching,
  numberText,
  pdStageStatus,
} from "./scene-inference";
import { CP_TOKENS } from "./scene-parallel-mechanisms";

export function InferenceReadout({
  kind,
  progress,
  onSeek,
}: {
  kind: number;
  progress: number;
  onSeek: (progress: number) => void;
}) {
  if (kind >= 4) return <OptimizationReadout kind={kind - 4} progress={progress} onSeek={onSeek} />;
  if (kind === 1) return <CacheReadout progress={progress} onSeek={onSeek} />;
  const lesson = INFERENCE_LESSONS[kind]!,
    f = inferenceFrame(kind, progress),
    teaching = inferenceTeaching(kind, progress);
  const row = Math.min(7, Math.floor(f.local * 8));
  return (
    <aside className="wiki-inference-readout" aria-label={`${lesson.label} 当前讲解`}>
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
          {String(f.phase + 1).padStart(2, "0")} / {String(lesson.stages.length).padStart(2, "0")} · 正在发生
        </span>
        <h4>{teaching.title}</h4>
        <p>{teaching.detail}</p>
      </div>
      {kind === 0 && (
        <>
          {f.phase < 2 ? (
            <div className="wiki-inference-ledger">
              <strong>{f.phase === 0 ? "先分清三个对象" : `位置 ${row} · 匹配怎样变成份数`}</strong>
              {f.phase === 0 ? (
                <dl>
                  <div>
                    <dt>Q</dt>
                    <dd>当前位置拿什么去找</dd>
                  </div>
                  <div>
                    <dt>K</dt>
                    <dd>每个历史位置怎样被匹配</dd>
                  </div>
                  <div>
                    <dt>V</dt>
                    <dd>匹配后取回的内容向量</dd>
                  </div>
                </dl>
              ) : (
                <>
                  <p className="wiki-inference-number">
                    exp({numberText(Math.log(ATTENTION.mass[row]!))}) ≈ {numberText(ATTENTION.mass[row]!)}
                  </p>
                  <p>先算 Q·K/√4。图中 K 显示两位小数，计算使用 ln(0.5)、ln(1.5) 的精确值。</p>
                </>
              )}
            </div>
          ) : f.phase < 4 ? (
            <div className="wiki-inference-ledger">
              <strong>八行如何分这 1 份上下文</strong>
              <div
                className="wiki-inference-share"
                role="img"
                aria-label="八个位置交替占十六分之一和十六分之三"
              >
                {ATTENTION.mass.map((mass, i) => (
                  <span key={CP_TOKENS[i]} style={{ flex: mass }} data-tone={i % 2 ? "gold" : "blue"}>
                    {i}
                  </span>
                ))}
              </div>
              <p>编号是历史位置。偶数行各占 1/16，奇数行各占 3/16。</p>
              {f.phase === 3 && (
                <>
                  <strong>当前加入位置 {row} 的四通道贡献</strong>
                  <p className="wiki-inference-vector">
                    [
                    {ATTENTION.values[row]!.map((x) =>
                      numberText((x * ATTENTION.mass[row]!) / ATTENTION_TOTAL),
                    ).join(", ")}
                    ]
                  </p>
                  {row === 7 && f.local * 8 - row >= 0.78 && (
                    <p className="wiki-inference-vector">
                      完整八行结果：[{ATTENTION_OUTPUT.map(numberText).join(", ")}]
                    </p>
                  )}
                  <p>每列只和同列相加，四个通道不会混在一起。</p>
                </>
              )}
            </div>
          ) : (
            <div className="wiki-inference-ledger">
              <strong>在线合并：带局部总份数 Zᵢ 加权</strong>
              {ATTENTION_GROUPS.map((indices, i) => (
                <div className="wiki-inference-part" key={indices.join(",")}>
                  <span>
                    卡 {i} · 位置 {indices.join("、")}
                    {f.phase > 4 || f.settled ? `（Z${i ? "₁" : "₀"} = ${i ? 6 : 2}）` : ""}
                  </span>
                  {f.phase > 4 || f.settled ? (
                    <>
                      <b>
                        {numberText(attentionSum(indices)[0]!)} ÷ {i ? 6 : 2} ={" "}
                        {numberText(attentionSum(indices, true)[0]!)}
                      </b>
                      <small>
                        局部四通道 O{i ? "₁" : "₀"} = [
                        {attentionSum(indices, true).map(numberText).join(", ")}]
                      </small>
                    </>
                  ) : (
                    <small>正在归属本卡历史位置，落稳后计算局部平均与总份数…</small>
                  )}
                </div>
              ))}
              {(f.phase > 4 || f.settled) && (
                <div className="wiki-inference-share" role="img" aria-label="卡0占四分之一，卡1占四分之三">
                  <span style={{ flex: 2 }} data-tone="blue">
                    2/8
                  </span>
                  <span style={{ flex: 6 }} data-tone="gold">
                    6/8
                  </span>
                </div>
              )}
              {f.phase === 5 && f.settled && (
                <>
                  <p className="wiki-inference-number">
                    (2×10 + 6×30) ÷ 8 = <b>25</b>
                  </p>
                  <p className="wiki-inference-vector">
                    合并结果 = 整表结果 = [{ATTENTION_OUTPUT.map(numberText).join(", ")}]
                  </p>
                </>
              )}
              <p>
                {f.phase > 4 || f.settled
                  ? "若直接对 10 与 30 平分，会错算成 (10+30)÷2 = 20。其余三列按同一 2/8、6/8 份额合并。"
                  : "两张卡先各自收下负责的历史位置，落稳后再算出各自的局部平均 Oᵢ 与总份数 Zᵢ。"}
              </p>
            </div>
          )}
          <p className="wiki-inference-outcome">
            输出 O 是数字向量，继续进入输出投影、残差和后续层，最终影响下一个 token。
          </p>
          <details>
            <summary>图中的数与真实实现</summary>
            <p>
              “内容和”是未归一化的加权向量，“总份数”是归一化分母。二者不是额外的模型参数。内核会做数值稳定处理；跨卡常交换局部
              O 与 LSE，再计算各块比例，不一定传图中的原始总和。
            </p>
            <Link to="/wiki/context-parallel#为什么取回的内容还要除以权重总和">看正文中的公式与实现对应</Link>
          </details>
        </>
      )}
      {kind === 2 &&
        (() => {
          const pd = pdStageStatus(progress);
          return (
            <div className="wiki-inference-ledger">
              <strong>这条请求的交接账</strong>
              <dl>
                <div>
                  <dt>D 目的块</dt>
                  <dd>{pd.allocated ? "3、5 已分配" : f.phase === 1 ? "正在申请 3、5…" : "等待分配"}</dd>
                </div>
                <div>
                  <dt>已收到</dt>
                  <dd>{pd.received.filter(Boolean).length} / 2 块</dd>
                </div>
                <div>
                  <dt>P 源块</dt>
                  <dd>{pd.released ? "已归还" : "仍持有"}</dd>
                </div>
                <div>
                  <dt>D 本请求</dt>
                  <dd>
                    {pd.resumed
                      ? "p3 重算完成 · 继续 decode"
                      : pd.recomputing
                        ? "正在重算末位 p3"
                        : pd.queued
                          ? "历史就绪 · 重新入队待调度"
                          : "尚未恢复计算"}
                  </dd>
                </div>
              </dl>
              <p className="wiki-inference-outcome">请求结束 ≠ 块已释放。目的块已分配 ≠ 历史已到达。</p>
              <p>
                每行对应一个位置，前两格是 K 的两个通道，后两格是 V
                的两个通道。钴蓝传数据，青玉传完成信号；两边仍可执行其他请求。
              </p>
            </div>
          );
        })()}
      {kind === 3 && (
        <div className="wiki-inference-ledger">
          <strong>跟踪同一行的两个通道</strong>
          <dl>
            <div>
              <dt>输入 x</dt>
              <dd>[1, 2]</dd>
            </div>
            <div>
              <dt>Cube 输出</dt>
              <dd>
                {f.phase > 3 || (f.phase === 3 && f.local >= 0.82)
                  ? `[${CORE_PRODUCT.join(", ")}]`
                  : "等待乘加完成"}
              </dd>
            </div>
            <div>
              <dt>Vector 输出</dt>
              <dd>
                {f.phase > 6 || (f.phase === 6 && f.landed) ? `[${CORE_OUTPUT.join(", ")}]` : "等待激活完成"}
              </dd>
            </div>
            <div>
              <dt>GM 最终输出</dt>
              <dd>{f.phase === 7 && f.landed ? "[5, 0] 已写回" : "等待写回"}</dd>
            </div>
          </dl>
          <p className="wiki-inference-outcome">
            Cube 做矩阵乘加；Vector 做逐项运算。搬运和缓冲让两者拿到正确的数据。
          </p>
          <p>
            GM 是设备侧全局内存；L1、L0、UB 是片上缓冲。图中立体阵列台表示 Cube 与 Vector
            计算单元，带数值的格阵表示数据。
          </p>
        </div>
      )}
    </aside>
  );
}
