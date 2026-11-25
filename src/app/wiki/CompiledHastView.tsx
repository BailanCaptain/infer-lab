import "../../design/tools.css";
import {
  type CSSProperties,
  createContext,
  createElement,
  Fragment,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { Link, useInRouterContext, useNavigate } from "react-router";
import { CalcBlock } from "../../content/wiki/CalcBlock";
import { parseCalcFence, textFenceAsCalc } from "../../content/wiki/calc";
import {
  findByAlias,
  resolvePageId,
  rewriteRelativeLink,
  routePathOf,
  sourceUrl,
} from "../../content/wiki/index";
import { pageDisplayTitle } from "../../content/wiki/param-display";
import {
  type CompiledNode,
  parseRepoRef,
  type RegistryEntry,
  rawSourceHref,
} from "../../content/wiki/schema";
import { EVIDENCE_LEVELS_INFO, EvidenceBadge } from "../../content/wiki/Term";
import { WikiDiagram } from "../../content/wiki/WikiDiagram";
import { parseVllmServeCommand } from "../../sim/doctor/cliParser";
import type { AscendFamily, RuleVersion } from "../../sim/rules";
import { buildHardwareDeployHrefFromCommand } from "../model/hardwareDeployOverlay";
import { appendFromPageToExperienceRoute } from "../model/qwen-frame";
import { copyTextToClipboard, workbenchHandoffStore } from "../tools/workbenchHandoff";
import { isSceneLessonId, sceneAnchorIds } from "./scene-lessons";
import { isPlainPrimaryLinkClick, scrollToWikiFragment, WikiContentLink } from "./WikiLink";
import { WikiScene } from "./WikiScene";
import { WikiToolBlock } from "./WikiToolBlock";

export const DiagramSnapshot = createContext(new Map<string, string>());
export const DiagramPageContext = createContext("");
export const DiagramEvidenceContext = createContext<
  ((diagramId: string, trigger: HTMLElement | null) => void) | undefined
>(undefined);

const EVIDENCE_LETTERS = new Set(EVIDENCE_LEVELS_INFO.map((e) => e.level as string));
const SAFE_PROTOCOL = /^(?:https?|ircs?|mailto|xmpp|tel)$/i;
const HAST_WHITESPACE_RE = /^[ \t\n\r\f]*$/;
const TABLE_WHITESPACE_TAGS = new Set(["table", "tbody", "thead", "tfoot", "tr"]);
const COMMA_SEPARATED_PROPS = new Set(["accept", "coords", "media", "sizes", "srcSet"]);
const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const URL_ATTRS = new Set([
  "href",
  "src",
  "action",
  "formAction",
  "cite",
  "poster",
  "longDesc",
  "ping",
  "useMap",
  "xlinkHref",
  "xLinkHref",
  "itemId",
]);

const HAST_TO_REACT_PROP: Readonly<Record<string, string>> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  viewbox: "viewBox",
  preserveaspectratio: "preserveAspectRatio",
  classId: "classID",
  dataType: "datatype",
  itemId: "itemID",
  strokeDashArray: "strokeDasharray",
  strokeDashOffset: "strokeDashoffset",
  strokeLineCap: "strokeLinecap",
  strokeLineJoin: "strokeLinejoin",
  strokeMiterLimit: "strokeMiterlimit",
  typeOf: "typeof",
  xLinkActuate: "xlinkActuate",
  xLinkArcRole: "xlinkArcrole",
  xLinkHref: "xlinkHref",
  xLinkRole: "xlinkRole",
  xLinkShow: "xlinkShow",
  xLinkTitle: "xlinkTitle",
  xLinkType: "xlinkType",
  xmlnsXLink: "xmlnsXlink",
};

/** 来源引用 → 可点的 URL（源码引用指向钉住 commit 的 GitHub 行号） */
export function hrefOfSource(ref: string): string | null {
  const rawHref = rawSourceHref(ref);
  if (rawHref) return rawHref;
  const parsed = parseRepoRef(ref);
  if (parsed) return sourceUrl(parsed);
  return ref.startsWith("http") ? ref : null;
}

