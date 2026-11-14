import { CHAPTERS } from "../chapters";

export const CHAPTER_TITLES: Record<string, string> = Object.fromEntries(
  CHAPTERS.map(({ id, title }) => [id, title]),
);
export const CHAPTER_IDS = CHAPTERS.map(({ id }) => id);
