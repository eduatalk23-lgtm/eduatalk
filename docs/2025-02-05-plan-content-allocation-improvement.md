# 플랜 생성 콘텐츠 배치 및 학습 분량 검토 개선 작업 요약

## 작업 일시
2025년 2월 5일

## 작업 목표
1. 중복 코드 제거 및 통합
2. 강의 소요시간 계산 정확도 향상 (episode별 duration 사용)
3. 소요시간 계산 로직 통합
4. Bin Packing 알고리즘 최적화
5. 학습 분량 검증 강화

## 완료된 작업

### 1. 시간 변환 함수 통합 ✅

**작업 내용**:
- `lib/utils/time.ts` 파일 생성하여 공통 함수 제공
- `timeToMinutes`, `minutesToTime` 함수를 모든 파일에서 공통 함수로 교체

**수정된 파일**:
- `lib/plan/assignPlanTimes.ts`
- `lib/scheduler/SchedulerEngine.ts`
- `lib/plan/scheduler.ts`
- `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts`
- `app/(student)/actions/plan-groups/utils.ts`
- `app/(student)/plan/calendar/_utils/timelineUtils.ts`
- `app/(student)/blocks/_components/BlockTimeline.tsx`
- `app/(student)/plan/new-group/_components/_features/scheduling/components/TimelineBar.tsx`
- `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx`
- `lib/reschedule/conflictDetector.ts`
- `lib/scheduler/calculateAvailableDates.ts`
- `lib/blocks/timeRange.ts`
- `lib/blocks/statistics.ts`
- `lib/blocks/validation.ts`
- `lib/validation/scheduleValidator.ts`
- `lib/plan/1730TimetableLogic.ts` (추가 수정)
- `lib/plan/scheduleProcessor.ts` (re-export로 유지, 내부 구현은 공통 함수 사용)

**결과**: 19개 파일에서 중복된 시간 변환 함수를 제거하고 공통 함수로 통합

### 2. ContentDurationInfo 타입 확장 ✅

**작업 내용**:
- `ContentDurationInfo` 타입에 `episodes` 필드 추가
- 강의 episode별 duration 정보를 저장할 수 있도록 타입 확장

**수정된 파일**:
- `lib/types/plan-generation.ts`
- `lib/plan/assignPlanTimes.ts`
- `lib/plan/scheduler.ts`
- `lib/plan/generators/planDataPreparer.ts`

**타입 정의**:
```typescript
export type ContentDurationInfo = {
  content_type: ContentType;
  content_id: string;
  total_pages?: number | null;
  duration?: number | null; // 전체 강의 시간 (fallback용)
  total_page_or_time?: number | null;
  episodes?: Array<{
    episode_number: number;
    duration: number | null; // 회차별 소요시간 (분)
  }> | null; // 강의 episode별 duration 정보
};
```

### 3. Episode별 Duration 조회 로직 추가 ✅

**작업 내용**:
- `loadContentDurations` 함수에 episode 조회 쿼리 추가
- `prepareContentDuration` 함수에 episode 조회 쿼리 추가
- 학생 강의 episode 우선 조회, 없으면 마스터 강의 episode 사용

**수정된 파일**:
- `lib/plan/contentResolver.ts`
- `lib/plan/generators/planDataPreparer.ts`

**데이터베이스 쿼리**:
- `student_lecture_episodes` 테이블에서 episode 정보 조회
- `lecture_episodes` 테이블에서 마스터 강의 episode 정보 조회 (fallback)

### 4. 소요시간 계산 함수 통합 ✅

**작업 내용**:
- `lib/plan/contentDuration.ts` 파일 생성하여 통합 함수 제공
- 강의 episode별 duration 합산 로직 구현
- 복습일 소요시간 단축 로직 통합

**통합 함수**:
```typescript
export function calculateContentDuration(
  content: {
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
  },
  durationInfo: ContentDurationInfo,
  dayType?: "학습일" | "복습일" | string
): number
```

**계산 로직**:
- **강의**: episode별 duration 합산 (있으면), 없으면 전체 duration / 전체 회차 * 배정 회차
- **책**: 페이지 수 * (60 / pagesPerHour)
- **커스텀**: total_page_or_time >= 100이면 페이지로 간주, 아니면 시간으로 간주
- **복습일**: 학습일 대비 50% 단축

