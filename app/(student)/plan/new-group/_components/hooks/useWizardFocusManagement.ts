/**
 * useWizardFocusManagement - 위저드 포커스 관리 훅
 *
 * Phase 4 UX 개선: 접근성
 * 단계 전환 시 적절한 요소로 포커스를 이동시킵니다.
 */

import { useEffect, useRef, useCallback } from "react";
import type { WizardStep } from "../PlanGroupWizard";

type UseWizardFocusManagementProps = {
  /** 현재 단계 */
  currentStep: WizardStep;
  /** 이전 단계 (변경 감지용) */
  previousStep?: WizardStep;
  /** 포커스 대상 선택자 (기본값: 첫 번째 입력 필드) */
  focusTarget?: string;
  /** 활성화 여부 */
  enabled?: boolean;
};

type UseWizardFocusManagementReturn = {
  /** 컨테이너 ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 수동 포커스 이동 */
  focusFirstInput: () => void;
  /** 제목으로 포커스 이동 */
  focusTitle: () => void;
};

/**
 * useWizardFocusManagement
 *
 * 단계 전환 시 자동으로 적절한 요소로 포커스를 이동시킵니다.
 * - 다음 단계로 이동 시: 첫 번째 입력 필드 또는 제목
 * - 에러 발생 시: 첫 번째 에러 필드
 */
export function useWizardFocusManagement({
  currentStep,
  previousStep,
  focusTarget,
  enabled = true,
}: UseWizardFocusManagementProps): UseWizardFocusManagementReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<WizardStep | undefined>(previousStep);

  /**
   * 첫 번째 입력 필드로 포커스 이동
   */
  const focusFirstInput = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // 커스텀 타겟이 있으면 사용
    if (focusTarget) {
      const target = container.querySelector(focusTarget) as HTMLElement;
      if (target) {
        target.focus();
        return;
      }
    }

    // 포커스 가능한 요소 우선순위
    const focusableSelectors = [
      'input:not([type="hidden"]):not([disabled])',
      "select:not([disabled])",
      "textarea:not([disabled])",
      'button:not([disabled]):not([type="submit"])',
      "[tabindex]:not([tabindex='-1'])",
    ];

    for (const selector of focusableSelectors) {
      const element = container.querySelector(selector) as HTMLElement;
      if (element) {
        // 약간의 지연을 두어 렌더링 완료 후 포커스
        requestAnimationFrame(() => {
          element.focus();
        });
        return;
      }
    }
  }, [focusTarget]);

  /**
   * 제목으로 포커스 이동 (스크린 리더용)
   */
  const focusTitle = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // h1, h2, h3 순서로 제목 찾기
    const headingSelectors = ["h1", "h2", "h3", "[role='heading']"];

    for (const selector of headingSelectors) {
      const heading = container.querySelector(selector) as HTMLElement;
      if (heading) {
        // tabindex를 임시로 설정하여 포커스 가능하게 함
        const hadTabIndex = heading.hasAttribute("tabindex");
        const originalTabIndex = heading.getAttribute("tabindex");

        heading.setAttribute("tabindex", "-1");
        heading.focus();

        // 원래 상태로 복원
        if (!hadTabIndex) {
          heading.removeAttribute("tabindex");
        } else if (originalTabIndex) {
          heading.setAttribute("tabindex", originalTabIndex);
        }
        return;
      }
    }
  }, []);

  // 단계 변경 감지 및 포커스 이동
  useEffect(() => {
    if (!enabled) return;

    const prevStep = previousStepRef.current;
    previousStepRef.current = currentStep;

    // 단계가 변경되었을 때만 포커스 이동
    if (prevStep !== undefined && prevStep !== currentStep) {
      // 약간의 지연을 두어 새 컴포넌트 렌더링 완료 후 포커스
      const timeoutId = setTimeout(() => {
        // 다음 단계로 이동 시 제목으로 포커스 (스크린 리더 사용자를 위해)
        // 이전 단계로 이동 시 첫 입력으로 포커스
        if (currentStep > prevStep) {
          focusTitle();
        } else {
          focusFirstInput();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [currentStep, enabled, focusFirstInput, focusTitle]);

  return {
    containerRef,
    focusFirstInput,
    focusTitle,
  };
}

/**
 * 에러 필드로 포커스 이동 헬퍼
 */
export function focusErrorField(fieldName: string): void {
  // 에러 필드 찾기
  const selectors = [
    `[name="${fieldName}"]`,
    `[id="${fieldName}"]`,
    `[data-field="${fieldName}"]`,
    `#${fieldName}`,
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    } catch {
      // 잘못된 선택자 무시
    }
  }
}
