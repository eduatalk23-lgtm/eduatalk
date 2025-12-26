/**
 * useWizardKeyboardNavigation - 위저드 키보드 네비게이션 훅
 *
 * Phase 4 UX 개선: 접근성
 * 키보드 단축키를 통한 위저드 네비게이션을 지원합니다.
 *
 * 단축키:
 * - Alt + → : 다음 단계
 * - Alt + ← : 이전 단계
 * - Alt + 1~7 : 특정 단계로 이동 (유효한 경우)
 * - Escape : 취소 확인
 */

import { useEffect, useCallback } from "react";
import type { WizardStep } from "../PlanGroupWizard";

type UseWizardKeyboardNavigationProps = {
  /** 현재 단계 */
  currentStep: WizardStep;
  /** 최대 도달 가능 단계 */
  maxReachedStep?: WizardStep;
  /** 다음 단계로 이동 (비동기) */
  onNext: () => Promise<void> | void;
  /** 이전 단계로 이동 */
  onBack: () => void;
  /** 특정 단계로 이동 */
  onSetStep?: (step: WizardStep) => void;
  /** 취소 핸들러 */
  onCancel?: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
};

/**
 * useWizardKeyboardNavigation
 *
 * 위저드 단계 네비게이션을 위한 키보드 단축키를 제공합니다.
 */
export function useWizardKeyboardNavigation({
  currentStep,
  maxReachedStep = currentStep,
  onNext,
  onBack,
  onSetStep,
  onCancel,
  disabled = false,
}: UseWizardKeyboardNavigationProps): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      // 입력 필드에서는 단축키 비활성화
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        // Escape만 허용
        if (event.key !== "Escape") return;
      }

      // Alt + 화살표 키 네비게이션
      if (event.altKey) {
        switch (event.key) {
          case "ArrowRight":
            event.preventDefault();
            if (currentStep < 7) {
              onNext();
            }
            break;

          case "ArrowLeft":
            event.preventDefault();
            if (currentStep > 1) {
              onBack();
            }
            break;

          // Alt + 숫자키로 특정 단계 이동
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
            if (onSetStep) {
              const targetStep = parseInt(event.key, 10) as WizardStep;
              // 이미 도달한 단계까지만 이동 가능
              if (targetStep <= maxReachedStep) {
                event.preventDefault();
                onSetStep(targetStep);
              }
            }
            break;
        }
      }

      // Escape로 취소
      if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
      }
    },
    [currentStep, maxReachedStep, onNext, onBack, onSetStep, onCancel, disabled]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * 키보드 단축키 안내 컴포넌트용 데이터
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: ["Alt", "→"], description: "다음 단계로 이동" },
  { keys: ["Alt", "←"], description: "이전 단계로 이동" },
  { keys: ["Alt", "1-7"], description: "특정 단계로 이동" },
  { keys: ["Esc"], description: "취소" },
] as const;
