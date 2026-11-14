import { COLLECTIVES } from "./scene-collective";
import { INFERENCE_LESSONS } from "./scene-inference";

export type SceneLessonId =
  | "model-compute"
  | "parallel-strategy"
  | "parallel-mechanism"
  | "token-flow"
  | "collective-communication"
  | "inference-mechanism";
export type SceneStep = {
  label: string;
  title: string;
  text: string;
  shape: string;
  blocks: string[];
  labels: string[];
  /** Overrides the lesson note when one section belongs to a different deployment boundary. */
  note?: string;
};

export const SCENE_LESSONS: Record<
  SceneLessonId,
  {
    title: string;
    page: string;
    intro: string;
    note: string;
    steps: SceneStep[];
  }
> = {
  "collective-communication": {
    title: "四张卡，九种通信视角",
    page: "collective-communication",
    intro: "切换操作，对照发前的数据、正在传的块和每卡的结果。",
    note: "四卡数值示意 · root 为 rank 0 · 归约使用 SUM · 逻辑通信路线",
    steps: COLLECTIVES.map((item) => ({
      label: item.name,
      title: item.title,
      text: item.input,
      shape: "",
      blocks: [],
      labels: [],
    })),
  },
  "inference-mechanism": {
    title: "推理中的数据与计算",
    page: "attention-qkv",
    intro: "追踪同一份数据：在哪里、怎样改变、交给谁。",
    note: "教学数值与逻辑展开。",
    steps: INFERENCE_LESSONS.map((lesson) => ({
      label: lesson.label,
      title: lesson.title,
      text: lesson.details[0],
      note: lesson.note,
      shape: "",
      blocks: [],
      labels: [],
    })),
  },
  "model-compute": {
    title: "一层里面，数是怎样算的？",
    page: "glm-5-3-flash",
    intro: "沿一层拆开看：四路输入先合成一路，经过 KDA 和前馈，再写回四路。每一步都能旋转观察。",
    note: "数值示例；格线表示矩阵分组。",
    steps: [
      {
        label: "合并与归一化",
        title: "先把四路输入合成一路",
        text: "mHC 先算出混合系数，再把四条 residual 流加权合成一条。RMSNorm 对这条向量按均方根缩放，并乘增益 γ；宽度仍然是 4096，交给注意力计算。",
        shape: "每个位置：4 × 4096 → 4096",
        blocks: ["residual_in", "fn_attn", "coef_attn", "collapsed_attn", "gamma_attn", "x_attn"],
        labels: ["residual_in", "fn_attn", "collapsed_attn", "x_attn"],
      },
      {
        label: "KDA 注意力",
        title: "从输入到整块输出：矩阵乘法在模型里怎样发生",
        text: "同一条输入分别乘 Wq、Wk、Wv，生成查询 Q、键 K、值 V。它们各有 8192 个数，按 64 个头、每头 128 维处理。后续短卷积和门控更新记忆矩阵，再读出历史信息。这里放大的是前三个投影。",
        shape: "本图：3 个 token · 3 → 4 维；GLM KDA 的 Q 投影：4096 → 8192",
        blocks: ["x_attn", "W_q", "Q", "W_k", "K", "W_v", "V"],
        labels: ["x_attn", "W_q", "Q", "W_k", "K", "W_v", "V"],
      },
      {
        label: "前馈变换",
        title: "SwiGLU：门控怎样改变六个通道，再合成四个输出",
        text: "注意力结果写回四路后，前馈入口再次合并、归一化。gate 和 up 两个投影把它展开到 12288 维；限幅后，SiLU(gate) 与 up 逐元素相乘，再由 down 投影收回 4096 维。",
        shape: "本图：4 → 6 → 4；GLM 稠密前馈：4096 → 12288 → 4096",
        blocks: ["x_ffn", "W_gate", "W_up", "gate_ffn", "up_ffn", "h_ffn", "W_down", "ffn_out"],
        labels: ["x_ffn", "W_gate", "W_up", "h_ffn", "ffn_out"],
      },
      {
        label: "写回四路",
        title: "本层的结果，成为下一层的输入",
        text: "前馈输出按 post 系数分到四路；原来的四路按 comb 矩阵重新混合，两者相加得到本层输出。层间传递的是更新后的隐藏表示，token 编号并没有被改成另一个编号。",
        shape: "前馈输出 4096 + 四路旁路 → 4 × 4096",
        blocks: ["residual_mid", "coef_ffn", "ffn_out", "residual_out"],
        labels: ["residual_mid", "coef_ffn", "ffn_out", "residual_out"],
      },
    ],
  },
  "parallel-strategy": {
    title: "同样 16 张卡，三种分工",
    page: "glm-5-3-flash-two-node",
    intro:
      "先看一份权重怎样切开放到各卡，再看数据怎样使用它。蓝色矩阵是常驻权重，棕色是流动的激活，绿色是返回的结果；点卡号查看它存的那一份。",
    note: "布局与路由示意。权重常驻各卡，专家编号按顺排表示；Σ 表示归约求和。",
    steps: [
      {
        label: "TP · 分矩阵",
        title: "一份矩阵切成 8 片，每张卡常驻一片",
        text: "以稠密前馈的 down 投影为例：按 XW 写法，12288 × 4096 的权重沿输入维切成 8 片，每片 1536 × 4096。卡用自己的权重片与对应激活计算部分和，再通过 All-Reduce 合齐。两台机器各存一套这样的分片，对应卡上的 W0…W7 相同。",
        shape: "2 个 TP 组 · 每组 8 卡",
        blocks: [],
        labels: [],
      },
      {
        label: "DP · 分请求",
        title: "两组各自调度请求，专家仍要共同使用",
        text: "入口把请求交给其中一个 DP 执行组；每组有自己的 scheduler 和 KV cache 池。这里高亮的是执行组。两组的路由专家合起来才完整，因此到 MoE 时仍会跨机协作；每台机器不能独自跑完这套模型。",
        shape: "2 个 DP 执行组 · 各自接收和调度请求",
        blocks: [],
        labels: [],
      },
      {
        label: "EP · 分专家",
        title: "专家分在 16 张卡，token 去找被选中的专家",
        text: "每组三层权重是一位完整专家：gate、up、down 各一套。每卡 18 位、16 卡共 288 位；本次选中 8 位，分布在 6 张卡，包括源卡。棕色激活沿 dispatch 送达，专家分别计算，再把 8 份绿色结果送回源卡，按路由权重相加为一份输出。全过程中，专家权重留在原卡。",
        shape: "1 个 EP16 组 · 每层每卡 18 个路由专家",
        blocks: [],
        labels: [],
      },
    ],
  },
  "parallel-mechanism": {
    title: "并行计算：数据由谁接收、在哪里计算",
    page: "pipeline-parallel",
    intro: "保留各卡的完整结构，展开当前分工和输入输出。",
    note: "通用机制与正文缩小算例。固定 GLM 双机的 PP=1、FlashComm1 关闭、PCP=DCP=1；不代表该部署已经启用这些并行，也不代表当前 GLM 已支持 CP。",
    steps: [
      {
        label: "PP · 分层",
        title: "PP：八层分在四张卡，上一段输出接成下一段输入",
        text: "层权重与 KV 留在各卡，隐藏状态依次交接。",
        shape: "8 层 / 4 卡 · 每层加 1 的玩具变换",
        blocks: [],
        labels: [],
      },
      {
        label: "SP · 分行",
        title: "SP：同一行先求和、分工，再接入下一次投影",
        text: "保留完整 TP 结构，跟踪四个 token 的四通道数值。",
        shape: "2 张 TP 卡 · 4 个 token · 每行 4 通道",
        blocks: [],
        labels: [],
      },
      {
        label: "PCP · 分查询",
        title: "PCP：前后配对的查询行，分摊因果注意力计算",
        text: "保持因果结构，分开查询归属与 KV 缓存归属。",
        shape: "通用非分块 prefill · 8 个查询位置 · PCP2",
        blocks: [],
        labels: [],
      },
      {
        label: "DCP · 分历史",
        title: "DCP：历史留在各卡，两份局部答案按份额合并",
        text: "同一个查询读取分片历史，交换局部结果和归一化信息。",
        shape: "K/V 各 [8,4] → 每卡 [4,4]；完整四通道输出 + 独立归一化统计 · DCP2",
        blocks: [],
        labels: [],
      },
      {
        label: "Ring · 逐块累积",
        title: "Ring Attention：Q 留在原卡，K/V 分块交换并接着计算",
        text: "同一组位置、两轮计算；读完全部块后得到完整因果 attention。",
        shape: "通用 Ring 示意 · 8 个位置 · 2 卡 · Q/K/V 各4通道，展开第0输出通道",
        blocks: [],
        labels: [],
      },
      {
        label: "TP · 分矩阵",
        title: "TP：一次 down 投影切给 4 张卡，All-Reduce 加齐部分和",
        text: "沿输入通道切 X 的列与 W 的行；各卡得到形状完整的部分和，相加后每卡都有完整 Y。",
        shape: "X [4,8] × W [8,4] → 每卡 [4,2] × [2,4] → [4,4] 部分和 → All-Reduce",
        blocks: [],
        labels: [],
        note: "示意 TP4 与整数算例；GLM 双机每台机器 TP8，down 投影每卡持有 1536 个输入通道。权重片常驻，推理时不随请求搬动。",
      },
      {
        label: "DP · 分请求",
        title: "DP：两台机器各是一个执行组，整条请求进入其中一组",
        text: "前端按等待与运行的请求数打分选组；请求的全部行留在该组计算并回复。",
        shape: "2 个 DP 组 · 每组 8 卡 TP8 · 请求 A、B 各 4 个 token",
        blocks: [],
        labels: [],
        note: "GLM 官方双机 DP2：两台机器各一个执行组。矩阵数值与回复 token 为示意；专家分布按部署的连续编号。",
      },
      {
        label: "EP · 分专家",
        title: "EP：一行 hidden 去找选中的 8 位专家，再带着结果回来",
        text: "按行分给源卡，router 选 top-8，dispatch、专家计算、combine 加权，最后 All-Gather 并加上共享专家。",
        shape: "EP16 · 每卡 18 位路由专家 · top-8 · 组合权重和 2.5 · 1 位共享专家",
        blocks: [],
        labels: [],
        note: "GLM 官方双机 EP16 的 MC2 路径示意：每行 4 个通道代替 4096；分数与专家输出为示意，专家编号与所在卡按部署的连续编号。",
      },
    ],
  },
  "token-flow": {
    title: "R1：从客户端的一句话，到逐段返回",
    page: "one-request",
    intro: "一次播放完整走完输入、模型计算、生成循环和流式返回；当前步骤从完整结构中展开。",
    note: "句子、token 与回答为教学示例；沿用正文 R1 的四位置缩尺及 MTP 条件，不代表真实分词或推理实测。",
    steps: [
      {
        label: "入口与调度",
        title: "从客户端的一句话，到 8 个 worker 的输入",
        text: "同一条请求从四个 token ID 变成可执行的计划。",
        shape: "4 个输入位置 · DP0 · TP8",
        blocks: [],
        labels: [],
      },
      {
        label: "逐层计算",
        title: "四个输入位置，怎样产生下一位置的分数",
        text: "查词向量、四路残差、45 层主干，再取最后位置投影。",
        shape: "[4,4096] → [4,4,4096] → [1,154880]",
        blocks: [],
        labels: [],
      },
      {
        label: "采样与返回",
        title: "已确认的 y₀ 与待验证的候选，分开追踪",
        text: "引擎追加已确认 token，候选留待下一轮验证。",
        shape: "已计算 4 · 持有 5 · 下一轮验证 1 + 3",
        blocks: [],
        labels: [],
      },
      {
        label: "文字流与收尾",
        title: "一批批返回文字，直到客户端收到结束标记",
        text: "接着首批文字，逐批返回后续确认输出，再演示 EOS 结束分支。",
        shape: "确认 ID → 增量文字 → SSE → 客户端；EOS → 回收 → [DONE]",
        blocks: [],
        labels: [],
      },
    ],
  },
};

export function isSceneLessonId(value: string): value is SceneLessonId {
  return Object.hasOwn(SCENE_LESSONS, value);
}

/** 阅读页与静态链接检查共用；连续请求保留原来四段的入口。 */
export function sceneAnchorIds(source: string): string[] {
  const [id, part] = source.trim().split(":");
  if (!id || !isSceneLessonId(id)) return [];
  const anchor = `scene-${id}`;
  if (part !== undefined) {
    const section = Number(part);
    return Number.isInteger(section) && section >= 0 && section < SCENE_LESSONS[id].steps.length
      ? [`${anchor}-${section}`]
      : [];
  }
  return [
    anchor,
    ...(id === "token-flow" ? SCENE_LESSONS[id].steps.map((_, index) => `${anchor}-${index}`) : []),
  ];
}
