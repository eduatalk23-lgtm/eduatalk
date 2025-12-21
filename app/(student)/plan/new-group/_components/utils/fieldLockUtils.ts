/**
 * 필드 잠금 관련 유틸리티 함수
 * 
 * 템플릿 모드에서 필드 잠금/해제 로직을 통합 관리합니다.
 */

import type { TemplateLockedFields } from "../PlanGroupWizard";
import type { WizardData } from "../PlanGroupWizard";

/**
 * 필드명과 allow_student_* 필드명 매핑
 */
const FIELD_NAME_MAP: Record<string, string> = {
  name: "allow_student_name",
  plan_purpose: "allow_student_plan_purpose",
  scheduler_type: "allow_student_scheduler_type",
  period_start: "allow_student_period",
  period_end: "allow_student_period",
  block_set_id: "allow_student_block_set_id",
  student_level: "allow_student_student_level",
  subject_allocations: "allow_student_subject_allocations",
  study_review_cycle: "allow_student_study_review_cycle",
  additional_period_reallocation: "allow_student_additional_period_reallocation",
};

/**
 * 필드가 고정되어 있는지 확인
 * 
 * @param fieldName 필드명 (예: "name", "plan_purpose")
 * @param lockedFields 템플릿 고정 필드 객체
 * @param isCampMode 캠프 모드 여부 (학생 모드에서만 체크)
 * @returns 필드가 고정되어 있으면 true
 */
export function isFieldLocked(
  fieldName: string,
  lockedFields: TemplateLockedFields["step1"] | undefined,
  isCampMode: boolean
): boolean {
  // 템플릿 편집 모드에서는 항상 편집 가능
  if (!isCampMode) return false;

  const allowFieldName = FIELD_NAME_MAP[fieldName];
  if (!allowFieldName || !lockedFields) return false;

  const fieldValue = lockedFields[allowFieldName as keyof typeof lockedFields];
  // undefined나 false이면 고정 (true가 아니면 고정)
  return fieldValue !== true;
}

/**
 * 학생이 필드에 입력할 수 있는지 확인
 * 
 * @param fieldName 필드명 (allow_student_* 형식)
 * @param lockedFields 템플릿 고정 필드 객체
 * @param editable 편집 가능 여부
 * @param isCampMode 캠프 모드 여부
 * @returns 입력 가능하면 true
 */
export function canStudentInput(
  fieldName: keyof NonNullable<TemplateLockedFields["step1"]>,
  lockedFields: TemplateLockedFields["step1"] | undefined,
  editable: boolean,
  isCampMode: boolean
): boolean {
  // editable={false}일 때는 모든 필드 입력 불가
  if (!editable) return false;
  
  // 일반 모드에서는 항상 허용
  if (!isCampMode) return true;

  // templateLockedFields가 없으면 모든 필드 입력 가능 (기본값)
  if (!lockedFields) return true;

  const fieldValue = lockedFields[fieldName];
  // 명시적으로 true인 경우만 입력 가능, undefined나 false이면 입력 불가
  return fieldValue === true;
}

/**
 * 필드 제어 토글 (템플릿 모드에서만 사용)
 * 
 * @param fieldName 필드명 (allow_student_* 형식)
 * @param currentLocked 현재 고정 필드 객체
 * @param enabled 명시적으로 설정할 값 (선택사항, 제공되지 않으면 자동 토글)
 * @returns 새로운 고정 필드 객체
 */
export function toggleFieldControl(
  fieldName: keyof NonNullable<TemplateLockedFields["step1"]>,
  currentLocked: TemplateLockedFields["step1"] | undefined,
  enabled?: boolean
): TemplateLockedFields["step1"] {
  const locked = currentLocked || {};
  
  // enabled 값이 명시적으로 제공되면 그 값을 사용, 아니면 자동 토글
  const newValue = enabled !== undefined 
    ? enabled 
    : (locked[fieldName] === true ? false : true);

  return {
    ...locked,
    [fieldName]: newValue,
  };
}

/**
 * 템플릿 모드에서 학생 입력 허용 여부 확인
 * 
 * @param fieldName 필드명 (allow_student_* 형식)
 * @param lockedFields 템플릿 고정 필드 객체
 * @returns 학생 입력 허용 여부
 */
export function isStudentInputAllowed(
  fieldName: keyof NonNullable<TemplateLockedFields["step1"]>,
  lockedFields: TemplateLockedFields["step1"] | undefined
): boolean {
  if (!lockedFields) return false;
  const fieldValue = lockedFields[fieldName];
  return fieldValue === true;
}

/**
 * 필드 잠금 상태 업데이트
 * 
 * @param wizardData 현재 위저드 데이터
 * @param step1LockedFields Step1의 새로운 고정 필드 객체
 * @returns 업데이트된 위저드 데이터
 */
export function updateFieldLock(
  wizardData: WizardData,
  step1LockedFields: TemplateLockedFields["step1"]
): Partial<WizardData> {
  return {
    templateLockedFields: {
      ...wizardData.templateLockedFields,
      step1: step1LockedFields,
    },
  };
}

/**
 * 모든 필드의 학생 입력 허용 여부를 한 번에 확인
 * 
 * @param lockedFields 템플릿 고정 필드 객체
 * @param editable 편집 가능 여부
 * @param isCampMode 캠프 모드 여부
 * @returns 필드별 입력 가능 여부 맵
 */
export function getAllFieldInputPermissions(
  lockedFields: TemplateLockedFields["step1"] | undefined,
  editable: boolean,
  isCampMode: boolean
): Record<string, boolean> {
  const permissions: Record<string, boolean> = {};
  
  const fieldNames: Array<keyof NonNullable<TemplateLockedFields["step1"]>> = [
    "allow_student_name",
    "allow_student_plan_purpose",
    "allow_student_scheduler_type",
    "allow_student_period",
    "allow_student_block_set_id",
    "allow_student_student_level",
    "allow_student_subject_allocations",
    "allow_student_study_review_cycle",
    "allow_student_additional_period_reallocation",
  ];

  for (const fieldName of fieldNames) {
    permissions[fieldName as string] = canStudentInput(fieldName, lockedFields, editable, isCampMode);
  }

  return permissions;
}

