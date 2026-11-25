import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const PAGED_ATTENTION_WASTE_APPROVED_SHA256 =
  "a9a1a89da3567703e0fbc26d08d72d1be7516e56c73d96013d2bd385467ac0ac";
export const PAGED_ATTENTION_FIG_WASTE_VS_PAGING_APPROVED_SHA256 = PAGED_ATTENTION_WASTE_APPROVED_SHA256;

export const MAX_MODEL_LEN_OPTIONS = [4096, 8192, 16384] as const;
export type MaxModelLenOption = (typeof MAX_MODEL_LEN_OPTIONS)[number];
export type PagedDiagramMode = "sandbox" | "svg";

export const ASCEND_DEFAULT_BLOCK_SIZE = 128;
export const QWEN3_8B_10G_TOTAL_BLOCKS = 568;
export const QWEN3_8B_10G_USABLE_BLOCKS = 567;
export const QWEN3_8B_10G_TOKEN_SLOTS = QWEN3_8B_10G_USABLE_BLOCKS * ASCEND_DEFAULT_BLOCK_SIZE;
export const CONTIG_EXTERNAL_FRAG_RATIO = 0.15;

export interface PagedWasteComparison {
  readonly actualLen: number;
  readonly maxModelLen: MaxModelLenOption;
  readonly externalFragPct: 15;
  readonly externalFragTokens: number;
  readonly usableAfterExternalFrag: number;
  readonly usedBarPct: number;
  readonly contigConcurrency: number;
  readonly contigInternalWastePerReq: number;
  readonly contigWastePct: number;
  readonly blocksPerReq: number;
  readonly tailInternalSlack: number;
  readonly pagedConcurrency: number;
  readonly pagedWastePct: number;
  readonly concurrencyGain: number;
}

export function computePagedWasteComparison(
  rawActualLen: number,
  maxModelLen: MaxModelLenOption,
): PagedWasteComparison {
  const actualLen = Math.min(maxModelLen, Math.max(200, Math.round(rawActualLen / 100) * 100));
  const externalFragTokens = Math.ceil(QWEN3_8B_10G_TOKEN_SLOTS * CONTIG_EXTERNAL_FRAG_RATIO);
  const usableAfterExternalFrag = QWEN3_8B_10G_TOKEN_SLOTS - externalFragTokens;
  const usedBarPct = Number(((actualLen / maxModelLen) * 100).toFixed(2));
  const contigConcurrency = Math.max(1, Math.floor(usableAfterExternalFrag / maxModelLen));
  const contigInternalWastePerReq = Math.max(0, maxModelLen - actualLen);
  const contigUsefulTokens = contigConcurrency * actualLen;
  const contigWastePct = Math.min(
    99,
    Math.max(1, Math.round((1 - contigUsefulTokens / QWEN3_8B_10G_TOKEN_SLOTS) * 100)),
  );

  const blocksPerReq = Math.ceil(actualLen / ASCEND_DEFAULT_BLOCK_SIZE);
  const tailInternalSlack = blocksPerReq * ASCEND_DEFAULT_BLOCK_SIZE - actualLen;
  const pagedConcurrency = Math.max(1, Math.floor(QWEN3_8B_10G_USABLE_BLOCKS / blocksPerReq));
  const pagedUsefulTokens = pagedConcurrency * actualLen;
  const pagedWastePct = Math.max(
    0,
    Math.round((1 - pagedUsefulTokens / (pagedConcurrency * blocksPerReq * ASCEND_DEFAULT_BLOCK_SIZE)) * 100),
  );
  const concurrencyGain = Number((pagedConcurrency / contigConcurrency).toFixed(1));

  return {
    actualLen,
    maxModelLen,
    externalFragPct: 15,
    externalFragTokens,
    usableAfterExternalFrag,
    usedBarPct,
    contigConcurrency,
    contigInternalWastePerReq,
    contigWastePct,
    blocksPerReq,
    tailInternalSlack,
    pagedConcurrency,
    pagedWastePct,
    concurrencyGain,
  };
}

export interface PagedAttentionWasteInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: PagedDiagramMode | undefined;
  readonly initialActualLen?: number | undefined;
  readonly initialMaxModelLen?: MaxModelLenOption | undefined;
}

