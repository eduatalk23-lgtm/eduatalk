# EduaTalk 비즈니스 로직 개선 권장사항

> 작성일: 2024-12-24
> 버전: 1.1
> 기준 문서: docs/business-logic-analysis.md
> **완료일: 2024-12-24** ✅

---

## 구현 완료 요약

| 우선순위 | 상태 | 커밋 | 주요 내용 |
|---------|------|------|----------|
| **P0** Critical | ✅ 완료 | `f23d4bbf` | 플랜 상태 전환 검증, RLS 정책 강화, 테넌트 격리 |
| **P1** High | ✅ 완료 | `647f7d43` | 성적→플랜 연동, N+1 해결, 캐시 전략, 에러 분석 |
| **P2** Medium | ✅ 완료 | `bc0e8f55` | 블록-학원 겹침 검증, Realtime 확장, 인덱스 최적화 |
| **P3** Low | ✅ 완료 | `98226d80` | 진행률 시스템, 로딩 컴포넌트, JSDoc, Query 키 정리 |
| **UX** 개선 | ✅ 완료 | `af091624` | 에러 필드 강조, 저장 상태 표시, Step 7 에러 복구 |

---

## 요약

현재 코드베이스는 **구조적으로 잘 설계되었으나** 다음 영역의 강화가 필수:

1. **데이터 무결성**: 상태 전환, 권한 검증, 테넌트 격리
2. **성능**: N+1 제거, 캐싱, 인덱스
3. **UX**: 에러 원인 분석, 단계별 진행률, 복구 가이드
4. **유지보수성**: 데이터 레이어 통합, 검증 추상화

---

## 1. 아키텍처 & 코드 구조

### P0-Critical: 데이터 레이어 중복 제거

**현황:**
- `lib/data/` 50개 파일과 `lib/domains/*/repository.ts` 중복 존재
- 플랜 조회: `lib/data/planGroups.ts`, `lib/data/studentPlans.ts`, `lib/data/todayPlans.ts`와 `lib/domains/plan/repository.ts` 중복
- 학생 정보 조회: `lib/data/students.ts`와 도메인 레이어 중복

**문제점:**
- 같은 쿼리가 여러 곳에서 구현되어 유지보수 어려움
- 스키마 변경 시 모든 데이터 레이어 수정 필요
- 버전 불일치로 인한 버그 발생 가능

**권장사항:**
```
1. lib/data/* → lib/domains/*/repository.ts로 통합
2. 도메인별 Repository 패턴 확립:
   - lib/domains/{domain}/repository.ts (데이터 접근)
   - lib/domains/{domain}/service.ts (비즈니스 로직)
   - lib/domains/{domain}/actions/ (Server Actions)
3. lib/data/는 점진적으로 deprecate하고 도메인 기반 구조로 마이그레이션
```

**예상 작업량:** 8-12주
**우선 대상 도메인:** Plan → Score → Attendance → Student

---

### P1-High: 검증 레이어 추상화 부재

**현황:**
- 검증 로직이 Action과 Service에 산재 분포
- Plan 그룹 생성: `generatePlansRefactored.ts` (검증 포함) vs `actions/plan-groups/create.ts` (중복 검증)
- Score 생성: `actions/core.ts`에서 FormData 파싱 후 검증

**문제점:**
- 공통 검증 로직 누락 → 불일치 가능성
- 단위 테스트 어려움
- 클라이언트/서버 검증 불동기

**권장사항:**
```typescript
// lib/domains/{domain}/validators.ts 신규 생성
export async function validatePlanGroupCreation(
  data: PlanGroupCreationData
): Promise<ValidationResult>

// 검증 규칙:
// - 필수 필드: student_id, period_start, period_end
// - 기간 유효성: start < end
// - 기간 충돌 검사 (동일 학생의 활성 플랜)
// - 블록 세트 존재 여부
// - 제외일 중복 검사
```

**우선 대상:** Plan, Score, Attendance

---

## 2. 데이터 흐름 & 성능

### P0-Critical: N+1 쿼리 패턴 (부분적 미해결)

