"use client";

/**
 * SimpleCompleteCheckbox - 간단 완료 체크박스 컴포넌트
 *
 * 타이머 없이 체크박스만으로 플랜을 완료할 수 있는 컴포넌트입니다.
 * Optimistic UI 패턴을 사용하여 즉각적인 피드백을 제공합니다.
 */

import { useState, useTransition, useCallback } from "react";
import { cn } from "@/lib/cn";
import {
  simpleCompletePlan,
  simpleCompleteAdHocPlan,
} from "@/lib/domains/plan/actions/simpleComplete";
import { Check, Loader2 } from "lucide-react";

// ============================================
// 타입 정의
// ============================================

export type CheckboxSize = "sm" | "md" | "lg";
export type PlanType = "student_plan" | "ad_hoc_plan";

export interface SimpleCompleteCheckboxProps {
  /** 플랜 ID */
  planId: string;
  /** 플랜 타입 */
  planType?: PlanType;
  /** 완료 여부 */
  isCompleted: boolean;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 완료 후 콜백 */
  onComplete?: (completedAt: string) => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: string) => void;
  /** 크기 */
  size?: CheckboxSize;
  /** 추가 클래스 */
  className?: string;
  /** 라벨 (접근성) */
  label?: string;
}

// ============================================
// 상수
// ============================================

const SIZE_CLASSES: Record<CheckboxSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const ICON_CLASSES: Record<CheckboxSize, string> = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

// ============================================
// 컴포넌트
// ============================================

export function SimpleCompleteCheckbox({
  planId,
  planType = "student_plan",
  isCompleted,
  disabled = false,
  onComplete,
  onError,
  size = "md",
  className,
  label,
}: SimpleCompleteCheckboxProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticCompleted, setOptimisticCompleted] = useState(isCompleted);

  // 완료 핸들러
  const handleComplete = useCallback(() => {
    if (disabled || isPending || optimisticCompleted) return;

    // Optimistic update
    setOptimisticCompleted(true);

    startTransition(async () => {
      const action =
        planType === "ad_hoc_plan"
          ? simpleCompleteAdHocPlan
          : simpleCompletePlan;

      const result = await action({ planId });

      if (result.success && result.completedAt) {
        onComplete?.(result.completedAt);
      } else {
        // Rollback on error
        setOptimisticCompleted(false);
        onError?.(result.error || "Failed to complete");
      }
    });
  }, [
    disabled,
    isPending,
    optimisticCompleted,
    planId,
    planType,
    onComplete,
    onError,
  ]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleComplete();
      }
    },
    [handleComplete]
  );

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticCompleted}
      aria-label={label || (optimisticCompleted ? "완료됨" : "완료하기")}
      disabled={disabled || isPending}
      onClick={handleComplete}
      onKeyDown={handleKeyDown}
      className={cn(
        // 기본 스타일
        "inline-flex items-center justify-center rounded border-2 transition-all duration-150",
        SIZE_CLASSES[size],
        // 완료 상태
        optimisticCompleted
          ? "border-green-500 bg-green-500 text-white"
          : "border-gray-300 bg-white hover:border-green-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-green-500",
        // 비활성화/로딩 상태
        (disabled || isPending) && "cursor-not-allowed opacity-50",
        // 포커스 스타일
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2",
        className
      )}
    >
      {/* 완료 체크 아이콘 */}
      {optimisticCompleted && !isPending && (
        <Check className={ICON_CLASSES[size]} strokeWidth={3} />
      )}

      {/* 로딩 인디케이터 */}
      {isPending && (
        <Loader2
          className={cn(ICON_CLASSES[size], "animate-spin")}
          strokeWidth={2}
        />
      )}
    </button>
  );
}

// ============================================
// 메모 입력 포함 버전
// ============================================

export interface SimpleCompleteWithNoteProps
  extends Omit<SimpleCompleteCheckboxProps, "onComplete"> {
  /** 메모 입력 활성화 */
  showNoteInput?: boolean;
  /** 완료 후 콜백 (메모 포함) */
  onComplete?: (completedAt: string, note?: string) => void;
}

export function SimpleCompleteWithNote({
  planId,
  planType = "student_plan",
  isCompleted,
  disabled = false,
  showNoteInput = false,
  onComplete,
  onError,
  size = "md",
  className,
}: SimpleCompleteWithNoteProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticCompleted, setOptimisticCompleted] = useState(isCompleted);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  const handleComplete = useCallback(
    (noteText?: string) => {
      if (disabled || isPending || optimisticCompleted) return;

      setOptimisticCompleted(true);
      setShowNote(false);

      startTransition(async () => {
        const action =
          planType === "ad_hoc_plan"
            ? simpleCompleteAdHocPlan
            : simpleCompletePlan;

        const result = await action({ planId, note: noteText });

        if (result.success && result.completedAt) {
          onComplete?.(result.completedAt, noteText);
        } else {
          setOptimisticCompleted(false);
          onError?.(result.error || "Failed to complete");
        }
      });
    },
    [
      disabled,
      isPending,
      optimisticCompleted,
      planId,
      planType,
      onComplete,
      onError,
    ]
  );

  const handleClick = useCallback(() => {
    if (optimisticCompleted) return;

    if (showNoteInput) {
      setShowNote(true);
    } else {
      handleComplete();
    }
  }, [optimisticCompleted, showNoteInput, handleComplete]);

  // 메모 입력 UI
  if (showNote) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (선택)"
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 focus:border-green-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleComplete(note);
            } else if (e.key === "Escape") {
              setShowNote(false);
              setNote("");
            }
          }}
        />
        <button
          onClick={() => handleComplete(note)}
          className="rounded bg-green-500 px-2 py-1 text-sm text-white hover:bg-green-600"
        >
          완료
        </button>
        <button
          onClick={() => {
            setShowNote(false);
            setNote("");
          }}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          취소
        </button>
      </div>
    );
  }

  // 일반 체크박스 UI
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticCompleted}
      aria-label={optimisticCompleted ? "완료됨" : "완료하기"}
      disabled={disabled || isPending}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center rounded border-2 transition-all duration-150",
        SIZE_CLASSES[size],
        optimisticCompleted
          ? "border-green-500 bg-green-500 text-white"
          : "border-gray-300 bg-white hover:border-green-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-green-500",
        (disabled || isPending) && "cursor-not-allowed opacity-50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2",
        className
      )}
    >
      {optimisticCompleted && !isPending && (
        <Check className={ICON_CLASSES[size]} strokeWidth={3} />
      )}
      {isPending && (
        <Loader2
          className={cn(ICON_CLASSES[size], "animate-spin")}
          strokeWidth={2}
        />
      )}
    </button>
  );
}

// ============================================
// 기본 export
// ============================================

export default SimpleCompleteCheckbox;
