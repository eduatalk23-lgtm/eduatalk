"use client";

import { useMemo } from "react";
import { calculateDayDistribution, calculateBlockStatistics } from "@/lib/blocks/statistics";
import { EmptyState } from "@/components/ui/EmptyState";
import ProgressBar from "@/components/atoms/ProgressBar";

type Block = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type BlockStatisticsProps = {
  blocks: Block[];
};

export default function BlockStatistics({ blocks }: BlockStatisticsProps) {
  // 계산 결과를 메모이제이션하여 불필요한 재계산 방지
  const { dayDistribution, statistics } = useMemo(() => {
    if (blocks.length === 0) {
      return {
        dayDistribution: null,
        statistics: null,
      };
    }

    return {
      dayDistribution: calculateDayDistribution(blocks),
      statistics: calculateBlockStatistics(blocks),
    };
  }, [blocks]);

  if (blocks.length === 0 || !statistics || !dayDistribution) {
    return (
      <EmptyState
        icon="📊"
        title="통계 데이터가 없습니다"
        description="시간 블록을 추가하면 통계 정보를 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 통계 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-col gap-1">
          <div className="text-sm text-gray-600">총 블록 수</div>
          <div className="text-2xl font-semibold text-gray-900">
            {statistics.totalBlocks}개
          </div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-col gap-1">
          <div className="text-sm text-gray-600">주간 총 학습 시간</div>
          <div className="text-2xl font-semibold text-gray-900">
            {statistics.totalHours}시간 {statistics.remainingMinutes}분
          </div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg flex flex-col gap-1">
          <div className="text-sm text-gray-600">평균 블록 길이</div>
          <div className="text-2xl font-semibold text-gray-900">
            {Math.floor(statistics.averageBlockDuration / 60)}시간{" "}
            {statistics.averageBlockDuration % 60}분
          </div>
        </div>
      </div>

      {/* 요일별 학습 시간 분포 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-gray-900">
          요일별 학습 시간 분포
        </h3>
        <div className="flex flex-col gap-3">
          {dayDistribution.distribution.map((day) => (
            <div key={day.dayIndex} className="flex items-center gap-4">
              <div className="w-12 text-sm font-medium text-gray-700">
                {day.day}요일
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar
                      value={(day.minutes / dayDistribution.maxMinutes) * 100}
                      color="indigo"
                      height="md"
                    />
                  </div>
                  <div className="w-20 text-sm text-gray-600 text-right">
                    {day.hours}시간 {day.remainingMinutes}분
                  </div>
                  <div className="w-12 text-xs text-gray-500 text-right">
                    ({day.blockCount}개)
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

