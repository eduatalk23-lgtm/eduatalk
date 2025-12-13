"use client";

type FieldErrorProps = {
  error?: string;
  id?: string;
};

/**
 * 필드 오류 메시지 표시를 위한 재사용 가능한 컴포넌트
 * 일관된 스타일링 및 접근성 속성 적용
 */
export function FieldError({ error, id }: FieldErrorProps) {
  if (!error) return null;

  return (
    <p
      id={id}
      className="text-xs text-red-600 mt-1"
      role="alert"
      aria-live="polite"
    >
      {error}
    </p>
  );
}

