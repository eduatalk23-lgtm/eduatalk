# Superadmin 페이지 404 에러 수정

**작업일**: 2025-02-02  
**작업자**: AI Assistant  
**목적**: Superadmin 페이지들의 404 에러를 수정하기 위해 파일 구조를 네비게이션 경로에 맞게 재구성

---

## 문제 발견

### 1. Next.js App Router 라우트 그룹 동작

**Next.js App Router 규칙**:
- 라우트 그룹 `(superadmin)`은 URL 경로에 포함되지 않음
- 실제 파일 구조와 URL 경로가 불일치

**문제 상황**:
- 네비게이션 설정: `/superadmin/tenants`, `/superadmin/admin-users`, `/superadmin/unverified-users`
- 실제 파일 구조:
  - `app/(superadmin)/tenants/page.tsx` → URL: `/tenants` ❌
  - `app/(superadmin)/admin-users/page.tsx` → URL: `/admin-users` ❌
  - `app/(superadmin)/unverified-users/page.tsx` → URL: `/unverified-users` ❌
- 올바른 구조:
  - `app/(superadmin)/superadmin/dashboard/page.tsx` → URL: `/superadmin/dashboard` ✅
  - `app/(superadmin)/superadmin/settings/page.tsx` → URL: `/superadmin/settings` ✅

---

## 해결 방법

### 파일 구조 재구성

모든 superadmin 페이지를 `superadmin/` 디렉토리 내부로 이동하여 일관된 경로 구조 생성:

#### 수정 전 구조
```
app/(superadmin)/
├── tenants/
│   ├── _components/
│   │   ├── TenantCard.tsx
│   │   ├── TenantForm.tsx
│   │   └── TenantList.tsx
│   └── page.tsx  → URL: /tenants ❌
├── admin-users/
│   ├── AdminUsersList.tsx
│   ├── CreateAdminUserForm.tsx
│   └── page.tsx  → URL: /admin-users ❌
├── unverified-users/
│   ├── _components/
│   │   └── UnverifiedUsersList.tsx
│   └── page.tsx  → URL: /unverified-users ❌
├── superadmin/
│   ├── dashboard/
│   │   └── page.tsx  → URL: /superadmin/dashboard ✅
│   └── settings/
│       └── page.tsx  → URL: /superadmin/settings ✅
└── layout.tsx
```

#### 수정 후 구조
```
app/(superadmin)/
├── superadmin/
│   ├── dashboard/
│   │   └── page.tsx  → URL: /superadmin/dashboard ✅
│   ├── tenants/
│   │   ├── _components/
│   │   │   ├── TenantCard.tsx
│   │   │   ├── TenantForm.tsx
│   │   │   └── TenantList.tsx
│   │   └── page.tsx  → URL: /superadmin/tenants ✅
│   ├── admin-users/
│   │   ├── AdminUsersList.tsx
│   │   ├── CreateAdminUserForm.tsx
│   │   └── page.tsx  → URL: /superadmin/admin-users ✅
│   ├── unverified-users/
│   │   ├── _components/
│   │   │   └── UnverifiedUsersList.tsx
│   │   └── page.tsx  → URL: /superadmin/unverified-users ✅
│   └── settings/
│       └── page.tsx  → URL: /superadmin/settings ✅
└── layout.tsx
```

---

## 수정된 파일

### 1. 새로 생성된 페이지

1. **`app/(superadmin)/superadmin/tenants/page.tsx`**
   - 기관 관리 페이지
   - 기존 `app/(superadmin)/tenants/page.tsx`를 올바른 위치로 이동

2. **`app/(superadmin)/superadmin/admin-users/page.tsx`**
   - 관리자 계정 관리 페이지
   - 기존 `app/(superadmin)/admin-users/page.tsx`를 올바른 위치로 이동

3. **`app/(superadmin)/superadmin/unverified-users/page.tsx`**
   - 미인증 가입 관리 페이지
   - 기존 `app/(superadmin)/unverified-users/page.tsx`를 올바른 위치로 이동

### 2. 이동된 컴포넌트

1. **TenantList, TenantForm, TenantCard**
   - `app/(superadmin)/tenants/_components/` → `app/(superadmin)/superadmin/tenants/_components/`

2. **AdminUsersList, CreateAdminUserForm**
   - `app/(superadmin)/admin-users/` → `app/(superadmin)/superadmin/admin-users/`

3. **UnverifiedUsersList**
   - `app/(superadmin)/unverified-users/_components/` → `app/(superadmin)/superadmin/unverified-users/_components/`

---

## 최종 URL 경로 확인

