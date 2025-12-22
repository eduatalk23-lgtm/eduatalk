"use client";

import { useState, useEffect, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { bulkPreviewPlans, bulkAdjustPlanRanges } from "@/lib/domains/camp/actions";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type Participant = {
  groupId: string;
  studentId: string;
  studentName: string;
};

type Step3PlanPreviewProps = {
  templateId: string;
  participants: Participant[];
  step1Data: {
    subjectCounts: Record<string, Record<string, number>>;
    replaceExisting: boolean;
  };
  step2Data: {
    rangeAdjustments: Record<string, Array<{
      contentId: string;
      contentType: "book" | "lecture";
      startRange: number;
      endRange: number;
    }>>;
  };
  initialData?: {
    selectedGroupIds: Set<string>;
    previewResults?: Record<string, {
      planCount: number;
      previewData?: any[];
      error?: string;
    }>;
  } | null;
  onComplete: (data: {
    selectedGroupIds: Set<string>;
    previewResults?: Record<string, {
      planCount: number;
      previewData?: any[];
      error?: string;
    }>;
  }) => void;
  onBack: () => void;
};

export function Step3PlanPreview({
  templateId,
  participants,
  step1Data,
  step2Data,
  initialData,
  onComplete,
  onBack,
}: Step3PlanPreviewProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    initialData?.selectedGroupIds || new Set(participants.map((p) => p.groupId))
  );
  const [previewResults, setPreviewResults] = useState<Record<string, {
    planCount: number;
    previewData?: any[];
    error?: string;
  }>>(initialData?.previewResults || {});

  // 범위 조절 저장 (플랜 미리보기 전에 저장)
  const saveRanges = async () => {
    try {
      const result = await bulkAdjustPlanRanges(
        participants.map((p) => p.groupId),
        step2Data.rangeAdjustments
      );

      if (!result.success) {
        toast.showError("범위 조절 저장에 실패했습니다.");
        return false;
      }
      return true;
    } catch (error) {
      console.error("범위 조절 저장 실패:", error);
      toast.showError("범위 조절 저장 중 오류가 발생했습니다.");
      return false;
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      // 먼저 범위 조절 저장
      const saved = await saveRanges();
      if (!saved) {
        setLoading(false);
        return;
      }

      // 플랜 미리보기 실행
      const result = await bulkPreviewPlans(participants.map((p) => p.groupId));
      
      const resultsMap: Record<string, {
        planCount: number;
        previewData?: any[];
        error?: string;
      }> = {};

      result.previews.forEach((preview) => {
        resultsMap[preview.groupId] = {
          planCount: preview.planCount,
          previewData: preview.previewData,
          error: preview.error,
        };
      });

      setPreviewResults(resultsMap);
      toast.showSuccess("플랜 미리보기가 완료되었습니다.");
    } catch (error) {
      console.error("플랜 미리보기 실패:", error);
      toast.showError("플랜 미리보기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (selectedGroupIds.size === 0) {
      toast.showError("플랜을 생성할 학생을 최소 1명 이상 선택해주세요.");
      return;
    }

    onComplete({
      selectedGroupIds,
      previewResults,
    });
  };

  const toggleSelection = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900">Step 3: 플랜 미리보기</h3>
        <p className="text-sm text-gray-700">
          각 학생의 플랜을 미리보고, 플랜을 생성할 학생을 선택합니다.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePreview}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              미리보기 중...
            </>
          ) : (
            "플랜 미리보기"
          )}
        </button>
      </div>

      {/* 학생별 미리보기 결과 */}
      <div className="space-y-4">
        {participants.map((participant) => {
          const result = previewResults[participant.groupId];
          const isSelected = selectedGroupIds.has(participant.groupId);
          const hasError = result?.error;
          const planCount = result?.planCount ?? 0;

          return (
            <div
              key={participant.groupId}
              className={`rounded-lg border p-4 ${
                hasError
                  ? "border-red-200 bg-red-50"
                  : isSelected
                  ? "border-indigo-200 bg-indigo-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(participant.groupId)}
                    disabled={hasError !== undefined}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {participant.studentName}
                    </div>
                    {result && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {hasError ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <span className="text-red-600">{result.error}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>{planCount}개의 플랜이 생성됩니다.</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          이전
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending || selectedGroupIds.size === 0}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음 단계
        </button>
      </div>
    </div>
  );
}

