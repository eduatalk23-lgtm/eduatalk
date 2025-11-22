# Today 페이지 - 플랜 타이머 기능

## 📋 기능 개요

`/today` 페이지에서 각 플랜에 대한 학습 시간을 측정하고 관리하는 타이머 기능입니다. 학습 시작, 일시정지, 재개, 완료 등의 기능을 제공하며, 실제 학습 시간을 정확하게 추적합니다.

## ✨ 주요 기능

### 1. 플랜 시작 (타이머 시작)

- 플랜을 시작하면 학습 세션(`student_study_sessions`)이 생성됩니다
- 플랜의 `actual_start_time`이 기록됩니다 (처음 시작하는 경우만)
- 타이머가 시작되어 실시간으로 학습 시간을 표시합니다

### 2. 일시정지/재개

- 학습 중 언제든지 일시정지를 할 수 있습니다
- 일시정지된 시간은 제외하고 실제 학습 시간만 계산합니다
- 일시정지 횟수(`pause_count`)와 총 일시정지 시간(`paused_duration_seconds`)을 추적합니다

### 3. 학습 시간 표시

- 실시간으로 경과 시간을 표시합니다 (1초 단위 업데이트)
- 시간 형식:
  - 1시간 미만: `MM:SS` 형식 (예: `45:23`)
  - 1시간 이상: `HH:MM:SS` 형식 (예: `01:23:45`)
- 일시정지 횟수와 일시정지된 시간도 함께 표시됩니다

### 4. 플랜 완료

- 완료 시 플랜의 `actual_end_time`이 기록됩니다
- 총 학습 시간(`total_duration_seconds`)이 계산되어 저장됩니다
- 실제 학습 시간 = 총 소요 시간 - 일시정지된 시간

## 🏗 구조 및 데이터 흐름

### 컴포넌트 구조

```
/today 페이지
├── TodayPlanList (서버 컴포넌트)
│   └── DraggablePlanList (클라이언트 컴포넌트)
│       ├── TodayPlanItem (대기 중인 플랜)
│       └── PlanTimerCard (활성/완료된 플랜) ⭐ 타이머 UI
│
└── CurrentLearningSection (서버 컴포넌트)
    └── ActiveLearningWidget (현재 학습 중인 플랜)
```

### 데이터베이스 구조

#### `student_plan` 테이블

- `actual_start_time`: 플랜 시작 시간
- `actual_end_time`: 플랜 완료 시간
- `total_duration_seconds`: 총 소요 시간 (초 단위)
- `paused_duration_seconds`: 총 일시정지된 시간 (초 단위)
- `pause_count`: 일시정지 횟수

#### `student_study_sessions` 테이블

- `plan_id`: 연결된 플랜 ID
- `started_at`: 세션 시작 시간
- `ended_at`: 세션 종료 시간
- `paused_at`: 일시정지 시작 시간
- `resumed_at`: 재개 시간
- `paused_duration_seconds`: 이 세션에서 일시정지된 시간

## 🔧 구현 상세

### PlanTimerCard 컴포넌트

클라이언트 컴포넌트로, 타이머 UI와 제어 버튼을 제공합니다.

**주요 Props:**

```typescript
type PlanTimerCardProps = {
  planId: string;
  planTitle: string;
  contentType: "book" | "lecture" | "custom";
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  totalDurationSeconds?: number | null;
  pausedDurationSeconds?: number | null;
  pauseCount?: number | null;
  activeSessionId?: string | null;
  isPaused?: boolean;
};
```

**주요 기능:**

1. **경과 시간 계산**

```43:67:app/(student)/today/_components/PlanTimerCard.tsx
  // 경과 시간 계산
  useEffect(() => {
    if (!isRunning || isPaused || actualEndTime) {
      return;
    }

    const calculateElapsed = () => {
      if (actualStartTime) {
        const start = new Date(actualStartTime);
        const now = new Date();
        const total = Math.floor((now.getTime() - start.getTime()) / 1000);
        const paused = pausedDurationSeconds || 0;
        return Math.max(0, total - paused);
      }
      return 0;
    };

    setElapsedSeconds(calculateElapsed());

    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, actualStartTime, actualEndTime, pausedDurationSeconds]);
```

2. **시간 포맷팅**

```77:86:app/(student)/today/_components/PlanTimerCard.tsx
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };
```

### 서버 액션 (todayActions.ts)

