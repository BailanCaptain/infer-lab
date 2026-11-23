import { useMemo } from "react";
import { StableSceneContent } from "./StableSceneContent";
import {
  REQUEST_BODY,
  REQUEST_SENTENCE,
  type RequestState,
  requestState,
  requestStatus,
  requestTransfer,
} from "./scene-request-data";

export function RequestReadout({ state: s }: { state: RequestState }) {
  const sizing = useMemo(
    () =>
      [0, 1, 2, 3].flatMap((section) =>
        [0, 0.249, 0.499, 0.749, 1].map((p) => (
          <RequestReadoutContent key={`${section}/${p}`} state={requestState(section, p)} sizing />
        )),
      ),
    [],
  );
  return (
    <StableSceneContent sizing={sizing}>
      <RequestReadoutContent state={s} />
    </StableSceneContent>
  );
}

function RequestReadoutContent({ state: s, sizing = false }: { state: RequestState; sizing?: boolean }) {
  const stream = s.stream;
  const received = stream?.clientText ?? (s.returned.length ? "先" : "");
  const transfer = requestTransfer(s.section, s.phase);
  return (
    <section className="wiki-request-readout" aria-label="R1 实时数据">
      <div className="wiki-request-transfer">
        <strong>{transfer.title}</strong>
        <p>{transfer.detail}</p>
        {(s.section !== 0 || s.phase !== 0) && (
          <div className="wiki-request-arrival" data-phase={s.handoff.phase}>
            <span className="wiki-request-arrival-dot" aria-hidden="true" />
            {requestStatus(s)}
          </div>
        )}
      </div>
      <div className="wiki-request-conversation">
        <span className="wiki-request-example">教学示例 · R1 四位置缩尺</span>
        <div>
          <small>客户端输入</small>
          <p>{REQUEST_SENTENCE}</p>
        </div>
        <div className="wiki-request-reply">
          <small>客户端已收到 · 原始 content</small>
          <p data-testid={sizing ? undefined : "request-client-text"}>{received || "等待服务端返回…"}</p>
        </div>
      </div>
      <dl>
        {stream ? (
          <>
            {stream.generation && (
              <div>
                <dt>已算位置</dt>
                <dd>
                  {stream.generation.computed}
                  {stream.phase === 1 && stream.generation.verified ? "（8 回退到 6）" : ""}
                </dd>
              </div>
            )}
            <div>
              <dt>确认输出</dt>
              <dd>{stream.confirmed.join(" · ") || "等待第一批"}</dd>
            </div>
            <div>
              <dt>R1 缓存</dt>
              <dd>{stream.cacheReleased ? "引擎已归还" : "保留，供后续生成使用"}</dd>
            </div>
            <div>
              <dt>HTTP 流</dt>
              <dd>{stream.done ? "[DONE] · 已结束" : "保持打开，逐段返回"}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>输入 ID</dt>
              <dd>{s.tokenized ? s.input.join(" · ") : "分词后得到编号"}</dd>
            </div>
            <div>
              <dt>{s.section === 0 ? "调度预记" : "已算位置"}</dt>
              <dd>
                {s.section === 0
                  ? s.phase === 3
                    ? "4（尚不代表执行完成）"
                    : "0"
                  : `${s.computed} / ${s.confirmed.length} 个持有 ID`}
              </dd>
            </div>
            <div>
              <dt>确认 / 候选</dt>
              <dd>
                {s.sampled ? "y₀" : "尚未采样"} / {s.drafts.join(" · ") || "无候选"}
              </dd>
            </div>
          </>
        )}
      </dl>
      {(s.section === 0 || stream) && (
        <details className="wiki-request-wire">
          <summary>
            {stream
              ? stream.waitingFinish
                ? "查看当前 SSE 状态（等待终止事件）"
                : "查看当前 SSE 片段"
              : "查看客户端请求"}
          </summary>
          <p>
            {stream
              ? stream.waitingFinish
                ? "客户端已保留前 3 批文字；当前尚无新增量片段，等待引擎结束事件（finish_reason / [DONE]）。"
                : "只展示 choices 字段；示例片段边界不代表真实 tokenizer 的边界。"
              : "POST /v1/chat/completions；model 必须与部署的服务名一致。句子、输出为示例，不是模型实测。"}
          </p>
          <pre>{stream ? stream.sse : JSON.stringify(REQUEST_BODY, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
