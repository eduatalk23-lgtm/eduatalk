# 플랜 Episode 분할 및 소요시간 계산 개선

**작업일**: 2025-02-02

## 문제 상황

1. **중복 플랜 생성**: SchedulerEngine이 이미 episode별로 분할한 플랜을 `generatePlansRefactored.ts`에서 다시 분할하여 중복 플랜이 생성됨
2. **소요시간 계산 불일치**: `scheduleUtils.ts`의 `calculateEstimatedTime` 함수가 episodes 정보를 사용하지 못하여 정확한 소요시간을 계산하지 못함

## 수정 내용

### 1. Episode 분할 중복 방지

**파일**: `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

SchedulerEngine이 이미 episode별로 분할한 플랜(`start === end`)은 재분할하지 않도록 수정:

```typescript
// Episode별 플랜 분할 (Pre-calculated time 여부와 무관하게)
// 큰 범위(예: 2~23)를 개별 episode로 분할하여 각 episode의 실제 duration을 정확히 반영
// 단, SchedulerEngine이 이미 episode별로 분할한 경우(start === end)는 재분할하지 않음
const splitPlansForAssign = plansForAssign.flatMap((p) => {
  // 강의 콘텐츠만 episode별로 분할
  if (p.content_type === "lecture") {
    // 이미 단일 episode로 분할된 경우(start === end)는 재분할하지 않음
    // SchedulerEngine이 이미 episode별로 분할했을 수 있음
    const isAlreadySingleEpisode = p.planned_start_page_or_time === p.planned_end_page_or_time;
    if (isAlreadySingleEpisode) {
      return [p];
    }
    // 범위가 있는 경우에만 분할
    return splitPlanTimeInputByEpisodes(p, contentDurationMap);
  }
  return [p];
});
```

### 2. ContentData 타입에 episodes 필드 추가

**파일**: `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts`

```typescript
export type ContentData = {
  id: string;
  title: string;
  subject?: string | null;
  subject_category?: string | null;
  total_pages?: number | null; // 책의 경우
  duration?: number | null; // 강의의 경우
  total_page_or_time?: number | null; // 커스텀의 경우
  episodes?: Array<{
    episode_number: number;
    duration: number | null;
  }> | null; // 강의의 경우 episode 정보
};
```

### 3. Episodes 정보 조회 및 포함

**파일**: `app/(student)/actions/plan-groups/queries.ts`

`_getScheduleResultData` 함수에서 강의 콘텐츠의 episodes 정보를 조회하여 `ContentData`에 포함:

- 학생 강의의 경우 `student_lecture_episodes` 테이블에서 조회
- 마스터 강의의 경우 `lecture_episodes` 테이블에서 조회 (학생 강의에 episodes가 없는 경우)
- episodes 정보를 `contentsMap`에 추가하여 소요시간 계산에 활용

### 4. 소요시간 계산에 episodes 정보 활용

**파일**: `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts`

`calculateEstimatedTime` 함수에서 `ContentData`의 episodes 정보를 활용하도록 수정:

```typescript
const contentDurationMap = new Map<string, ContentDurationInfo>();
if (content) {
  contentDurationMap.set(plan.content_id, {
    content_type: plan.content_type as "book" | "lecture" | "custom",
    content_id: plan.content_id,
    total_pages: content.total_pages ?? null,
    duration: content.duration ?? null,
    total_page_or_time: content.total_page_or_time ?? null,
    // ContentData에 episodes 정보가 있으면 사용
    episodes: content.episodes?.map((ep) => ({
      episode_number: ep.episode_number,
      duration: ep.duration,
    })) ?? null,
  });
}
```

## 영향 범위

- 플랜 생성 시 중복 플랜 생성 방지
- 스케줄 결과 화면에서 정확한 소요시간 표시
- Episode별 duration 정보를 활용한 정확한 시간 계산

## 관련 파일

- `app/(student)/actions/plan-groups/generatePlansRefactored.ts` - Episode 분할 로직
- `app/(student)/actions/plan-groups/queries.ts` - Episodes 정보 조회
- `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts` - ContentData 타입 정의
- `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts` - 소요시간 계산

