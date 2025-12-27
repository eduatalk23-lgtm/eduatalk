"use client";

import React, { memo, useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  type ContentSlot,
  type SlotTemplate,
  getSlotCompletionStatus,
} from "@/lib/types/content-selection";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock,
  LockOpen,
} from "lucide-react";

// ============================================================================
// 로컬 타입 정의 (content-selection 타입과 호환)
// ============================================================================

interface SlotValidationError {
  slotIndex: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface SlotValidationResult {
  isValid: boolean;
  errors: SlotValidationError[];
  warnings: SlotValidationError[];
}

interface SubjectConstraint {
  subjectCategory: string;
  minCount: number;
  maxCount?: number;
}

// ============================================================================
// 로컬 검증 함수들
// ============================================================================

/**
 * 슬롯 완성도 계산 (0-100)
 */
function calculateSlotCompleteness(slot: ContentSlot): number {
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
function calculateOverallCompleteness(slots: ContentSlot[]): number {
  if (slots.length === 0) return 0;

  const totalScore = slots.reduce(
    (sum, slot) => sum + calculateSlotCompleteness(slot),
    0
  );

  return Math.round(totalScore / slots.length);
}

/**
 * 슬롯 검증 수행
 */
function validateSlots(
  slots: ContentSlot[],
  templates?: SlotTemplate[],
  constraints?: SubjectConstraint[]
): SlotValidationResult {
  const errors: SlotValidationError[] = [];
  const warnings: SlotValidationError[] = [];

  slots.forEach((slot, index) => {
    // 필수 슬롯 검증
    if (templates) {
      const template = templates.find((t) => t.slot_index === slot.slot_index);
      if (template?.is_required && !template.is_ghost) {
        if (!slot.content_id && slot.slot_type !== "self_study" && slot.slot_type !== "test") {
          errors.push({
            slotIndex: index,
            field: "content_id",
            message: `슬롯 ${index + 1}에 콘텐츠를 연결해주세요.`,
            severity: "error",
          });
        }
      }
    }

    // 콘텐츠 연결 검증
    if (slot.content_id) {
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
            message: `종료 범위는 시작 범위보다 커야 합니다.`,
            severity: "error",
          });
        }
      }
    }

    // 자습 타입 검증
    if (slot.slot_type === "self_study" && !slot.self_study_purpose) {
      warnings.push({
        slotIndex: index,
        field: "self_study_purpose",
        message: `자습 목적을 선택해주세요.`,
        severity: "warning",
      });
    }
  });

  // 과목 제약 검증
  if (constraints && constraints.length > 0) {
    constraints.forEach((constraint) => {
      const matchingSlots = slots.filter(
        (s) =>
          s.subject_category === constraint.subjectCategory &&
          s.content_id !== null
      );

      if (matchingSlots.length < constraint.minCount) {
        warnings.push({
          slotIndex: -1,
          field: "subject_category",
          message: `${constraint.subjectCategory} 과목은 최소 ${constraint.minCount}개 이상 필요합니다.`,
          severity: "warning",
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// 타입 정의
// ============================================================================

interface SlotValidationStatusProps {
  slots: ContentSlot[];
  slotTemplates?: SlotTemplate[];
  subjectConstraints?: SubjectConstraint[];
  strictMode?: boolean;
  showDetails?: boolean;
  className?: string;
}

interface SlotCompletenessIndicatorProps {
  slot: ContentSlot;
  size?: "sm" | "md";
  className?: string;
}

interface ValidationMessageListProps {
  errors: SlotValidationError[];
  warnings: SlotValidationError[];
  maxItems?: number;
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

function SlotValidationStatusComponent({
  slots,
  slotTemplates,
  subjectConstraints,
  strictMode = false,
  showDetails = true,
  className,
}: SlotValidationStatusProps) {
  // 검증 실행
  const validationResult = useMemo<SlotValidationResult>(() => {
    return validateSlots(slots, slotTemplates, subjectConstraints);
  }, [slots, slotTemplates, subjectConstraints]);

  // 전체 완성도 계산
  const overallCompleteness = useMemo(() => {
    return calculateOverallCompleteness(slots);
  }, [slots]);

  // 상태에 따른 스타일 결정
  const statusConfig = useMemo(() => {
    if (validationResult.errors.length > 0) {
      return {
        icon: AlertCircle,
        color: "text-red-500",
        bg: "bg-red-50 dark:bg-red-900/20",
        border: "border-red-200 dark:border-red-800",
        label: "오류 있음",
      };
    }
    if (validationResult.warnings.length > 0) {
      return {
        icon: AlertTriangle,
        color: "text-amber-500",
        bg: "bg-amber-50 dark:bg-amber-900/20",
        border: "border-amber-200 dark:border-amber-800",
        label: "주의 필요",
      };
    }
    if (overallCompleteness < 100) {
      return {
        icon: Info,
        color: "text-blue-500",
        bg: "bg-blue-50 dark:bg-blue-900/20",
        border: "border-blue-200 dark:border-blue-800",
        label: "진행 중",
      };
    }
    return {
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-900/20",
      border: "border-green-200 dark:border-green-800",
      label: "완료",
    };
  }, [validationResult, overallCompleteness]);

  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        statusConfig.bg,
        statusConfig.border,
        className
      )}
    >
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-5 w-5", statusConfig.color)} />
          <span className="font-medium text-gray-800 dark:text-gray-200">
            슬롯 설정 상태
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              statusConfig.bg,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          완성도: {overallCompleteness}%
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn(
            "h-full transition-all duration-300",
            overallCompleteness === 100
              ? "bg-green-500"
              : overallCompleteness >= 50
                ? "bg-blue-500"
                : "bg-amber-500"
          )}
          style={{ width: `${overallCompleteness}%` }}
        />
      </div>

      {/* 슬롯별 완성도 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {slots.map((slot, index) => (
          <SlotCompletenessIndicator key={slot.id || index} slot={slot} />
        ))}
      </div>

      {/* 상세 메시지 */}
      {showDetails && (
        <ValidationMessageList
          errors={validationResult.errors}
          warnings={validationResult.warnings}
          maxItems={5}
        />
      )}
    </div>
  );
}

// ============================================================================
// 하위 컴포넌트
// ============================================================================

function SlotCompletenessIndicatorComponent({
  slot,
  size = "sm",
  className,
}: SlotCompletenessIndicatorProps) {
  const completeness = useMemo(() => {
    return calculateSlotCompleteness(slot);
  }, [slot]);

  const sizeClasses = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";

  const statusColor = useMemo(() => {
    if (completeness === 100) return "bg-green-500 text-white";
    if (completeness >= 50) return "bg-blue-500 text-white";
    if (completeness > 0) return "bg-amber-500 text-white";
    return "bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300";
  }, [completeness]);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full font-medium",
        sizeClasses,
        statusColor,
        slot.is_locked && "ring-2 ring-amber-400 ring-offset-1",
        className
      )}
      title={`슬롯 ${slot.slot_index + 1}: ${completeness}% 완료${slot.is_locked ? " (잠금)" : ""}`}
    >
      {slot.slot_index + 1}
      {slot.is_locked && (
        <Lock className="absolute -right-1 -top-1 h-3 w-3 text-amber-600" />
      )}
    </div>
  );
}