**현황:**
- 대부분 배치 처리로 해결됨
- 일부 여전히 미해결:
  - Parent 도메인: 부모-학생 연결 조회 시 각 부모별 학생 수를 별도로 계산
  - Score 조회: 과목별 점수 상세 조회 시 각 과목마다 별도 쿼리

**문제 예시:**
```typescript
// lib/domains/parent/actions/linkRequests.ts
for (const request of pendingRequests) {
  const student = await getStudentById(request.student_id); // N+1!
}
```

**권장사항:**
```typescript
// 개선된 쿼리:
const { data } = await supabase
  .from('parent_student_links')
  .select(`
    *,
    students(id, name, grade, class)
  `)
  .eq('is_approved', false)
  .eq('tenant_id', tenantId);
```

---

### P1-High: 캐시 전략 부재

**현황:**
- React Query 사용하나 일부 고비용 쿼리에 캐싱 전략 없음
- `getMergedSchedulerSettings()` → 테넌트 설정 반복 조회
- 어려운 설정 데이터: 매번 DB 조회

**권장사항:**
```typescript
// 캐시 레이어 강화
export const QUERY_KEYS = {
  tenantSettings: (tenantId: string) => ['tenant', tenantId, 'settings'],
  blockSets: (studentId: string) => ['blocksets', studentId],
  scheduleSettings: (tenantId: string) => ['schedule-settings', tenantId],
};

// 캐시 시간:
// - 테넌트 설정: 5분
// - 블록 세트: 30분
// - 스케줄 설정: 10분
```

**우선 대상:**
1. `getMergedSchedulerSettings()`
2. `getBlockSetForPlanGroup()`
3. `getPlanGroupsForStudent()` (대시보드)

---

### P2-Medium: 실시간 기능 제한적

**현황:**
- Supabase Realtime 구현 매우 제한적 (4개만 사용)
- 출석 기록만 실시간 동기화
- 플랜 진행률은 주기적 폴링에 의존

**권장사항:**
```typescript
// 필요한 실시간 채널:
1. student_plan 업데이트 → 진행률 실시간 반영
2. attendance_records → 출석 통계 실시간 업데이트
3. plan_groups 상태 변경 → 대시보드 자동 반영
4. student_content_progress → 콘텐츠 진행률 실시간

// 구현 예시:
supabase
  .channel(`student_plans:${studentId}`)
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'student_plan',
      filter: `student_id=eq.${studentId}` },
    (payload) => updateProgress(payload.new)
  )
  .subscribe();
```

---

## 3. 비즈니스 로직 갭

### P0-Critical: 플랜 상태 전환 검증 부재

**현황:**
- 문서상 상태: `draft → saved → active → paused/completed/cancelled`
- 실제 코드: 상태 전환 규칙 검증 없음

**문제점:**
```typescript
// 예: draft → active로 직접 전환 가능 (saved 건너뜀)
await updatePlanGroup(groupId, { status: 'active' }); // 검증 없음

// 예: active → draft로 역전 가능 (규칙 위반)
```

**권장사항:**
```typescript
// lib/domains/plan/validators.ts
const STATE_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  draft: ['saved'],           // draft → saved만 가능
  saved: ['active', 'draft'], // saved → active 또는 draft로 revert
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],              // 종료 상태, 전환 불가
  cancelled: [],
};

export function validateStatusTransition(
  currentStatus: PlanStatus,
  newStatus: PlanStatus
): boolean {
  return STATE_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}
```

**영향 범위:** Plan 도메인 전체

---

### P1-High: 성적 입력 후 플랜 재생성 부재

**현황:**
- 비즈니스 로직: "성적 입력 → 약점 과목 분석 → 맞춤형 학습 경로 자동 제안"
- 실제 구현: 성적 저장만 수행, 플랜 재생성 없음

**문제점:**
```typescript
// lib/domains/score/actions/core.ts
async function _createMockScore(formData) {
  await createMockScoreData(data);
  revalidatePath('/scores'); // 플랜 재생성 없음
}
```

