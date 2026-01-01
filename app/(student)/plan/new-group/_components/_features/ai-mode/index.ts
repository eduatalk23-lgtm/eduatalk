/**
 * AI 모드 기능 모듈
 *
 * AI 플랜 자동 생성 관련 컴포넌트와 유틸리티를 제공합니다.
 */

// 컴포넌트
export { AIPlanGeneratorPanel } from "./AIPlanGeneratorPanel";
export type { AIPlanGeneratorPanelProps } from "./AIPlanGeneratorPanel";

export { AIModeButton } from "./AIModeButton";
export type { AIModeButtonProps } from "./AIModeButton";

export { StreamingProgress } from "./StreamingProgress";
export type { StreamingProgressProps } from "./StreamingProgress";

export { PartialRegenerateModal } from "./PartialRegenerateModal";
export type { PartialRegenerateModalProps } from "./PartialRegenerateModal";

// 훅
export { useAIPlanGeneration } from "./hooks/useAIPlanGeneration";
export type {
  UseAIPlanGenerationOptions,
  UseAIPlanGenerationReturn,
} from "./hooks/useAIPlanGeneration";

export { useStreamingGeneration } from "./hooks/useStreamingGeneration";
export type {
  GenerationPhase,
  GenerationProgress,
  UseStreamingGenerationOptions,
  UseStreamingGenerationReturn,
} from "./hooks/useStreamingGeneration";
