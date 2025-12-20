# getScoreTrend 마이그레이션 수정 완료

**작성일**: 2025-02-05  
**작업자**: AI Assistant

---

## 📋 작업 개요

`student_school_scores` 테이블이 제거되고 `student_internal_scores`와 `student_mock_scores`로 분리된 마이그레이션 이후, `getScoreTrend` 함수가 여전히 삭제된 테이블을 참조하거나 필드명이 맞지 않아 발생하던 빌드/런타임 에러를 수정했습니다.

---

## 🔧 수정 내용

### 1. `lib/metrics/getScoreTrend.ts` 수정

#### 변경 사항

- **테이블 변경**: `student_school_scores` → `student_internal_scores`, `student_mock_scores`
- **필드명 변경**:
  - 내신: `grade_score` → `rank_grade`, `test_date` → `created_at`
  - 모의고사: `test_date` → `exam_date`
- **JOIN 추가**: `subject_group_id`를 통해 `subject_groups(name)` 조회
- **scoreType 변경**: `"school"` → `"internal"` (더 명확한 의미)

#### 주요 로직

1. **내신 성적 조회 (`student_internal_scores`)**:
   ```typescript
   .select("rank_grade,grade,semester,created_at,subject_groups:subject_group_id(name)")
   .eq("student_id", studentId)
   .order("created_at", { ascending: false })
   ```
   - `rank_grade`를 등급으로 사용
   - `created_at`을 testDate로 사용 (내신은 시험일자가 없으므로 생성일 기준)

2. **모의고사 성적 조회 (`student_mock_scores`)**:
   ```typescript
   .select("grade_score,exam_date,subject_groups:subject_group_id(name)")
   .eq("student_id", studentId)
   .order("exam_date", { ascending: false })
   ```
   - `grade_score`를 등급으로 사용
   - `exam_date`를 testDate로 사용

3. **데이터 통합**:
   - 두 결과를 합쳐 `testDate` 기준 내림차순 정렬
   - 과목별로 그룹화하여 추이 분석
   - `subject_groups.name`이 null일 경우 안전하게 처리

#### 타입 정의

```typescript
// 내신 성적 조회 결과 타입
type InternalScoreRow = {
  rank_grade: number | null;
  grade: number | null;
  semester: number | null;
  created_at: string;
  subject_groups: {
    name: string;
  } | null;
};

// 모의고사 성적 조회 결과 타입
type MockScoreRow = {
  grade_score: number | null;
  exam_date: string;
  subject_groups: {
    name: string;
  } | null;
};
```

### 2. `lib/supabase/safeQuery.ts` 에러 로깅 개선

#### 변경 사항

Supabase 에러 객체가 `console.error`에서 빈 객체(`{}`)로 출력되는 문제를 해결하기 위해 로깅 방식을 개선했습니다.

#### 개선 내용

1. **에러 정보 명시적 분해**:
   - `error.code`, `error.message`, `error.details`, `error.hint` 명시적 추출
   - `Error` 인스턴스인 경우 `name`, `stack` 포함

2. **원본 에러 객체 포함**:
   - 직렬화 가능한 경우 JSON으로 변환하여 `raw` 필드에 포함
   - 직렬화 실패 시 문자열로 변환

3. **적용 범위**:
   - `safeQueryArray` 함수의 에러 처리
   - `safeQuerySingle` 함수의 에러 처리
   - 모든 `catch` 블록의 예외 처리

#### 개선된 로깅 예시

```typescript
// 이전: 빈 객체로 출력
console.error(`${context} 쿼리 실패`, error); // {}

// 이후: 상세 정보 포함
console.error(`${context} 쿼리 실패`, {
  code: "42703",
  message: "column does not exist",
  details: "...",
  hint: "...",
  name: "PostgrestError",
  stack: "...",
  raw: { ... }
});
```

---

## ✅ 검증 결과

### 타입 체크

- `getScoreTrend.ts`: 타입 에러 없음
- `safeQuery.ts`: 타입 에러 없음

### 영향 범위

- `lib/risk/engine.ts`: `getScoreTrend` 사용 (타입만 사용, 문제 없음)
- `lib/recommendations/subjectRecommendation.ts`: `getScoreTrend` 사용 (타입만 사용, 문제 없음)
- `lib/validation/schemas.ts`: `scoreType: z.enum(["school", "mock"])` (다른 스키마, 영향 없음)

---

## 📝 참고 사항

### 테이블 구조

#### `student_internal_scores`
- `rank_grade`: 석차등급 (1~9)
- `created_at`: 생성일 (testDate로 사용)
- `subject_group_id`: FK → `subject_groups.id`

#### `student_mock_scores`
- `grade_score`: 등급 (1~9)
- `exam_date`: 시험일 (testDate로 사용)
- `subject_group_id`: FK → `subject_groups.id`

### 데이터 흐름

1. 내신/모의고사 성적 병렬 조회
2. `subject_groups.name` 추출
3. 데이터 통합 및 날짜순 정렬
4. 과목별 그룹화
5. 추이 분석 (연속 하락, 저등급 과목 식별)

---

## 🚀 다음 단계

- [ ] 실제 데이터로 테스트하여 정상 동작 확인
- [ ] 성능 최적화 (필요 시)
- [ ] 에러 케이스 추가 테스트

---

**작업 완료**: 2025-02-05

