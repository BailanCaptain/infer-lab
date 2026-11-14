import {
  computePhase,
  MATMUL_INPUT,
  MATMUL_OUTPUT,
  MATMUL_WEIGHT,
  SWIGLU_EXAMPLE,
} from "./scene-compute-data";
import { DP_DETAILS, DP_TITLES, dpDeployment, dpRequestFrame, epIntroduction } from "./scene-hardware-story";
import { expertAssignments, parallelPhase, parallelTransfer, SCENE_BEATS } from "./scene-playback";
import { residualFrame } from "./scene-residual-data";

export { MATMUL_INPUT, MATMUL_OUTPUT, MATMUL_WEIGHT, SWIGLU_EXAMPLE } from "./scene-compute-data";
export type TeachingTensor = { name: string; rows: string[][]; active?: number[] | undefined };
export type TeachingFrame = {
  title: string;
  equation: string;
  detail: string;
  tensors: TeachingTensor[];
  operators?: string[];
};

export function parallelTeaching(step: number, rank: number, progress: number): TeachingFrame {
  if (step === 1) {
    const frame = dpRequestFrame(progress);
    if (frame.stage === 0) {
      const deployment = dpDeployment(frame.local);
      return {
        title: [
          "先看完整模型：不同权重有不同放法",
          "先分到两台机器：哪些重复，哪些共同持有",
          "再落到每张卡：TP 分片、完整专家和复制参数",
        ][deployment.stage]!,
        detail: [
          "同一个模型的权重分三类：大投影等权重由机内8卡分担；路由专家跨两机分放；归一化、router等小参数每卡保留一份。下方是这三类权重的逻辑总览，蓝格表示参数结构，不是请求。",
          "可做TP的大矩阵，两台机器各有一份；本层288位路由专家只有一套，服务器0持有E0–E143，服务器1持有E144–E287。每张卡还复制一份小参数。因此每台机器是DP执行组，两台合起来才拥有全部专家。",
          "以一张down权重为例：沿输入通道切成8行片，W0–W7分别落到机内8卡，两机对应卡的片相同；路由专家整位落卡，每卡18位。分配完成后权重常驻，接下来再让两位用户发请求。",
        ][deployment.stage]!,
        equation: "大矩阵：两机各一份 → 每机TP8\n路由专家：288位 → 16卡各18位\n小参数：每卡完整复制",
        tensors: [],
      };
    }
    return {
      title: DP_TITLES[frame.stage]!,
      detail: DP_DETAILS[frame.stage]!,
      equation:
        frame.stage < 5
          ? `前端本地负载：DP0 ${frame.scores[0]} 分 · DP1 ${frame.scores[1]} 分\n选组分数 = 等待请求数 × 4 + 运行请求数`
          : "甲的 A → DP0 → 回复 a → 甲\n乙的 B → DP1 → 回复 b → 乙",
      tensors: [],
    };
  }
  const { phase, local } = parallelPhase(progress, step === 2);
  if (step === 2 && phase === 0) {
    const intro = epIntroduction(local).stage;
    return {
      title: [
        "先接上整条请求：现在轮到本层 MoE",
        "先认清专家：不同的前馈网络，已经分放在各卡",
        "router 读取这一行，打分并选出 8 位专家",
      ][intro]!,
      detail: [
        `请求经过本层注意力后，形成左下4个token×6个示意通道的矩阵。现在从中抽出“一封”所在的第3行，落在源卡${rank}，准备做本层前馈；其他行保留原位作为上下文，各自会有自己的路由。EP不重新给用户请求选DP组。`,
        "MoE 把一层前馈做成许多套不同参数的小网络，每套叫一位专家。蓝色的一组三层权重是一位专家；本层共288位，提前分在16张卡上，每卡18位。整个专家留在所属卡，输入需要去找它。",
        `源卡${rank}上的 router 是学习出来的打分器：同一输入给288位专家打分，本次只选8位，并保留各自的合并权重。专家编号决定去哪里找它；不是每个用户固定对应某位专家。接下来只追踪这一行，其他行各自选。`,
      ][intro]!,
      equation: [
        "请求 → 本层注意力 → 当前 token 的 MoE 输入",
        "一位专家 = 一套前馈网络\n16 张卡 × 每卡18位 = 288位",
        "同一行输入 → 打分 → 选8位 → 查所在卡",
      ][intro]!,
      tensors: [],
    };
  }
  const arrived = parallelTransfer(local).count;
  const expert = expertAssignments(rank)[Math.min(7, Math.floor(local * 8))]!;
  const details = [
    [
      "DP已决定请求所属组。前景展开所选卡所在组的计算：每行对应一个token，输入来自本层前馈前半段；真实宽度12288，示意缩成4行×8列。蓝色是这一层完整的down权重，下一步沿输入维分给本组8卡。",
      "只沿输入通道切列，不切token行。示意8列分别对应卡0…7，每张卡的输入片仍有4行；真实每片是N行×1536通道。权重按同一输入维分片，始终归属于对应卡。",
      "各卡用自己的输入列和权重行，生成4行×4列部分和；前景从所选卡展开输入与权重，逐格填入结果。浅色空格等待计算，当前格抬起后写入数值；上方各卡同步留下自己的部分和。结果收回本卡后再参加组内归约。",
      `八份4×4部分和按同一行、同一列相加。已收到${arrived}/8份；左上格为${(arrived * (arrived + 1)) / 2}，完整矩阵中的其他格也同步累加，不混合不同token。两组独立归约。`,
      "绿色4×4矩阵沿路径回到本组8张卡，前景保留逐格合齐的结果：左上36、右下576。每张卡收到全部4个token行与全部示意输出通道。",
      "本组各卡都有完整输出矩阵，继续残差与后续层；常驻权重不搬动。这里将All-Reduce的语义展开成汇合与返回两段，不代表实际通信拓扑或包顺序。",
    ],
    [], // DP uses its request-level timeline above.
    [
      `源卡${rank}保存当前 token 的输入；router 为它打分，选出8位专家。E是专家编号，卡号是存放位置。每位专家有 gate（门控）、up（展开）、down（收回）三套权重。`,
      `现在跟踪源卡${rank} → 卡${expert.rank}的专家E${expert.expert}。dispatch把同一输入发给选中专家，权重不搬动。为看清路径逐条演示；实际通信可并行。共2份本卡、6份跨卡。`,
      "8 位专家在各自卡上同时计算。前景固定放大其中一位：橙色输入经过 gate、up 和 down，绿色输出回到本卡；上方其他选中专家也留下各自的结果。未选中的专家不参与这条输入的计算。",
      `现在跟踪专家E${expert.expert} → 源卡${rank}的收集槽。combine把8份结果送回输入所在卡，按专家编号分别保留，下一步再按路由权重相加。`,
      "源卡按路由权重逐位置相加，把 8 份贡献合成一份输出。图中的向量在源卡汇合。",
      "合成后的向量交给后续计算，288 位路由专家的权重仍常驻原卡，等待下一次路由。",
    ],
  ];
  const equations = [
    [
      "N×12288 → 8份 N×1536；示意 4×8 → 8份4×1",
      "每组 8 张卡各持 W0 … W7",
      "每卡4×4部分和；左上格贡献依次1, 2, …, 8",
      `${arrived}/8 份 → Σ = ${(arrived * (arrived + 1)) / 2}`,
      "完整4×4矩阵 → 组内8张卡",
      "每卡得到完整4×4输出 · 左上36、右下576 · 权重不搬动",
    ],
    [],
    [
      "288 位专家 → 本次选中 8 位",
      "dispatch：2 份本卡 + 6 份跨卡",
      "每位专家：(gate ∥ up) → 门控 → down",
      "8 份专家输出 → 源卡",
      "输出 = Σ 路由权重 × 专家输出",
      "1 份合成向量 → 后续计算",
    ],
  ];
  return {
    title: SCENE_BEATS["parallel-strategy"][step]![phase]!,
    detail: details[step]![phase]!,
    equation: equations[step]![phase]!,
    tensors:
      step === 2 ? [{ name: "本次选中", rows: [expertAssignments(rank).map((e) => `E${e.expert}`)] }] : [],
  };
}
/** The geometric explanation and playback share one set of phase boundaries. */
export function spatialTeaching(step: number, progress: number): TeachingFrame {
  const phase = computePhase(step, progress);
  return step === 1
    ? {
        title: [
          "同一行输入，读取当前列权重",
          "沿深度，逐项相乘",
          "把三项贡献收进一格",
          "只写入这一格，保留已算结果",
        ][phase]!,
        equation: "Y[i,j] = Σₖ X[i,k] × W[k,j]　·　[3,3] × [3,4] → [3,4]",
        detail:
          "横向是输出通道，竖向是 token，深度是参与求和的输入维。每条深度线只生成一个输出；不同 token 不在这里混合。Q、K、V 和前馈投影都使用这种乘加结构，只是权重与尺寸不同。",
        tensors: [],
      }
    : {
        title: [
          "同一份输入，算出 gate 和 up 两路",
          "gate 变成每个通道的乘数",
          "同通道配对：门控乘数 × 内容",
          "六个通道按权重相加，得到四个输出",
        ][phase]!,
        equation: "g = nW_gate；u = nW_up；h = SiLU(g) ⊙ u；Δ = hW_down",
        detail:
          "完整前馈结构始终保留。输入行与完整权重矩阵展开到旁边，当前权重列突出；同亮的输入项与权重相乘，乘积按顺序排成一行，相加后收回对应输出格。门控按同一通道配对，保留原值轮廓对照改变后的乘积。GLM 的限幅发生在 SiLU 之前，本组示意数未触发限幅。",
        tensors: [],
      };
}
const tensor = (name: string, rows: (string | number)[][], active?: number[]): TeachingTensor => ({
  name,
  rows: rows.map((row) => row.map(String)),
  active,
});

