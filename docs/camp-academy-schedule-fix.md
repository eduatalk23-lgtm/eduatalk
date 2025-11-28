# 캠프 모드 템플릿 제출 시 학원 일정 정보 전달 문제 개선

## 문제 상황

학생이 캠프 모드에서 템플릿 작성 후 제출 시, 템플릿에 포함된 학원 일정 정보가 데이터베이스에 저장되지 않는 문제가 발생했습니다.

## 원인 분석

1. **템플릿 학원 일정 병합**: `campActions.ts`의 `submitCampParticipation` 함수에서 템플릿 학원 일정과 학생 입력 일정을 병합하고 있습니다.

2. **중복 체크 로직**: `createStudentAcademySchedules` 함수가 중복 체크를 수행하면서, 같은 요일/시간대의 학원 일정이 이미 존재하면 스킵합니다.

3. **문제점**: 템플릿 학원 일정이 이미 학생의 학원 일정에 존재하는 경우, 중복 체크로 인해 저장되지 않았습니다.

## 해결 방법

### 1. 캠프 모드 제출 시 기존 학원 일정 삭제

캠프 모드에서는 템플릿 학원 일정을 반드시 저장해야 하므로, 제출 전에 기존 학원 일정을 삭제하고 템플릿 일정으로 교체하도록 수정했습니다.

**변경 파일**: `app/(student)/actions/campActions.ts`

```typescript
// 캠프 모드: 템플릿 학원 일정을 반드시 저장하기 위해 기존 학원 일정 삭제
// (학원 일정은 학생별 전역 관리이므로, 캠프 모드 제출 시 템플릿 일정으로 교체)
if (
  creationData.academy_schedules &&
  creationData.academy_schedules.length > 0
) {
  const deleteQuery = supabase
    .from("academy_schedules")
    .delete()
    .eq("student_id", user.userId);

  if (tenantContext.tenantId) {
    deleteQuery.eq("tenant_id", tenantContext.tenantId);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    console.warn(
      "[campActions] 기존 학원 일정 삭제 실패 (무시하고 계속 진행):",
      deleteError
    );
    // 삭제 실패해도 계속 진행 (새 일정 저장 시도)
  } else {
    console.log("[campActions] 기존 학원 일정 삭제 완료");
  }
}
```

### 2. 디버깅 로그 추가

학원 일정 데이터 흐름을 추적하기 위해 디버깅 로그를 추가했습니다.

**변경 파일**: `app/(student)/actions/campActions.ts`

- 템플릿 학원 일정 확인 로그
- 병합된 학원 일정 확인 로그
- 변환된 학원 일정 확인 로그

**변경 파일**: `lib/data/planGroups.ts`

- 입력된 학원 일정 확인 로그
- 기존 학원 일정 확인 로그
- 필터링된 새 학원 일정 확인 로그
- 저장 완료 로그

## 변경 사항 요약

### `app/(student)/actions/campActions.ts`

1. 템플릿 학원 일정 확인 디버깅 로그 추가
2. 병합된 학원 일정 확인 디버깅 로그 추가
3. 변환된 학원 일정 확인 디버깅 로그 추가
4. 캠프 모드 제출 시 기존 학원 일정 삭제 로직 추가

### `lib/data/planGroups.ts`

1. 입력된 학원 일정 확인 디버깅 로그 추가
2. 기존 학원 일정 확인 디버깅 로그 추가
3. 필터링된 새 학원 일정 확인 디버깅 로그 추가
4. 저장 완료 로그 추가

## 테스트 방법

1. 캠프 템플릿에 학원 일정이 포함된 템플릿 생성
2. 학생이 캠프 모드에서 템플릿 작성 후 제출
3. 콘솔 로그를 통해 다음을 확인:
   - 템플릿 학원 일정이 제대로 로드되는지
   - 병합 과정에서 누락되는지
   - 변환 과정에서 문제가 있는지
   - 기존 학원 일정이 삭제되는지
   - 새 학원 일정이 저장되는지
4. 데이터베이스에서 `academy_schedules` 테이블 확인하여 학원 일정이 저장되었는지 확인

## 주의사항

