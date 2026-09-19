import { parsePage } from "../scripts/wiki/pages";
import { EVIDENCE_MARK_RE } from "../src/content/wiki/evidenceMarks";
import {
  type CitationVerdict,
  citationCheck,
  citationProse,
  citedPageLinks,
  matchesCitedPage,
} from "../src/content/wiki/retrieve";

/** Copyable forms derived from the same snapshot and validator used after answering. */
export function answerCitationGuide(pages: { file: string; text: string }[]) {
  return pages.flatMap((source) => {
    const { page, problems } = parsePage(source.file, source.text);
    if (!page || problems.length) return [];
    const pageLink = `[${page.fm.id}](${source.file})`;
    const sourceLinks = [
      ...new Set(
        [...citationProse(page.body).matchAll(new RegExp(EVIDENCE_MARK_RE.source, "g"))]
          .filter((match) => "SCM".includes(match[1]!))
          .map((match) => `${match[0]}(${source.file})`),
      ),
    ].filter((link) => checkAnswerCitations(link, [source]).cited);
    return [{ pageLink, sourceLinks }];
  });
}

/** Syntax and snapshot ownership only; never certifies a claim's meaning or that the agent read it. */
export function checkAnswerCitations(
  answer: string,
  pages: { file: string; text: string }[],
): CitationVerdict {
  const fail = (reason: string): CitationVerdict => ({ cited: false, selfDeclaredUncovered: false, reason });
  const resolvePage = (href: string) => pages.find((page) => matchesCitedPage(href, page.file));
  for (const href of citedPageLinks(answer)) {
    if (!resolvePage(href)) return fail(`引用页面不在当前知识版本中：${href}`);
  }
  // Keep code examples out of the evidence contract, as citedPageLinks does.
  const prose = citationProse(answer);
  for (const mark of prose.matchAll(new RegExp(EVIDENCE_MARK_RE.source, "g"))) {
    const [label, level, index] = mark;
    if (!"SCM".includes(level!)) {
      if (index) return fail(`${label} 不能带来源编号；推导与推断不能冒充一手证据。`);
      continue;
    }
    const href = /^\(([^\s)]+)\)/.exec(prose.slice(mark.index! + label.length))?.[1];
    const source = href ? resolvePage(href) : undefined;
    if (!index || !source) return fail(`${label} 未明确绑定所属页；请将带编号的标记直接链接到知识库页面。`);
    const parsed = parsePage(source.file, source.text);
    const page = parsed.page;
    if (!page || parsed.problems.length) return fail(`引用页面无法解析：${source.file}`);
    const ordinal = Number(index);
    if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > page.fm.sources.length)
      return fail(`${source.file} 没有第 ${index} 条来源。`);
    const body = citationProse(page.body);
    if (![...body.matchAll(new RegExp(EVIDENCE_MARK_RE.source, "g"))].some((m) => m[0] === label))
      return fail(`${source.file} 没有该证据标记 ${label}；请沿用原页等级与编号。`);
  }
  return citationCheck(answer);
}
