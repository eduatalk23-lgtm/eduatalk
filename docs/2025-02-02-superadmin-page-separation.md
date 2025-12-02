# Super Admin 전용 페이지 분리 구현

## 개요
Super Admin을 위한 독립적인 페이지 구조를 생성하여 일반 Admin과 역할을 명확히 구분하고, Super Admin 전용 기능을 체계적으로 관리합니다.

## 구현 내용

### 1. Super Admin 전용 레이아웃 및 네비게이션

#### 1.1 레이아웃 생성
- **파일**: `app/(superadmin)/layout.tsx`
- Super Admin 전용 레이아웃 컴포넌트 생성
- `getCurrentUserRole()`로 superadmin 권한 체크
- `RoleBasedLayout`에 `role="admin"` 전달 (네비게이션은 별도 처리)
- `dashboardHref="/superadmin/dashboard"` 설정

#### 1.2 네비게이션 설정
- **파일**: `components/navigation/global/categoryConfig.ts`
- `NavigationRole` 타입에 `"superadmin"` 추가
- `superadminCategories` 배열 추가:
  - 대시보드 (`/superadmin/dashboard`)
  - 기관 관리 (`/superadmin/tenants`)
  - 관리자 계정 (`/superadmin/admin-users`)
  - 미인증 가입 관리 (`/superadmin/unverified-users`)
  - 설정 (`/superadmin/settings`)
- `categoryConfig`에 `superadmin: superadminCategories` 추가

#### 1.3 CategoryNav 및 RoleBasedLayout 수정
- **파일**: `components/navigation/global/CategoryNav.tsx`, `components/layout/RoleBasedLayout.tsx`
- `role === "superadmin"`인 경우 `superadminCategories` 사용하도록 수정
- `RoleBasedLayout`의 `role` prop 타입에 `"superadmin"` 추가

### 2. Super Admin 전용 대시보드

#### 2.1 대시보드 데이터 페칭 함수
- **파일**: `lib/data/superadminDashboard.ts`
- `getTenantStatistics()`: 기관 통계 조회
- `getUserStatistics()`: 사용자 통계 조회
- `getRecentTenants()`: 최근 생성된 기관 조회

#### 2.2 대시보드 페이지
- **파일**: `app/(superadmin)/dashboard/page.tsx`
- 전체 기관 통계 (기관 수, 활성 기관 수, 비활성 기관 수, 정지된 기관 수)
- 전체 사용자 통계 (학생 수, 학부모 수, 관리자 수, 컨설턴트 수, Super Admin 수)
- 최근 생성된 기관 목록
- 빠른 액션 링크

### 3. 기존 페이지 이동

#### 3.1 기관 관리 페이지
- **기존**: `app/(admin)/admin/superadmin/tenants/`
- **신규**: `app/(superadmin)/tenants/`
- `page.tsx` 및 `_components/` 디렉토리 이동
- 권한 체크 수정: `role !== "superadmin"` → `role !== "superadmin"` (직접 체크)

#### 3.2 관리자 계정 페이지
- **기존**: `app/(admin)/admin/admin-users/`
- **신규**: `app/(superadmin)/admin-users/`
- `page.tsx`, `AdminUsersList.tsx`, `CreateAdminUserForm.tsx` 이동
- 권한 체크 수정: `role !== "superadmin"` → `role !== "superadmin"` (직접 체크)
- `AdminUsersList`에서 superadmin 역할 표시 추가

#### 3.3 미인증 가입 관리 페이지
- **기존**: `app/(admin)/admin/unverified-users/`
- **신규**: `app/(superadmin)/unverified-users/`
- `page.tsx` 및 `_components/UnverifiedUsersList.tsx` 이동
- 페이지네이션 링크 경로 수정: `/admin/unverified-users` → `/superadmin/unverified-users`
- 권한 체크 수정: `role !== "superadmin"` → `role !== "superadmin"` (직접 체크)

### 4. 리다이렉트 및 경로 정리

