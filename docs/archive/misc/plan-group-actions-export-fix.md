# planGroupActions.ts Export 에러 수정

## 문제 상황

빌드 시 다음 에러가 발생했습니다:

```
./app/(student)/actions/planGroupActions.ts:22:1
Only async functions are allowed to be exported in a "use server" file.
```

## 원인 분석

Next.js의 "use server" 파일에서는 다른 파일에서 export된 함수를 직접 re-export할 수 없습니다. `planGroupActions.ts` 파일이 `"use server"` 지시어를 가지고 있으면서 다른 모듈 파일에서 함수들을 re-export하고 있어서 문제가 발생했습니다.

## 해결 방법

`planGroupActions.ts` 파일에서 각 함수를 먼저 import한 후, 다시 export하도록 변경했습니다.

### 변경 전

```typescript
"use server";

// Create actions
export {
  createPlanGroupAction,
  savePlanGroupDraftAction,
  copyPlanGroupAction,
} from "./plan-groups/create";
```

### 변경 후

```typescript
"use server";

// Create actions
import {
  createPlanGroupAction,
  savePlanGroupDraftAction,
  copyPlanGroupAction,
} from "./plan-groups/create";

// ... 다른 import들 ...

// Re-export all actions
export {
  createPlanGroupAction,
  savePlanGroupDraftAction,
  copyPlanGroupAction,
  // ... 모든 함수들 ...
};
```

## 수정된 파일

- `app/(student)/actions/planGroupActions.ts`

## 참고 사항

Next.js의 "use server" 파일에서는:
- async 함수만 export할 수 있습니다
- 다른 파일에서 직접 re-export하는 것은 허용되지 않습니다
- import 후 다시 export하는 방식은 허용됩니다

## 테스트

- [x] 빌드 에러 해결 확인
- [x] 린터 에러 없음 확인

