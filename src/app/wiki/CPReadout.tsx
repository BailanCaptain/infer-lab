import { useMemo } from "react";
import { Link } from "react-router";
import { StableSceneContent } from "./StableSceneContent";
import {
  CP_TOKENS,
  cpReadFrame,
  DCP_EXAMPLE,
  DCP_OUTPUT,
  DCP_WEIGHTS,
  dcpChannels,
  dcpMergeFrame,
  mechanismFrame,
  pcpMotion,
  ringMotion,
} from "./scene-parallel-mechanisms";
import { ringVectorOutput } from "./scene-ring-data";

const n = (value: number) => String(+value.toFixed(2));

export function CPReadout({ kind, progress }: { kind: number; progress: number }) {
  const sizing = useMemo(
    () =>
      [0, 0.12, 0.24, 0.32, 0.42, 0.48, 0.55, 0.65, 0.75, 0.85, 0.95, 1].map((p) => (
        <CPReadoutContent key={p} kind={kind} progress={p} />
      )),
    [kind],
  );
  return (
    <>
      <p className="wiki-cp-prerequisite">
        看不清“内容和、总份数”的来源？
        <Link to="/wiki/attention-qkv#scene-inference-mechanism-0">先播放每行 V 怎样贡献上下文</Link>
      </p>
      <StableSceneContent sizing={sizing}>
        <CPReadoutContent kind={kind} progress={progress} />
      </StableSceneContent>
      <details className="wiki-compute-reference">
        <summary>这些数为什么能得到上下文？</summary>
        <p className="wiki-attention-purpose">
          <b>除法是在求加权平均：</b>
          {kind === 2
            ? "本图每行权重为 1，读 8 行就除以 8。"
            : "两块各占 2/8、6/8，局部内容 10、30 按比例混合得到25；200是尚未除以总权重8的中间量。"}
          <Link to="/wiki/context-parallel#为什么取回的内容还要除以权重总和">
            正文：为什么必须除、直接相加会怎样
          </Link>
        </p>
        <aside className="wiki-attention-purpose" aria-label="加权内容到底用来做什么">
          <strong>这一站的目的：为当前位置读回上下文</strong>
          <p>
            “原理”这个位置需要结合前面的“并行”“计算”等信息。Q 表示当前位置的查询，K 用来比较匹配程度，V
            是各位置可提供的内容向量。attention 按匹配权重取用 V，合成一行上下文 O。
          </p>
          <div className="wiki-attention-path">
            <span>Q 与 K 匹配</span>
            <span>决定各位置占几份</span>
            <span>按份额取 V</span>
            <b>上下文 O</b>
          </div>
          <p>
            <b>算完交给谁：</b>O 进入本层输出投影、残差与后续层，更新当前位置的隐藏表示，最终影响下一个 token
            的预测。它是数字向量，不是直接拼出来的一段回答。
          </p>
          <p>
            {kind === 2
              ? "本图特意让合法位置等权：位置7读8行，每行占1/8。第0通道的内容是1、3、5、7、9、11、13、15，合起来64÷8＝8；真实模型的权重通常不同。"
              : "看本图位置7的两块历史：各块平均内容为10和30，分量为2和6。它们应各占2/8、6/8，所以读回2/8×10＋6/8×30＝25；直接平均成20会丢掉两块的重要程度。这里用教学数值，不代表词义的真实评分。"}
          </p>
        </aside>
      </details>
    </>
  );
}

