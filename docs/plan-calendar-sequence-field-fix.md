# 월별 플랜 캘린더 회차 표시 수정

## 작업 개요

월별 플랜 캘린더에서 아이콘, 교과, 회차 구조로 표시할 때 회차 참고 필드가 잘못되어 있었습니다. `plan_number` 대신 `sequence` 필드를 사용하도록 수정했습니다.

## 문제점

- 월별 플랜 캘린더에서 회차를 표시할 때 `plan_number` 필드를 사용하고 있었음
- `plan_number`는 플랜 그룹 내에서의 순서를 나타내는 필드로, 같은 콘텐츠의 회차를 나타내는 `sequence` 필드와는 다름
- 데이터베이스에 `sequence` 필드가 추가되었지만, 조회 및 표시 로직에서 사용하지 않음

## 수정 내용

### 1. Plan 타입에 sequence 필드 추가

**파일**: `lib/data/studentPlans.ts`

```typescript
export type Plan = {
  // ... 기존 필드들
  plan_number?: number | null;
  sequence?: number | null; // 플랜 그룹 내에서 같은 콘텐츠의 회차 번호
  day_type?: string | null;
  // ... 나머지 필드들
};
```

### 2. 데이터 조회 쿼리에 sequence 필드 추가

**파일**: `lib/data/studentPlans.ts`

- `getPlansForStudent` 함수의 select 쿼리에 `sequence` 필드 추가
- `getPlanById` 함수의 select 쿼리에 `sequence` 필드 추가

```typescript
.select(
  "id,tenant_id,student_id,plan_date,block_index,content_type,content_id,chapter,planned_start_page_or_time,planned_end_page_or_time,completed_amount,progress,is_reschedulable,plan_group_id,start_time,end_time,actual_start_time,actual_end_time,total_duration_seconds,paused_duration_seconds,pause_count,plan_number,sequence,day_type,week,day,is_partial,is_continued,content_title,content_subject,content_subject_category,content_category,created_at,updated_at"
)
```

### 3. 회차 표시 로직 수정

**파일**: `app/(student)/plan/calendar/page.tsx`

```typescript
// 수정 전
// 플랜 회차 정보 (plan_number 사용)
let contentEpisode: string | null = null;
if (plan.plan_number !== null && plan.plan_number !== undefined) {
  contentEpisode = `${plan.plan_number}회차`;
}

// 수정 후
// 플랜 회차 정보 (sequence 사용)
let contentEpisode: string | null = null;
if (plan.sequence !== null && plan.sequence !== undefined) {
  contentEpisode = `${plan.sequence}회차`;
}
```

## 변경 사항 요약

1. **타입 정의**: `Plan` 타입에 `sequence` 필드 추가
2. **데이터 조회**: `getPlansForStudent`와 `getPlanById` 함수에서 `sequence` 필드 조회
3. **UI 표시**: 월별 플랜 캘린더에서 `plan_number` 대신 `sequence` 필드를 사용하여 회차 표시

## 관련 파일

- `lib/data/studentPlans.ts`: Plan 타입 정의 및 데이터 조회 함수
- `app/(student)/plan/calendar/page.tsx`: 플랜 캘린더 페이지
- `app/(student)/plan/calendar/_components/PlanCard.tsx`: 플랜 카드 컴포넌트 (회차 표시)

## 참고

- `sequence` 필드는 플랜 그룹 내에서 같은 `content_id`를 가진 플랜들 중에서의 회차 번호를 나타냅니다
- 같은 `plan_number`를 가진 플랜들은 같은 회차(`sequence`)를 가집니다
- 학습 플랜에만 `sequence`가 부여되며, 학원일정, 이동시간, 점심시간, 자율학습은 `null`입니다

## 커밋 정보

- 커밋 해시: `b26c132`
- 커밋 메시지: "fix: 월별 플랜 캘린더 회차 표시를 sequence 필드로 변경"

