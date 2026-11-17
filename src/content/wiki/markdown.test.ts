import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { describe, expect, it } from "vitest";
import * as pipeline from "./markdown";

/** 按阅读页同一份插件把 markdown 渲染成 HTML */
function render(md: string): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { remarkPlugins: pipeline.WIKI_REMARK_PLUGINS, rehypePlugins: pipeline.WIKI_REHYPE_PLUGINS },
      md,
    ),
  );
}

describe("知识页正文：标题锚点", () => {
  it("H2/H3 带 id，写法与链接里的 #锚点 对得上：转小写、空格变 -、保留中文", () => {
    const html = render("## 剩下的显存变成多少 KV cache\n\n正文\n\n### 源码位置\n");
    expect(html).toContain('<h2 id="剩下的显存变成多少-kv-cache">');
    expect(html).toContain('<h3 id="源码位置">');
  });

  it("标点去掉，行内代码按文字算；同名标题依次加 -1、-2", () => {
    const html = render("## `--max-model-len` 为什么是 128K？\n\n## 怎么开\n\n## 怎么开\n");
    expect(html).toContain('<h2 id="--max-model-len-为什么是-128k">');
    expect(html).toContain('<h2 id="怎么开">');
    expect(html).toContain('<h2 id="怎么开-1">');
  });
});

describe("知识页正文：行内代码断行", () => {
  it("超过 40 个字符的标识符才在 /、_、-、. 之后给断行机会，不逐字断", () => {
    const html = render(
      "| 参数 | 取值 |\n| --- | --- |\n| `--tensor-parallel-size` | `vllm_ascend/ops/fused_moe/prepare_finalize.py` |\n",
    );
    expect(html).toContain('<code class="wiki-nobr">--tensor-parallel-size</code>');
    expect(html).toContain(
      '<code><span class="wiki-code-long">vllm_<wbr/>ascend/<wbr/>ops/<wbr/>fused_<wbr/>moe/<wbr/>prepare_<wbr/>finalize.<wbr/>py</span></code>',
    );
  });

  it("开头的 -- 不和参数名拆开：浏览器自己会在连字符后断，这一段要整体不断", () => {
    // 手机宽度下 `--quantization` 曾排成「--」一行、「quantization」一行
    expect(render("`--quantization`")).toContain('<code class="wiki-nobr">--quantization</code>');
    expect(render("`https://docs.vllm.ai/en/latest/serving/distributed.html`")).toContain(
      '<code><span class="wiki-code-long"><span class="wiki-nobr">https://docs.</span><wbr/>vllm.<wbr/>ai/<wbr/>en/<wbr/>latest/<wbr/>serving/<wbr/>distributed.<wbr/>html</span></code>',
    );
  });

  it("没有这种连写的段不加 nowrap：超长的哈希在手机上仍能兜底断开，不把整页撑宽", () => {
    const html = render("`raw:sha256-2a352fc9453bfcd0bd297b7e521f82bf.md#L1`");
    expect(html).not.toContain("wiki-nobr");
    expect(html).toContain(
      '<code><span class="wiki-code-long">raw:sha256-2a352fc9453bfcd0bd297b7e521f82bf.<wbr/>md#L1</span></code>',
    );
  });

  it("数字之间的分隔符、连写的分隔符不断；空格照常可断；代码块原样", () => {
    const html = render(
      "比例 `0.85`，版本 `v0.26.0`，日期 `2026-09-27`，`__init__`，`ceil(7 / 640)`\n\n```py\nx = a_b/c\n```\n",
    );
    // 这些都不到 20 个字符，按下面「短代码」一条整段不断
    expect(html).toContain('<code class="wiki-nobr">0.85</code>');
    expect(html).toContain('<code class="wiki-nobr">v0.26.0</code>');
    expect(html).toContain('<code class="wiki-nobr">2026-09-27</code>');
    expect(html).toContain('<code class="wiki-nobr">__init__</code>');
    expect(html).toContain('<code class="wiki-nobr">ceil(7 / 640)</code>');
    expect(html).toContain("x = a_b/c");
    expect(html).not.toMatch(/<pre>[\s\S]*<(wbr|span)/);
  });
});

