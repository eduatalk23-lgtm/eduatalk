# 일시정지/재시작 타임스탬프 누적 표시 수정

## 📋 문제 상황

여러 번 일시정지/재시작을 해도 타임스탬프가 계속 쌓이지 않고 마지막 것만 표시되는 문제가 발생했습니다.

## 🔍 원인 분석

### 문제점

1. **Optimistic 타임스탬프 단일 값 관리**: `pause`와 `resume`을 단일 값으로 관리하여 이전 값이 덮어씌워짐
2. **서버 값만 표시**: 서버에 저장된 마지막 값만 표시하여 이전 기록이 사라짐
3. **타임스탬프 누적 부재**: 여러 번의 일시정지/재시작을 추적하지 못함

### 시나리오

1. 시작 → 시작 시간 표시
2. 일시정지 → 일시정지 시간 표시
3. 재시작 → 재시작 시간 표시, 일시정지 시간 유지
4. 다시 일시정지 → 새로운 일시정지 시간이 이전 것을 덮어씀
5. 다시 재시작 → 새로운 재시작 시간이 이전 것을 덮어씀

## ✅ 해결 방법

### 1. Optimistic 타임스탬프를 배열로 변경

**파일**: `app/(student)/today/_components/TimeCheckSection.tsx`

**변경 사항**: `pause`와 `resume`을 배열로 관리하여 누적

```typescript
// Optimistic 타임스탬프 관리 (버튼 클릭 시 즉시 표시, 여러 번 누적)
const [optimisticTimestamps, setOptimisticTimestamps] = useState<{
  start?: string;
  pauses?: string[]; // 일시정지 타임스탬프 배열
  resumes?: string[]; // 재시작 타임스탬프 배열
}>({});
```

### 2. 일시정지/재시작 핸들러 수정

**변경 사항**: 배열에 타임스탬프 추가

```typescript
onPause={() => {
  const timestamp = new Date().toISOString();
  setOptimisticIsPaused(true);
  setOptimisticTimestamps((prev) => ({
    ...prev,
    pauses: [...(prev.pauses || []), timestamp],
  }));
  startTransition(() => {
    onPause(timestamp);
  });
}}

onResume={() => {
  const timestamp = new Date().toISOString();
  setOptimisticIsPaused(false);
  setOptimisticTimestamps((prev) => ({
    ...prev,
    resumes: [...(prev.resumes || []), timestamp],
  }));
  startTransition(() => {
    onResume(timestamp);
  });
}}
```

### 3. 타임스탬프 표시 로직 수정

**변경 사항**: 모든 타임스탬프를 시간순으로 정렬하여 표시

```typescript
{
  /* 모든 일시정지/재시작 타임스탬프를 시간순으로 표시 */
}
{
  (() => {
    // 모든 타임스탬프를 수집 (optimistic + 서버 값)
    const allPauses: string[] = [];
    const allResumes: string[] = [];

    // Optimistic 일시정지 타임스탬프
    if (optimisticTimestamps.pauses) {
      allPauses.push(...optimisticTimestamps.pauses);
    }

    // 서버 일시정지 타임스탬프
    if (timeStats.currentPausedAt) {
      allPauses.push(timeStats.currentPausedAt);
    }
    if (timeStats.lastPausedAt && !allPauses.includes(timeStats.lastPausedAt)) {
      allPauses.push(timeStats.lastPausedAt);
    }

    // Optimistic 재시작 타임스탬프
    if (optimisticTimestamps.resumes) {
      allResumes.push(...optimisticTimestamps.resumes);
    }

    // 서버 재시작 타임스탬프
    if (
      timeStats.lastResumedAt &&
      !allResumes.includes(timeStats.lastResumedAt)
    ) {
      allResumes.push(timeStats.lastResumedAt);
    }

    // 모든 이벤트를 시간순으로 정렬
    const allEvents: Array<{ type: "pause" | "resume"; timestamp: string }> = [
      ...allPauses.map((ts) => ({ type: "pause" as const, timestamp: ts })),
      ...allResumes.map((ts) => ({ type: "resume" as const, timestamp: ts })),
    ].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return allEvents.map((event, index) => (
      <div
        key={`${event.type}-${event.timestamp}-${index}`}
        className="flex items-center justify-between"
      >
        <span
          className={`text-sm ${
            event.type === "pause" ? "text-amber-600" : "text-blue-600"
          }`}
        >
          {event.type === "pause" ? "일시정지 시간" : "재시작 시간"}
        </span>
        <span
          className={`text-sm font-medium ${
            event.type === "pause" ? "text-amber-900" : "text-blue-900"
          }`}
        >
          {formatTimestamp(event.timestamp)}
        </span>
      </div>
    ));
  })();
}
```

