# getScoreTrend 테이블 마이그레이션 수정 완료

**작성일**: 2025-02-03  
**작업자**: AI Assistant

---

## 📋 작업 개요

`student_school_scores` 테이블이 제거되고 `student_internal_scores`와 `student_mock_scores`로 분리된 마이그레이션 이후, `getScoreTrend` 함수와 `safeQuery` 유틸리티의 에러 로깅을 개선했습니다.

---

## 🔧 수정 내용

### 1. `lib/metrics/getScoreTrend.ts` 개선

#### 변경 사항

- **주석 및 문서화 개선**: 각 타입과 함수에 상세한 주석 추가
- **에러 처리 개선**: 예외 발생 시 상세한 에러 정보 로깅
- **코드 가독성 향상**: 로직 흐름을 명확하게 주석 처리

#### 주요 개선점

1. **타입 정의 주석 추가**
   - `InternalScoreRow`: 내신 성적 조회 결과 타입 (rank_grade, created_at 사용)
   - `MockScoreRow`: 모의고사 성적 조회 결과 타입 (grade_score, exam_date 사용)

2. **데이터 처리 로직 명확화**
   - 내신 성적: `rank_grade`를 등급으로 사용, `created_at`을 testDate로 사용
   - 모의고사 성적: `grade_score`를 등급으로 사용, `exam_date`를 testDate로 사용
   - `subject_groups.name`이 null인 경우 안전하게 처리

3. **에러 로깅 개선**
   - 예외 발생 시 에러 객체의 모든 속성을 명시적으로 로깅
   - JSON 직렬화 실패 시 문자열로 변환하여 로깅

#### 코드 구조

```typescript
// 내신 성적 조회: student_internal_scores 테이블 사용
safeQueryArray<InternalScoreRow>(
  () => supabase.from("student_internal_scores").select(...),
  () => supabase.from("student_internal_scores").select(...), // fallback
  { context: "[metrics/getScoreTrend] 내신 성적 조회" }
)

// 모의고사 성적 조회: student_mock_scores 테이블 사용
safeQueryArray<MockScoreRow>(
  () => supabase.from("student_mock_scores").select(...),
  () => supabase.from("student_mock_scores").select(...), // fallback
  { context: "[metrics/getScoreTrend] 모의고사 성적 조회" }
)
```

---

### 2. `lib/supabase/safeQuery.ts` 에러 로깅 개선

#### 변경 사항

- **PostgrestError 직렬화 문제 해결**: 빈 객체(`{}`)로 출력되는 문제 해결
- **명시적 속성 추출**: `error.code`, `error.message`, `error.details`, `error.hint` 등을 명시적으로 추출
- **로깅 형식 개선**: 구조화된 객체로 로깅하여 디버깅 용이성 향상

#### 개선 전

```typescript
console.error(`${context} 쿼리 실패`, errorInfo);
// PostgrestError가 빈 객체로 출력될 수 있음
```

#### 개선 후

```typescript
console.error(`${context} 쿼리 실패`, {
  code: errorInfo.code,
  message: errorInfo.message,
  details: errorInfo.details,
  hint: errorInfo.hint,
  name: errorInfo.name,
  stack: errorInfo.stack,
  raw: errorInfo.raw,
});
// 모든 속성을 명시적으로 로깅하여 디버깅 용이성 향상
```

#### 적용된 함수

- `safeQueryArray`: 배열 반환 쿼리 함수
- `safeQuerySingle`: 단일 항목 반환 쿼리 함수

---

## ✅ 검증 완료

- [x] TypeScript 컴파일 에러 없음
- [x] ESLint 에러 없음
- [x] 코드 가독성 향상
- [x] 에러 로깅 개선

---

## 📝 참고 사항

### 테이블 구조

#### `student_internal_scores` (내신 성적)
- `rank_grade`: 석차등급 (1~9, null 가능)
- `created_at`: 생성일 (내신은 시험일자가 없으므로 생성일 기준 정렬)

#### `student_mock_scores` (모의고사 성적)
- `grade_score`: 등급 (1~9, null 가능)
- `exam_date`: 시험일자

### 에러 처리

- 42703 에러(undefined column) 발생 시 fallback 쿼리 자동 실행
- 모든 에러는 상세한 정보와 함께 로깅됨
- 에러 발생 시 기본값 반환으로 안정성 보장

---

## 🚀 다음 단계

다른 파일에서 `student_school_scores` 테이블을 참조하는 경우가 있는지 확인 필요:

- `lib/domains/score/repository.ts` (5곳)
- `lib/reports/weekly.ts` (1곳)
- `lib/domains/score/types.ts` (타입 정의)

이 파일들도 마이그레이션을 완료해야 합니다.

---

**작업 완료 시간**: 2025-02-03