**권장사항:**
```typescript
export async function createMockScoreAction(formData: FormData) {
  const score = await createMockScore(formData);

  // 1. 약점/강점 분석
  const analysis = analyzeScoreWeaknesses(score);

  // 2. 기존 활성 플랜이 있으면 제안 알림
  const existingPlans = await getPlanGroups({
    studentId: score.student_id,
    status: ['active', 'saved']
  });

  if (existingPlans.length === 0) {
    // 3. 성적 기반 플랜 생성 제안
    suggestPlanCreation(score, analysis);
  }

  return { success: true, score, suggestion: analysis };
}
```

---

### P1-High: 캠프 초대 만료 처리 부재

**현황:**
- 캠프 초대: `expires_at` 필드 있음
- 만료된 초대 자동 처리 규칙 없음

**문제점:**
- 만료된 초대를 여전히 수락 가능
- UI에서 만료 여부 표시 없음
- 관리자가 수동으로 거부해야 함

**권장사항:**
```typescript
// lib/domains/camp/service.ts
export async function validateCampInvitation(invitationId: string) {
  const invitation = await getCampInvitation(invitationId);

  if (invitation?.expires_at) {
    const isExpired = new Date(invitation.expires_at) < new Date();
    if (isExpired) {
      throw new AppError(
        '만료된 초대장입니다.',
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  return invitation;
}

// 정기 작업 (크론):
export async function autoRejectExpiredInvitations() {
  await supabase
    .from('camp_invitations')
    .update({ status: 'expired' })
    .lte('expires_at', new Date().toISOString())
    .eq('status', 'pending');
}
```

---

### P2-Medium: 블록 시간 겹침 검증 개선

**현황:**
- 블록 겹침 검증 구현됨 (수정 시 자신 제외)
- 하지만 학원 일정과 블록의 겹침 검사 부재

**문제점:**
```typescript
// 학원 일정: 월 14:00-16:00
// 블록: 월 15:00-17:00
// → 겹침 있지만 검증 안 됨
```

**권장사항:**
```typescript
export async function validateBlockWithAcademySchedule(
  studentId: string,
  block: TenantBlock,
  excludeBlockId?: string
) {
  // 1. 기존 블록 겹침 검사
  const overlappingBlocks = await getOverlappingBlocks(
    studentId, block, excludeBlockId
  );

  // 2. 학원 일정과 겹침 검사
  const academySchedules = await getAcademySchedules(studentId);
  const overlappingAcademy = academySchedules.filter(
    a => a.day_of_week === block.day_of_week &&
         timeOverlap(a.start_time, a.end_time, block.start_time, block.end_time)
  );

  if (overlappingBlocks.length > 0 || overlappingAcademy.length > 0) {
    throw new AppError('시간이 겹치는 일정이 있습니다.', ...);
  }
}
```

---

## 4. 보안 & RLS

### P0-Critical: 부모-학생 링크 RLS 정책 불완전

**현황:**
- RLS 정책이 있지만 몇 가지 갭 존재

**문제점 분석:**
```sql
-- parent_student_links 테이블에 접근할 때
-- is_approved 체크가 일부 정책에만 있음

-- 부모가 승인되지 않은 링크를 통해 학생 정보 조회 가능
-- 학생 정보 조회 시 is_approved 확인 누락
```

**권장사항:**
```sql
-- lib/domains/parent의 모든 SELECT에
-- is_approved = true 필터 추가

ALTER TABLE students
DROP POLICY IF EXISTS "parents_can_view_linked_students";

CREATE POLICY "parents_can_view_linked_students"
ON students FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_id = auth.uid()
      AND student_id = students.id
      AND is_approved = true  -- 명시적으로 확인
      AND deleted_at IS NULL
  )
);
```

**영향 범위:** Parent 도메인, 데이터 보안 Critical

---

### P1-High: 관리자 권한 검증 일관성

**현황:**
- 일부 관리자 액션에서 `requireAdminAuth()` 검증 누락
- 데이터 레이어에서 RLS 의존

**문제점:**
```typescript
// 일부 액션은 수동으로 admin_users 테이블 조회
const { data: admin } = await supabase
  .from('admin_users')
  .select('*')
  .eq('id', auth.uid())
  .single();

// 다른 액션은 requireAdminAuth() 사용
await requireAdminAuth();
```

**권장사항:**
```typescript
// 일관된 패턴 적용
// lib/domains/{domain}/actions/*.ts의 모든 관리자 액션에

export async function adminAction(input: ...) {
  // 첫 줄: 권한 검증
  await requireAdminAuth();

  // 이하 로직...
}
```

