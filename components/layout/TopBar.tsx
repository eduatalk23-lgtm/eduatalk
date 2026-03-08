"use client";

import dynamic from "next/dynamic";
import { Search, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { topBarStyles, zIndexLayers } from "@/components/navigation/global/navStyles";
import { LogoSection } from "@/components/navigation/global/LogoSection";
import { WaffleMenu } from "./WaffleMenu";
import { ProfileMenu } from "./ProfileMenu";
import { useSidebar } from "./SidebarContext";
import { useTopBarCenterSlot } from "./TopBarCenterSlotContext";
import type { RoleBasedLayoutProps } from "./types";

const NotificationCenter = dynamic(
  () => import("@/components/notifications/NotificationCenter").then((m) => m.NotificationCenter),
  { ssr: false },
);

type TopBarProps = {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  userName?: string | null;
  profileImageUrl?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
};

export function TopBar({
  role,
  dashboardHref,
  roleLabel,
  userName,
  profileImageUrl,
  userEmail,
  userId,
  tenantInfo,
}: TopBarProps) {
  const { toggleMobile } = useSidebar();
  const { targetRef, isOccupied } = useTopBarCenterSlot();

  return (
    <header
      className={cn(topBarStyles.container)}
      style={{ zIndex: zIndexLayers.topBar }}
    >
      {/* 좌측: [Portal ☰] + [로고] + [Portal 컨트롤] (Google Calendar 순서) */}
      <div className={cn(
        "flex items-center",
        isOccupied ? "flex-1 min-w-0" : "shrink-0 gap-2"
      )}>
        {/* 모바일 햄버거 */}
        <button
          onClick={toggleMobile}
          className={cn(
            "md:hidden flex items-center justify-center p-2 rounded-md",
            "hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))]",
            "text-[var(--text-secondary)] transition-colors"
          )}
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Portal target - contents로 자식이 부모 flex에 참여 */}
        <div
          ref={targetRef}
          className={cn(
            isOccupied ? "contents" : "hidden"
          )}
        />

        {/* 로고 - portal 활성 시 order-1로 ☰ 뒤에 배치 */}
        <div className={cn(isOccupied && "order-1 shrink-0")}>
          <LogoSection
            dashboardHref={dashboardHref}
            roleLabel={roleLabel}
            variant="desktop"
          />
        </div>
      </div>

      {/* 중앙: 검색 pill (portal 비활성 시에만) */}
      {!isOccupied && (
        <div className="hidden md:flex flex-1 min-w-0 justify-center px-8">
          <button
            className={topBarStyles.searchPill}
            onClick={() => {
              const event = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
            }}
            aria-label="검색 열기 (⌘K)"
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">검색...</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] text-[var(--text-tertiary)]">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      {/* 우측: 알림 + 와플(데스크톱) + 프로필 */}
      <div className={cn("flex items-center gap-1 shrink-0", isOccupied && "order-4")}>
        {userId && <NotificationCenter userId={userId} />}
        <div className="hidden md:block">
          <WaffleMenu role={role} />
        </div>
        <ProfileMenu
          userName={userName}
          profileImageUrl={profileImageUrl}
          userEmail={userEmail}
          roleLabel={roleLabel}
          tenantInfo={tenantInfo}
          settingsHref={
            role === "admin" || role === "consultant" || role === "superadmin"
              ? "/admin/settings"
              : role === "parent"
                ? "/parent/settings"
                : "/settings"
          }
        />
      </div>
    </header>
  );
}