### 4. useEffect 수정

**변경 사항**: 서버에 저장된 값과 일치하는 optimistic 타임스탬프만 제거

```typescript
useEffect(() => {
  setOptimisticIsPaused(null);
  setOptimisticIsActive(null);

  // 서버에서 props가 업데이트되면 optimistic 타임스탬프 정리
  setOptimisticTimestamps((prev) => {
    const newTimestamps = { ...prev };

    // 서버에 저장된 일시정지 타임스탬프가 있으면 해당 optimistic 제거
    if (currentPausedAt || lastPausedAt) {
      if (newTimestamps.pauses) {
        newTimestamps.pauses = newTimestamps.pauses.filter(
          (ts) => ts !== currentPausedAt && ts !== lastPausedAt
        );
        if (newTimestamps.pauses.length === 0) {
          delete newTimestamps.pauses;
        }
      }
    }

    // 서버에 저장된 재시작 타임스탬프가 있으면 해당 optimistic 제거
    if (lastResumedAt) {
      if (newTimestamps.resumes) {
        newTimestamps.resumes = newTimestamps.resumes.filter(
          (ts) => ts !== lastResumedAt
        );
        if (newTimestamps.resumes.length === 0) {
          delete newTimestamps.resumes;
        }
      }
    }

    return newTimestamps;
  });
}, [
  isPaused,
  isActive,
  firstStartTime,
  currentPausedAt,
  lastPausedAt,
  lastResumedAt,
]);
```

## 🎯 수정 효과

### 수정 전

- 일시정지 → 일시정지 시간 표시
- 재시작 → 재시작 시간 표시, 이전 일시정지 시간 유지
- 다시 일시정지 → 이전 일시정지 시간 사라지고 새로운 것만 표시
- 타임스탬프가 누적되지 않음

### 수정 후

- 일시정지 → 일시정지 시간 표시
- 재시작 → 재시작 시간 표시, 이전 일시정지 시간 유지
- 다시 일시정지 → 새로운 일시정지 시간 추가, 이전 기록 유지
- 다시 재시작 → 새로운 재시작 시간 추가, 모든 기록 유지
- 모든 타임스탬프가 시간순으로 누적 표시

## 📌 핵심 변경 사항

1. **배열 기반 관리**: `pauses`와 `resumes`를 배열로 관리하여 누적
2. **시간순 정렬**: 모든 이벤트를 시간순으로 정렬하여 표시
3. **중복 제거**: 서버 값과 optimistic 값의 중복 제거
4. **선택적 제거**: 서버에 저장된 값과 일치하는 optimistic만 제거

## 🔧 추가 수정 사항

### 일시정지 시간 중복 표시 문제 수정

**문제**: 일시정지 시간과 재시작 시간이 중복으로 표시되는 문제

**원인**:

1. `currentPausedAt`과 `lastPausedAt`이 같은 값일 때 둘 다 표시됨
2. Optimistic 타임스탬프와 서버 타임스탬프가 중복으로 수집됨
3. `includes()` 체크만으로는 완전한 중복 제거가 어려움

**해결**:

1. `getTimeStats`에서 일시정지 중일 때는 `currentPausedAt`만 설정, `lastPausedAt`은 null
2. 재시작 후에만 `lastPausedAt` 설정
3. `TimeCheckSection`에서 **Set을 사용하여 중복 완전 제거**

