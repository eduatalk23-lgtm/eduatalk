/**
 * 템플릿 잠금 서비스
 *
 * 캠프 템플릿의 필드 잠금 상태를 관리하고 검증합니다.
 * 템플릿에서 학생이 수정할 수 없는 필드를 제어합니다.
 */

import {
  type TemplateLockedFields,
  type ContentSlot,
  type SlotTemplate,
} from "@/lib/schemas/planWizardSchema";

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 잠금 가능한 필드 카테고리
 */
export type LockableFieldCategory =
  | "basic_info"
  | "schedule"
  | "time_settings"
  | "content"
  | "slot"
  | "allocation";

/**
 * 잠금 필드 정보
 */
export interface LockedFieldInfo {
  fieldPath: string;
  category: LockableFieldCategory;
  isLocked: boolean;
  lockedBy: "template" | "admin" | "system";
  reason?: string;
}

/**
 * 잠금 검증 결과
 */
export interface LockValidationResult {
  isValid: boolean;
  violations: LockViolation[];
}

/**
 * 잠금 위반 정보
 */
export interface LockViolation {
  fieldPath: string;
  attemptedValue: unknown;
  lockedValue: unknown;
  message: string;
}

/**
 * 템플릿 잠금 컨텍스트
 */
export interface TemplateLockContext {
  templateLockedFields?: TemplateLockedFields;
  slotTemplates?: SlotTemplate[];
  isAdmin?: boolean;
}

// ============================================================================
// 필드 잠금 매핑
// ============================================================================

/**
 * Step별 잠금 가능 필드 정의
 */
export const LOCKABLE_FIELDS: Record<string, { step: number; category: LockableFieldCategory; label: string }> = {
  // Step 1 - 기본 정보
  "name": { step: 1, category: "basic_info", label: "플랜 이름" },
  "plan_purpose": { step: 1, category: "basic_info", label: "플랜 목적" },
  "scheduler_type": { step: 1, category: "basic_info", label: "스케줄러 유형" },
  "period_start": { step: 1, category: "schedule", label: "시작일" },
  "period_end": { step: 1, category: "schedule", label: "종료일" },
  "block_set_id": { step: 1, category: "basic_info", label: "블록셋" },
  "student_level": { step: 1, category: "basic_info", label: "학생 수준" },
  "subject_allocations": { step: 1, category: "allocation", label: "과목 배정" },
  "study_review_cycle": { step: 1, category: "schedule", label: "학습/복습 주기" },

  // Step 2 - 일정 설정
  "exclusions": { step: 2, category: "schedule", label: "제외일" },
  "academy_schedules": { step: 2, category: "schedule", label: "학원 일정" },
  "time_settings": { step: 2, category: "time_settings", label: "시간 설정" },
  "time_settings.lunch_time": { step: 2, category: "time_settings", label: "점심 시간" },
  "time_settings.camp_study_hours": { step: 2, category: "time_settings", label: "캠프 학습 시간" },
  "time_settings.camp_self_study_hours": { step: 2, category: "time_settings", label: "자율 학습 시간" },

  // Step 4 - 콘텐츠
  "student_contents": { step: 4, category: "content", label: "학생 콘텐츠" },
  "recommended_contents": { step: 4, category: "content", label: "추천 콘텐츠" },
  "content_slots": { step: 4, category: "slot", label: "콘텐츠 슬롯" },

  // Step 6 - 배정
  "content_allocations": { step: 6, category: "allocation", label: "콘텐츠 배정" },
  "allocation_mode": { step: 6, category: "allocation", label: "배정 모드" },
};

// ============================================================================
// 잠금 상태 확인 함수
// ============================================================================

/**
 * 필드가 잠겨있는지 확인
 */
