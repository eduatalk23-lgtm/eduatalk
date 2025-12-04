# requireStudentAuth import 누락 수정

## 작업 일시
2025-12-04

## 문제 상황
학원 일정 삭제 시 `requireStudentAuth is not defined` 에러 발생

### 에러 메시지
```
Error [AppError]: 작업을 완료하는 중 오류가 발생했습니다: requireStudentAuth is not defined
```

## 원인
`academy.ts` 파일에서 `requireStudentAuth` 함수를 사용하고 있었으나 import하지 않았음

## 수정 내용
`app/(student)/actions/plan-groups/academy.ts` 파일에 필요한 import 추가

### 변경 전
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
// ... 기타 imports
```

### 변경 후
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
// ... 기타 imports
```

## 수정 파일
- `app/(student)/actions/plan-groups/academy.ts`

## 검증
- 린터 에러 없음 확인
- import 경로 정확성 확인

## 참고
- `requireStudentAuth`: 학생 인증을 요구하는 헬퍼 함수
- `requireTenantContext`: 테넌트 컨텍스트를 요구하는 헬퍼 함수
- 다른 파일들(`create.ts`, `update.ts`, `queries.ts` 등)에서는 이미 올바르게 import하고 있었음

