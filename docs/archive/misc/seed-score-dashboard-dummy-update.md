# 성적 대시보드 더미 데이터 시드 스크립트 업데이트

## 작업 개요

`scripts/seedScoreDashboardDummy.ts` 스크립트를 실제 DB 스키마에 맞게 수정했습니다.

## 주요 변경 사항

### 1. 타입 정의 정리

#### `CreateInternalScoreParams` 타입 추가
- 내신 성적 생성 파라미터를 명확하게 타입 정의
- 실제 스키마의 NOT NULL 필드 기준으로 정리

#### `CreateMockScoreParams` 타입 수정
- 더 이상 사용하지 않는 필드 제거: `exam_round`, `exam_type`, `subject_group` (텍스트)
- 실제 스키마 기준 필수 필드만 포함:
  - `tenant_id` (NOT NULL)
  - `student_id` (NOT NULL)
  - `grade` (NOT NULL, 1~3)
  - `exam_date` (NOT NULL)
  - `exam_title` (NOT NULL)
  - `subject_id` (NOT NULL)
  - `subject_group_id` (NOT NULL, UUID)
  - `percentile`, `standard_score`, `grade_score` (nullable)

### 2. 함수 시그니처 개선

#### `createInternalScore` 함수
- 파라미터를 단일 객체로 받도록 변경
- 타입 안전성 향상
- 실제 스키마 기준 주석 추가

#### `createMockScore` 함수
- 기존 타입 유지하되, nullable 필드 명시
- 실제 스키마 기준 주석 추가

### 3. 사용하지 않는 필드 제거

- `student_mock_scores`에서 제거된 필드:
  - `exam_round` (nullable text)
  - `exam_type` (NOT NULL text)
  - `subject_group` (NOT NULL text)
  
- 대신 사용하는 필드:
  - `exam_date` (NOT NULL date)
  - `exam_title` (NOT NULL text)
  - `subject_group_id` (NOT NULL uuid)

### 4. 결과 출력 개선

- 생성된 학생 정보 출력 형식 개선
- API 테스트 방법 안내 추가
- 더미 데이터 삭제 방법 안내 추가

## 사용 방법

### 1. 더미 데이터 생성

```bash
npx tsx scripts/seedScoreDashboardDummy.ts
```

### 2. API 테스트

```bash
npx tsx scripts/testScoreDashboard.ts
```

또는 브라우저에서 직접 확인:
```
http://localhost:3000/api/students/{studentId}/score-dashboard?tenantId={tenantId}&grade={grade}&semester={semester}
```

### 3. 더미 데이터 삭제

```bash
npm run cleanup:score-dashboard-dummy
```

## 생성되는 데이터

### 학생 A: 정시 우위 (MOCK_ADVANTAGE)
- 내신: GPA 3.2 근처 (환산 백분위 약 75)
- 모의고사: 평백 85 (내신 환산 백분위보다 +10 높음)

### 학생 B: 수시 우위 (INTERNAL_ADVANTAGE)
- 내신: GPA 2.0 근처 (환산 백분위 약 89)
- 모의고사: 평백 65 (내신 환산 백분위보다 -24 낮음)

### 학생 C: 균형형 (BALANCED)
- 내신: GPA 2.5 근처 (환산 백분위 약 82)
- 모의고사: 평백 80 (내신 환산 백분위와 차이 -2)

## 주의 사항

1. **테이블 존재 확인**: `student_internal_scores` 테이블이 존재해야 합니다. 만약 테이블이 없다면 마이그레이션이 필요할 수 있습니다.

2. **스키마 일치**: `student_mock_scores` 테이블에 `exam_date`, `exam_title` 컬럼이 있어야 합니다. 만약 없다면 마이그레이션이 필요할 수 있습니다.

3. **NOT NULL 필드**: 모든 NOT NULL 필드를 반드시 채워야 합니다:
   - `student_internal_scores`: tenant_id, student_id, student_term_id, curriculum_revision_id, subject_group_id, subject_type_id, subject_id, grade, semester
   - `student_mock_scores`: tenant_id, student_id, grade, exam_date, exam_title, subject_id, subject_group_id

## 관련 파일

- `scripts/seedScoreDashboardDummy.ts`: 더미 데이터 생성 스크립트
- `scripts/testScoreDashboard.ts`: API 테스트 스크립트
- `app/api/students/[id]/score-dashboard/route.ts`: 성적 대시보드 API
- `lib/scores/internalAnalysis.ts`: 내신 분석 로직
- `lib/scores/mockAnalysis.ts`: 모의고사 분석 로직

