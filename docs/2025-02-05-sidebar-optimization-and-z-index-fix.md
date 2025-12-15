# 사이드 메뉴 최적화 및 z-index 개선 작업

## 작업 일자
2025년 2월 5일

## 작업 개요
사이드 메뉴의 z-index 겹침 문제 해결, 중복 코드 제거, 최적화, 그리고 shadcn-ui 모범 사례 적용을 통한 코드 품질 개선

## 구현 내용

### 1. z-index 계층 구조 정리

#### 1.1 z-index 상수 정의
- **파일**: `components/navigation/global/navStyles.ts`
- z-index 계층 구조를 상수로 중앙 집중식 관리
- `zIndexLayers` 객체에 모든 z-index 값 정의
  - 사이드바: 10
  - 사이드바 헤더/푸터: 20
  - 모바일 상단 네비게이션: 40
  - 오버레이: 45
  - 드로어: 50
  - 드로어 헤더: 60
  - 툴팁/모달: 50

#### 1.2 모바일 네비게이션 z-index 수정
- **파일**: `components/navigation/global/navStyles.ts`
- `mobileNavStyles.overlay`: `z-40` → `z-[45]`
- `mobileNavStyles.drawer`: `z-50` → `z-[50]` (유지)
- `mobileNavStyles.header`: `z-10` → `z-[60]`

#### 1.3 데스크톱 사이드바 z-index 추가
- **파일**: `components/navigation/global/navStyles.ts`
- `sidebarStyles.container`: `z-[10]` 추가
- `sidebarStyles.header`: `z-[20]` 추가 (sticky 고정)
- `sidebarStyles.footer`: `z-[20]` 추가 (sticky 고정)

#### 1.4 모바일 상단 네비게이션 z-index 조정
- **파일**: `components/layout/RoleBasedLayout.tsx`
- 모바일 상단 네비게이션: `z-50` → `z-[40]`
- 드로어가 열릴 때 상단 네비게이션이 드로어 뒤에 위치하도록 조정

### 2. 미사용 코드 제거

#### 2.1 isPinned 상태 제거
- **파일**: `components/layout/SidebarContext.tsx`
- `isPinned` 상태 제거
- `togglePin` 함수 제거
- `STORAGE_KEYS.PINNED` 제거
- localStorage 저장 로직 제거

**이유**: 현재 flex 레이아웃으로 충분하며, 실제로 사용되지 않음

### 3. 중복 코드 제거 및 최적화

#### 3.1 Breadcrumbs 툴팁 스타일 통합
- **파일**: `components/navigation/global/navStyles.ts`
- `tooltipStyles` 객체 추가
  - `base`: 툴팁 기본 스타일
  - `arrow`: 툴팁 화살표 스타일

- **파일**: `components/navigation/global/Breadcrumbs.tsx`
- 중복된 툴팁 스타일을 `tooltipStyles`로 교체
- 두 곳에서 사용되던 동일한 스타일 코드 제거

#### 3.2 스와이프 제스처 처리 단순화
- **파일**: `components/layout/RoleBasedLayout.tsx`
- CSS 변수(`--swipe-progress`) 제거
- Tailwind 클래스(`translate-x-[var(--swipe-progress)]`) 제거
- 인라인 스타일로 통일: `transform: translateX(${...}%)`
- 조건부 클래스 적용 로직 단순화

**개선 전**:
```typescript
className={cn(
  ...,
  isMobileOpen 
    ? swipeProgress > 0 
      ? "translate-x-[var(--swipe-progress)]" 
      : "translate-x-0"
    : "-translate-x-full",
  ...
)}
style={
  isMobileOpen && swipeProgress > 0
    ? ({ "--swipe-progress": `${Math.max(0, -swipeProgress * 100)}%` } as React.CSSProperties & { "--swipe-progress": string })
    : undefined
}
```

**개선 후**:
```typescript
className={cn(
  ...,
  isMobileOpen && swipeProgress === 0
    ? "translate-x-0"
    : !isMobileOpen
    ? "-translate-x-full"
    : "",
  ...
)}
style={
  isMobileOpen && swipeProgress > 0
    ? { transform: `translateX(${Math.max(-100, -swipeProgress * 100)}%)` }
    : undefined
}
```

