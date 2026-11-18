import { ArrowLeft, Box, Layers, Network, Play } from "lucide-react";
import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { findChapter } from "../../content/chapters";
import { CourseDirectory } from "../CourseDirectory";

const MODEL_VIEWS = [
  { id: "play", title: "计算演示", path: "chapter.html", icon: Play },
  { id: "model", title: "整个模型", path: "model.html", icon: Box },
  { id: "layer", title: "单层结构", path: "flow.html", icon: Layers },
  { id: "arch", title: "二维架构", path: "arch.html", icon: Network },
] as const;

export function ExperiencePage({ kind }: { kind: "model" | "hardware" }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const chapter = findChapter(id ?? params.get("chapter") ?? undefined);
  const view = MODEL_VIEWS.find((item) => item.id === params.get("view")) ?? MODEL_VIEWS[0];
  // Both entrances use the accepted whole-machine master, including its NPU module.
  const hardwareModule = params.get("view") === "npu";
  const segment = Number(params.get("segment"));
  const modelEntry = Number.isInteger(segment) && segment >= 1 && segment <= 40 ? `&segment=${segment}` : "";
  const vendor = params.get("vendor") === "nvidia" ? "nvidia" : "ascend";
  const hardwareModel = params.get("model");
  const modelParam = hardwareModel && /^[a-z0-9-]+$/.test(hardwareModel) ? `&model=${hardwareModel}` : "";
  const level = params.has("level")
    ? Math.max(0, Math.min(4, Number(params.get("level")) || 0))
    : hardwareModule
      ? 3
      : 0;
  const path =
    kind === "model"
      ? `glm-flow/master/${view.path}?site=1${view.id === "play" ? modelEntry : ""}`
      : `whole/index.html?site=1&vendor=${vendor}&level=${level}${modelParam}`;
  const src = `${import.meta.env.BASE_URL}experiences/${path}`;
  const title = kind === "model" ? "GLM 模型计算" : "硬件 3D";
  const viewTitle = kind === "model" ? view.title : "机柜与整机";
  const base = id ? `/chapters/${id}` : `/${kind}`;

  useEffect(() => {
    document.title = `${kind === "model" ? "模型探索" : "硬件探索"} · AI Infra`;
  }, [kind]);

  return (
    <div className={id ? "course-layout experience-layout" : "reader-experience"}>
      {id && chapter && <CourseDirectory current={chapter.id} />}
      <main className={`experience-page experience-${kind}`} id="main-content" tabIndex={-1}>
        <header className="experience-toolbar">
          <div className="experience-heading">
            <Link to={chapter ? `/chapters/${chapter.id}` : "/wiki"}>
              <ArrowLeft size={14} />
              {chapter ? `返回第 ${chapter.id} 章` : "返回主章节"}
            </Link>
            <h1>{id && chapter ? chapter.title : kind === "model" ? "模型探索" : "硬件探索"}</h1>
          </div>
          {kind === "model" && (
            <nav className="experience-tabs" aria-label="演示视图">
              {MODEL_VIEWS.map((item) => (
                <Link
                  key={item.id}
                  aria-current={view.id === item.id ? "page" : undefined}
                  to={`${base}?${new URLSearchParams({ view: item.id, ...(id ? { experience: "1" } : chapter ? { chapter: chapter.id } : {}), ...(modelEntry ? { segment: String(segment) } : {}) })}`}
                >
                  <item.icon size={16} strokeWidth={1.6} aria-hidden="true" />
                  <span>{item.title}</span>
                </Link>
              ))}
            </nav>
          )}
        </header>
        <div className="experience-viewport">
          <iframe
            key={src}
            className="experience-frame"
            src={src}
            title={`${title} · ${viewTitle}`}
            allow="fullscreen"
            allowFullScreen
          />
        </div>
      </main>
    </div>
  );
}
