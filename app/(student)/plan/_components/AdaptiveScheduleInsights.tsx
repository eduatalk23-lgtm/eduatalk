/**
 * 적응형 스케줄 인사이트 컴포넌트
 *
 * 학습 패턴 분석 결과와 스케줄 조정 권장사항을 표시합니다.
 */

"use client";

import { useState, useEffect, useCallback, memo, useMemo } from "react";
import { getAdaptiveScheduleAnalysis } from "@/lib/domains/plan/actions/plan-groups";
import type { AdaptiveScheduleAnalysis, ScheduleRecommendation } from "@/lib/domains/plan/services";
import {
  Brain,
  RefreshCw,
  Clock,
  Calendar,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
} from "lucide-react";
import { cn } from "@/lib/cn";

type AdaptiveScheduleInsightsProps = {
  studentId: string;
  /** 분석할 과거 일수 (기본값: 30) */
  daysBack?: number;
  /** 간략 모드 (권장사항만 표시) */
  compact?: boolean;
};

/**
 * 시간대 성과 차트
 */
const TimePeriodChart = memo(function TimePeriodChart({
  data,
}: {
  data: AdaptiveScheduleAnalysis["patterns"]["timePeriodPerformance"];
}) {
  if (data.length === 0) return null;

  const maxPlans = Math.max(...data.map((d) => d.totalPlans));

  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Clock className="h-4 w-4" />
        시간대별 완료율
      </h4>
      <div className="flex flex-col gap-1.5">
        {data.map((period) => (
          <div key={period.period} className="flex items-center gap-3">
            <span className="w-12 text-xs text-gray-600">{period.label}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  period.completionRate >= 70
                    ? "bg-green-500"
                    : period.completionRate >= 50
                    ? "bg-yellow-500"
                    : "bg-red-400"
                )}
                style={{ width: `${Math.max(period.completionRate, 5)}%` }}
              />
            </div>
            <span className="w-12 text-right text-xs font-medium text-gray-700">
              {period.completionRate}%
            </span>
            <span className="w-16 text-right text-xs text-gray-500">
              ({period.totalPlans}개)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * 요일별 성과 차트
 */
const DayOfWeekChart = memo(function DayOfWeekChart({
  data,
}: {
  data: AdaptiveScheduleAnalysis["patterns"]["dayOfWeekPerformance"];
}) {
  if (data.length === 0) return null;

  // 요일 순서로 정렬
  const sortedData = [...data].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Calendar className="h-4 w-4" />
        요일별 완료율
      </h4>
      <div className="flex gap-1">
        {sortedData.map((day) => (
          <div
            key={day.dayOfWeek}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <div className="relative w-full h-20 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className={cn(
                  "absolute bottom-0 w-full rounded-b-lg transition-all",
                  day.completionRate >= 70
                    ? "bg-green-500"
                    : day.completionRate >= 50
                    ? "bg-yellow-500"
                    : "bg-red-400"
                )}
                style={{ height: `${Math.max(day.completionRate, 5)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                {day.completionRate}%
              </span>
            </div>
            <span className="text-xs text-gray-600">{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * 과목별 성과 목록
 */
const SubjectPerformanceList = memo(function SubjectPerformanceList({
  data,
  showWeak = false,
}: {
  data: AdaptiveScheduleAnalysis["patterns"]["subjectPerformance"];
  showWeak?: boolean;
}) {
  const filteredData = showWeak ? data.filter((s) => s.isWeak) : data.slice(0, 5);

  if (filteredData.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <BookOpen className="h-4 w-4" />
        {showWeak ? "취약 과목" : "과목별 현황"}
      </h4>
      <div className="flex flex-col gap-1.5">
        {filteredData.map((subject) => (
          <div
            key={subject.subject}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
              subject.isWeak
                ? "bg-red-50 border border-red-100"
                : "bg-gray-50"
            )}
          >
            <span className="font-medium text-gray-700">{subject.subject}</span>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-xs",
                  subject.isWeak ? "text-red-600" : "text-gray-600"
                )}
              >
                완료율 {subject.completionRate}%
              </span>
              <span className="text-xs text-gray-500">
                {subject.totalPlans}개
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * 권장사항 카드
 */
const RecommendationCard = memo(function RecommendationCard({
  recommendation,
}: {
  recommendation: ScheduleRecommendation;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getTypeIcon = () => {
    switch (recommendation.type) {
      case "time_shift":
        return <Clock className="h-4 w-4" />;
      case "day_change":
        return <Calendar className="h-4 w-4" />;
      case "subject_focus":
        return <Target className="h-4 w-4" />;
      case "workload_adjust":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getPriorityColor = () => {
    if (recommendation.priority >= 5) return "bg-red-50 border-red-200";
    if (recommendation.priority >= 4) return "bg-orange-50 border-orange-200";
    if (recommendation.priority >= 3) return "bg-yellow-50 border-yellow-200";
    return "bg-blue-50 border-blue-200";
  };

  const getPriorityLabel = () => {
    if (recommendation.priority >= 5) return "높음";
    if (recommendation.priority >= 3) return "보통";
    return "낮음";
  };

  return (
    <div
      className={cn("rounded-lg border p-4 transition-all", getPriorityColor())}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-gray-600">{getTypeIcon()}</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">
                {recommendation.title}
              </span>
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium",
                  recommendation.priority >= 5
                    ? "bg-red-100 text-red-700"
                    : recommendation.priority >= 4
                    ? "bg-orange-100 text-orange-700"
                    : recommendation.priority >= 3
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-blue-100 text-blue-700"
                )}
              >
                {getPriorityLabel()}
              </span>
            </div>
            <p className="text-sm text-gray-600">{recommendation.description}</p>
            {isExpanded && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <TrendingUp className="h-4 w-4" />
                  {recommendation.expectedImprovement}
                </div>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {recommendation.actions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-lg p-1 text-gray-500 hover:bg-white/50 transition"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
});

/**
 * 적응형 스케줄 인사이트 메인 컴포넌트
 */
export function AdaptiveScheduleInsights({
  studentId,
  daysBack = 30,
  compact = false,
}: AdaptiveScheduleInsightsProps) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AdaptiveScheduleAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getAdaptiveScheduleAnalysis(studentId, daysBack);
      if (result.success && result.data) {
        setAnalysis(result.data);
      } else {
        setError(result.error || "분석에 실패했습니다.");
      }
    } catch (err) {
      console.error("[AdaptiveScheduleInsights] 분석 로드 실패:", err);
      setError("분석을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [studentId, daysBack]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  // 전체 요약 통계
  const summaryStats = useMemo(() => {
    if (!analysis) return null;

    const { patterns } = analysis;
    return {
      analyzedPlans: patterns.analyzedPlansCount,
      completionRate: patterns.overallCompletionRate,
      optimalTime: patterns.optimalTimePeriod?.label,
      optimalDay: patterns.optimalDayOfWeek?.label,
      weakSubjectsCount: patterns.weakSubjects.length,
    };
  }, [analysis]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent" />
            <p className="text-sm text-gray-600">학습 패턴 분석 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!analysis || analysis.recommendations.length === 0) {
    return null; // 분석 결과가 없으면 표시하지 않음
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            학습 패턴 분석
          </h3>
        </div>
        <button
          onClick={loadAnalysis}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          title="분석 새로고침"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* 요약 통계 */}
      {summaryStats && (
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">분석 플랜</span>
            <span className="text-lg font-semibold text-gray-900">
              {summaryStats.analyzedPlans}개
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">전체 완료율</span>
            <span
              className={cn(
                "text-lg font-semibold",
                summaryStats.completionRate >= 70
                  ? "text-green-600"
                  : summaryStats.completionRate >= 50
                  ? "text-yellow-600"
                  : "text-red-600"
              )}
            >
              {summaryStats.completionRate}%
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">최적 학습 시간</span>
            <span className="text-lg font-semibold text-gray-900">
              {summaryStats.optimalTime || "-"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">취약 과목</span>
            <span
              className={cn(
                "text-lg font-semibold",
                summaryStats.weakSubjectsCount > 0 ? "text-red-600" : "text-green-600"
              )}
            >
              {summaryStats.weakSubjectsCount}개
            </span>
          </div>
        </div>
      )}

      {/* 권장사항 */}
      <div className="flex flex-col gap-3">
        <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Lightbulb className="h-4 w-4" />
          스케줄 조정 권장사항
        </h4>
        {analysis.recommendations.map((rec, idx) => (
          <RecommendationCard key={idx} recommendation={rec} />
        ))}
      </div>

      {/* 상세 분석 토글 (compact 모드가 아닐 때) */}
      {!compact && (
        <>
          <button
            onClick={() => setIsDetailExpanded(!isDetailExpanded)}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            {isDetailExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                상세 분석 숨기기
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                상세 분석 보기
              </>
            )}
          </button>

          {/* 상세 분석 내용 */}
          {isDetailExpanded && (
            <div className="flex flex-col gap-6 border-t border-gray-200 pt-4">
              {/* 시간대별 성과 */}
              <TimePeriodChart data={analysis.patterns.timePeriodPerformance} />

              {/* 요일별 성과 */}
              <DayOfWeekChart data={analysis.patterns.dayOfWeekPerformance} />

              {/* 취약 과목 */}
              {analysis.patterns.weakSubjects.length > 0 && (
                <SubjectPerformanceList
                  data={analysis.patterns.weakSubjects}
                  showWeak
                />
              )}

              {/* 과목별 성과 */}
              <SubjectPerformanceList data={analysis.patterns.subjectPerformance} />
            </div>
          )}
        </>
      )}

      {/* 분석 일시 */}
      <p className="text-xs text-gray-400 text-right">
        분석 기준: {new Date(analysis.analyzedAt).toLocaleString("ko-KR")}
      </p>
    </div>
  );
}
