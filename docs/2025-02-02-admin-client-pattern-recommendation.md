# 관리자 영역 Admin Client 패턴 권장 사항

## 📋 질문

**관리자 영역은 처음부터 Admin Client 패턴을 적용하면 안 되는 이유가 있을까?**

## ✅ 답변: 관리자 영역에서 Admin Client 직접 사용이 더 나은 접근

### 이유

1. **이미 애플리케이션 레벨에서 권한 확인**
   - `requireAdminOrConsultant()`로 권한 확인 완료
   - 테넌트 컨텍스트도 `getTenantContext()`로 확인
   - 보안은 이미 충분히 보장됨

2. **RLS 정책 문제를 사전에 방지**
   - Server Client 사용 시 RLS 정책으로 차단되는 문제가 계속 발생
   - 재시도 로직은 복잡하고 불필요한 오버헤드
   - 처음부터 Admin Client 사용으로 문제 원천 차단

3. **일관성 있는 패턴**
   - 이미 많은 관리자 액션에서 Admin Client 사용 중
   - `subjectActions.ts`: "전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)"
   - `campTemplateActions.ts`: 관리자 작업에서 Admin Client 사용
   - 패턴이 이미 확립되어 있음

4. **성능 및 안정성**
   - 재시도 로직 없이 한 번에 처리
   - 에러 처리 단순화
   - 예측 가능한 동작

## 📊 현재 상태 분석

### 이미 Admin Client를 사용하는 관리자 액션들

| 액션 파일 | 사용 이유 | 패턴 |
|----------|----------|------|
| `subjectActions.ts` | "전역 관리 작업이므로 Admin 클라이언트 사용 (RLS 우회)" | 직접 사용 |
| `campTemplateActions.ts` | 관리자가 다른 학생의 데이터 조회/수정 | 직접 사용 |
| `adminUserActions.ts` | Auth Admin API 사용 필요 | 직접 사용 |
| `unverifiedUserActions.ts` | Auth Admin API 사용 필요 | 직접 사용 |

### Server Client를 사용하는 관리자 액션들 (문제 발생 가능)

| 액션 파일 | 작업 유형 | 문제 발생 가능성 |
|----------|----------|----------------|
| `studentManagementActions.ts` | DELETE, UPDATE | 높음 |
| `parentStudentLinkActions.ts` | DELETE, UPDATE | 높음 |
| `attendanceActions.ts` | UPDATE | 중간 |
| `tenantBlockSets.ts` | DELETE | 중간 |
| `consultingNoteActions.ts` | DELETE | 중간 |

## 🎯 권장 패턴

### 패턴 1: 관리자 액션에서 Admin Client 직접 사용 (권장)

```typescript
export const deleteStudent = withErrorHandling(
  async (studentId: string): Promise<{ success: boolean; error?: string }> => {
    // 1. 권한 확인 (애플리케이션 레벨)
    await requireAdminOrConsultant();
    
    // 2. 테넌트 컨텍스트 확인
    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }
    
    // 3. Admin Client 직접 사용 (RLS 우회)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new AppError(
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }
    
    // 4. 작업 수행
    const { data: deletedRows, error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId)
      .eq("tenant_id", tenantContext.tenantId)
      .select();
    
    if (error) {
      throw new AppError("학생 삭제에 실패했습니다.", ErrorCode.DATABASE_ERROR, 500, true);
    }
    
    if (!deletedRows || deletedRows.length === 0) {
      throw new AppError("학생을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
    }
    
    return { success: true };
  }
);
```

### 패턴 2: 헬퍼 함수 사용 (선택사항)

```typescript
/**
 * 관리자 액션용 Supabase 클라이언트 생성
 * - 권한 확인 및 테넌트 컨텍스트 확인 포함
 * - Admin Client 반환 (RLS 우회)
 */
async function getAdminSupabaseClient() {
  await requireAdminOrConsultant();
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }
  
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new AppError(
      "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
      ErrorCode.INTERNAL_ERROR,
      500,
      true
    );
  }
  
  return { supabase, tenantContext };
}

// 사용 예시
export const deleteStudent = withErrorHandling(
  async (studentId: string): Promise<{ success: boolean; error?: string }> => {
    const { supabase, tenantContext } = await getAdminSupabaseClient();
    
    const { data: deletedRows, error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId)
      .eq("tenant_id", tenantContext.tenantId)
      .select();
    
    // ...
  }
);
```

