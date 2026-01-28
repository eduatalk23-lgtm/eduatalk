/**
 * AI 플랜 슬롯 기반 콘텐츠 구성 타입 정의
 *
 * AdminAIPlanModalV2에서 사용하는 슬롯 시스템 타입입니다.
 * 다중 교과 동시 추천, AI + 기존 콘텐츠 혼합을 지원합니다.
 */

import type { DifficultyLevel, ContentType } from '@/lib/domains/plan/llm/actions/coldStart/types';

// ============================================================================
// 슬롯 타입
// ============================================================================

/**
 * 슬롯 타입
 * - ai_recommendation: AI Cold Start를 통한 콘텐츠 추천
 * - existing_content: 기존 DB에 있는 콘텐츠 직접 선택
 */
export type SlotType = 'ai_recommendation' | 'existing_content';

/**
 * 슬롯 상태
 * - empty: 초기 상태, 아직 설정 안 됨
 * - configuring: 설정 진행 중 (교과/난이도 선택 중)
 * - loading: AI 추천 로딩 중
 * - preview: 추천 결과 확인/선택 단계
 * - confirmed: 확정됨
 * - error: 오류 발생
 */
export type SlotStatus = 'empty' | 'configuring' | 'loading' | 'preview' | 'confirmed' | 'error';

/**
 * AI 추천 설정
 */
export interface AIConfig {
  /** 교과 (국어, 수학, 영어 등) */
  subjectCategory: string;
  /** 세부 과목 (미적분, 문학 등) */
  subject?: string;
  /** 난이도 */
  difficulty: DifficultyLevel;
  /** 콘텐츠 타입 */
  contentType: ContentType | 'all';
}

/**
 * AI 추천 결과 (슬롯용)
 */
export interface AIResult {
  /** 추천된 콘텐츠 목록 */
  recommendations: RecommendedContent[];
  /** 선택된 콘텐츠 (사용자가 1개 선택) */
  selectedContent?: RecommendedContent;
  /** 추천 통계 */
  stats?: {
    totalFound: number;
    usedFallback: boolean;
  };
}

/**
 * 추천 콘텐츠 (AI 추천용)
 * - tempId: 임시 ID (DB 저장 전)
 */
export interface RecommendedContent {
  /** 임시 ID (UUID) */
  tempId: string;
  /** 콘텐츠 제목 */
  title: string;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 총 범위 (페이지 수 또는 강의 수) */
  totalRange: number;
  /** 저자/강사 */
  author?: string;
  /** 출판사/플랫폼 */
  publisher?: string;
  /** AI 매칭 점수 (0-100) */
  matchScore: number;
  /** 추천 이유 */
  reason: string;
  /** 목차 정보 */
  chapters?: ChapterInfo[];
}

/**
 * 챕터 정보
 */
export interface ChapterInfo {
  title: string;
  startRange: number;
  endRange: number;
}

/**
 * 기존 콘텐츠 설정
 */
export interface ExistingContentConfig {
  /** 콘텐츠 ID (DB ID) */
  contentId: string;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 제목 */
  title: string;
  /** 총 범위 */
  totalRange: number;
  /** 교과 */
  subjectCategory?: string;
  /** 과목 */
  subject?: string;
}

/**
 * 범위 설정
 */
export interface RangeConfig {
  /** 시작 범위 (페이지/강의 번호) */
  startRange: number;
  /** 끝 범위 (페이지/강의 번호) */
  endRange: number;
}

/**
 * 과목 분류 (전략/취약)
 */
export type SubjectClassification = 'strategic' | 'weakness';

/**
 * 전략 과목 설정 (주간 배정일)
 */
export interface StrategicConfig {
  /** 주간 배정일 (2, 3, 4일 중 선택) */
  weeklyDays: 2 | 3 | 4;
}

// ============================================================================
// 콘텐츠 슬롯 (핵심 타입)
// ============================================================================

/**
 * 콘텐츠 슬롯
 * - 하나의 학습 콘텐츠를 나타냄
 * - AI 추천 또는 기존 콘텐츠 모두 지원
 */
export interface ContentSlot {
  /** 슬롯 고유 ID (UUID) */
  id: string;

