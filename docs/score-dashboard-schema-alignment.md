# 성적 대시보드 스키마 정합성 작업 문서

## 작업 개요

현재 Supabase DB 스키마(개정교육과정 / 교과 / 과목 / 과목 구분 정리 이후 상태)를 기준으로 성적 대시보드 관련 테스트/더미 데이터 스크립트와 서비스 코드를 정합성 있게 맞추는 작업을 수행했습니다.

## 주요 변경 사항

### 1. 테이블 구조 변경

#### 제거된 테이블
- `student_terms`: 학기 정보를 별도 테이블로 관리하던 구조에서 제거
- `grade_conversion_rules`: 등급 환산 규칙 테이블이 없음

#### 변경된 테이블 구조
- `student_internal_scores` → `student_school_scores`
  - `student_term_id` 컬럼 제거
  - `grade`, `semester` 컬럼으로 직접 저장
  - `avg_score` → `subject_average`
  - `std_dev` → `standard_deviation`
  - `subject_group`, `subject_type`, `subject_name` 텍스트 컬럼 추가

- `student_mock_scores`
  - `student_term_id` 컬럼 제거
  - `exam_date`, `exam_title` 컬럼 제거
  - `exam_type`, `exam_round` 컬럼 사용
  - `subject_group`, `subject_name` 텍스트 컬럼 추가

### 2. 수정된 파일 목록

#### 스크립트 파일
1. **scripts/seedScoreDashboardDummy.ts**
   - `student_internal_scores` → `student_school_scores`로 변경
   - `createStudentTerm` 함수 제거, `getStudentTermInfo` 함수로 대체
   - 하드코딩된 ID 제거, 이름 기반 조회로 변경
   - `createInternalScore`, `createMockScore` 함수 시그니처 변경
   - 반환 타입에서 `studentTermId` 제거, `grade`, `semester`, `schoolYear` 추가

2. **scripts/testScoreDashboard.ts**
   - `student_terms` 조회 제거
   - `student_school_scores`에서 최근 학기 정보 조회
   - API 호출 파라미터: `termId` → `grade`, `semester`

3. **scripts/cleanupScoreDashboardDummy.ts**
   - `student_internal_scores` → `student_school_scores`로 변경
   - `student_terms` 삭제 로직 제거

#### 서비스 레이어
4. **lib/scores/internalAnalysis.ts**
   - `student_internal_scores` → `student_school_scores`로 변경
   - 컬럼명 변경: `avg_score` → `subject_average`, `std_dev` → `standard_deviation`
   - `studentTermId` 형식: `"grade:semester"` 문자열로 처리
   - `subject_groups` 조인 제거, `subject_group` 텍스트 컬럼 직접 사용

5. **lib/scores/mockAnalysis.ts**
   - `exam_date`, `exam_title` → `exam_type`, `exam_round`로 변경
   - 최근 시험 조회 로직 수정

6. **lib/scores/admissionStrategy.ts**
   - `grade_conversion_rules` 테이블 조회 제거
   - 간단한 선형 환산 공식 사용: `percentile = 100 - (totalGpa - 1) * 12.5`

#### API 라우트
7. **app/api/students/[id]/score-dashboard/route.ts**
   - `student_terms` 테이블 조회 제거
   - `grade`, `semester` 파라미터 직접 사용
   - 학생 조회 후 최근 성적에서 학기 정보 가져오기
   - `curriculum_revision_id`는 활성화된 최신 교육과정 사용

## 주요 변경 로직

### 1. 학기 정보 처리

**이전:**
```typescript
const studentTermId = await createStudentTerm(...);
await createInternalScore(..., studentTermId, ...);
```

**변경 후:**
```typescript
const termInfo = getStudentTermInfo(2025, 2, 1);
await createInternalScore(..., termInfo.grade, termInfo.semester, ...);
```

### 2. 내신 성적 생성

**이전:**
```typescript
await supabase.from("student_internal_scores").insert({
  student_term_id: studentTermId,
  avg_score: avgScore,
  std_dev: stdDev,
  ...
});
```

**변경 후:**
```typescript
await supabase.from("student_school_scores").insert({
  grade: termInfo.grade,
  semester: termInfo.semester,
  subject_average: avgScore,
  standard_deviation: stdDev,
  subject_group: subjectGroupName,
  subject_type: subjectTypeName,
  subject_name: subjectName,
  ...
});
```

### 3. 모의고사 성적 생성

**이전:**
```typescript
await supabase.from("student_mock_scores").insert({
  student_term_id: studentTermId,
  exam_date: examDate,
  exam_title: examTitle,
  ...
});
```

**변경 후:**
```typescript
await supabase.from("student_mock_scores").insert({
  grade: termInfo.grade,
  exam_type: examType,
  exam_round: examRound,
  subject_group: subjectGroupName,
  subject_name: subjectName,
  ...
});
```

### 4. API 파라미터 변경

**이전:**
```
GET /api/students/:id/score-dashboard?tenantId=...&termId=...
```

**변경 후:**
```
GET /api/students/:id/score-dashboard?tenantId=...&grade=...&semester=...
```

## 테스트 방법

### 1. 더미 데이터 생성

```bash
npx tsx scripts/seedScoreDashboardDummy.ts
```

생성되는 데이터:
- 학생 A: 정시 우위 (MOCK_ADVANTAGE)
- 학생 B: 수시 우위 (INTERNAL_ADVANTAGE)
- 학생 C: 균형형 (BALANCED)

### 2. API 테스트

```bash
npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> [grade] [semester]
```

예시:
```bash
npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> 2 1
```

### 3. 더미 데이터 삭제

```bash
npx tsx scripts/cleanupScoreDashboardDummy.ts
```

## 주의 사항

1. **등급 환산 규칙**: `grade_conversion_rules` 테이블이 없으므로 간단한 선형 환산 공식을 사용합니다. 실제 운영 환경에서는 더 정교한 환산 로직이 필요할 수 있습니다.

2. **교육과정 개정**: `curriculum_revision_id`는 활성화된 최신 교육과정을 자동으로 사용합니다. 특정 교육과정을 지정하려면 추가 로직이 필요합니다.

3. **학기 정보**: `grade`와 `semester`가 없으면 최근 성적에서 자동으로 가져옵니다. 명시적으로 지정하는 것을 권장합니다.

## 향후 개선 사항

1. `grade_conversion_rules` 테이블 생성 및 데이터 입력
2. 교육과정 개정 정보를 학생별로 관리하는 로직 추가
3. API 응답에 교육과정 개정 정보 포함

