# 멀티테넌트 구조 구현 가이드

> **관련 문서**: [README.md](./README.md) - 전체 문서 인덱스 | [데이터 스키마 분석 보고서](./schema_analysis.md) - 전체 스키마 구조

## 개요

TimeLevelUp에 멀티테넌트 구조를 적용하여 여러 학원/학교/교육기관이 각자 독립적인 공간에서 시스템을 사용할 수 있도록 구축했습니다.

## 구현된 기능

### 1. 데이터베이스 구조

#### tenants 테이블
- 기관(tenant) 정보를 저장하는 테이블
- 필드: `id`, `name`, `type`, `created_at`, `updated_at`
- 유형: `academy`(학원), `school`(학교), `enterprise`(기업), `other`(기타)

#### tenant_id 추가
다음 테이블에 `tenant_id` 컬럼이 추가되었습니다:

**사용자 테이블:**
- `students`
- `parent_users`
- `admin_users` (Super Admin은 `tenant_id = NULL`)

**Core Data 테이블:**
- `student_plan`
- `student_block_schedule`
- `student_school_scores`
- `student_mock_scores`
- `student_content_progress`
- `student_custom_contents`
- `recommended_contents`
- `student_analysis`
- `student_consulting_notes`
- `make_scenario_logs`
- `student_goals`
- `student_goal_progress`
- `student_study_sessions`
- `student_history`
- `books`
- `lectures`
- `parent_student_links`

### 2. RLS (Row Level Security) 정책

모든 테이블에 tenant 기반 접근 제어가 적용되었습니다:

- **Super Admin**: 모든 tenant 데이터 접근 가능 (`tenant_id IS NULL`)
- **Admin/Consultant**: 자신의 tenant 데이터만 접근 가능
- **Parent**: 연결된 학생의 tenant 데이터만 접근 가능
- **Student**: 자신의 tenant 데이터만 접근 가능

### 3. 유틸리티 함수

#### `getTenantContext()`
현재 사용자의 tenant context를 반환합니다.

```typescript
const context = await getTenantContext();
// { tenantId: string | null, role: 'superadmin' | 'admin' | 'consultant' | 'parent' | 'student', userId: string | null }
```

#### `getCurrentUserRole()`
기존 함수에 `tenantId` 필드가 추가되었습니다.

```typescript
const { userId, role, tenantId } = await getCurrentUserRole();
```

### 4. Admin UI

#### Super Admin 페이지
- `/admin/superadmin/tenants`: 기관 관리 페이지
  - 기관 생성/수정/삭제
  - 기관 목록 조회

#### Tenant Admin 페이지
- `/admin/tenant/settings`: 기관 설정 페이지
  - 기관 정보 수정
  - 소속 멤버 통계 (학생 수, 학부모 수, 관리자 수)

### 5. Navigation 구조

AdminSidebar가 업데이트되어:
- Super Admin만 "기관 관리" 메뉴 표시
- 모든 Admin/Consultant는 "기관 설정" 메뉴 표시

## 마이그레이션 파일

다음 마이그레이션 파일들이 생성되었습니다:

1. `20250107000000_create_tenants_table.sql`: tenants 테이블 생성
2. `20250107000001_add_tenant_id_to_users.sql`: 사용자 테이블에 tenant_id 추가
3. `20250107000002_add_tenant_id_to_core_tables.sql`: Core Data 테이블에 tenant_id 추가
4. `20250107000003_create_default_tenant_and_assign.sql`: Default Tenant 생성 및 기존 데이터 배정
5. `20250107000004_update_rls_policies_for_tenants.sql`: RLS 정책 업데이트

## 사용 방법

### 1. 마이그레이션 실행

Supabase에서 마이그레이션 파일을 순서대로 실행합니다.

### 2. Super Admin 생성

Super Admin은 `admin_users` 테이블에서 `role = 'admin'`이고 `tenant_id = NULL`인 사용자입니다.

