'use client';

import { useState, useCallback } from 'react';
import { useAIPlanModalActions, useAIPlanModalSelectors } from '../context/AIPlanModalContext';
import { runColdStartPipeline, type ColdStartRawInput, type RecommendationItem } from '@/lib/domains/plan/llm/actions/coldStart';
import type { RecommendedContent, AIResult } from '@/lib/domains/admin-plan/types/aiPlanSlot';

// ============================================================================
// 상수
// ============================================================================

/** Rate limit 방지를 위한 요청 간 대기 시간 (ms) */
const RATE_LIMIT_DELAY_MS = 5000;

// ============================================================================
// 타입
// ============================================================================

interface Progress {
  current: number;
  total: number;
  waitingForRateLimit: boolean;
}

interface UseAIRecommendationReturn {
  executeAllRecommendations: () => Promise<void>;
  executeSingleRecommendation: (slotId: string) => Promise<void>;
  isExecuting: boolean;
  progress: Progress;
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * RecommendationItem을 RecommendedContent로 변환
 */
function toRecommendedContent(item: RecommendationItem): RecommendedContent {
  return {
    tempId: crypto.randomUUID(),
    title: item.title,
    contentType: item.contentType,
    totalRange: item.totalRange,
    author: item.author,
    publisher: item.publisher,
    matchScore: item.matchScore,
    reason: item.reason,
    chapters: item.chapters,
  };
}

/**
 * 난이도 매핑 (한글 → API)
 */
function mapDifficulty(difficulty: string): '개념' | '기본' | '심화' {
  if (difficulty === '개념' || difficulty === 'beginner') return '개념';
  if (difficulty === '기본' || difficulty === 'intermediate') return '기본';
  if (difficulty === '심화' || difficulty === 'advanced') return '심화';
  return '개념';
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Hook
// ============================================================================

export function useAIRecommendation(): UseAIRecommendationReturn {
  const { slots } = useAIPlanModalSelectors();
  const { setAIResult, setSlotError, setSlotLoading } = useAIPlanModalActions();

  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    current: 0,
    total: 0,
    waitingForRateLimit: false,
  });

  /**
   * 단일 슬롯에 대한 AI 추천 실행
   */
  const executeSingleRecommendation = useCallback(async (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot || slot.type !== 'ai_recommendation' || !slot.aiConfig) {
      return;
    }

    // 교과가 선택되지 않았으면 스킵
    if (!slot.aiConfig.subjectCategory) {
      setSlotError(slotId, '교과를 선택해주세요.');
      return;
    }

    // 로딩 상태로 변경
    setSlotLoading(slotId);

    try {
      // Cold Start 파이프라인 실행
      const input: ColdStartRawInput = {
        subjectCategory: slot.aiConfig.subjectCategory,
        subject: slot.aiConfig.subject,
        difficulty: mapDifficulty(slot.aiConfig.difficulty),
        contentType: slot.aiConfig.contentType === 'all' ? undefined : slot.aiConfig.contentType,
      };

      const result = await runColdStartPipeline(input, {
        enableFallback: true,
        saveToDb: false, // 나중에 확정 시 저장
      });

      if (!result.success) {
        setSlotError(slotId, result.error || 'AI 추천 실패');
        return;
      }

      // 결과 변환 및 저장
      const aiResult: AIResult = {
        recommendations: result.recommendations.map(toRecommendedContent),
        stats: {
          totalFound: result.stats.totalFound,
          usedFallback: result.stats.usedFallback ?? false,
        },
      };

      setAIResult(slotId, aiResult);
    } catch (error) {
      console.error(`AI recommendation failed for slot ${slotId}:`, error);
      setSlotError(slotId, error instanceof Error ? error.message : 'AI 추천 중 오류 발생');
    }
  }, [slots, setAIResult, setSlotError, setSlotLoading]);

  /**
   * 모든 AI 슬롯에 대한 추천 순차 실행 (Rate limit 고려)
   */
  const executeAllRecommendations = useCallback(async () => {
    // AI 추천 슬롯 필터링 (configuring 상태만)
    const aiSlots = slots.filter(
      s => s.type === 'ai_recommendation' &&
           s.status === 'configuring' &&
           s.aiConfig?.subjectCategory
    );

    if (aiSlots.length === 0) {
      return;
    }

    setIsExecuting(true);
    setProgress({ current: 0, total: aiSlots.length, waitingForRateLimit: false });

    try {
      for (let i = 0; i < aiSlots.length; i++) {
        const slot = aiSlots[i];

        // 진행 상태 업데이트
        setProgress(prev => ({ ...prev, current: i, waitingForRateLimit: false }));

        // 슬롯 로딩 상태로 변경
        setSlotLoading(slot.id);

        // Cold Start 실행
        const input: ColdStartRawInput = {
          subjectCategory: slot.aiConfig!.subjectCategory,
          subject: slot.aiConfig!.subject,
          difficulty: mapDifficulty(slot.aiConfig!.difficulty),
          contentType: slot.aiConfig!.contentType === 'all' ? undefined : slot.aiConfig!.contentType,
        };

        const result = await runColdStartPipeline(input, {
          enableFallback: true,
          saveToDb: false,
        });

        if (result.success) {
          const aiResult: AIResult = {
            recommendations: result.recommendations.map(toRecommendedContent),
            stats: {
              totalFound: result.stats.totalFound,
              usedFallback: result.stats.usedFallback ?? false,
            },
          };
          setAIResult(slot.id, aiResult);
        } else {
          setSlotError(slot.id, result.error || 'AI 추천 실패');
        }

        // Rate limit 방지: 다음 요청 전 대기 (마지막 요청 제외)
        if (i < aiSlots.length - 1) {
          setProgress(prev => ({ ...prev, waitingForRateLimit: true }));
          await delay(RATE_LIMIT_DELAY_MS);
        }
      }

      // 완료
      setProgress(prev => ({ ...prev, current: aiSlots.length, waitingForRateLimit: false }));
    } catch (error) {
      console.error('AI recommendation batch failed:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [slots, setAIResult, setSlotError, setSlotLoading]);

  return {
    executeAllRecommendations,
    executeSingleRecommendation,
    isExecuting,
    progress,
  };
}
