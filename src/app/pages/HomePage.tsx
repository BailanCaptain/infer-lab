import { ArrowRight } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import city from "../intro/city.json";
import type { CityScene } from "../intro/cityScene";
import "../../design/city.css";

export function HomePage() {
  const host = useRef<HTMLDivElement>(null);
  const entrance = useRef<HTMLAnchorElement>(null);
  const sceneRef = useRef<CityScene | undefined>(undefined);
  const pauseForEntrance = () =>
    sceneRef.current?.suspend(Boolean(entrance.current?.matches(":hover, :focus")));
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    document.title = "大模型推理之旅 · AI Infra";
    let cancelled = false;
    let interacted = false;
    let scene: CityScene | undefined;
    import("../intro/cityScene")
      .then(({ createCityScene }) => {
        if (cancelled || !host.current) return;
        scene = createCityScene(host.current, {
          onLoad: () => {
            setStatus("ready");
            if (!interacted) setTouring(scene?.tour(true) ?? false);
          },
          onProgress: () => {},
          onError: () => setStatus("error"),
          onInteract: () => {
            interacted = true;
            setTouring(false);
          },
        });
        sceneRef.current = scene;
        scene.suspend(Boolean(entrance.current?.matches(":hover, :focus")));
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = undefined;
    };
  }, []);

  return (
    <main
      className="inference-journey"
      aria-label="大模型推理之旅"
      style={{ "--city-paper": city.palette.sky, "--city-ink": city.palette.ink } as CSSProperties}
    >
      <div className="city-stage" ref={host} data-testid="city-scene" />
      <div className="city-atmosphere" />
      <div className="city-signature" aria-hidden="true">
        AI Infra <span>推理，从这里开始</span>
      </div>
      <header className="city-intro">
        <p className="city-eyebrow">A JOURNEY INTO AI INFRA</p>
        <h1>
          大模型<span>推理之旅</span>
        </h1>
        <p className="city-description">
          从一次计算，
          <br />
          走进大模型推理的世界。
        </p>
        <Link
          className="city-enter"
          to="/wiki"
          ref={entrance}
          onPointerEnter={pauseForEntrance}
          onPointerLeave={pauseForEntrance}
          onFocus={pauseForEntrance}
          onBlur={pauseForEntrance}
        >
          开始阅读 <ArrowRight size={19} strokeWidth={1.6} aria-hidden="true" />
        </Link>
      </header>
      <footer className="city-footer">
        <span>模型 · 系统 · 硬件</span>
        {status === "ready" ? (
          <span className="city-interaction-hint">
            {touring ? "自动环绕 · 拖动暂停" : "拖动城市，换个角度"}
          </span>
        ) : (
          <span role="status">{status === "loading" ? "正在展开城市…" : "场景暂未载入，仍可开始阅读"}</span>
        )}
      </footer>
    </main>
  );
}
