# withErrorHandling 타입 정의 개선

## 작업 일시
2025-01-XX

## 문제점
`withErrorHandling` 함수의 타입 정의가 `T extends (...args: unknown[]) => Promise<unknown>`로 제한되어 있어, 구체적인 함수 타입을 받을 수 없었습니다.

## 수정 내용

### 이전 타입 정의
```typescript
export function withErrorHandling<
  T extends (...args: unknown[]) => Promise<unknown>
>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    // ...
  }) as T;
}
```

### 개선된 타입 정의
```typescript
export function withErrorHandling<
  TArgs extends readonly unknown[],
  TReturn
>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    // ...
  };
}
```

## 개선 사항

1. **타입 보존**: 함수의 매개변수 타입(`TArgs`)과 반환 타입(`TReturn`)을 완전히 보존
2. **튜플 타입 지원**: `readonly unknown[]`를 사용하여 튜플 타입도 지원
3. **타입 추론 개선**: TypeScript가 함수 타입을 더 정확하게 추론할 수 있음

## 참고

- TypeScript 서버가 이전 타입을 캐시하고 있을 수 있으므로, IDE를 재시작하거나 TypeScript 서버를 재시작해야 할 수 있습니다.
- 이 변경으로 `withErrorHandling`을 사용하는 모든 함수에서 타입 안전성이 향상됩니다.

