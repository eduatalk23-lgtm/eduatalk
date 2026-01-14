"use client";

import { CategoryNav } from "@/components/navigation/global/CategoryNav";
import { SidebarUserSection } from "@/components/navigation/global/SidebarUserSection";
import { mapRoleForNavigation } from "@/lib/navigation/utils";
import { sidebarStyles } from "@/components/navigation/global/navStyles";
import type { RoleBasedLayoutProps } from "./types";

type SharedSidebarContentProps = {
  role: RoleBasedLayoutProps["role"];
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  roleLabel: string;
  userName?: string | null;
  /** 강제 collapsed 상태 (Hover 시 false 전달 위함) */
  isCollapsed?: boolean;
};

export function SharedSidebarContent({
  role,
  tenantInfo,
  variant = "desktop",
  onNavigate,
  roleLabel,
  userName,
  isCollapsed,
}: SharedSidebarContentProps) {
  return (
    <>
      <div className={sidebarStyles.navSection}>
        <CategoryNav
          role={mapRoleForNavigation(role)}
          onNavigate={onNavigate}
          isCollapsed={isCollapsed}
        />
      </div>
      {variant === "mobile" && (
        <SidebarUserSection
          roleLabel={roleLabel}
          userName={userName}
          tenantInfo={tenantInfo && role !== "superadmin" ? tenantInfo : null}
          variant={variant}
        />
      )}
    </>
  );
}