/** 对齐 ReactMarkdown defaultUrlTransform（补充 tel:），拦截 javascript:/data:/vbscript: 等危险协议 */
export function sanitizeHastUrl(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strip ASCII control chars before scheme check
  const cleaned = value.replace(/[\u0000-\u001f\u007f\s]+/g, "");
  const colon = cleaned.indexOf(":");
  const questionMark = cleaned.indexOf("?");
  const numberSign = cleaned.indexOf("#");
  const slash = cleaned.indexOf("/");
  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    SAFE_PROTOCOL.test(cleaned.slice(0, colon))
  ) {
    return value;
  }
  return "";
}

/** 将 HAST 内联 CSS 字符串解析为 React style 对象（兼容 KaTeX 内联样式、自定义变量与厂商前缀） */
export function parseInlineStyle(cssText: string): CSSProperties {
  const out: Record<string, string> = {};
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  let start = 0;
  let quote: string | null = null;
  let parenDepth = 0;

  const pushDecl = (decl: string) => {
    const colon = decl.indexOf(":");
    if (colon <= 0) return;
    const rawName = decl.slice(0, colon).trim();
    const rawValue = decl.slice(colon + 1).trim();
    if (!rawName || !rawValue) return;
    if (rawName.startsWith("--")) {
      out[rawName] = rawValue;
      return;
    }
    const lower = rawName.toLowerCase();
    const normalized = lower.startsWith("-ms-") ? lower.slice(1) : lower;
    const camel = normalized.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
    out[camel] = rawValue;
  };

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]!;
    if (quote) {
      if (ch === "\\" && i + 1 < stripped.length) i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") parenDepth++;
    else if (ch === ")" && parenDepth > 0) parenDepth--;
    else if (ch === ";" && parenDepth === 0) {
      pushDecl(stripped.slice(start, i));
      start = i + 1;
    }
  }
  if (start < stripped.length) pushDecl(stripped.slice(start));
  return out as CSSProperties;
}

function mapHastPropName(prop: string): string {
  const mapped = HAST_TO_REACT_PROP[prop];
  if (mapped) return mapped;
  if (/^aria[A-Z]/.test(prop)) return `aria-${prop.slice(4).toLowerCase()}`;
  if (/^data[A-Z]/.test(prop)) return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  return prop;
}

export function hastPropsToReactProps(
  tagName: string,
  properties: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  if (!properties) return {};
  const props: Record<string, unknown> = {};
  let alignValue: string | undefined;

  for (const [rawKey, rawValue] of Object.entries(properties)) {
    if (rawKey === "children" || rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === "number" && Number.isNaN(rawValue)) continue;

    let value: unknown = rawValue;
    if (Array.isArray(value)) {
      value = COMMA_SEPARATED_PROPS.has(rawKey) ? value.join(", ") : value.join(" ");
    }

    if (URL_ATTRS.has(rawKey) || (tagName === "object" && rawKey === "data")) {
      value = sanitizeHastUrl(String(value || ""));
    } else if (rawKey === "srcSet" && typeof value === "string") {
      value = value
        .split(",")
        .map((part) => {
          const trimmed = part.trim();
          if (!trimmed) return "";
          const sp = trimmed.search(/\s/);
          const url = sp < 0 ? trimmed : trimmed.slice(0, sp);
          const desc = sp < 0 ? "" : trimmed.slice(sp);
          const safe = sanitizeHastUrl(url);
          return safe ? `${safe}${desc}` : "";
        })
        .filter(Boolean)
        .join(", ");
    }

    if (rawKey === "style") {
      if (typeof value === "string") {
        props.style = parseInlineStyle(value);
      } else if (typeof value === "object") {
        props.style = { ...(value as Record<string, unknown>) };
      }
      continue;
    }

    const reactKey = mapHastPropName(rawKey);
    if ((tagName === "td" || tagName === "th") && reactKey === "align" && typeof value === "string") {
      alignValue = value;
    } else {
      props[reactKey] = value;
    }
  }

  if (alignValue) {
    const style = (props.style as Record<string, unknown> | undefined) ?? {};
    props.style = { ...style, textAlign: alignValue };
  }
  return props;
}

function hastTextOf(node: CompiledNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(hastTextOf).join("");
}

function plainFenceCode(pre: CompiledNode | undefined): CompiledNode | null {
  const code = pre?.children?.[0];
  if (code?.type !== "element" || code.tagName !== "code") return null;
  const cls = code.properties?.className;
  return Array.isArray(cls) && !cls.includes("language-text") ? null : code;
}

