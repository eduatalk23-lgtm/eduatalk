import { cn } from "@/lib/cn";

/**
 * 필드에 오류 스타일을 적용하는 헬퍼 함수
 * 조건부 클래스명 병합
 */
export function getFieldErrorClasses(
  baseClasses: string,
  hasError: boolean
): string {
  return cn(
    baseClasses,
    hasError && "border-red-500 focus:border-red-500 focus:ring-red-500"
  );
}

