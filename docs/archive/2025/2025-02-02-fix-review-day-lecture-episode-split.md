# 복습일 강의 콘텐츠 Episode별 분할 방지 수정

## 작업 일시
2025-02-02

## 문제 상황
플랜 배치 시 복습일에는 해당 주차의 학습일에 배정했던 내용을 범위로 배치하게 되는데, 강의 콘텐츠의 경우 복습일에 에피소드별 배치를 하고 있어 복습일만 범위형으로 수정이 필요했습니다.

## 수정 내용

### 변경 파일
- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

### 수정 로직
복습일(`dayType === "복습일"`)인 경우 강의 콘텐츠를 episode별로 분할하지 않고 범위형으로 유지하도록 수정했습니다.

**수정 전:**
```typescript
const splitPlansForAssign = plansForAssign.flatMap((p) => {
  // 강의 콘텐츠만 episode별로 분할
  if (p.content_type === "lecture") {
    // 이미 단일 episode로 분할된 경우(start === end)는 재분할하지 않음
    const isAlreadySingleEpisode =
      p.planned_start_page_or_time === p.planned_end_page_or_time;
    if (isAlreadySingleEpisode) {
      return [p];
    }
    // 범위가 있는 경우에만 분할
    return splitPlanTimeInputByEpisodes(p, contentDurationMap);
  }
  return [p];
});
```

**수정 후:**
```typescript
const splitPlansForAssign = plansForAssign.flatMap((p) => {
  // 강의 콘텐츠만 episode별로 분할
  if (p.content_type === "lecture") {
    // 복습일인 경우 범위형으로 유지 (episode별 분할하지 않음)
    if (dayType === "복습일") {
      return [p];
    }
    
    // 이미 단일 episode로 분할된 경우(start === end)는 재분할하지 않음
    const isAlreadySingleEpisode =
      p.planned_start_page_or_time === p.planned_end_page_or_time;
    if (isAlreadySingleEpisode) {
      return [p];
    }
    // 범위가 있는 경우에만 분할
    return splitPlanTimeInputByEpisodes(p, contentDurationMap);
  }
  return [p];
});
```

## 동작 방식

1. **학습일**: 강의 콘텐츠는 episode별로 분할되어 배치됩니다.
   - 예: 범위 2~23 → episode 2, 3, 4, ..., 23으로 분할

2. **복습일**: 강의 콘텐츠는 범위형으로 유지됩니다.
   - 예: 범위 2~23 → 그대로 2~23으로 유지

## 영향 범위
- 플랜 생성 시 복습일에 배치되는 강의 콘텐츠가 범위형으로 배치됨
- 학습일의 episode별 분할 로직은 기존과 동일하게 유지됨

## 테스트 확인 사항
- [ ] 복습일에 강의 콘텐츠가 범위형으로 배치되는지 확인
- [ ] 학습일에 강의 콘텐츠가 episode별로 분할되는지 확인
- [ ] 교재 콘텐츠는 기존과 동일하게 동작하는지 확인