function fenceSource(node: unknown, language: string): string | null {
  const code = (node as CompiledNode | undefined)?.children?.[0];
  if (code?.type !== "element" || code.tagName !== "code") return null;
  const cls = code.properties?.className;
  if (!Array.isArray(cls) || !cls.includes(`language-${language}`)) return null;
  const text = code.children?.[0];
  return text?.type === "text" && text.value ? text.value.trim() : null;
}

function hasFenceLanguage(node: unknown, language: string): boolean {
  const code = (node as CompiledNode | undefined)?.children?.[0];
  if (code?.type !== "element" || code.tagName !== "code") return false;
  const cls = code.properties?.className;
  return Array.isArray(cls) && cls.includes(`language-${language}`);
}

function plainFenceSource(node: unknown): string | null {
  const code = plainFenceCode(node as CompiledNode | undefined);
  const text = code ? hastTextOf(code) : "";
  return text ? text.replace(/\n$/, "") : null;
}

function diagramId(node: unknown): string | null {
  const body = fenceSource(node, "wiki-diagram");
  if (!body) return null;
  const file = /^\s*file:\s*(\S+)\s*$/m.exec(body)?.[1];
  return file ? file.replace(/\.(ya?ml|svg)$/, "") : null;
}

const SHELL_FENCE_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console", "text"]);
const ENV_TOKEN_RE = /^[A-Za-z_][A-Za-z0-9_]*=.*$/;
const PLACEHOLDER_ANGLE_TOKEN_RE = /<(?:[A-Za-z_][A-Za-z0-9_.:/-]*|)>/;
const SHELL_VAR_EXPANSION_RE = /\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[^}]*\}|\(|\d|[?#@*!-])/;

interface LogicalShellStatement {
  rawChunk: string;
  logicalLine: string;
}

/**
 * 严格单命令 Shell 分句器：
 * - 遇到未加引号的 `|`、`||`、`&`、`&&`、`;`、`<`、`>`、反引号 `` ` ``、未闭合引号，或 `\` 续行符后残留空白字符（`\\[ \t]+\n`）时，直接返回 `null` 拒绝提取。
 */
function splitStrictShellLogicalStatements(raw: string): LogicalShellStatement[] | null {
  const text = raw.replace(/\r\n/g, "\n");
  const out: LogicalShellStatement[] = [];
  let curRaw = "";
  let curLogical = "";
  let quote: "'" | '"' | null = null;
  let i = 0;

  const flush = () => {
    const logical = curLogical.trim();
    if (logical.length > 0) {
      out.push({ rawChunk: curRaw.trim(), logicalLine: logical });
    }
    curRaw = "";
    curLogical = "";
  };

  while (i < text.length) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";

    if (quote === "'") {
      curRaw += ch;
      curLogical += ch;
      if (ch === "'") quote = null;
      i += 1;
      continue;
    }
    if (quote === '"') {
      if (ch === "`") return null;
      if (ch === "\\" && i + 1 < text.length) {
        curRaw += ch + next;
        curLogical += ch + next;
        i += 2;
        continue;
      }
      curRaw += ch;
      curLogical += ch;
      if (ch === '"') quote = null;
      i += 1;
      continue;
    }

    if (ch === "\\") {
      const tail = text.slice(i);
      if (/^\\[ \t]+\n/.test(tail) || /^\\[ \t]*$/.test(tail)) {
        return null;
      }
      if (next === "\n") {
        curRaw += "\\\n";
        curLogical += " ";
        i += 2;
        continue;
      }
      if (i + 1 < text.length) {
        curRaw += ch + next;
        curLogical += ch + next;
        i += 2;
        continue;
      }
      return null;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      curRaw += ch;
      curLogical += ch;
      i += 1;
      continue;
    }

    if (ch === "#" && (curLogical.length === 0 || /\s/.test(curLogical[curLogical.length - 1] ?? ""))) {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }

    if (ch === "|" || ch === "&" || ch === ";" || ch === "`" || ch === "<" || ch === ">") {
      return null;
    }

    if (ch === "\n") {
      flush();
      i += 1;
      continue;
    }

    curRaw += ch;
    curLogical += ch;
    i += 1;
  }

  if (quote !== null) return null;
  flush();
  return out;
}

function simpleShellWords(line: string): string[] {
  const words: string[] = [];
  let cur = "";
  let has = false;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? "";
    const next = line[i + 1] ?? "";
    if (quote === "'") {
      if (ch === "'") quote = null;
      else cur += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === "\\" && i + 1 < line.length) {
        cur += next;
        i += 1;
      } else cur += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (has) {
        words.push(cur);
        cur = "";
        has = false;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
      continue;
    }
    if (ch === "\\" && i + 1 < line.length) {
      cur += next;
      has = true;
      i += 1;
      continue;
    }
    cur += ch;
    has = true;
  }
  if (has) words.push(cur);
  return words;
}