#### 3.3 공통 스타일 유틸리티 확장
- **파일**: `components/navigation/global/navStyles.ts`
- `layoutStyles.scrollableContainer`: `"overflow-y-auto"` 추가
- `layoutStyles.fullHeight`: `"h-screen"` 추가
- `animationDurations` 상수 추가 (fast, normal, slow)
- `sidebarWidths` 상수 추가 (collapsed, expanded)

### 4. 접근성 개선

#### 4.1 ESC 키로 드로어 닫기
- **파일**: `components/layout/RoleBasedLayout.tsx`
- `useEffect`로 ESC 키 이벤트 리스너 추가
- 드로어가 열려 있을 때 ESC 키를 누르면 닫힘

#### 4.2 포커스 트랩
- **파일**: `components/layout/RoleBasedLayout.tsx`
- 드로어가 열릴 때 첫 번째 포커스 가능한 요소로 포커스 이동
- `querySelector`로 첫 번째 포커스 가능한 요소 찾기

#### 4.3 aria-hidden 일관성
- 오버레이의 `aria-hidden` 속성을 `!isMobileOpen`으로 수정
- 드로어의 `aria-hidden` 속성과 일관성 유지

## 수정된 파일

### `components/navigation/global/navStyles.ts`
- z-index 상수 추가 (`zIndexLayers`)
- tooltipStyles 추가
- 공통 스타일 유틸리티 확장 (`scrollableContainer`, `fullHeight`)
- 애니메이션 duration 상수 추가 (`animationDurations`)
- 사이드바 너비 상수 추가 (`sidebarWidths`)
- 모바일 네비게이션 z-index 수정
- 데스크톱 사이드바 z-index 추가

### `components/layout/RoleBasedLayout.tsx`
- 모바일 상단 네비게이션 z-index 조정 (`z-50` → `z-[40]`)
- 스와이프 제스처 처리 단순화 (CSS 변수 제거, 인라인 스타일로 통일)
- ESC 키로 드로어 닫기 기능 추가
- 포커스 트랩 기능 추가
- 오버레이 aria-hidden 속성 개선

### `components/layout/SidebarContext.tsx`
- `isPinned` 상태 제거
- `togglePin` 함수 제거
- `STORAGE_KEYS.PINNED` 제거
- localStorage 저장 로직 제거

### `components/navigation/global/Breadcrumbs.tsx`
- 툴팁 스타일을 `tooltipStyles`로 교체
- 중복 코드 제거

## z-index 계층 구조

```
최상위 (100)
  └─ top

드로어 헤더 (60)
  └─ drawerHeader

드로어/모달/팝오버/툴팁 (50)
  └─ drawer, modal, popover, tooltip

오버레이 (45)
  └─ overlay

모바일 상단 네비게이션 (40)
  └─ mobileNav

사이드바 헤더/푸터 (20)
  └─ sidebarHeader, sidebarFooter

사이드바 (10)
  └─ sidebar

기본 (0)
  └─ base
```

## 개선 효과

1. **명확한 레이어링**: z-index 상수로 레이어 구조가 명확해짐
2. **코드 간소화**: 중복 코드 제거로 유지보수성 향상
3. **성능 개선**: 스와이프 처리 단순화로 렌더링 최적화
4. **일관성 향상**: 스타일 상수화로 디자인 시스템 일관성 확보
5. **접근성 향상**: ESC 키 지원, 포커스 트랩으로 키보드 사용성 개선

## 테스트 체크리스트

- [ ] 모바일에서 드로어가 상단 네비게이션 위에 올바르게 표시되는지 확인
- [ ] 오버레이가 드로어 뒤에 올바르게 표시되는지 확인
- [ ] 드로어 헤더가 스크롤 시 고정되는지 확인
- [ ] 스와이프 제스처가 부드럽게 동작하는지 확인
- [ ] 데스크톱 사이드바가 다른 요소와 겹치지 않는지 확인
- [ ] 애니메이션이 부드럽게 동작하는지 확인
- [ ] ESC 키로 드로어가 닫히는지 확인
- [ ] 드로어 열림 시 포커스가 올바르게 이동하는지 확인
- [ ] 접근성 (키보드 네비게이션, 스크린 리더) 확인

## 참고 사항

- shadcn-ui의 Drawer 컴포넌트 모범 사례 참고
- Radix UI의 접근성 가이드라인 준수
- Tailwind CSS의 z-index arbitrary values 사용 (`z-[50]` 형식)

