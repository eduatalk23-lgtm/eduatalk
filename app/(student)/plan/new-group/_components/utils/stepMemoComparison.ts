/**
 * Step 컴포넌트 메모이제이션 비교 함수
 *
 * React.memo의 두 번째 인자로 사용되는 커스텀 비교 함수를 제공합니다.
 * 핵심 props만 비교하여 불필요한 리렌더링을 방지합니다.
 *
 * 성능 향상:
 * - 전체 props 얕은 비교 → 핵심 필드만 비교
 * - 40-50% 리렌더링 감소 예상
 */

import type { FieldErrors } from "../hooks/useWizardValidation";

// 공통 데이터 타입 (WizardData와 Step3ContentSelectionProps의 data를 모두 포함)
type DataWithContents = {
  student_contents?: unknown[];
  recommended_contents?: unknown[];
  content_slots?: unknown[];
  use_slot_mode?: boolean;
  allocation_mode?: string;
  name?: string;
  plan_purpose?: string;
  scheduler_type?: string;
  period_start?: string;
  period_end?: string;
  block_set_id?: string;
  study_review_cycle?: unknown;
  exclusions?: unknown[];
  academy_schedules?: unknown[];
  time_settings?: unknown;
  scheduler_options?: unknown;
  non_study_time_blocks?: unknown[];
  schedule_summary?: unknown;
  daily_schedule?: unknown[];
};

// ============================================================================
// 공통 유틸리티
// ============================================================================

/**
 * 두 객체의 특정 키들만 비교
 */
function compareKeys<T extends object>(
  prev: T,
  next: T,
  keys: (keyof T)[]
): boolean {
  for (const key of keys) {
    if (prev[key] !== next[key]) {
      return false;
    }
  }
  return true;
}

/**
 * 데이터의 특정 필드들만 비교
 */
function compareDataFields(
  prev: DataWithContents | undefined,
  next: DataWithContents | undefined,
  fields: (keyof DataWithContents)[]
): boolean {
  // 둘 다 없으면 동일
  if (!prev && !next) return true;
  // 하나만 없으면 다름
  if (!prev || !next) return false;
  // 레퍼런스 동일하면 동일
  if (prev === next) return true;

  for (const field of fields) {
    const prevValue = prev[field];
    const nextValue = next[field];

    // 배열은 길이와 첫/마지막 요소로 빠르게 비교
    if (Array.isArray(prevValue) && Array.isArray(nextValue)) {
      if (prevValue.length !== nextValue.length) return false;
      if (prevValue.length > 0) {
        // 첫/마지막 요소의 레퍼런스 비교
        if (prevValue[0] !== nextValue[0]) return false;
        if (prevValue[prevValue.length - 1] !== nextValue[nextValue.length - 1])
          return false;
      }
    } else if (prevValue !== nextValue) {
      return false;
    }
  }

  return true;
}

/**
 * FieldErrors Map 비교 (크기와 키 집합)
 */
function compareFieldErrors(
  prev: FieldErrors | undefined,
  next: FieldErrors | undefined
): boolean {
  if (!prev && !next) return true;
  if (!prev || !next) return false;
  if (prev === next) return true;
  if (prev.size !== next.size) return false;

  // 키 집합 비교
  for (const key of prev.keys()) {
    if (!next.has(key)) return false;
    if (prev.get(key) !== next.get(key)) return false;
  }

  return true;
}

// ============================================================================
// Step1 비교 함수
// ============================================================================

type Step1Props = {
  data?: DataWithContents;
  onUpdate?: unknown;
  blockSets?: unknown[];
  editable?: boolean;
  isTemplateMode?: boolean;
  isCampMode?: boolean;
  fieldErrors?: FieldErrors;
};

/**
 * Step 1 (기본 정보) 전용 비교 함수
 *
 * 핵심 필드: name, plan_purpose, scheduler_type, period_start, period_end, block_set_id
 */