/**
 * 活代码块单命令门禁：仅当围栏内仅由可选前置环境变量赋值（`export KEY=VAL` / `KEY=VAL`）与**唯一一条**具体可解析的 `vllm serve` 命令组成
 * （无 `cd`/`echo` 等其他命令，无 `|`/`&`/`;`/`&&`/`||`，无 `\` 后尾随空白，无 `<model>` 或 `$VAR`/`${VAR}` 变量展开）时，
 * 返回保留了前置环境变量与 `\` 续行符的启动命令字符串；否则返回 `null`（仅渲染「复制」）。
 */
export function extractSingleVllmServeFenceCommand(
  rawFenceText: string,
  fenceLanguage?: string | null,
): string | null {
  if (!rawFenceText || !rawFenceText.includes("vllm")) return null;
  if (fenceLanguage && !SHELL_FENCE_LANGUAGES.has(fenceLanguage.toLowerCase())) {
    return null;
  }

  const statements = splitStrictShellLogicalStatements(rawFenceText);
  if (!statements || statements.length === 0) return null;

  const classified = statements.map((stmt) => {
    const cleanedRaw = stmt.rawChunk.replace(/^\$\s+/, "");
    const cleanedLogical = stmt.logicalLine.replace(/^\$\s+/, "");
    if (
      SHELL_VAR_EXPANSION_RE.test(cleanedLogical) ||
      SHELL_VAR_EXPANSION_RE.test(cleanedRaw) ||
      PLACEHOLDER_ANGLE_TOKEN_RE.test(cleanedLogical)
    ) {
      return { kind: "other" as const, cleanedRaw, cleanedLogical };
    }
    const words = simpleShellWords(cleanedLogical);
    if (words.length === 0 || words.some((w) => SHELL_VAR_EXPANSION_RE.test(w))) {
      return { kind: "other" as const, cleanedRaw, cleanedLogical };
    }

    if (words[0] === "export" && words.length >= 2 && words.slice(1).every((w) => ENV_TOKEN_RE.test(w))) {
      return { kind: "env" as const, cleanedRaw, cleanedLogical };
    }
    let idx = 0;
    while (idx < words.length) {
      const w = words[idx] ?? "";
      if (ENV_TOKEN_RE.test(w) || w === "env") {
        idx += 1;
        continue;
      }
      break;
    }
    if (idx === words.length && words.every((w) => ENV_TOKEN_RE.test(w))) {
      return { kind: "env" as const, cleanedRaw, cleanedLogical };
    }
    const head = words[idx] ?? "";
    const second = words[idx + 1] ?? "";
    if (head === "vllm" && second === "serve") {
      return { kind: "vllm-serve" as const, cleanedRaw, cleanedLogical };
    }
    return { kind: "other" as const, cleanedRaw, cleanedLogical };
  });

  if (classified.some((item) => item.kind === "other")) return null;

  const vllmServeIndices: number[] = [];
  for (let i = 0; i < classified.length; i += 1) {
    if (classified[i]!.kind === "vllm-serve") vllmServeIndices.push(i);
  }

  if (vllmServeIndices.length !== 1) return null;
  const targetIdx = vllmServeIndices[0]!;
  if (targetIdx !== classified.length - 1) return null;
  const targetStmt = classified[targetIdx]!;

  const envPrefixLines = classified.slice(0, targetIdx).map((s) => s.cleanedRaw);
  const handoffCommand = [...envPrefixLines, targetStmt.cleanedRaw].join("\n").trim();

  const parsed = parseVllmServeCommand(handoffCommand);
  if (parsed.parseDiagnostics.some((d) => d.severity === "error")) return null;
  const model = parsed.model?.trim() ?? "";
  if (
    !model ||
    model.includes("$") ||
    model.includes("<") ||
    model.includes(">") ||
    model.includes("...") ||
    model.includes("…")
  ) {
    return null;
  }
  return handoffCommand;
}

