/**
 * useStreamingGeneration - AI 플랜 스트리밍 생성 훅
 *
 * 실시간 생성 진행 상황을 표시합니다.
 */

import { useState, useCallback, useRef } from "react";
import { generatePlanStream, type StreamEvent, type StreamPlanInput } from "@/lib/domains/plan/llm/actions/streamPlan";
import type { LLMPlanGenerationResponse } from "@/lib/domains/plan/llm";

export type GenerationPhase =
  | "idle"
  | "starting"
  | "fetching"
  | "generating"
  | "parsing"
  | "complete"
  | "error";

export interface GenerationProgress {
  phase: GenerationPhase;
  progress: number;
  message: string;
  streamedText: string;
}

export interface UseStreamingGenerationOptions {
  onComplete?: (response: LLMPlanGenerationResponse) => void;
  onError?: (error: string) => void;
}

export interface UseStreamingGenerationReturn {
  /** 생성 시작 */
  startGeneration: (input: StreamPlanInput) => Promise<void>;
  /** 생성 취소 */
  cancelGeneration: () => void;
  /** 현재 진행 상황 */
  progress: GenerationProgress;
  /** 생성 중 여부 */
  isGenerating: boolean;
  /** 생성 결과 */
  result: LLMPlanGenerationResponse | null;
  /** 오류 메시지 */
  error: string | null;
  /** 비용 정보 */
  cost: { inputTokens: number; outputTokens: number; estimatedUSD: number } | null;
  /** 상태 리셋 */
  reset: () => void;
}

/**
 * AI 플랜 스트리밍 생성 훅
 */
export function useStreamingGeneration(
  options: UseStreamingGenerationOptions = {}
): UseStreamingGenerationReturn {
  const { onComplete, onError } = options;

  const [progress, setProgress] = useState<GenerationProgress>({
    phase: "idle",
    progress: 0,
    message: "",
    streamedText: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<LLMPlanGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<{
    inputTokens: number;
    outputTokens: number;
    estimatedUSD: number;
  } | null>(null);

  const abortRef = useRef(false);

  // 이벤트 처리
  const processEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case "start":
        setProgress({
          phase: "starting",
          progress: event.data.progress || 0,
          message: event.data.message || "시작 중...",
          streamedText: "",
        });
        break;

      case "progress":
        setProgress((prev) => ({
          ...prev,
          phase: event.data.progress && event.data.progress > 50 ? "generating" : "fetching",
          progress: event.data.progress || prev.progress,
          message: event.data.message || prev.message,
        }));
        break;

      case "text":
        setProgress((prev) => ({
          ...prev,
          streamedText: prev.streamedText + (event.data.text || ""),
        }));
        break;

      case "parsing":
        setProgress((prev) => ({
          ...prev,
          phase: "parsing",
          message: event.data.message || "파싱 중...",
        }));
        break;

      case "complete":
        setProgress({
          phase: "complete",
          progress: 100,
          message: "완료!",
          streamedText: "",
        });
        if (event.data.response) {
          setResult(event.data.response);
          onComplete?.(event.data.response);
        }
        if (event.data.cost) {
          setCost(event.data.cost);
        }
        break;

      case "error":
        setProgress({
          phase: "error",
          progress: 0,
          message: event.data.error || "오류 발생",
          streamedText: "",
        });
        setError(event.data.error || "알 수 없는 오류");
        onError?.(event.data.error || "알 수 없는 오류");
        break;
    }
  }, [onComplete, onError]);

  // 생성 시작
  const startGeneration = useCallback(async (input: StreamPlanInput) => {
    abortRef.current = false;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setCost(null);
    setProgress({
      phase: "starting",
      progress: 0,
      message: "AI 플랜 생성을 준비하고 있습니다...",
      streamedText: "",
    });

    try {
      const { events } = await generatePlanStream(input);

      for (const event of events) {
        if (abortRef.current) {
          break;
        }
        processEvent(event);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "생성 중 오류가 발생했습니다.";
      setError(errorMessage);
      setProgress({
        phase: "error",
        progress: 0,
        message: errorMessage,
        streamedText: "",
      });
      onError?.(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [processEvent, onError]);

  // 생성 취소
  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setProgress({
      phase: "idle",
      progress: 0,
      message: "취소됨",
      streamedText: "",
    });
  }, []);

  // 상태 리셋
  const reset = useCallback(() => {
    abortRef.current = false;
    setIsGenerating(false);
    setResult(null);
    setError(null);
    setCost(null);
    setProgress({
      phase: "idle",
      progress: 0,
      message: "",
      streamedText: "",
    });
  }, []);

  return {
    startGeneration,
    cancelGeneration,
    progress,
    isGenerating,
    result,
    error,
    cost,
    reset,
  };
}
