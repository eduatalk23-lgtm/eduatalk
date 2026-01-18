# 플랜에 전략/취약 정보 추가 작업 문서

## 개요

플랜 생성 시 전략/취약 정보를 저장하고, PlanListView에서 콘텐츠명 앞에 배지로 표시합니다. 나중에 플랜 캘린더나 학습 관리에서도 활용할 수 있도록 데이터베이스에 저장합니다.

## 작업 일시

2025-12-21

## 변경 사항

### 1. 데이터베이스 스키마 수정

**마이그레이션 파일**: `supabase/migrations/20251221200303_add_subject_type_to_plans.sql`

- `student_plan` 테이블에 `subject_type` 컬럼 추가
  - 타입: `TEXT`
  - 제약 조건: `CHECK (subject_type IS NULL OR subject_type IN ('strategy', 'weakness'))`
  - NULL 허용: 기존 플랜과 전략/취약 설정이 없는 플랜 지원
- 인덱스 추가: `idx_student_plan_subject_type` (필터링 성능 향상)
- 코멘트 추가: 컬럼 설명

### 2. TypeScript 타입 정의 수정

#### 2.1 Plan 타입 (`lib/types/plan/domain.ts`)

```typescript
export type Plan = {
  // ... 기존 필드들
  subject_type?: "strategy" | "weakness" | null; // 전략/취약 정보
  // ...
};
```

#### 2.2 ScheduledPlan 타입 (`lib/plan/scheduler.ts`)

```typescript
export type ScheduledPlan = {
  // ... 기존 필드들
  subject_type?: "strategy" | "weakness" | null; // 전략/취약 정보
};
```

#### 2.3 GeneratePlanPayload 타입 (`lib/types/plan-generation.ts`)

```typescript
export type PlanPayloadBase = {
  // ... 기존 필드들
  subject_type?: "strategy" | "weakness" | null; // 전략/취약 정보
};
```

#### 2.4 Plan 타입 (UI 컴포넌트용) (`app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleTypes.ts`)

```typescript
export type Plan = {
  // ... 기존 필드들
  subject_type?: "strategy" | "weakness" | null; // 전략/취약 정보
};
```

### 3. 플랜 생성 로직 수정

#### 3.1 generatePlansFromGroup 함수 (`lib/plan/scheduler.ts`)

플랜 생성 후 각 플랜에 대해 `getEffectiveAllocation` 함수를 사용하여 `subject_type`을 계산하고 할당:

```typescript
// 5. 각 플랜에 subject_type 계산 및 할당
const schedulerOptions = group.scheduler_options as SchedulerOptions | null;
const contentAllocations = schedulerOptions?.content_allocations as
  | Array<{
      content_type: "book" | "lecture" | "custom";
      content_id: string;
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }>
  | undefined;
const subjectAllocations = schedulerOptions?.subject_allocations as
  | Array<{
      subject_id?: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }>
  | undefined;

// 각 플랜에 대해 subject_type 계산
for (const plan of plans) {
  const content = contentInfos.find((c) => c.content_id === plan.content_id);
  if (content) {
    const allocation = getEffectiveAllocation(
      {
        content_type: content.content_type,
        content_id: content.content_id,
        subject_category: content.subject_category || undefined,
        subject: content.subject || undefined,
        subject_id: undefined,
      },
      contentAllocations,
      subjectAllocations,
      false // 프로덕션에서는 로깅 비활성화
    );
    plan.subject_type = allocation.subject_type;
  }
}
```

#### 3.2 createGeneratePlanPayload 함수 (`lib/plan/scheduleProcessor.ts`)

`originalPlan`에서 `subject_type`을 가져와서 페이로드에 포함:

```typescript
return {
  // ... 기존 필드들
  subject_type: originalPlan?.subject_type || null,
};
```

### 4. 데이터베이스 저장 로직 수정

#### 4.1 CreatePlanInput 타입 (`lib/data/studentPlans.ts`)

```typescript
export type CreatePlanInput = {
  // ... 기존 필드들
  subject_type?: "strategy" | "weakness" | null; // 전략/취약 정보
};
```

#### 4.2 createPlan 함수 (`lib/data/studentPlans.ts`)

`subject_type`을 페이로드에 포함:

```typescript
// 전략/취약 정보가 있으면 추가
if (plan.subject_type !== undefined) {
  payload.subject_type = plan.subject_type;
}
```

