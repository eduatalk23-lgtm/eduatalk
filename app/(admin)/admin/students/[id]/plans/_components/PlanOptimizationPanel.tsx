"use client";

/**
 * 플랜 최적화 AI 패널 (관리자용)
 *
 * Claude API를 사용하여 학생의 플랜 실행 데이터를 분석하고
 * 효율성 점수와 개선 제안을 제공합니다.
 *
 * @module PlanOptimizationPanel
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";
import Badge from "@/components/atoms/Badge";
import Select from "@/components/atoms/Select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Card, CardHeader, CardContent } from "@/components/molecules/Card";
import { Spinner } from "@/components/atoms/Spinner";

import {
  analyzePlanEfficiency,
  type OptimizePlanResult,
} from "@/lib/domains/plan/llm/actions/optimizePlan";
import type {
  PlanOptimizationResponse,
  OptimizationSuggestion,
  StrengthAnalysis,
  WeaknessAnalysis,
  Priority,
  OptimizationCategory,
} from "@/lib/domains/plan/llm/prompts/planOptimization";

// ============================================
// 타입 정의
// ============================================

interface PlanOptimizationPanelProps {
  /** 학생 ID */
  studentId: string;
  /** 학생 이름 (선택적 - controlled 모드에서는 생략 가능) */
  studentName?: string;
  /** 플랜 그룹 ID (선택적) */
  planGroupId?: string;
  /** 외부에서 다이얼로그 상태 제어 (controlled mode) */
  open?: boolean;
  /** 다이얼로그 상태 변경 핸들러 (controlled mode) */
  onOpenChange?: (open: boolean) => void;
  /** 트리거 버튼 숨김 (controlled mode에서 사용) */
  hideTrigger?: boolean;
}

// ============================================
// 아이콘 컴포넌트
// ============================================

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function TrendingDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function BalanceIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3v18" />
      <path d="M5 12l7-9 7 9" />
      <path d="M5 12l-2 6h18l-2-6" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

// ============================================
// 헬퍼 함수
// ============================================

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 75) return "text-blue-600 dark:text-blue-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 90)
    return "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800";
  if (score >= 75)
    return "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800";
  if (score >= 60)
    return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800";
  if (score >= 40)
    return "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800";
  return "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800";
}

function getGradeLabel(
  grade: PlanOptimizationResponse["scoreGrade"]
): string {
  const labels: Record<PlanOptimizationResponse["scoreGrade"], string> = {
    excellent: "우수",
    good: "양호",
    average: "보통",
    needs_improvement: "개선 필요",
    poor: "미흡",
  };
  return labels[grade];
}

function getPriorityBadgeVariant(
  priority: Priority
): "error" | "warning" | "default" {
  const variants: Record<Priority, "error" | "warning" | "default"> = {
    high: "error",
    medium: "warning",
    low: "default",
  };
  return variants[priority];
}

function getPriorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    high: "높음",
    medium: "중간",
    low: "낮음",
  };
  return labels[priority];
}

function getCategoryIcon(category: OptimizationCategory) {
  const icons: Record<OptimizationCategory, React.ReactNode> = {
    time_allocation: <ClockIcon className="h-4 w-4" />,
    subject_balance: <BalanceIcon className="h-4 w-4" />,
    workload: <TargetIcon className="h-4 w-4" />,
    rest_pattern: <ClockIcon className="h-4 w-4" />,
    review_cycle: <LightbulbIcon className="h-4 w-4" />,
    motivation: <TrendingUpIcon className="h-4 w-4" />,
    efficiency: <SparklesIcon className="h-4 w-4" />,
  };
  return icons[category];
}

function getCategoryLabel(category: OptimizationCategory): string {
  const labels: Record<OptimizationCategory, string> = {
    time_allocation: "시간 배치",
    subject_balance: "과목 균형",
    workload: "학습량",
    rest_pattern: "휴식 패턴",
    review_cycle: "복습 주기",
    motivation: "동기 부여",
    efficiency: "효율성",
  };
  return labels[category];
}

