# 플랜 그룹 제외일 중복 에러 처리 개선

## 📋 개요

플랜 그룹 저장 시 제외일 중복 에러가 발생했을 때 사용자에게 명확한 에러 메시지를 표시하도록 개선했습니다.

## 🔍 문제 분석

### 발견된 문제점

1. **에러 코드 부재**
   - 제외일 중복 에러에 대한 전용 에러 코드가 없었음
   - 모든 에러가 `DRAFT_SAVE_FAILED`로 처리되어 사용자에게 "임시 저장에 실패했습니다"라는 모호한 메시지 표시

2. **에러 메시지 변환 로직 부재**
   - `toPlanGroupError` 함수가 에러 메시지를 분석하지 않고 기본 코드만 사용
   - 서버에서 반환된 상세 에러 메시지가 사용자에게 전달되지 않음

3. **에러 처리 일관성 부족**
   - `savePlanGroupDraftAction`에서 제외일 저장 실패를 처리하지 않음
   - `updatePlanGroupDraftAction`에서 제외일 중복을 `DATABASE_ERROR`로 처리 (올바르게는 `VALIDATION_ERROR`)

## ✅ 해결 방안

### 1. 제외일 중복 에러 코드 추가

**파일**: `lib/errors/planGroupErrors.ts`

```typescript
export const PlanGroupErrorCodes = {
  // ... 기존 코드 ...
  
  // 제외일 관련
  EXCLUSION_DUPLICATE: 'EXCLUSION_DUPLICATE',
  
  // ... 기존 코드 ...
} as const;

export const ErrorUserMessages: Record<PlanGroupErrorCode, string> = {
  // ... 기존 코드 ...
  
  [PlanGroupErrorCodes.EXCLUSION_DUPLICATE]: '이미 등록된 제외일이 있습니다.',
  
  // ... 기존 코드 ...
};
```

**개선 사항**:
- 제외일 중복에 대한 전용 에러 코드 추가
- 사용자 친화적인 에러 메시지 정의

### 2. 에러 메시지 분석 로직 추가

**파일**: `lib/errors/planGroupErrors.ts`

```typescript
export function toPlanGroupError(
  error: unknown,
  defaultCode: PlanGroupErrorCode = PlanGroupErrorCodes.UNKNOWN_ERROR,
  context?: Record<string, unknown>
): PlanGroupError {
  if (error instanceof PlanGroupError) {
    return error;
  }

  if (error instanceof Error) {
    // 에러 메시지를 분석하여 적절한 에러 코드로 매핑
    let errorCode = defaultCode;
    let userMessage = ErrorUserMessages[defaultCode];

    const errorMessage = error.message.toLowerCase();
    
    // 제외일 중복 에러 감지
    if (errorMessage.includes('이미 등록된 제외일') || 
        (errorMessage.includes('exclusion') && errorMessage.includes('duplicate'))) {
      errorCode = PlanGroupErrorCodes.EXCLUSION_DUPLICATE;
      // 원본 에러 메시지에 중복된 날짜 정보가 있으면 그대로 사용
      userMessage = error.message.includes('이미 등록된 제외일') 
        ? error.message 
        : ErrorUserMessages[PlanGroupErrorCodes.EXCLUSION_DUPLICATE];
    }

    return new PlanGroupError(
      error.message,
      errorCode,
      userMessage,
      false,
      { ...context, originalError: error.message }
    );
  }

  // ... 나머지 로직 ...
}
```

**개선 사항**:
- 에러 메시지에서 "이미 등록된 제외일" 키워드 감지
- 적절한 에러 코드로 자동 매핑
- 원본 에러 메시지에 중복 날짜 정보가 있으면 그대로 전달

### 3. savePlanGroupDraftAction 에러 처리 개선

**파일**: `app/(student)/actions/plan-groups/create.ts`

```typescript
// 제외일은 플랜 그룹별 관리
if (data.exclusions && data.exclusions.length > 0) {
  const exclusionsResult = await createPlanExclusions(
    groupId,
    tenantContext.tenantId,
    data.exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason || null,
    }))
  );

  if (!exclusionsResult.success) {
    // 중복 에러인 경우 VALIDATION_ERROR로 처리
    const isDuplicateError = exclusionsResult.error?.includes("이미 등록된 제외일");
    throw new AppError(
      exclusionsResult.error || "제외일 저장에 실패했습니다.",
      isDuplicateError ? ErrorCode.VALIDATION_ERROR : ErrorCode.DATABASE_ERROR,
      isDuplicateError ? 400 : 500,
      true
    );
  }
}
```

