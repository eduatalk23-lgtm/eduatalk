# TypeScript 컴파일 에러 수정

## 작업 개요

TypeScript 컴파일 에러 14개를 모두 수정했습니다.

## 수정된 에러 목록

### 1. `cn` export 에러 (4개 파일)
**문제**: `@/lib/utils/darkMode`에서 `cn`을 import하려고 했지만 export되지 않음

**수정 파일**:
- `lib/utils/darkMode.ts`: `cn` 함수를 re-export 추가
- `app/(student)/contents/_components/FilterBar.tsx`
- `app/(student)/dashboard/_components/MonthlyReportSection.tsx`
- `app/(student)/dashboard/_components/RecommendationCard.tsx`
- `app/(student)/dashboard/_components/TimeStatistics.tsx`

**수정 내용**:
```typescript
// lib/utils/darkMode.ts
import { cn } from "@/lib/cn";

// cn 함수 re-export (다른 파일에서 darkMode.ts에서 import할 수 있도록)
export { cn };
```

### 2. `CampTemplate` 타입 호환성 문제 (3개 파일)
**문제**: `CampTemplate`의 `template_data`가 `Json` 타입과 호환되지 않음. 특히 `recommended_contents`의 `recommendation_metadata`가 `Record<string, unknown> | null`인데 `Json`에 할당할 수 없음.

**수정 파일**:
- `lib/camp/campAdapter.ts`: `parseCampConfiguration` 함수 내부에서 타입 단언 사용
- `app/(admin)/admin/plan-groups/[id]/page.tsx`: 호출 시 타입 단언 추가
- `app/(student)/camp/[invitationId]/submitted/page.tsx`: 호출 시 타입 단언 추가
- `app/(student)/plan/group/[id]/page.tsx`: 호출 시 타입 단언 추가

**수정 내용**:
```typescript
// lib/camp/campAdapter.ts
export async function parseCampConfiguration(
  supabase: SupabaseClient,
  group: Pick<PlanGroup, "camp_template_id" | "scheduler_options">,
  template: CampTemplate | null,
  tenantId: string | null
): Promise<CampPlanConfig> {
  // 타입 호환성을 위해 template을 any로 캐스팅하여 처리
  const templateAny = template as any;
  
  // ...
  const templateData = templateAny
    ? parseTemplateData(templateAny.template_data)
    : null;
}

// 호출하는 쪽
const campConfig = await parseCampConfiguration(
  supabase,
  group,
  template as any, // 타입 단언
  tenantContext?.tenantId || null
);
```

### 3. `plan_type` 속성 문제
**문제**: `PlanGroup` 타입에 `plan_type` 속성이 없음

**수정 파일**:
- `app/(student)/today/_components/PlanGroupCard.tsx`

**수정 내용**:
`plan_type`을 직접 사용하는 대신 `campMode` prop으로 전달받도록 변경:
```typescript
type PlanGroupCardProps = {
  // ...
  campMode?: boolean; // 캠프 모드 여부
};

function PlanGroupCardComponent({
  // ...
  campMode = false,
}: PlanGroupCardProps) {
  // group.plan_type === "camp" 대신 campMode prop 사용
}
```

### 4. `borderDefault` import 누락
**문제**: `PlanRangeAdjustModal.tsx`에서 `borderDefault`를 사용하지만 import하지 않음

**수정 파일**:
- `app/(student)/today/_components/PlanRangeAdjustModal.tsx`

**수정 내용**:
```typescript
import {
  // ...
  borderDefault,
} from "@/lib/utils/darkMode";
```

### 5. `campMode` prop 누락
**문제**: `DailyPlanViewProps`에 `campMode` prop이 없음

**수정 파일**:
- `app/(student)/today/_components/DailyPlanView.tsx`

**수정 내용**:
```typescript
type DailyPlanViewProps = {
  // ...
  campMode?: boolean; // 캠프 모드 여부
};

export function DailyPlanView({
  // ...
  campMode = false,
}: DailyPlanViewProps) {
  // ...
  <PlanGroupCard
    // ...
    campMode={campMode}
  />
}
```

### 6. `URLSearchParams` import 에러
**문제**: `next/navigation`에서 `URLSearchParams`를 import하려고 했지만, 이는 브라우저 전역 객체임

**수정 파일**:
- `components/navigation/global/categoryNavUtils.ts`

**수정 내용**:
```typescript
// 수정 전
import type { URLSearchParams } from "next/navigation";
const params = new URLSearchParams(queryString);
params.forEach((value, key) => { // 타입 에러

// 수정 후
// import 제거 (브라우저 전역 객체 사용)
const params = new URLSearchParams(queryString);
params.forEach((value: string, key: string) => { // 명시적 타입 지정
```

## 수정 결과

- **수정 전**: 14개 TypeScript 에러
- **수정 후**: 0개 에러

## 관련 파일

### 수정된 파일 목록
1. `lib/utils/darkMode.ts`
2. `lib/camp/campAdapter.ts`
3. `app/(admin)/admin/plan-groups/[id]/page.tsx`
4. `app/(student)/camp/[invitationId]/submitted/page.tsx`
5. `app/(student)/plan/group/[id]/page.tsx`
6. `app/(student)/today/_components/PlanGroupCard.tsx`
7. `app/(student)/today/_components/PlanRangeAdjustModal.tsx`
8. `app/(student)/today/_components/DailyPlanView.tsx`
9. `components/navigation/global/categoryNavUtils.ts`

## 참고 사항

### 타입 단언 사용 이유
`CampTemplate`의 `template_data` 필드가 Supabase의 `Json` 타입과 완전히 호환되지 않아 타입 단언(`as any`)을 사용했습니다. 이는 다음 이유 때문입니다:

1. `recommended_contents` 배열의 `recommendation_metadata`가 `Record<string, unknown> | null` 타입
2. `Json` 타입은 `string | number | boolean | null | { [key: string]: Json | undefined } | Json[]`로 정의됨
3. `Record<string, unknown>`이 `Json`의 인덱스 시그니처와 완전히 일치하지 않음

런타임에서는 문제가 없지만, TypeScript의 엄격한 타입 검사로 인해 타입 단언이 필요했습니다.

## 작업 일시

2025년 2월 5일

