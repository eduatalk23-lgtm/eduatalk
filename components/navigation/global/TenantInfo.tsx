"use client";

import { cn } from "@/lib/cn";
import { layoutStyles } from "./navStyles";

type TenantInfoProps = {
  tenantInfo: {
    name: string;
    type?: string;
  };
  isCollapsed?: boolean;
  variant?: "sidebar" | "mobile" | "mobile-card";
};

export function TenantInfo({ tenantInfo, isCollapsed, variant = "sidebar" }: TenantInfoProps) {
  if (variant === "mobile-card") {
    return (
      <div className={`rounded-lg ${layoutStyles.bgGray50} px-3 py-2`}>
        <div className={layoutStyles.flexCenter}>
          <span className="text-sm">🏢</span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold ${layoutStyles.textHeading} truncate`}>
              {tenantInfo.name}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${layoutStyles.borderBottom} ${layoutStyles.bgGray50} ${variant === "mobile" ? layoutStyles.padding3 : layoutStyles.padding3}`}>
      <div className={layoutStyles.flexCenter}>
        <span className={`text-sm ${variant === "mobile" ? "" : "flex-shrink-0"}`}>🏢</span>
        <div
          className={cn(
            "flex-1 min-w-0",
            variant === "mobile" ? "" : "transition-opacity",
            isCollapsed && variant !== "mobile" && "opacity-0 w-0 overflow-hidden"
          )}
        >
          <div className={`text-sm font-semibold ${layoutStyles.textHeading} truncate`}>
            {tenantInfo.name}
          </div>
        </div>
      </div>
    </div>
  );
}

