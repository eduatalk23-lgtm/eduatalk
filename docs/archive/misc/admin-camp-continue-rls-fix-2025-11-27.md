# 관리자 페이지 '남은 단계 진행하기' RLS 문제 해결

## 🔍 문제 상황

관리자/컨설턴트가 '남은 단계 진행하기'에서 학생의 추가 콘텐츠 정보를 조회할 때 RLS(Row Level Security) 정책 때문에 조회가 실패하는 문제가 발생했습니다.

### 근본 원인

`classifyPlanContents` 함수에서 일반 서버 클라이언트(`createSupabaseServerClient`)만 사용하고 있어서, 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때 RLS 정책에 막혔습니다.

### 이전 해결 방법

이전에도 동일한 문제가 있었고, 컨설턴트/관리자 권한으로 검색 및 플랜 생성 시 Admin 클라이언트를 사용하도록 해결했습니다. 하지만 `classifyPlanContents` 함수에는 적용되지 않았습니다.

## 🛠 해결 방법

### 수정 내용

#### 1. `classifyPlanContents` 함수에 Admin 클라이언트 지원 추가

**파일**: `lib/data/planContents.ts`

관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때 Admin 클라이언트를 사용하도록 수정했습니다.

**변경 전**:
```typescript
export async function classifyPlanContents(
  contents: Array<{...}>,
  studentId: string
): Promise<{...}> {
  const supabase = await createSupabaseServerClient();
  // ...
}
```

**변경 후**:
```typescript
export async function classifyPlanContents(
  contents: Array<{...}>,
  studentId: string,
  options?: {
    currentUserRole?: "student" | "admin" | "consultant" | "parent";
    currentUserId?: string;
  }
): Promise<{...}> {
  // 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 Admin 클라이언트 사용 (RLS 우회)
  const isAdminOrConsultant = options?.currentUserRole === "admin" || options?.currentUserRole === "consultant";
  const isOtherStudent = isAdminOrConsultant && options?.currentUserId && studentId !== options.currentUserId;
  
  let supabase: SupabaseServerClient;
  if (isOtherStudent) {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn("[classifyPlanContents] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      supabase = await createSupabaseServerClient();
    } else {
      supabase = adminClient as any; // Admin 클라이언트를 SupabaseServerClient 타입으로 사용
    }
  } else {
    supabase = await createSupabaseServerClient();
  }
  // ...
}
```

#### 2. Admin 클라이언트 Import 추가

```typescript
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
```

#### 3. 관리자/컨설턴트 호출부 수정

**파일**: `app/(admin)/actions/campTemplateActions.ts`

`getCampPlanGroupForReview` 함수에서 역할 정보를 전달하도록 수정했습니다.

**변경 전**:
```typescript
const { studentContents, recommendedContents } =
  await classifyPlanContents(result.contents, result.group.student_id);
```

**변경 후**:
```typescript
// 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 역할 정보 전달 (RLS 우회)
const { userId } = await getCurrentUserRole();
const { studentContents, recommendedContents } =
  await classifyPlanContents(result.contents, result.group.student_id, {
    currentUserRole: role,
    currentUserId: userId || undefined,
  });
```

#### 4. `continue/page.tsx` 수정

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

역할 정보를 전달하도록 수정했습니다.

**변경 전**:
```typescript
const { studentContents: classifiedStudentContents, recommendedContents: classifiedRecommendedContents } = 
  await classifyPlanContents(contentsForClassification, studentId);
```

**변경 후**:
```typescript
// 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 역할 정보 전달 (RLS 우회)
const { userId } = await getCurrentUserRole();
const { studentContents: classifiedStudentContents, recommendedContents: classifiedRecommendedContents } = 
  await classifyPlanContents(contentsForClassification, studentId, {
    currentUserRole: role,
    currentUserId: userId || undefined,
  });
```

#### 5. `admin/plan-groups/[id]/page.tsx` 수정

**파일**: `app/(admin)/admin/plan-groups/[id]/page.tsx`

역할 정보를 전달하도록 수정했습니다.

**변경 후**:
```typescript
// 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 역할 정보 전달 (RLS 우회)
const { userId } = await getCurrentUserRole();
const { studentContents, recommendedContents } = await classifyPlanContents(
  contents,
  group.student_id,
  {
    currentUserRole: role,
    currentUserId: userId || undefined,
  }
);
```

## 📊 변경 사항 요약

### 클라이언트 선택 로직

**조건**:
- 관리자 또는 컨설턴트인가?
- 다른 학생의 콘텐츠를 조회하는가? (`studentId !== currentUserId`)

**결과**:
- 조건을 만족하면 → Admin 클라이언트 사용 (RLS 우회)
- 그렇지 않으면 → 일반 서버 클라이언트 사용

### 효과

- ✅ 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때 RLS 정책 우회
- ✅ 학생이 자신의 콘텐츠를 조회할 때는 일반 클라이언트 사용 (보안 유지)
- ✅ 기존 학생 페이지 동작에 영향 없음 (옵셔널 파라미터 사용)

## ✅ 검증 완료

- [x] `classifyPlanContents` 함수에 Admin 클라이언트 지원 추가
- [x] 관리자/컨설턴트 호출부에서 역할 정보 전달
- [x] 학생 호출부는 기존 동작 유지 (옵셔널 파라미터)
- [x] 린터 오류 없음

## 📝 참고

### 관련 이전 수정 사항

이전에도 동일한 RLS 문제를 해결한 사례들이 있습니다:

1. **플랜 생성 시 교재 조회 RLS 문제**
   - 문서: `docs/plan-generation-book-query-rls-fix.md`
   - `_generatePlansFromGroup` 함수에서 Admin 클라이언트 사용

2. **Step 7 스케줄 확인 RLS 문제**
   - 문서: `docs/step7-schedule-result-rls-fix.md`
   - `_getScheduleResultData` 함수에서 Admin 클라이언트 사용

3. **플랜 미리보기 Admin 지원**
   - 문서: `docs/plan-preview-admin-support.md`
   - Admin/Consultant가 다른 학생의 플랜을 미리볼 때 Admin 클라이언트 사용

### RLS 정책

Supabase의 RLS 정책은 일반적으로 사용자가 자신의 데이터만 조회할 수 있도록 제한합니다. 관리자/컨설턴트가 다른 학생의 데이터를 조회하려면:

1. Service Role Key를 사용한 Admin 클라이언트 사용 (RLS 우회)
2. 또는 RLS 정책에 관리자/컨설턴트 권한 예외 추가

이번 수정에서는 1번 방법을 사용했습니다.

## 🔄 이번 수정과 함께 작동하는 수정 사항

1. **원본 데이터 전달 개선** (`docs/admin-camp-continue-student-content-fix-2025-11-27.md`)
   - `originalContents`를 별도로 반환하여 `master_content_id` 정보 전달

2. **content_id가 마스터 ID인 경우 처리** (`docs/admin-camp-continue-content-id-as-master-fix-2025-11-27.md`)
   - `content_id` 자체도 마스터 콘텐츠 조회 대상에 포함

3. **RLS 문제 해결** (이번 수정)
   - 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때 Admin 클라이언트 사용

세 가지 수정이 함께 작동하여 더 안정적이고 정확한 콘텐츠 조회를 보장합니다.

