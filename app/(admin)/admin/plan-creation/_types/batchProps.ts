/**
 * 배치 모드 컴포넌트 공통 Props 정의
 */

import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import type {
  BatchProgress,
  BatchItemResult,
  RetryPolicy,
  ProcessingStrategy,
} from "./batchTypes";

// 배치 모드 공통 Props
export interface BatchModeProps<TSettings = unknown> {
  /** 처리 모드 */
  mode: "single" | "batch";

  /** 처리할 학생 목록 */
  students: StudentListRow[];

  /** 공유 설정 (모든 학생에게 적용) */
  sharedSettings?: TSettings;

  /** 진행 상황 콜백 */
  onProgress?: (progress: BatchProgress) => void;

  /** 개별 학생 완료 콜백 */
  onStudentComplete?: (result: BatchItemResult) => void;

  /** 전체 완료 콜백 */
  onAllComplete?: (results: BatchItemResult[]) => void;

  /** 에러 콜백 */
  onError?: (error: Error) => void;

  /** 처리 전략 */
  processingStrategy?: ProcessingStrategy;

  /** 재시도 정책 */
  retryPolicy?: RetryPolicy;

  /** 취소 토큰 */
  cancelToken?: AbortSignal;
}

// AI 플랜 생성 설정
export interface AIGenerationSettings {
  useAI: boolean;
  aiModel?: string;
  temperature?: number;
  customPrompt?: string;
}

// 플랜 그룹 위저드 설정
export interface PlanGroupWizardSettings {
  startDate: Date;
  endDate: Date;
  daysPerWeek: number[];
  studyHoursPerDay: number;
  contentIds?: string[];
  templateId?: string;
}

// 빠른 플랜 설정
export interface QuickPlanSettings {
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  contentId?: string;
  memo?: string;
}

// 콘텐츠 추가 위저드 설정
export interface AddContentWizardSettings {
  planGroupId: string;
  contentIds: string[];
  distributionStrategy: "even" | "front-loaded" | "back-loaded";
}

// 배치 AI 플랜 Props
export type BatchAIPlanProps = BatchModeProps<AIGenerationSettings>;

// 배치 플랜 그룹 위저드 Props
export type BatchPlanGroupWizardProps = BatchModeProps<PlanGroupWizardSettings>;

// 배치 빠른 플랜 Props
export type BatchQuickPlanProps = BatchModeProps<QuickPlanSettings>;

// 배치 콘텐츠 추가 위저드 Props
export type BatchAddContentWizardProps = BatchModeProps<AddContentWizardSettings>;
