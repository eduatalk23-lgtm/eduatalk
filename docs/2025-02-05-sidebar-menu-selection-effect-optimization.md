# 사이드바 메뉴 선택 효과 개선 및 코드 최적화

## 작업 일자
2025년 2월 5일

## 작업 개요
사이드바 네비게이션 메뉴의 선택 효과가 잘리는 문제를 해결하고, 중복 코드를 제거하여 유지보수성을 향상시켰습니다. shadcn/ui 모범 사례를 참고하여 사이드바 너비 조정, 패딩 최적화, 스타일 중복 제거를 수행했습니다.

## 문제 분석

### 발견된 문제점
1. **사이드바 너비 부족**: `w-64` (256px)로 고정되어 활성 메뉴 항목의 `pl-[11px]` + `border-l-2`로 인해 콘텐츠가 잘림
2. **패딩 중복**: 네비게이션 섹션의 `p-4`와 활성 항목의 `pl-[11px]`가 겹쳐 공간 낭비
3. **코드 중복**: 활성 상태 스타일(`pl-[11px] border-l-2`)이 3곳에서 반복 정의됨
   - `navItemStyles.active` (line 102)
   - `subItemStyles.active` (line 131)
   - `childItemStyles.active` (line 141)

## 구현 내용

### 1. 사이드바 너비 조정

**파일**: `components/navigation/global/navStyles.ts`

```typescript
// 변경 전
export const sidebarWidths = {
  collapsed: "w-16",
  expanded: "w-64",  // 256px
} as const;

// 변경 후
export const sidebarWidths = {
  collapsed: "w-16",
  expanded: "w-72",  // 288px (32px 증가)
} as const;
```

**효과**: 사이드바 너비를 32px 증가시켜 활성 메뉴 항목의 텍스트가 잘리지 않도록 충분한 공간 확보

### 2. 활성 상태 스타일 통합

**파일**: `components/navigation/global/navStyles.ts`

```typescript
// 공통 활성 상태 스타일 상수 추가
const activeBorderStyle = "pl-[9px] border-l-2";

// navItemStyles.active 수정
active: `${designTokens.colors.primary[50]} ${designTokens.colors.primary[500]} ${activeBorderStyle} ${designTokens.colors.primary.border}`,

// subItemStyles.active 수정
active: `${designTokens.colors.primary[50]} ${designTokens.colors.primary[500]} ${activeBorderStyle} ${designTokens.colors.primary.border}`,

// childItemStyles.active 수정
active: `${designTokens.colors.primary[100]} ${designTokens.colors.primary[800]} ${activeBorderStyle} ${designTokens.colors.primary.border}`,
```

**변경 사항**:
- 중복된 `pl-[11px] border-l-2` 패턴을 `activeBorderStyle` 상수로 추출
- 패딩을 `pl-[11px]`에서 `pl-[9px]`로 조정하여 2px 절약
- 3곳의 중복 코드를 단일 상수로 통합하여 유지보수성 향상

### 3. 네비게이션 섹션 패딩 최적화

**파일**: `components/navigation/global/navStyles.ts`

```typescript
// 변경 전
navSection: layoutStyles.padding4,  // p-4 (16px)

// 변경 후
navSection: "px-3 py-4",  // 좌우 12px, 상하 16px
```

**효과**: 좌우 패딩을 16px에서 12px로 축소하여 메뉴 항목에 더 많은 공간 할당

### 4. 사이드바 너비 상수 사용

**파일**: `components/layout/RoleBasedLayout.tsx`

```typescript
// Import 추가
import { layoutStyles, sidebarStyles, mobileNavStyles, sidebarWidths } from "@/components/navigation/global/navStyles";

// 변경 전
<aside
  className={cn(
    sidebarStyles.container,
    "hidden md:block",
    isCollapsed ? "w-16" : "w-64"
  )}
>

// 변경 후
<aside
  className={cn(
    sidebarStyles.container,
    "hidden md:block",
    isCollapsed ? sidebarWidths.collapsed : sidebarWidths.expanded
  )}
>
```

**효과**: 하드코딩된 너비 값을 상수로 대체하여 일관성 유지 및 유지보수성 향상

## 개선 효과

### 공간 최적화
- 사이드바 너비: 256px → 288px (+32px)
- 활성 메뉴 패딩: 11px → 9px (-2px)
- 네비게이션 섹션 좌우 패딩: 16px → 12px (-4px)
- **총 추가 공간**: 약 38px 확보

### 코드 품질 개선
- 중복 코드 제거: 3곳의 중복 스타일을 단일 상수로 통합
- 유지보수성 향상: 활성 상태 스타일 변경 시 한 곳만 수정하면 됨
- 일관성 확보: 사이드바 너비를 상수로 관리하여 일관된 사용

## 참고 자료

### shadcn/ui 모범 사례
- 사이드바 너비 권장 범위: 16rem-20rem (256px-320px)
- CSS 변수를 통한 동적 너비 설정 지원
- `isActive` prop을 통한 명확한 활성 상태 관리

### 웹 접근성 가이드라인
- 충분한 터치 타겟 크기 유지 (최소 44x44px)
- 키보드 네비게이션 지원 유지
- 스크린 리더 호환성 유지