export function modelTeaching(step: number, progress: number): TeachingFrame {
  const phase = Math.min(3, Math.floor(progress * 4));
  if (step === 1) {
    const col = phase;
    const terms = MATMUL_INPUT.map((x, row) => `${x} × ${MATMUL_WEIGHT[row]![col]}`);
    const term = Math.min(3, Math.floor((progress * 4 - col) * 4));
    const complete = term >= 3;
    const used = complete ? terms : terms.slice(0, term + 1);
    const partial = MATMUL_INPUT.slice(0, term + 1).reduce(
      (sum, x, row) => sum + x * MATMUL_WEIGHT[row]![col]!,
      0,
    );
    return {
      title: `求输出第 ${col + 1} 格：同一行 × 第 ${col + 1} 列`,
      equation: `${used.join(" + ")} = ${complete ? MATMUL_OUTPUT[col] : partial}${complete ? " · 写入输出" : " · 继续累加"}`,
      operators: ["×", "="],
      detail:
        "输入一行不变。权重每换一列，就得到一个新输出数。数字复用正文的示意例子；Q、K、V 用三套不同权重，分别重复这种计算。",
      tensors: [
        tensor("输入 x · 1 × 3", [MATMUL_INPUT], complete ? [0, 1, 2] : [term]),
        tensor("权重 W · 3 × 4", MATMUL_WEIGHT, complete ? [col, col + 4, col + 8] : [col + term * 4]),
        tensor(
          "输出 y · 1 × 4",
          [MATMUL_OUTPUT.map((n, i) => (i < col || (i === col && complete) ? n : "?"))],
          [col],
        ),
      ],
    };
  }
  if (step === 0) return residualFrame(step, progress);
  if (step === 2)
    return {
      operators: phase === 0 ? [] : phase === 3 ? ["×", "="] : ["⊙", "="],
      title: [
        "两套投影：同一输入，得到 g 和 u",
        "SiLU：把 g 变成连续的门",
        "逐元素乘：每一维自己控制放行量",
        "down 投影：从 4 维回到 2 维",
      ][phase]!,
      equation: [
        "n = [0.85, 1.13] → g₀ = 0.85×1 + 1.13×1 = 1.98",
        "SiLU(1.98) ≈ 1.98 × 0.879 = 1.74",
        "z₀ = 1.74 × 1.13 ≈ 1.97",
        "Δ₀ = 1.97 − 0.12 + 0.27 − 1.20 = 0.92",
      ][phase]!,
      detail:
        "复用正文 SwiGLU 手算，按每步展示的两位小数继续计算。这组数未触发 GLM 的限幅；这里只算到前馈输出 Δ，残差相加另见正文。",
      tensors:
        phase === 0
          ? [
              tensor("归一化输入 n", [SWIGLU_EXAMPLE.input]),
              tensor("gate 投影 g", [SWIGLU_EXAMPLE.gate], [0]),
              tensor("up 投影 u", [SWIGLU_EXAMPLE.up]),
            ]
          : phase < 3
            ? [
                tensor("SiLU(g)", [SWIGLU_EXAMPLE.silu], phase === 1 ? [0, 1, 2, 3] : []),
                tensor("u", [SWIGLU_EXAMPLE.up]),
                tensor("z = SiLU(g) ⊙ u", [SWIGLU_EXAMPLE.product], phase === 2 ? [0, 1, 2, 3] : []),
              ]
            : [
                tensor("中间向量 z", [SWIGLU_EXAMPLE.product]),
                tensor("W_down · 4 × 2", SWIGLU_EXAMPLE.down, [0, 2, 4, 6]),
                tensor("前馈输出 Δ", [SWIGLU_EXAMPLE.output], [0, 1]),
              ],
    };
  return residualFrame(3, progress);
}

