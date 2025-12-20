# Repomix Phase별 상세 개선 제안서

**작성 일시**: 2025-02-04  
**분석 대상**: Phase 2, 3, 4 (개선 필요)

---

## Phase 2: 공통 유틸리티 및 UI 컴포넌트 개선

### 1. 유틸리티 함수 타입 개선

#### 현재 코드

```typescript
// lib/utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  // ...
}
```

#### 개선 제안

```typescript
// lib/utils/debounce.ts
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
```

**개선 효과**:
- `any[]` → `never[]`로 변경하여 타입 안전성 향상
- `any` → `unknown`으로 변경하여 타입 안전성 향상

---

### 2. 타입 캐스팅 제거

#### 현재 코드

```typescript
// lib/utils/planGroupAdapters.ts
student_contents: studentContents as any,
recommended_contents: recommendedContents as any,
```

#### 개선 제안

```typescript
// lib/types/plan.ts
export interface PlanContent {
  id: string;
  master_content_id: string | null;
  content_type: ContentType;
  // ... 기타 필드
}

// lib/utils/planGroupAdapters.ts
import type { PlanContent } from "@/lib/types/plan";

function adaptPlanGroupData(data: PlanGroupRow): PlanGroup {
  return {
    // ...
    student_contents: data.student_contents as PlanContent[],
    recommended_contents: data.recommended_contents as PlanContent[],
    // ...
  };
}
```

**개선 효과**:
- 명시적 타입 정의로 타입 안전성 향상
- IDE 자동완성 지원 개선

---

### 3. TODO 주석 처리

#### 현재 코드

```typescript
// lib/utils/scheduler.ts
travel_time: undefined, // TODO: travel_time 저장/로드 추가 필요
```

#### 개선 제안

```typescript
// lib/types/scheduler.ts
export interface SchedulerOptions {
  travel_time?: number; // 분 단위 이동 시간
  // ... 기타 옵션
}

// lib/utils/scheduler.ts
import type { SchedulerOptions } from "@/lib/types/scheduler";

function createSchedulerOptions(data: PlanGroupRow): SchedulerOptions {
  return {
    travel_time: data.travel_time ?? undefined,
    // ... 기타 옵션
  };
}
```

---

## Phase 3: 학생 핵심 기능 개선

### 1. PlanStatus 타입 정의

#### 현재 코드

```typescript
// app/(student)/plan/_components/PlanGroupListItem.tsx
groupStatus={group.status as any}
```

#### 개선 제안

```typescript
// lib/types/plan.ts
export type PlanStatus = 
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";

export interface PlanGroup {
  id: string;
  name: string;
  status: PlanStatus;
  // ... 기타 필드
}

// app/(student)/plan/_components/PlanGroupListItem.tsx
import type { PlanStatus } from "@/lib/types/plan";

interface PlanGroupListItemProps {
  group: PlanGroup;
  // ...
}

<PlanGroupDeleteDialog
  groupStatus={group.status} // 타입 캐스팅 불필요
  // ...
/>
```

---

### 2. RecommendationItem 타입 정의

#### 현재 코드

```typescript
// app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/hooks/useRecommendations.ts
items: rawRecommendations.map((r: any) => ({
  // ...
}))
```

#### 개선 제안

```typescript
// lib/types/recommendations.ts
export interface RecommendationItem {
  id: string;
  master_content_id: string;
  title: string;
  content_type: ContentType;
  difficulty_level: DifficultyLevel;
  // ... 기타 필드
}

// hooks/useRecommendations.ts
import type { RecommendationItem } from "@/lib/types/recommendations";

function transformRecommendations(
  raw: RawRecommendation[]
): RecommendationItem[] {
  return raw.map((r): RecommendationItem => ({
    id: r.id,
    master_content_id: r.master_content_id,
    title: r.title,
    content_type: r.content_type,
    difficulty_level: r.difficulty_level,
    // ... 기타 필드
  }));
}
```

---

### 3. SchedulerOptions 인터페이스 정의

#### 현재 코드

```typescript
// app/(student)/plan/new-group/_components/PlanGroupWizard.tsx
let schedulerOptions: Record<string, any> = {
  // ...
};
```

#### 개선 제안

```typescript
// lib/types/scheduler.ts
export interface SchedulerOptions {
  daily_schedule?: DailySchedule;
  subject_constraints?: SubjectConstraints;
  additional_period_reallocation?: AdditionalPeriodReallocation;
  non_study_time_blocks?: NonStudyTimeBlock[];
  study_hours?: number;
  self_study_hours?: number;
  travel_time?: number;
}

// app/(student)/plan/new-group/_components/PlanGroupWizard.tsx
import type { SchedulerOptions } from "@/lib/types/scheduler";

const schedulerOptions: SchedulerOptions = {
  daily_schedule: wizardData.daily_schedule,
  subject_constraints: wizardData.subject_constraints,
  // ... 기타 옵션
};
```

---

### 4. SupabaseAnyClient 타입 개선

#### 현재 코드

```typescript
// lib/plan/scheduler.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAnyClient = SupabaseClient<any>;
```

#### 개선 제안

