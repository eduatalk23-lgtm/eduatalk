# 우선순위 중간 컴포넌트 타이포그래피 시스템 적용

**작성 일시**: 2025-01-XX  
**목적**: 우선순위 중간 컴포넌트에 타이포그래피 시스템 적용

---

## 📋 작업 개요

우선순위 중간으로 분류된 5개 컴포넌트에 타이포그래피 시스템을 적용하여 일관된 텍스트 스타일을 확보했습니다.

---

## ✅ 변경 사항

### 1. SearchModal 컴포넌트 (`components/molecules/SearchModal.tsx`)

#### 라벨 및 입력 필드
- **변경 전**: `text-sm`
- **변경 후**: `text-body-2` (17px)
- **적용 위치**: 검색 라벨, 입력 필드, 관계 선택 라벨, select 필드

#### 힌트 메시지
- **변경 전**: `text-xs`
- **변경 후**: `text-body-2` (17px)

#### 버튼 및 메시지
- **변경 전**: `text-sm`
- **변경 후**: `text-body-2` (17px)
- **적용 위치**: 검색 중 메시지, 검색 결과 없음 메시지, 검색 결과 헤더, 닫기 버튼

```typescript
// 변경 전
<label className="block text-sm font-medium text-[var(--text-secondary)]">
<input className="... text-sm ..." />
<p className="text-xs text-[var(--text-tertiary)]">
<div className="py-8 text-center text-sm text-[var(--text-tertiary)]">

// 변경 후
<label className="block text-body-2-bold text-[var(--text-secondary)]">
<input className="... text-body-2 ..." />
<p className="text-body-2 text-[var(--text-tertiary)]">
<div className="py-8 text-center text-body-2 text-[var(--text-tertiary)]">
```

---

### 2. Tabs 컴포넌트 (`components/molecules/Tabs.tsx`)

#### sizeClasses 업데이트
- **변경 전**:
  - `sm`: `text-xs` (12px)
  - `md`: `text-sm` (14px)
  - `lg`: `text-base` (16px)
- **변경 후**:
  - `sm`: `text-body-2` (17px)
  - `md`: `text-body-2` (17px)
  - `lg`: `text-body-1` (19px)

#### Badge 텍스트
- **변경 전**: `text-xs`
- **변경 후**: `text-body-2` (17px)

```typescript
// 변경 전
const sizeClasses = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};
<span className="rounded-full px-1.5 py-0.5 text-xs font-medium">

// 변경 후
const sizeClasses = {
  sm: "px-3 py-1.5 text-body-2",
  md: "px-4 py-2 text-body-2",
  lg: "px-6 py-3 text-body-1",
};
<span className="rounded-full px-1.5 py-0.5 text-body-2 font-medium">
```

---

### 3. DataTable 컴포넌트 (`components/organisms/DataTable.tsx`)

#### 헤더 및 셀 텍스트
- **변경 전**:
  - `compact`: `text-xs` (12px)
  - 일반: `text-sm` (14px)
- **변경 후**:
  - `compact`: `text-body-2` (17px)
  - 일반: `text-body-2` (17px)

```typescript
// 변경 전
<th className={cn(
  "...",
  compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
  ...
)}>
<td className={cn(
  compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
  ...
)}>

// 변경 후
<th className={cn(
  "...",
  compact ? "px-3 py-2 text-body-2" : "px-4 py-3 text-body-2",
  ...
)}>
<td className={cn(
  compact ? "px-3 py-2 text-body-2" : "px-4 py-3 text-body-2",
  ...
)}>
```

---

### 4. UnifiedContentFilter 컴포넌트 (`components/filters/UnifiedContentFilter.tsx`)

#### 라벨
- **변경 전**: `text-xs font-medium`
- **변경 후**: `text-body-2-bold` (17px, font-weight: 700)
- **적용 위치**: 모든 필터 라벨 (개정교육과정, 교과, 과목, 출판사, 플랫폼, 콘텐츠 유형, 난이도, 제목 검색, 정렬)

#### 입력 필드 및 버튼
- **변경 전**: `text-sm`
- **변경 후**: `text-body-2` (17px)
- **적용 위치**: 모든 select, input 필드, 버튼

```typescript
// 변경 전
<label className="text-xs font-medium text-[var(--text-secondary)]">
<select className="... text-sm" />
<input className="... text-sm" />
<button className="... text-sm font-semibold ..." />

// 변경 후
<label className="text-body-2-bold text-[var(--text-secondary)]">
<select className="... text-body-2" />
<input className="... text-body-2" />
<button className="... text-body-2 font-semibold ..." />
```

