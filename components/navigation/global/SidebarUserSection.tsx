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
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-body-2 font-semibold truncate",
              layoutStyles.textHeading
            )}>
              {userName || "사용자"}
            </p>
            <p className={cn(
              "text-body-2 truncate",
              layoutStyles.textMuted
            )}>
              {roleLabel}
            </p>
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
      "p-4 flex flex-col gap-3"
    )}>
      {/* 테넌트 정보 */}
      {tenantInfo && (
        <div className={cn(
          layoutStyles.flexCenter,
          "gap-2 px-3 py-2 rounded-lg",
          layoutStyles.bgGray50
        )}>
          <Building2 
            className={cn(
              "w-4 h-4 flex-shrink-0",
              layoutStyles.textSecondary
            )} 
          />
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-body-2 font-semibold truncate",
              layoutStyles.textHeading
            )}>
              {tenantInfo.name}
            </p>
            {tenantInfo.type && (
              <p className={cn(
                "text-body-2 truncate",
                layoutStyles.textMuted
              )}>
                {tenantInfo.type}
              </p>
            )}
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
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-body-2 font-semibold truncate",
            layoutStyles.textHeading
          )}>
            {userName || "사용자"}
          </p>
          <p className={cn(
            "text-body-2 truncate",
            layoutStyles.textMuted
          )}>
            {roleLabel}
          </p>
        </div>
      </div>

      {/* 액션 버튼 그룹 */}
      <div className={cn(layoutStyles.flexBetween, "gap-2")}>
        <SignOutButton variant="compact" />
        <ThemeToggle />
      </div>
    </div>
  );
}

