# Phase 4: 관리자 및 컨설턴트 모듈 초기 진단

**작성일**: 2025-02-04  
**분석 대상**: `app/(admin)/`, `lib/data/admin/`, `lib/auth/`  
**분석 파일**: `repomix-phase4-admin-consultant.xml` (308 files, 507,536 tokens)

---

## 📋 목차

1. [권한 관리 (Authorization)](#1-권한-관리-authorization)
2. [데이터 접근 및 테넌트 격리 (Data Access & Tenant Isolation)](#2-데이터-접근-및-테넌트-격리-data-access--tenant-isolation)
3. [템플릿 관리 (Template Management)](#3-템플릿-관리-template-management)
4. [레거시 코드 및 개선 사항](#4-레거시-코드-및-개선-사항)
5. [보안 취약점 식별](#5-보안-취약점-식별)
6. [리팩토링 우선순위](#6-리팩토링-우선순위)

---

## 1. 권한 관리 (Authorization)

### 1.1 현재 구현 상태

#### ✅ 잘 구현된 부분

1. **통합 권한 체크 함수**
   - `lib/auth/guards.ts`: `requireAdminOrConsultant()` 함수로 admin, consultant, superadmin 통합 처리
   - `lib/auth/isAdminRole.ts`: 역할 확인 유틸리티 함수 제공

```typescript
// lib/auth/guards.ts
export async function requireAdminOrConsultant(
  options: AdminGuardOptions = {}
): Promise<AdminGuardResult> {
  const { userId, role, tenantId } = await getCurrentUserRole();
  
  if (!isAdminRole(role)) {
    throw new AppError("관리자 또는 컨설턴트 권한이 필요합니다.", ...);
  }
  
  return { userId, role, tenantId };
}
```

2. **역할별 차별화**
   - **컨설턴트**: 본인이 작성한 상담노트만 조회/삭제 가능
   - **관리자**: 모든 상담노트 조회/삭제 가능
   - **학생 삭제**: 관리자만 가능 (컨설턴트 불가)

```typescript
// app/(admin)/admin/consulting/page.tsx
// 본인이 작성한 노트만 조회 (admin은 모든 노트 조회 가능)
if (role !== "admin") {
  query = query.eq("consultant_id", userId);
}
```

```typescript
// app/(admin)/actions/studentManagementActions.ts
// 학생 삭제는 관리자만 가능
const { role } = await requireAdminOrConsultant();
if (role !== "admin") {
  return { success: false, error: "관리자만 학생을 삭제할 수 있습니다." };
}
```

#### ⚠️ 개선 필요 사항

1. **일관성 없는 권한 체크**
   - 일부 액션에서 `requireAdminOrConsultant()` 사용
   - 일부 액션에서 `getCurrentUserRole()` 직접 사용
   - 권한 체크 로직이 분산되어 있음

2. **컨설턴트 권한 범위 불명확**
   - 컨설턴트가 접근할 수 있는 기능과 제한된 기능이 명확히 문서화되지 않음
   - 일부 기능에서 컨설턴트 권한 체크가 누락될 가능성

3. **Super Admin 처리**
   - `isAdminRole()`에서 superadmin도 포함하지만, 일부 기능에서 superadmin 특별 처리 필요
   - 예: `tenantUsers.ts`에서 superadmin은 모든 테넌트 조회 가능

---

## 2. 데이터 접근 및 테넌트 격리 (Data Access & Tenant Isolation)

### 2.1 현재 구현 상태

#### ✅ 잘 구현된 부분

1. **테넌트 컨텍스트 사용**
   - 대부분의 액션에서 `getTenantContext()` 사용하여 테넌트 ID 확인
   - 쿼리에 `.eq("tenant_id", tenantContext.tenantId)` 필터 적용

```typescript
// app/(admin)/actions/studentManagementActions.ts
const tenantContext = await getTenantContext();
if (!tenantContext?.tenantId) {
  return { success: false, error: "기관 정보를 찾을 수 없습니다." };
}

const { data: updatedRows, error } = await supabase
  .from("students")
  .update({ is_active: isActive })
  .eq("id", studentId)
  .eq("tenant_id", tenantContext.tenantId) // ✅ 테넌트 격리
  .select();
```

2. **Super Admin 예외 처리**
   - Super Admin은 모든 테넌트 데이터 조회 가능하도록 명시적 처리

```typescript
// app/(admin)/actions/tenantUsers.ts
// Super Admin이 아니면 현재 기관의 사용자만 조회
const targetTenantId = role === "superadmin" ? null : tenantId;

if (targetTenantId !== null) {
  studentsQuery = studentsQuery.or(`tenant_id.eq.${targetTenantId},tenant_id.is.null`);
}
```

#### ⚠️ 잠재적 취약점

1. **Admin Client 사용 시 테넌트 격리 누락 가능성**
   - `createSupabaseAdminClient()` 사용 시 RLS 우회로 인해 테넌트 필터링이 수동으로 처리되어야 함
   - 일부 액션에서 Admin Client 사용 시 테넌트 필터 누락 가능성

```typescript
// app/(admin)/actions/consultingNoteActions.ts
// Admin Client 사용 시 테넌트 필터가 없음
const supabase = createSupabaseAdminClient();
const { data: note, error: fetchError } = await supabase
  .from("student_consulting_notes")
  .select("consultant_id")
  .eq("id", noteId)
  .eq("student_id", studentId) // ⚠️ student_id만 체크, tenant_id 체크 없음
  .maybeSingle();
```

2. **학생 데이터 조회 시 테넌트 격리 불일치**
   - `lib/data/admin/studentData.ts`에서 `tenantId: null`로 전달하여 테넌트 필터링 우회
   - 관리자용 함수이지만 테넌트 격리가 보장되지 않음

```typescript
// lib/data/admin/studentData.ts
export async function getStudentPlansForAdmin(
  studentId: string,
  dateRange?: { start: string; end: string }
) {
  const filters: Parameters<typeof getPlansForStudent>[0] = {
    studentId,
    tenantId: null, // ⚠️ 테넌트 필터링 우회
  };
  return await getPlansForStudent(filters);
}
```

3. **Cross-Tenant 데이터 접근 위험**
   - `studentId`만으로 조회하는 경우, 다른 테넌트의 학생 데이터에 접근 가능
   - 테넌트 ID 검증이 선행되어야 함

---

## 3. 템플릿 관리 (Template Management)

### 3.1 캠프 템플릿과 PlanGroupWizard 연결

#### ✅ 잘 구현된 부분

1. **공통 위저드 컴포넌트 사용**
   - `CampTemplateEditForm`에서 `PlanGroupWizard` 재사용
   - `WizardData` 타입 공유로 일관성 유지

```typescript
// app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx
<PlanGroupWizard
  initialBlockSets={initialBlockSets}
  initialContents={{ books: [], lectures: [], custom: [] }}
  initialData={{
    ...initialData,
    name: templateName,
    templateId: template.id,
  }}
  isTemplateMode={true}
  onTemplateSave={handleTemplateUpdate}
  onSaveRequest={handleSaveRequest}
/>
```

2. **캠프 템플릿 액션 구조**
   - `campTemplateActions.ts`: 캠프 템플릿 CRUD 및 플랜 그룹 관리
   - `getCampPlanGroupForReview`: 관리자가 학생의 캠프 플랜 그룹을 검토할 수 있는 기능

#### ⚠️ 개선 필요 사항

1. **템플릿 데이터 구조 복잡성**
   - `campTemplateActions.ts`가 5,000+ 라인으로 매우 큼 (37,322 tokens)
   - 단일 책임 원칙 위반 가능성
   - 리팩토링 필요

2. **템플릿과 플랜 그룹 동기화**
   - 템플릿 수정 시 기존 플랜 그룹과의 동기화 로직 불명확
   - 템플릿 버전 관리 부재

---

## 4. 레거시 코드 및 개선 사항

### 4.1 발견된 이슈

1. **중복된 권한 체크 로직**
   - `requireAdminOrConsultant()`와 `getCurrentUserRole()` 직접 사용이 혼재
   - 일관성 있는 권한 체크 패턴 필요

2. **Admin Client 남용**
   - RLS 우회가 필요한 경우에만 사용해야 하지만, 일부 일반 쿼리에서도 사용
   - 테넌트 격리 보장이 어려움

3. **에러 처리 불일치**
   - 일부 액션은 `AppError` 사용
   - 일부 액션은 `{ success: boolean, error?: string }` 반환
   - 통일된 에러 처리 패턴 필요

4. **타입 안전성**
   - 일부 액션에서 `any` 타입 사용 가능성
   - Supabase 응답 타입 명시 부족

---

## 5. 보안 취약점 식별

### 5.1 높은 우선순위

1. **테넌트 격리 누락**
   - `lib/data/admin/studentData.ts`: `tenantId: null`로 전달하여 테넌트 필터링 우회
   - **위험도**: 🔴 높음
   - **영향**: 다른 테넌트의 학생 데이터 접근 가능

2. **Admin Client 사용 시 테넌트 필터 누락**
   - `consultingNoteActions.ts`: 상담노트 조회 시 `student_id`만 체크, `tenant_id` 체크 없음
   - **위험도**: 🟡 중간
   - **영향**: 다른 테넌트의 상담노트 접근 가능

### 5.2 중간 우선순위

1. **권한 체크 일관성 부족**
   - 일부 액션에서 권한 체크 로직이 분산
   - **위험도**: 🟡 중간
   - **영향**: 권한 우회 가능성

2. **컨설턴트 권한 범위 불명확**
   - 컨설턴트가 접근할 수 있는 기능이 명확히 정의되지 않음
   - **위험도**: 🟡 중간
   - **영향**: 권한 오남용 가능성

### 5.3 낮은 우선순위

1. **에러 메시지 정보 노출**
   - 일부 에러 메시지에서 내부 구조 정보 노출 가능
   - **위험도**: 🟢 낮음
   - **영향**: 정보 수집에 도움

---

## 6. 리팩토링 우선순위

### 6.1 Phase 4 리팩토링 계획

#### 🔴 즉시 수정 필요 (보안)

1. **테넌트 격리 강화**
   - `lib/data/admin/studentData.ts`: 테넌트 ID 필터 추가
   - 모든 Admin Client 사용 시 테넌트 필터 검증 추가
   - **예상 작업량**: 2-3일

2. **권한 체크 통일**
   - 모든 액션에서 `requireAdminOrConsultant()` 사용
   - 컨설턴트 권한 범위 명확화
   - **예상 작업량**: 3-5일

#### 🟡 단기 개선 (1-2주)

3. **에러 처리 통일**
   - `AppError` 기반 통일된 에러 처리
   - 타입 안전성 강화
   - **예상 작업량**: 3-5일

4. **캠프 템플릿 액션 리팩토링**
   - `campTemplateActions.ts` 분리 (5,000+ 라인)
   - 단일 책임 원칙 적용
   - **예상 작업량**: 5-7일

#### 🟢 중장기 개선 (1개월 이상)

5. **테넌트 격리 자동화**
   - 미들웨어 레벨에서 테넌트 필터 자동 적용
   - RLS 정책 강화
   - **예상 작업량**: 1-2주

6. **권한 관리 시스템 개선**
   - 역할 기반 접근 제어 (RBAC) 도입
   - 권한 매트릭스 문서화
   - **예상 작업량**: 2-3주

---

## 7. 다음 단계

### 7.1 즉시 조치 사항

1. ✅ **보안 취약점 수정**
   - 테넌트 격리 누락 수정
   - Admin Client 사용 시 테넌트 필터 검증 추가

2. ✅ **권한 체크 통일**
   - 모든 액션에서 `requireAdminOrConsultant()` 사용
   - 컨설턴트 권한 범위 문서화

### 7.2 리팩토링 작업

1. **Phase 4.1: 보안 강화** (1주)
   - 테넌트 격리 수정
   - 권한 체크 통일

2. **Phase 4.2: 코드 품질 개선** (2주)
   - 에러 처리 통일
   - 타입 안전성 강화
   - 캠프 템플릿 액션 리팩토링

3. **Phase 4.3: 아키텍처 개선** (3-4주)
   - 테넌트 격리 자동화
   - 권한 관리 시스템 개선

---

## 8. 참고 자료

- **분석 파일**: `repomix-phase4-admin-consultant.xml`
- **관련 문서**:
  - `docs/architecture/phase3-student-core-summary.md`
  - `docs/rls-bypass-patterns.md`
  - `docs/navigation-critical-improvements.md`

---

**다음 작업**: Phase 4.1 보안 강화 작업 시작

