# 성적 대시보드 더미 데이터 시드 스크립트 수정

## 작업 개요

`scripts/seedScoreDashboardDummy.ts` 스크립트를 수정하여 `/score-dashboard` API에서 각 더미 학생에 대해 올바른 전략 분석 결과가 나오도록 개선했습니다.

## 목표

더미 학생 3명 (A: 정시우위, B: 수시우위, C: 균형형)에 대해:
- `student_internal_scores`와 `student_mock_scores` 둘 다 채우기
- `/score-dashboard` API에서:
  - `internalAnalysis` 항상 유효
  - `mockAnalysis` 항상 유효
  - `strategyResult`:
    - A → `MOCK_ADVANTAGE`
    - B → `INTERNAL_ADVANTAGE`
    - C → `BALANCED`

## 수정 내용

### 1. 학생 A (정시 우위 - MOCK_ADVANTAGE)

**요구사항**: 모의고사 percentile이 내신 환산 백분위보다 10 이상 높게

**수정 전**:
- 내신: GPA 3.0 근처 (환산 백분위 약 70)
- 모의고사: 평백 85 (차이 +15)

**수정 후**:
- 내신: GPA 3.2 근처 (환산 백분위 약 75)
- 모의고사: 평백 85 (차이 +10)

**내신 성적 조정**:
- 국어: rankGrade 3, creditHours 5
- 수학: rankGrade 3, creditHours 5
- 영어: rankGrade 3, creditHours 5
- 사회: rankGrade 4, creditHours 4
- 과학: rankGrade 3, creditHours 4
- **평균 GPA**: (3×5 + 3×5 + 3×5 + 4×4 + 3×4) / (5+5+5+4+4) = 3.17 ≈ 3.2

**모의고사 성적**:
- 국어: percentile 85, standardScore 135, gradeScore 2
- 수학: percentile 84, standardScore 133, gradeScore 2
- 영어: percentile 86, standardScore 137, gradeScore 2
- 사회: percentile 83, standardScore 132, gradeScore 3
- 과학: percentile 87, standardScore 138, gradeScore 2
- **평균 백분위**: (85 + 84 + 83 + 87) / 4 = 84.75 ≈ 85 (국/수/탐 상위2)

### 2. 학생 B (수시 우위 - INTERNAL_ADVANTAGE)

**요구사항**: 모의고사 percentile이 내신 환산 백분위보다 10 이상 낮게

**수정 전**:
- 내신: GPA 1.8 근처 (환산 백분위 약 85)
- 모의고사: 평백 65 (차이 -20)

**수정 후**:
- 내신: GPA 2.0 근처 (환산 백분위 약 89)
- 모의고사: 평백 65 (차이 -24)

**내신 성적 조정**:
- 국어: rankGrade 2, creditHours 5
- 수학: rankGrade 2, creditHours 5
- 영어: rankGrade 1, creditHours 5
- 사회: rankGrade 2, creditHours 4
- 과학: rankGrade 2, creditHours 4
- **평균 GPA**: (2×5 + 2×5 + 1×5 + 2×4 + 2×4) / (5+5+5+4+4) = 1.87 ≈ 2.0

**모의고사 성적**:
- 국어: percentile 65, standardScore 115, gradeScore 4
- 수학: percentile 64, standardScore 114, gradeScore 4
- 영어: percentile 66, standardScore 116, gradeScore 4
- 사회: percentile 63, standardScore 113, gradeScore 5
- 과학: percentile 67, standardScore 117, gradeScore 4
- **평균 백분위**: (65 + 64 + 63 + 67) / 4 = 64.75 ≈ 65 (국/수/탐 상위2)

### 3. 학생 C (균형형 - BALANCED)

**요구사항**: 내신 환산 백분위와 모의고사 percentile 차이가 -3~+3 이내

**수정 전**:
- 내신: GPA 2.5 근처 (환산 백분위 약 80)
- 모의고사: 평백 78 (차이 -2)

