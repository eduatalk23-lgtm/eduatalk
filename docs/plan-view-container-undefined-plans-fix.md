# PlanViewContainer undefined plans 에러 수정

## 문제 상황

`PlanViewContainer` 컴포넌트에서 `groupPlansByPlanNumber` 함수를 호출할 때 `plans`가 `undefined`인 경우 `Cannot read properties of undefined (reading 'forEach')` 에러가 발생했습니다.

## 에러 위치

- `app/(student)/today/_utils/planGroupUtils.ts:28:9`
- `app/(student)/today/_components/PlanViewContainer.tsx:119:47`

## 원인 분석

1. **API 응답 구조 불일치**: `apiSuccess`는 `{ success: true, data: { plans, sessions, ... } }` 형식으로 응답하지만, `PlanViewContainer`에서는 `data.plans`로 직접 접근하고 있었습니다.

2. **안전하지 않은 타입 처리**: `groupPlansByPlanNumber` 함수가 `plans`가 `undefined`이거나 `null`인 경우를 처리하지 않았습니다.

## 수정 내용

### 1. `planGroupUtils.ts` - 안전한 타입 처리 추가

```typescript
export function groupPlansByPlanNumber(plans: PlanWithContent[] | null | undefined): PlanGroup[] {
  if (!plans || !Array.isArray(plans)) {
    return [];
  }
  // ... 나머지 로직
}
```

- `plans` 파라미터 타입에 `null | undefined` 추가
- 함수 시작 부분에서 `plans`가 없거나 배열이 아닌 경우 빈 배열 반환

### 2. `PlanViewContainer.tsx` - API 응답 파싱 개선

```typescript
const responseData = await response.json();
// API 응답이 { success: true, data: { plans, sessions, ... } } 형식인지 확인
const data = (responseData.success && responseData.data 
  ? responseData.data 
  : responseData) as PlansResponse;
const grouped = groupPlansByPlanNumber(data?.plans);
```

- API 응답 구조를 확인하여 `data.data` 또는 `data`로 접근
- 옵셔널 체이닝(`?.`)을 사용하여 안전하게 접근
- `data.sessions`, `data.planDate`, `data.isToday`도 옵셔널 체이닝으로 처리

## 수정된 파일

1. `app/(student)/today/_utils/planGroupUtils.ts`
2. `app/(student)/today/_components/PlanViewContainer.tsx`

## 테스트 확인

- [x] Linter 에러 없음
- [ ] 실제 API 응답 테스트 필요 (개발 환경에서 확인)

## 참고사항

- `apiSuccess` 응답 형식: `{ success: true, data: T }`
- 클라이언트에서 응답을 파싱할 때 `responseData.data`로 접근해야 함
- 향후 API 응답 구조가 변경되면 클라이언트 파싱 로직도 함께 수정 필요

