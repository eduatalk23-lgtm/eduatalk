/**
 * useWizardScroll - 위저드 스크롤 관리 훅
 * 
 * 단계 변경 및 검증 실패 시 스크롤 동작을 통합 관리합니다.
 * React Hook Form의 shouldFocus 패턴을 참고하여 구현.
 * 
 * 스크롤 우선순위:
 * 1. 검증 실패 시 오류 필드로 스크롤 (최우선)
 * 2. 단계 변경 시 상단으로 스크롤 (검증 실패가 아닐 때만)
 */

import { useEffect, useRef, useCallback } from "react";
import { WizardStep } from "../PlanGroupWizard";
import { FieldErrors, getFirstErrorFieldId } from "./useWizardValidation";
import { scrollToTop, scrollToField } from "@/lib/utils/scroll";

type UseWizardScrollProps = {
  currentStep: WizardStep;
  fieldErrors: FieldErrors;
};

type UseWizardScrollReturn = {
  handleValidationFailed: () => void;
};

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
 * useWizardScroll 훅
 * 
 * 위저드의 스크롤 동작을 통합 관리합니다.
 * 검증 실패 시 오류 필드로 스크롤하는 것을 최우선으로 처리하고,
 * 그 외의 경우에는 단계 변경 시 상단으로 스크롤합니다.
 */
export function useWizardScroll({
  currentStep,
  fieldErrors,
}: UseWizardScrollProps): UseWizardScrollReturn {
  // 스크롤 우선순위 관리
  // 'error': 검증 실패로 인한 오류 필드 스크롤 예정
  // null: 스크롤 예정 없음
  const scrollPriorityRef = useRef<'error' | null>(null);
  
  // 이전 단계 추적 (단계 변경 감지용)
  const prevStepRef = useRef<WizardStep>(currentStep);

  // 통합 스크롤 효과
  useEffect(() => {
    // 검증 실패 시 오류 필드로 스크롤 (최우선)
    if (scrollPriorityRef.current === 'error' && fieldErrors.size > 0) {
      scrollToFirstError(fieldErrors, currentStep);
      scrollPriorityRef.current = null;
      prevStepRef.current = currentStep;
      return;
    }

    // 단계 변경 시 상단으로 스크롤 (검증 실패가 아닐 때만)
    // currentStep이 실제로 변경되었고, 검증 실패가 아닌 경우에만 실행
    if (prevStepRef.current !== currentStep && scrollPriorityRef.current !== 'error') {
      scrollToTop();
      prevStepRef.current = currentStep;
    }
  }, [currentStep, fieldErrors]);

  // 검증 실패 핸들러
  // 검증 실패 시 호출하여 오류 필드로 스크롤할 것을 예약
  const handleValidationFailed = useCallback(() => {
    scrollPriorityRef.current = 'error';
  }, []);

  return { handleValidationFailed };
}

