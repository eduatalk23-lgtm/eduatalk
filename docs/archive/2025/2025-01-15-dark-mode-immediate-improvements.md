# 다크 모드 즉시 적용 개선 작업

**작업 일시**: 2025-01-15  
**작업 범위**: 즉시 적용 가능한 다크 모드 개선 사항 적용  
**완료율**: 100%

---

## 개요

라이트/다크 모드 검토 결과를 바탕으로 즉시 적용 가능한 개선 사항들을 적용했습니다. CSS 변수 기반 유틸리티를 활용하여 다크 모드 지원을 강화하고, 하드코딩된 색상 클래스를 유틸리티 함수로 교체했습니다.

---

## 완료된 작업

### 1. MockScoreCard.tsx 개선 ✅

**파일**: `app/(student)/scores/mock/[grade]/[month]/[exam-type]/_components/MockScoreCard.tsx`

**변경 사항**:
- ✅ `periodBadge`에 다크 모드 클래스 추가
  - `bg-blue-50` → `bg-blue-50 dark:bg-blue-900/30`
  - `text-blue-700` → `text-blue-700 dark:text-blue-300`
  - `ring-blue-200` → `ring-blue-200 dark:ring-blue-800`

- ✅ `scoreFields`에 CSS 변수 기반 유틸리티 적용
  - `text-gray-500` → `textTertiaryVar`
  - `text-gray-900` → `textPrimaryVar`

- ✅ `detailDialogContent`에 CSS 변수 기반 유틸리티 적용
  - 모든 텍스트 색상을 CSS 변수 기반으로 변경
  - `border-gray-200` → `borderDefaultVar`

**사용된 유틸리티**:
```typescript
import {
  textPrimaryVar,
  textSecondaryVar,
  textTertiaryVar,
  borderDefaultVar,
} from "@/lib/utils/darkMode";
```

---

### 2. MockComparisonTable.tsx 개선 ✅

**파일**: `app/(student)/scores/analysis/_components/MockComparisonTable.tsx`

**변경 사항**:
- ✅ 하드코딩된 색상 클래스를 유틸리티 함수로 교체
  - 테이블 헤더: `bg-gray-50 border-gray-200` → `getGrayBgClasses("tableHeader")`, `borderDefaultVar`
  - 테이블 행: `border-gray-100 hover:bg-gray-50` → `tableRowBase`
  - 텍스트 색상: `text-gray-900`, `text-gray-600`, `text-gray-700` → CSS 변수 기반 유틸리티
  - 등급 배지: 하드코딩된 색상 → `getGradeColor()` 함수 활용

- ✅ 등급 배지 색상 개선
  - 기존: 하드코딩된 조건부 클래스
  - 변경: `getGradeColor()` 함수로 일관된 색상 적용

- ✅ 변화 색상 개선
  - `text-green-600`, `text-red-600` 등에 다크 모드 클래스 추가

**사용된 유틸리티**:
```typescript
import {
  textPrimaryVar,
  textSecondaryVar,
  textTertiaryVar,
  bgSurfaceVar,
  borderDefaultVar,
  getGrayBgClasses,
  tableHeaderBase,
  tableCellBase,
  tableRowBase,
  divideDefaultVar,
} from "@/lib/utils/darkMode";
```

---

### 3. Admin 학생 페이지 개선 ✅

**파일**: `app/(admin)/admin/students/page.tsx`

**변경 사항**:
- ✅ `divideDefaultVar` 추가 및 적용
  - `divide-gray-200 dark:divide-gray-700` → `divideDefaultVar`

**변경 내용**:
```typescript
// Before
<tbody className={cn("divide-y", "divide-gray-200 dark:divide-gray-700", bgSurface)}>

// After
<tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
```

---

### 4. ScoreListTable.tsx 마이그레이션 ✅

**파일**: `app/(student)/scores/_components/ScoreListTable.tsx`

