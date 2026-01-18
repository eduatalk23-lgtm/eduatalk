# Score Dashboard Route 리팩토링

## 작업 일자
2025-01-31

## 작업 내용

### 문제 상황
`GET /api/students/:id/score-dashboard` 엔드포인트에서 404 (`Student not found`) 에러가 발생하고 있었음.

실제 호출 URL 예시:
```
http://localhost:3000/api/students/f7b6e709-c50b-4586-84a6-8e5a5d51b9b1/score-dashboard?tenantId=84b71a5d-5681-4da3-88d2-91e75ef89015&termId=cda33d0a-9559-4e47-a01f-3fe955bbe3e6
```

### 원인 분석
현재 `app/api/students/[id]/score-dashboard/route.ts`에서 학생 조회 쿼리 조건이 실제 데이터와 맞지 않게 작성되어 있었음.

### 해결 방법

#### 1. JOIN 쿼리로 통합
- `students`와 `student_terms`를 JOIN해서 한 번에 조회하도록 변경
- 조건:
  - `students.id = params.id`
  - `students.tenant_id = tenantId` (querystring)
  - `student_terms.id = termId` (querystring)
  - `student_terms.tenant_id = tenantId`

#### 2. Supabase 관계형 쿼리 사용
- `student_terms`를 기준으로 조회 (foreign key 관계 활용)
- `students!inner()`를 사용하여 INNER JOIN 수행

#### 3. 필수 파라미터 검증 강화
- `tenantId`와 `termId` 모두 필수로 변경
- 둘 중 하나라도 없으면 400 에러 반환

#### 4. 응답 구조 개선
- `studentProfile`에 다음 필드 추가:
  - `class`: 학생 반
  - `schoolYear`: 학년도
  - `termGrade`: 학기 학년
  - `semester`: 학기

### 변경된 코드 구조

```typescript
// 1) 학생 + term 조인으로 존재 여부 및 기본 프로필 조회
const { data: termRow, error: termError } = await supabase
  .from("student_terms")
  .select(`
    id,
    school_year,
    grade,
    semester,
    curriculum_revision_id,
    students!inner(
      id,
      name,
      grade,
      class,
      school_type
    )
  `)
  .eq("id", termId)
  .eq("tenant_id", tenantId)
  .eq("students.id", studentId)
  .eq("students.tenant_id", tenantId)
  .maybeSingle();

// 2) 내신 분석 (특정 term 기준)
const internal = await getInternalAnalysis(
  tenantId,
  studentId,
  termId // studentTermId로 사용
);

// 3) 내신 백분위 환산
const internalPct =
  internal.totalGpa != null && curriculumRevisionId
    ? await getInternalPercentile(curriculumRevisionId, internal.totalGpa)
    : null;

// 4) 모의고사 분석 (최근 모의 기준)
const mock = await getMockAnalysis(tenantId, studentId);

// 5) 전략 분석
const strategy = analyzeAdmissionStrategy(
  internalPct,
  mock.avgPercentile,
  internal.zIndex
);
```

### 주요 변경 사항

1. **쿼리 방식 변경**
   - 기존: `students` 테이블에서 조회 후 별도로 `student_terms` 조회
   - 변경: `student_terms` 기준으로 JOIN하여 한 번에 조회

2. **에러 처리 개선**
   - 404 에러 메시지 명확화
   - RLS 정책 에러 처리 추가

3. **타입 안전성 향상**
   - `ScoreDashboardResponse` 타입에 필드 추가
   - `student_terms` 배열 처리 로직 추가

### 테스트 시나리오

1. **정상 케이스**
   - 유효한 `studentId`, `tenantId`, `termId`로 요청
   - 학생과 학기 정보가 모두 존재하는 경우

2. **에러 케이스**
   - `tenantId` 또는 `termId`가 없는 경우 → 400
   - 학생이 존재하지 않는 경우 → 404
   - 학기가 존재하지 않는 경우 → 404
   - RLS 정책으로 인한 권한 없는 경우 → 403

### 참고 사항

- Supabase의 관계형 쿼리는 foreign key 관계가 설정되어 있어야 작동함
- `student_terms.student_id`가 `students.id`를 참조하는 관계 필요
- `students!inner()`는 INNER JOIN을 의미하며, 관계가 없으면 결과가 반환되지 않음

