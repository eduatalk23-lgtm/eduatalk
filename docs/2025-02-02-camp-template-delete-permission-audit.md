# 캠프 템플릿 삭제 권한 및 로직 점검 결과

## 📋 점검 개요

**점검 일시**: 2025-02-02  
**점검 대상**: `/admin/camp-templates` 페이지의 캠프 템플릿 삭제 기능  
**점검 목적**: 관리자의 캠프 템플릿 삭제 관련 권한 체크 및 로직 안전성 검증

---

## ✅ 권한 체크 현황

### 1. 페이지 레벨 권한 체크

**파일**: `app/(admin)/admin/camp-templates/page.tsx`

```typescript
const { role } = await getCurrentUserRole();
if (role !== "admin" && role !== "consultant") {
  redirect("/login");
}
```

**평가**: ✅ **적절함**
- `admin` 또는 `consultant` 역할만 접근 가능
- 권한이 없는 사용자는 로그인 페이지로 리다이렉트

---

### 2. 삭제 액션 권한 체크

**파일**: `app/(admin)/actions/campTemplateActions.ts`  
**함수**: `deleteCampTemplateAction`

#### 2.1 역할 기반 권한 체크

```typescript
// 권한 검증
await requireAdminOrConsultant();
```

**평가**: ✅ **적절함**
- `requireAdminOrConsultant()` 함수가 `admin`, `consultant`, `superadmin` 역할만 허용
- 로그인하지 않은 사용자 또는 권한이 없는 사용자는 401/403 에러 발생

#### 2.2 Tenant 기반 권한 체크

```typescript
const tenantContext = await getTenantContext();
if (!tenantContext?.tenantId) {
  throw new AppError(
    "기관 정보를 찾을 수 없습니다.",
    ErrorCode.NOT_FOUND,
    404,
    true
  );
}

// 템플릿 존재 및 권한 확인 (강화된 검증)
const template = await getCampTemplate(templateId);
if (!template) {
  throw new AppError(
    "템플릿을 찾을 수 없습니다.",
    ErrorCode.NOT_FOUND,
    404,
    true
  );
}

if (template.tenant_id !== tenantContext.tenantId) {
  throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
}
```

**평가**: ✅ **적절함**
- Tenant 컨텍스트 확인
- 템플릿 존재 여부 확인
- 템플릿의 `tenant_id`와 현재 사용자의 `tenant_id` 비교
- 다른 기관의 템플릿 삭제 시도 시 403 에러 발생

#### 2.3 DB 쿼리 레벨 권한 체크

```typescript
const supabase = await createSupabaseServerClient();
const { error } = await supabase
  .from("camp_templates")
  .delete()
  .eq("id", templateId)
  .eq("tenant_id", tenantContext.tenantId);
```

**평가**: ✅ **방어적 프로그래밍 적용**
- DB 쿼리에서도 `tenant_id` 필터링 적용
- 이중 체크로 보안 강화
- RLS(Row Level Security)와 함께 다층 방어 구조

---

## 🔍 로직 안전성 검증

### 1. 입력값 검증

```typescript
// 입력값 검증
if (!templateId || typeof templateId !== "string") {
  throw new AppError(
    "템플릿 ID가 올바르지 않습니다.",
    ErrorCode.VALIDATION_ERROR,
    400,
    true
  );
}
```

**평가**: ✅ **적절함**
- `templateId` 타입 및 존재 여부 검증
- 잘못된 입력값에 대한 명확한 에러 메시지

---

### 2. 관련 데이터 삭제 처리

```typescript
// 템플릿 삭제 전에 관련된 플랜 그룹 삭제
const { deletePlanGroupsByTemplateId } = await import(
  "@/lib/data/planGroups"
);
const planGroupResult = await deletePlanGroupsByTemplateId(templateId);
```

**평가**: ⚠️ **개선 필요**

**현재 상태**:
- `deletePlanGroupsByTemplateId` 함수가 `tenant_id` 체크 없이 플랜 그룹 삭제
- 함수 내부에서 `camp_template_id`로만 필터링하여 조회

**잠재적 위험**:
- 이론적으로 다른 tenant의 플랜 그룹을 삭제할 가능성 (RLS로 보호되지만 명시적 체크 권장)
- 함수가 직접 호출될 경우 tenant_id 검증 누락

**권장 개선 사항**:
1. `deletePlanGroupsByTemplateId` 함수에 `tenantId` 파라미터 추가
2. 플랜 그룹 조회 시 `tenant_id` 필터링 추가
3. 템플릿의 `tenant_id`와 일치하는 플랜 그룹만 삭제

---

### 3. 에러 처리

```typescript
if (!planGroupResult.success) {
  console.error(
    "[campTemplateActions] 플랜 그룹 삭제 실패",
    planGroupResult.error
  );
  // 플랜 그룹 삭제 실패해도 템플릿 삭제는 계속 진행
  console.warn(
    "[campTemplateActions] 플랜 그룹 삭제 실패했지만 템플릿 삭제는 계속 진행합니다."
  );
}
```

