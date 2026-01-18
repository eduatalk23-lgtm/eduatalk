# cn 함수 import 누락 에러 수정

## 문제 상황

`ContentCard.tsx` 파일에서 `cn` 함수를 사용하고 있었지만 import 문이 누락되어 런타임 에러가 발생했습니다.

### 에러 메시지
```
ReferenceError: cn is not defined
    at ContentCardComponent (app/(student)/contents/_components/ContentCard.tsx:44:20)
```

## 원인

`ContentCard.tsx` 파일의 44번째 줄에서 `cn` 함수를 사용하고 있었지만, 파일 상단에 `cn` 함수를 import하는 문이 없었습니다.

## 해결 방법

`lib/cn.ts`에서 `cn` 함수를 import하도록 수정했습니다.

### 수정 내용

```typescript
// 수정 전
"use client";

import { useState, Fragment, memo } from "react";
import Link from "next/link";
import { DeleteContentButton } from "./DeleteContentButton";
import { isFromMaster } from "@/lib/utils/contentMaster";

// 수정 후
"use client";

import { useState, Fragment, memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { DeleteContentButton } from "./DeleteContentButton";
import { isFromMaster } from "@/lib/utils/contentMaster";
```

## 참고 사항

- `cn` 함수는 `lib/cn.ts`에 정의되어 있으며, `clsx`와 `tailwind-merge`를 사용하여 클래스명을 병합합니다.
- 일부 파일에서는 `lib/utils/darkMode.ts`에서 `cn`을 re-export하고 있으므로, 해당 파일에서도 import할 수 있습니다.
- 하지만 일관성을 위해 `@/lib/cn`에서 직접 import하는 것을 권장합니다.

## 수정된 파일

- `app/(student)/contents/_components/ContentCard.tsx`

## 작업 일시

2025-12-17