function ValidationMessageListComponent({
  errors,
  warnings,
  maxItems = 5,
}: ValidationMessageListProps) {
  const allMessages = useMemo(() => {
    return [
      ...errors.map((e) => ({ ...e, type: "error" as const })),
      ...warnings.map((w) => ({ ...w, type: "warning" as const })),
    ].slice(0, maxItems);
  }, [errors, warnings, maxItems]);

  if (allMessages.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        <span>모든 슬롯이 올바르게 설정되었습니다.</span>
      </div>
    );
  }

  const remainingCount =
    errors.length + warnings.length - allMessages.length;

  return (
    <div className="space-y-2">
      {allMessages.map((msg, index) => (
        <div
          key={`${msg.slotIndex}-${msg.field}-${index}`}
          className={cn(
            "flex items-start gap-2 rounded-md p-2 text-sm",
            msg.type === "error"
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          )}
        >
          {msg.type === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <div>
            {msg.slotIndex >= 0 && (
              <span className="font-medium">
                슬롯 {msg.slotIndex + 1}:{" "}
              </span>
            )}
            {msg.message}
          </div>
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          +{remainingCount}개의 추가 메시지가 있습니다.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 슬롯 잠금 인디케이터
// ============================================================================

interface SlotLockIndicatorProps {
  isLocked: boolean;
  lockMessage?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function SlotLockIndicator({
  isLocked,
  lockMessage,
  size = "sm",
  className,
}: SlotLockIndicatorProps) {
  const sizeClasses = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const Icon = isLocked ? Lock : LockOpen;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        isLocked ? "text-amber-600" : "text-gray-400",
        className
      )}
      title={
        isLocked
          ? lockMessage || "이 슬롯은 템플릿에 의해 잠겨있습니다."
          : "수정 가능"
      }
    >
      <Icon className={sizeClasses} />
      {lockMessage && isLocked && (
        <span className="max-w-[150px] truncate text-xs">{lockMessage}</span>
      )}
    </div>
  );
}

// ============================================================================
// 슬롯 완성 상태 배지
// ============================================================================

interface SlotCompletionBadgeProps {
  slot: ContentSlot;
  showLabel?: boolean;
  className?: string;
}

export function SlotCompletionBadge({
  slot,
  showLabel = false,
  className,
}: SlotCompletionBadgeProps) {
  const completeness = calculateSlotCompleteness(slot);

  const config = useMemo(() => {
    if (completeness === 100) {
      return {
        icon: CheckCircle2,
        color: "text-green-600 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-900/30",
        label: "완료",
      };
    }
    if (completeness >= 50) {
      return {
        icon: Info,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-900/30",
        label: "진행 중",
      };
    }
    if (completeness > 0) {
      return {
        icon: AlertTriangle,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-900/30",
        label: "설정 필요",
      };
    }
    return {
      icon: AlertCircle,
      color: "text-gray-500 dark:text-gray-400",
      bg: "bg-gray-100 dark:bg-gray-800",
      label: "미설정",
    };
  }, [completeness]);

  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        config.bg,
        config.color,
        className
      )}
      title={`${completeness}% 완료`}
    >
      <StatusIcon className="h-3.5 w-3.5" />
      {showLabel && <span className="text-xs font-medium">{config.label}</span>}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export const SlotValidationStatus = memo(SlotValidationStatusComponent);
export const SlotCompletenessIndicator = memo(SlotCompletenessIndicatorComponent);
export const ValidationMessageList = memo(ValidationMessageListComponent);
