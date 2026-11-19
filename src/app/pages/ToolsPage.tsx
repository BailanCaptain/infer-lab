import "../../design/tools.css";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { ConfigDoctorView } from "../tools/ConfigDoctorView";
import { DeployCalculatorView } from "../tools/DeployCalculatorView";

type ActiveToolTab = "calculator" | "doctor";

function resolveToolTab(raw: string | null): ActiveToolTab {
  return raw === "doctor" ? "doctor" : "calculator";
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
            源码规则链的在线算账与起服务体检工具，支持直接跳转至对应章节与源码锚点。
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
        <span className="wt-workbench-tab-soon" data-testid="tools-tab-troubleshoot-preview">
          <span>③ 排障工作台</span>
          <span className="wt-workbench-soon-badge">Wave 4</span>
        </span>
        <span className="wt-workbench-tab-soon" data-testid="tools-tab-aicore-preview">
          <span>④ AI Core 算子实验室</span>
          <span className="wt-workbench-soon-badge">Wave 4</span>
        </span>
      </div>

      {activeTab === "calculator" ? (
        <DeployCalculatorView
          mode="full"
          title="「立项四问」双模部署算账台"
          summary="Mode A 用 7 级冷启动显存区间 + Roofline 回答「立项四问」；Mode B 粘贴真实 vllm serve 启动日志逐项对账（HCCL 不二次扣减）。"
        />
      ) : (
        <ConfigDoctorView
          mode="full"
          title="vllm serve 配置体检器"
          summary="基于 vllm-ascend v0.30.0 / main 源码规则，覆盖单实例与 P/D 分离双实例联检、静默改写对照与子系统快照。"
        />
      )}
    </main>
  );
}
