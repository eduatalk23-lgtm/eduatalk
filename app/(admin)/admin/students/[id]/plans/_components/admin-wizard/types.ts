/**
 * 관리자 간소화 위자드 타입 정의
 */

export type WizardStep = 1 | 2 | 3;

export type PlanPurpose = '내신대비' | '모의고사' | '수능' | '기타' | '';

export interface SelectedContent {
  contentId: string;
  contentType: 'book' | 'lecture';
  title: string;
  subject?: string;
  startRange: number;
  endRange: number;
  totalRange: number;
}

export interface AdminWizardState {
  currentStep: WizardStep;
  // Step 1: 기본 정보
  periodStart: string;
  periodEnd: string;
  name: string;
  planPurpose: PlanPurpose;
  // Step 2: 콘텐츠 선택
  selectedContents: SelectedContent[];
  skipContents: boolean;
  // Step 3: 옵션
  generateAIPlan: boolean;
  // 상태
  isSubmitting: boolean;
  error: string | null;
  createdGroupId: string | null;
}

export type AdminWizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'UPDATE_PERIOD'; periodStart: string; periodEnd: string }
  | { type: 'UPDATE_NAME'; name: string }
  | { type: 'UPDATE_PURPOSE'; purpose: PlanPurpose }
  | { type: 'TOGGLE_CONTENT'; content: SelectedContent }
  | { type: 'UPDATE_CONTENT_RANGE'; contentId: string; startRange: number; endRange: number }
  | { type: 'SET_SKIP_CONTENTS'; skip: boolean }
  | { type: 'SET_GENERATE_AI'; generate: boolean }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_CREATED_GROUP_ID'; groupId: string }
  | { type: 'RESET' };

export interface StudentContent {
  id: string;
  type: 'book' | 'lecture';
  title: string;
  subject?: string;
  totalPages?: number;
  totalEpisodes?: number;
}

export interface AdminPlanCreationWizardProps {
  studentId: string;
  tenantId: string;
  studentName: string;
  onClose: () => void;
  onSuccess: (groupId: string, generateAI: boolean) => void;
}
