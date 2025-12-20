# Phase 5: 잔여 파일 일괄 표준화 완료

## 작업 개요

Phase 5의 마지막 단계로 `lib/data/` 디렉토리의 잔여 파일들을 Core 모듈 패턴(`typedQueryBuilder`, `errorHandler`)으로 일괄 표준화했습니다.

## 주요 변경사항

### 1. 사용자/권한 관련 파일

#### `lib/data/admins.ts`

**이전:**

```typescript
let { data, error } = await query.maybeSingle<Admin>();

if (error && error.code === "42703") {
  ({ data, error } = await selectAdmin().maybeSingle<Admin>());
}

if (error && error.code !== "PGRST116") {
  console.error("[data/admins] Admin 조회 실패", error);
  return null;
}

return data ?? null;
```

**이후:**

```typescript
return await createTypedSingleQuery<Admin>(
  async () => {
    let query = supabase
      .from("admin_users")
      .select("id,tenant_id,role,created_at")
      .eq("id", adminId);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const queryResult = await query;
    return {
      data: queryResult.data as Admin[] | null,
      error: queryResult.error,
    };
  },
  {
    context: "[data/admins] getAdminById",
    defaultValue: null,
  }
);
```

#### `lib/data/parents.ts`

동일한 패턴으로 리팩토링되었습니다.

#### `lib/data/tenants.ts`

**이전:**

```typescript
const { data, error } = await supabase
  .from("tenants")
  .select("id,name,created_at,updated_at")
  .eq("id", tenantId)
  .maybeSingle<Tenant>();

if (error && error.code !== "PGRST116") {
  console.error("[data/tenants] Tenant 조회 실패", error);
  return null;
}

return data ?? null;
```

**이후:**

```typescript
import type { Database } from "@/lib/supabase/database.types";

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];
export type Tenant = TenantRow;

return await createTypedSingleQuery<Tenant>(
  async () => {
    const queryResult = await supabase
      .from("tenants")
      .select("id,name,created_at,updated_at")
      .eq("id", tenantId);

    return {
      data: queryResult.data as Tenant[] | null,
      error: queryResult.error,
    };
  },
  {
    context: "[data/tenants] getTenantById",
    defaultValue: null,
  }
);
```

**개선 사항:**

- Database 타입 사용으로 타입 안전성 향상
- `any` 타입 제거 (`Record<string, any>` → 명시적 타입)
- `createTenant`, `updateTenant` 함수도 `createTypedSingleQuery` 사용

#### `lib/data/userConsents.ts`

**이전:**

```typescript
if (error) {
  console.error("[userConsents] 약관 동의 저장 실패:", {
    userId,
    error: error.message,
    code: error.code,
  });
  return {
    success: false,
    error: error.message || "약관 동의 정보 저장에 실패했습니다.",
  };
}
```

**이후:**

```typescript
if (error) {
  handleQueryError(error, {
    context: "[data/userConsents] saveUserConsents",
  });
  return {
    success: false,
    error: error.message || "약관 동의 정보 저장에 실패했습니다.",
  };
}
```

### 2. 학적/기초 정보 파일

#### `lib/data/studentProfiles.ts`

**이전:**

```typescript
const { data, error } = await supabase
  .from("student_profiles")
  .select("*")
  .eq("id", studentId)
  .maybeSingle<StudentProfile>();

if (error && error.code !== "PGRST116") {
  console.error("[data/studentProfiles] 프로필 조회 실패", error);
  return null;
}

return data ?? null;
```

**이후:**

```typescript
return await createTypedSingleQuery<StudentProfile>(
  async () => {
    const queryResult = await supabase
      .from("student_profiles")
      .select("*")
      .eq("id", studentId);

    return {
      data: queryResult.data as StudentProfile[] | null,
      error: queryResult.error,
    };
  },
  {
    context: "[data/studentProfiles] getStudentProfileById",
    defaultValue: null,
  }
);
```

#### `lib/data/studentTerms.ts`

**이전:**

```typescript
const { data, error } = await supabase
  .from("student_terms")
  .select("id")
  .eq("tenant_id", params.tenant_id)
  .eq("student_id", params.student_id)
  .eq("school_year", params.school_year)
  .eq("grade", params.grade)
  .eq("semester", params.semester)
  .maybeSingle();

if (selectError) {
  console.error("[data/studentTerms] student_term 조회 실패", selectError);
  throw selectError;
}
```