function CPReadoutContent({ kind, progress }: { kind: number; progress: number }) {
  const first = cpReadFrame(kind, progress, 0);
  if (kind === 3 && first.phase >= 2) {
    const merge = dcpMergeFrame(progress);
    return (
      <aside className="wiki-cp-readout" aria-label="同一个查询的两份答案怎样合并">
        <strong>
          {merge.enabled
            ? "同一个 Q7：按本卡算出的 Z = exp(LSE) 合成一份"
            : "跨卡交换局部 O 与 LSE（ln 2、ln 6），K/V 留在原卡"}
        </strong>
        <p>两卡传 LSE = ln 2、ln 6，本卡算 Z = exp(LSE) = 2、6（总和 8），所以不能各取一半。</p>
        <div className="wiki-cp-share-bar" role="img" aria-label="卡0占2份，卡1占6份">
          {Array.from({ length: DCP_EXAMPLE.normalizers.reduce((a, b) => a + b, 0) }, (_, unit) => unit).map(
            (unit) => (
              <span key={unit} data-card={unit < DCP_EXAMPLE.normalizers[0]! ? 0 : 1} />
            ),
          )}
        </div>
        {[0, 1].map((card) => (
          <section key={card} data-card={card}>
            <b>
              卡{card}（槽{card ? 3 : 0}）· LSE{card ? "₁" : "₀"}=ln {DCP_EXAMPLE.normalizers[card]} → 本卡算
              Z{card ? "₁" : "₀"}={DCP_EXAMPLE.normalizers[card]}（{DCP_EXAMPLE.normalizers[card]}/8 ＝{" "}
              {card ? "¾" : "¼"}）
            </b>
            <span>局部上下文：[{dcpChannels(DCP_EXAMPLE.local[card]!).map(n).join(", ")}]</span>
            <strong>
              {merge.weighted
                ? `贡献：[${dcpChannels(DCP_EXAMPLE.local[card]!)
                    .map((x) => n(x * DCP_WEIGHTS[card]!))
                    .join(", ")}]`
                : "收到后，四个通道都乘同一个份额"}
            </strong>
          </section>
        ))}
        <strong className="wiki-cp-read-result">
          {merge.complete
            ? `合并后：[${dcpChannels(DCP_OUTPUT).map(n).join(", ")}]`
            : merge.weighted
              ? "贡献已算好，接下来同列相加"
              : "先把两份答案放入合并位置"}
        </strong>
        <small>输出继续进入本层投影；这些数字不是 token 编号。</small>
      </aside>
    );
  }
  const waiting = first.phase < (kind === 2 ? 2 : 1);
  if (waiting) {
    const frame = mechanismFrame(kind, progress);
    const landed =
      kind === 2
        ? pcpMotion(progress).assign === 1
        : kind === 4
          ? ringMotion(progress).assign === 1
          : frame.split === 1;
    return (
      <aside className="wiki-cp-readout" aria-label="先认识输入与位置分工">
        <strong>
          {kind === 3 ? "当前任务：用历史生成下一个 token" : "当前任务：同一句话的一层 attention"}
        </strong>
        <p>
          {kind === 3
            ? "此前各位置的 K/V 已写入缓存。新查询要读这些历史；先看历史保存在哪里，再看怎么合并两卡的答案。"
            : `输入：“${CP_TOKENS.join("")}”。图中示意分成 8 个 token；行号 0–7 对应它们在原句中的位置。`}
        </p>
        <section>
          <b>
            {kind === 3
              ? "这张完整表表示什么"
              : landed
                ? "输入落稳后，才生成 Q/K/V"
                : "先看完整输入，再看分工"}
          </b>
          <span>
            {kind === 3
              ? "同一位置的 K、V 成对保存；这张表是分布的逻辑总览，不表示先集中缓存再搬走。"
              : landed
                ? "Q 用于查询；K 用于匹配；V 提供内容。三者都来自本卡输入的投影，此处省略投影乘法。"
                : "一行属于一个位置，格子表示这一行的隐藏通道。按行分配，整行通道一起保留。"}
          </span>
        </section>
      </aside>
    );
  }
  return (
    <aside className="wiki-cp-readout" aria-label="当前查询怎样读取历史">
      <strong>{kind === 3 ? "同一个 Q7，分读两份历史" : "一直追踪：卡0 的 Q7，卡1 的 Q5"}</strong>
      <div className="wiki-attention-path">
        <span>Q 查询</span>
        <span>K 匹配</span>
        <span>按权重取 V</span>
        <b>累加后求平均</b>
      </div>
      {kind === 4 && (
        <details className="wiki-compute-reference">
          <summary>本例的匹配权重如何算出</summary>
          <small>
            κ 是本例的匹配评分：块A取 ln(0.5)，块B取
            ln(1.5)，取指数后分别得到权重0.5、1.5。Q=[2,0,0,0]、K=[κ,0,1,−1]，使 Q·K/√4=κ。
          </small>
        </details>
      )}
      {kind === 3 && (
        <details className="wiki-compute-reference">
          <summary>本例的匹配权重如何算出</summary>
          <p>
            这里的数字都是通道值。教学查询 Q=[2,0,0,0] 使评分只由 K 的第一通道决定；另外三项乘以 0。K 首项的
            −0.69、0.41 分别是 ln(0.5)、ln(1.5) 的近似显示，计算使用精确值。
          </p>
          <small>这组数用于看清两卡份额 ¼、¾，不是模型实际生成的 K。下面的除法展开第0输出通道。</small>
        </details>
      )}
      {[0, 1].map((card) => {
        const f = cpReadFrame(kind, progress, card);
        const exchange = kind === 4 && f.phase === 2;
        const nextBlock = card ? "A" : "B";
        return (
          <section key={card} data-card={card}>
            <b>
              卡{card}（槽{card ? 3 : 0}）· Q{f.query}
              {kind !== 3 ? `“${CP_TOKENS[f.query]}”` : ""} → {f.block}
            </b>
            {kind === 4 && f.phase >= 2 && (
              <small>
                {f.phase === 2
                  ? `保留本轮：内容 ${n(f.total.u)}，份额 ${n(f.total.z)}`
                  : `从上轮接着算：内容 ${n(f.prior.u)}，份额 ${n(f.prior.z)}`}
              </small>
            )}
            <span className="wiki-cp-read-target">
              {exchange
                ? ringMotion(progress).transfer === 1
                  ? `块 ${nextBlock} 已落稳 · 下一轮接着算`
                  : `累计留在本卡 · 等待块 ${nextBlock}`
                : f.complete
                  ? `已读位置 ${f.read.join("、")}`
                  : `正在读：K${f.position} / V${f.position}`}
            </span>
            {f.running && !f.complete && (
              <span className="wiki-cp-read-operation">
                {!f.scored
                  ? `Q${f.query} 与 K${f.position} 对齐评分`
                  : !f.weighted
                    ? `评分 ${kind === 2 ? "0" : `ln(${n(f.weight)})`} → exp = ${n(f.weight)}`
                    : `${n(f.weight)} × V${f.position}(${n(f.value)}) = ${n(f.product)}`}
              </span>
            )}
            <dl>
              <div>
                <dt>{f.pending ? `内容和：之前 + 本行 V${f.position}` : "取回的内容总和"}</dt>
                <dd>
                  {f.pending ? (
                    <>
                      <span>{n(f.before.u)}</span> + <em>{f.weighted ? n(f.product) : "…"}</em> = <b>…</b>
                    </>
                  ) : (
                    <>
                      <span>{n(f.before.u)}</span> + <em>{n(f.current.u)}</em> = <b>{n(f.total.u)}</b>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt>{f.pending ? `权重份额：之前 + 本行` : "取用的权重总份额"}</dt>
                <dd>
                  {f.pending ? (
                    <>
                      <span>{n(f.before.z)}</span> + <em>{f.scored ? n(f.weight) : "…"}</em> = <b>…</b>
                    </>
                  ) : (
                    <>
                      <span>{n(f.before.z)}</span> + <em>{n(f.current.z)}</em> = <b>{n(f.total.z)}</b>
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <span className="wiki-cp-read-result">
              {f.output === null
                ? "第一项尚未加入"
                : `${kind === 3 && f.complete ? "本块上下文" : f.complete && ((kind === 4 && f.phase >= 3) || kind === 2) ? "完整上下文" : "目前读回的上下文"}：${n(f.total.u)} ÷ ${n(f.total.z)} = ${n(f.output)}`}
            </span>
            {kind === 4 && f.phase >= 3 && f.complete && (
              <span>
                整行 O{f.query} ≈ [{ringVectorOutput(f.query).map(n).join(", ")}]
              </span>
            )}
            {kind === 3 && f.output !== null && (
              <span>
                局部 O 四通道：[{dcpChannels(f.output).map(n).join(", ")}]；权重总份额={n(f.total.z)}
              </span>
            )}
            {f.masked.length > 0 && <small>位置{f.masked.join("、")}是未来，遮蔽、不加入。</small>}
          </section>
        );
      })}
      <small>
        {kind === 2
          ? "四通道正交 Q/K 算例；跟踪第0输出通道。"
          : kind === 3
            ? "教学取评分 ln(0.5) / ln(1.5)，指数分别为0.5 / 1.5。跟踪第0输出通道。"
            : "矩阵保留4通道；下方贡献格和除法展开第0通道，其余通道同样加权。Q/K 的四通道评分与正文标量算例相同，输出第0通道仍为25。图中输出取一位小数。"}
      </small>
      {kind !== 3 && first.complete && (
        <small>其余查询也按自己的因果范围独立计算；最后各行输出保留原位置。</small>
      )}
    </aside>
  );
}
