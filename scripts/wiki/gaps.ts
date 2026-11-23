import type { WikiPage } from "./pages";

/**
 * 漏洞扫描：正文反复引用、但知识库里没有页的概念。
 *
 * 这是 2026-09-11 用户点出来的缺口。当时 11 页里 attention 出现 234 次、
 * connector 71 次、MLA 33 次、GQA 20 次、DCP 10 次——没有一个有页面，而系统
 * 对此一无所知。「识别到交叉和漏洞」里的交叉勉强有（整合 agent 报矛盾），
 * 漏洞是零。
 *
 * 判据不是「出现过」而是「被当成读者已经懂的东西反复用」：
 *   - 至少在 MIN_PAGES 页里出现（只在一页里出现多半是那页的局部话题）
 *   - 总次数至少 MIN_HITS
 * 两条都满足，才值得单开一页。
 */

export interface Gap {
  term: string;
  hits: number;
  /** 出现在哪些页，用来判断它属于哪个章节 */
  pages: string[];
}

export interface GapOptions {
  minHits?: number;
  minPages?: number;
  /** 已知不需要单开页的词（太泛、或本来就是别的页的标题） */
  ignore?: Iterable<string>;
}

const DEFAULTS = { minHits: 8, minPages: 3 };

/**
 * 候选词：反引号里的标识符，以及连续的大写缩写（MLA、GQA、DCP、HCCL）。
 * 中文词不扫——中文的分词在这里不可靠，宁可漏也不要制造一堆噪声。
 */
const BACKTICK_RE = /`([A-Za-z_][A-Za-z0-9_.]{2,})`/g;
const ACRONYM_RE = /\b([A-Z]{2,6})\b/g;

/** 语言关键字、通用协议/系统缩写、配置枚举与泛称，出现再多也不是待单开页面的「知识点」 */
const STOPWORDS = new Set([
  "TODO",
  "NOTE",
  "FIXME",
  "API",
  "CLI",
  "SDK",
  "CPU",
  "GPU",
  "NPU",
  "HBM",
  "DRAM",
  "SRAM",
  "SSD",
  "CUDA",
  "NVIDIA",
  "ARM",
  "KV",
  "PR",
  "URL",
  "URI",
  "HTTP",
  "HTTPS",
  "POST",
  "GET",
  "PUT",
  "DELETE",
  "HEAD",
  "PATCH",
  "IP",
  "TCP",
  "UDP",
  "SSH",
  "TLS",
  "SSL",
  "OS",
  "PID",
  "UTF",
  "ASCII",
  "SHA",
  "JSON",
  "YAML",
  "TOML",
  "HTML",
  "XML",
  "CSV",
  "PDF",
  "FAQ",
  "README",
  "MB",
  "GB",
  "KB",
  "KIB",
  "MIB",
  "GIB",
  "FLOP",
  "FLOPS",
  "MFLOP",
  "GFLOP",
  "TFLOP",
  "TFLOPS",
  // Python / C 类型与关键字
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "float",
  "float16",
  "float32",
  "float64",
  "FLOAT",
  "bool",
  "str",
  "None",
  "True",
  "False",
  "self",
  "def",
  "class",
  "import",
  "from",
  "return",
  "assert",
  "if",
  "else",
  "for",
  "while",
  "break",
  "continue",
  "pass",
  "raise",
  "with",
  "async",
  "await",
  // 配置字面量、日志级别与通用状态枚举：页里写「默认 `false`」「状态 `RELEASED`」很常见，不是知识点
  "true",
  "false",
  "none",
  "null",
  "auto",
  "unknown",
  "default",
  "enabled",
  "disabled",
  "INFO",
  "DEBUG",
  "WARN",
  "WARNING",
  "ERROR",
  "FULL",
  "NONE",
  "STANDARD",
  "MAX",
  "MIN",
  "SUM",
  "RETRYABLE",
  "REJECTED",
  "REGISTERED",
  "RELEASED",
  "PREEMPTED",
  "COMPATIBILITY",
  // 泛化代码/数学/基础计算机词与分支泛称：整个库都在用，不会为其单开一页概念
  "main",
  "vllm",
  "vLLM",
  "ascend",
  "HF",
  "EOS",
  "BOS",
  "PAD",
  "BPE",
  "TTL",
  "LRU",
  "LIFO",
  "FIFO",
  "FCFS",
  "EADDRINUSE",
  "sources",
  "apply",
  "down",
  "free",
  "all",
  "model",
  "weights",
  "linear",
  "align",
  "dynamic",
  "forward",
  "refresh",
  "priority",
  "content",
  "choices",
  "high",
  "AI",
  "LLM",
  "ID",
  "IO",
  "OK",
  // mermaid 的方向词（graph TD / LR），存量图里会被当成缩写扫到
  "TD",
  "LR",
  "TB",
  "RL",
]);
/** Python 异常类名：页里引用的是报错现象，不是要补的概念 */
const EXCEPTION_RE = /(Error|Exception|Warning)$/;
/** commit 短号（含数字的 7–40 位十六进制串）：页里写版本快照时会反复出现 */
const COMMIT_RE = /^(?=.*\d)[a-f0-9]{7,40}$/;
/** 版本号字符串（如 v0.30.0、v0.26.0rc、v0.23）：四版对照高频出现，不是概念缺口 */
const VERSION_RE = /^v\d+(?:\.\d+)+(?:[._-]?(?:rc|post|dev|a|b|alpha|beta)\d*)?$/i;
/** 源码与文档文件名（如 model_runner_v1.py、ascend_config.py、*.cc、*.h、*.rs、*.md、*.json） */
const FILE_NAME_RE =
  /\.(?:py|cc|cpp|cxx|c|h|hpp|cu|rs|go|java|ts|tsx|js|mjs|cjs|md|rst|json|ya?ml|toml|ini|cfg|sh|bash|txt|html?|svg|webp|png|whl|so)$/i;
