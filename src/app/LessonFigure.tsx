import { Maximize2, Play, X } from "lucide-react";
import { Link } from "react-router";
import type { LessonFigure as Figure } from "../content/course/types";

export function LessonFigure({
  figure,
  chapterId,
  open,
  onToggle,
}: {
  figure: Figure;
  chapterId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const params = new URLSearchParams(
    figure.kind === "model"
      ? { segment: String(figure.segment) }
      : { vendor: figure.vendor, level: String(figure.level) },
  );
  const path = figure.kind === "model" ? "glm-flow/master/chapter.html" : "whole/index.html";
  return (
    <figure className="lesson-figure">
      <figcaption>{figure.caption}</figcaption>
      <ol>
        {figure.observe.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <div className="lesson-figure-actions">
        <button type="button" onClick={onToggle} aria-expanded={open}>
          {open ? <X size={15} /> : <Play size={15} />}
          {open ? "收起演示" : figure.kind === "model" ? "在这里播放这一步" : "在这里查看部件"}
        </button>
        <Link to={`/${figure.kind}?chapter=${chapterId}&${params}`}>
          <Maximize2 size={15} />
          放大查看
        </Link>
      </div>
      {open && (
        <div className={`lesson-demo-viewport lesson-demo-${figure.kind}`}>
          {figure.kind === "model" && (
            <p className="lesson-demo-hint">窄屏可横向查看画面，也可点「放大查看」进入完整播放器。</p>
          )}
          <iframe
            src={`${import.meta.env.BASE_URL}experiences/${path}?site=1&inline=1&${params}`}
            title={figure.caption}
            allow="fullscreen"
            allowFullScreen
          />
        </div>
      )}
    </figure>
  );
}
