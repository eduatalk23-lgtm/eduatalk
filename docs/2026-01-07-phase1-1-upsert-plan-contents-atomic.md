# Phase 1.1: DELETE → INSERT 패턴을 UPSERT로 전환

## 작업 개요

**작업 ID**: Phase 1.1  
**작업명**: DELETE → INSERT 패턴을 UPSERT로 전환  
**우선순위**: CRITICAL  
**작업 일자**: 2026-01-07

## 목표

데이터 손실 위험을 제거하고 원자적 처리를 보장하기 위해 DELETE → INSERT 패턴을 PostgreSQL RPC 함수를 사용한 원자적 트랜잭션으로 전환합니다.

## 문제점

### 기존 문제

1. **데이터 손실 위험**: DELETE 성공 후 INSERT 실패 시 데이터 손실
2. **중간 상태 노출**: DELETE와 INSERT 사이에 다른 요청이 조회하면 데이터 불일치
3. **트랜잭션 부재**: 두 작업이 별도의 트랜잭션으로 처리되어 롤백 불가능

### 발견된 위치

- `lib/domains/plan/service.ts`의 `savePlanContents` 함수 (204-233줄)
- `lib/domains/plan/actions/plan-groups/update.ts`의 `_updatePlanGroupDraft` 함수 (251-292줄)

## 구현 내용

### 1. PostgreSQL RPC 함수 생성

**파일**: `supabase/migrations/20260107163140_create_upsert_plan_contents_atomic.sql`

```sql
CREATE OR REPLACE FUNCTION upsert_plan_contents_atomic(
  p_group_id UUID,
  p_tenant_id UUID,
  p_contents JSONB
) RETURNS JSONB
```

**기능**:
- 기존 `plan_contents` 삭제 (트랜잭션 내에서)
- 새 `plan_contents` 삽입 (배치)
- 실패 시 자동 롤백

### 2. TypeScript 래퍼 함수 추가

**파일**: `lib/domains/plan/transactions.ts`

**추가된 함수**:
- `upsertPlanContentsAtomic`: RPC 함수를 호출하는 TypeScript 래퍼
- `UpsertPlanContentInput`: 입력 타입 정의
- `UpsertPlanContentsResult`: 결과 타입 정의

### 3. 기존 코드 수정

#### 3.1 `lib/domains/plan/service.ts`

**변경 전**:
```typescript
// 기존 콘텐츠 삭제
await repository.deletePlanContentsByGroupId(planGroupId);

// 새 콘텐츠 생성
if (contents.length > 0) {
  await repository.insertPlanContents(contentsWithGroupId);
}
```

**변경 후**:
```typescript
const result = await upsertPlanContentsAtomic(
  planGroupId,
  tenantId,
  contentsInput
);
```

#### 3.2 `lib/domains/plan/actions/plan-groups/update.ts`

**변경 전**:
```typescript
const { error: deleteError } = await supabase
  .from("plan_contents")
  .delete()
  .eq("plan_group_id", groupId);

if (data.contents.length > 0) {
  const contentsResult = await createPlanContents(...);
}
```

**변경 후**:
```typescript
const result = await upsertPlanContentsAtomic(
  groupId,
  tenantContext.tenantId,
  contentsInput
);
```

## 변경된 파일 목록

1. **마이그레이션 파일**:
   - `supabase/migrations/20260107163140_create_upsert_plan_contents_atomic.sql` (신규)

2. **TypeScript 파일**:
   - `lib/domains/plan/transactions.ts` (수정)
   - `lib/domains/plan/service.ts` (수정)
   - `lib/domains/plan/actions/plan-groups/update.ts` (수정)

## 검증 방법

### 단위 테스트

1. **정상 케이스**: DELETE → INSERT 성공
2. **실패 케이스**: DELETE 성공 후 INSERT 실패 시 롤백 확인
3. **빈 배열 케이스**: contents가 빈 배열일 때 처리

### 통합 테스트

1. 실제 플랜 그룹 업데이트 플로우 테스트
2. 동시 요청 시 데이터 일관성 테스트

### 수동 검증

1. 개발 환경에서 플랜 그룹 콘텐츠 업데이트 테스트
2. 에러 로그 모니터링

## 향후 작업

- [ ] `savePlanContents` 함수 호출부에서 `tenantId` 또는 `studentId` 전달 확인
- [ ] 다른 DELETE → INSERT 패턴 사용 위치 확인 및 수정
- [ ] 단위 테스트 작성

## 참고

- 기존 RPC 함수 패턴: `generate_plans_atomic`, `create_plan_group_atomic`
- 트랜잭션 유틸리티: `lib/supabase/transaction.ts`
- 비즈니스 로직 개선 계획: `.cursor/plans/-14010842.plan.md`

