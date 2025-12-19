# 학생 코어 모듈 리팩토링 작업

**작업일**: 2025-02-04  
**작업 내용**: 매직 넘버 설정화 및 레거시 코드 삭제

## 작업 개요

학생 코어 모듈(Student Core Module)의 리팩토링 작업을 수행했습니다. 이번 작업은 "매직 넘버 설정화"와 "레거시 코드 삭제"를 목표로 진행되었습니다.

## 작업 내용

### 1단계: 스케줄러 설정 파일 생성

**파일**: `lib/config/schedulerConfig.ts`

시간 계산 관련 상수들을 중앙 관리하기 위한 설정 파일을 생성했습니다.

#### 주요 설정값

- **DURATION**: 콘텐츠별 기본 소요 시간 (분 단위)
  - `DEFAULT_BASE`: 60분 (기본 단위 시간)
  - `DEFAULT_EPISODE`: 30분 (강의 1강당 시간)
  - `DEFAULT_PAGE`: 6분 (교재 1페이지당 시간, 60분 / 10페이지)

- **DIFFICULTY_MULTIPLIER**: 교재 난이도별 페이지당 소요 시간
  - 기초: 4분
  - 기본: 6분
  - 심화: 8분
  - 최상: 10분

- **REVIEW**: 1730 Timetable 관련 설정
  - `TIME_RATIO`: 0.5 (복습일은 학습일 소요시간의 50%)

- **LIMITS**: 제약 조건
  - `MAX_CONTENTS`: 9 (플랜에 담을 수 있는 최대 콘텐츠 수)
  - `CUSTOM_CONTENT_PAGE_THRESHOLD`: 100 (커스텀 콘텐츠 페이지/시간 구분 기준)

### 2단계: contentDuration.ts 리팩토링

**파일**: `lib/plan/contentDuration.ts`

기존에 하드코딩되어 있던 상수들을 `SCHEDULER_CONFIG`를 사용하도록 변경했습니다.

#### 변경 사항

1. **Import 변경**
   - 기존: `defaultRangeRecommendationConfig` 사용
   - 변경: `SCHEDULER_CONFIG` import

2. **상수 정의 리팩토링**
   - 기존 상수들은 하위 호환성을 위해 export 유지
   - 내부 로직에서는 모두 `SCHEDULER_CONFIG` 참조로 변경
   - `@deprecated` 주석 추가

3. **매직 넘버 제거**
   - `DEFAULT_BASE_TIME_MINUTES` → `SCHEDULER_CONFIG.DURATION.DEFAULT_BASE`
   - `DEFAULT_EPISODE_DURATION_MINUTES` → `SCHEDULER_CONFIG.DURATION.DEFAULT_EPISODE`
   - `DEFAULT_REVIEW_TIME_RATIO` → `SCHEDULER_CONFIG.REVIEW.TIME_RATIO`
   - `PAGE_DURATION_BY_DIFFICULTY` → `SCHEDULER_CONFIG.DIFFICULTY_MULTIPLIER`
   - `CUSTOM_CONTENT_PAGE_THRESHOLD` → `SCHEDULER_CONFIG.LIMITS.CUSTOM_CONTENT_PAGE_THRESHOLD`

#### 하위 호환성 유지

다음 파일들이 여전히 기존 상수를 import하여 사용 중이므로, export는 유지되었습니다:
- `lib/plan/assignPlanTimes.ts`

향후 이 파일들도 `SCHEDULER_CONFIG`를 직접 사용하도록 마이그레이션하는 것을 권장합니다.

### 3단계: 레거시 코드 삭제

**삭제 대상**: `app/(student)/scores/dashboard/_components/_deprecated/`

기능이 `dashboard/unified`로 이전되어 더 이상 사용하지 않는 레거시 컴포넌트들을 삭제했습니다.

#### 삭제된 파일 목록

1. `CompareSection.tsx`
2. `InsightPanel.tsx`
3. `IntegratedComparisonChart.tsx`
4. `ScoreConsistencyAnalysis.tsx`
5. `SemesterChartsSection.tsx`
6. `SubjectTrendSection.tsx`
7. `SummarySection.tsx`
8. `WeakSubjectSection.tsx`

#### 삭제 전 확인 사항

- 프로젝트의 다른 곳(page.tsx 등 활성 페이지)에서 import 되고 있는지 확인
- 검색 결과: 다른 곳에서 사용되지 않음을 확인하여 안전하게 삭제

## 변경된 파일 목록

### 신규 생성
- `lib/config/schedulerConfig.ts`

### 수정
- `lib/plan/contentDuration.ts`

### 삭제
- `app/(student)/scores/dashboard/_components/_deprecated/CompareSection.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/InsightPanel.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/IntegratedComparisonChart.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/ScoreConsistencyAnalysis.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/SemesterChartsSection.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/SubjectTrendSection.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/SummarySection.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/WeakSubjectSection.tsx`

## 테스트 확인

- ESLint 에러 없음
- TypeScript 컴파일 에러 없음
- 기존 코드의 하위 호환성 유지

## 향후 작업 권장사항

1. **다른 파일들의 마이그레이션**
   - `lib/plan/assignPlanTimes.ts`에서 `SCHEDULER_CONFIG` 직접 사용으로 변경
   - 기존 상수 export 제거 (하위 호환성 유지 기간 경과 후)

2. **설정 값 확장**
   - 필요시 `SCHEDULER_CONFIG`에 추가 설정값 추가
   - 환경별 설정 지원 (예: 개발/프로덕션)

3. **문서화**
   - `SCHEDULER_CONFIG` 사용 가이드 문서 작성
   - 각 설정값의 의미와 사용 사례 설명

