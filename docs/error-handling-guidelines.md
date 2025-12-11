# 에러 처리 가이드라인

## 개요

이 문서는 TimeLevelUp 프로젝트에서 일관된 에러 처리를 위한 가이드라인입니다.

## 에러 타입

### 1. PlanGroupError

**사용 범위**: 플랜 그룹 도메인 관련 에러

**파일**: `lib/errors/planGroupErrors.ts`

**사용 예시**:
```typescript
import { PlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";

throw new PlanGroupError(
  "플랜 그룹을 찾을 수 없습니다.",
  PlanGroupErrorCodes.PLAN_GROUP_NOT_FOUND,
  "플랜 그룹을 찾을 수 없습니다.",
  false, // recoverable
  { groupId, studentId } // context
);
```

**사용 위치**:
- `lib/utils/planGroupDataSync.ts`
- `lib/utils/schedulerOptionsMerge.ts`
- `lib/plan/blocks.ts`
- `lib/data/contentMetadata.ts`
- 기타 플랜 그룹 관련 로직

### 2. AppError

**사용 범위**: 일반 애플리케이션 에러

**파일**: `lib/errors/handler.ts`

**사용 예시**:
```typescript
import { AppError, ErrorCode } from "@/lib/errors";

throw new AppError(
  "플랜 그룹을 찾을 수 없습니다.",
  ErrorCode.NOT_FOUND,
  404,
  true, // isUserFacing
  { groupId } // details
);
```

**사용 위치**:
- Server Actions (`app/(student)/actions/`)
- 인증 관련 로직 (`lib/auth/`)
- 테넌트 관련 로직 (`lib/tenant/`)
- 기타 일반 애플리케이션 로직

### 3. 일반 Error

**사용 범위**: 외부 라이브러리 에러 또는 예상치 못한 에러

**처리 방법**: `normalizeError`로 변환하여 `AppError`로 변환

```typescript
import { normalizeError } from "@/lib/errors/handler";

try {
  // 외부 라이브러리 호출
} catch (error) {
  const normalizedError = normalizeError(error);
  // AppError로 변환됨
}
```

## 에러 처리 규칙

### 1. 도메인별 에러 타입 선택

| 도메인 | 에러 타입 | 예시 |
|--------|----------|------|
| 플랜 그룹 | `PlanGroupError` | 플랜 그룹 생성/수정/삭제 실패 |
| 일반 애플리케이션 | `AppError` | 인증 실패, 권한 없음, 데이터베이스 에러 |
| 외부 라이브러리 | `normalizeError`로 변환 | Supabase 에러, 네트워크 에러 |

### 2. 에러 로깅

**모든 에러는 `logError` 함수로 로깅합니다:**

```typescript
import { logError } from "@/lib/errors/handler";

try {
  // 작업 수행
} catch (error) {
  logError(error, {
    function: "functionName",
    // 추가 컨텍스트
    groupId,
    studentId,
  });
  throw error;
}
```

**로그 레벨**:
- `error`: 기본값, 심각한 에러
- `warn`: 경고, 복구 가능한 에러
- `info`: 정보성 로그 (개발 환경에서만)

### 3. 사용자 친화적 메시지

**에러는 사용자에게 보여줄 수 있는 메시지를 포함해야 합니다:**

```typescript
// PlanGroupError
throw new PlanGroupError(
  "내부 에러 메시지",
  PlanGroupErrorCodes.PLAN_GROUP_CREATE_FAILED,
  "플랜 그룹 생성에 실패했습니다. 다시 시도해주세요.", // 사용자 메시지
  true, // recoverable
);

// AppError
throw new AppError(
  "플랜 그룹 생성에 실패했습니다.",
  ErrorCode.DATABASE_ERROR,
  500,
  true, // isUserFacing
);
```

### 4. 에러 컨텍스트

**에러 발생 시 관련 컨텍스트 정보를 포함합니다:**

```typescript
logError(error, {
  function: "createPlanGroup",
  groupId,
  studentId,
  tenantId,
  payload: Object.keys(payload),
});
```

## 마이그레이션 가이드

### 기존 코드에서 PlanGroupError로 마이그레이션

**Before (AppError 사용)**:
```typescript
import { AppError, ErrorCode } from "@/lib/errors";

throw new AppError(
  "플랜 그룹을 찾을 수 없습니다.",
  ErrorCode.NOT_FOUND,
  404,
  true
);
```

**After (PlanGroupError 사용)**:
```typescript
import { PlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";

throw new PlanGroupError(
  "플랜 그룹을 찾을 수 없습니다.",
  PlanGroupErrorCodes.PLAN_GROUP_NOT_FOUND,
  "플랜 그룹을 찾을 수 없습니다.",
  false,
  { groupId, studentId }
);
```

### 기존 코드에서 logError로 마이그레이션

**Before (console.error 사용)**:
```typescript
if (error) {
  console.error("[data/planGroups] 플랜 그룹 조회 실패", error);
  return null;
}
```

**After (logError 사용)**:
```typescript
import { logError } from "@/lib/errors/handler";

if (error) {
  logError(error, {
    function: "getPlanGroupById",
    groupId,
    studentId,
  });
  return null;
}
```

## 체크리스트

새로운 코드 작성 시:

- [ ] 적절한 에러 타입을 선택했는가?
- [ ] 사용자 친화적 메시지를 포함했는가?
- [ ] `logError`로 에러를 로깅했는가?
- [ ] 필요한 컨텍스트 정보를 포함했는가?
- [ ] 에러가 복구 가능한지 명시했는가? (PlanGroupError의 경우)

## 참고 파일

- `lib/errors/planGroupErrors.ts` - PlanGroupError 정의
- `lib/errors/handler.ts` - AppError 및 logError 정의
- `lib/utils/migrationStatus.ts` - 마이그레이션 상태 확인 유틸리티