#### 1. 플랜 시작 (`startPlan`)

```19:70:app/(student)/today/actions/todayActions.ts
export async function startPlan(
  planId: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const tenantContext = await getTenantContext();

    // 플랜 조회
    const plan = await getPlanById(
      planId,
      user.userId,
      tenantContext?.tenantId || null
    );

    if (!plan) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    // 학습 세션 시작
    const result = await startStudySession(planId);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 플랜의 actual_start_time 업데이트 (처음 시작하는 경우만)
    if (!plan.actual_start_time) {
      await supabase
        .from("student_plan")
        .update({
          actual_start_time: new Date().toISOString(),
        })
        .eq("id", planId)
        .eq("student_id", user.userId);
    }

    revalidatePath("/today");
    revalidatePath("/dashboard");
    revalidatePath(`/today/plan/${planId}`);
    return { success: true, sessionId: result.sessionId };
  } catch (error) {
    console.error("[todayActions] 플랜 시작 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 시작에 실패했습니다.",
    };
  }
}
```

**처리 과정:**
1. 플랜 존재 여부 확인
2. `startStudySession`으로 학습 세션 생성
3. 플랜의 `actual_start_time` 기록 (처음 시작하는 경우만)
4. 관련 페이지 재검증

#### 2. 일시정지 (`pausePlan`)

```370:435:app/(student)/today/actions/todayActions.ts
export async function pausePlan(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 활성 세션 조회
    const { data: activeSession } = await supabase
      .from("student_study_sessions")
      .select("id, paused_at")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .maybeSingle();

    if (!activeSession) {
      return { success: false, error: "활성 세션을 찾을 수 없습니다." };
    }

    // 이미 일시정지된 상태인지 확인
    if (activeSession.paused_at && !activeSession.resumed_at) {
      return { success: false, error: "이미 일시정지된 상태입니다." };
    }

    // 세션 일시정지
    await supabase
      .from("student_study_sessions")
      .update({
        paused_at: new Date().toISOString(),
      })
      .eq("id", activeSession.id);

    // 플랜의 pause_count 증가
    const { data: planData } = await supabase
      .from("student_plan")
      .select("pause_count")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    const currentPauseCount = planData?.pause_count || 0;
    await supabase
      .from("student_plan")
      .update({
        pause_count: currentPauseCount + 1,
      })
      .eq("id", planId)
      .eq("student_id", user.userId);

    revalidatePath("/today");
    revalidatePath("/dashboard");
    revalidatePath(`/today/plan/${planId}`);
    return { success: true };
  } catch (error) {
    console.error("[todayActions] 플랜 일시정지 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 일시정지에 실패했습니다.",
    };
  }
}
```

**처리 과정:**
1. 활성 세션 조회 및 검증
2. 세션의 `paused_at` 기록
3. 플랜의 `pause_count` 증가

#### 3. 재개 (`resumePlan`)

```440:511:app/(student)/today/actions/todayActions.ts
export async function resumePlan(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 활성 세션 조회
    const { data: activeSession } = await supabase
      .from("student_study_sessions")
      .select("id, paused_at, paused_duration_seconds")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .maybeSingle();

    if (!activeSession) {
      return { success: false, error: "활성 세션을 찾을 수 없습니다." };
    }

    // 일시정지 상태인지 확인
    if (!activeSession.paused_at || activeSession.resumed_at) {
      return { success: false, error: "일시정지된 상태가 아닙니다." };
    }

    const pausedAt = new Date(activeSession.paused_at);
    const resumedAt = new Date();
    const pauseDuration = Math.floor((resumedAt.getTime() - pausedAt.getTime()) / 1000);
    const totalPausedDuration = (activeSession.paused_duration_seconds || 0) + pauseDuration;

    // 세션 재개
    await supabase
      .from("student_study_sessions")
      .update({
        resumed_at: resumedAt.toISOString(),
        paused_duration_seconds: totalPausedDuration,
      })
      .eq("id", activeSession.id);

    // 플랜의 paused_duration_seconds 업데이트
    const { data: planData } = await supabase
      .from("student_plan")
      .select("paused_duration_seconds")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    const planPausedDuration = planData?.paused_duration_seconds || 0;
    await supabase
      .from("student_plan")
      .update({
        paused_duration_seconds: planPausedDuration + pauseDuration,
      })
      .eq("id", planId)
      .eq("student_id", user.userId);

    revalidatePath("/today");
    revalidatePath("/dashboard");
    revalidatePath(`/today/plan/${planId}`);
    return { success: true };
  } catch (error) {
    console.error("[todayActions] 플랜 재개 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 재개에 실패했습니다.",
    };
  }
}
```

