"use client";

/**
 * AI 콘텐츠 추천 패널 (관리자용)
 *
 * Claude API를 사용하여 학생에게 최적의 학습 콘텐츠를 추천합니다.
 * 학생의 성적, 학습 이력, 목표를 분석하여 개인화된 추천을 제공합니다.
 *
 * @module AdminContentRecommendationPanel
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";
import { Badge } from "@/components/atoms/Badge";
import Select from "@/components/atoms/Select";
import { TextArea } from "@/components/atoms/TextArea";
import ToggleSwitch from "@/components/atoms/ToggleSwitch";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Card, CardHeader, CardContent } from "@/components/molecules/Card";
import { Spinner } from "@/components/atoms/Spinner";

import {
  recommendContentWithAI,
  type RecommendContentResult,
} from "@/lib/domains/plan/llm/actions/recommendContent";
import type { ContentRecommendationResponse } from "@/lib/domains/plan/llm/prompts/contentRecommendation";

// ============================================
// 타입 정의
// ============================================

interface AdminContentRecommendationPanelProps {
  /** 학생 ID */
  studentId: string;
  /** 학생 이름 */
  studentName: string;
  /** 선택된 콘텐츠 추가 콜백 */
  onAddContents?: (contentIds: string[]) => void;
  /** 현재 선택된 콘텐츠 ID 목록 (중복 방지) */
  selectedContentIds?: string[];
  /** 추천 가능한 과목 카테고리 */
  availableSubjectCategories?: string[];
}

type FocusArea = "weak_subjects" | "all_subjects" | "exam_prep";

type RecommendationCategory =
  | "weak_subject"
  | "strength_enhance"
  | "review"
  | "new_skill"
  | "exam_prep";

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
      <path d="M18 14l.5 1.5L20 16l-1.5.5L18 18l-.5-1.5L16 16l1.5-.5L18 14z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
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
      <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
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
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
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
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
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

// ============================================
// 헬퍼 함수
// ============================================

const getCategoryLabel = (category: RecommendationCategory): string => {
  const labels: Record<RecommendationCategory, string> = {
    weak_subject: "취약 보강",
    strength_enhance: "강점 강화",
    review: "복습",
    new_skill: "새 영역",
    exam_prep: "시험 대비",
  };
  return labels[category] || category;
};

const getCategoryVariant = (
  category: RecommendationCategory
): "success" | "info" | "warning" | "error" | "default" => {
  const variants: Record<
    RecommendationCategory,
    "success" | "info" | "warning" | "error" | "default"
  > = {
    weak_subject: "error",
    strength_enhance: "success",
    review: "info",
    new_skill: "warning",
    exam_prep: "default",
  };
  return variants[category] || "default";
};

const getDifficultyFitLabel = (
  fit: number
): { label: string; color: string } => {
  if (fit >= 4)
    return { label: "매우 적합", color: "text-success-600 dark:text-success-400" };
  if (fit >= 3)
    return { label: "적합", color: "text-info-600 dark:text-info-400" };
  if (fit >= 2)
    return { label: "보통", color: "text-warning-600 dark:text-warning-400" };
  return { label: "부적합", color: "text-error-600 dark:text-error-400" };
};

// ============================================
// 추천 결과 카드 컴포넌트
// ============================================

interface RecommendationCardProps {
  recommendation: ContentRecommendationResponse["recommendations"][0];
  isSelected: boolean;
  isAlreadyAdded: boolean;
  onToggle: () => void;
}

