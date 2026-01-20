# AI 플랜 생성 ↔ 플래너 시스템 통합 개선 분석

> 작성일: 2026-01-20
> 상태: 분석 완료, 구현 대기

## 1. 문제 개요

### 1.1 발견된 문제

AI 플랜 생성 기능(`batchAIPlanGeneration`, `generateHybridPlanComplete`)이 Phase 3에서 완료된 **플래너/플랜 관리 시스템 통합**과 연계되지 않음.

| 구분 | 현재 상태 | 목표 상태 |
|------|----------|----------|
| `planner_id` | ❌ 미전달 | ✅ 플래너 연결 필수 |
| `is_single_content` | ❌ 미전달 (기본값 false) | ✅ true 설정 |
| `creation_mode` | ❌ 미전달 | ✅ 'ai_batch' 또는 'ai_hybrid' |
| 콘텐츠별 Plan Group | ❌ 1개 Plan Group에 여러 콘텐츠 | ✅ 콘텐츠당 1개 Plan Group |

### 1.2 영향

1. **캘린더 통합 문제**: AI 생성 플랜이 플래너 뷰에서 분리됨
2. **스케줄러 조율 불가**: Planner 기반 시간 슬롯 조율이 적용 안 됨
3. **데이터 일관성**: 단일 콘텐츠 모드 원칙 위반
4. **진행률 추적**: 콘텐츠별 진행 상황 추적 어려움

---

## 2. 현재 아키텍처 분석

### 2.1 플래너 시스템 구조 (Phase 3 완료)

```
┌─────────────────────────────────────────────────────────────────┐
│ Planner (플래너)                                                │
│ - scheduler_options (조율 정보)                                 │
│ - 여러 Plan Group의 "허브" 역할                                 │
└─────────────────────────────────────────────────────────────────┘
                              │ 1:N (planner_id)
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Plan Group A    │  │ Plan Group B    │  │ Plan Group C    │
│ is_single_      │  │ is_single_      │  │ is_single_      │
│ content: true   │  │ content: true   │  │ content: true   │
│ content_type    │  │ content_type    │  │ content_type    │
│ content_id      │  │ content_id      │  │ content_id      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
    student_plan        student_plan        student_plan
```

### 2.2 AI 플랜 생성 현재 흐름

#### 2.2.1 batchAIPlanGeneration (배치)

```typescript
// lib/domains/admin-plan/actions/batchAIPlanGeneration.ts:567-588

const groupInput: AtomicPlanGroupInput = {
  tenant_id: tenantId,
  student_id: studentId,
  name: groupName,
  // ❌ planner_id 없음
  // ❌ is_single_content 없음
  // ❌ creation_mode 없음
  scheduler_type: "ai_batch",
  period_start: settings.startDate,
  period_end: settings.endDate,
  status: "active",
  plan_type: "ai",
  // ... 기타 필드
};

const groupResult = await createPlanGroupAtomic(groupInput, [], [], [], true);
```

**문제점**:
- 플래너 연결 없이 Plan Group 직접 생성
- 여러 콘텐츠를 1개 Plan Group에 할당
- 단일 콘텐츠 모드 미적용

#### 2.2.2 generateHybridPlanComplete (하이브리드)

```typescript
// lib/domains/plan/llm/actions/generateHybridPlanComplete.ts:362-378

const planResult = await generatePlansWithServices({
  groupId: input.planGroupId,  // 기존 planGroupId 사용
  context: { ... },
  aiSchedulerOptionsOverride: aiSchedulerOverride,
});
```

**문제점**:
- 이미 생성된 Plan Group을 받아서 사용
- Plan Group 생성 시점의 플래너 연계는 호출자 책임
- 단일 콘텐츠 검증 없음

### 2.3 TypeScript 타입 불일치

```typescript
// lib/domains/plan/transactions.ts:17-38

export type AtomicPlanGroupInput = {
  tenant_id: string;
  student_id: string;
  name: string | null;
  // ❌ planner_id 없음
  // ❌ is_single_content 없음
  // ❌ creation_mode 없음
  // ❌ content_type 없음
  // ❌ content_id 없음
  // ... 레거시 필드들만 존재
};
```

