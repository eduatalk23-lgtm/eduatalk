"use client";

import { layoutStyles } from "./navStyles";

type LogoSectionProps = {
  dashboardHref: string;
  roleLabel: string;
  variant?: "desktop" | "mobile";
  isCollapsed?: boolean;
};

export function LogoSection({
  dashboardHref,
  roleLabel,
  variant = "desktop",
  isCollapsed = false,
}: LogoSectionProps) {
  return (
    <div className={layoutStyles.flexBetween}>
      <a
        href={dashboardHref}
        className={`${layoutStyles.flexCenter} text-h2 font-semibold ${layoutStyles.textHeading}`}
      >
        <span>⏱️</span>
        {!isCollapsed && <span>TimeLevelUp</span>}
      </a>
    </div>
  );
}