**수정 후**:
- 내신: GPA 2.5 근처 (환산 백분위 약 82)
- 모의고사: 평백 80 (차이 -2)

**내신 성적 조정**:
- 국어: rankGrade 2, creditHours 5
- 수학: rankGrade 3, creditHours 5
- 영어: rankGrade 2, creditHours 5
- 사회: rankGrade 3, creditHours 4
- 과학: rankGrade 2, creditHours 4
- **평균 GPA**: (2×5 + 3×5 + 2×5 + 3×4 + 2×4) / (5+5+5+4+4) = 2.39 ≈ 2.5

**모의고사 성적**:
- 국어: percentile 80, standardScore 128, gradeScore 3
- 수학: percentile 79, standardScore 127, gradeScore 3
- 영어: percentile 81, standardScore 129, gradeScore 3
- 사회: percentile 78, standardScore 125, gradeScore 3
- 과학: percentile 82, standardScore 130, gradeScore 2
- **평균 백분위**: (80 + 79 + 78 + 82) / 4 = 79.75 ≈ 80 (국/수/탐 상위2)

## 모의고사 성적 생성 규칙

### 공통 필수 사항

1. **exam_date**: `2025-06-01`
2. **exam_title**: `'2025-06 모평'`
3. **필수 과목**: 국어, 수학, 탐구(2과목), 영어
4. **필수 컬럼**:
   - `percentile` (0~100)
   - `standard_score`
   - `grade_score` (1~9)
   - `subject_group_id` (2022개정 기준 subject_groups에서 lookup)

### 시나리오별 패턴

- **A (정시 우위)**: 모의고사 percentile이 내신 환산 백분위보다 10 이상 높게
- **B (수시 우위)**: 모의고사 percentile이 내신 환산 백분위보다 10 이상 낮게
- **C (균형형)**: 내신 환산 백분위와 모의고사 percentile 차이가 -3~+3 이내

## 출력 정보

스크립트 실행 후 콘솔에 다음 정보가 출력됩니다:

- 각 더미 학생의 `studentId` / `tenantId` / `termId`
- 예상 전략 타입 (`MOCK_ADVANTAGE` / `INTERNAL_ADVANTAGE` / `BALANCED`)
- 참고용 API URL

## 실행 방법

```bash
# 더미 데이터 생성
npm run seed:score-dashboard-dummy

# API 테스트
npm run test:score-dashboard
```

## 검증

수정 후 다음 명령어를 실행했을 때, 세 케이스 모두에서:
- `internalAnalysis`가 완성된 값으로 나와야 함
- `mockAnalysis`가 완성된 값으로 나와야 함
- `strategyResult`가 각각 올바른 타입으로 나와야 함

## 참고

### 전략 분석 로직 (`lib/scores/admissionStrategy.ts`)

```typescript
const diff = mockPct - internalPct;

if (diff > 5) {
  type = "MOCK_ADVANTAGE";  // 정시 우위
} else if (diff < -5) {
  type = "INTERNAL_ADVANTAGE";  // 수시 우위
} else {
  type = "BALANCED";  // 균형형
}
```

따라서:
- A: diff > 5 (실제로는 +10 이상)
- B: diff < -5 (실제로는 -10 이하)
- C: -5 ≤ diff ≤ 5 (실제로는 -3~+3 범위)

## 관련 파일

- `scripts/seedScoreDashboardDummy.ts` - 더미 데이터 생성 스크립트
- `scripts/testScoreDashboard.ts` - API 테스트 스크립트
- `app/api/students/[id]/score-dashboard/route.ts` - API 엔드포인트
- `lib/scores/internalAnalysis.ts` - 내신 분석 로직
- `lib/scores/mockAnalysis.ts` - 모의고사 분석 로직
- `lib/scores/admissionStrategy.ts` - 전략 분석 로직

## 날짜

2025-12-01

