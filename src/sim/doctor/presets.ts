import type { AscendFamily, RuleVersion } from "../rules/types";
import type { DoctorMode } from "./configDoctor";

export interface SingleDoctorPreset {
  id: string;
  kind: "single";
  mode: DoctorMode;
  health: "healthy" | "pitfall";
  label: string;
  summary: string;
  hardwareFamily: AscendFamily;
  version: RuleVersion;
  command: string;
}

export interface PdDoctorPreset {
  id: string;
  kind: "pd";
  mode: "full";
  health: "healthy" | "pitfall";
  label: string;
  summary: string;
  hardwareFamily: AscendFamily;
  decodeHardwareFamily?: AscendFamily | undefined;
  version: RuleVersion;
  prefillCommand: string;
  decodeCommand: string;
}

export type DoctorPreset = SingleDoctorPreset | PdDoctorPreset;

export const MINIMAL_DOCTOR_PRESETS: readonly SingleDoctorPreset[] = [
  {
    id: "minimal-healthy-qwen3-8b-a2",
    kind: "single",
    mode: "minimal",
    health: "healthy",
    label: "健康基线：A2 单卡 Qwen3-8B (BF16)",
    summary:
      "对照第 1 章清单 A：显式传 --served-model-name、--gpu-memory-utilization 0.90 与 FULL_DECODE_ONLY，零硬阻断。",
    hardwareFamily: "A2",
    version: "v0.30.0",
    command: `export ASCEND_RT_VISIBLE_DEVICES=0
vllm serve /root/.cache/Qwen3-8B \\
    --served-model-name qwen3-8b \\
    --max-model-len 8192 \\
    --gpu-memory-utilization 0.90 \\
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \\
    --port 8000`,
  },
  {
    id: "minimal-pitfall-310p-dtype-tp-retired-env",
    kind: "single",
    mode: "minimal",
    health: "pitfall",
    label: "排雷：310P 漏 float16 + 卡数不足 + 退役变量 NZ",
    summary:
      "Atlas 300I DUO (310P) 漏传 --dtype float16、ASCEND_RT_VISIBLE_DEVICES=0 却设 -tp 2，并导出 v0.30.0 已下线的 VLLM_ASCEND_ENABLE_NZ=1。",
    hardwareFamily: "310P",
    version: "v0.30.0",
    command: `export ASCEND_RT_VISIBLE_DEVICES=0
export VLLM_ASCEND_ENABLE_NZ=1
vllm serve /root/.cache/Qwen3-8B-W8A8SC \\
    --served-model-name qwen3-8b \\
    --quantization ascend \\
    -tp 2 \\
    --max-model-len 8192 \\
    --gpu-memory-utilization 0.90 \\
    --port 8000`,
  },
  {
    id: "minimal-pitfall-a2-fp8-unknown-env-high-u",
    kind: "single",
    mode: "minimal",
    health: "pitfall",
    label: "排雷：A2 原生 FP8 反量化 + HCCL_BUFFSIZE_EP + 高显存水位 0.97",
    summary:
      "演示 v0.30.0 上 A2 原生分块 FP8 静默反量化回 BF16（2× 显存）、HCCL_BUFFSIZE_EP 诚实标 unknown [I]（非报错），以及 u=0.97 录图 OOM 告警。",
    hardwareFamily: "A2",
    version: "v0.30.0",
    command: `export ASCEND_RT_VISIBLE_DEVICES=0
export HCCL_BUFFSIZE_EP=512
vllm serve /root/.cache/Qwen3-8B-FP8 \\
    --served-model-name qwen3-8b-fp8 \\
    --max-model-len 8192 \\
    --gpu-memory-utilization 0.97 \\
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \\
    --port 8000`,
  },
];