```typescript
// getTimeStats 수정
if (pausedPlan) {
  // 일시정지된 플랜: 현재 일시정지 중이므로 currentPausedAt만 설정
  currentPausedAt = session.pausedAt || null;
  lastPausedAt = null; // 일시정지 중이면 null
} else if (activePlan) {
  if (session.isPaused) {
    // 현재 일시정지 중
    currentPausedAt = session.pausedAt || null;
    lastPausedAt = null;
  } else {
    // 재시작된 플랜의 경우 마지막 일시정지 시간 표시
    currentPausedAt = null;
    if (session.pausedAt && session.resumedAt) {
      lastPausedAt = session.pausedAt;
    }
  }
}

// TimeCheckSection 수정 - Set을 사용하여 중복 완전 제거
const pauseSet = new Set<string>();
const resumeSet = new Set<string>();

// Optimistic 타임스탬프 추가
if (optimisticTimestamps.pauses) {
  optimisticTimestamps.pauses.forEach((ts) => pauseSet.add(ts));
}

// 서버 타임스탬프 추가 (Set이므로 자동으로 중복 제거)
if (timeStats.currentPausedAt) {
  pauseSet.add(timeStats.currentPausedAt);
} else if (timeStats.lastPausedAt) {
  pauseSet.add(timeStats.lastPausedAt);
}

// 재시작 타임스탬프도 동일하게 처리
if (optimisticTimestamps.resumes) {
  optimisticTimestamps.resumes.forEach((ts) => resumeSet.add(ts));
}
if (timeStats.lastResumedAt) {
  resumeSet.add(timeStats.lastResumedAt);
}

// Set을 배열로 변환하여 시간순 정렬
const allEvents = [
  ...Array.from(pauseSet).map((ts) => ({
    type: "pause" as const,
    timestamp: ts,
  })),
  ...Array.from(resumeSet).map((ts) => ({
    type: "resume" as const,
    timestamp: ts,
  })),
].sort(
  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
);
```

## ✅ 테스트 시나리오

1. ✅ 시작 → 시작 시간 표시
2. ✅ 일시정지 → 일시정지 시간 1개만 표시
3. ✅ 재시작 → 일시정지 시간 유지, 재시작 시간 표시
4. ✅ 다시 일시정지 → 새로운 일시정지 시간 추가, 이전 기록 유지
5. ✅ 다시 재시작 → 새로운 재시작 시간 추가, 모든 기록 유지
6. ✅ 여러 번 반복 → 모든 타임스탬프가 시간순으로 누적 표시, 중복 없음

## 🔧 최종 수정 (2025-11-22)

### 타임스탬프 표준화로 중복 완전 제거

**문제**: 타임스탬프 문자열 표현 차이로 인한 중복 표시

- `2025-11-22T14:21:47.483Z` (UTC)
- `2025-11-22T14:21:47.483+00:00` (UTC+00:00)

**원인**: 동일한 시간을 나타내는 타임스탬프지만 timezone offset 표기가 달라 Set에서 다른 값으로 인식

**해결**: Date 객체를 이용한 타임스탬프 표준화

- 타임스탬프를 `new Date(ts).getTime()`으로 밀리초 값으로 변환
- Map을 사용하여 밀리초 값으로 중복 제거
- 최종적으로 원본 타임스탬프 문자열 유지

**변경 파일**: `app/(student)/today/_components/TimeCheckSection.tsx`

**핵심 변경**:

```typescript
// 타임스탬프 표준화 함수
const normalizeTimestamp = (ts: string): number => {
  return new Date(ts).getTime();
};

// Map을 사용한 중복 제거
const pauseMap = new Map<number, string>();
const resumeMap = new Map<number, string>();

// 타임스탬프 추가 시 정규화된 값으로 비교
const normalized = normalizeTimestamp(timestamp);
if (!pauseMap.has(normalized)) {
  pauseMap.set(normalized, timestamp);
}
```

**효과**:

- ✅ 동일 시간의 타임스탬프 중복 표시 완전 제거
- ✅ timezone offset 차이 무시하고 시간 값으로 비교
- ✅ Optimistic과 서버 값이 동일 시간일 때 하나만 표시