#### 4.1 app/page.tsx 수정
- superadmin 리다이렉트 경로를 `/admin/dashboard` → `/superadmin/dashboard`로 변경

#### 4.2 app/login/page.tsx 수정
- superadmin 리다이렉트 경로를 `/admin/dashboard` → `/superadmin/dashboard`로 변경

#### 4.3 기존 경로 제거
- `app/(admin)/admin/superadmin/` 디렉토리 삭제
- `app/(admin)/admin/admin-users/` 디렉토리 삭제
- `app/(admin)/admin/unverified-users/` 디렉토리 삭제

### 5. 네비게이션 및 링크 업데이트

#### 5.1 categoryConfig.ts 업데이트
- `adminCategories`에서 Super Admin 전용 메뉴 제거:
  - "기관 관리" (`admin-tenants`)
  - "관리자 계정" (`admin-users`)
  - "미인증 가입 관리" (`admin-unverified-users`)

#### 5.2 설정 페이지 업데이트
- **파일**: `app/(admin)/admin/settings/page.tsx`
- Super Admin 링크 제거 (일반 admin은 더 이상 Super Admin 페이지에 접근 불가)

## 주요 변경 사항

### 권한 체크 방식
- 모든 Super Admin 페이지에서 `role !== "superadmin"` 직접 체크 사용
- `isSuperAdmin()` 유틸리티 함수는 사용하지 않음 (직접 체크로 통일)

### 네비게이션 구조
- Super Admin과 일반 Admin의 네비게이션이 완전히 분리됨
- Super Admin은 전용 메뉴를 통해 접근
- 일반 Admin은 Super Admin 페이지에 접근할 수 없음

### 경로 구조
```
app/
├── (admin)/          # 일반 Admin 페이지
│   └── admin/
└── (superadmin)/     # Super Admin 전용 페이지
    ├── dashboard/
    ├── tenants/
    ├── admin-users/
    └── unverified-users/
```

## 테스트 체크리스트

- [x] Super Admin으로 로그인 시 `/superadmin/dashboard`로 리다이렉트
- [x] Super Admin 전용 네비게이션 메뉴 표시 확인
- [x] 기관 관리 페이지 접근 가능
- [x] 관리자 계정 페이지 접근 가능
- [x] 미인증 가입 관리 페이지 접근 가능
- [x] 일반 Admin이 Super Admin 페이지 접근 불가 확인
- [x] 기존 경로 접근 시 404 또는 적절한 에러 처리

## 주의사항

- 기존 경로를 완전히 제거하므로 북마크나 외부 링크가 깨질 수 있음
- Super Admin 전용 기능은 일반 Admin이 접근할 수 없도록 권한 체크 필수
- 네비게이션에서 Super Admin과 일반 Admin 메뉴가 섞이지 않도록 주의

## 관련 파일

### 신규 생성
- `app/(superadmin)/layout.tsx`
- `app/(superadmin)/dashboard/page.tsx`
- `app/(superadmin)/tenants/page.tsx`
- `app/(superadmin)/tenants/_components/TenantList.tsx`
- `app/(superadmin)/tenants/_components/TenantForm.tsx`
- `app/(superadmin)/tenants/_components/TenantCard.tsx`
- `app/(superadmin)/admin-users/page.tsx`
- `app/(superadmin)/admin-users/AdminUsersList.tsx`
- `app/(superadmin)/admin-users/CreateAdminUserForm.tsx`
- `app/(superadmin)/unverified-users/page.tsx`
- `app/(superadmin)/unverified-users/_components/UnverifiedUsersList.tsx`
- `lib/data/superadminDashboard.ts`

### 수정
- `components/navigation/global/categoryConfig.ts`
- `components/layout/RoleBasedLayout.tsx`
- `app/page.tsx`
- `app/login/page.tsx`
- `app/(admin)/admin/settings/page.tsx`

### 삭제
- `app/(admin)/admin/superadmin/` (전체 디렉토리)
- `app/(admin)/admin/admin-users/` (전체 디렉토리)
- `app/(admin)/admin/unverified-users/` (전체 디렉토리)