## 검증 사항

- [x] 활성 메뉴 항목의 텍스트가 잘리지 않음
- [x] 사이드바 너비가 적절하게 조정됨
- [x] 중복 코드가 제거되어 유지보수성 향상
- [x] 반응형 디자인이 정상 작동
- [x] 다크 모드에서도 스타일이 정상 표시
- [x] 접근성 (키보드 네비게이션, 스크린 리더) 유지
- [x] 린터 에러 없음

## 변경된 파일

1. `components/navigation/global/navStyles.ts`
   - `sidebarWidths.expanded`를 `w-72`로 변경
   - `activeBorderStyle` 상수 추가
   - `activeBorderStyleSubMenu` 상수 추가 (하위 메뉴용)
   - 활성 상태 스타일 중복 제거
   - `navSection` 패딩 최적화
   - 하위 메뉴 아이템 기본 패딩 `px-3` → `px-2`
   - 하위 메뉴 활성 상태 패딩 `pl-[9px]` → `pl-[7px]`

2. `components/navigation/global/CategoryNav.tsx`
   - 하위 메뉴 컨테이너 `pl-4` → `pl-3`
   - 3단계 메뉴 컨테이너 `pl-6` → `pl-4`

3. `components/layout/RoleBasedLayout.tsx`
   - `sidebarWidths` 상수 import 추가
   - 하드코딩된 너비 값을 상수로 대체

## 전체 리팩토링 (사이드 메뉴 구조 정리)

### 문제점
여러 번의 패치로 인해 사이드 메뉴 구조가 복잡해지고 일관성이 떨어졌습니다:
- Negative margin (-mx-2) 사용으로 인한 복잡성
- 패딩 값이 일관되지 않음
- 하위 메뉴 들여쓰기가 너무 작아짐

### 해결 방안
shadcn/ui 모범 사례를 참고하여 전체 구조를 단순화하고 일관성 있게 재정리했습니다.

1. **Negative margin 제거**
   - 모든 `-mx-2` 제거
   - 자연스러운 spacing 사용

2. **패딩 값 통일**
   - 네비게이션 섹션: `px-4` (일관성 유지)
   - 메뉴 아이템 기본 패딩: `px-3` (모든 레벨 통일)
   - 활성 상태 패딩: `pl-3` (간단하고 명확)

3. **들여쓰기 구조 정리**
   - 하위 메뉴 컨테이너: `pl-4` (표준 들여쓰기)
   - 3단계 메뉴 컨테이너: `pl-4` (일관성 유지)

4. **활성 상태 스타일 단순화**
   - `pl-[9px]` → `pl-3` (표준 Tailwind 값 사용)
   - `pl-[7px]` → `pl-3` (통일)

### 개선 효과
- 코드 복잡도 감소: negative margin 제거로 이해하기 쉬워짐
- 일관성 향상: 모든 레벨에서 동일한 패딩 규칙 적용
- 유지보수성 향상: 표준 Tailwind 값 사용으로 변경 용이
- 가독성 향상: 구조가 단순하고 명확해짐

## 추가 개선 (하위 메뉴 최적화) - 이전 버전

### 문제점
하위 메뉴 항목들이 여전히 잘리는 문제가 발견되어 추가 최적화를 수행했습니다.

### 해결 방안

**파일**: `components/navigation/global/navStyles.ts`, `components/navigation/global/CategoryNav.tsx`

1. **하위 메뉴용 활성 상태 스타일 추가**
   ```typescript
   // 하위 메뉴는 이미 들여쓰기가 있어 패딩을 더 줄임
   const activeBorderStyleSubMenu = "pl-[7px] border-l-2";
   ```

2. **하위 메뉴 아이템 패딩 최적화**
   ```typescript
   // 변경 전
   base: "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
   active: `${...} ${activeBorderStyle} ${...}`,  // pl-[9px]
   
   // 변경 후
   base: "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition",
   active: `${...} ${activeBorderStyleSubMenu} ${...}`,  // pl-[7px]
   ```

3. **하위 메뉴 컨테이너 들여쓰기 조정**
   ```typescript
   // 변경 전: pl-4 (16px)
   // 변경 후: pl-3 (12px)
   ```

4. **3단계 메뉴 들여쓰기 조정**
   ```typescript
   // 변경 전: pl-6 (24px)
   // 변경 후: pl-4 (16px)
   ```

### 개선 효과
- 하위 메뉴 컨테이너: 16px → 12px (-4px)
- 하위 메뉴 아이템 기본 패딩: 12px → 8px (-4px)
- 하위 메뉴 활성 상태 패딩: 9px → 7px (-2px)
- 3단계 메뉴 들여쓰기: 24px → 16px (-8px)
- **총 추가 공간**: 약 18px 확보

## 향후 개선 사항

1. **CSS 변수 활용**: 사이드바 너비를 CSS 변수로 관리하여 런타임 조정 가능
2. **반응형 사이드바**: 화면 크기에 따라 사이드바 너비 자동 조정
3. **애니메이션 개선**: 사이드바 너비 변경 시 부드러운 전환 효과 추가

