/**
 * 知识页样式对照页（只在 dev 挂路由，见 App.tsx）：算式块、行内代码、表格三类元素的定稿样子，
 * 留作以后调样式时的对照。`#/dev/wiki-specimen`。
 *
 * 内容是 one-request 与 glm-5-3-flash-two-node 的原文片段，走阅读页同一份 markdown 管线和
 * 同一条算式识别：```text 算式块由 textFenceAsCalc 认出来，```calc 围栏由 parseCalcFence 解析。
 */
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import { Link } from "react-router";
import { CalcBlock } from "../../../content/wiki/CalcBlock";
import { parseCalcFence, textFenceAsCalc } from "../../../content/wiki/calc";
import { rewriteRelativeLink, routePathOf } from "../../../content/wiki/index";
import { textOf, WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../../content/wiki/markdown";
import { EvidenceBadge } from "../../../content/wiki/Term";
import { rehypeNumericColumns } from "../../../content/wiki/tableAlign";
import "katex/dist/katex.min.css";
import "../../../design/wiki.css";

// ---------- 算式：one-request 的原文 ```text 块 ----------

const CALC_MD = [
  [
    "块大小取 640 个 token，是为了让这两种东西装进同样大的格子：",
    `MLA 一层一块    = 640 token × 1024 B（512 维 × 2 B） = 655,360 B
KDA 一层一份状态 = 36,864 B 卷积 + 524,288 B 递推  = 561,152 B   ≤ 655,360 B`,
  ],
  [
    "不论这个块号拿去装 MLA 的历史还是 KDA 的状态，每张卡上都要为它留出这 12 格：",
    `每块号    = 12 × (655,360 + 40,960) B    = 8,355,840 B ≈ 7.969 MiB（每张卡）
折合每 token = 8,355,840 B ÷ 640          = 13,056 B = 12 层 × (1024 + 64) B`,
  ],
  [
    "TP8 下词表 154880 行按行切成 8 段，每卡 19360 行：",
    `每卡嵌入权重  = 19360 × 4096 × 2 B = 151.25 MiB（BF16：16 位浮点，每个数 2 字节）
本卡查表      = input_ids [4] → [4, 4096]，编号不在本卡那一段的行填 0
All-Reduce    = TP8 内按元素相加 → 每卡都得到完整的 [4, 4096]
单次张量      = 4 × 4096 × 2 B = 32,768 B`,
  ],
  [
    "vLLM 把 DP2 和 TP8 拍平成一个 EP16 维度，专家内部的 2048 维不再切：",
    `每卡专家数   = 288 ÷ 16 = 18
每卡每层权重 = 18 × (4096 × 4096 + 4096 × 2048) × 1 B = 432 MiB（int8）
42 层        = 17.72 GiB，占主干 45 层权重的 88%`,
  ],
]
  .map(([lead, body]) => `${lead}\n\n\`\`\`text\n${body}\n\`\`\``)
  .join("\n\n");

// ---------- 行内代码与表格：同一份 markdown ----------

const CODE_MD = `
1. 客户端 \`POST /v1/chat/completions\`。聊天接口先套**聊天模板**（模型训练时约定的对话格式，规定 system、user 各段怎么拼、用哪些特殊标记分隔），再用分词器把文本切成 token 编号，得到 \`prompt_token_ids = [p₀, p₁, p₂, p₃]\` 和采样设置。

**每张卡上的权重约 20.58 GiB**（1 GiB = 2³⁰ 字节）。其中 17.72 GiB 是 42 个 MoE 层各 18 个路由专家的 int8 权重：\`18 × 3 × 4096 × 2048 × 1 B = 432 MiB/层\`，乘 42 层。

**空白一：prefix caching 没写。** 教程里既没有 \`--enable-prefix-caching\` 也没有关闭它的选项，所以走默认值。默认值不是「开」：GLM 是 hybrid 模型，vLLM 对这类模型直接判定不支持 prefix caching，于是它是**关着的**。

**空白二：\`block_size\` 没写。** 教程里也没有 \`--block-size\`，走默认值。但默认值 16 会被 vllm-ascend 的补丁按上一节那个公式改写成 **640**。
`;

const TABLE_MD = `
这里只解释每个参数管住主线的哪一步。

| 参数 | 取值 | 它是什么意思 | 管住主线的哪一步 | 深入看 |
| --- | --- | --- | --- | --- |
| \`--tensor-parallel-size\` | 8 | 机内几张卡合切同一层的矩阵 | 每层 attention 和 MLP 的切分与 All-Reduce | [tensor parallel](tensor-parallel.md) |
| \`--data-parallel-size\` | 2 | 一共几个执行组（DP 组） | 请求分给哪一组；两组每步互相对齐 | [data parallel](data-parallel.md) |
| \`--quantization\` | \`ascend\` | 按权重仓库的描述文件逐层选精度 | 启动第四步：权重字节数 | [quantization](quantization.md) |
| \`--max-model-len\` | 133120 | 一条请求最长能有多少 token | 块表的最大长度、KDA 状态的页大小 | [block table](block-table.md) |
| \`--gpu-memory-utilization\` | 0.85 | 显存预算占总量的比例 | 启动第五步：能切出多少 KV 块 | [KV cache 显存量测](kv-cache-memory-profiling.md) |
| \`cudagraph_mode\` | \`FULL_DECODE_ONLY\` | 只给纯 decode 步录图 | 启动第七步；混合批只能 eager 执行 | [ACL Graph](acl-graph.md) |

按部件把每张卡上的权重逐项加起来：

| 部件 | 每卡每层 | 合计 |
| --- | --- | --- |
| 嵌入表（BF16） | 19360 × 4096 × 2 B | 151.25 MiB |
| KDA 层（主要是 BF16） | 34.61 MiB | × 34 层 = 1,176.7 MiB |
| 稠密 MLP（int8） | 18.0 MiB | × 3 层 = 54.0 MiB |
| 路由专家（int8） | 432.0 MiB | × 42 层 = **17.72 GiB** |
| MTP 第 45 层 | | 540.75 MiB |
| **整卡合计** | | **21,078 MiB = 20.58 GiB** |

### 源码位置

| 站 | 想核对的事 | 阅读位置 |
|---|---|---|
| 1 入口 | 按 \`waiting × 4 + running\` 选 DP 组 | \`DPLBAsyncMPClient.get_core_engine_for_request\` [C3] |
| 2 调度 | 等待队列里的请求带 \`num_lookahead_tokens = 3\` 要块 | \`Scheduler.schedule\` 的 waiting 分支 [C5] |
| 2 调度 | 每块号 \`12 × (655,360 + 40,960) = 8,355,840 B\` | GLM 布局的块字节公式 [C9]，算式由正文推出 [D] |
| 4 前向 | A2 上 MC2 与 AllGather 的门槛 128 | \`mc2_tokens_capacity\`、\`_select_a2_moe_comm_method\` [C15] |
| 6 更新 | \`num_computed_tokens -= num_rejected\` | \`Scheduler.update_from_output\` [C19] |
`;

/** ```calc 围栏的写法示例：第一行可选的 title，下面一项一行 */
const CALC_FENCE_MD = [
  "新写法：```calc 围栏，第一行 `title:` 是这组计算的名字（可选，显示在框下）。",
  "",
  "```calc",
  "title: KV 块的大小是怎么定的",
  "KDA 每层每请求的状态（TP=8 之后） = 561,152 B",
  "MLA 每 token 每层 = kv_lora_rank 512 × 2 B = 1,024 B",
  "需要多少个 128 token 的 kernel 块 = ceil(561,152 / (128 × 1024)) = 5",
  "逻辑块大小 = 128 × 5 = 640 个 token",
  "```",
].join("\n");

// 冻结 2026-10-05 一条请求中的七组字符格样例，正文改写不改变排版验收覆盖。
const PLAIN_TEXT_MD =
  "```text\n进入第 0 层前   [4, 4096] → 复制 → [4, 4, 4096]   R1 占 4 × 4 × 4096 × 2 B = 128 KiB\n每个子层之前    4 条流 → 加权求和 → [4, 4096]     送进注意力或 MLP；同时算出 4×4 混合矩阵\n每个子层之后    输出 [4, 4096] → 写回并混合 → [4, 4, 4096]\n第 44 层之后    4 条流求平均 → [4, 4096]\n```\n\n```text\ngate_up_proj  [4, 4096] × [4096, 3072] → [4, 3072]   每卡 3072 = 2 × 12288 ÷ 8\n激活          silu(gate) × up          → [4, 1536]\ndown_proj     [4, 1536] × [1536, 4096] → [4, 4096]   只是部分和\nAll-Reduce    TP8 相加部分和            → 完整 [4, 4096]，单次张量 32,768 B\n每卡权重      (3072 + 1536) × 4096 × 1 B = 18.0 MiB（int8），3 层 54.0 MiB\n```\n\n```text\nq/k/v_proj    [4, 4096] → 各 [4, 1024]              每卡 1024 = 8 头 × 128\n短卷积        [4, 3072] 与本请求的卷积状态 (3072, 6) 拼接，宽度 4\n递推          8 个头各更新一个 [128, 128] FP32 状态\no_proj        [4, 1024] × [1024, 4096] → [4, 4096]   部分和\nAll-Reduce    TP8，单次张量 32,768 B\n每卡权重      34.61 MiB/层（BF16 为主），34 层 1.149 GiB\n```\n\n```text\nrouter        [4, 4096] × [4096, 288]（FP32）→ [4, 288] → 每个 token 选 8 个专家\n补齐与切片    4 行补到 8 行，TP8 每卡分 1 行；机内编号 0–3 的卡拿到真 token，4–7 的卡拿到填充行\ndispatch      每卡发出 ≤ 1 个 token × 8 个专家 × (4096 B int8 + 4 B 缩放系数) = 32,800 B\n专家计算      落到本卡 18 个专家上的（token, 专家）对，期望 4 × 8 × 18 ÷ 288 = 2 行\ncombine       每卡收回 ≤ 1 × 8 × 4096 × 2 B = 65,536 B\n拼回          TP8 All-Gather，每卡发 1 行 8,192 B，拼回完整 [4, 4096]\n共享专家      在完整 [4, 4096] 上算，按 TP8 切，每卡 3.0 MiB；之后 TP8 All-Reduce，单次张量 32,768 B\n```\n\n```text\n每卡权重              [19360, 4096] BF16 = 151.25 MiB\nprefill 只取最后位置   [1, 4096] × [4096, 19360] → [1, 19360]，38,720 B\nTP8 All-Gather        拼成 [1, 154880]，309,760 B\n```\n\n```text\n第 1 遍  token 输入 = [p₁, p₂, p₃, y₀] 的嵌入，位置 [0, 1, 2, 3]\n         隐藏输入   = 主模型这一步的隐藏向量 [4, 4096]\n         两者各做一次归一化后拼成 [4, 8192] → 投影回 [4, 4096]\n         → 一层稀疏 MLA + MoE → 词表投影 → 取最后一行 → d₁（位置 5）\n第 2 遍  token 输入 = d₁，位置 +1，隐藏输入 = 第 1 遍的输出   → d₂（位置 6）\n第 3 遍  token 输入 = d₂，位置 +1，隐藏输入 = 第 2 遍的输出   → d₃（位置 7）\n```\n\n```text\n第 0 行（位置 4 的输出）预测位置 5：分数最大的是 d₁   与候选 d₁ 相同 → 接受\n第 1 行（位置 5 的输出）预测位置 6：分数最大的是 y₂   与候选 d₂ 不同 → 写下 y₂，停止\n本圈产出：y₁ = d₁、y₂，共 2 个 token\n```";

type HastNode = { children?: { type: string; tagName?: string; properties?: Record<string, unknown> }[] };

/** 与阅读页（WikiPage.tsx 的 Article）一致的几处组件：算式块、表格外包横滚容器、角标、站内链接 */
const COMPONENTS: Components = {
  pre: ({ children, node }) => {
    const code = (node as HastNode | undefined)?.children?.[0];
    const cls = code?.tagName === "code" ? code.properties?.className : undefined;
    // rehypeTextGrid 已把中文分进 span；与正式阅读页一致，拼回完整原文再识别算式。
    const text = code ? textOf(code) : "";
    if (Array.isArray(cls) && cls.includes("language-calc")) {
      const { title, rows } = parseCalcFence(text);
      return <CalcBlock rows={rows} title={title} />;
    }
    const plain = !Array.isArray(cls) || cls.includes("language-text");
    const rows = plain && text ? textFenceAsCalc(text.replace(/\n$/, "")) : null;
    return rows ? <CalcBlock rows={rows} /> : <pre>{children}</pre>;
  },
  table: ({ children }) => (
    <div className="wiki-table-scroll">
      <table>{children}</table>
    </div>
  ),
  abbr: ({ children }) => <EvidenceBadge level={String(children)} />,
  a: ({ href, children }) => {
    const to = rewriteRelativeLink(href ?? "", "glm-5-3-flash-two-node");
    const route = routePathOf(to);
    return route ? <Link to={route}>{children}</Link> : <a href={to}>{children}</a>;
  },
};

type Plugins = NonNullable<Options["rehypePlugins"]>;
const REHYPE: Plugins = [...(WIKI_REHYPE_PLUGINS ?? []), rehypeNumericColumns];

function Body({ children }: { children: string }) {
  return (
    <div className="wiki-body">
      <ReactMarkdown remarkPlugins={WIKI_REMARK_PLUGINS} rehypePlugins={REHYPE} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-10" data-specimen={id}>
      <h2 className="mb-3 text-title font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function WikiSpecimenPage() {
  return (
    <div className="wiki-shell">
      <nav className="wiki-toc" aria-label="试样说明">
        <Link className="wiki-toc-home" to="/wiki">
          <ArrowLeft size={12} /> 返回知识库
        </Link>
        <div className="wiki-toc-head">
          <span className="eyebrow">DEV · SPECIMEN</span>
          <strong>样式对照页</strong>
          <small>只在开发环境出现，不进构建</small>
        </div>
        <div className="flex flex-col gap-3 text-compact" data-testid="specimen-notes">
          <strong className="text-ink-inverse">2026-09-27 定稿</strong>
          <ul className="flex flex-col gap-2">
            <li>正文 15/26，中英文之间自动留空。</li>
            <li>行内代码：暖沙色小底 + 深棕字。</li>
            <li>表格：无竖线、隔行底色，数字列右对齐。</li>
            <li>算式块：图框同款外框；一项一行，标签 ｜ 算式 ｜ = 结果，说明在行下。</li>
          </ul>
          <strong className="text-ink-inverse">```calc 写法</strong>
          <ul className="flex flex-col gap-1 text-rail-muted">
            <li>title: 这组计算的名字（可选）</li>
            <li>标签 = 算式 = … = 结果（说明）</li>
          </ul>
        </div>
      </nav>

      <main className="wiki-main">
        <article className="wiki-article" data-testid="specimen">
          <header className="wiki-article-head">
            <span className="eyebrow">STYLE SPECIMEN</span>
            <h1 className="display">算式、行内代码、表格</h1>
            <p className="wiki-summary">
              知识页三类元素定稿后的样子。内容取自「一条请求走完全程」与「官方双机部署」的原文片段，走阅读页同一份
              markdown 管线。
            </p>
          </header>
          <Section id="calc" title="算式">
            <Body>{`${CALC_MD}\n\n${CALC_FENCE_MD}`}</Body>
          </Section>
          <Section id="code" title="行内代码">
            <Body>{CODE_MD}</Body>
          </Section>
          <Section id="table" title="表格">
            <Body>{TABLE_MD}</Body>
          </Section>
          <Section id="legacy-calc" title="冒号旧写法回归样例">
            <Body>{"```text\nN 的第 2 步： ceil(6003 / 640) + 14 = 10 + 14 = 24 块\n```"}</Body>
          </Section>
          <Section id="plain-text" title="纯文本字符格回归样例">
            <Body>{PLAIN_TEXT_MD}</Body>
          </Section>
        </article>
      </main>
    </div>
  );
}
