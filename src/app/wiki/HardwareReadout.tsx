import {
  DP_STOPS,
  DP_TITLES,
  dpRequestFrame,
  EP_COMBINED_CHANNEL,
  EP_OUTPUT_CHANNEL,
  EP_ROUTE_WEIGHTS,
  epIntroduction,
} from "./scene-hardware-story";
import { expertAssignments, parallelPhase, parallelSeconds } from "./scene-playback";

export function HardwareReadout({
  step,
  rank,
  progress,
  onSeek,
}: {
  step: number;
  rank: number;
  progress: number;
  onSeek: (seconds: number) => void;
}) {
  const { phase, local } = parallelPhase(progress, step === 2);
  if (step === 1) {
    const frame = dpRequestFrame(progress);
    return (
      <aside className="wiki-hardware-story" aria-label="请求怎样选择 DP 组">
        <nav aria-label="DP 请求阶段">
          {DP_TITLES.map((title, i) => (
            <button
              type="button"
              key={title}
              aria-pressed={frame.stage === i}
              onClick={() => onSeek(DP_STOPS[i]! * parallelSeconds(1))}
            >
              {i + 1} ·{" "}
              {
                [
                  "模型如何落卡",
                  "甲发来 A",
                  "A 进 DP0",
                  "乙发来 B",
                  "B 进 DP1",
                  "各自计算",
                  "分别回复",
                  "回看分工",
                ][i]
              }
            </button>
          ))}
        </nav>
        <strong>一句话 → token 编号 → 选 DP 组 → embedding 矩阵 → 模型</strong>
        <p>
          甲：“帮我写一封邮件”；乙：“解释一下缓存原理”。图中各简化为4个 token：每个 token
          对应矩阵的一行，横向是隐藏通道。分词只产生编号；选中的组查 embedding 表，才将每个编号展开成一行数。
        </p>
        <p>
          图中编号、分词与4×6数值均为教学示意；真实分词可能更多，隐藏宽度为4096。DP
          保留整条请求的所有行，不沿行切给两组。
        </p>
        <div className="wiki-dp-loads">
          {[0, 1].map((group) => (
            <section key={group} data-chosen={frame.stage === (group ? 3 : 1)}>
              <b>
                DP{group} ·{" "}
                {frame.stage >= (group ? 4 : 2) ? (group ? "乙的 B" : "甲的 A") : "尚未接到新请求"}
              </b>
              <span>
                {frame.stage < 5
                  ? `前端记账：等待 ${frame.waiting[group]}，运行 0`
                  : frame.stage === 5
                    ? "调度器取出本组请求，进入本轮计算"
                    : "保留请求归属，回复沿原路返回"}
              </span>
              {frame.stage < 5 && (
                <em>
                  {frame.waiting[group]} × 4 + 0 = {frame.scores[group]} 分
                </em>
              )}
            </section>
          ))}
        </div>
        <p>本例：一个前端；两组初始空闲；A、B 紧接着到达，B 到达时还没收到下一次统计更新。</p>
      </aside>
    );
  }
  if (step === 0)
    return (
      <aside className="wiki-hardware-story" aria-label="TP 在请求中的位置">
        <strong>一条请求的完整矩阵，8 张卡合算一次投影</strong>
        <p>DP 先决定请求进哪组；TP 在这组内部，把同一次矩阵乘交给 8 张卡合作。</p>
        <dl>
          <dt>输入从哪来</dt>
          <dd>本层前馈前半段的结果：N 个 token × 12288 通道。画面缩小为4行×8通道，每卡拿1列，4行都保留。</dd>
          <dt>这一站做什么</dt>
          <dd>乘 down 权重，产生 N 行 × 4096 通道；示意输出为4行×4通道。前景放大所选卡的全部部分和。</dd>
          <dt>为什么最后要相加</dt>
          <dd>
            每卡只读了输入列的1/8；输出的每一格都是部分和。按相同行、相同列相加，不能把不同 token 混在一起。
          </dd>
          <dt>结果交给谁</dt>
          <dd>本组各卡拿到结果，继续残差写回与下一层。</dd>
        </dl>
        <p>
          可手算的缩小例子：第 r 行输入全为 r+1；卡 k 的权重行是 (k+1)×[1,2,3,4]（r、k
          从0开始）。左上格为1+2+…+8=36；右下格为16×36=576。权重蓝色格阵只表示常驻切片，数值不代表真实模型参数。
        </p>
      </aside>
    );
  const selected = phase > 0 || epIntroduction(local).selected;
  return (
    <aside className="wiki-hardware-story" aria-label="EP 在请求中的位置">
      <strong>完整输入矩阵 → 抽出“一封”这行 → 选专家 → 合并 → 写回原行</strong>
      <p>
        左下保留4个 token
        的完整输入，每行横向展示6个通道（实际4096）。高亮“一封”所在的第3行；本次只追踪这一行，其余行各自选专家，不会整句共用同一个路由结果。分词与格内数值均为教学示例。
      </p>
      <p>
        一位专家是一套前馈网络，不是一个用户，也不等于一张卡。源卡是当前输入所在卡；每张卡同时存有多位专家。
      </p>
      {selected ? (
        <>
          <b>这一行选中的专家</b>
          <table>
            <thead>
              <tr>
                <th>专家 / 所在卡</th>
                <th>合并权重</th>
                {phase >= 3 && <th>某通道输出</th>}
              </tr>
            </thead>
            <tbody>
              {expertAssignments(rank).map((e, i) => (
                <tr key={e.expert}>
                  <td>
                    E{e.expert} / 卡{e.rank}
                  </td>
                  <td>{EP_ROUTE_WEIGHTS[i]}</td>
                  {phase >= 3 && <td>{EP_OUTPUT_CHANNEL[i]}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <small>编号、权重和通道值是固定教学示例；真实选择与数值由当前输入和模型参数决定。</small>
          {phase >= 4 && (
            <p>
              <b>为什么要合并：</b>同一输入得到八种变换结果，router 的权重决定各取多少。此通道：
              {EP_ROUTE_WEIGHTS.map((w, i) => `${w}×${EP_OUTPUT_CHANNEL[i]}`).join(" + ")} ={" "}
              <b>{+EP_COMBINED_CHANNEL.toFixed(2)}</b>
              。本例后五个通道的专家输出依次是首通道的2至6倍，合并后为13.2、19.8、26.4、33、39.6；六个数写回“一封”这一行，再交给后续计算。
            </p>
          )}
        </>
      ) : (
        <p>先认清输入和专家的存放位置；打分之后才出现本次选择，未选专家的权重仍留在显存中。</p>
      )}
    </aside>
  );
}