**개선 사항**:
- 제외일 저장 결과 확인
- 중복 에러를 `VALIDATION_ERROR` (400)로 처리
- 명확한 에러 메시지 전달

### 4. updatePlanGroupDraftAction 에러 처리 개선

**파일**: `app/(student)/actions/plan-groups/update.ts`

```typescript
if (!exclusionsResult.success) {
  // 중복 에러인 경우 VALIDATION_ERROR로 처리
  const isDuplicateError = exclusionsResult.error?.includes("이미 등록된 제외일");
  throw new AppError(
    exclusionsResult.error || "제외일 업데이트에 실패했습니다.",
    isDuplicateError ? ErrorCode.VALIDATION_ERROR : ErrorCode.DATABASE_ERROR,
    isDuplicateError ? 400 : 500,
    true
  );
}
```

**개선 사항**:
- 제외일 중복을 `VALIDATION_ERROR` (400)로 처리 (이전에는 `DATABASE_ERROR` 500)
- 에러 처리 일관성 확보

## 🎯 에러 처리 흐름

### 기존 흐름
1. `createPlanExclusions` → "이미 등록된 제외일이 있습니다." 반환
2. `AppError`로 변환 → `DATABASE_ERROR` (500)
3. `PlanGroupWizard`에서 catch → `toPlanGroupError` → `DRAFT_SAVE_FAILED`
4. 사용자에게 "임시 저장에 실패했습니다." 표시 ❌

### 개선된 흐름
1. `createPlanExclusions` → "이미 등록된 제외일이 있습니다: 2024-01-01" 반환
2. `AppError`로 변환 → `VALIDATION_ERROR` (400)
3. `PlanGroupWizard`에서 catch → `toPlanGroupError` → 메시지 분석 → `EXCLUSION_DUPLICATE`
4. 사용자에게 "이미 등록된 제외일이 있습니다: 2024-01-01" 표시 ✅

## 📝 에러 코드 목록

### 추가된 에러 코드
- `EXCLUSION_DUPLICATE`: 제외일 중복 에러

### 관련 에러 코드
- `VALIDATION_FAILED`: 일반 검증 실패
- `DRAFT_SAVE_FAILED`: 임시 저장 실패 (기본 fallback)

## 🔄 영향 범위

### 수정된 파일
1. `lib/errors/planGroupErrors.ts`
   - 제외일 중복 에러 코드 추가
   - `toPlanGroupError` 함수에 메시지 분석 로직 추가

2. `app/(student)/actions/plan-groups/create.ts`
   - `savePlanGroupDraftAction`에서 제외일 저장 에러 처리 추가

3. `app/(student)/actions/plan-groups/update.ts`
   - `updatePlanGroupDraftAction`에서 제외일 중복 에러를 `VALIDATION_ERROR`로 처리

### 영향받는 컴포넌트
- `PlanGroupWizard`: 에러 메시지가 더 명확하게 표시됨

## ✅ 테스트 시나리오

### 시나리오 1: 제외일 중복 저장 시도
1. 플랜 그룹 생성 중 제외일 추가
2. 같은 날짜의 제외일을 다시 추가 시도
3. **기대 결과**: "이미 등록된 제외일이 있습니다: YYYY-MM-DD" 메시지 표시

### 시나리오 2: 여러 제외일 중 일부 중복
1. 플랜 그룹 생성 중 여러 제외일 추가
2. 일부 날짜가 이미 등록되어 있는 경우
3. **기대 결과**: 중복된 날짜 목록과 함께 에러 메시지 표시

### 시나리오 3: 임시 저장 중 제외일 중복
1. 플랜 그룹 임시 저장 (자동 저장)
2. 제외일이 중복된 경우
3. **기대 결과**: 토스트로 "이미 등록된 제외일이 있습니다" 메시지 표시

## 📚 참고 문서

- [학습 제외일 중복 방지 개선](./학습-제외일-중복-방지-개선.md)
- [플랜 그룹 에러 처리 가이드](./plan-group-error-handling.md)

## 🎉 개선 효과

1. **사용자 경험 개선**
   - 모호한 에러 메시지 대신 명확한 원인 표시
   - 중복된 날짜 정보 제공으로 문제 해결 용이

2. **에러 처리 일관성**
   - 검증 에러는 400, 데이터베이스 에러는 500으로 구분
   - 적절한 HTTP 상태 코드 사용

3. **유지보수성 향상**
   - 에러 코드 체계화
   - 에러 메시지 자동 분석으로 확장성 확보

