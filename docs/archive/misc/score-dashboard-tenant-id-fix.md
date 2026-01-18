# 성적 대시보드 Tenant ID 처리 수정

## 작업 일시
2025-11-28

## 문제 상황

성적 대시보드 통합 페이지(`/scores/dashboard/unified`)에서 API 호출 시 500 에러가 발생했습니다.

### 에러 로그
```
[api/score-dashboard] 학생 조회 실패 {
  error: {
    code: '22P02',
    message: 'invalid input syntax for type uuid: "undefined"'
  }
}
GET /api/students/.../score-dashboard?tenantId=undefined&grade=2&semester=1 500
```

## 원인 분석

### 1. 잘못된 필드명 사용

**파일**: `app/(student)/scores/dashboard/unified/page.tsx` (50번째 줄)

```typescript
// ❌ 잘못된 필드명
const tenantContext = await getTenantContext();
const tenantId = tenantContext.id;  // TenantContext에 id 필드가 없음
```

**문제점**:
- `TenantContext` 타입의 필드명은 `tenantId`인데 `id`로 접근
- `tenantContext.id`는 `undefined`를 반환
- API 호출 시 `tenantId=undefined`로 전달됨

### 2. API에서 tenantId 필수 처리

**파일**: `app/api/students/[id]/score-dashboard/route.ts`

```typescript
// ❌ tenantId를 필수로 처리
if (!tenantId) {
  return NextResponse.json(
    { error: "tenantId is required" },
    { status: 400 }
  );
}
```

**문제점**:
- `tenantId`가 `null`일 수 있는 경우(예: Default Tenant 사용)를 고려하지 않음
- 학생의 `tenant_id`를 fallback으로 사용하지 않음

### 3. UUID 타입 검증 실패

DB에서 `tenant_id`는 UUID 타입인데, `"undefined"` 문자열이 전달되어 타입 검증 실패:
```sql
-- 실행된 쿼리
SELECT * FROM students WHERE tenant_id = 'undefined'  -- ❌ UUID 타입 에러
```

## 해결 방법

### 1. TenantContext 필드명 수정

**파일**: `app/(student)/scores/dashboard/unified/page.tsx`

```typescript
// ✅ 올바른 필드명 사용
const tenantId = tenantContext.tenantId;
```

### 2. API에서 tenantId null 처리

**파일**: `app/api/students/[id]/score-dashboard/route.ts`

```typescript
// ✅ "null"이나 "undefined" 문자열을 실제 null로 변환
const tenantIdParam = searchParams.get("tenantId");
const tenantId = tenantIdParam === "null" || tenantIdParam === "undefined" ? null : tenantIdParam;
```

### 3. 학생의 tenant_id를 fallback으로 사용

```typescript
// ✅ tenantId가 없으면 학생의 tenant_id 사용
const effectiveTenantId = tenantId || student.tenant_id;

if (!effectiveTenantId) {
  return NextResponse.json(
    { error: "Tenant ID not found for student" },
    { status: 400 }
  );
}
```

### 4. 조건부 쿼리 처리

```typescript
// ✅ tenantId가 있을 때만 조건에 추가
let studentQuery = supabase
  .from("students")
  .select("id, name, grade, class, school_id, school_type, tenant_id")
  .eq("id", studentId);

if (tenantId) {
  studentQuery = studentQuery.eq("tenant_id", tenantId);
}

const { data: student } = await studentQuery.maybeSingle();
```

### 5. fetchScoreDashboard 함수 수정

**파일**: `lib/api/scoreDashboard.ts`

```typescript
// ✅ tenantId가 null이면 "null" 문자열로 전달 (파라미터로)
url.searchParams.set("tenantId", tenantId ?? "null");
```

## 수정된 파일

### 1. `app/(student)/scores/dashboard/unified/page.tsx`

**변경 내용**:
- `tenantContext.id` → `tenantContext.tenantId`

### 2. `app/api/students/[id]/score-dashboard/route.ts`

**변경 내용**:
- `tenantId` 파라미터를 선택적으로 처리
- `"null"`, `"undefined"` 문자열을 실제 `null`로 변환
- 학생 조회 시 `tenantId` 조건부 추가
- `effectiveTenantId` 도입 (tenantId || student.tenant_id)
- `student_terms` 조회 시 `tenantId` 조건부 추가
- `getInternalAnalysis`, `getMockAnalysis`에 `effectiveTenantId` 전달

### 3. `lib/api/scoreDashboard.ts`

**변경 내용**:
- `tenantId`가 `null`일 때 `"null"` 문자열로 전달

## 주요 변경 사항 요약

### Before

```typescript
// unified/page.tsx
const tenantId = tenantContext.id;  // undefined

// route.ts
if (!tenantId) {
  return error;
}

const { data: student } = await supabase
  .from("students")
  .eq("id", studentId)
  .eq("tenant_id", tenantId)  // "undefined" 전달
  .maybeSingle();
```

### After

```typescript
// unified/page.tsx
const tenantId = tenantContext.tenantId;  // null or string

// route.ts
const tenantId = tenantIdParam === "null" || tenantIdParam === "undefined" ? null : tenantIdParam;

let studentQuery = supabase
  .from("students")
  .eq("id", studentId);

if (tenantId) {
  studentQuery = studentQuery.eq("tenant_id", tenantId);
}

const { data: student } = await studentQuery.maybeSingle();

// student.tenant_id를 fallback으로 사용
const effectiveTenantId = tenantId || student.tenant_id;
```

## 테스트 시나리오

### 1. tenantId가 null인 경우
- ✅ 학생 조회 시 `tenant_id` 조건 제외
- ✅ 학생의 `tenant_id`를 `effectiveTenantId`로 사용
- ✅ 내신/모의고사 분석 정상 작동

### 2. tenantId가 있는 경우
- ✅ 학생 조회 시 `tenant_id` 조건 포함
- ✅ 해당 tenant의 학생만 조회
- ✅ 내신/모의고사 분석 정상 작동

## 관련 타입 정의

```typescript
// lib/tenant/getTenantContext.ts
export type TenantContext = {
  tenantId: string | null;  // ✅ 필드명: tenantId (id가 아님)
  role: "superadmin" | "admin" | "consultant" | "parent" | "student" | null;
  userId: string | null;
};
```

## 영향 범위

- ✅ 성적 대시보드 통합 페이지 정상 작동
- ✅ Default Tenant 사용 학생도 대시보드 접근 가능
- ✅ UUID 타입 검증 에러 해결
- ✅ 500 에러 제거

## 추가 개선 사항

향후 고려할 사항:

1. **타입 안전성 강화**: `TenantContext` 타입을 더 명확하게 정의
2. **에러 메시지 개선**: `tenantId` 관련 에러 메시지 구체화
3. **로깅 강화**: `effectiveTenantId` 사용 시 로그 추가
4. **테스트 케이스 추가**: tenantId null 케이스 테스트

## 결론

`TenantContext`의 올바른 필드명(`tenantId`)을 사용하고, API에서 `tenantId`가 `null`일 수 있는 경우를 처리하여 성적 대시보드가 정상 작동하도록 수정했습니다. 또한 학생의 `tenant_id`를 fallback으로 사용하여 더 유연한 처리가 가능해졌습니다.

