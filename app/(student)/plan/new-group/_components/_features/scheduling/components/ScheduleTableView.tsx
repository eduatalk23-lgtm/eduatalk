import {
  useState,
  useMemo,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
} from "react";
import { VariableSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import type { BlockData, ContentData } from "../../../utils/scheduleTransform";
import type { DailySchedule, Plan } from "./scheduleTypes";
import { MeasureRow } from "./MeasureRow";
import { ScheduleItem } from "./ScheduleItem";
import { ScheduleListByWeek } from "./ScheduleListByWeek";

type ScheduleTableViewProps = {
  dailySchedule: DailySchedule[];
  plans: Plan[];
  contents: Map<string, ContentData>;
  blocks: BlockData[];
};

export function ScheduleTableView({
  dailySchedule,
  plans,
  contents,
  blocks,
}: ScheduleTableViewProps) {
  // useDeferredValue로 큰 데이터셋 지연 처리
  const deferredDailySchedule = useDeferredValue(dailySchedule);
  const deferredPlans = useDeferredValue(plans);

  // 주차별 그룹화가 가능한지 확인
  const hasWeekNumbers = dailySchedule.some((s) => s.week_number !== undefined);

  // sequenceMap 제거 (서버 데이터 사용)
  const sequenceMap = useMemo(() => new Map<string, number>(), []);

  // 날짜별로 플랜 그룹화
  const plansByDate = useMemo(() => {
    const map = new Map<string, Plan[]>();
    if (deferredPlans && Array.isArray(deferredPlans)) {
      deferredPlans.forEach((plan) => {
        if (!map.has(plan.plan_date)) {
          map.set(plan.plan_date, []);
        }
        map.get(plan.plan_date)!.push(plan);
      });
    }
    return map;
  }, [deferredPlans]);

  // 날짜 순으로 정렬된 스케줄 (주차 정보가 없는 경우)
  const sortedSchedules = useMemo(() => {
    if (hasWeekNumbers) return [];
    return [...(deferredDailySchedule || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [deferredDailySchedule, hasWeekNumbers]);

  const [expandedDates, setExpandedDates] = useState<Map<string, boolean>>(
    new Map()
  );

  const toggleDate = useCallback((date: string) => {
    setExpandedDates((prev) => {
      const next = new Map(prev);
      next.set(date, !next.get(date));
      return next;
    });
  }, []);

  const listRef = useRef<List>(null);
  const sizeMap = useRef<Map<number, number>>(new Map());

  const setSize = useCallback((index: number, size: number) => {
    if (sizeMap.current.get(index) !== size) {
      sizeMap.current.set(index, size);
      listRef.current?.resetAfterIndex(index);
    }
  }, []);

  const getSize = useCallback((index: number) => {
    return sizeMap.current.get(index) || 80; // Default height
  }, []);

  // 확장 상태 변경 시 리스트 갱신
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedDates]);

  if (!dailySchedule || dailySchedule.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-600">표시할 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[800px] rounded-lg border border-gray-200 bg-white flex flex-col">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">
          일별 스케줄 ({dailySchedule.length}일)
        </h3>
      </div>
      <div className="flex-1 min-h-0">
        <AutoSizer>
          {({ height, width }) =>
            hasWeekNumbers ? (
              <ScheduleListByWeek
                height={height}
                width={width}
                schedules={deferredDailySchedule}
                plansByDate={plansByDate}
                contents={contents}
                blocks={blocks}
                sequenceMap={sequenceMap}
                expandedDates={expandedDates}
                onToggleDate={toggleDate}
              />
            ) : (
              <List
                ref={listRef}
                height={height}
                width={width}
                itemCount={sortedSchedules.length}
                itemSize={getSize}
              >
                {({
                  index,
                  style,
                }: {
                  index: number;
                  style: React.CSSProperties;
                }) => {
                  const schedule = sortedSchedules[index];
                  const datePlans = plansByDate.get(schedule.date) || [];
                  return (
                    <div style={style}>
                      <MeasureRow
                        index={index}
                        setSize={setSize}
                        // Force re-measure when expanded changes
                        expandedKey={`${expandedDates.get(schedule.date)}`}
                      >
                        <ScheduleItem
                          schedule={schedule}
                          datePlans={datePlans}
                          contents={contents}
                          blocks={blocks}
                          sequenceMap={sequenceMap}
                          isExpanded={expandedDates.get(schedule.date) ?? false}
                          onToggle={() => toggleDate(schedule.date)}
                        />
                      </MeasureRow>
                    </div>
                  );
                }}
              </List>
            )
          }
        </AutoSizer>
      </div>
    </div>
  );
}