/** Python 双下划线/私有内部符号（如 __init__、_dummy_run） */
const DUNDER_OR_PRIVATE_RE = /^_[A-Za-z0-9_.]*$/;
/** 模块/类成员访问片段（如 Scheduler.schedule、NPUWorker.__init__、PassConfig.enable_sp） */
const DOTTED_SYMBOL_RE = /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_.]*$/;
/** 并行组编号实例（如 DP0、DP1、TP8、EP16），对应并行机制已有专页 */
const RANK_LABEL_RE = /^(?:DP|TP|PP|EP|CP|SP)\d+$/i;

const NON_PROSE_H2_RE = /^##\s+(?:对照源码|版本谱系|参数定义（自动生成）)(?:\s.*)?$/;
const H2_HEADING_RE = /^##\s+\S/;
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`~]*)/;

/**
 * 提取真正面向读者的教学正文：
 * 剥离页末默认折叠的「## 对照源码」（以及参数页自动生成的「## 版本谱系」「## 参数定义（自动生成）」）
 * 与 `wiki-diagram` / `wiki-scene` / `wiki-tool` 结构围栏，避免源码锚点文件名与组件 ID 污染概念缺口雷达。
 */
export function teachingProse(body: string): string {
  const out: string[] = [];
  let fenceMarker: string | null = null;
  let skipFence = false;
  let skipSection = false;

  for (const line of body.split(/\r?\n/)) {
    if (fenceMarker !== null) {
      const ch = fenceMarker[0]!;
      const closeRe = new RegExp(`^ {0,3}${ch}{${fenceMarker.length},}\\s*$`);
      if (closeRe.test(line)) {
        fenceMarker = null;
        skipFence = false;
      } else if (!skipFence && !skipSection) {
        out.push(line);
      }
      continue;
    }

    const open = FENCE_OPEN_RE.exec(line);
    if (open) {
      fenceMarker = open[1]!;
      const lang = (open[2] ?? "").toLowerCase();
      skipFence = lang === "wiki-diagram" || lang === "wiki-scene" || lang === "wiki-tool";
      continue;
    }

    if (H2_HEADING_RE.test(line)) {
      skipSection = NON_PROSE_H2_RE.test(line.trim());
    }
    if (!skipSection) {
      out.push(line);
    }
  }
  return out.join("\n");
}

function isNoiseTerm(term: string): boolean {
  return (
    STOPWORDS.has(term) ||
    EXCEPTION_RE.test(term) ||
    COMMIT_RE.test(term) ||
    VERSION_RE.test(term) ||
    FILE_NAME_RE.test(term) ||
    DUNDER_OR_PRIVATE_RE.test(term) ||
    DOTTED_SYMBOL_RE.test(term) ||
    RANK_LABEL_RE.test(term)
  );
}

function candidates(text: string): string[] {
  const prose = teachingProse(text);
  const out: string[] = [];
  for (const m of prose.matchAll(BACKTICK_RE)) if (m[1]) out.push(m[1]);
  // 仅抹掉已被单标识符规则判为噪音的反引号片段（如 `CANN.Profiler`、`foo.py`），保留含空格的多词短语（如 `HCCS / RoCE`）
  const scrubbed = prose.replace(/`([A-Za-z_][A-Za-z0-9_.-]*)`/g, (full, t: string) =>
    isNoiseTerm(t) ? " " : full,
  );
  for (const m of scrubbed.matchAll(ACRONYM_RE)) if (m[1]) out.push(m[1]);
  return out;
}

/** 概念名 → 可能的页 id，用来判断「这个概念是不是已经有页了」 */
export function toId(term: string): string {
  return (
    term
      // KVPool → KV-Pool：缩写开头的驼峰要先断，否则会归一成 kvpool 对不上 kv-pool
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[_.\s]+/g, "-")
      .toLowerCase()
  );
}

export function findGaps(pages: WikiPage[], opts: GapOptions = {}): Gap[] {
  const minHits = opts.minHits ?? DEFAULTS.minHits;
  const minPages = opts.minPages ?? DEFAULTS.minPages;
  // 已有页的 id 与别名都算「已覆盖」
  const covered = new Set<string>();
  for (const p of pages) {
    covered.add(p.fm.id);
    covered.add(toId(p.fm.title));
    for (const a of p.fm.aliases) covered.add(toId(a));
  }
  for (const x of opts.ignore ?? []) covered.add(toId(x));

  const hits = new Map<string, { n: number; pages: Set<string> }>();
  for (const p of pages) {
    for (const term of candidates(p.body)) {
      if (isNoiseTerm(term)) continue;
      const id = toId(term);
      if (covered.has(id)) continue;
      const rec = hits.get(term) ?? { n: 0, pages: new Set<string>() };
      rec.n++;
      rec.pages.add(p.fm.id);
      hits.set(term, rec);
    }
  }

  const out: Gap[] = [];
  for (const [term, rec] of hits) {
    if (rec.n < minHits || rec.pages.size < minPages) continue;
    out.push({ term, hits: rec.n, pages: [...rec.pages].sort() });
  }
  return out.sort((a, b) => b.hits - a.hits || a.term.localeCompare(b.term));
}

/** 断掉的 relations：指向不存在的页。它们是最确定的漏洞——有人已经说要连过去了。 */
export function danglingRelations(pages: WikiPage[]): { from: string; to: string; note: string }[] {
  const ids = new Set(pages.map((p) => p.fm.id));
  const out: { from: string; to: string; note: string }[] = [];
  for (const p of pages) {
    for (const r of p.fm.relations) {
      if (!ids.has(r.to)) out.push({ from: p.fm.id, to: r.to, note: r.note });
    }
  }
  return out.sort((a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from));
}
