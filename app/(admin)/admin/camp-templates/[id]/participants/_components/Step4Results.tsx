"use client";

/**
 * Phase 6 P1 개선: 배치 작업 에러 세분화
 *
 * - 단계별 진행률 실시간 표시
 * - 상세 에러 카테고리 및 원인 표시
 * - 실패한 항목만 재시도 기능
 * - 결과 요약 통계 시각화
 */

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
  bulkApplyRecommendedContents,
  bulkAdjustPlanRanges,
  bulkGeneratePlans,
} from "@/lib/domains/camp/actions";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Participant = {
  groupId: string;
  studentId: string;
  studentName: string;
};

type StepResult = {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: Array<{ groupId: string; error: string }>;
};

// Phase 6 P1: 처리 단계 상태
type ProcessingPhase = "idle" | "content" | "range" | "plan" | "done";

// Phase 6 P1: 에러 카테고리
type ErrorCategory =
  | "already_exists"
  | "validation"
  | "permission"
  | "network"
  | "unknown";

function categorizeError(error: string): ErrorCategory {
  if (error.includes("이미") || error.includes("already")) return "already_exists";
  if (error.includes("유효") || error.includes("검증") || error.includes("invalid"))
    return "validation";
  if (error.includes("권한") || error.includes("permission")) return "permission";
  if (error.includes("네트워크") || error.includes("timeout") || error.includes("network"))
    return "network";
  return "unknown";
}

const errorCategoryLabels: Record<ErrorCategory, string> = {
  already_exists: "이미 처리됨",
  validation: "데이터 검증 실패",
  permission: "권한 오류",
  network: "네트워크 오류",
  unknown: "기타 오류",
};

type Step4ResultsProps = {
  templateId: string;
  participants: Participant[];
  step1Data: {
    subjectCounts: Record<string, Record<string, number>>;
    replaceExisting: boolean;
  };
  step2Data: {
    rangeAdjustments: Record<
      string,
      Array<{
        contentId: string;
        contentType: "book" | "lecture";
        startRange: number;
        endRange: number;
      }>
    >;
  };
  step3Data: {
    selectedGroupIds: Set<string>;
    previewResults?: Record<
      string,
      {
        planCount: number;
        previewData?: any[];
        error?: string;
      }
    >;
  };
  initialData?: {
    results: {
      contentRecommendation: StepResult;
      rangeAdjustment: StepResult;
      planGeneration: StepResult;
    };
  } | null;
  onComplete: () => void;
  onBack: () => void;
};

