/**
 * 章节编号 → 标题。真相源是 PLAN.md §1.1（22 章）；这里是给程序读的副本，改 PLAN 时同步。
 */
export const CHAPTER_TITLES: Record<string, string> = {
  "00": "从一次对话开始：推理到底在算什么",
  "01": "Token、Embedding 与向量",
  "02": "矩阵乘法与张量形状",
  "03": "Transformer 层的双层数据流",
  "04": "Attention 深入",
  "05": "Prefill 与 Decode",
  "06": "MoE",
  "07": "昇腾 NPU 剖面",
  "08": "服务器与机柜",
  "09": "一次请求的硬件旅程",
  "10": "引擎架构与插件机制",
  "11": "KV cache 内存系统",
  "12": "Scheduler 与调度策略",
  "13": "并行 I：TP / PP / DP",
  "14": "并行 II：EP / DPA / EPLB / large-scale EP",
  "15": "并行 III：SP / CP / PCP / DCP",
  "16": "Graph mode 与 kernel",
  "17": "量化与 speculative decoding",
  "18": "PD / EPD 分离与 KV 传输",
  "19": "性能工程",
  "20": "读源码",
  "21": "PR 影响分析",
};
export const CHAPTER_IDS = Object.keys(CHAPTER_TITLES);
