import { expect, it } from "vitest";
import { allowedAttribute } from "./WikiDiagram";

it("白名单：几何与排版照旧放行，marker / 斜线填充只许指向图内，事件属性和外链不放行", () => {
  expect(allowedAttribute("d", "M0 0 L10 10")).toBe(true);
  expect(allowedAttribute("class", "wiki-anim-move")).toBe(true);
  expect(allowedAttribute("marker-end", "url(#f-ah-comm)")).toBe(true);
  expect(allowedAttribute("marker-end", "url(https://x.example/a.svg#m)")).toBe(false);
  expect(allowedAttribute("fill", "url(#f-hatch)")).toBe(true);
  expect(allowedAttribute("fill", "url(https://x.example/p)")).toBe(false);
  expect(allowedAttribute("onclick", "alert(1)")).toBe(false);
  expect(allowedAttribute("href", "https://x.example")).toBe(false);
});

it("逐张卡演的时间轴属性放行，但值只能是数字（关键帧里还可以有「-」），别的 data- 属性不放行", () => {
  expect(allowedAttribute("data-ms", "7250")).toBe(true);
  expect(allowedAttribute("data-keys", "0 - 0.0966 0.1862 0.2345")).toBe(true);
  expect(allowedAttribute("data-show", "0.25")).toBe(true);
  expect(allowedAttribute("data-hide", "1")).toBe(true);
  expect(allowedAttribute("data-fade", "0.4 0.5")).toBe(true);
  expect(allowedAttribute("data-fade", "0.4")).toBe(false);
  expect(allowedAttribute("data-show", "javascript:1")).toBe(false);
  expect(allowedAttribute("data-keys", "0 <b>")).toBe(false);
  expect(allowedAttribute("data-other", "1")).toBe(false);
});