describe("知识页正文：短的行内代码整段不断（P3 验收：`8 - 2 = 6` 断成两行）", () => {
  it("不到 20 个字符的行内代码整段不断行，空格和分隔符处都不断", () => {
    for (const code of ["8 - 2 = 6", "48 + 80 = 128", "n_shared_experts", "kv_lora_rank", "max-model-len"]) {
      expect(render(`算 \`${code}\` 格`), code).toContain(`<code class="wiki-nobr">${code}</code>`);
    }
  });

  it("长代码里，<wbr> 只加在超过 40 个字符的标识符上；短词不加，带连字符的短词整段不断", () => {
    const html = render(
      "`n_shared_experts quant_model_description max-model-len vllm@0fc695fc:vllm/config/vllm.py#L497-L507`",
    );
    expect(html).toContain("n_shared_experts quant_model_description ");
    expect(html).toContain('<span class="wiki-nobr">max-model-len</span>');
    expect(html).toContain(
      '<span class="wiki-code-long">vllm@0fc695fc:vllm/<wbr/>config/<wbr/>vllm.<wbr/>py#L497-<wbr/>L507</span>',
    );
    expect(html).not.toContain("n_<wbr/>shared");
    expect(html).not.toContain("quant_<wbr/>model");
  });
});

describe("知识页正文：标识符放得进一行就整个不断（P4 验收：`vllm-/ascend@db701c1f`、`num_/speculative_tokens`）", () => {
  it("不超过 40 个字符、中间没有空白的行内代码整段不断，不插 <wbr>", () => {
    for (const code of [
      "vllm-ascend@db701c1f",
      "--data-parallel-size-local",
      "num_speculative_tokens",
      "index_kpool_compress=true",
      "npu_moe_distribute_dispatch_v2",
      "vllm_ascend/worker/model_runner_v1.py",
      "OpenAIServingChat.create_chat_completion",
    ]) {
      const html = render(`执行侧固定为 \`${code}\`，控制流为`);
      expect(html, code).toContain(`<code class="wiki-nobr">${code}</code>`);
    }
  });

  it("不超过 30 个字符的代码连同其中的空格整段不断：参数和它的取值不拆开", () => {
    // 多请求页 `--data-parallel-size-local 1` 曾断成「--data-parallel-size-local」一行、「1」一行
    for (const code of [
      "--data-parallel-size-local 1",
      "num_lookahead_tokens = 3",
      "--max-num-batched-tokens 8192",
    ]) {
      expect(render(`（每台 \`${code}\`）`), code).toContain(`<code class="wiki-nobr">${code}</code>`);
    }
  });

  it("更长的代码仍在空格处可断，里面每个不超过 40 个字符的标识符各自不断", () => {
    const html = render("`--tensor-parallel-size 8 --data-parallel-size 2 --data-parallel-size-local 1`");
    expect(html).toContain(
      '<code><span class="wiki-nobr">--tensor-parallel-size</span> 8 <span class="wiki-nobr">--data-parallel-size</span> 2 <span class="wiki-nobr">--data-parallel-size-local</span> 1</code>',
    );
  });
});