const requestFrames: TeachingFrame[][] = [
  [
    {
      title: "R1 到达：先套模板，再分词",
      equation: "messages → chat template → tokenizer → input_ids",
      detail:
        "客户端发送一句话；API 先补角色与生成前缀，再分词。图中 p₀…p₃ 是正文四位置缩尺，真实模板含 <|assistant|><think>，这句话并非只分成四个 token。",
      tensors: [
        tensor("请求 R1", [["prompt"]]),
        tensor("input_ids", [["p₀", "p₁", "p₂", "p₃"]]),
        tensor("positions", [[0, 1, 2, 3]]),
      ],
    },
    {
      title: "选择执行组：R1 进入 DP0",
      equation: "DP0 等待队列 = [R1]；DP1 = []",
      detail:
        "API 先为 R1 登记输出收集器与增量反分词器，再把请求送入引擎。沿用正文两组空闲、选中 DP0 的条件；MoE 的专家仍跨两组。",
      tensors: [
        tensor("R1 · 4 个输入", [["p₀", "p₁", "p₂", "p₃"]]),
        tensor("DP0 队列", [["R1"]], [0]),
        tensor("DP1 队列", [["空"]]),
      ],
    },
    {
      title: "调度：本步算 4 个，另预留 3 个候选位置",
      equation: "4 + 3 = 7 个位置需求 → 15 个块号",
      detail: "15 个块号来自正文的混合缓存分组规则，不是每 token 一个块；候选预留还不是已生成的输出。",
      tensors: [
        tensor("本步预算", [["p₀", "p₁", "p₂", "p₃"]], [0, 1, 2, 3]),
        tensor("候选预留", [["d₁?", "d₂?", "d₃?"]]),
        tensor("分配块号数", [[15]]),
      ],
    },
    {
      title: "同一计划交给 DP0 的 8 个 worker",
      equation: "input_ids = [p₀…p₃]；positions = [0,1,2,3]",
      detail:
        "8 张卡看到相同的位置计划，随后按 TP 分担计算。调度器已提前登记 4 个已计算位置；这是记账进度，不表示 NPU 此刻已经算完。",
      tensors: [
        tensor("计划 R1", [["p₀", "p₁", "p₂", "p₃"]]),
        tensor(
          "8 个 worker",
          [
            ["r0", "r1", "r2", "r3"],
            ["r4", "r5", "r6", "r7"],
          ],
          [0, 1, 2, 3, 4, 5, 6, 7],
        ),
        tensor("调度预记 / 持有", [[4, 4]]),
      ],
    },
  ],
  [
    {
      title: "Embedding：四个编号，各查一行",
      equation: "[4] 个 ID → [4, 4096] 个数",
      detail: "行对应输入位置，列对应隐藏维度；图中省略中间维度，不虚构模型的真实向量值。",
      tensors: [
        tensor("R1 · input_ids", [["p₀"], ["p₁"], ["p₂"], ["p₃"]]),
        tensor(
          "查表后 · 4 × 4096",
          [
            ["h₀,₀", "…", "h₀,₄₀₉₅"],
            ["h₁,₀", "…", "h₁,₄₀₉₅"],
            ["h₂,₀", "…", "h₂,₄₀₉₅"],
            ["h₃,₀", "…", "h₃,₄₀₉₅"],
          ],
          [9, 10, 11],
        ),
      ],
    },
    {
      title: "四路残差，走过 45 个主干层",
      equation: "[4, 4096] → [4, 4, 4096] → 45 层更新",
      detail: "第一个 4 是位置数，第二个 4 是 residual 流数。每一层更新隐藏表示，输入的四个 ID 保持不变。",
      tensors: [
        tensor("4 个位置", [["p₀", "p₁", "p₂", "p₃"]]),
        tensor("每位置四路", [["r₀"], ["r₁"], ["r₂"], ["r₃"]], [0, 1, 2, 3]),
        tensor("主干层", [["L0", "…", "L44"]]),
      ],
    },
    {
      title: "取最后位置：准备预测下一项",
      equation: "位置 3：四路取均值 + RMSNorm → [1, 4096]",
      detail: "其他三个位置参与了 prefill；本次生成只拿最后位置的输出预测 y₀。不是把 p₃ 改名成 y₀。",
      tensors: [
        tensor("4 个位置的输出", [["h₀"], ["h₁"], ["h₂"], ["h₃"]], [3]),
        tensor("最后位置 · 1 × 4096", [["h₃,₀", "…", "h₃,₄₀₉₅"]], [0, 1, 2]),
      ],
    },
    {
      title: "输出头：隐藏向量变成候选分数",
      equation: "[1, 4096] × [4096, 154880] → [1, 154880]",
      detail: "每个分数对应一个词表候选。logits 是未归一化分数；此时还没有选出下一项。",
      tensors: [
        tensor("最后位置 h₃", [["h₀", "…", "h₄₀₉₅"]]),
        tensor("输出头权重", [
          ["W₀,₀", "…", "W₀,ᵥ"],
          ["⋮", "…", "⋮"],
          ["Wₕ,₀", "…", "Wₕ,ᵥ"],
        ]),
        tensor("154880 个 logits", [["ℓ₀", "…", "ℓ₁₅₄₈₇₉"]], [0, 1, 2]),
      ],
    },
  ],
  [
    {
      title: "采样：选出第一个新 token y₀",
      equation: "154880 个 logits → 采样规则 → y₀",
      detail:
        "y₀ 是新选出的 ID，不是 p₃ 的新名字。示例中它可解码为“先”；具体 ID、回答及采样结果由真实运行决定。",
      tensors: [
        tensor("候选分数", [["ℓ₀", "…", "ℓᵥ"]]),
        tensor("已确认输出", [["y₀"]], [0]),
        tensor("引擎已有输入", [["p₀", "p₁", "p₂", "p₃"]]),
      ],
    },
    {
      title: "MTP：再猜 3 个，但还不能返回",
      equation: "已确认：[y₀]；待验证：[d₁, d₂, d₃]",
      detail: "d₁…d₃ 留在 worker，下一轮由主模型验证。预先猜出候选，不等于用户已经收到三个 token。",
      tensors: [
        tensor("已确认", [["y₀"]], [0]),
        tensor("待验证 · 留在 worker", [["d₁?", "d₂?", "d₃?"]]),
        tensor("尚未返回", [["d₁", "d₂", "d₃"]]),
      ],
    },
    {
      title: "结果更新与流式返回",
      equation: "引擎持有 5 个 ID；已计算 4 个位置",
      detail:
        "引擎追加 y₀。增量反分词攒够可显示的文字后，通过 SSE（服务端逐段推送的事件流）返回；一个 token 不保证就是一个字或一个网络片段。",
      tensors: [
        tensor("引擎 token 列表", [["p₀", "p₁", "p₂", "p₃", "y₀"]], [4]),
        tensor("已计算 / 持有", [[4, 5]]),
        tensor("客户端", [["增量文字"]]),
      ],
    },
    {
      title: "下一圈：确认的 y₀ 与三个候选一起验证",
      equation: "输入 [y₀,d₁,d₂,d₃]；位置 [4,5,6,7]",
      detail: "确认的 y₀ 与候选身份不同。接下来的画面会把这四个位置送回主模型，演示验证、回退和返回。",
      tensors: [
        tensor("下一步输入", [["y₀", "d₁?", "d₂?", "d₃?"]], [0]),
        tensor("positions", [[4, 5, 6, 7]]),
        tensor("已经返回", [["仅 y₀ 的可显示文字"]]),
      ],
    },
  ],
  [
    {
      title: "首批：y₀ 先变成一小段文字",
      equation: "worker → Engine → API → SSE → 客户端",
      detail:
        "回看 prefill 的输出：Engine 只送回确认的 y₀。API 按 R1 找到增量反分词器，得到“先”，再由输出收集器交给 HTTP 流。首次响应先声明 assistant 角色。",
      tensors: [tensor("已确认", [["y₀"]]), tensor("客户端 content", [["先"]])],
    },
    {
      title: "第二圈：先验证，再返回两个新 token",
      equation: "[y₀,d₁,d₂,d₃] → 接受 d₁、拒绝 d₂ → [y₁,y₂]",
      detail:
        "沿用正文的贪心示例：位置 4 的分数支持 d₁，位置 5 改选 y₂，于是停止检查后续候选，已算计数从 8 回退到 6。确认的两个 ID 再经 Engine、API 反分词，追加到客户端已有的“先”后面；缓存块不在这里释放。",
      tensors: [tensor("本批确认", [["y₁", "y₂"]]), tensor("增量文字", [["解释缓存作用。"]])],
    },
    {
      title: "第三圈：新候选全通过，再返回四个 token",
      equation: "[y₂,d₁′,d₂′,d₃′] → 三个接受 + 一个额外输出",
      detail:
        "从位置 6 继续前向，覆盖上一圈错误候选的位置。假设三个新候选全通过，再使用第四行分数产生额外输出，共确认 y₃…y₆。API 追加可显示文字；本部署未启用 reasoning parser，示例原始 content 保留 </think>。",
      tensors: [tensor("本批确认", [["y₃", "y₄", "y₅", "y₆"]]), tensor("原始 content", [["</think>…答案"]])],
    },
    {
      title: "EOS：先结束请求，再关闭文字流",
      equation: "引擎停止并归还缓存 → finish_reason: stop → [DONE]",
      detail:
        "假设随后生成结束标记 EOS。引擎判停时归还 R1 占用的缓存，再把最终结果发给 API；API 发送 stop 和 [DONE]。EOS 不显示为答案，[DONE] 也不是触发缓存释放的原因。正文下方另演示 200-token 长度上限分支。",
      tensors: [tensor("引擎", [["R1 缓存归还"]]), tensor("最终响应", [["stop"], ["[DONE]"]])],
    },
  ],
];
export function requestTeaching(step: number, progress: number) {
  return requestFrames[step]![Math.min(3, Math.floor(progress * 4))]!;
}
