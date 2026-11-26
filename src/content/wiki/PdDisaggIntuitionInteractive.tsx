import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
import { stepStopLeft, stepStopRight } from "./PrefillComputeBwInteractive";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const PD_DISAGGREGATION_INTUITION_APPROVED_SHA256 =
  "db947cfbbb13e9001c9056a764c62f1e9bd3d7addb9ce9999709dab6e393bb94";

export const PD_PROMPT_STOPS = [4, 64, 262, 512, 2048, 4096, 6000, 8192] as const;
export const PD_PRESETS = [
  { id: "toy-4", promptTokens: 4, shortBtn: "首屏示意 (4词)" },
  { id: "short-262", promptTokens: 262, shortBtn: "均匀短输入 (262词)" },
  { id: "mid-2048", promptTokens: 2048, shortBtn: "中等长文 (2048词)" },
  { id: "burst-6000", promptTokens: 6000, shortBtn: "长文洪峰 (6000词)" },
] as const;

export type PdDiagramMode = "sandbox" | "svg";

const RUNNING_DECODE_TOKENS = 2; // 生成中的请求 A、B 每步各 1 个新位置
const ASCEND_BLOCK_SIZE = 128;
const QWEN3_KV_KIB_PER_TOK = 144;
const QWEN3_TOTAL_MIB_PER_BLOCK = 18; // 128 * 144 KiB = 18 MiB（TP=2 每卡 9 MiB）
const CHUNK_BUDGET = 2048;

export interface PdDisaggSandboxState {
  readonly promptTokens: number;
  readonly colocatedUnchunkedTokens: number;
  readonly colocatedWidthRatio: number;
  readonly colocatedChunkSteps: number;
  readonly dPoolPureDecodeTokens: 2;
  readonly blocks128Count: number;
  readonly tailUnusedSlots: number;
  readonly logicalKvMiB: number;
  readonly blockAlignedTotalKvMiB: number;
  readonly tp2PerRankBlockMiB: number;
  readonly badgeText: string;
  readonly badgeTone: "default" | "accent" | "warn";
}

export function computePdDisaggState(rawPromptTokens: number): PdDisaggSandboxState {
  const promptTokens = Math.min(8192, Math.max(4, Math.round(rawPromptTokens)));
  const colocatedUnchunkedTokens = RUNNING_DECODE_TOKENS + promptTokens;
  const colocatedWidthRatio = Number((colocatedUnchunkedTokens / RUNNING_DECODE_TOKENS).toFixed(1));
  const perChunkPrefill = CHUNK_BUDGET - RUNNING_DECODE_TOKENS; // 2046
  const colocatedChunkSteps = Math.ceil(promptTokens / perChunkPrefill);

  const blocks128Count = Math.ceil(promptTokens / ASCEND_BLOCK_SIZE);
  const tailUnusedSlots = blocks128Count * ASCEND_BLOCK_SIZE - promptTokens;
  const logicalKvMiB = Number(((promptTokens * QWEN3_KV_KIB_PER_TOK) / 1024).toFixed(2));
  const blockAlignedTotalKvMiB = blocks128Count * QWEN3_TOTAL_MIB_PER_BLOCK;
  const tp2PerRankBlockMiB = blocks128Count * 9;

  let badgeText: string;
  let badgeTone: PdDisaggSandboxState["badgeTone"];

  if (promptTokens <= 16) {
    badgeText = "机制对照 · 同批拼算 vs 跨池传块";
    badgeTone = "accent";
  } else if (promptTokens <= 512) {
    badgeText = "短输入权衡 · 跨池传块与代理开销显著";
    badgeTone = "warn";
  } else {
    badgeText = "长提示词权衡 · 跨池传 KV 换取 D 池零预填阻塞";
    badgeTone = "default";
  }

  return {
    promptTokens,
    colocatedUnchunkedTokens,
    colocatedWidthRatio,
    colocatedChunkSteps,
    dPoolPureDecodeTokens: 2,
    blocks128Count,
    tailUnusedSlots,
    logicalKvMiB,
    blockAlignedTotalKvMiB,
    tp2PerRankBlockMiB,
    badgeText,
    badgeTone,
  };
}