function inferFenceHardwareFamily(commandText: string): AscendFamily {
  if (/310p|enable_npugraph_ex["']?\s*:\s*false/i.test(commandText)) return "310P";
  if (/950dt|\ba5\b|mxfp8/i.test(commandText)) return "A5";
  if (/\ba3\b|800i-a3|davinci15/i.test(commandText)) return "A3";
  return "A2";
}

function buildDoctorTargetQuery(pageId: string): string {
  const params = new URLSearchParams();
  params.set("tab", "doctor");
  if (pageId && /^[a-z0-9][a-z0-9-_]{0,127}$/i.test(pageId)) {
    params.set("fromPage", pageId);
  }
  return params.toString();
}

export function inferFenceRuleVersion(
  commandText: string,
  pageId: string,
): Extract<RuleVersion, "v0.30.0" | "main"> {
  const page = pageId ? findByAlias(resolvePageId(pageId) ?? pageId) : undefined;
  if (page && page.verified.includes("main") && !page.verified.includes("releases/v0.30.0")) {
    return "main";
  }
  const parsed = parseVllmServeCommand(commandText);
  if (
    (parsed.couplingInput.mainOnlyAdditionalConfigKeys?.length ?? 0) > 0 ||
    parsed.couplingInput.enableFusedMc2 === 3
  ) {
    return "main";
  }
  return "v0.30.0";
}

function sendFenceCommandToDoctor(commandText: string, pageId: string): void {
  workbenchHandoffStore.sendToDoctor({
    commandText,
    hardwareFamily: inferFenceHardwareFamily(commandText),
    version: inferFenceRuleVersion(commandText, pageId),
    sourceLabel: pageId ? `知识页 · ${pageId}` : "知识页代码块",
  });
}

function WikiFenceDoctorRouterButton({ commandText, pageId }: { commandText: string; pageId: string }) {
  const navigate = useNavigate();
  const query = buildDoctorTargetQuery(pageId);
  return (
    <button
      type="button"
      className="wt-code-fence-btn is-doctor"
      data-testid="wiki-code-doctor-btn"
      onClick={() => {
        sendFenceCommandToDoctor(commandText, pageId);
        navigate(`/tools?${query}`);
      }}
    >
      送去体检 →
    </button>
  );
}

function WikiFenceDoctorFallbackButton({ commandText, pageId }: { commandText: string; pageId: string }) {
  const query = buildDoctorTargetQuery(pageId);
  return (
    <button
      type="button"
      className="wt-code-fence-btn is-doctor"
      data-testid="wiki-code-doctor-btn"
      onClick={() => {
        sendFenceCommandToDoctor(commandText, pageId);
        if (typeof window !== "undefined") {
          window.location.hash = `#/tools?${query}`;
        }
      }}
    >
      送去体检 →
    </button>
  );
}

function WikiFallbackCodeFence({
  children,
  node,
  pageId,
}: {
  children?: ReactNode;
  node?: unknown;
  pageId: string;
}) {
  const [copied, setCopied] = useState(false);
  const inRouter = useInRouterContext();
  const preNode = node as CompiledNode | undefined;
  const codeNode = preNode?.children?.find(
    (child): child is CompiledNode => child.type === "element" && child.tagName === "code",
  );
  const rawText = (codeNode ? hastTextOf(codeNode) : hastTextOf(preNode)).replace(/\n$/, "");
  const rawClasses = Array.isArray(codeNode?.properties?.className) ? codeNode.properties.className : [];
  const langCls = rawClasses.find((c): c is string => typeof c === "string" && c.startsWith("language-"));
  const fenceLang = langCls ? langCls.slice("language-".length).toLowerCase() : null;
  const doctorCommand = rawText ? extractSingleVllmServeFenceCommand(rawText, fenceLang) : null;
  const preserveParams =
    pageId && /^[a-z0-9][a-z0-9-_]{0,127}$/i.test(pageId)
      ? new URLSearchParams({ fromPage: pageId })
      : undefined;
  const hardwareHref = doctorCommand
    ? buildHardwareDeployHrefFromCommand(doctorCommand, {
        hardwareFamily: inferFenceHardwareFamily(doctorCommand),
        version: inferFenceRuleVersion(doctorCommand, pageId),
        ...(preserveParams ? { preserveParams } : {}),
      })
    : null;

  const handleCopy = () => {
    void copyTextToClipboard(rawText).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    });
  };

  return (
    <div className="wt-wiki-codeblock" data-testid="wiki-code-fence">
      {rawText.length > 0 && (
        <div className="wt-code-fence-toolbar" data-testid="wiki-code-fence-toolbar">
          {hardwareHref !== null &&
            (inRouter ? (
              <Link
                className="wt-code-fence-btn"
                data-testid="wiki-code-3d-btn"
                to={hardwareHref.startsWith("#") ? hardwareHref.slice(1) : hardwareHref}
              >
                看 3D 切分 →
              </Link>
            ) : (
              <a className="wt-code-fence-btn" data-testid="wiki-code-3d-btn" href={hardwareHref}>
                看 3D 切分 →
              </a>
            ))}
          {doctorCommand !== null &&
            (inRouter ? (
              <WikiFenceDoctorRouterButton commandText={doctorCommand} pageId={pageId} />
            ) : (
              <WikiFenceDoctorFallbackButton commandText={doctorCommand} pageId={pageId} />
            ))}
          <button
            type="button"
            className={`wt-code-fence-btn${copied ? " is-copied" : ""}`}
            data-testid="wiki-code-copy-btn"
            onClick={handleCopy}
          >
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      )}
      <pre>{children}</pre>
    </div>
  );
}

