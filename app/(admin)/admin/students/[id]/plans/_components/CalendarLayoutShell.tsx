'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  const [isMobileOverlay, setIsMobileOverlay] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 반응형 감지: mobile (<768), tablet (768-1023), desktop (1024+)
  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 767px)');
    const mqTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');

    const handleChange = () => {
      setIsMobileOverlay(mqMobile.matches);
      setIsTablet(mqTablet.matches);
    };
    handleChange();

    mqMobile.addEventListener('change', handleChange);
    mqTablet.addEventListener('change', handleChange);
    return () => {
      mqMobile.removeEventListener('change', handleChange);
      mqTablet.removeEventListener('change', handleChange);
    };
  }, []);

  // 모바일 백드롭 클릭 시 사이드바 닫기
  const handleBackdropClick = useCallback(() => {
    if (isSidebarOpen) onToggleSidebar();
  }, [isSidebarOpen, onToggleSidebar]);

  const sidebarWidth = isTablet ? SIDEBAR_WIDTH_TABLET : SIDEBAR_WIDTH_DESKTOP;

  return (
    <div className="h-full flex flex-col overflow-hidden pt-10 md:pt-0">
      {/* Compact Header */}
      {header && header}

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isMobileOverlay && isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden touch-none"
            onClick={handleBackdropClick}
            onTouchMove={(e) => e.preventDefault()}
          />
        )}

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={cn(
            'flex-shrink-0 bg-[var(--background)] border-r border-[rgb(var(--color-secondary-200))] overflow-y-auto overflow-x-hidden overscroll-y-contain transition-all duration-200 ease-in-out',
            // 모바일: JS 감지 전 깜빡임 방지 — 모바일에서는 초기에 숨기고 JS가 오버레이 모드 활성화 후 표시
            !isMobileOverlay && 'max-md:invisible',
            isMobileOverlay
              ? cn(
                  'fixed top-0 left-0 h-full z-50 shadow-xl',
                  isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )
              : isSidebarOpen
                ? ''
                : 'w-0 overflow-hidden border-r-0'
          )}
          style={
            isSidebarOpen && !isMobileOverlay
              ? { width: sidebarWidth }
              : isMobileOverlay
                ? { width: SIDEBAR_WIDTH_DESKTOP }
                : undefined
          }
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
