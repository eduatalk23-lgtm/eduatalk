# 캠프 제출 페이지 블록 세트 조회 실패 - plan_type 누락 문제 수정

## 🔍 문제 상황

학생이 제출한 캠프 템플릿 상세보기 페이지에서 블록 정보가 표시되지 않는 문제가 있었습니다.

### 원인

**`lib/data/planGroups.ts`의 `getPlanGroupById` 함수에서 `plan_type`과 `camp_template_id`를 조회하지 않음**

- `getPlanGroupById` 함수의 select 쿼리에 `plan_type`, `camp_template_id`, `camp_invitation_id` 필드가 누락되어 있었음
- 결과적으로 `group.plan_type`과 `group.camp_template_id`가 `undefined`가 되어 조건문 `if (group.plan_type === "camp" && group.camp_template_id)`이 실행되지 않음
- 블록 세트 조회 로직이 전혀 실행되지 않아 콘솔 로그도 없고 블록 정보도 표시되지 않음

## 🛠 해결 방법

### 수정 내용

**파일**: `lib/data/planGroups.ts`

#### 1. `getPlanGroupById` 함수의 select 쿼리 수정

**변경 전**:
```typescript
.select(
  "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,created_at,updated_at"
)
```

**변경 후**:
```typescript
.select(
  "id,tenant_id,student_id,name,plan_purpose,scheduler_type,scheduler_options,period_start,period_end,target_date,block_set_id,status,deleted_at,daily_schedule,subject_constraints,additional_period_reallocation,non_study_time_blocks,plan_type,camp_template_id,camp_invitation_id,created_at,updated_at"
)
```

#### 2. Fallback 쿼리도 동일하게 수정

fallback 쿼리에도 `plan_type`, `camp_template_id`, `camp_invitation_id` 추가

### 추가 개선

**파일**: `app/(student)/camp/[invitationId]/submitted/page.tsx`

디버깅을 위한 로그 추가:
```typescript
console.log("[CampSubmissionDetailPage] group 객체 확인:", {
  plan_type: group.plan_type,
  camp_template_id: group.camp_template_id,
  group_id: group.id,
  has_plan_type: "plan_type" in group,
  has_camp_template_id: "camp_template_id" in group,
});
```

## 📋 변경 사항 요약

### `lib/data/planGroups.ts`

1. **`getPlanGroupById` 함수 수정**
   - select 쿼리에 `plan_type`, `camp_template_id`, `camp_invitation_id` 추가
   - fallback 쿼리에도 동일하게 추가

### `app/(student)/camp/[invitationId]/submitted/page.tsx`

1. **디버깅 로그 추가**
   - group 객체에 필요한 필드가 있는지 확인하는 로그 추가

## ✅ 검증 체크리스트

- [x] `getPlanGroupById`에서 `plan_type` 조회 확인
- [x] `getPlanGroupById`에서 `camp_template_id` 조회 확인
- [x] `getPlanGroupById`에서 `camp_invitation_id` 조회 확인
- [x] Fallback 쿼리에도 동일하게 추가
- [x] 디버깅 로그 추가

## 🔗 관련 파일

- `lib/data/planGroups.ts` - 플랜 그룹 데이터 조회 함수
- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 캠프 제출 상세보기 페이지

## 📝 교훈

### 문제 발견이 늦어진 이유

1. **select 쿼리 필드 누락을 간과**
   - 블록 세트 조회 로직 자체에만 집중
   - 데이터 조회 단계에서 필드 누락 가능성을 간과

2. **조건문 실행 여부 확인 부족**
   - 콘솔 로그가 없다는 것은 조건문 자체가 실행되지 않았다는 신호
   - 조건문 내부 로그만 확인하고 조건문 실행 여부는 확인하지 않음

### 개선 방안

1. **데이터 조회 함수 일관성 유지**
   - 모든 플랜 그룹 조회 함수에서 동일한 필드 조회
   - `getPlanGroupsForStudent`에는 이미 포함되어 있었지만 `getPlanGroupById`에는 누락

2. **조건문 실행 여부 확인**
   - 조건문 전에 디버깅 로그 추가
   - 조건문이 실행되지 않는 경우를 먼저 확인

3. **타입 안전성 강화**
   - TypeScript 타입 정의와 실제 조회 필드 일치 확인
   - 타입 체크로 누락 필드 조기 발견 가능

## 날짜

2024-11-24

