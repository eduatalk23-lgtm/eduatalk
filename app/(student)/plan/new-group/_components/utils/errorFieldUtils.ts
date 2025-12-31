/**
 * UX-1: 에러 필드 시각적 강조 유틸리티
 *
 * 에러가 있는 필드에 시각적 강조를 제공하고,
 * 첫 에러 필드로 자동 스크롤하는 기능을 제공합니다.
 */

import { cn } from "@/lib/cn";

/**
 * 에러 필드 스타일 클래스
 */
export const ERROR_FIELD_CLASSES = {
  /** 에러 테두리 */
  border: "border-error-500 focus:border-error-500 focus:ring-error-500",
  /** 에러 배경 */
  background: "bg-error-50",
  /** 에러 테두리 + 배경 */
  full: "border-error-500 bg-error-50 focus:border-error-500 focus:ring-error-500",
} as const;

/**
 * 에러 상태에 따른 필드 클래스 반환
 */
export function getErrorFieldClass(
  hasError: boolean,
  variant: keyof typeof ERROR_FIELD_CLASSES = "full"
): string {
  return hasError ? ERROR_FIELD_CLASSES[variant] : "";
}

/**
 * 에러 필드 클래스를 기존 클래스와 병합
 */
export function withErrorClass(
  baseClass: string,
  hasError: boolean,
  variant: keyof typeof ERROR_FIELD_CLASSES = "full"
): string {
  return cn(baseClass, hasError && ERROR_FIELD_CLASSES[variant]);
}

/**
 * 필드 ID를 data-field-id 속성으로 변환
 * 스크롤 타겟팅에 사용
 */
export function getFieldDataAttribute(fieldId: string): Record<string, string> {
  return { "data-field-id": fieldId };
}

/**
 * 스크롤 완료 후 요소에 포커스 설정
 *
 * IntersectionObserver를 사용하여 스크롤 완료를 정확히 감지합니다.
 * setTimeout 대비 장점:
 * - 정확한 스크롤 완료 시점 감지
 * - 디바이스/브라우저 성능과 무관하게 동작
 * - 불필요한 지연 제거
 *
 * @param element - 포커스할 요소
 * @param targetElement - 스크롤 타겟 요소 (교차 관찰용)
 */
function focusAfterScrollComplete(
  element: HTMLElement,
  targetElement: Element
): void {
  // IntersectionObserver 지원 확인 (SSR 호환)
  if (typeof IntersectionObserver === "undefined") {
    // Fallback: 300ms 후 포커스
    setTimeout(() => element.focus(), 300);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      // 요소가 화면에 보이면 (threshold 충족)
      if (entry.isIntersecting) {
        // 관찰 중단
        observer.disconnect();
        // requestAnimationFrame으로 다음 페인트 후 포커스
        requestAnimationFrame(() => {
          element.focus();
        });
      }
    },
    {
      // 요소의 50% 이상이 보이면 트리거
      threshold: 0.5,
      // 루트를 null로 설정하면 viewport 기준
      root: null,
    }
  );

  observer.observe(targetElement);

  // 안전장치: 1초 후에도 교차하지 않으면 강제 포커스 및 정리
  setTimeout(() => {
    observer.disconnect();
    // 요소가 아직 포커스되지 않았다면 포커스
    if (document.activeElement !== element) {
      element.focus();
    }
  }, 1000);
}

/**
 * 첫 번째 에러 필드로 자동 스크롤
 *
 * 성능 최적화:
 * - IntersectionObserver 기반 스크롤 완료 감지
 * - 300ms 고정 지연 제거
 *
 * @param fieldErrors - 필드 에러 맵
 * @param options - 스크롤 옵션
 */
export function scrollToFirstErrorField(
  fieldErrors: Map<string, string>,
  options: ScrollIntoViewOptions = { behavior: "smooth", block: "center" }
): void {
  if (fieldErrors.size === 0) return;

  const firstErrorField = fieldErrors.keys().next().value;
  if (!firstErrorField) return;

  // data-field-id 속성으로 요소 찾기
  const element = document.querySelector(
    `[data-field-id="${firstErrorField}"]`
  );

  if (element) {
    element.scrollIntoView(options);

    // 포커스 가능한 요소라면 포커스도 설정
    if (element instanceof HTMLElement) {
      const focusableChild = element.querySelector<HTMLElement>(
        'input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableChild) {
        focusAfterScrollComplete(focusableChild, element);
      } else if (element.tabIndex !== -1) {
        focusAfterScrollComplete(element, element);
      }
    }
  }
}

/**
 * 에러 필드 래퍼 컴포넌트용 props
 */
export interface ErrorFieldWrapperProps {
  /** 필드 ID (에러 맵의 키) */
  fieldId: string;
  /** 에러 여부 */
  hasError: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 에러 요약 표시를 위한 헬퍼
 */
export function formatErrorSummary(fieldErrors: Map<string, string>): string[] {
  return Array.from(fieldErrors.entries()).map(
    ([field, error]) => `${field}: ${error}`
  );
}

/**
 * 필드별 에러 우선순위 (스크롤 순서 결정)
 * 낮은 숫자가 높은 우선순위
 */
const FIELD_PRIORITY: Record<string, number> = {
  // Step 1
  plan_name: 1,
  plan_purpose: 2,
  period_start: 3,
  period_end: 4,
  block_set_id: 5,
  // Step 2
  study_days: 10,
  review_days: 11,
  exclusions: 12,
  academy_schedules: 13,
  // Step 4
  student_contents: 20,
  // Step 5
  content_allocations: 30,
  subject_allocations: 31,
};

/**
 * 에러 필드를 우선순위에 따라 정렬
 */
export function sortErrorFieldsByPriority(
  fieldErrors: Map<string, string>
): [string, string][] {
  return Array.from(fieldErrors.entries()).sort(([a], [b]) => {
    const priorityA = FIELD_PRIORITY[a] ?? 100;
    const priorityB = FIELD_PRIORITY[b] ?? 100;
    return priorityA - priorityB;
  });
}

/**
 * 가장 높은 우선순위의 에러 필드 반환
 */
export function getHighestPriorityErrorField(
  fieldErrors: Map<string, string>
): string | null {
  const sorted = sortErrorFieldsByPriority(fieldErrors);
  return sorted.length > 0 ? sorted[0][0] : null;
}
