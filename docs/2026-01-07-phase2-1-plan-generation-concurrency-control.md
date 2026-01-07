# Phase 2.1: 플랜 생성 동시성 제어 구현

## 작업 개요

**작업 ID**: Phase 2.1  
**작업명**: 플랜 생성 동시성 제어 구현  
**우선순위**: HIGH  
**작업 일자**: 2026-01-07

## 목표

동일 플랜 그룹에 대한 동시 생성 요청을 방지하여 데이터 일관성을 보장합니다.

## 문제점

### 기존 문제

1. **동시 생성 요청**: 동일 플랜 그룹에 대한 동시 생성 요청 시 중복 생성 가능
2. **Race Condition**: 플랜 그룹 상태 업데이트 시 Race Condition 가능
3. **락 메커니즘 부재**: `acquirePlanGroupLock` 함수가 실제로 락을 획득하지 않고 단순 존재 확인만 수행

## 구현 내용

### 1. PostgreSQL Advisory Lock RPC 함수 생성

**파일**: `supabase/migrations/20260107163641_create_plan_group_lock_functions.sql`

**생성된 함수**:
- `acquire_plan_group_lock(p_group_id UUID)`: 논블로킹 Advisory Lock 획득
- `check_plan_group_lock(p_group_id UUID)`: Lock 보유 여부 확인

**특징**:
- 트랜잭션 레벨 Advisory Lock 사용
- UUID를 해시하여 Lock 키 생성 (PostgreSQL `hashtext` 함수 사용)
- 트랜잭션이 끝나면 자동으로 해제

### 2. planGroupLock 유틸리티 개선

**파일**: `lib/utils/planGroupLock.ts`

**변경 사항**:
- `acquirePlanGroupLock`: RPC 함수를 호출하여 실제 Advisory Lock 획득
- `tryAcquirePlanGroupLock`: `acquirePlanGroupLock`과 동일하게 변경 (이미 논블로킹)

**이전**:
```typescript
// 단순히 존재 여부만 확인
const { data } = await supabase.from('plan_groups').select('id').eq('id', groupId).single();
return true; // 실제 락 획득 안 함
```

**이후**:
```typescript
// RPC 함수를 통해 실제 Advisory Lock 획득
const { data } = await supabase.rpc('acquire_plan_group_lock', { p_group_id: groupId });
return result.acquired === true;
```

### 3. generatePlansWithServices에 락 적용

**파일**: `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts`

**추가된 로직**:
```typescript
// 플랜 생성 시작 전 락 획득
const lockAcquired = await acquirePlanGroupLock(supabase, groupId);
if (!lockAcquired) {
  throw new AppError(
    "플랜 생성이 이미 진행 중입니다. 잠시 후 다시 시도해주세요.",
    ErrorCode.DATABASE_ERROR,
    409,
    true
  );
}
```

**특징**:
- 플랜 그룹 조회 전에 락 획득하여 동시 요청 방지
- 락 획득 실패 시 409 Conflict 에러 반환
- Advisory Lock은 트랜잭션 레벨이므로 함수 종료 시 자동 해제

## 변경된 파일 목록

1. **마이그레이션 파일**:
   - `supabase/migrations/20260107163641_create_plan_group_lock_functions.sql` (신규)

2. **TypeScript 파일**:
   - `lib/utils/planGroupLock.ts` (수정)
   - `lib/domains/plan/actions/plan-groups/generatePlansWithServices.ts` (수정)

## 검증 방법

### 단위 테스트

1. **정상 케이스**: 락 획득 성공 후 플랜 생성
2. **동시 요청 케이스**: 두 요청이 동시에 들어올 때 하나만 성공
3. **락 해제 케이스**: 트랜잭션 종료 시 자동 해제 확인

### 통합 테스트

1. 실제 플랜 생성 플로우에서 동시 요청 시나리오 테스트
2. 락 획득 실패 시 적절한 에러 메시지 반환 확인

### 수동 검증

1. 개발 환경에서 동시에 여러 요청 보내기
2. 하나만 성공하고 나머지는 409 에러 반환 확인

## 주의사항

1. **트랜잭션 레벨 Lock**: Advisory Lock은 트랜잭션 레벨이므로 트랜잭션이 끝나면 자동으로 해제됩니다. 명시적으로 해제할 필요는 없습니다.
2. **Lock 키 생성**: UUID를 해시하여 Lock 키를 생성하므로, 해시 충돌 가능성이 있지만 매우 낮습니다.
3. **에러 처리**: 락 획득 실패 시 사용자에게 친화적인 메시지를 제공합니다.

## 향후 개선 사항

- [ ] Lock 타임아웃 설정 (무한 대기 방지)
- [ ] Lock 대기 시간 로깅
- [ ] Lock 획득 실패 시 재시도 로직 (선택적)

## 참고

- Advisory Lock 문서: PostgreSQL 공식 문서
- 트랜잭션 유틸리티: `lib/supabase/transaction.ts`
- 재조정 트랜잭션: `lib/reschedule/transaction.ts`
- 비즈니스 로직 개선 계획: `.cursor/plans/-14010842.plan.md`

