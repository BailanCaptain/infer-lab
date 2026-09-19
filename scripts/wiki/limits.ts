/**
 * 页面的两个数量上限，lint 拿它判、整合引擎拿它给 agent 定删减目标——同一个数只定义在这里。
 * 规则的出处是 HANDBOOK：标记上限见「整合」第 4 条与 Lint `mark-flood`；事实表见「页面格式 › 参数页与来源页」。
 */

/** 一页内联证据标记的上限 */
export const MARK_FLOOD = 30;
/** 参数页 `## 事实表` 的行数上限 */
export const FACTS_BUDGET = 10;
