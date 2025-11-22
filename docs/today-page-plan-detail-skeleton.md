# 플랜 상세 정보 및 시간 체크 스켈레톤 UI

## 개요

단일 뷰에서 플랜 그룹의 상세 정보와 시간 체크 기능을 제공하는 UI 설계입니다.

## 1. 헤더 영역 확장 정보

### 현재 구조

```
[메모 아이콘] [범위 조정 아이콘]
      📚 아이콘
   콘텐츠 제목
      (1회차)
```

### 제안 구조

```
[메모 아이콘] [범위 조정 아이콘]
      📚 아이콘
   콘텐츠 제목
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 학습 범위    1회차
   p.50 ~ p.75   블록 2개
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 표시할 정보 요소

1. **학습 범위**

   - 형식: `p.50 ~ p.75` (책인 경우) 또는 `00:10 ~ 00:30` (강의인 경우)
   - 첫 번째 블록의 시작 ~ 마지막 블록의 종료
   - 총 범위: 모든 블록의 합산 범위 표시

2. **회차**

   - 현재: `(1회차)` 형태로 표시됨
   - 개선: `1회차` 라벨과 함께 더 명확하게 표시

3. **블록 수**

   - `블록 2개` 형태로 표시
   - 여러 블록으로 나뉘어진 경우 시각화

4. **계획된 학습 시간** (선택사항)
   - 플랜 생성 시 계산된 예상 시간
   - `계획: 약 1시간 30분` 형태

### 레이아웃 옵션

#### 옵션 A: 인라인 정보 카드

```jsx
<div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
  <div className="grid grid-cols-2 gap-4 text-sm">
    <div>
      <span className="text-gray-600">학습 범위</span>
      <p className="mt-1 font-semibold text-gray-900">p.50 ~ p.75</p>
    </div>
    <div>
      <span className="text-gray-600">회차</span>
      <p className="mt-1 font-semibold text-gray-900">1회차 (블록 2개)</p>
    </div>
  </div>
</div>
```

#### 옵션 B: 아이콘 기반 정보 표시

```jsx
<div className="mt-4 flex items-center justify-center gap-6 text-sm">
  <div className="flex items-center gap-2">
    <BookOpen className="h-4 w-4 text-gray-400" />
    <span className="text-gray-600">범위</span>
    <span className="font-semibold text-gray-900">p.50 ~ p.75</span>
  </div>
  <div className="h-4 w-px bg-gray-300"></div>
  <div className="flex items-center gap-2">
    <Repeat className="h-4 w-4 text-gray-400" />
    <span className="text-gray-600">회차</span>
    <span className="font-semibold text-gray-900">1회차</span>
  </div>
  <div className="h-4 w-px bg-gray-300"></div>
  <div className="flex items-center gap-2">
    <Layers className="h-4 w-4 text-gray-400" />
    <span className="text-gray-600">블록</span>
    <span className="font-semibold text-gray-900">2개</span>
  </div>
</div>
```

## 2. 시간 체크 영역 (헤더 아래)

### 목적

- 학습 시간 추적 및 확인
- 계획 대비 실제 학습 시간 비교
- 일시정지 상태 모니터링

### 표시 정보

1. **시작/종료 시간**

   - 시작: `시작: 2025-01-13 09:00`
   - 종료: `종료: 2025-01-13 11:30` (완료된 경우)

2. **학습 시간**

   - 총 학습 시간: `총 학습: 2시간 30분`
   - 순수 학습 시간: `순수 학습: 2시간 15분` (일시정지 제외)
   - 일시정지 시간: `일시정지: 15분`
   - 일시정지 횟수: `일시정지 3회`

3. **현재 진행 시간** (진행 중인 경우)

   - 실시간 타이머: `진행 중: 00:45:23`
   - 일시정지 중: `일시정지 중: 00:42:15` (일시정지 시간 제외)

4. **계획 대비 비교** (선택사항)
   - 계획 시간: `계획: 2시간`
   - 실제 시간: `실제: 2시간 30분`
   - 차이: `+30분 초과` 또는 `-15분 부족`

### 레이아웃 옵션

#### 옵션 A: 카드형 타임라인

```jsx
<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
  <h3 className="mb-4 text-sm font-semibold text-gray-700">시간 정보</h3>

  {/* 시작/종료 시간 */}
  <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">시작 시간</span>
      <span className="text-sm font-medium text-gray-900">
        2025-01-13 09:00
      </span>
    </div>
    {actualEndTime && (
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">종료 시간</span>
        <span className="text-sm font-medium text-gray-900">
          2025-01-13 11:30
        </span>
      </div>
    )}
  </div>

  {/* 학습 시간 통계 */}
  <div className="grid grid-cols-2 gap-4">
    <div className="rounded-lg bg-blue-50 p-3">
      <div className="text-xs text-blue-600">총 학습</div>
      <div className="mt-1 text-lg font-bold text-blue-900">2시간 30분</div>
    </div>
    <div className="rounded-lg bg-green-50 p-3">
      <div className="text-xs text-green-600">순수 학습</div>
      <div className="mt-1 text-lg font-bold text-green-900">2시간 15분</div>
    </div>
  </div>

  {/* 일시정지 정보 */}
  {pauseCount > 0 && (
    <div className="mt-4 flex items-center justify-between rounded-lg bg-amber-50 p-3">
      <div>
        <div className="text-xs text-amber-600">일시정지</div>
        <div className="mt-1 text-sm font-semibold text-amber-900">
          {pauseCount}회 / {formatTime(pausedDuration)}분
        </div>
      </div>
    </div>
  )}

  {/* 현재 진행 시간 (진행 중인 경우) */}
  {isActive && (
    <div className="mt-4 rounded-lg bg-indigo-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo-700">진행 중</span>
        <div className="text-2xl font-bold text-indigo-900">
          {formatElapsedTime()}
        </div>
      </div>
      {isPaused && (
        <div className="mt-2 text-xs text-indigo-600">일시정지 중</div>
      )}
    </div>
  )}
