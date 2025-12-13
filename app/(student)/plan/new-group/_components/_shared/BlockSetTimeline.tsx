"use client";

import { Calendar } from "lucide-react";
import { createPositionStyle, createHeightStyle } from "@/lib/utils/cssVariables";

interface Block {
  day_of_week: number;
  start_time: string; // "HH:mm"
  end_time: string;
  block_index: number;
}

interface BlockSetTimelineProps {
  blocks: Block[];
  name?: string;
}

export function BlockSetTimeline({ blocks, name }: BlockSetTimelineProps) {
  if (blocks.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">
            {name || "블록 세트를 선택해주세요"}
          </p>
        </div>
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Calendar className="h-12 w-12 text-gray-400" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-800">
                블록 세트를 선택해주세요
              </p>
              <p className="text-xs text-gray-500">
                선택하면 요일별 학습 시간을 확인할 수 있습니다
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const hours = Array.from({ length: 25 }, (_, i) => i); // 0-24시

  // 요일별로 그룹화
  const blocksByDay = blocks.reduce((acc, block) => {
    const day = block.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(block);
    return acc;
  }, {} as Record<number, Block[]>);

  // 시간을 숫자로 변환 (HH:mm -> 시간의 소수점)
  const timeToNumber = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours + minutes / 60;
  };

  // 블록의 위치와 높이 계산 (0-24시 기준, 백분율)
  const getBlockStyle = (block: Block) => {
    const startHour = timeToNumber(block.start_time);
    const endHour = timeToNumber(block.end_time);
    const top = (startHour / 24) * 100;
    const height = ((endHour - startHour) / 24) * 100;
    return { top, height }; // 숫자 반환
  };

  // 블록 색상 (block_index에 따라)
  const getBlockColor = (index: number | undefined | null) => {
    const colors = [
      "bg-blue-500",
      "bg-indigo-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-cyan-500",
    ];
    // index가 없거나 유효하지 않으면 기본 색상 사용
    const safeIndex = index ?? 0;
    return colors[safeIndex % colors.length];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {name || "선택된 블록 세트"}
        </p>
        <p className="text-xs font-medium text-gray-800">
          등록된 시간 블록 ({blocks.length}개)
        </p>
      </div>

      {/* 타임라인 시각화 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-1">
          {/* 시간 축 (왼쪽) - 3시간 간격 */}
          <div className="flex w-14 flex-col justify-between py-2 pr-2 text-right">
            {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hour) => (
              <div
                key={hour}
                className={`text-[10px] ${
                  hour === 12
                    ? "font-bold text-gray-900"
                    : hour === 0 || hour === 24
                    ? "font-medium text-gray-400"
                    : "font-medium text-gray-600"
                }`}
              >
                {hour}시
              </div>
            ))}
          </div>

          {/* 요일별 타임라인 */}
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const dayBlocks = blocksByDay[day] || [];
              const hasBlocks = dayBlocks.length > 0;

              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-1">
                  {/* 요일 라벨 */}
                  <div
                    className={`text-xs font-semibold ${
                      hasBlocks ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {dayNames[day]}
                  </div>

                  {/* 타임라인 컨테이너 */}
                  <div className="relative h-64 w-full rounded border border-gray-200 bg-gray-50">
                    {/* 시간 그리드 라인 - 1시간 간격 */}
                    {Array.from({ length: 25 }, (_, i) => (
                      <div
                        key={`grid-${i}`}
                        className={`pointer-events-none absolute left-0 right-0 ${
                          i === 12
                            ? "border-t-2 border-gray-400"
                            : i % 3 === 0
                            ? "border-t border-gray-300"
                            : "border-t border-dashed border-gray-200"
                        }`}
                        style={createPositionStyle((i / 24) * 100)}
                      />
                    ))}

                    {/* 오전/오후 라벨 */}
                    <div className="absolute left-1 top-1 text-[9px] text-gray-400">
                      오전
                    </div>
                    <div className="absolute bottom-1 left-1 text-[9px] text-gray-400">
                      오후
                    </div>

                    {/* 블록 표시 */}
                    {dayBlocks.map((block, idx) => {
                      const blockStyle = getBlockStyle(block);
                      const colorClass = getBlockColor(block.block_index ?? 0);

                      return (
                        <div
                          key={idx}
                          className={`group absolute left-0 right-0 mx-1 rounded ${
                            colorClass || "bg-blue-500"
                          } cursor-pointer opacity-80 transition-opacity hover:opacity-100 flex flex-col justify-between`}
                          style={{
                            ...createPositionStyle(blockStyle.top),
                            ...createHeightStyle(blockStyle.height),
                          }}
                          title={`${block.start_time} ~ ${block.end_time}`}
                        >
                          {/* 시작 시간 - 상단 */}
                          <div className="px-1 pt-0.5">
                            <div className="text-[9px] font-semibold text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.5)]">
                              {block.start_time}
                            </div>
                          </div>

                          {/* 종료 시간 - 하단 */}
                          <div className="px-1 pb-0.5">
                            <div className="text-[9px] font-semibold text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.5)]">
                              {block.end_time}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-3 text-xs text-gray-600">
          <span className="font-medium">블록 색상:</span>
          {Array.from(new Set(blocks.map((b) => b.block_index)))
            .sort((a, b) => a - b)
            .map((index) => (
              <div key={`legend-${index}`} className="flex items-center gap-1">
                <div
                  className={`h-3 w-3 rounded ${getBlockColor(index)}`}
                ></div>
                <span>블록 {index}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
