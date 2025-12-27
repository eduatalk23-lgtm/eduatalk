/**
 * 슬롯 유효성 검증 서비스
 *
 * 콘텐츠 슬롯의 비즈니스 로직 검증을 담당합니다.
 * Zod 스키마 검증 이후의 추가적인 비즈니스 규칙 검증을 수행합니다.
 */

import { z } from "zod";
import {
  type ContentSlot,
  type SlotTemplate,
  contentSlotSchema,
  slotTemplateSchema,
} from "@/lib/schemas/planWizardSchema";

// ============================================================================
// 타입 정의
// ============================================================================

export interface SlotValidationError {
  slotIndex: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface SlotValidationResult {
  isValid: boolean;
  errors: SlotValidationError[];
  warnings: SlotValidationError[];
}

export interface SlotRelationship {
  sourceSlotIndex: number;
  targetSlotIndex: number;
  type: "linked" | "exclusive";
  direction?: "after" | "before";
}

export interface SubjectConstraint {
  subjectCategory: string;
  minCount: number;
  maxCount?: number;
  requiredSlotTypes?: ("book" | "lecture" | "custom")[];
}

export interface SlotValidationContext {
  slots: ContentSlot[];
  slotTemplates?: SlotTemplate[];
  subjectConstraints?: SubjectConstraint[];
  existingContentIds?: string[];
  allowEmptySlots?: boolean;
  strictMode?: boolean;
}

// ============================================================================
// 슬롯 검증 함수들
// ============================================================================

/**
 * 슬롯 배열 전체 검증
 */
export function validateSlots(context: SlotValidationContext): SlotValidationResult {
  const errors: SlotValidationError[] = [];
  const warnings: SlotValidationError[] = [];

  const { slots, slotTemplates, subjectConstraints, strictMode = false } = context;

  // 1. 개별 슬롯 스키마 검증
  slots.forEach((slot, index) => {
    const schemaResult = contentSlotSchema.safeParse(slot);
    if (!schemaResult.success) {
      schemaResult.error.errors.forEach((err) => {
        errors.push({
          slotIndex: index,
          field: err.path.join("."),
          message: err.message,
          severity: "error",
        });
      });
    }
  });

  // 2. 필수 슬롯 검증
  const requiredSlotErrors = validateRequiredSlots(slots, slotTemplates);
  errors.push(...requiredSlotErrors);

  // 3. 슬롯 관계 검증 (linked_slot_id, exclusive_with)
  const relationshipErrors = validateSlotRelationships(slots);
  errors.push(...relationshipErrors);

  // 4. 과목 제약 검증
  if (subjectConstraints && subjectConstraints.length > 0) {
    const constraintResults = validateSubjectConstraints(slots, subjectConstraints, strictMode);
    errors.push(...constraintResults.filter((e) => e.severity === "error"));
    warnings.push(...constraintResults.filter((e) => e.severity === "warning"));
  }

  // 5. 콘텐츠 연결 검증
  const contentErrors = validateContentConnections(slots);
  errors.push(...contentErrors);

  // 6. 시간 제약 검증
  const timeErrors = validateTimeConstraints(slots);
  warnings.push(...timeErrors); // 시간 제약은 경고로 처리

  // 7. 중복 콘텐츠 검증
  const duplicateWarnings = validateDuplicateContent(slots);
  warnings.push(...duplicateWarnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 필수 슬롯 검증
 */
export function validateRequiredSlots(
  slots: ContentSlot[],
  templates?: SlotTemplate[]
): SlotValidationError[] {
  const errors: SlotValidationError[] = [];

  if (!templates) return errors;

  templates.forEach((template) => {
    if (template.is_required && !template.is_ghost) {
      const matchingSlot = slots.find(
        (s) => s.slot_index === template.slot_index
      );

      if (!matchingSlot) {
        errors.push({
          slotIndex: template.slot_index,
          field: "slot_index",
          message: `슬롯 ${template.slot_index + 1}은(는) 필수입니다.`,
          severity: "error",
        });
      } else if (!matchingSlot.content_id && matchingSlot.slot_type !== "self_study" && matchingSlot.slot_type !== "test") {
        errors.push({
          slotIndex: template.slot_index,
          field: "content_id",
          message: `슬롯 ${template.slot_index + 1}에 콘텐츠를 연결해주세요.`,
          severity: "error",
        });
      }
    }
  });

  return errors;
}

/**
 * 슬롯 관계 검증 (연계/배타)
 */
export function validateSlotRelationships(
  slots: ContentSlot[]
): SlotValidationError[] {
  const errors: SlotValidationError[] = [];

  slots.forEach((slot, index) => {
    // 연계 슬롯 검증
    if (slot.linked_slot_id) {
      const linkedSlot = slots.find(
        (s) => s.id === slot.linked_slot_id
      );
      if (!linkedSlot) {
        errors.push({
          slotIndex: index,
          field: "linked_slot_id",
          message: `연계된 슬롯을 찾을 수 없습니다.`,
          severity: "error",
        });
      } else {
        // 순환 참조 검증
        if (linkedSlot.linked_slot_id === slot.id) {
          errors.push({
            slotIndex: index,
            field: "linked_slot_id",
            message: `슬롯 간 순환 연계가 발견되었습니다.`,
            severity: "error",
          });
        }

        // 연계 타입별 검증
        if (slot.link_type === "after") {
          // "after" 타입: 연계 슬롯보다 뒤에 있어야 함
          if (slot.slot_index <= linkedSlot.slot_index) {
            errors.push({
              slotIndex: index,
              field: "link_type",
              message: `'이후' 연계 슬롯은 연계 대상보다 뒤에 배치되어야 합니다.`,
              severity: "error",
            });
          }
        } else if (slot.link_type === "before") {
          // "before" 타입: 연계 슬롯보다 앞에 있어야 함
          if (slot.slot_index >= linkedSlot.slot_index) {
            errors.push({
              slotIndex: index,
              field: "link_type",
              message: `'이전' 연계 슬롯은 연계 대상보다 앞에 배치되어야 합니다.`,
              severity: "error",
            });
          }
        }
      }
    }

    // 배타 슬롯 검증
    if (slot.exclusive_with && slot.exclusive_with.length > 0) {
      slot.exclusive_with.forEach((excludedId) => {
        const excludedSlot = slots.find((s) => s.id === excludedId);
        if (excludedSlot && excludedSlot.content_id && slot.content_id) {
          errors.push({
            slotIndex: index,
            field: "exclusive_with",
            message: `슬롯 ${index + 1}과 슬롯 ${excludedSlot.slot_index + 1}은 동시에 콘텐츠를 가질 수 없습니다.`,
            severity: "error",
          });
        }
      });
    }
  });

  return errors;
}

/**
 * 과목 제약 검증
 */
export function validateSubjectConstraints(
  slots: ContentSlot[],
  constraints: SubjectConstraint[],
  strictMode: boolean = false
): SlotValidationError[] {
  const results: SlotValidationError[] = [];

  constraints.forEach((constraint) => {
    const matchingSlots = slots.filter(
      (s) =>
        s.subject_category === constraint.subjectCategory &&
        s.content_id !== null
    );

    const count = matchingSlots.length;

    // 최소 개수 검증
    if (count < constraint.minCount) {
      results.push({
        slotIndex: -1,
        field: "subject_category",
        message: `${constraint.subjectCategory} 과목은 최소 ${constraint.minCount}개 이상 필요합니다. (현재: ${count}개)`,
        severity: strictMode ? "error" : "warning",
      });
    }

    // 최대 개수 검증 (있는 경우)
    if (constraint.maxCount && count > constraint.maxCount) {
      results.push({
        slotIndex: -1,
        field: "subject_category",
        message: `${constraint.subjectCategory} 과목은 최대 ${constraint.maxCount}개까지만 가능합니다. (현재: ${count}개)`,
        severity: strictMode ? "error" : "warning",
      });
    }

    // 허용 슬롯 타입 검증
    if (constraint.requiredSlotTypes && constraint.requiredSlotTypes.length > 0) {
      matchingSlots.forEach((slot) => {
        if (slot.slot_type && !constraint.requiredSlotTypes!.includes(slot.slot_type as "book" | "lecture" | "custom")) {
          results.push({
            slotIndex: slot.slot_index,
            field: "slot_type",
            message: `${constraint.subjectCategory} 과목은 ${constraint.requiredSlotTypes!.join(", ")} 타입만 허용됩니다.`,
            severity: "warning",
          });
        }
      });
    }
  });

  return results;
}

/**
 * 콘텐츠 연결 검증
 */
export function validateContentConnections(
  slots: ContentSlot[]
): SlotValidationError[] {
  const errors: SlotValidationError[] = [];

  slots.forEach((slot, index) => {
    // 콘텐츠 ID가 있는 경우
    if (slot.content_id) {
      // book, lecture 타입인 경우 범위 필수
      if (slot.slot_type === "book" || slot.slot_type === "lecture") {
        if (slot.start_range === undefined || slot.end_range === undefined) {
          errors.push({
            slotIndex: index,
            field: "start_range",
            message: `교재/강의 콘텐츠는 범위 설정이 필요합니다.`,
            severity: "error",
          });
        } else if (slot.start_range >= slot.end_range) {
          errors.push({
            slotIndex: index,
            field: "end_range",
            message: `종료 범위(${slot.end_range})는 시작 범위(${slot.start_range})보다 커야 합니다.`,
            severity: "error",
          });
        }
      }

      // 제목 권장
      if (!slot.title) {
        errors.push({
          slotIndex: index,
          field: "title",
          message: `콘텐츠 제목을 입력하는 것이 좋습니다.`,
          severity: "warning",
        });
      }
    }

    // 자습 타입인 경우
    if (slot.slot_type === "self_study") {
      if (!slot.self_study_purpose) {
        errors.push({
          slotIndex: index,
          field: "self_study_purpose",
          message: `자습 목적을 선택해주세요.`,
          severity: "warning",
        });
      }
    }
  });

  return errors;
}

/**
 * 시간 제약 검증
 */
export function validateTimeConstraints(
  slots: ContentSlot[]
): SlotValidationError[] {
  const warnings: SlotValidationError[] = [];

  // 시간 범위 중복 검증
  const fixedTimeSlots = slots.filter(
    (s) => s.time_constraint?.type === "fixed" && s.time_constraint?.preferred_time_range
  );

  fixedTimeSlots.forEach((slot, i) => {
    const range = slot.time_constraint!.preferred_time_range!;

    fixedTimeSlots.slice(i + 1).forEach((otherSlot) => {
      const otherRange = otherSlot.time_constraint!.preferred_time_range!;

      // 시간 범위 겹침 검사
      if (
        range.start_hour < otherRange.end_hour &&
        range.end_hour > otherRange.start_hour
      ) {
        warnings.push({
          slotIndex: slot.slot_index,
          field: "time_constraint",
          message: `슬롯 ${slot.slot_index + 1}과 슬롯 ${otherSlot.slot_index + 1}의 선호 시간이 겹칩니다.`,
          severity: "warning",
        });
      }
    });
  });

  // 시간 유효성 검증
  slots.forEach((slot) => {
    if (slot.time_constraint?.preferred_time_range) {
      const { start_hour, end_hour } = slot.time_constraint.preferred_time_range;
      if (start_hour >= end_hour) {
        warnings.push({
          slotIndex: slot.slot_index,
          field: "time_constraint.preferred_time_range",
          message: `시작 시간(${start_hour}시)은 종료 시간(${end_hour}시)보다 이전이어야 합니다.`,
          severity: "warning",
        });
      }
    }
  });

  return warnings;
}

/**
 * 중복 콘텐츠 검증
 */
export function validateDuplicateContent(
  slots: ContentSlot[]
): SlotValidationError[] {
  const warnings: SlotValidationError[] = [];
  const contentMap = new Map<string, number[]>();

  slots.forEach((slot, index) => {
    if (slot.content_id) {
      const key = `${slot.content_id}-${slot.slot_type}`;
      const existing = contentMap.get(key) || [];
      existing.push(index);
      contentMap.set(key, existing);
    }
  });

  contentMap.forEach((indices, key) => {
    if (indices.length > 1) {
      // 범위가 겹치는지 확인
      const slotsWithSameContent = indices.map((i) => slots[i]);
      for (let i = 0; i < slotsWithSameContent.length; i++) {
        for (let j = i + 1; j < slotsWithSameContent.length; j++) {
          const slot1 = slotsWithSameContent[i];
          const slot2 = slotsWithSameContent[j];

          if (
            slot1.start_range !== undefined &&
            slot1.end_range !== undefined &&
            slot2.start_range !== undefined &&
            slot2.end_range !== undefined
          ) {
            // 범위 겹침 검사
            if (
              slot1.start_range < slot2.end_range &&
              slot1.end_range > slot2.start_range
            ) {
              warnings.push({
                slotIndex: indices[i],
                field: "content_id",
                message: `슬롯 ${indices[i] + 1}과 슬롯 ${indices[j] + 1}의 콘텐츠 범위가 겹칩니다.`,
                severity: "warning",
              });
            }
          }
        }
      }
    }
  });

  return warnings;
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 슬롯 인덱스로 템플릿 찾기
 */
export function findSlotTemplate(
  slotIndex: number,
  templates: SlotTemplate[]
): SlotTemplate | undefined {
  return templates.find((t) => t.slot_index === slotIndex);
}

/**
 * 슬롯이 잠긴 상태인지 확인
 */
export function isSlotLocked(slot: ContentSlot, template?: SlotTemplate): boolean {
  return slot.is_locked === true || template?.is_locked === true;
}

/**
 * 슬롯이 고스트(숨김) 상태인지 확인
 */
export function isSlotGhost(slot: ContentSlot, template?: SlotTemplate): boolean {
  return slot.is_ghost === true || template?.is_ghost === true;
}

/**
 * 슬롯의 완성도 계산 (0-100)
 */
export function calculateSlotCompleteness(slot: ContentSlot): number {
  let score = 0;
  const weights = {
    slot_type: 10,
    subject_category: 15,
    content_id: 25,
    title: 10,
    range: 20,
    subject_type: 10,
    weekly_days: 10,
  };

  if (slot.slot_type) score += weights.slot_type;
  if (slot.subject_category) score += weights.subject_category;
  if (slot.content_id) score += weights.content_id;
  if (slot.title) score += weights.title;
  if (slot.start_range !== undefined && slot.end_range !== undefined) {
    score += weights.range;
  }
  if (slot.subject_type) score += weights.subject_type;
  if (slot.weekly_days !== null && slot.weekly_days !== undefined) {
    score += weights.weekly_days;
  }

  return score;
}

/**
 * 슬롯 배열의 전체 완성도 계산
 */
export function calculateOverallCompleteness(slots: ContentSlot[]): number {
  if (slots.length === 0) return 0;

  const totalScore = slots.reduce(
    (sum, slot) => sum + calculateSlotCompleteness(slot),
    0
  );

  return Math.round(totalScore / slots.length);
}

/**
 * 검증 결과를 사용자 친화적 메시지로 변환
 */
export function formatValidationResults(result: SlotValidationResult): string[] {
  const messages: string[] = [];

  result.errors.forEach((error) => {
    const prefix = error.slotIndex >= 0 ? `[슬롯 ${error.slotIndex + 1}] ` : "";
    messages.push(`❌ ${prefix}${error.message}`);
  });

  result.warnings.forEach((warning) => {
    const prefix = warning.slotIndex >= 0 ? `[슬롯 ${warning.slotIndex + 1}] ` : "";
    messages.push(`⚠️ ${prefix}${warning.message}`);
  });

  return messages;
}
