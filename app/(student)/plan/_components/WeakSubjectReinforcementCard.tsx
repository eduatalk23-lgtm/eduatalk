/**
 * 취약 과목 강화 스케줄 카드 컴포넌트
 *
 * 취약 과목에 대한 강화 스케줄을 표시하고 권장사항을 제공합니다.
 */

"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { getWeakSubjectReinforcement } from "@/lib/domains/plan/actions/plan-groups";
import type { WeakSubjectReinforcementPlan, WeakSubjectReinforcement } from "@/lib/domains/plan/services";
import {
  Target,
  RefreshCw,
  Clock,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/cn";

type WeakSubjectReinforcementCardProps = {
  studentId: string;
  /** 분석할 과거 일수 (기본값: 30) */
  daysBack?: number;
  /** 목표 완료율 (기본값: 80) */
  targetCompletionRate?: number;
};

/**
 * 개별 과목 강화 카드
 */
const SubjectReinforcementItem = memo(function SubjectReinforcementItem({
  reinforcement,
}: {
  reinforcement: WeakSubjectReinforcement;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 완료율 차이에 따른 색상
  const completionGap = reinforcement.targetCompletionRate - reinforcement.currentCompletionRate;
  const gapColor = completionGap > 40 ? "red" : completionGap > 20 ? "orange" : "yellow";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="rounded-lg bg-red-100 p-2">
            <BookOpen className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {reinforcement.subject}
              </span>
              {reinforcement.subjectCategory && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {reinforcement.subjectCategory}
                </span>
              )}
            </div>

            {/* 완료율 비교 */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">
                현재 <span className={cn(
                  "font-medium",
                  gapColor === "red" ? "text-red-600" :
                  gapColor === "orange" ? "text-orange-600" : "text-yellow-600"
                )}>{reinforcement.currentCompletionRate}%</span>
              </span>
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">
                목표 <span className="font-medium text-green-600">{reinforcement.targetCompletionRate}%</span>
              </span>
            </div>

            {/* 핵심 지표 */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                추가 학습: <span className="font-medium">{reinforcement.additionalMinutesNeeded}분</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                권장 시간: <span className="font-medium">{reinforcement.suggestedTimePeriod.label}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                권장 요일: <span className="font-medium">{reinforcement.suggestedDays.map(d => d.label).join(", ")}</span>
              </div>
            </div>

            {/* 확장 섹션 */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-700 mb-2">학습 팁:</p>
                <ul className="space-y-1.5">
                  {reinforcement.tips.map((tip, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-gray-600"
                    >
                      <span className="text-green-500 mt-0.5">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition"
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
 * 취약 과목 강화 스케줄 메인 컴포넌트
 */
export function WeakSubjectReinforcementCard({
  studentId,
  daysBack = 30,
  targetCompletionRate = 80,
}: WeakSubjectReinforcementCardProps) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<WeakSubjectReinforcementPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getWeakSubjectReinforcement(
        studentId,
        daysBack,
        targetCompletionRate
      );
      if (result.success && result.data) {
        setPlan(result.data);
      } else {
        setError(result.error || "강화 스케줄 생성에 실패했습니다.");
      }
    } catch (err) {
      console.error("[WeakSubjectReinforcementCard] 로드 실패:", err);
      setError("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [studentId, daysBack, targetCompletionRate]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-orange-600 border-r-transparent" />
            <p className="text-sm text-gray-600">취약 과목 분석 중...</p>
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

  // 취약 과목이 없으면 표시하지 않음
  if (!plan || plan.weakSubjectsCount === 0) {
    return null;
  }

  // 시간 포맷
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-orange-200 bg-orange-50 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            취약 과목 강화 스케줄
          </h3>
        </div>
        <button
          onClick={loadPlan}
          className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 transition hover:bg-orange-100"
          title="새로고침"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* 요약 */}
      <div className="rounded-lg bg-white p-4 border border-orange-100">
        <p className="text-sm text-gray-700">{plan.summary}</p>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <div className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-4 w-4" />
            <span>취약 과목: <strong>{plan.weakSubjectsCount}개</strong></span>
          </div>
          <div className="flex items-center gap-2 text-orange-700">
            <Clock className="h-4 w-4" />
            <span>추가 학습 필요: <strong>{formatTime(plan.totalAdditionalMinutes)}</strong></span>
          </div>
        </div>
      </div>

      {/* 과목별 강화 스케줄 */}
      <div className="flex flex-col gap-3">
        {plan.reinforcements.map((reinforcement, idx) => (
          <SubjectReinforcementItem key={idx} reinforcement={reinforcement} />
        ))}
      </div>

      {/* 하단 안내 */}
      <p className="text-xs text-gray-500 text-right">
        기준: 최근 {daysBack}일 학습 데이터 | 목표 완료율: {targetCompletionRate}%
      </p>
    </div>
  );
}