**처리 과정:**
1. 활성 세션 조회 및 일시정지 상태 확인
2. 일시정지 기간 계산 (`paused_at` ~ 현재 시간)
3. 세션의 `paused_duration_seconds`에 누적
4. 플랜의 `paused_duration_seconds`도 업데이트
5. 세션의 `resumed_at` 기록

#### 4. 플랜 완료 (`completePlan`)

플랜 완료 시 학습 시간 정보를 최종 업데이트합니다:

```222:265:app/(student)/today/actions/todayActions.ts
    // 플랜의 actual_end_time 및 시간 정보 업데이트
    const now = new Date();
    const actualEndTime = now.toISOString();

    // 플랜의 actual_start_time 조회
    const { data: planData } = await supabase
      .from("student_plan")
      .select("actual_start_time, paused_duration_seconds, pause_count")
      .eq("id", planId)
      .eq("student_id", user.userId)
      .maybeSingle();

    let totalDurationSeconds: number | null = null;
    if (planData?.actual_start_time) {
      const startTime = new Date(planData.actual_start_time);
      const endTime = new Date(actualEndTime);
      totalDurationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    }

    // 활성 세션 조회하여 일시정지 정보 가져오기
    const { data: activeSession } = await supabase
      .from("student_study_sessions")
      .select("paused_duration_seconds")
      .eq("plan_id", planId)
      .eq("student_id", user.userId)
      .is("ended_at", null)
      .maybeSingle();

    const sessionPausedDuration = activeSession?.paused_duration_seconds || 0;
    const planPausedDuration = planData?.paused_duration_seconds || 0;
    const totalPausedDuration = sessionPausedDuration + planPausedDuration;
    const pauseCount = planData?.pause_count || 0;

    // 플랜 시간 정보 업데이트
    await supabase
      .from("student_plan")
      .update({
        actual_end_time: actualEndTime,
        total_duration_seconds: totalDurationSeconds,
        paused_duration_seconds: totalPausedDuration,
        pause_count: pauseCount,
      })
      .eq("id", planId)
      .eq("student_id", user.userId);
```

**처리 과정:**
1. 총 소요 시간 계산 (`actual_start_time` ~ `actual_end_time`)
2. 세션과 플랜의 일시정지 시간 합산
3. 플랜의 최종 시간 정보 업데이트

## 📊 UI 상태 및 동작

### 플랜 상태별 표시

#### 1. 대기 중 (시작 전)

```tsx
// TodayPlanItem 컴포넌트 사용
<TodayPlanItem plan={plan} />
```

- 시작 버튼 표시
- 타이머 표시 안 함

#### 2. 학습 중 (활성)

```tsx
// PlanTimerCard 컴포넌트 사용
<PlanTimerCard
  isRunning={true}
  isPaused={false}
  // ...
/>
```

- 실시간 타이머 표시
- 일시정지 버튼
- 완료하기 버튼

#### 3. 일시정지 중

```tsx
<PlanTimerCard
  isRunning={false}
  isPaused={true}
  // ...
/>
```

- 일시정지된 시간까지의 타이머 표시 (고정)
- 다시시작 버튼
- 완료하기 버튼

#### 4. 완료

```tsx
<PlanTimerCard
  isCompleted={true}
  // ...
/>
```

- 총 학습 시간 표시 (고정)
- 일시정지 횟수 및 시간 표시
- 상세보기 버튼

### DraggablePlanList에서의 조건부 렌더링

