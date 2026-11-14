export const DP_STOPS = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 0.94, 1] as const;
export function dpDeployment(local: number) {
  return {
    stage: local < 0.1 ? 0 : local < 0.55 ? 1 : 2,
    copies: Math.max(0, Math.min(1, (local - 0.1) / 0.4)),
    landing: Math.max(0, Math.min(1, (local - 0.55) / 0.41)),
  };
}
export const DP_TITLES = [
  "先看全局：两位用户，共用一个前端入口",
  "用户甲先发来 A：前端比较两组负载",
  "A 整条送入 DP0，前端立即记下这笔分配",
  "用户乙再发来 B：此刻 DP1 的分数更低",
  "B 整条送入 DP1，两条请求各有归属",
  "先 embedding：4个编号展开成4行，再由本组8卡计算",
  "前端按请求身份，把回复分别送回甲、乙",
  "DP 分的是请求；下一条来了，还要重新比较负载",
] as const;
export const DP_DETAILS = [
  "服务启动时就建好了 DP0、DP1 两个执行组，各有队列、调度器和缓存。现在甲、乙准备各发一条请求；组数不会因为来了两个用户才临时变成 2。",
  "A 先到 API 前端：接收文本、分词，再选择执行组。本例两组都空闲，分数同为 0，示意先选 DP0；同分时不是根据用户身份决定。",
  "A 进入 DP0 的等待队列。前端先把自己记录的 DP0 等待数加 1：等待×4＋运行，从 0 变为 4。这笔本地记账让紧接着来的请求看见刚刚的分配。",
  "B 在下一次负载统计更新前到达同一个前端：DP0 为 1×4＋0＝4，DP1 为 0×4＋0＝0，所以选 DP1。两次选择的结果来自此刻负载，不是固定轮流，也不是一个用户绑定一个组。",
  "B 落到 DP1 的队列，前端也记下一笔。A 仍属于 DP0；没有把 A 拆成 A、B，也没有把同一条请求复制给两组。",
  "每组取出自己的4个 token 编号，查 embedding 表：每个编号对应一行隐藏向量，整条请求展开成4行×4096通道（画面缩为6通道）。展开结束后，本组8卡通过TP合作计算；DP没有把一条请求的行切给另一组。这里只放大输入，生成仍需多轮执行。",
  "DP0 的回复 a 经过前端回到甲，DP1 的回复 b 回到乙。这里只示意各自的一段回复；真实生成会多轮执行，状态与缓存继续留在原组。",
  "多一组，让更多请求可以同时推进。A、B 本次分到不同组是这组负载下的选择；换一组负载，两条新请求也可能先后选中同一组。",
] as const;

export function dpRequestFrame(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const stage = p >= 1 ? 7 : DP_STOPS.findIndex((end) => end > p) - 1;
  const local = (p - DP_STOPS[stage]!) / (DP_STOPS[stage + 1]! - DP_STOPS[stage]!);
  const waiting: [number, number] = [stage >= 2 ? 1 : 0, stage >= 4 ? 1 : 0];
  const requests = [0, 1].map((owner) => {
    const arrival = owner ? 3 : 1;
    const dispatch = owner ? 4 : 2;
    const place =
      stage < arrival
        ? "user"
        : stage === arrival
          ? "arriving"
          : stage === dispatch
            ? "dispatch"
            : stage < 6
              ? "group"
              : stage === 6
                ? "returning"
                : "done";
    return { owner, place, amount: local };
  });
  return { stage, local, waiting, scores: waiting.map((n) => n * 4), requests };
}

export function epIntroduction(local: number) {
  return {
    stage: Math.min(2, Math.floor(local * 3)),
    arrived: Math.min(1, local * 4),
    selected: local >= 2 / 3,
  };
}

export const EP_ROUTE_WEIGHTS = [0.25, 0.2, 0.15, 0.12, 0.1, 0.08, 0.06, 0.04];
export const EP_OUTPUT_CHANNEL = [2, 4, 6, 8, 10, 12, 14, 16];
export const EP_COMBINED_CHANNEL = EP_ROUTE_WEIGHTS.reduce(
  (sum, weight, i) => sum + weight * EP_OUTPUT_CHANNEL[i]!,
  0,
);