**수정된 파일**:
- `lib/plan/scheduler.ts` - `calculateContentDuration` 함수 교체
- `lib/scheduler/SchedulerEngine.ts` - `calculateContentDuration` 함수 교체
- `lib/plan/assignPlanTimes.ts` - `calculatePlanEstimatedTime` 함수 교체
- `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts` - `calculateEstimatedTime` 함수 교체
- `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts` - `calculateEstimatedTime` 함수 교체

### 5. Bin Packing 알고리즘 최적화 ✅

**작업 내용**:
- First Fit 알고리즘에서 Best Fit 알고리즘으로 변경
- 플랜을 소요시간 내림차순 정렬 (큰 것부터 배치)
- 각 플랜을 가장 적합한 슬롯에 배치 (남은 시간이 가장 적은 슬롯)

**수정된 파일**:
- `lib/plan/assignPlanTimes.ts` - `assignPlanTimes` 함수 최적화
- `lib/scheduler/SchedulerEngine.ts` - `generateStudyDayPlans` 함수 최적화

**최적화 전략**:
1. 플랜을 소요시간 내림차순 정렬
2. 각 플랜을 가장 적합한 슬롯에 배치 (Best Fit)
3. Best Fit 슬롯을 찾지 못한 경우 First Fit으로 폴백

### 6. 학습 분량 검증 강화 ✅

**작업 내용**:
- `validateStep6` 함수에 예상 소요 일수 검증 추가
- 학습 분량 적정성 검증 추가 (과도하게 많거나 적은 경우 경고)

**수정된 파일**:
- `lib/validation/wizardValidator.ts` - `validateStep6` 함수 개선

**추가된 검증 항목**:
- 예상 소요 일수가 총 학습일 수를 초과하는지 확인
- 학습 분량이 과도하게 많거나 적은 경우 경고 (50% 미만, 150% 초과)
- 추천 범위와 현재 범위의 차이가 큰 경우 경고 (기존 로직 유지)

## 개선 효과

### 코드 품질
- **중복 코드 제거**: 17개 파일에서 시간 변환 함수 통합
- **유지보수성 향상**: 소요시간 계산 로직을 단일 함수로 통합
- **타입 안전성 향상**: ContentDurationInfo 타입 확장으로 episode 정보 명시적 관리

### 정확도 향상
- **강의 소요시간 계산 정확도 향상**: episode별 duration 사용으로 더 정확한 계산
- **Bin Packing 최적화**: Best Fit 알고리즘으로 시간 효율성 향상

### 사용자 경험
- **학습 분량 검증 강화**: 예상 소요 일수 및 학습 분량 적정성 검증으로 더 나은 플랜 생성 가이드 제공

## 향후 개선 사항

### Episode Duration 계산 개선
- 현재는 episode 정보가 없을 때 fallback 로직을 사용하지만, 전체 회차 수를 조회하여 더 정확한 계산 가능
- `lectures.total_episodes` 또는 `master_lectures.total_episodes` 필드를 활용하여 정확도 향상

### Bin Packing 알고리즘 추가 최적화
- 현재는 Best Fit 알고리즘을 사용하지만, 더 복잡한 최적화 알고리즘 (예: Genetic Algorithm) 적용 가능
- 시간 제약 조건을 고려한 최적화

### 학습 분량 검증 개선
- Episode별 duration을 고려한 정확한 예상 소요 일수 계산
- 복습일 소요시간 단축 비율 검증

## 테스트 권장 사항

### 단위 테스트
- `calculateContentDuration` 함수 테스트 (episode 정보 있음/없음 케이스)
- `timeToMinutes`, `minutesToTime` 함수 테스트
- Bin Packing 알고리즘 테스트

### 통합 테스트
- 강의 episode별 duration이 다른 경우 플랜 생성 테스트
- 복습일 소요시간 계산 테스트
- 시간 부족 시 처리 테스트
- 학습 분량 검증 경고 메시지 테스트

## 참고 파일

### 신규 생성 파일
- `lib/utils/time.ts` - 시간 변환 유틸리티
- `lib/plan/contentDuration.ts` - 소요시간 계산 통합 함수

### 주요 수정 파일
- `lib/plan/contentResolver.ts` - Episode 조회 로직 추가
- `lib/plan/generators/planDataPreparer.ts` - Episode 조회 로직 추가
- `lib/plan/assignPlanTimes.ts` - Bin Packing 최적화 및 통합 함수 사용
- `lib/scheduler/SchedulerEngine.ts` - Bin Packing 최적화 및 통합 함수 사용
- `lib/validation/wizardValidator.ts` - 학습 분량 검증 강화

