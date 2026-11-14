import type { ReactNode } from "react";

/** Hidden alternatives reserve their natural wrapped height without clipping the current explanation. */
export function StableSceneContent({ children, sizing }: { children: ReactNode; sizing: ReactNode }) {
  return (
    <div className="wiki-scene-stable-stack">
      <div>{children}</div>
      <div className="wiki-scene-stable-stack" aria-hidden="true" inert>
        {sizing}
      </div>
    </div>
  );
}

export function StableSceneText({ text, alternatives }: { text: string; alternatives: string[] }) {
  return (
    <span className="wiki-scene-stable-stack">
      <span>{text}</span>
      {alternatives.map((value) => (
        <span key={value} aria-hidden="true">
          {value}
        </span>
      ))}
    </span>
  );
}
