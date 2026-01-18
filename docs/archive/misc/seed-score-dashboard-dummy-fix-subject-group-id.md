# seedScoreDashboardDummy.ts - subject_group_id 필수 필드 추가

## 문제 상황

`scripts/seedScoreDashboardDummy.ts` 실행 시 아래 에러가 발생:

```
모의고사 성적 생성 실패: null value in column "subject_group_id" of relation "student_mock_scores" violates not-null constraint (코드: 23502)
```

## 원인 분석

`student_mock_scores` 테이블의 `subject_group_id` 컬럼에 NOT NULL 제약이 있는데, 스크립트에서 이 값을 insert하지 않아 발생한 오류입니다.

현재 스크립트는:
- `subject_id`는 insert하고 있음
- `subject_group_id`는 insert하지 않음

하지만 스키마에서는 `subject_group_id`가 NOT NULL 필수 필드입니다.

## 해결 방법

### 1. 타입 정의 수정

`CreateMockScoreParams` 타입에 `subjectGroupId` 필드 추가:

```typescript
type CreateMockScoreParams = {
  tenantId: string;
  studentId: string;
  grade: number; // 학년 (NOT NULL)
  examDate: string;
  examTitle: string;
  subjectId: string;
  subjectGroupId: string; // ✅ 추가: 교과 그룹 ID (NOT NULL)
  percentile: number;
  standardScore: number;
  gradeScore: number;
};
```

### 2. insert 로직 수정

`createMockScore` 함수에서 insert 시 `subject_group_id` 포함:

```typescript
async function createMockScore(params: CreateMockScoreParams) {
  const { data, error } = await supabase
    .from("student_mock_scores")
    .insert({
      tenant_id: params.tenantId,
      student_id: params.studentId,
      grade: params.grade,
      exam_date: params.examDate,
      exam_title: params.examTitle,
      subject_id: params.subjectId,
      subject_group_id: params.subjectGroupId, // ✅ 추가
      percentile: params.percentile,
      standard_score: params.standardScore,
      grade_score: params.gradeScore,
    })
    .select("id")
    .single();
  // ...
}
```

### 3. 호출부 수정

`createStudentA`, `createStudentB`, `createStudentC` 함수에서 `createMockScore` 호출 시 `subjectGroupId` 전달:

```typescript
for (const score of mockScores) {
  const subjectId = metadata.subjectMap[score.subjectGroup];
  const subjectGroupId = metadata.subjectGroupMap[score.subjectGroup]; // ✅ 추가

  if (!subjectId) {
    throw new Error(`과목을 찾을 수 없습니다: ${score.subjectGroup}`);
  }

  if (!subjectGroupId) {
    throw new Error(`교과 그룹을 찾을 수 없습니다: ${score.subjectGroup}`);
  }

  await createMockScore({
    tenantId: metadata.tenantId,
    studentId,
    grade: 2,
    examDate,
    examTitle,
    subjectId,
    subjectGroupId, // ✅ 추가
    percentile: score.percentile,
    standardScore: score.standardScore,
    gradeScore: score.gradeScore,
  });
}
```

## 수정 완료 내역

- ✅ `CreateMockScoreParams` 타입에 `subjectGroupId: string` 필드 추가
- ✅ `createMockScore` 함수에서 insert 시 `subject_group_id` 포함
- ✅ `createStudentA` 호출부에서 `subjectGroupId` 전달
- ✅ `createStudentB` 호출부에서 `subjectGroupId` 전달
- ✅ `createStudentC` 호출부에서 `subjectGroupId` 전달

## 확인 방법

수정 후 다음 명령어로 확인:

```bash
# 더미 데이터 생성
npx tsx scripts/seedScoreDashboardDummy.ts

# API 테스트
npm run test:score-dashboard
```

## 참고사항

- 이미 스크립트에서 `metadata.subjectGroupMap`을 통해 교과 그룹 ID를 조회하고 있었으므로, 이를 활용하여 `subjectGroupId`를 전달할 수 있었습니다.
- `subjectGroupMap`은 `fetchMetadata()` 함수에서 이미 생성되고 있어 추가 조회가 필요하지 않았습니다.

## 날짜

2025-01-21