export interface PdDisaggIntuitionInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: PdDiagramMode | undefined;
  readonly initialPromptTokens?: number | undefined;
}

export function PdDisaggIntuitionInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialPromptTokens = 2048,
}: PdDisaggIntuitionInteractiveProps) {
  const [mode, setMode] = useState<PdDiagramMode>(initialMode);
  const [promptTokens, setPromptTokens] = useState<number>(initialPromptTokens);
  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mKv = `${id}-${uid}-pd-kv`;

  const state = useMemo(() => computePdDisaggState(promptTokens), [promptTokens]);

  const applyPrompt = (nextLen: number) => {
    setMode("sandbox");
    setPromptTokens(Math.min(8192, Math.max(4, Math.round(nextLen))));
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
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        applyPrompt(stepStopRight(PD_PROMPT_STOPS, state.promptTokens));
        break;
      case "ArrowLeft":
        event.preventDefault();
        applyPrompt(stepStopLeft(PD_PROMPT_STOPS, state.promptTokens));
        break;
      case "1":
      case "2":
      case "3":
      case "4": {
        event.preventDefault();
        const preset = PD_PRESETS[Number(event.key) - 1];
        if (preset) applyPrompt(preset.promptTokens);
        break;
      }
    }
  };

  const hasMultiChunkInterference = state.promptTokens > 512;

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
      kickerTag="母版 B · 混部 vs 拆池权衡"
      kickerTitle="单池混部同批阻塞 vs P/D 分离跨池整块传 KV 权衡"
      question="把 Prefill 和 Decode 拆到两拨卡上为什么能救尾延迟，什么情况下反而得不偿失？"
      toolbarLabel="新进入提示词长度与混部/拆池对比控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-prompt-tokens": state.promptTokens,
        "data-kv-blocks": state.blocks128Count,
      }}
      toolbar={
        <>
          <label htmlFor={sliderId} className="wiki-edu-slider-chip">
            <span className="mono">{`新提示词 ${state.promptTokens} 词`}</span>
            <input
              id={sliderId}
              type="range"
              min={4}
              max={8192}
              step={1}
              value={state.promptTokens}
              data-testid="pd-prompt-slider"
              aria-valuetext={`新进入提示词长度 ${state.promptTokens} 词元`}
              onPointerDown={() => setMode("sandbox")}
              onChange={(e) => applyPrompt(Number(e.target.value))}
            />
          </label>

          <fieldset className="wiki-edu-btn-row" aria-label="P/D 权衡四档长度预设">
            {PD_PRESETS.map((preset) => {
              const active = mode === "sandbox" && state.promptTokens === preset.promptTokens;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`pd-preset-${preset.id}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => applyPrompt(preset.promptTokens)}
                >
                  {preset.shortBtn}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={state.badgeText}
      takeawayTone={state.badgeTone}
      takeaway={
        state.promptTokens <= 16 ? (
          <>
            机制缩影：混部下在跑的 A、B（各 1 词）被迫与新来的 <strong>{`${state.promptTokens} 词`}</strong>
            凑成 <strong>{`${state.colocatedUnchunkedTokens} 词`}</strong>同批前向；拆池后，P 算提示词期间 D
            池只推进在跑 A、B（
            <strong>2 词/步</strong>，零预填阻塞），按 128 词整块拉回 KV 后新请求才并入 D 池常规解码（变为{" "}
            <strong>3 词/步</strong>纯解码批）。
          </>
        ) : state.promptTokens <= 512 ? (
          <>
            <strong>跨池传块 vs 同批混跑权衡</strong>：<strong>{`${state.promptTokens} 词`}</strong>有效 KV 仅{" "}
            <strong>{`${state.logicalKvMiB} MiB`}</strong>，但按 128 词块对齐实传{" "}
            <strong>{`${state.blocks128Count} 块共 ${state.blockAlignedTotalKvMiB} MiB`}</strong>（双卡每卡{" "}
            <strong>{`${state.tp2PerRankBlockMiB} MiB`}</strong>）；910B3 均匀 262 词实测中，「两跳代理 + 3
            整块搬运 + 双端无图 Eager + 关前缀缓存 + P 池空转」组合导致 TTFT 放大{" "}
            <strong>6.07× / 2.20×</strong>、TPOT 放大 <strong>1.729× / 3.952×</strong>！
          </>
        ) : (
          <>
            <strong>跨池传 KV 换取吐字隔离</strong>：混部不切块时单步词元宽度比达{" "}
            <strong>{`×${state.colocatedWidthRatio}`}</strong>（位置数比，非耗时倍数；2048 预算分块也须连混{" "}
            <strong>{`${state.colocatedChunkSteps} 步`}</strong>打断整图）；拆池本身已隔离长 Prefill
            阻塞（交接前 D 池稳跑 <strong>2 词/步</strong>，收完 KV 并入后跑 <strong>3 词/步</strong>
            纯解码；D 端保留图模式则是为了消除逐词 Eager 下发开销导致的持续 TPOT 劣化）！
          </>
        )
      }
      kpi={`有效 ${state.logicalKvMiB} MiB / 整块实传 ${state.blockAlignedTotalKvMiB} MiB (${state.blocks128Count}块)`}
      detailsSummary="查看工程与源码细节（D拉非P推 / 纯注意力退1格 vs 混合模型截末词 / 910B3 多因素实测边界）"
      detailsContent={
        <>
          <strong>Mooncake V1 交接契约</strong>：代理向 P 发{" "}
          <code>do_remote_decode=True, max_tokens=1, min_tokens=1</code>；P（
          <code>kv_producer</code>，严禁配 <code>kv_both</code>，V2 直接抛 <code>ValueError</code>；非 MLA
          须满足 <code>prefill_tp_size % decode_tp_size == 0</code>）算完押住源块，D（<code>kv_consumer</code>
          ）先分本地目的块再经 <code>batch_transfer_sync_read</code> 按块号拉取（<code>Qwen3-8B</code> 每 128
          词块总计 <code>18 MiB</code>，<code>TP=2</code> 每卡 <code>9 MiB</code>，故{" "}
          <code>{state.promptTokens}</code> 词占 <code>{state.blocks128Count}</code> 块含末块未满{" "}
          <code>{state.tailUnusedSlots}</code> 空槽，实传{" "}
          <code>
            {state.tp2PerRankBlockMiB} MiB/卡 × 2 = {state.blockAlignedTotalKvMiB} MiB
          </code>
          ），收完发信放源块（默认超时 <code>480s</code>；上游 <code>NixlConnector</code> 用 <code>30s</code>{" "}
          租约与 <code>max(t_expire, t_hb + 20)</code> 续期）。纯注意力模型 D 整段命中后退 1
          格重算末词；混合递推模型（
          <code>N&gt;1</code>）由 P 少算末 1 词。
          <strong>Ascend 910B3 多因素组合实测边界</strong>：均匀 <code>262</code>-tok 输入下，
          <code>8B 2P2D</code> 与 <code>30B-A3B 4P4D</code> 同时改变了拆池拓扑、双端{" "}
          <code>--enforce-eager</code>、关闭前缀缓存与 <code>max_model_len=16384</code>（非单变量 A/B），出现
          P 池空转（<code>Running: 0</code>）、 <code>c=1</code> TTFT <code>6.07× / 2.20×</code>、TPOT{" "}
          <code>1.729× / 3.952×</code>、<code>c=16</code> 吞吐降 <code>47.08% ~ 69.50%</code>
          ；是否值得拆池须在同图模式、同缓存与真实流量分布下实测评估。
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className={`wiki-edu-panel${hasMultiChunkInterference ? " is-oom" : ""}`}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 混部单池（同组卡兼顾预填充 + 吐字）</span>
            <span className={`wiki-edu-badge ${hasMultiChunkInterference ? "is-warn" : "is-good"}`}>
              {`单步词元宽度比 ×${state.colocatedWidthRatio}（位置数）`}
            </span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>在跑请求 A、B 与新提示词同批处理</span>
              <span className="mono">
                {`1 + 1 + ${state.promptTokens} = ${state.colocatedUnchunkedTokens} 词`}
              </span>
            </div>
            <div className="wiki-edu-track">
              <div className="wiki-edu-op is-full" style={{ flex: 0.24 }}>
                在跑 2词
              </div>
              <div
                className={`wiki-edu-op ${hasMultiChunkInterference ? "is-bubble" : "is-attn"}`}
                style={{ flex: 0.76 }}
              >
                {`新提示词 ${state.promptTokens}词`}
              </div>
            </div>
          </div>

          <div className="wiki-edu-tok-list">
            <div className={`wiki-edu-tok-pill ${hasMultiChunkInterference ? "is-cow" : "is-priv"}`}>
              <span>同批阻塞与图模式影响（位置数比 ≠ 耗时比）</span>
              <span className="wiki-edu-ptr-tag">
                {hasMultiChunkInterference
                  ? `2048 预算下连混 ${state.colocatedChunkSteps} 步 · 打断纯解码整图`
                  : "短输入干扰轻 · 单池满卡共同分担"}
              </span>
            </div>
            <div className="wiki-edu-tok-pill is-sys">
              <span>910B3 均匀 262 词多因素对照（混部 Graph vs 拆池 Eager）</span>
              <span className="wiki-edu-ptr-tag">8B 首字 6.07× · 吞吐 -47.08%</span>
            </div>
          </div>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② P/D 分离双池（整块拉取 KV vs 吐字隔离）</span>
            <span className="wiki-edu-badge is-mid">
              {`有效 ${state.logicalKvMiB} MiB · 实传 ${state.blockAlignedTotalKvMiB} MiB`}
            </span>
          </div>

          <svg
            viewBox="0 0 340 156"
            width="340"
            height="156"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`PD 分离交接：P 池算 ${state.promptTokens} 词，传 ${state.blocks128Count} 块（每卡 ${state.tp2PerRankBlockMiB} MiB）给 D 池纯解码`}
          >
            <defs>
              <marker
                id={mKv}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#9a4b86" />
              </marker>
            </defs>

            <rect
              x="10"
              y="16"
              width="108"
              height="122"
              rx="8"
              fill="#fff4cf"
              stroke="#c78300"
              strokeWidth="1.5"
            />
            <text x="64" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              P 池预填充
            </text>
            <text x="64" y="68" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {`算 ${state.promptTokens} 词`}
            </text>
            <text x="64" y="94" textAnchor="middle" fontSize="13" fill="#66716d">
              押块等回信
            </text>
            <text x="64" y="120" textAnchor="middle" fontSize="13" fontWeight="700" fill="#c78300">
              {state.promptTokens <= 512 ? "短输入易闲置" : "专扛提示词"}
            </text>

            <line
              className="wiki-edu-wire is-flow"
              x1="120"
              y1="77"
              x2="218"
              y2="77"
              stroke="#9a4b86"
              markerEnd={`url(#${mKv})`}
            />
            <text x="169" y="58" textAnchor="middle" fontSize="13" fontWeight="700" fill="#9a4b86">
              按址拉 KV
            </text>
            <text x="169" y="100" textAnchor="middle" fontSize="13" fill="#66716d">
              {`${state.tp2PerRankBlockMiB} MiB/卡`}
            </text>

            <rect
              x="222"
              y="16"
              width="108"
              height="122"
              rx="8"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.5"
            />
            <text x="276" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              D 池纯解码
            </text>
            <text x="276" y="68" textAnchor="middle" fontSize="13" fontWeight="700" fill="#087f73">
              交接前 2词/步
            </text>
            <text x="276" y="94" textAnchor="middle" fontSize="13" fill="#087f73">
              并入后 3词/步
            </text>
            <text x="276" y="120" textAnchor="middle" fontSize="13" fill="#17211f">
              零预填充阻塞
            </text>
          </svg>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
