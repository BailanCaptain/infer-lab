import { Link } from "react-router";
import { CHAPTERS, COURSE_PARTS } from "../content/chapters";
import { SiteNav } from "./SiteNav";

export function CourseDirectory({
  current,
  compactAt = 800,
}: {
  current: string | undefined;
  compactAt?: number;
}) {
  return (
    <aside className="course-sidebar" aria-label="学习导航">
      <SiteNav />
      {current ? (
        <details
          className="course-directory"
          open={!window.matchMedia(`(max-width: ${compactAt}px)`).matches}
        >
          <summary>课程目录 · 22 章</summary>
          <nav aria-label="课程目录">
            {COURSE_PARTS.map((part, partIndex) => (
              <section key={part}>
                <h2>{part}</h2>
                {CHAPTERS.filter((item) => item.part === partIndex).map((item) => (
                  <Link
                    key={item.id}
                    to={`/chapters/${item.id}`}
                    className={current === item.id ? "active" : undefined}
                    aria-current={current === item.id ? "page" : undefined}
                  >
                    <span className="course-number">{item.id}</span>
                    {item.title}
                  </Link>
                ))}
              </section>
            ))}
          </nav>
        </details>
      ) : (
        <div className="sidebar-guide">
          <span className="eyebrow">学习路线 / 00—21</span>
          <p>从一次对话出发，逐步理解模型、硬件与推理系统。</p>
          <Link to="/chapters/00">从第 00 章开始 →</Link>
        </div>
      )}
    </aside>
  );
}