describe("知识页正文：表格首列的标签不被挤碎（P3 验收：「router 打/分」「Q、K、V 投/影」）", () => {
  it("首列排得下 18 个汉字宽的格子标 is-label（整格不折行）；更长的、别的列都不标", () => {
    const html = render(
      [
        "| 步骤 | 作用 |",
        "| --- | --- |",
        "| router 打分 | 很长很长的一句说明 |",
        "| Q、K、V 投影 | 另一句 |",
        "| **PP**（pipeline parallel，流水线并行） | 1 |",
        "| 头加权查询、池分数、选池、展开与补尾 | 2 |",
        "| KDA 的前向：投影、状态更新、输出门与归一化、遗忘门 | 3 |",
      ].join("\n"),
    );
    expect(html).toContain('<td class="is-label">router 打分</td>');
    expect(html).toContain('<td class="is-label">Q、K、V 投影</td>');
    expect(html).toContain('<td class="is-label"><strong>PP</strong>（pipeline parallel，流水线并行）</td>');
    expect(html).toContain('<td class="is-label">头加权查询、池分数、选池、展开与补尾</td>');
    expect(html).toContain("<td>KDA 的前向：投影、状态更新、输出门与归一化、遗忘门</td>");
    expect(html).toContain("<td>很长很长的一句说明</td>");
    // 表头有自己的不折行规则，不标
    expect(html).toContain("<th>步骤</th>");
  });

  it("按排出来的宽度算，不按字数：拉丁字母只占半个汉字宽（P4 验收：「总 attention 头数不能被 TP / 整除」）", () => {
    // 23 个字符，但只有 8 个汉字，排出来不到 16 个汉字宽
    const html = render("| 条件 | 报错 |\n| --- | --- |\n| 总 attention 头数不能被 TP 整除 | x |\n");
    expect(html).toContain('<td class="is-label">总 attention 头数不能被 TP 整除</td>');
  });
});

describe("知识页正文：纯文本块按字符格对齐（P4 验收：one-request 的张量快照块中英文对不齐）", () => {
  it("text 块和不标语言的块里，每个非 ASCII 字符一格，汉字与全角符号标 is-wide（占两格），ASCII 原样", () => {
    const html = render("```text\n激活  silu(gate) → [4, 1536]\n```\n\n```\n每卡：x\n```\n");
    expect(html).toContain(
      '<code class="language-text"><span class="wiki-cell is-wide">激</span><span class="wiki-cell is-wide">活</span>  silu(gate) <span class="wiki-cell">→</span> [4, 1536]\n</code>',
    );
    expect(html).toContain(
      '<code><span class="wiki-cell is-wide">每</span><span class="wiki-cell is-wide">卡</span><span class="wiki-cell is-wide">：</span>x\n</code>',
    );
  });

  it("带语言的代码块、行内代码不动", () => {
    const html = render("```py\nx = 1  # 注释\n```\n\n正文 `激活 → x`\n");
    expect(html).toContain("x = 1  # 注释");
    expect(html).not.toContain("wiki-cell");
  });
});

describe("知识页正文：专名不从中间断行", () => {
  it("正文里的 GLM-5.3-Flash 整体不断：浏览器默认会在连字符后断开", () => {
    const html = render("先读[认识 GLM-5.3-Flash](glm-5-3-flash.md)，再看部署。");
    expect(html).toContain('认识 <span class="wiki-nobr">GLM-5.3-Flash</span>');
  });

  it("只挡住短的专名：过长的标识符仍可断，否则窄栏里会顶出屏幕", () => {
    const html = render("键名 enable_pcp_embedding_lmhead_weight_sharding 很长。");
    expect(html).not.toContain("wiki-nobr");
  });

  it("中文、普通英文词和破折号不受影响", () => {
    const html = render("这一步——也就是 prefill——只做一次。");
    expect(html).not.toContain("wiki-nobr");
  });
});

