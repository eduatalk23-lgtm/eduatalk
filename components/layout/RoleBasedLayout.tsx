"use client";

import { ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { CategoryNav } from "@/components/navigation/global/CategoryNav";
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";
import { LogoSection } from "@/components/navigation/global/LogoSection";
import { SidebarUserSection } from "@/components/navigation/global/SidebarUserSection";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OfflineStatusIndicator } from "@/components/ui/OfflineStatusIndicator";
import { useSidebar } from "./SidebarContext";
import { Menu, X, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { mapRoleForNavigation } from "@/lib/navigation/utils";
import { layoutStyles, sidebarStyles, mobileNavStyles, sidebarWidths } from "@/components/navigation/global/navStyles";
import { motion } from "framer-motion";

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
  isCollapsed,
}: {
  role: RoleBasedLayoutProps["role"];
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  roleLabel: string;
  userName?: string | null;
  /** 강제 collapsed 상태 (Hover 시 false 전달 위함) */
  isCollapsed?: boolean;
}) {
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

function SidebarContent({
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
}: {
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
}) {
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
          <motion.div 
            className="hidden md:block flex-shrink-0"
            initial={false}
            animate={{ width: isCollapsed ? "4rem" : "20rem" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          />

          {/* 2. Visual Panel: 실제 사이드바 UI (Hover 시 확장) */}
          <motion.aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            initial={false}
            animate={{ 
              width: isCollapsed && !isHovered ? "4rem" : "20rem",
              // Hover 확장 시 z-index와 그림자 처리 필요
              zIndex: isCollapsed && isHovered ? 50 : 10,
              boxShadow: isCollapsed && isHovered 
                ? "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" // shadow-xl
                : "none"
            }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={cn(
              sidebarStyles.container,
              "hidden md:block fixed left-0 top-0 h-screen overflow-hidden", // overflow-hidden 추가
              // width 클래스는 motion.animate로 제어하므로 제거
              // isCollapsed && isHovered 스타일도 motion.animate로 이동
            )}
            style={{
              borderRightWidth: isCollapsed && isHovered ? 0 : 1
            }}
          >
            <div className="relative h-full flex flex-col w-[20rem]"> {/* 내부 컨텐츠는 항상 20rem 너비 유지하여 찌그러짐 방지 */}
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
          </motion.aside>
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

