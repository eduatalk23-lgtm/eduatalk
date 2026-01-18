# PlanSelector 중복 키 오류 수정

## 작업 일시
2025-12-21 18:41:06

## 문제 상황

### 오류 메시지
```
Encountered two children with the same key, `null`. Keys should be unique so that components maintain their identity across updates.
```

### 발생 위치
- 파일: `app/(student)/today/_components/PlanSelector.tsx`
- 라인: 88번째 줄

### 원인 분석
`PlanSelector` 컴포넌트에서 `groups.map()`을 사용하여 `<option>` 요소를 렌더링할 때, `key` 속성으로 `group.planNumber ?? "null"`을 사용하고 있었습니다. 

여러 그룹의 `planNumber`가 `null`인 경우, 모두 `"null"` 문자열로 변환되어 동일한 키를 가지게 되어 React에서 중복 키 경고가 발생했습니다.

```typescript
// 문제가 있던 코드
<option key={group.planNumber ?? "null"} value={group.planNumber ?? ""}>
```

## 해결 방법

`planNumber` 대신 각 그룹의 고유 식별자인 `group.plan.id`를 키로 사용하도록 변경했습니다.

```typescript
// 수정된 코드
<option key={group.plan.id} value={group.planNumber ?? ""}>
```

### 변경 사항
- **파일**: `app/(student)/today/_components/PlanSelector.tsx`
- **변경 내용**: 
  - `key={group.planNumber ?? "null"}` → `key={group.plan.id}`
  - `value` 속성은 그대로 유지 (`group.planNumber ?? ""`)

### 근거
1. `group.plan.id`는 각 플랜의 고유 식별자로, 항상 고유한 값을 보장합니다.
2. `planNumber`는 `null`일 수 있어 중복 키 문제가 발생할 수 있습니다.
3. React의 키는 렌더링 최적화와 컴포넌트 식별을 위해 고유해야 합니다.

## 검증
- ✅ 린터 오류 없음
- ✅ 타입 안전성 유지
- ✅ 기능 동작 유지 (value 속성은 그대로 유지)

## 관련 파일
- `app/(student)/today/_components/PlanSelector.tsx`
- `app/(student)/today/_utils/planGroupUtils.ts` (PlanGroup 타입 정의)

