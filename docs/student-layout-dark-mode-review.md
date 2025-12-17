# Student Layout 라이트/다크 모드 검토

**작성일**: 2025-01-15  
**대상 파일**: `app/(student)/layout.tsx`

## 📋 검토 개요

Student Layout의 라이트/다크 모드 지원 상태를 전반적으로 검토하고, 일관성과 완성도를 확인합니다.

---

## ✅ 현재 상태

### 1. ThemeProvider 설정

**위치**: `lib/providers/ThemeProvider.tsx`

```typescript
<NextThemesProvider
  attribute="class"
  defaultTheme="light"
  enableSystem={true}
  disableTransitionOnChange={false}
>
```

**상태**: ✅ 올바르게 설정됨
- 클래스 기반 다크 모드 (`attribute="class"`)
- 시스템 설정 지원 (`enableSystem={true}`)
- 기본 테마: 라이트 모드
- 전환 애니메이션 유지

### 2. ThemeToggle 컴포넌트

**위치**: `components/ui/ThemeToggle.tsx`

**상태**: ✅ 구현 완료
- `RoleBasedLayout`의 사이드바 푸터에 포함됨 (라인 65)
- Hydration mismatch 방지 처리됨
- 접근성 속성 포함 (`aria-label`, `title`)

### 3. RoleBasedLayout 다크 모드 스타일

**위치**: `components/layout/RoleBasedLayout.tsx`

#### 메인 컨테이너 배경
```305:305:components/layout/RoleBasedLayout.tsx
    <div className="flex min-h-screen bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
```

**상태**: ✅ 다크 모드 스타일 적용됨

#### 사이드바 스타일
- `sidebarStyles.container`: `layoutStyles.bgWhite` 사용
- `sidebarStyles.header`: `layoutStyles.bgWhite` 사용
- `sidebarStyles.footer`: `layoutStyles.bgWhite` 사용

**상태**: ✅ 다크 모드 스타일 적용됨 (navStyles.ts에서 정의)

#### 모바일 네비게이션
- 상단 네비게이션 바: `layoutStyles.bgWhite` 사용
- 모바일 드로어: `mobileNavStyles.drawer` → `layoutStyles.bgWhite` 사용

**상태**: ✅ 다크 모드 스타일 적용됨

### 4. navStyles.ts 다크 모드 정의

**위치**: `components/navigation/global/navStyles.ts`

#### 디자인 토큰
- **Primary 색상**: 다크 모드 변형 정의됨
- **Gray 색상**: 다크 모드 변형 정의됨
- **텍스트 색상**: CSS 변수 기반으로 다크 모드 지원

**상태**: ✅ 광범위하게 다크 모드 스타일 정의됨

#### layoutStyles
```typescript
bgWhite: "bg-white dark:bg-secondary-900",
```

**⚠️ 개선 필요**: Tailwind 클래스 `dark:bg-secondary-900` 대신 CSS 변수 사용 권장

---

## 🔍 상세 검토

### 1. CSS 변수 시스템

**위치**: `app/globals.css`

**상태**: ✅ 완벽하게 정의됨
- 라이트 모드 변수 정의 (라인 21-152)
- 다크 모드 변수 정의 (라인 199-251)
- `@media (prefers-color-scheme: dark)` 지원
- `.dark` 클래스 지원

### 2. Tailwind 다크 모드 설정

**위치**: `app/globals.css`

```css
@variant dark (&:where(.dark, .dark));
```

**상태**: ✅ 올바르게 설정됨
- 클래스 기반 다크 모드 지원
- 시스템 설정과 수동 전환 모두 지원

### 3. 컴포넌트별 다크 모드 적용 상태

#### ✅ 완전히 적용된 컴포넌트
- `RoleBasedLayout`: 메인 배경, 사이드바
- `CategoryNav`: 네비게이션 아이템, 툴팁
- `Breadcrumbs`: 컨테이너, 링크, 텍스트
- `TenantInfo`: 배경, 텍스트
- `LogoSection`: 텍스트 색상

