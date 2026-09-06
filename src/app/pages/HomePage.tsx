import { ArrowUpRight, Compass, Pause, RotateCcw } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import city from "../intro/city.json";
import type { CityScene } from "../intro/cityScene";
import world from "../intro/world.json";
import "../../design/city.css";

export function HomePage() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<CityScene | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [touring, setTouring] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setProgress(0);
    import("../intro/cityScene")
      .then(({ createCityScene }) => {
        if (cancelled || !host.current) return;
        host.current.dataset.attempt = String(retry);
        controller.current = createCityScene(host.current, {
          onLoad: () => setStatus("ready"),
          onProgress: setProgress,
          onError: () => setStatus("error"),
          onInteract: () => setTouring(false),
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, [retry]);
  return (
    <main
      className="inference-journey"
      aria-label="大模型推理之旅"
      style={{ "--city-paper": city.palette.sky, "--city-ink": city.palette.ink } as CSSProperties}
    >
      <div className="city-stage" ref={host} data-testid="city-scene" />
      <div className="city-atmosphere" />
      <header className="city-header">
        <div className="city-brand">
          <span className="city-seal">
            云<br />隐
          </span>
          <div>
            <h1>大模型推理之旅</h1>
            <p>A JOURNEY INTO LLM INFERENCE</p>
          </div>
        </div>
        <Link className="city-practice" to="/dev/spike-c">
          实践 <ArrowUpRight size={12} />
        </Link>
      </header>
      <aside className="city-index" aria-label="十章目录">
        <div className="city-index-heading">
          <span>拾级而上</span>
          <span>十境 · 一程</span>
        </div>
        <ol>
          {world.chapters.map((chapter) => (
            <li key={chapter.id}>
              <span className="city-chapter-number">{chapter.id}</span>
              <div>
                <strong>{chapter.title}</strong>
                <small>{chapter.english}</small>
              </div>
            </li>
          ))}
        </ol>
        <p className="city-index-foot">循山而行，见微知著。</p>
        <p className="city-motto">EXPLORE · UNDERSTAND · BUILD</p>
      </aside>
      {status === "loading" && (
        <div className="city-loading" role="status">
          正在展开推理之旅<small>{progress < 100 ? `${progress}%` : "准备场景"}</small>
        </div>
      )}
      {status === "error" && (
        <div className="city-error" role="alert">
          <strong>场景暂未载入</strong>
          <p>请重试加载。</p>
          <button
            type="button"
            onClick={() => {
              setTouring(false);
              setRetry((value) => value + 1);
            }}
          >
            重新加载
          </button>
        </div>
      )}
      <footer className="city-footer">
        <div className="city-controls">
          <span>拖动旋转 · 滚轮缩放</span>
          <button
            type="button"
            aria-label="重置视角"
            title="重置视角 (Esc)"
            disabled={status !== "ready"}
            onClick={() => controller.current?.reset()}
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            aria-label={touring ? "暂停环游" : "自动环游"}
            aria-pressed={touring}
            disabled={status !== "ready"}
            onClick={() => setTouring(controller.current?.tour(!touring) ?? false)}
          >
            {touring ? <Pause size={14} /> : <Compass size={14} />}
            <span>{touring ? "暂停" : "环游"}</span>
          </button>
        </div>
      </footer>
    </main>
  );
}