**변경 사항**:
- ✅ Deprecated 함수를 CSS 변수 기반으로 교체
  - `textPrimary` → `textPrimaryVar`
  - `textSecondary` → `textSecondaryVar`
  - `textTertiary` → `textTertiaryVar`
  - `textMuted` → `textMutedVar`
  - `bgSurface` → `bgSurfaceVar`
  - `bgHover` → `bgHoverVar`
  - `divideDefault` → `divideDefaultVar`
  - `borderDefault` → `borderDefaultVar`
  - `borderInput` → `borderInputVar`

**주요 변경 위치**:
- 필터 컨트롤 영역
- 테이블 헤더 및 본문
- 모바일 카드 뷰
- 정렬 버튼

---

## 적용된 패턴

### CSS 변수 기반 유틸리티 우선 사용

**권장 패턴**:
```tsx
import {
  textPrimaryVar,
  textSecondaryVar,
  bgSurfaceVar,
  borderDefaultVar,
} from "@/lib/utils/darkMode";

// 사용 예시
<div className={cn(bgSurfaceVar, borderDefaultVar)}>
  <h1 className={textPrimaryVar}>제목</h1>
  <p className={textSecondaryVar}>설명</p>
</div>
```

**이점**:
- CSS 변수가 자동으로 다크 모드에 대응
- `dark:` 클래스 불필요
- 중앙 집중식 색상 관리

### 유틸리티 함수 활용

**등급 배지 색상**:
```tsx
// Before
className={`${
  grade_score <= 2 ? "bg-green-100 text-green-800"
  : grade_score <= 4 ? "bg-blue-100 text-blue-800"
  : ...
}`}

// After
const gradeColor = getGradeColor(grade_score);
<span className={gradeColor.badge}>등급</span>
```

**테이블 스타일**:
```tsx
// Before
<thead className="bg-gray-50 border-b border-gray-200">
<th className="px-4 py-3 text-left font-medium text-gray-700">

// After
<thead className={cn(getGrayBgClasses("tableHeader"), "border-b", borderDefaultVar)}>
<th className={tableHeaderBase}>
```

---

## 통계

### 변경된 파일
- ✅ `MockScoreCard.tsx`: 5개 위치 개선
- ✅ `MockComparisonTable.tsx`: 전체 리팩토링
- ✅ `ScoreListTable.tsx`: Deprecated 함수 26개 위치 교체
- ✅ `admin/students/page.tsx`: 1개 위치 개선

### 적용된 유틸리티 함수
- CSS 변수 기반: `textPrimaryVar`, `textSecondaryVar`, `textTertiaryVar`, `textMutedVar`, `bgSurfaceVar`, `borderDefaultVar`, `borderInputVar`, `divideDefaultVar`, `bgHoverVar`
- 유틸리티 함수: `getGrayBgClasses()`, `tableHeaderBase`, `tableCellBase`, `tableRowBase`, `getGradeColor()`

---

## 향후 개선 사항

### 추가 마이그레이션 대상

1. **Admin 페이지**
   - 나머지 컴포넌트에서 deprecated 함수 교체
   - CSS 변수 기반 유틸리티 적용

2. **Student 페이지**
   - 리포트 관련 컴포넌트들
   - 분석 페이지 컴포넌트들

3. **공통 컴포넌트**
   - 일부 컴포넌트에서 하드코딩된 색상 제거

### 권장 사항

1. **새로운 코드 작성 시**
   - 항상 CSS 변수 기반 유틸리티 사용
   - `darkMode.ts`의 함수 우선 활용

2. **기존 코드 개선 시**
   - 점진적으로 CSS 변수 기반으로 마이그레이션
   - 우선순위가 높은 컴포넌트부터 적용

3. **코드 리뷰 체크리스트**
   - 다크 모드 지원 여부 확인
   - CSS 변수 기반 유틸리티 사용 여부 확인

---

## 참고 자료

- [다크 모드 사용 가이드](./dark-mode-usage-guide.md)
- `lib/utils/darkMode.ts` - 모든 유틸리티 함수 정의
- `app/globals.css` - CSS 변수 시스템 정의

---

**작업 완료**: 2025-01-15  
**다음 단계**: 추가 컴포넌트 점진적 마이그레이션
