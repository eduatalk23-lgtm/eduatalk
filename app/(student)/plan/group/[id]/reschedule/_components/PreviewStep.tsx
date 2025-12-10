/**
 * Step 3: 미리보기 & 확인 컴포넌트
 * 
 * 재조정 결과를 미리보고 최종 확인합니다.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getReschedulePreview, rescheduleContents } from "@/app/(student)/actions/plan-groups/reschedule";
import { useToast } from "@/components/ui/ToastProvider";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import type { ReschedulePreviewResult } from "@/app/(student)/actions/plan-groups/reschedule";
import { BeforeAfterComparison } from "./BeforeAfterComparison";
import { AffectedPlansList } from "./AffectedPlansList";
import { ConflictWarning } from "./ConflictWarning";
import { detectAllConflicts, type PlanWithTime } from "@/lib/reschedule/conflictDetector";

type PreviewStepProps = {
  groupId: string;
  adjustments: AdjustmentInput[];
  dateRange?: { from: string; to: string } | null;
  onLoad: (preview: ReschedulePreviewResult) => void;
  previewResult: ReschedulePreviewResult | null;
};

export function PreviewStep({
  groupId,
  adjustments,
  dateRange,
  onLoad,
  previewResult: initialPreview,
}: PreviewStepProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(!initialPreview);
  const [preview, setPreview] = useState<ReschedulePreviewResult | null>(
    initialPreview
  );
  const [executing, setExecuting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // 충돌 감지 (실제 플랜 데이터 사용)
  const conflicts = useMemo(() => {
    if (!preview || !preview.plans_after || preview.plans_after.length === 0) {
      return [];
    }

    // 플랜 데이터를 PlanWithTime 형식으로 변환
    const plansWithTime: PlanWithTime[] = preview.plans_after.map((plan) => ({
      id: `${plan.plan_date}-${plan.content_id}-${plan.planned_start_page_or_time}`,
      plan_date: plan.plan_date,
      start_time: plan.start_time || null,
      end_time: plan.end_time || null,
      content_id: plan.content_id,
      content_type: plan.content_type,
    }));

    // 날짜별 플랜 통계 맵 생성
    const datePlansMap = new Map<
      string,
      { totalHours: number; planCount: number }
    >();

    preview.plans_after.forEach((plan) => {
      if (!datePlansMap.has(plan.plan_date)) {
        datePlansMap.set(plan.plan_date, {
          totalHours: 0,
          planCount: 0,
        });
      }

      const dateData = datePlansMap.get(plan.plan_date)!;
      dateData.planCount++;

      if (plan.start_time && plan.end_time) {
        const [startHour, startMin] = plan.start_time.split(":").map(Number);
        const [endHour, endMin] = plan.end_time.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        dateData.totalHours += (endMinutes - startMinutes) / 60;
      }
    });

    // 충돌 감지
    return detectAllConflicts(plansWithTime, datePlansMap, 12); // 최대 12시간
  }, [preview]);

  useEffect(() => {
    if (!preview && adjustments.length > 0) {
      loadPreview();
    }
  }, []);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const result = await getReschedulePreview(groupId, adjustments, dateRange);
      setPreview(result);
      onLoad(result);
    } catch (error) {
      toast.showError(
        error instanceof Error
          ? error.message
          : "미리보기를 불러오는데 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!confirmDialogOpen) {
      setConfirmDialogOpen(true);
      return;
    }

    setExecuting(true);
    try {
      const result = await rescheduleContents(groupId, adjustments, undefined, dateRange);
      if (result.success) {
        toast.showSuccess("재조정이 완료되었습니다.");
        router.push(`/plan/group/${groupId}`);
      } else {
        toast.showError(result.error || "재조정에 실패했습니다.");
      }
    } catch (error) {
      toast.showError(
        error instanceof Error
          ? error.message
          : "재조정에 실패했습니다."
      );
    } finally {
      setExecuting(false);
      setConfirmDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">미리보기를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">미리보기 데이터를 불러올 수 없습니다.</p>
        <button
          onClick={loadPreview}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">미리보기 & 확인</h2>
        <p className="mt-1 text-sm text-gray-600">
          재조정 결과를 확인하고 실행하세요.
        </p>
      </div>

      {/* 변경 요약 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-gray-900">변경 요약</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-gray-600">기존 플랜 수</p>
            <p className="text-2xl font-bold text-gray-900">
              {preview.plans_before_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">새 플랜 수</p>
            <p className="text-2xl font-bold text-blue-600">
              {preview.plans_after_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">영향받는 날짜</p>
            <p className="text-2xl font-bold text-gray-900">
              {preview.affected_dates.length}
            </p>
            {dateRange && (
              <p className="mt-1 text-xs text-gray-500">
                {dateRange.from} ~ {dateRange.to}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600">예상 시간</p>
            <p className="text-2xl font-bold text-gray-900">
              {preview.estimated_hours}시간
            </p>
          </div>
        </div>
      </div>

      {/* 변경 전/후 비교 */}
      <BeforeAfterComparison
        preview={preview}
        adjustments={adjustments}
        dateRange={dateRange}
      />

      {/* 영향받는 플랜 목록 */}
      <AffectedPlansList
        preview={preview}
        adjustments={adjustments}
        dateRange={dateRange}
      />

      {/* 조정 요약 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-gray-900">조정 내역</h3>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">범위 수정:</span>
            <span className="font-medium text-gray-900">
              {preview.adjustments_summary.range_changes}개
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">콘텐츠 교체:</span>
            <span className="font-medium text-gray-900">
              {preview.adjustments_summary.replacements}개
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">전체 재생성:</span>
            <span className="font-medium text-gray-900">
              {preview.adjustments_summary.full_regenerations}개
            </span>
          </div>
        </div>
      </div>

      {/* 충돌 경고 */}
      {conflicts.length > 0 && (
        <ConflictWarning conflicts={conflicts} />
      )}

      {/* 경고 메시지 */}
      {preview.plans_before_count > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ 총 {preview.plans_before_count}개의 기존 플랜이 비활성화되고,{" "}
            {preview.plans_after_count}개의 새 플랜이 생성됩니다.
            <br />
            완료된 플랜은 유지되며, 롤백은 최대 24시간 내에만 가능합니다.
          </p>
        </div>
      )}

      {/* 확인 다이얼로그 */}
      {confirmDialogOpen && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-lg bg-white p-6 shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              재조정 실행 확인
            </h3>

            {/* 변경 요약 */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">
                변경 요약
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">기존 플랜:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {preview.plans_before_count}개
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">새 플랜:</span>
                  <span className="ml-2 font-medium text-blue-600">
                    {preview.plans_after_count}개
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">영향받는 날짜:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {preview.affected_dates.length}일
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">예상 시간:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {preview.estimated_hours}시간
                  </span>
                </div>
              </div>
            </div>

            {/* 영향받는 날짜 목록 (최대 10개만 표시) */}
            {preview.affected_dates.length > 0 && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
                <h4 className="mb-2 text-sm font-semibold text-gray-900">
                  영향받는 날짜
                </h4>
                <div className="max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {preview.affected_dates.slice(0, 10).map((date) => (
                      <span
                        key={date}
                        className="rounded-full border border-gray-300 bg-gray-50 px-2 py-1 text-gray-700"
                      >
                        {date}
                      </span>
                    ))}
                    {preview.affected_dates.length > 10 && (
                      <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-1 text-gray-700">
                        +{preview.affected_dates.length - 10}일
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 조정 내역 */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">
                조정 내역
              </h4>
              <div className="flex flex-col gap-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>범위 수정:</span>
                  <span className="font-medium text-gray-900">
                    {preview.adjustments_summary.range_changes}개
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>콘텐츠 교체:</span>
                  <span className="font-medium text-gray-900">
                    {preview.adjustments_summary.replacements}개
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>전체 재생성:</span>
                  <span className="font-medium text-gray-900">
                    {preview.adjustments_summary.full_regenerations}개
                  </span>
                </div>
              </div>
            </div>

            {/* 경고 메시지 */}
            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ 총 {preview.plans_before_count}개의 기존 플랜이 비활성화되고,{" "}
                {preview.plans_after_count}개의 새 플랜이 생성됩니다.
                <br />
                완료된 플랜은 유지되며, 롤백은 최대 24시간 내에만 가능합니다.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialogOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-gray-300"
              >
                {executing ? "실행 중..." : "실행"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onClick={handleExecute}
          disabled={executing}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-300"
        >
          {executing ? "실행 중..." : "재조정 실행"}
        </button>
      </div>
    </div>
  );
}

