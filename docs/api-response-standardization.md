# API 응답 규격 표준화

## 📋 작업 개요

모든 API 응답을 `success/data/error` 형식으로 통일했습니다.

## 🎯 목표

1. **일관성**: 모든 API가 동일한 응답 형식 사용
2. **예측 가능성**: 클라이언트에서 응답 처리 단순화
3. **에러 처리**: 구조화된 에러 정보 제공
4. **타입 안전성**: TypeScript 타입 완전 지원

## 📁 생성된 파일

```
lib/api/
├── types.ts       # API 응답 타입 정의
├── response.ts    # 응답 헬퍼 함수
└── index.ts       # Public API
```

## 📊 응답 형식

### 성공 응답

```typescript
{
  success: true,
  data: T,           // 실제 데이터
  meta?: {           // 선택적 메타 정보
    pagination?: {
      page: number,
      pageSize: number,
      totalCount: number,
      totalPages: number,
      hasNextPage: boolean,
      hasPreviousPage: boolean
    },
    timestamp?: string,
    requestId?: string
  }
}
```

### 에러 응답

```typescript
{
  success: false,
  error: {
    code: ApiErrorCode,  // 에러 코드
    message: string,     // 사용자 친화적 메시지
    details?: object     // 추가 정보 (검증 에러 등)
  }
}
```

## 🔧 에러 코드

| 코드 | HTTP | 설명 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 로그인 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `SESSION_EXPIRED` | 401 | 세션 만료 |
| `BAD_REQUEST` | 400 | 잘못된 요청 |
| `VALIDATION_ERROR` | 400 | 검증 실패 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 충돌 |
| `DUPLICATE_ENTRY` | 409 | 중복 |
| `RATE_LIMITED` | 429 | 요청 제한 |
| `INTERNAL_ERROR` | 500 | 서버 오류 |
| `DATABASE_ERROR` | 500 | DB 오류 |
| `BUSINESS_ERROR` | 422 | 비즈니스 로직 오류 |

## 📖 사용 예시

### API 라우트에서 사용

```typescript
import {
  apiSuccess,
  apiSuccessList,
  apiCreated,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  apiValidationError,
  apiNotFound,
  handleApiError,
} from "@/lib/api";

// 성공 응답
export async function GET() {
  try {
    const data = await fetchData();
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error, "[api/example]");
  }
}

// 목록 응답 (페이지네이션)
export async function GET() {
  const items = await fetchItems({ page, pageSize });
  const totalCount = await countItems();

  return apiSuccessList(items, {
    page,
    pageSize,
    totalCount,
  });
}

// 생성 응답 (201)
export async function POST() {
  const created = await createItem(data);
  return apiCreated(created);
}

// 인증 에러
if (!user) {
  return apiUnauthorized();
}

// 권한 에러
if (user.role !== "admin") {
  return apiForbidden("관리자만 접근할 수 있습니다.");
}

// 검증 에러
if (!name) {
  return apiValidationError("입력값이 올바르지 않습니다.", {
    name: ["이름은 필수입니다."],
  });
}

// Not Found
const item = await findItem(id);
if (!item) {
  return apiNotFound("항목을 찾을 수 없습니다.");
}

// 예외 처리 (자동 로깅 포함)
try {
  // ...
} catch (error) {
  return handleApiError(error, "[api/users]");
}
```

### 클라이언트에서 사용

```typescript
import { isApiSuccess, isApiError } from "@/lib/api";

async function fetchData() {
  const response = await fetch("/api/users");
  const result = await response.json();

  if (isApiSuccess(result)) {
    // result.data 사용
    console.log(result.data);

    // 페이지네이션 정보
    if (result.meta?.pagination) {
      console.log(`${result.meta.pagination.page} / ${result.meta.pagination.totalPages}`);
    }
  } else {
    // result.error 처리
    console.error(`${result.error.code}: ${result.error.message}`);

    // 특정 에러 처리
    if (result.error.code === "UNAUTHORIZED") {
      router.push("/login");
    }
  }
}
```

## 🔄 마이그레이션된 API

| API | 메서드 | 변경 사항 |
|-----|--------|----------|
| `/api/schools/search` | GET | `{ schools: [] }` → `{ success, data: { schools } }` |
| `/api/tenants` | POST | `data` → `{ success, data }` |
| `/api/tenants/[id]` | PUT, DELETE | 표준 형식 적용 |
| `/api/goals/list` | GET | `{ goals: [] }` → `{ success, data: { goals } }` |
| `/api/today/plans` | GET | 표준 형식 적용 |
| `/api/today/progress` | GET | 표준 형식 적용 |
| `/api/auth/check-superadmin` | GET | 표준 형식 적용 |
| `/api/admin/check-student-scores` | GET | 표준 형식 적용 |

## ✅ 개선 사항

1. **일관된 응답 형식**: 모든 API가 동일한 구조
2. **타입 안전성**: TypeScript 타입 완전 지원
3. **에러 처리 단순화**: `handleApiError`로 예외 자동 처리
4. **로깅 통합**: 에러 발생 시 자동 로깅
5. **Supabase 에러 매핑**: DB 에러를 적절한 API 에러로 변환

## 🔜 향후 작업

1. **나머지 API 마이그레이션**: `master-content-*`, `student-content-*` 등
2. **클라이언트 훅 생성**: `useFetch`, `useMutation` 등
3. **에러 바운더리 통합**: API 에러를 UI에서 자동 처리
4. **API 문서 자동 생성**: OpenAPI/Swagger 스펙 생성

## 📝 주의사항

1. **기존 클라이언트 업데이트 필요**: 응답 형식이 변경되었으므로 클라이언트 코드도 업데이트 필요
2. **에러 코드 일관성**: 새 API 작성 시 정의된 에러 코드 사용
3. **로깅 접두사**: `handleApiError`에 로깅 접두사 전달 권장