---

### 5. BaseBookSelector 컴포넌트 (`components/forms/BaseBookSelector.tsx`)

#### 제목
- **변경 전**: `text-lg font-semibold`
- **변경 후**: `text-h2 font-semibold` (32px)
- **적용 위치**: "교재 등록", "교재 검색 및 선택" 제목

#### 라벨 및 입력 필드
- **변경 전**: `text-sm`
- **변경 후**: `text-body-2` (17px)
- **적용 위치**: 모든 라벨, input, select, textarea, 버튼, 메시지

```typescript
// 변경 전
<h3 className="text-lg font-semibold text-[var(--text-primary)]">
<label className="block text-sm font-medium ...">
<input className="... text-sm ..." />
<button className="... text-sm font-semibold ..." />

// 변경 후
<h3 className="text-h2 font-semibold text-[var(--text-primary)]">
<label className="block text-body-2 font-medium ...">
<input className="... text-body-2 ..." />
<button className="... text-body-2 font-semibold ..." />
```

---

## 🎯 개선 효과

### 1. 일관성 확보
- 모든 필터 및 폼 컴포넌트가 동일한 타이포그래피 시스템 사용
- 라벨, 입력 필드, 버튼의 텍스트 크기 통일

### 2. 가독성 향상
- 작은 텍스트 크기 개선 (12px → 17px, 14px → 17px)
- 제목 크기 표준화 (18px → 32px)

### 3. 디자인 시스템 준수
- 하드코딩된 텍스트 크기 제거
- 의미 있는 타이포그래피 클래스 사용

### 4. 유지보수성 향상
- 타이포그래피 변경 시 `globals.css`만 수정하면 전체 적용
- 컴포넌트별 개별 수정 불필요

---

## 📊 영향 범위

### 직접 영향
- **SearchModal**: 검색 모달의 모든 텍스트 스타일 변경
- **Tabs**: 탭 버튼 및 배지 텍스트 크기 변경
- **DataTable**: 테이블 헤더 및 셀 텍스트 크기 변경
- **UnifiedContentFilter**: 모든 필터 라벨 및 입력 필드 스타일 변경
- **BaseBookSelector**: 교재 선택 폼의 모든 텍스트 스타일 변경

### 사용 위치
- 검색 기능이 있는 모든 페이지
- 탭이 사용되는 모든 페이지
- 데이터 테이블이 사용되는 모든 페이지
- 필터가 사용되는 콘텐츠 목록 페이지
- 교재 선택이 필요한 모든 폼

---

## ✅ 검증 사항

### 1. 타입 안전성
- ✅ TypeScript 타입 에러 없음
- ✅ 모든 props 타입 정상 작동

### 2. 스타일 일관성
- ✅ 라벨: `text-body-2-bold` 적용
- ✅ 입력 필드: `text-body-2` 적용
- ✅ 버튼: `text-body-2` 적용
- ✅ 제목: `text-h2` 적용

### 3. 접근성
- ✅ 라벨과 입력 필드 연결 유지
- ✅ ARIA 속성 정상 작동

---

## 📝 참고 사항

### 타이포그래피 시스템 클래스
- `text-body-2`: 17px (기본 본문 텍스트)
- `text-body-2-bold`: 17px, font-weight: 700 (강조 텍스트)
- `text-body-1`: 19px (큰 본문 텍스트)
- `text-h2`: 32px (섹션 제목)

### 기존 텍스트 크기 매핑
- `text-xs` (12px) → `text-body-2` (17px)
- `text-sm` (14px) → `text-body-2` (17px)
- `text-base` (16px) → `text-body-1` (19px)
- `text-lg` (18px) → `text-h2` (32px)

---

## 🔄 다음 단계

### 완료된 작업
- ✅ SearchModal 컴포넌트 타이포그래피 적용
- ✅ Tabs 컴포넌트 타이포그래피 적용
- ✅ DataTable 컴포넌트 타이포그래피 적용
- ✅ UnifiedContentFilter 컴포넌트 타이포그래피 적용
- ✅ BaseBookSelector 컴포넌트 타이포그래피 적용

### 향후 작업
- 우선순위 낮은 컴포넌트 점진적 적용
- 새로운 컴포넌트 작성 시 필수 적용

---

**작성 일시**: 2025-01-XX

