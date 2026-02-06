"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";
import { LogoSection } from "@/components/navigation/global/LogoSection";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OfflineStatusIndicator } from "@/components/ui/OfflineStatusIndicator";
import { useSidebar } from "./SidebarContext";
import { Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { mapRoleForNavigation } from "@/lib/navigation/utils";
import { layoutStyles, sidebarStyles } from "@/components/navigation/global/navStyles";
// Framer Motion 제거: motion.aside/div의 CSS transform이 @dnd-kit DragOverlay의
// position:fixed를 깨뜨리는 문제 방지. CSS transition으로 대체.
import { SidebarContent } from "./SidebarContent";
import { MobileSidebar } from "./MobileSidebar";
import type { RoleBasedLayoutProps } from "./types";

export function RoleBasedLayout({
  role,
  children,
  dashboardHref,
  roleLabel,
  showSidebar = true,
  wrapper,
  tenantInfo,
  userName,
  userId,
}: RoleBasedLayoutProps) {
  const { isCollapsed, toggleCollapse } = useSidebar();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hover 핸들러 (Delay 적용)
  const handleMouseEnter = () => {
    if (!isCollapsed) return; // 고정된 상태면 무시
    
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 25); // 0.025초 지연 (빠른 반응)
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  };
  
  // Collapse 상태가 바뀌면 Hover 상태 초기화
  useEffect(() => {
    setIsHovered(false);
  }, [isCollapsed]);

  const content = (
    <div className="flex min-h-screen bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
      {/* 사이드바 네비게이션 (데스크톱) - Hover Overlay 패턴 적용 */}
      {showSidebar && (
        <>
          {/* 1. Layout Spacer: 본문 콘텐츠 위치를 잡기 위한 투명 공간 */}
          <div
            className="hidden md:block flex-shrink-0 transition-[width] duration-200 ease-in-out"
            style={{ width: isCollapsed ? "4rem" : "20rem" }}
          />

          {/* 2. Visual Panel: 실제 사이드바 UI (Hover 시 확장) */}
          <aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
              sidebarStyles.container,
              "hidden md:block fixed left-0 top-0 h-screen overflow-x-hidden",
              "transition-[width,box-shadow] duration-200 ease-in-out",
            )}
            style={{
              width: isCollapsed && !isHovered ? "4rem" : "20rem",
              zIndex: isCollapsed && isHovered ? 50 : 10,
              boxShadow: isCollapsed && isHovered
                ? "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
                : "none",
              borderRightWidth: isCollapsed && isHovered ? 0 : 1,
            }}
          >
            <div className="relative h-full flex flex-col w-[20rem] overflow-y-auto overscroll-y-contain"> {/* 내부 컨텐츠는 항상 20rem 너비 유지하여 찌그러짐 방지, 스크롤 가능, 스크롤 체이닝 방지 */}
              {/* Collapsed && Not Hovered: 햄버거 아이콘만 표시 */}
              {isCollapsed && !isHovered ? (
                <div className="flex flex-col items-center py-4 w-16"> {/* w-16 고정 */}
                  <button
                    className="p-2 rounded-md hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-secondary)]"
                    aria-label="메뉴 펼치기"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                /* Expanded or Hovered: 전체 사이드바 콘텐츠 */
                <SidebarContent
                  role={role}
                  dashboardHref={dashboardHref}
                  roleLabel={roleLabel}
                  tenantInfo={tenantInfo}
                  userName={userName}
                  userId={userId}
                  // 아이콘 모드(Icon Rail)를 사용하지 않고 항상 펼쳐진 UI 사용
                  isCollapsed={false}
                  onToggleCollapse={toggleCollapse}
                  // 고정 상태: isCollapsed=false면 고정됨
                  isPinned={!isCollapsed}
                />
              )}
            </div>
          </aside>
        </>
      )}

      {/* 메인 콘텐츠 */}
      <main id="main-content" className="flex-1 flex flex-col">
        {/* 상단 네비게이션 (모바일용) */}
        {showSidebar && (
          <nav className={cn("md:hidden sticky top-0 z-[40]", layoutStyles.borderBottom, layoutStyles.bgWhite)}>
            <div className={cn("flex flex-col gap-2", layoutStyles.padding4)}>
              <div className={layoutStyles.flexBetween}>
                <LogoSection
                  dashboardHref={dashboardHref}
                  roleLabel={roleLabel}
                  variant="mobile"
                />
                <div className="flex items-center gap-2">
                  {/* 오프라인 상태 표시 (모바일용 컴팩트) */}
                  <OfflineStatusIndicator variant="compact" />
                  {/* A1 개선: 인앱 알림 센터 */}
                  {userId && <NotificationCenter userId={userId} />}
                  <MobileSidebar
                    role={role}
                    dashboardHref={dashboardHref}
                    roleLabel={roleLabel}
                    tenantInfo={tenantInfo}
                    userName={userName}
                  />
                </div>
              </div>
            </div>
          </nav>
        )}

        {/* Breadcrumbs */}
        {showSidebar && (
          <Suspense fallback={null}>
            <Breadcrumbs role={mapRoleForNavigation(role)} />
          </Suspense>
        )}

        {/* 페이지 콘텐츠 - suppressHydrationWarning으로 hydration 불일치 방지 */}
        <div className="flex-1" suppressHydrationWarning>
          {children}
        </div>
      </main>
    </div>
  );

  return wrapper ? wrapper(content) : content;
}
