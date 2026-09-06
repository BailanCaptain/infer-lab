/**
 * 离线生成教学预设句子的 token id（HANDOFF 第五节第 6 步）。
 *
 * 本机没有 Python transformers，因此用 Node 直接读 Qwen3 官方 tokenizer.json，
 * 按 HF tokenizers 的 byte-level BPE 流程（NFC → 正则预切分 → 字节映射 → 按 rank 合并 → 查表）分词。
 * 分词结果作为 [S] 数据写入 src/sim/model/presets.tokens.json；tokenizer.json 本身不入库。
 *
 * 用法：pnpm gen:presets            只打印分词结果
 *       pnpm gen:presets --write    同时写入 presets.tokens.json
 * tokenizer.json 缺失时自动从固定 revision 下载到 tools/tokenizer/，并校验 SHA-256。
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Qwen3 系列共用同一份 tokenizer.json（0.6B / 8B / 30B-A3B 三个仓库的 LFS SHA-256 相同，2026-09-06 核验）。 */
export const TOKENIZER_SOURCE = {
  repo: "Qwen/Qwen3-0.6B",
  file: "tokenizer.json",
  revision: "c1899de289a04d12100db370d81485cdf75e47ca",
  sha256: "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4",
  url: "https://huggingface.co/Qwen/Qwen3-0.6B/resolve/c1899de289a04d12100db370d81485cdf75e47ca/tokenizer.json",
  verifiedOn: "2026-09-06",
} as const;

const LOCAL_PATH = join(process.cwd(), "tools/tokenizer/qwen3-tokenizer.json");
const OUT_PATH = join(process.cwd(), "src/sim/model/presets.tokens.json");

/** 教学预设句（纯文本，不套 chat 模板；S 控制在 6–8 个 token）。 */
const SENTENCES: { id: string; text: string; note: string }[] = [
  { id: "kv-cache", text: "大模型推理需要显存", note: "默认预设：03 章主线，直接引出 KV Cache 与显存" },
  {
    id: "ascend",
    text: "昇腾芯片正在计算注意力",
    note: "点名硬件层；「昇」「腾」被拆成两个单字 token，可讲罕见词切分",
  },
  { id: "hello", text: "你好，世界！今天天气怎么样", note: "日常句，含中文标点与多字词 token" },
];

// ---------- tokenizer.json 类型 ----------
interface TokenizerJson {
  normalizer: { type: string } | null;
  pre_tokenizer: { type: string; pretokenizers?: { type: string; pattern?: { Regex: string } }[] };
  model: { type: string; vocab: Record<string, number>; merges: ([string, string] | string)[] };
  added_tokens: { id: number; content: string; special: boolean }[];
}

// ---------- 下载与校验 ----------
function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function loadTokenizer(): Promise<TokenizerJson> {
  if (!existsSync(LOCAL_PATH)) {
    console.log(`下载 ${TOKENIZER_SOURCE.url} → ${LOCAL_PATH}`);
    const res = await fetch(TOKENIZER_SOURCE.url);
    if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
    mkdirSync(join(process.cwd(), "tools/tokenizer"), { recursive: true });
    writeFileSync(LOCAL_PATH, Buffer.from(await res.arrayBuffer()));
  }
  const buf = readFileSync(LOCAL_PATH);
  const digest = sha256(buf);
  if (digest !== TOKENIZER_SOURCE.sha256) {
    throw new Error(`tokenizer.json SHA-256 不匹配：期望 ${TOKENIZER_SOURCE.sha256}，实际 ${digest}`);
  }
  return JSON.parse(buf.toString("utf8")) as TokenizerJson;
}

// ---------- byte-level BPE ----------

/** GPT-2 / Qwen 的 bytes_to_unicode：256 个字节 → 256 个可打印 Unicode 字符。 */
function bytesToUnicode(): { enc: string[]; dec: Map<string, number> } {
  const bs: number[] = [];
  for (let b = 0x21; b <= 0x7e; b++) bs.push(b);
  for (let b = 0xa1; b <= 0xac; b++) bs.push(b);
  for (let b = 0xae; b <= 0xff; b++) bs.push(b);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n++;
    }
  }
  const enc: string[] = new Array(256);
  const dec = new Map<string, number>();
  for (let i = 0; i < bs.length; i++) {
    const ch = String.fromCodePoint(cs[i]!);
    enc[bs[i]!] = ch;
    dec.set(ch, bs[i]!);
  }
  return { enc, dec };
}

class ByteLevelBpe {
  private readonly ranks = new Map<string, number>();
  private readonly vocab: Record<string, number>;
  private readonly idToToken = new Map<number, string>();
  private readonly byteEnc: string[];
  private readonly byteDec: Map<string, number>;
  private readonly splitRe: RegExp;
  private readonly addedTokens: { id: number; content: string }[];
  private readonly addedRe: RegExp | null;

