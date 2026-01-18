# Phase 1.2: withBatchOperations 자동 롤백 로직 추가

## 작업 개요

**작업 ID**: Phase 1.2  
**작업명**: withBatchOperations에 자동 롤백 로직 추가  
**우선순위**: CRITICAL  
**작업 일자**: 2026-01-07

## 목표

`withBatchOperations` 실패 시 성공한 작업들을 자동으로 롤백하여 데이터 일관성을 보장합니다.

## 문제점

### 기존 문제

1. **수동 롤백 필요**: 실패 시 `rollbackIds`만 반환하고, 실제 롤백은 호출자가 수동으로 수행해야 함
2. **롤백 누락 위험**: 호출자가 롤백을 깜빡하거나 제대로 처리하지 않으면 데이터 불일치 발생
3. **롤백 순서 관리**: 여러 작업이 성공한 경우 롤백 순서를 올바르게 관리해야 함

## 구현 내용

### 1. BatchOperation 인터페이스 확장

**변경 전**:
```typescript
export interface BatchOperation<T = unknown> {
  name: string;
  execute: () => Promise<{ success: boolean; data?: T; error?: string }>;
  rollbackId?: string;
}
```

**변경 후**:
```typescript
export interface BatchOperation<T = unknown> {
  name: string;
  execute: () => Promise<{ success: boolean; data?: T; error?: string }>;
  rollbackId?: string;
  rollback?: () => Promise<void>; // 롤백 함수 추가
}
```

### 2. withBatchOperations 함수 개선

**주요 변경사항**:

1. **롤백 함수 수집**: 성공한 작업 중 `rollback` 함수가 있는 작업들을 기록
2. **자동 롤백 실행**: 실패 시 성공한 작업들을 역순으로 롤백 (LIFO)
3. **롤백 오류 처리**: 롤백 중 발생한 오류를 수집하고 결과에 포함
4. **옵션 추가**: `enableAutoRollback` 옵션으로 자동 롤백 활성화/비활성화 가능

**롤백 순서**:
- LIFO (Last In First Out): 마지막에 성공한 작업부터 역순으로 롤백
- 이는 일반적인 트랜잭션 롤백 패턴과 일치합니다

### 3. BatchOperationResult 인터페이스 확장

**추가된 필드**:
- `rollbackPerformed?: boolean`: 롤백 수행 여부
- `rollbackErrors?: string[]`: 롤백 중 발생한 오류

## 사용 예시

### 기본 사용법

```typescript
const result = await withBatchOperations([
  {
    name: 'Create plan 1',
    execute: async () => {
      const { data, error } = await supabase
        .from('student_plan')
        .insert({ ... })
        .select()
        .single();
      return { success: !error, data, error: error?.message };
    },
    rollback: async () => {
      // 생성한 플랜 삭제
      await supabase.from('student_plan').delete().eq('id', planId);
    },
  },
  {
    name: 'Update plan group',
    execute: async () => {
      const { error } = await supabase
        .from('plan_groups')
        .update({ status: 'active' })
        .eq('id', groupId);
      return { success: !error, error: error?.message };
    },
    rollback: async () => {
      // 상태를 이전 값으로 복원
      await supabase
        .from('plan_groups')
        .update({ status: 'draft' })
        .eq('id', groupId);
    },
  },
]);

if (!result.success) {
  // 자동 롤백이 이미 수행됨
  console.error('작업 실패:', result.error);
  if (result.rollbackErrors && result.rollbackErrors.length > 0) {
    console.error('롤백 중 오류:', result.rollbackErrors);
  }
}
```

### 자동 롤백 비활성화

```typescript
const result = await withBatchOperations(
  operations,
  { enableAutoRollback: false }
);

if (!result.success && result.rollbackIds) {
  // 수동으로 롤백 수행
  await manualRollback(result.rollbackIds);
}
```

## 변경된 파일 목록

1. **TypeScript 파일**:
   - `lib/supabase/transaction.ts` (수정)

## 검증 방법

### 단위 테스트

1. **정상 케이스**: 모든 작업 성공 시 롤백 미실행
2. **롤백 성공 케이스**: 실패 시 성공한 작업들이 역순으로 롤백됨
3. **롤백 실패 케이스**: 롤백 중 오류 발생 시 오류 정보가 결과에 포함됨
4. **롤백 비활성화 케이스**: `enableAutoRollback: false` 시 롤백 미실행

### 통합 테스트

1. 실제 배치 작업 플로우에서 롤백 동작 확인
2. 롤백 중 오류 발생 시나리오 테스트

### 수동 검증

1. 개발 환경에서 실제 배치 작업 실패 시나리오 테스트
2. 롤백 로그 확인

## 주의사항

1. **롤백 함수의 안전성**: 롤백 함수 자체가 실패할 수 있으므로, 롤백 함수는 가능한 한 단순하고 안전하게 작성해야 합니다.
2. **롤백 순서**: 롤백은 역순(LIFO)으로 실행되므로, 작업 간 의존성이 있는 경우 이를 고려해야 합니다.
3. **부분 롤백**: 일부 롤백이 실패하더라도 나머지 롤백은 계속 실행됩니다. 이는 "best-effort" 롤백입니다.

## 향후 개선 사항

- [ ] 롤백 함수 실행 순서 옵션 추가 (LIFO/FIFO)
- [ ] 롤백 재시도 로직 추가
- [ ] 롤백 로깅 개선 (구조화된 로그)

## 참고

- 트랜잭션 유틸리티: `lib/supabase/transaction.ts`
- 비즈니스 로직 개선 계획: `.cursor/plans/-14010842.plan.md`
- Phase 1.1 작업: `docs/2026-01-07-phase1-1-upsert-plan-contents-atomic.md`

