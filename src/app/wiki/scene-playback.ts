export const SCENE_STEP_SECONDS = 12;
export const PARALLEL_SECONDS = 48;
export const DATA_PARALLEL_SECONDS = 64;
export const EXPERT_PARALLEL_SECONDS = 72;
export const parallelSeconds = (step: number) =>
  step === 2 ? EXPERT_PARALLEL_SECONDS : step === 1 ? DATA_PARALLEL_SECONDS : PARALLEL_SECONDS;

// Keep enough time to recognize the input before splitting or routing it.
export function parallelPhase(progress: number, experts = false) {
  const boundaries = experts ? [0, 0.16, 0.36, 0.56, 0.75, 0.94, 1] : [0, 0.08, 0.28, 0.48, 0.78, 0.94, 1];
  const phase = Math.min(5, Math.max(0, boundaries.findIndex((end) => end > progress) - 1));
  const index = progress >= 1 ? 5 : phase;
  return {
    phase: index,
    local: Math.min(1, (progress - boundaries[index]!) / (boundaries[index + 1]! - boundaries[index]!)),
  };
}

/** Each contribution travels, lands, then joins the sum before the next one departs. */
export function parallelTransfer(progress: number) {
  const p = Math.max(0, Math.min(1, progress)) * 8;
  const index = Math.min(7, Math.floor(p)),
    local = p - index;
  return { index, local, count: index + Number(local >= 0.86) };
}

export function scenePosition(seconds: number, count: number) {
  const time = Math.max(0, Math.min(count * SCENE_STEP_SECONDS, Number.isFinite(seconds) ? seconds : 0));
  const step = Math.min(count - 1, Math.floor(time / SCENE_STEP_SECONDS));
  return { time, step, progress: (time - step * SCENE_STEP_SECONDS) / SCENE_STEP_SECONDS };
}

export function clipPosition(
  seconds: number,
  count: number,
  fixedStep?: number,
  parallel = false,
  fixedDuration = SCENE_STEP_SECONDS,
) {
  if (fixedStep === undefined) return scenePosition(seconds, count);
  const duration = parallel ? parallelSeconds(fixedStep) : fixedDuration;
  const time = Math.max(0, Math.min(duration, Number.isFinite(seconds) ? seconds : 0));
  return { time, step: fixedStep, progress: time / duration };
}

export const phaseAt = (progress: number, count = 4) =>
  Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
export const phaseProgress = (progress: number, count = 4) =>
  Math.min(1, progress * count - phaseAt(progress, count));

/** One illustrative routing decision: eight experts on six cards, including the source card. */
export function expertAssignments(source: number) {
  return [0, 0, 2, 5, 8, 8, 11, 14].map((offset, index) => {
    const rank = (source + offset) % 16;
    const slot = index === 1 || index === 5 ? 1 : 0;
    return { rank, slot, expert: rank * 18 + slot };
  });
}

/** Stagger only the illustration, so one long route can be followed at a time. */
export const expertTransferProgress = (local: number, index: number) =>
  Math.max(0, Math.min(1, local * 8 - index));

// Dense MLP down projection in the fixed GLM example; shapes follow Y = XW.
export const TP_DOWN_WEIGHT = { input: 12288, output: 4096, shards: 8 } as const;

export const SCENE_BEATS = {
  "model-compute": [
    ["读取四路 residual", "计算混合系数并合成一路", "RMSNorm 缩放，乘增益 γ", "归一化的向量交给 KDA"],
    [
      "同一输入送到三个投影",
      "输入与 Wq、Wk、Wv 相乘",
      "Q、K、V 三个结果逐步生成",
      "交给后续短卷积、门控和状态更新",
    ],
    ["输入送到 gate / up 投影", "展开后限幅并施加 SiLU", "两路逐元素相乘", "down 投影收回 4096 维"],
    ["保留四路旁路和前馈输出", "comb 混合原来的四路", "post 将前馈输出分到四路", "相加后的四路交给下一层"],
  ],
  "parallel-strategy": [
    [
      "先看整张输入：每行一个 token，横向是输入通道",
      "沿列分成8片：每片都保留完整的4个 token 行",
      "每卡产生4行×4列部分和，前景放大所选卡的结果",
      "按相同行列逐格相加：左上格1+2+…+8=36",
      "合齐的4×4输出矩阵送回本组各卡",
      "各卡保留完整输出；左上36、右下576，行序没有改变",
    ],
    [
      "布局：相同的稠密权重在两组各有一份（不是复制完整 MoE 模型）",
      "落卡：每份再由组内 TP8 分担；对应卡保存相同切片",
      "派请求：A 进入 DP0，B 进入 DP1，各有自己的队列",
      "计算：不同请求使用相同权重；示意 A 产生 a，B 产生 b",
      "返回：两组分别交回各自结果 a / b",
      "边界：这里只放大稠密计算；遇到 MoE，两组仍需 EP16 协作",
    ],
    [
      "router 选 8 个专家，本例落在 6 张卡",
      "dispatch：隐藏向量送到专家所在卡",
      "选中的专家计算；源卡也参与",
      "combine：专家结果回到源卡",
      "源卡按路由权重合并 8 份贡献",
      "得到这一行的专家输出；288 位专家的权重仍常驻各卡",
    ],
  ],
  "token-flow": [
    [
      "定位最后的输入位置：开了 / 103349",
      "按编号索引 embedding 表",
      "读取这一行的 4096 个数",
      "第 6 列的隐藏向量准备完成",
    ],
    [
      "取出最后位置的隐藏向量",
      "复制成四条 residual 流",
      "mHC 合并，再做 RMSNorm",
      "后续 45 层持续更新隐藏表示",
    ],
    ["45 层之后，四路取平均", "RMSNorm 得到输出头输入", "与词表输出头相乘", "生成下一位置的 154880 个分数"],
    ["读取最后位置的候选分数", "按生成策略选择候选", "得到新 token ID", "返回文字；未结束时新 ID 进入下一轮"],
  ],
} as const;
