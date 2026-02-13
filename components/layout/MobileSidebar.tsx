"use client";

import { useRef, useState, useEffect } from "react";
import { useSidebar } from "./SidebarContext";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { layoutStyles, mobileNavStyles } from "@/components/navigation/global/navStyles";
import { LogoSection } from "@/components/navigation/global/LogoSection";
import { SharedSidebarContent } from "./SharedSidebarContent";
import { useSwipeGesture } from "./useSwipeGesture";
import { easings } from "@/lib/styles/animations";
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

  // 오버레이 마운트/애니메이션 상태 (fade in/out)
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (isMobileOpen) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect, react-hooks/set-state-in-effect -- 트랜지션을 위해 동기 마운트 필수
      setOverlayMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setOverlayVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- 트랜지션을 위해 동기 해제 필수
    setOverlayVisible(false);
    const timer = setTimeout(() => setOverlayMounted(false), 200);
    return () => clearTimeout(timer);
  }, [isMobileOpen]);

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

      {/* 오버레이 (fade in/out) */}
      {overlayMounted && (
        <div
          className="fixed inset-0 bg-black z-[45] md:hidden"
          style={{
            opacity: swipeProgress > 0
              ? 0.5 * (1 - swipeProgress)
              : overlayVisible ? 0.5 : 0,
            transition: swipeProgress === 0
              ? overlayVisible
                ? `opacity 200ms ${easings.easeOut}`
                : `opacity 150ms ${easings.easeIn}`
              : "none",
          }}
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
        )}
        style={{
          ...(swipeProgress === 0
            ? {
                transition: isMobileOpen
                  ? `transform 300ms ${easings.emphasizedDecelerate}`
                  : `transform 250ms ${easings.emphasizedAccelerate}`,
              }
            : undefined),
          ...(isMobileOpen && swipeProgress > 0
            ? { transform: `translateX(${Math.max(-100, -swipeProgress * 100)}%)` }
            : undefined),
        }}
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
          isCollapsed={false}  // 모바일은 항상 펼쳐진 상태
        />
      </aside>
    </>
  );
}
