"use client";

import { ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { CategoryNav } from "@/components/navigation/global/CategoryNav";
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";
import { TenantInfo } from "@/components/navigation/global/TenantInfo";
import { LogoSection } from "@/components/navigation/global/LogoSection";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useSidebar } from "./SidebarContext";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { mapRoleForNavigation } from "@/lib/navigation/utils";
import { layoutStyles, sidebarStyles, mobileNavStyles } from "@/components/navigation/global/navStyles";

type RoleBasedLayoutProps = {
  role: "student" | "admin" | "parent" | "consultant" | "superadmin";
  children: ReactNode;
  dashboardHref: string;
  roleLabel: string;
  showSidebar?: boolean;
  wrapper?: (children: ReactNode) => ReactNode;
  tenantInfo?: {
    name: string;
    type?: string;
  } | null;
};

function SharedSidebarContent({
  role,
  tenantInfo,
  isCollapsed,
  variant = "desktop",
  onNavigate,
}: {
  role: RoleBasedLayoutProps["role"];
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  isCollapsed: boolean;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  return (
    <>
      {tenantInfo && role !== "superadmin" && (
        <TenantInfo 
          tenantInfo={tenantInfo} 
          isCollapsed={isCollapsed} 
          variant={variant === "mobile" ? "mobile" : "sidebar"} 
        />
      )}
      <div className={sidebarStyles.navSection}>
        <CategoryNav
          role={mapRoleForNavigation(role)}
          onNavigate={onNavigate}
        />
      </div>
      <div className={sidebarStyles.footer}>
        <div 
          className={cn("transition-opacity", isCollapsed && variant === "desktop" && "opacity-0")}
          aria-hidden={isCollapsed && variant === "desktop"}
          hidden={isCollapsed && variant === "desktop"}
        >
          <div className={layoutStyles.flexBetween}>
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}

function SidebarContent({
  role,
  dashboardHref,
  roleLabel,
  tenantInfo,
  onNavigate,
}: {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  onNavigate?: () => void;
}) {
  const { isCollapsed, toggleCollapse } = useSidebar();

  return (
    <>
      {/* 로고 및 컨트롤 */}
      <div className={cn(sidebarStyles.header)}>
        <LogoSection
          dashboardHref={dashboardHref}
          roleLabel={roleLabel}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      <SharedSidebarContent
        role={role}
        tenantInfo={tenantInfo}
        isCollapsed={isCollapsed}
        variant="desktop"
        onNavigate={onNavigate}
      />
    </>
  );
}

function MobileSidebar({
  role,
  dashboardHref,
  roleLabel,
  tenantInfo,
}: {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
}) {
  const { isMobileOpen, toggleMobile, closeMobile } = useSidebar();
  const drawerRef = useRef<HTMLElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeProgress, setSwipeProgress] = useState<number>(0);

  // body 스크롤 잠금
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  // 터치 제스처 처리
  const minSwipeDistance = 100;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwipeProgress(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);
    
    // 스와이프 진행률 계산 (0-1)
    const distance = touchStart - currentX;
    if (distance > 0) {
      const progress = Math.min(distance / minSwipeDistance, 1);
      setSwipeProgress(progress);
    } else {
      setSwipeProgress(0);
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setSwipeProgress(0);
      return;
    }
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    if (isLeftSwipe && isMobileOpen) {
      closeMobile();
    }
    setSwipeProgress(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <>
      {/* 햄버거 버튼 */}
      <button
        onClick={toggleMobile}
        className={mobileNavStyles.hamburgerButton}
        aria-label="메뉴 열기"
        aria-expanded={isMobileOpen}
        aria-controls="mobile-sidebar"
      >
        <Menu className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* 오버레이 */}
      {isMobileOpen && (
        <div
          className={cn(
            swipeProgress > 0 ? mobileNavStyles.overlaySwipe : mobileNavStyles.overlay,
            swipeProgress > 0 && "transition-opacity duration-300"
          )}
          style={
            swipeProgress > 0
              ? { opacity: 0.5 * (1 - swipeProgress) }
              : undefined
          }
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* 드로어 */}
      <aside
        ref={drawerRef}
        id="mobile-sidebar"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={cn(
          mobileNavStyles.drawer,
          "fixed top-0 left-0 h-full w-64",
          isMobileOpen 
            ? swipeProgress > 0 
              ? "translate-x-[var(--swipe-progress)]" 
              : "translate-x-0"
            : "-translate-x-full",
          swipeProgress === 0 && "transition-transform duration-300 ease-in-out"
        )}
        style={
          isMobileOpen && swipeProgress > 0
            ? ({ "--swipe-progress": `${Math.max(0, -swipeProgress * 100)}%` } as React.CSSProperties & { "--swipe-progress": string })
            : undefined
        }
        role="navigation"
        aria-label="모바일 메뉴"
        aria-hidden={!isMobileOpen}
      >
        <div className={mobileNavStyles.header}>
          <div className={layoutStyles.flexBetween}>
            <LogoSection
              dashboardHref={dashboardHref}
              roleLabel={roleLabel}
              isCollapsed={false}
              onToggleCollapse={() => {}}
              variant="mobile"
            />
            <button
              onClick={closeMobile}
              className={mobileNavStyles.closeButton}
              aria-label="메뉴 닫기"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <SharedSidebarContent
          role={role}
          tenantInfo={tenantInfo}
          isCollapsed={false}
          variant="mobile"
          onNavigate={closeMobile}
        />
      </aside>
    </>
  );
}

export function RoleBasedLayout({
  role,
  children,
  dashboardHref,
  roleLabel,
  showSidebar = true,
  wrapper,
  tenantInfo,
}: RoleBasedLayoutProps) {
  const { isCollapsed } = useSidebar();

  const content = (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 사이드바 네비게이션 (데스크톱) */}
      {showSidebar && (
        <aside
          className={cn(
            sidebarStyles.container,
            "hidden md:block",
            isCollapsed ? "w-16" : "w-64"
          )}
        >
          <div className="sticky top-0 h-screen overflow-y-auto">
            <SidebarContent
              role={role}
              dashboardHref={dashboardHref}
              roleLabel={roleLabel}
              tenantInfo={tenantInfo}
            />
          </div>
        </aside>
      )}

      {/* 메인 콘텐츠 */}
      <main id="main-content" className="flex-1 flex flex-col">
        {/* 상단 네비게이션 (모바일용) */}
        {showSidebar && (
          <nav className={cn("md:hidden sticky top-0 z-50", layoutStyles.borderBottom, layoutStyles.bgWhite)}>
            <div className={cn("flex flex-col gap-2", layoutStyles.padding4)}>
              <div className={layoutStyles.flexBetween}>
                <LogoSection
                  dashboardHref={dashboardHref}
                  roleLabel={roleLabel}
                  isCollapsed={false}
                  onToggleCollapse={() => {}}
                  variant="mobile"
                />
                <MobileSidebar
                  role={role}
                  dashboardHref={dashboardHref}
                  roleLabel={roleLabel}
                  tenantInfo={tenantInfo}
                />
              </div>
              {/* 기관 정보 (모바일 - Superadmin 제외 모든 역할) */}
              {tenantInfo && role !== "superadmin" && (
                <TenantInfo tenantInfo={tenantInfo} variant="mobile-card" />
              )}
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

