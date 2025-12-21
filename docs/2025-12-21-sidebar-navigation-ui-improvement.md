# 사이드바 네비게이션 UI 개선

**작성 일자**: 2025-12-21  
**목적**: 사이드바 하단의 사용자 정보, 테넌트 정보, 로그아웃, 토글 버튼을 통합하여 UI 개선

---

## 개요

사이드바 네비게이션의 하단 섹션을 개선하여 사용자 정보, 테넌트 정보, 로그아웃, 토글 버튼을 더 직관적이고 일관된 UI로 통합했습니다.

---

## 주요 변경 사항

### 1. SidebarUserSection 컴포넌트 생성

**파일**: `components/navigation/global/SidebarUserSection.tsx`

- 테넌트 정보, 사용자 정보, 액션 버튼(로그아웃, 테마 토글, 사이드바 토글)을 통합 관리
- 데스크톱/모바일 variant 지원
- 사이드바 접기/펼치기 상태에 따른 반응형 UI

**주요 기능**:
- 테넌트 정보 표시 (아이콘 + 이름)
- 사용자 정보 표시 (아바타 + 이름 + 역할)
- 로그아웃 버튼 (compact variant)
- 테마 토글 버튼
- 사이드바 접기/펼치기 토글 버튼

### 2. SignOutButton 컴포넌트 개선

**파일**: `app/_components/SignOutButton.tsx`

- `variant` prop 추가: `default`, `icon`, `compact`
- 아이콘 추가 (LogOut from lucide-react)
- 디자인 시스템 스타일 적용

**Variant 설명**:
- `default`: 기본 버튼 (아이콘 + 텍스트)
- `icon`: 아이콘만 표시
- `compact`: 작은 크기의 버튼 (아이콘 + 텍스트)

### 3. getCurrentUserName 유틸리티 함수 생성

**파일**: `lib/auth/getCurrentUserName.ts`

- 현재 로그인한 사용자의 이름을 조회하는 함수
- 역할별로 적절한 테이블에서 이름을 가져옴:
  - `student`: students 테이블 또는 user_metadata
  - `admin`/`consultant`: users 테이블
  - `parent`: users 테이블
  - `superadmin`: users 테이블

### 4. RoleBasedLayout 수정

**파일**: `components/layout/RoleBasedLayout.tsx`

- `userName` prop 추가
- `SharedSidebarContent`에서 `TenantInfo` 제거하고 `SidebarUserSection` 사용
- 데스크톱/모바일 모두 `SidebarUserSection` 사용

**변경 사항**:
- `TenantInfo` 컴포넌트 import 제거
- `SidebarUserSection` import 추가
- `SharedSidebarContent`에서 테넌트 정보를 `SidebarUserSection`으로 통합

### 5. Layout 파일 수정

다음 layout 파일들에서 사용자 이름을 가져와서 `RoleBasedLayout`에 전달:

- `app/(student)/layout.tsx`
- `app/(admin)/layout.tsx`
- `app/(parent)/layout.tsx`
- `app/(superadmin)/layout.tsx`

**변경 사항**:
- `getCurrentUserName` import 추가
- `getTenantInfo`와 `getCurrentUserName`을 병렬로 조회
- `RoleBasedLayout`에 `userName` prop 전달

---

## UI 개선 사항

### 데스크톱 사이드바

1. **테넌트 정보 섹션**
   - Building2 아이콘 + 테넌트 이름
   - 접기 상태에서는 숨김 처리

2. **사용자 정보 섹션**
   - 원형 아바타 (User 아이콘)
   - 사용자 이름 (bold)
   - 역할 라벨 (muted)
   - 접기 상태에서는 아바타만 표시

3. **액션 버튼 그룹**
   - 로그아웃 버튼 (compact variant)
   - 테마 토글 버튼
   - 사이드바 토글 버튼 (ChevronLeft/ChevronRight)
   - 접기 상태에서는 테마 토글과 사이드바 토글만 표시

### 모바일 사이드바

1. **테넌트 정보 카드**
   - Building2 아이콘 + 테넌트 이름
   - 배경색이 있는 카드 형태

2. **사용자 정보 카드**
   - 원형 아바타 + 사용자 이름 + 역할 라벨
   - 배경색이 있는 카드 형태

3. **액션 버튼**
   - 로그아웃 버튼 (compact variant)
   - 테마 토글 버튼

---

## 접근성 개선

- `aria-label` 속성 추가 (로그아웃 버튼, 사이드바 토글)
- `aria-hidden` 속성으로 접기 상태의 숨김 요소 처리
- `aria-expanded` 속성으로 사이드바 상태 표시

---

## 스타일링

- 디자인 시스템 컬러 토큰 사용
- Tailwind CSS 유틸리티 클래스 사용
- 다크 모드 지원
- 반응형 디자인 (접기/펼치기 상태)

---

## 파일 목록

### 신규 파일
- `components/navigation/global/SidebarUserSection.tsx`
- `lib/auth/getCurrentUserName.ts`

### 수정 파일
- `app/_components/SignOutButton.tsx`
- `components/layout/RoleBasedLayout.tsx`
- `app/(student)/layout.tsx`
- `app/(admin)/layout.tsx`
- `app/(parent)/layout.tsx`
- `app/(superadmin)/layout.tsx`

---

## 테스트 체크리스트

- [ ] 데스크톱 사이드바에서 사용자 정보 표시 확인
- [ ] 데스크톱 사이드바 접기/펼치기 동작 확인
- [ ] 모바일 사이드바에서 사용자 정보 표시 확인
- [ ] 로그아웃 버튼 동작 확인
- [ ] 테마 토글 버튼 동작 확인
- [ ] 사이드바 토글 버튼 동작 확인
- [ ] 다크 모드에서 UI 확인
- [ ] 각 역할(학생, 관리자, 학부모, 슈퍼관리자)에서 정상 동작 확인

---

## 향후 개선 사항

1. 사용자 프로필 이미지 지원
2. 사용자 정보 클릭 시 프로필 페이지로 이동
3. 테넌트 정보 클릭 시 테넌트 설정 페이지로 이동
4. 애니메이션 효과 추가

---

**작업 완료**: 2025-12-21


