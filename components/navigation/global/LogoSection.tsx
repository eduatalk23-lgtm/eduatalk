"use client";

import { layoutStyles } from "./navStyles";

type LogoSectionProps = {
  dashboardHref: string;
  roleLabel: string;
  isCollapsed: boolean; // 웹 환경에서는 사용하지 않지만 호환성을 위해 유지
  onToggleCollapse: () => void; // 웹 환경에서는 사용하지 않지만 호환성을 위해 유지
  variant?: "desktop" | "mobile";
};

export function LogoSection({
  dashboardHref,
  roleLabel,
  isCollapsed,
  onToggleCollapse,
  variant = "desktop",
}: LogoSectionProps) {
  if (variant === "mobile") {
    return (
      <div className={layoutStyles.flexBetween}>
        <a
          href={dashboardHref}
          className={`${layoutStyles.flexCenter} text-h2 font-semibold ${layoutStyles.textHeading}`}
        >
          <span>⏱️</span>
          <span>TimeLevelUp</span>
          <span className={`ml-2 text-body-2 ${layoutStyles.textMuted}`}>{roleLabel}</span>
        </a>
      </div>
    );
  }

  // 웹 환경에서는 접기 버튼 제거 (항상 펼쳐진 상태)
  return (
    <div className={layoutStyles.flexBetween}>
      <a
        href={dashboardHref}
        className={`${layoutStyles.flexCenter} text-h2 font-semibold ${layoutStyles.textHeading}`}
      >
        <span>⏱️</span>
        <span>TimeLevelUp</span>
        <span className={`text-body-2 ${layoutStyles.textMuted}`}>{roleLabel}</span>
      </a>
    </div>
  );
}