  /** 슬롯 타입 */
  type: SlotType;

  /** 슬롯 상태 */
  status: SlotStatus;

  /** AI 추천 설정 (type이 'ai_recommendation'일 때) */
  aiConfig?: AIConfig;

  /** AI 추천 결과 (type이 'ai_recommendation'일 때) */
  aiResult?: AIResult;

  /** 기존 콘텐츠 설정 (type이 'existing_content'일 때) */
  existingContent?: ExistingContentConfig;

  /** 범위 설정 (시작/끝) */
  rangeConfig?: RangeConfig;

  /** 과목 분류 (전략/취약) */
  subjectClassification?: SubjectClassification;

  /** 전략 과목 설정 (subjectClassification이 'strategic'일 때) */
  strategicConfig?: StrategicConfig;

  /** 표시 순서 (0부터 시작) */
  displayOrder: number;

  /** 에러 메시지 (status가 'error'일 때) */
  errorMessage?: string;
}

// ============================================================================
// 모달 상태 타입
// ============================================================================

/**
 * 위저드 스텝
 * 1: 플래너 선택
 * 2: 슬롯 구성
 * 3: AI 추천 확인 & 설정
 * 4: 생성 결과
 */
export type WizardStep = 1 | 2 | 3 | 4;

/**
 * 모달 전체 상태
 */
export interface ModalState {
  /** 현재 스텝 */
  currentStep: WizardStep;

  /** 선택된 플래너 ID */
  selectedPlannerId: string | null;

  /** 콘텐츠 슬롯 목록 */
  slots: ContentSlot[];

  /** 학습 시작일 */
  periodStart: string;

  /** 학습 종료일 */
  periodEnd: string;

  /** 생성 결과 */
  generationResult: GenerationResult | null;

  /** 로딩 상태 */
  isLoading: boolean;

  /** 전역 에러 */
  error: string | null;
}

/**
 * 생성 결과
 */
export interface GenerationResult {
  success: boolean;
  results: SlotGenerationResult[];
  totalPlans: number;
  processingTimeMs: number;
}

/**
 * 개별 슬롯 생성 결과
 */
export interface SlotGenerationResult {
  slotId: string;
  contentId: string;
  contentTitle: string;
  planGroupId: string;
  planCount: number;
  success: boolean;
  error?: string;
  warning?: string;
}

// ============================================================================
// Reducer Action 타입
// ============================================================================

