import { Map as MapIcon, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { CHAPTERS, findChapter } from "../../content/chapters";
import { COURSE_LESSONS } from "../../content/course";
import { fragmentId } from "../../content/wiki/anchors";
import { CourseDirectory } from "../CourseDirectory";
import { LayerJourney } from "../course/LayerJourney";
import { LayerPart } from "../course/LayerPart";
import { CHAPTER03_FOCUS, LayerRoute } from "../course/LayerRoute";
import { RepresentationRelation } from "../course/LessonRelations";
import { MatrixPart } from "../course/MatrixPart";
import { type PageHeading, PageTocFab, PageTocSide, useActiveHeading } from "../wiki/PageToc";
import "../../design/wiki.css";
import "../../design/course-reader.css";

// The course completeness check requires all 22 entries, including this sample.
const lesson = COURSE_LESSONS["03"]!;
const chapter = findChapter("03")!;
const headings: PageHeading[] = [
  ...lesson.sections.map(({ id, title }) => ({ id, text: title, level: 2 as const })),
  { id: "takeaways", text: "把一层连起来", level: 2 },
  { id: "check-heading", text: "检查一下理解", level: 2 },
];

export function CourseChapter03Page() {
  const body = useRef<HTMLDivElement>(null);
  const structure = useRef<HTMLDialogElement>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSection, setMapSection] = useState("two-halves");
  const [journeyRequest, setJourneyRequest] = useState<{ step: number; revision: number } | null>(null);
  const continueJourney = (step: number) => {
    setJourneyRequest((previous) => ({ step, revision: (previous?.revision ?? 0) + 1 }));
    document.getElementById("layer-journey")?.scrollIntoView({ block: "start" });
  };
  const active = useActiveHeading(headings) ?? "two-halves";
  const focus = CHAPTER03_FOCUS[active] ?? CHAPTER03_FOCUS["whole-layer"]!;
  const { hash } = useLocation();
  const scrollTo = useCallback((target: string) => {
    document.getElementById(fragmentId(target))?.scrollIntoView({ block: "start" });
  }, []);
  useEffect(() => scrollTo(hash), [hash, scrollTo]);
  const toc = { pageId: "03", pathname: "/chapters/03", headings, scrollTo };
  const openMap = (id: string) => {
    // Use the existing pause controls to preserve each renderer's current calculation and camera.
    for (const button of body.current?.querySelectorAll<HTMLButtonElement>(
      '.matrix-part-playback button[aria-label="暂停计算"], .journey-playback button[aria-label="暂停完整计算"]',
    ) ?? []) {
      button.click();
    }
    setMapSection(id);
    setMapOpen(true);
    structure.current?.showModal();
  };
  const navigateFromMap = (id: string) => {
    structure.current?.close();
    scrollTo(`#${id}`);
  };
  const location = (id: string) =>
    CHAPTER03_FOCUS[id] && (
      <div className="course-section-location">
        <span>{CHAPTER03_FOCUS[id]!.path}</span>
        <button type="button" onClick={() => openMap(id)}>
          在全局图中定位
        </button>
      </div>
    );
  return (
    <div className="wiki-shell is-panel-closed course-reader course-chapter03">
      <CourseDirectory current="03" compactAt={1024} />
      <main className="wiki-main" id="main-content">
        <div className="wiki-reading-frame">
          <div className="wiki-reading" data-page-toc>
            <article className="wiki-article" aria-label="章节正文">
              <header className="wiki-article-head">
                <div className="wiki-article-meta">
                  <Link className="wiki-chip" to="/chapters">
                    全部课程
                  </Link>
                  <span className="wiki-type">第 03 章 · 模型计算</span>
                </div>
                <h1 className="display">{chapter.title}</h1>
                <p className="wiki-summary">{chapter.question}</p>
              </header>
              <nav className="course-compass" aria-label="本章全局定位" data-section={active}>
                <div className="course-compass-label">
                  <strong>{focus.label}</strong>
                  <span>{focus.path}</span>
                </div>
                <button type="button" onClick={() => openMap(active)} aria-haspopup="dialog">
                  <MapIcon size={16} aria-hidden="true" />
                  全局结构
                </button>
              </nav>
              <dialog
                ref={structure}
                className="course-structure-dialog"
                aria-labelledby="course-structure-title"
                onClose={() => setMapOpen(false)}
              >
                <header>
                  <div>
                    <strong id="course-structure-title">这一层的全局结构</strong>
                    <span>当前：{(CHAPTER03_FOCUS[mapSection] ?? CHAPTER03_FOCUS["whole-layer"]!).path}</span>
                  </div>
                  <button type="button" aria-label="关闭全局结构" onClick={() => structure.current?.close()}>
                    <X size={20} />
                  </button>
                </header>
                {mapOpen && <LayerRoute active={mapSection} onNavigate={navigateFromMap} />}
              </dialog>
              <div className="wiki-body" ref={body}>
                <p>{lesson.lead}</p>
                {lesson.sections.map((section) => {
                  const before = section.visualAfterParagraph ?? section.part?.afterParagraph ?? 1;
                  const paragraphWithFigure = (paragraph: string) => <p key={paragraph}>{paragraph}</p>;
                  return (
                    <Fragment key={section.id}>
                      {section.part || section.layerScene ? (
                        <section className="course-rms-section">
                          <div className="course-visual-intro">
                            <h2 id={section.id}>{section.title}</h2>
                            {location(section.id)}
                            {section.paragraphs.slice(0, before).map(paragraphWithFigure)}
                          </div>
                          {section.part && <MatrixPart kind={section.part.kind} />}
                          {section.layerScene === "attention" ? (
                            <>
                              <LayerJourney request={journeyRequest} />
                              <details className="course-local-attention" data-layer-detail="attention">
                                <summary>展开局部：八维内容怎样乘比例、求和与投影？</summary>
                                <LayerPart kind="attention" />
                              </details>
                            </>
                          ) : (
                            section.layerScene && (
                              <div className="course-continue-calculation">
                                <button
                                  type="button"
                                  onClick={() =>
                                    continueJourney(
                                      section.layerScene === "residual-attn"
                                        ? 10
                                        : section.layerScene === "ffn"
                                          ? 11
                                          : 15,
                                    )
                                  }
                                >
                                  在完整计算中继续：
                                  {section.layerScene === "residual-attn"
                                    ? "X + ΔA → X′"
                                    : section.layerScene === "ffn"
                                      ? "X′ → 归一化 → FFN"
                                      : "X′ + ΔF → Y"}
                                </button>
                                <details data-layer-detail={section.layerScene}>
                                  <summary>展开这一段的局部演算</summary>
                                  <LayerPart kind={section.layerScene} />
                                </details>
                              </div>
                            )
                          )}
                          <div className="course-visual-copy">
                            {section.paragraphs.slice(before).map(paragraphWithFigure)}
                          </div>
                        </section>
                      ) : (
                        <>
                          <h2 id={section.id}>{section.title}</h2>
                          {section.id !== "two-halves" && location(section.id)}
                          {section.paragraphs.slice(0, before).map(paragraphWithFigure)}
                          {section.diagram === "layer-route" && (
                            <LayerRoute active={active} onNavigate={navigateFromMap} />
                          )}
                          {section.id === "hidden" && <RepresentationRelation />}
                          {section.paragraphs.slice(before).map(paragraphWithFigure)}
                        </>
                      )}
                      {section.example && (
                        <>
                          <figure className="course-formula" aria-label={section.example.title}>
                            <figcaption>{section.example.title}</figcaption>
                            <pre>
                              <code>{section.example.code}</code>
                            </pre>
                          </figure>
                          <p>{section.example.explanation}</p>
                        </>
                      )}
                    </Fragment>
                  );
                })}
                <details className="course-comparison">
                  <summary>延伸：怎样对照 GLM 的具体结构？</summary>
                  <p>
                    本章先建立单条残差、普通注意力和基础前馈的关系。GLM 母版中，mHC
                    扩展了残差的读入、混合与写回；KDA 使用递推状态，不能直接当作这里的 softmax 注意力；SwiGLU
                    则把前馈的中间变换扩展为两路投影与门控相乘。先定位这些变化发生在哪一段，再进入它们的内部，更容易分清共同结构与模型选择。
                  </p>
                  <p>
                    它们不改变本章要练习的阅读方法：找到输入表示，沿支路追踪计算，确认结果如何写回。MoE
                    的专家与路由会在第 06 章继续展开。
                  </p>
                </details>
                <details className="course-comparison">
                  <summary>本页教学数据与图形怎样对应？</summary>
                  <p>
                    本页沿用现有 RMS
                    演示的六列输入、第一次归一化结果和增益参数，作为一个教学层的起点。注意力使用单头、8 维
                    Q/K/V 和因果 softmax，输出投影回 4,096 维；前馈采用 4,096 → 8,192 → 4,096 的 ReLU
                    结构。注意力、两次相加、第二次归一化与前馈的结果依次实际计算，不是 GLM 第 0
                    层的完整前向结果。
                  </p>
                  <p>
                    投影使用固定生成的教学权重：以八组因子构造稠密矩阵，计算时可先后乘两个因子，避免在浏览器保存巨大的权重数组。这些权重没有训练；演示用于核对计算关系，不用于解释模型学到了哪些语义。矩阵外观复用母版的立体材质，细纹表示结构密度，数值在每幅图下方核对。
                  </p>
                </details>
                <h2 id="takeaways">把一层连起来</h2>
                <ul>
                  {lesson.takeaways.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
                <h2 id="check-heading">检查一下理解</h2>
                {[lesson.check, ...(lesson.checks ?? [])].map((check) => (
                  <details className="course-reader-check" key={check.question}>
                    <summary>{check.question}</summary>
                    <p>{check.answer}</p>
                  </details>
                ))}
              </div>
              <nav className="chapter-pagination" aria-label="章节翻页">
                {["02", "04"].map((id) => (
                  <Link key={id} to={`/chapters/${id}`}>
                    <span>
                      <small>
                        {id === "02" ? "上一章" : "下一章"} · {id}
                      </small>
                      {CHAPTERS.find((item) => item.id === id)?.title}
                    </span>
                  </Link>
                ))}
              </nav>
            </article>
            <PageTocSide {...toc} />
          </div>
          <PageTocFab {...toc} />
        </div>
      </main>
    </div>
  );
}
