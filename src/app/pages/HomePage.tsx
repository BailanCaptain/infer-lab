export function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="eyebrow">infer-lab · vLLM-Ascend</p>
      <h1 className="display mt-3 text-hero">
        看清一次推理<span className="text-accent">怎么算</span>、<span className="text-accent">在哪跑</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lead text-ink-muted">
        以 vLLM-Ascend 为主线，从 Token 与矩阵到 NPU 与机柜，把一次推理请求的两层数据流看清楚。
      </p>
      <a
        href="#/model"
        className="mt-8 inline-flex h-10 items-center rounded-field border border-accent bg-accent px-4 text-compact text-ink-inverse hover:bg-accent-hover"
      >
        看 Qwen3-0.6B 的整体结构
      </a>
    </main>
  );
}