**RPC 함수는 이미 지원** (20260119120000_update_rpc_single_content_support.sql):
```sql
INSERT INTO plan_groups (
  ...
  planner_id,
  creation_mode,
  is_single_content,
  content_type,
  content_id,
  ...
)
```

---

## 3. 영향 범위

### 3.1 수정 필요 파일

| 파일 | 변경 내용 | 우선순위 |
|------|----------|----------|
| `lib/domains/plan/transactions.ts` | `AtomicPlanGroupInput` 타입 확장 | P0 |
| `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts` | 플래너 연계 로직 추가 | P0 |
| `lib/domains/plan/llm/actions/generateHybridPlanComplete.ts` | 입력 검증 및 플래너 연계 | P1 |
| `app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx` | 플래너 선택 UI | P1 |
| `app/(admin)/admin/students/_components/BatchAIPlanModalContent.tsx` | 배치 생성 시 플래너 처리 | P1 |

### 3.2 호출 관계도

```
[UI Layer]
├── AdminAIPlanModal.tsx
│   └── generateHybridPlanCompleteAction()
│       └── generatePlansWithServices()
│           └── (기존 planGroupId 사용)
│
├── BatchAIPlanModalContent.tsx
│   └── batchAIPlanGenerationAction()
│       └── createPlanGroupAtomic()  ← ❌ 플래너 미연결
│           └── generatePlansAtomic()

[Action Layer]
├── generateHybridPlanComplete.ts
│   └── planGroupId만 받음 (플래너 연계 책임 외부화)
│
└── batchAIPlanGeneration.ts
    └── AtomicPlanGroupInput 사용 (타입 미확장)

[Data Layer]
└── transactions.ts
    └── AtomicPlanGroupInput 타입 (Phase 3 필드 누락)
```

---

## 4. 개선 방안

### 4.1 Phase 1: 타입 확장 (즉시)

#### 4.1.1 AtomicPlanGroupInput 타입 확장

```typescript
// lib/domains/plan/transactions.ts

export type AtomicPlanGroupInput = {
  // 기존 필드들...
  
  // Phase 3 추가 필드
  planner_id?: string | null;
  creation_mode?: string | null;
  plan_mode?: string | null;
  is_single_day?: boolean;
  study_type?: string | null;
  strategy_days_per_week?: number | null;
  
  // 단일 콘텐츠 모드 필드
  content_type?: string | null;
  content_id?: string | null;
  master_content_id?: string | null;
  start_range?: number | null;
  end_range?: number | null;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
  is_single_content?: boolean;
};
```

#### 4.1.2 createPlanGroupAtomic 함수 업데이트

```typescript
// planGroupJsonb 매핑에 새 필드 추가
const planGroupJsonb = {
  // 기존 필드들...
  
  // Phase 3 필드
  planner_id: groupData.planner_id ?? null,
  creation_mode: groupData.creation_mode ?? null,
  plan_mode: groupData.plan_mode ?? null,
  is_single_day: groupData.is_single_day ?? false,
  study_type: groupData.study_type ?? null,
  strategy_days_per_week: groupData.strategy_days_per_week ?? null,
  
  // 단일 콘텐츠 모드
  content_type: groupData.content_type ?? null,
  content_id: groupData.content_id ?? null,
  master_content_id: groupData.master_content_id ?? null,
  start_range: groupData.start_range ?? null,
  end_range: groupData.end_range ?? null,
  start_detail_id: groupData.start_detail_id ?? null,
  end_detail_id: groupData.end_detail_id ?? null,
  is_single_content: groupData.is_single_content ?? false,
};
```

### 4.2 Phase 2: batchAIPlanGeneration 수정

#### 4.2.1 플래너 확보 로직 추가

