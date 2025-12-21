# 사이드바 네비게이션 상단 통합 및 웹 접기 기능 제거

**작성 일자**: 2025-12-21  
**목적**: 사용자 정보 섹션을 사이드바 상단으로 이동하고, 웹 환경에서 사용하지 않는 접기 기능 관련 코드 정리

---

## 개요

사이드바 네비게이션의 사용자 정보 섹션을 하단에서 상단으로 이동하여 더 직관적인 UI로 개선하고, 웹 환경에서 사용하지 않는 사이드바 접기 기능 관련 코드를 정리했습니다.

---

## 주요 변경 사항

### 1. 사용자 정보 섹션 상단 이동

**변경 전**:
- 로고 → 네비게이션 메뉴 → 사용자 정보 섹션 (하단)

**변경 후**:
- 로고 → 사용자 정보 섹션 (상단) → 네비게이션 메뉴

**파일**: `components/layout/RoleBasedLayout.tsx`

- `SidebarContent`에서 `SidebarUserSection`을 로고 바로 아래로 이동
- 데스크톱 variant에서만 상단에 배치
- 모바일 variant는 기존대로 하단에 유지

### 2. 웹 환경 접기 기능 제거

#### 2.1 SidebarUserSection 개선

**파일**: `components/navigation/global/SidebarUserSection.tsx`

**제거된 기능**:
- `isCollapsed` 상태 사용 제거
- `toggleCollapse` 함수 사용 제거
- 사이드바 토글 버튼 제거 (ChevronLeft/ChevronRight)
- 접기 상태에 따른 조건부 렌더링 제거

**개선 사항**:
- 데스크톱 variant를 상단 배치로 변경 (footer → header 아래)
- 항상 펼쳐진 상태로 표시
- 깔끔한 레이아웃 (테넌트 정보 → 사용자 정보 → 액션 버튼)

#### 2.2 LogoSection 개선

**파일**: `components/navigation/global/LogoSection.tsx`

**제거된 props**:
- `isCollapsed`: 웹 환경에서 사용하지 않음
- `onToggleCollapse`: 웹 환경에서 사용하지 않음

**개선 사항**:
- 불필요한 props 제거로 코드 단순화
- variant에 따른 roleLabel 위치만 조정

#### 2.3 RoleBasedLayout 개선

**파일**: `components/layout/RoleBasedLayout.tsx`

**제거된 기능**:
- `SidebarContent`에서 `isCollapsed`, `toggleCollapse` 사용 제거
- `SharedSidebarContent`에서 `isCollapsed` prop 제거
- 사이드바 너비를 항상 `expanded`로 고정
- `RoleBasedLayout`에서 `isCollapsed` 사용 제거

**개선 사항**:
- 데스크톱 사이드바 구조 재구성:
  1. 로고 섹션
  2. 사용자 정보 섹션 (상단)
  3. 네비게이션 메뉴
- 모바일 사이드바는 기존 구조 유지 (하단에 사용자 정보)

---

## UI 구조

### 데스크톱 사이드바 (웹 환경)

```
┌─────────────────────────┐
│ ⏱️ TimeLevelUp 학생      │  ← 로고
├─────────────────────────┤
│ 🏢 에듀엣톡 academy      │  ← 테넌트 정보
│ 👤 이윤호               │  ← 사용자 정보
│    학생                 │
│ [로그아웃] [🌙]         │  ← 액션 버튼
├─────────────────────────┤
│ 📚 학습 계획            │  ← 네비게이션 메뉴
│ 📊 성적 관리            │
│ ...                     │
└─────────────────────────┘
```

### 모바일 사이드바

```
┌─────────────────────────┐
│ ⏱️ TimeLevelUp 학생  [X] │  ← 로고 + 닫기
├─────────────────────────┤
│ 📚 학습 계획            │  ← 네비게이션 메뉴
│ 📊 성적 관리            │
│ ...                     │
├─────────────────────────┤
│ 🏢 에듀엣톡 academy      │  ← 테넌트 정보
│ 👤 이윤호               │  ← 사용자 정보
│    학생                 │
│ [로그아웃] [🌙]         │  ← 액션 버튼
└─────────────────────────┘
```

---

## 코드 정리

### 제거된 코드

1. **SidebarUserSection**:
   - `useSidebar` hook 사용 제거
   - `ChevronLeft`, `ChevronRight` import 제거
   - 접기 상태 관련 조건부 렌더링 제거
   - 사이드바 토글 버튼 제거

2. **LogoSection**:
   - `isCollapsed` prop 제거
   - `onToggleCollapse` prop 제거

3. **RoleBasedLayout**:
   - `SidebarContent`에서 `isCollapsed`, `toggleCollapse` 사용 제거
   - 사이드바 너비를 `sidebarWidths.expanded`로 고정
   - `RoleBasedLayout`에서 `isCollapsed` 사용 제거

### 유지된 코드

- 모바일 사이드바 관련 코드는 모두 유지 (모바일에서는 접기 기능 사용)
- `useSidebar` hook은 모바일에서 여전히 사용되므로 유지

---

## 파일 목록

### 수정 파일
- `components/navigation/global/SidebarUserSection.tsx`
- `components/navigation/global/LogoSection.tsx`
- `components/layout/RoleBasedLayout.tsx`

---

## 테스트 체크리스트

- [ ] 데스크톱 사이드바에서 사용자 정보가 상단에 표시되는지 확인
- [ ] 데스크톱 사이드바에서 접기 버튼이 없는지 확인
- [ ] 모바일 사이드바에서 사용자 정보가 하단에 표시되는지 확인
- [ ] 로고 섹션이 정상적으로 표시되는지 확인
- [ ] 네비게이션 메뉴가 정상적으로 작동하는지 확인
- [ ] 로그아웃 버튼이 정상적으로 작동하는지 확인
- [ ] 테마 토글 버튼이 정상적으로 작동하는지 확인
- [ ] 다크 모드에서 UI가 정상적으로 표시되는지 확인

---

## 향후 개선 사항

1. 사용자 프로필 이미지 지원
2. 사용자 정보 클릭 시 프로필 페이지로 이동
3. 테넌트 정보 클릭 시 테넌트 설정 페이지로 이동

---

**작업 완료**: 2025-12-21


