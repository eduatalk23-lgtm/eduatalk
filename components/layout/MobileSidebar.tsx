"use client";

import { useRef } from "react";
import { useSidebar } from "./SidebarContext";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { layoutStyles, mobileNavStyles } from "@/components/navigation/global/navStyles";
import { LogoSection } from "@/components/navigation/global/LogoSection";
import { SharedSidebarContent } from "./SharedSidebarContent";
import { useSwipeGesture } from "./useSwipeGesture";
import type { RoleBasedLayoutProps } from "./types";

type MobileSidebarProps = {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
  userName?: string | null;
};

export function MobileSidebar({
  role,
  dashboardHref,
  roleLabel,
  tenantInfo,
  userName,
}: MobileSidebarProps) {
  const { isMobileOpen, toggleMobile, closeMobile } = useSidebar();
  const drawerRef = useRef<HTMLElement>(null);

  // 터치 제스처 처리 (Hook 사용)
  const { onTouchStart, onTouchMove, onTouchEnd, swipeProgress } = useSwipeGesture({
    onSwipeLeft: () => {
      if (isMobileOpen) {
        closeMobile();
      }
    },
    minSwipeDistance: 100,
  });

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
