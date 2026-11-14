import { INFERENCE_LESSONS, inferenceFrame, kvOwnership } from "./scene-inference";

export function CacheReadout({ progress, onSeek }: { progress: number; onSeek: (p: number) => void }) {
  const f = inferenceFrame(1, progress);
  const lesson = INFERENCE_LESSONS[1];
  const sharing = f.phase >= 3;
  const start = sharing ? 3 : 0;
  const written = f.phase === 2 && f.landed;
  const detail =
    f.phase === 4 && !f.landed
      ? "A 结束，正在归还它占用的块。撤完后块 2、9 可以再分配；块 7 还要留给 B。"
      : f.phase === 5 && !f.landed
        ? "正在撤掉 B 的最后一条使用关系。撤完后，块 7 才能再分配。"
        : lesson.details[f.phase];
  return (
    <aside className="wiki-inference-readout wiki-cache-readout" aria-label="KV cache 当前讲解">
      <p className="wiki-cache-premise">
        {sharing
          ? "刚才这条请求叫 A，蓝色行仍在块 2。现在 B 需要相同的前 4 个位置，直接用已有的块 7。"
          : "一次生成任务是一条请求。蓝色这一行，是位置 6 刚算好、要存下来的 K/V 数据。"}
      </p>
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
            <b>{kvOwnership(progress).refs[0]}</b> 个请求正在用块 7
          </p>
        )}
      </section>
      <p className="wiki-cache-answer">
        {sharing
          ? "关系线连到同一块，数据始终只有一份。"
          : written
            ? "位置 6 → 4–7 这一组 → 块 2 → 第 3 行。"
            : "块表记地址，显存块放数据。金色查地址，蓝色存数据。"}
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