</div>
```

#### 옵션 B: 컴팩트 인라인 표시

```jsx
<div className="rounded-lg border border-gray-200 bg-white p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-6 text-sm">
      <div>
        <span className="text-gray-600">시작</span>
        <span className="ml-2 font-medium">09:00</span>
      </div>
      {actualEndTime && (
        <>
          <div className="h-4 w-px bg-gray-300"></div>
          <div>
            <span className="text-gray-600">종료</span>
            <span className="ml-2 font-medium">11:30</span>
          </div>
        </>
      )}
      <div className="h-4 w-px bg-gray-300"></div>
      <div>
        <span className="text-gray-600">학습</span>
        <span className="ml-2 font-bold text-blue-600">2시간 30분</span>
      </div>
      {pauseCount > 0 && (
        <>
          <div className="h-4 w-px bg-gray-300"></div>
          <div>
            <span className="text-gray-600">일시정지</span>
            <span className="ml-2 font-medium">{pauseCount}회</span>
          </div>
        </>
      )}
    </div>

    {/* 실시간 타이머 (진행 중인 경우) */}
    {isActive && (
      <div className="rounded-full bg-indigo-100 px-4 py-2">
        <div className="text-lg font-bold text-indigo-900">
          {formatElapsedTime()}
        </div>
      </div>
    )}
  </div>
</div>
```

#### 옵션 C: 타임라인 스타일

```jsx
<div className="relative rounded-lg border border-gray-200 bg-white p-6">
  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

  {/* 시작 시간 */}
  <div className="relative flex items-start gap-4">
    <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
      <div className="h-2 w-2 rounded-full bg-white"></div>
    </div>
    <div className="flex-1 pb-4">
      <div className="text-xs text-gray-500">시작</div>
      <div className="text-sm font-semibold text-gray-900">
        2025-01-13 09:00
      </div>
    </div>
  </div>

  {/* 진행 중 (있는 경우) */}
  {isActive && (
    <div className="relative flex items-start gap-4">
      <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 animate-pulse">
        <div className="h-2 w-2 rounded-full bg-white"></div>
      </div>
      <div className="flex-1 pb-4">
        <div className="text-xs text-gray-500">진행 중</div>
        <div className="text-2xl font-bold text-blue-600">
          {formatElapsedTime()}
        </div>
        {isPaused && (
          <div className="mt-1 text-xs text-amber-600">일시정지 중</div>
        )}
      </div>
    </div>
  )}

  {/* 종료 시간 (완료된 경우) */}
  {actualEndTime && (
    <div className="relative flex items-start gap-4">
      <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gray-400">
        <div className="h-2 w-2 rounded-full bg-white"></div>
      </div>
      <div className="flex-1">
        <div className="text-xs text-gray-500">종료</div>
        <div className="text-sm font-semibold text-gray-900">
          2025-01-13 11:30
        </div>
        <div className="mt-2 text-sm">
          <span className="text-gray-600">총 학습:</span>
          <span className="ml-2 font-bold text-gray-900">2시간 30분</span>
        </div>
      </div>
    </div>
  )}
