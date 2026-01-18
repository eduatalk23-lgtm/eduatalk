# 플랜 저장 에러 메시지 개선

**작업 일자**: 2025-12-17  
**관련 파일**: `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

## 작업 목적

플랜 저장 실패 시 발생하는 에러 메시지를 더 상세하고 사용자 친화적으로 개선하여, 실제 문제 원인을 파악하고 디버깅을 용이하게 함.

## 개선 내용

### 1. 데이터 검증 로직 추가

플랜 저장 전에 필수 필드 검증을 수행하여, 데이터베이스에 저장하기 전에 문제를 미리 발견:

```typescript
// 플랜 저장 전 검증
if (planPayloads.length === 0) {
  throw new AppError(
    "저장할 플랜이 없습니다.",
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}

// 필수 필드 검증
const invalidPayloads = planPayloads.filter(
  (p) => !p.plan_group_id || !p.student_id || !p.tenant_id || !p.content_id || !p.plan_date
);

if (invalidPayloads.length > 0) {
  // 상세 로깅 및 에러 발생
}
```

### 2. 상세한 에러 정보 로깅

데이터베이스 에러 발생 시 다음과 같은 상세 정보를 로깅:

- 에러 코드 (`error.code`)
- 에러 메시지 (`error.message`)
- 에러 상세 정보 (`error.details`)
- 힌트 (`error.hint`)
- 플랜 페이로드 개수 및 샘플 데이터

```typescript
const errorDetails = {
  errorCode: insertError.code,
  errorMessage: insertError.message,
  errorDetails: insertError.details,
  errorHint: insertError.hint,
  planPayloadsCount: planPayloads.length,
  samplePayload: planPayloads[0],
};

console.error("[_generatePlansFromGroupRefactored] 플랜 저장 실패:", {
  ...errorDetails,
  fullError: insertError,
});
```

### 3. 사용자 친화적인 에러 메시지

일반적인 PostgreSQL 에러 코드에 대한 구체적인 메시지 제공:

- `23503` (외래 키 제약 조건 위반): "참조 무결성 오류가 발생했습니다. 콘텐츠, 학생, 또는 플랜 그룹 정보를 확인해주세요."
- `23505` (중복 키): "중복된 플랜이 이미 존재합니다."
- `23502` (NOT NULL 제약 조건 위반): "필수 필드가 누락되었습니다. 플랜 데이터를 확인해주세요."
- `23514` (CHECK 제약 조건 위반): "데이터 제약 조건을 위반했습니다. 플랜 데이터의 형식을 확인해주세요."

### 4. 성공 로깅 추가

플랜 저장 성공 시에도 로그를 남겨 디버깅과 모니터링을 용이하게 함:

```typescript
if (insertedData && insertedData.length > 0) {
  console.log(
    `[_generatePlansFromGroupRefactored] 플랜 저장 성공: ${insertedData.length}개 플랜 저장됨`
  );
}
```

## 변경된 코드 위치

- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`
  - 569-630줄: 플랜 저장 로직 및 에러 처리 개선

## 기대 효과

1. **디버깅 시간 단축**: 상세한 에러 정보로 문제 원인을 빠르게 파악
2. **사용자 경험 개선**: 구체적인 에러 메시지로 사용자가 문제를 이해하고 대응 가능
3. **데이터 품질 향상**: 저장 전 검증으로 잘못된 데이터의 데이터베이스 저장 방지
4. **모니터링 강화**: 성공/실패 로그를 통한 시스템 상태 추적

## 참고

- PostgreSQL 에러 코드: https://www.postgresql.org/docs/current/errcodes-appendix.html
- Supabase 에러 처리: https://supabase.com/docs/reference/javascript/error-handling

