'use client';

import { useState, useSyncExternalStore, useRef, useMemo } from 'react';
import { cn } from '@/lib/cn';

interface CalendarLayoutShellProps {
  header?: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** 외부에서 사이드바 상태를 제어할 때 사용 */
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/** 데스크톱(lg+) 사이드바 너비 */
const SIDEBAR_WIDTH_DESKTOP = 280;
/** 태블릿(md~lg) 사이드바 너비 */
const SIDEBAR_WIDTH_TABLET = 220;

// --- Breakpoint (useSyncExternalStore) ---
type BreakpointValue = 'mobile' | 'tablet' | 'desktop';

function getBreakpoint(): BreakpointValue {
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  if (window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches)
    return 'tablet';
  return 'desktop';
}

function subscribeBreakpoint(callback: () => void) {
  const mqMobile = window.matchMedia('(max-width: 767px)');
  const mqTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
  mqMobile.addEventListener('change', callback);
  mqTablet.addEventListener('change', callback);
  return () => {
    mqMobile.removeEventListener('change', callback);
    mqTablet.removeEventListener('change', callback);
  };
}

/**
 * Google Calendar 스타일 레이아웃 셸
 *
 * - 모바일(<768px): 사이드바 오버레이 + 백드롭
 * - 태블릿(768~1024px): 축소 사이드바 (220px) + 메인 영역
 * - 데스크톱(1024px+): 전체 사이드바 (280px) + 메인 영역
 */
export function CalendarLayoutShell({
  header,
  sidebar,
  children,
  isSidebarOpen,
  onToggleSidebar,
}: CalendarLayoutShellProps) {
  // SSR: null → 마운트 전(CSS 숨김), Client: 실제 breakpoint
  const breakpoint = useSyncExternalStore<BreakpointValue | null>(
    subscribeBreakpoint,
    getBreakpoint,
    () => null
  );

  const mounted = breakpoint !== null;
  const isMobileOverlay = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const sidebarRef = useRef<HTMLDivElement>(null);

  // --- 모바일 초기 사이드바 닫힘 (getDerivedStateFromProps 패턴) ---
  // 사용자가 명시적으로 토글하기 전까지 모바일에서 사이드바 강제 닫힘
  const [mobileDismissed, setMobileDismissed] = useState(true);
  const [prevOpen, setPrevOpen] = useState(isSidebarOpen);

  if (prevOpen !== isSidebarOpen) {
    setPrevOpen(isSidebarOpen);
    if (mobileDismissed) setMobileDismissed(false);
  }

  // 모바일 + 아직 토글 안 함 → 강제 닫힘; 그 외 → prop 따름
  const effectiveOpen =
    isMobileOverlay && mobileDismissed ? false : isSidebarOpen;

  const sidebarWidth = isTablet ? SIDEBAR_WIDTH_TABLET : SIDEBAR_WIDTH_DESKTOP;

  const sidebarStyle = useMemo(() => {
    if (isMobileOverlay) return { width: SIDEBAR_WIDTH_DESKTOP };
    if (effectiveOpen) return { width: sidebarWidth };
    return undefined;
  }, [isMobileOverlay, effectiveOpen, sidebarWidth]);

  return (
    <div className="h-full flex flex-col overflow-hidden pt-10 md:pt-0">
      {/* Compact Header */}
      {header && header}

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isMobileOverlay && effectiveOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden touch-none"
            onClick={onToggleSidebar}
            onTouchMove={(e) => e.preventDefault()}
          />
        )}

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={cn(
            'flex-shrink-0 bg-[var(--background)] border-r border-[rgb(var(--color-secondary-200))] overflow-y-auto overflow-x-hidden overscroll-y-contain',
            // 트랜지션: 마운트 후에만 적용 (초기 깜빡임 방지), width/transform만 전환
            mounted && 'transition-[width,transform] duration-200 ease-in-out',
            // 마운트 전: CSS로 모바일에서 숨김 (SSR → hydration 기간)
            !mounted && 'max-md:hidden',
            isMobileOverlay
              ? cn(
                  'fixed top-0 left-0 h-full z-50 shadow-xl',
                  effectiveOpen ? 'translate-x-0' : '-translate-x-full'
                )
              : effectiveOpen
                ? ''
                : 'w-0 overflow-hidden border-r-0'
          )}
          style={sidebarStyle}
        >
          {sidebar}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Calendar / Tab Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
