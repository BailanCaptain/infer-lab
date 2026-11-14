import {
  mechanismFrame,
  SP_NORMALIZED,
  SP_PARTIALS,
  SP_PROJECTED,
  SP_RMS,
  SP_SUM,
  SP_TOKENS,
  spNormalization,
  spProjection,
} from "./scene-parallel-mechanisms";

const vector = (row: readonly number[]) => `[${row.map((x) => +x.toFixed(2)).join(", ")}]`;

export function SPReadout({ progress }: { progress: number }) {
  const f = mechanismFrame(1, progress);
  const introducing = f.phase === 0 && f.local < 0.4;
  const r = Math.min(3, Math.floor(f.local * 4));
  const owner = Math.floor(r / 2);
  const norm = spNormalization(progress);
  const projection = spProjection(progress);
  const gatherRow = Math.min(3, Math.floor(Math.max(0, (f.local - 0.18) / 0.82) * 4));
  const titles = [
    "两份贡献，还不是完整值",
    "先相加，只留负责的行",
    "各算两行，不跨卡传输",
    "只复制缺行，不再相加",
    "行收齐后，按输出列分工",
  ];
  const rowState = (card: number, row: number) => {
    const own = Math.floor(row / 2) === card;
    const completed = f.local * 4 >= row + 1;
    const received = f.local >= 0.18 && ((f.local - 0.18) / 0.82) * 4 >= row + 0.65;
    if (f.phase === 1 && completed) return { away: !own, text: own ? "已合齐" : "交给另一卡" };
    if (f.phase === 2) return { away: !own, text: own ? "4 通道" : "在另一卡" };
    if (f.phase === 3)
      return { away: !own && !received, text: own ? "本卡保留" : received ? "已收到" : "待接收" };
    return { away: false, text: f.phase === 0 || f.phase === 1 ? "部分和" : "4 通道" };
  };
  return (
    <aside className="wiki-sp-readout" aria-label="SP 当前数据怎样改变">
      <strong>{introducing ? "完整序列：一句话的四行" : titles[f.phase]}</strong>
      {!introducing && (
        <section className="wiki-sp-ownership" aria-label="行的归属">
          {[0, 1].map((card) => (
            <section key={card} data-card={card}>
              <b>卡{card}</b>
              <span>
                {f.phase < 2
                  ? "同四行的不同贡献"
                  : f.phase === 2
                    ? "仅保留本卡两行"
                    : f.phase === 3
                      ? "保留自己的行，补齐另一半"
                      : "完整四行 × 本卡权重列"}
              </span>
              <div className="wiki-sp-token-rows">
                {SP_TOKENS.map((token, row) => (
                  <span
                    key={token}
                    data-owner={Math.floor(row / 2)}
                    data-away={rowState(card, row).away || undefined}
                  >
                    {token}
                    <small>{rowState(card, row).text}</small>
                  </span>
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
      {f.phase === 0 && (
        <p>
          {introducing ? (
            "今天 / 天气 / 很 / 好各占一行，横向四格是四个通道。接下来再展开两张 TP 卡对这些行算出的不同贡献。"
          ) : (
            <>
              同名行要逐格相加。例如“今天”：卡0的 {vector(SP_PARTIALS[0]![0]!)}，加上卡1的{" "}
              {vector(SP_PARTIALS[1]![0]!)}，才得到完整值。
            </>
          )}
        </p>
      )}
      {f.phase === 1 && (
        <section className="wiki-sp-operation">
          <b>
            正在处理“{SP_TOKENS[r]}” → 归卡{owner}
          </b>
          <span>卡0贡献 {vector(SP_PARTIALS[0]![r]!)}</span>
          <span>＋ 卡1贡献 {vector(SP_PARTIALS[1]![r]!)}</span>
          <strong>{f.local * 4 - r >= 0.62 ? `＝ ${vector(SP_SUM[r]!)}` : "先接收，落稳后逐通道相加"}</strong>
        </section>
      )}
      {f.phase === 2 && (
        <section className="wiki-sp-operation">
          <b>一行用自己的四个数归一化</b>
          {norm.rows.map((row, card) => (
            <span key={row}>
              卡{card} · {SP_TOKENS[row]}：{vector(SP_SUM[row]!)} ÷ {SP_RMS[row]}
              {norm.divided === 1 || norm.written[row] === 1
                ? ` ＝ ${vector(SP_NORMALIZED[row]!)}`
                : "（本行均方根）"}
            </span>
          ))}
          <small>每卡只算两行，省掉另一半的重复计算。</small>
        </section>
      )}
      {f.phase === 3 && (
        <section className="wiki-sp-operation">
          <b>
            “{SP_TOKENS[gatherRow]}”：卡{Math.floor(gatherRow / 2)} → 卡{1 - Math.floor(gatherRow / 2)}
          </b>
          <span>{vector(SP_NORMALIZED[gatherRow]!)}</span>
          <strong>原卡保留，另一卡收到同一行。</strong>
          <small>下一次投影需要全部四行，所以此时才补齐。</small>
        </section>
      )}
      {f.phase === 4 && (
        <section className="wiki-sp-operation">
          <b>同一行输入，各卡产生不同输出列</b>
          <span>
            {SP_TOKENS[projection.row]}：{vector(SP_NORMALIZED[projection.row]!)}
          </span>
          <strong>
            {projection.written[projection.row] === 1
              ? `卡0：${+SP_PROJECTED[projection.row]![0]!.toFixed(2)} · 卡1：${+SP_PROJECTED[projection.row]![1]!.toFixed(2)}`
              : "四个通道分别乘本卡权重，再求和"}
          </strong>
          <small>最后并排展示两列，仍分别存于两卡。</small>
        </section>
      )}
    </aside>
  );
}
