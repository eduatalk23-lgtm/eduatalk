"use client";

import { LogoSection } from "@/components/navigation/global/LogoSection";
import { SidebarUserSection } from "@/components/navigation/global/SidebarUserSection";
import { sidebarStyles } from "@/components/navigation/global/navStyles";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { SharedSidebarContent } from "./SharedSidebarContent";
import type { RoleBasedLayoutProps } from "./types";

type SidebarContentProps = {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  onNavigate?: () => void;
  userName?: string | null;
  userId?: string | null;
  /** 사이드바 접힘 상태 (UI 렌더링용) */
  isCollapsed?: boolean;
  /** 접힘/펼침 토글 함수 */
  onToggleCollapse?: () => void;
  /** 사이드바 고정 상태 (핀 아이콘 표시용) - true면 고정됨 */
  isPinned?: boolean;
};

export function SidebarContent({
  role,
  dashboardHref,
  roleLabel,
  tenantInfo,
  onNavigate,
  userName,
  userId,
  isCollapsed,
  onToggleCollapse,
  /** 실제 Context의 isCollapsed 상태 (핀 아이콘 표시용) */
  isPinned,
}: SidebarContentProps) {
  return (
    <>
      {/* 로고 - 그림자 추가로 구분 */}
      <div className={cn(sidebarStyles.header, "shadow-sm")}>
        <div className="flex items-center justify-between w-full">
          {/* 로고 + 핀 버튼 그룹 */}
          <div className="flex items-center gap-2">
            <LogoSection
              dashboardHref={dashboardHref}
              roleLabel={roleLabel}
              isCollapsed={isCollapsed}
            />
            {/* 토글 버튼 (데스크톱 전용) - 로고 옆에 배치 */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className={cn(
                  "hidden md:flex items-center justify-center p-1.5 rounded-md transition-colors",
                  isPinned
                    ? "text-primary-600 hover:bg-primary-50 hover:text-primary-700"
                    : "text-[var(--text-tertiary)] hover:bg-[rgb(var(--color-secondary-100))] hover:text-[var(--text-primary)]"
                )}
                aria-label={isPinned ? "사이드바 고정 해제" : "사이드바 고정"}
                title={isPinned ? "사이드바 고정 해제" : "사이드바 고정"}
              >
                {isPinned ? (
                  <PinOff className="w-4 h-4" />
                ) : (
                  <Pin className="w-4 h-4 rotate-45" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 사용자 정보 섹션 - 배경색 조정 */}
      <div className="bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
        <SidebarUserSection
          roleLabel={roleLabel}
          userName={userName}
          tenantInfo={tenantInfo && role !== "superadmin" ? tenantInfo : null}
          variant="desktop"
          userId={userId}
        />
      </div>

      {/* 네비게이션 메뉴 - 구분선 추가 */}
      <div className={cn(
        "border-t border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]"
      )}>
        <SharedSidebarContent
          role={role}
          tenantInfo={tenantInfo}
          variant="desktop"
          onNavigate={onNavigate}
          roleLabel={roleLabel}
          userName={userName}
          isCollapsed={isCollapsed}
        />
      </div>
    </>
  );
}
