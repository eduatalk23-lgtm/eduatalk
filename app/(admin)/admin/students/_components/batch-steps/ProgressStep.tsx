"use client";

/**
 * 배치 AI 플랜 - 진행 스텝
 */

import { cn } from "@/lib/cn";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import type { StudentPlanResult } from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";

// ============================================
// 아이콘 컴포넌트
// ============================================

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

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function MinusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
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

// ============================================
// Props
// ============================================

interface ProgressStepProps {
  progress: number;
  total: number;
  currentStudent: string;
  results: StudentPlanResult[];
}

// ============================================
// 컴포넌트
// ============================================

export function ProgressStep({
  progress,
  total,
  currentStudent,
  results,
}: ProgressStepProps) {
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 진행 바 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className={textSecondaryVar}>진행 중...</span>
          <span className={textPrimaryVar}>
            {progress} / {total} ({progressPercent}%)
          </span>
        </div>
        <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 현재 처리 중인 학생 */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border p-4",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <LoaderIcon className="h-5 w-5 text-blue-600" />
        <div>
          <p className={cn("text-sm font-medium", textPrimaryVar)}>
            현재 처리 중
          </p>
          <p className={textSecondaryVar}>{currentStudent || "준비 중..."}</p>
        </div>
      </div>

      {/* 실시간 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className={cn(
            "rounded-lg border p-3 text-center",
            borderDefaultVar,
            "bg-green-50 dark:bg-green-950/30"
          )}
        >
          <CheckCircleIcon className="h-5 w-5 mx-auto text-green-600 mb-1" />
          <p className="text-lg font-bold text-green-600">{successCount}</p>
          <p className={cn("text-xs", textSecondaryVar)}>성공</p>
        </div>
        <div
          className={cn(
            "rounded-lg border p-3 text-center",
            borderDefaultVar,
            "bg-red-50 dark:bg-red-950/30"
          )}
        >
          <XCircleIcon className="h-5 w-5 mx-auto text-red-600 mb-1" />
          <p className="text-lg font-bold text-red-600">{errorCount}</p>
          <p className={cn("text-xs", textSecondaryVar)}>실패</p>
        </div>
        <div
          className={cn(
            "rounded-lg border p-3 text-center",
            borderDefaultVar,
            "bg-gray-50 dark:bg-gray-800"
          )}
        >
          <MinusCircleIcon className="h-5 w-5 mx-auto text-gray-500 mb-1" />
          <p className="text-lg font-bold text-gray-500">{skippedCount}</p>
          <p className={cn("text-xs", textSecondaryVar)}>건너뜀</p>
        </div>
      </div>

      {/* 최근 결과 목록 */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          <p className={cn("text-sm font-medium", textPrimaryVar)}>처리 결과</p>
          {results.slice(-5).reverse().map((result, idx) => (
            <div
              key={`${result.studentId}-${idx}`}
              className={cn(
                "flex items-center gap-2 rounded px-3 py-2 text-sm",
                result.status === "success" && "bg-green-50 dark:bg-green-950/30",
                result.status === "error" && "bg-red-50 dark:bg-red-950/30",
                result.status === "skipped" && "bg-gray-50 dark:bg-gray-800"
              )}
            >
              {result.status === "success" && (
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
              )}
              {result.status === "error" && (
                <XCircleIcon className="h-4 w-4 text-red-600" />
              )}
              {result.status === "skipped" && (
                <MinusCircleIcon className="h-4 w-4 text-gray-500" />
              )}
              <span className={textPrimaryVar}>{result.studentName}</span>
              {result.status === "success" && (
                <span className={textSecondaryVar}>
                  ({result.totalPlans}개 플랜 생성)
                </span>
              )}
              {result.error && (
                <span className="text-red-600 text-xs">- {result.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
