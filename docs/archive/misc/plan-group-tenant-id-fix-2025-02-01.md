# 플랜 생성 시 tenant_id 누락 문제 해결

## 작업 일시
2025년 2월 1일

## 문제 분석

### 에러 원인
- `student_plan` 테이블의 `tenant_id` 컬럼은 NOT NULL 제약조건이 있음
- `generatePlansRefactored.ts`의 `planPayloads`에 `tenant_id`가 포함되지 않음
- 플랜 저장 시 `null value in column "tenant_id"` 에러 발생

### 에러 메시지
```
null value in column "tenant_id" of relation "student_plan" violates not-null constraint
```

## 수정 내용

### 1. planPayloads 타입 정의에 tenant_id 추가
**파일**: `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

- 399-424줄: 타입 정의에 `tenant_id: string` 필드 추가
- 다른 필드들과 일관성 유지

### 2. tenant_id 검증 로직 추가
**파일**: `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

- 387-396줄: 플랜 저장 전에 `tenant_id` 검증 로직 추가
- `group.tenant_id` 우선 사용, 없으면 `tenantContext.tenantId` 사용
- `tenant_id`가 없을 경우 명확한 에러 메시지 제공

### 3. planPayloads.push()에 tenant_id 포함
**파일**: `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

- 506줄: `planPayloads.push()` 호출 시 검증된 `tenantId` 사용
- 모든 플랜에 동일한 `tenant_id` 적용

## 수정된 코드

### 타입 정의
```typescript
const planPayloads: Array<{
  plan_group_id: string;
  student_id: string;
  tenant_id: string; // 추가됨
  plan_date: string;
  // ... 나머지 필드
}> = [];
```

### 검증 로직
```typescript
// 12. tenant_id 검증 (플랜 저장 전에 미리 검증)
const tenantId = group.tenant_id || tenantContext.tenantId;
if (!tenantId) {
  throw new AppError(
    "테넌트 ID를 찾을 수 없습니다. 플랜 그룹 또는 사용자 정보를 확인해주세요.",
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}
```

### 데이터 추가
```typescript
planPayloads.push({
  plan_group_id: groupId,
  student_id: studentId,
  tenant_id: tenantId, // 검증된 값 사용
  plan_date: date,
  // ... 나머지 필드
});
```

## 검증 결과

- ✅ 타입 정의에 `tenant_id` 필드 추가 완료
- ✅ `tenant_id` 검증 로직 추가 완료
- ✅ `planPayloads.push()`에 `tenant_id` 포함 완료
- ✅ ESLint 에러 없음
- ✅ TypeScript 타입 검사 통과

## 참고사항

- `group.tenant_id`가 더 정확한 값이므로 우선 사용
- `tenantContext.tenantId`는 폴백으로 사용
- 데이터베이스 스키마 확인 완료: `tenant_id`는 NOT NULL 제약조건 있음
- 다른 플랜 생성 로직과의 일관성 유지

## 관련 파일

- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`
- `app/(student)/actions/plan-groups/plans.ts` (re-export)

