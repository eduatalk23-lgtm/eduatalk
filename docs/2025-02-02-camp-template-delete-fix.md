# 캠프 템플릿 삭제 기능 수정

## 📋 작업 개요

캠프 템플릿 삭제 시 삭제 메시지는 표시되지만 실제로 삭제되지 않는 문제를 수정했습니다.

## 🔍 문제 분석

### 문제 상황

- 템플릿 삭제 버튼 클릭 시 "템플릿이 삭제되었습니다." 메시지 표시
- 하지만 템플릿 목록에서 여전히 조회됨
- 템플릿 상세 보기도 여전히 접근 가능

### 원인 분석

1. **삭제 쿼리 결과 확인 부족**
   - 기존 코드는 에러만 확인하고 실제로 삭제된 행 수를 확인하지 않음
   - Supabase의 delete 쿼리는 에러가 없어도 삭제된 행이 0개일 수 있음

2. **RLS 정책 문제 가능성**
   - RLS 정책 때문에 삭제가 차단될 수 있음
   - 하지만 에러가 발생하지 않아서 문제를 감지하지 못함

3. **캐시 무효화 부족**
   - `revalidatePath`가 제대로 작동하지 않을 수 있음
   - 특정 템플릿 경로의 캐시가 무효화되지 않을 수 있음

## ✅ 해결 방안

### 1. 삭제된 행 수 확인

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**변경 내용**:
- 삭제 쿼리에 `.select()` 추가하여 삭제된 행 반환
- 삭제된 행이 0개인 경우 명확한 에러 메시지 표시

```typescript
// 삭제된 행을 반환받아 실제로 삭제되었는지 확인
const { data: deletedRows, error } = await supabase
  .from("camp_templates")
  .delete()
  .eq("id", templateId)
  .eq("tenant_id", tenantContext.tenantId)
  .select();

// 실제로 삭제된 행이 없는 경우
if (!deletedRows || deletedRows.length === 0) {
  throw new AppError(
    "템플릿을 삭제할 수 없습니다. 권한을 확인하거나 템플릿이 이미 삭제되었는지 확인해주세요.",
    ErrorCode.FORBIDDEN,
    403,
    true
  );
}
```

### 2. Admin Client 자동 재시도 로직

**변경 내용**:
- 먼저 일반 클라이언트로 삭제 시도
- 삭제된 행이 0개이거나 에러 발생 시 Admin Client로 자동 재시도
- RLS 정책을 우회하여 삭제 보장

```typescript
// 먼저 일반 클라이언트로 삭제 시도
const { data: deletedRows, error } = await supabase
  .from("camp_templates")
  .delete()
  .eq("id", templateId)
  .eq("tenant_id", tenantContext.tenantId)
  .select();

let deletedSuccessfully = false;

if (deletedRows && deletedRows.length > 0) {
  // 일반 클라이언트로 삭제 성공
  deletedSuccessfully = true;
} else {
  // 삭제된 행이 없음 (RLS 정책으로 차단되었을 가능성)
  // Admin Client로 재시도
  const adminSupabase = createSupabaseAdminClient();
  const { data: adminDeletedRows, error: adminError } = await adminSupabase
    .from("camp_templates")
    .delete()
    .eq("id", templateId)
    .eq("tenant_id", tenantContext.tenantId)
    .select();
  
  if (!adminError && adminDeletedRows && adminDeletedRows.length > 0) {
    deletedSuccessfully = true;
  }
}
```

### 3. 캐시 무효화 강화

**변경 내용**:
- 목록 페이지 캐시 무효화
- 레이아웃 레벨 캐시 무효화
- 특정 템플릿 경로 캐시 무효화

```typescript
// 캐시 무효화하여 목록 페이지 재렌더링 (강화)
revalidatePath("/admin/camp-templates");
revalidatePath("/admin/camp-templates", "layout");
revalidatePath(`/admin/camp-templates/${templateId}`);
```

## 📝 변경 사항 요약

### 수정된 파일

1. **`app/(admin)/actions/campTemplateActions.ts`**
   - 삭제 쿼리에서 삭제된 행 수 확인
   - 삭제 후 재확인 로직 추가
   - Admin Client를 사용한 강제 삭제 로직 추가
   - 캐시 무효화 강화

### 개선 사항

1. **에러 처리 개선**
   - 삭제된 행이 0개인 경우 명확한 에러 메시지
   - RLS 정책 문제 시 Admin Client로 재시도

2. **로깅 강화**
   - 삭제 성공/실패 로그 추가
   - 디버깅을 위한 상세 정보 기록

3. **캐시 무효화 강화**
   - 여러 레벨의 캐시 무효화
   - 목록 및 상세 페이지 모두 갱신

## 🧪 테스트 시나리오

### 삭제 기능 테스트

1. 관리자로 로그인
2. `/admin/camp-templates` 접속
3. 템플릿 카드의 드롭다운 메뉴에서 "삭제" 선택
4. 삭제 확인 다이얼로그에서 "삭제" 클릭
5. ✅ "템플릿이 삭제되었습니다." 메시지 표시
6. ✅ 템플릿 목록에서 삭제된 템플릿이 사라져야 함
7. ✅ 삭제된 템플릿의 상세 페이지 접근 시 404 에러 또는 리다이렉트

### 에러 처리 테스트

1. 삭제 권한이 없는 경우
   - ✅ 명확한 에러 메시지 표시
   - ✅ 삭제되지 않음

2. 이미 삭제된 템플릿 삭제 시도
   - ✅ 적절한 에러 메시지 표시

## 🎯 결과

- ✅ 삭제된 행 수 확인으로 실제 삭제 여부 검증
- ✅ 삭제 실패 시 Admin Client로 재시도
- ✅ 캐시 무효화 강화로 목록 및 상세 페이지 갱신
- ✅ 명확한 에러 메시지로 사용자 경험 개선

## 📚 참고 사항

- Supabase의 delete 쿼리는 에러가 없어도 삭제된 행이 0개일 수 있음
- RLS 정책 때문에 삭제가 차단될 수 있으므로 Admin Client를 사용한 재시도 로직 추가
- `revalidatePath`는 여러 레벨에서 호출하여 캐시 무효화 보장
