# 플랜 그룹 제외일 중복 에러 수정

## 문제 상황

플랜 그룹 임시 저장 시 "이미 등록된 제외일이 있습니다: 2025-12-04" 에러가 발생하는 문제가 있었습니다.

### 원인

1. `updatePlanGroupDraftAction`에서 제외일을 업데이트할 때:
   - 기존 제외일을 삭제
   - 새로운 제외일을 추가

2. `createPlanExclusions` 함수에서 중복 체크를 할 때:
   - 학생의 모든 제외일을 조회하여 중복 체크
   - 현재 플랜 그룹의 제외일도 포함되어 중복으로 인식
   - 같은 플랜 그룹에서 제외일을 업데이트할 때 자기 자신의 제외일과 중복으로 판단

## 해결 방법

`lib/data/planGroups.ts`의 `createPlanExclusions` 함수를 수정하여:
- 현재 플랜 그룹의 제외일을 중복 체크에서 제외
- 다른 플랜 그룹의 제외일과만 중복 체크를 수행

### 수정 내용

```typescript
// 학생의 모든 제외일을 plan_group_id 포함하여 조회
const allExclusionsQuery = supabase
  .from("plan_exclusions")
  .select("exclusion_date, plan_group_id")
  .eq("student_id", group.student_id);

// 현재 플랜 그룹의 제외일을 제외한 다른 플랜 그룹의 제외일만 중복 체크 대상
const otherGroupExclusions = (allExclusions || []).filter(
  (e) => e.plan_group_id !== groupId
);
const existingDates = new Set(otherGroupExclusions.map((e) => e.exclusion_date));
```

## 수정된 파일

- `lib/data/planGroups.ts`: `createPlanExclusions` 함수의 중복 체크 로직 수정

## 테스트 시나리오

1. **정상 케이스**: 같은 플랜 그룹에서 제외일을 수정할 때 중복 에러가 발생하지 않아야 함
2. **중복 체크**: 다른 플랜 그룹에 이미 등록된 제외일을 추가하려고 할 때 중복 에러가 발생해야 함

## 참고

- 제외일은 플랜 그룹별로 관리되지만, 학생별로도 중복되지 않아야 함
- 같은 플랜 그룹 내에서 제외일을 업데이트할 때는 중복 체크에서 제외

