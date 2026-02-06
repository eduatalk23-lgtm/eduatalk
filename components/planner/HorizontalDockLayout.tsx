'use client';

import React, { type ReactNode, type ReactElement, useState, useEffect } from 'react';
import type { DockType } from './CollapsedDockCard';

interface HorizontalDockLayoutProps {
  expandedDock: DockType;
  /** @deprecated 각 Dock 컴포넌트에서 onExpand로 처리됨 */
  onDockClick?: (dock: DockType) => void;
  unfinished: ReactNode;
  daily: ReactNode;
  weekly: ReactNode;
}

const DOCK_KEYS: DockType[] = ['unfinished', 'daily', 'weekly'];

// lg breakpoint (1024px) 기준으로 데스크톱/모바일 감지
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

/**
 * HorizontalDockLayout - 3-Dock 가로 아코디언 레이아웃
 *
 * 웹 (≥1024px): CSS flex + transition 기반 애니메이션
 *   - Framer Motion layout 대신 CSS transition-[flex]를 사용하여
 *     CSS transform이 발생하지 않음 (DnD DragOverlay position:fixed 호환)
 *   - 모든 flex 값이 동시에 변경되므로 자연스럽게 동기 애니메이션
 * 모바일 (<1024px): 세로 스택 (기존 방식, 항상 확장)
 *
 * 중요: 데스크톱/모바일 중 하나만 렌더링하여 @dnd-kit droppable 중복 등록 방지
 */
export function HorizontalDockLayout({
  expandedDock,
  unfinished,
  daily,
  weekly,
}: HorizontalDockLayoutProps) {
  const docks: Record<DockType, ReactNode> = { unfinished, daily, weekly };
  const isDesktop = useIsDesktop();

  // 초기 렌더 시 애니메이션 건너뛰기
  // @dnd-kit DragOverlay가 정확한 rect를 측정할 수 있도록
  // 페이지 로드 직후 flex 애니메이션을 비활성화하고, 마운트 후 활성화
  const [isInitialRender, setIsInitialRender] = useState(true);

  useEffect(() => {
    // 첫 렌더 후 짧은 지연 뒤 애니메이션 활성화
    const timer = requestAnimationFrame(() => {
      setIsInitialRender(false);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // 모바일에서는 isCollapsed를 false로 강제 (세로 스택에서는 항상 확장)
  const forceExpanded = (element: ReactNode): ReactNode => {
    if (!React.isValidElement(element)) return element;
    return React.cloneElement(element as ReactElement<{ isCollapsed?: boolean }>, {
      isCollapsed: false,
    });
  };

  // SSR/hydration 중에는 데스크톱 레이아웃 표시 (lg:flex와 일치)
  // 클라이언트에서 실제 화면 크기에 맞게 조건부 렌더링
  if (isDesktop === null) {
    // SSR: 데스크톱 레이아웃만 렌더 (모바일은 CSS로 숨김)
    return (
      <div
        className="hidden lg:flex gap-2 items-stretch"
        style={{
          minHeight: '300px',
          maxHeight: 'min(70vh, 700px)',
        }}
      >
        {DOCK_KEYS.map((key) => {
          const isExpanded = expandedDock === key;
          return (
            <div
              key={key}
              className="min-w-0 min-h-0 overflow-hidden"
              style={{
                flex: isExpanded ? '1 1 0%' : '0 0 120px',
                transition: 'none',
              }}
            >
              <div className="h-full">
                {docks[key]}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 클라이언트: 화면 크기에 따라 하나만 렌더링 (droppable 중복 방지)
  if (isDesktop) {
    return (
      <div
        className="flex gap-2 items-stretch"
        style={{
          minHeight: '300px',
          maxHeight: 'min(70vh, 700px)',
        }}
      >
        {DOCK_KEYS.map((key) => {
          const isExpanded = expandedDock === key;

          return (
            <div
              key={key}
              className="min-w-0 min-h-0 overflow-hidden"
              style={{
                flex: isExpanded ? '1 1 0%' : '0 0 120px',
                transition: isInitialRender ? 'none' : 'flex 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <div className="h-full">
                {docks[key]}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 모바일: 세로 스택 (항상 확장)
  return (
    <div className="space-y-4">
      {forceExpanded(unfinished)}
      {forceExpanded(daily)}
      {forceExpanded(weekly)}
    </div>
  );
}
