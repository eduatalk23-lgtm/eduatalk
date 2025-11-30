# PlanGroupListItem displayStatus 에러 수정

## 문제 상황

`PlanGroupListItem.tsx` 파일에서 `displayStatus is not defined` 에러가 발생했습니다.

### 에러 위치
- 파일: `app/(student)/plan/_components/PlanGroupListItem.tsx`
- 라인: 182

### 원인
- `displayStatus` 변수가 정의되지 않았음
- `Badge` 컴포넌트가 import되지 않았음
- `statusLabels`를 import하지 않았음

## 수정 내용

### 1. Import 추가
- `statusLabels`를 `StatusBadge`에서 import
- `Badge` 컴포넌트를 `@/components/atoms/Badge`에서 import

```typescript
import { StatusBadge, statusLabels } from "../_shared/StatusBadge";
import { Badge } from "@/components/atoms/Badge";
```

### 2. displayStatus 생성 로직 추가
- `getDisplayStatus()` 함수를 추가하여 상태 정보를 생성
- `shouldShowStatus` 조건을 기반으로 표시할 상태 결정
- `statusLabels`를 사용하여 상태 레이블 매핑

```typescript
// 표시할 상태 정보 생성
const getDisplayStatus = () => {
  if (!shouldShowStatus) {
    return null;
  }

  const status = group.status as PlanStatus;
  const label = statusLabels[status] || status;
  
  return { label };
};

const displayStatus = getDisplayStatus();
```

## 수정된 파일

- `app/(student)/plan/_components/PlanGroupListItem.tsx`

## 테스트

- [x] 린터 에러 확인 완료
- [x] `displayStatus` 변수 정의 확인
- [x] `Badge` 컴포넌트 import 확인

## 참고

- `StatusBadge` 컴포넌트의 `statusLabels`를 재사용하여 일관된 상태 레이블 표시
- `shouldShowStatus` 로직을 활용하여 저장됨/초안 상태는 표시하지 않음

