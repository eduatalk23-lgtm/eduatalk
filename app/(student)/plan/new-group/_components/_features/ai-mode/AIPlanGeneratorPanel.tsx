"use client";

/**
 * AIPlanGeneratorPanel - AI 플랜 생성 패널
 *
 * AI를 사용하여 학습 플랜을 자동 생성하는 패널입니다.
 * - 생성 설정 구성
 * - 미리보기 및 편집
 * - 최종 적용
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import { previewPlanWithAI, type PreviewPlanResult } from "@/lib/domains/plan/llm/actions/generatePlan";
import type { LLMPlanGenerationResponse, ModelTier } from "@/lib/domains/plan/llm/types";
import { StreamingProgress } from "./StreamingProgress";
import { useStreamingGeneration } from "./hooks/useStreamingGeneration";
import { WebSearchResultsPanel } from "@/components/plan";

// ============================================
// 타입 정의
// ============================================

export interface AIPlanGeneratorPanelProps {
  /** 선택된 콘텐츠 ID 목록 */
  contentIds: string[];
  /** 시작 날짜 */
  startDate: string;
  /** 종료 날짜 */
  endDate: string;
  /** 일일 학습 시간 (분) */
  dailyStudyMinutes?: number;
  /** 제외 요일 */
  excludeDays?: number[];
  /** 생성 완료 시 콜백 */
  onGenerated?: (response: LLMPlanGenerationResponse) => void;
  /** 취소 시 콜백 */
  onCancel?: () => void;
  /** 추가 클래스 */
  className?: string;
}

type GenerationPhase = "config" | "generating" | "preview" | "error";

// ============================================
// 설정 컴포넌트
// ============================================

interface ConfigSectionProps {
  dailyMinutes: number;
  setDailyMinutes: (v: number) => void;
  excludeDays: number[];
  toggleExcludeDay: (day: number) => void;
  prioritizeWeak: boolean;
  setPrioritizeWeak: (v: boolean) => void;
  includeReview: boolean;
  setIncludeReview: (v: boolean) => void;
  reviewRatio: number;
  setReviewRatio: (v: number) => void;
  modelTier: ModelTier;
  setModelTier: (v: ModelTier) => void;
  additionalInstructions: string;
  setAdditionalInstructions: (v: string) => void;
  enableWebSearch: boolean;
  setEnableWebSearch: (v: boolean) => void;
}

