# 성적 상세 조회 에러 로깅 개선

## 작업 일시
2024-12-XX

## 문제 상황

성적 분석 페이지에서 내신 성적과 모의고사 성적 조회 시 콘솔 에러가 발생했지만, 에러 메시지가 `{}`로 비어있어 실제 원인을 파악하기 어려웠습니다.

### 에러 메시지
```
[data/scoreDetails] 내신 성적 조회 실패 {}
[data/scoreDetails] 모의고사 성적 조회 실패 {}
```

## 원인 분석

1. **에러 객체 직렬화 문제**: Supabase 에러 객체를 직접 `console.error`로 출력할 때 제대로 직렬화되지 않아 빈 객체로 표시됨
2. **디버깅 정보 부족**: 에러 발생 시 쿼리 파라미터나 상세 정보가 로그에 포함되지 않음

## 해결 방법

### 1. 에러 로깅 개선

에러 객체의 속성을 명시적으로 추출하여 로깅하도록 수정:

```typescript
// 이전
if (error) {
  console.error("[data/scoreDetails] 내신 성적 조회 실패", error);
  return [];
}

// 개선 후
if (error) {
  console.error("[data/scoreDetails] 내신 성적 조회 실패", {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    studentId,
    tenantId,
    grade,
    semester,
  });
  return [];
}
```

### 2. 모든 함수에 일관된 에러 로깅 적용

다음 함수들의 에러 로깅을 개선했습니다:

- `getInternalScoresByTerm`: 내신 성적 조회
- `getMockScoresByPeriod`: 모의고사 성적 조회
- `getRecentMockExams`: 최근 모의고사 시험 목록 조회
- `getMockScoresByExam`: 특정 시험 성적 조회
- `getMockTrendBySubject`: 과목별 모의고사 추이 조회

## 수정된 파일

- `lib/data/scoreDetails.ts`: 모든 에러 로깅 개선

## 기대 효과

1. **에러 원인 파악 용이**: 에러 메시지, 상세 정보, 힌트, 코드 등이 명확하게 표시됨
2. **디버깅 효율성 향상**: 쿼리 파라미터 정보가 함께 로깅되어 문제 재현이 쉬워짐
3. **일관된 에러 처리**: 모든 함수에서 동일한 형식의 에러 로깅 사용

## 다음 단계

실제 에러 메시지를 확인한 후:
1. RLS 정책 문제인지 확인
2. 외래키 관계 설정 확인
3. 테이블 데이터 존재 여부 확인
4. 필요 시 쿼리 문법 수정

## 참고

- Supabase 에러 객체는 `PostgrestError` 타입이며 다음 속성을 포함:
  - `message`: 에러 메시지
  - `details`: 상세 정보
  - `hint`: 해결 힌트
  - `code`: 에러 코드

