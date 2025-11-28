# 모의고사 분석 조인 쿼리 수정

## 작업 일시
2025-12-01

## 문제 상황

성적 대시보드 API(`/api/students/[id]/score-dashboard`)에서 모의고사 분석 값이 전부 N/A로 나오는 문제가 발생했습니다.

### 원인 분석

1. `student_mock_scores` 테이블에는 데이터가 정상적으로 들어가 있음
2. Supabase에서 직접 조인 쿼리로는 잘 조회됨
3. 하지만 `getMockAnalysis` 함수에서 `subject_groups`를 직접 조인하는 방식이 작동하지 않음
4. `student_mock_scores.subject_group_id`가 NULL인 경우가 있어서 JOIN에서 모든 row가 날아가는 문제

### 실제 데이터 구조

```json
{
  "student_id": "d5c869dc-5dbd-4438-8856-34773992ad16",
  "exam_date": "2025-06-01",
  "exam_title": "2025-06 모평",
  "subject_id": "a9fd4a57-7fe5-4fb0-ad6a-63d119b3f631",  // ✅ 채워져 있음
  "subject_group_id": "56376590-d522-4805-acf4-b9e8219742f7",  // ✅ 채워져 있음
  "percentile": 85,
  "standard_score": 135,
  "grade_score": 2
}
```

## 수정 내용

### 1. 조인 쿼리 수정

**파일**: `lib/scores/mockAnalysis.ts`

**기존 코드**:
```typescript
const { data: subjectData, error: subjectError } = await supabase
  .from("student_mock_scores")
  .select(`
    percentile,
    standard_score,
    grade_score,
    subject_groups!inner(name)
  `)
  .eq("tenant_id", tenantId)
  .eq("student_id", studentId)
  .eq("exam_date", examDate)
  .eq("exam_title", examTitle);
```

**수정된 코드**:
```typescript
// 1단계: student_mock_scores에서 데이터 조회
const { data: mockScores, error: mockScoresError } = await supabase
  .from("student_mock_scores")
  .select("percentile, standard_score, grade_score, subject_id")
  .eq("tenant_id", tenantId)
  .eq("student_id", studentId)
  .eq("exam_date", examDate)
  .eq("exam_title", examTitle)
  .not("subject_id", "is", null);

// 2단계: subjects 조회
const { data: subjectsData, error: subjectsError } = await supabase
  .from("subjects")
  .select("id, subject_group_id")
  .in("id", subjectIds);

// 3단계: subject_groups 조회
const { data: subjectGroupsData, error: sgError } = await supabase
  .from("subject_groups")
  .select("id, name")
  .in("id", subjectGroupIds);

// 4단계: 매핑 생성
const subjectGroupMap = new Map(
  (subjectGroupsData || []).map((sg) => [sg.id, sg.name])
);
const subjectToGroupMap = new Map(
  subjectsData.map((s) => [s.id, s.subject_group_id])
);

const subjectMap = new Map<string, string>();
for (const [subjectId, subjectGroupId] of subjectToGroupMap.entries()) {
  const subjectGroupName = subjectGroupId
    ? subjectGroupMap.get(subjectGroupId)
    : null;
  if (subjectGroupName) {
    subjectMap.set(subjectId, subjectGroupName);
  }
}
```

### 2. 과목 그룹명 필터링 기준 수정

**파일**: `lib/scores/mockAnalysis.ts`

**기존 코드**:
```typescript
const inquiryRows = rows
  .filter(
    (r) =>
      ["사회(역사/도덕 포함)", "과학"].includes(r.subject_group_name) &&
      r.percentile != null
  )
```

**수정된 코드**:
```typescript
const inquiryRows = rows
  .filter(
    (r) =>
      ["사회", "과학"].includes(r.subject_group_name) &&
      r.percentile != null
  )
```

**기존 코드**:
```typescript
const gradeCandidates = rows.filter(
  (r) =>
    ["국어", "수학", "영어", "사회(역사/도덕 포함)", "과학"].includes(
      r.subject_group_name
    ) && r.grade_score != null
);
```

**수정된 코드**:
```typescript
const gradeCandidates = rows.filter(
  (r) =>
    ["국어", "수학", "영어", "사회", "과학"].includes(
      r.subject_group_name
    ) && r.grade_score != null
);
```

## 계산 로직

### 평균 백분위 계산
- 국어: `subject_group_name === '국어'`
- 수학: `subject_group_name === '수학'`
- 탐구: `subject_group_name IN ('사회', '과학')` → 상위 2개 백분위 평균
- 최종: `(국어 + 수학 + 탐구평균) / 3`

### 표준점수 합 계산
- 국어 + 수학 + 탐구(상위 2개) 표준점수 합

### 상위 3개 등급 합 계산
- 국·수·영·탐 중 등급이 낮은(좋은) 순으로 상위 3개 선택
- 등급 합계 반환

## 테스트 방법

```bash
npx tsx scripts/testScoreDashboard.ts \
  d5c869dc-5dbd-4438-8856-34773992ad16 \
  84b71a5d-5681-4da3-88d2-91e75ef89015 \
  85c7f19f-0994-42b0-af05-adf46ea4a611
```

### 예상 결과

디버깅 스크립트 결과를 기반으로:
- 국어: percentile 85, standard_score 135, grade_score 2
- 수학: percentile 84, standard_score 133, grade_score 2
- 영어: percentile 86, standard_score 137, grade_score 2
- 사회: percentile 83, standard_score 132, grade_score 3
- 과학: percentile 87, standard_score 138, grade_score 2

**예상 계산 결과**:
- 평균 백분위: (85 + 84 + (87 + 83) / 2) / 3 = (85 + 84 + 85) / 3 = **84.67**
- 표준점수 합: 135 + 133 + 138 + 132 = **538**
- 상위 3개 등급 합: 2 + 2 + 2 = **6** (국어, 수학, 과학)

## 디버깅 로그

다음 로그가 출력됩니다:
- `[scores/mockAnalysis] 조회된 모의고사 성적`
- `[scores/mockAnalysis] 추출된 subject_ids`
- `[scores/mockAnalysis] 조회된 subjects 데이터`
- `[scores/mockAnalysis] 생성된 subjectMap`
- `[scores/mockAnalysis] 변환된 rows`
- `[scores/mockAnalysis] 계산된 통계`

## 참고사항

- Supabase의 중첩 조인(`subject_groups!inner(name)`)이 제대로 작동하지 않아 두 단계로 나누어 조회
- `subject_id`가 NULL인 경우는 필터링하여 제외
- `subject_group_name`이 없는 경우도 필터링하여 제외

