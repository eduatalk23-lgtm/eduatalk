"use client";

/**
 * BatchAIPlanModal 내부 콘텐츠 컴포넌트
 *
 * 4-Layer Context를 사용하는 모달 내부 콘텐츠
 * BatchWizardProvider 내부에서 렌더링되어야 함
 *
 * @module BatchAIPlanModalContent
 */

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import {
  textSecondaryVar,
} from "@/lib/utils/darkMode";

import {
  useBatchData,
  useBatchStep,
  useBatchState,
} from "../[id]/plans/_components/admin-wizard/_context";

import {
  estimateBatchPlanCost,
  getStudentsContentsForBatch,
} from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";

import {
  parseSSEEvent,
} from "@/lib/domains/admin-plan/types/streaming";

import {
  generateBatchPreview,
  saveFromPreview,
} from "@/lib/domains/admin-plan/actions/batchPreviewPlans";
import { BatchPreviewStep } from "./BatchPreviewStep";

import {
  mergeRetryResults,
  recalculateSummary,
} from "@/lib/domains/admin-plan/actions/batchRetry";

import type { StudentListRow } from "./types";
import type { StudentPlanResult } from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";

// Step 컴포넌트
import { SettingsStep, ProgressStep, ResultsStep } from "./batch-steps";

// ============================================
// 아이콘 컴포넌트
// ============================================

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

// ============================================
// 로컬 헬퍼
// ============================================

function hasRetryableStudentsLocal(results: StudentPlanResult[]): boolean {
  return results.some((r) => r.status === "error" || r.status === "skipped");
}

// ============================================
// Props
// ============================================

interface BatchAIPlanModalContentProps {
  selectedStudents: StudentListRow[];
  onClose: () => void;
}

// ============================================
// 메인 컴포넌트
// ============================================

