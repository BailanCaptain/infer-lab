import "../../design/tools.css";
import { type ResolvedToolDeepLink, resolveToolDeepLink } from "../../content/wiki/toolDeeplinks";
import type { ResolvedDoctorDeepLink } from "../../sim/doctor/configDoctor";

export type ToolDeepLinkItem = ResolvedToolDeepLink | ResolvedDoctorDeepLink;

export interface ToolDeepLinkChipProps {
  link: ToolDeepLinkItem;
}

export function ToolDeepLinkChip({ link }: ToolDeepLinkChipProps) {
  return (
    <a
      className="wt-deeplink"
      href={link.href}
      data-testid={`tool-deeplink-${link.canonicalId}`}
      data-legacy-baseline={link.isLegacyBaseline ? "true" : "false"}
    >
      <span className="wt-deeplink-label">{link.label}</span>
      {link.isLegacyBaseline && link.badgeText !== null && (
        <span className="wt-legacy-badge" data-testid="legacy-baseline-badge">
          {link.badgeText}
        </span>
      )}
    </a>
  );
}

export interface ToolDeepLinkByIdProps {
  pageId: string;
  anchor?: string | undefined;
  label?: string | undefined;
}

export function ToolDeepLinkById({ pageId, anchor, label }: ToolDeepLinkByIdProps) {
  const link = resolveToolDeepLink(pageId, { anchor, label });
  return <ToolDeepLinkChip link={link} />;
}
