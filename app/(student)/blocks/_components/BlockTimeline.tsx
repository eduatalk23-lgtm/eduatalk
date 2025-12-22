"use client";

import { useMemo } from "react";
import { calculateAutoTimeRange } from "@/lib/blocks/timeRange";
import { EmptyState } from "@/components/molecules/EmptyState";
import { createHeightPxStyle, createBlockStyle } from "@/lib/utils/cssVariables";
import { timeToMinutes } from "@/lib/utils/time";

type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  block_index?: number | null;
};

type BlockTimelineProps = {
  blocks: Block[];
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 블록의 위치와 높이 계산 (시간 범위 기준)
 */
function calculateBlockPosition(
  block: Block,
  timeRangeStartHour: number,
  hourHeight: number
) {
  const startMinutes = timeToMinutes(block.start_time);
  const endMinutes = timeToMinutes(block.end_time);
  
  // 시간 범위의 시작 시간을 기준으로 상대적 위치 계산
  const rangeStartMinutes = timeRangeStartHour * 60;
  
  // 블록의 시작 시간이 범위 시작 시간보다 앞에 있으면 0부터 시작
  const relativeStart = Math.max(0, startMinutes - rangeStartMinutes);
  const relativeEnd = Math.max(0, endMinutes - rangeStartMinutes);
  
  const top = (relativeStart / 60) * hourHeight;
  const height = ((relativeEnd - relativeStart) / 60) * hourHeight;
  
  return { top, height };
}

export default function BlockTimeline({ blocks }: BlockTimelineProps) {
  // 시간 영역 계산 (자동 모드만 사용)
  const autoTimeRange = useMemo(() => calculateAutoTimeRange(blocks), [blocks]);
  const timeRange = autoTimeRange;

  const HOURS = timeRange.hours;
  const hourHeight = 80; // 1시간 = 80px

  const blocksByDay = useMemo(
    () => DAYS.map((_, dayIndex) => blocks.filter((b) => b.day_of_week === dayIndex)),
    [blocks]
  );

  // 블록이 없을 때 빈 상태 표시
  if (blocks.length === 0) {
    return (
      <EmptyState
        icon="📅"
        title="타임테이블 데이터가 없습니다"
        description="시간 블록을 추가하면 주간 타임테이블을 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <div className="min-w-[800px]">
          {/* 시간 축 */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <div className="w-20 flex-shrink-0 p-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              시간
            </div>
            {DAYS.map((day) => (
              <div
                key={day}
                className="flex-1 p-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 border-l border-gray-200 dark:border-gray-700"
              >
                {day}요일
              </div>
            ))}
          </div>

          {/* 타임라인 그리드 */}
          <div className="relative border-b border-gray-200 dark:border-gray-700">
            {/* 시간 라인 */}
            <div className="flex">
              <div className="w-20 flex-shrink-0">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-t border-gray-100 dark:border-gray-800 flex items-start justify-end pr-2 pt-1"
                    style={createHeightPxStyle(hourHeight)}
                  >
                    <span className="text-xs text-gray-400 dark:text-gray-500">{hour}시</span>
                  </div>
                ))}
              </div>

              {/* 요일별 컬럼 */}
              {blocksByDay.map((dayBlocks, dayIndex) => (
                <div
                  key={dayIndex}
                  className="flex-1 relative border-l border-gray-200 dark:border-gray-700"
                >
                  {/* 시간 슬롯 */}
                  <div
                    className="relative"
                    style={createHeightPxStyle(HOURS.length * hourHeight)}
                  >
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="border-t border-gray-100 dark:border-gray-800"
                        style={createHeightPxStyle(hourHeight)}
                        aria-hidden="true"
                      />
                    ))}

                    {/* 블록들 (읽기 전용) */}
                    {dayBlocks.map((block) => {
                      const { top, height } = calculateBlockPosition(
                        block,
                        timeRange.startHour,
                        hourHeight
                      );
                      
                      // 시간 범위 밖의 블록은 표시하지 않음
                      const blockStartHour = Math.floor(timeToMinutes(block.start_time) / 60);
                      const blockEndHour = Math.ceil(timeToMinutes(block.end_time) / 60);
                      if (blockEndHour < timeRange.startHour || blockStartHour > timeRange.endHour) {
                        return null;
                      }

                      // 블록 길이 계산 (분 단위)
                      const blockDurationMinutes = Math.round((height / hourHeight) * 60);

                      return (
                        <div
                          key={block.id}
                          className="absolute left-1 right-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 p-2"
                          style={createBlockStyle(top, height, "40px")}
                        >
                          <div className="flex flex-col gap-1 h-full">
                            <span className="text-xs font-medium text-indigo-900 dark:text-indigo-200">
                              {block.start_time} ~ {block.end_time}
                            </span>
                            <span className="text-xs text-indigo-700 dark:text-indigo-300">
                              {blockDurationMinutes}분
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