// A stable fence type preserves live scene playback when article data or its hash changes.
export function WikiFence({ children, node }: { children?: ReactNode; node?: unknown }) {
  const diagrams = useContext(DiagramSnapshot);
  const pageId = useContext(DiagramPageContext);
  const onOpenDiagram = useContext(DiagramEvidenceContext);
  const scene = fenceSource(node, "wiki-scene");
  if (scene) {
    const [id, part] = scene.split(":");
    const section = part === undefined ? undefined : Number(part);
    if (id && isSceneLessonId(id) && sceneAnchorIds(scene).length > 0)
      return <WikiScene key={scene} id={id} section={section} />;
  }
  const diagram = diagramId(node);
  if (diagram)
    return (
      <WikiDiagram
        key={`${pageId}:${diagram}`}
        id={diagram}
        svg={diagrams.get(diagram)}
        allowInteractive
        onOpenEvidence={onOpenDiagram}
      />
    );
  if (hasFenceLanguage(node, "wiki-tool")) {
    return <WikiToolBlock source={fenceSource(node, "wiki-tool") ?? ""} />;
  }
  const source = fenceSource(node, "calc");
  if (source) {
    const { title, rows } = parseCalcFence(source);
    return <CalcBlock rows={rows} title={title} />;
  }
  const plain = plainFenceSource(node);
  const rows = plain ? textFenceAsCalc(plain) : null;
  return rows ? (
    <CalcBlock rows={rows} />
  ) : (
    <WikiFallbackCodeFence node={node} pageId={pageId}>
      {children}
    </WikiFallbackCodeFence>
  );
}

function renderWikiAbbr(
  node: CompiledNode | undefined,
  restProps: Record<string, unknown>,
  children: ReactNode,
  sources: readonly string[],
  onOpenSource: ((sourceIndex: number, trigger: HTMLElement | null) => void) | undefined,
  key?: string,
): ReactNode {
  const level = String(children);
  if (!EVIDENCE_LETTERS.has(level)) {
    return createElement("abbr", key !== undefined ? { ...restProps, key } : restProps, children);
  }
  const idx = Number(node?.properties?.["data-source"] ?? 0);
  const src = idx >= 1 && idx <= sources.length ? sources[idx - 1] : undefined;
  if (!src) return <EvidenceBadge key={key} level={level} />;
  const href = hrefOfSource(src);
  return href ? (
    <a
      key={key}
      className="wiki-mark-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`来源 ${idx}`}
      data-source={idx}
      onClick={(event) => {
        if (!onOpenSource || !isPlainPrimaryLinkClick(event)) return;
        event.preventDefault();
        onOpenSource(idx - 1, event.currentTarget);
      }}
    >
      <EvidenceBadge level={level} />
    </a>
  ) : (
    <button
      key={key}
      type="button"
      className="wiki-mark-btn"
      title={`来源 ${idx}`}
      data-source={idx}
      onClick={(event) => onOpenSource?.(idx - 1, event.currentTarget)}
    >
      <EvidenceBadge level={level} />
    </button>
  );
}

