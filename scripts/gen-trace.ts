/**
 * 离线生成「真实 token 生成 trace」：用 transformers.js 在 Node 里跑真正的 Qwen3-0.6B（ONNX），
 * 对每句预设做贪心续写，记录每一步的 top-k 下一 token 概率。产物是小 JSON，随站点打包，标 [M] 实测。
 *
 * 用法：pnpm gen:trace [--write] [--dtype q8|fp32] [--tokens 12]
 * 模型文件缓存在 tools/hf-cache（已 gitignore，约 0.6 GB q8 / 2.4 GB fp32），不进仓库。
 *
 * 诚实边界：
 * - 输入是预设的纯文本 token（没有套 chat 模板），与站内 21 步 prefill 用的是同一串 id；
 * - 贪心解码（do_sample=false），可复现；
 * - 量化 dtype 会让概率与 bf16 原版有微小差异，metadata 里写明。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AutoModelForCausalLM, AutoTokenizer, env, Tensor } from "@huggingface/transformers";
import { TOKEN_PRESETS } from "../src/sim/model/presets";

const REPO = "onnx-community/Qwen3-0.6B-ONNX";
const REVISION = "da1453100cf3ff33ef56d17983fc7a8648706db6"; // 2026-04-20，Qwen/Qwen3-0.6B 转换
const OUT_DIR = join(process.cwd(), "src/sim/model/traces");
const TOP_K = 10;

const args = process.argv.slice(2);
const write = args.includes("--write");
const dtype = (args[args.indexOf("--dtype") + 1] as "q8" | "fp32" | undefined) ?? "q8";
const maxNew = Number(args[args.indexOf("--tokens") + 1]) || 12;

env.cacheDir = join(process.cwd(), "tools/hf-cache");
env.allowLocalModels = false;

interface TraceStep {
  /** 生成第几个新 token（0 = 紧接输入之后） */
  index: number;
  /** 此时的上下文长度（含已生成） */
  contextLength: number;
  /** top-k 候选：id、文本片段、概率 */
  topK: { id: number; token: string; prob: number }[];
  /** 贪心选中的 token */
  chosen: { id: number; token: string; prob: number };
  /** 分布熵（nat） */
  entropy: number;
}

interface Trace {
  presetId: string;
  inputText: string;
  inputIds: number[];
  generatedIds: number[];
  generatedText: string;
  steps: TraceStep[];
  source: {
    repo: string;
    revision: string;
    baseModel: string;
    dtype: string;
    decoding: "greedy";
    library: string;
    generatedAt: string;
    note: string;
  };
}

function softmaxTopK(logits: Float32Array, k: number): { ids: number[]; probs: number[]; entropy: number } {
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < logits.length; i++) if (logits[i]! > max) max = logits[i]!;
  let sum = 0;
  const exps = new Float64Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i]! - max);
    exps[i] = e;
    sum += e;
  }
  let entropy = 0;
  const idx = Array.from({ length: logits.length }, (_, i) => i);
  for (let i = 0; i < logits.length; i++) {
    const p = exps[i]! / sum;
    if (p > 0) entropy -= p * Math.log(p);
  }
  idx.sort((a, b) => exps[b]! - exps[a]!);
  const ids = idx.slice(0, k);
  return { ids, probs: ids.map((i) => exps[i]! / sum), entropy };
}

async function main() {
  const version = JSON.parse(
    readFileSync(join(process.cwd(), "node_modules/@huggingface/transformers/package.json"), "utf8"),
  ).version as string;
  console.log(
    `transformers.js ${version} · ${REPO}@${REVISION.slice(0, 8)} · dtype=${dtype} · 每句 ${maxNew} 个新 token`,
  );

  const tokenizer = await AutoTokenizer.from_pretrained(REPO, { revision: REVISION });
  const model = await AutoModelForCausalLM.from_pretrained(REPO, { revision: REVISION, dtype });

  mkdirSync(OUT_DIR, { recursive: true });
  for (const preset of TOKEN_PRESETS) {
    // 分词结果必须与站内预设 id 逐个一致，否则 trace 与 21 步对不上
    const enc = tokenizer(preset.text, { add_special_tokens: false });
    const encIds = Array.from(enc.input_ids.data as BigInt64Array, (v) => Number(v));
    if (encIds.join(",") !== preset.ids.join(","))
      throw new Error(`预设 ${preset.id} 的 token id 与 tokenizer 不一致：${encIds} vs ${preset.ids}`);

    const ids = [...preset.ids];
    const steps: TraceStep[] = [];
    const t0 = performance.now();
    for (let n = 0; n < maxNew; n++) {
      const input_ids = new Tensor("int64", BigInt64Array.from(ids.map((v) => BigInt(v))), [1, ids.length]);
      const attention_mask = new Tensor("int64", BigInt64Array.from(ids.map(() => 1n)), [1, ids.length]);
      const out = await model({ input_ids, attention_mask });
      const logits = out.logits as Tensor;
      const [, S, V] = logits.dims as [number, number, number];
      const last = (logits.data as Float32Array).subarray((S - 1) * V, S * V);
      const { ids: top, probs, entropy } = softmaxTopK(last, TOP_K);
      const topK = top.map((id, i) => ({ id, token: tokenizer.decode([id]), prob: probs[i]! }));
      const chosen = topK[0]!;
      steps.push({ index: n, contextLength: ids.length, topK, chosen, entropy });
      ids.push(chosen.id);
      process.stdout.write(
        `  ${preset.id} +${n + 1}: ${JSON.stringify(chosen.token)} p=${chosen.prob.toFixed(3)}\n`,
      );
    }
    const generatedIds = ids.slice(preset.ids.length);
    const trace: Trace = {
      presetId: preset.id,
      inputText: preset.text,
      inputIds: preset.ids,
      generatedIds,
      generatedText: tokenizer.decode(generatedIds),
      steps,
      source: {
        repo: REPO,
        revision: REVISION,
        baseModel: "Qwen/Qwen3-0.6B",
        dtype,
        decoding: "greedy",
        library: `@huggingface/transformers ${version} (onnxruntime-node, CPU)`,
        generatedAt: new Date().toISOString(),
        note:
          dtype === "fp32"
            ? "fp32 ONNX 权重，与 bf16 原版有浮点舍入差异"
            : `${dtype} 量化 ONNX 权重，概率与 bf16 原版有微小差异；输入为纯文本 token，未套 chat 模板`,
      },
    };
    console.log(
      `${preset.id}: "${preset.text}" → "${trace.generatedText}"（${((performance.now() - t0) / 1000).toFixed(1)} s）`,
    );
    const file = join(OUT_DIR, `${preset.id}.trace.json`);
    if (write) {
      writeFileSync(file, `${JSON.stringify(trace, null, 2)}\n`);
      console.log(`  写入 ${file}`);
    } else if (existsSync(file)) {
      console.log(`  （未写入；加 --write 覆盖 ${file}）`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
