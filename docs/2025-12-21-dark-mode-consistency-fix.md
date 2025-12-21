# 다크모드 일관성 문제 분석 및 수정 방향

**작업 일시**: 2025-12-21  
**목적**: 사이드 네비게이션과 메인 콘텐츠 영역 간 다크모드 일관성 문제 해결

---

## 📋 문제 분석

### 현재 상태

1. **다크모드 인프라**: ✅ 정상 작동
   - `ThemeProvider` 설정 완료 (`lib/providers/ThemeProvider.tsx`)
   - `next-themes` 사용 중
   - `suppressHydrationWarning` 설정 완료

2. **문제점**: 사이드바와 메인 콘텐츠의 배경색이 일관되지 않음

#### 사이드바 (RoleBasedLayout)
```typescript
// components/layout/RoleBasedLayout.tsx:309
<div className="flex min-h-screen bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
  <aside className={cn(sidebarStyles.container, ...)}>
    {/* 사이드바는 bgWhite 사용 */}
  </aside>
</div>
```

#### navStyles.ts의 bgWhite 정의
```typescript
// components/navigation/global/navStyles.ts:332
bgWhite: "bg-white dark:bg-[rgb(var(--color-secondary-900))]",
```

#### 메인 콘텐츠
```typescript
// components/layout/RoleBasedLayout.tsx:309
// 메인 콘텐츠는 bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))] 사용
```

### 문제의 원인

1. **배경색 불일치**:
   - 사이드바: `bg-white` (라이트) → `dark:bg-[rgb(var(--color-secondary-900))]` (다크)
   - 메인 콘텐츠: `bg-[rgb(var(--color-secondary-50))]` (라이트) → `dark:bg-[rgb(var(--color-secondary-900))]` (다크)
   - **라이트 모드에서 배경색이 다름**: 사이드바는 흰색, 메인은 연한 회색

2. **스타일 토큰 혼재**:
   - `navStyles.ts`의 `bgWhite`는 하드코딩된 `bg-white` 사용
   - 메인 콘텐츠는 CSS 변수 기반 색상 사용
   - 두 가지 접근 방식이 혼재되어 있음

---

## 🎯 수정 방향

### 옵션 1: 사이드바를 메인 콘텐츠와 동일한 배경색으로 통일 (권장)

**장점**:
- 메인 콘텐츠와 사이드바의 배경색이 완전히 일치
- 전체 레이아웃의 시각적 일관성 향상
- CSS 변수 기반으로 통일

**수정 내용**:
```typescript
// components/navigation/global/navStyles.ts
// bgWhite를 CSS 변수 기반으로 변경
bgWhite: "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]",
```

**영향 범위**:
- `RoleBasedLayout`의 사이드바 배경
- `SidebarUserSection`의 배경
- 모바일 드로어 배경

### 옵션 2: 메인 콘텐츠를 사이드바와 동일한 배경색으로 통일

**장점**:
- 사이드바가 더 명확하게 구분됨
- 카드형 콘텐츠와의 대비가 더 좋음

**단점**:
- 라이트 모드에서 배경이 너무 밝을 수 있음
- 메인 콘텐츠 영역이 덜 구분될 수 있음

---

## 🔧 권장 수정 사항

### 1. navStyles.ts 수정

**파일**: `components/navigation/global/navStyles.ts`

**변경 전**:
```typescript
bgWhite: "bg-white dark:bg-[rgb(var(--color-secondary-900))]",
```

**변경 후**:
```typescript
bgWhite: "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]",
```

**이유**:
- 메인 콘텐츠와 동일한 배경색 사용
- CSS 변수 기반으로 통일
- 라이트/다크 모드 모두 일관성 유지

### 2. RoleBasedLayout 검증

**파일**: `components/layout/RoleBasedLayout.tsx`

현재 메인 컨테이너의 배경색이 올바르게 설정되어 있는지 확인:
```typescript
// 라인 309
<div className="flex min-h-screen bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
```

이 부분은 이미 올바르게 설정되어 있음.

### 3. SidebarUserSection 검증

**파일**: `components/navigation/global/SidebarUserSection.tsx`

사이드바 사용자 섹션의 배경색도 일관되게 적용되어 있는지 확인:
```typescript
// 라인 89
<div className="bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
```

이 부분도 이미 올바르게 설정되어 있음.

---

## 📝 수정 체크리스트

- [ ] `navStyles.ts`의 `bgWhite`를 CSS 변수 기반으로 변경
- [ ] 사이드바 배경색이 메인 콘텐츠와 일치하는지 확인
- [ ] 모바일 드로어 배경색도 일관되게 적용되는지 확인
- [ ] 라이트 모드에서 사이드바와 메인 콘텐츠 배경색이 동일한지 확인
- [ ] 다크 모드에서 사이드바와 메인 콘텐츠 배경색이 동일한지 확인
- [ ] 테넌트 정보 섹션 배경색도 일관되게 적용되는지 확인

---

## 🎨 디자인 시스템 일관성

### CSS 변수 기반 색상 사용 원칙

1. **배경색**: `bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]`
2. **텍스트 색상**: `text-[var(--text-primary)]`, `text-[var(--text-secondary)]` 등
3. **테두리 색상**: `border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]`

### 하드코딩된 색상 금지

다음과 같은 하드코딩된 색상은 사용하지 않음:
- ❌ `bg-white` (단독 사용)
- ❌ `bg-gray-50`, `bg-gray-900` (CSS 변수 대신)
- ❌ `text-gray-900`, `text-gray-100` (CSS 변수 대신)

대신 CSS 변수 기반 색상 사용:
- ✅ `bg-[rgb(var(--color-secondary-50))]`
- ✅ `text-[var(--text-primary)]`

---

## 🔍 추가 검토 사항

### 1. 모바일 네비게이션

모바일 드로어의 배경색도 일관되게 적용되어 있는지 확인:
```typescript
// components/navigation/global/navStyles.ts:376
drawer: `${layoutStyles.bgWhite} ...`,
```

`bgWhite`를 수정하면 모바일 드로어도 자동으로 일관되게 적용됨.

### 2. Breadcrumbs

Breadcrumbs의 배경색도 확인:
```typescript
// components/navigation/global/navStyles.ts:304
container: `... ${designTokens.colors.gray.bg50} ...`,
```

이 부분은 이미 CSS 변수 기반으로 올바르게 설정되어 있음.

### 3. CategoryNav

CategoryNav의 배경색은 투명하므로 문제 없음.

---

## ✅ 예상 결과

수정 후:
- ✅ 라이트 모드: 사이드바와 메인 콘텐츠 모두 `bg-[rgb(var(--color-secondary-50))]` (연한 회색)
- ✅ 다크 모드: 사이드바와 메인 콘텐츠 모두 `bg-[rgb(var(--color-secondary-900))]` (어두운 회색)
- ✅ 시각적 일관성 향상
- ✅ CSS 변수 기반으로 통일된 색상 관리

---

## 📚 참고 문서

- [다크모드 구현 가이드](./2025-02-02-dark-mode-implementation-guide.md)
- [다크모드 분석](./2025-02-02-dark-mode-analysis.md)
- [학생 레이아웃 다크모드 리뷰](./student-layout-dark-mode-review.md)

