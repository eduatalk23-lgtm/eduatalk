/**
 * useWizardScroll - 위저드 스크롤 관리 훅
 *
 * 단계 변경 및 검증 실패 시 스크롤 동작을 통합 관리합니다.
 * React Hook Form의 shouldFocus 패턴을 참고하여 구현.
 *
 * 스크롤 우선순위:
 * 1. 검증 실패 시 오류 필드로 스크롤 (최우선)
 * 2. 뒤로 가기 시 저장된 스크롤 위치로 복구
 * 3. 앞으로 가기 시 상단으로 스크롤
 *
 * 성능 최적화:
 * - Step별 스크롤 위치 저장 (Map)
 * - 뒤로 가기 시 저장된 위치로 복구
 */

import { useEffect, useRef, useCallback } from "react";
import { WizardStep } from "../PlanGroupWizard";
import { FieldErrors, getFirstErrorFieldId } from "./useWizardValidation";
import { scrollToTop, scrollToField } from "@/lib/utils/scroll";

// ============================================================================
// 타입 정의
// ============================================================================

type ScrollPosition = {
  x: number;
  y: number;
};

type ScrollPositionMap = Map<WizardStep, ScrollPosition>;

type UseWizardScrollProps = {
  currentStep: WizardStep;
  fieldErrors: FieldErrors;
  /** 스크롤 위치 복구 활성화 여부 (기본값: true) */
  enableScrollRestore?: boolean;
};

type UseWizardScrollReturn = {
  handleValidationFailed: () => void;
  /** 현재 Step 스크롤 위치 수동 저장 */
  saveCurrentScrollPosition: () => void;
};

// ============================================================================
// 상수
// ============================================================================

/** 스크롤 복구 지연 시간 (렌더링 완료 대기) */
const SCROLL_RESTORE_DELAY_MS = 50;

/**
 * 첫 번째 오류 필드로 스크롤 이동
 */
function scrollToFirstError(fieldErrors: FieldErrors, currentStep: WizardStep): void {
  if (fieldErrors.size === 0) return;

  // 화면 순서에 따라 첫 번째 오류 필드 찾기
  const firstFieldId = getFirstErrorFieldId(fieldErrors, currentStep);
  if (!firstFieldId) return;

  // DOM 업데이트 후 스크롤 실행
  // requestAnimationFrame을 사용하여 브라우저 렌더링 완료 보장
  requestAnimationFrame(() => {
    scrollToField(firstFieldId);
  });
}

/**
 * 현재 스크롤 위치 가져오기
 */
function getCurrentScrollPosition(): ScrollPosition {
  return {
    x: window.scrollX,
    y: window.scrollY,
  };
}

/**
 * 스크롤 위치 설정
 */
function setScrollPosition(position: ScrollPosition): void {
  window.scrollTo({
    left: position.x,
    top: position.y,
    behavior: "instant",
  });
}

/**
 * useWizardScroll 훅
 *
 * 위저드의 스크롤 동작을 통합 관리합니다.
 *
 * 스크롤 우선순위:
 * 1. 검증 실패 시 오류 필드로 스크롤 (최우선)
 * 2. 뒤로 가기 시 저장된 스크롤 위치로 복구
 * 3. 앞으로 가기 시 상단으로 스크롤
 */
export function useWizardScroll({
  currentStep,
  fieldErrors,
  enableScrollRestore = true,
}: UseWizardScrollProps): UseWizardScrollReturn {
  // 스크롤 우선순위 관리
  // 'error': 검증 실패로 인한 오류 필드 스크롤 예정
  // null: 스크롤 예정 없음
  const scrollPriorityRef = useRef<"error" | null>(null);

  // 이전 단계 추적 (단계 변경 감지용)
  const prevStepRef = useRef<WizardStep>(currentStep);

  // Step별 스크롤 위치 저장 (컴포넌트 생명주기 동안 유지)
  const scrollPositionsRef = useRef<ScrollPositionMap>(new Map());

  /**
   * 현재 Step 스크롤 위치 저장
   */
  const saveCurrentScrollPosition = useCallback(() => {
    if (!enableScrollRestore) return;
    const position = getCurrentScrollPosition();
    scrollPositionsRef.current.set(currentStep, position);
  }, [enableScrollRestore, currentStep]);

  /**
   * 저장된 스크롤 위치로 복구
   */
  const restoreScrollPosition = useCallback(
    (step: WizardStep): void => {
      if (!enableScrollRestore) return;

      const savedPosition = scrollPositionsRef.current.get(step);
      if (savedPosition) {
        setTimeout(() => {
          setScrollPosition(savedPosition);
        }, SCROLL_RESTORE_DELAY_MS);
      } else {
        // 저장된 위치가 없으면 상단으로
        scrollToTop();
      }
    },
    [enableScrollRestore]
  );

  // 통합 스크롤 효과
  useEffect(() => {
    // 검증 실패 시 오류 필드로 스크롤 (최우선)
    if (scrollPriorityRef.current === "error" && fieldErrors.size > 0) {
      scrollToFirstError(fieldErrors, currentStep);
      scrollPriorityRef.current = null;
      prevStepRef.current = currentStep;
      return;
    }

    // 단계 변경 시 스크롤 처리
    if (prevStepRef.current !== currentStep && scrollPriorityRef.current !== "error") {
      const prevStep = prevStepRef.current;

      // 이전 Step 스크롤 위치 저장
      if (enableScrollRestore) {
        scrollPositionsRef.current.set(prevStep, getCurrentScrollPosition());
      }

      // 이동 방향에 따라 처리
      if (currentStep < prevStep) {
        // 뒤로 가기: 저장된 위치 복구
        restoreScrollPosition(currentStep);
      } else {
        // 앞으로 가기: 상단으로 스크롤
        scrollToTop();
      }

      prevStepRef.current = currentStep;
    }
  }, [currentStep, fieldErrors, enableScrollRestore, restoreScrollPosition]);

  // 검증 실패 핸들러
  // 검증 실패 시 호출하여 오류 필드로 스크롤할 것을 예약
  const handleValidationFailed = useCallback(() => {
    scrollPriorityRef.current = "error";
  }, []);

  return {
    handleValidationFailed,
    saveCurrentScrollPosition,
  };
}