모든 superadmin 페이지가 올바른 경로로 접근 가능:

| 페이지 | URL 경로 | 상태 |
|--------|----------|------|
| 대시보드 | `/superadmin/dashboard` | ✅ |
| 기관 관리 | `/superadmin/tenants` | ✅ |
| 관리자 계정 | `/superadmin/admin-users` | ✅ |
| 미인증 가입 관리 | `/superadmin/unverified-users` | ✅ |
| 설정 | `/superadmin/settings` | ✅ |

---

## 네비게이션 설정 확인

**파일**: `components/navigation/global/categoryConfig.ts`

네비게이션 설정이 올바르게 되어 있음:

```typescript
const superadminCategories: NavigationCategory[] = [
  {
    id: "superadmin-dashboard",
    label: "대시보드",
    items: [{ href: "/superadmin/dashboard", ... }],
  },
  {
    id: "superadmin-tenants",
    label: "기관 관리",
    items: [{ href: "/superadmin/tenants", ... }],  // ✅ 올바른 경로
  },
  {
    id: "superadmin-users",
    label: "사용자 관리",
    items: [
      { href: "/superadmin/admin-users", ... },      // ✅ 올바른 경로
      { href: "/superadmin/unverified-users", ... }, // ✅ 올바른 경로
    ],
  },
  {
    id: "superadmin-settings",
    label: "설정",
    items: [{ href: "/superadmin/settings", ... }],
  },
];
```

---

## 결과

### 수정 전
- ❌ `/superadmin/tenants` → 404 에러 (실제 경로: `/tenants`)
- ❌ `/superadmin/admin-users` → 404 에러 (실제 경로: `/admin-users`)
- ❌ `/superadmin/unverified-users` → 404 에러 (실제 경로: `/unverified-users`)

### 수정 후
- ✅ 모든 네비게이션 링크가 올바른 페이지로 이동
- ✅ 파일 구조와 URL 경로가 일치
- ✅ 일관된 경로 구조 (`/superadmin/*`)

---

## 테스트 체크리스트

- [x] `/superadmin/dashboard` 페이지 접근 확인
- [x] `/superadmin/tenants` 페이지 접근 확인
- [x] `/superadmin/admin-users` 페이지 접근 확인
- [x] `/superadmin/unverified-users` 페이지 접근 확인
- [x] `/superadmin/settings` 페이지 접근 확인
- [x] 네비게이션 메뉴에서 모든 링크 작동 확인
- [x] 기존 파일 정리 (잘못된 위치의 파일 삭제)

---

## 관련 파일

### 새로 생성된 파일
- `app/(superadmin)/superadmin/tenants/page.tsx`
- `app/(superadmin)/superadmin/admin-users/page.tsx`
- `app/(superadmin)/superadmin/unverified-users/page.tsx`

### 이동된 컴포넌트
- `app/(superadmin)/superadmin/tenants/_components/` (전체 디렉토리)
- `app/(superadmin)/superadmin/admin-users/` (AdminUsersList.tsx, CreateAdminUserForm.tsx)
- `app/(superadmin)/superadmin/unverified-users/_components/` (UnverifiedUsersList.tsx)

### 삭제된 파일/디렉토리
- `app/(superadmin)/tenants/` (전체 디렉토리)
- `app/(superadmin)/admin-users/` (전체 디렉토리)
- `app/(superadmin)/unverified-users/` (전체 디렉토리)

---

## 결론

**Next.js App Router의 라우트 그룹 동작 방식을 고려하지 않아 발생한 문제였습니다.**

모든 superadmin 페이지를 `superadmin/` 디렉토리 내부로 통일하여:
- ✅ 네비게이션 설정과 실제 URL 경로가 일치
- ✅ 모든 페이지가 올바르게 접근 가능
- ✅ 일관된 파일 구조 유지

---

## 참고사항

### Next.js App Router 라우트 그룹 규칙

1. **라우트 그룹은 URL에 포함되지 않음**
   - `app/(superadmin)/tenants/page.tsx` → URL: `/tenants`
   - `app/(superadmin)/superadmin/tenants/page.tsx` → URL: `/superadmin/tenants`

2. **일관된 경로를 위해서는 라우트 그룹 내부에 명시적 디렉토리 필요**
   - 모든 superadmin 페이지는 `superadmin/` 디렉토리 내부에 위치

3. **레이아웃 공유**
   - 라우트 그룹의 `layout.tsx`는 해당 그룹의 모든 페이지에 적용됨
   - `app/(superadmin)/layout.tsx`는 모든 superadmin 페이지에 적용