---

### P2-Medium: 테넌트 데이터 격리 강화

**현황:**
- 모든 주요 테이블에 `tenant_id` 있음
- 하지만 일부 쿼리에서 `tenant_id` 필터 누락 가능

**문제점:**
```typescript
// lib/data/planGroups.ts의 일부 함수들
// tenant_id 필터가 선택사항인 경우가 있음

export async function findPlanGroups(filters: PlanGroupFilters) {
  let query = supabase.from("plan_groups")
    .eq("student_id", filters.studentId);

  if (filters.tenantId) {
    query = query.eq("tenant_id", filters.tenantId); // 선택사항
  }
  // tenant_id 필터 없으면 다른 테넌트의 플랜도 조회 가능!
}
```

**권장사항:**
```typescript
// tenant_id는 필수 항목으로 변경
export async function findPlanGroups(
  filters: PlanGroupFilters & { tenantId: string }
) {
  const query = supabase
    .from("plan_groups")
    .select(...)
    .eq("student_id", filters.studentId)
    .eq("tenant_id", filters.tenantId); // 항상 적용
}
```

---

## 5. 사용자 경험 & 에러 처리

### P1-High: 플랜 생성 실패 원인 분석 부족

**현황:**
- 플랜 생성 실패 시 일반적인 에러 메시지만 반환
- 실패 원인 구분 불명확

**문제점:**
```typescript
// "플랜 생성에 실패했습니다."
// → 뭐가 문제인지 알 수 없음
// → 블록 세트? 제외일? 스케줄? 콘텐츠?

throw new AppError(
  "플랜 생성에 실패했습니다.",
  ErrorCode.PLAN_GENERATION_FAILED,
  500
);
```

**권장사항:**
```typescript
// 구체적인 실패 원인 제공
export enum PlanGenerationFailureReason {
  BLOCK_SET_MISSING = 'block_set_missing',
  INVALID_PERIOD = 'invalid_period',
  INSUFFICIENT_STUDY_DAYS = 'insufficient_study_days',
  NO_AVAILABLE_CONTENT = 'no_available_content',
  SCHEDULE_CONFLICT = 'schedule_conflict',
  TIMELINE_ERROR = 'timeline_error',
}

// 실패 시 이유와 함께 반환
throw new AppError(
  "블록 세트가 설정되지 않았습니다. 설정을 확인해주세요.",
  ErrorCode.PLAN_GENERATION_FAILED,
  400,
  true,
  { reason: PlanGenerationFailureReason.BLOCK_SET_MISSING }
);
```

**UI 영향:**
```typescript
// 클라이언트에서 이유에 따른 상이한 조치 가능
if (error.context?.reason === 'block_set_missing') {
  showAlert('시간 블록을 먼저 설정해주세요.');
  redirectTo('/settings/blocks');
}
```

---

### P1-High: 로딩 상태 세분화 부족

**현황:**
- 플랜 생성 중: 전체 로딩 상태만 표시
- 사용자가 어느 단계인지 알 수 없음

**권장사항:**
```typescript
export enum PlanGenerationStep {
  VALIDATING = 'validating',           // 검증 중
  LOADING_CONTENT = 'loading_content', // 콘텐츠 로드 중
  GENERATING = 'generating',           // 스케줄 생성 중
  SAVING = 'saving',                   // 저장 중
}

// 각 단계별 진행률 정보 제공
{
  currentStep: PlanGenerationStep.GENERATING,
  progress: 45, // 전체 진행률
  message: '학습 계획을 생성 중입니다...'
}
```

---

### P2-Medium: 에러 복구 가이드 부족

**현황:**
- 에러 메시지만 표시
- 복구 방법 제시 없음

**권장사항:**
```typescript
interface UserFriendlyError {
  message: string;           // 사용자 메시지
  code: ErrorCode;           // 에러 코드
  recoveryActions?: Array<{  // 복구 액션
    label: string;
    action: () => Promise<void>;
  }>;
  contactSupport?: boolean;  // 지원 센터 연락 제안
}

// 예시
{
  message: "학원 일정과 겹쳐서 플랜을 만들 수 없습니다.",
  recoveryActions: [
    {
      label: "학원 일정 확인하기",
      action: () => navigate('/settings/academy')
    },
    {
      label: "시간 블록 조정하기",
      action: () => navigate('/settings/blocks')
    }
  ]
}
```