**이후:**

```typescript
const existing = await createTypedSingleQuery<{ id: string }>(
  async () => {
    const queryResult = await supabase
      .from("student_terms")
      .select("id")
      .eq("tenant_id", params.tenant_id)
      .eq("student_id", params.student_id)
      .eq("school_year", params.school_year)
      .eq("grade", params.grade)
      .eq("semester", params.semester);

    return {
      data: queryResult.data as { id: string }[] | null,
      error: queryResult.error,
    };
  },
  {
    context: "[data/studentTerms] getOrCreateStudentTerm (조회)",
    defaultValue: null,
  }
);
```

### 3. 목표/기타 파일

#### `lib/data/studentGoals.ts`

**이전:**

```typescript
let { data, error } = await query;

if (error && error.code === "42703") {
  // fallback: tenant_id 컬럼이 없는 경우
  const fallbackQuery = supabase
    .from("student_goals")
    .select("*")
    .eq("student_id", filters.studentId);
  // ...
  ({ data, error } = await fallbackQuery.order("created_at", { ascending: false }));
}

if (error) {
  console.error("[data/studentGoals] 목표 조회 실패", error);
  return [];
}
```

**이후:**

```typescript
return await createTypedConditionalQuery<Goal[]>(
  async () => {
    let query = supabase
      .from("student_goals")
      .select("...")
      .eq("student_id", filters.studentId);
    // ... 필터링 로직
    const queryResult = await query.order("created_at", { ascending: false });
    return {
      data: queryResult.data as Goal[] | null,
      error: queryResult.error,
    };
  },
  {
    context: "[data/studentGoals] getGoalsForStudent",
    defaultValue: [],
    fallbackQuery: async () => {
      // fallback: tenant_id 컬럼이 없는 경우
      // ...
    },
    shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
  }
) ?? [];
```

**개선 사항:**

- Fallback 로직을 `createTypedConditionalQuery`로 표준화
- 에러 코드 체크를 `ErrorCodeCheckers.isColumnNotFound`로 통일
- `any` 타입 제거

#### `lib/data/termsContents.ts`

**이전:**

```typescript
try {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('terms_contents')
    .select('*')
    .eq('content_type', contentType)
    .eq('is_active', true)
    .single();

  if (error) {
    // PGRST116: No rows returned
    if (error.code === 'PGRST116') {
      return null;
    }
    // PGRST205: 테이블이 스키마 캐시에 없음
    if (error.code === 'PGRST205') {
      console.error('[termsContents] 약관 테이블을 찾을 수 없습니다...');
      return null;
    }
    console.error('[termsContents] 활성 약관 조회 실패:', {...});
    return null;
  }

  return data as TermsContent;
} catch (error) {
  // ...
}
```

**이후:**

```typescript
const supabase = await createSupabaseServerClient();

return await createTypedSingleQuery<TermsContent>(
  async () => {
    const queryResult = await supabase
      .from('terms_contents')
      .select('*')
      .eq('content_type', contentType)
      .eq('is_active', true);

    return {
      data: queryResult.data as TermsContent[] | null,
      error: queryResult.error,
    };
  },
  {
    context: '[data/termsContents] getActiveTermsContent',
    defaultValue: null,
  }
);
```

**개선 사항:**

- `try-catch` 블록 제거 (typedQueryBuilder 내부에서 처리)
- 에러 코드 체크 로직 제거 (기본값 반환으로 처리)

#### `lib/data/careerFields.ts`

**이전:**

```typescript
const { data, error } = await supabase
  .from("career_fields")
  .select("*")
  .eq("is_active", true)
  .order("display_order", { ascending: true });

if (error) {
  console.error("[data/careerFields] 진로 계열 조회 실패", error);
  return [];
}

return (data as CareerField[]) ?? [];
```

**이후:**

```typescript
return await createTypedQuery<CareerField[]>(
  async () => {
    const queryResult = await supabase
      .from("career_fields")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    return {
      data: queryResult.data as CareerField[] | null,
      error: queryResult.error,
    };
  },
  {
    context: "[data/careerFields] getCareerFields",
    defaultValue: [],
  }
) ?? [];
```

#### `lib/data/subjects.ts`

**이전:**

