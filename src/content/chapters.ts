/** 全站课程目录；Wiki 只复用编号与标题，不参与课程正文渲染。 */
export const COURSE_PARTS = ["导论", "模型计算层", "硬件执行层", "推理框架与机制", "工程与源码"];
export const CHAPTERS = [
  {
    id: "00",
    part: 0,
    title: "从一次对话开始：推理到底在算什么",
    question: "输入一句话之后，到第一个词出现之前发生了什么？",
    topics: ["一次请求", "模型与硬件", "学习路线"],
  },
  {
    id: "01",
    part: 1,
    title: "Token、Embedding 与向量",
    question: "文字怎样变成模型能够计算的一组数？",
    topics: ["Token 编号", "Embedding 查表", "向量与维度"],
  },
  {
    id: "02",
    part: 1,
    title: "矩阵乘法与张量形状",
    question: "沿着一次矩阵乘法，怎样读懂输入、权重与输出的形状？",
    topics: ["点积与矩阵乘法", "张量形状", "分块与数据搬运"],
  },
  {
    id: "03",
    part: 1,
    title: "一层 Transformer 怎样更新表示",
    question: "一个词的表示经过一层，究竟改变了什么？",
    topics: ["隐藏表示的更新", "注意力与前馈", "归一化与残差"],
  },
  {
    id: "04",
    part: 1,
    title: "Attention 深入",
    question: "一个词怎样从上下文中选择、汇总自己需要的信息？",
    topics: ["Q / K / V", "位置与因果关系", "注意力结构与计算方式"],
  },
  {
    id: "05",
    part: 1,
    title: "Prefill 与 Decode",
    question: "处理输入和逐词生成，为什么需要分开观察？",
    topics: ["输入处理", "逐词生成", "状态复用与延迟"],
  },
  {
    id: "06",
    part: 1,
    title: "MoE",
    question: "一个词怎样选择专家，专家的结果又怎样合并？",
    topics: ["路由与 Top-k", "专家前馈", "加权合并"],
  },
  {
    id: "07",
    part: 2,
    title: "昇腾 NPU 剖面",
    question: "把计算放大到芯片内部，计算单元与存储各负责什么？",
    topics: ["计算单元", "片上存储与 HBM", "读取、计算与写回"],
  },
  {
    id: "08",
    part: 2,
    title: "服务器与机柜",
    question: "从一个计算模组走到整机和机柜，哪些部件把它们连起来？",
    topics: ["CPU、内存与加速器", "整机部件", "机柜与互联"],
  },
  {
    id: "09",
    part: 2,
    title: "一次请求的硬件旅程",
    question: "请求经过哪些软硬件边界，结果怎样回到用户？",
    topics: ["请求入口与队列", "执行与采样", "流式返回"],
  },
  {
    id: "10",
    part: 3,
    title: "引擎架构与插件机制",
    question: "推理服务怎样划分职责，昇腾适配又接在哪些位置？",
    topics: ["EngineCore 与 Scheduler", "Worker 与 ModelRunner", "平台插件与适配"],
  },
  {
    id: "11",
    part: 3,
    title: "KV cache 内存系统",
    question: "请求越来越多、上下文越来越长时，怎样管理缓存空间？",
    topics: ["分页与块表", "前缀复用", "缓存迁移"],
  },
  {
    id: "12",
    part: 3,
    title: "Scheduler 与调度策略",
    question: "多个请求同时到来，下一步应该让谁参与计算？",
    topics: ["连续批处理", "分块 Prefill", "抢占与异步调度"],
  },
  {
    id: "13",
    part: 3,
    title: "并行 I：TP / PP / DP",
    question: "把模型或请求分给多张卡，各张卡分别负责哪一部分？",
    topics: ["张量并行", "流水线并行", "数据并行"],
  },
  {
    id: "14",
    part: 3,
    title: "并行 II：EP / DPA / EPLB / large-scale EP",
    question: "专家分散在不同设备后，怎样派发数据并平衡工作量？",
    topics: ["专家放置", "派发与合并", "负载均衡"],
  },
  {
    id: "15",
    part: 3,
    title: "并行 III：SP / CP / PCP / DCP",
    question: "上下文太长时，怎样分配序列与注意力计算？",
    topics: ["序列分片", "上下文并行", "Prefill 与 Decode 的切分"],
  },
  {
    id: "16",
    part: 3,
    title: "Graph mode 与 kernel",
    question: "模型中的一步计算怎样进入设备执行？",
    topics: ["算子与 Kernel", "图捕获与回放", "编译与执行"],
  },
  {
    id: "17",
    part: 3,
    title: "量化与 speculative decoding",
    question: "减少数值精度和提前猜词，各自改变了哪部分工作？",
    topics: ["量化表示", "草拟与验证", "精度与计算代价"],
  },
  {
    id: "18",
    part: 3,
    title: "PD / EPD 分离与 KV 传输",
    question: "把推理阶段放在不同设备上，需要交接哪些状态？",
    topics: ["阶段分离", "KV 传输", "连接器与交接成本"],
  },
  {
    id: "19",
    part: 4,
    title: "性能工程",
    question: "看到延迟或吞吐变化，怎样找到对应的计算、访存或通信环节？",
    topics: ["性能指标", "Benchmark 与 Profiling", "瓶颈归因"],
  },
  {
    id: "20",
    part: 4,
    title: "读源码",
    question: "怎样从一条请求出发，找到真正执行工作的函数？",
    topics: ["目录地图", "调用链", "固定版本的源码阅读"],
  },
  {
    id: "21",
    part: 4,
    title: "PR 影响分析",
    question: "一个代码改动改变了什么行为，证据又在哪里？",
    topics: ["改动与模块", "数据流与特性", "验证与指标"],
  },
] as const;
export function findChapter(id: string | undefined) {
  return CHAPTERS.find((chapter) => chapter.id === id);
}
export function chapterExperience(id: string) {
  if (["01", "02", "03", "04", "05", "06"].includes(id)) {
    return { to: `/chapters/${id}?experience=1`, label: "打开 GLM 计算演示" };
  }
  if (id === "07" || id === "08") {
    return { to: `/chapters/${id}?experience=1&view=${id === "07" ? "npu" : "whole"}`, label: "打开硬件 3D" };
  }
  return undefined;
}
