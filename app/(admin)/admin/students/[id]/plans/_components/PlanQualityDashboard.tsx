"use client";

/**
 * 플랜 품질 대시보드
 *
 * Phase 4: 플랜 품질 대시보드
 *
 * 플랜 그룹의 품질 메트릭을 시각화합니다.
 *
 * @module PlanQualityDashboard
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import { analyzePlanQuality } from "@/lib/domains/admin-plan/actions/planQualityAnalysis";
import type {
  PlanQualityDashboardData,
  QualityDimension,
  QualitySuggestion,
} from "@/lib/domains/admin-plan/types/qualityMetrics";

// ============================================
// Props
// ============================================

interface PlanQualityDashboardProps {
  planGroupId: string;
  planGroupName?: string;
}

// ============================================
// 아이콘 컴포넌트
// ============================================

function BalanceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
      />
    </svg>
  );
}

function ConflictIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function CoverageIcon({ className }: { className?: string }) {
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

function PacingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

// ============================================
// 등급 색상 헬퍼
// ============================================

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "text-green-600";
    case "B":
      return "text-blue-600";
    case "C":
      return "text-yellow-600";
    case "D":
      return "text-orange-600";
    case "F":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

function getGradeBgColor(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-green-50 dark:bg-green-950/30";
    case "B":
      return "bg-blue-50 dark:bg-blue-950/30";
    case "C":
      return "bg-yellow-50 dark:bg-yellow-950/30";
    case "D":
      return "bg-orange-50 dark:bg-orange-950/30";
    case "F":
      return "bg-red-50 dark:bg-red-950/30";
    default:
      return "bg-gray-50 dark:bg-gray-800";
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "high":
      return "text-red-600 bg-red-50 dark:bg-red-950/30";
    case "medium":
      return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
    case "low":
      return "text-blue-600 bg-blue-50 dark:bg-blue-950/30";
    default:
      return "text-gray-600 bg-gray-50 dark:bg-gray-800";
  }
}

// ============================================
// 서브 컴포넌트
// ============================================

interface ScoreCardProps {
  dimension: QualityDimension;
  icon: React.ReactNode;
}

function ScoreCard({ dimension, icon }: ScoreCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        borderDefaultVar,
        getGradeBgColor(dimension.grade)
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={cn("font-medium text-sm", textPrimaryVar)}>
          {dimension.label}
        </span>
        <span
          className={cn(
            "ml-auto text-lg font-bold",
            getGradeColor(dimension.grade)
          )}
        >
          {dimension.grade}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold", textPrimaryVar)}>
          {dimension.score}
        </span>
        <span className={textSecondaryVar}>/ 100</span>
      </div>
      <p className={cn("text-xs mt-1", textSecondaryVar)}>
        {dimension.details || dimension.description}
      </p>
    </div>
  );
}

interface SubjectChartProps {
  data: PlanQualityDashboardData["subjectDistribution"];
}

function SubjectChart({ data }: SubjectChartProps) {
  if (data.length === 0) {
    return (
      <div className={cn("text-center py-4", textSecondaryVar)}>
        데이터가 없습니다.
      </div>
    );
  }

  const maxMinutes = Math.max(...data.map((d) => d.totalMinutes));

  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.subject} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className={textPrimaryVar}>{item.subject}</span>
            <span className={textSecondaryVar}>
              {Math.round(item.totalMinutes / 60)}시간 ({item.percentage.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(item.totalMinutes / maxMinutes) * 100}%`,
                backgroundColor: item.color || "#3B82F6",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SuggestionListProps {
  suggestions: QualitySuggestion[];
}

function SuggestionList({ suggestions }: SuggestionListProps) {
  if (suggestions.length === 0) {
    return (
      <div className={cn("text-center py-4 text-sm", textSecondaryVar)}>
        개선 제안이 없습니다. 플랜 품질이 양호합니다!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {suggestions.map((suggestion, idx) => (
        <div
          key={idx}
          className={cn(
            "rounded-lg p-3 text-sm",
            getSeverityColor(suggestion.severity)
          )}
        >
          <p className="font-medium">{suggestion.message}</p>
          {suggestion.action && (
            <p className="text-xs mt-1 opacity-80">{suggestion.action}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function PlanQualityDashboard({
  planGroupId,
  planGroupName,
}: PlanQualityDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<PlanQualityDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzePlanQuality(planGroupId);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "품질 분석에 실패했습니다.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "품질 분석 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [planGroupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg border p-6",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <div className="flex items-center justify-center gap-2 py-8">
          <LoaderIcon className="h-5 w-5 text-blue-600" />
          <span className={textSecondaryVar}>품질 분석 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border p-6",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">{error}</p>
          <button
            onClick={loadData}
            className="text-sm text-blue-600 hover:underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { metrics, subjectDistribution, planGroupInfo, suggestions } = data;

  return (
    <div
      className={cn(
        "rounded-lg border p-6 space-y-6",
        borderDefaultVar,
        bgSurfaceVar
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartIcon className="h-5 w-5 text-purple-600" />
          <h3 className={cn("font-semibold", textPrimaryVar)}>플랜 품질 분석</h3>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
            getGradeBgColor(metrics.overallGrade),
            getGradeColor(metrics.overallGrade)
          )}
        >
          <span>종합 등급</span>
          <span className="text-lg font-bold">{metrics.overallGrade}</span>
          <span className="text-xs opacity-70">({metrics.overallScore}점)</span>
        </div>
      </div>

      {/* 플랜 그룹 정보 */}
      <div className={cn("text-sm", textSecondaryVar)}>
        <span className="font-medium">{planGroupName || planGroupInfo.name}</span>
        <span className="mx-2">|</span>
        <span>
          {planGroupInfo.startDate} ~ {planGroupInfo.endDate}
        </span>
        <span className="mx-2">|</span>
        <span>{planGroupInfo.totalPlans}개 플랜</span>
        <span className="mx-2">|</span>
        <span>총 {Math.round(planGroupInfo.totalMinutes / 60)}시간</span>
      </div>

      {/* 품질 점수 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard
          dimension={metrics.balance}
          icon={<BalanceIcon className="h-4 w-4 text-blue-600" />}
        />
        <ScoreCard
          dimension={metrics.conflicts}
          icon={<ConflictIcon className="h-4 w-4 text-orange-600" />}
        />
        <ScoreCard
          dimension={metrics.coverage}
          icon={<CoverageIcon className="h-4 w-4 text-green-600" />}
        />
        <ScoreCard
          dimension={metrics.pacing}
          icon={<PacingIcon className="h-4 w-4 text-purple-600" />}
        />
      </div>

      {/* 과목별 분포 & 개선 제안 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className={cn("text-sm font-medium", textPrimaryVar)}>
            과목별 학습 시간
          </h4>
          <SubjectChart data={subjectDistribution} />
        </div>
        <div className="space-y-3">
          <h4 className={cn("text-sm font-medium", textPrimaryVar)}>
            개선 제안
          </h4>
          <SuggestionList suggestions={suggestions} />
        </div>
      </div>
    </div>
  );
}
