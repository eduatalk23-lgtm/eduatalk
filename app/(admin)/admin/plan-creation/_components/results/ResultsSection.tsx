"use client";

/**
 * 결과 표시 섹션 컴포넌트
 * 플랜 생성 완료 후 결과를 요약 및 상세 테이블로 표시
 * 부분 실패 시 재시도 기능 지원
 */

import { cn } from "@/lib/cn";
import {
  bgSurface,
  textPrimary,
  textSecondary,
  borderInput,
} from "@/lib/utils/darkMode";
import { ClipboardCheck, RotateCcw, Home, RefreshCw, AlertTriangle } from "lucide-react";
import { useFlow } from "../../_context/PlanCreationContext";
import { ResultsSummary } from "./ResultsSummary";
import { ResultsDetailTable } from "./ResultsDetailTable";

export function ResultsSection() {
  const { results, failedStudentIds, retryAllFailed, startRetry, reset } = useFlow();

  const handleStartNew = () => {
    reset();
  };

  const handleGoToStudents = () => {
    // 학생 목록 페이지로 이동
    window.location.href = "/admin/students";
  };

  const handleRetryAll = () => {
    retryAllFailed();
  };

  const handleRetryStudent = (studentId: string) => {
    startRetry([studentId]);
  };

  const hasFailures = failedStudentIds.length > 0;

  return (
    <section
      className={cn(
        "rounded-xl border p-6",
        bgSurface,
        borderInput
      )}
    >
      {/* 섹션 헤더 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className={cn("text-lg font-semibold", textPrimary)}>
            4단계: 생성 결과
          </h2>
          <p className={cn("text-sm", textSecondary)}>
            플랜 생성이 완료되었습니다
          </p>
        </div>
      </div>

      {/* 부분 실패 경고 배너 */}
      {hasFailures && (
        <div
          className={cn(
            "mb-6 flex items-center justify-between rounded-lg border p-4",
            "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
          )}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className={cn("font-medium text-amber-800 dark:text-amber-200")}>
                {failedStudentIds.length}명의 학생에 대한 플랜 생성이 실패했습니다
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                실패한 항목을 재시도하거나, 개별적으로 다시 시도할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            onClick={handleRetryAll}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition",
              "bg-amber-600 text-white hover:bg-amber-700"
            )}
          >
            <RefreshCw className="h-4 w-4" />
            모두 재시도 ({failedStudentIds.length})
          </button>
        </div>
      )}

      {/* 결과 요약 */}
      <div className="mb-6">
        <ResultsSummary results={results} />
      </div>

      {/* 결과 상세 테이블 */}
      <div className="mb-6">
        <h3 className={cn("mb-3 font-medium", textPrimary)}>학생별 결과</h3>
        <ResultsDetailTable results={results} onRetry={handleRetryStudent} />
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-6 dark:border-gray-700">
        <button
          onClick={handleGoToStudents}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition",
            "bg-gray-100 text-gray-700 hover:bg-gray-200",
            "dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          )}
        >
          <Home className="h-4 w-4" />
          학생 목록으로
        </button>
        <button
          onClick={handleStartNew}
          className={cn(
            "flex items-center gap-2 rounded-lg px-6 py-2.5 font-semibold text-white transition",
            "bg-purple-600 hover:bg-purple-700",
            "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          )}
        >
          <RotateCcw className="h-4 w-4" />
          새로운 플랜 생성
        </button>
      </div>
    </section>
  );
}
