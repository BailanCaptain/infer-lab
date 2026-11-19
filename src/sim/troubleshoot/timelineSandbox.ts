/**
 * Pure TypeScript `Perfetto-lite` schematic relative-timeline sandbox
 * for Wave 4A Tool ③ (`troubleshoot-workbench` Panel B).
 *
 * Strictly schematic and physically isolated from Panel A real log analysis:
 * every span uses dimensionless relative progress coordinates (0..100) rather than
 * fabricated hardware millisecond or cycle numbers.
 */

export const SCHEMATIC_TRACE_BADGE_TEXT = "示意相对时序 · 非真机实测 Trace" as const;

export type TimelineScenarioId =
  | "proxy-buffering"
  | "host-dispatch-bubble"
  | "rank-straggler-hccl"
  | "unbounded-prefill-head-of-line"
  | "kv-preemption-storm"
  | "moe-ep-straggler-dummy";

export type SpanRole = "compute" | "comm" | "host" | "kv" | "proxy" | "wait-bubble" | "fault" | "output";

export interface TimelineSpan {
  id: string;
  label: string;
  /** Dimensionless relative start on 0..100 schematic progress axis */
  start: number;
  /** Dimensionless relative end on 0..100 schematic progress axis */
  end: number;
  role: SpanRole;
  detail: string;
}

export interface TimelineLane {
  id: string;
  label: string;
  sublabel: string;
  spans: readonly TimelineSpan[];
}

export interface TimelineMarker {
  /** Dimensionless relative position on 0..100 schematic progress axis */
  at: number;
  label: string;
  tone: "fault" | "fixed" | "neutral";
}

export interface TimelineSnapshot {
  stateLabel: string;
  relativeAxisCaption: string;
  bottleneckCallout: string;
  lanes: readonly TimelineLane[];
  markers: readonly TimelineMarker[];
}

export interface TimelineScenario {
  id: TimelineScenarioId;
  shortLabel: string;
  title: string;
  symptomSummary: string;
  boundaryQuestion: string;
  counterfactualLabel: string;
  counterfactualSummary: string;
  faultState: TimelineSnapshot;
  fixedState: TimelineSnapshot;
  discriminatingEvidence: readonly string[];
  nextStepCmd: string;
  wikiPageIds: readonly string[];
}

