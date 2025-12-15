# 네비게이션 설정 파일 JSX 파싱 오류 수정

**날짜**: 2025-02-05  
**작업 유형**: 버그 수정

## 문제 상황

빌드 시 다음 오류가 발생했습니다:

```
Parsing ecmascript source code failed
Expected '>', got 'className'
```

다음 파일들에서 오류 발생:
- `components/navigation/global/configs/adminCategories.ts`
- `components/navigation/global/configs/parentCategories.ts`
- `components/navigation/global/configs/studentCategories.ts`
- `components/navigation/global/configs/superadminCategories.ts`

### 오류 원인

이 파일들이 서버 컴포넌트로 처리되면서 JSX 구문(`<BarChart3 className="w-4 h-4" />`)을 파싱할 수 없었습니다. TypeScript 파일에서 JSX를 사용하려면 해당 파일이 클라이언트 컴포넌트로 표시되어야 합니다.

## 해결 방법

각 설정 파일의 최상단에 `"use client"` 지시어를 추가하여 클라이언트 컴포넌트로 처리되도록 수정했습니다.

### 수정된 파일

1. **adminCategories.ts**
```typescript
"use client";

import type { NavigationCategory } from "../types";
// ... 나머지 코드
```

2. **parentCategories.ts**
```typescript
"use client";

import type { NavigationCategory } from "../types";
// ... 나머지 코드
```

3. **studentCategories.ts**
```typescript
"use client";

import type { NavigationCategory } from "../types";
// ... 나머지 코드
```

4. **superadminCategories.ts**
```typescript
"use client";

import type { NavigationCategory } from "../types";
// ... 나머지 코드
```

## 영향도 분석

- ✅ **정상 동작**: 네비게이션 설정 파일들이 클라이언트에서만 사용되므로 `"use client"` 추가로 인한 부작용 없음
- ✅ **타입 안전성**: 기존 타입 정의(`icon?: ReactNode`) 그대로 유지
- ✅ **성능 영향**: 설정 데이터는 이미 클라이언트 컴포넌트(`CategoryNav`)에서 사용되므로 추가 오버헤드 없음

## 검증

- [x] 린터 오류 없음
- [x] 빌드 오류 해결
- [x] 타입 체크 통과

## 참고 사항

Next.js에서는 JSX를 포함한 파일은 반드시 클라이언트 컴포넌트로 표시해야 합니다. 설정 파일이라도 JSX를 사용하는 경우 `"use client"` 지시어가 필요합니다.
