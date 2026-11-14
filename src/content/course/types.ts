export type LessonFigure =
  | { kind: "model"; segment: number; caption: string; observe: string[] }
  | {
      kind: "hardware";
      vendor: "ascend" | "nvidia";
      level: 0 | 1 | 2 | 3;
      caption: string;
      observe: string[];
    };

export interface CourseLesson {
  readings?: { title: string; url: string; note: string }[];
  lead: string;
  sections: {
    id: string;
    title: string;
    paragraphs: string[];
    /** Explain the objects used by an inline visualization before showing it. */
    visualAfterParagraph?: number;
    example?: { title: string; code: string; explanation: string };
    diagram?: "layers-one-layer" | "layer-route";
    layerScene?: "attention" | "residual-attn" | "ffn" | "residual-ffn";
    table?: { caption: string; columns: string[]; rows: string[][] };
    figure?: LessonFigure;
    part?: { kind: "rms" | "ffn" | "mhc"; afterParagraph: number };
  }[];
  check: { question: string; answer: string };
  checks?: { question: string; answer: string }[];
  takeaways: string[];
  /** Editorial evidence paths or official URLs; never rendered as course navigation. */
  sources: string[];
}
