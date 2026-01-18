# 성적 상세 조회 에러 로깅 개선

## 작업 일시
2025-01-02

## 문제 상황

성적 상세 분석 페이지(`app/(student)/scores/analysis/page.tsx`)에서 내신 성적 및 모의고사 성적 조회 시 에러가 발생했지만, 콘솔에 빈 객체(`{}`)만 출력되어 실제 에러 원인을 파악하기 어려웠습니다.

### 에러 메시지
```
[data/scoreDetails] 내신 성적 조회 실패 쿼리 에러: {}
[data/scoreDetails] 내신 성적 조회 상세 정보 {}
[data/scoreDetails] 모의고사 성적 조회 실패 쿼리 에러: {}
[data/scoreDetails] 모의고사 성적 조회 상세 정보 {}
```

## 원인 분석

1. **에러 객체 직렬화 문제**: `PostgrestError` 객체를 `JSON.stringify`로 직렬화할 때 순환 참조나 직렬화 불가능한 속성으로 인해 빈 객체가 생성됨
2. **에러 속성 추출 실패**: 에러 객체의 속성을 안전하게 추출하지 못해 로깅 정보가 비어있음
3. **에러 정보 부족**: 최소한의 에러 정보(메시지, 코드 등)도 제대로 추출되지 않음

## 해결 방법

### 1. `errorHandler.ts` 개선

에러 객체를 안전하게 직렬화하고 모든 속성을 추출하도록 개선:

```typescript
// 에러 로깅
if (logError) {
  // 에러 객체를 안전하게 직렬화
  const errorInfo: Record<string, unknown> = {};
  
  // 기본 속성 추출
  if (error.message) {
    errorInfo.message = error.message;
  }
  if (error.code) {
    errorInfo.code = error.code;
  }
  
  // 에러 객체의 모든 열거 가능한 속성 추출
  try {
    Object.keys(error).forEach((key) => {
      const value = (error as Record<string, unknown>)[key];
      // 순환 참조 방지 및 직렬화 가능한 값만 포함
      if (value !== null && typeof value !== "function" && typeof value !== "object") {
        errorInfo[key] = value;
      } else if (typeof value === "object" && value !== null) {
        try {
          // 객체인 경우 JSON 직렬화 시도
          JSON.stringify(value);
          errorInfo[key] = value;
        } catch {
          // 직렬화 불가능한 경우 문자열로 변환
          errorInfo[key] = String(value);
        }
      }
    });
  } catch (e) {
    // 속성 추출 실패 시 최소한의 정보라도 로깅
    errorInfo.errorString = String(error);
  }
  
  // PostgrestError의 표준 속성들 명시적으로 확인
  if ("details" in error && error.details) {
    errorInfo.details = error.details;
  }
  if ("hint" in error && error.hint) {
    errorInfo.hint = error.hint;
  }
  if ("statusCode" in error && (error as { statusCode?: unknown }).statusCode) {
    errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
  }

  // 최소한의 정보가 있는지 확인
  if (Object.keys(errorInfo).length === 0) {
    errorInfo.errorString = String(error);
    errorInfo.errorType = typeof error;
    errorInfo.errorConstructor = error?.constructor?.name || "Unknown";
  }

  console.error(`${context} 쿼리 에러:`, errorInfo);
}
```

### 2. `scoreDetails.ts` 개선

에러 상세 정보 로깅을 개선하여 더 많은 컨텍스트 정보를 포함:

```typescript
if (handleQueryError(error, {
  context: "[data/scoreDetails] 내신 성적 조회 실패",
  logError: true,
})) {
  // 에러 상세 정보 추가 로깅
  if (error) {
    const errorDetails: Record<string, unknown> = {
      studentId,
      tenantId,
      grade,
      semester,
    };
    
    // 에러 정보 안전하게 추출
    if (error.message) errorDetails.errorMessage = error.message;
    if (error.code) errorDetails.errorCode = error.code;
    if ("details" in error && error.details) errorDetails.errorDetails = error.details;
    if ("hint" in error && error.hint) errorDetails.errorHint = error.hint;
    if ("statusCode" in error) {
      errorDetails.errorStatusCode = (error as { statusCode?: unknown }).statusCode;
    }
    
    // JSON 직렬화 시도
    try {
      errorDetails.errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch (e) {
      errorDetails.errorString = String(error);
    }
    
    console.error("[data/scoreDetails] 내신 성적 조회 상세 정보", errorDetails);
  }
  return [];
}
```

## 개선 효과

1. **에러 정보 가시성 향상**: 에러 객체의 모든 속성을 안전하게 추출하여 로깅
2. **디버깅 용이성**: 에러 메시지, 코드, 상세 정보, 힌트 등 모든 정보를 확인 가능
3. **안정성 향상**: 직렬화 실패 시에도 최소한의 에러 정보는 로깅
4. **컨텍스트 정보 추가**: 쿼리 파라미터(studentId, tenantId 등)도 함께 로깅하여 디버깅 용이

## 수정된 파일

- `lib/data/core/errorHandler.ts`: 에러 처리 로직 개선
- `lib/data/scoreDetails.ts`: 내신 성적 및 모의고사 성적 조회 에러 로깅 개선

## 참고 사항

- 에러 객체의 직렬화는 순환 참조나 직렬화 불가능한 속성으로 인해 실패할 수 있으므로, 안전한 추출 방식을 사용
- 최소한의 정보라도 로깅하도록 fallback 로직 포함
- 향후 다른 데이터 페칭 함수에서도 동일한 패턴 적용 가능

