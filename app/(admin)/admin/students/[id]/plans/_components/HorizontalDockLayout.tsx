'use client';

import React, { type ReactNode, type ReactElement } from 'react';
import type { DockType } from './CollapsedDockCard';

interface HorizontalDockLayoutProps {
  expandedDock: DockType;
  /** @deprecated 각 Dock 컴포넌트에서 onExpand로 처리됨 */
  onDockClick?: (dock: DockType) => void;
  unfinished: ReactNode;
  daily: ReactNode;
  weekly: ReactNode;
}

/**
 * HorizontalDockLayout - 3-Dock 가로 아코디언 레이아웃
 *
 * 웹 (≥1024px): 가로 그리드, 확장 독 1개 + 축소 독 2개 (120px)
 * 모바일 (<1024px): 세로 스택 (기존 방식, 항상 확장)
 */
export function HorizontalDockLayout({
  expandedDock,
  unfinished,
  daily,
  weekly,
}: HorizontalDockLayoutProps) {
  // 확장 상태에 따른 그리드 템플릿
  const gridTemplateColumns: Record<DockType, string> = {
    unfinished: '1fr 120px 120px',
    daily: '120px 1fr 120px',
    weekly: '120px 120px 1fr',
  };

  // 컨테이너 최대 높이 (콘텐츠 기반, 내부 스크롤)
  // min: 최소 높이, max: 최대 높이 (넘으면 내부 스크롤)
  const containerMinHeight = '300px';
  const containerMaxHeight = 'min(70vh, 700px)';

  // 모바일에서는 isCollapsed를 false로 강제 (세로 스택에서는 항상 확장)
  const forceExpanded = (element: ReactNode): ReactNode => {
    if (!React.isValidElement(element)) return element;
    return React.cloneElement(element as ReactElement<{ isCollapsed?: boolean }>, {
      isCollapsed: false,
    });
  };

  return (
    <>
      {/* 웹: 가로 그리드 - 콘텐츠 기반 높이 (min/max) */}
      <div
        className="hidden lg:grid gap-2 items-stretch"
        style={{
          gridTemplateColumns: gridTemplateColumns[expandedDock],
          minHeight: containerMinHeight,
          maxHeight: containerMaxHeight,
          // 그리드 전환 애니메이션 (특정 속성만 전환)
          transition: 'grid-template-columns 300ms ease-in-out',
        }}
      >
        <div className="min-w-0 min-h-0">{unfinished}</div>
        <div className="min-w-0 min-h-0">{daily}</div>
        <div className="min-w-0 min-h-0">{weekly}</div>
      </div>

      {/* 모바일: 세로 스택 (항상 확장) */}
      <div className="lg:hidden space-y-4">
        {forceExpanded(unfinished)}
        {forceExpanded(daily)}
        {forceExpanded(weekly)}
      </div>
    </>
  );
}
