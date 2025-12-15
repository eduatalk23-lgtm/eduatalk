import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { VariableSizeList as List } from "react-window";
import type { DailySchedule, Plan } from "./scheduleTypes";
import type { ContentData, BlockData } from "../../utils/scheduleTransform";
import { MeasureRow } from "./MeasureRow";
import { WeekSection } from "./WeekSection";

// 주차별 그룹화 컴포넌트
export function ScheduleListByWeek({
  height,
  width,
  schedules,
  plansByDate,
  contents,
  blocks,
  sequenceMap,
  expandedDates,
  onToggleDate,
}: {
  height: number;
  width: number;
  schedules: DailySchedule[];
  plansByDate: Map<string, Plan[]>;
  contents: Map<string, ContentData>;
  blocks: BlockData[];
  sequenceMap: Map<string, number>;
  expandedDates: Map<string, boolean>;
  onToggleDate: (date: string) => void;
}) {
  // 주차별로 그룹화
  const schedulesByWeek = useMemo(() => {
    const map = new Map<number | undefined, DailySchedule[]>();
    for (const schedule of schedules) {
      const weekNum = schedule.week_number;
      if (!map.has(weekNum)) {
        map.set(weekNum, []);
      }
      map.get(weekNum)!.push(schedule);
    }
    return map;
  }, [schedules]);

  // 주차 번호로 정렬 (undefined는 마지막)
  const sortedWeeks = useMemo(() => {
    return Array.from(schedulesByWeek.entries()).sort((a, b) => {
      if (a[0] === undefined) return 1;
      if (b[0] === undefined) return -1;
      return a[0] - b[0];
    });
  }, [schedulesByWeek]);

  const listRef = useRef<List>(null);
  const sizeMap = useRef<Map<number, number>>(new Map());
  // WeekSection 자체의 expand 상태를 추적하기 위한 Map
  const [expandedWeeks, setExpandedWeeks] = useState<Map<string, boolean>>(
    new Map()
  );

  const toggleWeek = useCallback((weekKey: string) => {
    setExpandedWeeks((prev) => {
      const next = new Map(prev);
      next.set(weekKey, !next.get(weekKey));
      return next;
    });
  }, []);

  const setSize = useCallback((index: number, size: number) => {
    if (sizeMap.current.get(index) !== size) {
      sizeMap.current.set(index, size);
      listRef.current?.resetAfterIndex(index);
    }
  }, []);

  const getSize = useCallback((index: number) => {
    return sizeMap.current.get(index) || 120; // Default week height
  }, []);

  // 확장 상태 변경 시 리스트 갱신 
  // (하위 날짜가 토글되어도 높이가 변하므로 expandedDates 의존성 필요)
  useEffect(() => {
      if (listRef.current) {
        listRef.current.resetAfterIndex(0);
      }
  }, [expandedWeeks, expandedDates]);

  return (
    <List
      ref={listRef}
      height={height}
      width={width}
      itemCount={sortedWeeks.length}
      itemSize={getSize}
    >
      {({ index, style }: { index: number; style: React.CSSProperties }) => {
        const [weekNum, weekSchedules] = sortedWeeks[index];
        const weekKey = weekNum !== undefined ? String(weekNum) : "undefined";
        
        return (
          <div style={style}>
            <MeasureRow
              index={index}
              setSize={setSize}
              expandedKey={`${expandedWeeks.get(weekKey)}-${weekSchedules.map(d => expandedDates.get(d.date)).join(',')}`}
            >
              <WeekSection
                weekNum={weekNum}
                schedules={weekSchedules}
                plansByDate={plansByDate}
                contents={contents}
                blocks={blocks}
                sequenceMap={sequenceMap}
                expandedDates={expandedDates}
                onToggleDate={onToggleDate}
                isExpanded={expandedWeeks.get(weekKey) ?? false}
                onToggleWeek={() => toggleWeek(weekKey)}
              />
            </MeasureRow>
          </div>
        );
      }}
    </List>
  );
}
