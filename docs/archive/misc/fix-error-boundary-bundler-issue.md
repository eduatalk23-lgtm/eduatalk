# Error Boundary Bundler 이슈 수정

## 문제 상황

### 에러 메시지
```
Error: Could not find the module "[project]/app/(admin)/error.tsx#default" in the React Client Manifest. 
This is probably a bug in the React Server Components bundler.
```

### 발생 위치
- `app/(admin)/error.tsx`
- Next.js 16의 React Server Components bundler 관련

### 원인 분석
1. **Next.js 16의 React Server Components bundler 버그**: Error Boundary 파일이 React Client Manifest에 포함되지 않는 문제
2. **캐시 문제**: Next.js 빌드 캐시가 오래된 상태일 수 있음
3. **파일 구조 문제**: Error Boundary 파일의 export 방식이나 구조에 문제가 있을 수 있음

## 해결 방법

### 1. 파일 수정
- `interface`를 `type`으로 변경 (더 명확한 타입 정의)
- 파일을 재작성하여 bundler가 인식하도록 함

### 2. 캐시 클리어
```bash
rm -rf .next
```

### 3. 파일 구조 확인
Error Boundary는 반드시:
- `"use client"` 지시어 필요
- `export default function Error` 형식 필요
- `error`와 `reset` props 필요

## 적용된 수정 사항

### 파일: `app/(admin)/error.tsx`

**변경 전:**
```tsx
interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}
```

**변경 후:**
```tsx
type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};
```

## 추가 조사 필요 사항

1. **Next.js 16 버그**: 공식 이슈 트래커 확인 필요
2. **다른 error.tsx 파일**: 동일한 문제가 있는지 확인
3. **빌드 프로세스**: 프로덕션 빌드에서도 동일한 문제가 발생하는지 확인

## 참고 자료

- [Next.js Error Handling](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

## 작업 일시
2025-01-07