```typescript
// lib/supabase/types.ts
import type { Database } from "@/lib/supabase/database.types";

export type SupabaseTypedClient = SupabaseClient<Database>;

// lib/plan/scheduler.ts
import type { SupabaseTypedClient } from "@/lib/supabase/types";

function generatePlan(
  queryClient: SupabaseTypedClient,
  masterQueryClient: SupabaseTypedClient
) {
  // 타입 안전한 쿼리 사용 가능
}
```

---

## Phase 4: 관리자 및 컨설턴트 모듈 개선

### 1. 에러 핸들링 개선

#### 현재 코드

```typescript
// app/(admin)/actions/camp-templates/progress.ts
} catch (error: any) {
  console.error("Error:", error);
  // ...
}
```

#### 개선 제안

```typescript
// lib/errors/errorHandler.ts
export function handleError(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  
  if (typeof error === "string") {
    return {
      message: error,
    };
  }
  
  return {
    message: "알 수 없는 오류가 발생했습니다.",
  };
}

// app/(admin)/actions/camp-templates/progress.ts
import { handleError } from "@/lib/errors/errorHandler";

try {
  // ...
} catch (error: unknown) {
  const errorInfo = handleError(error);
  console.error("Error:", errorInfo);
  // ...
}
```

---

### 2. ZodResolver 타입 명시

#### 현재 코드

```typescript
// app/(admin)/students/create/_components/CreateStudentForm.tsx
const form = useForm<CreateStudentFormData>({
  resolver: zodResolver(createStudentFormSchema) as any,
  // ...
});
```

#### 개선 제안

```typescript
// app/(admin)/students/create/_components/CreateStudentForm.tsx
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";

const form = useForm<CreateStudentFormData>({
  resolver: zodResolver(createStudentFormSchema as ZodType<CreateStudentFormData>),
  // ...
});
```

**또는 더 나은 방법**:

```typescript
// lib/validation/schemas.ts
import { z } from "zod";

export const createStudentFormSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  // ... 기타 필드
});

export type CreateStudentFormData = z.infer<typeof createStudentFormSchema>;

// app/(admin)/students/create/_components/CreateStudentForm.tsx
const form = useForm<CreateStudentFormData>({
  resolver: zodResolver(createStudentFormSchema), // 타입 캐스팅 불필요
  // ...
});
```

---

### 3. PreviewData 인터페이스 정의

#### 현재 코드

```typescript
// app/(admin)/camp-templates/[id]/_components/CampTemplateProgress.tsx
previewData?: any[];
```

#### 개선 제안

```typescript
// lib/types/camp.ts
export interface CampPreviewData {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  participants: number;
  // ... 기타 필드
}

// app/(admin)/camp-templates/[id]/_components/CampTemplateProgress.tsx
import type { CampPreviewData } from "@/lib/types/camp";

interface CampTemplateProgressProps {
  previewData?: CampPreviewData[];
  // ...
}
```

---

### 4. TODO 주석 처리 우선순위

#### 높은 우선순위

1. **테스트 코드 작성**
   ```typescript
   // __tests__/integration/camp-templates/progress.test.ts
   describe("Camp Template Progress", () => {
     it("should validate permissions correctly", () => {
       // 권한 검증 로직 테스트
     });
     
     it("should isolate tenants correctly", () => {
       // 테넌트 격리 테스트
     });
   });
   ```

2. **progress.ts 파일 생성 및 이동**
   ```typescript
   // lib/camp/progress.ts
   export async function calculateCampProgress(
     templateId: string
   ): Promise<CampProgress> {
     // 진행률 계산 로직
   }
   ```

3. **revision_id 관계 스키마 추가**
   ```sql
   -- supabase/migrations/XXXX_add_revision_id_relation.sql
   ALTER TABLE content_metadata
   ADD COLUMN revision_id UUID REFERENCES revisions(id);
   ```

---

## 실행 계획

### Week 1: 타입 정의 추가

1. **Day 1-2**: Phase 3 타입 정의
   - `PlanStatus`, `RecommendationItem`, `SchedulerOptions` 타입 정의
   - `SupabaseAnyClient` → `SupabaseTypedClient` 변경

2. **Day 3-4**: Phase 4 타입 정의
   - `PreviewData` 인터페이스 정의
   - `ZodResolver` 타입 명시
   - 에러 핸들링 개선

3. **Day 5**: Phase 2 유틸리티 함수 개선
   - `debounce`, `throttle`, `memoize` 타입 개선

### Week 2: 타입 캐스팅 제거

1. **Day 1-3**: Phase 2 타입 캐스팅 제거
   - `planGroupAdapters.ts` 개선
   - `planVersionUtils.ts` 개선
   - `contentFilters.ts` 개선

2. **Day 4-5**: Phase 3 타입 캐스팅 제거
   - `PlanGroupListItem.tsx` 개선
   - `PlanGroupWizard.tsx` 개선

### Week 3: TODO 주석 처리

1. **Day 1-3**: Phase 4 테스트 코드 작성
   - 권한 검증 테스트
   - 테넌트 격리 테스트

2. **Day 4-5**: Phase 3 TODO 처리
   - Supabase 클라이언트 서버에서 가져오는 방법 수정
   - `subject_type_id`로 실제 타입 조회 구현

---

## 참고 문서

- [Repomix AI 종합 분석 보고서](./2025-02-04-repomix-ai-analysis-comprehensive.md)
- [Repomix 개선 진행 상태 점검](./2025-02-04-repomix-improvement-status-check.md)

