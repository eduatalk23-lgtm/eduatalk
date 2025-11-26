# Step 7 스케줄 확인 교과 과목 이름 학습내역 RLS 문제 해결

## 문제 분석

### 근본 원인
- `_getScheduleResultData` 함수에서 Admin이 다른 학생의 데이터를 조회할 때 일반 서버 클라이언트 사용
- RLS 정책 때문에 교재, 강의, 커스텀 콘텐츠, 블록 데이터 조회 실패
- 교과 과목 이름과 학습내역이 제대로 표시되지 않음

### 영향 범위
- Step 7 스케줄 확인 화면에서 교과 과목 이름이 표시되지 않음
- 학습내역(콘텐츠 제목, 과목, 과목 카테고리)이 표시되지 않음
- Admin이 다른 학생의 플랜 그룹을 확인할 때 발생

## 해결 방법

### 근본적인 해결 (구현 완료)

`_getScheduleResultData` 함수에서 Admin/Consultant가 다른 학생의 데이터를 조회할 때는 Admin 클라이언트를 사용하도록 수정했습니다.

## 구현 내용

### 1. 플랜 그룹 조회 클라이언트 수정

**변경 사항:**
- Admin/Consultant인 경우 플랜 그룹 조회 시 Admin 클라이언트 사용
- RLS 정책 우회

**주요 코드:**
```typescript
// Admin/Consultant가 다른 학생의 데이터를 조회할 때는 Admin 클라이언트 사용
const isAdminOrConsultant = userRole.role === "admin" || userRole.role === "consultant";
const groupQueryClient = isAdminOrConsultant ? createSupabaseAdminClient() : supabase;

if (isAdminOrConsultant && !groupQueryClient) {
  throw new AppError(
    "Admin 클라이언트를 생성할 수 없습니다. 환경 변수를 확인해주세요.",
    ErrorCode.INTERNAL_ERROR,
    500,
    false
  );
}
```

### 2. 플랜 조회 클라이언트 수정

**변경 사항:**
- Admin/Consultant가 다른 학생의 플랜을 조회할 때는 Admin 클라이언트 사용
- `queryClient` 변수로 동적 결정

**주요 코드:**
```typescript
const isOtherStudent = isAdminOrConsultant && targetStudentId !== userRole.userId;
const queryClient = isOtherStudent ? createSupabaseAdminClient() : supabase;

const { data: plans, error: plansError } = await queryClient
  .from("student_plan")
  .select(...)
  .eq("plan_group_id", groupId)
  .eq("student_id", targetStudentId);
```

### 3. 교재 조회 클라이언트 수정

**변경 사항:**
- 교재 조회 시 `queryClient` 사용
- `supabase` 대신 `queryClient` 사용

**주요 코드:**
```typescript
if (bookIds.length > 0) {
  const { data: books } = await queryClient
    .from("books")
    .select("id, title, subject, subject_category, total_pages")
    .in("id", bookIds)
    .eq("student_id", targetStudentId);
}
```

### 4. 강의 조회 클라이언트 수정

동일한 방식으로 강의 조회도 `queryClient` 사용하도록 수정했습니다.

### 5. 커스텀 콘텐츠 조회 클라이언트 수정

동일한 방식으로 커스텀 콘텐츠 조회도 `queryClient` 사용하도록 수정했습니다.

### 6. 블록 조회 클라이언트 수정

동일한 방식으로 블록 조회도 `queryClient` 사용하도록 수정했습니다.

## 테스트 시나리오

1. ✅ Admin 액션에서 다른 학생의 스케줄 확인 시 교과 과목 이름 표시 확인
2. ✅ Admin 액션에서 다른 학생의 스케줄 확인 시 학습내역 표시 확인
3. ✅ 학생 액션에서 자신의 스케줄 확인 시 정상 표시 확인
4. ✅ RLS 정책 우회로 다른 학생의 콘텐츠 조회 성공 확인

## 보안 고려사항

- Admin 클라이언트는 RLS를 우회하므로 보안에 주의
- 다른 학생의 데이터를 조회할 때만 Admin 클라이언트 사용
- 학생이 자신의 데이터를 조회할 때는 일반 서버 클라이언트 사용 (정상적인 RLS 적용)
- 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 함

## 관련 파일

- `app/(student)/actions/plan-groups/queries.ts` - 수정된 함수
- `lib/supabase/admin.ts` - Admin 클라이언트 생성 함수
- `app/(admin)/actions/campTemplateActions.ts` - 호출하는 Admin 액션
- `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx` - Step 7 컴포넌트

## 변경 이력

- 2025-11-26: Step 7 스케줄 확인에서 교과 과목 이름 및 학습내역 표시 문제 해결을 위해 Admin 클라이언트 사용으로 변경

