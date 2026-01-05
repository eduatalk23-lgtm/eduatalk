"use client";

import { ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { CategoryNav } from "@/components/navigation/global/CategoryNav";
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";
import { LogoSection } from "@/components/navigation/global/LogoSection";
import { SidebarUserSection } from "@/components/navigation/global/SidebarUserSection";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OfflineStatusIndicator } from "@/components/ui/OfflineStatusIndicator";
import { useSidebar } from "./SidebarContext";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { mapRoleForNavigation } from "@/lib/navigation/utils";
import { layoutStyles, sidebarStyles, mobileNavStyles, sidebarWidths } from "@/components/navigation/global/navStyles";

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
  userName?: string | null;
  /** A1 개선: 인앱 알림 센터에 사용할 userId */
  userId?: string | null;
};

function SharedSidebarContent({
  role,
  tenantInfo,
  variant = "desktop",
  onNavigate,
  roleLabel,
  userName,
}: {
  role: RoleBasedLayoutProps["role"];
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  roleLabel: string;
  userName?: string | null;
}) {
  return (
    <>
      <div className={sidebarStyles.navSection}>
        <CategoryNav
          role={mapRoleForNavigation(role)}
          onNavigate={onNavigate}
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

function SidebarContent({
  role,
  dashboardHref,
  roleLabel,
  tenantInfo,
  onNavigate,
  userName,
  userId,
}: {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  onNavigate?: () => void;
  userName?: string | null;
  userId?: string | null;
}) {
  return (
    <>
      {/* 로고 - 그림자 추가로 구분 */}
      <div className={cn(sidebarStyles.header, "shadow-sm")}>
        <div className="flex items-center justify-between w-full">
          <LogoSection
            dashboardHref={dashboardHref}
            roleLabel={roleLabel}
          />
          <div className="flex items-center gap-2">
            {/* 오프라인 상태 표시 */}
            <OfflineStatusIndicator variant="minimal" />
            {/* A1 개선: 데스크톱 알림 센터 */}
            {userId && <NotificationCenter userId={userId} />}
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
        />
      </div>
    </>
  );
}

function MobileSidebar({
  role,
  dashboardHref,
  roleLabel,
  tenantInfo,
  userName,
}: {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  userName?: string | null;
}) {
  const { isMobileOpen, toggleMobile, closeMobile } = useSidebar();
  const drawerRef = useRef<HTMLElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeProgress, setSwipeProgress] = useState<number>(0);

  // body 스크롤 잠금 및 포커스 트랩
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
      // 포커스를 드로어로 이동
      const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  // ESC 키로 드로어 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        closeMobile();
      }
    };

    if (isMobileOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isMobileOpen, closeMobile]);

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
            mobileNavStyles.overlay,
            swipeProgress > 0 && "transition-opacity duration-300"
          )}
          style={
            swipeProgress > 0
              ? { opacity: 0.5 * (1 - swipeProgress) }
              : undefined
          }
          onClick={closeMobile}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeMobile();
            }
          }}
          aria-hidden={!isMobileOpen}
          tabIndex={-1}
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
          isMobileOpen && swipeProgress === 0
            ? "translate-x-0"
            : !isMobileOpen
            ? "-translate-x-full"
            : "", // swipeProgress > 0일 때는 인라인 스타일 사용
          swipeProgress === 0 && "transition-transform duration-300 ease-in-out"
        )}
        style={
          isMobileOpen && swipeProgress > 0
            ? { transform: `translateX(${Math.max(-100, -swipeProgress * 100)}%)` }
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
          variant="mobile"
          onNavigate={closeMobile}
          roleLabel={roleLabel}
          userName={userName}
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
  userName,
  userId,
}: RoleBasedLayoutProps) {
  const content = (
    <div className="flex min-h-screen bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
      {/* 사이드바 네비게이션 (데스크톱) */}
      {showSidebar && (
        <aside
          className={cn(
            sidebarStyles.container,
            "hidden md:block",
            sidebarWidths.expanded
          )}
        >
          <div className="sticky top-0 h-screen overflow-y-auto">
            <SidebarContent
              role={role}
              dashboardHref={dashboardHref}
              roleLabel={roleLabel}
              tenantInfo={tenantInfo}
              userName={userName}
              userId={userId}
            />
          </div>
        </aside>
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

