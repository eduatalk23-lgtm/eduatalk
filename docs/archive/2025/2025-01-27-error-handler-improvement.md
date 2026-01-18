# 에러 핸들러 개선

## 문제 상황

`lib/errors/handler.ts`의 339번째 줄에서 다음과 같은 에러가 발생했습니다:

```
작업을 완료하는 중 오류가 발생했습니다: 알 수 없는 오류가 발생했습니다.
```

## 원인 분석

1. **`normalizeError` 함수의 문제**
   - `Error`가 아닌 값(문자열, 숫자, 객체 등)이 throw된 경우 `isUserFacing: false`로 설정
   - 이로 인해 사용자에게 에러 정보가 제대로 전달되지 않음

2. **`withErrorHandling` 함수의 문제**
   - `isUserFacing`이 `false`인 경우 처리 로직이 복잡하고 중복됨
   - 에러 메시지가 중복되어 표시되는 문제

## 개선 사항

### 1. `normalizeError` 함수 개선

**이전 코드:**
```typescript
return new AppError(
  "알 수 없는 오류가 발생했습니다.",
  ErrorCode.INTERNAL_ERROR,
  500,
  false  // isUserFacing이 항상 false
);
```

**개선 후:**
```typescript
// Error가 아닌 값이 throw된 경우 (문자열, 숫자, 객체 등)
// 개발 환경에서는 실제 값을 포함한 메시지 제공
const errorMessage = process.env.NODE_ENV === "development"
  ? `알 수 없는 오류가 발생했습니다: ${JSON.stringify(error)}`
  : "알 수 없는 오류가 발생했습니다.";

return new AppError(
  errorMessage,
  ErrorCode.INTERNAL_ERROR,
  500,
  // 개발 환경에서는 상세 정보를 포함하므로 isUserFacing을 true로 설정
  // 프로덕션에서는 일반 메시지만 표시
  process.env.NODE_ENV === "development"
);
```

**개선 효과:**
- 개발 환경에서 실제 에러 값을 확인할 수 있음
- 프로덕션에서는 안전한 일반 메시지 제공
- `isUserFacing` 플래그를 환경에 따라 적절히 설정

### 2. `withErrorHandling` 함수 개선

**이전 코드:**
```typescript
// 개발 환경에서는 실제 에러 메시지 포함
const errorMessage = process.env.NODE_ENV === "development"
  ? `작업을 완료하는 중 오류가 발생했습니다: ${normalizedError.message}`
  : "작업을 완료하는 중 오류가 발생했습니다.";

// 그 외에는 일반적인 에러 메시지
throw new AppError(
  errorMessage,
  ErrorCode.INTERNAL_ERROR,
  500,
  true
);
```

**개선 후:**
```typescript
// isUserFacing이 false인 경우 (Error가 아닌 값이 catch된 경우 등)
// 개발 환경에서는 원본 에러 정보를 포함한 메시지 제공
// 프로덕션에서는 일반적인 메시지만 제공
const errorMessage = process.env.NODE_ENV === "development"
  ? `작업을 완료하는 중 오류가 발생했습니다: ${normalizedError.message}`
  : "작업을 완료하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

// 사용자에게 보여줄 수 있는 형태로 변환하여 throw
throw new AppError(
  errorMessage,
  ErrorCode.INTERNAL_ERROR,
  500,
  true
);
```

**개선 효과:**
- 주석 추가로 코드 의도 명확화
- 프로덕션 메시지에 "잠시 후 다시 시도해주세요" 추가로 사용자 경험 개선

## 변경된 파일

- `lib/errors/handler.ts`
  - `normalizeError` 함수: Error가 아닌 값 처리 개선
  - `withErrorHandling` 함수: 주석 추가 및 메시지 개선

## 테스트 권장 사항

1. **개발 환경 테스트**
   - 다양한 타입의 에러를 throw하여 메시지가 올바르게 표시되는지 확인
   - `Error`가 아닌 값(문자열, 숫자, 객체)을 throw하여 처리 확인

2. **프로덕션 환경 테스트**
   - 에러 메시지가 안전하게 표시되는지 확인
   - 민감한 정보가 노출되지 않는지 확인

## 향후 개선 사항

1. **에러 트래킹 서비스 통합**
   - Sentry, LogRocket 등과 통합하여 프로덕션 에러 추적
   - 에러 발생 시 자동으로 알림 받기

2. **에러 분류 개선**
   - 더 세밀한 에러 코드 분류
   - 에러별 적절한 HTTP 상태 코드 설정

3. **에러 로깅 개선**
   - 구조화된 로깅 형식
   - 에러 컨텍스트 정보 추가

