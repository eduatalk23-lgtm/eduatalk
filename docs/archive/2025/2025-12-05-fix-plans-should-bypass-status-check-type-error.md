# plans.ts에서 shouldBypassStatusCheck 타입 에러 수정

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:

### 에러 1
```
./app/(student)/actions/plan-groups/plans.ts:62:5
Type error: Argument of type 'PlanType | null | undefined' is not assignable to parameter of type 'string | null'.
Type 'undefined' is not assignable to type 'string | null'.
```

### 에러 2
```
./app/(student)/actions/plan-groups/plans.ts:1989:7
Type error: Argument of type 'PlanType | null | undefined' is not assignable to parameter of type 'string | null'.
Type 'undefined' is not assignable to type 'string | null'.
```

## 원인 분석
`shouldBypassStatusCheck` 함수는 `planType: string | null` 타입을 받는데, `group.plan_type`은 `PlanType | null | undefined` 타입입니다. `undefined`를 처리하지 않아서 타입 에러가 발생했습니다. 이 문제가 두 곳에서 발생했습니다 (62번 라인과 1989번 라인).

## 수정 내용

### 파일
- `app/(student)/actions/plan-groups/plans.ts`

### 변경 사항

#### 수정 1: group.plan_type에 nullish coalescing 연산자 적용 (62번 라인)
`group.plan_type`이 `undefined`일 수 있으므로, `?? null`을 사용하여 `undefined`를 `null`로 변환했습니다.

#### 수정 2: group.plan_type에 nullish coalescing 연산자 적용 (1989번 라인)
동일한 문제가 다른 위치에서도 발생했습니다. 같은 방식으로 수정했습니다.

```typescript
// 수정 전
const bypassStatusCheck = shouldBypassStatusCheck(
  access.role,
  group.plan_type
);

// 수정 후
const bypassStatusCheck = shouldBypassStatusCheck(
  access.role,
  group.plan_type ?? null
);
```

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `shouldBypassStatusCheck` 함수는 `lib/auth/planGroupAuth.ts`에 정의되어 있습니다.
- 함수 시그니처: `shouldBypassStatusCheck(role: PlanGroupAllowedRole, planType: string | null): boolean`
- `group.plan_type`은 `PlanType | null | undefined` 타입입니다.

