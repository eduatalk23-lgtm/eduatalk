# 우선순위 낮은 컴포넌트 타이포그래피 시스템 적용

**작성 일시**: 2025-01-XX  
**목적**: 우선순위 낮은 컴포넌트에 타이포그래피 시스템 적용

---

## 📋 작업 개요

우선순위 낮은 컴포넌트들에 타이포그래피 시스템을 적용하여 프로젝트 전반의 일관성을 확보했습니다.

---

## ✅ 변경 사항

### 1. ErrorBoundary 컴포넌트 (`components/errors/ErrorBoundary.tsx`)

#### 에러 메시지 및 버튼
- **변경 전**: 
  - 제목: `text-sm font-semibold`
  - 설명: `text-sm`
  - 개발자 정보: `text-xs`
  - 버튼: `text-sm`
- **변경 후**: 
  - 제목: `text-body-2-bold`
  - 설명: `text-body-2`
  - 개발자 정보: `text-body-2`
  - 버튼: `text-body-2`

```typescript
// 변경 전
<h3 className="text-sm font-semibold text-error-800">
<p className="text-sm text-error-700">
<summary className="cursor-pointer text-xs text-error-600">
<pre className="... text-xs ...">
<button className="... text-sm font-medium ...">

// 변경 후
<h3 className="text-body-2-bold text-error-800">
<p className="text-body-2 text-error-700">
<summary className="cursor-pointer text-body-2 text-error-600">
<pre className="... text-body-2 ...">
<button className="... text-body-2 font-medium ...">
```

---

### 2. GlobalErrorBoundary 컴포넌트 (`components/errors/GlobalErrorBoundary.tsx`)

#### 개발자 정보
- **변경 전**: 
  - 요약: `text-sm font-semibold`
  - 라벨: `text-xs font-semibold`
  - 코드 블록: `text-xs`
- **변경 후**: 
  - 요약: `text-body-2-bold`
  - 라벨: `text-body-2 font-semibold`
  - 코드 블록: `text-body-2`

```typescript
// 변경 전
<summary className="cursor-pointer text-sm font-semibold text-error-800">
<div className="text-xs font-semibold text-error-700 mb-1">
<pre className="... text-xs ...">

// 변경 후
<summary className="cursor-pointer text-body-2-bold text-error-800">
<div className="text-body-2 font-semibold text-error-700 mb-1">
<pre className="... text-body-2 ...">
```

**설명**: ErrorState 컴포넌트를 사용하므로 메인 에러 메시지는 이미 타이포그래피 시스템이 적용되어 있습니다.

---

### 3. navStyles 유틸리티 (`components/navigation/global/navStyles.ts`)

#### 네비게이션 아이템 스타일
- **변경 전**: 
  - 기본 아이템: `text-sm`
  - 카테고리 헤더: `text-sm`
  - 하위 아이템: `text-sm`
  - 자식 아이템: `text-xs`
  - 툴팁: `text-xs`
  - 브레드크럼: `text-sm`
  - 로고 링크: `text-lg`
- **변경 후**: 
  - 기본 아이템: `text-body-2`
  - 카테고리 헤더: `text-body-2`
  - 하위 아이템: `text-body-2`
  - 자식 아이템: `text-body-2`
  - 툴팁: `text-body-2`
  - 브레드크럼: `text-body-2`
  - 로고 링크: `text-h2`

```typescript
// 변경 전
base: "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ..."
base: "flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium ..."
base: "absolute ... text-xs text-white ..."
container: `flex items-center gap-1 ... text-sm ...`
logoLink: `${layoutStyles.flexCenter} text-lg font-semibold ...`

// 변경 후
base: "flex items-center gap-2 rounded-lg px-3 py-2 text-body-2 font-medium ..."
base: "flex items-center gap-2 rounded-lg px-4 py-1.5 text-body-2 font-medium ..."
base: "absolute ... text-body-2 text-white ..."
container: `flex items-center gap-1 ... text-body-2 ...`
logoLink: `${layoutStyles.flexCenter} text-h2 font-semibold ...`
```

**설명**: 네비게이션 전반의 스타일을 관리하는 유틸리티 파일이므로, 모든 네비게이션 컴포넌트에 영향을 미칩니다.

---

### 4. ExcelImportDialog 컴포넌트 (`components/admin/ExcelImportDialog.tsx`)

#### 라벨 및 메시지
- **변경 전**: 
  - 라벨: `text-sm font-medium`
  - 입력 필드: `text-sm`
  - 파일 정보: `text-sm`
  - 경고 메시지: `text-sm`
- **변경 후**: 
  - 라벨: `text-body-2-bold`
  - 입력 필드: `text-body-2`
  - 파일 정보: `text-body-2`
  - 경고 메시지: `text-body-2`

```typescript
// 변경 전
<label className="block text-sm font-medium text-[var(--text-secondary)]">
<input className="block w-full text-sm ... file:text-sm ..." />
<p className="text-sm text-[var(--text-secondary)]">
<p className="text-sm text-warning-800">

// 변경 후
<label className="block text-body-2-bold text-[var(--text-secondary)]">
<input className="block w-full text-body-2 ... file:text-body-2 ..." />
<p className="text-body-2 text-[var(--text-secondary)]">
<p className="text-body-2 text-warning-800">
```

---

### 5. CategoryNav 컴포넌트 (`components/navigation/global/CategoryNav.tsx`)

#### 툴팁
- **변경 전**: `text-xs`
- **변경 후**: `text-body-2`

```typescript
// 변경 전
<span className="... text-xs font-medium ..." role="tooltip">

// 변경 후
<span className="... text-body-2 font-medium ..." role="tooltip">
```

