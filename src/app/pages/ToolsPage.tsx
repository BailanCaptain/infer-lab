import "../../design/tools.css";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { AiCoreLabView } from "../tools/AiCoreLabView";
import { ConfigDoctorView } from "../tools/ConfigDoctorView";
import { DeployCalculatorView } from "../tools/DeployCalculatorView";
import { TroubleshootWorkbenchView } from "../tools/TroubleshootWorkbenchView";

type ActiveToolTab = "calculator" | "doctor" | "troubleshoot" | "aicore";

function resolveToolTab(raw: string | null): ActiveToolTab {
  if (raw === "doctor" || raw === "troubleshoot" || raw === "aicore") return raw;
  return "calculator";
}

export function ToolsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveToolTab(searchParams.get("tab"));

  const handleSelectTab = (next: ActiveToolTab) => {
    setSearchParams({ tab: next }, { replace: true });
  };

  return (
    <main id="main-content" className="wt-workbench" data-testid="tools-workbench" tabIndex={-1}>
      <header className="wt-workbench-head">
        <div className="wt-workbench-heading">
          <span className="wt-workbench-eyebrow">ASCEND ENGINEERING WORKBENCH</span>
          <h1 className="wt-workbench-title">昇腾推理交互工程工作台</h1>
          <p className="wt-workbench-desc">
            面向 vllm-ascend v0.30.0 / main
            源码规则链的四大在线工程实验室：部署算账、起服务联检、日志与相对时序排障、AI Core 算子流水线对照。
          </p>
        </div>
        <Link className="wt-workbench-back" to="/wiki" data-testid="tools-back-to-wiki">
          <ArrowLeft size={15} aria-hidden="true" />
          <span>返回主章节</span>
        </Link>
      </header>

      <div className="wt-workbench-tabs" role="tablist" aria-label="交互工程实验室切换">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "calculator"}
          className={`wt-workbench-tab ${activeTab === "calculator" ? "is-active" : ""}`}
          data-testid="tools-tab-calculator"
          onClick={() => handleSelectTab("calculator")}
        >
          <span>① 部署算账台</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "doctor"}
          className={`wt-workbench-tab ${activeTab === "doctor" ? "is-active" : ""}`}
          data-testid="tools-tab-doctor"
          onClick={() => handleSelectTab("doctor")}
        >
          <span>② vllm serve 配置体检器</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "troubleshoot"}
          className={`wt-workbench-tab ${activeTab === "troubleshoot" ? "is-active" : ""}`}
          data-testid="tools-tab-troubleshoot"
          onClick={() => handleSelectTab("troubleshoot")}
        >
          <span>③ 交互式排障工作台</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "aicore"}
          className={`wt-workbench-tab ${activeTab === "aicore" ? "is-active" : ""}`}
          data-testid="tools-tab-aicore"
          onClick={() => handleSelectTab("aicore")}
        >
          <span>④ AI Core 算子实验室</span>
        </button>
      </div>

      {activeTab === "calculator" ? (
        <DeployCalculatorView
          mode="full"
          title="「立项四问」双模部署算账台"
          summary="Mode A 用 7 级冷启动显存区间 + Roofline 回答「立项四问」；Mode B 粘贴真实 vllm serve 启动日志逐项对账（HCCL 不二次扣减）。"
        />
      ) : activeTab === "doctor" ? (
        <ConfigDoctorView
          mode="full"
          title="vllm serve 配置体检器"
          summary="基于 vllm-ascend v0.30.0 / main 源码规则，覆盖单实例与 P/D 分离双实例联检、静默改写对照与子系统快照。"
        />
      ) : activeTab === "troubleshoot" ? (
        <TroubleshootWorkbenchView
          mode="full"
          title="双模交互式排障工作台"
          summary="Panel A 解析真实启动日志、CANN/HCCL 错误码与 /metrics 快照定位首错 Rank；Panel B 用示意相对时序沙箱复现 6 类阻塞机理，物理隔离。"
        />
      ) : (
        <AiCoreLabView
          mode="full"
          title="昇腾 AI Core 算子与流水线实验室"
          summary="单场景深度对照 QuantMatmul + AddRMSNorm（2 Tile）：观察 AIC/AIV 分离泳道、910B vs 950 片上直通、Roofline 响应与跨组离群量化。"
        />
      )}
    </main>
  );
}
