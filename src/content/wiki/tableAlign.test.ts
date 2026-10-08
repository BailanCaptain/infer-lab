import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { isNumericCell, rehypeNumericColumns } from "./tableAlign";

const render = (md: string) =>
  renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeNumericColumns] }, md),
  );

describe("表格：数字列", () => {
  it("数值、算式、带单位的都算；以中文收尾的不算", () => {
    for (const t of ["151.25 MiB", "× 34 层 = 1,176.7 MiB", "19360 × 4096 × 2 B", "0.85", "88%"]) {
      expect(isNumericCell(t), t).toBe(true);
    }
    for (const t of ["0 部署", "4…128 共 7 个", "开", "`ascend`", "1,577 块 ≈ 101 万 token"]) {
      expect(isNumericCell(t), t).toBe(false);
    }
  });

  it("整列都是数字才标 is-num，表头跟着标；空格不算反例", () => {
    const html = render(
      "| 部件 | 每卡每层 | 合计 |\n| --- | --- | --- |\n" +
        "| 嵌入表 | 19360 × 4096 × 2 B | 151.25 MiB |\n" +
        "| KDA 层 | 34.61 MiB | × 34 层 = 1,176.7 MiB |\n" +
        "| 小计 | | **20,537 MiB** |\n",
    );
    expect(html).toContain('<th class="is-num">每卡每层</th>');
    expect(html).toContain('<td class="is-num"><strong>20,537 MiB</strong></td>');
    expect(html).toContain("<td>嵌入表</td>");
  });

  it("混着文字的列、作者写了对齐的列都不动", () => {
    const html = render(
      "| 站 | 取值 | 值 |\n| --- | --- | ---: |\n| 0 部署 | 8 | 1 |\n| 1 入口 | 开 | 2 |\n",
    );
    expect(html).not.toContain("is-num");
  });
});
