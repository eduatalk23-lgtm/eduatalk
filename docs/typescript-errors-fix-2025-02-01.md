# TypeScript 컴파일 에러 수정 (2025-02-01)

## 문제 상황

TypeScript 컴파일 시 다음 에러들이 발생했습니다:

1. **usePlanPayloadBuilder.ts**: `student_contents`와 `recommended_contents`를 합칠 때 추천 관련 필드(`is_auto_recommended`, `recommendation_source` 등)와 `master_content_id`에 접근할 수 없음
2. **app/api/student-content-details/batch/route.ts**: Supabase 쿼리 결과가 `ParserError` 타입으로 추론되어 데이터 속성에 접근할 수 없음
3. **app/api/student-content-details/route.ts**: 동일한 Supabase 쿼리 결과 타입 추론 문제

## 원인 분석

### 1. WizardData 타입 구조 문제

- `student_contents`에는 추천 관련 필드가 없음
- `recommended_contents`에만 추천 관련 필드가 있음
- 두 배열을 합칠 때 타입이 제대로 추론되지 않음

### 2. Supabase 쿼리 결과 타입 추론 문제

- Supabase의 `select()` 메서드가 반환하는 타입이 Zod 파서 에러 타입으로 추론됨
- 명시적 타입 단언이 필요함

## 해결 방법

### 1. usePlanPayloadBuilder.ts 수정

```typescript
// 타입 확장을 통해 추천 필드를 포함한 통합 타입 생성
const contentWithExtras = c as typeof c & {
  is_auto_recommended?: boolean;
  recommendation_source?: "auto" | "admin" | "template" | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: any;
  master_content_id?: string | null;
};
```

### 2. API 라우트 파일들 수정

#### batch/route.ts
```typescript
// unknown을 거쳐서 타입 단언 (TypeScript의 안전한 타입 단언 패턴)
(booksDataResult.data as unknown as Array<{
  id: string;
  total_pages: number | null;
  // ...
}>).forEach((book) => {
  // ...
});
```

#### route.ts
```typescript
// 명시적 타입 정의 후 타입 단언
type StudentBook = {
  total_pages: number | null;
  master_content_id: string | null;
  // ...
};

const studentBook = studentBookRaw as StudentBook | null;
```

## 수정된 파일

1. `app/(student)/plan/new-group/_components/hooks/usePlanPayloadBuilder.ts`
2. `app/api/student-content-details/batch/route.ts`
3. `app/api/student-content-details/route.ts`

## 검증

```bash
npx tsc --noEmit
# Exit code: 0 (성공)
```

모든 TypeScript 컴파일 에러가 해결되었습니다.

## 참고사항

- Supabase 쿼리 결과에 대한 타입 단언은 `unknown`을 거쳐서 수행하는 것이 TypeScript의 권장 패턴입니다
- `student_contents`와 `recommended_contents`의 타입 차이를 고려하여 옵셔널 필드로 처리했습니다

