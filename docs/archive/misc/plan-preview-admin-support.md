# 플랜 미리보기 함수 Admin 지원 추가

## 문제 분석

### 근본 원인
- `_previewPlansFromGroup` 함수가 학생 권한만 허용하여 Admin 호출 시 실패
- Admin이 다른 학생의 플랜 그룹을 미리볼 때 사용 불가

### 에러 로그
```
[Error] {
  message: '로그인이 필요합니다.',
  code: 'UNAUTHORIZED',
  statusCode: 401
}
```

### 문제 흐름
1. Admin 액션에서 `previewPlansFromGroupAction` 호출
2. `_previewPlansFromGroup` 함수에서 `user.role !== "student"` 체크
3. Admin 권한이므로 "로그인이 필요합니다" 에러 발생

## 해결 방법

### 근본적인 해결 (구현 완료)

`_previewPlansFromGroup` 함수를 Admin/Consultant도 사용할 수 있도록 수정했습니다. `_generatePlansFromGroup`와 유사한 패턴을 적용했습니다.

## 구현 내용

### 1. 권한 확인 로직 수정

**변경 사항:**
- `user.role !== "student"` 체크를 `getCurrentUserRole` 사용으로 변경
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

### 2. 플랜 그룹 조회 로직 수정

**변경 사항:**
- Admin/Consultant인 경우 `getPlanGroupWithDetailsForAdmin` 사용
- 학생인 경우 `getPlanGroupWithDetails` 사용

**주요 코드:**
```typescript
let group, contents, exclusions, academySchedules;
if (role === "admin" || role === "consultant") {
  const { getPlanGroupWithDetailsForAdmin } = await import("@/lib/data/planGroups");
  const result = await getPlanGroupWithDetailsForAdmin(groupId, tenantContext.tenantId);
  group = result.group;
  contents = result.contents;
  exclusions = result.exclusions;
  academySchedules = result.academySchedules;
} else {
  const result = await getPlanGroupWithDetails(groupId, user.userId);
  group = result.group;
  contents = result.contents;
  exclusions = result.exclusions;
  academySchedules = result.academySchedules;
}
```

### 3. studentId 변수 추가

**변경 사항:**
- Admin/Consultant인 경우 플랜 그룹의 `student_id` 사용
- 학생인 경우 `user.userId` 사용

**주요 코드:**
```typescript
const studentId = (role === "admin" || role === "consultant") ? group.student_id : user.userId;
```

### 4. Admin 클라이언트 사용

**변경 사항:**
- Admin/Consultant가 다른 학생의 콘텐츠를 조회할 때는 Admin 클라이언트 사용
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
```

### 5. 모든 콘텐츠 조회 로직 수정

**변경 사항:**
- 교재, 강의, 커스텀 콘텐츠 조회 시 `queryClient` 사용
- `user.userId` 대신 `studentId` 사용

**수정된 부분:**
- 마스터 콘텐츠 매핑 시 교재/강의 조회
- 콘텐츠 duration 조회 시 교재/강의/커스텀 콘텐츠 조회
- 콘텐츠 메타데이터 조회 시 교재/강의/커스텀 콘텐츠 조회

## 테스트 시나리오

1. ✅ Admin 액션에서 다른 학생의 플랜 미리보기 성공
2. ✅ 학생 액션에서 자신의 플랜 미리보기 성공
3. ✅ RLS 정책 우회로 다른 학생의 콘텐츠 조회 성공

## 보안 고려사항

- Admin 클라이언트는 RLS를 우회하므로 보안에 주의
- 다른 학생의 콘텐츠를 조회할 때만 Admin 클라이언트 사용
- 학생이 자신의 콘텐츠를 조회할 때는 일반 서버 클라이언트 사용 (정상적인 RLS 적용)
- 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 함

## 관련 파일

- `app/(student)/actions/plan-groups/plans.ts` - 수정된 함수
- `lib/supabase/admin.ts` - Admin 클라이언트 생성 함수
- `app/(admin)/actions/campTemplateActions.ts` - 호출하는 Admin 액션

## 변경 이력

- 2025-11-26: `_previewPlansFromGroup` 함수에 Admin/Consultant 지원 추가

