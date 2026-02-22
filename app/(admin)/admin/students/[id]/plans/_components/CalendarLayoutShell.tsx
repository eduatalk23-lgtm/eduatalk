'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

interface CalendarLayoutShellProps {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** 외부에서 사이드바 상태를 제어할 때 사용 */
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const SIDEBAR_WIDTH = 280;

/**
 * Google Calendar 스타일 레이아웃 셸
 *
 * - 접기/펼치기 가능한 좌측 사이드바 (280px) + 메인 영역 (flex-1)
 * - 모바일(<1024px): 사이드바 오버레이 + 백드롭
 */
export function CalendarLayoutShell({
  header,
  sidebar,
  children,
  isSidebarOpen,
  onToggleSidebar,
}: CalendarLayoutShellProps) {
  const [isMobileOverlay, setIsMobileOverlay] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 반응형 감지
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobileOverlay(e.matches);
    };
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  // 모바일 백드롭 클릭 시 사이드바 닫기
  const handleBackdropClick = useCallback(() => {
    if (isSidebarOpen) onToggleSidebar();
  }, [isSidebarOpen, onToggleSidebar]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compact Header */}
      {header}

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isMobileOverlay && isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={handleBackdropClick}
          />
        )}

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={cn(
            'flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto overflow-x-hidden transition-all duration-200 ease-in-out',
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
              ? { width: SIDEBAR_WIDTH }
              : isMobileOverlay
                ? { width: SIDEBAR_WIDTH }
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