export function Step4Results({
  templateId,
  participants,
  step1Data,
  step2Data,
  step3Data,
  initialData,
  onComplete,
  onBack,
}: Step4ResultsProps) {
  const toast = useToast();
  const [processing, setProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ProcessingPhase>("idle");
  const [results, setResults] = useState<Step4ResultsProps["initialData"]>(initialData);
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Phase 6 P1/M1: 단계별 진행 상태
  const phaseLabels: Record<ProcessingPhase, string> = {
    idle: "대기 중",
    content: "콘텐츠 추천 적용 중...",
    range: "범위 조절 적용 중...",
    plan: "플랜 생성 중...",
    done: "완료",
  };

  // 결과 처리 실행
  const processAll = useCallback(async () => {
    if (results) return;

    setProcessing(true);
    try {
      // Step 1: 콘텐츠 추천 적용
      setCurrentPhase("content");
      const contentResult = await bulkApplyRecommendedContents(
        templateId,
        participants.map((p) => p.groupId),
        step1Data.subjectCounts,
        { replaceExisting: step1Data.replaceExisting }
      );

      // Step 2: 범위 조절 적용
      setCurrentPhase("range");
      const rangeResult = await bulkAdjustPlanRanges(
        participants.map((p) => p.groupId),
        step2Data.rangeAdjustments
      );

      // Step 3: 플랜 생성
      setCurrentPhase("plan");
      const selectedGroupIdsArray = Array.from(step3Data.selectedGroupIds);
      const planResult = await bulkGeneratePlans(selectedGroupIdsArray);

      setCurrentPhase("done");
      setResults({
        results: {
          contentRecommendation: contentResult,
          rangeAdjustment: rangeResult,
          planGeneration: planResult,
        },
      });

      // 전체 성공 여부 확인
      const allSuccess =
        contentResult.success && rangeResult.success && planResult.success;

      if (allSuccess) {
        toast.showSuccess("모든 작업이 완료되었습니다.");
      } else {
        toast.showError("일부 작업이 실패했습니다. 결과를 확인해주세요.");
      }
    } catch (error) {
      console.error("작업 처리 실패:", error);
      toast.showError("작업 처리 중 오류가 발생했습니다.");
      setCurrentPhase("idle");
    } finally {
      setProcessing(false);
    }
  }, [results, templateId, participants, step1Data, step2Data, step3Data, toast]);

  useEffect(() => {
    processAll();
  }, [processAll]);

  // Phase 6 P1: 실패한 항목만 재시도
  const handleRetryFailed = useCallback(async () => {
    if (!results) return;

    const failedGroupIds: string[] = [];

    // 실패한 그룹 ID 수집
    results.results.contentRecommendation.errors?.forEach((e) => {
      if (!failedGroupIds.includes(e.groupId)) {
        failedGroupIds.push(e.groupId);
      }
    });
    results.results.rangeAdjustment.errors?.forEach((e) => {
      if (!failedGroupIds.includes(e.groupId)) {
        failedGroupIds.push(e.groupId);
      }
    });
    results.results.planGeneration.errors?.forEach((e) => {
      if (!failedGroupIds.includes(e.groupId)) {
        failedGroupIds.push(e.groupId);
      }
    });

    if (failedGroupIds.length === 0) {
      toast.showInfo("재시도할 항목이 없습니다.");
      return;
    }

    setRetrying(true);
    try {
      // 실패한 그룹에 대해서만 재시도
      const failedParticipants = participants.filter((p) =>
        failedGroupIds.includes(p.groupId)
      );

      setCurrentPhase("content");
      const contentResult = await bulkApplyRecommendedContents(
        templateId,
        failedParticipants.map((p) => p.groupId),
        step1Data.subjectCounts,
        { replaceExisting: step1Data.replaceExisting }
      );

      setCurrentPhase("range");
      const rangeResult = await bulkAdjustPlanRanges(
        failedParticipants.map((p) => p.groupId),
        step2Data.rangeAdjustments
      );

      setCurrentPhase("plan");
      const failedSelectedGroupIds = failedGroupIds.filter((id) =>
        step3Data.selectedGroupIds.has(id)
      );
      const planResult = await bulkGeneratePlans(failedSelectedGroupIds);

      setCurrentPhase("done");

      // 결과 병합
      setResults((prev) => {
        if (!prev) return null;

        const mergeResults = (
          original: StepResult,
          retry: StepResult
        ): StepResult => {
          const newErrors = retry.errors || [];
          const originalErrors = original.errors || [];

          // 재시도에서 성공한 그룹 ID
          const retrySuccessIds = failedGroupIds.filter(
            (id) => !newErrors.some((e) => e.groupId === id)
          );

          // 기존 에러 중 재시도에서 성공한 것 제거
          const remainingErrors = originalErrors.filter(
            (e) => !retrySuccessIds.includes(e.groupId)
          );

          return {
            success: remainingErrors.length === 0 && newErrors.length === 0,
            successCount: original.successCount + retrySuccessIds.length,
            failureCount: remainingErrors.length + newErrors.length,
            errors:
              remainingErrors.length > 0 || newErrors.length > 0
                ? [...remainingErrors, ...newErrors]
                : undefined,
          };
        };

        return {
          results: {
            contentRecommendation: mergeResults(
              prev.results.contentRecommendation,
              contentResult
            ),
            rangeAdjustment: mergeResults(prev.results.rangeAdjustment, rangeResult),
            planGeneration: mergeResults(prev.results.planGeneration, planResult),
          },
        };
      });

      const retrySuccess =
        contentResult.success && rangeResult.success && planResult.success;
      if (retrySuccess) {
        toast.showSuccess("재시도 작업이 완료되었습니다.");
      } else {
        toast.showError("일부 재시도 작업이 실패했습니다.");
      }
    } catch (error) {
      console.error("재시도 실패:", error);
      toast.showError("재시도 중 오류가 발생했습니다.");
    } finally {
      setRetrying(false);
      setCurrentPhase("done");
    }
  }, [results, participants, templateId, step1Data, step2Data, step3Data, toast]);

  // Phase 6 P1: CSV 다운로드
  const handleDownloadResults = useCallback(() => {
    if (!results) return;

    const rows = [
      ["학생명", "그룹ID", "콘텐츠 추천", "범위 조절", "플랜 생성", "에러 내용"],
    ];

    participants.forEach((participant) => {
      const contentError = results.results.contentRecommendation.errors?.find(
        (e) => e.groupId === participant.groupId
      );
      const rangeError = results.results.rangeAdjustment.errors?.find(
        (e) => e.groupId === participant.groupId
      );
      const planError = results.results.planGeneration.errors?.find(
        (e) => e.groupId === participant.groupId
      );
      const wasSelected = step3Data.selectedGroupIds.has(participant.groupId);

      const errors = [contentError?.error, rangeError?.error, planError?.error]
        .filter(Boolean)
        .join("; ");

      rows.push([
        participant.studentName,
        participant.groupId,
        contentError ? "실패" : "성공",
        rangeError ? "실패" : "성공",
        !wasSelected ? "선택 안 함" : planError ? "실패" : "성공",
        errors || "",
      ]);
    });

    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `batch-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }, [results, participants, step3Data.selectedGroupIds]);

  // Phase 6 M1: 진행률 표시 UI
  if (processing || !results) {
    const phaseOrder: ProcessingPhase[] = ["content", "range", "plan"];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const progress =
      currentPhase === "idle"
        ? 0
        : currentPhase === "done"
          ? 100
          : ((currentIndex + 1) / phaseOrder.length) * 100;

    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        {/* 진행률 바 */}
        <div className="w-full max-w-md">
          <div className="mb-2 flex justify-between text-sm text-gray-600">
            <span>{phaseLabels[currentPhase]}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 단계별 상태 */}
        <div className="flex items-center gap-4">
          {phaseOrder.map((phase, index) => {
            const isActive = currentPhase === phase;
            const isCompleted = currentIndex > index;

            return (
              <div key={phase} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all",
                    isCompleted
                      ? "bg-green-600 text-white"
                      : isActive
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 text-gray-500"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm",
                    isActive ? "font-medium text-indigo-600" : "text-gray-500"
                  )}
                >
                  {phase === "content"
                    ? "콘텐츠"
                    : phase === "range"
                      ? "범위"
                      : "플랜"}
                </span>
                {index < phaseOrder.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-8",
                      isCompleted ? "bg-green-600" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-sm text-gray-500">
          {participants.length}명의 학생에 대해 작업을 처리하고 있습니다...
        </p>
      </div>
    );
  }

  const { contentRecommendation, rangeAdjustment, planGeneration } = results.results;

  // Phase 6 P1: 전체 통계 계산
  const totalOperations =
    participants.length * 2 + step3Data.selectedGroupIds.size;
  const totalSuccess =
    contentRecommendation.successCount +
    rangeAdjustment.successCount +
    planGeneration.successCount;
  const totalFailure =
    contentRecommendation.failureCount +
    rangeAdjustment.failureCount +
    planGeneration.failureCount;
  const successRate = Math.round((totalSuccess / totalOperations) * 100);

  // Phase 6 P1: 에러 카테고리별 그룹핑
  const allErrors = [
    ...(contentRecommendation.errors?.map((e) => ({
      ...e,
      step: "콘텐츠 추천",
    })) || []),
    ...(rangeAdjustment.errors?.map((e) => ({ ...e, step: "범위 조절" })) || []),
    ...(planGeneration.errors?.map((e) => ({ ...e, step: "플랜 생성" })) || []),
  ];

  const errorsByCategory = allErrors.reduce(
    (acc, err) => {
      const category = categorizeError(err.error);
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(err);
      return acc;
    },
    {} as Record<ErrorCategory, typeof allErrors>
  );

  const hasAnyFailure = totalFailure > 0;

  // 필터된 참여자 목록
  const displayParticipants = showFailedOnly
    ? participants.filter((p) => {
        const hasError =
          contentRecommendation.errors?.some((e) => e.groupId === p.groupId) ||
          rangeAdjustment.errors?.some((e) => e.groupId === p.groupId) ||
          planGeneration.errors?.some((e) => e.groupId === p.groupId);
        return hasError;
      })
    : participants;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900">Step 4: 결과</h3>
        <p className="text-sm text-gray-700">
          모든 작업이 완료되었습니다. 결과를 확인해주세요.
        </p>
      </div>

      {/* Phase 6 P1: 전체 요약 (도넛 차트 스타일) */}
      <div
        className={cn(
          "rounded-lg border p-4",
          hasAnyFailure ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"
        )}
      >
        <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            {/* 성공률 원형 표시 */}
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="h-20 w-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-200"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${successRate * 2.26} 226`}
                  className={hasAnyFailure ? "text-yellow-500" : "text-green-500"}
                />
              </svg>
              <span className="absolute text-lg font-bold text-gray-900">
                {successRate}%
              </span>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {hasAnyFailure ? "일부 작업 완료" : "전체 작업 완료"}
              </div>
              <div className="text-sm text-gray-600">
                성공 {totalSuccess}건 / 실패 {totalFailure}건
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-wrap gap-2">
            {hasAnyFailure && (
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", retrying && "animate-spin")} />
                {retrying ? "재시도 중..." : "실패 항목 재시도"}
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadResults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              결과 다운로드
            </button>
          </div>
        </div>
      </div>

      {/* 단계별 통계 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">콘텐츠 추천</div>
          <div className="flex items-center gap-2">
            {contentRecommendation.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <span className="text-lg font-semibold text-gray-900">
              {contentRecommendation.successCount} / {participants.length}
            </span>
          </div>
          {contentRecommendation.failureCount > 0 && (
            <span className="text-xs text-red-600">
              {contentRecommendation.failureCount}건 실패
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">범위 조절</div>
          <div className="flex items-center gap-2">
            {rangeAdjustment.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <span className="text-lg font-semibold text-gray-900">
              {rangeAdjustment.successCount} / {participants.length}
            </span>
          </div>
          {rangeAdjustment.failureCount > 0 && (
            <span className="text-xs text-red-600">
              {rangeAdjustment.failureCount}건 실패
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">플랜 생성</div>
          <div className="flex items-center gap-2">
            {planGeneration.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <span className="text-lg font-semibold text-gray-900">
              {planGeneration.successCount} / {step3Data.selectedGroupIds.size}
            </span>
          </div>
          {planGeneration.failureCount > 0 && (
            <span className="text-xs text-red-600">
              {planGeneration.failureCount}건 실패
            </span>
          )}
        </div>
      </div>

      {/* Phase 6 P1: 에러 카테고리별 요약 */}
      {Object.keys(errorsByCategory).length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <button
            type="button"
            onClick={() => setExpandedErrors(!expandedErrors)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-900">
                에러 상세 ({allErrors.length}건)
              </span>
            </div>
            {expandedErrors ? (
              <ChevronUp className="h-5 w-5 text-red-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-red-600" />
            )}
          </button>

          {expandedErrors && (
            <div className="mt-4 space-y-3">
              {(Object.entries(errorsByCategory) as [ErrorCategory, typeof allErrors][]).map(
                ([category, errors]) => (
                  <div key={category} className="rounded-md bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-red-800">
                        {errorCategoryLabels[category]}
                      </span>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {errors.length}건
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-gray-600">
                      {errors.slice(0, 5).map((err, idx) => {
                        const participant = participants.find(
                          (p) => p.groupId === err.groupId
                        );
                        return (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-red-400" />
                            <span>
                              <strong>{participant?.studentName || err.groupId}</strong>{" "}
                              ({err.step}): {err.error}
                            </span>
                          </li>
                        );
                      })}
                      {errors.length > 5 && (
                        <li className="text-gray-400">...외 {errors.length - 5}건</li>
                      )}
                    </ul>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* 필터 토글 */}
      {hasAnyFailure && (
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showFailedOnly}
              onChange={(e) => setShowFailedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            실패한 항목만 표시
          </label>
        </div>
      )}

      {/* 상세 결과 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse rounded-lg border border-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-900">
                학생명
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-900">
                콘텐츠 추천
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-900">
                범위 조절
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-900">
                플랜 생성
              </th>
            </tr>
          </thead>
          <tbody>
            {displayParticipants.map((participant) => {
              const contentError = contentRecommendation.errors?.find(
                (e) => e.groupId === participant.groupId
              );
              const rangeError = rangeAdjustment.errors?.find(
                (e) => e.groupId === participant.groupId
              );
              const planError = planGeneration.errors?.find(
                (e) => e.groupId === participant.groupId
              );
              const wasSelected = step3Data.selectedGroupIds.has(participant.groupId);

              const contentSuccess = !contentError;
              const rangeSuccess = !rangeError;
              const planSuccess = !wasSelected || !planError;

              const hasAnyError = !contentSuccess || !rangeSuccess || !planSuccess;

              return (
                <tr
                  key={participant.groupId}
                  className={cn(
                    "border-b border-gray-100",
                    hasAnyError && "bg-red-50/30"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {participant.studentName}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {contentSuccess ? (
                      <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="max-w-[120px] truncate text-xs text-red-600" title={contentError?.error}>
                          {contentError?.error}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rangeSuccess ? (
                      <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="max-w-[120px] truncate text-xs text-red-600" title={rangeError?.error}>
                          {rangeError?.error}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!wasSelected ? (
                      <span className="text-xs text-gray-400">선택 안 함</span>
                    ) : planSuccess ? (
                      <CheckCircle2 className="mx-auto h-5 w-5 text-green-600" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="max-w-[120px] truncate text-xs text-red-600" title={planError?.error}>
                          {planError?.error}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          onClick={onComplete}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          완료
        </button>
      </div>
    </div>
  );
}
