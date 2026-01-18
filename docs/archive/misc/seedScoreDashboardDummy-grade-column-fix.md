# seedScoreDashboardDummy.ts grade 컬럼 누락 수정

## 작업 일시
2025-01-XX

## 문제 상황

`scripts/seedScoreDashboardDummy.ts` 실행 시 다음 에러가 발생했습니다:

```
모의고사 성적 생성 실패: null value in column "grade" of relation "student_mock_scores" violates not-null constraint (코드: 23502)
```

### 원인 분석

1. **스키마 요구사항**: `student_mock_scores` 테이블의 `grade` 컬럼은 NOT NULL 제약이 있습니다.
   - `grade`: 학년 (1, 2, 3 등)

2. **현재 코드 문제**:
   - `CreateMockScoreParams` 타입에 `grade` 필드가 없음
   - `createMockScore` 함수의 insert에서 `grade` 컬럼 누락
   - 모든 `createMockScore` 호출부에서 `grade` 값을 전달하지 않음

3. **더미 데이터 특성**: 
   - 모든 더미 학생은 2학년 1학기로 생성됨
   - 따라서 `grade: 2`를 하드코딩하여 전달하면 됨

## 수정 내용

### 1. 타입 정의 수정

`CreateMockScoreParams` 타입에 `grade` 필드 추가:

```typescript
type CreateMockScoreParams = {
  tenantId: string;
  studentId: string;
  grade: number; // 학년 (NOT NULL) ✅ 추가
  examDate: string;
  examTitle: string;
  subjectId: string;
  percentile: number;
  standardScore: number;
  gradeScore: number;
};
```

### 2. createMockScore 함수 수정

insert 로직에 `grade` 컬럼 추가:

```typescript
async function createMockScore(params: CreateMockScoreParams) {
  const { data, error } = await supabase
    .from("student_mock_scores")
    .insert({
      tenant_id: params.tenantId,
      student_id: params.studentId,
      grade: params.grade, // ✅ 학년 추가
      exam_date: params.examDate,
      exam_title: params.examTitle,
      subject_id: params.subjectId,
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

모든 `createMockScore` 호출부에 `grade: 2` 추가:

- `createStudentA` 함수 (학생 A 생성)
- `createStudentB` 함수 (학생 B 생성)
- `createStudentC` 함수 (학생 C 생성)

```typescript
await createMockScore({
  tenantId: metadata.tenantId,
  studentId,
  grade: 2, // ✅ 2학년
  examDate,
  examTitle,
  subjectId,
  percentile: score.percentile,
  standardScore: score.standardScore,
  gradeScore: score.gradeScore,
});
```

## 수정된 파일

- `scripts/seedScoreDashboardDummy.ts`

## 확인 사항

### 스키마 정리

이번 수정에서 맞춘 컬럼:
- ✅ `student_mock_scores.grade` - seed 시 필수로 채워지도록 수정

이전에 제거된 컬럼 (실제 스키마에 없음):
- ❌ `exam_round` - 제거됨
- ❌ `exam_type` - 제거됨
- ❌ `subject_group` - 제거됨

## 테스트 방법

### 1. 더미 데이터 생성

```bash
npx tsx scripts/seedScoreDashboardDummy.ts
```

예상 결과:
- ✅ NOT NULL 에러 없이 더미 데이터 생성 완료
- ✅ 학생 A, B, C 모두 정상 생성

### 2. API 테스트

```bash
npm run test:score-dashboard
```

예상 결과:
- ✅ `/api/students/:id/score-dashboard` 테스트 정상 통과
- ✅ 모의고사 분석 (평균 백분위/표점 합/상위 3등급 합) 정상 출력
- ✅ 전략 분석 정상 출력

## 참고 사항

- 더미 학생은 모두 2학년 1학기로 생성되므로 `grade: 2`를 하드코딩
- 필요하다면 `student_term`에서 가져올 수 있지만, seed 스크립트에서는 하드코딩으로 충분
- `grade_score`는 등급을 의미하며, `grade`는 학년을 의미함 (혼동 주의)

