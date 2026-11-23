import { INFERENCE_LESSONS, inferenceFrame, kvOwnership } from "./scene-inference";

export function CacheReadout({ progress, onSeek }: { progress: number; onSeek: (p: number) => void }) {
  const f = inferenceFrame(1, progress);
  const lesson = INFERENCE_LESSONS[1];
  const own = kvOwnership(progress);
  const sharing = f.phase >= 3;
  const start = sharing ? 3 : 0;
  const written = f.phase === 2 && f.landed;
  const detail =
    f.phase === 3 && !own.r2
      ? "请求 B 需要相同的前 4 个位置，正在建立指向块 7 的引用；连接落稳前块 7 仍只有 A 这 1 条使用关系。"
      : f.phase === 4 && !f.landed
        ? "A 结束，正在归还它占用的块。撤完后块 2、9 可以再分配；块 7 还要留给 B。"
        : f.phase === 5 && !f.landed
          ? "正在撤掉 B 的最后一条使用关系。撤完后，块 7 才能再分配。"
          : lesson.details[f.phase];
  const premise = !sharing
    ? "一次生成任务是一条请求。蓝色这一行，是位置 6 刚算好、要存下来的 K/V 数据。"
    : f.phase === 3 && !own.r2
      ? "刚才这条请求记作 A，数据已在块 7、2。现在请求 B 也需要前 4 个位置，正在连接块 7。"
      : own.r1 && own.r2
        ? "A 与 B 的块表同时指向块 7：当前两条请求共用同一份前缀数据。"
        : own.r2
          ? "A 已结束并归还块 2、9；块 7 因请求 B 仍在使用（引用数 1）而继续保留。"
          : "A、B 都已结束，块 7、2、9 的引用计数全部归零，均回到空闲池等待下次分配。";
  return (
    <aside className="wiki-inference-readout wiki-cache-readout" aria-label="KV cache 当前讲解">
      <p className="wiki-cache-premise">{premise}</p>
      <ol className="wiki-cache-steps" start={start + 1} aria-label="当前播放阶段">
        {lesson.stages.slice(start, start + 3).map((label, index) => (
          <li key={label}>
            <button
              type="button"
              aria-pressed={f.phase === start + index}
              onClick={() => onSeek((start + index + 0.001) / 6)}
            >
              <span>{start + index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <section className="wiki-cache-current">
        <h4>{written ? "已存进块 2 的第 3 行" : lesson.stages[f.phase]}</h4>
        <p>{detail}</p>
        {!sharing && f.phase > 0 && (
          <div className="wiki-cache-count" role="img" aria-label="4、5、6、7 中，位置 6 排第三">
            {[4, 5, 6, 7].map((position) => (
              <span key={position} data-selected={position === 6 || undefined}>
                {position}
              </span>
            ))}
            <small>这一组的第 3 个位置</small>
          </div>
        )}
        {sharing && (
          <p className="wiki-cache-owners">
            <b>{own.refs[0]}</b> 个请求正在用块 7
          </p>
        )}
      </section>
      <p className="wiki-cache-answer">
        {sharing
          ? own.refs[0] === 2
            ? "关系线连到同一个块 7，显存里的数据始终只有一份。"
            : own.refs[0] === 1
              ? own.r2
                ? "A 已撤回引用，仅剩 B 仍指向块 7，该块继续保留。"
                : "B 的引用正在连接，落稳后引用计数才增为 2。"
              : "引用计数已归零，块回到空闲池；旧内容等到下次分配时覆盖。"
          : written
            ? "位置 6 → 4–7 这一组 → 块 2 → 第 3 行。"
            : "块表记地址，显存块放数据。珊瑚色查地址，钴蓝存数据。"}
      </p>
      <details>
        <summary>{sharing ? "什么情况下能共享？" : "槽位编号与示意数值"}</summary>
        {sharing ? (
          <p>
            共享的是已算好、内容与身份匹配的完整前缀块。最后一条请求结束后，块才能再分配；原内容和前缀登记暂时保留，直到复用或淘汰。
          </p>
        ) : (
          <>
            <p>
              位置从 0 开始计数。块内第 3 行的偏移是 2，因此槽位编号是 2 × 4 + 2 =
              10。它是地址，不是缓存中的数值。
            </p>
            <p>
              每个位置的一行分为 K、V 两部分，本例各取两个示意通道。位置 p 的四个值为 [p, p+1, p+2, p+3]。块 9
              已预留，尚未写入。
            </p>
          </>
        )}
      </details>
    </aside>
  );
}