interface SafeAnchorPassthroughProps {
  id?: string | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "data-footnote-ref"?: string | undefined;
  "data-footnote-backref"?: string | undefined;
}

function extractSafeAnchorProps(props: Record<string, unknown>): {
  href: string | undefined;
  title: string | undefined;
  extra: SafeAnchorPassthroughProps | null;
} {
  const href = typeof props.href === "string" ? props.href : undefined;
  const title = typeof props.title === "string" ? props.title : undefined;
  const extra: SafeAnchorPassthroughProps = {};
  let hasExtra = false;

  if (typeof props.id === "string" && props.id.length > 0) {
    extra.id = props.id;
    hasExtra = true;
  }
  if (typeof props.className === "string" && props.className.length > 0) {
    extra.className = props.className;
    hasExtra = true;
  }
  if (typeof props["aria-label"] === "string" && props["aria-label"].length > 0) {
    extra["aria-label"] = props["aria-label"];
    hasExtra = true;
  }
  if (typeof props["aria-describedby"] === "string" && props["aria-describedby"].length > 0) {
    extra["aria-describedby"] = props["aria-describedby"];
    hasExtra = true;
  }
  const fnRef = props["data-footnote-ref"];
  if (fnRef === true || typeof fnRef === "string") {
    extra["data-footnote-ref"] = fnRef === true ? "" : fnRef;
    hasExtra = true;
  }
  const fnBackref = props["data-footnote-backref"];
  if (fnBackref === true || typeof fnBackref === "string") {
    extra["data-footnote-backref"] = fnBackref === true ? "" : fnBackref;
    hasExtra = true;
  }
  return { href, title, extra: hasExtra ? extra : null };
}