#### ⚠️ 개선 권장 사항
- `layoutStyles.bgWhite`: CSS 변수 사용으로 변경

---

## 🛠 개선 사항

### 1. layoutStyles.bgWhite 일관성 개선

**현재**:
```typescript
bgWhite: "bg-white dark:bg-secondary-900",
```

**개선안**:
```typescript
bgWhite: "bg-white dark:bg-[rgb(var(--color-secondary-900))]",
```

**이유**:
- CSS 변수 시스템과의 일관성 유지
- 디자인 토큰 중앙 관리
- 향후 테마 확장성 향상

### 2. 검증 체크리스트

다음 항목들이 모두 적용되었는지 확인:

- [x] ThemeProvider 설정 완료
- [x] ThemeToggle 컴포넌트 포함
- [x] 메인 레이아웃 배경 다크 모드 적용
- [x] 사이드바 다크 모드 적용
- [x] 모바일 네비게이션 다크 모드 적용
- [x] 텍스트 색상 다크 모드 적용
- [x] 테두리 색상 다크 모드 적용
- [x] 호버 상태 다크 모드 적용
- [x] `layoutStyles.bgWhite` CSS 변수 사용 (개선 완료)

---

## 📊 다크 모드 적용 범위

### 완전히 적용된 영역
1. **메인 레이아웃**
   - 배경색: `bg-[rgb(var(--color-secondary-50))]` → `dark:bg-[rgb(var(--color-secondary-900))]`

2. **사이드바**
   - 배경색: `bg-white` → `dark:bg-[rgb(var(--color-secondary-900))]`
   - 텍스트: CSS 변수 기반
   - 테두리: `border-[rgb(var(--color-secondary-200))]` → `dark:border-[rgb(var(--color-secondary-700))]`

3. **모바일 네비게이션**
   - 상단 바: `bg-white` → `dark:bg-[rgb(var(--color-secondary-900))]`
   - 드로어: 동일하게 적용

4. **네비게이션 아이템**
   - 활성 상태: Primary 색상 다크 모드 변형
   - 비활성 상태: Gray 색상 다크 모드 변형
   - 호버 상태: 다크 모드 변형

5. **텍스트 시스템**
   - Primary 텍스트: `--text-primary` 변수 사용
   - Secondary 텍스트: `--text-secondary` 변수 사용
   - Tertiary 텍스트: `--text-tertiary` 변수 사용

---

## 🎯 결론

### 전체 평가: ✅ 우수

Student Layout의 라이트/다크 모드 지원은 **전반적으로 잘 구현**되어 있습니다.

### 강점
1. ✅ ThemeProvider가 올바르게 설정됨
2. ✅ ThemeToggle이 접근 가능한 위치에 배치됨
3. ✅ CSS 변수 시스템을 활용한 일관된 색상 관리
4. ✅ navStyles.ts에서 중앙 집중식 스타일 관리
5. ✅ 모든 주요 컴포넌트에 다크 모드 적용

### 개선 완료 사항
1. ✅ `layoutStyles.bgWhite`를 CSS 변수 기반으로 변경 완료
   - 변경 전: `bg-white dark:bg-secondary-900`
   - 변경 후: `bg-white dark:bg-[rgb(var(--color-secondary-900))]`

### 다음 단계
1. 실제 브라우저에서 다크 모드 전환 테스트
2. 다양한 화면 크기에서 다크 모드 검증
3. 접근성 테스트 (색상 대비율 확인)

---

## 📝 참고 파일

- `app/(student)/layout.tsx` - Student Layout
- `components/layout/RoleBasedLayout.tsx` - 레이아웃 컴포넌트
- `components/navigation/global/navStyles.ts` - 네비게이션 스타일 정의
- `lib/providers/ThemeProvider.tsx` - 테마 프로바이더
- `components/ui/ThemeToggle.tsx` - 테마 전환 버튼
- `app/globals.css` - 전역 CSS 변수 및 다크 모드 설정