describe("知识页正文：KaTeX 数学公式渲染", () => {
  it("支持行内公式 $...$ 与块级公式 $$...$$，且不向 KaTeX DOM 混入断行/字格节点", async () => {
    const { compileMarkdown } = await import("../../../scripts/wiki/compile-markdown");
    const md = [
      "量化写为 $q = \\text{clamp}(\\text{round}(x / s), -128, 127)$，反量化写为 $\\hat{y} = s_x \\times s_w \\times \\sum_i q_{x,i} q_{w,i}$。",
      "",
      "$$",
      "s = \\frac{\\max(|x|)}{127}",
      "$$",
      "",
    ].join("\n");

    const liveHtml = render(md);
    expect(liveHtml).toContain('class="katex"');
    expect(liveHtml).toContain('class="katex-display"');
    expect(liveHtml).toContain('<annotation encoding="application/x-tex">');
    expect(liveHtml).not.toContain("wiki-cell");
    expect(liveHtml).not.toContain("wiki-nobr");
    expect(liveHtml).not.toContain("<wbr");

    const compiled = compileMarkdown(md);
    const compiledHtml = renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        { remarkPlugins: [], rehypePlugins: [() => () => structuredClone(compiled) as never] },
        md,
      ),
    );
    expect(compiledHtml).toBe(liveHtml);
  });

  it("编译快照与实时双路对上下标与多层分式输出完全一致的 KaTeX DOM 类结构", async () => {
    const { compileMarkdown } = await import("../../../scripts/wiki/compile-markdown");
    const md = [
      "暴露通信耗时记为 $T_{\\text{comm,exposed}}$，单步耗时满足：",
      "",
      "$$",
      "T_{\\text{step}} \\ge \\max\\!\\left(T_{\\text{compute}}\\!\\left(\\left\\{\\frac{W_p}{P_{\\text{peak},p}}\\right\\}\\right),\\; \\frac{Q_{\\text{dram}}}{BW_{\\text{dram}}}\\right) + T_{\\text{comm,exposed}}",
      "$$",
      "",
    ].join("\n");

    const liveHtml = render(md);
    const compiled = compileMarkdown(md);
    const compiledHtml = renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        { remarkPlugins: [], rehypePlugins: [() => () => structuredClone(compiled) as never] },
        "",
      ),
    );
    expect(compiledHtml).toBe(liveHtml);

    for (const cls of [
      "base",
      "sizing",
      "reset-size6",
      "size3",
      "mfrac",
      "frac-line",
      "vlist-t",
      "vlist-r",
      "vlist",
      "msupsub",
      "pstrut",
      "nulldelimiter",
    ]) {
      expect(liveHtml, `DOM 应包含 .${cls}`).toMatch(new RegExp(`\\bclass="[^"]*\\b${cls}\\b`));
    }
  });

  it("保持 safe math 边界：危险协议与 HTML 扩展命令在实时与编译快照双路均不生成可执行链接或属性", async () => {
    const { compileMarkdown } = await import("../../../scripts/wiki/compile-markdown");
    const md = [
      "不可信命令：$\\href{javascript:alert(1)}{click}$ 与 $\\url{javascript:alert(1)}$ 与 $\\htmlData{evil=1}{x}$。",
      "",
    ].join("\n");

    const liveHtml = render(md);
    const compiled = compileMarkdown(md);
    const compiledHtml = renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        { remarkPlugins: [], rehypePlugins: [() => () => structuredClone(compiled) as never] },
        "",
      ),
    );
    expect(compiledHtml).toBe(liveHtml);
    expect(liveHtml).not.toMatch(/<a[\s>]/i);
    expect(liveHtml).not.toContain('href="javascript:');
    expect(liveHtml).not.toContain("data-evil");
    expect(liveHtml).toContain('style="color:#cc0000">\\href</span>');
    expect(liveHtml).toContain('style="color:#cc0000">\\htmlData</span>');
  });
});

