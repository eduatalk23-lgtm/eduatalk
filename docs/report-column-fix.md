# 리포트 쿼리 컬럼명 수정

## 📋 개요

리포트 기능에서 발생한 Supabase 쿼리 에러를 해결하기 위해 실제 데이터베이스 스키마에 맞게 컬럼명을 수정했습니다.

## 🔍 발견된 문제

### 1. `student_internal_scores` 테이블
- **에러**: `column student_internal_scores.subject_group does not exist`
- **원인**: `subject_group` 컬럼이 없고 `subject_group_id`를 사용해야 함
- **해결**: `subject_group_id`를 사용하고 JOIN으로 `subject_groups.name` 조회

### 2. `student_mock_scores` 테이블
- **에러**: `column student_mock_scores.subject_group does not exist`
- **원인**: `subject_group` 컬럼이 없고 `subject_group_id`를 사용해야 함
- **해결**: `subject_group_id`를 사용하고 JOIN으로 `subject_groups.name` 조회

### 3. `student_block_schedule` 테이블
- **에러**: `column student_block_schedule.block_index does not exist`
- **원인**: `block_index` 컬럼이 존재하지 않음
- **해결**: `block_index` 없이 조회하고 결과에 `null`로 설정

## 🔧 수정 내용

### `app/(student)/reports/_utils.ts`

#### 1. `fetchSubjectGradeTrends` 함수 수정

**변경 전:**
```typescript
.select("subject_group,subject_name,grade_score,raw_score,test_date")
```

**변경 후:**
```typescript
.select(`
  subject_group_id,
  subject_id,
  grade_score,
  raw_score,
  test_date,
  subject_groups:subject_group_id(name),
  subjects:subject_id(name)
`)
```

**데이터 변환 추가:**
```typescript
internalScoresResult = (internalData || []).map((score: any) => ({
  subject_group: score.subject_groups?.name || null,
  subject_name: score.subjects?.name || null,
  grade_score: score.grade_score,
  raw_score: score.raw_score,
  test_date: score.test_date,
}));
```

#### 2. `fetchNextWeekSchedule` 함수 수정

**변경 전:**
```typescript
.select("day_of_week,block_index,start_time,end_time")
```

**변경 후:**
```typescript
.select("day_of_week,start_time,end_time")
```

**데이터 변환 추가:**
```typescript
blocks = (blocksData || []).map((block: any) => ({
  day_of_week: block.day_of_week,
  start_time: block.start_time,
  end_time: block.end_time,
  block_index: null, // 컬럼이 없으므로 null로 설정
}));
```

#### 3. 쿼리 함수 타입 에러 수정

`handleSupabaseQueryArray`를 사용하던 부분을 직접 쿼리로 변경하여 타입 에러 해결:

- `fetchStudentInfo`: 직접 쿼리로 변경
- `fetchWeeklyLearningSummary`: 직접 쿼리로 변경
- `fetchWeakSubjects`: 직접 쿼리로 변경
- `fetchNextWeekSchedule`: 직접 쿼리로 변경

## ✅ 결과

1. **컬럼명 에러 해결**: 실제 데이터베이스 스키마에 맞게 컬럼명 수정
2. **JOIN 쿼리 추가**: `subject_group_id`와 `subject_id`를 사용하여 과목명 조회
3. **타입 에러 해결**: 모든 TypeScript 타입 에러 해결
4. **에러 처리 개선**: 각 쿼리별로 상세한 에러 로깅 추가

## 📝 참고사항

- `student_internal_scores`와 `student_mock_scores` 테이블은 FK 관계를 사용하므로 JOIN이 필요합니다.
- `student_block_schedule` 테이블에는 `block_index` 컬럼이 없으므로 `null`로 처리합니다.
- 향후 데이터베이스 스키마 변경 시 이 부분을 함께 업데이트해야 합니다.

