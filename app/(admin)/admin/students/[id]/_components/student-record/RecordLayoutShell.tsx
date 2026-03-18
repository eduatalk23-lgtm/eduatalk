"use client";

import { useState, useSyncExternalStore, useRef, useMemo, useEffect } from "react";
import { cn } from "@/lib/cn";

interface RecordLayoutShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** 오른쪽 패널 (Icon Rail + SidePanel) — 캘린더와 동일 구조 */
  rightPanel?: React.ReactNode;
}

/** 데스크톱(lg+) 사이드바 너비 */
const SIDEBAR_WIDTH_DESKTOP = 260;
/** 태블릿(md~lg) 사이드바 너비 */
const SIDEBAR_WIDTH_TABLET = 220;

// --- Breakpoint (useSyncExternalStore) ---
type BreakpointValue = "mobile" | "tablet" | "desktop";

function getBreakpoint(): BreakpointValue {
  if (window.matchMedia("(max-width: 767px)").matches) return "mobile";
  if (window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches)
    return "tablet";
  return "desktop";
}

function subscribeBreakpoint(callback: () => void) {
  const mqMobile = window.matchMedia("(max-width: 767px)");
  const mqTablet = window.matchMedia(
    "(min-width: 768px) and (max-width: 1023px)",
  );
  mqMobile.addEventListener("change", callback);
  mqTablet.addEventListener("change", callback);
  return () => {
    mqMobile.removeEventListener("change", callback);
    mqTablet.removeEventListener("change", callback);
  };
}

/**
 * 생기부 문서형 뷰 레이아웃 셸
 *
 * CalendarLayoutShell 패턴 차용:
 * - 모바일(<768px): 사이드바 오버레이 + 백드롭
 * - 태블릿(768~1024px): 축소 사이드바 (220px) + 메인 영역
 * - 데스크톱(1024px+): 전체 사이드바 (260px) + 메인 영역
 */
export function RecordLayoutShell({
  sidebar,
  children,
  isSidebarOpen,
  onToggleSidebar,
  rightPanel,
}: RecordLayoutShellProps) {
  const breakpoint = useSyncExternalStore<BreakpointValue | null>(
    subscribeBreakpoint,
    getBreakpoint,
    () => null,
  );

  const mounted = breakpoint !== null;
  const isMobileOverlay = breakpoint === "mobile";
  const isTablet = breakpoint === "tablet";
  const sidebarRef = useRef<HTMLDivElement>(null);

  // --- 모바일 초기 사이드바 닫힘 ---
  const [mobileDismissed, setMobileDismissed] = useState(true);
  const [prevOpen, setPrevOpen] = useState(isSidebarOpen);

  if (prevOpen !== isSidebarOpen) {
    setPrevOpen(isSidebarOpen);
    if (mobileDismissed) setMobileDismissed(false);
  }

  const effectiveOpen =
    isMobileOverlay && mobileDismissed ? false : isSidebarOpen;

  const sidebarWidth = isTablet ? SIDEBAR_WIDTH_TABLET : SIDEBAR_WIDTH_DESKTOP;

  // 내부 스크롤만 사용 — html의 scrollbar-gutter: stable 비활성화
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollbarGutter;
    html.style.scrollbarGutter = "auto";
    return () => {
      html.style.scrollbarGutter = prev;
    };
  }, []);

  const sidebarStyle = useMemo(() => {
    if (isMobileOverlay) return { width: SIDEBAR_WIDTH_DESKTOP };
    if (effectiveOpen) return { width: sidebarWidth };
    return undefined;
  }, [isMobileOverlay, effectiveOpen, sidebarWidth]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Mobile Backdrop */}
      {isMobileOverlay && effectiveOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 touch-none md:hidden"
          onClick={onToggleSidebar}
          onTouchMove={(e) => e.preventDefault()}
        />
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          "flex-shrink-0 overflow-y-auto overflow-x-hidden overscroll-y-contain border-r border-[var(--border-secondary)] bg-[var(--surface-secondary)]",
          mounted && "transition-[width,transform] duration-200 ease-in-out",
          !mounted && "max-md:hidden",
          isMobileOverlay
            ? cn(
                "fixed top-0 left-0 z-50 h-full shadow-xl",
                effectiveOpen ? "translate-x-0" : "-translate-x-full",
              )
            : effectiveOpen
              ? ""
              : "w-0 overflow-hidden",
        )}
        style={sidebarStyle}
      >
        {sidebar}
      </div>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
        {children}
      </div>

      {/* Right Panel (Icon Rail + SidePanel) */}
      {rightPanel}
    </div>
  );
}