export function PagedAttentionWasteInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialActualLen = 300,
  initialMaxModelLen = 8192,
}: PagedAttentionWasteInteractiveProps) {
  const [mode, setMode] = useState<PagedDiagramMode>(initialMode);
  const [actualLen, setActualLen] = useState<number>(initialActualLen);
  const [maxModelLen, setMaxModelLen] = useState<MaxModelLenOption>(initialMaxModelLen);
  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-pa-teal`;

  const cmp = useMemo(() => computePagedWasteComparison(actualLen, maxModelLen), [actualLen, maxModelLen]);

  const selectActualLen = (next: number) => {
    setMode("sandbox");
    setActualLen(Math.min(maxModelLen, Math.max(200, Math.round(next / 100) * 100)));
  };

  const selectMaxLen = (next: MaxModelLenOption) => {
    setMode("sandbox");
    setMaxModelLen(next);
    if (actualLen > next) setActualLen(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (shouldPassKeyToRangeInput(event.target, event.key)) return;
    if (
      scrollable &&
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      event.target.classList.contains("wiki-diagram-svg") &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      return;
    }
    const maxIdx = MAX_MODEL_LEN_OPTIONS.indexOf(maxModelLen);
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        selectActualLen(Math.min(3600, cmp.actualLen + 200));
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectActualLen(Math.max(200, cmp.actualLen - 200));
        break;
      case "1":
      case "2":
      case "3":
        event.preventDefault();
        selectMaxLen(MAX_MODEL_LEN_OPTIONS[Number(event.key) - 1]!);
        break;
      default:
        if (maxIdx < 0) break;
    }
  };

  const isTypicalShort = mode === "sandbox" && cmp.actualLen === 300 && maxModelLen === 8192;
  const holeBarPct = Number((100 - cmp.usedBarPct).toFixed(2));

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      onToggleMode={setMode}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 B · 连续调参权衡"
      kickerTitle="PagedAttention（连续预留浪费 vs 128-token 按需分页）"
      question={
        <>
          明明每条对话只聊几百字，为什么传统连续预留一下就把 <span className="mono">10 GiB</span> KV
          池占满了？
        </>
      }
      toolbarLabel="PagedAttention 请求实际长度与预留上限权衡控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-actual-len": cmp.actualLen,
        "data-max-len": cmp.maxModelLen,
      }}
      toolbar={
        <>
          <label htmlFor={sliderId} className="wiki-edu-slider-chip">
            <span>{`实际长度 ${cmp.actualLen} 词`}</span>
            <input
              id={sliderId}
              type="range"
              min={200}
              max={3600}
              step={100}
              value={Math.min(3600, cmp.actualLen)}
              data-testid="paged-actual-len-slider"
              aria-valuetext={`实际长度 ${cmp.actualLen} tokens`}
              onPointerDown={() => setMode("sandbox")}
              onChange={(e) => selectActualLen(Number(e.target.value))}
            />
          </label>

          <fieldset className="wiki-edu-btn-row" aria-label="最大上下文预留上限">
            {MAX_MODEL_LEN_OPTIONS.map((opt) => {
              const active = mode === "sandbox" && maxModelLen === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`paged-maxlen-${opt}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => selectMaxLen(opt)}
                >
                  {`上限 ${opt}`}
                </button>
              );
            })}
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="paged-preset-short"
              aria-pressed={isTypicalShort}
              style={eduBtnStyle(isTypicalShort, "accent")}
              onClick={() => {
                setMode("sandbox");
                setMaxModelLen(8192);
                setActualLen(300);
              }}
            >
              典型短对话 (300/8192)
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={`并发提升 ${cmp.concurrencyGain}×`}
      takeawayTone={cmp.concurrencyGain >= 5 ? "accent" : "default"}
      takeaway={
        <>
          同样 <strong>10 GiB</strong> 池子（Qwen3-8B 共 567 个可借块 = 72,576 格）：连续预留受内部空洞与{" "}
          <strong>15% 外部碎片损耗</strong>双重夹击卡死在 <strong>{`${cmp.contigConcurrency} 条`}</strong>
          ，换成 128 词分页立刻装下 <strong>{`${cmp.pagedConcurrency} 条`}</strong>并发请求！
        </>
      }
      kpi={`连续 ${cmp.contigConcurrency} 条 → 分页 ${cmp.pagedConcurrency} 条`}
      detailsSummary="查看工程与源码细节（Qwen3-8B 18MiB/块 / 15% 外部碎片假设 / 昇腾默认 128 块长）"
      detailsContent={
        <>
          <strong>Qwen3-8B（TP=1, BF16）10 GiB 静态池对账</strong>：每 tok 144 KiB，昇腾默认{" "}
          <code>block_size = 128</code> 时每块固定 <strong>18 MiB</strong>，10 GiB 切 568 块（扣{" "}
          <code>Block 0 = null_block</code> 剩 567 块 = 72,576 格）。左栏连续预留示意扣除 <code>15%</code>{" "}
          退场外部断档夹缝（{cmp.externalFragTokens} 格，剩 {cmp.usableAfterExternalFrag} 格）后按{" "}
          <code>max_model_len={cmp.maxModelLen}</code> 整段圈地；右栏分页下每请求仅借{" "}
          <code>{cmp.blocksPerReq}</code> 块，末块余量仅 <code>{cmp.tailInternalSlack}</code> 格（恒{" "}
          <code>&lt;= 127</code> 格），零外部碎片且公共前缀满块可 <code>ref_cnt</code> 共享！
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className={`wiki-edu-panel${cmp.contigWastePct >= 75 ? " is-oom" : ""}`}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">✗ 传统连续预留（含 15% 外部碎片损耗）</span>
            <span className="wiki-edu-badge is-bad">{`总浪费约 ${cmp.contigWastePct}%`}</span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>{`实写 ${cmp.actualLen} 格（占 ${cmp.usedBarPct}%）`}</span>
              <span className="mono">{`预留 ${cmp.maxModelLen} · 空洞 ${cmp.contigInternalWastePerReq}`}</span>
            </div>
            <div className="wiki-edu-track">
              <div
                className="wiki-edu-op is-piece"
                data-used-pct={cmp.usedBarPct}
                style={{ flex: cmp.usedBarPct, paddingInline: 0 }}
                title={`实写 ${cmp.actualLen} 格 (${cmp.usedBarPct}%)`}
              />
              <div className="wiki-edu-op is-bubble" style={{ flex: holeBarPct }}>
                {`内部预留空洞 ${cmp.contigInternalWastePerReq} 格 + 15% 外部夹缝`}
              </div>
            </div>
          </div>

          <div className="wiki-edu-metrics">
            <div className={`wiki-edu-metric-row${cmp.contigWastePct >= 75 ? " is-oom" : ""}`}>
              <span className="wiki-edu-metric-label">10 GiB 池（扣 15% 外部断档后）最多接纳</span>
              <span className="wiki-edu-metric-val">{`仅 ${cmp.contigConcurrency} 条请求`}</span>
            </div>
          </div>

          <div className="wiki-edu-note-card">
            不知道用户会写多长，只能按 <strong>{cmp.maxModelLen}</strong>{" "}
            提前圈死地皮；退场后留下的散碎夹缝新请求还塞不进！
          </div>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">✓ PagedAttention 分页（128 词/块）</span>
            <span className="wiki-edu-badge is-good">{`末块仅空 ${cmp.tailInternalSlack} 格`}</span>
          </div>

          <svg
            viewBox="0 0 400 76"
            width="400"
            height="76"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label="PagedAttention 等长物理块池与块表寻址"
          >
            <defs>
              <marker
                id={mTeal}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#087f73" />
              </marker>
            </defs>
            <rect
              x="6"
              y="10"
              width="58"
              height="54"
              rx="6"
              fill="#ece9df"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="35" y="33" textAnchor="middle" fontSize="12" fontWeight="700" fill="#66716d">
              B0
            </text>
            <text x="35" y="51" textAnchor="middle" fontSize="12" fill="#66716d">
              保留
            </text>

            <rect
              x="70"
              y="10"
              width="76"
              height="54"
              rx="6"
              fill="#f7e7f2"
              stroke="#9a4b86"
              strokeWidth="1.6"
            />
            <text x="108" y="33" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              B1 共享
            </text>
            <text x="108" y="51" textAnchor="middle" fontSize="12" fill="#9a4b86">
              ref=2
            </text>

            <rect
              x="152"
              y="10"
              width="76"
              height="54"
              rx="6"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.5"
            />
            <text x="190" y="33" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              B2 空闲
            </text>
            <text x="190" y="51" textAnchor="middle" fontSize="12" fill="#087f73">
              随时借
            </text>

            <rect
              x="234"
              y="10"
              width="84"
              height="54"
              rx="6"
              fill="#e8edff"
              stroke="#4c65b6"
              strokeWidth="1.5"
            />
            <text x="276" y="33" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              尾块有界
            </text>
            <text
              x="276"
              y="51"
              textAnchor="middle"
              fontSize="12"
              fill="#4c65b6"
            >{`空 ${cmp.tailInternalSlack} 格`}</text>

            <path
              className="wiki-edu-wire"
              d="M 322 37 L 342 37"
              stroke="#087f73"
              markerEnd={`url(#${mTeal})`}
            />
            <text x="371" y="34" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              567块
            </text>
            <text x="371" y="51" textAnchor="middle" fontSize="12" fill="#66716d">
              零外碎
            </text>
          </svg>

          <div className="wiki-edu-metrics">
            <div className="wiki-edu-metric-row">
              <span className="wiki-edu-metric-label">{`每请求仅借 ${cmp.blocksPerReq} 块（每块 18 MiB）`}</span>
              <span className="wiki-edu-metric-val">{`可同时跑 ${cmp.pagedConcurrency} 条请求（${cmp.concurrencyGain}×）`}</span>
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