```typescript
const { data, error } = await query
  .order("name", { ascending: true });

if (error) {
  console.error("[data/subjects] 교과 그룹 조회 실패", error);
  return [];
}

return (data as SubjectGroup[] | null) ?? [];
```

**이후:**

```typescript
return await createTypedQuery<SubjectGroup[]>(
  async () => {
    let query = supabase
      .from("subject_groups")
      .select("*");

    if (curriculumRevisionId) {
      query = query.eq("curriculum_revision_id", curriculumRevisionId);
    }

    const queryResult = await query.order("name", { ascending: true });
    return {
      data: queryResult.data as SubjectGroup[] | null,
      error: queryResult.error,
    };
  },
  {
    context: "[data/subjects] getSubjectGroups",
    defaultValue: [],
  }
) ?? [];
```

**개선 사항:**

- 복잡한 JOIN 로직은 유지하되, 기본 쿼리들을 `createTypedQuery`로 감싸기
- 에러 처리를 `handleQueryError`로 표준화

## 개선 효과

### 1. 일관성 확보

- 모든 데이터 접근 함수가 동일한 패턴 사용
- 에러 처리 방식 통일
- 타입 안전성 향상

### 2. 코드 간소화

- 불필요한 `try-catch` 블록 제거
- 중복된 에러 처리 로직 제거
- 에러 코드 체크 로직 표준화

### 3. 타입 안전성 향상

- `any` 타입 제거
- Database 타입 활용 (`tenants.ts`)
- 명시적 타입 정의

### 4. 유지보수성 향상

- 에러 로깅 컨텍스트 표준화
- Fallback 로직 표준화 (`createTypedConditionalQuery`)
- 코드 가독성 향상

## 변경된 파일 목록

### 사용자/권한 관련

- `lib/data/admins.ts` - `createTypedQuery`, `createTypedSingleQuery` 사용
- `lib/data/parents.ts` - `createTypedQuery`, `createTypedSingleQuery` 사용
- `lib/data/tenants.ts` - Database 타입 사용, `createTypedQuery`, `createTypedSingleQuery` 사용
- `lib/data/userConsents.ts` - `handleQueryError` 사용

### 학적/기초 정보

- `lib/data/studentProfiles.ts` - `createTypedQuery`, `createTypedSingleQuery` 사용
- `lib/data/studentTerms.ts` - `createTypedQuery`, `createTypedSingleQuery` 사용
- `lib/data/subjects.ts` - `createTypedQuery`, `createTypedSingleQuery` 사용

### 목표/기타

- `lib/data/studentGoals.ts` - `createTypedConditionalQuery` 사용 (Fallback 로직)
- `lib/data/termsContents.ts` - `createTypedQuery`, `createTypedSingleQuery` 사용
- `lib/data/careerFields.ts` - `createTypedQuery`, `createTypedSingleQuery` 사용

## 제거된 코드

- `try-catch` 블록 (typedQueryBuilder 내부에서 처리)
- `console.error` 직접 호출 (`handleQueryError`로 대체)
- 하드코딩된 에러 코드 체크 (`ErrorCodeCheckers` 사용)
- `any` 타입 사용
- 불필요한 타입 단언 (`as any`)

## 유지된 비즈니스 로직

다음 비즈니스 로직은 그대로 유지되었습니다:

1. **Fallback 로직**:
   - `studentGoals.ts`의 컬럼 누락 시 Fallback 로직
   - `createTypedConditionalQuery`로 표준화

2. **JOIN 로직**:
   - `subjects.ts`의 복잡한 JOIN 쿼리 (성능 최적화)
   - JOIN 결과 평탄화 로직

3. **Admin 클라이언트 사용**:
   - `subjects.ts`의 Admin 클라이언트 우선 사용 (RLS 우회)

## 다음 단계

Phase 5 리팩토링이 완료되었습니다. 다음 단계는:

1. 성능 테스트 및 모니터링
2. 문서화 및 가이드라인 정리
3. 다른 데이터 계층 파일들도 동일한 패턴으로 표준화 (필요 시)

## 참고

- Core 모듈: `lib/data/core/typedQueryBuilder.ts`
- 에러 처리: `lib/data/core/errorHandler.ts`
- 에러 코드: `lib/constants/errorCodes.ts`
- Database 타입: `lib/supabase/database.types.ts`