```typescript
// lib/domains/admin-plan/actions/batchAIPlanGeneration.ts

async function generatePlanForStudent(...) {
  // 1. 플래너 확보 (없으면 자동 생성)
  const { getOrCreateDefaultPlannerAction } = await import(
    "@/lib/domains/plan/actions/planners/autoCreate"
  );
  
  const plannerResult = await getOrCreateDefaultPlannerAction({
    studentId,
    periodStart: settings.startDate,
    periodEnd: settings.endDate,
  });
  
  if (!plannerResult.plannerId) {
    return {
      studentId,
      studentName: student.name,
      status: "error",
      error: "기본 플래너 생성 실패",
      failedStep: "planner",
    };
  }
  
  const plannerId = plannerResult.plannerId;
  
  // 2. 콘텐츠별 Plan Group 생성 (단일 콘텐츠 모드)
  for (const content of contents) {
    const groupInput: AtomicPlanGroupInput = {
      tenant_id: tenantId,
      student_id: studentId,
      name: `${content.title} (${settings.startDate} ~ ${settings.endDate})`,
      
      // 플래너 연계
      planner_id: plannerId,
      creation_mode: "ai_batch",
      is_single_content: true,
      
      // 단일 콘텐츠 정보
      content_type: content.contentType,
      content_id: content.id,
      start_range: content.startRange ?? 1,
      end_range: content.endRange ?? content.totalRange,
      
      // 기타 설정
      period_start: settings.startDate,
      period_end: settings.endDate,
      status: "active",
      plan_type: "ai",
      scheduler_type: "ai_batch",
      // ...
    };
    
    const groupResult = await createPlanGroupAtomic(groupInput, [], [], [], true);
    // ...
  }
}
```

#### 4.2.2 콘텐츠별 분할 생성

**현재**: 여러 콘텐츠 → 1개 Plan Group
**변경**: 여러 콘텐츠 → 콘텐츠 수만큼 Plan Group

```typescript
// 배치 입력 구조 변경
interface BatchPlanGenerationInput {
  students: Array<{
    studentId: string;
    contentIds: string[];  // 이전과 동일
  }>;
  settings: BatchPlanSettings;
}

// 내부 처리 변경
async function generatePlanForStudent(studentId, contentIds, settings) {
  // 플래너 확보
  const plannerId = await ensurePlanner(studentId, settings);
  
  // 콘텐츠별로 Plan Group 생성
  const results = [];
  for (const contentId of contentIds) {
    const content = await loadContent(contentId);
    const groupResult = await createSingleContentPlanGroup(
      plannerId,
      content,
      settings
    );
    results.push(groupResult);
  }
  
  return results;
}
```

### 4.3 Phase 3: generateHybridPlanComplete 개선

#### 4.3.1 플래너 연계 검증 추가

```typescript
// lib/domains/plan/llm/actions/generateHybridPlanComplete.ts

interface GenerateHybridPlanCompleteInput {
  planGroupId: string;
  plannerId?: string;  // 새로 추가 (선택적)
  // ...
}

async function _generateHybridPlanComplete(input) {
  // 1. Plan Group 정보 조회
  const planGroup = await getPlanGroup(input.planGroupId);
  
  // 2. 플래너 연결 확인
  if (!planGroup.planner_id && !input.plannerId) {
    // 경고 로깅 (레거시 호환성 유지)
    logActionWarn(
      { domain: "plan", action: "generateHybridPlanComplete" },
      "플래너 미연결 Plan Group에서 AI 플랜 생성",
      { planGroupId: input.planGroupId }
    );
  }
  
  // 3. 단일 콘텐츠 모드 확인
  if (!planGroup.is_single_content) {
    // 다중 콘텐츠 모드 - 레거시 처리
    logActionWarn(
      { domain: "plan", action: "generateHybridPlanComplete" },
      "다중 콘텐츠 Plan Group - 레거시 모드",
      { planGroupId: input.planGroupId }
    );
  }
  
  // 4. 기존 로직 계속...
}
```

### 4.4 Phase 4: UI 개선

#### 4.4.1 AdminAIPlanModal 플래너 선택

