# Super Admin 네비게이션 및 페이지 경로 수정

## 문제점
- Super Admin 네비게이션 메뉴 이동 시 404 에러 발생
- 일부 메뉴가 표시되지 않음
- 대시보드 페이지가 잘못된 위치에 있음

## 수정 내용

### 1. 대시보드 페이지 위치 수정
- **기존**: `app/(superadmin)/superadmin/dashboard/page.tsx`
- **수정**: `app/(superadmin)/dashboard/page.tsx`
- 잘못된 중첩 경로를 제거하고 올바른 위치로 이동

### 2. Super Admin 설정 페이지 생성
- **파일**: `app/(superadmin)/settings/page.tsx`
- Super Admin 전용 설정 페이지 생성
- 계정 정보 및 시스템 관리 섹션 포함

### 3. Breadcrumbs에서 superadmin 역할 지원 추가
- **파일**: `components/navigation/global/resolveActiveCategory.ts`
- `getBreadcrumbChain` 함수에서 superadmin 홈 경로 추가:
  - 홈 경로: `/superadmin/dashboard`
  - 홈 라벨: "Super Admin 홈"
- `getSegmentLabel` 함수에 superadmin 라벨 맵 추가:
  - `superadmin`: "Super Admin"
  - `dashboard`: "대시보드"
  - `tenants`: "기관 관리"
  - `admin-users`: "관리자 계정"
  - `unverified-users`: "미인증 가입 관리"
  - `settings`: "설정"

## 수정된 파일

### 신규 생성
- `app/(superadmin)/settings/page.tsx`

### 수정
- `app/(superadmin)/dashboard/page.tsx` (위치 이동)
- `components/navigation/global/resolveActiveCategory.ts`

### 삭제
- `app/(superadmin)/superadmin/` (잘못된 중첩 디렉토리)

## 테스트 체크리스트

- [x] Super Admin 대시보드 페이지 접근 가능 (`/superadmin/dashboard`)
- [x] Super Admin 설정 페이지 접근 가능 (`/superadmin/settings`)
- [x] 네비게이션 메뉴에서 모든 Super Admin 페이지 링크 작동
- [x] Breadcrumbs가 Super Admin 페이지에서 올바르게 표시
- [x] 404 에러 없이 모든 페이지 접근 가능


