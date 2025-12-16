# 교재와 강의 콘텐츠 혼합 처리 문제 수정

## 문제 상황

교재와 강의 콘텐츠를 혼합하여 플랜을 생성할 때, 교재가 episode 기반 로직으로 잘못 처리되어 시간 계산이 부정확한 문제가 발생했습니다.

### 발견된 문제점

1. **`assignPlanTimes` 함수 (259-275줄)**: 강의가 하나라도 있으면 모든 플랜(교재 포함)을 `assignEpisodeBasedTimes`로 전달
2. **`assignEpisodeBasedTimes` 함수 (550-570줄)**: 
   - 교재의 페이지 번호(`planned_start_page_or_time`)를 episode 번호로 잘못 해석
   - 교재는 `episodes` 정보가 없어 `episodeMap`이 비어있음
   - 결과적으로 교재는 항상 기본값 30분으로 계산됨

### 예시

- 교재: 10페이지 → episode 번호 10으로 해석 → episodeMap에서 조회 실패 → 기본값 30분 사용 (잘못됨)
- 강의: episode 5 → episodeMap에서 조회 성공 → 실제 duration 사용 (정상)

## 수정 내용

### 1. `assignPlanTimes` 함수 수정

[lib/plan/assignPlanTimes.ts](lib/plan/assignPlanTimes.ts)의 259-294줄을 수정하여 교재와 강의를 분리 처리:

```typescript
if (hasLectureEpisodes) {
  // 교재와 강의 분리
  const lecturePlans = plansWithInfo.filter(
    (p) => p.plan.content_type === "lecture"
  );
  const nonLecturePlans = plansWithInfo.filter(
    (p) => p.plan.content_type !== "lecture"
  );

  // 강의만 episode 기반 처리
  const lectureSegments = assignEpisodeBasedTimes(
    lecturePlans,
    studyTimeSlots,
    contentDurationMap,
    dayType
  );

  // 교재/커스텀은 일반 Best Fit 알고리즘으로 처리
  const nonLectureSegments =
    nonLecturePlans.length > 0
      ? assignNonLecturePlans(nonLecturePlans, studyTimeSlots, dayType)
      : [];

  // 결과 병합 및 정렬
  return [...lectureSegments, ...nonLectureSegments].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );
}
```

**변경 사항**:
- 강의와 교재/커스텀 콘텐츠를 분리하여 각각 적절한 알고리즘으로 처리
- 강의는 `assignEpisodeBasedTimes`로 episode 기반 처리
- 교재/커스텀은 `assignNonLecturePlans`로 Best Fit 알고리즘 처리
- 결과를 병합하여 시간 순으로 정렬

### 2. `assignNonLecturePlans` 헬퍼 함수 추가

교재와 커스텀 콘텐츠를 처리하는 헬퍼 함수를 추가했습니다. 기존 Best Fit 알고리즘 로직을 재사용합니다.

**함수 위치**: [lib/plan/assignPlanTimes.ts](lib/plan/assignPlanTimes.ts)의 380-500줄

**주요 기능**:
- 교재/커스텀 콘텐츠를 Best Fit 알고리즘으로 시간 배정
- Precalculated time이 있으면 우선 사용
- 슬롯별 사용 가능한 시간을 추적하여 최적 배정
- 부분 배정 및 연속 배정 지원

## 검증 방법

### 1. 교재만 있는 경우
- 기존 로직과 동일하게 동작해야 함
- 페이지 기반 duration으로 정확히 계산됨

### 2. 강의만 있는 경우
- 기존 episode 기반 로직과 동일하게 동작해야 함
- Episode별 실제 duration으로 정확히 계산됨

### 3. 교재 + 강의 혼합
- 교재는 페이지 기반 duration으로 계산됨
- 강의는 episode 기반 duration으로 계산됨
- 각 콘텐츠 타입이 올바르게 처리되어 시간이 정확히 배정됨

### 4. 로그 확인

개발 환경에서 다음 로그를 확인할 수 있습니다:

```
[assignPlanTimes] 강의 플랜 episode 정보 확인: {...}
[assignEpisodeBasedTimes] 입력 플랜 분석: {...}
```

## 관련 파일

- [lib/plan/assignPlanTimes.ts](lib/plan/assignPlanTimes.ts)

## 예상 효과

- ✅ 교재는 페이지 기반 duration으로 정확히 계산됨
- ✅ 강의는 episode 기반 duration으로 정확히 계산됨
- ✅ 혼합 플랜에서도 각 콘텐츠 타입이 올바르게 처리됨
- ✅ 교재와 강의가 혼합된 경우에도 시간 배정이 정확함

## 참고

- 교재는 `planned_start_page_or_time`과 `planned_end_page_or_time`이 페이지 번호를 의미
- 강의는 `planned_start_page_or_time`과 `planned_end_page_or_time`이 episode 번호를 의미
- 각 콘텐츠 타입에 맞는 duration 계산 방식이 적용되어야 함

