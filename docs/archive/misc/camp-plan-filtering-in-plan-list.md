# 캠프 모드 플랜 목록 필터링 개선

## 작업 개요

학생 페이지의 `/plan` 경로에서 캠프 모드 플랜이 표시되지 않도록 필터링 로직을 개선했습니다.

## 변경 사항

### 파일 수정
- `app/(student)/plan/page.tsx`

### 변경 내용

기존 필터링 로직은 `camp_template_id`와 `camp_invitation_id`만 확인하고 있었습니다. 하지만 `plan_type`이 "camp"인 경우도 캠프 모드 플랜이므로, 이를 필터링 조건에 추가했습니다.

**변경 전:**
```typescript
const nonCampPlanGroups = planGroupsWithStats.filter(
  (group) => !group.camp_template_id && !group.camp_invitation_id
);
```

**변경 후:**
```typescript
const nonCampPlanGroups = planGroupsWithStats.filter(
  (group) => 
    group.plan_type !== "camp" && 
    !group.camp_template_id && 
    !group.camp_invitation_id
);
```

## 필터링 조건

다음 조건 중 하나라도 해당하는 플랜 그룹은 `/plan` 페이지에서 제외됩니다:

1. `plan_type === "camp"` - 캠프 모드 플랜
2. `camp_template_id`가 존재하는 경우
3. `camp_invitation_id`가 존재하는 경우

## 관련 타입

- `PlanType`: `"individual" | "integrated" | "camp"`
- `PlanGroup`: `plan_type`, `camp_template_id`, `camp_invitation_id` 필드 포함

## 참고

- 캠프 관련 플랜은 `/camp` 경로에서만 확인할 수 있습니다.
- 일반 플랜과 캠프 플랜을 명확히 구분하여 사용자 경험을 개선했습니다.

## 작업 일시

2024년 11월

