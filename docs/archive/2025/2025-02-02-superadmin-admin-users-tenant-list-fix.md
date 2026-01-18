# Superadmin 관리자 계정 관리 - 테넌트 관리자 목록 표시 문제 수정

**작업일**: 2025-02-02  
**작업자**: AI Assistant  
**목적**: Superadmin 페이지에서 관리자 계정 관리 시 테넌트 관리자 목록이 표시되지 않는 문제 해결

---

## 문제 발견

### 1. RLS 정책으로 인한 데이터 접근 제한

**문제**:
- Superadmin이 관리자 계정 관리 페이지에서 모든 관리자를 조회하려 했지만
- 일반 Server Client를 사용하여 RLS (Row Level Security) 정책의 제약을 받음
- 결과적으로 다른 테넌트의 관리자들이 필터링되어 표시되지 않음

**원인**:
```typescript
// 문제가 있던 코드
const supabase = await createSupabaseServerClient();
const { data: adminUsers } = await supabase
  .from("admin_users")
  .select("id, role, created_at")  // tenant_id 미포함
  .order("created_at", { ascending: false });
```

---

### 2. tenant_id 정보 미포함

**문제**:
- 관리자 목록 조회 시 `tenant_id`를 select하지 않아서
- 테넌트 관리자와 Superadmin을 구분할 수 없음
- 기관 정보를 표시할 수 없음

---

## 해결 방법

### 1. Admin Client 사용으로 RLS 우회

**파일**: `app/(superadmin)/superadmin/admin-users/page.tsx`

**변경 사항**:
1. Admin Client (Service Role Key) 사용하여 RLS 우회
2. 모든 테넌트의 관리자를 조회할 수 있도록 수정
3. Fallback으로 Server Client도 지원

**구현 코드**:
```typescript
// Admin Client를 사용하여 모든 관리자 조회 (RLS 우회)
const adminClient = createSupabaseAdminClient();
let adminUsers = null;

if (!adminClient) {
  console.warn("[admin-users] Service Role Key가 설정되지 않았습니다.");
} else {
  // Admin Client로 모든 관리자 조회 (RLS 우회)
  const { data, error } = await adminClient
    .from("admin_users")
    .select("id, role, tenant_id, created_at")  // tenant_id 포함
    .order("created_at", { ascending: false });

  adminUsers = data;
  
  if (error) {
    console.error("[admin-users] 관리자 목록 조회 실패:", error);
  }
}

// Fallback: Admin Client를 사용할 수 없는 경우 Server Client로 시도
if (!adminClient || adminUsersError) {
  const supabase = await createSupabaseServerClient();
  // ...
}
```

---

### 2. tenant_id 조회 및 기관 정보 표시

**변경 사항**:
1. `tenant_id`를 select에 포함
2. 기관 정보 조회 및 매핑
3. 관리자 목록에 기관 이름 추가

**구현 코드**:
```typescript
// 기관 정보 조회 (tenant_id 목록 수집)
const tenantIds = Array.from(
  new Set(
    (adminUsers || [])
      .map((au: any) => au.tenant_id)
      .filter((tid: string | null) => tid !== null && tid !== undefined)
  )
);

// 기관 정보 조회
let tenantMap = new Map<string, string>();
if (tenantIds.length > 0) {
  const clientForTenants = adminClient || createSupabaseAdminClient();
  if (clientForTenants) {
    const { data: tenants } = await clientForTenants
      .from("tenants")
      .select("id, name")
      .in("id", tenantIds);

    if (tenants) {
      tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
    }
  }
}

// 관리자 목록에 이메일 및 기관 정보 추가
const adminUsersWithEmail =
  adminUsers?.map((adminUser: any) => {
    const user = allUsersData?.users.find((u) => u.id === adminUser.id);
    const tenantId = adminUser.tenant_id;
    const tenantName = tenantId ? tenantMap.get(tenantId) : null;

    return {
      ...adminUser,
      email: user?.email || "이메일 없음",
      tenant_id: tenantId || null,
      tenant_name: tenantName || null,
    };
  }) || [];
```

---

### 3. UI에 기관 정보 표시

**파일**: `app/(superadmin)/superadmin/admin-users/AdminUsersList.tsx`

**변경 사항**:
1. 타입에 `tenant_id`, `tenant_name` 추가
2. 테이블에 "기관" 컬럼 추가
3. 기관 이름 표시 (없으면 "—" 표시)

**UI 변경**:
```
이메일 | 역할 | 기관 | 생성일 | 작업
```

---

## 수정된 파일

### 1. `app/(superadmin)/superadmin/admin-users/page.tsx`

**주요 변경**:
- Admin Client를 사용하여 RLS 우회
- `tenant_id`를 select에 포함
- 기관 정보 조회 및 매핑
- 관리자 목록에 기관 정보 추가

### 2. `app/(superadmin)/superadmin/admin-users/AdminUsersList.tsx`

**주요 변경**:
- 타입에 `tenant_id`, `tenant_name` 추가
- 테이블에 "기관" 컬럼 추가
- 기관 이름 표시 UI 추가

---

## 결과

### 수정 전
- ❌ 테넌트 관리자 목록이 표시되지 않음
- ❌ RLS 정책으로 인해 다른 테넌트 관리자 접근 불가
- ❌ 기관 정보 표시 안 됨

### 수정 후
- ✅ 모든 관리자(Superadmin + 테넌트 관리자) 표시
- ✅ Admin Client로 RLS 우회하여 모든 데이터 접근 가능
- ✅ 기관 정보(기관 이름) 표시
- ✅ 테넌트 관리자와 Superadmin 구분 가능

---

## 테스트 체크리스트

- [x] Superadmin이 모든 관리자를 볼 수 있는지 확인
- [x] 테넌트 관리자가 목록에 표시되는지 확인
- [x] 기관 이름이 올바르게 표시되는지 확인
- [x] tenant_id가 null인 Superadmin도 올바르게 표시되는지 확인
- [x] Admin Client가 없을 때 Fallback이 작동하는지 확인

---

## 관련 파일

### 수정된 파일
1. `app/(superadmin)/superadmin/admin-users/page.tsx`
   - Admin Client 사용으로 변경
   - tenant_id 조회 및 기관 정보 매핑

2. `app/(superadmin)/superadmin/admin-users/AdminUsersList.tsx`
   - 타입에 tenant 정보 추가
   - UI에 기관 컬럼 추가

### 사용된 유틸리티
- `lib/supabase/admin.ts` - Admin Client 생성
- `lib/supabase/server.ts` - Server Client 생성 (Fallback)

---

## 결론

**RLS 정책 때문에 Superadmin이 다른 테넌트의 관리자를 볼 수 없었던 문제를 해결했습니다.**

- ✅ Admin Client를 사용하여 RLS 우회
- ✅ tenant_id 정보 포함하여 테넌트 관리자 구분
- ✅ 기관 이름 표시로 사용자 경험 개선

Superadmin이 이제 모든 관리자(Superadmin + 모든 테넌트의 관리자)를 확인할 수 있습니다.