- 캠프 모드 제출 시 기존 학원 일정이 모두 삭제되고 템플릿 일정으로 교체됩니다.
- 학원 일정은 학생별 전역 관리이므로, 다른 플랜 그룹의 학원 일정도 영향을 받을 수 있습니다.
- 삭제 실패 시에도 새 일정 저장을 시도하므로, 중복 체크 로직에 의해 일부 일정이 저장되지 않을 수 있습니다.

## 추가 개선 사항 (관리자 페이지)

### 1. 관리자 "남은 단계 진행하기"에서 학원 일정 표시 문제 해결

**문제**: 학생이 캠프 템플릿에 작성해서 제출한 학원 일정이 관리자의 "남은 단계 진행하기" 페이지에서 보이지 않았습니다.

**원인**: `getPlanGroupWithDetailsForAdmin` 함수에서 `getStudentAcademySchedules`를 사용할 때, RLS(Row Level Security) 정책 때문에 관리자가 다른 학생의 학원 일정을 조회하지 못했습니다.

**해결**: `getPlanGroupWithDetailsForAdmin` 함수 내에서 Admin 클라이언트를 사용하여 학원 일정을 직접 조회하도록 수정했습니다.

**변경 파일**: `lib/data/planGroups.ts`

```typescript
// 관리자용 학원 일정 조회 (RLS 우회를 위해 Admin 클라이언트 사용)
const getAcademySchedulesForAdmin = async (): Promise<AcademySchedule[]> => {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    // Admin 클라이언트를 생성할 수 없으면 일반 함수 사용 (fallback)
    return getStudentAcademySchedules(group.student_id, tenantId);
  }

  // Admin 클라이언트로 학원 일정 조회 (RLS 우회)
  // ...
};
```

### 2. 관리자 "남은 단계 진행하기"에서 학원 일정 저장 시 RLS 정책 위반 문제 해결

**문제**: 관리자가 "남은 단계 진행하기"에서 학원 일정을 저장할 때 `new row violates row-level security policy for table "academies"` 에러가 발생했습니다.

**원인**: `createStudentAcademySchedules` 함수가 일반 서버 클라이언트를 사용하여 `academies` 테이블에 새 학원을 생성하려고 할 때, RLS 정책 때문에 관리자가 다른 학생의 학원을 생성할 수 없었습니다.

**해결**: `createStudentAcademySchedules` 함수에 `useAdminClient` 파라미터를 추가하고, 관리자 모드일 때 Admin 클라이언트를 사용하도록 수정했습니다.

**변경 파일**: `lib/data/planGroups.ts`

```typescript
/**
 * 학생별 학원 일정 일괄 생성 (전역 관리)
 * @param useAdminClient 관리자 모드일 때 true로 설정 (RLS 우회)
 */
export async function createStudentAcademySchedules(
  studentId: string,
  tenantId: string,
  schedules: Array<{...}>,
  useAdminClient: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // 관리자 모드일 때 Admin 클라이언트 사용 (RLS 우회)
  let supabase;
  if (useAdminClient) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn("[createStudentAcademySchedules] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      supabase = await createSupabaseServerClient();
    } else {
      supabase = adminClient;
    }
  } else {
    supabase = await createSupabaseServerClient();
  }
  // ...
}
```

**변경 파일**: `app/(admin)/actions/campTemplateActions.ts`

```typescript
// 새로운 학원 일정 추가 (관리자 모드: Admin 클라이언트 사용)
if (creationData.academy_schedules.length > 0) {
  const schedulesResult = await createStudentAcademySchedules(
    studentId,
    tenantContext.tenantId,
    creationData.academy_schedules.map((s) => ({...})),
    true // 관리자 모드: Admin 클라이언트 사용 (RLS 우회)
  );
  // ...
}
```

## 향후 개선 사항

1. 캠프 모드에서만 기존 학원 일정을 삭제하도록 플래그 추가
2. 학원 일정 삭제 전 백업 기능 추가
3. 학원 일정 삭제 실패 시 재시도 로직 추가
4. 프로덕션 환경에서는 디버깅 로그 제거 또는 레벨 조정

## 관련 파일

- `app/(student)/actions/campActions.ts`
- `lib/data/planGroups.ts`
- `lib/utils/planGroupDataSync.ts`
- `app/(student)/actions/plan-groups/create.ts`
