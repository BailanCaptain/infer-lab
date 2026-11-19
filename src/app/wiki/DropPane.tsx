import { useCallback, useEffect, useRef, useState } from "react";
import { type DropBatch, type DropItem, dropStates } from "../../content/wiki/drop";
import { wikiRequest } from "./api";
import { DropReceiptView } from "./DropReceiptView";

export function DropPane({
  id,
  hidden,
  onReview,
}: {
  id: string;
  hidden: boolean;
  onReview: (id: string) => void;
}) {
  const [batches, setBatches] = useState<DropBatch[]>([]);
  const [selected, setSelected] = useState<string>();
  const [items, setItems] = useState<DropItem[]>([]);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [why, setWhy] = useState("");
  const [series, setSeries] = useState("");
  const [previous, setPrevious] = useState<string>();
  const [identity, setIdentity] = useState("");
  const [version, setVersion] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const requestKey = useRef(crypto.randomUUID());
  const requestBody = useRef("");
  const current = batches.find((b) => b.id === selected);
  const collecting = !current || current.state === "collecting";
  const load = useCallback(async () => {
    try {
      setBatches((await wikiRequest<{ batches: DropBatch[] }>("drops")).batches);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    if (hidden) return;
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [hidden, load]);
  const perform = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const clear = () => {
    setItems([]);
    setText("");
    setUrl("");
    setIdentity("");
    setVersion("");
    requestKey.current = crypto.randomUUID();
  };
  async function submit() {
    const added = [
      ...items,
      ...(text.trim()
        ? [
            {
              name: "粘贴资料.md",
              text,
              ...(identity.trim() ? { identity: identity.trim() } : {}),
              ...(version.trim() ? { version: version.trim() } : {}),
            },
          ]
        : []),
      ...(url.trim()
        ? [
            {
              name: url.trim(),
              url: url.trim(),
              ...(identity.trim() ? { identity: identity.trim() } : {}),
              ...(version.trim() ? { version: version.trim() } : {}),
            },
          ]
        : []),
    ];
    if (!added.length) throw new Error("请粘贴正文、选择文本文件或填写网页链接");
    const input = { why, series: series || undefined, previous, items: added };
    const serialized = JSON.stringify(input);
    if (serialized !== requestBody.current) {
      requestBody.current = serialized;
      requestKey.current = crypto.randomUUID();
    }
    const response = await wikiRequest<{ batch: DropBatch }>(
      current ? `drops/${current.id}/edit` : "drops",
      current ? { items: added } : { key: requestKey.current, ...input },
    );
    setSelected(response.batch.id);
    clear();
    await load();
  }
  async function action(name: string, body: unknown = {}) {
    if (!current) return;
    const result = await wikiRequest<{ batch: DropBatch }>(`drops/${current.id}/${name}`, body);
    setBatches((bs) => bs.map((b) => (b.id === result.batch.id ? result.batch : b)));
    await load();
  }
  return (
    <section id={id} role="tabpanel" aria-label="Drop 资料" hidden={hidden} className="wiki-drop">
      <p>把资料交给知识库。校对清单后开始处理，整合结果由你整组审阅、批准。</p>
      {error && (
        <p role="alert" className="wiki-panel-error">
          {error}
        </p>
      )}
      <label>
        资料批次
        <select
          aria-label="资料批次"
          value={selected ?? ""}
          onChange={(e) => {
            setSelected(e.target.value || undefined);
            setFeedback("");
            setPrevious(undefined);
          }}
        >
          <option value="">新建批次</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.sources[0]?.name ?? "待修复资料"} · {dropStates[b.state]}
            </option>
          ))}
        </select>
      </label>
      {collecting && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void perform(submit);
          }}
        >
          <label>
            粘贴正文
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                requestKey.current = crypto.randomUUID();
              }}
              rows={7}
            />
          </label>
          <label>
            网页链接
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                requestKey.current = crypto.randomUUID();
              }}
              placeholder="https://…"
            />
          </label>
          <label>
            上传 MD/TXT/RST/JSON/CSV 文件
            <input
              type="file"
              accept=".md,.txt,.rst,.json,.csv"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                void perform(async () => {
                  const next: DropItem[] = [];
                  for (const file of files) {
                    if (file.size > 1024 * 1024) throw new Error(`${file.name} 超过单份 1 MiB`);
                    next.push({
                      name: file.name,
                      text: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()),
                    });
                  }
                  setItems((old) => [...old, ...next]);
                  requestKey.current = crypto.randomUUID();
                });
                e.target.value = "";
              }}
            />
          </label>
          {items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stateless pending file labels; no child state to preserve
            <div key={`${item.name}-${i}`}>
              {item.name}{" "}
              <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                移除
              </button>
              <label>
                来源标识：{item.name}
                <input
                  value={item.identity ?? ""}
                  onChange={(e) =>
                    setItems(
                      items.map((v, j) => (j === i ? { ...v, identity: e.target.value || undefined } : v)),
                    )
                  }
                />
              </label>
              <label>
                版本：{item.name}
                <input
                  value={item.version ?? ""}
                  onChange={(e) =>
                    setItems(
                      items.map((v, j) => (j === i ? { ...v, version: e.target.value || undefined } : v)),
                    )
                  }
                />
              </label>
            </div>
          ))}
          <details>
            <summary>粘贴或链接的来源与版本（选填）</summary>
            <label>
              稳定来源标识
              <input
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="同一资料改版时沿用；未知可留空"
              />
            </label>
            <label>
              版本或日期
              <input value={version} onChange={(e) => setVersion(e.target.value)} />
            </label>
          </details>
          {!current && (
            <>
              <label>
                收录目的（选填）
                <textarea
                  rows={2}
                  value={why}
                  onChange={(e) => {
                    setWhy(e.target.value);
                    requestKey.current = crypto.randomUUID();
                  }}
                />
              </label>
              <label>
                系列名称（选填）
                <input value={series} onChange={(e) => setSeries(e.target.value)} />
              </label>
            </>
          )}
          <button disabled={busy} type="submit">
            {busy ? "预检中…" : current ? "继续补资料" : "接收并预检"}
          </button>
        </form>
      )}
      {current && (
        <div className="wiki-drop-progress">
          <h3>{dropStates[current.state]}</h3>
          <p role="status">{current.stage}</p>
          {current.selection && (
            <p>
              本批模型：{current.selection.provider} / {current.selection.model}
            </p>
          )}
          <p>
            {current.sources.length} 份资料 · {current.calls.length} 次模型调用
            {current.selection?.provider && current.selection.provider !== "claude"
              ? ` · 已记录输出 ${current.calls.reduce((n, c) => n + (c.usage?.output_tokens ?? 0), 0)} tokens`
              : ` · 已知费用 $${current.calls.reduce((n, c) => n + (c.costUsd ?? 0), 0).toFixed(4)}`}
            {current.calls.some((c) => !c.usage && c.costUsd === undefined) && " · 部分调用用量尚未回传"}
          </p>
          {current.error &&
            (current.error.includes("自动修订已达上限") ? (
              <>
                <p role="alert">
                  自动修订已达上限，已停止后续模型调用。资料和进度已保留，可补充修改意见后重试。
                </p>
                <details>
                  <summary>查看失败详情</summary>
                  <p>{current.error}</p>
                </details>
              </>
            ) : (
              <p role="alert">{current.error}</p>
            ))}
          <ul>
            {current.sources.map((s) => (
              <li key={s.item}>
                <strong>{s.name}</strong>
                {s.version && ` · ${s.version}`}
                <p>{s.identity ?? "来源未注明，按内容记录，不猜测归属"}</p>
                {s.omissions.map((note) => (
                  <p key={note}>{note}</p>
                ))}
                <a
                  href={`/api/wiki/raw?ref=${encodeURIComponent(`raw:${s.parsed.slice(4)}#L1`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看已接收文本
                </a>
                {s.raw !== s.parsed && (
                  <a
                    href={`/api/wiki/raw?ref=${encodeURIComponent(`raw:${s.raw.slice(4)}#L1`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {" "}
                    · 查看原文快照
                  </a>
                )}
                {current.state === "collecting" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void perform(() => action("edit", { remove: [s.item] }))}
                  >
                    移出本批
                  </button>
                )}
              </li>
            ))}
          </ul>
          {current.issues.map((i) => (
            <p key={i.item} role="alert">
              {i.name}：{i.reason}{" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => void perform(() => action("edit", { remove: [i.item] }))}
              >
                明确移出本批
              </button>
            </p>
          ))}
          {current.state === "collecting" && (
            <button
              type="button"
              disabled={busy || !!current.issues.length || !current.sources.length}
              onClick={() => void perform(() => action("run"))}
            >
              开始处理
            </button>
          )}
          {current.state === "running" && (
            <button type="button" disabled={busy} onClick={() => void perform(() => action("cancel"))}>
              取消处理
            </button>
          )}
          {["failed", "cancelled", "rejected", "needs-input"].includes(current.state) && (
            <>
              <p>{current.question}</p>
              <label>
                补充或修改意见
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void perform(() => action("run", { retry: true, ...(feedback.trim() ? { feedback } : {}) }))
                }
              >
                按本批模型重试
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void perform(() =>
                    action("run", {
                      retry: true,
                      newAttempt: true,
                      ...(feedback.trim() ? { feedback } : {}),
                    }),
                  )
                }
              >
                使用当前全局模型重新整合
              </button>
            </>
          )}
          {current.reviewId && (
            <button type="button" onClick={() => onReview(current.reviewId!)}>
              查看整组变更
            </button>
          )}
          {current.state === "review" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void perform(() => action("run", { newAttempt: true }))}
            >
              使用当前模型重新整合（旧提案作废）
            </button>
          )}
          {current.state !== "collecting" && (
            <button
              type="button"
              onClick={() => {
                setSeries(current.series ?? current.id);
                setPrevious(current.id);
                setSelected(undefined);
                clear();
              }}
            >
              续传到新批次
            </button>
          )}
          {current.report && (
            <details>
              <summary>整合依据与检查范围</summary>
              <pre>{current.report}</pre>
            </details>
          )}
          {current.receipt && <DropReceiptView receipt={current.receipt} />}
        </div>
      )}
    </section>
  );
}
