import { ENGINEERING_LESSONS } from "./engineering";
import { FOUNDATION_LESSONS } from "./foundations";
import { FRAMEWORK_LESSONS } from "./framework";
import { HARDWARE_LESSONS } from "./hardware-lessons";
import type { CourseLesson } from "./types";

export const COURSE_LESSONS: Record<string, CourseLesson> = {
  ...FOUNDATION_LESSONS,
  ...HARDWARE_LESSONS,
  ...FRAMEWORK_LESSONS,
  ...ENGINEERING_LESSONS,
};
