/**
 * Track 3B (#8b): 6 关真实生产故障实战通关场 —— 纯 `sim` 层关卡数据契约与现场标本。
 * 零框架依赖（严禁引用 React / Zustand / `content` / `app`）。
 */

import type { AscendCalcCardId, WeightPrecision } from "../modelspec/deployCalculator";
import { type AscendFamily, type RuleVersion, VERIFIED_COMMITS } from "../rules";

export type WarGameScenarioId =
  | "rank3-oom-ei0006"
  | "910b3-u090-aclgraph-oom"
  | "metrics-preemption-avalanche"
  | "legacy-v030-silent-degrade"
  | "exit-137-cgroup-sigkill"
  | "pd-mooncake-kv-mismatch"
  | "a3-dual-die-static-kernel-trap"
  | "a3-pd-mc2-buffsize-ifname-trap";

export type WarGameOptionId = "A" | "B" | "C" | "D";

export interface WarGameChoiceOption {
  id: WarGameOptionId;
  label: string;
}

export interface WarGameSourceAnchor {
  ref: string;
  note: string;
}

export interface WarGameWikiRef {
  pageId: string;
  anchor?: string | undefined;
  label: string;
}

export interface WarGameTopologyMustKeep {
  targetModelPresetId: "qwen3-30b-a3b" | "qwen3-8b";
  targetModelCanonical: string;
  tpSize: number;
  decodeTpSize?: number | undefined;
  ppSize: number;
  decodePpSize?: number | undefined;
  dpSize: number;
  requireEp: boolean;
  weightPrecision: WeightPrecision;
  requireAscendQuantFlag: boolean;
  minMaxModelLen: number;
  requiredConnector?: string | undefined;
}

export interface WarGameDebrief {
  takeaway: string;
  rootCauseChain: string;
  sourceAnchors: readonly WarGameSourceAnchor[];
  wikiRefs: readonly WarGameWikiRef[];
}

export interface WarGameScenario {
  id: WarGameScenarioId;
  order: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  code: string;
  title: string;
  subtitle: string;
  evidenceBadge: "C" | "M";
  provenanceLabel?: string | undefined;
  topology: "single" | "pd";
  hardwareFamily: AscendFamily;
  decodeHardwareFamily?: AscendFamily | undefined;
  cardId: AscendCalcCardId;
  cardLabel: string;
  version: RuleVersion;
  telemetryKind: "logs" | "metrics" | "logs+metrics";
  telemetryTitle: string;
  telemetryText: string;
  question: {
    prompt: string;
    options: readonly [WarGameChoiceOption, WarGameChoiceOption, WarGameChoiceOption, WarGameChoiceOption];
    correctOptionId: WarGameOptionId;
    explanation: string;
  };
  initialCommand: string;
  initialDecodeCommand?: string | undefined;
  mustKeep: WarGameTopologyMustKeep;
  missionConstraints: readonly string[];
  hints: readonly [string, string, string];
  debrief: WarGameDebrief;
}