#### 4.3 generatePlansRefactored 함수 (`app/(student)/actions/plan-groups/generatePlansRefactored.ts`)

플랜 저장 시 `subject_type` 포함:

```typescript
planPayloads.push({
  // ... 기존 필드들
  subject_type: originalPlan?.subject_type || null, // 전략/취약 정보
});
```

### 5. PlanListView 컴포넌트 수정

#### 5.1 PlanTableRow 타입 수정 (`app/(student)/plan/group/[id]/_components/PlanListView.tsx`)

```typescript
type PlanTableRow = {
  // ... 기존 필드들
  subject_type?: "strategy" | "weakness" | null; // 전략/취약 정보
};
```

#### 5.2 테이블 데이터 변환 로직 수정

```typescript
return {
  // ... 기존 필드들
  subject_type: plan.subject_type || null,
};
```

#### 5.3 콘텐츠명 컬럼에 배지 추가

```typescript
{
  accessorKey: "content_title",
  header: "콘텐츠명",
  cell: ({ row }) => {
    const subjectType = row.original.subject_type;
    const contentTitle = row.original.content_title || "-";
    
    // 전략/취약 배지 컴포넌트
    const Badge = ({ type }: { type: "strategy" | "weakness" }) => {
      const config = {
        strategy: {
          label: "전략",
          className: "bg-blue-100 text-blue-800",
        },
        weakness: {
          label: "취약",
          className: "bg-red-100 text-red-800",
        },
      };
      const { label, className } = config[type];
      
      return (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-1 ${className}`}
        >
          {label}
        </span>
      );
    };
    
    return (
      <div className="max-w-[200px] truncate flex items-center gap-1" title={contentTitle}>
        {subjectType === "strategy" && <Badge type="strategy" />}
        {subjectType === "weakness" && <Badge type="weakness" />}
        <span>{contentTitle}</span>
      </div>
    );
  },
  enableSorting: true,
  size: 200,
},
```

## 하위 호환성 고려사항

- 기존 플랜의 `subject_type`은 NULL로 유지 (기존 데이터 보존)
- `subject_type`이 없는 경우 배지 표시하지 않음
- 플랜 재생성 시에만 `subject_type` 계산 및 저장

## 성능 고려사항

- `getEffectiveAllocation` 호출은 플랜 생성 시에만 수행 (조회 시에는 DB에서 읽기)
- 인덱스 추가로 필터링 성능 향상
- 배지 렌더링은 클라이언트 사이드에서만 수행 (서버 부하 없음)

## 마이그레이션 가이드

### 1. 데이터베이스 마이그레이션 실행

```bash
# Supabase CLI를 사용하는 경우
supabase migration up

# 또는 Supabase Dashboard에서 직접 실행
```

### 2. 애플리케이션 배포

마이그레이션 실행 후 애플리케이션을 배포합니다.

### 3. 기존 플랜 처리

- 기존 플랜은 `subject_type`이 NULL로 유지됩니다.
- 플랜을 재생성하면 새로운 `subject_type`이 계산되어 저장됩니다.

## 테스트 체크리스트

- [ ] 마이그레이션 실행 확인
- [ ] 플랜 생성 시 `subject_type`이 올바르게 저장되는지 확인
- [ ] PlanListView에서 배지가 올바르게 표시되는지 확인
- [ ] 기존 플랜이 정상적으로 표시되는지 확인 (NULL 처리)
- [ ] 전략과목/취약과목 설정이 올바르게 반영되는지 확인

## 관련 파일

### 마이그레이션
- `supabase/migrations/20251221200303_add_subject_type_to_plans.sql`

### 타입 정의
- `lib/types/plan/domain.ts`
- `lib/plan/scheduler.ts`
- `lib/types/plan-generation.ts`
- `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleTypes.ts`

### 비즈니스 로직
- `lib/plan/scheduler.ts`
- `lib/plan/scheduleProcessor.ts`
- `lib/data/studentPlans.ts`
- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

### UI 컴포넌트
- `app/(student)/plan/group/[id]/_components/PlanListView.tsx`

## 참고

- `getEffectiveAllocation` 함수는 `lib/utils/subjectAllocation.ts`에 정의되어 있습니다.
- 전략/취약 정보는 `scheduler_options`의 `content_allocations` 또는 `subject_allocations`에서 가져옵니다.