export type ModalAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_PLANNER'; plannerId: string }
  | { type: 'SET_PERIOD'; periodStart: string; periodEnd: string }
  | { type: 'ADD_SLOT'; slotType: SlotType }
  | { type: 'REMOVE_SLOT'; slotId: string }
  | { type: 'UPDATE_SLOT'; slotId: string; updates: Partial<ContentSlot> }
  | { type: 'REORDER_SLOT'; slotId: string; newOrder: number }
  | { type: 'SET_AI_CONFIG'; slotId: string; config: AIConfig }
  | { type: 'SET_AI_RESULT'; slotId: string; result: AIResult }
  | { type: 'SELECT_RECOMMENDATION'; slotId: string; content: RecommendedContent }
  | { type: 'SET_EXISTING_CONTENT'; slotId: string; content: ExistingContentConfig }
  | { type: 'SET_RANGE_CONFIG'; slotId: string; rangeConfig: RangeConfig }
  | { type: 'SET_SUBJECT_CLASSIFICATION'; slotId: string; classification: SubjectClassification }
  | { type: 'SET_STRATEGIC_CONFIG'; slotId: string; config: StrategicConfig }
  | { type: 'CONFIRM_SLOT'; slotId: string }
  | { type: 'SET_SLOT_ERROR'; slotId: string; error: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_GENERATION_RESULT'; result: GenerationResult }
  | { type: 'RESET' };

// ============================================================================
// Server Action 입력 타입
// ============================================================================

/**
 * 슬롯 기반 플랜 생성 입력
 */
export interface GenerateSlotBasedPlanInput {
  /** 학생 ID */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 플래너 ID */
  plannerId: string;
  /** 학습 시작일 */
  periodStart: string;
  /** 학습 종료일 */
  periodEnd: string;
  /** 확정된 슬롯 목록 */
  slots: ConfirmedSlot[];
}

/**
 * 확정된 슬롯 (생성 요청용)
 */
export interface ConfirmedSlot {
  /** 슬롯 ID */
  id: string;
  /** 슬롯 타입 */
  type: SlotType;
  /** 콘텐츠 정보 */
  content: {
    /** 콘텐츠 ID (기존) 또는 null (AI 추천) */
    id: string | null;
    /** 제목 */
    title: string;
    /** 콘텐츠 타입 */
    contentType: ContentType;
    /** 총 범위 */
    totalRange: number;
    /** 저자/강사 */
    author?: string;
    /** 출판사/플랫폼 */
    publisher?: string;
    /** 교과 */
    subjectCategory?: string;
    /** 과목 */
    subject?: string;
    /** 목차 */
    chapters?: ChapterInfo[];
  };
  /** 범위 설정 */
  rangeConfig: RangeConfig;
  /** 과목 분류 */
  subjectClassification: SubjectClassification;
  /** 전략 과목 설정 */
  strategicConfig?: StrategicConfig;
}

// ============================================================================
// 헬퍼 함수 타입
// ============================================================================

/**
 * 슬롯에서 확정 슬롯으로 변환하는 헬퍼
 */
export function toConfirmedSlot(slot: ContentSlot): ConfirmedSlot | null {
  if (slot.status !== 'confirmed') {
    return null;
  }

  // AI 추천 슬롯
  if (slot.type === 'ai_recommendation' && slot.aiResult?.selectedContent) {
    const selected = slot.aiResult.selectedContent;
    return {
      id: slot.id,
      type: slot.type,
      content: {
        id: null, // 아직 DB에 없음
        title: selected.title,
        contentType: selected.contentType,
        totalRange: selected.totalRange,
        author: selected.author,
        publisher: selected.publisher,
        subjectCategory: slot.aiConfig?.subjectCategory,
        subject: slot.aiConfig?.subject,
        chapters: selected.chapters,
      },
      rangeConfig: slot.rangeConfig!,
      subjectClassification: slot.subjectClassification!,
      strategicConfig: slot.strategicConfig,
    };
  }

  // 기존 콘텐츠 슬롯
  if (slot.type === 'existing_content' && slot.existingContent) {
    const existing = slot.existingContent;
    return {
      id: slot.id,
      type: slot.type,
      content: {
        id: existing.contentId,
        title: existing.title,
        contentType: existing.contentType,
        totalRange: existing.totalRange,
        subjectCategory: existing.subjectCategory,
        subject: existing.subject,
      },
      rangeConfig: slot.rangeConfig!,
      subjectClassification: slot.subjectClassification!,
      strategicConfig: slot.strategicConfig,
    };
  }

  return null;
}

/**
 * 슬롯이 확정 가능한지 검사
 */
export function canConfirmSlot(slot: ContentSlot): boolean {
  // 기본 조건: 범위와 분류가 설정되어 있어야 함
  if (!slot.rangeConfig || !slot.subjectClassification) {
    return false;
  }

  // 전략 과목이면 주간 배정일 필요
  if (slot.subjectClassification === 'strategic' && !slot.strategicConfig) {
    return false;
  }

  // AI 추천: 콘텐츠 선택 필요
  if (slot.type === 'ai_recommendation') {
    return !!slot.aiResult?.selectedContent;
  }

  // 기존 콘텐츠: 콘텐츠 선택 필요
  if (slot.type === 'existing_content') {
    return !!slot.existingContent;
  }

  return false;
}

/**
 * 새 슬롯 생성 헬퍼
 */
export function createNewSlot(type: SlotType, displayOrder: number): ContentSlot {
  return {
    id: crypto.randomUUID(),
    type,
    status: type === 'ai_recommendation' ? 'configuring' : 'empty',
    displayOrder,
    aiConfig: type === 'ai_recommendation' ? {
      subjectCategory: '',
      difficulty: '개념',
      contentType: 'book',
    } : undefined,
  };
}