</div>
```

## 3. 통합 레이아웃 제안

### 전체 구조

```
┌─────────────────────────────────────────┐
│ [메모] [범위조정]                        │
│         📚                              │
│    콘텐츠 제목                          │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│    📖 p.50 ~ p.75  1회차  블록 2개      │
│    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
├─────────────────────────────────────────┤
│  ⏱️ 시간 정보                           │
│  ┌─────────────────┬─────────────────┐ │
│  │ 시작: 09:00     │ 종료: 11:30     │ │
│  │ 총 학습: 2:30   │ 순수: 2:15      │ │
│  └─────────────────┴─────────────────┘ │
│  현재 진행: 00:45:23                    │
├─────────────────────────────────────────┤
│  [시작] [일시정지] [완료] [재개]        │
│  진행률: ████████░░ 80%                │
└─────────────────────────────────────────┘
```

## 4. 추천 구현 요소

### 필수 요소

1. ✅ **학습 범위 표시** - 계획된 범위 (시작 ~ 종료)
2. ✅ **회차 표시** - 현재 회차 및 블록 수
3. ✅ **시작/종료 시간** - 실제 학습 시간 기록
4. ✅ **총 학습 시간** - 순수 학습 시간 (일시정지 제외)
5. ✅ **일시정지 정보** - 횟수 및 총 일시정지 시간

### 권장 요소

6. ⭐ **실시간 타이머** - 진행 중인 경우 현재 경과 시간
7. ⭐ **진행률 표시** - 계획 대비 완료 비율
8. ⭐ **블록별 진행 상황** - 각 블록의 완료 상태

### 선택 요소

9. 📊 **계획 대비 비교** - 예상 시간 vs 실제 시간
10. 📊 **통계 정보** - 평균 학습 속도, 남은 예상 시간
11. 📊 **히스토리** - 과거 학습 기록 그래프

## 5. UI 컴포넌트 구조

```
PlanGroupCard (단일 뷰)
├── PlanGroupHeader (헤더 영역)
│   ├── PlanGroupActions (메모, 범위조정 아이콘)
│   ├── ContentIcon & Title
│   └── PlanDetailInfo (새로 추가)
│       ├── LearningRange (학습 범위)
│       ├── SequenceInfo (회차)
│       └── BlockCount (블록 수)
│
├── TimeCheckSection (새로 추가)
│   ├── TimeTimeline (시작/종료 시간)
│   ├── StudyTimeStats (학습 시간 통계)
│   ├── PauseInfo (일시정지 정보)
│   └── LiveTimer (실시간 타이머)
│
└── ProgressAndControls (기존)
    ├── ProgressBar
    └── TimerControlButtons
```

## 6. 데이터 계산 로직

### 학습 범위 계산

```typescript
function getLearningRange(plans: PlanWithContent[]): string {
  const sortedPlans = plans.sort((a, b) => a.block_index - b.block_index);
  const firstPlan = sortedPlans[0];
  const lastPlan = sortedPlans[sortedPlans.length - 1];

  const start = firstPlan.planned_start_page_or_time ?? 0;
  const end = lastPlan.planned_end_page_or_time ?? 0;

  if (firstPlan.content_type === "book") {
    return `p.${start} ~ p.${end}`;
  } else {
    return `${formatTime(start)} ~ ${formatTime(end)}`;
  }
}

function getTotalRange(plans: PlanWithContent[]): number {
  return plans.reduce((sum, plan) => {
    const range =
      (plan.planned_end_page_or_time ?? 0) -
      (plan.planned_start_page_or_time ?? 0);
    return sum + range;
  }, 0);
}
```

### 시간 정보 계산

```typescript
function getTimeStats(plans: PlanWithContent[], activePlan: Plan | null) {
  const totalDuration = plans.reduce(
    (sum, plan) => sum + (plan.total_duration_seconds ?? 0),
    0
  );

  const pausedDuration = plans.reduce(
    (sum, plan) => sum + (plan.paused_duration_seconds ?? 0),
    0
  );

  const pureStudyTime = totalDuration - pausedDuration;

  const pauseCount = plans.reduce(
    (sum, plan) => sum + (plan.pause_count ?? 0),
    0
  );

  const firstStartTime = plans
    .filter((p) => p.actual_start_time)
    .sort(
      (a, b) =>
        new Date(a.actual_start_time!).getTime() -
        new Date(b.actual_start_time!).getTime()
    )[0]?.actual_start_time;

  const lastEndTime = plans
    .filter((p) => p.actual_end_time)
    .sort(
      (a, b) =>
        new Date(b.actual_end_time!).getTime() -
        new Date(a.actual_end_time!).getTime()
    )[0]?.actual_end_time;

  return {
    totalDuration,
    pureStudyTime,
    pausedDuration,
    pauseCount,
    firstStartTime,
    lastEndTime,
    isActive: !!activePlan,
  };
}
```

## 7. 반응형 고려사항

- **모바일**: 세로 레이아웃, 정보 카드 스택
- **태블릿**: 2열 그리드, 인라인 정보 표시
- **데스크톱**: 3-4열 그리드, 상세 정보 표시

## 8. 접근성

- 모든 시간 정보에 `aria-label` 추가
- 색상 대비 충분히 확보
- 키보드 네비게이션 지원
- 스크린 리더 친화적 텍스트
