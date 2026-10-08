import { lookup } from "node:dns/promises";
import { Agent as HttpAgent, request as httpRequest } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { type DefaultTreeAdapterMap, parse } from "parse5";

export const DROP_BYTES = 1024 * 1024;
type Node = DefaultTreeAdapterMap["node"];
const children = (n: Node): Node[] => ("childNodes" in n ? n.childNodes : []);
const tag = (n: Node) => ("tagName" in n ? n.tagName : "");
const attr = (n: Node, key: string) =>
  "attrs" in n ? n.attrs.find((a) => a.name === key)?.value : undefined;

/** Parse HTML structurally; never execute scripts or claim to have read linked assets. */
export function extractHtml(html: string, url: string) {
  const doc = parse(html);
  const all: Node[] = [];
  const visit = (n: Node) => {
    all.push(n);
    children(n).forEach(visit);
  };
  visit(doc);
  const main =
    all.find((n) => tag(n) === "main") ??
    all.find((n) => tag(n) === "article") ??
    all.find((n) => tag(n) === "body") ??
    doc;
  const omissions = ["仅提取静态 HTML；未执行脚本、未访问登录区域或链接附件"];
  const images = all.filter((n) => ["img", "video", "audio", "iframe", "object"].includes(tag(n))).length;
  if (images) omissions.push(`${images} 个图像/媒体/嵌入内容未解析`);
  const text = (n: Node): string => {
    if ("value" in n) return n.value;
    const t = tag(n);
    if (
      ["script", "style", "nav", "header", "footer", "noscript", "template", "form"].includes(t) ||
      attr(n, "hidden") !== undefined ||
      attr(n, "aria-hidden") === "true"
    )
      return "";
    const body = children(n).map(text).join("");
    if (/^h[1-6]$/.test(t)) return `\n${"#".repeat(Number(t[1]))} ${body.trim()}\n`;
    if (t === "a") {
      try {
        const href = new URL(attr(n, "href") ?? "", url);
        return /^https?:$/.test(href.protocol) ? `[${body.trim()}](${href.href})` : body;
      } catch {
        return body;
      }
    }
    if (t === "img") return `[图片未解析：${attr(n, "alt") ?? "无说明"}]`;
    if (t === "pre") return `\n\`\`\`\n${body.trim()}\n\`\`\`\n`;
    if (t === "br") return "\n";
    if (t === "li") return `\n- ${body.trim()}`;
    if (t === "td" || t === "th") return ` ${body.trim()} |`;
    if (t === "tr") return `\n|${body}\n`;
    if (["p", "div", "section", "table", "ul", "ol"].includes(t)) return `\n${body}\n`;
    return body;
  };
  const body = text(main)
    .replace(/\n[\t ]*\n(?:[\t ]*\n)+/g, "\n\n")
    .trim();
  if (body.length < 80) throw new Error("网页正文不足，可能是登录页或动态壳；请粘贴正文");
  return { text: body, omissions, parser: "parse5-static-v1" };
}

export function publicAddress(address: string): boolean {
  if (isIP(address) === 6)
    return (
      /^2[0-9a-f]{3}:/i.test(address) && !/^2001:(?:0:|db8:|[12]:)/i.test(address) && !/^2002:/i.test(address)
    );
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number) as [number, number];
  return !(
    [0, 10, 127].includes(a) ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0)
  );
}

export async function fetchDrop(url: string, signal?: AbortSignal, allowJson = false) {
  let current = new URL(url);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (
      !/^https?:$/.test(current.protocol) ||
      current.username ||
      current.password ||
      (current.port && !["80", "443"].includes(current.port))
    )
      throw new Error("只接受无凭据的公开 HTTP(S) 网页");
    const host = current.hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(host, { all: true });
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new Error("网页地址必须是公网地址，不能访问本机或内网");
    const chosen = addresses[0]!;
    const response = await new Promise<{ status: number; location?: string; type: string; body: Buffer }>(
      (resolve, reject) => {
        const agent =
          current.protocol === "https:"
            ? new HttpsAgent({ proxyEnv: process.env })
            : new HttpAgent({ proxyEnv: process.env });
        const req = (current.protocol === "https:" ? httpsRequest : httpRequest)(
          current,
          {
            signal,
            agent,
            hostname: chosen.address,
            servername: host,
            headers: {
              host: current.host,
              "user-agent": "LLM-Wiki-Drop/1",
              accept: allowJson ? "application/json" : "text/html,text/plain,text/markdown",
              "accept-encoding": "identity",
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            let size = 0;
            res.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > DROP_BYTES) req.destroy(new Error("网页超过 1 MiB，请缩小单份资料"));
              else chunks.push(chunk);
            });
            res.on("error", reject);
            res.on("end", () =>
              resolve({
                status: res.statusCode ?? 0,
                location: res.headers.location,
                type: res.headers["content-type"] ?? "",
                body: Buffer.concat(chunks),
              }),
            );
          },
        );
        const timer = setTimeout(() => req.destroy(new Error("网页抓取超时，请重试或粘贴正文")), 30_000);
        req.on("close", () => {
          clearTimeout(timer);
          agent.destroy();
        });
        req.on("error", reject);
        req.end();
      },
    );
    if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
      current = new URL(response.location, current);
      continue;
    }
    if (response.status !== 200) throw new Error(`网页 HTTP ${response.status}；请重试或粘贴正文`);
    if (
      !/^text\/(?:html|plain|markdown)/i.test(response.type) &&
      !(allowJson && /^application\/json/i.test(response.type))
    )
      throw new Error("网页不是支持的 HTML/文本格式");
    const original = new TextDecoder("utf-8", { fatal: true }).decode(response.body);
    const extracted = /text\/html/i.test(response.type)
      ? extractHtml(original, current.href)
      : { text: original, omissions: [], parser: "utf8-text-v1" };
    return { ...extracted, original, url: current.href };
  }
  throw new Error("网页重定向过多");
}
