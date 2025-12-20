# Phase 7.2: 무거운 라이브러리 최적화 및 CLS 방지

## 작업 개요

애플리케이션의 성능 최적화를 위해 Recharts 라이브러리 지연 로딩 적용 상태를 확인하고, 주요 데이터 영역의 CLS(Cumulative Layout Shift) 방지를 위한 작업을 수행했습니다.

## 작업 내용

### 1. Recharts 라이브러리 지연 로딩 확인

**확인 결과**:
- 프로젝트 내의 모든 차트 컴포넌트들이 이미 `components/charts/LazyRecharts.tsx`의 `useRecharts` 훅을 사용하고 있음을 확인했습니다.
- 직접 `recharts`를 import하는 파일은 발견되지 않았습니다.

**확인된 파일들**:
- ✅ `app/(student)/scores/analysis/_components/MockTrendChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/scores/dashboard/_components/SubjectGradeHistoryChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/scores/dashboard/_components/CourseAverageChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/report/weekly/_components/WeeklyTimeBarChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/report/weekly/_components/SubjectTimePieChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(admin)/admin/attendance/statistics/_components/DailyAttendanceChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/scores/dashboard/school/_components/SchoolGradeDistributionChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/scores/dashboard/mock/_components/MockPercentileDistributionChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/scores/dashboard/mock/_components/MockExamTypeComparisonChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/scores/dashboard/school/_components/SchoolHeatmapChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/report/monthly/_components/MonthlyCharts.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/analysis/_components/RiskIndexList.tsx` - LazyRecharts 사용 중
- ✅ `app/(admin)/admin/attendance/statistics/_components/TimeDistributionChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(admin)/admin/attendance/statistics/_components/MethodStatisticsChart.tsx` - LazyRecharts 사용 중
- ✅ `app/(student)/scores/analysis/_components/InternalGPAChart.tsx` - LazyRecharts 사용 중

**결론**: 모든 차트 컴포넌트가 이미 지연 로딩을 적용하고 있어 추가 작업이 필요하지 않았습니다.

### 2. 주요 데이터 영역 CLS 방지

데이터 로딩 중 레이아웃이 밀리는 현상을 방지하기 위해 주요 리스트 및 테이블 컴포넌트에 `min-height`를 추가했습니다.

#### 수정된 파일들

**관리자 대시보드** (`app/(admin)/admin/dashboard/page.tsx`):
- ✅ 이번주 학습시간 Top5 리스트: `min-h-[200px]` 추가
- ✅ 이번주 플랜 실행률 Top5 리스트: `min-h-[200px]` 추가
- ✅ 최근 목표 달성 Top3 리스트: `min-h-[150px]` 추가
- ✅ 위험 학생 리스트: `min-h-[200px]` 추가
- ✅ 최근 상담노트 리스트: `min-h-[200px]` 추가

**학생 대시보드**:
- ✅ `app/(student)/scores/dashboard/_components/WeakSubjectsList.tsx`: 테이블에 `min-h-[300px]` 추가

**공통 컴포넌트**:
- ✅ `components/organisms/DataTable.tsx`: 테이블 컨테이너에 `min-h-[300px]` 추가
- ✅ `components/ui/LoadingSkeleton.tsx`: `SuspenseFallback`에 `min-h-[200px]` 추가

**콘텐츠 리스트**:
- ✅ `app/(student)/contents/_components/ContentsList.tsx`: `ContentsListSkeleton`에 `min-h-[400px]` 추가

## 변경 사항 요약

### 파일 변경 목록

1. **app/(admin)/admin/dashboard/page.tsx**
   - 관리자 대시보드의 모든 리스트 섹션에 `min-height` 추가

2. **app/(student)/scores/dashboard/_components/WeakSubjectsList.tsx**
   - 취약 과목 테이블에 `min-h-[300px]` 추가

3. **components/organisms/DataTable.tsx**
   - DataTable 컴포넌트에 `min-h-[300px]` 추가

4. **components/ui/LoadingSkeleton.tsx**
   - SuspenseFallback에 `min-h-[200px]` 추가

5. **app/(student)/contents/_components/ContentsList.tsx**
   - ContentsListSkeleton에 `min-h-[400px]` 추가

## 성능 개선 효과

### CLS (Cumulative Layout Shift) 개선
- 데이터 로딩 중 레이아웃이 밀리는 현상 방지
- 사용자 경험 개선 (레이아웃 안정성 향상)
- Core Web Vitals 점수 개선 기대

### 번들 크기 최적화
- Recharts 라이브러리는 이미 지연 로딩이 적용되어 있어 초기 번들 크기에 포함되지 않음
- 차트가 필요한 페이지에서만 동적으로 로드됨

## 검증 사항

- ✅ 모든 차트 컴포넌트가 LazyRecharts를 사용 중
- ✅ 주요 리스트/테이블 컴포넌트에 min-height 적용
- ✅ 스켈레톤 UI가 적절히 적용되어 있음
- ✅ ESLint 에러 없음

## 향후 개선 사항

1. **성능 모니터링**: 실제 사용자 환경에서 CLS 점수 측정 및 개선 효과 확인
2. **추가 최적화**: 다른 무거운 라이브러리(예: date-fns, lodash 등)도 지연 로딩 적용 검토
3. **스켈레톤 개선**: 더 정확한 높이 예측을 위한 동적 스켈레톤 높이 계산

## 참고 사항

- Recharts 라이브러리는 약 327KB 크기로, 지연 로딩이 필수적입니다.
- CLS는 사용자 경험에 직접적인 영향을 미치는 Core Web Vitals 지표입니다.
- min-height 값은 실제 데이터의 예상 높이를 고려하여 설정했습니다.

