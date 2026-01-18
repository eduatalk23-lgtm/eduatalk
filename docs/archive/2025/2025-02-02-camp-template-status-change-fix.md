# Camp Template 상태 변경 기능 수정

**날짜**: 2025-02-02  
**문제**: CampTemplateDetail 컴포넌트에서 상태 변경이 동작하지 않음

## 문제 상황

CampTemplateDetail 컴포넌트에서 상태 변경(활성/비활성/보관) 드롭다운을 선택해도 상태가 변경되지 않고 에러가 발생했습니다.

### 에러 메시지

```
AppError: updatedRows is not defined
```

### 원인 분석

`updateCampTemplateStatusAction` 함수에서 Supabase `update()` 쿼리를 실행할 때:
1. `.select()` 메서드를 호출하지 않아 업데이트된 데이터를 반환받지 않음
2. 구조 분해에서 `data`를 추출하지 않아 `updatedRows` 변수가 정의되지 않음
3. 이후 `updatedRows`를 참조하는 코드에서 에러 발생

### 문제 코드

```852:878:app/(admin)/actions/campTemplateActions.ts
// 상태 변경
const supabase = await createSupabaseServerClient();
const { error } = await supabase  // data를 구조 분해하지 않음
  .from("camp_templates")
  .update({
    status,
    updated_at: new Date().toISOString(),
  })
  .eq("id", templateId)
  .eq("tenant_id", tenantContext.tenantId);
// .select() 메서드가 없음

if (error) {
  throw new AppError(...);
}

if (!updatedRows || updatedRows.length === 0) {  // updatedRows가 정의되지 않음!
  throw new AppError(...);
}
```

## 해결 방법

다른 update 쿼리 패턴을 참고하여 수정:

1. `.select()` 메서드 추가하여 업데이트된 행 데이터 반환
2. 구조 분해에 `data: updatedRows` 추가
3. **`createSupabaseAdminClient()` 사용으로 변경** (RLS 정책 문제 해결)

### 문제 분석

- `updateCampTemplateAction` 등 다른 update 함수들은 `createSupabaseAdminClient()`를 사용하여 RLS를 우회
- `updateCampTemplateStatusAction`만 `createSupabaseServerClient()`를 사용하여 RLS 정책에 의해 업데이트가 차단될 수 있음
- Admin 영역에서의 관리 작업이므로 Admin Client 사용이 적절함

### 수정 코드

```typescript
// 상태 변경
// Admin Client 사용 (RLS 우회)
const supabase = createSupabaseAdminClient();
if (!supabase) {
  throw new AppError(
    "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
    ErrorCode.INTERNAL_ERROR,
    500,
    true
  );
}

const { data: updatedRows, error } = await supabase  // data 구조 분해 추가
  .from("camp_templates")
  .update({
    status,
    updated_at: new Date().toISOString(),
  })
  .eq("id", templateId)
  .eq("tenant_id", tenantContext.tenantId)
  .select();  // select() 메서드 추가

if (error) {
  throw new AppError(
    "템플릿 상태 변경에 실패했습니다.",
    ErrorCode.DATABASE_ERROR,
    500,
    true,
    { originalError: error.message }
  );
}

if (!updatedRows || updatedRows.length === 0) {
  throw new AppError(
    "템플릿을 찾을 수 없습니다.",
    ErrorCode.NOT_FOUND,
    404,
    true
  );
}
```

## 수정된 파일

- `app/(admin)/actions/campTemplateActions.ts`
  - `updateCampTemplateStatusAction` 함수 수정

## 테스트 확인 사항

1. ✅ 상태 변경 드롭다운에서 "활성" 선택 시 상태 변경 성공
2. ✅ 상태 변경 드롭다운에서 "비활성" 선택 시 상태 변경 성공
3. ✅ 상태 변경 드롭다운에서 "보관" 선택 시 상태 변경 성공
4. ✅ 에러 메시지가 발생하지 않음
5. ✅ 성공 토스트 메시지 표시
6. ✅ 페이지 자동 새로고침 (`router.refresh()`)

## 관련 컴포넌트

- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
  - 상태 변경 UI 및 핸들러 구현

## 참고

- Supabase의 `update()` 메서드는 기본적으로 업데이트된 데이터를 반환하지 않음
- 업데이트된 행을 확인하려면 `.select()` 메서드를 호출해야 함
- 다른 update 액션들(`updateCampTemplateAction` 등)도 동일한 패턴 사용
- **Admin 영역에서는 RLS를 우회하기 위해 `createSupabaseAdminClient()` 사용**
  - `updateCampTemplateAction` (724번째 줄)
  - `getCampTemplates` (130번째 줄)
  - `getCampTemplateById` (188번째 줄)
  - 모두 Admin Client 사용

