# 논리 플랜 목록 표시 수정

## 작업 일시
2024-12-09

## 문제 상황
플랜 그룹 상세 페이지의 "논리 플랜" 탭에서 "이 플랜 그룹에는 논리 플랜이 정의되지 않았습니다" 메시지가 표시되었습니다. 실제로는 논리 플랜이 존재할 수 있지만, 서버에서 조회하지 않아 컴포넌트에 전달되지 않기 때문이었습니다.

## 수정 내용

### 1. 플랜 그룹 상세 페이지에서 논리 플랜 목록 조회 추가
**파일**: `app/(student)/plan/group/[id]/page.tsx`

- `getPlanGroupItems` 함수를 import 추가
- 플랜 그룹 데이터 조회 후 논리 플랜 목록 조회 로직 추가
- `PlanGroupDetailView`에 논리 플랜 목록을 `logicalPlans` prop으로 전달

```typescript
// 논리 플랜 목록 조회 추가
import { getPlanGroupItems } from "@/lib/data/planGroupItems";

// 기존 데이터 조회 후 추가
const logicalPlans = await getPlanGroupItems(id, tenantContext?.tenantId || null);

// PlanGroupDetailView에 전달
<PlanGroupDetailView
  // ... 기존 props
  logicalPlans={logicalPlans}
/>
```

### 2. PlanGroupDetailView에 logicalPlans prop 추가
**파일**: `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`

- `PlanGroupItem` 타입 import 추가
- `PlanGroupDetailViewProps` 타입에 `logicalPlans?: PlanGroupItem[]` 추가
- 컴포넌트 파라미터에 `logicalPlans = []` 추가
- `LogicalPlanList` 컴포넌트에 `initialItems={logicalPlans}` prop 전달

```typescript
import type { PlanGroup, PlanContent, PlanExclusion, AcademySchedule, PlanStatus, PlanGroupItem } from "@/lib/types/plan";

type PlanGroupDetailViewProps = {
  // ... 기존 props
  logicalPlans?: PlanGroupItem[];
};

export function PlanGroupDetailView({
  // ... 기존 props
  logicalPlans = [],
}: PlanGroupDetailViewProps) {
  // ...
  case 8:
    return (
      <Suspense fallback={<TabLoadingSkeleton />}>
        <LogicalPlanList
          planGroupId={groupId}
          tenantId={group.tenant_id || null}
          initialItems={logicalPlans}  // 추가
          readOnly={!canEdit}
        />
      </Suspense>
    );
}
```

## 수정된 파일
1. `app/(student)/plan/group/[id]/page.tsx`
2. `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`

## 예상 결과
- 논리 플랜이 존재하는 경우 목록이 정상적으로 표시됨
- 논리 플랜이 없는 경우 "논리 플랜 추가" 안내 메시지가 표시됨
- 서버에서 조회한 데이터가 클라이언트 컴포넌트에 전달되어 초기 렌더링 시 올바른 상태 표시

## 테스트 확인 사항
- [ ] 논리 플랜이 있는 플랜 그룹에서 목록이 표시되는지 확인
- [ ] 논리 플랜이 없는 플랜 그룹에서 안내 메시지가 표시되는지 확인
- [ ] 논리 플랜 추가/수정/삭제 기능이 정상 작동하는지 확인

