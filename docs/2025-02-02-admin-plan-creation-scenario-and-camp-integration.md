# 관리자 플랜 생성 시나리오 및 캠프 모드 통합 분석

> 작성일: 2025-02-02  
> 상태: 완료  
> 목적: 관리자가 학생을 선택하여 플랜을 생성하는 기본 시나리오 정리 및 캠프 모드 통합 가능성 점검

---

## 📋 목차

1. [개요](#개요)
2. [기본 시나리오](#기본-시나리오)
3. [시각화 (플로우차트)](#시각화-플로우차트)
4. [관련 코드 분석](#관련-코드-분석)
5. [캠프 모드 통합 가능성](#캠프-모드-통합-가능성)
6. [통합 방안 제안](#통합-방안-제안)
7. [참고 자료](#참고-자료)

---

## 개요

### 관리자 플랜 생성 기능 개요

관리자는 학생 목록에서 특정 학생을 선택한 후, 해당 학생의 플랜 관리 페이지에서 다양한 방식으로 플랜을 생성할 수 있습니다.

### 플랜 생성 방법

관리자가 사용할 수 있는 플랜 생성 방법은 다음과 같습니다:

1. **플랜 그룹 생성 (7단계 위자드)** - 가장 상세한 설정
2. **AI 플랜 생성** - AI 기반 자동 생성
3. **빠른 플랜 추가** - 간단한 플랜 추가
4. **콘텐츠 추가** - 특정 콘텐츠로 플랜 추가
5. **일회성 플랜 추가** - 단발성 플랜 추가

---

## 기본 시나리오

### 시나리오 1: 플랜 그룹 생성 (7단계 위자드)

#### 1단계: 학생 선택

**경로**: `/admin/students`

**프로세스**:
1. 관리자가 학생 목록 페이지에 접근
2. 학생 목록에서 특정 학생을 선택 (테이블에서 클릭)
3. 해당 학생의 플랜 관리 페이지로 이동: `/admin/students/[id]/plans`

**관련 컴포넌트**:
- `app/(admin)/admin/students/page.tsx` - 학생 목록 페이지
- `app/(admin)/admin/students/_components/StudentListClient.tsx` - 학생 목록 클라이언트
- `app/(admin)/admin/students/_components/StudentTable.tsx` - 학생 테이블

#### 2단계: 플랜 그룹 생성 버튼 클릭

**경로**: `/admin/students/[id]/plans`

**프로세스**:
1. 플랜 관리 페이지에서 "플랜 그룹" 버튼 클릭 (또는 키보드 단축키 `g`)
2. 7단계 플랜 생성 위자드 모달이 열림

**관련 컴포넌트**:
- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` - 플랜 관리 메인 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx` - 7단계 위자드

#### 3단계: 7단계 위자드 진행

**Step 1: 기본 정보**
- 플랜 이름
- 기간 (시작일, 종료일)
- 플랜 목적 (내신대비, 모의고사, 수능)

**Step 2: 시간 설정**
- 학원 스케줄 설정
- 제외 일정 설정

**Step 3: 스케줄 미리보기**
- 생성될 스케줄 미리 확인

**Step 4: 콘텐츠 선택**
- 학습할 콘텐츠 선택
- 콘텐츠 범위 설정

**Step 5: 배분 설정**
- 콘텐츠 배분 방식 설정

**Step 6: 최종 검토**
- 모든 설정 사항 검토

**Step 7: 생성 및 결과**
- 플랜 그룹 생성 실행
- 생성 결과 확인

#### 4단계: 플랜 그룹 생성 완료

**결과**:
- 플랜 그룹이 생성되고 `draft` 상태로 저장됨
- 생성된 플랜 그룹 ID 반환
- 선택적으로 AI 플랜 생성 모달 자동 열림

**관련 액션**:
- `lib/domains/plan/actions/plan-groups/create.ts` - `createPlanGroupAction`
- `lib/data/planGroups.ts` - `createPlanGroup`

---

## 시각화 (플로우차트)

### 전체 플로우

```
┌─────────────────────────────────────────────────────────────┐
│                    관리자 플랜 생성 플로우                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  학생 목록 페이지 │
                    │ /admin/students │
                    └─────────────────┘
                              │
                              │ [학생 선택]
                              ▼
                    ┌─────────────────┐
                    │  플랜 관리 페이지 │
                    │/admin/students/  │
                    │   [id]/plans    │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ 플랜 그룹 생성 │    │  AI 플랜 생성  │    │ 빠른 플랜 추가 │
│  (7단계 위자드)│    │                │    │                │
└───────────────┘    └───────────────┘    └───────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 1: 기본 정보                                 │
│  - 플랜 이름                                                  │
│  - 기간 (시작일, 종료일)                                      │
│  - 플랜 목적                                                  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 2: 시간 설정                                 │
│  - 학원 스케줄 설정                                            │
│  - 제외 일정 설정                                             │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 3: 스케줄 미리보기                           │
│  - 생성될 스케줄 미리 확인                                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 4: 콘텐츠 선택                               │
│  - 학습할 콘텐츠 선택                                          │
│  - 콘텐츠 범위 설정                                            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 5: 배분 설정                                 │
│  - 콘텐츠 배분 방식 설정                                       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 6: 최종 검토                                 │
│  - 모든 설정 사항 검토                                         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 7: 생성 및 결과                              │
│  - 플랜 그룹 생성 실행                                         │
│  - 생성 결과 확인                                             │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              플랜 그룹 생성 완료                               │
│  - draft 상태로 저장                                           │
│  - 플랜 그룹 ID 반환                                           │
│  - (선택) AI 플랜 생성 모달 자동 열림                          │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    데이터 흐름도                               │
└─────────────────────────────────────────────────────────────┘

[AdminPlanManagement]
        │
        │ studentId, tenantId, studentName 전달
        ▼
[AdminPlanCreationWizard7Step]
        │
        │ 위자드 데이터 수집
        ▼
[AdminWizardProvider (Context)]
        │
        │ PlanGroupCreationData 변환
        ▼
[createPlanGroupAction]
        │
        │ options: { studentId, skipContentValidation }
        ▼
[_createPlanGroup]
        │
        │ studentId 사용 (관리자 모드)
        ▼
[createPlanGroup (lib/data/planGroups)]
        │
        │ DB에 플랜 그룹 저장
        ▼
[plan_groups 테이블]
        │
        │ groupId 반환
        ▼
[AdminPlanManagement]
        │
        │ onSuccess(groupId, generateAI)
        ▼
[플랜 관리 페이지 새로고침]
```

---

## 관련 코드 분석

### 1. 학생 선택 및 플랜 관리 페이지 접근

**파일**: `app/(admin)/admin/students/page.tsx`

```typescript
// 학생 목록 조회 및 표시
// 학생 클릭 시 /admin/students/[id]/plans로 이동
```

**파일**: `app/(admin)/admin/students/[id]/plans/page.tsx`

```12:72:app/(admin)/admin/students/[id]/plans/page.tsx
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}

async function getStudentInfo(studentId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('students')
    .select('id, name, tenant_id')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export default async function StudentPlansPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { date } = await searchParams;

  const student = await getStudentInfo(id);

  if (!student) {
    notFound();
  }

  const targetDate = date ?? new Date().toISOString().split('T')[0];

  // 활성 플랜 그룹 조회
  const activePlanGroups = await getPlanGroupsForStudent({
    studentId: id,
    status: 'active',
  });
  const activePlanGroupId = activePlanGroups[0]?.id ?? null;

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          플랜 관리: {student.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          학생의 학습 플랜을 관리하고 재분배할 수 있습니다
        </p>
      </div>

      {/* 플랜 관리 컴포넌트 */}
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={student.id}
          studentName={student.name}
          tenantId={student.tenant_id}
          initialDate={targetDate}
          activePlanGroupId={activePlanGroupId}
        />
      </Suspense>
    </div>
  );
}
```

### 2. 플랜 그룹 생성 위자드

**파일**: `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`

```380:387:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
            <button
              onClick={() => setShowCreateWizard(true)}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
              title="플랜 그룹 생성 (g)"
            >
              <Plus className="h-4 w-4" />
              플랜 그룹
            </button>
```

```584:601:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
        {/* 플랜 그룹 생성 위자드 (7단계) */}
        {showCreateWizard && (
          <AdminPlanCreationWizard7Step
            studentId={studentId}
            tenantId={tenantId}
            studentName={studentName}
            onClose={() => setShowCreateWizard(false)}
            onSuccess={(groupId, generateAI) => {
              setShowCreateWizard(false);
              handleRefresh();
              // AI 생성 옵션이 선택된 경우, 새로 생성된 그룹으로 AI 모달 열기
              if (generateAI) {
                setNewGroupIdForAI(groupId);
                setShowAIPlanModal(true);
              }
            }}
          />
        )}
```

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

```192:283:app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx
  const handleSubmit = useCallback(async () => {
    if (hasErrors) {
      setError("입력 값에 오류가 있습니다. 이전 단계를 확인해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const {
        name,
        planPurpose,
        periodStart,
        periodEnd,
        selectedContents,
        skipContents,
        exclusions,
        academySchedules,
        schedulerType,
        blockSetId,
        schedulerOptions,
      } = wizardData;

      // PlanGroupCreationData 구성
      const planGroupData: PlanGroupCreationData = {
        name: name || null,
        plan_purpose: (planPurpose as "내신대비" | "모의고사" | "수능" | "") || "내신대비",
        scheduler_type: schedulerType === "custom" ? "1730_timetable" : (schedulerType || "1730_timetable"),
        period_start: periodStart,
        period_end: periodEnd,
        block_set_id: blockSetId || null,
        scheduler_options: schedulerOptions || undefined,
        contents: skipContents
          ? []
          : selectedContents.map((c, index) => ({
              content_type: c.contentType as "book" | "lecture",
              content_id: c.contentId,
              master_content_id: null,
              start_range: c.startRange,
              end_range: c.endRange,
              start_detail_id: null,
              end_detail_id: null,
              display_order: index,
            })),
        exclusions: exclusions.map((e) => ({
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type === "holiday" ? "휴일지정"
            : e.exclusion_type === "personal" ? "개인사정"
            : "기타" as const,
          reason: e.reason || undefined,
        })),
        academy_schedules: academySchedules.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name || undefined,
          subject: s.subject || undefined,
        })),
      };

      const result = await createPlanGroupAction(planGroupData, {
        skipContentValidation: true,
        studentId: studentId,
      });

      // 에러 확인
      if ("success" in result && result.success === false) {
        setError(result.error?.message || "플랜 그룹 생성에 실패했습니다.");
        setSubmitting(false);
        return;
      }

      // 성공 시
      const groupId = (result as { groupId: string }).groupId;
      setCreatedGroupId(groupId);
      setSubmitting(false);
      onSuccess(groupId, wizardData.generateAIPlan);
    } catch (err) {
      console.error("[AdminWizard] 생성 실패:", err);
      setError("플랜 그룹 생성 중 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }, [
    hasErrors,
    wizardData,
    studentId,
    setSubmitting,
    setError,
    setCreatedGroupId,
    onSuccess,
  ]);
```

### 3. 플랜 그룹 생성 액션

**파일**: `lib/domains/plan/actions/plan-groups/create.ts`

```179:185:lib/domains/plan/actions/plan-groups/create.ts
async function _createPlanGroup(
  data: PlanGroupCreationData,
  options?: {
    skipContentValidation?: boolean; // 캠프 모드에서 Step 3 제출 시 콘텐츠 검증 건너뛰기
    studentId?: string | null; // 관리자 모드에서 직접 지정하는 student_id
  }
): Promise<{ groupId: string }> {
```

**핵심 로직**:
- `options.studentId`가 제공되면 관리자 모드로 인식
- 관리자 모드에서는 해당 `studentId`를 사용하여 플랜 그룹 생성
- 일반 모드(학생 모드)에서는 현재 로그인한 사용자의 ID 사용

---

## 캠프 모드 통합 가능성

### 현재 캠프 모드 구현

#### 1. 캠프 모드 식별

캠프 모드는 다음 필드로 식별됩니다:

- `plan_type`: `"camp"`로 설정
- `camp_template_id`: 캠프 템플릿 ID
- `camp_invitation_id`: 캠프 초대 ID (학생별 고유)

**파일**: `lib/data/planGroups.ts`

```409:412:lib/data/planGroups.ts
    // 캠프 관련 필드
    plan_type?: string | null;
    camp_template_id?: string | null;
    camp_invitation_id?: string | null;
```

#### 2. 캠프 모드 플랜 그룹 생성 로직

**파일**: `lib/domains/plan/actions/plan-groups/create.ts`

```293:319:lib/domains/plan/actions/plan-groups/create.ts
  // 캠프 모드인 경우 camp_invitation_id로 먼저 확인
  const supabase = await createSupabaseServerClient();
  
  // 캠프 모드인 경우 camp_invitation_id로 기존 플랜 그룹 확인
  if (data.camp_invitation_id) {
    const { data: existingCampGroup, error: campGroupError } = await supabase
      .from("plan_groups")
      .select("id, status")
      .eq("camp_invitation_id", data.camp_invitation_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (campGroupError && campGroupError.code !== "PGRST116") {
      logActionDebug(
        { domain: "plan", action: "createPlanGroup", userId: studentId },
        "캠프 플랜 그룹 확인 중 에러 (무시하고 계속 진행)",
        { error: campGroupError }
      );
    } else if (existingCampGroup) {
      // 기존 캠프 플랜 그룹이 있으면 업데이트
      await updatePlanGroupDraftAction(existingCampGroup.id, data);
      revalidatePath("/plan");
      return { groupId: existingCampGroup.id };
    }
  }
```

#### 3. 학생 영역 캠프 모드 플랜 생성

**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanGenerator.ts`

```115:121:app/(student)/plan/new-group/_components/hooks/usePlanGenerator.ts
    // Camp Mode Overrides
    if (isCampMode) {
      creationData.block_set_id = null;
      if (campInvitationId) creationData.camp_invitation_id = campInvitationId;
      if (initialData?.templateId) creationData.camp_template_id = initialData.templateId;
      creationData.plan_type = "camp";
    }
```

### 관리자 영역에서의 캠프 모드 통합 가능성

#### ✅ 통합 가능한 부분

1. **플랜 그룹 생성 시 캠프 모드 지원**
   - `AdminPlanCreationWizard7Step`에서 캠프 모드 옵션 추가 가능
   - `camp_template_id`와 `camp_invitation_id`를 위자드 데이터에 포함 가능

2. **학생 선택 후 캠프 템플릿 적용**
   - 관리자가 학생을 선택한 후, 특정 캠프 템플릿을 적용하여 플랜 생성 가능
   - 캠프 초대(`camp_invitation`)를 통해 학생과 캠프 템플릿 연결

3. **기존 캠프 플랜 그룹 업데이트**
   - `camp_invitation_id`로 기존 플랜 그룹을 찾아 업데이트하는 로직이 이미 구현됨

#### ⚠️ 주의사항

1. **캠프 초대 필요**
   - 캠프 모드로 플랜을 생성하려면 `camp_invitation_id`가 필요
   - 관리자가 직접 캠프 초대를 생성하거나, 기존 초대를 사용해야 함

2. **템플릿 데이터 필요**
   - 캠프 템플릿(`camp_template_id`)이 존재해야 함
   - 템플릿에서 기본 설정을 가져와야 함

3. **학생별 고유성**
   - `camp_invitation_id`는 학생별로 고유해야 함
   - 동일한 학생에게 동일한 캠프 템플릿으로 여러 플랜 그룹 생성 시 충돌 가능

---

## 통합 방안 제안

### 방안 1: 관리자 위자드에 캠프 모드 옵션 추가

**구현 방법**:
1. `AdminPlanCreationWizard7Step`에 캠프 모드 토글 추가
2. 캠프 모드 선택 시 캠프 템플릿 선택 UI 표시
3. 선택된 템플릿의 기본 설정을 위자드에 자동 채움
4. 플랜 그룹 생성 시 `camp_template_id`와 `camp_invitation_id` 포함

**장점**:
- 기존 위자드 구조 재사용 가능
- 관리자가 캠프 모드와 일반 모드를 동일한 인터페이스에서 사용 가능

**단점**:
- 위자드가 복잡해질 수 있음
- 캠프 초대 생성 로직 추가 필요

### 방안 2: 별도의 캠프 플랜 생성 모달

**구현 방법**:
1. `AdminPlanManagement`에 "캠프 플랜 생성" 버튼 추가
2. 캠프 템플릿 선택 모달 생성
3. 선택된 템플릿과 학생 정보로 플랜 그룹 생성

**장점**:
- 캠프 모드 전용 UI로 명확함
- 기존 위자드와 분리되어 유지보수 용이

**단점**:
- 별도 컴포넌트 개발 필요
- 코드 중복 가능성

### 방안 3: 학생 목록에서 일괄 캠프 플랜 생성

**구현 방법**:
1. 학생 목록에서 여러 학생 선택
2. "캠프 플랜 일괄 생성" 버튼 클릭
3. 캠프 템플릿 선택 후 선택된 학생들에게 일괄 생성

**장점**:
- 여러 학생에게 동시에 캠프 플랜 생성 가능
- 효율적인 작업 흐름

**단점**:
- 일괄 생성 로직 복잡도 증가
- 에러 처리 및 롤백 로직 필요

### 추천 방안

**방안 1 + 방안 3 조합**을 추천합니다:

1. **개별 생성**: `AdminPlanCreationWizard7Step`에 캠프 모드 옵션 추가
2. **일괄 생성**: 학생 목록에서 일괄 캠프 플랜 생성 기능 추가

이렇게 하면:
- 개별 학생에 대한 세밀한 제어 가능
- 여러 학생에 대한 효율적인 작업 가능
- 기존 코드 구조 최대한 재사용

---

## 구현 체크리스트

### Phase 1: 기본 통합

- [ ] `AdminPlanCreationWizard7Step`에 캠프 모드 토글 추가
- [ ] 캠프 템플릿 선택 UI 추가
- [ ] 선택된 템플릿의 기본 설정 로드 로직 구현
- [ ] 플랜 그룹 생성 시 캠프 필드 포함 로직 추가

### Phase 2: 캠프 초대 처리

- [ ] 캠프 초대 생성/조회 로직 구현
- [ ] 기존 캠프 초대 재사용 로직 구현
- [ ] 캠프 초대 없이 플랜 생성 시 자동 생성 로직 구현

### Phase 3: 일괄 생성

- [ ] 학생 목록에서 일괄 선택 기능 확인
- [ ] 일괄 캠프 플랜 생성 모달 구현
- [ ] 일괄 생성 진행 상황 표시 UI 구현
- [ ] 에러 처리 및 부분 성공 처리 로직 구현

---

## 참고 자료

### 관련 문서

- [학생/관리자 영역 플랜 생성 기능 통합 분석](./2025-02-02-plan-creation-features-comprehensive-analysis.md)
- [관리자 플랜 배정 플로우](./admin-plan-assignment-flow.md)
- [캠프 모드 플랜 생성 권한 수정](./camp-mode-plan-generation-permission-fix-2025-11-27.md)

### 관련 코드

- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` - 플랜 관리 메인 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx` - 7단계 위자드
- `lib/domains/plan/actions/plan-groups/create.ts` - 플랜 그룹 생성 액션
- `lib/data/planGroups.ts` - 플랜 그룹 데이터 레이어
- `lib/domains/camp/actions/progress/bulk.ts` - 캠프 일괄 플랜 생성

### 데이터베이스 스키마

- `plan_groups` 테이블:
  - `plan_type`: 플랜 유형 (`"camp"` | `null`)
  - `camp_template_id`: 캠프 템플릿 ID
  - `camp_invitation_id`: 캠프 초대 ID

---

**마지막 업데이트**: 2025-02-02

