export function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mono text-label text-ink-muted">infer-lab · 0.1.0</p>
      <h1 className="mt-2 text-display font-semibold">大模型推理可视化实验室</h1>
      <p className="mt-4 max-w-2xl text-lead text-ink-muted">
        以 vLLM-Ascend 为主线，从 Token 与矩阵到 NPU 与机柜，把一次推理请求的两层数据流看清楚。
      </p>
    </main>
  );
}