export function BatchAIPlanModalContent({
  selectedStudents,
  onClose,
}: BatchAIPlanModalContentProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // 4-Layer Context Hooks
  const {
    settings,
    estimatedCost,
    progress,
    currentStudent,
    results,
    finalResult,
    previewResult,
    selectedStudentIds,
    previewStudents,
    retryMode,
    selectedRetryIds,
    originalContentsMap,
    updateSettings,
    setEstimatedCost,
    setProgress,
    setCurrentStudent,
    addResult,
    setResults,
    setFinalResult,
    setPreviewResult,
    setSelectedStudentIds,
    setPreviewStudents,
    setRetryMode,
    setSelectedRetryIds,
    setOriginalContentsMap,
  } = useBatchData();

  const {
    currentStep,
    goToSettings,
    goToPreview,
    goToProgress,
    goToResults,
  } = useBatchStep();

  const {
    isLoading,
    setLoading,
  } = useBatchState();

  // SSE 스트리밍 취소용 ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // 비용 추정 업데이트
  useEffect(() => {
    if (selectedStudents.length > 0 && settings.modelTier) {
      estimateBatchPlanCost(selectedStudents.length, settings.modelTier)
        .then(setEstimatedCost)
        .catch(console.error);
    }
  }, [selectedStudents.length, settings.modelTier, setEstimatedCost]);

  // 미리보기 생성
  const handlePreview = useCallback(async () => {
    if (selectedStudents.length === 0) {
      showError("선택된 학생이 없습니다.");
      return;
    }

    const startDate = new Date(settings.startDate);
    const endDate = new Date(settings.endDate);
    if (startDate >= endDate) {
      showError("종료일은 시작일 이후여야 합니다.");
      return;
    }

    setLoading(true);
    goToPreview();
    setPreviewResult(null);

    try {
      const studentIds = selectedStudents.map((s) => s.id);
      const contentsMap = await getStudentsContentsForBatch(studentIds);

      const students = selectedStudents.map((s) => ({
        studentId: s.id,
        contentIds: contentsMap.get(s.id)?.contentIds || [],
      }));

      setPreviewStudents(students);

      const result = await generateBatchPreview({
        students,
        settings,
      });

      if (result.success && result.previews) {
        setPreviewResult(result);
        const successIds = result.previews
          .filter((p) => p.status === "success")
          .map((p) => p.studentId);
        setSelectedStudentIds(successIds);
      } else {
        const errorMessage =
          typeof result.error === "string"
            ? result.error
            : "미리보기 생성에 실패했습니다.";
        showError(errorMessage);
        goToSettings();
      }
    } catch (error) {
      console.error("Preview Error:", error);
      showError(
        error instanceof Error ? error.message : "미리보기 생성 중 오류가 발생했습니다."
      );
      goToSettings();
    } finally {
      setLoading(false);
    }
  }, [
    selectedStudents,
    settings,
    showError,
    setLoading,
    goToPreview,
    goToSettings,
    setPreviewResult,
    setPreviewStudents,
    setSelectedStudentIds,
  ]);

  // 미리보기에서 저장
  const handleSaveFromPreview = useCallback(async () => {
    if (!previewResult || selectedStudentIds.length === 0) {
      showError("저장할 학생을 선택하세요.");
      return;
    }

    setLoading(true);
    goToProgress();
    setProgress(0);

    try {
      const result = await saveFromPreview({
        studentIds: selectedStudentIds,
        previews: previewResult.previews,
        planGroupNameTemplate: "AI 학습 계획 ({startDate} ~ {endDate})",
      });

      if (result.success) {
        const convertedResults: StudentPlanResult[] = result.results.map((r) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          status: r.status,
          planGroupId: r.planGroupId,
          totalPlans: previewResult.previews.find((p) => p.studentId === r.studentId)?.summary?.totalPlans,
          error: r.error,
        }));

        setProgress(result.results.length);
        setResults(convertedResults);
        setFinalResult({
          success: true,
          results: convertedResults,
          summary: {
            total: result.summary.total,
            succeeded: result.summary.succeeded,
            failed: result.summary.failed,
            skipped: 0,
            totalPlans: previewResult.previews
              .filter((p) => selectedStudentIds.includes(p.studentId))
              .reduce((sum, p) => sum + (p.summary?.totalPlans || 0), 0),
            totalCost: previewResult.previews
              .filter((p) => selectedStudentIds.includes(p.studentId))
              .reduce((sum, p) => sum + (p.cost?.estimatedUSD || 0), 0),
          },
        });
        goToResults();
        showSuccess(`${result.summary.succeeded}명의 학생에게 플랜이 저장되었습니다.`);
      } else {
        showError("저장에 실패했습니다.");
        goToPreview();
      }
    } catch (error) {
      console.error("Save Error:", error);
      showError(
        error instanceof Error ? error.message : "저장 중 오류가 발생했습니다."
      );
      goToPreview();
    } finally {
      setLoading(false);
    }
  }, [
    previewResult,
    selectedStudentIds,
    showError,
    showSuccess,
    setLoading,
    goToProgress,
    goToPreview,
    goToResults,
    setProgress,
    setResults,
    setFinalResult,
  ]);

  // 직접 생성 시작 (미리보기 없이) - SSE 스트리밍
  const handleStartStreaming = useCallback(async (
    studentsToProcess: Array<{ studentId: string; contentIds: string[] }>,
    isRetry: boolean = false
  ) => {
    setLoading(true);
    goToProgress();
    setProgress(0);
    if (!isRetry) {
      setResults([]);
      setRetryMode(false);
      setSelectedRetryIds([]);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/admin/batch-plan/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: studentsToProcess,
          settings,
          planGroupNameTemplate: "AI 학습 계획 ({startDate} ~ {endDate})",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "배치 플랜 생성 요청에 실패했습니다.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("스트림을 읽을 수 없습니다.");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const collectedResults: StudentPlanResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = parseSSEEvent(line);
          if (!event) continue;

          switch (event.type) {
            case "start":
              setProgress(0);
              break;

            case "student_start":
              setCurrentStudent(event.studentName);
              break;

            case "student_complete":
              setProgress(event.progress);
              collectedResults.push(event.result);
              setResults([...collectedResults]);
              break;

            case "student_error":
              setProgress(event.progress);
              collectedResults.push({
                studentId: event.studentId,
                studentName: event.studentName,
                status: "error",
                error: event.error,
              });
              setResults([...collectedResults]);
              break;

            case "complete":
              setProgress(event.total);

              if (isRetry && finalResult) {
                // 재시도: 기존 결과와 병합
                const mergedResults = await mergeRetryResults(
                  finalResult.results,
                  event.results
                );
                const newSummary = await recalculateSummary(mergedResults);
                setResults(mergedResults);
                setFinalResult({
                  success: true,
                  results: mergedResults,
                  summary: {
                    ...newSummary,
                    skipped: mergedResults.filter((r) => r.status === "skipped").length,
                  },
                });
                setSelectedRetryIds([]);
                showSuccess(`${event.summary.succeeded}명의 학생 재시도가 완료되었습니다.`);
              } else {
                // 신규 생성
                setResults(event.results);
                setFinalResult({
                  success: true,
                  results: event.results,
                  summary: event.summary,
                });
                showSuccess(`${event.summary.succeeded}명의 학생에게 플랜이 생성되었습니다.`);
              }
              goToResults();
              break;

            case "batch_error":
              throw new Error(event.error);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        isRetry ? goToResults() : goToSettings();
        return;
      }

      console.error("Batch AI Plan Error:", error);
      showError(
        error instanceof Error ? error.message : "배치 플랜 생성 중 오류가 발생했습니다."
      );
      isRetry ? goToResults() : goToSettings();
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [
    settings,
    finalResult,
    showSuccess,
    showError,
    setLoading,
    goToProgress,
    goToSettings,
    goToResults,
    setProgress,
    setCurrentStudent,
    setResults,
    setFinalResult,
    setRetryMode,
    setSelectedRetryIds,
  ]);

  // 직접 생성 시작 핸들러
  const handleStart = useCallback(async () => {
    if (selectedStudents.length === 0) {
      showError("선택된 학생이 없습니다.");
      return;
    }

    const startDate = new Date(settings.startDate);
    const endDate = new Date(settings.endDate);
    if (startDate >= endDate) {
      showError("종료일은 시작일 이후여야 합니다.");
      return;
    }

    try {
      const studentIds = selectedStudents.map((s) => s.id);
      const contentsMap = await getStudentsContentsForBatch(studentIds);

      // 재시도용 콘텐츠 맵 저장
      const contentsMapForRetry = new Map<string, string[]>();
      contentsMap.forEach((value, key) => {
        contentsMapForRetry.set(key, value.contentIds);
      });
      setOriginalContentsMap(contentsMapForRetry);

      const students = selectedStudents.map((s) => ({
        studentId: s.id,
        contentIds: contentsMap.get(s.id)?.contentIds || [],
      }));

      await handleStartStreaming(students, false);
    } catch (error) {
      console.error("Batch start error:", error);
      showError(
        error instanceof Error ? error.message : "배치 시작 중 오류가 발생했습니다."
      );
    }
  }, [selectedStudents, settings, showError, setOriginalContentsMap, handleStartStreaming]);

  // 완료 후 처리
  const handleComplete = useCallback(() => {
    onClose();
    router.refresh();
  }, [onClose, router]);

  // 재시도 모드 토글
  const handleToggleRetryMode = useCallback(() => {
    if (retryMode) {
      setRetryMode(false);
      setSelectedRetryIds([]);
    } else {
      setRetryMode(true);
      if (finalResult) {
        const retryableIds = finalResult.results
          .filter((r) => r.status === "error" || r.status === "skipped")
          .map((r) => r.studentId);
        setSelectedRetryIds(retryableIds);
      }
    }
  }, [retryMode, finalResult, setRetryMode, setSelectedRetryIds]);

  // 재시도 실행
  const handleRetry = useCallback(async () => {
    if (selectedRetryIds.length === 0) {
      showError("재시도할 학생을 선택하세요.");
      return;
    }

    const students = selectedRetryIds.map((studentId) => ({
      studentId,
      contentIds: originalContentsMap.get(studentId) || [],
    }));

    setRetryMode(false);
    await handleStartStreaming(students, true);
  }, [selectedRetryIds, originalContentsMap, showError, setRetryMode, handleStartStreaming]);

  // 재시도 가능 여부 확인
  const canRetry = finalResult
    ? hasRetryableStudentsLocal(finalResult.results)
    : false;

  return (
    <>
      <DialogContent>
        {currentStep === "settings" && (
          <SettingsStep
            settings={settings}
            onSettingsChange={updateSettings}
            studentCount={selectedStudents.length}
            estimatedCost={estimatedCost}
          />
        )}
        {currentStep === "preview" && previewResult && (
          <BatchPreviewStep
            previewResult={previewResult}
            selectedStudentIds={selectedStudentIds}
            onSelectionChange={setSelectedStudentIds}
            isLoading={isLoading}
          />
        )}
        {currentStep === "preview" && !previewResult && isLoading && (
          <div className="flex items-center justify-center py-12">
            <LoaderIcon className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3" style={{ color: textSecondaryVar }}>
              미리보기 생성 중...
            </span>
          </div>
        )}
        {currentStep === "progress" && (
          <ProgressStep
            progress={progress}
            total={selectedStudentIds.length || selectedStudents.length}
            currentStudent={currentStudent}
            results={results}
          />
        )}
        {currentStep === "results" && (
          <ResultsStep
            result={finalResult}
            retryMode={retryMode}
            selectedRetryIds={selectedRetryIds}
            onRetrySelectionChange={setSelectedRetryIds}
          />
        )}
      </DialogContent>
      <DialogFooter>
        {currentStep === "settings" && (
          <>
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handlePreview}
              isLoading={isLoading}
              disabled={selectedStudents.length === 0}
            >
              <SparklesIcon className="h-4 w-4 mr-2" />
              미리보기 생성
            </Button>
          </>
        )}
        {currentStep === "preview" && (
          <>
            <Button
              variant="outline"
              onClick={goToSettings}
              disabled={isLoading}
            >
              이전
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveFromPreview}
              isLoading={isLoading}
              disabled={selectedStudentIds.length === 0}
            >
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              {selectedStudentIds.length}명 저장
            </Button>
          </>
        )}
        {currentStep === "progress" && (
          <Button variant="outline" disabled>
            저장 중...
          </Button>
        )}
        {currentStep === "results" && (
          <>
            {canRetry && !retryMode && (
              <Button
                variant="outline"
                onClick={handleToggleRetryMode}
              >
                <RefreshIcon className="h-4 w-4 mr-2" />
                실패 학생 재시도
              </Button>
            )}
            {retryMode && (
              <>
                <Button
                  variant="outline"
                  onClick={handleToggleRetryMode}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={handleRetry}
                  isLoading={isLoading}
                  disabled={selectedRetryIds.length === 0}
                >
                  <RefreshIcon className="h-4 w-4 mr-2" />
                  {selectedRetryIds.length}명 재시도
                </Button>
              </>
            )}
            {!retryMode && (
              <Button variant="primary" onClick={handleComplete}>
                확인
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  );
}