export const FULL_SINGLE_DOCTOR_PRESETS: readonly SingleDoctorPreset[] = [
  {
    id: "full-healthy-qwen3-30b-a3b-w8a8-tp4-ep4",
    kind: "single",
    mode: "full",
    health: "healthy",
    label: "健康基线：A3 四卡 Qwen3-30B-A3B (W8A8_DYNAMIC + TP4 + EP4)",
    summary:
      "对照 08 性能与调参篇完整调优模板：ModelSlim W8A8 + TP=4 + EP + FULL_DECODE_ONLY + npugraph_ex + static_kernel，零硬阻断。",
    hardwareFamily: "A3",
    version: "v0.30.0",
    command: `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True
export HCCL_BUFFSIZE=1024
export HCCL_OP_EXPANSION_MODE="AIV"
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 4 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --gpu-memory-utilization 0.90 \\
    --max-model-len 16384 \\
    --max-num-seqs 128 \\
    --max-num-batched-tokens 8192 \\
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \\
    --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":true,"enable_static_kernel":true,"enable_super_kernel":true}}'`,
  },
  {
    id: "full-pitfall-piecewise-super-kernel-gqa-c8",
    kind: "single",
    mode: "full",
    health: "pitfall",
    label: "排雷：PIECEWISE 清空三级融合 + 未量化 BF16 硬开 GQA C8",
    summary:
      "PIECEWISE 模式会静默清空 npugraph_ex/static_kernel/super_kernel，同时在未量化 BF16 GQA 模型上开 --kv-cache-dtype int8 启动即抛 ValueError。",
    hardwareFamily: "A2",
    version: "v0.30.0",
    command: `export ASCEND_RT_VISIBLE_DEVICES=0,1
vllm serve /root/.cache/Qwen3-8B \\
    --served-model-name qwen3-8b \\
    --tensor-parallel-size 2 \\
    --kv-cache-dtype int8 \\
    --gpu-memory-utilization 0.90 \\
    --max-model-len 16384 \\
    --max-num-batched-tokens 8192 \\
    --compilation-config '{"cudagraph_mode":"PIECEWISE"}' \\
    --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":true,"enable_static_kernel":true,"enable_super_kernel":true}}'`,
  },
];

export const PD_DOCTOR_PRESETS: readonly PdDoctorPreset[] = [
  {
    id: "pd-pitfall-mooncake-tp-pp-recompute",
    kind: "pd",
    mode: "full",
    health: "pitfall",
    label: "P/D 排雷：Mooncake TP_P=4 vs TP_D=3 + D 端 PP=2 + P 端开 recompute",
    summary:
      "联合触发跨实例 TP_P % TP_D != 0、Decode 端 PP_D != 1 硬阻断，以及 Prefill 端 recompute_scheduler_enable 静默置 False。",
    hardwareFamily: "A3",
    decodeHardwareFamily: "A3",
    version: "v0.30.0",
    prefillCommand: `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 4 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --max-num-batched-tokens 8192 \\
    --gpu-memory-utilization 0.90 \\
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer","kv_connector_extra_config":{"prefill":{"tp_size":4,"dp_size":1},"decode":{"tp_size":3,"dp_size":1,"pp_size":2}}}' \\
    --additional-config '{"recompute_scheduler_enable":true}'`,
    decodeCommand: `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3,4,5
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 3 \\
    --pipeline-parallel-size 2 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --max-num-batched-tokens 4096 \\
    --gpu-memory-utilization 0.90 \\
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer","kv_connector_extra_config":{"prefill":{"tp_size":4,"dp_size":1},"decode":{"tp_size":3,"dp_size":1,"pp_size":2}}}'`,
  },
  {
    id: "pd-healthy-mooncake-tp4-to-tp2-pp1",
    kind: "pd",
    mode: "full",
    health: "healthy",
    label: "P/D 健康基线：Prefill TP=4 → Decode TP=2, PP=1 (MooncakeConnectorV1)",
    summary:
      "1 键切换合规 P/D 联检配置：满足 TP_P(4) % TP_D(2) == 0、PP_D == 1、block_size 与 kv_cache_dtype 一致，recompute_scheduler 仅在 D 端启用。",
    hardwareFamily: "A3",
    decodeHardwareFamily: "A3",
    version: "v0.30.0",
    prefillCommand: `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 4 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --max-num-batched-tokens 8192 \\
    --gpu-memory-utilization 0.90 \\
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer","kv_connector_extra_config":{"prefill":{"tp_size":4,"dp_size":1},"decode":{"tp_size":2,"dp_size":1,"pp_size":1}}}'`,
    decodeCommand: `export ASCEND_RT_VISIBLE_DEVICES=0,1
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \\
    --served-model-name qwen3-30b-a3b \\
    --tensor-parallel-size 2 \\
    --pipeline-parallel-size 1 \\
    --enable-expert-parallel \\
    --quantization ascend \\
    --max-model-len 16384 \\
    --max-num-batched-tokens 4096 \\
    --gpu-memory-utilization 0.90 \\
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer","kv_connector_extra_config":{"prefill":{"tp_size":4,"dp_size":1},"decode":{"tp_size":2,"dp_size":1,"pp_size":1}}}' \\
    --additional-config '{"recompute_scheduler_enable":true}'`,
  },
];

export const DOCTOR_PRESETS: readonly DoctorPreset[] = [
  ...MINIMAL_DOCTOR_PRESETS,
  ...FULL_SINGLE_DOCTOR_PRESETS,
  ...PD_DOCTOR_PRESETS,
];
