# 타이머 기능 리팩토링 가이드

> 브라우저 종료/새로고침/멀티 탭 상황에서도 안전하게 동작하는 타이머로 리팩토링

**작성일**: 2025-01-31  
**버전**: 2.0

---

## 📋 목차

1. [리팩토링 배경](#리팩토링-배경)
2. [설계 원칙](#설계-원칙)
3. [코드 변경 사항](#코드-변경-사항)
4. [동작 흐름](#동작-흐름)
5. [주의사항 및 한계](#주의사항-및-한계)

---

## 리팩토링 배경

### 문제점

**기존 웹 타이머의 문제점**:
- 초당 API 호출 또는 `router.refresh()` 기반으로 상태 갱신
- Server Action 응답을 기다리며 UI가 멈칫하거나 버벅임
- "Today 페이지 가이드"에서도 **"1초마다 서버 의존"**이 성능 병목으로 지적됨

**Flutter 앱과의 차이**:
- Flutter: `Timer.periodic`이 **사용자 디바이스(Local)**에서만 동작, 시작/종료 시에만 Supabase에 기록
- 웹: 서버에 계속 물어보는 구조

### 목표

웹 타이머를 Flutter와 동일한 UX 레벨로 끌어올리기:
- **"내 디바이스에서 직접 시간 계산"**
- 브라우저 종료/새로고침/멀티 탭 상황에서도 안전하게 동작

---

## 설계 원칙

### 핵심 개념: "진짜 시간의 기준"과 "UI 표시용 타이머" 분리

#### 서버(DB) 기준 정보

서버에는 다음 정보가 반드시 존재해야 합니다:

- `status`: `"NOT_STARTED" | "RUNNING" | "PAUSED" | "COMPLETED"`
- `accumulated_seconds`: 지금까지 누적된 시간(초)
- `started_at`: 마지막 시작 시각(UTC ISO 타임스탬프, RUNNING일 때만 값 존재)

**현재 DB 구조**:
- `student_plan` 테이블: `actual_start_time`, `actual_end_time`, `total_duration_seconds`, `paused_duration_seconds`, `pause_count`
- `student_study_sessions` 테이블: `started_at`, `ended_at`, `paused_at`, `resumed_at`, `paused_duration_seconds`

#### 서버 로직 규칙

1. **시작(start)**
   - 서버:
     - `status = "RUNNING"`
     - `started_at = now()`
     - `accumulated_seconds`는 그대로 유지
   - 이 시점부터 "실제 시간 경과"는 `now() - started_at`으로 계산 가능

2. **일시정지/종료(pause/stop/complete)**
   - 서버:
     - `elapsed = now() - started_at`
     - `accumulated_seconds += floor(elapsed / 1000)`
     - `started_at = null`
     - `status = "PAUSED"` 또는 `"COMPLETED"`

#### 클라이언트(브라우저) 타이머

- 클라이언트는 **초당 setInterval로 seconds를 증가시키되, 서버에는 일절 묻지 않는다.**
- 초기 진입 시 서버에서 내려준 `status`, `accumulated_seconds`, `started_at` 정보로 **초기 seconds와 isRunning을 계산**하고, 그 이후는 브라우저 메모리 상에서만 1초씩 증가.

---

## 코드 변경 사항

### 1. 새로 생성된 파일

#### `lib/utils/timerUtils.ts`
- 서버에서 클라이언트로 전달할 초기 타이머 상태를 계산하는 유틸리티
- `calculatePlanTimerState()` 함수: 플랜의 타이머 초기 상태 계산

#### `lib/hooks/useInterval.ts`
- React에서 setInterval을 안정적으로 사용하기 위한 훅
- 콜백 함수 변경 시에도 안정적으로 동작

#### `lib/hooks/usePlanTimer.ts`
- 플랜 타이머를 관리하는 공통 훅
- 클라이언트에서만 동작하며, 서버와의 통신은 호출하는 컴포넌트에서 처리
- `initialDuration`, `isInitiallyRunning`을 받아서 클라이언트에서만 1초씩 증가

### 2. 수정된 파일

#### `app/(student)/today/_components/PlanTimer.tsx`
**Before**:
- `useEffect`와 `setInterval`을 사용해서 `timeStats`를 기반으로 매초 계산
- 서버 데이터(`timeStats`)에 의존하여 매초 타임스탬프 계산

**After**:
- `usePlanTimer` 훅 사용
- 서버에서 계산된 `initialDuration`과 `isInitiallyRunning`을 props로 받아서 클라이언트에서만 1초씩 증가
- 타이머 동작 중에는 서버에 요청하지 않음

#### `app/(student)/today/_components/PlanCard.tsx`
**Before**:
- `getTimeStats`로 시간 통계 계산 후 `PlanTimer`에 전달

**After**:
- 서버 데이터를 기반으로 초기 타이머 상태(`initialTimerState`) 계산
- `initialDuration`과 `isInitiallyRunning`을 `PlanTimer`에 전달
- 세션 정보(`startedAt`, `pausedDurationSeconds`)를 활용한 정확한 초기값 계산

#### `app/(student)/today/_components/PlanTimerCard.tsx`
**Before**:
- `calculateStudyTimeFromTimestamps`로 매번 시간 계산

**After**:
- `usePlanTimer` 훅 사용
- 서버에서 계산된 초기값을 기반으로 클라이언트에서만 1초씩 증가

#### `app/api/today/plans/route.ts`
**Before**:
- 세션 정보에서 `plan_id`, `paused_at`, `resumed_at`만 조회

**After**:
- 세션 정보에 `started_at`, `paused_duration_seconds`도 포함하여 조회
- 클라이언트에서 초기 타이머 상태 계산에 필요한 모든 정보 제공

#### `app/(student)/today/_utils/planGroupUtils.ts`
**Before**:
- `PlanWithContent`의 `session` 타입에 `isPaused`, `pausedAt`, `resumedAt`만 포함

**After**:
- `session` 타입에 `startedAt`, `pausedDurationSeconds` 추가

#### `app/(student)/today/_components/PlanViewContainer.tsx`
**Before**:
- `SessionState` 타입에 `isPaused`, `pausedAt`, `resumedAt`만 포함

**After**:
- `SessionState` 타입에 `startedAt`, `pausedDurationSeconds` 추가

---

## 동작 흐름

### 서버 기준 타임라인

#### 시작(start)
1. 클라이언트: `startPlan(planId)` 호출
2. 서버:
   - `student_study_sessions` 테이블에 새 세션 생성 (`started_at = now()`)
   - `student_plan` 테이블의 `actual_start_time` 업데이트 (처음 시작하는 경우만)
3. 클라이언트: 서버 응답 후 `isRunning = true`로 설정하고 타이머 시작

#### 일시정지(pause)
1. 클라이언트: `pausePlan(planId)` 호출 (Optimistic UI: UI 먼저 멈춤)
2. 서버:
   - `student_study_sessions` 테이블의 `paused_at` 업데이트
   - `paused_duration_seconds` 계산 및 업데이트
3. 클라이언트: 서버 응답 후 상태 유지

#### 재개(resume)
1. 클라이언트: `resumePlan(planId)` 호출
2. 서버:
   - `student_study_sessions` 테이블의 `resumed_at` 업데이트
   - `paused_duration_seconds` 누적 업데이트
3. 클라이언트: 서버 응답 후 `isRunning = true`로 설정하고 타이머 재개

#### 완료(complete)
1. 클라이언트: `completePlan(planId)` 호출
2. 서버:
   - 활성 세션 종료 (`ended_at` 설정)
   - `student_plan` 테이블의 `actual_end_time`, `total_duration_seconds` 업데이트
3. 클라이언트: 타이머 정지

### 클라이언트 타이머 흐름

#### 페이지 진입 시
1. 서버에서 플랜 데이터와 세션 정보 조회
2. 서버에서 초기 타이머 상태 계산:
   ```typescript
   if (status === "RUNNING" && started_at) {
     const now = new Date();
     const startedAt = new Date(started_at);
     const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
     initialDuration = accumulated_seconds + elapsed;
     isInitiallyRunning = true;
   } else {
     initialDuration = accumulated_seconds;
     isInitiallyRunning = false;
   }
   ```
3. 클라이언트 컴포넌트에 `initialDuration`과 `isInitiallyRunning`을 props로 전달
4. `usePlanTimer` 훅이 초기값을 받아서 상태로 설정
5. `isRunning && !isPaused && !isCompleted`이면 `setInterval`로 1초씩 증가

#### 타이머 동작 중
- 클라이언트에서만 `setInterval`로 `seconds` 상태를 1초씩 증가
- 서버에는 **절대 요청하지 않음**

#### 시작/일시정지/종료 버튼 클릭 시
- **시작**: 서버 응답 후에만 클라이언트 타이머 시작 (정합성 우선)
- **일시정지/종료**: Optimistic UI 허용 (UI 먼저 멈추고 서버에 기록)

### 브라우저 종료/새로고침 시나리오

#### 시나리오 1: 브라우저 종료
1. 사용자가 브라우저를 닫음
2. 클라이언트 타이머(`setInterval`)는 사라지지만, 서버에는 `status`, `accumulated_seconds`, `started_at`이 유지됨
3. 다시 접속할 때:
   - 서버가 위 규칙대로 `initialDuration`을 계산해서 내려줌
   - 클라이언트는 `initialDuration`을 상태로 받고 다시 `setInterval`로 증가
   - **따라서 브라우저 종료는 기능적으로 전혀 문제가 없음**

#### 시나리오 2: 새로고침
1. 사용자가 새로고침 (F5 또는 Cmd+R)
2. 클라이언트 타이머는 사라지지만, 서버 데이터는 유지됨
3. 페이지 재로드 시:
   - 서버에서 최신 데이터 조회
   - 초기 타이머 상태 계산
   - 클라이언트에서 다시 타이머 시작
   - **시간이 정확히 복원됨**

#### 시나리오 3: 멀티 탭
1. 동일 유저가 여러 탭에서 같은 Plan을 열 경우
2. 각 클라이언트는 서버에서 동일한 `status`, `accumulated_seconds`, `started_at`을 읽어 동기화된 기준으로 타이머를 계산
3. 한 탭에서 일시정지/종료하면:
   - 서버 상태가 업데이트됨
   - 다른 탭은 다음 데이터 갱신 시(예: 페이지 새로고침 또는 Realtime 이벤트) 동기화됨
   - **필요 시 Supabase Realtime 등으로 pause/stop 이벤트를 다른 탭에도 push하여 즉시 업데이트 가능** (선택 사항)

---

## 주의사항 및 한계

### 멀티 탭/멀티 디바이스 동시 사용

**현재 동작**:
- 각 클라이언트는 서버에서 동일한 기준으로 초기값을 계산하므로, 페이지 로드 시점에는 동기화됨
- 한 탭에서 일시정지/종료하면 다른 탭은 다음 데이터 갱신 시(예: 페이지 새로고침) 동기화됨

**개선 가능 사항**:
- Supabase Realtime을 사용하여 pause/stop 이벤트를 다른 탭에도 즉시 push
- 각 탭의 타이머 상태도 즉시 업데이트

### 시간 동기화

**서버 시간과 브라우저 시간 차이**:
- 서버에서 `started_at`을 기준으로 초기값을 계산하므로, 브라우저 시간이 서버 시간과 다르더라도 서버 기준으로 정확하게 계산됨
- 다만, 클라이언트에서 1초씩 증가하는 동안 브라우저 시간이 크게 변하면(예: 시스템 시간 변경) 약간의 오차가 발생할 수 있음
- 이는 일반적인 사용 시나리오에서는 문제가 되지 않음

### Hydration 경고

**주의 사항**:
- 서버에서 계산된 `initialDuration`을 클라이언트에 전달할 때, 서버 시간과 클라이언트 시간이 다를 수 있음
- 하지만 초기값 계산 시 서버 시간(`started_at`)을 기준으로 하므로, Hydration 시에도 일관된 값이 전달됨
- `usePlanTimer` 훅에서 `useEffect`로 초기값을 설정하므로, Hydration 경고가 발생하지 않음

### 초당 API 호출/refresh 제거

**제거된 패턴**:
- ✅ 1초마다 `router.refresh()` 호출 제거
- ✅ 1초마다 Server Action 호출 제거
- ✅ React Query/SWR의 `refetchInterval`을 1초로 둔 타이머용 쿼리 제거
- ✅ 타이머 숫자를 맞추기 위해 초당 Supabase 쿼리를 재실행하는 로직 제거

**남아있는 `router.refresh()` 호출**:
- 시작/일시정지/종료 후에만 호출 (데이터 갱신용)
- 타이머 동작 중에는 호출하지 않음

---

## 최종 요약

### 핵심 원칙

1. **타이머의 진짜 기준은 DB** (`status`, `accumulated_seconds`, `started_at`)
2. **클라이언트 타이머는 setInterval 기반 "표시용 시계"**
3. **시작은 서버 응답 후에만 클라이언트 타이머 시작** (정합성 우선)
4. **일시정지/종료는 Optimistic 허용** (UI 먼저 멈추고 서버에 기록)
5. **타이머 동작 중에는 절대 초당 API 호출/refresh 하지 않음**

### 성능 개선

- ✅ 초당 API 호출 제거 → 네트워크 부하 대폭 감소
- ✅ 서버 의존성 제거 → UI 반응성 향상
- ✅ Flutter 앱과 동일한 UX 레벨 달성

### 안정성 개선

- ✅ 브라우저 종료/새로고침 시에도 시간 정확히 복원
- ✅ 멀티 탭 환경에서도 안전하게 동작
- ✅ 서버 시간 기준으로 정확한 시간 계산

---

**작성일**: 2025-01-31  
**작성자**: AI Assistant  
**버전**: 2.0