function WikiPassthroughLink({
  href,
  currentId,
  title,
  extra,
  children,
}: {
  href?: string | undefined;
  currentId?: string | undefined;
  title?: string | undefined;
  extra: SafeAnchorPassthroughProps;
  children?: ReactNode;
}) {
  const inRouter = useInRouterContext();
  const to = rewriteRelativeLink(href ?? "", currentId);
  const route = routePathOf(to);
  const effectiveRoute = route ? appendFromPageToExperienceRoute(route, currentId) : null;
  const routePageRawId = route?.startsWith("/wiki/")
    ? route.slice("/wiki/".length).split(/[?#]/)[0]
    : undefined;
  const resolvedTarget = routePageRawId
    ? findByAlias(resolvePageId(routePageRawId) ?? routePageRawId)
    : undefined;
  const effectiveTitle = title ?? (resolvedTarget ? pageDisplayTitle(resolvedTarget) : undefined);
  const fragmentIndex = to.startsWith("#/") ? to.indexOf("#", 1) : -1;
  const targetFragment = fragmentIndex > 0 ? to.slice(fragmentIndex) : "";
  if (effectiveRoute && inRouter) {
    return (
      <Link
        to={effectiveRoute}
        title={effectiveTitle}
        {...extra}
        onClick={(event) => {
          if (!isPlainPrimaryLinkClick(event)) return;
          if (!targetFragment) {
            requestAnimationFrame(() => {
              document.getElementById("main-content")?.scrollTo?.({ top: 0 });
              window.scrollTo?.({ top: 0 });
            });
            return;
          }
          requestAnimationFrame(() => {
            scrollToWikiFragment(targetFragment);
          });
        }}
      >
        {children}
      </Link>
    );
  }
  const external = /^https?:/i.test(to) || to.startsWith("./wiki-raw/");
  return (
    <a
      href={to}
      title={effectiveTitle}
      {...extra}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function renderWikiAnchor(
  props: Record<string, unknown>,
  currentId: string,
  children: ReactNode,
  key?: string,
): ReactNode {
  const { href, title, extra } = extractSafeAnchorProps(props);
  if (!extra) {
    return (
      <WikiContentLink key={key} href={href} currentId={currentId} title={title}>
        {children}
      </WikiContentLink>
    );
  }
  return (
    <WikiPassthroughLink key={key} href={href} currentId={currentId} title={title} extra={extra}>
      {children}
    </WikiPassthroughLink>
  );
}

/** 供动态未编译 Markdown 回退分支复用同一套组件映射规则，保持单一真相源。 */
export function createWikiMarkdownComponents(
  page: Pick<RegistryEntry, "id" | "sources">,
  onOpenSource?: ((sourceIndex: number, trigger: HTMLElement | null) => void) | undefined,
): Record<string, unknown> {
  return {
    pre: WikiFence,
    table: ({ children }: { children?: ReactNode }) => (
      <div className="wiki-table-scroll">
        <table>{children}</table>
      </div>
    ),
    abbr: ({
      children,
      node,
      ...rest
    }: {
      children?: ReactNode;
      node?: CompiledNode;
      [k: string]: unknown;
    }) => renderWikiAbbr(node, rest, children, page.sources, onOpenSource),
    a: ({
      node: _node,
      children,
      ...props
    }: {
      node?: unknown;
      children?: ReactNode;
      [k: string]: unknown;
    }) => renderWikiAnchor(props, page.id, children),
    img: ({ node: _node, alt = "", ...props }: { node?: unknown; alt?: string; [k: string]: unknown }) => (
      <img alt={alt} decoding="async" {...props} />
    ),
  };
}

function collapseChildren(children: ReactNode[]): ReactNode {
  if (children.length === 0) return undefined;
  if (children.length === 1) return children[0] || undefined;
  return children;
}

export interface CompiledHastViewProps {
  root: CompiledNode;
  page: Pick<RegistryEntry, "id" | "sources">;
  onOpenSource?: ((sourceIndex: number, trigger: HTMLElement | null) => void) | undefined;
}

/**
 * 零克隆、零 unified/ReactMarkdown 运行时依赖的只读 HAST 直接渲染器。
 */
export function CompiledHastView({ root, page, onOpenSource }: CompiledHastViewProps) {
  const renderChildren = (parent: CompiledNode, filterTableWs: boolean): ReactNode[] => {
    const out: ReactNode[] = [];
    const countsByTag = new Map<string, number>();
    for (const child of parent.children ?? []) {
      let key: string | undefined;
      if (child.type === "element" && child.tagName) {
        const count = countsByTag.get(child.tagName) ?? 0;
        key = `${child.tagName}-${count}`;
        countsByTag.set(child.tagName, count + 1);
      }
      const rendered = renderNode(child, key);
      if (rendered === undefined) continue;
      if (filterTableWs && typeof rendered === "string" && HAST_WHITESPACE_RE.test(rendered)) {
        continue;
      }
      out.push(rendered);
    }
    return out;
  };

  const renderNode = (node: CompiledNode, key?: string): ReactNode => {
    if (node.type === "text" || node.type === "raw") {
      return node.value;
    }
    if (node.type === "root") {
      const childProp = collapseChildren(renderChildren(node, false));
      return createElement(Fragment, key !== undefined ? { key } : null, childProp);
    }
    if (node.type !== "element" || !node.tagName) {
      return undefined;
    }

    const tag = node.tagName;
    const props = hastPropsToReactProps(tag, node.properties);
    const childProp = collapseChildren(renderChildren(node, TABLE_WHITESPACE_TAGS.has(tag)));

    if (tag === "pre") {
      return (
        <WikiFence key={key} node={node}>
          {childProp}
        </WikiFence>
      );
    }
    if (tag === "table") {
      return (
        <div key={key} className="wiki-table-scroll">
          {createElement("table", props, childProp)}
        </div>
      );
    }
    if (tag === "abbr") {
      return renderWikiAbbr(node, props, childProp, page.sources, onOpenSource, key);
    }
    if (tag === "a") {
      return renderWikiAnchor(props, page.id, childProp, key);
    }
    if (tag === "img") {
      const { alt, src, ...restImgProps } = props;
      const safeSrc = typeof src === "string" && src.length > 0 ? src : undefined;
      return (
        <img
          key={key}
          alt={typeof alt === "string" ? alt : ""}
          decoding="async"
          {...(safeSrc !== undefined ? { src: safeSrc } : {})}
          {...restImgProps}
        />
      );
    }

    if (key !== undefined) props.key = key;
    if (!VOID_HTML_TAGS.has(tag) && childProp !== undefined) {
      props.children = childProp;
    }
    return createElement(tag, props);
  };

  return <>{renderNode(root)}</>;
}
