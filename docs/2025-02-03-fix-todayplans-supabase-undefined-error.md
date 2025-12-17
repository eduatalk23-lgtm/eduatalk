# todayPlans.ts supabase undefined 에러 수정

## 날짜
2025-02-03

## 문제 상황

### 에러 정보
- **에러 타입**: Runtime ReferenceError
- **에러 메시지**: `supabase is not defined`
- **발생 위치**: `lib/data/todayPlans.ts:337:9`
- **호출 경로**: `CampTodayPage` (app/(student)/camp/today/page.tsx:182:26)

### 에러 원인
`lib/data/todayPlans.ts` 파일의 337번째 줄에서 `supabase` 변수를 사용하려고 했지만, 해당 스코프에서 `supabase` 클라이언트가 정의되지 않았습니다.

```typescript
// 문제가 있던 코드 (334-337번째 줄)
const progressQueries = [];
if (bookProgressIds.length > 0) {
  progressQueries.push(
    supabase  // ❌ supabase가 정의되지 않음
      .from("student_content_progress")
      ...
  );
}
```

## 수정 내용

### 변경 사항
`progressQueries` 배열을 생성하기 전에 `supabase` 클라이언트를 생성하도록 수정했습니다.

```typescript
// 수정된 코드
if (contentKeys.size > 0) {
  // Supabase 클라이언트 생성 추가
  const supabase = await createSupabaseServerClient();
  
  // 각 content_type별로 그룹화하여 쿼리
  const bookProgressIds: string[] = [];
  const lectureProgressIds: string[] = [];
  const customProgressIds: string[] = [];
  // ...
  
  const progressQueries = [];
  if (bookProgressIds.length > 0) {
    progressQueries.push(
      supabase  // ✅ 이제 supabase가 정의되어 있음
        .from("student_content_progress")
        ...
    );
  }
  // ...
}
```

### 수정 파일
- `lib/data/todayPlans.ts` (321-334번째 줄)

## 검증
- ✅ 린터 오류 없음
- ✅ TypeScript 타입 체크 통과
- ✅ `createSupabaseServerClient` import 확인 (이미 파일 상단에 존재)

## 참고 사항
- 파일 내 다른 위치(106번째 줄, 572번째 줄)에서는 이미 `supabase` 클라이언트를 올바르게 생성하고 있었습니다.
- 이번 수정으로 진행률 조회 쿼리 부분에서도 일관되게 `supabase` 클라이언트를 사용할 수 있게 되었습니다.