```sql
-- Super Admin 생성 예시
INSERT INTO admin_users (id, role, tenant_id)
VALUES ('user-uuid', 'admin', NULL);
```

### 3. 새 기관 생성

Super Admin으로 로그인 후 `/admin/superadmin/tenants`에서 새 기관을 생성합니다.

### 4. 사용자 배정

새 기관에 사용자를 배정하려면 해당 사용자의 `tenant_id`를 업데이트합니다:

```sql
-- 학생 배정
UPDATE students SET tenant_id = 'tenant-uuid' WHERE id = 'student-uuid';

-- 학부모 배정
UPDATE parent_users SET tenant_id = 'tenant-uuid' WHERE id = 'parent-uuid';

-- 관리자 배정
UPDATE admin_users SET tenant_id = 'tenant-uuid' WHERE id = 'admin-uuid';
```

## Data Access Layer 업데이트

모든 데이터 접근 시 `tenant_id`를 포함해야 합니다:

### Insert 예시

```typescript
const tenantContext = await getTenantContext();
if (!tenantContext?.tenantId) {
  throw new Error("기관 정보를 찾을 수 없습니다.");
}

await supabase.from("student_plan").insert({
  tenant_id: tenantContext.tenantId,
  student_id: user.id,
  // ... 기타 필드
});
```

### Select 예시

```typescript
const tenantContext = await getTenantContext();
if (!tenantContext?.tenantId) {
  throw new Error("기관 정보를 찾을 수 없습니다.");
}

await supabase
  .from("student_plan")
  .select("*")
  .eq("tenant_id", tenantContext.tenantId)
  .eq("student_id", studentId);
```

### 42703 Fallback 패턴

컬럼이 없을 때를 대비한 fallback 패턴:

```typescript
let { error } = await supabase.from("student_plan").insert(payload);

if (error && error.code === "42703") {
  const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
  void _tenantId;
  void _studentId;
  ({ error } = await supabase.from("student_plan").insert(fallbackPayload));
}
```

## 보안 고려사항

1. **RLS 정책**: 모든 테이블에 RLS가 활성화되어 있어 tenant 기반 접근 제어가 자동으로 적용됩니다.
2. **Super Admin 권한**: Super Admin만 전체 데이터에 접근할 수 있으며, 일반 Admin/Consultant는 자신의 tenant 데이터만 접근 가능합니다.
3. **API 엔드포인트**: 모든 API 엔드포인트에서 tenant context를 확인하여 권한을 검증합니다.

## 향후 확장 가능성

1. **기관별 커스터마이징**: 로고, 테마, 운영정책 등
2. **B2B/B2E/B2G 확장**: 기업/정부 기관용 기능 추가
3. **라이선스 관리**: 기관별 사용자 수 제한, 기능 제한 등
4. **멀티 테넌트 분석**: 전체 통계 및 개별 기관 통계

## 주의사항

1. **기존 데이터**: 마이그레이션 시 모든 기존 데이터는 "Default Tenant"에 배정됩니다.
2. **Super Admin**: `tenant_id = NULL`인 Admin만 Super Admin으로 인식됩니다.
3. **데이터 무결성**: `tenant_id`는 NOT NULL 제약조건이 있어 항상 값이 있어야 합니다 (Super Admin 제외).

## 문제 해결

### tenant_id가 없는 경우
- `getTenantContext()`가 `null`을 반환하면 로그인 페이지로 리다이렉트
- 사용자에게 기관 배정 요청

### RLS 정책 오류
- Supabase 대시보드에서 RLS 정책 확인
- `get_user_tenant_id()` 및 `is_super_admin()` 함수가 정상 작동하는지 확인

### 데이터 접근 오류
- 모든 쿼리에 `tenant_id` 필터가 포함되어 있는지 확인
- Insert 시 `tenant_id`가 포함되어 있는지 확인