**설명**: navStyles.ts의 tooltipStyles를 사용하지만, 직접 정의된 부분도 수정했습니다.

---

### 6. LogoSection 컴포넌트 (`components/navigation/global/LogoSection.tsx`)

#### 로고 및 라벨
- **변경 전**: 
  - 로고: `text-lg font-semibold`
  - 역할 라벨: `text-xs`
- **변경 후**: 
  - 로고: `text-h2 font-semibold`
  - 역할 라벨: `text-body-2`

```typescript
// 변경 전
className={`${layoutStyles.flexCenter} text-lg font-semibold ${layoutStyles.textHeading}`}
<span className={`ml-2 text-xs ${layoutStyles.textMuted}`}>{roleLabel}</span>

// 변경 후
className={`${layoutStyles.flexCenter} text-h2 font-semibold ${layoutStyles.textHeading}`}
<span className={`ml-2 text-body-2 ${layoutStyles.textMuted}`}>{roleLabel}</span>
```

---

### 7. TenantInfo 컴포넌트 (`components/navigation/global/TenantInfo.tsx`)

#### 텍스트
- **변경 전**: `text-sm`
- **변경 후**: `text-body-2`

```typescript
// 변경 전
<span className="text-sm">🏢</span>
<div className={`text-sm font-semibold ${layoutStyles.textHeading} truncate`}>

// 변경 후
<span className="text-body-2">🏢</span>
<div className={`text-body-2 font-semibold ${layoutStyles.textHeading} truncate`}>
```

---

## 🎯 개선 효과

### 1. 일관성 확보
- 모든 에러 처리 컴포넌트가 동일한 타이포그래피 시스템 사용
- 네비게이션 전반의 텍스트 스타일 통일
- 관리자 컴포넌트의 텍스트 스타일 표준화

### 2. 가독성 향상
- 작은 텍스트 크기 개선 (12px/14px → 17px)
- 특히 에러 메시지와 개발자 정보의 가독성 향상

### 3. 디자인 시스템 준수
- 하드코딩된 텍스트 크기 제거
- 의미 있는 타이포그래피 클래스 사용

### 4. 유지보수성 향상
- navStyles.ts를 통한 중앙 집중식 스타일 관리
- 타이포그래피 변경 시 `globals.css`만 수정하면 전체 적용

---

## 📊 영향 범위

### 직접 영향
- **ErrorBoundary**: 모든 에러 바운더리 메시지 스타일 변경
- **GlobalErrorBoundary**: 전역 에러 메시지 스타일 변경
- **navStyles**: 모든 네비게이션 컴포넌트에 영향
- **ExcelImportDialog**: Excel 업로드 다이얼로그 스타일 변경
- **CategoryNav**: 카테고리 네비게이션 툴팁 스타일 변경
- **LogoSection**: 로고 및 역할 라벨 스타일 변경
- **TenantInfo**: 테넌트 정보 텍스트 스타일 변경

### 사용 위치
- 에러가 발생하는 모든 페이지
- 네비게이션이 사용되는 모든 페이지
- Excel 업로드 기능이 있는 관리자 페이지

---

## ✅ 검증 사항

### 1. 타입 안전성
- ✅ TypeScript 타입 에러 없음
- ✅ 모든 props 타입 정상 작동

### 2. 스타일 일관성
- ✅ ErrorBoundary: `text-body-2`, `text-body-2-bold` 적용
- ✅ GlobalErrorBoundary: `text-body-2`, `text-body-2-bold` 적용
- ✅ navStyles: 모든 네비게이션 스타일 `text-body-2` 적용
- ✅ ExcelImportDialog: `text-body-2`, `text-body-2-bold` 적용
- ✅ 네비게이션 컴포넌트: `text-body-2`, `text-h2` 적용

### 3. 접근성
- ✅ ErrorBoundary: `role="alert"` 유지
- ✅ 툴팁: `role="tooltip"` 유지
- ✅ 키보드 네비게이션 정상 작동

---

## 📝 참고 사항

### 타이포그래피 시스템 클래스
- `text-body-2`: 17px (기본 본문 텍스트)
- `text-body-2-bold`: 17px, font-weight: 700 (강조 텍스트)
- `text-h2`: 32px (섹션 제목)

### 기존 텍스트 크기 매핑
- `text-xs` (12px) → `text-body-2` (17px)
- `text-sm` (14px) → `text-body-2` (17px)
- `text-lg` (18px) → `text-h2` (32px)

### navStyles.ts의 역할
- 네비게이션 전반의 스타일을 중앙 집중식으로 관리
- 모든 네비게이션 컴포넌트가 이 유틸리티를 사용
- 타이포그래피 변경 시 한 곳만 수정하면 전체 적용

---

## 🔄 다음 단계

### 완료된 작업
- ✅ ErrorBoundary 컴포넌트 타이포그래피 적용
- ✅ GlobalErrorBoundary 컴포넌트 타이포그래피 적용
- ✅ navStyles 유틸리티 타이포그래피 적용
- ✅ ExcelImportDialog 컴포넌트 타이포그래피 적용
- ✅ CategoryNav 컴포넌트 타이포그래피 적용
- ✅ LogoSection 컴포넌트 타이포그래피 적용
- ✅ TenantInfo 컴포넌트 타이포그래피 적용

### 향후 작업
- 남은 컴포넌트들 (LazyRecharts 등)은 점진적 적용
- 새로운 컴포넌트 작성 시 필수 적용

---

**작성 일시**: 2025-01-XX

