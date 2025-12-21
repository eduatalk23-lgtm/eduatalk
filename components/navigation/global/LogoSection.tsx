"use client";

import { layoutStyles } from "./navStyles";

type LogoSectionProps = {
  dashboardHref: string;
  roleLabel: string;
  variant?: "desktop" | "mobile";
};

export function LogoSection({
  dashboardHref,
  roleLabel,
  variant = "desktop",
}: LogoSectionProps) {
  return (
    <div className={layoutStyles.flexBetween}>
      <a
        href={dashboardHref}
        className={`${layoutStyles.flexCenter} text-h2 font-semibold ${layoutStyles.textHeading}`}
      >
        <span>⏱️</span>
        <span>TimeLevelUp</span>
      </a>
    </div>
  );
}

