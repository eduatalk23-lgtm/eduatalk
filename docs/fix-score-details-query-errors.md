# 성적 상세 조회 에러 수정

## 문제 상황

`app/(student)/scores/analysis/page.tsx`에서 내신 성적과 모의고사 성적을 조회할 때 콘솔 에러가 발생했습니다.

### 에러 메시지

1. `[data/scoreDetails] 내신 성적 조회 실패 {}`
2. `[data/scoreDetails] 모의고사 성적 조회 실패 {}`

에러 객체가 빈 객체로 출력되어 실제 에러 원인을 파악하기 어려웠습니다.

## 원인 분석

1. **에러 로깅 방식 문제**: 에러 객체의 속성들이 제대로 추출되지 않아 빈 객체로 출력됨
2. **Supabase 관계 조회 문법 문제**: 관계 조회 시 잘못된 문법 사용
   - 기존: `subject_groups:subject_group_id (name)`
   - 수정: `subject_group:subject_groups(name)`

## 수정 내용

### 1. 에러 핸들러 적용

`lib/data/core/errorHandler.ts`의 `handleQueryError` 함수를 사용하도록 수정했습니다.

**수정 전:**
```typescript
if (error) {
  console.error("[data/scoreDetails] 내신 성적 조회 실패", {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    // ...
  });
  return [];
}
```

**수정 후:**
```typescript
if (handleQueryError(error, {
  context: "[data/scoreDetails] 내신 성적 조회 실패",
  logError: true,
})) {
  // 에러 상세 정보 추가 로깅
  if (error) {
    console.error("[data/scoreDetails] 내신 성적 조회 상세 정보", {
      error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      studentId,
      tenantId,
      grade,
      semester,
    });
  }
  return [];
}
```

### 2. Supabase 관계 조회 문법 수정

`lib/data/scoreQueries.ts`의 패턴을 참고하여 관계 조회 문법을 수정했습니다.

**수정 전:**
```typescript
.select(`
  *,
  subject_groups:subject_group_id (name),
  subjects:subject_id (name),
  subject_types:subject_type_id (name)
`)
```

**수정 후:**
```typescript
.select(`
  *,
  subject_group:subject_groups(name),
  subject:subjects(name),
  subject_type:subject_types(name)
`)
```

### 3. 수정된 함수 목록

- `getInternalScoresByTerm`: 내신 성적 조회
- `getMockScoresByPeriod`: 모의고사 성적 조회
- `getRecentMockExams`: 최근 모의고사 시험 목록 조회
- `getMockScoresByExam`: 특정 시험 성적 조회
- `getMockTrendBySubject`: 과목별 모의고사 추이 조회

## 개선 사항

1. **일관된 에러 처리**: 모든 함수에서 `handleQueryError` 사용
2. **상세한 에러 로깅**: 에러 객체의 모든 속성을 JSON으로 직렬화하여 로깅
3. **올바른 관계 조회**: Supabase의 표준 관계 조회 문법 사용

## 테스트

수정 후 다음을 확인해야 합니다:

1. 내신 성적 조회가 정상적으로 동작하는지
2. 모의고사 성적 조회가 정상적으로 동작하는지
3. 에러 발생 시 상세한 에러 정보가 로깅되는지
4. 관계 데이터(subject_group, subject, subject_type)가 정상적으로 조회되는지

## 관련 파일

- `lib/data/scoreDetails.ts`: 수정된 파일
- `lib/data/core/errorHandler.ts`: 에러 핸들러 유틸리티
- `app/(student)/scores/analysis/page.tsx`: 에러가 발생한 페이지
- `lib/data/scoreQueries.ts`: 참고한 관계 조회 패턴

