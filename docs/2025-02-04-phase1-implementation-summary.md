# Phase 1: 데이터 정확성 확보 및 레거시 청산 - 구현 완료

## 작업 완료 일자
2025-02-04

## 완료된 작업

### 1-1. Timezone 및 날짜 처리 표준화 ✅

#### 구현 내용
- `@date-fns/tz` 패키지 설치 완료
- `lib/utils/dateUtils.ts` 신규 생성
  - `getStartOfDayUTC`: 특정 타임존의 하루 시작을 UTC로 변환
  - `getEndOfDayUTC`: 특정 타임존의 하루 끝을 UTC로 변환
  - `formatDateInTimezone`: UTC Date를 특정 타임존 기준으로 변환하여 YYYY-MM-DD 형식 반환
  - `getTodayInTimezone`: 현재 시간을 특정 타임존 기준으로 오늘 날짜 반환
  - `isSameDayInTimezone`: 두 날짜가 특정 타임존에서 같은 날인지 확인
  - `parseDateInTimezone`: 타임존 기준으로 날짜 문자열을 Date 객체로 변환

#### 수정된 파일
- `lib/metrics/todayProgress.ts`: 타임존 처리 적용
- `lib/metrics/getStudyTime.ts`: 타임존 처리 적용
- `lib/metrics/streak.ts`: 타임존 처리 적용

#### 기대 효과
- 0시~9시 사이 데이터 누락 문제 해결
- 날짜 비교 시 타임존 미고려로 인한 오류 방지
- 로컬 타임존과 UTC 간 변환 일관성 확보

---

### 1-2. 성적 분석 N+1 쿼리 제거 ✅

#### 구현 내용
- Supabase Relational Query를 사용하여 조인 쿼리로 변경
- 데이터 가공 로직을 메모리 연산에서 DB 쿼리 단계로 이관

#### 수정된 파일
- `lib/scores/mockAnalysis.ts`:
  - Before: scores 조회 → subjects 조회 → subject_groups 조회 (3단계 쿼리)
  - After: Relational Query로 한 번에 조인하여 조회
  - Admin 클라이언트 사용 제거 (RLS 정책 활용)

- `lib/scores/internalAnalysis.ts`:
  - Before: scores 조회 → subject_groups 조회 (2단계 쿼리)
  - After: Relational Query로 한 번에 조인하여 조회
  - Admin 클라이언트 사용 제거 (RLS 정책 활용)

#### 기대 효과
- 분석 페이지 로딩 속도 개선
- 데이터베이스 쿼리 횟수 감소
- 서버 부하 감소

---

### 1-3. 레거시 코드 및 컴포넌트 제거 ✅

#### 구현 내용

##### 레거시 페이지 리다이렉트
- `app/(student)/scores/dashboard/school/page.tsx`: `/scores/dashboard/unified`로 리다이렉트 처리
- `app/(student)/scores/dashboard/page.tsx`: 이미 리다이렉트 처리됨 (확인 완료)

##### 레거시 컴포넌트 제거
다음 컴포넌트들을 `_deprecated` 폴더로 이동:
- `CompareSection.tsx`
- `InsightPanel.tsx`
- `SummarySection.tsx`
- `ScoreConsistencyAnalysis.tsx`
- `IntegratedComparisonChart.tsx`
- `SemesterChartsSection.tsx`
- `SubjectTrendSection.tsx`
- `WeakSubjectSection.tsx`

**참고**: `MockExamTrendSection.tsx`는 `mock/page.tsx`에서 아직 사용 중이므로 유지

##### student_scores 테이블 참조 코드 마이그레이션
- `lib/data/studentScores.ts`:
  - `getStudentScores` 함수를 deprecated로 표시하고 빈 배열 반환하도록 수정
  - `getSchoolScores` 함수는 이미 `student_internal_scores`로 마이그레이션됨 (확인 완료)

- `lib/reports/monthly.ts`:
  - `getMonthlyWeakSubjectTrend` 함수에서 `student_scores` 참조 제거
  - TODO 주석 추가: `student_internal_scores`와 `student_mock_scores`를 조합하여 사용하도록 수정 필요

- `app/actions/scores.ts`:
  - 파일 상단에 deprecated 경고 주석 유지
  - `addStudentScore`, `updateStudentScore`, `deleteStudentScore`는 아직 사용 중 (향후 마이그레이션 필요)

#### 기대 효과
- 코드베이스 정리 및 유지보수성 향상
- 개발 혼란 감소
- 새로운 통합 대시보드로의 전환 완료

---

## 검증 필요 사항

### 1. Timezone 테스트
- [ ] 0시~9시 사이 데이터가 올바르게 조회되는지 확인
- [ ] 날짜 범위 쿼리가 올바르게 동작하는지 확인
- [ ] 연속 학습일 계산이 올바르게 동작하는지 확인

### 2. N+1 쿼리 제거 확인
- [ ] 성적 분석 페이지 로딩 속도 개선 확인
- [ ] 데이터베이스 쿼리 횟수 감소 확인
- [ ] Relational Query가 올바르게 동작하는지 확인

### 3. 레거시 코드 제거 확인
- [ ] `student_scores` 참조가 남아있지 않은지 확인 (grep)
- [ ] 성적 대시보드가 정상적으로 동작하는지 확인
- [ ] 리다이렉트가 올바르게 동작하는지 확인

---

## 향후 작업

### 우선순위 높음
1. `lib/reports/monthly.ts`의 `getMonthlyWeakSubjectTrend` 함수 수정
   - `student_internal_scores`와 `student_mock_scores`를 조합하여 과목별 등급 계산
   - `subject_group_id`를 통해 과목 정보 조회

2. `app/actions/scores.ts` 마이그레이션
   - `addStudentScore`, `updateStudentScore`, `deleteStudentScore`를 새로운 구조로 마이그레이션
   - `student_internal_scores`와 `student_mock_scores`를 별도로 처리

### 우선순위 중간
3. `lib/domains/score/types.ts`의 레거시 타입 정의 정리
   - `SchoolScore`, `SchoolScoreInsert`, `SchoolScoreUpdate` 타입 제거 검토
   - 하위 호환성이 필요한 경우에만 유지

4. `mock/page.tsx` 리다이렉트 검토
   - `MockExamTrendSection` 등 레거시 컴포넌트 사용 중
   - 통합 대시보드로 전환 여부 결정

---

## 변경된 파일 목록

### 신규 생성
- `lib/utils/dateUtils.ts`

### 수정
- `lib/metrics/todayProgress.ts`
- `lib/metrics/getStudyTime.ts`
- `lib/metrics/streak.ts`
- `lib/scores/mockAnalysis.ts`
- `lib/scores/internalAnalysis.ts`
- `app/(student)/scores/dashboard/school/page.tsx`
- `lib/data/studentScores.ts`
- `lib/reports/monthly.ts`

### 이동 (deprecated)
- `app/(student)/scores/dashboard/_components/_deprecated/CompareSection.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/InsightPanel.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/SummarySection.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/ScoreConsistencyAnalysis.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/IntegratedComparisonChart.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/SemesterChartsSection.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/SubjectTrendSection.tsx`
- `app/(student)/scores/dashboard/_components/_deprecated/WeakSubjectSection.tsx`

### 의존성 추가
- `@date-fns/tz` (package.json)

---

## 참고 문서
- 원본 계획: `docs/2025-02-04-repomix-phase-analysis-guide.md`
- 통합 대시보드 구현: `docs/score-dashboard-frontend-implementation.md`

