# 월간 리포트 성적 변화 기능 제거

## 📋 작업 개요

**작업 일자**: 2024년 11월 29일  
**이슈**: Console Error - `[reports/monthly] 성적 변화 조회 실패`  
**에러 코드**: PGRST205 (PostgREST Schema Cache Error)

## 🔍 문제 분석

### 발생 원인

```
Could not find the table 'public.student_scores' in the schema cache
Hint: Perhaps you meant the table 'public.student_mock_scores'
```

1. **레거시 테이블 참조**: `getMonthlyScoreTrend` 함수가 이미 존재하지 않는 `student_scores` 테이블을 조회
2. **스키마 마이그레이션 완료**: 성적 데이터는 이미 `student_school_scores` (→ `student_internal_scores`)와 `student_mock_scores`로 분리됨
3. **미사용 코드**: 해당 함수가 반환하는 데이터가 UI에서 실제로 사용되지 않음

### 기술적 배경

프로젝트는 성적 관리 스키마 마이그레이션을 완료했으며, 레거시 `student_scores` 테이블은 다음으로 대체됨:

- `student_school_scores` → 내신 성적
- `student_mock_scores` → 모의고사 성적

그러나 월간 리포트 모듈의 `getMonthlyScoreTrend` 함수는 여전히 구 스키마를 참조하고 있었음.

## ✅ 해결 방법

### 제거된 코드

#### 1. Type 정의 제거

```typescript
// lib/reports/monthly.ts
export type MonthlyScoreTrend = {
  thisMonth: Array<{
    subject: string;
    grade: number;
    rawScore: number;
    testDate: string;
  }>;
  lastMonth: Array<{
    subject: string;
    grade: number;
    rawScore: number;
    testDate: string;
  }>;
  trend: "improving" | "declining" | "stable";
};
```

#### 2. 함수 제거

```typescript
// lib/reports/monthly.ts - getMonthlyScoreTrend 함수 전체 (약 125줄)
```

#### 3. MonthlyReport 타입 업데이트

```typescript
// Before
export type MonthlyReport = {
  // ...
  scores: MonthlyScoreTrend;
  // ...
};

// After
export type MonthlyReport = {
  // ...
  // scores 필드 제거
  // ...
};
```

#### 4. getMonthlyReportData 함수 수정

```typescript
// Before
const [
  studyTime,
  planSummary,
  goalSummary,
  scoreTrend, // 제거됨
  weakSubjects,
  // ...
] = await Promise.all([
  getMonthlyStudyTime(supabase, studentId, monthStart, monthEnd),
  getMonthlyPlanSummary(supabase, studentId, monthStart, monthEnd),
  getMonthlyGoalSummary(supabase, studentId, monthStart, monthEnd),
  getMonthlyScoreTrend(
    supabase,
    studentId,
    monthStart,
    monthEnd,
    lastMonthStart,
    lastMonthEnd
  ), // 제거됨
  getMonthlyWeakSubjectTrend(supabase, studentId, monthStart, monthEnd),
  // ...
]);

// After
const [
  studyTime,
  planSummary,
  goalSummary,
  weakSubjects,
  // ...
] = await Promise.all([
  getMonthlyStudyTime(supabase, studentId, monthStart, monthEnd),
  getMonthlyPlanSummary(supabase, studentId, monthStart, monthEnd),
  getMonthlyGoalSummary(supabase, studentId, monthStart, monthEnd),
  getMonthlyWeakSubjectTrend(supabase, studentId, monthStart, monthEnd),
  // ...
]);
```

### 수정된 컴포넌트

#### 1. SubjectAnalysisSection (학생/부모 공통)

```typescript
// Before
type SubjectAnalysisSectionProps = {
  strongSubjects: string[];
  weakSubjects: string[];
  weakSubjectDetails: MonthlyScoreTrend; // 제거됨
};

// After
type SubjectAnalysisSectionProps = {
  strongSubjects: string[];
  weakSubjects: string[];
};
```

**파일**:

- `app/(student)/report/monthly/_components/SubjectAnalysisSection.tsx`
- 호출처: `app/(student)/report/monthly/page.tsx`, `app/(parent)/parent/report/monthly/page.tsx`

#### 2. MonthlyCharts (학생 전용)

```typescript
// 성적 변화 차트 섹션 전체 제거
// - scoreData 변수 제거
// - AreaChart, Area import 제거
// - UI에서 "성적 변화" 차트 섹션 제거
```

**파일**: `app/(student)/report/monthly/_components/MonthlyCharts.tsx`

## 📊 영향 범위

### 변경된 파일

1. **`lib/reports/monthly.ts`** - 타입 및 함수 제거
2. **`app/(student)/report/monthly/_components/SubjectAnalysisSection.tsx`** - Props 업데이트
3. **`app/(student)/report/monthly/_components/MonthlyCharts.tsx`** - 성적 차트 제거
4. **`app/(student)/report/monthly/page.tsx`** - Props 수정
5. **`app/(parent)/parent/report/monthly/page.tsx`** - Props 수정

### 기능 영향

- ❌ **제거됨**: 월간 리포트에서 "성적 변화" 차트
- ✅ **유지됨**:
  - 강점/약점 과목 분석
  - 학습시간 통계
  - 플랜 실행률
  - 목표 진행률
  - 콘텐츠 진행률
  - 학습 이력

### 사용자 영향

- **최소 영향**: 제거된 성적 차트는 레거시 데이터를 기반으로 하여 실제 표시되지 않았음
- **개선**: 에러 로그 제거로 콘솔이 깨끗해짐
- **향후**: 새 성적 스키마 기반의 차트가 필요한 경우 `/scores/dashboard/unified`를 활용

## 🔄 마이그레이션 경로

현재 프로젝트의 성적 관리 시스템:

```
레거시 (제거됨)
└── student_scores 테이블
    └── getMonthlyScoreTrend 함수 (이번에 제거)

현재 (활성)
├── student_school_scores (내신)
│   └── /api/students/[id]/score-dashboard
└── student_mock_scores (모의고사)
    └── /api/students/[id]/score-dashboard
```

## 🧪 테스트 결과

### TypeScript 검증

```bash
$ ./node_modules/.bin/tsc --noEmit
# monthly 관련 에러 없음 확인
```

### ESLint 검증

```bash
$ npm run lint
# 관련 컴포넌트 에러 없음 확인
```

### 런타임 검증

- 월간 리포트 페이지 로드 성공
- 콘솔 에러 제거 확인
- 데이터 표시 정상 동작

## 📝 관련 문서

- [성적 관리 메뉴 대체 및 통합 완료](./score-dashboard-migration-complete.md) - 성적 스키마 마이그레이션 완료 문서
- [성적 대시보드 프론트엔드 구현](./score-dashboard-frontend-implementation.md) - 새 성적 대시보드 구현 문서

## 🎯 결론

`getMonthlyScoreTrend` 함수와 관련 코드를 안전하게 제거하여:

1. ✅ PostgREST 에러 해결
2. ✅ 레거시 코드 정리
3. ✅ 코드베이스 단순화
4. ✅ 타입 안전성 유지

향후 월간 리포트에 성적 분석이 필요한 경우, 새 스키마(`student_school_scores`, `student_mock_scores`)를 기반으로 구현해야 함.