export function isFieldLocked(
  fieldPath: string,
  context: TemplateLockContext
): boolean {
  if (context.isAdmin) return false; // 관리자는 잠금 무시

  const { templateLockedFields } = context;
  if (!templateLockedFields) return false;

  // Step별 잠금 확인
  const fieldInfo = LOCKABLE_FIELDS[fieldPath];
  if (!fieldInfo) return false;

  const stepKey = `step${fieldInfo.step}` as keyof TemplateLockedFields;
  const stepLocks = templateLockedFields[stepKey];

  if (!stepLocks) return false;

  // Step 1 특수 처리 (allow_student_ 접두어)
  if (fieldInfo.step === 1) {
    const step1Locks = stepLocks as NonNullable<TemplateLockedFields["step1"]>;
    const allowKey = `allow_student_${fieldPath}` as keyof typeof step1Locks;
    if (allowKey in step1Locks) {
      // allow_student_* 가 false면 잠김
      return step1Locks[allowKey] === false;
    }
  }

  // 일반 필드 잠금 확인
  const locks = stepLocks as Record<string, boolean>;
  return locks[fieldPath] === true || locks[`lock_${fieldPath}`] === true;
}

/**
 * 슬롯이 잠겨있는지 확인
 */
export function isSlotLocked(
  slotIndex: number,
  context: TemplateLockContext
): boolean {
  if (context.isAdmin) return false;

  const { slotTemplates } = context;
  if (!slotTemplates) return false;

  const template = slotTemplates.find((t) => t.slot_index === slotIndex);
  return template?.is_locked === true;
}

/**
 * 슬롯의 특정 필드가 잠겨있는지 확인
 */
export function isSlotFieldLocked(
  slotIndex: number,
  fieldName: string,
  context: TemplateLockContext
): boolean {
  // 슬롯 전체가 잠기면 모든 필드 잠김
  if (isSlotLocked(slotIndex, context)) return true;

  // 슬롯 필드별 잠금 확인
  const { slotTemplates } = context;
  if (!slotTemplates) return false;

  const template = slotTemplates.find((t) => t.slot_index === slotIndex);
  if (!template) return false;

  // 특정 필드 잠금 규칙
  switch (fieldName) {
    case "slot_type":
      // slot_type이 지정되어 있으면 잠김
      return template.slot_type !== null;
    case "subject_category":
      // subject_category가 지정되어 있으면 잠김
      return !!template.subject_category && template.subject_category !== "";
    case "subject_type":
      // subject_type이 지정되어 있으면 잠김
      return template.subject_type !== null && template.subject_type !== undefined;
    case "weekly_days":
      // weekly_days가 지정되어 있으면 잠김
      return template.weekly_days !== null && template.weekly_days !== undefined;
    default:
      return false;
  }
}

// ============================================================================
// 잠금 검증 함수
// ============================================================================

/**
 * 필드 변경 검증
 */
