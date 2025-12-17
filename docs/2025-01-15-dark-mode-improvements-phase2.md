# 다크 모드 개선 작업 Phase 2

**작업 일시**: 2025-01-15  
**작업 범위**: 미개선 부분 즉시 개선  
**완료율**: 100%

---

## 개요

라이트/다크 모드 검토 결과를 바탕으로 우선순위가 높은 파일들의 개선을 완료했습니다. Deprecated 함수를 CSS 변수 기반 유틸리티로 교체하고, 하드코딩된 색상 클래스를 유틸리티 함수로 교체했습니다.

---

## 완료된 작업

### 1. ScoreCard.tsx 개선 ✅

**파일**: `app/(student)/scores/_components/ScoreCard.tsx`

**변경 사항**:
- ✅ Deprecated 함수를 CSS 변수 기반으로 교체
  - `textPrimary` → `textPrimaryVar` (19개 위치)
  - `textMuted` → `textMutedVar` (19개 위치)
  - `borderDefault` → `borderDefaultVar` (1개 위치)

**주요 변경 위치**:
- `scoreFields`: 모든 텍스트 색상 클래스 교체
- `detailDialogContent`: 기본 정보 및 성적 정보 섹션의 모든 색상 클래스 교체

**사용된 유틸리티**:
```typescript
import {
  textMutedVar,
  textPrimaryVar,
  borderDefaultVar,
} from "@/lib/utils/darkMode";
```

---

### 2. GoalProgressSection.tsx 개선 ✅

**파일**: `app/(student)/report/weekly/_components/GoalProgressSection.tsx`

**변경 사항**:
- ✅ Deprecated 함수를 CSS 변수 기반으로 교체
  - `textPrimary` → `textPrimaryVar` (3개 위치)
  - `textTertiary` → `textTertiaryVar` (1개 위치)
  - `textMuted` → `textMutedVar` (1개 위치)
  - `borderDefault` → `borderDefaultVar` (2개 위치)
  - `bgSurface` → `bgSurfaceVar` (2개 위치)

**사용된 유틸리티**:
```typescript
import {
  goalStatusColors,
  borderDefaultVar,
  bgSurfaceVar,
  textPrimaryVar,
  textTertiaryVar,
  textMutedVar,
} from "@/lib/utils/darkMode";
```

---

### 3. SubjectAnalysisSection.tsx 개선 ✅

**파일**: `app/(student)/report/monthly/_components/SubjectAnalysisSection.tsx`

**변경 사항**:
- ✅ 하드코딩된 색상을 CSS 변수 기반 유틸리티 및 다크 모드 클래스로 교체
  - 컨테이너: `border-gray-200 bg-white` → `borderDefaultVar`, `bgSurfaceVar`
  - 제목: `text-gray-900` → `textPrimaryVar`
  - 빈 상태 텍스트: `text-gray-500` → `textTertiaryVar`
  - 강점 과목 섹션: 다크 모드 클래스 추가
    - `text-green-700` → `text-green-700 dark:text-green-300`
    - `border-green-200 bg-green-50 text-green-800` → 다크 모드 클래스 추가
  - 약점 과목 섹션: 다크 모드 클래스 추가
    - `text-red-700` → `text-red-700 dark:text-red-300`
    - `border-red-200 bg-red-50 text-red-800` → 다크 모드 클래스 추가

**사용된 유틸리티**:
```typescript
import {
  bgSurfaceVar,
  borderDefaultVar,
  textPrimaryVar,
  textTertiaryVar,
} from "@/lib/utils/darkMode";
```

---

### 4. WeeklyCoachingSection.tsx 개선 ✅

**파일**: `app/(student)/report/weekly/_components/WeeklyCoachingSection.tsx`

**변경 사항**:
- ✅ 하드코딩된 색상을 CSS 변수 기반 유틸리티 및 다크 모드 클래스로 교체
  - 컨테이너: `border-gray-200 bg-white` → `borderDefaultVar`, `bgSurfaceVar`
  - 제목: `text-gray-900` → `textPrimaryVar`
  - Summary 섹션: `bg-indigo-50 text-indigo-900` → 다크 모드 클래스 추가
  - Highlights 섹션: `text-gray-700` → `textSecondaryVar`
  - Warnings 섹션: `text-gray-700`, `text-red-700` → `textSecondaryVar`, 다크 모드 클래스 추가
  - Next Week Guide 섹션: `text-gray-700`, `text-yellow-800` → `textSecondaryVar`, 다크 모드 클래스 추가

**사용된 유틸리티**:
```typescript
import {
  bgSurfaceVar,
  borderDefaultVar,
  textPrimaryVar,
  textSecondaryVar,
} from "@/lib/utils/darkMode";
```

---

## 통계

### 변경된 파일
- ✅ `ScoreCard.tsx`: Deprecated 함수 19개 위치 교체
- ✅ `GoalProgressSection.tsx`: Deprecated 함수 6개 위치 교체
- ✅ `SubjectAnalysisSection.tsx`: 하드코딩된 색상 10개 위치 교체
- ✅ `WeeklyCoachingSection.tsx`: 하드코딩된 색상 8개 위치 교체

### 적용된 유틸리티 함수
- CSS 변수 기반: `textPrimaryVar`, `textSecondaryVar`, `textTertiaryVar`, `textMutedVar`, `bgSurfaceVar`, `borderDefaultVar`
- 상태 색상: `goalStatusColors` (유지)

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

### 특수 색상에 다크 모드 클래스 추가

**패턴**:
```tsx
// 상태 색상 (Green, Red, Yellow 등)
<div className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">
  내용
</div>

// 아이콘 색상
<span className="text-green-600 dark:text-green-400">✓</span>
<span className="text-red-600 dark:text-red-400">⚠</span>
<span className="text-yellow-600 dark:text-yellow-400">→</span>
```

---

## 향후 개선 사항

### 추가 마이그레이션 대상

1. **Deprecated 함수 사용 파일들**
   - 약 50+ 파일에서 여전히 deprecated 함수 사용
   - 점진적으로 CSS 변수 기반으로 마이그레이션 필요

2. **하드코딩된 색상**
   - 약 30개 파일에서 하드코딩된 색상 사용
   - 우선순위에 따라 점진적 개선

3. **리포트 페이지 컴포넌트들**
   - 다른 리포트 컴포넌트들도 유사한 패턴 확인
   - 일괄 개선 가능

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
   - Deprecated 함수 사용 금지

---

## 참고 자료

- [다크 모드 사용 가이드](./dark-mode-usage-guide.md)
- [다크 모드 즉시 적용 개선](./2025-01-15-dark-mode-immediate-improvements.md)
- `lib/utils/darkMode.ts` - 모든 유틸리티 함수 정의
- `app/globals.css` - CSS 변수 시스템 정의

---

**작업 완료**: 2025-01-15  
**다음 단계**: 추가 컴포넌트 점진적 마이그레이션