// ============================================
// 서브 컴포넌트
// ============================================

function ScoreGauge({
  score,
  grade,
}: {
  score: number;
  grade: PlanOptimizationResponse["scoreGrade"];
}) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90" width="150" height="150">
        <circle
          cx="75"
          cy="75"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx="75"
          cy="75"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-500",
            getScoreColor(score)
          )}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("text-3xl font-bold", getScoreColor(score))}>
          {score}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {getGradeLabel(grade)}
        </span>
      </div>
    </div>
  );
}

function CategoryScoreBar({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <span className={cn("font-medium", getScoreColor(score))}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            score >= 75
              ? "bg-blue-500"
              : score >= 50
              ? "bg-yellow-500"
              : "bg-red-500"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StrengthCard({ strength }: { strength: StrengthAnalysis }) {
  return (
    <div className="flex gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
      <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-green-800 dark:text-green-200">
          {strength.area}
        </p>
        <p className="text-sm text-green-700 dark:text-green-300">
          {strength.description}
        </p>
        {strength.metric && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            {strength.metric}
          </p>
        )}
      </div>
    </div>
  );
}

function WeaknessCard({ weakness }: { weakness: WeaknessAnalysis }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
      <AlertCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-amber-800 dark:text-amber-200">
          {weakness.area}
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {weakness.description}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          → {weakness.improvementDirection}
        </p>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: OptimizationSuggestion }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="flex-shrink-0 p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          {getCategoryIcon(suggestion.category)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={getPriorityBadgeVariant(suggestion.priority)} size="sm">
              {getPriorityLabel(suggestion.priority)}
            </Badge>
            <Badge variant="default" size="sm">
              {getCategoryLabel(suggestion.category)}
            </Badge>
          </div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {suggestion.title}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {suggestion.description}
          </p>
        </div>
        <svg
          className={cn(
            "h-5 w-5 text-gray-400 transition-transform",
            isExpanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                예상 효과
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {suggestion.expectedImprovement}
              </p>
            </div>

            {suggestion.relatedMetrics && (
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">현재: </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {suggestion.relatedMetrics.current}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">목표: </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {suggestion.relatedMetrics.target}
                  </span>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                실행 방안
              </p>
              <ul className="space-y-1">
                {suggestion.actionItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="text-blue-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export default function PlanOptimizationPanel({
  studentId,
  studentName = "학생",
  planGroupId,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: PlanOptimizationPanelProps) {
  // Controlled vs Uncontrolled 모드 지원
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (value: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [analysisDays, setAnalysisDays] = useState("30");
  const [result, setResult] = useState<OptimizePlanResult["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await analyzePlanEfficiency({
        studentId,
        analysisDays: parseInt(analysisDays),
        planGroupId,
        modelTier: "fast",
      });

      if (response.success && response.data) {
        setResult(response.data);
      } else {
        setError(response.error || "분석에 실패했습니다.");
      }
    } catch (err) {
      console.error("Plan optimization error:", err);
      setError(
        err instanceof Error ? err.message : "분석 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [studentId, analysisDays, planGroupId]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // 모달 닫을 때 결과 유지 (재사용 가능)
  }, [isControlled, onOpenChange]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setError(null);
  }, [isControlled, onOpenChange]);

  return (
    <>
      {/* 트리거 버튼 (hideTrigger가 false인 경우에만 표시) */}
      {!hideTrigger && (
        <Button variant="outline" onClick={handleOpen}>
          <SparklesIcon className="h-4 w-4 mr-2" />
          플랜 최적화 분석
        </Button>
      )}

      {/* 분석 모달 */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => setIsOpen(open)}
        title="플랜 최적화 분석"
        description={`${studentName} 학생의 학습 플랜 효율성을 AI로 분석합니다.`}
        size="3xl"
        showCloseButton
      >
        <DialogContent className="max-h-[70vh] overflow-y-auto">
          {/* 분석 설정 */}
          {!result && !isLoading && (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="분석 설정"
                  description="분석 기간을 선택하고 시작하세요."
                />
                <CardContent>
                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        분석 기간
                      </label>
                      <Select
                        value={analysisDays}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setAnalysisDays(e.target.value)
                        }
                      >
                        <option value="7">최근 7일</option>
                        <option value="14">최근 14일</option>
                        <option value="30">최근 30일</option>
                        <option value="60">최근 60일</option>
                        <option value="90">최근 90일</option>
                      </Select>
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleAnalyze}
                      isLoading={isLoading}
                    >
                      <SparklesIcon className="h-4 w-4 mr-2" />
                      분석 시작
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* 로딩 상태 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                AI가 학습 패턴을 분석하고 있습니다...
              </p>
            </div>
          )}

          {/* 분석 결과 */}
          {result && !isLoading && (
            <div className="space-y-6">
              {/* 효율성 점수 */}
              <div className="flex flex-col md:flex-row gap-6">
                <Card className="flex-shrink-0">
                  <CardContent className="flex flex-col items-center py-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      효율성 점수
                    </p>
                    <ScoreGauge
                      score={result.analysis.efficiencyScore}
                      grade={result.analysis.scoreGrade}
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center max-w-xs">
                      {result.analysis.scoreSummary}
                    </p>
                  </CardContent>
                </Card>

                {/* 카테고리별 점수 */}
                <Card className="flex-1">
                  <CardHeader title="영역별 점수" />
                  <CardContent className="space-y-3">
                    <CategoryScoreBar
                      label="시간 배치"
                      score={result.analysis.categoryScores.timeAllocation}
                    />
                    <CategoryScoreBar
                      label="과목 균형"
                      score={result.analysis.categoryScores.subjectBalance}
                    />
                    <CategoryScoreBar
                      label="일관성"
                      score={result.analysis.categoryScores.consistency}
                    />
                    <CategoryScoreBar
                      label="효율성"
                      score={result.analysis.categoryScores.efficiency}
                    />
                    <CategoryScoreBar
                      label="휴식 패턴"
                      score={result.analysis.categoryScores.restPattern}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* 강점 & 약점 */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* 강점 */}
                <Card>
                  <CardHeader
                    title="강점"
                    description="잘 하고 있는 영역"
                  />
                  <CardContent className="space-y-3">
                    {result.analysis.strengths.length > 0 ? (
                      result.analysis.strengths.map((s, idx) => (
                        <StrengthCard key={idx} strength={s} />
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        분석된 강점이 없습니다.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* 약점 */}
                <Card>
                  <CardHeader
                    title="개선 필요"
                    description="보완이 필요한 영역"
                  />
                  <CardContent className="space-y-3">
                    {result.analysis.weaknesses.length > 0 ? (
                      result.analysis.weaknesses.map((w, idx) => (
                        <WeaknessCard key={idx} weakness={w} />
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        특별한 약점이 발견되지 않았습니다.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 개선 제안 */}
              <Card>
                <CardHeader
                  title="최적화 제안"
                  description="우선순위별 개선 방안"
                />
                <CardContent className="space-y-3">
                  {result.analysis.suggestions.length > 0 ? (
                    result.analysis.suggestions.map((s) => (
                      <SuggestionCard key={s.id} suggestion={s} />
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      특별한 개선 제안이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* 다음 주 포커스 */}
              {result.analysis.nextWeekFocus.length > 0 && (
                <Card>
                  <CardHeader title="다음 주 추천 포커스" />
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.nextWeekFocus.map((focus, idx) => (
                        <Badge key={idx} variant="info" size="md">
                          {focus}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 분석 정보 */}
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <span>
                  분석 기간: {result.inputData.analysisPeriod} | 총 플랜:{" "}
                  {result.inputData.executionStats.totalPlans}개
                </span>
                <span>API 비용: ${result.cost.estimatedUSD.toFixed(4)}</span>
              </div>
            </div>
          )}
        </DialogContent>

        <DialogFooter>
          {result && (
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              다시 분석
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            닫기
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
