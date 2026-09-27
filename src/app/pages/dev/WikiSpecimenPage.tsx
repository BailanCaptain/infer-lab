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
import { WIKI_REHYPE_PLUGINS, WIKI_REMARK_PLUGINS } from "../../../content/wiki/markdown";
import { EvidenceBadge } from "../../../content/wiki/Term";
import { rehypeNumericColumns } from "../../../content/wiki/tableAlign";
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

type HastNode = { children?: { type: string; tagName?: string; properties?: Record<string, unknown> }[] };

/** 与阅读页（WikiPage.tsx 的 Article）一致的几处组件：算式块、表格外包横滚容器、角标、站内链接 */
const COMPONENTS: Components = {
  pre: ({ children, node }) => {
    const code = (node as HastNode | undefined)?.children?.[0];
    const cls = code?.tagName === "code" ? code.properties?.className : undefined;
    const text = (code as { children?: { value?: string }[] } | undefined)?.children?.[0]?.value ?? "";
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
        </article>
      </main>
    </div>
  );
}