**평가**: ⚠️ **주의 필요**

**현재 동작**:
- 플랜 그룹 삭제 실패 시에도 템플릿 삭제는 계속 진행
- 데이터 정합성 문제 가능성

**권장 개선 사항**:
- 플랜 그룹 삭제 실패 시 템플릿 삭제를 중단할지, 계속 진행할지 비즈니스 로직 결정 필요
- 현재는 "계속 진행" 방식이지만, 데이터 정합성을 위해 트랜잭션 처리 고려

---

## 📊 종합 평가

### ✅ 강점

1. **다층 권한 체크**: 역할 기반 → Tenant 기반 → DB 쿼리 레벨
2. **방어적 프로그래밍**: DB 쿼리에서도 `tenant_id` 필터링 적용
3. **명확한 에러 메시지**: 각 단계별 적절한 에러 메시지 제공
4. **입력값 검증**: 타입 및 존재 여부 검증 완료

### ⚠️ 개선 권장 사항

1. **플랜 그룹 삭제 함수 개선**
   - `deletePlanGroupsByTemplateId`에 `tenantId` 파라미터 추가
   - 플랜 그룹 조회 시 `tenant_id` 필터링 추가

2. **일관성 개선**
   - `validateCampTemplateAccess` 헬퍼 함수 사용 권장 (현재는 직접 체크)
   - 다른 액션들과 일관된 패턴 유지

3. **에러 처리 정책 명확화**
   - 플랜 그룹 삭제 실패 시 처리 정책 결정
   - 트랜잭션 처리 고려

---

## 🔧 권장 수정 사항

### 1. `deletePlanGroupsByTemplateId` 함수 개선

**현재 코드**:
```typescript
export async function deletePlanGroupsByTemplateId(
  templateId: string
): Promise<{ success: boolean; error?: string; deletedGroupIds?: string[] }> {
  const supabase = await createSupabaseServerClient();

  // 1. camp_template_id로 플랜 그룹 조회 (여러 개일 수 있음)
  const { data: planGroups, error: fetchError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .is("deleted_at", null);
  // ...
}
```

**개선 제안**:
```typescript
export async function deletePlanGroupsByTemplateId(
  templateId: string,
  tenantId: string  // 추가
): Promise<{ success: boolean; error?: string; deletedGroupIds?: string[] }> {
  const supabase = await createSupabaseServerClient();

  // 1. camp_template_id와 tenant_id로 플랜 그룹 조회
  const { data: planGroups, error: fetchError } = await supabase
    .from("plan_groups")
    .select("id, student_id")
    .eq("camp_template_id", templateId)
    .eq("tenant_id", tenantId)  // 추가
    .is("deleted_at", null);
  // ...
}
```

**호출부 수정**:
```typescript
const planGroupResult = await deletePlanGroupsByTemplateId(
  templateId,
  tenantContext.tenantId  // 추가
);
```

### 2. `deleteCampTemplateAction` 일관성 개선

**현재 코드**:
```typescript
// 템플릿 존재 및 권한 확인 (강화된 검증)
const template = await getCampTemplate(templateId);
if (!template) {
  throw new AppError(/* ... */);
}

if (template.tenant_id !== tenantContext.tenantId) {
  throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
}
```

**개선 제안**:
```typescript
// 템플릿 존재 및 권한 확인 (헬퍼 함수 사용)
await validateCampTemplateAccess(templateId, tenantContext.tenantId);
```

---

## 📝 결론

### 전반적 평가: ✅ **안전함**

캠프 템플릿 삭제 기능의 권한 체크는 **다층 방어 구조**로 잘 구현되어 있습니다:

1. ✅ 페이지 레벨: 역할 기반 접근 제어
2. ✅ 액션 레벨: 역할 + Tenant 기반 권한 체크
3. ✅ DB 쿼리 레벨: `tenant_id` 필터링

### 개선 우선순위

1. **높음**: `deletePlanGroupsByTemplateId`에 `tenantId` 파라미터 추가
2. **중간**: `validateCampTemplateAccess` 헬퍼 함수 사용으로 일관성 개선
3. **낮음**: 플랜 그룹 삭제 실패 시 처리 정책 명확화

---

## 🔗 관련 파일

- `app/(admin)/admin/camp-templates/page.tsx` - 페이지 레벨 권한 체크
- `app/(admin)/actions/campTemplateActions.ts` - 삭제 액션
- `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx` - 삭제 UI
- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx` - 상세 페이지 삭제
- `lib/auth/guards.ts` - `requireAdminOrConsultant` 함수
- `lib/validation/campValidation.ts` - `validateCampTemplateAccess` 함수
- `lib/data/planGroups.ts` - `deletePlanGroupsByTemplateId` 함수

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰 권장




