"use client";

/**
 * 배치 AI 플랜 - 설정 스텝
 */

import { cn } from "@/lib/cn";
import Select from "@/components/atoms/Select";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import type { BatchPlanSettings } from "@/lib/domains/admin-plan/actions/batchAIPlanGeneration";
import type { ModelTier } from "@/lib/domains/plan/llm/types";

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
// Props
// ============================================

interface SettingsStepProps {
  settings: BatchPlanSettings;
  onSettingsChange: (settings: Partial<BatchPlanSettings>) => void;
  studentCount: number;
  estimatedCost: { estimatedTotalCost: number; modelTier: ModelTier } | null;
}

// ============================================
// 컴포넌트
// ============================================

export function SettingsStep({
  settings,
  onSettingsChange,
  studentCount,
  estimatedCost,
}: SettingsStepProps) {
  const updateSetting = <K extends keyof BatchPlanSettings>(
    key: K,
    value: BatchPlanSettings[K]
  ) => {
    onSettingsChange({ [key]: value });
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
        <label className={cn("text-sm font-medium", textPrimaryVar)}>
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