## 🔒 보안 고려사항

### 이미 충분한 보안 조치

1. **애플리케이션 레벨 권한 확인**
   ```typescript
   await requireAdminOrConsultant(); // 관리자/컨설턴트만 통과
   ```

2. **테넌트 컨텍스트 확인**
   ```typescript
   const tenantContext = await getTenantContext();
   // 테넌트 ID로 데이터 접근 제한
   .eq("tenant_id", tenantContext.tenantId)
   ```

3. **Server Action 보호**
   - `"use server"` 지시어로 서버에서만 실행
   - 클라이언트에서 직접 호출 불가

4. **환경 변수 보호**
   - `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 접근 가능
   - 클라이언트 번들에 포함되지 않음

### 추가 보안 조치 (선택사항)

1. **로깅 강화**
   ```typescript
   console.log("[deleteStudent] 관리자 작업 수행:", {
     adminId: currentUser.userId,
     studentId,
     tenantId: tenantContext.tenantId,
     timestamp: new Date().toISOString(),
   });
   ```

2. **작업 이력 기록**
   - 중요한 작업(삭제, 수정)은 이력 테이블에 기록
   - 감사(audit) 목적

3. **추가 검증**
   - 삭제 전 데이터 존재 확인
   - 삭제 후 결과 확인

## 📝 권장 사항 요약

### ✅ 관리자 영역에서 Admin Client 직접 사용 권장

**이유**:
1. 보안은 이미 애플리케이션 레벨에서 충분히 보장됨
2. RLS 정책 문제를 사전에 방지
3. 코드가 더 단순하고 명확함
4. 기존 패턴과 일관성 유지

**조건**:
1. `requireAdminOrConsultant()`로 권한 확인 필수
2. `getTenantContext()`로 테넌트 컨텍스트 확인 필수
3. 테넌트 ID로 데이터 접근 제한 필수
4. 중요한 작업은 로깅 필수

### ❌ 재시도 패턴은 불필요

**이유**:
1. 복잡성 증가
2. 불필요한 오버헤드
3. 예측 불가능한 동작
4. 에러 처리 복잡화

## 🔄 마이그레이션 계획

### 1단계: 주요 DELETE 작업 수정

- `studentManagementActions.ts` - `deleteStudent()`
- `parentStudentLinkActions.ts` - `removeParentLink()`, `rejectLinkRequest()`
- `subjectActions.ts` - `deleteSubject()` (일부는 이미 수정됨)
- `tenantBlockSets.ts` - 블록 세트 삭제
- `consultingNoteActions.ts` - `deleteConsultingNote()`

### 2단계: 주요 UPDATE 작업 수정

- `studentManagementActions.ts` - `toggleStudentStatus()`, `updateStudentClass()`, `updateStudentInfo()`
- `parentStudentLinkActions.ts` - `updateParentRelation()`, `approveLinkRequest()`
- `subjectActions.ts` - `updateSubject()` (일부는 이미 수정됨)
- `attendanceActions.ts` - 출석 기록 수정

### 3단계: 헬퍼 함수 생성 (선택사항)

- `getAdminSupabaseClient()` 헬퍼 함수 생성
- 공통 패턴 추출

## 📚 참고 사항

### 기존 문서

- `docs/2025-12-05-캠프-관리자-RLS-우회-수정.md` - 관리자 작업에서 Admin Client 사용 사례
- `docs/rls-bypass-patterns.md` - RLS 우회 패턴 가이드
- `docs/2025-02-02-admin-actions-rls-policy-review.md` - RLS 정책 문제 검토

### Supabase 문서

- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Service Role Key](https://supabase.com/docs/guides/api/service-role-key)

## 결론

**관리자 영역에서는 처음부터 Admin Client를 사용하는 것이 더 나은 접근입니다.**

- 보안은 이미 충분히 보장됨
- RLS 정책 문제를 사전에 방지
- 코드가 더 단순하고 명확함
- 기존 패턴과 일관성 유지

재시도 패턴은 불필요하며, 오히려 복잡성만 증가시킵니다.