```tsx
// app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx

// 플래너 선택 드롭다운 추가
const [selectedPlannerId, setSelectedPlannerId] = useState<string | null>(null);
const [planners, setPlanners] = useState<Planner[]>([]);

// Plan Group 생성 시 플래너 연결
const handleCreatePlanGroup = async () => {
  const groupResult = await createPlanGroupAction({
    studentId,
    plannerId: selectedPlannerId,
    isSingleContent: true,
    // ...
  });
};
```

#### 4.4.2 BatchAIPlanModalContent 플래너 자동 처리

```tsx
// 배치 생성 시 각 학생별로 기본 플래너 자동 사용
// UI에서는 "기본 플래너 사용" 체크박스만 표시
const [useDefaultPlanner, setUseDefaultPlanner] = useState(true);
```

---

## 5. 구현 계획

### 5.1 작업 순서

```
Phase 1: 타입 확장 (1시간)
├── [ ] AtomicPlanGroupInput 타입 확장
├── [ ] createPlanGroupAtomic 함수 업데이트
└── [ ] 테스트

Phase 2: batchAIPlanGeneration 수정 (2시간)
├── [ ] 플래너 확보 로직 추가
├── [ ] 콘텐츠별 Plan Group 분할 생성
├── [ ] 기존 테스트 업데이트
└── [ ] 통합 테스트

Phase 3: generateHybridPlanComplete 개선 (1시간)
├── [ ] 플래너 연계 검증 추가
├── [ ] 경고 로깅 추가
└── [ ] 테스트

Phase 4: UI 개선 (선택적, 2시간)
├── [ ] AdminAIPlanModal 플래너 선택 UI
├── [ ] BatchAIPlanModalContent 개선
└── [ ] E2E 테스트
```

### 5.2 하위 호환성

| 시나리오 | 처리 방법 |
|----------|----------|
| 기존 AI 생성 Plan Group | 플래너 미연결 상태 유지 (레거시) |
| 새 API 호출 시 플래너 미제공 | 기본 플래너 자동 생성/연결 |
| 다중 콘텐츠 Plan Group | `is_single_content: false`로 유지 |

### 5.3 테스트 계획

```typescript
describe("AI Plan Generation - Planner Integration", () => {
  it("should create planner if not exists", async () => {
    const result = await batchAIPlanGenerationAction({
      students: [{ studentId: "...", contentIds: ["..."] }],
      settings: { ... },
    });
    
    expect(result.results[0].planGroupId).toBeDefined();
    const planGroup = await getPlanGroup(result.results[0].planGroupId);
    expect(planGroup.planner_id).not.toBeNull();
  });
  
  it("should create single content plan groups per content", async () => {
    const result = await batchAIPlanGenerationAction({
      students: [{ studentId: "...", contentIds: ["c1", "c2", "c3"] }],
      settings: { ... },
    });
    
    // 3개 콘텐츠 → 3개 Plan Group
    expect(result.results[0].planGroupIds).toHaveLength(3);
  });
});
```

---

## 6. 참고 자료

- **관련 메모리**: `plan-system-unification-architecture`
- **RPC 마이그레이션**: `20260119120000_update_rpc_single_content_support.sql`
- **플래너 자동 생성**: `lib/domains/plan/actions/planners/autoCreate.ts`
- **Plan Group 선택**: `lib/domains/admin-plan/utils/planGroupSelector.ts`

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-20 | 초안 작성 - 문제 분석 및 개선 방안 설계 |
| 2026-01-20 | Phase 1 완료: AtomicPlanGroupInput 타입 확장, createPlanGroupAtomic 업데이트 |
| 2026-01-20 | Phase 2 부분 완료: batchAIPlanGeneration 플래너 연계 로직 추가 (ensurePlannerForStudent 헬퍼 함수, groupInput에 planner_id/creation_mode/is_single_content 필드 추가) |
| 2026-01-20 | Phase 2 완료: 콘텐츠별 Plan Group 분할 생성 구현 (is_single_content: true, 콘텐츠당 1개 Plan Group) |
| 2026-01-20 | Phase 3 완료: generateHybridPlanComplete 플래너 연계 검증 추가 (Plan Group 정보 조회, planner_id/is_single_content 경고 로깅) |
