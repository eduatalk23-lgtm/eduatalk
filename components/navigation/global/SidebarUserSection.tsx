"use client";

import { cn } from "@/lib/cn";
import { layoutStyles, sidebarStyles } from "@/components/navigation/global/navStyles";
import { User, Building2 } from "lucide-react";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type SidebarUserSectionProps = {
  roleLabel: string;
  userName?: string | null;
  tenantInfo?: {
    name: string;
    type?: string;
  } | null;
  variant?: "desktop" | "mobile";
};

/**
 * 사이드바 사용자 정보 섹션
 * 테넌트, 사용자 유형, 이름, 로그아웃, 테마 토글을 통합 관리
 * 웹 환경에서는 상단에 배치, 모바일에서는 하단에 배치
 */
export function SidebarUserSection({
  roleLabel,
  userName,
  tenantInfo,
  variant = "desktop",
}: SidebarUserSectionProps) {

  if (variant === "mobile") {
    return (
      <div className={cn(
        layoutStyles.borderTop,
        layoutStyles.bgWhite,
        "p-4 space-y-3"
      )}>
        {/* 테넌트 정보 */}
        {tenantInfo && (
          <div className={cn(
            layoutStyles.flexCenter,
            "gap-2 px-3 py-2 rounded-lg",
            layoutStyles.bgGray50
          )}>
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-body-2 font-semibold truncate",
                layoutStyles.textHeading
              )}>
                {tenantInfo.name}
              </p>
            </div>
          </div>
        )}

        {/* 사용자 정보 */}
        <div className={cn(
          layoutStyles.flexCenter,
          "gap-2 px-3 py-2 rounded-lg",
          layoutStyles.bgGray50
        )}>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            "bg-primary-100 dark:bg-primary-900/30",
            "text-primary-700 dark:text-primary-300"
          )}>
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <p className={cn(
              "text-body-2 font-semibold truncate",
              layoutStyles.textHeading
            )}>
              {userName || "사용자"}
            </p>
            <span className={cn(
              "text-body-2 truncate",
              layoutStyles.textMuted
            )}>
              · {roleLabel}
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className={cn(layoutStyles.flexBetween, "gap-2")}>
          <SignOutButton variant="compact" />
          <ThemeToggle />
        </div>
      </div>
    );
  }

  // Desktop variant - 상단에 배치
  return (
    <div className={cn(
      layoutStyles.borderBottom,
      layoutStyles.bgWhite,
      "p-3 flex flex-col gap-2"
    )}>
      {/* 테넌트 정보와 사용자 정보 세로 배치 */}
      <div className="flex flex-col gap-2">
        {/* 테넌트 정보 */}
        {tenantInfo && (
          <div className={cn(
            layoutStyles.flexCenter,
            "gap-2 px-3 py-2 rounded-lg",
            "bg-transparent hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]",
            "cursor-default",
            layoutStyles.transition
          )}>
            <Building2 
              className={cn(
                "w-4 h-4 flex-shrink-0",
                "text-[var(--text-secondary)] dark:text-[var(--text-tertiary)]"
              )} 
            />
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <p className={cn(
                "text-body-2 font-semibold truncate",
                layoutStyles.textHeading
              )}>
                {tenantInfo.name}
              </p>
              {tenantInfo.type && (
                <span className={cn(
                  "text-sm truncate",
                  layoutStyles.textMuted
                )}>
                  · {tenantInfo.type}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 사용자 정보 */}
        <div className={cn(
          layoutStyles.flexCenter,
          "gap-2 px-3 py-2 rounded-lg",
          "bg-transparent hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]",
          "cursor-default",
          layoutStyles.transition
        )}>
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            "bg-primary-100 dark:bg-primary-900/30",
            "text-primary-700 dark:text-primary-300"
          )}>
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <p className={cn(
              "text-body-2 font-semibold truncate",
              layoutStyles.textHeading
            )}>
              {userName || "사용자"}
            </p>
            <span className={cn(
              "text-sm truncate",
              layoutStyles.textMuted
            )}>
              · {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 액션 버튼 그룹 - 구분선 추가 */}
      <div className={cn(
        "pt-2 border-t border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",
        layoutStyles.flexBetween, 
        "gap-2"
      )}>
        <SignOutButton variant="compact" />
        <ThemeToggle />
      </div>
    </div>
  );
}
