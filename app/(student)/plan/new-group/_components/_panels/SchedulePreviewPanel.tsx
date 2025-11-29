"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, AlertCircle, Loader2 } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";

type SchedulePreviewPanelProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
};

/**
 * 스케줄 미리보기 패널 (프로토타입)
 * - 실시간 스케줄 계산 결과 표시
 * - 요약 통계 (총 학습일, 블록 시간 등)
 * - 주차별 스케줄 미리보기
 * 
 * 참고: 전체 구현은 기존 Step2_5SchedulePreview.tsx (1,135 라인) 참고
 */
export const SchedulePreviewPanel = React.memo(function SchedulePreviewPanel({
  data,
  onUpdate,
}: SchedulePreviewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 스케줄 계산 파라미터 메모이제이션
  const scheduleParams = useMemo(() => ({
    periodStart: data.period_start,
    periodEnd: data.period_end,
    blockSetId: data.block_set_id,
    exclusions: data.exclusions,
    academySchedules: data.academy_schedules,
    timeSettings: data.time_settings,
    nonStudyTimeBlocks: data.non_study_time_blocks,
    schedulerType: data.scheduler_type,
  }), [
    data.period_start,
    data.period_end,
    data.block_set_id,
    data.exclusions,
    data.academy_schedules,
    data.time_settings,
    data.non_study_time_blocks,
    data.scheduler_type,
  ]);

  // TODO: 실제 스케줄 계산 로직 연동
  // 현재는 프로토타입이므로 기본 통계만 표시
  useEffect(() => {
    // 실시간 계산 로직은 기존 Step2_5SchedulePreview.tsx의
    // calculateScheduleAvailability 함수를 재사용하면 됩니다
    setLoading(false);
    setError(null);
  }, [scheduleParams]);

  // 요약 통계 계산
  const summary = useMemo(() => {
    if (!data.period_start || !data.period_end) {
      return null;
    }

    const start = new Date(data.period_start);
    const end = new Date(data.period_end);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const excludedDays = data.exclusions?.length || 0;
    const studyDays = totalDays - excludedDays;

    return {
      totalDays,
      excludedDays,
      studyDays,
      blockCount: data.academy_schedules?.length || 0,
    };
  }, [data.period_start, data.period_end, data.exclusions, data.academy_schedules]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-sm text-gray-500">스케줄 계산 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">스케줄 계산 오류</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">스케줄 미리보기</h2>
        <p className="mt-1 text-sm text-gray-500">
          설정한 내용을 바탕으로 계산된 스케줄 정보입니다.
        </p>
      </div>

      {/* 요약 통계 */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">총 기간</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.totalDays}</p>
            <p className="text-xs text-gray-500">일</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="text-xs font-medium text-gray-500">제외일</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.excludedDays}</p>
            <p className="text-xs text-gray-500">일</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-400" />
              <span className="text-xs font-medium text-gray-500">학습일</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.studyDays}</p>
            <p className="text-xs text-gray-500">일</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              <span className="text-xs font-medium text-gray-500">학원 일정</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.blockCount}</p>
            <p className="text-xs text-gray-500">개</p>
          </div>
        </div>
      )}

      {/* 상세 미리보기 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">상세 스케줄</h3>
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            스케줄 미리보기 프로토타입
          </p>
          <p className="mt-1 text-xs text-gray-500">
            전체 구현은 Step2_5SchedulePreview.tsx (1,135 라인) 참고
          </p>
          <div className="mt-4 text-left space-y-2">
            <p className="text-xs text-gray-600">
              <strong>구현 필요 기능:</strong>
            </p>
            <ul className="ml-4 list-disc space-y-1 text-xs text-gray-600">
              <li>calculateScheduleAvailability API 연동</li>
              <li>Debounce (500ms) 적용</li>
              <li>스케줄 캐싱</li>
              <li>주차별 스케줄 표시</li>
              <li>일별 상세 정보</li>
              <li>블록 시간대 시각화</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">프로토타입 안내</p>
            <p className="mt-1">
              현재는 기본 통계만 표시됩니다. 전체 스케줄 미리보기 기능은 기존{" "}
              <code className="rounded bg-blue-100 px-1 py-0.5">
                Step2_5SchedulePreview.tsx
              </code>{" "}
              컴포넌트의 로직을 이식하여 구현하면 됩니다.
            </p>
            <p className="mt-2 font-medium">
              ⏱️ 예상 작업 시간: 4-5시간 (1,135 라인 리팩토링)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