export function areStep1PropsEqual(
  prev: Step1Props,
  next: Step1Props
): boolean {
  // 1. 기본 props 비교
  if (
    prev.editable !== next.editable ||
    prev.isTemplateMode !== next.isTemplateMode ||
    prev.isCampMode !== next.isCampMode
  ) {
    return false;
  }

  // 2. blockSets 배열 길이 비교
  if ((prev.blockSets?.length ?? 0) !== (next.blockSets?.length ?? 0)) {
    return false;
  }

  // 3. fieldErrors 비교
  if (!compareFieldErrors(prev.fieldErrors, next.fieldErrors)) {
    return false;
  }

  // 4. 데이터 핵심 필드 비교
  const step1Fields: (keyof DataWithContents)[] = [
    "name",
    "plan_purpose",
    "scheduler_type",
    "period_start",
    "period_end",
    "block_set_id",
    "study_review_cycle",
  ];

  return compareDataFields(prev.data, next.data, step1Fields);
}

// ============================================================================
// Step2 비교 함수
// ============================================================================

type Step2Props = {
  data?: DataWithContents;
  onUpdate?: unknown;
  editable?: boolean;
  isTemplateMode?: boolean;
  fieldErrors?: FieldErrors;
};

/**
 * Step 2 (시간 설정) 전용 비교 함수
 *
 * 핵심 필드: exclusions, academy_schedules, time_settings, scheduler_options
 */
export function areStep2PropsEqual(
  prev: Step2Props,
  next: Step2Props
): boolean {
  // 1. 기본 props 비교
  if (
    prev.editable !== next.editable ||
    prev.isTemplateMode !== next.isTemplateMode
  ) {
    return false;
  }

  // 2. fieldErrors 비교
  if (!compareFieldErrors(prev.fieldErrors, next.fieldErrors)) {
    return false;
  }

  // 3. 데이터 핵심 필드 비교
  const step2Fields: (keyof DataWithContents)[] = [
    "exclusions",
    "academy_schedules",
    "time_settings",
    "scheduler_options",
    "non_study_time_blocks",
  ];

  return compareDataFields(prev.data, next.data, step2Fields);
}

// ============================================================================
// Step3 비교 함수
// ============================================================================

type Step3Props = {
  data?: DataWithContents;
  onUpdate?: unknown;
  editable?: boolean;
  isTemplateMode?: boolean;
  fieldErrors?: FieldErrors;
};

/**
 * Step 3 (콘텐츠 선택) 전용 비교 함수
 *
 * 핵심 필드: student_contents, recommended_contents, content_slots
 */
export function areStep3PropsEqual(
  prev: Step3Props,
  next: Step3Props
): boolean {
  // 1. 기본 props 비교
  if (
    prev.editable !== next.editable ||
    prev.isTemplateMode !== next.isTemplateMode
  ) {
    return false;
  }

  // 2. fieldErrors 비교
  if (!compareFieldErrors(prev.fieldErrors, next.fieldErrors)) {
    return false;
  }

  // 3. 데이터 핵심 필드 비교
  const step3Fields: (keyof DataWithContents)[] = [
    "student_contents",
    "recommended_contents",
    "content_slots",
    "use_slot_mode",
    "allocation_mode",
  ];

  return compareDataFields(prev.data, next.data, step3Fields);
}

// ============================================================================
// Step6 비교 함수
// ============================================================================

type Step6Props = {
  data?: DataWithContents;
  onUpdate?: unknown;
  editable?: boolean;
  fieldErrors?: FieldErrors;
};

/**
 * Step 6 (최종 확인) 전용 비교 함수
 *
 * 핵심 필드: 모든 콘텐츠와 범위 관련 필드
 */
export function areStep6PropsEqual(
  prev: Step6Props,
  next: Step6Props
): boolean {
  // 1. 기본 props 비교
  if (prev.editable !== next.editable) {
    return false;
  }

  // 2. fieldErrors 비교
  if (!compareFieldErrors(prev.fieldErrors, next.fieldErrors)) {
    return false;
  }

  // 3. 데이터 핵심 필드 비교
  const step6Fields: (keyof DataWithContents)[] = [
    "student_contents",
    "recommended_contents",
    "schedule_summary",
    "daily_schedule",
  ];

  return compareDataFields(prev.data, next.data, step6Fields);
}
