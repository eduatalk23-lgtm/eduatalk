/**
 * useAIPlanGeneration - AI 플랜 생성 훅
 *
 * AI 플랜 생성 상태를 관리하고 생성된 플랜을 위저드 데이터에 통합합니다.
 */

import { useState, useCallback, useMemo } from "react";
import type { LLMPlanGenerationResponse, GeneratedPlanItem } from "@/lib/domains/plan/llm";

export interface UseAIPlanGenerationOptions {
  /** 위저드 데이터 업데이트 함수 */
  onUpdateWizardData?: (updates: Record<string, unknown>) => void;
  /** AI 생성 후 다음 단계로 이동할지 여부 */
  autoAdvanceStep?: boolean;
  /** 다음 단계로 이동하는 함수 */
  onNextStep?: () => void;
}

export interface UseAIPlanGenerationReturn {
  /** AI 모드 활성화 여부 */
  isAIModeActive: boolean;
  /** AI 패널 표시 여부 */
  showAIPanel: boolean;
  /** AI 생성 결과 */
  aiGenerationResult: LLMPlanGenerationResponse | null;
  /** AI 모드 활성화 */
  activateAIMode: () => void;
  /** AI 모드 비활성화 */
  deactivateAIMode: () => void;
  /** AI 패널 열기 */
  openAIPanel: () => void;
  /** AI 패널 닫기 */
  closeAIPanel: () => void;
  /** AI 생성 결과 적용 */
  applyAIResult: (response: LLMPlanGenerationResponse) => void;
  /** AI 생성 결과 초기화 */
  clearAIResult: () => void;
  /** AI 생성된 플랜 아이템들 */
  generatedPlans: GeneratedPlanItem[];
  /** AI 생성 통계 */
  generationStats: {
    totalPlans: number;
    totalWeeks: number;
    confidence: number;
    subjects: string[];
  } | null;
}

/**
 * AI 플랜 생성 상태 관리 훅
 */
export function useAIPlanGeneration(
  options: UseAIPlanGenerationOptions = {}
): UseAIPlanGenerationReturn {
  const { onUpdateWizardData, autoAdvanceStep, onNextStep } = options;

  // AI 모드 상태
  const [isAIModeActive, setIsAIModeActive] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiGenerationResult, setAIGenerationResult] = useState<LLMPlanGenerationResponse | null>(null);

  // AI 모드 활성화
  const activateAIMode = useCallback(() => {
    setIsAIModeActive(true);
    setShowAIPanel(true);
  }, []);

  // AI 모드 비활성화
  const deactivateAIMode = useCallback(() => {
    setIsAIModeActive(false);
    setShowAIPanel(false);
    setAIGenerationResult(null);
  }, []);

  // AI 패널 열기
  const openAIPanel = useCallback(() => {
    setShowAIPanel(true);
  }, []);

  // AI 패널 닫기
  const closeAIPanel = useCallback(() => {
    setShowAIPanel(false);
  }, []);

  // AI 생성 결과에서 플랜 아이템 추출
  const generatedPlans = useMemo(() => {
    if (!aiGenerationResult) return [];

    const plans: GeneratedPlanItem[] = [];
    for (const matrix of aiGenerationResult.weeklyMatrices) {
      for (const day of matrix.days) {
        plans.push(...day.plans);
      }
    }
    return plans;
  }, [aiGenerationResult]);

  // AI 생성 통계
  const generationStats = useMemo(() => {
    if (!aiGenerationResult) return null;

    const subjects = new Set<string>();
    for (const plan of generatedPlans) {
      if (plan.subject) {
        subjects.add(plan.subject);
      }
    }

    return {
      totalPlans: aiGenerationResult.totalPlans,
      totalWeeks: aiGenerationResult.weeklyMatrices.length,
      confidence: aiGenerationResult.meta.confidence,
      subjects: Array.from(subjects),
    };
  }, [aiGenerationResult, generatedPlans]);

  // AI 생성 결과 적용
  const applyAIResult = useCallback((response: LLMPlanGenerationResponse) => {
    setAIGenerationResult(response);
    setShowAIPanel(false);

    // 위저드 데이터에 AI 생성 정보 저장
    if (onUpdateWizardData) {
      // 생성된 콘텐츠 ID 추출
      const contentIds = new Set<string>();
      for (const matrix of response.weeklyMatrices) {
        for (const day of matrix.days) {
          for (const plan of day.plans) {
            contentIds.add(plan.contentId);
          }
        }
      }

      onUpdateWizardData({
        ai_generation: {
          enabled: true,
          response,
          generatedAt: new Date().toISOString(),
          modelId: response.meta.modelId,
          confidence: response.meta.confidence,
        },
      });
    }

    // 자동으로 다음 단계로 이동
    if (autoAdvanceStep && onNextStep) {
      onNextStep();
    }
  }, [onUpdateWizardData, autoAdvanceStep, onNextStep]);

  // AI 생성 결과 초기화
  const clearAIResult = useCallback(() => {
    setAIGenerationResult(null);
    if (onUpdateWizardData) {
      onUpdateWizardData({
        ai_generation: null,
      });
    }
  }, [onUpdateWizardData]);

  return {
    isAIModeActive,
    showAIPanel,
    aiGenerationResult,
    activateAIMode,
    deactivateAIMode,
    openAIPanel,
    closeAIPanel,
    applyAIResult,
    clearAIResult,
    generatedPlans,
    generationStats,
  };
}
