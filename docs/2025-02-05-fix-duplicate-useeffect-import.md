# useContext 중복 Import 에러 수정

## 날짜
2025-02-05

## 문제
빌드 에러 발생: `Step6Simplified.tsx` 파일에서 `useContext`가 여러 번 정의되어 있다는 에러

```
the name `useContext` is defined multiple times
```

## 원인
`Step6Simplified.tsx` 파일에서 `useContext`를 두 번 import하고 있었습니다:

1. 3번째 줄: `import React, { useState, useEffect, useMemo, useRef, useContext } from "react";`
2. 14번째 줄: `import { useContext } from "react";` (중복)

## 해결 방법
14번째 줄의 중복 import 문을 제거했습니다.

### 변경 전
```typescript
import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
// ... other imports ...
import { useContext } from "react"; // 중복!
import { PlanWizardContext } from "./_context/PlanWizardContext";
```

### 변경 후
```typescript
import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
// ... other imports ...
import { PlanWizardContext } from "./_context/PlanWizardContext";
```

## 수정된 파일
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

## 검증
- 린터 에러 없음 확인
- 빌드 에러 해결