---

## 6. 확장성 & 성능

### P0-Critical: 플랜 생성 병목 해결 필요

**현황:**
- 플랜 생성: 콘텐츠 로드 → 스케줄 계산 → 저장 (순차 처리)
- 대규모 플랜(1년 기간) 생성 시 5-10초 소요

**문제점:**
```
현재 흐름 (순차):
1. 콘텐츠 메타데이터 로드      (1초)
2. 스케줄 계산                (3초)
3. 일별 플랜 생성 (배치)      (4초)
4. DB 저장                    (2초)
= 총 10초
```

**권장사항:**
```typescript
// 개선된 흐름 (부분 병렬화):
1. 콘텐츠 메타 + 스케줄러 설정 병렬 로드 (1초)
2. 스케줄 계산 (병렬화된 블록 처리)       (2초)
3. 일별 플랜 생성 (청크 단위 배치)       (2초)
4. DB 저장 (트랜잭션)                    (1초)
= 총 6초 (약 40% 단축)

// 구현:
const [contents, schedulerSettings] = await Promise.all([
  loadContentMetadata(groupId),
  getMergedSchedulerSettings(tenantId, campTemplateId)
]);

// 청크 단위 삽입
const chunkSize = 100;
for (let i = 0; i < plans.length; i += chunkSize) {
  await insertStudentPlans(plans.slice(i, i + chunkSize));
}
```

---

### P1-High: 학생 대시보드 성능 최적화

**현황:**
- 대시보드 로드: 오늘 플랜 + 진행률 + 통계 조회
- 매 방문마다 모든 데이터 리로드

**권장사항:**
```typescript
// 캐시 전략:
const QUERY_KEYS = {
  // 오늘 플랜: 일일 캐시 (자정 리셋)
  todayPlans: ['today-plans', studentId, getCurrentDate()],

  // 통계: 시간 단위 캐시 (시간마다 리셋)
  statistics: ['statistics', studentId, getCurrentHour()],

  // 플랜 그룹: 30분 캐시
  planGroups: ['plan-groups', studentId],
};

// 실시간 필요한 데이터만 구독
supabase
  .channel(`dashboard:${studentId}`)
  .on('postgres_changes',
    { event: 'UPDATE', table: 'student_plan' },
    (payload) => {
      // 진행률만 실시간 업데이트
      updateProgressCache(payload.new);
    }
  )
  .subscribe();
```

---

### P2-Medium: 데이터베이스 인덱스 전략

**현황:**
- 기본 인덱스만 존재
- 자주 조회되는 필터 조합에 복합 인덱스 부재

**현재 인덱스:**
```sql
CREATE INDEX idx_student_plan_student_id ON student_plan(student_id);
CREATE INDEX idx_plan_groups_student_id ON plan_groups(student_id);
```

**권장사항:**
```sql
-- 자주 함께 조회되는 필터 조합
CREATE INDEX idx_student_plan_student_date_tenant
  ON student_plan(student_id, plan_date, tenant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_plan_groups_student_status
  ON plan_groups(student_id, status, period_start)
  WHERE deleted_at IS NULL;

-- 부모-학생 링크
CREATE INDEX idx_parent_student_links_parent_approved
  ON parent_student_links(parent_id, is_approved)
  WHERE deleted_at IS NULL;

-- 출석 통계
CREATE INDEX idx_attendance_records_student_date
  ON attendance_records(student_id, attendance_date)
  WHERE deleted_at IS NULL;
```

**영향:** 대규모 학생(1000+) 시스템에서 필수

---

## 7. 마이그레이션 우선순위 로드맵

