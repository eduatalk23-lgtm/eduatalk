# 플랜 존재 확인 함수 Admin 지원 추가

## 문제 분석

### 근본 원인
- `_checkPlansExist` 함수가 `requireStudentAuth`만 허용하여 Admin 호출 시 실패
- Admin이 다른 학생의 플랜 그룹에 플랜이 생성되었는지 확인할 때 사용 불가

### 에러 로그
```
[Error] {
  message: '학생 권한이 필요합니다.',
  code: 'UNAUTHORIZED',
  statusCode: 403
}
```

### 문제 흐름
1. Admin 액션에서 `checkPlansExistAction` 호출
2. `_checkPlansExist` 함수에서 `requireStudentAuth` 호출
3. Admin 권한이므로 "학생 권한이 필요합니다" 에러 발생

## 해결 방법

### 근본적인 해결 (구현 완료)

`_checkPlansExist` 함수를 Admin/Consultant도 사용할 수 있도록 수정했습니다. `_generatePlansFromGroup`와 유사한 패턴을 적용했습니다.

## 구현 내용

### 1. Import 추가

```typescript
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
```

### 2. 권한 확인 로직 수정

**변경 사항:**
- `requireStudentAuth` 대신 `getCurrentUser`와 `getCurrentUserRole` 사용
- Admin/Consultant도 허용
- 플랜 그룹의 `student_id`를 사용하여 조회

**주요 코드:**
```typescript
const user = await getCurrentUser();
if (!user) {
  throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
}

// 관리자 또는 컨설턴트 권한도 허용
const { role } = await getCurrentUserRole();
if (user.role !== "student" && role !== "admin" && role !== "consultant") {
  throw new AppError("학생 권한이 필요합니다.", ErrorCode.UNAUTHORIZED, 403, true);
}
```

### 3. 플랜 그룹 student_id 확인

**변경 사항:**
- Admin/Consultant인 경우 플랜 그룹에서 `student_id` 조회
- 학생인 경우 `user.userId` 사용

**주요 코드:**
```typescript
let studentId: string;
if (role === "admin" || role === "consultant") {
  const { getPlanGroupWithDetailsForAdmin } = await import("@/lib/data/planGroups");
  const tenantContext = await getTenantContext();
  const result = await getPlanGroupWithDetailsForAdmin(groupId, tenantContext.tenantId);
  if (!result.group) {
    throw new AppError("플랜 그룹을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }
  studentId = result.group.student_id;
} else {
  studentId = user.userId;
}
```

### 4. Admin 클라이언트 사용

**변경 사항:**
- Admin/Consultant가 다른 학생의 플랜을 조회할 때는 Admin 클라이언트 사용
- RLS 정책 우회

**주요 코드:**
```typescript
const isAdminOrConsultant = role === "admin" || role === "consultant";
const isOtherStudent = isAdminOrConsultant && studentId !== user.userId;
const queryClient = isOtherStudent ? createSupabaseAdminClient() : supabase;

if (isOtherStudent && !queryClient) {
  throw new AppError(
    "Admin 클라이언트를 생성할 수 없습니다. 환경 변수를 확인해주세요.",
    ErrorCode.INTERNAL_ERROR,
    500,
    false
  );
}

const { count, error } = await queryClient
  .from("student_plan")
  .select("*", { count: "exact", head: true })
  .eq("plan_group_id", groupId)
  .eq("student_id", studentId);
```

## 테스트 시나리오

1. ✅ Admin 액션에서 다른 학생의 플랜 존재 확인 성공
2. ✅ 학생 액션에서 자신의 플랜 존재 확인 성공
3. ✅ RLS 정책 우회로 다른 학생의 플랜 조회 성공

## 보안 고려사항

- Admin 클라이언트는 RLS를 우회하므로 보안에 주의
- 다른 학생의 플랜을 조회할 때만 Admin 클라이언트 사용
- 학생이 자신의 플랜을 조회할 때는 일반 서버 클라이언트 사용 (정상적인 RLS 적용)
- 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 함

## 관련 파일

- `app/(student)/actions/plan-groups/queries.ts` - 수정된 함수
- `lib/supabase/admin.ts` - Admin 클라이언트 생성 함수
- `app/(admin)/actions/campTemplateActions.ts` - 호출하는 Admin 액션

## 변경 이력

- 2025-11-26: `_checkPlansExist` 함수에 Admin/Consultant 지원 추가

