/**
 * useFieldPermission 훅
 *
 * 현재 모드와 템플릿 잠금 설정에 따라 필드의 입력 가능 여부를 반환합니다.
 * Step1BasicInfo 등에서 반복되는 권한 체크 로직을 추상화합니다.
 */

import { useMemo } from "react";
import { canStudentInput } from "../utils/fieldLockUtils";
import type { TemplateLockedFields } from "../PlanGroupWizard";

type FieldPermissionOptions = {
  /**
   * 템플릿 고정 필드 객체 (step1, step2 등)
   */
  lockedFields?: TemplateLockedFields["step1"];
  /**
   * 편집 가능 여부 (editable prop)
   */
  editable: boolean;
  /**
   * 캠프 모드 여부
   */
  isCampMode: boolean;
};

/**
 * 필드명 타입 (Step1의 allow_student_* 필드들)
 */
export type Step1FieldName =
  | "allow_student_name"
  | "allow_student_plan_purpose"
  | "allow_student_scheduler_type"
  | "allow_student_period"
  | "allow_student_block_set_id"
  | "allow_student_student_level"
  | "allow_student_subject_allocations"
  | "allow_student_study_review_cycle"
  | "allow_student_additional_period_reallocation";

/**
 * useFieldPermission 훅
 *
 * @param options 필드 권한 옵션
 * @returns 필드별 입력 가능 여부를 반환하는 함수
 */
export function useFieldPermission(options: FieldPermissionOptions) {
  const { lockedFields, editable, isCampMode } = options;

  /**
   * 특정 필드의 입력 가능 여부를 반환하는 함수
   *
   * @param fieldName 필드명 (allow_student_* 형식)
   * @returns 입력 가능하면 true
   */
  const getFieldPermission = useMemo(
    () =>
      (fieldName: Step1FieldName): boolean => {
        return canStudentInput(fieldName, lockedFields, editable, isCampMode);
      },
    [lockedFields, editable, isCampMode]
  );

  return { getFieldPermission };
}




