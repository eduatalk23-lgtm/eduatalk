# plan_contents 테이블 Deprecation 추적

> 작성일: 2026-01-20
> Phase: 3.5 (Deprecation 시작)

## 개요

플랜 시스템 통합의 일환으로 `plan_contents` 테이블을 deprecation하고,
단일 콘텐츠 정보를 `plan_groups` 테이블의 필드로 직접 저장하는 방식으로 전환합니다.

## Deprecation 상태

### Phase 3.5 완료 (2026-01-20)

다음 파일에 `@deprecated` JSDoc 주석 추가:

| 파일 | 설명 |
|------|------|
| `lib/data/planGroups/contents.ts` | 파일 헤더, `getPlanContents()`, `createPlanContents()` |
| `lib/data/planContents.ts` | 파일 헤더 |
| `lib/types/plan/domain.ts` | `PlanContent` 타입 |
| `lib/types/plan/schema.ts` | `PlanContentRow`, `PlanContentInsert`, `PlanContentUpdate` 타입 |

## 영향 받는 파일 목록 (40개)

### 핵심 데이터 접근 (최우선 마이그레이션)
- `lib/data/planContents.ts`
- `lib/data/planGroups/contents.ts`

### 도메인 액션
- `lib/domains/plan/actions/plan-groups/create.ts`
- `lib/domains/plan/actions/contentPlanGroup/create.ts`
- `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`
- `lib/domains/plan/actions/content-calendar.ts`
- `lib/domains/plan/actions/contentSchedule.ts`
- `lib/domains/plan/actions/contentIndividualization.ts`
- `lib/domains/plan/actions/timezone.ts`
- `lib/domains/plan/actions/adjustDashboard.ts`
- `lib/domains/admin-plan/actions/adHocPlan.ts`
- `lib/domains/admin-plan/actions/getPlanRound.ts`
- `lib/domains/admin-plan/actions/planGroupOperations.ts`
- `lib/domains/camp/actions/student.ts`
- `lib/domains/camp/actions/progress/bulk.ts`
- `lib/domains/camp/actions/progress/wizard.ts`

### 타입 정의
- `lib/types/plan/domain.ts`
- `lib/types/plan/schema.ts`
- `lib/types/plan/scheduler.ts`
- `lib/types/plan/timezone.ts`
- `lib/types/plan/contentPlanGroup.ts`
- `lib/types/content-selection.ts`

### 플랜 생성/스케줄러
- `lib/plan/contentResolver.ts`
- `lib/plan/shared/types.ts`
- `lib/plan/shared/ContentResolutionService.ts`
- `lib/reschedule/scheduleEngine.ts`

### 데이터 레이어
- `lib/data/planGroupItems.ts`
- `lib/data/planGroups/admin.ts`
- `lib/data/planGroups/summary.ts`
- `lib/data/planGroups/deletion.ts`

### 기타
- `lib/domains/plan/types.ts`
- `lib/domains/plan/transactions.ts`
- `lib/domains/plan/repository.ts`
- `lib/domains/plan/utils/planGroupDeletion.ts`
- `lib/domains/plan/services/types.ts`
- `lib/domains/camp/services/contentService.ts`
- `lib/supabase/database.types.ts` (자동 생성)

## 마이그레이션 가이드

### 새 코드 작성 시

```typescript
// ❌ 기존 방식 (deprecated)
const contents = await getPlanContents(groupId);

// ✅ 새 방식 (단일 콘텐츠 모드)
if (planGroup.is_single_content) {
  const content = {
    content_type: planGroup.content_type,
    content_id: planGroup.content_id,
    master_content_id: planGroup.master_content_id,
    start_range: planGroup.start_range,
    end_range: planGroup.end_range,
  };
}
```

### 읽기 시 분기 처리

```typescript
function getGroupContents(group: PlanGroup): ContentInfo[] {
  if (group.is_single_content && group.content_id) {
    // 단일 콘텐츠 모드
    return [{
      content_type: group.content_type!,
      content_id: group.content_id,
      // ...
    }];
  }
  // 레거시 다중 콘텐츠 모드
  return await getPlanContents(group.id);
}
```

## Phase 5 완료 (2026-01-20)

### 통합 콘텐츠 접근 모듈 추가

새 파일: `lib/data/planGroups/unifiedContent.ts`

```typescript
// 권장 사용법
import { getUnifiedContents, getSingleContentFromGroup, hasContent, getContentMode } from "@/lib/data/planGroups";

// 단일/다중 콘텐츠 통합 조회
const contents = await getUnifiedContents(planGroup, tenantId);

// 단일 콘텐츠만 (DB 조회 없음)
const content = getSingleContentFromGroup(planGroup);

// 콘텐츠 모드 확인
const mode = getContentMode(planGroup); // 'single' | 'slot' | 'legacy_multi' | 'empty'
```

### 레거시 코드 유지 이유

- `getPlanContents`, `createPlanContents`는 캠프 도메인(슬롯 모드)에서 정당하게 사용
- 완전 제거는 캠프 도메인 리팩토링 후 진행 예정

---

## 다음 단계

1. **Phase 4**: 레거시 데이터 마이그레이션
   - 기존 `is_single_content=false` 그룹 중 콘텐츠 1개인 경우 변환
   - 데이터 정합성 검증

2. **Phase 5**: plan_contents 테이블 제거
   - 모든 참조 코드 업데이트 완료 후
   - 테이블 DROP (또는 아카이브)