export const WARGAME_SCENARIOS: readonly WarGameScenario[] = [
  {
    id: "rank3-oom-ei0006",
    order: 1,
    code: "CASE-01",
    title: "多卡 EI0006 刷屏假象与首错 Rank 3 录图 OOM",
    subtitle: "Atlas A2 64G × 4 · /models/Qwen3-30B-A3B-W8A8 (W8A8_DYNAMIC, TP=4, EP)",
    evidenceBadge: "C",
    topology: "single",
    hardwareFamily: "A2",
    cardId: "a2-64g",
    cardLabel: "Atlas A2 64G × 4",
    version: "v0.30.0",
    telemetryKind: "logs",
    telemetryTitle: "四卡交错合并启动日志（Worker_TP0 ~ Worker_TP3）",
    telemetryText: [
      "2026-04-12 10:10:58.104 INFO [Worker_TP0] [Rank 0] Available KV cache memory: 43.10 GiB (gpu_memory_utilization=0.96)",
      "2026-04-12 10:10:58.118 INFO [Worker_TP1] [Rank 1] Available KV cache memory: 43.10 GiB (gpu_memory_utilization=0.96)",
      "2026-04-12 10:10:58.122 INFO [Worker_TP2] [Rank 2] Available KV cache memory: 43.10 GiB (gpu_memory_utilization=0.96)",
      "2026-04-12 10:10:58.131 INFO [Worker_TP3] [Rank 3] Available KV cache memory: 43.10 GiB (gpu_memory_utilization=0.96)",
      "2026-04-12 10:12:35.402 ERROR [Worker_TP0] [Rank 0] HCCL_E_WAIT_TIMEOUT: EI0006 Getting socket times out! [Wait][LinkEstablish] on AllReduce group tp_0",
      "2026-04-12 10:12:35.419 ERROR [Worker_TP1] [Rank 1] EI0006 Getting socket times out! [Wait][LinkEstablish] during collective setup",
      "2026-04-12 10:12:35.437 ERROR [Worker_TP2] [Rank 2] Watchdog caught collective operation timeout: EI0006 Getting socket times out! [Wait][LinkEstablish]",
      "2026-04-12 10:11:05.214 ERROR [Worker_TP3] [Rank 3] RuntimeError: NPU out of memory. Tried to allocate 1.24 GiB during capture_model() aclgraph pool init",
      "2026-04-12 10:11:05.229 ERROR [Worker_TP3] [Rank 3] EZ9999: Inner Error! ACL_ERROR_RT_MEMORY_ALLOCATION failed on device 3",
      "2026-04-12 10:12:36.011 ERROR [EngineCore_DP0] EngineCoreProc(DP0) died unexpectedly, shutting down client.",
    ].join("\n"),
    question: {
      prompt:
        "日志里 Rank 0/1/2 在 10:12:35 连续报 HCCL EI0006 建链超时，本次启动失败的真正首错卡与根因是什么？",
      options: [
        {
          id: "A",
          label: "Rank 0 在 10:12:35 触发 HCCL 集合通信物理链路闪断，需拉长 HCCL 超时阈值",
        },
        {
          id: "B",
          label:
            "Rank 3 在 10:11:05 因 u=0.96 挤压 1−u 余量，在切完 KV 后的 capture_model() 录图期 NPU OOM，引发其余卡次生 EI0006 套接字建链等待超时",
        },
        {
          id: "C",
          label: "Qwen3-30B-A3B 的 W8A8 权重超出 4×64 GiB 总容量，在 load_model() 阶段即溢出",
        },
        {
          id: "D",
          label: "未开启流水线并行 PP=4，导致单卡 KV Cache 块数不足 1 条 16K 请求",
        },
      ],
      correctOptionId: "B",
      explanation:
        "按时间戳重排交错日志可见 Rank 3 早在 10:11:05 已在 capture_model() 报 NPU OOM 与 EZ9999；Rank 0/1/2 在 90 秒后的 10:12:35 报出的 EI0006 只是等待已死队友的次生建链等待超时假象（区别于算子执行期 Notify 等待超时 EI0002）。",
    },
    initialCommand: `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
export HCCL_BUFFSIZE=1024
vllm serve /models/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 4 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --gpu-memory-utilization 0.96`,
    mustKeep: {
      targetModelPresetId: "qwen3-30b-a3b",
      targetModelCanonical: "/models/Qwen3-30B-A3B-W8A8",
      tpSize: 4,
      ppSize: 1,
      dpSize: 1,
      requireEp: true,
      weightPrecision: "w8a8_dynamic",
      requireAscendQuantFlag: true,
      minMaxModelLen: 16384,
    },
    missionConstraints: [
      "保留量化模型路径 /models/Qwen3-30B-A3B-W8A8、TP=4、--enable-expert-parallel、--quantization ascend 与 --max-model-len >= 16384",
      "保持 ACLGraph 图模式启用（严禁加 --enforce-eager 暴力关图逃课）",
      "将显存水位 --gpu-memory-utilization 回调至安全区间 0.85 ~ 0.90",
    ],
    hints: [
      "提示 1：不要只看刷屏最多的最后几行！把所有 ERROR 行的 HH:MM:SS.mmm 时间戳排个序，找最早出事的那张卡。",
      "提示 2：10:10:58 的 Available KV cache memory 打印于显存探测与初始化阶段（在 initialize_kv_cache 与 capture_model() 之前）；真正定位故障阶段的是 L8 的 capture_model() aclgraph pool init 报错，说明失败发生在第 7 级 ACLGraph 录图阶段。",
      "提示 3：ACLGraph 录图直接消耗预算外 1−u 余量（worker.py 在测算可用显存时还会从预算外扣减 150 MiB 安全裕度建议）；保留原拓扑与图模式，将 --gpu-memory-utilization 从 0.96 调低到 0.85~0.90（如 0.88 或 0.90）。",
    ],
    debrief: {
      takeaway:
        "多卡交错日志排障铁律：先按时间戳找 First-Fault Rank，切勿对次生 EI0006 盲调 HCCL 超时；capture_model() 阶段的 aclgraph OOM 须释放 1−u 预算外余量。",
      rootCauseChain:
        "u=0.96 仅留 4% 预算外余量 → Rank 3 在 worker.py compile_or_warm_up_model() -> capture_model() 申请图池显存报 EZ9999/OOM 退出 → Rank 0/1/2 在后续建链/同步阶段等不到已死队友，90s 后刷出次生 EI0006（Getting socket times out）。",
      sourceAnchors: [
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L907-L949`,
          note: "compile_or_warm_up_model() 在切完 KV 池后执行 capture_model()，消耗 1−u 预算外显存。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L942-L951`,
          note: "HCCL 算子等待超时链与多进程 RPC 超时联动。",
        },
      ],
      wikiRefs: [
        { pageId: "inference-troubleshooting", label: "推理排障入口（首错 Rank 定位）" },
        { pageId: "kv-cache-memory-profiling", label: "KV 显存探测与 7 级冷启动账本" },
        { pageId: "cann-hccl", label: "CANN 与 HCCL 集合通信" },
      ],
    },
  },
  {
    id: "910b3-u090-aclgraph-oom",
    order: 2,
    code: "CASE-02",
    title: "910B3 KV 划完后 FULL_AND_PIECEWISE 录图期 OOM",
    subtitle: "单卡 a2-64g Qwen/Qwen3-8B 预算改编题 [C]（内附 Qwen3-0.6B u=0.90 真机原栈 [M]）",
    evidenceBadge: "C",
    topology: "single",
    hardwareFamily: "A2",
    cardId: "a2-64g",
    cardLabel: "Atlas A2 64G × 1 (910B3)",
    version: "v0.30.0",
    telemetryKind: "logs",
    telemetryTitle: "Qwen3-8B (u=0.95) 改编复现现场 [C] + 910B3 Qwen3-0.6B (u=0.90) 真机捕获调用栈 [M]",
    telemetryText: [
      "# [C] 本关教学推演现场：单卡 Qwen/Qwen3-8B (u=0.95 + FULL_AND_PIECEWISE，机制同源真机标本)：",
      "(EngineCore pid=38102) INFO [model_runner_v1.py:4476] Loading model weights took 15.26 GiB",
      "(EngineCore pid=38102) INFO [worker.py:660] Available KV cache memory: 39.42 GiB (gpu_memory_utilization=0.95)",
      "# [M] 同源 Ascend 910B3 真机捕获调用栈标本（real-910b3-u090-aclgraph-oom，Qwen3-0.6B u=0.90，OS 可见 60.96 GiB）：",
      '(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/worker/model_runner_v1.py", line 6613, in capture_model',
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]     cuda_graph_size = GPUModelRunner.capture_model(self)",
      '(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/device/device_op.py", line 216, in npu_fused_infer_attention_score',
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 1.98 GiB (NPU 0; 60.96 GiB total capacity; 54.62 GiB already allocated; 1.71 GiB free; 58.75 GiB reserved in total by PyTorch).",
      '(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]   File "/mnt/workspace/src/vllm_ascend-0.30.0/vllm_ascend/worker/worker.py", line 909, in compile_or_warm_up_model',
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]     npugraph_memory_bytes = self.model_runner.capture_model()",
    ].join("\n"),
    question: {
      prompt:
        "Available KV cache memory 已划完，却在 capture_model -> npu_fused_infer_attention_score 抛 OutOfMemoryError，根因与正确处置是？",
      options: [
        {
          id: "A",
          label: "单卡 64 GiB 放不下 Qwen3-8B BF16 权重，必须扩成 TP=4 四卡切分",
        },
        {
          id: "B",
          label: "KV Cache 块大小 128 触发内存泄漏，改成 --block-size 16 即可消除录图开销",
        },
        {
          id: "C",
          label:
            "910B3 实机 OS 可见约 60.96 GiB 且 FULL_AND_PIECEWISE 双路录图开销大，u=0.95 把 1−u 余量压得太薄；须保图模式并降 u<=0.88（或切 FULL_DECODE_ONLY + u<=0.90）",
        },
        {
          id: "D",
          label: "昇腾 910B3 不支持图捕获，线上生产应统一加 --enforce-eager 永久关闭 ACLGraph",
        },
      ],
      correctOptionId: "C",
      explanation:
        "910B3 标称 64 GB 但扣除系统预留后 OS 可见约 60.96 GiB [M]；FULL_AND_PIECEWISE 同时录制分段图与整图，u=0.95 剩下的余量不足以支撑 FIA 图工作区分配。关图会严重劣化 Decode ITL，正确做法是保图降 u 或收紧为 FULL_DECODE_ONLY。",
    },
    initialCommand: `export ASCEND_RT_VISIBLE_DEVICES=0
vllm serve Qwen/Qwen3-8B \\
    --served-model-name qwen3-8b \\
    --max-model-len 8192 \\
    --gpu-memory-utilization 0.95 \\
    --compilation-config '{"cudagraph_mode":"FULL_AND_PIECEWISE"}'`,
    mustKeep: {
      targetModelPresetId: "qwen3-8b",
      targetModelCanonical: "Qwen/Qwen3-8B",
      tpSize: 1,
      ppSize: 1,
      dpSize: 1,
      requireEp: false,
      weightPrecision: "bf16",
      requireAscendQuantFlag: false,
      minMaxModelLen: 8192,
    },
    missionConstraints: [
      "保留单卡 TP=1、目标模型 Qwen/Qwen3-8B 与 --max-model-len >= 8192",
      "禁止使用 --enforce-eager 或 cudagraph_mode=NONE 逃课，必须保持 ACLGraph 图模式启用",
      "路线一：保留图模式并将 --gpu-memory-utilization 降至 <= 0.88；路线二：切换 cudagraph_mode 为 FULL_DECODE_ONLY 并设 u <= 0.90",
    ],
    hints: [
      "提示 1：观察报错栈底部 worker.py:909 compile_or_warm_up_model -> model_runner_v1.py:6613 capture_model，这是 KV 池划完之后的录图阶段。",
      "提示 2：FULL_AND_PIECEWISE 需要录制更多图档位（且还会静默重置 npugraph_ex），而 --enforce-eager 会损失线上 Decode 吞吐与延迟。",
      '提示 3：把 --gpu-memory-utilization 调到 0.88（或 0.85），或者把 cudagraph_mode 改为 "FULL_DECODE_ONLY" 同时将 u 设为 0.90。',
    ],
    debrief: {
      takeaway:
        "标称 64G 卡在 OS 层可见约 60.96 GiB [M]，高水位 u 叠加重度图模式极易在 KV 切完后的 FULL 录图期因差几百 MiB 爆显存；线上应保图控 u 或选 FULL_DECODE_ONLY。",
      rootCauseChain:
        "本关 Qwen3-8B 在 u=0.95 下把 1−u 预算外余量压至约 3.2 GiB，不足以容纳 FULL_AND_PIECEWISE 双路图池而触发 capture_model() OOM（机制同源标本 Qwen3-0.6B u=0.90 实测在 npu_fused_infer_attention_score 申请 1.98 GiB 时因仅剩 1.71 GiB 空闲显存报错 [M]）。",
      sourceAnchors: [
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/model_runner_v1.py#L6610-L6618`,
          note: "NPUModelRunner.capture_model 调用上游 GPUModelRunner.capture_model 捕获多档批形状图。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/device_op.py#L212-L224`,
          note: "npu_fused_infer_attention_score 在 FULL Decode 图捕获期分配算子工作区。",
        },
      ],
      wikiRefs: [
        { pageId: "acl-graph", label: "ACL Graph 捕获、批形状与显存开销" },
        { pageId: "kv-cache-memory-profiling", label: "KV 显存探测与 1−u 余量账" },
      ],
    },
  },
  {
    id: "metrics-preemption-avalanche",
    order: 3,
    code: "CASE-03",
    title: "高并发 /metrics 抢占雪崩与 KV 块池枯竭抖动",
    subtitle: "Atlas A2 64G × 1 · Qwen/Qwen3-8B · kv_cache_usage_perc=99.8% + num_preemptions 暴涨",
    evidenceBadge: "C",
    topology: "single",
    hardwareFamily: "A2",
    cardId: "a2-64g",
    cardLabel: "Atlas A2 64G × 1",
    version: "v0.30.0",
    telemetryKind: "metrics",
    telemetryTitle: "高峰期 Prometheus /metrics 采样快照（ITL 尖峰与吞吐塌方现场）",
    telemetryText: [
      "# --- curl -s http://127.0.0.1:8000/metrics (t=0s -> t=60s 采样) ---",
      "# TYPE vllm:kv_cache_usage_perc gauge",
      'vllm:kv_cache_usage_perc{engine="0",model_name="qwen3-8b"} 0.998',
      "# TYPE vllm:num_requests_running gauge",
      'vllm:num_requests_running{engine="0",model_name="qwen3-8b"} 212',
      "# TYPE vllm:num_requests_waiting gauge",
      'vllm:num_requests_waiting{engine="0",model_name="qwen3-8b"} 148',
      "# TYPE vllm:num_preemptions_total counter  (60s 前为 1530，每分钟新增 +312 次抢占重算)",
      'vllm:num_preemptions_total{engine="0",model_name="qwen3-8b"} 1842',
      "# TYPE vllm:inter_token_latency_seconds summary",
      'vllm:inter_token_latency_seconds_sum{engine="0",model_name="qwen3-8b"} 294.6',
      'vllm:inter_token_latency_seconds_count{engine="0",model_name="qwen3-8b"} 1000',
    ].join("\n"),
    question: {
      prompt:
        "线上 Qwen3-8B 在共享长系统提示词流量高峰期出现大量卡顿，/metrics 显示 kv_cache_usage_perc=0.998、waiting=148、num_preemptions_total 持续暴涨，根因与正确止血组合是？",
      options: [
        {
          id: "A",
          label:
            "ACLGraph 图回放导致显存碎片，应加 --enforce-eager 关闭图捕获并把 --max-num-seqs 调大到 1024",
        },
        {
          id: "B",
          label:
            "并发上限 --max-num-seqs=512 过激、--gpu-memory-utilization=0.72 偏低且误关了 Prefix Caching，导致物理 KV 块耗尽触发调度器反复驱逐与前缀重算（Preemption 雪崩）；应收敛 max-num-seqs<=128、恢复 u=0.86~0.90 并开启 --enable-prefix-caching",
        },
        {
          id: "C",
          label: "HCCL 跨卡通信死锁引发排队，需要在单卡上额外导出 HCCL_BUFFSIZE=2048",
        },
        {
          id: "D",
          label: "采样温度过高导致 EOS 无法生成，只能把 --max-model-len 砍到 512 强行截断",
        },
      ],
      correctOptionId: "B",
      explanation:
        "kv_cache_usage_perc 顶满 99.8% 伴随 waiting 积压与 num_preemptions_total 飙升是典型的 KV 块池枯竭抢占风暴：在途序列被驱逐释放块后又必须整段重算 Prefill，形成正反馈吞吐雪崩。收敛 --max-num-seqs、合理释放 u 至 0.86~0.90 并打开 Prefix Caching 复用共享系统提示词即可止血。",
    },
    initialCommand: `export ASCEND_RT_VISIBLE_DEVICES=0
vllm serve Qwen/Qwen3-8B \\
    --served-model-name qwen3-8b \\
    --max-model-len 32768 \\
    --max-num-seqs 512 \\
    --no-enable-prefix-caching \\
    --gpu-memory-utilization 0.72`,
    mustKeep: {
      targetModelPresetId: "qwen3-8b",
      targetModelCanonical: "Qwen/Qwen3-8B",
      tpSize: 1,
      ppSize: 1,
      dpSize: 1,
      requireEp: false,
      weightPrecision: "bf16",
      requireAscendQuantFlag: false,
      minMaxModelLen: 32768,
    },
    missionConstraints: [
      "保留单卡 TP=1、目标模型 Qwen/Qwen3-8B 与 --max-model-len >= 32768（严禁缩减上下文或关图逃课）",
      "将过激的并发在途上限 --max-num-seqs 收敛至 16 ~ 128 安全区间，并将 --gpu-memory-utilization 调回 0.86 ~ 0.90",
      "移除 --no-enable-prefix-caching 并启用前缀缓存复用（显式传 --enable-prefix-caching 或恢复默认开启）",
    ],
    hints: [
      "提示 1：紧盯三联指标：kv_cache_usage_perc=0.998（块池见底）+ waiting=148 + num_preemptions_total 持续跳增，这是调度器在反复踢出在途请求重算。",
      "提示 2：当前命令一边只给了 u=0.72 的偏低显存预算，一边放行 --max-num-seqs 512 条并发，还加了 --no-enable-prefix-caching 禁止复用共享系统提示词。",
      "提示 3：把 --max-num-seqs 改为 64（或 128），把 --gpu-memory-utilization 调到 0.88（或 0.90），并将 --no-enable-prefix-caching 替换为 --enable-prefix-caching。",
    ],
    debrief: {
      takeaway:
        "高并发抖动先看 /metrics 三联征（kv_cache_usage_perc > 95% + waiting > 0 + num_preemptions 递增）：盲目放大 max-num-seqs 只会把连续批处理拖入驱逐重算风暴。",
      rootCauseChain:
        "u=0.72 压缩可用 KV 池 + max_num_seqs=512 放行过多并发 + 关闭 Prefix Caching 重复占用块 → 序列增长瞬间耗尽空闲块 → 调度器触发 Recompute 抢占驱逐 → 重算 Prefill 抢占算力令 ITL 飙至 294 ms/tok。",
      sourceAnchors: [
        {
          ref: `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/metrics/loggers.py#L508-L517`,
          note: "Prometheus 导出 num_requests_running / num_requests_waiting 与 KV 池使用率指标。",
        },
        {
          ref: `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/metrics/loggers.py#L566-L572`,
          note: "num_preemptions_total 累计调度器因 KV 块不足触发的请求抢占次数。",
        },
      ],
      wikiRefs: [
        { pageId: "continuous-batching", label: "Continuous Batching 连续批处理与抢占机制" },
        { pageId: "paged-attention", label: "PagedAttention 物理块分配与水位边界" },
        { pageId: "prefix-caching", label: "Prefix Caching 共享前缀块复用" },
      ],
    },
  },
  {
    id: "legacy-v030-silent-degrade",
    order: 4,
    code: "CASE-04",
    title: "910B3 升级 v0.30.0 静默退化与稳态吞吐腰斩",
    subtitle: "Atlas A2 64G × 1 (910B3) · Qwen/Qwen3-8B · 吞吐 1,840 → 790 tok/s (-57%), ITL 138 ms",
    evidenceBadge: "C",
    topology: "single",
    hardwareFamily: "A2",
    cardId: "a2-64g",
    cardLabel: "Atlas A2 64G × 1 (910B3)",
    version: "v0.30.0",
    telemetryKind: "logs+metrics",
    telemetryTitle: "升级前后压测吞吐对照与 v0.30.0 /metrics 快照（低 KV 零排队吞吐腰斩）",
    telemetryText: [
      "# --- 升级前后同压测负载（batch=16, input=1024, output=512）对照 ---",
      "# [升级前 v0.26 基线] output_throughput: 1,840 tok/s | mean_itl: 18.6 ms/tok | aclgraph: PIECEWISE",
      "# [升级后 v0.30 现状] output_throughput:   790 tok/s (-57% 腰斩) | mean_itl: 138.4 ms/tok",
      "2026-04-15 11:20:04.018 INFO [APIServer] vLLM-Ascend version: 0.30.0, non-default args: {'enforce_eager': True, 'gpu_memory_utilization': 0.9}",
      "2026-04-15 11:20:19.512 INFO [worker.py:904] enforce_eager=True, skipping ACLGraph capture_model()",
      "# --- curl -s http://127.0.0.1:8000/metrics ---",
      "# TYPE vllm:kv_cache_usage_perc gauge",
      'vllm:kv_cache_usage_perc{engine="0",model_name="qwen3-8b"} 0.21',
      "# TYPE vllm:num_requests_running gauge",
      'vllm:num_requests_running{engine="0",model_name="qwen3-8b"} 4',
      "# TYPE vllm:num_requests_waiting gauge",
      'vllm:num_requests_waiting{engine="0",model_name="qwen3-8b"} 0',
      "# TYPE vllm:num_preemptions_total counter",
      'vllm:num_preemptions_total{engine="0",model_name="qwen3-8b"} 0',
      'vllm:inter_token_latency_seconds_sum{engine="0",model_name="qwen3-8b"} 138.4',
      'vllm:inter_token_latency_seconds_count{engine="0",model_name="qwen3-8b"} 1000',
    ].join("\n"),
    question: {
      prompt:
        "从 v0.26 升级到 v0.30.0 后服务虽未崩，但关闭 NZ 未生效且低并发零排队下平均 Decode ITL 高达 138.4 ms/tok，根因是？",
      options: [
        {
          id: "A",
          label: "KV Cache 块池耗尽引发高频重算抢占（Preemption），需把 --gpu-memory-utilization 拉高到 0.98",
        },
        {
          id: "B",
          label: "v0.30.0 默认把单卡推理切成了跨节点 RoCE 通信，导致每 token 额外等待网络 RTT",
        },
        {
          id: "C",
          label:
            "VLLM_ASCEND_ENABLE_NZ 在 v0.30.0 已彻底下线（源码 0 处读取、静默无效，须改传 additional_config.weight_nz_mode=0），且旧脚本遗留的 --enforce-eager 跳过 ACLGraph 放大了 Host 逐算子发射空泡",
        },
        {
          id: "D",
          label: "OMP_NUM_THREADS 默认被设成 128 导致 CPU 锁死，只需加 export OMP_NUM_THREADS=64",
        },
      ],
      correctOptionId: "C",
      explanation:
        "/metrics 中 kv_cache_usage_perc=0.21、waiting=0、preemptions=0 直接排除容量与排队瓶颈；v0.30.0 已移除 VLLM_ASCEND_ENABLE_NZ（须改用 weight_nz_mode:0），同时 --enforce-eager 关掉图回放使小批 Decode 受困于 Host 发射开销。",
    },
    initialCommand: `export ASCEND_RT_VISIBLE_DEVICES=0
export VLLM_ASCEND_ENABLE_NZ=0
vllm serve Qwen/Qwen3-8B \\
    --served-model-name qwen3-8b \\
    --max-model-len 8192 \\
    --gpu-memory-utilization 0.90 \\
    --enforce-eager`,
    mustKeep: {
      targetModelPresetId: "qwen3-8b",
      targetModelCanonical: "Qwen/Qwen3-8B",
      tpSize: 1,
      ppSize: 1,
      dpSize: 1,
      requireEp: false,
      weightPrecision: "bf16",
      requireAscendQuantFlag: false,
      minMaxModelLen: 8192,
    },
    missionConstraints: [
      "保留单卡 TP=1、目标模型 Qwen/Qwen3-8B 与 --max-model-len >= 8192",
      "彻底移除 v0.30.0 已退役的环境变量 VLLM_ASCEND_ENABLE_NZ，改用 --additional-config '{\"weight_nz_mode\":0}'",
      "移除 --enforce-eager 并保持 ACLGraph 图模式启用（如默认或显式 FULL_DECODE_ONLY）",
    ],
    hints: [
      "提示 1：看 /metrics：KV 占用仅 21%、waiting=0、preemptions=0，但 138.4s / 1000 tok = 138.4 ms/tok，说明慢在单步执行与 Host 调度而非排队。",
      "提示 2：v0.30.0 的 vllm_ascend/envs.py 精简至 14 项，VLLM_ASCEND_ENABLE_NZ 已被删除，继续 export 它不会报错但完全无效。",
      "提示 3：删掉 export VLLM_ASCEND_ENABLE_NZ=0 和 --enforce-eager，补上 --additional-config '{\"weight_nz_mode\":0}'。",
    ],
    debrief: {
      takeaway:
        "跨大版本升级必查退役环境变量与历史调试开关：v0.30.0 下 NZ 入口统一收敛至 additional_config.weight_nz_mode，且生产环境切忌遗留排障时临时加的 --enforce-eager。",
      rootCauseChain:
        "VLLM_ASCEND_ENABLE_NZ=0 在 v0.30.0 无读取点静默失效 + --enforce-eager 跳过 capture_model() → 小批 Decode 退化为逐算子 Host 发射 → 低 KV 零排队下 ITL 飙至百毫秒级。",
      sourceAnchors: [
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/configuration/additional_config.md#L57-L64`,
          note: "官方声明 VLLM_ASCEND_ENABLE_NZ 等旧环境变量下线并迁移至 additional_config。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L614-L635`,
          note: "AscendConfig.weight_nz_mode（0=关闭, 1=仅量化权重默认, 2=量化+浮点）单一入口校验。",
        },
      ],
      wikiRefs: [
        { pageId: "ascend-config-system", label: "AscendConfig 配置系统与版本迁移" },
        { pageId: "tensor-layout", label: "ND 与 FRACTAL_NZ 张量布局边界" },
        { pageId: "inference-performance-troubleshooting", label: "推理性能排障（低 KV 高 ITL 分流）" },
      ],
    },
  },
  {
    id: "exit-137-cgroup-sigkill",
    order: 5,
    code: "CASE-05",
    title: "加载分片 exitcode -9 / 137 (SIGKILL) 与错写 CUDA 切卡变量",
    subtitle: "Atlas A2 64G × 4 · /models/Qwen3-30B-A3B-W8A8 分片加载中途猝死（无 NPU OOM 栈）",
    evidenceBadge: "C",
    topology: "single",
    hardwareFamily: "A2",
    cardId: "a2-64g",
    cardLabel: "Atlas A2 64G × 4",
    version: "v0.30.0",
    telemetryKind: "logs",
    telemetryTitle: "多卡容器加载 safetensors 分片猝死日志（无 NPU OOM Traceback）",
    telemetryText: [
      "2026-04-16 09:33:08.120 INFO [Worker_TP0] Initializing NPUWorker on Ascend910B2 (64.00 GiB HBM)",
      "2026-04-16 09:33:10.812 INFO [Worker_TP0] Loading safetensors checkpoint shards:   25% Completed | 4/16 [00:09<00:28]",
      "2026-04-16 09:33:11.004 INFO [Worker_TP1] Loading safetensors checkpoint shards:   25% Completed | 4/16 [00:09<00:28]",
      "2026-04-16 09:33:24.991 ERROR [EngineCore_DP0] EngineCoreProc died unexpectedly with exitcode: -9 (SIGKILL, container exit code 137)",
      "2026-04-16 09:33:25.004 ERROR [APIServer] RuntimeError: Engine core initialization failed. See root cause above.",
      "# 现场容器补充信息：docker run 配置 --shm-size=64m 与 --memory=32g（/dev/shm 仅 64M，cgroup memory.max=32Gi），已挂载宿主机 0..3 号达芬奇 NPU 设备、驱动与 /models 本地权重目录，全程无 ACL_ERROR_RT_MEMORY_ALLOCATION",
    ].join("\n"),
    question: {
      prompt:
        "加载 safetensors 分片至 4/16 时突发 exitcode: -9 (SIGKILL / 137) 且无任何 NPU OOM 栈，同时命令写了 CUDA_VISIBLE_DEVICES=0,1,2,3，正确判断与处置是？",
      options: [
        {
          id: "A",
          label: "这是典型的 NPU HBM 显存溢出，必须把 --gpu-memory-utilization 大幅砍到 0.45 才能启动",
        },
        {
          id: "B",
          label:
            "exitcode -9 / 137 且无 NPU OOM 栈首要指向宿主机/容器层 SIGKILL（需结合同 PID/时间窗核实 OOMKilled / cgroup memory.events / dmesg 及 64M /dev/shm，先放宽容器 --memory 与 --shm-size=16g 而非乱砍 u）；同时切卡变量须改为 ASCEND_RT_VISIBLE_DEVICES=0,1,2,3",
        },
        {
          id: "C",
          label: "safetensors 分片格式与昇腾不兼容，必须离线转成单文件 PyTorch .bin 权重",
        },
        {
          id: "D",
          label: "CUDA_VISIBLE_DEVICES 在昇腾上会自动触发操作系统内核发送 SIGKILL 强杀进程",
        },
      ],
      correctOptionId: "B",
      explanation:
        "NPU HBM 不足通常会抛出 Python RuntimeError / OutOfMemoryError 与 ACL 错误码；子进程在加载分片期无栈猝死并报 -9 (137) 说明收到外部 SIGKILL，首要候选根因是容器 cgroup DRAM 触顶（OOMKilled）或 64M /dev/shm 不足（定论前须对齐同进程与同时间窗的 docker inspect OOMKilled / cgroup memory.events / dmesg 记录），乱砍 gpu_memory_utilization 无济于事。同时昇腾切卡只认 ASCEND_RT_VISIBLE_DEVICES。",
    },
    initialCommand: `docker run -d --name vllm-qwen30b --shm-size=64m --memory=32g --device=/dev/davinci0 --device=/dev/davinci1 --device=/dev/davinci2 --device=/dev/davinci3 --device=/dev/davinci_manager --device=/dev/devmm_svm --device=/dev/hisi_hdc -v /usr/local/dcmi:/usr/local/dcmi -v /usr/local/bin/npu-smi:/usr/local/bin/npu-smi -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/ -v /usr/local/Ascend/driver/version.info:/usr/local/Ascend/driver/version.info -v /etc/ascend_install.info:/etc/ascend_install.info -v /models:/models -e CUDA_VISIBLE_DEVICES=0,1,2,3 quay.io/ascend/vllm-ascend:v0.30.0 \\
  vllm serve /models/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 4 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --gpu-memory-utilization 0.90`,
    mustKeep: {
      targetModelPresetId: "qwen3-30b-a3b",
      targetModelCanonical: "/models/Qwen3-30B-A3B-W8A8",
      tpSize: 4,
      ppSize: 1,
      dpSize: 1,
      requireEp: true,
      weightPrecision: "w8a8_dynamic",
      requireAscendQuantFlag: true,
      minMaxModelLen: 16384,
    },
    missionConstraints: [
      "同时修复 docker run 容器参数与内层服务启动：将 --shm-size 调大至 >= 16g（或改用 --ipc=host），放宽 --memory=32g 硬限（调至 >= 128g 或移除），保留 NPU 设备映射、宿主机 Ascend 驱动挂载及 /models 权重挂载并确保 vllm serve 在容器内启动",
      "移除无效的 CUDA_VISIBLE_DEVICES，改为通过 docker run -e ASCEND_RT_VISIBLE_DEVICES=0,1,2,3（或容器内 env ASCEND_RT_VISIBLE_DEVICES=0,1,2,3）切卡（禁止乱砍 --gpu-memory-utilization，保持 0.85 ~ 0.92）",
      "保留 quay.io/ascend/vllm-ascend:v0.30.0（或其他匹配 Ascend NPU 服务镜像）、/models/Qwen3-30B-A3B-W8A8、TP=4、--enable-expert-parallel、--quantization ascend 与图模式",
    ],
    hints: [
      "提示 1：区分主机 DRAM 与设备 NPU HBM！如果是 NPU HBM 爆了，PyTorch/CANN 会打印 OutOfMemoryError 栈；无栈 exitcode -9 / 137 代表进程收到 SIGKILL，应优先核查容器内存与共享内存配置。",
      "提示 2：4 个 Worker 并发映射 safetensors 分片并建立多进程队列时，docker run 的 --shm-size=64m 与 --memory=32g 极易触发共享内存不足或 cgroup OOM（线上排障应同步核对 docker inspect OOMKilled / memory.events / dmesg，并将容器参数调至 --shm-size=16g --memory=128g）。",
      "提示 3：保留容器内启动 vllm serve、--device=/dev/davinci0..3 等 NPU 设备映射、宿主机 Ascend 驱动挂载及 -v /models:/models 权重挂载，将 --shm-size=64m --memory=32g 调至 --shm-size=16g --memory=128g，把 -e CUDA_VISIBLE_DEVICES=0,1,2,3 改为 -e ASCEND_RT_VISIBLE_DEVICES=0,1,2,3，保持 --gpu-memory-utilization 0.90。",
    ],
    debrief: {
      takeaway:
        "遇到 exitcode -9 / 137 且无 NPU OOM 栈，先对齐同进程 PID 与时间窗核实 docker inspect OOMKilled、cgroup memory.events 与 dmesg，并排查过小的 --shm-size（如本例 64m，须调至 >= 16g）与过低的容器内存限额（如本例 32g，须调至 >= 128g），切忌反射式缩减 NPU KV 预算；切卡环境变量只认 ASCEND_RT_VISIBLE_DEVICES。",
      rootCauseChain:
        "4 个 Worker 并发读取 safetensors 分片与共享内存队列时出现无栈 SIGKILL (137)，结合 --shm-size=64m 与 cgroup memory.max=32Gi 现场高度指向容器 cgroup DRAM 触顶或 /dev/shm 耗尽（须用同进程同时间窗的 OOMKilled / cgroup memory.events / dmesg 记录最终坐实）；同时脚本误用 CUDA_VISIBLE_DEVICES，NPUPlatform 完全不读取该变量。",
      sourceAnchors: [
        {
          ref: `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/engine/utils.py#L262-L285`,
          note: "EngineCoreProc 监控子进程非零退出码并报告 exitcode: -9 (SIGKILL)。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L94-L98`,
          note: "NPUPlatform.device_control_env_var 固定为 ASCEND_RT_VISIBLE_DEVICES。",
        },
      ],
      wikiRefs: [
        { pageId: "device-memory", label: "主机内存、容器 cgroup 与设备 HBM 分账" },
        { pageId: "ascend-env-and-serve", label: "容器 --shm-size=16g 与切卡环境变量" },
        { pageId: "inference-troubleshooting", label: "推理排障入口（退出码 137 三步核查）" },
      ],
    },
  },
  {
    id: "pd-mooncake-kv-mismatch",
    order: 6,
    code: "CASE-06",
    title: "Mooncake P/D 跨实例 TP 切分、角色与 C8 KV 失配",
    subtitle: "Atlas A3 · /models/Qwen3-30B-A3B-W8A8 (目标 4P TP=4 → 2D TP=2, MooncakeConnectorV1)",
    evidenceBadge: "C",
    topology: "pd",
    hardwareFamily: "A3",
    decodeHardwareFamily: "A3",
    cardId: "a3-die64g",
    cardLabel: "Atlas A3 64G/Die (4P + 2D)",
    version: "v0.30.0",
    telemetryKind: "logs",
    telemetryTitle: "P/D 双实例启动与握手失败现场（依据 v0.30.0 源码规则还原 [C]）",
    telemetryText: [
      "# [教学复现现场 · 依据 vllm/vllm-ascend v0.30.0 校验与 Mooncake 拓扑约束还原]",
      "(Prefill pid=70112) INFO [factory.py:62] MooncakeConnectorV1 initialized with kv_role='kv_consumer', tp_size=4, kv_cache_dtype='auto'",
      "(Decode pid=70488) INFO [factory.py:62] MooncakeConnectorV1 initialized with kv_role='kv_producer', tp_size=8, kv_cache_dtype='int8'",
      '(Decode pid=70488) ERROR [core.py:1366]   File "vllm_ascend/ascend_config.py", line 1038, in _check_kv_transfer',
      "(Decode pid=70488) ERROR [core.py:1366] ValueError: MooncakeConnector does not support GQA with C8 (--kv-cache-dtype int8) KV cache quantization.",
      "# [跨实例联检阻断] Prefill TP=4 无法整除 Decode TP=8，kv_role 颠倒（P=kv_consumer / D=kv_producer），且两侧 KV 字节位宽不一致。",
    ].join("\n"),
    question: {
      prompt:
        "P/D 分离部署 /models/Qwen3-30B-A3B-W8A8（GQA MoE，目标 4P→2D）时启动即阻断，Prefill 与 Decode 双端配置的联合症结是？",
      options: [
        {
          id: "A",
          label: "MooncakeConnectorV1 要求 Prefill 与 Decode 的 TP 必须完全相等（只能 4P → 4D）",
        },
        {
          id: "B",
          label:
            "Decode 端误配 TP=8（违反 TP_P % TP_D == 0 整除契约，应改回 TP=2）、P/D 的 kv_role 写反（应 P=kv_producer / D=kv_consumer），且 D 端开启了 --kv-cache-dtype int8（触发 Mooncake+GQA 禁开 C8 与跨端精度失配）",
        },
        {
          id: "C",
          label: "P/D 分离必须把两侧的 --quantization ascend 删掉改回纯 FP32 权重",
        },
        {
          id: "D",
          label: "Decode 端必须设置 --pipeline-parallel-size 2 才能接收 Mooncake 的 KV 块",
        },
      ],
      correctOptionId: "B",
      explanation:
        "Mooncake 异构 TP 要求 TP_P % TP_D == 0（4P→2D 合法，4P→8D 非法）；同时 P/D 的 kv_role 颠倒（须 P=kv_producer、D=kv_consumer），且 D 端单独开了 --kv-cache-dtype int8 触发 Mooncake+GQA 禁开 C8 硬拦截与跨实例精度失配。",
    },
    initialCommand: `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
vllm serve /models/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 4 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --max-num-batched-tokens 8192 \\
    --gpu-memory-utilization 0.90 \\
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer","kv_connector_extra_config":{"prefill":{"tp_size":4,"dp_size":1},"decode":{"tp_size":2,"dp_size":1,"pp_size":1}}}'`,
    initialDecodeCommand: `export ASCEND_RT_VISIBLE_DEVICES=4,5
vllm serve /models/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 8 \\
    --pipeline-parallel-size 1 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --kv-cache-dtype int8 \\
    --max-model-len 16384 \\
    --max-num-batched-tokens 4096 \\
    --gpu-memory-utilization 0.90 \\
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer","kv_connector_extra_config":{"prefill":{"tp_size":4,"dp_size":1},"decode":{"tp_size":2,"dp_size":1,"pp_size":1}}}'`,
    mustKeep: {
      targetModelPresetId: "qwen3-30b-a3b",
      targetModelCanonical: "/models/Qwen3-30B-A3B-W8A8",
      tpSize: 4,
      decodeTpSize: 2,
      ppSize: 1,
      decodePpSize: 1,
      dpSize: 1,
      requireEp: true,
      weightPrecision: "w8a8_dynamic",
      requireAscendQuantFlag: true,
      minMaxModelLen: 16384,
      requiredConnector: "MooncakeConnectorV1",
    },
    missionConstraints: [
      "同时修正 Prefill 与 Decode 两条命令，保留 /models/Qwen3-30B-A3B-W8A8、MooncakeConnectorV1，并将 Decode 端 --tensor-parallel-size 修正为 2（满足 4P→2D 与 ASCEND_RT_VISIBLE_DEVICES=4,5 双卡一致）",
      '将 Prefill 端 kv_role 修正为 "kv_producer"，Decode 端 kv_role 修正为 "kv_consumer"',
      "消除跨实例 --kv-cache-dtype 失配与 GQA+Mooncake C8 冲突（移除 D 端 --kv-cache-dtype int8 或统一为 auto），使 runPdConfigDoctor 零 error",
    ],
    hints: [
      "提示 1：检查 Decode 端切分度：可见卡为 4,5（2 张卡）且 extra_config 声明 decode.tp_size=2，但 CLI 却误写了 --tensor-parallel-size 8（4 无法整除 8）。",
      '提示 2：Prefill 生产首包 KV 应设 "kv_role":"kv_producer"，Decode 拉取 KV 应设 "kv_role":"kv_consumer"，切勿篡改 MooncakeConnectorV1。',
      "提示 3：把 Decode 的 --tensor-parallel-size 8 改为 2，互换两侧正确的 kv_role，并删掉 Decode 的 --kv-cache-dtype int8。",
    ],
    debrief: {
      takeaway:
        "Mooncake P/D 分离上线必过跨实例四联检：① P=kv_producer / D=kv_consumer；② TP_P % TP_D == 0 且 PP_D == 1；③ 两侧 block_size 与 kv_cache_dtype 严格一致；④ GQA 架构下本实例直接拦截 C8 (int8 KV)。",
      rootCauseChain:
        "Decode 端误配 TP=8 破坏 TP_P(4) % TP_D == 0 切分契约与双卡可见性 + P/D 两侧 kv_role 颠倒导致握手错位 + D 端开启 --kv-cache-dtype int8 触发本实例 ascend_config.py _check_kv_transfer 硬报错。",
      sourceAnchors: [
        {
          ref: `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L130-L140`,
          note: "单实例 KVTransferConfig 校验 kv_role 合法字面量（kv_producer / kv_consumer / kv_both）与必填项。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1019-L1045`,
          note: "单实例 _check_kv_transfer 拦截 Mooncake 连接器与 GQA C8 (--kv-cache-dtype int8) 非法组合。",
        },
      ],
      wikiRefs: [
        { pageId: "pd-disaggregation", label: "P/D 分离架构与拓扑约束" },
        { pageId: "mooncake-connector", label: "MooncakeConnector 跨实例 KV 传输" },
        { pageId: "kv-cache-quantization", label: "KV Cache 量化边界（C8 / MXFP8）" },
      ],
    },
  },
  {
    id: "a3-dual-die-static-kernel-trap",
    order: 7,
    code: "CASE-07",
    title: "Atlas A3 双裸片单挂卡与 Static Kernel 依赖/静默清零连环坑",
    subtitle: "Atlas A3 双裸片卡 × 1 (2×64G Die) · /models/Qwen3-30B-A3B-W8A8 (TP=2, EP) · 社区案例脱敏改编",
    evidenceBadge: "C",
    provenanceLabel: "社区案例脱敏改编",
    topology: "single",
    hardwareFamily: "A3",
    cardId: "a3-die64g",
    cardLabel: "Atlas A3 双裸片卡 × 1（2 × 64G Die）",
    version: "v0.30.0",
    telemetryKind: "logs",
    telemetryTitle: "Atlas 800I A3 容器启动异常与图编译回退现场日志（社区 Issue 脱敏改编）",
    telemetryText: [
      "(APIServer pid=51204) INFO 10-18 15:20:03 [hardware_profile.py:194] Detected AscendDeviceType.A3 (DUAL_CHIP_CARD: card_id = npu // 2, chip_id = npu % 2)",
      "(APIServer pid=51204) ERROR 10-18 15:20:04 [ascend_config.py:157] Traceback (most recent call last):",
      '  File "vllm_ascend/ascend_config.py", line 167, in _apply_unsupported_hardware_downgrade_and_static_kernel_check',
      '    assert self.enable_npugraph_ex, "Static kernel generation requires npugraph_ex to be enabled."',
      "AssertionError: Static kernel generation requires npugraph_ex to be enabled.",
      "# --- 运维去掉 enable_npugraph_ex=false 但保留 PIECEWISE 与单逻辑卡可见性后的二次报错 ---",
      "(APIServer pid=51890) WARNING 10-18 15:22:11 [platform.py:1338] cudagraph_mode=PIECEWISE is incompatible with npugraph_ex; resetting enable_npugraph_ex, enable_static_kernel, and enable_super_kernel to False.",
      "(EngineCore_DP0 pid=51944) ERROR 10-18 15:22:14 [parallel_state.py:448] RuntimeError: world_size (2) is larger than visible NPU count (1) under ASCEND_RT_VISIBLE_DEVICES=0",
    ].join("\n"),
    question: {
      prompt:
        "团队在 Atlas 800I A3 上用 1 张物理双裸片卡（2 颗 64G Die）跑 /models/Qwen3-30B-A3B-W8A8 (TP=2 + EP) 并希望真正启用 Static Kernel，为何先后遭遇 AssertionError、静态核被静默清零与可见卡数不足？",
      options: [
        {
          id: "A",
          label: "Atlas A3 不支持 npugraph_ex 与 static_kernel，只能加 --enforce-eager 关闭全部图优化",
        },
        {
          id: "B",
          label: "Atlas A3 1 张物理卡仅含 1 个逻辑 davinci 设备，TP=2 必须跨两台服务器走 RoCE 互联",
        },
        {
          id: "C",
          label:
            "三处耦合失配：① A3 双裸片物理卡须成对暴露本机 0..15 内同卡 2 个逻辑设备（如 ASCEND_RT_VISIBLE_DEVICES=0,1）；② 之前调试误传了 enable_npugraph_ex=false 违反 static_kernel 前置依赖（v0.30.0 默认即为 True，移除 false 或设 true 即可）；③ PIECEWISE 会把 npugraph_ex/static_kernel 静默重置为 False，须切为 FULL_DECODE_ONLY（或 FULL）并控 u 在 0.85~0.90",
        },
        {
          id: "D",
          label: "只需删掉 enable_static_kernel 并保持 u=0.96 与 ASCEND_RT_VISIBLE_DEVICES=0 即可跑通 TP=2",
        },
      ],
      correctOptionId: "C",
      explanation:
        "Atlas A3 单机 8 物理槽共暴露 0..15 计 16 个逻辑设备（DUAL_CHIP_CARD：同卡成对如 0,1）；Static Kernel 依赖 npugraph_ex（v0.30.0 默认已为 True，但不可传 false 关闭），且在 PIECEWISE 模式下会被 _setup_compile_backend 静默刷回 False，只有配齐本机同卡成对可见号、保持 npugraph_ex 开启、切换 FULL_DECODE_ONLY（或 FULL）并将 u 控在 0.85~0.90 才能真正生效。",
    },
    initialCommand: `export ASCEND_RT_VISIBLE_DEVICES=0
vllm serve /models/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 2 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --gpu-memory-utilization 0.96 \\
    --compilation-config '{"cudagraph_mode":"PIECEWISE"}' \\
    --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":false,"enable_static_kernel":true}}'`,
    mustKeep: {
      targetModelPresetId: "qwen3-30b-a3b",
      targetModelCanonical: "/models/Qwen3-30B-A3B-W8A8",
      tpSize: 2,
      ppSize: 1,
      dpSize: 1,
      requireEp: true,
      weightPrecision: "w8a8_dynamic",
      requireAscendQuantFlag: true,
      minMaxModelLen: 16384,
    },
    missionConstraints: [
      "保留量化权重路径 /models/Qwen3-30B-A3B-W8A8、TP=2、--enable-expert-parallel、--quantization ascend 与 --max-model-len >= 16384",
      "在单台 Atlas 800I A3 的 0..15 逻辑设备范围内，按 card_id = npu // 2 成对导出同卡双 Die（如 ASCEND_RT_VISIBLE_DEVICES=0,1），禁止越界或跨卡异偶（如 0,2）",
      "真正生效 Static Kernel（严禁删掉 enable_static_kernel 逃课）：保持 enable_npugraph_ex 开启（设为 true 或利用 v0.30.0 默认 True），将 cudagraph_mode 改为 FULL_DECODE_ONLY（或 FULL）以防被 PIECEWISE 静默清零，并将 --gpu-memory-utilization 降至 0.85 ~ 0.90",
    ],
    hints: [
      "提示 1：单台 Atlas 800I A3 暴露逻辑号 0..15，按 npu0 // 2 == npu1 // 2 导出同卡成对设备（如 ASCEND_RT_VISIBLE_DEVICES=0,1）。",
      '提示 2：移除 "enable_npugraph_ex":false（或改为 true，v0.30.0 下默认即为 True），并保留 "enable_static_kernel":true。',
      '提示 3：PIECEWISE 会静默重置 npugraph_ex，请把 cudagraph_mode 改为 "FULL_DECODE_ONLY"，并将 --gpu-memory-utilization 调到 0.88。',
    ],
    debrief: {
      takeaway:
        "Atlas A3 上线双裸片 TP=2 + 静态核优化须过三道关：① 容器挂载与 ASCEND_RT_VISIBLE_DEVICES 按 npu // 2 成对绑同卡双 Die（0,1）；② 遵守 npugraph_ex -> static_kernel -> super_kernel 依赖链；③ 避开 PIECEWISE 静默清零陷阱，改走 FULL_DECODE_ONLY / FULL 并留足 1−u 图显存余量。",
      rootCauseChain:
        '单挂 ASCEND_RT_VISIBLE_DEVICES=0 破坏双裸片 TP=2 可见卡数与亲和拓扑 + 显式误配 "enable_npugraph_ex":false 触发 ascend_config.py 断言 + cudagraph_mode=PIECEWISE 在 platform.py _setup_compile_backend 中把 npugraph_ex/static_kernel 静默重置为 False + u=0.96 挤压整图捕获余量。',
      sourceAnchors: [
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L166-L169`,
          note: "AscendCompilationConfig 强校验 enable_static_kernel 前置要求 enable_npugraph_ex=True。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1313-L1352`,
          note: "_setup_compile_backend 在 NONE / PIECEWISE / FULL_AND_PIECEWISE 下静默将 npugraph_ex 与 static/super_kernel 重置为 False。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L187-L197`,
          note: "Atlas A3 采用 DeviceAddressingMode.DUAL_CHIP_CARD（1 物理板卡 = 2 颗逻辑 Die，按 npu // 2 寻址）。",
        },
      ],
      wikiRefs: [
        { pageId: "npugraph-ex", label: "npugraph_ex 与 Static / Super Kernel 依赖链" },
        { pageId: "acl-graph", label: "ACL Graph 捕获模式与静默重置边界" },
        { pageId: "hardware-devices", label: "Atlas A3 双裸片物理卡与成对挂载规则" },
      ],
    },
  },
  {
    id: "a3-pd-mc2-buffsize-ifname-trap",
    order: 8,
    code: "CASE-08",
    title: "双机 Atlas A3 Mooncake P/D：MC2 HCCL_BUFFSIZE 窗口过小与多通信层错址绑卡",
    subtitle:
      "Atlas 800I A3 × 2 机 (node-P 192.0.2.11 / node-D 192.0.2.12 · enp65s0f0 · 每端双 Die 卡 0,1) · /models/Qwen3-30B-A3B-W8A8 (TP=2, EP, enable_fused_mc2=1)",
    evidenceBadge: "C",
    topology: "pd",
    hardwareFamily: "A3",
    decodeHardwareFamily: "A3",
    cardId: "a3-die64g",
    cardLabel: "Atlas 800I A3 × 2 机（每端 1 张双 Die 卡 0,1）",
    version: "v0.30.0",
    telemetryKind: "logs",
    telemetryTitle: "P/D 双机网卡清单与交错启动排障日志（node-P / node-D）",
    telemetryText: [
      "# [跨机 P/D 现场资产清单与交错日志 · 时间、主机与 Rank 为教学构造，算子判断式与数值源自 vllm-ascend@c09d3e20]",
      "2026-04-18 10:00:10.412 ERROR [node-D] [Rank 0] HCCL_E_WAIT_TIMEOUT: EI0002 Notify wait execute timeout (The wait execution of the Notify register times out during collective op)",
      "2026-04-18 10:00:01.084 INFO  [node-P] Host NIC inventory: enp65s0f0 UP 192.0.2.11/24 (eth9: not found)",
      "2026-04-18 10:00:02.319 ERROR [node-D] [Rank 1] DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, m = 128, k = 2048, topK = 8 expected HCCL_BUFFSIZE is ((m * k * topK * sizeof(int8_t)) * 3 + 3MB)= 16MB, HCCL_BUFFSIZE=8MB.",
      "2026-04-18 10:00:01.092 INFO  [node-D] Host NIC inventory: enp65s0f0 UP 192.0.2.12/24 (eth9: not found)",
      "2026-04-18 10:00:03.105 ERROR [node-P] [Rank 0] RaSocket bind failed on local address 192.0.2.12 (Cannot assign requested address): HCCL_IF_IP=192.0.2.12 takes precedence over HCCL_SOCKET_IFNAME during Host root-info socket selection and does not match host enp65s0f0 (no automatic fallback); configured HCCL_SOCKET_IFNAME=eth9 / GLOO_SOCKET_IFNAME=eth9 also reference missing NIC eth9.",
    ].join("\n"),
    question: {
      prompt:
        "两台 Atlas 800I A3（每端分配 1 张双 Die 卡 0,1）部署 Qwen3-30B-A3B-W8A8 P/D 分离，交错日志中时间戳最晚的记录（10:00:10）报出 node-D Rank 0 的 EI0002 超时，P/D 双端真正并发的根因与修复要点是？",
      options: [
        {
          id: "A",
          label:
            "node-D Rank 0 在 10:00:10 触发集合通信超时，只需在两端导出 HCCL_EXEC_TIMEOUT=1800 拉长等待即可恢复",
        },
        {
          id: "B",
          label:
            "Atlas A3 不支持 --enable-expert-parallel 与 enable_fused_mc2=1，须删掉 EP 与融合算子并加 --enforce-eager 改走纯 Eager",
        },
        {
          id: "C",
          label:
            "两端存在并发独立故障：① node-D Rank 1 更早在 10:00:02 触发 DispatchFFNCombine 窗口不足（6 MiB 数据 + C++ 实际 10 MiB 裕度 = 16 MiB > HCCL_BUFFSIZE=8 MiB），Rank 0 的 EI0002（Notify wait 执行超时）只是陪等烟雾弹；② node-P 把在 Host root-info 选网中优先级高于 HCCL_SOCKET_IFNAME 的 HCCL_IF_IP 错写成 node-D 地址 192.0.2.12（失败不会自动回退），且 HCCL_SOCKET_IFNAME / GLOO_SOCKET_IFNAME 错填不存在的 eth9；须修正 P 端 HCCL_IF_IP=192.0.2.11 与双接口为 enp65s0f0，并将两端 HCCL_BUFFSIZE 按预算设为 128",
        },
        {
          id: "D",
          label:
            "MooncakeConnectorV1 与 W8A8 量化不兼容，须删掉 --quantization ascend 改回 BF16 并更换 KV connector",
        },
      ],
      correctOptionId: "C",
      explanation:
        "按时间戳拆解：node-D Rank 1 在 10:00:02 已因 HCCL_BUFFSIZE=8MB 小于 DispatchFFNCombine 实算窗口（C++ 文案写 + 3MB，源码行 289 实际按 128×2048×8×1×3 + 10 MiB = 16 MiB 判失败）退出，Rank 0 在 10:00:10 的 EI0002（CANN 定义为执行期 Notify wait 超时，区别于 EI0006 套接字建链超时——两者在同组对端先挂时都可成为次生烟雾弹）只是次生陪等；与此同时 node-P 独立因 HCCL_IF_IP=192.0.2.12（Host root-info 选网阶段优先于 HCCL_SOCKET_IFNAME，失败不会自动回退）且 HCCL_SOCKET_IFNAME / GLOO_SOCKET_IFNAME 同指不存在的 eth9 而失败。须在保留 W8A8/EP/fused_mc2=1/FULL_DECODE_ONLY/Mooncake 的前提下，修对 P 端本机 IP 与双层接口，并把两端 HCCL_BUFFSIZE 设为 128。",
    },
    initialCommand: `export ASCEND_RT_VISIBLE_DEVICES=0,1 HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9 HCCL_IF_IP=192.0.2.12 HCCL_BUFFSIZE=128
vllm serve /models/Qwen3-30B-A3B-W8A8 \\
    --tensor-parallel-size 2 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --max-num-seqs 128 \\
    --max-num-batched-tokens 2048 \\
    --gpu-memory-utilization 0.88 \\
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \\
    --additional-config '{"enable_fused_mc2":1}' \\
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer","kv_connector_extra_config":{"prefill":{"tp_size":2,"dp_size":1},"decode":{"tp_size":2,"dp_size":1,"pp_size":1}}}'`,
    initialDecodeCommand: `export ASCEND_RT_VISIBLE_DEVICES=0,1 HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0 HCCL_IF_IP=192.0.2.12 HCCL_BUFFSIZE=8
vllm serve /models/Qwen3-30B-A3B-W8A8 \\
    --tensor-parallel-size 2 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --max-num-seqs 128 \\
    --max-num-batched-tokens 2048 \\
    --gpu-memory-utilization 0.88 \\
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \\
    --additional-config '{"enable_fused_mc2":1}' \\
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer","kv_connector_extra_config":{"prefill":{"tp_size":2,"dp_size":1},"decode":{"tp_size":2,"dp_size":1,"pp_size":1}}}'`,
    mustKeep: {
      targetModelPresetId: "qwen3-30b-a3b",
      targetModelCanonical: "/models/Qwen3-30B-A3B-W8A8",
      tpSize: 2,
      decodeTpSize: 2,
      ppSize: 1,
      decodePpSize: 1,
      dpSize: 1,
      requireEp: true,
      weightPrecision: "w8a8_dynamic",
      requireAscendQuantFlag: true,
      minMaxModelLen: 16384,
      requiredConnector: "MooncakeConnectorV1",
    },
    missionConstraints: [
      "同时保留并修正 Prefill（node-P）与 Decode（node-D）双命令：精确保留 /models/Qwen3-30B-A3B-W8A8、显式 --quantization ascend、--enable-expert-parallel、TP=2（PP=DP=PCP=DCP=1）、本机已分配双 Die 卡 ASCEND_RT_VISIBLE_DEVICES=0,1、--max-model-len >= 16384、--max-num-seqs >= 128、--max-num-batched-tokens >= 2048，且禁止 --load-format dummy 或夹带第二条诱饵命令",
      "保持图模式 FULL_DECODE_ONLY（或 FULL）与 --gpu-memory-utilization 在 0.85 ~ 0.90（严禁 --enforce-eager、PIECEWISE 或 cudagraph_mode=NONE），保持 --additional-config '{\"enable_fused_mc2\":1}' 命中 FUSED_MC2，且保持 MooncakeConnectorV1（P=kv_producer / D=kv_consumer、完整 prefill/decode extra_config 且不篡改 kv_cache_dtype）",
      "修正跨层网络与窗口：P 端设 HCCL_IF_IP=192.0.2.11，D 端保持 HCCL_IF_IP=192.0.2.12；两端 GLOO_SOCKET_IFNAME=enp65s0f0（或每项均为 enp65s0f0 的逗号列表）、HCCL_SOCKET_IFNAME=enp65s0f0（或有效前缀如 enp65s0 / enp，或精确匹配 =enp65s0f0）且禁止 eth9；两端 HCCL_BUFFSIZE 均须按本关已分配预算显式设为 128（严禁省略回退默认或堆加 HCCL_EXEC_TIMEOUT 掩盖）",
    ],
    hints: [
      "提示 1：按时间戳与主机拆解交错日志——node-D Rank 1 在 10:00:02 报 DispatchFFNCombine HCCL_BUFFSIZE=8MB 不足（128×2048×8×1×3 + 10MB 实算 = 16MB），而 Rank 0 在 10:00:10 的 EI0002（执行期 Notify wait 超时）只是次生陪等；node-P 则独立报出了 RaSocket 绑定 node-D 地址与 eth9 不存在错误。",
      "提示 2：HCCL_IF_IP 在 Host root-info 选网阶段优先于 HCCL_SOCKET_IFNAME 且失败不会自动回退，同时 GLOO_SOCKET_IFNAME 与 HCCL_SOCKET_IFNAME 分别控制 CPU Gloo 组与设备 HCCL 组。Prefill 端（node-P）须把 HCCL_IF_IP 改为自身 192.0.2.11，并把两套 eth9 全部改成 enp65s0f0。",
      "提示 3：Decode 端（node-D）的 HCCL_BUFFSIZE=8 小于 16 MiB 必败，但删掉环境变量或乱填大窗口（如 65535）都不符合本关预算；将 Decode 端 HCCL_BUFFSIZE 改为 128，其余算子/图模式/Mooncake 参数保持不变即可通关。",
    ],
    debrief: {
      takeaway:
        "跨机 P/D 排障必须按 Host + 时间戳拆开交错日志：先分清本机算子硬报错（DispatchFFNCombine HCCL_BUFFSIZE=8MB 不足）与陪等 EI0002（CANN 定义为执行期 Notify wait 超时，区别于 EI0006 建链超时，对端先挂时两者均可能充当烟雾弹），再核对主机资产清单确保 HCCL_IF_IP 绑定各自本地地址，并同时修正 HCCL 与 Gloo 双层网卡名。",
      rootCauseChain:
        "node-D Rank 1 因 HCCL_BUFFSIZE=8 MiB 小于 DispatchFFNCombine 实际所需 16 MiB（6 MiB + 10 MiB）在 10:00:02 失败，连带 Rank 0 在 10:00:10 刷出 EI0002（Notify wait execute timeout）；node-P 同时因 Host root-info 选网优先的 HCCL_IF_IP 错填对端 192.0.2.12（失败不自动回退）且 HCCL_SOCKET_IFNAME / GLOO_SOCKET_IFNAME 错指不存在的 eth9 导致 RaSocket 绑定失败。",
      sourceAnchors: [
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L63-L85`,
          note: "GetMaxWindowSize() 直接读取环境变量 HCCL_BUFFSIZE（缺省 200 MiB）作为 MC2 通信窗口上限。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L288-L294`,
          note: "OP_TILING_CHECK 按 M × topK × K × sizeof(int8_t) × 3 + 10 * MB_SIZE 计算 actualSize（文案打印 + 3MB，实算 + 10 MiB = 16 MiB），大于 HCCL_BUFFSIZE=8 MiB 即返回失败。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ops/fused_moe/moe_comm_method.py#L580-L609`,
          note: "enable_fused_mc2 == 1 在非 MegaMoe 路径直接调用 torch.ops._C_ascend.dispatch_ffn_combine。",
        },
        {
          ref: `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L115-L118`,
          note: "Mooncake Worker 严格校验单向角色（kv_producer 或 kv_consumer），传入 kv_both 直接抛 ValueError。",
        },
      ],
      wikiRefs: [
        { pageId: "hccl-buffer", label: "HCCL 缓冲窗口与 DispatchFFNCombine 判据" },
        { pageId: "moe-comm-dispatch", label: "MoE 通信分派与 enable_fused_mc2" },
        { pageId: "mooncake-connector", label: "MooncakeConnectorV1 与 P/D 单角色约束" },
        { pageId: "cann-hccl", label: "CANN / HCCL 与 Gloo 双层网卡配置" },
      ],
    },
  },
];

export const DEFAULT_WARGAME_SCENARIO_ID: WarGameScenarioId = "rank3-oom-ei0006";

export const WARGAME_SCENARIO_IDS: readonly WarGameScenarioId[] = WARGAME_SCENARIOS.map((s) => s.id);

const WARGAME_ID_SET: ReadonlySet<string> = new Set(WARGAME_SCENARIO_IDS);

export function isWarGameScenarioId(raw: string | null | undefined): raw is WarGameScenarioId {
  return typeof raw === "string" && WARGAME_ID_SET.has(raw);
}

export function getWarGameScenario(id: string | null | undefined): WarGameScenario {
  if (isWarGameScenarioId(id)) {
    const found = WARGAME_SCENARIOS.find((s) => s.id === id);
    if (found) return found;
  }
  return WARGAME_SCENARIOS[0]!;
}