export function validateFieldChange<T>(
  fieldPath: string,
  newValue: T,
  originalValue: T,
  context: TemplateLockContext
): LockValidationResult {
  const violations: LockViolation[] = [];

  if (isFieldLocked(fieldPath, context)) {
    // 값이 변경되었는지 확인
    if (JSON.stringify(newValue) !== JSON.stringify(originalValue)) {
      violations.push({
        fieldPath,
        attemptedValue: newValue,
        lockedValue: originalValue,
        message: `'${LOCKABLE_FIELDS[fieldPath]?.label || fieldPath}'은(는) 템플릿에 의해 잠겨있어 수정할 수 없습니다.`,
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * 슬롯 변경 검증
 */
export function validateSlotChange(
  slot: ContentSlot,
  originalSlot: ContentSlot | undefined,
  context: TemplateLockContext
): LockValidationResult {
  const violations: LockViolation[] = [];

  if (isSlotLocked(slot.slot_index, context) && originalSlot) {
    // 잠긴 슬롯의 핵심 필드가 변경되었는지 확인
    const lockedFields = ["slot_type", "subject_category", "subject_type", "weekly_days"] as const;

    for (const field of lockedFields) {
      const newVal = slot[field];
      const origVal = originalSlot[field];

      if (JSON.stringify(newVal) !== JSON.stringify(origVal)) {
        violations.push({
          fieldPath: `slot[${slot.slot_index}].${field}`,
          attemptedValue: newVal,
          lockedValue: origVal,
          message: `슬롯 ${slot.slot_index + 1}의 '${field}'은(는) 템플릿에 의해 잠겨있습니다.`,
        });
      }
    }
  }

  // 개별 필드 잠금 검증
  if (originalSlot) {
    const checkableFields = ["slot_type", "subject_category", "subject_type", "weekly_days"] as const;
    for (const field of checkableFields) {
      if (isSlotFieldLocked(slot.slot_index, field, context)) {
        const newVal = slot[field];
        const origVal = originalSlot[field];

        if (JSON.stringify(newVal) !== JSON.stringify(origVal)) {
          violations.push({
            fieldPath: `slot[${slot.slot_index}].${field}`,
            attemptedValue: newVal,
            lockedValue: origVal,
            message: `슬롯 ${slot.slot_index + 1}의 '${field}'은(는) 변경할 수 없습니다.`,
          });
        }
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * 전체 위저드 데이터 잠금 검증
 */
export function validateLockedFields(
  newData: Record<string, unknown>,
  originalData: Record<string, unknown>,
  context: TemplateLockContext
): LockValidationResult {
  const violations: LockViolation[] = [];

  // 일반 필드 검증
  for (const fieldPath of Object.keys(LOCKABLE_FIELDS)) {
    if (fieldPath in newData && fieldPath in originalData) {
      const result = validateFieldChange(
        fieldPath,
        newData[fieldPath],
        originalData[fieldPath],
        context
      );
      violations.push(...result.violations);
    }
  }

  // 슬롯 검증
  const newSlots = newData.content_slots as ContentSlot[] | undefined;
  const originalSlots = originalData.content_slots as ContentSlot[] | undefined;

  if (newSlots && originalSlots) {
    newSlots.forEach((slot) => {
      const originalSlot = originalSlots.find((s) => s.slot_index === slot.slot_index);
      const result = validateSlotChange(slot, originalSlot, context);
      violations.push(...result.violations);
    });
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

// ============================================================================
// 잠금 정보 헬퍼
// ============================================================================

/**
 * 모든 잠긴 필드 목록 조회
 */
export function getLockedFields(context: TemplateLockContext): LockedFieldInfo[] {
  const lockedFields: LockedFieldInfo[] = [];

  for (const [fieldPath, info] of Object.entries(LOCKABLE_FIELDS)) {
    if (isFieldLocked(fieldPath, context)) {
      lockedFields.push({
        fieldPath,
        category: info.category,
        isLocked: true,
        lockedBy: "template",
        reason: "템플릿에 의해 잠금",
      });
    }
  }

  // 슬롯 잠금
  const { slotTemplates } = context;
  if (slotTemplates) {
    slotTemplates.forEach((template) => {
      if (template.is_locked) {
        lockedFields.push({
          fieldPath: `content_slots[${template.slot_index}]`,
          category: "slot",
          isLocked: true,
          lockedBy: "template",
          reason: "템플릿에 의해 슬롯 잠금",
        });
      }
    });
  }

  return lockedFields;
}

/**
 * 특정 Step의 잠긴 필드 목록 조회
 */
export function getLockedFieldsForStep(
  step: number,
  context: TemplateLockContext
): LockedFieldInfo[] {
  return getLockedFields(context).filter((field) => {
    const info = LOCKABLE_FIELDS[field.fieldPath];
    return info?.step === step;
  });
}

/**
 * 잠금 상태 요약 조회
 */
export function getLockSummary(context: TemplateLockContext): {
  totalFields: number;
  lockedFields: number;
  lockedSlots: number;
  isFullyLocked: boolean;
} {
  const lockedFields = getLockedFields(context);
  const totalFields = Object.keys(LOCKABLE_FIELDS).length;
  const lockedCount = lockedFields.filter((f) => f.category !== "slot").length;
  const lockedSlots = lockedFields.filter((f) => f.category === "slot").length;

  return {
    totalFields,
    lockedFields: lockedCount,
    lockedSlots,
    isFullyLocked: lockedCount >= totalFields,
  };
}

// ============================================================================
// UI 헬퍼
// ============================================================================

/**
 * 잠금 아이콘 타입 결정
 */
export function getLockIconType(
  isLocked: boolean,
  category: LockableFieldCategory
): "locked" | "unlocked" | "partial" {
  if (!isLocked) return "unlocked";
  return "locked";
}

/**
 * 잠금 상태 스타일 클래스 생성
 */
export function getLockStyleClasses(isLocked: boolean): {
  container: string;
  input: string;
  label: string;
} {
  if (isLocked) {
    return {
      container: "opacity-75 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50",
      input: "pointer-events-none cursor-not-allowed bg-gray-100 dark:bg-gray-700",
      label: "text-gray-500 dark:text-gray-400",
    };
  }

  return {
    container: "",
    input: "",
    label: "",
  };
}

/**
 * 잠금 힌트 메시지 생성
 */
export function getLockHintMessage(
  fieldPath: string,
  context: TemplateLockContext
): string | null {
  if (!isFieldLocked(fieldPath, context)) return null;

  const fieldInfo = LOCKABLE_FIELDS[fieldPath];
  const label = fieldInfo?.label || fieldPath;

  return `${label}은(는) 캠프 템플릿에 의해 고정되어 있습니다. 변경이 필요한 경우 관리자에게 문의하세요.`;
}

/**
 * 슬롯 잠금 힌트 메시지 생성
 */
export function getSlotLockHintMessage(
  slotIndex: number,
  context: TemplateLockContext
): string | null {
  if (!isSlotLocked(slotIndex, context)) return null;

  return `슬롯 ${slotIndex + 1}은(는) 캠프 템플릿에 의해 설정이 고정되어 있습니다. 콘텐츠 연결만 가능합니다.`;
}

// ============================================================================
// 템플릿 잠금 설정 적용
// ============================================================================

/**
 * 템플릿 잠금 설정을 슬롯에 적용
 */
export function applyTemplateLockToSlots(
  slots: ContentSlot[],
  slotTemplates: SlotTemplate[]
): ContentSlot[] {
  return slots.map((slot) => {
    const template = slotTemplates.find((t) => t.slot_index === slot.slot_index);
    if (!template) return slot;

    return {
      ...slot,
      // 템플릿에서 잠긴 필드 적용
      slot_type: template.slot_type ?? slot.slot_type,
      subject_category: template.subject_category || slot.subject_category,
      subject_type: template.subject_type ?? slot.subject_type,
      weekly_days: template.weekly_days ?? slot.weekly_days,
      is_locked: template.is_locked ?? slot.is_locked,
      is_ghost: template.is_ghost ?? slot.is_ghost,
      ghost_message: template.ghost_message ?? slot.ghost_message,
      is_required: template.is_required ?? slot.is_required,
    };
  });
}

/**
 * 빈 슬롯 배열을 템플릿으로 초기화
 */
export function initializeSlotsFromTemplates(
  slotTemplates: SlotTemplate[]
): ContentSlot[] {
  return slotTemplates.map((template) => ({
    slot_index: template.slot_index,
    slot_type: template.slot_type,
    subject_category: template.subject_category,
    subject_id: template.subject_id,
    curriculum_revision_id: template.curriculum_revision_id,
    is_required: template.is_required,
    is_locked: template.is_locked,
    is_ghost: template.is_ghost,
    ghost_message: template.ghost_message,
    default_search_term: template.default_search_term,
    subject_type: template.subject_type,
    weekly_days: template.weekly_days,
    // 콘텐츠 연결 필드는 빈 값으로 초기화
    content_id: null,
    start_range: undefined,
    end_range: undefined,
    title: undefined,
  }));
}