export const TIMELINE_SCENARIOS: readonly TimelineScenario[] = [
  {
    id: "proxy-buffering",
    shortLabel: "1. 反向代理缓冲积压",
    title: "反向代理流式缓冲积压（NPU 早已产出首词，卡在网关攒包）",
    symptomSummary:
      "客户端长时间收不到任何流式分片直至超时，看似「模型推理卡死」；实则 NPU 在早期就完成首个 token 并由引擎发出，只是反向代理开启缓冲把 SSE 分片全部攒在网关内存里。",
    boundaryQuestion: "最后在哪一步还正常？vLLM 引擎已发出首个片段，代理已收到该片段，但客户端侧零接收。",
    counterfactualLabel: "关闭代理缓冲（proxy_buffering off / SSE 透传）",
    counterfactualSummary:
      "关闭代理层缓冲后，NPU 每完成一个 decode step 并经由前端写出，代理立即透传给客户端，首字可见时机提前到与引擎首词几乎同步。",
    faultState: {
      stateLabel: "故障态：代理层开启响应缓冲（客户端超时无首字）",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，仅表示先后与阻塞关系）",
      bottleneckCallout: "NPU 与 vLLM 前端早已产出 Chunk 1..4，却被反向代理全部攒住直到触发客户端超时。",
      markers: [
        { at: 26, label: "引擎发出首词", tone: "neutral" },
        { at: 88, label: "客户端超时断连", tone: "fault" },
      ],
      lanes: [
        {
          id: "npu",
          label: "NPU 执行",
          sublabel: "Prefill + Decode",
          spans: [
            {
              id: "p1",
              label: "Prefill",
              start: 4,
              end: 20,
              role: "compute",
              detail: "完成输入编码并产出首词",
            },
            {
              id: "d1",
              label: "Decode #1",
              start: 22,
              end: 34,
              role: "compute",
              detail: "持续生成后续 token",
            },
            {
              id: "d2",
              label: "Decode #2",
              start: 36,
              end: 48,
              role: "compute",
              detail: "持续生成后续 token",
            },
            {
              id: "d3",
              label: "Decode #3",
              start: 50,
              end: 62,
              role: "compute",
              detail: "模型侧完全正常推进",
            },
          ],
        },
        {
          id: "engine",
          label: "vLLM 前端",
          sublabel: "SSE Chunk 输出",
          spans: [
            {
              id: "e1",
              label: "发出 Chunk 1",
              start: 21,
              end: 27,
              role: "output",
              detail: "首词已交给下游 TCP",
            },
            { id: "e2", label: "Chunk 2", start: 35, end: 41, role: "output", detail: "继续流式写出" },
            { id: "e3", label: "Chunk 3", start: 49, end: 55, role: "output", detail: "继续流式写出" },
          ],
        },
        {
          id: "proxy",
          label: "反向代理",
          sublabel: "缓冲攒包区",
          spans: [
            {
              id: "px1",
              label: "缓冲积压（未到达 flush 阈值，持续扣留 Chunk 1..3）",
              start: 27,
              end: 88,
              role: "fault",
              detail: "Nginx/网关 proxy_buffering=on 扣留小体积 SSE 分片",
            },
          ],
        },
        {
          id: "client",
          label: "客户端视图",
          sublabel: "首字可见时机",
          spans: [
            {
              id: "c1",
              label: "持续白屏等待…直至读超时（未收到首包）",
              start: 4,
              end: 88,
              role: "wait-bubble",
              detail: "直连服务正常、经代理积压即可确证",
            },
          ],
        },
      ],
    },
    fixedState: {
      stateLabel: "对策态：代理关闭响应缓冲（SSE 逐片透传）",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，仅表示先后与阻塞关系）",
      bottleneckCallout:
        "关闭 proxy_buffering 并设置 X-Accel-Buffering: no 后，每个分片紧随引擎输出抵达客户端。",
      markers: [
        { at: 26, label: "引擎发出首词", tone: "neutral" },
        { at: 30, label: "客户端即时收到首词", tone: "fixed" },
      ],
      lanes: [
        {
          id: "npu",
          label: "NPU 执行",
          sublabel: "Prefill + Decode",
          spans: [
            { id: "fp1", label: "Prefill", start: 4, end: 20, role: "compute", detail: "计算耗时未变" },
            { id: "fd1", label: "Decode #1", start: 22, end: 34, role: "compute", detail: "正常推进" },
            { id: "fd2", label: "Decode #2", start: 36, end: 48, role: "compute", detail: "正常推进" },
            { id: "fd3", label: "Decode #3", start: 50, end: 62, role: "compute", detail: "正常推进" },
          ],
        },
        {
          id: "engine",
          label: "vLLM 前端",
          sublabel: "SSE Chunk 输出",
          spans: [
            { id: "fe1", label: "Chunk 1", start: 21, end: 27, role: "output", detail: "发出首词" },
            { id: "fe2", label: "Chunk 2", start: 35, end: 41, role: "output", detail: "发出后续" },
            { id: "fe3", label: "Chunk 3", start: 49, end: 55, role: "output", detail: "发出后续" },
          ],
        },
        {
          id: "proxy",
          label: "反向代理",
          sublabel: "零缓冲透传",
          spans: [
            { id: "fpx1", label: "透传 #1", start: 27, end: 31, role: "proxy", detail: "立即 flush" },
            { id: "fpx2", label: "透传 #2", start: 41, end: 45, role: "proxy", detail: "立即 flush" },
            { id: "fpx3", label: "透传 #3", start: 55, end: 59, role: "proxy", detail: "立即 flush" },
          ],
        },
        {
          id: "client",
          label: "客户端视图",
          sublabel: "逐词流式呈现",
          spans: [
            { id: "fc1", label: "收到 #1", start: 31, end: 37, role: "output", detail: "首字立刻可见" },
            { id: "fc2", label: "收到 #2", start: 45, end: 51, role: "output", detail: "平滑流式输出" },
            { id: "fc3", label: "收到 #3", start: 59, end: 65, role: "output", detail: "平滑流式输出" },
          ],
        },
      ],
    },
    discriminatingEvidence: [
      "同一条 request_id 在 vLLM 服务端日志已打印首词写出时间，但客户端侧仍为零字节到达。",
      "绕开网关执行 curl -N 直连服务端口可逐字流式返回，经代理访问则整段卡住后一次吐出或超时。",
      "修改代理配置（如 proxy_buffering off）后现象消失，回滚配置后问题可复现。",
    ],
    nextStepCmd:
      "curl -N -sS http://127.0.0.1:8000/v1/chat/completions -H 'Content-Type: application/json' -d '{...\"stream\":true}'",
    wikiPageIds: ["request-overview", "ascend-env-and-serve"],
  },
  {
    id: "host-dispatch-bubble",
    shortLabel: "2. Host 逐算子下发空泡",
    title: "Eager 模式 Host 逐算子下发空泡拉高 TPOT（ACLGraph 消泡对比）",
    symptomSummary:
      "小 batch Decode 时 KV 使用率低、零排队，但单 token 延迟（ITL/TPOT）明显偏高；NPU AI Core 利用率曲线锯齿严重，大部分时间在干等 CPU 逐个提交 Python/ACL 算子。",
    boundaryQuestion:
      "最后在哪一步还正常？单算子计算本身很快，但相邻算子之间存在大段 Host 侧调度与启动空泡。",
    counterfactualLabel: "开启 ACLGraph（FULL_DECODE_ONLY）+ 异步调度",
    counterfactualSummary:
      "将 Decode 整图捕获为 ACLGraph 后，CPU 每步只需一次轻量化图重放触发（Graph Replay），NPU 流上算子背靠背连续执行，大幅抹平下发空泡。",
    faultState: {
      stateLabel: "故障态：Eager 逐算子下发（Host 成为瓶颈，NPU 频繁空转）",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，仅表示下发与执行重叠度）",
      bottleneckCallout:
        "Host 侧 Python 调度与逐个 ACL op 下发慢于小算子执行，NPU 队列反复出现大段红色空闲空泡。",
      markers: [
        { at: 46, label: "Eager Step #1 结束", tone: "fault" },
        { at: 92, label: "Eager Step #2 结束", tone: "fault" },
      ],
      lanes: [
        {
          id: "host",
          label: "Host CPU",
          sublabel: "Python + ACL 下发",
          spans: [
            { id: "h1", label: "下发 QKV", start: 2, end: 13, role: "host", detail: "Python 构图与参数封装" },
            { id: "h2", label: "下发 Attn", start: 15, end: 26, role: "host", detail: "逐算子提交到队列" },
            { id: "h3", label: "下发 MLP", start: 28, end: 39, role: "host", detail: "下发开销超过计算本身" },
            {
              id: "h4",
              label: "Step #2 下发…",
              start: 48,
              end: 84,
              role: "host",
              detail: "下一轮继续逐算子串行下发",
            },
          ],
        },
        {
          id: "npu",
          label: "NPU AI Core",
          sublabel: "设备侧算子流",
          spans: [
            { id: "n1", label: "QKV", start: 13, end: 18, role: "compute", detail: "算子极短" },
            {
              id: "b1",
              label: "空泡",
              start: 18,
              end: 26,
              role: "wait-bubble",
              detail: "等待 Host 下发下一个算子",
            },
            { id: "n2", label: "Attn", start: 26, end: 32, role: "compute", detail: "执行注意力" },
            { id: "b2", label: "空泡", start: 32, end: 39, role: "wait-bubble", detail: "再次空等 Host" },
            { id: "n3", label: "MLP", start: 39, end: 46, role: "compute", detail: "完成 Step #1" },
            {
              id: "b3",
              label: "跨步同步与下发空泡",
              start: 46,
              end: 64,
              role: "fault",
              detail: "同步取采样结果 + 下一轮下发空泡",
            },
            {
              id: "n4",
              label: "Step #2 稀疏执行",
              start: 64,
              end: 92,
              role: "compute",
              detail: "TPOT 显著拉长",
            },
          ],
        },
      ],
    },
    fixedState: {
      stateLabel: "对策态：ACLGraph 整图重放 + 异步调度（算子紧密背靠背）",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，仅表示下发与执行重叠度）",
      bottleneckCallout:
        "Host 每次仅提交一次 Graph Replay，并提前准备下一步元数据，NPU 连续满载执行多个 Decode Step。",
      markers: [
        { at: 28, label: "Graph Step #1 结束", tone: "fixed" },
        { at: 50, label: "Graph Step #2 结束", tone: "fixed" },
        { at: 72, label: "Graph Step #3 结束", tone: "fixed" },
      ],
      lanes: [
        {
          id: "host",
          label: "Host CPU",
          sublabel: "单次图重放 + 异步预备",
          spans: [
            {
              id: "fh1",
              label: "Replay #1",
              start: 2,
              end: 9,
              role: "host",
              detail: "单次图提交覆盖整层链路",
            },
            {
              id: "fh2",
              label: "异步准备 + Replay #2",
              start: 16,
              end: 25,
              role: "host",
              detail: "与 NPU 执行重叠",
            },
            {
              id: "fh3",
              label: "异步准备 + Replay #3",
              start: 38,
              end: 47,
              role: "host",
              detail: "持续领先设备队列",
            },
          ],
        },
        {
          id: "npu",
          label: "NPU AI Core",
          sublabel: "ACLGraph 连续重放流",
          spans: [
            {
              id: "fn1",
              label: "Step #1 整图连续",
              start: 8,
              end: 28,
              role: "compute",
              detail: "QKV + Attn + MLP 图内算子无缝衔接",
            },
            {
              id: "fn2",
              label: "Step #2 连续重放",
              start: 29,
              end: 50,
              role: "compute",
              detail: "空泡显著收窄",
            },
            {
              id: "fn3",
              label: "Step #3 连续重放",
              start: 51,
              end: 72,
              role: "compute",
              detail: "同等窗口完成更多 token",
            },
          ],
        },
      ],
    },
    discriminatingEvidence: [
      "/metrics 显示 kv_cache_usage_perc 偏低且 num_requests_waiting=0，排除容量与排队瓶颈。",
      "核对启动日志可见 enforce_eager=True 或 cudagraph_mode=NONE，未进入 capture_model()。",
      "固定相同单条请求，关闭 --enforce-eager 启用 ACLGraph 后 ITL 显著下降且 AI Core 空隙缩短。",
    ],
    nextStepCmd: "grep -nE 'enforce_eager|cudagraph_mode|capture_model|Graph capturing' vllm_serve.log",
    wikiPageIds: ["acl-graph", "npugraph-ex", "roofline-and-metrics"],
  },
  {
    id: "rank-straggler-hccl",
    shortLabel: "3. 首错卡引发 EI0006 假象",
    title: "Rank 3 算子报错/慢卡导致 Rank 0..2 卡在 AllReduce 报 EI0006 假象",
    symptomSummary:
      "日志最末尾刷屏出现 Rank 0/1/2 的 HCCL EI0006 Notify wait execute timeout，极易误判为网络故障或 Rank 0 问题；回溯时间线发现 Rank 3 早已因 OOM / EZ9999 中断，从未到达集体通信同步点。",
    boundaryQuestion:
      "最后在哪一步还正常？Rank 0..2 已正常到达 AllReduce 屏障，但 Rank 3 在前序算子阶段即已失败离场。",
    counterfactualLabel: "修复 Rank 3 首错（回落显存/修复算子）恢复全员同步",
    counterfactualSummary:
      "排除 Rank 3 的前序异常后，4 张卡在相近相对时刻抵达 AllReduce 屏障，通信短暂完成并继续下一层计算，EI0006 彻底消失。",
    faultState: {
      stateLabel: "故障态：Rank 3 先行失败，Rank 0..2 苦等 AllReduce 直至 EI0006",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，还原首错与连锁超时的因果先后）",
      bottleneckCallout:
        "Rank 3 在早期即触发 OOM / EZ9999（真正首错）；Rank 0..2 全部在后期死等 Notify wait 才报出 EI0006。",
      markers: [
        { at: 26, label: "Rank 3 首错中断", tone: "fault" },
        { at: 86, label: "Rank 0..2 连锁报 EI0006", tone: "fault" },
      ],
      lanes: [
        {
          id: "r0",
          label: "Rank 0",
          sublabel: "TP Worker 0",
          spans: [
            {
              id: "r0c",
              label: "Layer Compute",
              start: 4,
              end: 24,
              role: "compute",
              detail: "正常完成本层前向",
            },
            {
              id: "r0w",
              label: "AllReduce Notify wait … 最终 EI0006",
              start: 24,
              end: 88,
              role: "wait-bubble",
              detail: "次生症状：等待 Rank 3 到达",
            },
          ],
        },
        {
          id: "r1",
          label: "Rank 1",
          sublabel: "TP Worker 1",
          spans: [
            {
              id: "r1c",
              label: "Layer Compute",
              start: 4,
              end: 25,
              role: "compute",
              detail: "正常完成本层前向",
            },
            {
              id: "r1w",
              label: "AllReduce Notify wait … 最终 EI0006",
              start: 25,
              end: 88,
              role: "wait-bubble",
              detail: "次生症状：等待 Rank 3 到达",
            },
          ],
        },
        {
          id: "r2",
          label: "Rank 2",
          sublabel: "TP Worker 2",
          spans: [
            {
              id: "r2c",
              label: "Layer Compute",
              start: 4,
              end: 24,
              role: "compute",
              detail: "正常完成本层前向",
            },
            {
              id: "r2w",
              label: "AllReduce Notify wait … 最终 EI0006",
              start: 24,
              end: 88,
              role: "wait-bubble",
              detail: "次生症状：等待 Rank 3 到达",
            },
          ],
        },
        {
          id: "r3",
          label: "Rank 3 ★首错",
          sublabel: "TP Worker 3",
          spans: [
            { id: "r3c", label: "Compute", start: 4, end: 18, role: "compute", detail: "进入本层算子" },
            {
              id: "r3f",
              label: "★ 首错：OOM / EZ9999 异常退出",
              start: 18,
              end: 36,
              role: "fault",
              detail: "未进入 AllReduce，直接中断进程",
            },
          ],
        },
      ],
    },
    fixedState: {
      stateLabel: "对策态：排除 Rank 3 首错后四卡同步完成 AllReduce",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，验证全员按序汇合）",
      bottleneckCallout: "四张卡均完成本层计算并在屏障处即时汇合，AllReduce 短暂完成并顺利进入下一层。",
      markers: [
        { at: 26, label: "四卡齐聚 AllReduce", tone: "fixed" },
        { at: 38, label: "进入下一层", tone: "fixed" },
      ],
      lanes: [
        {
          id: "r0",
          label: "Rank 0",
          sublabel: "TP Worker 0",
          spans: [
            { id: "fr0c1", label: "Layer N", start: 4, end: 24, role: "compute", detail: "正常计算" },
            { id: "fr0m", label: "AllReduce", start: 25, end: 36, role: "comm", detail: "四卡即时完成同步" },
            { id: "fr0c2", label: "Layer N+1", start: 38, end: 64, role: "compute", detail: "持续推进" },
          ],
        },
        {
          id: "r1",
          label: "Rank 1",
          sublabel: "TP Worker 1",
          spans: [
            { id: "fr1c1", label: "Layer N", start: 4, end: 25, role: "compute", detail: "正常计算" },
            { id: "fr1m", label: "AllReduce", start: 25, end: 36, role: "comm", detail: "同步完成" },
            { id: "fr1c2", label: "Layer N+1", start: 38, end: 64, role: "compute", detail: "持续推进" },
          ],
        },
        {
          id: "r2",
          label: "Rank 2",
          sublabel: "TP Worker 2",
          spans: [
            { id: "fr2c1", label: "Layer N", start: 4, end: 24, role: "compute", detail: "正常计算" },
            { id: "fr2m", label: "AllReduce", start: 25, end: 36, role: "comm", detail: "同步完成" },
            { id: "fr2c2", label: "Layer N+1", start: 38, end: 64, role: "compute", detail: "持续推进" },
          ],
        },
        {
          id: "r3",
          label: "Rank 3",
          sublabel: "TP Worker 3",
          spans: [
            {
              id: "fr3c1",
              label: "Layer N",
              start: 4,
              end: 25,
              role: "compute",
              detail: "已修复首错，按时到达",
            },
            { id: "fr3m", label: "AllReduce", start: 25, end: 36, role: "comm", detail: "按序参与同步" },
            { id: "fr3c2", label: "Layer N+1", start: 38, end: 64, role: "compute", detail: "持续推进" },
          ],
        },
      ],
    },
    discriminatingEvidence: [
      "按时间戳排序全部 Rank 日志，Rank 3 的 OOM / EZ9999 早于 Rank 0..2 的 EI0006。",
      "可将多卡交错日志粘贴到 Panel A 验证「首错 Rank 检测器」自动过滤次生 EI0006。",
      "单靠调大 HCCL_EXEC_TIMEOUT 只会拉长等待，无法让已退出的 Rank 3 复活。",
    ],
    nextStepCmd:
      "grep -rnE 'ERROR|EZ9999|out of memory|EI0006' ~/ascend/log/debug/plog/ | sort -k2 | head -n 30",
    wikiPageIds: ["cann-hccl", "collective-communication", "hccl-buffer"],
  },
  {
    id: "unbounded-prefill-head-of-line",
    shortLabel: "4. 长 Prefill 队头阻塞",
    title: "超长请求阻塞在途 Decode 引发 ITL 尖峰（Chunked Prefill 预算对比）",
    symptomSummary:
      "在线并发请求大部分回答流畅，但一旦涌入超长上下文（如 16K~32K prompt）请求，其他正在流式输出的短请求突然停顿一大截，产生剧烈的 ITL（Inter-Token Latency）尖峰。",
    boundaryQuestion:
      "最后在哪一步还正常？短请求的 KV 依然健康且未抢占，只是单步被一次性塞入的巨型 Prefill 霸占了全部算力窗口。",
    counterfactualLabel: "合理收紧 Chunked Prefill 预算（控制 max_num_batched_tokens）",
    counterfactualSummary:
      "将超长 prompt 切分为多个较小 chunk 与在途 Decode 交错拼批执行，在途请求每轮都能稳定吐出 token，ITL 尖峰被平滑削平。",
    faultState: {
      stateLabel: "故障态：无分块/超大预算 Prefill 霸占整步（在途 Decode 停顿）",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，展示队头阻塞对在途流式输出的影响）",
      bottleneckCallout:
        "长请求 R_long 一次性占用巨型计算步，导致已在生成的 R_short_A / B 被迫暂停出词，形成明显 ITL 尖峰。",
      markers: [
        { at: 18, label: "超长请求进入", tone: "fault" },
        { at: 74, label: "在途请求才恢复吐字", tone: "fault" },
      ],
      lanes: [
        {
          id: "sched",
          label: "NPU 批执行",
          sublabel: "单步混合计算",
          spans: [
            { id: "s1", label: "Decode", start: 4, end: 16, role: "compute", detail: "短请求流畅解码" },
            {
              id: "s2",
              label: "整段超长 Prefill（未切分，霸占算力）",
              start: 18,
              end: 74,
              role: "fault",
              detail: "单步耗时暴涨，阻断其他请求",
            },
            {
              id: "s3",
              label: "Decode 恢复",
              start: 76,
              end: 88,
              role: "compute",
              detail: "长步结束后才恢复",
            },
          ],
        },
        {
          id: "short-a",
          label: "在途短请求 A",
          sublabel: "流式输出节奏",
          spans: [
            { id: "sa1", label: "Tok #1", start: 6, end: 16, role: "output", detail: "正常输出" },
            {
              id: "sa2",
              label: "被长 Prefill 阻塞停顿（ITL 尖峰）",
              start: 18,
              end: 74,
              role: "wait-bubble",
              detail: "客户端感知卡顿停顿",
            },
            { id: "sa3", label: "Tok #2", start: 76, end: 86, role: "output", detail: "恢复输出" },
          ],
        },
        {
          id: "long-r",
          label: "超长请求 B",
          sublabel: "Prompt 处理",
          spans: [
            {
              id: "lr1",
              label: "一次性全量 Prefill",
              start: 18,
              end: 74,
              role: "compute",
              detail: "吞吐优先但牺牲在途 ITL",
            },
            { id: "lr2", label: "首词", start: 76, end: 84, role: "output", detail: "产出首个 token" },
          ],
        },
      ],
    },
    fixedState: {
      stateLabel: "对策态：Chunked Prefill 切块交错拼批（平滑 ITL 波动）",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，展示分块预算对 ITL 的保护）",
      bottleneckCallout: "长请求被切成 Chunk 1..3 分轮推进，每轮与在途短请求共同拼批，短请求持续稳定吐词。",
      markers: [
        { at: 36, label: "Chunk #1 + Decode 共步", tone: "fixed" },
        { at: 78, label: "长请求完成全部 Chunk", tone: "fixed" },
      ],
      lanes: [
        {
          id: "sched",
          label: "NPU 批执行",
          sublabel: "受控预算混合步",
          spans: [
            { id: "fs1", label: "Decode", start: 4, end: 15, role: "compute", detail: "平稳推进" },
            {
              id: "fs2",
              label: "Chunk #1+Dec",
              start: 18,
              end: 36,
              role: "compute",
              detail: "单步 token 受预算封顶",
            },
            { id: "fs3", label: "Chunk #2+Dec", start: 39, end: 57, role: "compute", detail: "单步可控" },
            {
              id: "fs4",
              label: "Chunk #3+Dec",
              start: 60,
              end: 78,
              role: "compute",
              detail: "长请求编码收尾",
            },
          ],
        },
        {
          id: "short-a",
          label: "在途短请求 A",
          sublabel: "流式输出节奏",
          spans: [
            { id: "fsa1", label: "Tok #1", start: 6, end: 15, role: "output", detail: "平稳" },
            { id: "fsa2", label: "Tok #2", start: 27, end: 36, role: "output", detail: "不被阻塞" },
            { id: "fsa3", label: "Tok #3", start: 48, end: 57, role: "output", detail: "持续平滑" },
            { id: "fsa4", label: "Tok #4", start: 69, end: 78, role: "output", detail: "ITL 尖峰消退" },
          ],
        },
        {
          id: "long-r",
          label: "超长请求 B",
          sublabel: "分块 Prompt 处理",
          spans: [
            { id: "flr1", label: "Chunk 1", start: 18, end: 32, role: "kv", detail: "写入前段 KV" },
            { id: "flr2", label: "Chunk 2", start: 39, end: 53, role: "kv", detail: "写入中段 KV" },
            { id: "flr3", label: "Chunk 3", start: 60, end: 74, role: "kv", detail: "写入末段 KV" },
            { id: "flr4", label: "首词", start: 79, end: 87, role: "output", detail: "平滑开始生成" },
          ],
        },
      ],
    },
    discriminatingEvidence: [
      "在途短请求的 ITL 尖峰时刻与超长输入请求到达的日志时间戳高度重合。",
      "核对实际生效的 max_num_batched_tokens 与 enable_chunked_prefill：若预算过大（或关闭分块），单步计算时间随 prompt 长度线性暴涨。",
      "将 max_num_batched_tokens 下调后复测混合负载，短请求 P99 ITL 明显回落（以超长请求 TTFT 略微增加为代价）。",
    ],
    nextStepCmd: "grep -nE 'max_num_batched_tokens|enable_chunked_prefill' vllm_serve.log",
    wikiPageIds: ["chunked-prefill", "continuous-batching", "core-cli-params"],
  },
  {
    id: "kv-preemption-storm",
    shortLabel: "5. KV 抢占重算风暴",
    title: "KV 块耗尽引发抢占重算抖动（限流 max_num_seqs / 扩容 KV 对比）",
    symptomSummary:
      "高并发持续片刻后，请求输出反复卡顿，吞吐不升反降；/metrics 可见 kv_cache_usage_perc 逼近 100%，num_preemptions 持续攀升，大量算力被浪费在重复 Prefill 重算上。",
    boundaryQuestion:
      "最后在哪一步还正常？请求已进入运行队列并算出前段文本，但在追加新 token 申请物理 KV 块时池子见底，被迫驱逐重算。",
    counterfactualLabel: "限流并发（下调 max_num_seqs）或扩充可用 KV 池",
    counterfactualSummary:
      "把在途活跃序列的峰值 KV 需求控制在物理块池容量之内（多余请求在入口排队而非抢占在途请求），彻底消除驱逐与重算抖动。",
    faultState: {
      stateLabel: "故障态：KV 池持续打满（抢占 → 释放 → 重算恶性循环）",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，展示 KV 水位触顶触发抢占重算）",
      bottleneckCallout:
        "KV 物理块池触顶后，调度器被迫驱逐在途请求 R2 并丢失其已算 KV，后续恢复时不得不整段 Recompute Prefill。",
      markers: [
        { at: 36, label: "KV 水位触顶 · 触发抢占", tone: "fault" },
        { at: 62, label: "被迫重算已生成前缀", tone: "fault" },
      ],
      lanes: [
        {
          id: "kvpool",
          label: "KV 物理块池",
          sublabel: "空闲块水位",
          spans: [
            { id: "k1", label: "水位爬升", start: 4, end: 34, role: "kv", detail: "并发序列持续增长" },
            {
              id: "k2",
              label: "★ 98~100% 枯竭（触发抢占）",
              start: 34,
              end: 64,
              role: "fault",
              detail: "无法分配新块，强制驱逐在途请求",
            },
            {
              id: "k3",
              label: "再次逼近上限",
              start: 64,
              end: 92,
              role: "fault",
              detail: "重算后很快再次打满",
            },
          ],
        },
        {
          id: "req1",
          label: "高优请求 R1",
          sublabel: "继续占用块",
          spans: [
            { id: "q1a", label: "Decode", start: 6, end: 36, role: "compute", detail: "持续消耗新 KV 块" },
            {
              id: "q1b",
              label: "完成并释放 KV",
              start: 38,
              end: 60,
              role: "output",
              detail: "结束后空出一批块",
            },
          ],
        },
        {
          id: "req2",
          label: "被抢占请求 R2",
          sublabel: "进度回退重算",
          spans: [
            { id: "q2a", label: "Decode", start: 8, end: 36, role: "compute", detail: "已生成一半内容" },
            {
              id: "q2b",
              label: "被驱逐挂起（KV 清空）",
              start: 36,
              end: 60,
              role: "wait-bubble",
              detail: "挂起等待空闲块",
            },
            {
              id: "q2c",
              label: "Recompute 重算全前缀",
              start: 60,
              end: 84,
              role: "fault",
              detail: "白白浪费算力重算历史 token",
            },
            { id: "q2d", label: "续跑", start: 85, end: 94, role: "compute", detail: "端到端延迟翻倍" },
          ],
        },
      ],
    },
    fixedState: {
      stateLabel: "对策态：合理限流 max_num_seqs / 扩容 KV 池（零抢占平滑推进）",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，验证 KV 水位留有安全余量）",
      bottleneckCallout:
        "在途并发与 KV 物理池匹配后，KV 水位维持在安全区间，无驱逐、无重算，整体有效吞吐反而提升。",
      markers: [{ at: 58, label: "零抢占平滑完成", tone: "fixed" }],
      lanes: [
        {
          id: "kvpool",
          label: "KV 物理块池",
          sublabel: "安全水位",
          spans: [
            {
              id: "fk1",
              label: "健康水位（留有余量，无驱逐）",
              start: 4,
              end: 88,
              role: "kv",
              detail: "稳定复用与回收",
            },
          ],
        },
        {
          id: "req1",
          label: "在途请求 R1",
          sublabel: "平滑完成",
          spans: [
            {
              id: "fq1",
              label: "Prefill + 连续 Decode",
              start: 6,
              end: 56,
              role: "compute",
              detail: "无中断完成并释放块",
            },
            { id: "fq1o", label: "结束", start: 57, end: 64, role: "output", detail: "正常收尾" },
          ],
        },
        {
          id: "req2",
          label: "在途请求 R2",
          sublabel: "零重算推进",
          spans: [
            {
              id: "fq2",
              label: "连续 Decode（全程保留 KV，无抢占）",
              start: 8,
              end: 76,
              role: "compute",
              detail: "零 Recompute 浪费",
            },
            { id: "fq2o", label: "结束", start: 77, end: 85, role: "output", detail: "平稳交付" },
          ],
        },
      ],
    },
    discriminatingEvidence: [
      "Prometheus /metrics 同步出现 vllm:kv_cache_usage_perc > 0.95、vllm:num_preemptions 递增与 num_requests_waiting > 0。",
      "vLLM 日志输出警告：Sequence group is preempted by Recompute mode because there is not enough KV cache space。",
      "下调 --max-num-seqs 或扩容可用 KV 块后，num_preemptions 增量归零且尾部延迟收敛。",
    ],
    nextStepCmd:
      "curl -s http://127.0.0.1:8000/metrics | grep -E 'vllm:(kv_cache_usage_perc|num_preemptions|num_requests_waiting)'",
    wikiPageIds: ["kv-cache", "paged-attention", "recompute-scheduler", "core-cli-params"],
  },
  {
    id: "moe-ep-straggler-dummy",
    shortLabel: "6. MoE 跨 DP 热点与陪跑",
    title: "MoE 跨 DP 热点专家倾斜与空闲 DP 组陪跑等待（EPLB / 均衡路由对比）",
    symptomSummary:
      "多机多卡 MoE（如 DP2 + EP16）在流量不均或专家路由倾斜时，某张持有热点专家的卡计算拉长，其余卡在 Dispatch/Combine 集合通信屏障处干等；甚至某个没有用户请求的 DP 组也必须执行 dummy 步陪跑，常被误判为「该 DP 前端堵塞」。",
    boundaryQuestion:
      "最后在哪一步还正常？各卡都收到了 Dispatch 路由分片，但热点专家所在 Rank 的 MoE FFN 远长于其他 Rank，拉长了整组 Combine 屏障。",
    counterfactualLabel: "开启 EPLB 专家负载均衡 + 跨 DP 请求均衡调度",
    counterfactualSummary:
      "通过冗余热点专家副本（EPLB）分摊单卡热点 token，并让各 DP 组负载均衡避免纯 dummy 陪跑，所有 Rank 同时抵达 Combine，尾延迟显著收敛。",
    faultState: {
      stateLabel: "故障态：热点专家倾斜 + 空闲 DP 组陪跑等待 Combine 屏障",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，展示 EP Combine 同步短板效应）",
      bottleneckCallout:
        "EP Rank 3 承载过量热点专家 token 形成长尾，其余 EP Rank 算完后全部卡在 Combine 屏障等待；空闲 DP 组也因全员 EP 通信而被迫陪跑。",
      markers: [
        { at: 32, label: "常规 Rank 算完进入干等", tone: "neutral" },
        { at: 76, label: "热点 Rank 才完成 MoE", tone: "fault" },
      ],
      lanes: [
        {
          id: "dp0-r0",
          label: "DP0 · EP Rank 0",
          sublabel: "常规专家负载",
          spans: [
            { id: "m1", label: "Dispatch", start: 4, end: 14, role: "comm", detail: "AllToAll / MC2 分发" },
            { id: "m2", label: "MoE FFN", start: 15, end: 32, role: "compute", detail: "很快算完本卡专家" },
            {
              id: "m3",
              label: "等待热点 Rank 抵达 Combine 屏障",
              start: 32,
              end: 76,
              role: "wait-bubble",
              detail: "被热点专家拖住",
            },
            { id: "m4", label: "Combine", start: 76, end: 88, role: "comm", detail: "汇总结果" },
          ],
        },
        {
          id: "dp0-r3",
          label: "DP0 · EP Rank 3",
          sublabel: "★ 热点专家集中卡",
          spans: [
            {
              id: "m5",
              label: "Dispatch",
              start: 4,
              end: 14,
              role: "comm",
              detail: "涌入大量热点专家 token",
            },
            {
              id: "m6",
              label: "★ 热点专家过载 MoE FFN（长尾慢卡）",
              start: 15,
              end: 76,
              role: "fault",
              detail: "负载倾斜主导整组步长",
            },
            { id: "m7", label: "Combine", start: 76, end: 88, role: "comm", detail: "最后到达同步点" },
          ],
        },
        {
          id: "dp1-idle",
          label: "DP1 空闲组",
          sublabel: "无用户请求但需陪跑",
          spans: [
            {
              id: "m8",
              label: "Dummy",
              start: 4,
              end: 14,
              role: "host",
              detail: "无请求仍需参与 EP 通信防死锁",
            },
            {
              id: "m9",
              label: "空转陪跑等待全组 Combine",
              start: 15,
              end: 76,
              role: "wait-bubble",
              detail: "不是前端堵，是 EP 全局同步要求",
            },
            { id: "m10", label: "Combine", start: 76, end: 88, role: "comm", detail: "随组同步结束" },
          ],
        },
      ],
    },
    fixedState: {
      stateLabel: "对策态：EPLB 冗余分摊热点 + 跨 DP 负载均衡",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，验证多卡同步均衡收敛）",
      bottleneckCallout:
        "热点专家经 EPLB 副本分散到多张卡，DP1 同步承接有效请求而非空跑，各卡几乎同时进入 Combine。",
      markers: [
        { at: 46, label: "各卡均衡齐聚 Combine", tone: "fixed" },
        { at: 58, label: "同步完成本层", tone: "fixed" },
      ],
      lanes: [
        {
          id: "dp0-r0",
          label: "DP0 · EP Rank 0",
          sublabel: "均衡专家负载",
          spans: [
            { id: "fm1", label: "Dispatch", start: 4, end: 14, role: "comm", detail: "均衡路由分发" },
            {
              id: "fm2",
              label: "MoE FFN（均衡）",
              start: 15,
              end: 44,
              role: "compute",
              detail: "分摊部分热点副本",
            },
            { id: "fm3", label: "Combine", start: 46, end: 58, role: "comm", detail: "无长尾等待" },
          ],
        },
        {
          id: "dp0-r3",
          label: "DP0 · EP Rank 3",
          sublabel: "热点已分摊",
          spans: [
            { id: "fm4", label: "Dispatch", start: 4, end: 14, role: "comm", detail: "token 数显著下降" },
            {
              id: "fm5",
              label: "MoE FFN（已削峰）",
              start: 15,
              end: 46,
              role: "compute",
              detail: "与其余卡对齐完成",
            },
            { id: "fm6", label: "Combine", start: 46, end: 58, role: "comm", detail: "准时汇合" },
          ],
        },
        {
          id: "dp1-idle",
          label: "DP1 均衡组",
          sublabel: "承接真实流量",
          spans: [
            { id: "fm7", label: "Dispatch", start: 4, end: 14, role: "comm", detail: "有效参与真实请求" },
            {
              id: "fm8",
              label: "MoE FFN（有效算力）",
              start: 15,
              end: 45,
              role: "compute",
              detail: "消除纯 dummy 陪跑浪费",
            },
            { id: "fm9", label: "Combine", start: 46, end: 58, role: "comm", detail: "全员同步完成" },
          ],
        },
      ],
    },
    discriminatingEvidence: [
      "采集各 Rank 的 MoE 路由 token 分布与 Combine 等待耗时：若热点 Rank 计算长、其余 Rank Combine 等待长，则为负载倾斜而非网络故障。",
      "检查各 DP 组活跃请求数：某 DP 组为 0 但仍在执行 dummy step 属于 EP 全局同步机制，不可误判为前端断流。",
      "启用 EPLB（expert load balancing）与入口请求均衡后，各 Rank MoE FFN 耗时方差与 Combine 等待同步下降。",
    ],
    nextStepCmd: "grep -nE 'enable_expert_parallel|eplb|data_parallel|alltoall|mc2' vllm_serve.log",
    wikiPageIds: ["expert-parallel", "moe", "data-parallel", "collective-communication"],
  },
];

export function getTimelineScenario(id: string | undefined): TimelineScenario {
  if (id) {
    const matched = TIMELINE_SCENARIOS.find((s) => s.id === id);
    if (matched) return matched;
  }
  return TIMELINE_SCENARIOS[0]!;
}

export function getTimelineSnapshot(
  scenarioId: TimelineScenarioId,
  counterfactualEnabled: boolean,
): TimelineSnapshot {
  const scenario = getTimelineScenario(scenarioId);
  return counterfactualEnabled ? scenario.fixedState : scenario.faultState;
}
