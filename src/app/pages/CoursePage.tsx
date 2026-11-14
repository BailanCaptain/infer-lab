import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import oneLayerDiagram from "../../../wiki/diagrams/layers-one-layer.svg?raw";
import { CHAPTERS, COURSE_PARTS, chapterExperience, findChapter } from "../../content/chapters";
import { COURSE_LESSONS } from "../../content/course";
import { WikiDiagram } from "../../content/wiki/WikiDiagram";
import { CourseDirectory } from "../CourseDirectory";
import { ParallelLab } from "../course/ParallelLab";
import { BatchLedger, RequestJourney } from "../course/RequestJourney";
import { LessonFigure } from "../LessonFigure";
import { CourseChapter03Page } from "./CourseChapter03Page";
import { ExperiencePage } from "./ExperiencePage";

export function CoursePage() {
  const { id } = useParams();
  const [openFigure, setOpenFigure] = useState<string | null>(null);
  const [params] = useSearchParams();
  const chapter = findChapter(id);
  if (id && !chapter) return <NotFoundPage />;
  const index = CHAPTERS.findIndex((item) => item.id === id);
  const previous = CHAPTERS[index - 1];
  const next = CHAPTERS[index + 1];
  const experience = chapter && chapterExperience(chapter.id);
  if (experience && id !== "03" && params.get("experience") === "1") {
    return <ExperiencePage kind={chapter.part === 1 ? "model" : "hardware"} />;
  }
  const lesson = chapter ? COURSE_LESSONS[chapter.id] : undefined;
  if (id === "03") return <CourseChapter03Page />;

  return (
    <div className="course-layout">
      <CourseDirectory current={id} />
      <main className="course-content" id="main-content">
        {chapter && lesson ? (
          <>
            <div className="lesson-meta">
              <Link to="/chapters">全部课程</Link>
              <span>/</span>
              <span>{COURSE_PARTS[chapter.part]}</span>
            </div>
            <div className="eyebrow">第 {chapter.id} 章</div>
            <h1>{chapter.title}</h1>
            <p className="course-question">{chapter.question}</p>
            <div className="lesson-layout">
              <article key={chapter.id} className="lesson-article" aria-label="章节正文">
                <p className="lesson-lead">{lesson.lead}</p>
                {chapter.id === "09" && <RequestJourney />}
                {chapter.id === "13" && <ParallelLab />}
                {experience && (
                  <div className="course-experience">
                    <div>
                      <strong>配合演示一起看</strong>
                      <p>
                        {chapter.part === 1
                          ? "播放计算过程，对照下面的输入、运算与输出。"
                          : "旋转并展开部件，对照它们在计算中的职责。"}
                      </p>
                    </div>
                    <Link to={experience.to}>
                      {experience.label}
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                )}
                {lesson.sections.map((section, sectionIndex) => (
                  <section className="lesson-section" id={section.id} key={section.id}>
                    <h2>
                      <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
                      {section.title}
                    </h2>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {chapter.id === "09" && section.id === "join-batch" && <BatchLedger />}
                    {section.example && (
                      <figure className="lesson-example">
                        <h3>{section.example.title}</h3>
                        <pre>
                          <code>{section.example.code}</code>
                        </pre>
                        <p>{section.example.explanation}</p>
                      </figure>
                    )}
                    {section.table && (
                      <div className="lesson-table">
                        <table>
                          <caption>{section.table.caption}</caption>
                          <thead>
                            <tr>
                              {section.table.columns.map((column) => (
                                <th key={column} scope="col">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.table.rows.map((row) => (
                              <tr key={row.join("|")}>
                                {row.map((cell, cellIndex) => (
                                  <td key={section.table!.columns[cellIndex]}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {section.diagram && (
                      <div className="course-diagram">
                        <WikiDiagram id={section.diagram} svg={oneLayerDiagram} />
                      </div>
                    )}
                    {section.figure && (
                      <LessonFigure
                        figure={section.figure}
                        chapterId={chapter.id}
                        open={openFigure === `${chapter.id}/${section.id}`}
                        onToggle={() =>
                          setOpenFigure(
                            openFigure === `${chapter.id}/${section.id}`
                              ? null
                              : `${chapter.id}/${section.id}`,
                          )
                        }
                      />
                    )}
                  </section>
                ))}
                <section className="lesson-takeaways" aria-labelledby="takeaways">
                  <h2 id="takeaways">带走这几个要点</h2>
                  <ul>
                    {lesson.takeaways.map((takeaway) => (
                      <li key={takeaway}>{takeaway}</li>
                    ))}
                  </ul>
                </section>
                <section className="lesson-check" aria-labelledby="check-heading">
                  <h2 id="check-heading">检查一下理解</h2>
                  {[lesson.check, ...(lesson.checks ?? [])].map((check, checkIndex) => (
                    <div className="lesson-check-item" key={check.question}>
                      <p>
                        {checkIndex + 1}. {check.question}
                      </p>
                      <details>
                        <summary>查看参考答案</summary>
                        <p>{check.answer}</p>
                      </details>
                    </div>
                  ))}
                </section>
                {lesson.readings && (
                  <section className="lesson-readings">
                    <h2>继续阅读与图形依据</h2>
                    {lesson.readings.map((reading) => (
                      <p key={reading.url}>
                        <a href={reading.url} target="_blank" rel="noreferrer">
                          {reading.title} ↗
                        </a>
                        <br />
                        <span>{reading.note}</span>
                      </p>
                    ))}
                  </section>
                )}
                <nav className="chapter-pagination" aria-label="章节翻页">
                  {previous ? (
                    <Link to={`/chapters/${previous.id}`}>
                      <ArrowLeft size={16} />
                      <span>
                        <small>上一章 · {previous.id}</small>
                        {previous.title}
                      </span>
                    </Link>
                  ) : (
                    <Link to="/chapters">全部课程</Link>
                  )}
                  {next ? (
                    <Link to={`/chapters/${next.id}`}>
                      <span>
                        <small>下一章 · {next.id}</small>
                        {next.title}
                      </span>
                      <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <Link to="/chapters">回到课程目录</Link>
                  )}
                </nav>
              </article>
              <nav className="lesson-toc" aria-label="本章内容">
                <strong>本章内容</strong>
                {lesson.sections.map((section) => (
                  <Link key={section.id} to={`/chapters/${chapter.id}#${section.id}`}>
                    {section.title}
                  </Link>
                ))}
              </nav>
            </div>
          </>
        ) : (
          <>
            <header className="course-overview-heading">
              <div>
                <div className="eyebrow">22 章 · 5 个学习阶段</div>
                <h1>理解一次推理的全过程</h1>
                <p className="course-question">
                  从一句话怎样变成数字，到模型如何计算、硬件如何执行，再走进推理框架与源码。
                </p>
              </div>
              <Link className="site-action" to="/chapters/00">
                从导论开始
                <ArrowRight size={16} />
              </Link>
            </header>
            <div className="course-parts">
              {COURSE_PARTS.map((part, partIndex) => {
                const chapters = CHAPTERS.filter((item) => item.part === partIndex);
                return (
                  <section className="course-part" key={part} aria-label={part}>
                    <header>
                      <h2>{part}</h2>
                      <span>
                        {chapters.length === 1
                          ? `第 ${chapters[0]?.id} 章`
                          : `${chapters[0]?.id} — ${chapters.at(-1)?.id}`}
                      </span>
                    </header>
                    <ul>
                      {chapters.map((item) => (
                        <li key={item.id}>
                          <Link to={`/chapters/${item.id}`}>
                            <span className="course-number">{item.id}</span>
                            <div>
                              <strong>{item.title}</strong>
                              <p>{item.question}</p>
                            </div>
                            <ArrowRight size={16} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="course-layout">
      <CourseDirectory current={undefined} />
      <main className="course-content" id="main-content">
        <div className="eyebrow">404</div>
        <h1>没有找到这个页面</h1>
        <p className="course-question">可以回到课程目录，继续选择想了解的章节。</p>
        <Link className="site-action" to="/chapters">
          查看 22 章课程
          <ArrowRight size={16} />
        </Link>
      </main>
    </div>
  );
}
