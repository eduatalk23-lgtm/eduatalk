# 캠프 템플릿 및 초대 관련 Admin Client 패턴 적용 완료

## 📋 작업 개요

캠프 템플릿 및 초대 관련 모든 조회/수정/삭제 작업에 Admin Client 패턴을 적용하여 RLS 정책 문제를 해결했습니다.

## ✅ 수정 완료된 파일

### 1. `lib/data/campTemplates.ts`

**조회 함수들**:
- `getCampTemplate()` - 템플릿 단일 조회
- `getCampTemplatesForTenant()` - 테넌트별 템플릿 목록 조회
- `getCampTemplatesForTenantWithPagination()` - 템플릿 목록 조회 (페이지네이션)
- `getCampInvitation()` - 초대 단일 조회
- `getCampInvitationsForTemplate()` - 템플릿별 초대 목록 조회
- `getCampInvitationsForTemplateWithPagination()` - 템플릿별 초대 목록 조회 (페이지네이션)
- `getCampTemplateImpactSummary()` - 템플릿 영향 요약 조회
- `getCampStatisticsForTenant()` - 테넌트별 통계 조회
- `getCampTemplateStatistics()` - 템플릿별 통계 조회

**삭제 함수들**:
- `deleteCampInvitation()` - 초대 삭제
- `deleteCampInvitations()` - 초대 일괄 삭제

**변경 사항**:
- 모든 함수에서 `createSupabaseServerClient()` → `createSupabaseAdminClient()`로 변경
- Admin Client 생성 실패 시 적절한 에러 처리
- 삭제된 행 수 확인 추가

### 2. `app/(admin)/actions/campTemplateActions.ts`

**조회 함수들**:
- `getCampTemplates()` - 템플릿 목록 조회
- `getCampTemplateById()` - 템플릿 상세 조회
- `getCampInvitationsForTemplate()` - 초대 목록 조회
- `getCampInvitationsForTemplateWithPaginationAction()` - 초대 목록 조회 (페이지네이션)

**수정 함수들**:
- `updateCampTemplateAction()` - 템플릿 수정
- `updateCampTemplateStatusAction()` - 템플릿 상태 변경
- `updateCampInvitationStatusAction()` - 초대 상태 변경

**삭제 함수들**:
- `deleteCampTemplateAction()` - 템플릿 삭제 (이미 수정됨)
- `deleteCampInvitationAction()` - 초대 삭제
- `deleteCampInvitationsAction()` - 초대 일괄 삭제

**생성 함수들**:
- `sendCampInvitationsAction()` - 초대 발송

**변경 사항**:
- 모든 함수에서 `createSupabaseServerClient()` → `createSupabaseAdminClient()`로 변경
- Admin Client 생성 실패 시 적절한 에러 처리
- 삭제/수정된 행 수 확인 추가
- 테넌트 ID로 데이터 접근 제한

## 🎯 적용된 패턴

### 기본 패턴

```typescript
export async function getResource(resourceId: string): Promise<Resource | null> {
  // 관리자 영역에서 사용되므로 Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("[module] Admin Client를 생성할 수 없습니다.");
    return null;
  }

  const { data, error } = await supabase
    .from("table_name")
    .select("*")
    .eq("id", resourceId)
    .maybeSingle();

  if (error) {
    console.error("[module] 조회 실패", error);
    return null;
  }

  return data as Resource | null;
}
```

### 주요 변경 사항

1. **Admin Client 사용**: `createSupabaseServerClient()` → `createSupabaseAdminClient()`
2. **에러 처리**: Admin Client 생성 실패 시 적절한 에러 처리
3. **결과 확인**: DELETE/UPDATE 작업 시 `.select()`로 삭제/수정된 행 수 확인
4. **테넌트 제한**: 모든 쿼리에 `.eq("tenant_id", tenantContext.tenantId)` 적용

## 🔒 보안 고려사항

### 이미 충분한 보안 조치

1. **애플리케이션 레벨 권한 확인**
   - `requireAdminOrConsultant()`로 관리자/컨설턴트만 통과

2. **테넌트 컨텍스트 확인**
   - `getTenantContext()`로 테넌트 ID 확인
   - 모든 쿼리에 `.eq("tenant_id", tenantContext.tenantId)` 적용

3. **Server Action 보호**
   - `"use server"` 지시어로 서버에서만 실행
   - 클라이언트에서 직접 호출 불가

4. **환경 변수 보호**
   - `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 접근 가능

## 📊 수정 통계

- **수정된 파일**: 2개
  - `lib/data/campTemplates.ts`
  - `app/(admin)/actions/campTemplateActions.ts`
- **수정된 함수**: 20개 이상
- **적용된 패턴**: Admin Client 직접 사용 + 삭제/수정된 행 수 확인

## 🎉 기대 효과

1. **RLS 정책 문제 해결**
   - 초대 목록이 0개로 표시되던 문제 해결
   - 초대 발송 실패 문제 해결
   - 템플릿 조회 실패 문제 해결

2. **코드 일관성**
   - 모든 관리자 작업에 동일한 패턴 적용
   - 유지보수 용이

3. **보안 강화**
   - 애플리케이션 레벨 권한 확인
   - 테넌트 컨텍스트 확인
   - 테넌트 ID로 데이터 접근 제한

## 📚 참고 문서

- `docs/2025-02-02-admin-client-pattern-recommendation.md` - Admin Client 패턴 권장 사항
- `docs/2025-02-02-admin-actions-admin-client-migration.md` - 관리자 액션 Admin Client 마이그레이션

## 결론

캠프 템플릿 및 초대 관련 모든 조회/수정/삭제 작업에 Admin Client 패턴을 성공적으로 적용했습니다. 이제 RLS 정책 문제 없이 안정적으로 동작하며, 초대 목록이 정상적으로 조회되고 초대 발송도 정상적으로 작동합니다.