| Phase | 상태 | 핵심 작업 | 영향도 |
|-------|------|---------|--------|
| **P0** | ✅ 완료 | 플랜 상태 전환 검증<br>부모-학생 RLS 강화<br>테넌트 격리 검증 | Critical |
| **P1** | ✅ 완료 | 성적 → 플랜 재생성<br>N+1 쿼리 처리 (Parent)<br>에러 원인 분석 개선<br>캐시 전략 강화 | High |
| **P2** | ✅ 완료 | 블록-학원 겹침 검증<br>실시간 기능 확대<br>인덱스 최적화<br>에러 복구 가이드 | Medium |
| **P3** | ✅ 완료 | 진행률 시스템<br>UI/UX 개선<br>문서화<br>Query 키 정리 | Low |
| **UX** | ✅ 완료 | 에러 필드 강조/스크롤<br>저장 상태 표시기<br>Step 7 에러 복구 | High |

---

## 8. 체크리스트

### 즉시 조치 (P0 Critical) ✅ 완료
- [x] 플랜 상태 전환 검증 함수 추가 (`lib/domains/plan/validators.ts`)
- [x] 부모-학생 RLS 정책 완성 (`supabase/migrations/`)
- [x] 테넌트 격리 필수 적용 (`lib/utils/tenantValidation.ts`)
- [x] 관리자 권한 검증 일관성 점검 (`lib/auth/adminAuth.ts`)

### 고우선순위 (P1 High) ✅ 완료
- [x] 성적 입력 → 플랜 재생성 워크플로우 (`lib/recommendations/`)
- [x] Parent 도메인 N+1 쿼리 해결 (JOIN 쿼리로 개선)
- [x] 캐시 레이어 (getMergedSchedulerSettings)
- [x] 에러 원인 분석 개선 (`lib/errors/planGenerationErrors.ts`)
- [x] 캠프 초대 만료 자동 처리 (`lib/domains/camp/`)

### 중기 개선 (P2 Medium) ✅ 완료
- [x] 블록-학원 일정 겹침 검증 (`lib/domains/block/service.ts`)
- [x] tenant_id 필터 강제 유틸리티 (`lib/utils/tenantValidation.ts`)
- [x] 에러 복구 가이드 시스템 (`lib/errors/recoveryGuide.ts`)
- [x] 실시간 기능 확대 (`lib/realtime/`)
- [x] 성능 인덱스 최적화 (`supabase/migrations/20251224000000_add_performance_indexes.sql`)

### 저우선순위 (P3 Low) ✅ 완료
- [x] 플랜 생성 단계별 진행률 시스템 (`lib/plan/progress.ts`)
- [x] 로딩 상태 컴포넌트 세분화 (`components/organisms/PlanGenerationProgress.tsx`)
- [x] JSDoc 문서화 (`lib/errors/handler.ts`)
- [x] React Query 캐시 키 상수 정리 (`lib/query/keys.ts`)

### UX 개선 ✅ 완료
- [x] UX-1: 에러 필드 시각적 강조 + 자동 스크롤 (`errorFieldUtils.ts`, `ErrorFieldWrapper.tsx`)
- [x] UX-2: Step 6 인라인 편집 지원 (기존 구현 확인)
- [x] UX-3: 저장 상태 표시기 + 이탈 방지 (`SaveStatusIndicator.tsx`, `usePageLeaveGuard.ts`)
- [x] UX-4: Step 7 에러 복구 옵션 확대 (`Step7ScheduleResult.tsx` - onGoToStep, 에러 기반 복구 버튼)

### 향후 개선 (Backlog)
- [ ] lib/data → 도메인 저장소 마이그레이션 (장기 과제)
- [ ] 검증 레이어 추상화 (장기 과제)

---

## 9. 예상 효과

### 데이터 무결성
- 상태 전환 오류 0% 달성
- 권한 누출 위험 제거
- 테넌트 간 데이터 격리 보장

### 성능
- 대시보드 로딩 시간 50% 단축
- 플랜 생성 시간 40% 단축
- 대규모 학생 시스템 지원 가능

### 개발 생산성
- 코드 중복 제거로 유지보수 시간 감소
- 검증 로직 통합으로 버그 감소
- 명확한 도메인 구조로 온보딩 시간 단축

### 사용자 경험
- 명확한 에러 메시지로 셀프 서비스 가능
- 단계별 진행률로 대기 불안 감소
- 복구 가이드로 문제 해결 시간 단축
