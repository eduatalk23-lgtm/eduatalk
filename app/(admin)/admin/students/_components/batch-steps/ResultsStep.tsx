"use client";

/**
 * 배치 AI 플랜 - 결과 스텝
 */

import { cn } from "@/lib/cn";
import Badge from "@/components/atoms/Badge";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import type { BatchPlanGenerationResult } from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";

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

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// ============================================
// Props
// ============================================

interface ResultsStepProps {
  result: BatchPlanGenerationResult | null;
  /** 재시도 모드 활성화 여부 */
  retryMode?: boolean;
  /** 재시도 선택된 학생 ID 목록 */
  selectedRetryIds?: string[];
  /** 재시도 선택 변경 핸들러 */
  onRetrySelectionChange?: (ids: string[]) => void;
}

// ============================================
// 컴포넌트
// ============================================

export function ResultsStep({
  result,
  retryMode = false,
  selectedRetryIds = [],
  onRetrySelectionChange,
}: ResultsStepProps) {
  if (!result) return null;

  const { summary, results } = result;
  const retryableStudents = results.filter(
    (r) => r.status === "error" || r.status === "skipped"
  );
  const hasRetryable = retryableStudents.length > 0;

  const handleToggle = (studentId: string) => {
    if (!onRetrySelectionChange) return;
    if (selectedRetryIds.includes(studentId)) {
      onRetrySelectionChange(selectedRetryIds.filter((id) => id !== studentId));
    } else {
      onRetrySelectionChange([...selectedRetryIds, studentId]);
    }
  };

  const handleSelectAll = () => {
    if (!onRetrySelectionChange) return;
    onRetrySelectionChange(retryableStudents.map((r) => r.studentId));
  };

  const handleDeselectAll = () => {
    if (!onRetrySelectionChange) return;
    onRetrySelectionChange([]);
  };

  return (
    <div className="space-y-6">
      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className={cn(
            "rounded-lg border p-4",
            borderDefaultVar,
            "bg-green-50 dark:bg-green-950/30"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className={cn("font-medium", textPrimaryVar)}>성공</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {summary.succeeded}명
          </p>
          <p className={cn("text-sm", textSecondaryVar)}>
            총 {summary.totalPlans}개 플랜 생성
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border p-4",
            borderDefaultVar,
            "bg-red-50 dark:bg-red-950/30"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircleIcon className="h-5 w-5 text-red-600" />
            <span className={cn("font-medium", textPrimaryVar)}>실패/건너뜀</span>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {summary.failed + summary.skipped}명
          </p>
          <p className={cn("text-sm", textSecondaryVar)}>
            실패 {summary.failed}명 / 건너뜀 {summary.skipped}명
          </p>
        </div>
      </div>

      {/* 비용 정보 */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border p-4",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <CoinIcon className="h-5 w-5 text-amber-600" />
        <div>
          <p className={cn("text-sm font-medium", textPrimaryVar)}>
            총 API 비용
          </p>
          <p className="text-lg font-bold text-amber-600">
            ${summary.totalCost.toFixed(4)}
          </p>
        </div>
      </div>

      {/* 상세 결과 목록 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={cn("text-sm font-medium", textPrimaryVar)}>상세 결과</p>
          {retryMode && hasRetryable && (
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:underline"
              >
                실패 전체 선택
              </button>
              <button
                onClick={handleDeselectAll}
                className="text-xs text-gray-600 hover:underline"
              >
                전체 해제
              </button>
            </div>
          )}
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {results.map((r, idx) => {
            const isRetryable = r.status === "error" || r.status === "skipped";
            const isSelected = selectedRetryIds.includes(r.studentId);

            return (
              <div
                key={`${r.studentId}-${idx}`}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3",
                  borderDefaultVar,
                  bgSurfaceVar,
                  retryMode && isRetryable && isSelected && "ring-2 ring-blue-500"
                )}
              >
                <div className="flex items-center gap-3">
                  {retryMode && isRetryable && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(r.studentId)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                  {r.status === "success" && (
                    <Badge variant="success" size="sm">성공</Badge>
                  )}
                  {r.status === "error" && (
                    <Badge variant="error" size="sm">실패</Badge>
                  )}
                  {r.status === "skipped" && (
                    <Badge variant="default" size="sm">건너뜀</Badge>
                  )}
                  <div>
                    <p className={cn("font-medium", textPrimaryVar)}>
                      {r.studentName}
                    </p>
                    {r.status === "success" && (
                      <p className={cn("text-xs", textSecondaryVar)}>
                        {r.totalPlans}개 플랜 생성
                      </p>
                    )}
                    {r.error && (
                      <p className="text-xs text-red-500">{r.error}</p>
                    )}
                  </div>
                </div>
                {r.cost && (
                  <span className={cn("text-sm", textSecondaryVar)}>
                    ${r.cost.estimatedUSD.toFixed(4)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 재시도 모드 안내 */}
      {retryMode && hasRetryable && (
        <div className="text-xs text-center" style={{ color: textSecondaryVar }}>
          선택된 학생: {selectedRetryIds.length}명
        </div>
      )}
    </div>
  );
}
