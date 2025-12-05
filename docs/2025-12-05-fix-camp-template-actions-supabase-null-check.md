# 캠프 템플릿 액션 Supabase Null 체크 수정

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:
```
./app/(admin)/actions/campTemplateActions.ts:1783:35
Type error: 'supabase' is possibly 'null'.
```

## 원인 분석
`createSupabaseAdminClient()` 함수가 `SUPABASE_SERVICE_ROLE_KEY`가 없을 경우 `null`을 반환할 수 있는데, `continueCampStepsForAdmin` 함수에서 null 체크 없이 바로 사용하고 있었습니다.

## 수정 내용

### 파일
- `app/(admin)/actions/campTemplateActions.ts`

### 변경 사항
`continueCampStepsForAdmin` 함수에서 `createSupabaseAdminClient()` 호출 후 null 체크를 추가했습니다.

```typescript
// 수정 전
const supabase = createSupabaseAdminClient();
console.log("[continueCampStepsForAdmin] Admin 클라이언트 사용 (RLS 우회)");

// 수정 후
const supabase = createSupabaseAdminClient();

if (!supabase) {
  throw new AppError(
    "서버 설정 오류: Service Role Key가 설정되지 않았습니다.",
    ErrorCode.INTERNAL_ERROR,
    500,
    true
  );
}

console.log("[continueCampStepsForAdmin] Admin 클라이언트 사용 (RLS 우회)");
```

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `lib/supabase/admin.ts`의 `createSupabaseAdminClient()` 함수는 Service Role Key가 없을 경우 null을 반환합니다.
- 다른 곳(4270번 라인)에서는 이미 null 체크가 구현되어 있었습니다.

