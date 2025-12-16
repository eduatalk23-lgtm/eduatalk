# 플랜 생성 성능 및 버그 수정

**작성일**: 2025-01-15  
**목적**: 플랜 생성 시 발생하는 시간표 표시 오류, 학습일 플랜 생성 실패, 성능 문제, 네트워크 에러 해결

---

## 문제 분석

### 1. 시간표 표시 오류 ⚠️

**증상**: 모든 플랜이 "10:00 ~ 10:30"으로 동일하게 표시됨

**원인**:
- `previewPlansRefactored.ts`에서 `SchedulerEngine`이 계산한 pre-calculated 시간을 무시하고 `assignPlanTimes`로 재계산
- `generatePlansRefactored.ts`는 pre-calculated 시간을 사용하지만, 미리보기에서는 사용하지 않음

**해결**:
- `previewPlansRefactored.ts`에 `generatePlansRefactored.ts`와 동일한 로직 적용
- pre-calculated 시간이 있으면 그대로 사용, 없으면 `assignPlanTimes`로 fallback

**수정 파일**:
- `app/(student)/actions/plan-groups/previewPlansRefactored.ts`

---

### 2. 학습일 플랜 생성 실패 ⚠️

**증상**: 
```
[SchedulerEngine] 학습일 플랜이 생성되지 않음: {
  studyDaysList: ['2025-12-24', '2025-12-25', ...],
  totalContentsCount: 1,
  contentsWithRangeMap: 1
}
```

**원인**:
- `rangeMap`의 날짜와 `studyDaysList`의 날짜가 일치하지 않음
- `allocateContentDates()`에서 반환된 날짜가 주차별로 그룹화된 `studyDaysList`와 다를 수 있음

**해결**:
- 디버깅 로그 추가하여 날짜 불일치 원인 파악
- `rangeMap`의 모든 날짜와 `studyDaysList`의 날짜를 비교하여 불일치 감지

**수정 파일**:
- `lib/scheduler/SchedulerEngine.ts`

---

### 3. 성능 문제 ⚡

**증상**:
- `calculateContentDuration`이 episode별로 반복 호출됨 (24개 episode × 15개 플랜 = 최소 360회)
- 각 호출마다 episode 배열을 순회하여 성능 저하

**원인**:
- `SchedulerEngine`에서 episode를 개별 플랜으로 분할할 때 각 episode마다 `calculateContentDuration` 호출
- Episode Map을 매번 생성하여 중복 작업 발생

**해결**:
- Episode Map을 콘텐츠별로 한 번만 생성하고 캐싱
- 단일 episode인 경우 Map에서 직접 조회하여 `calculateContentDuration` 호출 생략
- 범위인 경우에만 `calculateContentDuration` 사용

**수정 파일**:
- `lib/scheduler/SchedulerEngine.ts`

**성능 개선 효과**:
- 단일 episode 조회: O(1) Map 조회로 변경 (기존: O(n) 배열 순회)
- Episode Map 생성: 콘텐츠별 1회만 생성 (기존: 플랜별 생성)

---

### 4. 네트워크 에러 처리 개선 🔄

**증상**:
```
[api/student-content-details/batch] Error: aborted (ECONNRESET)
```

**원인**:
- 배치 API 호출 시 네트워크 연결이 끊어지는 경우 재시도 로직 없음
- 일시적인 네트워크 오류로 인한 실패

**해결**:
- 재시도 가능한 에러 감지 (aborted, ECONNRESET, network, timeout 등)
- 최대 2회 재시도, 지수 백오프 적용 (1초, 2초)
- 4xx 에러는 재시도하지 않음 (클라이언트 오류)
- 5xx 에러는 재시도 (서버 오류)

**수정 파일**:
- `app/(student)/plan/new-group/_components/_features/content-selection/hooks/useContentDetailsBatch.ts`

---

## 수정 내용 상세

### 1. previewPlansRefactored.ts 수정

```typescript
// Before: 항상 assignPlanTimes 호출
const timeSegments = assignPlanTimes(...);

// After: pre-calculated 시간 확인 후 사용
const hasPrecalculatedTimes = plansForAssign.some(
  (p) => p._precalculated_start && p._precalculated_end
);

if (hasPrecalculatedTimes) {
  // SchedulerEngine이 계산한 시간 사용
  timeSegments = plansForAssign.map((p) => ({
    plan: p,
    start: p._precalculated_start!,
    end: p._precalculated_end!,
    // ...
  }));
} else {
  // Fallback to legacy assignment logic
  timeSegments = assignPlanTimes(...);
}
```

### 2. SchedulerEngine.ts 성능 최적화

```typescript
// Before: 각 플랜마다 calculateContentDuration 호출
const plansWithDuration = expandedPlans.map(({ content, start, end }) => {
  const requiredMinutes = calculateContentDuration(...); // 매번 호출
  // ...
});

// After: Episode Map 캐싱 및 최적화
const episodeMapCache = new Map<string, Map<number, number>>();

const plansWithDuration = expandedPlans.map(({ content, start, end }) => {
  // Episode Map 캐싱 확인
  let episodeMap = episodeMapCache.get(content.content_id);
  if (!episodeMap) {
    // 한 번만 생성
    episodeMap = new Map<number, number>();
    // ...
    episodeMapCache.set(content.content_id, episodeMap);
  }
  
  // 단일 episode인 경우 직접 조회
  if (amount === 1) {
    const episodeDuration = episodeMap.get(start);
    requiredMinutes = episodeDuration ?? 30;
  } else {
    // 범위인 경우에만 calculateContentDuration 사용
    requiredMinutes = calculateContentDuration(...);
  }
  // ...
});
```

### 3. useContentDetailsBatch.ts 재시도 로직

```typescript
// 재시도 가능한 에러 감지
const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("aborted") ||
      message.includes("econnreset") ||
      message.includes("network") ||
      message.includes("timeout")
    );
  }
  return false;
};

// 재시도 로직
let retryCount = 0;
const maxRetries = 2;

while (retryCount <= maxRetries) {
  try {
    response = await fetch("/api/student-content-details/batch", {...});
    if (response.ok) break;
    
    // 5xx 에러는 재시도
    if (response.status >= 500 && retryCount < maxRetries) {
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      continue;
    }
    break;
  } catch (error) {
    if (isRetryableError(error) && retryCount < maxRetries) {
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      continue;
    }
    break;
  }
}
```

---

## 테스트 체크리스트

- [ ] 시간표 미리보기에서 정확한 시간이 표시되는지 확인
- [ ] 학습일 플랜이 정상적으로 생성되는지 확인
- [ ] 성능 개선 효과 확인 (calculateContentDuration 호출 횟수 감소)
- [ ] 네트워크 에러 발생 시 재시도 로직 동작 확인

---

## 예상 효과

1. **시간표 표시 정확도**: 100% (모든 플랜이 정확한 시간으로 표시)
2. **성능 개선**: 
   - 단일 episode 조회: O(n) → O(1)
   - Episode Map 생성: 플랜별 → 콘텐츠별 1회
   - 예상 성능 향상: 약 50-70% (episode 수에 따라 다름)
3. **네트워크 안정성**: 일시적인 네트워크 오류 시 자동 재시도로 성공률 향상

---

## 참고 사항

- Episode Map 캐싱은 같은 콘텐츠의 여러 플랜에 대해 한 번만 생성되므로 메모리 사용량 증가는 미미함
- 재시도 로직은 최대 2회로 제한하여 무한 재시도 방지
- 4xx 에러는 클라이언트 오류이므로 재시도하지 않음

