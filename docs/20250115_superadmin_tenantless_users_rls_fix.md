# Super Admin 테넌트 미할당 관리 기능 권한 문제 수정

**작업 일시**: 2025-01-15  
**목적**: Super admin의 테넌트 미할당 사용자 조회 기능에서 RLS 정책으로 인한 권한 문제 해결

---

## 문제 상황

Super admin이 테넌트 미할당 관리 페이지(`/superadmin/tenantless-users`)에서 테넌트가 할당되지 않은 학생을 조회할 수 없는 문제가 발생했습니다.

### 원인 분석

1. **RLS 정책 제한**: `getTenantlessUsers` 함수에서 일반 서버 클라이언트(`createSupabaseServerClient`)를 사용하여 학생, 학부모, 관리자 데이터를 조회하고 있었습니다.
2. **RLS 우회 필요**: 일반 서버 클라이언트는 RLS(Row Level Security) 정책의 영향을 받아, super admin이 모든 테넌트 미할당 사용자를 조회하지 못할 수 있습니다.
3. **Admin 클라이언트 미사용**: `adminClient`는 생성하고 있었지만, 실제 데이터 조회에는 사용하지 않고 있었습니다.

---

## 해결 방법

### 1. Admin 클라이언트 사용으로 변경

Super admin이 모든 데이터를 조회할 수 있도록 Admin 클라이언트(Service Role Key 사용)를 사용하여 RLS를 우회하도록 수정했습니다.

#### 수정된 함수

- `getTenantlessUsers()`: 테넌트 미할당 사용자 조회
- `assignTenantToUser()`: 단일 사용자 테넌트 할당
- `assignTenantToMultipleUsers()`: 다중 사용자 테넌트 할당

### 2. 변경 사항

#### `getTenantlessUsers` 함수

**변경 전**:
```typescript
const supabase = await createSupabaseServerClient();
const adminClient = createSupabaseAdminClient();

// 일반 서버 클라이언트 사용
const { data: students } = await supabase
  .from("students")
  .select("id, created_at")
  .is("tenant_id", null);
```

**변경 후**:
```typescript
// Super admin은 RLS를 우회하기 위해 Admin 클라이언트 사용
const adminClient = createSupabaseAdminClient();

if (!adminClient) {
  return {
    success: false,
    error: "Service Role Key가 설정되지 않았습니다. 관리자에게 문의하세요.",
  };
}

// Admin 클라이언트 사용 (RLS 우회)
const { data: students } = await adminClient
  .from("students")
  .select("id, created_at")
  .is("tenant_id", null);
```

#### `assignTenantToUser` 및 `assignTenantToMultipleUsers` 함수

테넌트 할당 함수들도 동일하게 Admin 클라이언트를 사용하도록 수정했습니다.

---

## 수정된 파일

- `app/(superadmin)/actions/tenantlessUserActions.ts`

### 주요 변경 사항

1. **학생 조회**: `adminClient` 사용으로 RLS 우회
2. **학부모 조회**: `adminClient` 사용으로 RLS 우회
3. **관리자 조회**: `adminClient` 사용으로 RLS 우회
4. **테넌트 할당**: `adminClient` 사용으로 RLS 우회
5. **에러 처리**: `adminClient`가 null인 경우 명확한 에러 메시지 반환

---

## 보안 고려사항

1. **Service Role Key**: Admin 클라이언트는 Service Role Key를 사용하므로 서버 사이드에서만 사용해야 합니다.
2. **권한 확인**: 모든 함수에서 super admin 권한을 확인하고 있습니다.
3. **RLS 우회**: Admin 클라이언트는 RLS를 우회하므로, 반드시 super admin 권한 확인 후 사용해야 합니다.

---

## 테스트 확인 사항

1. ✅ Super admin이 테넌트 미할당 학생을 조회할 수 있는지 확인
2. ✅ Super admin이 테넌트 미할당 학부모를 조회할 수 있는지 확인
3. ✅ Super admin이 테넌트 미할당 관리자를 조회할 수 있는지 확인
4. ✅ 테넌트 할당 기능이 정상적으로 작동하는지 확인
5. ✅ Service Role Key가 없는 경우 적절한 에러 메시지가 표시되는지 확인

---

## 참고 사항

- Admin 클라이언트는 `lib/supabase/admin.ts`에서 생성됩니다.
- Service Role Key는 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`에 설정되어야 합니다.
- RLS 정책은 데이터베이스 레벨에서 적용되므로, Admin 클라이언트를 사용하면 모든 정책을 우회할 수 있습니다.

---

**작업 완료**: Super admin이 테넌트 미할당 사용자를 정상적으로 조회하고 관리할 수 있도록 수정 완료