```117:169:app/(student)/today/_components/DraggablePlanList.tsx
          const isActive = !!plan.actual_start_time && !plan.actual_end_time;
          const isCompleted = !!plan.actual_end_time;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          // 활성 플랜이거나 완료된 플랜은 PlanTimerCard 사용
          if (isActive || isCompleted) {
            return (
              <div
                key={plan.id}
                draggable={!isActive && !isCompleted}
                onDragStart={(e) => {
                  if (!isActive && !isCompleted) {
                    handleDragStart(index);
                    e.dataTransfer.effectAllowed = "move";
                  } else {
                    e.preventDefault();
                  }
                }}
                onDragOver={(e) => {
                  if (!isActive && !isCompleted) {
                    handleDragOver(e, index);
                  }
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  if (!isActive && !isCompleted) {
                    handleDrop(e, index);
                  }
                }}
                onDragEnd={handleDragEnd}
                className={cn(
                  "relative",
                  isDragging && "opacity-50",
                  isDragOver && "ring-2 ring-indigo-500 ring-offset-2"
                )}
              >
                <PlanTimerCard
                  planId={plan.id}
                  planTitle={plan.content?.title || "제목 없음"}
                  contentType={plan.content_type}
                  startTime={null}
                  endTime={null}
                  actualStartTime={plan.actual_start_time}
                  actualEndTime={plan.actual_end_time}
                  totalDurationSeconds={plan.total_duration_seconds}
                  pausedDurationSeconds={plan.paused_duration_seconds}
                  pauseCount={plan.pause_count}
                  activeSessionId={plan.session ? plan.id : null}
                  isPaused={plan.session?.isPaused || false}
                />
              </div>
            );
          }
```

**조건:**
- `isActive`: `actual_start_time`이 있고 `actual_end_time`이 없는 경우
- `isCompleted`: `actual_end_time`이 있는 경우
- 활성 또는 완료된 플랜은 드래그 불가능

## ⏱ 시간 계산 로직

### 실제 학습 시간 계산

```typescript
실제 학습 시간 = 총 소요 시간 - 일시정지된 시간

총 소요 시간 = actual_end_time - actual_start_time
일시정지된 시간 = 세션의 paused_duration_seconds + 플랜의 paused_duration_seconds
```

### 일시정지 시간 추적

1. **세션 레벨**: 각 일시정지/재개 시점의 시간을 계산하여 `student_study_sessions.paused_duration_seconds`에 누적
2. **플랜 레벨**: 모든 세션의 일시정지 시간을 합산하여 `student_plan.paused_duration_seconds`에 저장

## 🎯 사용자 경험

### 타이머 표시

```177:197:app/(student)/today/_components/PlanTimerCard.tsx
      {showTimer && (
        <div className="mb-3 rounded-lg bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">학습 시간</span>
            </div>
            <div className="text-lg font-bold text-indigo-600">
              {formatTime(elapsedSeconds)}
            </div>
          </div>
          {pauseCount !== null && pauseCount > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              일시정지: {pauseCount}회
              {pausedDurationSeconds !== null && pausedDurationSeconds > 0 && (
                <span> ({formatTime(pausedDurationSeconds)})</span>
              )}
            </div>
          )}
        </div>
      )}
```

- 시계 아이콘과 함께 학습 시간 표시
- 큰 글씨로 시간 강조 (인디고 색상)
- 일시정지 횟수와 시간 정보 표시

### 버튼 상태

- **시작하기**: 파란색 (indigo-600)
- **일시정지**: 노란색 (yellow-600)
- **다시시작**: 파란색 (indigo-600)
- **완료하기**: 초록색 (green-600)
- **상세보기**: 회색 (gray-600)

## 🔄 세션 관리

### 세션 생성 및 종료

- `startStudySession`: 새로운 학습 세션 생성
- `endStudySession`: 학습 세션 종료 및 시간 기록
- 하나의 플랜당 하나의 활성 세션만 허용

### 세션과 플랜의 관계

- 플랜이 시작되면 세션이 생성됩니다
- 플랜의 시간 정보는 세션 정보를 기반으로 업데이트됩니다
- 완료 시 세션은 종료되고 플랜의 최종 시간이 기록됩니다

## 📝 참고사항

### 성능 최적화

- 1초마다 경과 시간 업데이트 (클라이언트 측)
- 서버 재검증은 사용자 액션 시에만 발생 (시작/일시정지/재개/완료)
- 활성 세션 조회는 서버 컴포넌트에서 한 번만 수행

### 데이터 일관성

- 플랜과 세션의 시간 정보가 동기화됩니다
- 일시정지 시간은 세션과 플랜 두 곳에서 추적하여 정확성을 보장합니다
- 완료 시 모든 시간 정보가 최종 업데이트됩니다

### 사용자 제약사항

- 활성 플랜은 드래그하여 순서 변경 불가
- 완료된 플랜도 드래그 불가
- 하나의 플랜만 활성화 가능 (새 플랜 시작 시 기존 활성 세션 종료)

