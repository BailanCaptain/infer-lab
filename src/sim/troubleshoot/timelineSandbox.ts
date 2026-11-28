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
      'curl -N -sS http://127.0.0.1:8000/v1/chat/completions -H \'Content-Type: application/json\' -d \'{"model":"qwen3-8b","messages":[{"role":"user","content":"hi"}],"stream":true}\'',
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
    shortLabel: "3. 首错卡引发 EI0002 假象",
    title: "Rank 3 算子报错/慢卡导致 Rank 0..2 卡在 AllReduce 报 EI0002 假象",
    symptomSummary:
      "日志最末尾刷屏出现 Rank 0/1/2 的 HCCL EI0002 Notify wait execute timeout（通信算子执行期 Notify 等待超时，区别于建链阶段 Socket 超时 EI0006），极易误判为网络故障或 Rank 0 问题；回溯时间线发现 Rank 3 早已因 OOM / EZ9999 中断，从未到达集体通信同步点。",
    boundaryQuestion:
      "最后在哪一步还正常？Rank 0..2 已正常到达 AllReduce 屏障，但 Rank 3 在前序算子阶段即已失败离场。",
    counterfactualLabel: "修复 Rank 3 首错（回落显存/修复算子）恢复全员同步",
    counterfactualSummary:
      "排除 Rank 3 的前序异常后，4 张卡在相近相对时刻抵达 AllReduce 屏障，通信短暂完成并继续下一层计算，EI0002 彻底消失。",
    faultState: {
      stateLabel: "故障态：Rank 3 先行失败，Rank 0..2 苦等 AllReduce 直至 EI0002",
      relativeAxisCaption: "相对阶段轴 t₀ → t₄（无量纲示意，还原首错与连锁超时的因果先后）",
      bottleneckCallout:
        "Rank 3 在早期即触发 OOM / EZ9999（真正首错）；Rank 0..2 全部在后期死等 Notify wait 才报出 EI0002。",
      markers: [
        { at: 26, label: "Rank 3 首错中断", tone: "fault" },
        { at: 86, label: "Rank 0..2 连锁报 EI0002", tone: "fault" },
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
              label: "AllReduce Notify wait … 最终 EI0002",
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
              label: "AllReduce Notify wait … 最终 EI0002",
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
              label: "AllReduce Notify wait … 最终 EI0002",
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
      "按时间戳排序全部 Rank 日志，Rank 3 的 OOM / EZ9999 早于 Rank 0..2 的 EI0002（执行期 Notify 等待超时）。",
      "可将多卡交错日志粘贴到 Panel A 验证「首错 Rank 检测器」自动过滤纯次生 EI0002 等待刷屏（并保留真正先发生的主因或建链期 EI0006）。",
      "单靠调大 HCCL_EXEC_TIMEOUT 只会拉长等待，无法让已退出的 Rank 3 复活。",
    ],
    nextStepCmd:
      '{ [ -d ./all_node_logs ] || { echo "missing ./all_node_logs/" >&2; false; }; } && grep -rnI \'\' ./all_node_logs/ | awk \'function d2n(y,m,d, a,yoe,doy,doe){y-=(m<=2);a=int(y/400);yoe=y-a*400;doy=int((153*(m+(m>2?-3:9))+2)/5)+d-1;doe=yoe*365+int(yoe/4)-int(yoe/100)+doy;return a*146097+doe-719468} function valid_md(y,m,d, md){if(m<1||m>12||d<1)return 0;md=(m==2?((y==0||(y%4==0&&(y%100!=0||y%400==0)))?29:28):((m==4||m==6||m==9||m==11)?30:31));return d<=md} function tz(t, sgn,hm){if(t=="Z"||t=="z")return 0;sgn=(substr(t,1,1)=="-"?-1:1);hm=substr(t,2);gsub(/:/,"",hm);return sgn*(int(substr(hm,1,2))*3600+int(substr(hm,3,2))*60)} function n2ymd(z,era,doe,yoe,y,doy,mp,d,m){z+=719468;era=int(z/146097);doe=z-era*146097;yoe=int((doe-int(doe/1460)+int(doe/36524)-int(doe/146096))/365);y=yoe+era*400;doy=doe-(365*yoe+int(yoe/4)-int(yoe/100));mp=int((5*doy+2)/153);d=doy-int((153*mp+2)/5)+1;m=mp+(mp<10?3:-9);y+=(m<=2);return sprintf("%04d-%02d-%02d",y,m,d)} function to_utc(yr_n,mo_n,dy_n,hms,tzp, off,sec,ds,sh,ymd){off=tz(tzp);sec=int(substr(hms,1,2))*3600+int(substr(hms,4,2))*60+int(substr(hms,7,2))-off;ds=d2n(yr_n,mo_n,dy_n);sh=int(sec/86400);if(sec<0&&sec%86400!=0)sh--;sec-=sh*86400;ds+=sh;ymd=n2ymd(ds);return sprintf("%s-%02d:%02d:%02d",ymd,int(sec/3600),int((sec%3600)/60),sec%60)} function strip_ts(x){gsub(/[0-9]{4}-[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/," ",x);gsub(/E[0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/," ",x);gsub(/(^|[^0-9:])[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/," ",x);gsub(/(^|[^0-9:])([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/," ",x);return x} function is_hdr(hp){gsub(/(RUNTIME|HCCL|ASCENDCL|GE|DRV|AICPU|DEVDRV|TSD|APP|PROCMGR|TDT|SLOG)\\([0-9]+,[^)]*\\)/," ",hp);gsub(/WorkHCCL\\(([^()]|\\([^()]*\\))*\\)/," ",hp);gsub(/(\\[|\\()(Worker_|[A-Za-z0-9_]*EngineCore|APIServer)[^)\\]]*(\\]|\\))/," ",hp);sub(/^([[:space:]]*\\[[^]]+\\][[:space:]:-]*)+/," ",hp);gsub(/^[A-Za-z0-9_.-]+:/," ",hp);gsub(/ /,"  ",hp);gsub(/(^|[^[:alnum:]_])(host|node|instance|group|grp|pid|tid|uid|gid|rank|global_rank|local_rank)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_.:-]+/," ",hp);gsub(/(^|[^[:alnum:]_])((ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|DEBUG|EVENT)|[Rr]ank[[:space:]_:-]*[0-9]+|[Nn]ode[[:space:]_:-]*[0-9]+)([^[:alnum:]_]|$)/," ",hp);gsub(/[][[:space:]():,|\\/-]+/,"",hp);return hp==""} function find_ts(x, r, bp,bk,bt,p,t,ms,ml){bp=999999;bk=0;bt="";if(match(x,/[0-9]{4}-[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/)){ms=RSTART;ml=RLENGTH;if(is_hdr(substr(x,1,ms-1))){bp=ms;bk=1;bt=substr(x,ms,ml)}}if(match(x,/E[0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/)){ms=RSTART;ml=RLENGTH;if(ms<bp&&is_hdr(substr(x,1,ms-1))){bp=ms;bk=2;bt=substr(x,ms,ml)}}if(match(x,/(^|[^0-9-])[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/)){p=RSTART;ml=RLENGTH;t=substr(x,p,ml);if(substr(t,1,1)!~/[0-9]/){t=substr(t,2);p++}if(p<bp&&is_hdr(substr(x,1,p-1))){bp=p;bk=3;bt=t}}if(match(x,/(^|[^0-9:])([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?/)){p=RSTART;ml=RLENGTH;t=substr(x,p,ml);if(substr(t,1,1)!~/[0-9]/){t=substr(t,2);p++}if(p<bp&&is_hdr(substr(x,1,p-1))){bp=p;bk=4;bt=t}}r["bk"]=bk;r["bt"]=bt} function kv_val(str,key, m){if(match(tolower(str),"(^|[^[:alnum:]_])" key "[[:space:]]*[:=][[:space:]]*[^][:space:],)]+")){m=substr(str,RSTART,RLENGTH);sub(/^[^:=]*[:=][[:space:]]*/,"",m);return m}return ""} function get_tb_ids(x, ids, t,id,rid,wid,tl,v){split("",ids);rid="";wid="";ids["pid"]="";ids["host"]="";ids["inst"]="";ids["grp"]="";ids["rank"]="";ids["wid"]="";ids["rstr"]="";while(x!=""){if(sub(/^[[:space:]]+/,"",x))continue;if(match(x,/^([0-9]{4}-[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|E[0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?)/)){x=substr(x,RLENGTH+1);sub(/^[: -]+/,"",x);continue}if(match(x,/^(\\[[^]]+\\]|\\([^)]+\\)|(RUNTIME|HCCL|WorkHCCL|ASCENDCL|GE|DRV|AICPU|DEVDRV|TSD|APP|PROCMGR|TDT|SLOG)\\(([^()]|\\([^()]*\\))*\\)|Worker_[^:[:space:]]+|[Rr]ank[[:space:]_:-]*[0-9]+|[Nn]ode[[:space:]_:-]*[0-9]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]:]+|(ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|DEBUG|EVENT))/)){tl=RLENGTH;t=substr(x,1,tl);if(t~/^(\\[[Rr]ank[[:space:]_:-]*[0-9]+\\]|[Rr]ank[[:space:]_:-]*[0-9]+)$/){id=tolower(t);gsub(/[[:space:]\\[\\]():-]+/,"",id);if(rid==""){rid=id;ids["rank"]=id;ids["rstr"]=(substr(t,1,1)=="["?t:"[" t "]")}}else if(t~/^(\\[Worker_[^]]*\\]|\\(Worker_[^)]*\\))$/){id=tolower(t);gsub(/[[:space:]\\[\\]():-]+/,"",id);if(wid==""){wid=id;ids["wid"]=id}}v=kv_val(t,"pid");if(v~/^[0-9]+$/&&ids["pid"]=="")ids["pid"]=v;v=kv_val(t,"host");if(v!=""&&ids["host"]=="")ids["host"]=tolower(v);v=kv_val(t,"instance");if(v!=""&&ids["inst"]=="")ids["inst"]=tolower(v);v=kv_val(t,"(group|grp)");if(v!=""&&ids["grp"]=="")ids["grp"]=tolower(v);x=substr(x,tl+1);sub(/^[: -]+/,"",x);continue}break}return (rid!=""?rid:(wid!=""?wid:(ids["pid"]!=""?"pid" ids["pid"]:"")))} function clean_meta(x, out,k,y,pre){x=strip_ts(x);gsub(/(port|tokens? processed|pid|tid|uid|gid)[[:space:]:=]+[0-9]+/,"",x);gsub(/[0-9]+[[:space:]]+(tokens?|reqs?|requests?|steps?|iters?|iterations?|layers?|blocks?|items?|samples?|batches|bytes|KB|MB|GB|KiB|MiB|GiB|ms|us|ns|sec|seconds?)([^[:alnum:]_]|$)/," ",x);out="";while(match(x,/[A-Za-z_][A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*["\\047]?[A-Za-z0-9_.-]+["\\047]?/)){k=tolower(substr(x,RSTART,RLENGTH));if(k~/^([a-z_]*(log|logging|level|mode|verbosity)|vllm_[a-z_]+)[[:space:]]*[:=][[:space:]]*["\\047]?(error|critical|fatal|warn|warning|info|debug)["\\047]?$/){out=out substr(x,1,RSTART-1) " "}else if(substr(x,RSTART,RLENGTH)~/[:=][[:space:]]*[0-9]+$/){out=out substr(x,1,RSTART-1) ((k~/(err|ret|code|fault|fail|status)/||(RSTART>1&&substr(x,RSTART-1,1)=="."))?substr(x,RSTART,RLENGTH):" ")}else{out=out substr(x,1,RSTART+RLENGTH-1)}x=substr(x,RSTART+RLENGTH)}x=out x;if(x~/(^|[^[:alnum:]_])INFO([^[:alnum:]_]|$)/ && !(x~/(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/)){out="";y=x;while(match(y,/[0-9]{6}/)){pre=tolower(substr(y,(RSTART>32?RSTART-32:1),(RSTART>32?32:RSTART-1)));if(pre~/(^|[^[:alnum:]_])(err(or)?([[:space:]_]*(code|no))?|ret(urn)?([[:space:]_]*code)?|dev_?ret_?code|errno|fault|status|code)([[:space:]:=]+is)?[[:space:]:=]+$/){out=out substr(y,1,RSTART+RLENGTH-1)}else{out=out substr(y,1,RSTART-1) "000000"}y=substr(y,RSTART+RLENGTH)}x=out y}return x} function dom_ok(t,ph,pi,pg,pp,pr){return (ph==""||tb_host[t]==""||ph==tb_host[t])&&(pi==""||tb_inst[t]==""||pi==tb_inst[t])&&(pg==""||tb_grp[t]==""||pg==tb_grp[t])&&(pp==""||tb_pid[t]==""||pp==tb_pid[t])&&(pr==""||tb_rank[t]==""||pr==tb_rank[t])} function find_tb(fn,want_open,pr,pw,pp,ph,pi,pg, best,t,has_id,has_dom,id_match,dom_hit,fdom,cdom){best="";fdom="";has_id=(pr!=""||pw!=""||pp!="");has_dom=(ph!=""||pi!=""||pg!="");for(t=1;t<=tb_seq;t++){if(tb_fn[t]!=fn)continue;if(want_open){if(!tb_open[t])continue}else{if(tb_ch[t]=="")continue}if(!dom_ok(t,ph,pi,pg,pp,pr))continue;if(has_id){id_match=((pr!=""&&pr==tb_rank[t])||(pw!=""&&pw==tb_wid[t])||(pp!=""&&pp==tb_pid[t]));if(!id_match)continue}else if(has_dom){dom_hit=((ph!=""&&ph==tb_host[t])||(pi!=""&&pi==tb_inst[t])||(pg!=""&&pg==tb_grp[t]));if(!dom_hit)continue}cdom=tb_host[t] "|" tb_inst[t] "|" tb_grp[t] "|" tb_rank[t] "|" tb_wid[t] "|" tb_pid[t];if(fdom==""){fdom=cdom}else if(cdom!=fdom){return ""}if(!has_id&&!has_dom){if(want_open&&t!=last_tb[fn])continue;if(!want_open&&t!=last_ch[fn])continue}if(best==""||tb_ord[t]>tb_ord[best])best=t}return best} BEGIN { cfp="(out of memory|(^|[^[:alnum:]_])OOM([^[:alnum:]_]|$)|OutOfMemoryError|Failed to allocate memory|Failed to verify the cluster information|invalid device|(^|[^[:alnum:]_])([A-Za-z_][A-Za-z0-9_.]*\\\\.)?([A-Z][A-Za-z0-9_]*(Error|Exception|Fault|Interrupt|Exit)|BaseException|Exception|StopIteration|StopAsyncIteration|BaseExceptionGroup|ExceptionGroup):|EZ[0-9]{4}|EL[0-9]{4}|(^|[^[:alnum:]_.])(507015|507034|507035|507008|207003|107002|107030|16100[12]|561002)([^[:alnum:]_]|$)|(^|[^[:alnum:]_])(errno|err_?code|ret_?code|dev_?ret_?code|exit_?code|return_?code)[[:space:]]*[:=][[:space:]]*(-?[1-9][0-9]*|0x0*[1-9a-fA-F][0-9a-fA-F]*)([^[:alnum:]_]|$)|CheckSmmuFault|isSmmuFault([[:space:]]+is|[[:space:]]*[:=])[[:space:]]*[1-9]|retCode=0x0*[1-9a-fA-F]|EJ0001|Getting socket times out|\\\\[Wait\\\\]\\\\[LinkEstablish\\\\]|RaSocket[^;\\n]*(timed out|timeout|failed|FAIL|ERROR|refused|reset)|([Cc]onnection (refused|reset)|[Nn]o route to host|[Uu]nreachable)|((^|[^[:alnum:]_])([Ww]orker|[Pp]rocess|[Ee]ngine[[:space:]_]?[Cc]ore|[Bb]ootstrap|[Ii]nit(ialization)?)([^[:alnum:]_.]|$)[^;\\n]*(crashed|exited|died|killed|terminated|aborted|dead|failed|failure|denied|refused))|permission denied|no space left|cannot allocate|broken pipe|illegal instruction|bus error|uncorrectable|ecc error|double bit|hardware fault|[Ww]atchdog([[:space:]_-]+(has|is|was))?[[:space:]_-]*(timeout|timed[[:space:]]+out|expired|failed|failure|error|killed|triggered|reset|hang|blocked)|link down|segfault|segmentation fault|core dumped|SIGKILL|SIGSEGV|SIGABRT|SIGBUS|SIGILL)"; fp=cfp "|EI00(0[469]|14)" } { raw=$0; fn=""; gpref=""; c=raw; if (match(c, /^(\\.?\\/[^:]+|\\(standard input\\)):[0-9]+:/)) { gpref=substr(c,1,RLENGTH); fn=substr(c,1,index(c,":")-1); c=substr(c,RLENGTH+1) } else if (!(c ~ /^(\\[|\\(|[0-9]{4}-[0-9]{2}-[0-9]{2}[- T]|[0-9]{2}-[0-9]{2}[ T]|E[0-9]{4} |([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9])/) && match(c, /^[^:[:space:]]+:[0-9]+:/)) { gpref=substr(c,1,RLENGTH); fn=substr(c,1,index(c,":")-1); c=substr(c,RLENGTH+1) } if (c ~ /^[[:space:]]*$/) { for(t=1;t<=tb_seq;t++)if(tb_fn[t]==fn&&tb_open[t]){tb_open[t]=0;if(last_tb[fn]==t)last_tb[fn]=""} next } find_ts(c, tr); bk=tr["bk"]; bt=tr["bt"]; if (bk==1) { ay=substr(bt,1,4); amo=substr(bt,6,2); ady=substr(bt,9,2); ahms=substr(bt,12,8); atzp=""; if (match(bt,/([Zz]|[+-][0-9]{2}:?[0-9]{2})$/)) atzp=substr(bt,RSTART,RLENGTH); if (valid_md(ay+0,amo+0,ady+0)) { if (atzp!="") { au=to_utc(ay+0,amo+0,ady+0,ahms,atzp); ay=substr(au,1,4); amo=substr(au,6,2) } if (!min_yr || ay<min_yr) min_yr=ay; if (!max_yr || ay>max_yr) max_yr=ay; if (amo=="12") has_d_dec[ay]=1; if (amo=="01") has_d_jan[ay]=1 } } tb_id=get_tb_ids(c, tb_ids); cur_pid=tb_ids["pid"]; cur_host=tb_ids["host"]; cur_inst=tb_ids["inst"]; cur_grp=tb_ids["grp"]; cur_rank=tb_ids["rank"]; cur_wid=tb_ids["wid"]; cur_rstr=tb_ids["rstr"]; lk=find_tb(fn,1,cur_rank,cur_wid,cur_pid,cur_host,cur_inst,cur_grp); chk_awt=find_tb(fn,0,cur_rank,cur_wid,cur_pid,cur_host,cur_inst,cur_grp); c_np=c; while (sub(/^[[:space:]]*(\\[[^]]+\\]|Worker_[^:[:space:]]+|\\([^)]+\\)|(RUNTIME|HCCL|WorkHCCL|ASCENDCL|GE|DRV|AICPU|DEVDRV|TSD|APP|PROCMGR|TDT|SLOG)\\(([^()]|\\([^()]*\\))*\\)|[Rr]ank[[:space:]_:-]*[0-9]+|[Nn]ode[[:space:]_:-]*[0-9]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]:]+|(ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|DEBUG|EVENT)|[0-9]{4}-[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|E[0-9]{4} ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|[0-9]{2}-[0-9]{2}[- T]([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?|([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.,][0-9]+(\\.[0-9]+)?)?([Zz]|[+-][0-9]{2}:?[0-9]{2})?):?[[:space:]]?/, "", c_np)) {} has_pref=(c_np!=c); c_trim=c_np; sub(/^[[:space:]]+/,"",c_trim); sub(/[[:space:]]+$/,"",c_trim); is_term=(c_trim ~ /^([A-Za-z_][A-Za-z0-9_.]*\\.)?([A-Z][A-Za-z0-9_]*(Error|Exception|Fault|Interrupt|Exit)(:[[:space:]]*.*|[[:space:]]*$)|(BaseException|Exception|StopIteration|StopAsyncIteration|BaseExceptionGroup|ExceptionGroup)([[:space:]]*$|:[[:space:]]*.*)|(Error|Exception|Fault|Interrupt|Exit):)/); is_chain=(tolower(c_trim) ~ /^(during handling of the above exception(, another exception occurred)?|the above exception was the direct cause of the following exception|caused by):?[[:space:]]*$/); is_log_hdr=((bk==0 && !has_pref && c ~ /^[[:space:]]*(INFO|DEBUG|WARN|WARNING|ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/) || (has_pref && (c ~ /(^|[^[:alnum:]_])(INFO|DEBUG)([^[:alnum:]_]|$)/ || c_trim ~ /^(INFO|DEBUG|WARN|WARNING|ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/))); if (match(c, /(^|[^[:alnum:]_])Traceback \\(most recent call last\\):/)) { ttag=substr(c,1,RSTART-1); sub(/[[:space:]]+$/,"",ttag); if (chk_awt!="" && tb_ch[chk_awt]=="awaiting-traceback") { had_bk=(bk>0); had_rk=(cur_rank!=""); if (!had_bk && tb_bk[chk_awt]>0) { bk=tb_bk[chk_awt]; bt=tb_bt[chk_awt] } if (cur_host=="") cur_host=tb_host[chk_awt]; if (cur_inst=="") cur_inst=tb_inst[chk_awt]; if (cur_grp=="") cur_grp=tb_grp[chk_awt]; if (cur_pid=="") cur_pid=tb_pid[chk_awt]; if (!had_rk) { cur_rank=tb_rank[chk_awt]; cur_rstr=tb_rstr[chk_awt] } if (cur_wid=="") cur_wid=tb_wid[chk_awt]; if (tb_id=="") { if (ttag=="") { ttag=tb_tag[chk_awt] } else { pre_ch=tb_tag[chk_awt]; sub(/[[:space:]]*(ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|DEBUG|EVENT):?[[:space:]]*$/,"",pre_ch); if (pre_ch==""&&!had_bk&&bt!="") pre_ch=bt; if (pre_ch!="") ttag=pre_ch " " ttag } } else { pfx_c=""; if (!had_bk&&bt!=""&&index(ttag,bt)==0) pfx_c=bt; if (!had_rk&&cur_rstr!="") pfx_c=(pfx_c!=""?pfx_c " " cur_rstr:cur_rstr); if (pfx_c!="") ttag=(ttag!=""?pfx_c " " ttag:pfx_c) } tb_ch[chk_awt]=""; if (last_ch[fn]==chk_awt) last_ch[fn]="" } else if (chk_awt!="") { tb_ch[chk_awt]=""; if (last_ch[fn]==chk_awt) last_ch[fn]="" } k0=++tb_seq; tb_fn[k0]=fn; tb_open[k0]=1; tb_ord[k0]=++ord_clk; tb_bk[k0]=bk; tb_bt[k0]=bt; tb_tag[k0]=ttag; tb_pid[k0]=cur_pid; tb_host[k0]=cur_host; tb_inst[k0]=cur_inst; tb_grp[k0]=cur_grp; tb_rank[k0]=cur_rank; tb_wid[k0]=cur_wid; tb_rstr[k0]=cur_rstr; tb_ch[k0]=""; last_tb[fn]=k0; next } if (is_chain) { if (lk!="") { tb_open[lk]=0; if (last_tb[fn]==lk) last_tb[fn]="" } if (chk_awt!="" && (tb_ch[chk_awt]=="awaiting-marker" || tb_ch[chk_awt]=="awaiting-traceback")) { tb_ch[chk_awt]="awaiting-traceback"; tb_ord[chk_awt]=++ord_clk; last_ch[fn]=chk_awt } next } if (c ~ /(^|[^[:alnum:]_])File ".*", line [0-9]+/) { if (lk!="") { tb_ord[lk]=++ord_clk; last_tb[fn]=lk } next } c_code=c_trim; gsub(/\\((pid|tid|uid|gid|rank)[[:space:]]*[:=][[:space:]]*[0-9]+\\)/,"",c_code); gsub(/^[[:space:]]+|[[:space:]]+$/,"",c_code); is_code_pref=(!has_pref || (c_code ~ /^[A-Za-z_][A-Za-z0-9_]*$/ || c_code ~ /^((raise|assert|if|elif|for|while|with|return|await|yield|import|from|del|global|nonlocal)([^[:alnum:]_]|$)|(else|try|finally|pass|break|continue):?[[:space:]]*$|[~^[:space:]]*[~^]+[~^[:space:]]*$)/ || c_code ~ /[]~[(=:+*\\/<>{}@,"\\047^]/ || c_code ~ /(\\.[A-Za-z_0-9]|\\.\\.\\.)/)); is_ind=(!is_log_hdr && !is_chain && !(has_pref && is_term) && is_code_pref && (c ~ /^[[:space:]]{4,}/ || c ~ /(\\]|\\]:|\\))[[:space:]]{4,}/ || (bk==0 && c_np ~ /^[[:space:]]{3,}/))); if (is_ind && (lk!="" || c_np ~ /^[[:space:]]*(raise |assert |if |elif |else:|for |while |return |[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[^=])/)) { if (lk!="") { tb_ord[lk]=++ord_clk; last_tb[fn]=lk } next } row_disp=raw; if (!is_ind && lk!="" && is_term) { pfx_add=""; if (bk==0) { bk=tb_bk[lk]; bt=tb_bt[lk]; if (bt!="") pfx_add=bt } if (tb_id!="") { if (cur_rank=="" && tb_rstr[lk]!="") pfx_add=(pfx_add!="" ? pfx_add " " tb_rstr[lk] : tb_rstr[lk]); if (pfx_add!="") { c=pfx_add " " c; row_disp=gpref c } } else if (tb_tag[lk]!="") { if (c!=c_trim && !(tb_tag[lk] ~ /(ERROR|CRITICAL|FATAL):?[[:space:]]*$/)) { c=tb_tag[lk] " " c } else { c=tb_tag[lk] " " c_trim } row_disp=gpref c } tb_open[lk]=0; if (last_tb[fn]==lk) last_tb[fn]=""; tb_ch[lk]="awaiting-marker"; tb_bk[lk]=bk; tb_bt[lk]=bt; tb_ord[lk]=++ord_clk; last_ch[fn]=lk; } else if (!is_ind) { if (lk!="") { tb_open[lk]=0; if (last_tb[fn]==lk) last_tb[fn]="" } if (chk_awt!="") { tb_ch[chk_awt]=""; if (last_ch[fn]==chk_awt) last_ch[fn]="" } } ci=c; if (!(ci ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/)) { gsub(/(([Pp]arent|[Cc]hild|[Ss]ub)?[[:space:]]*([Ww]orker|[Pp]rocess|[Ee]ngine[[:space:]_]?[Cc]ore|[Bb]ootstrap|[Ii]nit(ialization)?))([[:space:]]+([Ww]orker|[Pp]rocess|id=[0-9]+|#[0-9]+|[0-9]+|\\([^)]*pid=[^)]*\\)|\\[[^]]*\\])){0,3}[[:space:]]+exited[[:space:]]+(normally|cleanly|with[[:space:]]+(exit[[:space:]]*)?(code|status)[[:space:]]*[:=]?[[:space:]]*0([^0-9]|$))/, " ", ci); gsub(/(^|[^[:alnum:]_])(no|not|without|0|zero)[[:space:]]+([A-Za-z0-9_]+[[:space:]]+)?([Ww]orker|[Pp]rocess|[Ee]ngine[[:space:]_]?[Cc]ore|[Bb]ootstrap|[Ii]nit(ialization)?)s?[[:space:]]+(crashed|exited|died|killed|terminated|aborted|dead|failed|failure|denied|refused)([^[:alnum:]_]|$)/, " ", ci); gsub(/([Ww]atchdog([[:space:]_-]+(started|initialized|enabled|configured))?([[:space:]_-]+with)?[[:space:]_-]+([Cc]onfigured[[:space:]]+)?|[Cc]onfigured[[:space:]]+)[Tt]imeout[[:space:]]*([:=]|set([[:space:]]+to)?|of|is|configured([[:space:]]+to)?)[[:space:]]*[0-9]+[A-Za-z]*/, " ", ci); gsub(/[Ww]atchdog[[:space:]]+(started|initialized|enabled|disabled|configured|ready|alive)([^[:alnum:]_]|$)/, " ", ci); gsub(/CheckSmmuFault[^.,;\\n]*isSmmuFault([[:space:]]+is|[[:space:]]*[:=])[[:space:]]*0([^0-9]|$)[[:space:].,;]*/, "", ci) } cn=clean_meta(ci); if (is_ind && !(cn ~ fp || c ~ /([A-Za-z_][A-Za-z0-9_.]*\\.)?([A-Z][A-Za-z0-9_]*)?(Error|Exception|Fault)[:(]/)) next; has_cas=(ci ~ /(EI0002|HCCL_E_WAIT_TIMEOUT|The wait execution of the Notify register times out\\.?|Notify (register )?wait( execute| execution)? timeout|[Ww]atchdog caught (the )?(HCCL )?collective([[:space:]]+(operation|communication))?[[:space:]]+timeout)/); s=ci; gsub(/([Ww]atchdog caught (the )?(HCCL )?collective([[:space:]]+(operation|communication))?[[:space:]]+timeout([[:space:]]+group[[:space:]_:-]*[A-Za-z0-9_.-]+)?[[:space:]:,;.-]*|((HCCL|RUNTIME|ASCENDCL)[[:space:]:,;-]+)?(The wait execution of the Notify register times out\\.?|Notify (register )?wait( execute| execution)? timeout|HCCL_E_WAIT_TIMEOUT|EI0002)[[:space:].,!-]*)([[:space:]]*[,:;]?[[:space:]]*([Ww]atchdog caught (the )?(HCCL )?collective([[:space:]]+(operation|communication))?[[:space:]]+timeout[[:space:]:,;.-]*|((HCCL|RUNTIME|ASCENDCL)[[:space:]:,;-]+)?(The wait execution of the Notify register times out\\.?|Notify (register )?wait( execute| execution)? timeout|HCCL_E_WAIT_TIMEOUT|EI0002|[Ww]ait(ing)? for rank [0-9]+|((in|during|on|of|at|for|when|while)[[:space:]]+(((the|a|an)[[:space:]]+)?(HCCL|collective)[[:space:]]+)?([Aa]ll[Rr]educe|[Aa]ll[Gg]ather|[Rr]educe[Ss]catter|[Aa]ll[Tt]o[Aa]ll|[Bb]roadcast|[Rr]educe|[Ss]catter|[Gg]ather|[Ss]end|[Rr]ecv|op(eration)?s?|comm(unication)?s?|[Cc]ollective([[:space:]]+(op(eration)?|comm(unication)?))?)([[:space:]]+group[[:space:]_:-]*[A-Za-z0-9_.-]+)?[[:space:].,!-]*))))*/, "", s); sc=s; gsub(/\\[([Ff][Uu][Nn][Cc]|[Ff][Ii][Ll][Ee]|[Ll][Ii][Nn][Ee]|[Pp][Ii][Dd]|[Tt][Ii][Dd]|[Tt][Hh][Rr][Ee][Aa][Dd]|[Mm][Oo][Dd][Uu][Ll][Ee]|[Dd][Ee][Vv]([Ii][Cc][Ee])?_?[Ii][Dd]|[Rr][Aa][Nn][Kk]|[Nn][Oo][Dd][Ee]|[Hh][Oo][Ss][Tt]):[^]]*\\]/, " ", sc); gsub(/(\\[|\\()Worker_[^)\\]]*(\\]|\\))/, " ", sc); gsub(/(\\[|\\()[A-Za-z0-9_]*EngineCore[^)\\]]*(\\]|\\))/, " ", sc); gsub(/(\\[|\\()APIServer[^)\\]]*(\\]|\\))/, " ", sc); gsub(/\\[([Nn]ode|[Hh]ost|[Rr]ank)[[:space:]_:-]*[^]]*\\]/, " ", sc); gsub(/\\([Rr]ank[[:space:]_:=]*[0-9]+\\)/, " ", sc); gsub(/\\[[A-Za-z0-9_.\\/-]+\\.(py|cc|cpp|h|hpp):[0-9]+\\]/, " ", sc); gsub(/[A-Za-z0-9_.\\/-]+\\.(py|cc|cpp|h|hpp):[0-9]+/, " ", sc); gsub(/(RUNTIME|HCCL|ASCENDCL|GE|DRV|AICPU|DEVDRV|TSD|APP|PROCMGR|TDT|SLOG)\\([0-9]+,[^)]*\\)/, " ", sc); wtmp=""; wr=sc; while(match(wr,/WorkHCCL\\(([^()]|\\([^()]*\\))*\\)/)){wseg=substr(wr,RSTART,RLENGTH);wchk=wseg;gsub(/(^|[,[:space:]\\(])(SeqNum|seq_?num|OpType|AlgType|Count|DataType|ReduceOp|Root|Tag|Group|Comm|Stream|Plane|Rank|LocalRank|DataSize)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9_.-]+/,"",wchk);gsub(/(^|[,[:space:]\\(])(Timeout|timeout|notifyWaitTime|retryHoldTime|retryIntervalTime|linkTimeOut)([[:space:]]*\\([^)]*\\))?[[:space:]]*[:=][[:space:]]*[0-9]+([A-Za-z_]*|[[:space:]]*(ms|us|s|sec))?/,"",wchk);wkeep=(wchk ~ fp || tolower(wchk) ~ /(^|[^[:alnum:]_])(err(or)?|errno|ret_?code|fault|fail(ed|ure)?|invalid|refus(ed)?|reset|denied|out[[:space:]]+of[[:space:]]+memory|oom|timeout|timed[[:space:]]+out|unreachable|mismatch|broken|abort|killed|crash)([^[:alnum:]_]|$)/);wtmp=wtmp substr(wr,1,RSTART-1) (wkeep?wseg:" ");wr=substr(wr,RSTART+RLENGTH)} sc=wtmp wr; gsub(/([A-Za-z_][A-Za-z0-9_.]*\\.)?([A-Za-z_][A-Za-z0-9_]*)?(Error|Exception|Fault):[[:space:]]*([.,;:!\\-]*[[:space:]]*($|;))/, ";", sc); sn=clean_meta(sc); rem=sn; gsub(/[A-Za-z_][A-Za-z0-9_]*=[^[:space:];)]+/, " ", rem); gsub(/ /, "  ", rem); gsub(/(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL|INFO|WARN|WARNING|EVENT|[Rr]ank[[:space:]_:-]*[0-9]+|[Nn]ode[[:space:]_:-]*[0-9]+|[Hh]ost[[:space:]_:-]*[A-Za-z0-9_.-]+|group[[:space:]_:-]+(tp|dp|pp|ep|cp|sp|hccl|world|comm|[0-9]+)[A-Za-z0-9_.-]*|(dp|tp|pp|ep|cp|sp|dcp|pcp)[[:space:]_:-]*[0-9]+|HCCL|RUNTIME|ASCENDCL|GE|DRV|AICPU|pid|tid|dp|tp|pp|ep)([^[:alnum:]_]|$)/, " ", rem); gsub(/[^[:alpha:]]+/, "", rem); term_tok=c_trim; sub(/[:[:space:]].*$/,"",term_tok); term_ok=(is_term && !is_log_hdr && term_tok!="" && index(ci,term_tok)>0); has_err=(ci ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL|WARN|WARNING)([^[:alnum:]_]|$)/ || ci ~ /(^|[^[:alnum:]_])([A-Za-z_][A-Za-z0-9_.]*\\.)?([A-Z][A-Za-z0-9_]*)?(Error|Exception|Fault|Interrupt|Exit):/ || term_ok); z_ei=((ci ~ /((EI000[2469]|EJ0001)(([^0-9a-zA-Z]|_)*(count|cnt|total|num|hits|errors?))?[[:space:]]*[:=][[:space:]]*0([^0-9]|$)|(EI000[2469]|EJ0001)[^\\r\\n]{0,40}(^|[^[:alnum:]_])(count|cnt|total|num|hits|errors?)[[:space:]]*[:=][[:space:]]*0([^0-9]|$))/) && !(ci ~ /((EI000[2469]|EJ0001)(([^0-9a-zA-Z]|_)*(count|cnt|total|num|hits|errors?))?[[:space:]]*[:=][[:space:]]*[1-9]|(EI000[2469]|EJ0001)[^\\r\\n]{0,40}(^|[^[:alnum:]_])(count|cnt|total|num|hits|errors?)[[:space:]]*[:=][[:space:]]*[1-9]|(ret|ret_?code|err_?code|dev_?ret_?code|status|errno)[[:space:]]*[:=][[:space:]]*(-?[1-9][0-9]*|0x0*[1-9a-fA-F]))/) && !(ci ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/) && !(ci ~ cfp) && !(ci ~ /(timed[[:space:]]+out|times[[:space:]]+out|TimeoutError|Getting socket times out|\\[Wait\\]\\[LinkEstablish\\]|Notify wait|The wait execution|ranktable|transport init|HCCP init|failed|FAIL|refused|reset|lost|unreachable|mismatch|abort|broken|hang|blocked)/) && !term_ok); if (z_ei) next; if ((s ~ /(^|[^[:alnum:]_])(count|errors?)[[:space:]]*[:=][[:space:]]*0([^0-9]|$)/ && s ~ /(^|[^[:alnum:]_])(INFO|health|success)([^[:alnum:]_]|$)/) && !(sn ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/ || sn ~ cfp || s ~ /(timed[[:space:]]+out|times[[:space:]]+out|timeout|failed|FAIL|refused|reset|lost|unreachable|mismatch|abort|broken|hang|blocked)/)) next; if (has_cas && !(sn ~ fp || (has_err && rem ~ /[[:alpha:]]/))) next; if (c ~ /(^|[^[:alnum:]_])INFO([^[:alnum:]_]|$)/ && !(sn ~ fp || sn ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/)) next; if (c ~ /RaSocket/ && c ~ /(^|[^[:alnum:]_])success([^[:alnum:]_]|$)/ && !(sn ~ fp)) next; if (!(cn ~ fp || term_ok || has_cas || cn ~ /(^|[^[:alnum:]_])(ERROR|CRITICAL|FATAL)([^[:alnum:]_]|$)/)) next; yr=""; md="99-99"; hms="99:99:99"; frac="000000000"; tzp=""; sh=0; inv_dt=0; if (match(bt, /([Zz]|[+-][0-9]{2}:?[0-9]{2})$/)) { tzp=substr(bt,RSTART,RLENGTH); bt=substr(bt,1,RSTART-1) } if (tzp!="") has_tzaware=1; else if (bk>=1 && bk<=4) has_tzless_ts=1; if (bk==1) { yr=substr(bt,1,4); mo=substr(bt,6,2); dy=substr(bt,9,2); hms=substr(bt,12,8); if (length(bt)>19) { frac=substr(bt,21); gsub(/[^0-9]/,"",frac); frac=substr(frac "000000000",1,9) } if (!valid_md(yr+0,mo+0,dy+0)) { inv_dt=1; has_inv_dt=1; md=mo "-" dy } else { has_dated=1; if (tzp!="") { u=to_utc(yr+0,mo+0,dy+0,hms,tzp); yr=substr(u,1,4); mo=substr(u,6,2); md=substr(u,6,5); hms=substr(u,12,8) } else { md=substr(bt,6,5) } } } else if (bk==2) { mo=substr(bt,2,2); dy=substr(bt,4,2); md=mo "-" dy; hms=substr(bt,7,8); if (length(bt)>14) { frac=substr(bt,16); gsub(/[^0-9]/,"",frac); frac=substr(frac "000000000",1,9) } if (!valid_md(0,mo+0,dy+0)) { inv_dt=1; has_inv_dt=1 } else { has_dated=1; has_short=1; if (mo=="12") has_yl_dec=1; if (mo=="01") has_yl_jan=1 } } else if (bk==3) { mo=substr(bt,1,2); dy=substr(bt,4,2); md=substr(bt,1,5); hms=substr(bt,7,8); if (length(bt)>14) { frac=substr(bt,16); gsub(/[^0-9]/,"",frac); frac=substr(frac "000000000",1,9) } if (!valid_md(0,mo+0,dy+0)) { inv_dt=1; has_inv_dt=1 } else { has_dated=1; has_short=1; if (mo=="12") has_yl_dec=1; if (mo=="01") has_yl_jan=1 } } else if (bk==4) { has_timeonly=1; hms=substr(bt,1,8); if (length(bt)>8) { frac=substr(bt,10); gsub(/[^0-9]/,"",frac); frac=substr(frac "000000000",1,9) } sec=int(substr(hms,1,2))*3600+int(substr(hms,4,2))*60+int(substr(hms,7,2)); if (tzp!="") { off=tz(tzp); sec-=off; sh=int(sec/86400); if (sec<0 && sec%86400!=0) sh--; sec-=sh*86400; hms=sprintf("%02d:%02d:%02d",int(sec/3600),int((sec%3600)/60),sec%60) } to_s=sh*86400+sec; to_ms=int((frac+0)/1000000); if (!has_to_span) { has_to_span=1; min_to_s=to_s; min_to_ms=to_ms; max_to_s=to_s; max_to_ms=to_ms } else { if (to_s<min_to_s||(to_s==min_to_s&&to_ms<min_to_ms)){min_to_s=to_s;min_to_ms=to_ms} if (to_s>max_to_s||(to_s==max_to_s&&to_ms>max_to_ms)){max_to_s=to_s;max_to_ms=to_ms} } yr=sprintf("%04d", 9998+sh) } else { yr="9999"; frac="999999999" } bks[++n]=bk; invs[n]=inv_dt; shs[n]=sh; yrs[n]=yr; rest[n]=md "-" hms "." frac; tzs[n]=(bk==2||bk==3)?tzp:""; has_tz[n]=(tzp!=""); rows[n]=row_disp } END { to_wrap=(has_to_span && (max_to_s-min_to_s>43200 || (max_to_s-min_to_s==43200 && max_to_ms>min_to_ms))); amb_short=(has_short && min_yr!="" && max_yr!="" && min_yr!=max_yr); if (has_dated && has_timeonly) printf "0000-00-00-WARN_MIXED_DATE_SCOPE\\t[WARN] mixed dated and time-only logs: time-only records cannot be ordered against dated logs (see ~UNORDERED_TIME_ONLY rows)\\n"; if (!has_dated && to_wrap) printf "0000-00-00-WARN_MIXED_TIMEONLY_SPAN\\t[WARN] time-only logs span >12h without dates: possible midnight rollover makes order ambiguous (see ~UNORDERED_TIME_ONLY rows)\\n"; if (has_tzaware && has_tzless_ts) printf "0000-00-00-WARN_MIXED_TZ_SCOPE\\t[WARN] mixed tz-aware and naive logs: timezone-less rows cannot be normalized to UTC alongside Z/offset logs (see ~UNORDERED_NAIVE_TZ rows)\\n"; if (amb_short) printf "0000-00-00-WARN_MIXED_SHORTDATE_YEAR\\t[WARN] short-date logs mixed with multi-year dated logs: year cannot be inferred uniquely (see ~UNORDERED_SHORT_DATE rows)\\n"; printed_inv=has_inv_dt; if (has_inv_dt) printf "0000-00-00-WARN_MIXED_INVALID_DATE\\t[WARN] invalid calendar date cannot be ordered chronologically (see ~UNORDERED_INVALID_DATE rows)\\n"; for(i=1;i<=n;i++){ if (invs[i]) { k=sprintf("~UNORDERED_INVALID_DATE(%s-%s)", (yrs[i]!=""?yrs[i]:"XXXX"), rest[i]); printf "%s\\t%s\\n", k, rows[i]; continue } if (yrs[i]!="") { y=yrs[i] } else { mo=substr(rest[i],1,2); if (min_yr!="") { if (amb_short) y="0000"; else if (has_d_dec[max_yr] && !has_d_jan[max_yr] && mo+0<=6) y=sprintf("%04d", max_yr+1); else if (has_d_jan[min_yr] && !has_d_dec[min_yr] && mo+0>=7) y=sprintf("%04d", min_yr-1); else y=min_yr } else { y=(has_yl_dec && has_yl_jan && mo+0<=6) ? "0005" : "0004" } } if (amb_short && (bks[i]==2 || bks[i]==3)) { k=sprintf("~UNORDERED_SHORT_DATE(%s)", rest[i]) } else if ((bks[i]==2 || bks[i]==3) && min_yr!="" && !valid_md(y+0,substr(rest[i],1,2)+0,substr(rest[i],4,2)+0)) { if (!printed_inv) { printed_inv=1; printf "0000-00-00-WARN_MIXED_INVALID_DATE\\t[WARN] invalid calendar date cannot be ordered chronologically (see ~UNORDERED_INVALID_DATE rows)\\n" } k=sprintf("~UNORDERED_INVALID_DATE(%s-%s)", y, rest[i]) } else if (tzs[i]!="") { k=to_utc(y+0,substr(rest[i],1,2)+0,substr(rest[i],4,2)+0,substr(rest[i],7,8),tzs[i]) "." substr(rest[i],16) } else if ((has_dated || to_wrap) && bks[i]==4) { k=sprintf("~UNORDERED_TIME_ONLY(d%d-%s.%s)", 1+shs[i], substr(rest[i],7,8), substr(rest[i],16)) } else if (has_tzaware && bks[i]>=1 && bks[i]<=4 && !has_tz[i]) { k=sprintf("~UNORDERED_NAIVE_TZ(%s-%s)", y, rest[i]) } else { k=y "-" rest[i] } printf "%s\\t%s\\n", k, rows[i] } }\' | LC_ALL=C sort -s -t $\'\\t\' -k1,1 | awk \'{ if ($0 ~ /^0000-00-00-WARN_MIXED_/) { w[++wc]=$0; next } if ($0 ~ /^~UNORDERED_/) { u[++uc]=$0; next } d[++dc]=$0 } END { max_r=40; p=0; for(i=1;i<=wc && p<max_r;i++){ print w[i]; p++ } avail=max_r-p; u_res=(uc<5?uc:5); dlim=(uc>0 && dc+uc>avail)?(avail-u_res):avail; if (dlim<0) dlim=0; for(i=1;i<=dc && i<=dlim && p<max_r;i++){ print d[i]; p++ } for(i=1;i<=uc && p<max_r;i++){ print u[i]; p++ } }\'',
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
      "核对实际生效的 max_num_batched_tokens、enable_chunked_prefill 与 long_prefill_token_threshold：调度器先按 long_prefill_token_threshold（> 0 时截断单请求上限）收敛单步新增数，再核对本步剩余预算 request_token_budget；若关闭分块且剩余预算不足，调度器会先 break 等待而不整段塞入——只有当单请求阈值未触发截断且本步剩余预算足够容纳长 prompt 时（无论是关分块还是把预算调得足够大），长请求才会整段并入单步执行（注意力配对呈 O(T²) 二次方、投影与 FFN 呈线性项）。",
      "将 max_num_batched_tokens 下调后复测混合负载，短请求 P99 ITL 明显回落（以超长请求 TTFT 略微增加为代价）。",
    ],
    nextStepCmd:
      "grep -nE 'max_num_batched_tokens|enable_chunked_prefill|long_prefill_token_threshold' vllm_serve.log",
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
