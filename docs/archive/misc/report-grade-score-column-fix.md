# 리포트 grade_score 컬럼명 수정

## 📋 개요

리포트 기능에서 `student_internal_scores` 테이블의 존재하지 않는 `grade_score` 컬럼을 사용하던 문제를 해결하기 위해 `rank_grade`로 변경했습니다.

## 🔍 발견된 문제

### 에러 메시지
```
column student_internal_scores.grade_score does not exist
hint: 'Perhaps you meant to reference the column "student_internal_scores.raw_score".'
```

### 원인 분석
- `student_internal_scores` 테이블에는 `grade_score` 컬럼이 없음
- 실제로는 `rank_grade` 컬럼만 존재
- `student_mock_scores` 테이블에는 `grade_score` 컬럼이 존재

### 테이블 구조 차이
- **student_internal_scores**: `rank_grade`만 있음 (석차등급)
- **student_mock_scores**: `grade_score` 있음 (성취도 등급)

## 🔧 수정 내용

### `app/(student)/reports/_utils.ts`

#### 1. 타입 정의 수정

**변경 전:**
```typescript
let internalScoresResult: Array<{
  subject_group?: string | null;
  subject_name?: string | null;
  grade_score?: number | null;  // ❌ 존재하지 않음
  raw_score?: number | null;
  test_date?: string | null;
}> = [];
```

**변경 후:**
```typescript
let internalScoresResult: Array<{
  subject_group?: string | null;
  subject_name?: string | null;
  rank_grade?: number | null;  // ✅ 실제 컬럼명
  raw_score?: number | null;
  test_date?: string | null;
}> = [];
```

#### 2. 쿼리 수정

**변경 전:**
```typescript
const { data: internalData, error: internalError } = await supabase
  .from("student_internal_scores")
  .select("subject_group_id,subject_id,grade_score,raw_score,test_date")
  .gte("test_date", startDateStr)
  .lte("test_date", endDateStr)
  .eq("student_id", studentId)
  .order("test_date", { ascending: true });
```

**변경 후:**
```typescript
// student_internal_scores에는 grade_score가 없고 rank_grade만 있음
// test_date도 없으므로 created_at을 사용하여 날짜 필터링
const { data: internalData, error: internalError } = await supabase
  .from("student_internal_scores")
  .select("subject_group_id,subject_id,rank_grade,raw_score,created_at")
  .eq("student_id", studentId)
  .gte("created_at", `${startDateStr}T00:00:00Z`)
  .lte("created_at", `${endDateStr}T23:59:59Z`)
  .order("created_at", { ascending: true });
```

#### 3. 데이터 변환 수정

**변경 전:**
```typescript
internalScoresResult = (internalData || []).map((score: any) => ({
  subject_group: ...,
  subject_name: ...,
  grade_score: score.grade_score,  // ❌
  raw_score: score.raw_score,
  test_date: score.test_date,  // ❌
}));
```

**변경 후:**
```typescript
// student_internal_scores에는 test_date가 없으므로 created_at을 사용
internalScoresResult = (internalData || []).map((score: any) => ({
  subject_group: ...,
  subject_name: ...,
  rank_grade: score.rank_grade,  // ✅
  raw_score: score.raw_score,
  test_date: score.created_at ? score.created_at.slice(0, 10) : null,  // ✅
}));
```

#### 4. 데이터 처리 로직 수정

**변경 전:**
```typescript
if (!subject || score.grade_score === null) return;
existing.push({
  test_date: score.test_date ?? "",
  grade: score.grade_score ?? 0,  // ❌
  raw_score: score.raw_score ?? null,
});
```

**변경 후:**
```typescript
if (!subject || score.rank_grade === null) return;
existing.push({
  test_date: score.test_date ?? "",
  grade: score.rank_grade ?? 0,  // ✅
  raw_score: score.raw_score ?? null,
});
```

## ✅ 결과

1. **컬럼명 에러 해결**: `grade_score` → `rank_grade`로 변경
2. **날짜 필터링 수정**: `test_date` → `created_at` 사용
3. **타입 안정성 향상**: 실제 테이블 구조에 맞게 타입 수정
4. **데이터 정확성 개선**: 올바른 컬럼을 사용하여 데이터 조회

## 📝 참고사항

- `student_internal_scores` 테이블은 내신 성적을 관리하며 `rank_grade`(석차등급)만 저장합니다.
- `student_mock_scores` 테이블은 모의고사 성적을 관리하며 `grade_score`(성취도 등급)를 저장합니다.
- 내신 성적에는 `test_date` 컬럼이 없으므로 `created_at`을 사용하여 날짜 필터링합니다.
- 향후 데이터베이스 스키마 변경 시 이 부분을 함께 업데이트해야 합니다.

