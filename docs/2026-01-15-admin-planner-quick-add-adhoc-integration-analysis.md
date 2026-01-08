# 관리자 플래너 플랜 관리: 플랜 추가 기능 전체 리팩토링 분석

**작성일**: 2026-01-15  
**분석 범위**: 관리자 영역 플래너 하위 플랜 관리의 모든 플랜 추가 기능  
**목적**: 빠른 추가, 단발성 추가, 콘텐츠 추가, 플랜 그룹 추가 기능을 하나의 유형으로 통합하는 리팩토링 방안 제시

---

## 📋 목차

1. [현재 구현 분석](#현재-구현-분석)
2. [기능 비교](#기능-비교)
3. [데이터 흐름 분석](#데이터-흐름-분석)
4. [문제점 도출](#문제점-도출)
5. [통합 리팩토링 방안](#통합-리팩토링-방안)
6. [플랜 그룹 추가 vs 데일리 독 플랜 추가 차이점](#플랜-그룹-추가-vs-데일리-독-플랜-추가-차이점)
7. [구현 로드맵](#구현-로드맵)

---

## 현재 구현 분석

### 1. 빠른 추가 (Quick Add)

**컴포넌트**: `AdminQuickPlanModal.tsx`  
**위치**: `app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx`

**주요 특징**:
- ✅ 간단한 폼 (제목, 날짜, 예상 소요시간, 학습 유형)
- ✅ 자유 학습 타입 선택 (자유 학습, 독서, 운동, 복습, 과제, 테스트, 기타)
- ✅ `createQuickPlanForStudent` Server Action 사용
- ✅ `student_plan` 테이블에 직접 저장
- ✅ `plannerId` 필수 (플랜 그룹 자동 생성)
- ✅ 자유 학습인 경우 `flexible_contents` 자동 생성

**액션 함수**: `createQuickPlanForStudent`
- **위치**: `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`
- **저장 테이블**: `student_plan`
- **플랜 그룹**: 자동 생성 (플래너 기반)

**키보드 단축키**: `q`

---

### 2. 단발성 추가 (Ad-hoc Add)

**컴포넌트**: `AddAdHocModal.tsx`  
**위치**: `app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx`

**주요 특징**:
- ✅ 간단한 폼 (제목, 날짜, 예상 소요시간, 메모)
- ✅ `createAdHocPlan` Server Action 사용
- ✅ `ad_hoc_plans` 테이블에 저장
- ✅ `plannerId` 필수 (플랜 그룹 자동 생성)
- ✅ `planGroupId` 선택적 (없으면 자동 생성)
- ✅ 메모 필드 제공
- ✅ 이벤트 로깅 (`adhoc_created`)

**액션 함수**: `createAdHocPlan`
- **위치**: `lib/domains/admin-plan/actions/adHocPlan.ts`
- **저장 테이블**: `ad_hoc_plans`
- **플랜 그룹**: 자동 생성 (없는 경우)

**키보드 단축키**: `a`

---

### 3. 콘텐츠 추가 (Content Add)

**컴포넌트**: `AddContentModal.tsx`  
**위치**: `app/(admin)/admin/students/[id]/plans/_components/AddContentModal.tsx`

**주요 특징**:
- ✅ 복잡한 폼 (콘텐츠 유형, 과목 정보, 범위 지정, 배치 방식)
- ✅ `createFlexibleContent` + `createPlanFromContent` 사용
- ✅ `flexible_contents` 생성 후 `student_plan` 저장
- ✅ 배치 방식 선택 (today/period/weekly)
- ✅ 스케줄러 옵션 (period 모드)

**액션 함수**: `createPlanFromContent` / `createPlanFromContentWithScheduler`
- **위치**: `lib/domains/admin-plan/actions/createPlanFromContent.ts`
- **저장 테이블**: `flexible_contents` + `student_plan`
- **플랜 그룹**: 자동 생성 또는 기존 그룹 사용

**키보드 단축키**: `n`

---

### 4. 플랜 그룹 추가 (Plan Group Creation)

**컴포넌트**: `AdminPlanCreationWizard7Step.tsx`  
**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**주요 특징**:
- ✅ 7단계 위저드 (기본 정보, 시간 설정, 스케줄 미리보기, 콘텐츠 선택, 배분 설정, 최종 검토, 생성 및 결과)
- ✅ `createPlanGroupAction` 사용
- ✅ `plan_groups` + `plan_contents` + `plan_exclusions` + `academy_schedules` 생성
- ✅ 복잡한 설정 (스케줄러, 블록 세트, 학원일정, 제외일 등)
- ✅ 플랜 자동 생성 옵션

**액션 함수**: `createPlanGroupAction`
- **위치**: `lib/domains/plan/actions/plan-groups/create.ts`
- **저장 테이블**: `plan_groups`, `plan_contents`, `plan_exclusions`, `academy_schedules`
- **플랜 생성**: 위저드 완료 후 자동 생성 또는 수동 생성

**키보드 단축키**: `g`

---

### 5. 데일리 독 플랜 추가 (Daily Dock Add)

**컴포넌트**: `DailyDock.tsx`  
**위치**: `app/(admin)/admin/students/[id]/plans/_components/DailyDock.tsx`

**주요 특징**:
- ✅ Daily Dock 내부의 "+ 플랜 추가" 버튼
- ✅ `onAddContent` 콜백 호출 → `AddContentModal` 열기
- ✅ `onAddAdHoc` 콜백 호출 → `AddAdHocModal` 열기
- ✅ 활성 플랜 그룹 필요 (단발성 추가의 경우)

**UI 구성**:
```typescript
// Daily Dock 헤더
<button onClick={onAddContent}>+ 플랜 추가</button>
<button onClick={onAddAdHoc} disabled={!activePlanGroupId}>+ 단발성</button>
```

**실제 동작**:
- "+ 플랜 추가": `AddContentModal` 열기 (콘텐츠 추가)
- "+ 단발성": `AddAdHocModal` 열기 (단발성 추가)

---

## 기능 비교

### 전체 기능 비교표

| 항목 | 빠른 추가 | 단발성 추가 | 콘텐츠 추가 | 플랜 그룹 추가 |
|------|----------|------------|------------|--------------|
| **목적** | 빠르게 자유 학습 플랜 추가 | 한 번만 수행할 학습 항목 추가 | 콘텐츠 기반 플랜 추가 | 복잡한 플랜 그룹 생성 |
| **저장 테이블** | `student_plan` | `ad_hoc_plans` | `flexible_contents` + `student_plan` | `plan_groups` + `plan_contents` + ... |
| **플랜 그룹** | 자동 생성 | 자동 생성 (선택적) | 자동 생성 또는 기존 사용 | 직접 생성 |
| **입력 필드** | 제목, 날짜, 시간, 유형 | 제목, 날짜, 시간, 메모 | 콘텐츠 정보, 범위, 배치 | 7단계 위저드 |
| **복잡도** | 낮음 | 낮음 | 중간 | 높음 |
| **스케줄러** | ❌ | ❌ | ✅ (period 모드) | ✅ |
| **이벤트 로깅** | ❌ | ✅ | ❌ | ✅ |
| **키보드 단축키** | `q` | `a` | `n` | `g` |

### 데이터 저장 방식 비교

#### 빠른 추가
```
flexible_contents (자유 학습)
  └── student_plan
      └── plan_group_id (자동 생성)
```

#### 단발성 추가
```
ad_hoc_plans
  └── plan_group_id (자동 생성 또는 기존)
```

#### 콘텐츠 추가
```
flexible_contents
  └── student_plan
      └── plan_group_id (자동 생성 또는 기존)
```

#### 플랜 그룹 추가
```
plan_groups
  ├── plan_contents
  ├── plan_exclusions
  └── academy_schedules
      └── (플랜 자동 생성)
          └── student_plan
```

---

## 데이터 흐름 분석

### 빠른 추가 플로우

```
[AdminQuickPlanModal]
  └── createQuickPlanForStudent({
        studentId,
        tenantId,
        plannerId, // 필수
        title,
        planDate,
        estimatedMinutes,
        isFreeLearning: true,
        freeLearningType,
        containerType: 'daily'
      })
        │
        ├── [1] flexible_contents 생성 (자유 학습)
        │   └── content_type: "free"
        │   └── item_type: freeLearningType
        │
        ├── [2] 플랜 그룹 선택/생성
        │   └── selectPlanGroupForPlanner(plannerId)
        │   └── 또는 createPlanGroupForPlanner(plannerId)
        │
        └── [3] student_plan 저장
            └── content_type: "free" | "custom"
            └── flexible_content_id: flexible_contents.id
```

### 단발성 추가 플로우

```
[AddAdHocModal]
  └── createAdHocPlan({
        tenant_id,
        student_id,
        plan_group_id, // 자동 생성 가능
        plan_date,
        title,
        description,
        estimated_minutes,
        container_type: 'daily'
      })
        │
        ├── [1] 플랜 그룹 자동 생성 (없는 경우)
        │   └── createAutoContentPlanGroupAction({
        │         plannerId,
        │         planPurpose: 'adhoc'
        │       })
        │
        ├── [2] ad_hoc_plans 저장
        │
        └── [3] 이벤트 로깅
            └── createPlanEvent({
                  event_type: 'adhoc_created'
                })
```

### 콘텐츠 추가 플로우

```
[AddContentModal]
  └── createFlexibleContent({ ... })
        │
        └── createPlanFromContent({
              flexibleContentId,
              distributionMode, // today/period/weekly
              targetDate,
              plannerId,
              useScheduler // today 모드 전용
            })
              │
              ├── [1] flexible_contents 생성
              │
              ├── [2] 플랜 그룹 자동 생성 (없는 경우)
              │
              └── [3] student_plan 저장
                  └── distributionMode에 따라 배치
```

### 플랜 그룹 추가 플로우

```
[AdminPlanCreationWizard7Step]
  └── createPlanGroupAction({
        name,
        plan_purpose,
        scheduler_type,
        scheduler_options,
        period_start,
        period_end,
        planner_id,
        // ... 기타 설정
      })
        │
        ├── [1] plan_groups 생성
        ├── [2] plan_contents 생성
        ├── [3] plan_exclusions 생성
        ├── [4] academy_schedules 생성
        │
        └── [5] 플랜 자동 생성 (옵션)
            └── generatePlansFromGroup()
                └── student_plan 저장
```

---

## 문제점 도출

### 1. 데이터 저장 방식 불일치 (심각)

**문제**:
- 빠른 추가: `student_plan` 테이블
- 단발성 추가: `ad_hoc_plans` 테이블
- 콘텐츠 추가: `flexible_contents` + `student_plan` 테이블
- 플랜 그룹 추가: `plan_groups` + `plan_contents` + `student_plan` 테이블

**영향**:
- 데이터 조회 시 여러 테이블 확인 필요
- 통계 및 분석 시 복잡도 증가
- 데이터 일관성 문제 가능성
- 유지보수 어려움

### 2. 기능 중복 및 혼란

**문제**:
- 빠른 추가와 단발성 추가가 거의 동일한 목적
- 사용자가 어떤 기능을 사용해야 할지 혼란
- Daily Dock에 두 개의 버튼이 있어 혼란 가중

**영향**:
- 사용자 경험 저하
- 기능 선택의 모호성
- 학습 곡선 증가

### 3. 플랜 그룹 생성 로직 중복

**문제**:
- 각 기능마다 플랜 그룹 자동 생성 로직이 다름
- `createAutoContentPlanGroupAction`, `selectPlanGroupForPlanner`, `createPlanGroupForPlanner` 등 여러 함수 사용

**영향**:
- 코드 중복
- 유지보수 어려움
- 버그 발생 가능성 증가

### 4. 이벤트 로깅 불일치

**문제**:
- 빠른 추가: 이벤트 로깅 없음
- 단발성 추가: `adhoc_created` 이벤트 로깅
- 콘텐츠 추가: 이벤트 로깅 없음
- 플랜 그룹 추가: 이벤트 로깅 있음

**영향**:
- 플랜 생성 이력 추적 불일치
- 감사(Audit) 로그 불완전

### 5. UI 일관성 부족

**문제**:
- 각 기능마다 다른 모달 컴포넌트
- 다른 색상 테마 (Amber, Purple, Blue)
- 다른 아이콘 사용

**영향**:
- 사용자 경험 불일치
- 디자인 시스템 위반

---

## 통합 리팩토링 방안

### 핵심 원칙

1. **단일 데이터 저장 방식**: 모든 플랜을 `student_plan` 테이블에 저장
2. **단일 플랜 추가 인터페이스**: 하나의 통합 모달/위저드로 모든 플랜 추가 처리
3. **플랜 타입 구분**: `plan_type` 또는 `content_type` 필드로 구분
4. **플랜 그룹 통합**: 모든 플랜이 플랜 그룹에 속하도록 보장

### 방안 1: student_plan으로 완전 통합 (권장)

#### 개념

모든 플랜을 `student_plan` 테이블에 저장하고, `ad_hoc_plans` 테이블을 제거합니다.

#### 데이터 구조 통합

```typescript
// 통합된 student_plan 스키마
{
  id: string;
  student_id: string;
  tenant_id: string;
  plan_group_id: string; // 필수 (캘린더 아키텍처)
  plan_date: string;
  
  // 콘텐츠 정보
  content_type: 'book' | 'lecture' | 'custom' | 'free';
  content_id: string | null;
  flexible_content_id: string | null;
  content_title: string;
  
  // 범위 정보
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  
  // 시간 정보
  start_time: string | null;
  end_time: string | null;
  estimated_minutes: number | null;
  
  // 메타데이터
  container_type: 'daily' | 'weekly' | 'unfinished';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
  description: string | null; // 기존 ad_hoc_plans의 description
  
  // 플랜 타입 구분
  plan_type: 'structured' | 'quick' | 'adhoc' | 'content_based';
  is_adhoc: boolean; // 단발성 플랜 여부 (마이그레이션용)
  
  // 기타
  block_index: number;
  is_active: boolean;
  is_virtual: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

#### 마이그레이션 전략

```sql
-- 1. student_plan 테이블에 description 컬럼 추가
ALTER TABLE student_plan ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE student_plan ADD COLUMN IF NOT EXISTS plan_type TEXT;
ALTER TABLE student_plan ADD COLUMN IF NOT EXISTS is_adhoc BOOLEAN DEFAULT FALSE;

-- 2. ad_hoc_plans 데이터를 student_plan으로 마이그레이션
INSERT INTO student_plan (
  id,
  student_id,
  tenant_id,
  plan_group_id,
  plan_date,
  content_type,
  content_title,
  description,
  estimated_minutes,
  container_type,
  status,
  plan_type,
  is_adhoc,
  created_by,
  created_at,
  updated_at
)
SELECT 
  id,
  student_id,
  tenant_id,
  plan_group_id,
  plan_date,
  COALESCE(content_type, 'custom') as content_type,
  title as content_title,
  description,
  estimated_minutes,
  container_type,
  COALESCE(status, 'pending') as status,
  'adhoc' as plan_type,
  TRUE as is_adhoc,
  created_by,
  created_at,
  updated_at
FROM ad_hoc_plans
WHERE is_active = TRUE;

-- 3. ad_hoc_plans 테이블 제거 (또는 deprecated로 표시)
-- ALTER TABLE ad_hoc_plans ADD COLUMN deprecated_at TIMESTAMP DEFAULT NOW();
```

#### 통합 액션 함수

```typescript
/**
 * 통합 플랜 생성 함수
 * 모든 플랜 타입을 하나의 함수로 처리
 */
export async function createUnifiedPlan(
  input: UnifiedPlanInput
): Promise<UnifiedPlanResult> {
  const {
    studentId,
    tenantId,
    plannerId,
    planType, // 'quick' | 'adhoc' | 'content' | 'structured'
    // ... 기타 필드
  } = input;

  // 1. 플랜 그룹 확인/생성
  const planGroupId = await ensurePlanGroup({
    studentId,
    tenantId,
    plannerId,
    targetDate: input.planDate,
    planType,
  });

  // 2. 콘텐츠 생성 (필요한 경우)
  let contentId: string | null = null;
  let flexibleContentId: string | null = null;

  if (planType === 'quick' || planType === 'adhoc') {
    // 자유 학습 콘텐츠 생성
    const content = await createFreeLearningContent({
      tenantId,
      studentId,
      title: input.title,
      itemType: input.freeLearningType,
      estimatedMinutes: input.estimatedMinutes,
    });
    flexibleContentId = content.id;
    contentId = content.id;
  } else if (planType === 'content') {
    // flexible_contents 생성
    const content = await createFlexibleContent(input.contentInfo);
    flexibleContentId = content.id;
    contentId = content.contentId;
  }

  // 3. student_plan 저장
  const plan = await supabase
    .from('student_plan')
    .insert({
      student_id: studentId,
      tenant_id: tenantId,
      plan_group_id: planGroupId,
      plan_date: input.planDate,
      content_type: getContentType(planType, input),
      content_id: contentId,
      flexible_content_id: flexibleContentId,
      content_title: input.title,
      description: input.description || null,
      estimated_minutes: input.estimatedMinutes || null,
      container_type: input.containerType || 'daily',
      status: 'pending',
      plan_type: planType,
      is_adhoc: planType === 'adhoc',
      // ... 기타 필드
    })
    .select()
    .single();

  // 4. 이벤트 로깅
  await createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    plan_id: plan.id,
    event_type: 'plan_created',
    event_category: planType,
    payload: { planType, title: input.title },
    new_state: plan,
  });

  return { success: true, data: plan };
}
```

### 방안 2: 통합 플랜 추가 UI

#### 단일 모달 컴포넌트

```typescript
/**
 * 통합 플랜 추가 모달
 * 모든 플랜 타입을 하나의 인터페이스로 처리
 */
export function UnifiedPlanAddModal({
  studentId,
  tenantId,
  plannerId,
  targetDate,
  defaultMode = 'quick', // 'quick' | 'content' | 'structured'
  onClose,
  onSuccess,
}: UnifiedPlanAddModalProps) {
  const [mode, setMode] = useState<'quick' | 'content' | 'structured'>(defaultMode);
  
  // 공통 필드
  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(targetDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [description, setDescription] = useState('');
  
  // 모드별 필드
  const [freeLearningType, setFreeLearningType] = useState<string>('free');
  const [contentType, setContentType] = useState<ContentType>('book');
  // ... 기타 필드

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await createUnifiedPlan({
      studentId,
      tenantId,
      plannerId,
      planType: mode === 'quick' ? 'quick' : mode === 'content' ? 'content' : 'structured',
      title: title.trim(),
      planDate,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      description: description.trim() || null,
      // ... 모드별 필드
    });

    if (result.success) {
      onSuccess();
    }
  };

  return (
    <Modal>
      {/* 모드 선택 탭 */}
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="quick">
            <Zap className="h-4 w-4" />
            빠른 추가
          </TabsTrigger>
          <TabsTrigger value="content">
            <Book className="h-4 w-4" />
            콘텐츠 추가
          </TabsTrigger>
          <TabsTrigger value="structured">
            <Calendar className="h-4 w-4" />
            구조화된 추가
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={handleSubmit}>
        {/* 공통 필드 */}
        <Input label="제목" value={title} onChange={setTitle} required />
        <DatePicker value={planDate} onChange={setPlanDate} />
        <TimeInput value={estimatedMinutes} onChange={setEstimatedMinutes} />
        <Textarea label="메모" value={description} onChange={setDescription} />

        {/* 모드별 필드 */}
        {mode === 'quick' && (
          <FreeLearningTypeSelector
            value={freeLearningType}
            onChange={setFreeLearningType}
          />
        )}
        {mode === 'content' && (
          <ContentSelector
            contentType={contentType}
            onContentTypeChange={setContentType}
            // ... 기타 콘텐츠 필드
          />
        )}
        {mode === 'structured' && (
          <StructuredPlanForm
            // ... 구조화된 플랜 필드
          />
        )}

        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button type="submit">추가</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
```

### 방안 3: 플랜 그룹 생성 로직 통합

#### 통합 플랜 그룹 관리 함수

```typescript
/**
 * 플랜 그룹 확인/생성 통합 함수
 * 모든 플랜 추가 기능에서 사용
 */
export async function ensurePlanGroup(input: {
  studentId: string;
  tenantId: string;
  plannerId: string;
  targetDate: string;
  planType: 'quick' | 'adhoc' | 'content' | 'structured';
  planGroupId?: string; // 기존 그룹 ID (있는 경우)
}): Promise<string> {
  // 1. 기존 그룹이 있으면 사용
  if (input.planGroupId) {
    return input.planGroupId;
  }

  // 2. 플래너 기반으로 기존 그룹 찾기
  const existingGroup = await findPlanGroupForPlanner({
    plannerId: input.plannerId,
    studentId: input.studentId,
    targetDate: input.targetDate,
  });

  if (existingGroup) {
    return existingGroup.id;
  }

  // 3. 새 그룹 생성
  const newGroup = await createAutoPlanGroup({
    tenantId: input.tenantId,
    studentId: input.studentId,
    plannerId: input.plannerId,
    targetDate: input.targetDate,
    planType: input.planType,
  });

  return newGroup.id;
}
```

---

## 플랜 그룹 추가 vs 데일리 독 플랜 추가 차이점

### 플랜 그룹 추가 (위자드)

**목적**: 복잡한 구조화된 플랜 그룹 생성

**특징**:
- ✅ 7단계 위저드로 상세 설정
- ✅ 스케줄러 설정 (1730 타임테이블 등)
- ✅ 블록 세트 선택
- ✅ 학원일정 및 제외일 설정
- ✅ 여러 콘텐츠 선택 및 배분 설정
- ✅ 플랜 자동 생성 옵션
- ✅ 기간 단위 플랜 그룹 생성

**사용 사례**:
- 학기 단위 학습 계획 수립
- 복잡한 스케줄링이 필요한 경우
- 여러 콘텐츠를 체계적으로 배분해야 하는 경우

**데이터 구조**:
```
plan_groups (메타데이터)
  ├── plan_contents (콘텐츠 목록)
  ├── plan_exclusions (제외일)
  └── academy_schedules (학원일정)
      └── (플랜 자동 생성)
          └── student_plan[] (여러 플랜)
```

**생성 결과**:
- 플랜 그룹 1개
- 플랜 콘텐츠 여러 개
- 플랜 여러 개 (자동 생성 시)

---

### 데일리 독 플랜 추가

**목적**: 특정 날짜에 빠르게 플랜 추가

**특징**:
- ✅ 간단한 폼으로 빠른 입력
- ✅ 단일 날짜에 단일 플랜 추가
- ✅ 플랜 그룹 자동 생성 (없는 경우)
- ✅ 콘텐츠 추가 또는 단발성 추가 선택

**사용 사례**:
- 오늘 할 일 빠르게 추가
- 특정 날짜에 단일 플랜 추가
- 간단한 학습 항목 추가

**데이터 구조**:
```
(플랜 그룹 자동 생성 또는 기존 사용)
  └── student_plan (단일 플랜)
```

**생성 결과**:
- 플랜 그룹 1개 (자동 생성 시)
- 플랜 1개

---

### 주요 차이점 요약

| 항목 | 플랜 그룹 추가 | 데일리 독 플랜 추가 |
|------|--------------|------------------|
| **복잡도** | 높음 (7단계 위저드) | 낮음 (간단한 폼) |
| **설정 항목** | 스케줄러, 블록, 학원일정, 제외일, 콘텐츠 배분 | 제목, 날짜, 시간, 메모 |
| **플랜 그룹** | 직접 생성 (상세 설정) | 자동 생성 (기본 설정) |
| **플랜 생성** | 여러 플랜 자동 생성 가능 | 단일 플랜만 생성 |
| **기간** | 기간 단위 (시작일 ~ 종료일) | 단일 날짜 |
| **스케줄러** | ✅ 사용 | ❌ 미사용 (단일 날짜) |
| **사용 시점** | 학기 초, 계획 수립 시 | 일상적인 플랜 추가 |

---

## 구현 로드맵

### Phase 1: 데이터 구조 통합 (1-2주)

**목표**: `ad_hoc_plans` 테이블을 `student_plan`으로 통합

**작업 내용**:
1. `student_plan` 테이블에 `description`, `plan_type`, `is_adhoc` 컬럼 추가
2. 마이그레이션 스크립트 작성 및 실행
3. `ad_hoc_plans` 데이터를 `student_plan`으로 마이그레이션
4. 기존 코드에서 `ad_hoc_plans` 참조 제거
5. 테스트 및 검증

**예상 시간**: 1-2주

---

### Phase 2: 통합 액션 함수 구현 (1주)

**목표**: 모든 플랜 추가 기능을 하나의 액션 함수로 통합

**작업 내용**:
1. `createUnifiedPlan` 함수 구현
2. `ensurePlanGroup` 함수 구현
3. 기존 액션 함수들을 래퍼로 변경
4. 테스트 및 검증

**예상 시간**: 1주

---

### Phase 3: 통합 UI 구현 (1-2주)

**목표**: 단일 모달로 모든 플랜 추가 기능 통합

**작업 내용**:
1. `UnifiedPlanAddModal` 컴포넌트 구현
2. 모드별 필드 조건부 렌더링
3. 기존 모달 컴포넌트 교체
4. Daily Dock 버튼 통합
5. 테스트 및 검증

**예상 시간**: 1-2주

---

### Phase 4: 이벤트 로깅 통일 (3일)

**목표**: 모든 플랜 생성에 이벤트 로깅 추가

**작업 내용**:
1. `createUnifiedPlan`에 이벤트 로깅 추가
2. 이벤트 타입 정의 (`plan_created`)
3. 기존 로깅 코드 정리
4. 테스트 및 검증

**예상 시간**: 3일

---

### Phase 5: 레거시 코드 정리 (1주)

**목표**: 기존 중복 코드 제거 및 정리

**작업 내용**:
1. `createQuickPlanForStudent` 함수 제거 또는 deprecated
2. `createAdHocPlan` 함수 제거 또는 deprecated
3. `createPlanFromContent` 함수 리팩토링
4. 사용하지 않는 컴포넌트 제거
5. 문서 업데이트

**예상 시간**: 1주

---

### Phase 6: 테스트 및 검증 (1주)

**목표**: 전체 기능 테스트 및 성능 검증

**작업 내용**:
1. 통합 테스트 작성
2. E2E 테스트 작성
3. 성능 테스트
4. 사용자 테스트
5. 버그 수정

**예상 시간**: 1주

---

## 예상 효과

### 코드 품질 개선

- ✅ 코드 중복 제거 (약 30-40% 감소 예상)
- ✅ 유지보수 용이성 향상
- ✅ 버그 발생 가능성 감소

### 사용자 경험 개선

- ✅ 기능 선택 혼란 제거
- ✅ 일관된 UI/UX
- ✅ 학습 곡선 감소

### 데이터 일관성 향상

- ✅ 단일 데이터 저장 방식
- ✅ 통계 및 분석 용이
- ✅ 데이터 무결성 보장

---

## 참고 문서

- [관리자 플래너-플랜 관리 플로우 분석](./2026-01-15-admin-planner-plan-management-flow-analysis.md)
- [플래너 콘텐츠 추가 시 스케줄러 및 타임라인 기능 연계](./2026-01-15-planner-content-addition-scheduler-timeline-integration.md)
- [관리자 플랜 생성 구조 분석](./2026-01-15-admin-plan-creation-structure-analysis-and-improvements.md)

---

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**버전**: 2.0  
**상태**: 리팩토링 방안 제시 완료