function ConfigSection({
  dailyMinutes,
  setDailyMinutes,
  excludeDays,
  toggleExcludeDay,
  prioritizeWeak,
  setPrioritizeWeak,
  includeReview,
  setIncludeReview,
  reviewRatio,
  setReviewRatio,
  modelTier,
  setModelTier,
  additionalInstructions,
  setAdditionalInstructions,
  enableWebSearch,
  setEnableWebSearch,
}: ConfigSectionProps) {
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="space-y-6">
      {/* 일일 학습 시간 */}
      <div>
        <label className={cn("block text-sm font-medium mb-2", textPrimary)}>
          일일 학습 시간
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={60}
            max={480}
            step={30}
            value={dailyMinutes}
            onChange={(e) => setDailyMinutes(Number(e.target.value))}
            className="flex-1"
          />
          <span className={cn("text-sm font-medium w-20 text-right", textSecondary)}>
            {Math.floor(dailyMinutes / 60)}시간 {dailyMinutes % 60 > 0 ? `${dailyMinutes % 60}분` : ""}
          </span>
        </div>
      </div>

      {/* 제외 요일 */}
      <div>
        <label className={cn("block text-sm font-medium mb-2", textPrimary)}>
          학습 제외 요일
        </label>
        <div className="flex gap-2">
          {dayNames.map((name, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleExcludeDay(idx)}
              className={cn(
                "w-10 h-10 rounded-lg text-sm font-medium transition-colors",
                excludeDays.includes(idx)
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <p className={cn("text-xs mt-1", textMuted)}>
          선택한 요일에는 학습 플랜이 생성되지 않습니다
        </p>
      </div>

      {/* 학습 옵션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
          <input
            type="checkbox"
            checked={prioritizeWeak}
            onChange={(e) => setPrioritizeWeak(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <div>
            <span className={cn("text-sm font-medium", textPrimary)}>취약 과목 우선</span>
            <p className={cn("text-xs", textMuted)}>성적이 낮은 과목에 더 많은 시간 배분</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
          <input
            type="checkbox"
            checked={includeReview}
            onChange={(e) => setIncludeReview(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <div>
            <span className={cn("text-sm font-medium", textPrimary)}>복습 포함</span>
            <p className={cn("text-xs", textMuted)}>학습 후 자동 복습 일정 추가</p>
          </div>
        </label>
      </div>

      {/* 복습 비율 */}
      {includeReview && (
        <div>
          <label className={cn("block text-sm font-medium mb-2", textPrimary)}>
            복습 비율
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={50}
              step={5}
              value={reviewRatio * 100}
              onChange={(e) => setReviewRatio(Number(e.target.value) / 100)}
              className="flex-1"
            />
            <span className={cn("text-sm font-medium w-12 text-right", textSecondary)}>
              {Math.round(reviewRatio * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* 모델 선택 */}
      <div>
        <label className={cn("block text-sm font-medium mb-2", textPrimary)}>
          AI 모델
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { tier: "fast" as ModelTier, label: "빠른 생성", desc: "기본 플랜" },
            { tier: "standard" as ModelTier, label: "표준", desc: "균형 잡힌 플랜" },
            { tier: "advanced" as ModelTier, label: "정밀", desc: "상세한 분석" },
          ].map(({ tier, label, desc }) => (
            <button
              key={tier}
              type="button"
              onClick={() => setModelTier(tier)}
              className={cn(
                "p-3 rounded-lg border text-left transition-colors",
                modelTier === tier
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <div className={cn("text-sm font-medium", textPrimary)}>{label}</div>
              <div className={cn("text-xs", textMuted)}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 웹 검색 (Gemini Grounding) */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enableWebSearch}
            onChange={(e) => setEnableWebSearch(e.target.checked)}
            className="w-4 h-4 mt-1 text-blue-600 rounded"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", textPrimary)}>
                🌐 웹 검색으로 최신 학습 자료 찾기
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Beta
              </span>
            </div>
            <p className={cn("text-xs mt-1", textMuted)}>
              AI가 인터넷에서 관련 학습 자료를 검색하여 플랜에 반영합니다
            </p>
          </div>
        </label>
      </div>

      {/* 추가 지시사항 */}
      <div>
        <label className={cn("block text-sm font-medium mb-2", textPrimary)}>
          추가 지시사항 (선택)
        </label>
        <textarea
          value={additionalInstructions}
          onChange={(e) => setAdditionalInstructions(e.target.value)}
          placeholder="예: 오전에는 수학 위주로 배치해주세요. 점심 후에는 가벼운 과목으로..."
          rows={3}
          className={cn(
            "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700",
            "bg-white dark:bg-gray-800 text-sm",
            textPrimary,
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
            "focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          )}
        />
      </div>
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function AIPlanGeneratorPanel({
  contentIds,
  startDate,
  endDate,
  dailyStudyMinutes: initialDailyMinutes = 180,
  excludeDays: initialExcludeDays = [],
  onGenerated,
  onCancel,
  className,
}: AIPlanGeneratorPanelProps) {
  // 설정 상태
  const [dailyMinutes, setDailyMinutes] = useState(initialDailyMinutes);
  const [excludeDays, setExcludeDays] = useState<number[]>(initialExcludeDays);
  const [prioritizeWeak, setPrioritizeWeak] = useState(true);
  const [includeReview, setIncludeReview] = useState(true);
  const [reviewRatio, setReviewRatio] = useState(0.2);
  const [modelTier, setModelTier] = useState<ModelTier>("standard");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [enableWebSearch, setEnableWebSearch] = useState(false);

  // 생성 상태
  const [phase, setPhase] = useState<GenerationPhase>("config");
  const [result, setResult] = useState<PreviewPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useStreaming, setUseStreaming] = useState(true); // 스트리밍 모드 토글

  // 스트리밍 생성 훅
  const {
    startGeneration: startStreamingGeneration,
    cancelGeneration,
    progress: streamingProgress,
    isGenerating: isStreamingGenerating,
    result: streamingResult,
    error: streamingError,
    cost: streamingCost,
    webSearchResults: streamingWebSearchResults,
    reset: resetStreaming,
  } = useStreamingGeneration({
    onComplete: (response) => {
      setResult({
        success: true,
        data: response,
        metadata: {
            ...response.meta,
            estimatedCost: streamingCost?.estimatedUSD || 0
        }
      });
      setPhase("preview");
    },
    onError: (err) => {
      setError(err);
      setPhase("error");
    },
  });

  // 제외 요일 토글
  const toggleExcludeDay = useCallback((day: number) => {
    setExcludeDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  // 플랜 생성
  const handleGenerate = async () => {
    if (contentIds.length === 0) {
      setError("선택된 콘텐츠가 없습니다.");
      setPhase("error");
      return;
    }

    setPhase("generating");
    setError(null);

    // 스트리밍 모드 사용
    if (useStreaming) {
      await startStreamingGeneration({
        contentIds,
        startDate,
        endDate,
        dailyStudyMinutes: dailyMinutes,
        excludeDays,
        prioritizeWeakSubjects: prioritizeWeak,
        balanceSubjects: true,
        includeReview,
        reviewRatio: includeReview ? reviewRatio : undefined,
        additionalInstructions: additionalInstructions || undefined,
        modelTier,
        enableWebSearch,
        webSearchConfig: enableWebSearch
          ? { mode: "dynamic", saveResults: true }
          : undefined,
      });
      return;
    }

    // 기존 비스트리밍 모드
    try {
      const response = await previewPlanWithAI({
        contentIds,
        startDate,
        endDate,
        dailyStudyMinutes: dailyMinutes,
        excludeDays,
        prioritizeWeakSubjects: prioritizeWeak,
        balanceSubjects: true,
        includeReview,
        reviewRatio: includeReview ? reviewRatio : undefined,
        additionalInstructions: additionalInstructions || undefined,
        modelTier,
        enableWebSearch,
        webSearchConfig: enableWebSearch
          ? { mode: "dynamic", saveResults: true }
          : undefined,
      });

      setResult(response);

      if (response.success && response.data) {
        setPhase("preview");
      } else {
        setError(response.error || "플랜 생성에 실패했습니다.");
        setPhase("error");
      }
    } catch (err) {
      console.error("AI Plan generation error:", err);
      setError(err instanceof Error ? err.message : "예기치 않은 오류가 발생했습니다.");
      setPhase("error");
    }
  };

  // 적용
  const handleApply = () => {
    if (result?.success && result.data) {
      onGenerated?.(result.data);
    }
  };

  // 재생성
  const handleRetry = () => {
    setPhase("config");
    setError(null);
  };

  return (
    <div className={cn("rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden", className)}>
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-lg">
            ✨
          </div>
          <div>
            <h3 className={cn("text-lg font-semibold", textPrimary)}>AI 플랜 생성</h3>
            <p className={cn("text-sm", textMuted)}>
              AI가 학습 패턴과 성적을 분석하여 최적의 플랜을 생성합니다
            </p>
          </div>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="p-6">
        {/* 설정 단계 */}
        {phase === "config" && (
          <>
            <ConfigSection
              dailyMinutes={dailyMinutes}
              setDailyMinutes={setDailyMinutes}
              excludeDays={excludeDays}
              toggleExcludeDay={toggleExcludeDay}
              prioritizeWeak={prioritizeWeak}
              setPrioritizeWeak={setPrioritizeWeak}
              includeReview={includeReview}
              setIncludeReview={setIncludeReview}
              reviewRatio={reviewRatio}
              setReviewRatio={setReviewRatio}
              modelTier={modelTier}
              setModelTier={setModelTier}
              additionalInstructions={additionalInstructions}
              setAdditionalInstructions={setAdditionalInstructions}
              enableWebSearch={enableWebSearch}
              setEnableWebSearch={setEnableWebSearch}
            />

            {/* 요약 정보 */}
            <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className={cn("text-sm", textSecondary)}>
                <strong>{contentIds.length}개</strong> 콘텐츠 ·{" "}
                <strong>{startDate}</strong> ~ <strong>{endDate}</strong> ·{" "}
                하루 <strong>{Math.floor(dailyMinutes / 60)}시간</strong>
                {excludeDays.length > 0 && (
                  <> · {excludeDays.length}일 제외</>
                )}
              </div>
            </div>
          </>
        )}

        {/* 생성 중 */}
        {phase === "generating" && (
          <div className="py-8">
            {useStreaming ? (
              <StreamingProgress
                phase={streamingProgress.phase}
                progress={streamingProgress.progress}
                message={streamingProgress.message}
                streamedText={streamingProgress.streamedText}
              />
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h4 className={cn("text-lg font-medium mb-2", textPrimary)}>
                  AI가 플랜을 생성하고 있습니다
                </h4>
                <p className={cn("text-sm", textMuted)}>
                  학습 패턴과 성적을 분석하여 최적의 플랜을 만들고 있어요...
                </p>
              </div>
            )}

            {/* 취소 버튼 */}
            {isStreamingGenerating && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    cancelGeneration();
                    setPhase("config");
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "border border-gray-300 dark:border-gray-600",
                    textSecondary,
                    "hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                >
                  생성 취소
                </button>
              </div>
            )}
          </div>
        )}

        {/* 미리보기 */}
        {phase === "preview" && result?.data && (
          <div className="space-y-4">
            {/* 생성 결과 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className={cn("text-2xl font-bold text-blue-600 dark:text-blue-400")}>
                  {result.data.totalPlans}
                </div>
                <div className={cn("text-sm", textMuted)}>총 플랜 수</div>
              </div>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className={cn("text-2xl font-bold text-green-600 dark:text-green-400")}>
                  {result.data.weeklyMatrices.length}
                </div>
                <div className={cn("text-sm", textMuted)}>주</div>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <div className={cn("text-2xl font-bold text-purple-600 dark:text-purple-400")}>
                  {Math.round(result.data.meta.confidence * 100)}%
                </div>
                <div className={cn("text-sm", textMuted)}>신뢰도</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className={cn("text-2xl font-bold", textPrimary)}>
                  ${(result.metadata?.estimatedCost || 0).toFixed(4)}
                </div>
                <div className={cn("text-sm", textMuted)}>비용</div>
              </div>
            </div>

            {/* 추천 사항 */}
            {result.data.recommendations.studyTips.length > 0 && (
              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <h5 className={cn("font-medium mb-2 text-blue-700 dark:text-blue-300")}>
                  💡 학습 팁
                </h5>
                <ul className="space-y-1">
                  {result.data.recommendations.studyTips.map((tip: string, idx: number) => (
                    <li key={idx} className={cn("text-sm", textSecondary)}>
                      • {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 경고 */}
            {result.data.recommendations.warnings.length > 0 && (
              <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <h5 className={cn("font-medium mb-2 text-amber-700 dark:text-amber-300")}>
                  ⚠️ 주의사항
                </h5>
                <ul className="space-y-1">
                  {result.data.recommendations.warnings.map((warn: string, idx: number) => (
                    <li key={idx} className={cn("text-sm", textSecondary)}>
                      • {warn}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 웹 검색 결과 */}
            {streamingWebSearchResults && streamingWebSearchResults.results.length > 0 && (
              <WebSearchResultsPanel
                results={streamingWebSearchResults.results}
                searchQueries={streamingWebSearchResults.searchQueries}
              />
            )}

            {/* 주간 요약 */}
            <div className="space-y-2">
              <h5 className={cn("font-medium", textPrimary)}>주간 계획 요약</h5>
              {result.data.weeklyMatrices.map((week) => (
                <div
                  key={week.weekNumber}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={cn("font-medium", textPrimary)}>
                        {week.weekNumber}주차
                      </span>
                      <span className={cn("text-sm ml-2", textMuted)}>
                        {week.weekStart} ~ {week.weekEnd}
                      </span>
                    </div>
                    <span className={cn("text-sm", textSecondary)}>
                      {week.days.reduce((sum: number, d: { plans: unknown[] }) => sum + d.plans.length, 0)}개 플랜
                    </span>
                  </div>
                  {week.weeklySummary && (
                    <p className={cn("text-sm mt-1", textMuted)}>{week.weeklySummary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 오류 */}
        {phase === "error" && (
          <div className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4 text-3xl">
              😢
            </div>
            <h4 className={cn("text-lg font-medium mb-2", textPrimary)}>
              플랜 생성에 실패했습니다
            </h4>
            <p className={cn("text-sm mb-4", textMuted)}>{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between">
        <button
          onClick={onCancel}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            "border border-gray-300 dark:border-gray-600",
            textSecondary,
            "hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          취소
        </button>

        <div className="flex gap-2">
          {phase === "config" && (
            <button
              onClick={handleGenerate}
              disabled={contentIds.length === 0}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
                "bg-gradient-to-r from-blue-500 to-purple-500 text-white",
                "hover:from-blue-600 hover:to-purple-600",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              ✨ AI로 생성하기
            </button>
          )}

          {phase === "preview" && (
            <>
              <button
                onClick={handleRetry}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "border border-gray-300 dark:border-gray-600",
                  textSecondary,
                  "hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                다시 생성
              </button>
              <button
                onClick={handleApply}
                className={cn(
                  "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-green-500 text-white hover:bg-green-600"
                )}
              >
                이 플랜 적용하기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