function RecommendationCard({
  recommendation,
  isSelected,
  isAlreadyAdded,
  onToggle,
}: RecommendationCardProps) {
  const difficultyFit = getDifficultyFitLabel(recommendation.difficultyFit);

  return (
    <div
      className={cn(
        "relative rounded-lg border p-4 transition-all",
        isAlreadyAdded
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:shadow-[var(--elevation-2)]",
        isSelected
          ? "border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20"
          : "border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]"
      )}
      onClick={() => !isAlreadyAdded && onToggle()}
    >
      {/* 선택 체크박스 */}
      <div
        className={cn(
          "absolute top-3 right-3 h-5 w-5 rounded border flex items-center justify-center",
          isAlreadyAdded
            ? "bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-600))]"
            : isSelected
              ? "bg-primary-600 border-primary-600 dark:bg-primary-500 dark:border-primary-500"
              : "border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-600))]"
        )}
      >
        {(isSelected || isAlreadyAdded) && (
          <CheckIcon className="h-3 w-3 text-white" />
        )}
      </div>

      <div className="flex items-start gap-3">
        {/* 우선순위 번호 */}
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-body-2">
          {recommendation.priority}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          {/* 헤더 */}
          <div className="flex items-center gap-2 flex-wrap">
            {recommendation.contentType === "book" ? (
              <BookIcon className="h-4 w-4 text-[var(--text-secondary)]" />
            ) : (
              <VideoIcon className="h-4 w-4 text-[var(--text-secondary)]" />
            )}
            <span className="font-medium text-body-1 text-[var(--text-primary)] truncate">
              {recommendation.title}
            </span>
          </div>

          {/* 카테고리 및 과목 */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge
              variant={getCategoryVariant(
                recommendation.category as RecommendationCategory
              )}
              size="xs"
            >
              {getCategoryLabel(
                recommendation.category as RecommendationCategory
              )}
            </Badge>
            <Badge variant="default" size="xs">
              {recommendation.subjectCategory}
            </Badge>
            <Badge variant="default" size="xs">
              {recommendation.subject}
            </Badge>
            {isAlreadyAdded && (
              <Badge variant="gray" size="xs">
                추가됨
              </Badge>
            )}
          </div>

          {/* 추천 이유 */}
          <p className="text-body-2 text-[var(--text-secondary)] mt-2 line-clamp-2">
            {recommendation.reason}
          </p>

          {/* 예상 효과 */}
          <div className="flex items-center gap-1 mt-2 text-body-2 text-success-600 dark:text-success-400">
            <TrendingUpIcon className="h-3 w-3" />
            <span>{recommendation.expectedBenefit}</span>
          </div>

          {/* 관련 성적 및 난이도 */}
          <div className="flex items-center justify-between mt-2 text-body-2 text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              {recommendation.relatedScore?.currentGrade && (
                <span>현재 {recommendation.relatedScore.currentGrade}등급</span>
              )}
              {recommendation.relatedScore?.targetGrade && (
                <>
                  <span>→</span>
                  <span className="text-primary-600 dark:text-primary-400 font-medium">
                    목표 {recommendation.relatedScore.targetGrade}등급
                  </span>
                </>
              )}
            </div>
            <span className={cn("font-medium", difficultyFit.color)}>
              {difficultyFit.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 인사이트 패널 컴포넌트
// ============================================

interface InsightsPanelProps {
  insights: ContentRecommendationResponse["insights"];
}

function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <Card elevation={0}>
      <CardHeader
        title="학습 분석 인사이트"
        description="AI가 분석한 학생의 학습 현황입니다."
      />
      <CardContent>
        <div className="space-y-4">
          {/* 강점 영역 */}
          {insights.strengthAreas.length > 0 && (
            <div>
              <h4 className="text-body-2 font-medium text-success-600 dark:text-success-400 mb-2 flex items-center gap-1">
                <TrendingUpIcon className="h-3 w-3" />
                강점 영역
              </h4>
              <div className="flex flex-wrap gap-2">
                {insights.strengthAreas.map((area, idx) => (
                  <Badge key={idx} variant="success" size="sm">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 개선 필요 영역 */}
          {insights.improvementAreas.length > 0 && (
            <div>
              <h4 className="text-body-2 font-medium text-error-600 dark:text-error-400 mb-2 flex items-center gap-1">
                <TrendingDownIcon className="h-3 w-3" />
                개선 필요 영역
              </h4>
              <div className="flex flex-wrap gap-2">
                {insights.improvementAreas.map((area, idx) => (
                  <Badge key={idx} variant="warning" size="sm">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 학습 전략 */}
          <div>
            <h4 className="text-body-2 font-medium text-[var(--text-secondary)] mb-2">
              추천 학습 전략
            </h4>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-info-50 dark:bg-info-900/20 text-info-800 dark:text-info-200">
              <LightbulbIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-body-2">{insights.studyStrategy}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function AdminContentRecommendationPanel({
  studentId,
  studentName,
  onAddContents,
  selectedContentIds = [],
  availableSubjectCategories,
}: AdminContentRecommendationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecommendContentResult["data"] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // 추천 설정
  const [focusArea, setFocusArea] = useState<FocusArea>("weak_subjects");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [maxRecommendations, setMaxRecommendations] = useState(5);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 선택된 추천 콘텐츠
  const [selectedRecommendations, setSelectedRecommendations] = useState<
    Set<string>
  >(new Set());

  // 추천 요청
  const handleRequestRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setSelectedRecommendations(new Set());

    try {
      const response = await recommendContentWithAI({
        studentId,
        focusArea,
        maxRecommendations,
        subjectCategories: availableSubjectCategories,
        additionalInstructions: additionalInstructions || undefined,
      });

      if (response.success && response.data) {
        setResult(response.data);
        // 성공 시 추가되지 않은 콘텐츠 전체 선택
        const newIds = response.data.recommendations
          .filter((r) => !selectedContentIds.includes(r.contentId))
          .map((r) => r.contentId);
        setSelectedRecommendations(new Set(newIds));
      } else {
        setError(response.error || "추천 생성에 실패했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    studentId,
    focusArea,
    maxRecommendations,
    availableSubjectCategories,
    additionalInstructions,
    selectedContentIds,
  ]);

  // 추천 선택 토글
  const handleToggleRecommendation = useCallback((contentId: string) => {
    setSelectedRecommendations((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  }, []);

  // 선택된 콘텐츠 추가
  const handleAddSelected = useCallback(() => {
    if (onAddContents && selectedRecommendations.size > 0) {
      onAddContents(Array.from(selectedRecommendations));
      setIsOpen(false);
      // 상태 초기화
      setResult(null);
      setSelectedRecommendations(new Set());
    }
  }, [onAddContents, selectedRecommendations]);

  // 전체 선택/해제
  const handleSelectAll = useCallback(() => {
    if (!result) return;

    const allIds = result.recommendations
      .filter((r) => !selectedContentIds.includes(r.contentId))
      .map((r) => r.contentId);

    if (selectedRecommendations.size === allIds.length) {
      setSelectedRecommendations(new Set());
    } else {
      setSelectedRecommendations(new Set(allIds));
    }
  }, [result, selectedContentIds, selectedRecommendations.size]);

  // 다시 추천받기
  const handleReset = useCallback(() => {
    setResult(null);
    setSelectedRecommendations(new Set());
    setError(null);
  }, []);

  const selectedCount = selectedRecommendations.size;
  const selectableCount =
    result?.recommendations.filter(
      (r) => !selectedContentIds.includes(r.contentId)
    ).length || 0;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <SparklesIcon className="h-4 w-4" />
        AI 콘텐츠 추천
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            handleReset();
          }
        }}
        title={`${studentName} 학생을 위한 AI 콘텐츠 추천`}
        description="학생의 성적과 학습 패턴을 분석하여 최적의 콘텐츠를 추천합니다."
        size="4xl"
        showCloseButton
      >
        <DialogContent className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* 추천 설정 (결과가 없고 로딩 중이 아닐 때) */}
          {!result && !isLoading && !error && (
            <div className="space-y-6">
              {/* 추천 포커스 */}
              <div className="space-y-2">
                <label className="text-body-2 font-medium text-[var(--text-primary)]">
                  추천 포커스
                </label>
                <Select
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value as FocusArea)}
                  selectSize="md"
                >
                  <option value="weak_subjects">취약 과목 보강</option>
                  <option value="all_subjects">전체 과목 균형</option>
                  <option value="exam_prep">시험 대비</option>
                </Select>
              </div>

              {/* 추천 개수 */}
              <div className="space-y-2">
                <label className="text-body-2 font-medium text-[var(--text-primary)]">
                  추천 개수
                </label>
                <Select
                  value={String(maxRecommendations)}
                  onChange={(e) =>
                    setMaxRecommendations(Number(e.target.value))
                  }
                  selectSize="md"
                >
                  <option value="3">3개</option>
                  <option value="5">5개</option>
                  <option value="8">8개</option>
                  <option value="10">10개</option>
                </Select>
              </div>

              {/* 고급 설정 토글 */}
              <div className="flex items-center gap-3">
                <ToggleSwitch
                  checked={showAdvanced}
                  onCheckedChange={setShowAdvanced}
                />
                <span className="text-body-2 text-[var(--text-secondary)]">
                  고급 설정 표시
                </span>
              </div>

              {/* 고급 설정 */}
              {showAdvanced && (
                <div className="space-y-2">
                  <label className="text-body-2 font-medium text-[var(--text-primary)]">
                    추가 지시사항
                  </label>
                  <TextArea
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="예: 수학 개념서 위주로 추천해주세요. / 강의보다 교재를 선호합니다."
                    fullWidth
                    size="md"
                    resize="vertical"
                    minRows={3}
                  />
                </div>
              )}
            </div>
          )}

          {/* 로딩 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner size="lg" />
              <p className="mt-4 text-[var(--text-secondary)]">
                AI가 최적의 콘텐츠를 분석하고 있습니다...
              </p>
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center mb-4">
                <AlertIcon className="h-6 w-6 text-error-600 dark:text-error-400" />
              </div>
              <h3 className="text-h3 text-[var(--text-primary)] mb-2">
                추천 생성 실패
              </h3>
              <p className="text-body-2 text-[var(--text-secondary)] mb-4">
                {error}
              </p>
              <Button variant="outline" onClick={handleReset}>
                다시 시도
              </Button>
            </div>
          )}

          {/* 추천 결과 */}
          {result && (
            <div className="space-y-6">
              {/* 요약 정보 */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
                <div>
                  <p className="text-body-1 font-medium text-[var(--text-primary)]">
                    {result.summary.totalRecommended}개 콘텐츠 추천
                  </p>
                  <p className="text-body-2 text-[var(--text-secondary)]">
                    {result.summary.mainFocus}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(result.summary.byCategory).map(
                      ([cat, count]) => (
                        <Badge key={cat} variant="gray" size="xs">
                          {getCategoryLabel(cat as RecommendationCategory)}:{" "}
                          {count}개
                        </Badge>
                      )
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-body-2 text-[var(--text-secondary)]">
                    예상 비용
                  </p>
                  <p className="text-body-1 font-mono">
                    ${result.cost.estimatedUSD.toFixed(4)}
                  </p>
                  <p className="text-body-2 text-[var(--text-secondary)]">
                    {result.cost.inputTokens + result.cost.outputTokens} 토큰
                  </p>
                </div>
              </div>

              {/* 전체 선택 */}
              <div className="flex items-center justify-between">
                <p className="text-body-2 text-[var(--text-secondary)]">
                  {selectedCount}개 선택됨 / {selectableCount}개 선택 가능
                </p>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedCount === selectableCount ? "전체 해제" : "전체 선택"}
                </Button>
              </div>

              {/* 추천 목록 */}
              <div className="grid gap-3 md:grid-cols-2">
                {result.recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.contentId}
                    recommendation={rec}
                    isSelected={selectedRecommendations.has(rec.contentId)}
                    isAlreadyAdded={selectedContentIds.includes(rec.contentId)}
                    onToggle={() => handleToggleRecommendation(rec.contentId)}
                  />
                ))}
              </div>

              {/* 인사이트 */}
              <InsightsPanel insights={result.insights} />
            </div>
          )}
        </DialogContent>

        <DialogFooter>
          {!result && !isLoading && !error ? (
            <>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                취소
              </Button>
              <Button onClick={handleRequestRecommendations} className="gap-2">
                <SparklesIcon className="h-4 w-4" />
                AI 추천 받기
              </Button>
            </>
          ) : isLoading ? (
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              취소
            </Button>
          ) : result ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                다시 추천받기
              </Button>
              <Button onClick={handleAddSelected} disabled={selectedCount === 0}>
                {selectedCount > 0
                  ? `${selectedCount}개 콘텐츠 추가`
                  : "콘텐츠 추가"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              닫기
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </>
  );
}

export default AdminContentRecommendationPanel;
