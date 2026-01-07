# Phase 4.2: any 타입 제거 및 명시적 타입 정의

## 작업 개요

**작업 일자**: 2026-01-07  
**우선순위**: MEDIUM  
**상태**: 완료 ✅

## 목표

`lib/domains/plan/actions/calendarDrag.ts`와 `lib/domains/plan/actions/contentIndividualization.ts`에서 사용된 `any` 타입을 제거하고 명시적인 타입 정의로 대체하여 타입 안전성을 향상시켰습니다.

## 문제점

두 파일에서 Supabase 조인 쿼리 결과에 접근할 때 `any` 타입을 사용하여 타입 안전성이 떨어졌습니다:

1. **calendarDrag.ts**: 3곳
   - 105줄: `(existingPlan as any).plan_groups?.student_id`
   - 143줄: `(existingPlan as any).plan_groups?.student_id`
   - 441줄: `(existingPlan as any).plan_groups?.student_id`

2. **contentIndividualization.ts**: 4곳
   - 176줄: `(planContent as any).plan_groups?.student_id`
   - 256줄: `(planContent as any).plan_groups?.student_id`
   - 316줄: `(planContent as any).plan_groups?.student_id`
   - 380줄: `(planContent as any).plan_groups?.student_id`

**문제점**:
- 타입 안전성 부족: 컴파일 타임에 타입 오류를 감지할 수 없음
- 코드 가독성 저하: 어떤 타입인지 명확하지 않음
- 유지보수 어려움: 타입 변경 시 런타임 오류 가능성

## 구현 내용

### 1. 타입 정의 추가

#### calendarDrag.ts

```typescript
/**
 * student_plan과 plan_groups 조인 결과 타입
 */
type StudentPlanWithPlanGroup = {
  id: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  student_id: string;
  content_title: string | null;
  plan_group_id: string | null;
  version: number | null;
  plan_groups: {
    student_id: string;
  } | null;
};

/**
 * student_plan (버전만)과 plan_groups 조인 결과 타입
 */
type StudentPlanVersionWithPlanGroup = {
  id: string;
  version: number | null;
  plan_groups: {
    student_id: string;
  } | null;
};
```

#### contentIndividualization.ts

```typescript
/**
 * plan_contents와 plan_groups 조인 결과 타입
 */
type PlanContentWithPlanGroup = {
  id: string;
  plan_groups: {
    student_id: string;
  } | null;
};
```

### 2. any 타입 제거

#### calendarDrag.ts 변경 예시

**변경 전**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isOwner = (existingPlan as any).plan_groups?.student_id === user.userId;
```

**변경 후**:
```typescript
const planWithGroup = existingPlan as StudentPlanWithPlanGroup;
const isOwner = planWithGroup.plan_groups?.student_id === user.userId;
```

#### contentIndividualization.ts 변경 예시

**변경 전**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const studentId = (planContent as any).plan_groups?.student_id;
revalidatePath(`/admin/students/${studentId}/plans`);
```

**변경 후**:
```typescript
const contentWithGroup = planContent as PlanContentWithPlanGroup;
const studentId = contentWithGroup.plan_groups?.student_id;
if (studentId) {
  revalidatePath(`/admin/students/${studentId}/plans`);
}
```

### 3. 안전성 개선

`contentIndividualization.ts`에서 `studentId`가 `undefined`일 수 있는 경우를 고려하여 조건부 체크를 추가했습니다:

```typescript
const studentId = contentWithGroup.plan_groups?.student_id;
if (studentId) {
  revalidatePath(`/admin/students/${studentId}/plans`);
}
```

## 변경된 파일

- `lib/domains/plan/actions/calendarDrag.ts` (수정)
  - `StudentPlanWithPlanGroup` 타입 추가
  - `StudentPlanVersionWithPlanGroup` 타입 추가
  - 3곳의 `any` 타입 제거

- `lib/domains/plan/actions/contentIndividualization.ts` (수정)
  - `PlanContentWithPlanGroup` 타입 추가
  - 4곳의 `any` 타입 제거
  - `studentId` null 체크 추가

## 개선 효과

1. **타입 안전성 향상**: 컴파일 타임에 타입 오류를 감지할 수 있음
2. **코드 가독성 향상**: 명시적인 타입 정의로 코드 의도가 명확해짐
3. **유지보수성 향상**: 타입 변경 시 컴파일 오류로 문제를 조기에 발견 가능
4. **런타임 안전성 향상**: null 체크 추가로 런타임 오류 방지

## 참고

- Supabase의 조인 쿼리 결과는 자동으로 타입이 추론되지 않으므로 명시적으로 타입을 정의해야 함
- 타입 단언(`as`)을 사용하되, 적절한 타입을 정의하여 타입 안전성을 보장
- `eslint-disable-next-line @typescript-eslint/no-explicit-any` 주석 제거

## 다음 단계

- [ ] 다른 파일에서도 `any` 타입 사용 여부 확인
- [ ] 타입 정의를 공통 타입 파일로 이동 고려 (재사용성 향상)

---

**작업 완료 일자**: 2026-01-07  
**커밋**: `feat: Phase 4.2 - any 타입 제거 및 명시적 타입 정의`