  constructor(t: TokenizerJson) {
    if (t.model.type !== "BPE") throw new Error(`不支持的 model.type ${t.model.type}`);
    if (t.normalizer && t.normalizer.type !== "NFC")
      throw new Error(`不支持的 normalizer ${t.normalizer.type}`);
    const split = t.pre_tokenizer.pretokenizers?.find((p) => p.type === "Split");
    const byteLevel = t.pre_tokenizer.pretokenizers?.find((p) => p.type === "ByteLevel");
    if (!split?.pattern?.Regex || !byteLevel) throw new Error("pre_tokenizer 不是 Split + ByteLevel");
    this.splitRe = new RegExp(split.pattern.Regex, "gu");
    this.vocab = t.model.vocab;
    for (const [tok, id] of Object.entries(this.vocab)) this.idToToken.set(id, tok);
    t.model.merges.forEach((m, i) => {
      const key = Array.isArray(m) ? `${m[0]} ${m[1]}` : m;
      this.ranks.set(key, i);
    });
    const { enc, dec } = bytesToUnicode();
    this.byteEnc = enc;
    this.byteDec = dec;
    this.addedTokens = t.added_tokens.map((a) => ({ id: a.id, content: a.content }));
    for (const a of t.added_tokens) this.idToToken.set(a.id, a.content);
    const escaped = this.addedTokens
      .map((a) => a.content)
      .sort((a, b) => b.length - a.length)
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    this.addedRe = escaped.length ? new RegExp(`(${escaped.join("|")})`, "gu") : null;
  }

  /** 单个预切分片段 → BPE token 字符串列表 */
  private bpe(piece: string): string[] {
    const bytes = Buffer.from(piece, "utf8");
    let word: string[] = Array.from(bytes, (b) => this.byteEnc[b]!);
    while (word.length > 1) {
      let best = -1;
      let bestRank = Number.POSITIVE_INFINITY;
      for (let i = 0; i < word.length - 1; i++) {
        const r = this.ranks.get(`${word[i]} ${word[i + 1]}`);
        if (r !== undefined && r < bestRank) {
          bestRank = r;
          best = i;
        }
      }
      if (best < 0) break;
      const merged: string[] = [];
      for (let i = 0; i < word.length; i++) {
        if (i === best) {
          merged.push(word[i]! + word[i + 1]!);
          i++;
        } else merged.push(word[i]!);
      }
      word = merged;
    }
    return word;
  }

  encode(text: string): { ids: number[]; tokens: string[] } {
    const ids: number[] = [];
    const tokens: string[] = [];
    const segments = this.addedRe ? text.split(this.addedRe) : [text];
    for (const seg of segments) {
      if (!seg) continue;
      const added = this.addedTokens.find((a) => a.content === seg);
      if (added) {
        ids.push(added.id);
        tokens.push(seg);
        continue;
      }
      const normalized = seg.normalize("NFC");
      for (const m of normalized.matchAll(this.splitRe)) {
        for (const tok of this.bpe(m[0])) {
          const id = this.vocab[tok];
          if (id === undefined) throw new Error(`词表里没有 token "${tok}"（来自 "${m[0]}"）`);
          ids.push(id);
          tokens.push(tok);
        }
      }
    }
    return { ids, tokens };
  }

  /** 把词表里的 byte-level 字符串还原为原始 UTF-8 文本；无法独立解码的片段返回 null。 */
  decodeToken(tok: string): string | null {
    if (this.addedTokens.some((a) => a.content === tok)) return tok;
    const bytes = Array.from(tok, (ch) => {
      const b = this.byteDec.get(ch);
      if (b === undefined) throw new Error(`token "${tok}" 含非 byte-level 字符 "${ch}"`);
      return b;
    });
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    } catch {
      return null;
    }
  }

  tokenOf(id: number): string | undefined {
    return this.idToToken.get(id);
  }
}

// ---------- 主流程 ----------
async function main() {
  const write = process.argv.includes("--write");
  const bpe = new ByteLevelBpe(await loadTokenizer());
  const presets = SENTENCES.map((s) => {
    const { ids, tokens } = bpe.encode(s.text);
    const pieces = tokens.map((t) => bpe.decodeToken(t));
    const bad = pieces.indexOf(null);
    if (bad >= 0)
      throw new Error(`"${s.text}" 第 ${bad} 个 token "${tokens[bad]}" 不是完整 UTF-8 字符，换一句`);
    const display = pieces as string[];
    if (display.join("") !== s.text) throw new Error(`"${s.text}" 分词拼回后不等于原文`);
    for (const id of ids) if (bpe.tokenOf(id) === undefined) throw new Error(`id ${id} 不在词表内`);
    console.log(`${s.id.padEnd(10)} S=${ids.length}  ${display.map((p, i) => `${p}(${ids[i]})`).join(" ")}`);
    return { id: s.id, text: s.text, note: s.note, tokens: display, ids };
  });
  const out = {
    $comment: "由 scripts/gen-preset-tokens.ts 生成，勿手改；tokens 是每个 id 对应的 UTF-8 片段。",
    tokenizer: TOKENIZER_SOURCE,
    presets,
  };
  if (write) {
    writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
    // 交给仓库的 Biome 统一格式，避免 pnpm lint 对生成文件报格式差异
    execSync(`pnpm biome format --write "${OUT_PATH}"`, { stdio: "inherit" });
    console.log(`已写入 ${OUT_PATH}`);
  } else console.log("（未写入；加 --write 写入 presets.tokens.json）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
