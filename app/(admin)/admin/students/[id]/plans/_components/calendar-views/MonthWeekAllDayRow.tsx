'use client';

/**
 * 월간 뷰 주별 AllDay/Spanning Bar 행
 *
 * GCal 패턴: 각 주의 day cell 위에 spanning bar를 CSS Grid span으로 렌더링
 * 주간 뷰의 AllDayRow + packAllDayRows 패턴을 월간 뷰에 맞게 축소
 */

import { memo, useMemo } from 'react';
import { AllDayItemBar } from '../items/AllDayItemBar';
import type { AllDayItem } from '@/lib/query-options/adminDock';

interface MonthWeekAllDayRowProps {
  weekDates: string[];
  allDayItemsByDate: Record<string, AllDayItem[]>;
  calendarColorMap?: Map<string, string>;
  onItemClick?: (item: AllDayItem, anchorRect: DOMRect) => void;
}

// ── Layout Types ──

interface MultiDayLayoutItem {
  item: AllDayItem;
  row: number;
  colStart: number;
  colSpan: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

// ── Bin-Packing Algorithm ──

function packMonthWeekAllDayRows(
  weekDates: string[],
  allDayItemsByDate: Record<string, AllDayItem[]>,
): MultiDayLayoutItem[] {
  const dateToCol = new Map(weekDates.map((d, i) => [d, i]));
  const numCols = 7;
  const firstDate = weekDates[0];
  const lastDate = weekDates[6];

  // 중복 제거 + colSpan 계산
  const seenIds = new Set<string>();
  const allItems: Array<Omit<MultiDayLayoutItem, 'row'>> = [];

  for (const date of weekDates) {
    for (const item of (allDayItemsByDate[date] ?? [])) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      const start = item.startDate ?? date;
      const end = item.endDate ?? start;
      const continuesBefore = start < firstDate;
      const continuesAfter = end > lastDate;
      const effectiveStart = continuesBefore ? 0 : (dateToCol.get(start) ?? 0);
      const effectiveEnd = continuesAfter ? numCols - 1 : (dateToCol.get(end) ?? numCols - 1);
      const colSpan = Math.max(1, effectiveEnd - effectiveStart + 1);

      allItems.push({ item, colStart: effectiveStart, colSpan, continuesBefore, continuesAfter });
    }
  }

  // 정렬: 넓은 span 먼저, 같으면 왼쪽 먼저
  allItems.sort((a, b) => b.colSpan - a.colSpan || a.colStart - b.colStart);

  // First-fit bin packing
  const rowOccupancy: boolean[][] = [];
  return allItems.map((layoutItem) => {
    let assignedRow = -1;
    for (let r = 0; r < rowOccupancy.length; r++) {
      let fits = true;
      for (let c = layoutItem.colStart; c < layoutItem.colStart + layoutItem.colSpan; c++) {
        if (c < numCols && rowOccupancy[r][c]) { fits = false; break; }
      }
      if (fits) { assignedRow = r; break; }
    }
    if (assignedRow === -1) {
      assignedRow = rowOccupancy.length;
      rowOccupancy.push(new Array(numCols).fill(false));
    }
    for (let c = layoutItem.colStart; c < layoutItem.colStart + layoutItem.colSpan; c++) {
      if (c < numCols) rowOccupancy[assignedRow][c] = true;
    }
    return { ...layoutItem, row: assignedRow };
  });
}

// ── Component ──

/** 월간 뷰에서 최대 표시 bar 행 수 */
const MAX_VISIBLE_ROWS = 2;
/** bar 1행 높이 (px) */
const BAR_ROW_HEIGHT = 20;
/** overflow 행 높이 (px) */
const OVERFLOW_ROW_HEIGHT = 14;

export const MonthWeekAllDayRow = memo(function MonthWeekAllDayRow({
  weekDates,
  allDayItemsByDate,
  calendarColorMap,
  onItemClick,
}: MonthWeekAllDayRowProps) {
  const layoutItems = useMemo(
    () => packMonthWeekAllDayRows(weekDates, allDayItemsByDate),
    [weekDates, allDayItemsByDate],
  );

  if (layoutItems.length === 0) return null;

  const totalRows = Math.max(...layoutItems.map((l) => l.row)) + 1;
  const visibleRows = Math.min(totalRows, MAX_VISIBLE_ROWS);
  const hasOverflow = totalRows > MAX_VISIBLE_ROWS;
  const hiddenCount = totalRows - visibleRows;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: `repeat(${visibleRows}, ${BAR_ROW_HEIGHT}px)${hasOverflow ? ` ${OVERFLOW_ROW_HEIGHT}px` : ''}`,
        gap: '1px 0',
        padding: '0 0 1px',
      }}
    >
      {layoutItems
        .filter((l) => l.row < visibleRows)
        .map((layout) => (
          <div
            key={layout.item.id}
            style={{
              gridColumn: `${layout.colStart + 1} / span ${layout.colSpan}`,
              gridRow: layout.row + 1,
              minWidth: 0,
            }}
          >
            <AllDayItemBar
              item={layout.item}
              calendarColor={calendarColorMap?.get(layout.item.calendarId ?? '')}
              colSpan={layout.colSpan}
              continuesBefore={layout.continuesBefore}
              continuesAfter={layout.continuesAfter}
              onClick={onItemClick}
            />
          </div>
        ))}

      {hasOverflow && (
        <div
          style={{ gridColumn: '1 / -1', gridRow: visibleRows + 1 }}
          className="flex items-center justify-center text-[10px] text-[var(--text-tertiary)]"
        >
          +{hiddenCount}행 더
        </div>
      )}
    </div>
  );
});
