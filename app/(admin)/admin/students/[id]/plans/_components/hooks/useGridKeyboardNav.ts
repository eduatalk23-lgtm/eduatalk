'use client';

import { useEffect, type RefObject } from 'react';

/**
 * 그리드 키보드 네비게이션 훅
 *
 * Arrow Up/Down: 같은 컬럼(날짜) 내 이전/다음 이벤트 블록으로 포커스 이동
 * Arrow Left/Right: 인접 컬럼의 유사 시간대 이벤트로 포커스 이동 (주간뷰)
 *
 * 전제 조건:
 * - 이벤트 블록에 `data-grid-block` 속성 필요
 * - 주간뷰 컬럼에 `role="gridcell"` 필요 (Left/Right 네비게이션)
 */
export function useGridKeyboardNav(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      const active = document.activeElement as HTMLElement;
      if (!active || !container.contains(active)) return;
      if (!active.hasAttribute('data-grid-block')) return;

      e.preventDefault(); // 스크롤 방지

      // 현재 블록이 속한 컬럼 찾기 (주간뷰: gridcell, 일간뷰: 부모 요소)
      const currentColumn =
        active.closest('[role="gridcell"]') ?? active.parentElement;
      if (!currentColumn) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // 같은 컬럼 내 이전/다음 블록 (top 기준 정렬)
        const columnBlocks = Array.from(
          currentColumn.querySelectorAll('[data-grid-block]'),
        ) as HTMLElement[];

        // offsetTop 기준 정렬 (DOM 순서가 시간순이 아닐 수 있으므로)
        columnBlocks.sort((a, b) => a.offsetTop - b.offsetTop);

        const idx = columnBlocks.indexOf(active);
        if (idx === -1) return;

        const nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(idx + 1, columnBlocks.length - 1)
            : Math.max(idx - 1, 0);

        if (nextIdx !== idx) {
          columnBlocks[nextIdx].focus();
          columnBlocks[nextIdx].scrollIntoView({
            block: 'nearest',
            behavior: 'smooth',
          });
        }
      } else {
        // ArrowLeft/Right: 인접 컬럼으로 이동
        const columns = Array.from(
          container.querySelectorAll('[role="gridcell"]'),
        ) as HTMLElement[];

        if (columns.length <= 1) return; // 일간뷰에서는 무시

        const colIdx = columns.indexOf(currentColumn as HTMLElement);
        if (colIdx === -1) return;

        const nextColIdx =
          e.key === 'ArrowRight'
            ? Math.min(colIdx + 1, columns.length - 1)
            : Math.max(colIdx - 1, 0);

        if (nextColIdx === colIdx) return;

        const nextColumn = columns[nextColIdx];
        const nextBlocks = Array.from(
          nextColumn.querySelectorAll('[data-grid-block]'),
        ) as HTMLElement[];

        if (nextBlocks.length === 0) return;

        // 현재 블록과 가장 가까운 수직 위치의 블록 찾기
        const activeTop = active.offsetTop;
        let closest = nextBlocks[0];
        let closestDist = Math.abs(nextBlocks[0].offsetTop - activeTop);

        for (let i = 1; i < nextBlocks.length; i++) {
          const dist = Math.abs(nextBlocks[i].offsetTop - activeTop);
          if (dist < closestDist) {
            closest = nextBlocks[i];
            closestDist = dist;
          }
        }

        closest.focus();
        closest.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, enabled]);
}
