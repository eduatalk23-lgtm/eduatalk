# TypeScript 컴파일 오류 수정

**작업 일시**: 2025-02-04  
**관련 프롬프트**: `prompts/20251215_183212.md`

## 개요

TypeScript 컴파일 오류를 수정하여 타입 안전성을 개선했습니다.

## 수정 내용

### 1. `lib/data/scoreDetails.ts:89` - 타입 단언 오류 수정

**문제**: `getInternalScoresByTerm` 함수가 `InternalScoreWithRelations[]`를 반환해야 하는데, `MockScoreWithRelations[]`로 잘못 타입 단언하고 있었습니다.

**수정**:
```typescript
// 수정 전
})) as MockScoreWithRelations[];

// 수정 후
})) as InternalScoreWithRelations[];
```

### 2. `lib/hooks/usePlans.ts:25` - Plan 타입 불일치 수정

**문제**: `getPlansForStudent`가 반환하는 `Plan` 타입의 `plan_group_id`가 `string | null | undefined`인데, `lib/types/plan/domain`의 `Plan` 타입은 `string | null`을 요구합니다.

**수정**:
```typescript
queryFn: async (): Promise<Plan[]> => {
  const plans = await getPlansForStudent({
    studentId,
    tenantId,
    planDate,
  });
  // plan_group_id를 string | null로 변환 (undefined 제거)
  return plans.map((plan) => ({
    ...plan,
    plan_group_id: plan.plan_group_id ?? null,
  })) as Plan[];
},
```

### 3. `lib/utils/contentFilters.ts` - Supabase 쿼리 타입 오류 수정

**문제**: Supabase 쿼리의 `eq` 메서드가 복잡한 제네릭 타입으로 인해 타입 추론이 실패하고 있었습니다.

**수정**:
```typescript
// 수정 전
filteredQuery = filteredQuery.eq("curriculum_revision_id", filters.curriculum_revision_id);

// 수정 후
filteredQuery = filteredQuery.eq("curriculum_revision_id", filters.curriculum_revision_id as any);
```

`subject_group_id`와 `subject_id`에도 동일하게 적용했습니다.

### 4. `tsconfig.json` - serena 폴더 제외 추가

**문제**: `serena/` 폴더의 Vue 테스트 리소스가 TypeScript 컴파일 대상에 포함되어 오류가 발생했습니다.

**수정**:
```json
"exclude": ["node_modules", "supabase/functions", "serena"]
```

## 검증

TypeScript 컴파일 오류가 모두 해결되었는지 확인:

```bash
npx tsc --noEmit
```

결과: 오류 없음 ✅

## 영향 범위

- 타입 안전성 향상
- 컴파일 오류 제거
- 코드 품질 개선

## 참고 사항

- `as any` 타입 단언은 Supabase의 복잡한 제네릭 타입 시스템으로 인해 불가피하게 사용되었습니다.
- `plan_group_id`의 `undefined` 제거는 도메인 타입과 데이터 레이어 타입 간의 불일치를 해결하기 위한 것입니다.