describe("知识页正文：页末「对照源码」默认折叠与 raw: 内联链接管线", () => {
  it("将 ## 对照源码 及其后续小节包裹进默认收起的 details.wiki-source-check，且保持标题 id 与预编译结果一致", async () => {
    const { compileMarkdown } = await import("../../../scripts/wiki/compile-markdown");
    const md = [
      "## 核心机制",
      "",
      "教学主干段落。",
      "",
      "## 对照源码",
      "",
      "### 源码位置",
      "",
      "核验条目 [C1]。",
      "",
    ].join("\n");

    const liveHtml = render(md);
    expect(liveHtml).toContain('<h2 id="核心机制">核心机制</h2>');
    expect(liveHtml).toContain(
      '<details class="wiki-source-check" data-testid="wiki-source-check"><summary class="wiki-source-summary"><h2 id="对照源码">对照源码</h2></summary><div class="wiki-source-check-body">\n<h3 id="源码位置">源码位置</h3>',
    );
    expect(liveHtml).not.toMatch(/<details[^>]*\bopen\b/);

    const compiled = compileMarkdown(md);
    const compiledHtml = renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        { remarkPlugins: [], rehypePlugins: [() => () => structuredClone(compiled) as never] },
        md,
      ),
    );
    expect(compiledHtml).toBe(liveHtml);
  });

  it("在 ReactMarkdown 默认 urlTransform 之前将合法 raw: 链接改写为 ./wiki-raw/，同时阻断越界路径与危险协议", async () => {
    const { compileMarkdown } = await import("../../../scripts/wiki/compile-markdown");
    const validHash = "a".repeat(64);
    const wholeHash = "b".repeat(64);
    const md = [
      `见[归档行段](raw:sha256-${validHash}.md#L5-L9)与[整份归档](raw:sha256-${wholeHash}.md)。`,
      `危险链接：[越界](raw:../HANDBOOK.md#L1)、[伪行号](raw:sha256-${validHash}.md#L0)、[脚本](javascript:alert(1))、[数据](data:text/html,boom)。`,
      "",
    ].join("\n\n");

    const liveHtml = render(md);
    expect(liveHtml).toContain(`href="./wiki-raw/sha256-${validHash}.html?lines=5-9#L5"`);
    expect(liveHtml).toContain(`href="./wiki-raw/sha256-${wholeHash}.html?lines=1#L1"`);
    expect(liveHtml).not.toContain("HANDBOOK");
    expect(liveHtml).not.toContain("raw:");
    expect(liveHtml).not.toContain("javascript:");
    expect(liveHtml).not.toContain("data:text/html");

    const compiled = compileMarkdown(md);
    const compiledHtml = renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        { remarkPlugins: [], rehypePlugins: [() => () => structuredClone(compiled) as never] },
        md,
      ),
    );
    expect(compiledHtml).toBe(liveHtml);
  });

  it("同名引用式链接按 CommonMark 首定义优先解析（含 Unicode 大小写折叠），后续重复 raw: 定义不会覆盖首条目标", async () => {
    const { compileMarkdown } = await import("../../../scripts/wiki/compile-markdown");
    const firstHash = "a".repeat(64);
    const shadowedHash = "b".repeat(64);
    const unicodeHash = "c".repeat(64);
    const shadowedByExtHash = "d".repeat(64);
    const md = [
      "见[首条原文][ref]、[折叠标识][ẞ]与[外链优先][ext]。",
      "",
      `[ref]: raw:sha256-${firstHash}.md#L1`,
      `[ref]: raw:sha256-${shadowedHash}.md#L1`,
      `[ss]: raw:sha256-${unicodeHash}.md#L2-L3`,
      `[ẞ]: raw:sha256-${shadowedHash}.md#L9`,
      "[ext]: https://docs.vllm.ai/en/latest/",
      `[ext]: raw:sha256-${shadowedByExtHash}.md#L1`,
      "",
    ].join("\n");

    const liveHtml = render(md);
    expect(liveHtml).toContain(`href="./wiki-raw/sha256-${firstHash}.html?lines=1#L1"`);
    expect(liveHtml).toContain(`href="./wiki-raw/sha256-${unicodeHash}.html?lines=2-3#L2"`);
    expect(liveHtml).toContain('href="https://docs.vllm.ai/en/latest/"');
    expect(liveHtml).not.toContain(shadowedHash);
    expect(liveHtml).not.toContain(shadowedByExtHash);

    const compiled = compileMarkdown(md);
    const compiledHtml = renderToStaticMarkup(
      createElement(
        ReactMarkdown,
        { remarkPlugins: [], rehypePlugins: [() => () => structuredClone(compiled) as never] },
        md,
      ),
    );
    expect(compiledHtml).toBe(liveHtml);
  });
});
