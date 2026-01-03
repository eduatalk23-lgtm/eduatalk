"use client";

/**
 * 배치 AI 플랜 생성 모달
 *
 * 여러 학생에게 동시에 AI 플랜을 생성하는 3단계 모달입니다.
 * 1. 설정: 기간, 학습 시간, 옵션 설정
 * 2. 진행: 실시간 진행 상황 표시
 * 3. 결과: 생성 결과 요약
 *
 * @module BatchAIPlanModal
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import Badge from "@/components/atoms/Badge";
import Select from "@/components/atoms/Select";
import { useToast } from "@/components/ui/ToastProvider";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";

import {
  generateBatchPlansWithAI,
  estimateBatchPlanCost,
  getStudentsContentsForBatch,
  type BatchPlanSettings,
  type StudentPlanResult,
  type BatchPlanGenerationResult,
} from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";

import {
  parseSSEEvent,
  type BatchStreamEvent,
} from "@/lib/domains/admin-plan/types/streaming";

import {
  generateBatchPreview,
  saveFromPreview,
} from "@/lib/domains/admin-plan/actions/batchPreviewPlans";
import type { BatchPreviewResult } from "@/lib/domains/admin-plan/types/preview";
import { BatchPreviewStep } from "./BatchPreviewStep";

import {
  hasRetryableStudents,
  mergeRetryResults,
  recalculateSummary,
} from "@/lib/domains/admin-plan/actions/batchRetry";

import type { ModelTier } from "@/lib/domains/plan/llm/types";
import type { StudentListRow } from "./types";

// ============================================
// 타입
// ============================================

type ModalStep = "settings" | "preview" | "progress" | "results";

interface BatchAIPlanModalProps {
  open: boolean;
  onClose: () => void;
  selectedStudents: StudentListRow[];
}

// ============================================
// 아이콘 컴포넌트
// ============================================

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

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

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
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
// 설정 스텝 컴포넌트
// ============================================

interface SettingsStepProps {
  settings: BatchPlanSettings;
  onSettingsChange: (settings: BatchPlanSettings) => void;
  studentCount: number;
  estimatedCost: { estimatedTotalCost: number; modelTier: ModelTier } | null;
}

function SettingsStep({
  settings,
  onSettingsChange,
  studentCount,
  estimatedCost,
}: SettingsStepProps) {
  const updateSetting = <K extends keyof BatchPlanSettings>(
    key: K,
    value: BatchPlanSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  // 기간 계산
  const getDaysDiff = () => {
    if (!settings.startDate || !settings.endDate) return 0;
    const start = new Date(settings.startDate);
    const end = new Date(settings.endDate);
    const diff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 0;
  };

  const daysDiff = getDaysDiff();
  const isValidPeriod = daysDiff > 0 && daysDiff <= 365;

  const modelOptions = [
    { value: "fast", label: "Fast (Haiku) - 빠르고 저렴" },
    { value: "standard", label: "Standard (Sonnet) - 균형" },
    { value: "advanced", label: "Advanced (Sonnet+) - 고품질" },
  ];

  const dailyMinutesOptions = [
    { value: "60", label: "1시간" },
    { value: "90", label: "1시간 30분" },
    { value: "120", label: "2시간" },
    { value: "150", label: "2시간 30분" },
    { value: "180", label: "3시간" },
    { value: "240", label: "4시간" },
    { value: "300", label: "5시간" },
  ];

  return (
    <div className="space-y-6 overflow-y-auto max-h-[60vh] px-1">
      {/* 대상 학생 수 */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border p-4",
          borderDefaultVar,
          "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
        )}
      >
        <UsersIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div>
          <p className={cn("text-sm font-medium", textPrimaryVar)}>
            선택된 학생 수
          </p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {studentCount}명
          </p>
        </div>
      </div>

      {/* 기간 설정 */}
      <div className="space-y-3">
        <label
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            textPrimaryVar
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          학습 기간 <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={settings.startDate}
            onChange={(e) => updateSetting("startDate", e.target.value)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
              bgSurfaceVar,
              textPrimaryVar,
              isValidPeriod
                ? "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-200"
                : "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
          <span className={textSecondaryVar}>~</span>
          <input
            type="date"
            value={settings.endDate}
            onChange={(e) => updateSetting("endDate", e.target.value)}
            min={settings.startDate}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
              bgSurfaceVar,
              textPrimaryVar,
              isValidPeriod
                ? "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-200"
                : "border-red-300 focus:border-red-500 focus:ring-red-200"
            )}
          />
        </div>
        {daysDiff > 0 && (
          <p
            className={cn(
              "text-sm",
              isValidPeriod ? textSecondaryVar : "text-red-500"
            )}
          >
            {daysDiff}일간의 학습 계획
            {daysDiff > 365 && " (최대 365일까지 설정 가능)"}
          </p>
        )}
      </div>

      {/* 일일 학습 시간 */}
      <div className="space-y-3">
        <label
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            textPrimaryVar
          )}
        >
          <ClockIcon className="h-4 w-4" />
          일일 학습 시간
        </label>
        <Select
          value={settings.dailyStudyMinutes.toString()}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            updateSetting("dailyStudyMinutes", parseInt(e.target.value))
          }
        >
          {dailyMinutesOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* AI 모델 선택 */}
      <div className="space-y-3">
        <label
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            textPrimaryVar
          )}
        >
          <SparklesIcon className="h-4 w-4" />
          AI 모델
        </label>
        <Select
          value={settings.modelTier || "fast"}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            updateSetting("modelTier", e.target.value as ModelTier)
          }
        >
          {modelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className={cn("text-xs", textSecondaryVar)}>
          Fast 모델은 빠르고 저렴하며, 대부분의 플랜 생성에 충분합니다.
        </p>
      </div>

      {/* 옵션 */}
      <div className="space-y-3">
        <label
          className={cn("text-sm font-medium", textPrimaryVar)}
        >
          플랜 옵션
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.prioritizeWeakSubjects || false}
              onChange={(e) =>
                updateSetting("prioritizeWeakSubjects", e.target.checked)
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={cn("text-sm", textPrimaryVar)}>
              취약 과목 우선 배치
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.balanceSubjects || false}
              onChange={(e) =>
                updateSetting("balanceSubjects", e.target.checked)
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={cn("text-sm", textPrimaryVar)}>
              과목간 균형 배치
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeReview || false}
              onChange={(e) => updateSetting("includeReview", e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={cn("text-sm", textPrimaryVar)}>
              복습 플랜 포함
            </span>
          </label>
        </div>
      </div>

      {/* 예상 비용 */}
      {estimatedCost && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border p-4",
            borderDefaultVar,
            "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
          )}
        >
          <CoinIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className={cn("text-sm font-medium", textPrimaryVar)}>
              예상 API 비용
            </p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              ${estimatedCost.estimatedTotalCost.toFixed(4)}
            </p>
            <p className={cn("text-xs", textSecondaryVar)}>
              학생당 약 ${(estimatedCost.estimatedTotalCost / studentCount).toFixed(4)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 진행 스텝 컴포넌트
// ============================================

interface ProgressStepProps {
  progress: number;
  total: number;
  currentStudent: string;
  results: StudentPlanResult[];
}

function ProgressStep({
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

// ============================================
// 새로고침 아이콘
// ============================================

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
// 결과 스텝 컴포넌트
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

function ResultsStep({
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

// ============================================
// 메인 컴포넌트
// ============================================

export function BatchAIPlanModal({
  open,
  onClose,
  selectedStudents,
}: BatchAIPlanModalProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // 상태
  const [step, setStep] = useState<ModalStep>("settings");
  const [isLoading, setIsLoading] = useState(false);

  // 설정
  const [settings, setSettings] = useState<BatchPlanSettings>(() => {
    const today = new Date();
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);

    return {
      startDate: today.toISOString().split("T")[0],
      endDate: thirtyDaysLater.toISOString().split("T")[0],
      dailyStudyMinutes: 180,
      prioritizeWeakSubjects: true,
      balanceSubjects: true,
      includeReview: false,
      modelTier: "fast",
    };
  });

  // 비용 추정
  const [estimatedCost, setEstimatedCost] = useState<{
    estimatedCostPerStudent: number;
    estimatedTotalCost: number;
    modelTier: ModelTier;
  } | null>(null);

  // 진행 상태
  const [progress, setProgress] = useState(0);
  const [currentStudent, setCurrentStudent] = useState("");
  const [results, setResults] = useState<StudentPlanResult[]>([]);
  const [finalResult, setFinalResult] = useState<BatchPlanGenerationResult | null>(null);

  // SSE 스트리밍 취소용 ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // 미리보기 관련 상태 (Phase 3)
  const [previewResult, setPreviewResult] = useState<BatchPreviewResult | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [previewStudents, setPreviewStudents] = useState<Array<{ studentId: string; contentIds: string[] }>>([]);

  // 재시도 관련 상태 (Phase 2)
  const [retryMode, setRetryMode] = useState(false);
  const [selectedRetryIds, setSelectedRetryIds] = useState<string[]>([]);
  const [originalContentsMap, setOriginalContentsMap] = useState<Map<string, string[]>>(new Map());

  // 비용 추정 업데이트
  useEffect(() => {
    if (selectedStudents.length > 0 && settings.modelTier) {
      estimateBatchPlanCost(selectedStudents.length, settings.modelTier)
        .then(setEstimatedCost)
        .catch(console.error);
    }
  }, [selectedStudents.length, settings.modelTier]);

  // 모달 닫힐 때 상태 초기화 및 스트리밍 취소
  useEffect(() => {
    if (!open) {
      // 진행 중인 스트리밍 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setStep("settings");
      setProgress(0);
      setCurrentStudent("");
      setResults([]);
      setFinalResult(null);
      // 미리보기 상태 초기화 (Phase 3)
      setPreviewResult(null);
      setSelectedStudentIds([]);
      setPreviewStudents([]);
      // 재시도 상태 초기화 (Phase 2)
      setRetryMode(false);
      setSelectedRetryIds([]);
      setOriginalContentsMap(new Map());
    }
  }, [open]);

  // 미리보기 생성 (Phase 3)
  const handlePreview = useCallback(async () => {
    if (selectedStudents.length === 0) {
      showError("선택된 학생이 없습니다.");
      return;
    }

    // 날짜 유효성 검사
    const startDate = new Date(settings.startDate);
    const endDate = new Date(settings.endDate);
    if (startDate >= endDate) {
      showError("종료일은 시작일 이후여야 합니다.");
      return;
    }

    setIsLoading(true);
    setStep("preview");
    setPreviewResult(null);

    try {
      // 학생별 콘텐츠 조회
      const studentIds = selectedStudents.map((s) => s.id);
      const contentsMap = await getStudentsContentsForBatch(studentIds);

      // 배치 생성 입력 준비
      const students = selectedStudents.map((s) => ({
        studentId: s.id,
        contentIds: contentsMap.get(s.id)?.contentIds || [],
      }));

      setPreviewStudents(students);

      // 미리보기 생성 실행
      const result = await generateBatchPreview({
        students,
        settings,
      });

      if (result.success && result.previews) {
        setPreviewResult(result);
        // 성공한 학생만 기본 선택
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
        setStep("settings");
      }
    } catch (error) {
      console.error("Preview Error:", error);
      showError(
        error instanceof Error ? error.message : "미리보기 생성 중 오류가 발생했습니다."
      );
      setStep("settings");
    } finally {
      setIsLoading(false);
    }
  }, [selectedStudents, settings, showError]);

  // 미리보기에서 저장 (Phase 3)
  const handleSaveFromPreview = useCallback(async () => {
    if (!previewResult || selectedStudentIds.length === 0) {
      showError("저장할 학생을 선택하세요.");
      return;
    }

    setIsLoading(true);
    setStep("progress");
    setProgress(0);

    try {
      const result = await saveFromPreview({
        studentIds: selectedStudentIds,
        previews: previewResult.previews,
        planGroupNameTemplate: "AI 학습 계획 ({startDate} ~ {endDate})",
      });

      if (result.success) {
        // 결과를 StudentPlanResult 형태로 변환
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
        setStep("results");
        showSuccess(`${result.summary.succeeded}명의 학생에게 플랜이 저장되었습니다.`);
      } else {
        showError("저장에 실패했습니다.");
        setStep("preview");
      }
    } catch (error) {
      console.error("Save Error:", error);
      showError(
        error instanceof Error ? error.message : "저장 중 오류가 발생했습니다."
      );
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  }, [previewResult, selectedStudentIds, showError, showSuccess]);

  // 직접 생성 시작 (미리보기 없이)
  const handleStart = useCallback(async () => {
    if (selectedStudents.length === 0) {
      showError("선택된 학생이 없습니다.");
      return;
    }

    // 날짜 유효성 검사
    const startDate = new Date(settings.startDate);
    const endDate = new Date(settings.endDate);
    if (startDate >= endDate) {
      showError("종료일은 시작일 이후여야 합니다.");
      return;
    }

    setIsLoading(true);
    setStep("progress");
    setProgress(0);
    setResults([]);
    setRetryMode(false);
    setSelectedRetryIds([]);

    // AbortController 생성
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 학생별 콘텐츠 조회
      const studentIds = selectedStudents.map((s) => s.id);
      const contentsMap = await getStudentsContentsForBatch(studentIds);

      // 재시도용 콘텐츠 맵 저장 (Phase 2)
      const contentsMapForRetry = new Map<string, string[]>();
      contentsMap.forEach((value, key) => {
        contentsMapForRetry.set(key, value.contentIds);
      });
      setOriginalContentsMap(contentsMapForRetry);

      // 배치 생성 입력 준비
      const students = selectedStudents.map((s) => ({
        studentId: s.id,
        contentIds: contentsMap.get(s.id)?.contentIds || [],
      }));

      // SSE 스트리밍 요청
      const response = await fetch("/api/admin/batch-plan/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students,
          settings,
          planGroupNameTemplate: "AI 학습 계획 ({startDate} ~ {endDate})",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "배치 플랜 생성 요청에 실패했습니다.");
      }

      // SSE 스트림 읽기
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

        // 완전한 이벤트 라인 파싱
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // 마지막 불완전한 라인 유지

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = parseSSEEvent(line);
          if (!event) continue;

          // 이벤트 타입별 처리
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
              setResults(event.results);
              setFinalResult({
                success: true,
                results: event.results,
                summary: event.summary,
              });
              setStep("results");
              showSuccess(
                `${event.summary.succeeded}명의 학생에게 플랜이 생성되었습니다.`
              );
              break;

            case "batch_error":
              throw new Error(event.error);
          }
        }
      }
    } catch (error) {
      // 취소된 경우 에러 메시지 표시 안함
      if (error instanceof Error && error.name === "AbortError") {
        setStep("settings");
        return;
      }

      console.error("Batch AI Plan Error:", error);
      showError(
        error instanceof Error ? error.message : "배치 플랜 생성 중 오류가 발생했습니다."
      );
      setStep("settings");
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [selectedStudents, settings, showSuccess, showError]);

  // 완료 후 처리
  const handleComplete = useCallback(() => {
    onClose();
    router.refresh();
  }, [onClose, router]);

  // 재시도 모드 토글 (Phase 2)
  const handleToggleRetryMode = useCallback(() => {
    if (retryMode) {
      // 재시도 모드 끄기
      setRetryMode(false);
      setSelectedRetryIds([]);
    } else {
      // 재시도 모드 켜기 - 실패한 학생 자동 선택
      setRetryMode(true);
      if (finalResult) {
        const retryableIds = finalResult.results
          .filter((r) => r.status === "error" || r.status === "skipped")
          .map((r) => r.studentId);
        setSelectedRetryIds(retryableIds);
      }
    }
  }, [retryMode, finalResult]);

  // 재시도 실행 (Phase 2)
  const handleRetry = useCallback(async () => {
    if (selectedRetryIds.length === 0) {
      showError("재시도할 학생을 선택하세요.");
      return;
    }

    if (!finalResult) {
      showError("결과를 찾을 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setStep("progress");
    setProgress(0);
    setRetryMode(false);

    // AbortController 생성
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 재시도할 학생 정보 준비
      const students = selectedRetryIds.map((studentId) => ({
        studentId,
        contentIds: originalContentsMap.get(studentId) || [],
      }));

      // SSE 스트리밍 요청
      const response = await fetch("/api/admin/batch-plan/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students,
          settings,
          planGroupNameTemplate: "AI 학습 계획 ({startDate} ~ {endDate})",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "재시도 요청에 실패했습니다.");
      }

      // SSE 스트림 읽기
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

        // 완전한 이벤트 라인 파싱
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
              // 기존 결과와 재시도 결과 병합
              const mergedResults = mergeRetryResults(
                finalResult.results,
                event.results
              );
              const newSummary = recalculateSummary(mergedResults);
              setResults(mergedResults);
              setFinalResult({
                success: true,
                results: mergedResults,
                summary: {
                  ...newSummary,
                  skipped: mergedResults.filter((r) => r.status === "skipped").length,
                },
              });
              setStep("results");
              setSelectedRetryIds([]);
              showSuccess(
                `${event.summary.succeeded}명의 학생 재시도가 완료되었습니다.`
              );
              break;

            case "batch_error":
              throw new Error(event.error);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStep("results");
        return;
      }

      console.error("Retry Error:", error);
      showError(
        error instanceof Error ? error.message : "재시도 중 오류가 발생했습니다."
      );
      setStep("results");
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [selectedRetryIds, finalResult, originalContentsMap, settings, showSuccess, showError]);

  // 재시도 가능 여부 확인
  const canRetry = finalResult
    ? hasRetryableStudents(finalResult.results)
    : false;

  // 스텝별 타이틀
  const getTitle = () => {
    switch (step) {
      case "settings":
        return "배치 AI 플랜 생성";
      case "preview":
        return "플랜 미리보기";
      case "progress":
        return "플랜 저장 중...";
      case "results":
        return "생성 완료";
    }
  };

  // 스텝별 설명
  const getDescription = () => {
    switch (step) {
      case "settings":
        return `${selectedStudents.length}명의 학생에게 AI 플랜을 생성합니다.`;
      case "preview":
        return "생성된 플랜을 확인하고 저장할 학생을 선택하세요.";
      case "progress":
        return "선택된 학생의 플랜을 저장하고 있습니다.";
      case "results":
        return "모든 학생의 플랜 생성이 완료되었습니다.";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !isLoading && onClose()}
      title={getTitle()}
      description={getDescription()}
      size="lg"
      showCloseButton={step !== "progress"}
    >
      <DialogContent>
        {step === "settings" && (
          <SettingsStep
            settings={settings}
            onSettingsChange={setSettings}
            studentCount={selectedStudents.length}
            estimatedCost={estimatedCost}
          />
        )}
        {step === "preview" && previewResult && (
          <BatchPreviewStep
            previewResult={previewResult}
            selectedStudentIds={selectedStudentIds}
            onSelectionChange={setSelectedStudentIds}
            isLoading={isLoading}
          />
        )}
        {step === "preview" && !previewResult && isLoading && (
          <div className="flex items-center justify-center py-12">
            <LoaderIcon className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3" style={{ color: textSecondaryVar }}>
              미리보기 생성 중...
            </span>
          </div>
        )}
        {step === "progress" && (
          <ProgressStep
            progress={progress}
            total={selectedStudentIds.length || selectedStudents.length}
            currentStudent={currentStudent}
            results={results}
          />
        )}
        {step === "results" && (
          <ResultsStep
            result={finalResult}
            retryMode={retryMode}
            selectedRetryIds={selectedRetryIds}
            onRetrySelectionChange={setSelectedRetryIds}
          />
        )}
      </DialogContent>
      <DialogFooter>
        {step === "settings" && (
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
        {step === "preview" && (
          <>
            <Button
              variant="outline"
              onClick={() => setStep("settings")}
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
        {step === "progress" && (
          <Button variant="outline" disabled>
            저장 중...
          </Button>
        )}
        {step === "results" && (
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
    </Dialog>
  );
}
