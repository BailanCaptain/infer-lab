/**
 * 解析上游文档的变量表，把 `{{ 变量 }}` 在本地展开。
 *
 * 为什么需要（2026-09-11 实测）：vllm-ascend 的文档正文里有 226 处占位符，
 * `{{ vllm_ascend_version }}` 一个就占 167 处，且集中在安装命令、pip 版本、
 * 镜像 tag。agent 照抄本地 md 会把
 * `pip install vllm-ascend=={{ pip_vllm_ascend_version }}` 原样写进页面，
 * 学习者复制粘贴得到一条跑不了的命令。
 *
 * 为什么在本地解而不是让 agent 去官网取：提取 agent 的工具黑名单里有 WebFetch
 * 与 WebSearch，它上不了网；而变量表本来就在仓库里，离线解更准也更快，还能
 * 随 ref 走——不同版本的值不一样。
 *
 * 两个版本的构建系统不同，两处都要认：
 *   - `main`：MkDocs，变量在 `mkdocs.yml` 的 `extra:` 块
 *   - `releases/v0.23.0`：Sphinx，变量在 `docs/source/conf.py` 的 `myst_substitutions`
 */

export type DocVars = Record<string, string>;

export interface DocVarSources {
  /** 仓库根的 mkdocs.yml 原文 */
  mkdocsYml?: string;
  /** docs/source/conf.py 原文 */
  confPy?: string;
}

const unquote = (v: string) => v.replace(/^["']|["']$/g, "").trim();

/** MkDocs：`extra:` 块下缩进两格的 `key: value`，到下一个顶层键为止。 */
function fromMkdocs(text: string): DocVars {
  const out: DocVars = {};
  const lines = text.split(/\r?\n/);
  let inExtra = false;
  for (const line of lines) {
    if (/^extra:\s*$/.test(line)) {
      inExtra = true;
      continue;
    }
    if (inExtra && /^\S/.test(line)) break; // 回到顶层键，extra 块结束
    if (!inExtra) continue;
    const m = /^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    if (!key || raw === undefined) continue;
    // `!ENV [...]` 是构建期由环境变量决定的，本地没有确定值，不当常量
    if (raw.startsWith("!ENV")) continue;
    out[key] = unquote(raw);
  }
  return out;
}

/** Sphinx：`myst_substitutions = { "key": "value", ... }`，到闭合花括号为止。 */
function fromConfPy(text: string): DocVars {
  const out: DocVars = {};
  const start = text.indexOf("myst_substitutions");
  if (start < 0) return out;
  const open = text.indexOf("{", start);
  const close = text.indexOf("}", open);
  if (open < 0 || close < 0) return out;
  for (const line of text.slice(open + 1, close).split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = /^\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*:\s*(.+?),?\s*$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    if (!key || raw === undefined) continue;
    out[key] = unquote(raw);
  }
  return out;
}

export function parseDocVars(src: DocVarSources): DocVars {
  return {
    ...(src.confPy ? fromConfPy(src.confPy) : {}),
    ...(src.mkdocsYml ? fromMkdocs(src.mkdocsYml) : {}),
  };
}

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** 文本里用到的变量名，去重。 */
export function findPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1] as string))];
}

/**
 * 展开已知变量。未知的**原样留着**——猜或删都会掩盖问题，留着才能被
 * lint 的 `unexpanded-placeholder` 抓到。
 */
export function expandPlaceholders(text: string, vars: DocVars): string {
  return text.replace(PLACEHOLDER_RE, (whole, name: string) => vars[name] ?? whole);
}

/**
 * 只保留文档里真正用到的变量。
 *
 * `extra:` / `myst_substitutions` 里不全是替换变量——MkDocs Material 的
 * `generator: false` 是页脚开关，照单全收会把它当版本变量塞进 agent 的 prompt
 * （2026-09-11 dry-run 实见）。以「文档里出现过 `{{ 它 }}`」为准最可靠，
 * 而且顺带把 prompt 缩短到只剩有用的那几条。
 */
export function keepUsed(vars: DocVars, docTexts: string[]): DocVars {
  const used = new Set(docTexts.flatMap(findPlaceholders));
  return Object.fromEntries(Object.entries(vars).filter(([k]) => used.has(k)));
}
