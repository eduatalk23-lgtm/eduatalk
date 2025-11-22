# 타이머 버튼 클릭 시 프로세스 플로우

## 날짜
2025-01-13

## 개요
시작하기, 일시정지 버튼을 클릭할 때 어떤 프로세스가 진행되는지 상세히 설명합니다.

---

## 1. 시작하기 버튼 클릭 시 프로세스

### 클라이언트 사이드 (UI)

```
1. 사용자가 "시작하기" 버튼 클릭
   ↓
2. TimeCheckSection의 onStart 핸들러 호출
   - setOptimisticIsActive(true)  // 즉시 UI 업데이트 (Optimistic Update)
   - setOptimisticIsPaused(false)
   ↓
3. PlanGroupCard의 handleGroupStart 호출
   - setIsLoading(true)  // 로딩 상태 활성화
   ↓
4. startPlan(planId) 서버 액션 호출
```

### 서버 사이드 (데이터베이스)

```
5. startPlan 액션 실행
   ├─ 사용자 인증 확인
   ├─ 플랜 조회 (getPlanById)
   │
   ├─ startStudySession(planId) 호출
   │  ├─ 기존 활성 세션 확인
   │  ├─ 기존 세션이 있으면 강제 종료
   │  ├─ 새 세션 생성 (createSession)
   │  │  └─ student_study_sessions 테이블에 INSERT
   │  │     - started_at: 현재 시간 (타임스탬프)
   │  │     - plan_id: 플랜 ID
   │  │     - student_id: 학생 ID
   │  │     - ended_at: NULL (진행 중)
   │  │
   │  └─ sessionId 반환
   │
   └─ student_plan 테이블 업데이트
      └─ actual_start_time: 현재 시간 (처음 시작하는 경우만)
         - 타임스탬프 저장
```

### 데이터베이스 변경 사항

**student_study_sessions 테이블:**
```sql
INSERT INTO student_study_sessions (
  id,
  student_id,
  plan_id,
  started_at,
  ended_at,
  paused_at,
  resumed_at,
  paused_duration_seconds
) VALUES (
  gen_random_uuid(),
  '학생ID',
  '플랜ID',
  '2025-01-13 21:23:51',  -- 시작 타임스탬프
  NULL,
  NULL,
  NULL,
  0
);
```

**student_plan 테이블:**
```sql
UPDATE student_plan
SET actual_start_time = '2025-01-13 21:23:51'  -- 시작 타임스탬프
WHERE id = '플랜ID' AND student_id = '학생ID'
AND actual_start_time IS NULL;  -- 처음 시작하는 경우만
```

### 클라이언트 사이드 (UI 업데이트)

```
6. startPlan 성공 응답
   ↓
7. router.refresh() 호출
   - Next.js 서버 컴포넌트 재렌더링
   - 최신 데이터로 UI 업데이트
   ↓
8. setIsLoading(false)
   - 로딩 상태 해제
```

---

## 2. 일시정지 버튼 클릭 시 프로세스

### 클라이언트 사이드 (UI)

```
1. 사용자가 "일시정지" 버튼 클릭
   ↓
2. TimeCheckSection의 onPause 핸들러 호출
   - setOptimisticIsPaused(true)  // 즉시 UI 업데이트 (Optimistic Update)
   ↓
3. PlanGroupCard의 handleGroupPause 호출
   - setIsLoading(true)  // 로딩 상태 활성화
   ↓
4. pausePlan(planId) 서버 액션 호출
```

### 서버 사이드 (데이터베이스)

```
5. pausePlan 액션 실행
   ├─ 사용자 인증 확인
   │
   ├─ 활성 세션 조회
   │  └─ student_study_sessions 테이블에서 조회
   │     - plan_id = 플랜ID
   │     - student_id = 학생ID
   │     - ended_at IS NULL (진행 중인 세션)
   │     - ORDER BY started_at DESC (최신 세션 우선)
   │
   ├─ 세션 검증
   │  ├─ 세션이 없으면 에러 반환
   │  └─ 이미 일시정지된 상태면 에러 반환
   │     (paused_at IS NOT NULL AND resumed_at IS NULL)
   │
   ├─ student_study_sessions 테이블 업데이트
   │  └─ paused_at: 현재 시간 (타임스탬프)
   │
   └─ student_plan 테이블 업데이트
      └─ pause_count: 기존 값 + 1
```

### 데이터베이스 변경 사항

**student_study_sessions 테이블:**
```sql
UPDATE student_study_sessions
SET paused_at = '2025-01-13 21:24:20'  -- 일시정지 타임스탬프
WHERE id = '세션ID'
AND student_id = '학생ID'
AND ended_at IS NULL
AND (paused_at IS NULL OR resumed_at IS NOT NULL);
```

**student_plan 테이블:**
```sql
UPDATE student_plan
SET pause_count = pause_count + 1
WHERE id = '플랜ID' AND student_id = '학생ID';
```

### 클라이언트 사이드 (UI 업데이트)

```
6. pausePlan 성공 응답
   ↓
7. router.refresh() 호출
   - Next.js 서버 컴포넌트 재렌더링
   - 최신 데이터로 UI 업데이트
   ↓
8. setIsLoading(false)
   - 로딩 상태 해제
```

---

## 3. 재시작 버튼 클릭 시 프로세스

### 클라이언트 사이드 (UI)

```
1. 사용자가 "재시작" 버튼 클릭
   ↓
2. TimeCheckSection의 onResume 핸들러 호출
   - setOptimisticIsPaused(false)  // 즉시 UI 업데이트
   ↓
3. PlanGroupCard의 handleGroupResume 호출
   - setIsLoading(true)
   ↓
4. resumePlan(planId) 서버 액션 호출
```

### 서버 사이드 (데이터베이스)

```
5. resumePlan 액션 실행
   ├─ 사용자 인증 확인
   │
   ├─ 활성 세션 조회
   │  └─ 일시정지된 세션 확인
   │     (paused_at IS NOT NULL AND resumed_at IS NULL)
   │
   ├─ 일시정지 시간 계산
   │  └─ (현재 시간 - paused_at) = 일시정지된 시간 (초)
   │
   ├─ student_study_sessions 테이블 업데이트
   │  ├─ resumed_at: 현재 시간 (타임스탬프)
   │  └─ paused_duration_seconds: 기존 값 + 일시정지 시간
   │
   └─ student_plan 테이블 업데이트
      └─ paused_duration_seconds: 기존 값 + 일시정지 시간
```

### 데이터베이스 변경 사항

**student_study_sessions 테이블:**
```sql
UPDATE student_study_sessions
SET 
  resumed_at = '2025-01-13 21:25:00',  -- 재시작 타임스탬프
  paused_duration_seconds = paused_duration_seconds + 40  -- 일시정지 시간 추가
WHERE id = '세션ID'
AND student_id = '학생ID'
AND paused_at IS NOT NULL
AND resumed_at IS NULL;
```

**student_plan 테이블:**
```sql
UPDATE student_plan
SET paused_duration_seconds = paused_duration_seconds + 40
WHERE id = '플랜ID' AND student_id = '학생ID';
```

---

## 4. 완료 버튼 클릭 시 프로세스

### 클라이언트 사이드 (UI)

```
1. 사용자가 "완료하기" 버튼 클릭
   ↓
2. TimeCheckSection의 onComplete 핸들러 호출
   ↓
3. PlanGroupCard의 handleGroupComplete 호출
   - router.push(`/today/plan/${planId}`)  // 완료 페이지로 이동
```

### 서버 사이드 (완료 페이지에서 처리)

완료 페이지(`/today/plan/[planId]`)에서:
- 사용자가 시작/종료 페이지(또는 시간) 입력
- `completePlan` 액션 호출
- `actual_end_time` 저장
- 총 학습 시간 계산
- 모든 활성 세션 종료

---

## 5. 타임스탬프 저장 위치

### 시작 타임스탬프
- **student_plan.actual_start_time**: 플랜의 시작 시간
- **student_study_sessions.started_at**: 세션의 시작 시간

### 일시정지 타임스탬프
- **student_study_sessions.paused_at**: 일시정지 시작 시간

### 재시작 타임스탬프
- **student_study_sessions.resumed_at**: 재시작 시간

### 완료 타임스탬프
- **student_plan.actual_end_time**: 플랜의 완료 시간
- **student_study_sessions.ended_at**: 세션의 종료 시간

---

## 6. 총 학습 시간 계산 방식

### 타임스탬프 기반 계산

```typescript
총 학습 시간 = (종료 시간 또는 현재 시간) - 시작 시간 - 일시정지 시간
```

**예시:**
- 시작: 21:23:51
- 일시정지: 21:24:20 (40초 일시정지)
- 재시작: 21:25:00
- 현재: 21:28:58

```
총 경과 시간 = 21:28:58 - 21:23:51 = 5분 7초 (307초)
일시정지 시간 = 40초
순수 학습 시간 = 307초 - 40초 = 267초 (4분 27초)
```

---

## 7. Optimistic Update (낙관적 업데이트)

버튼 클릭 시 서버 응답을 기다리지 않고 즉시 UI를 업데이트합니다:

```typescript
// 시작하기 버튼 클릭 시
onStart={() => {
  setOptimisticIsActive(true);   // 즉시 "진행 중" 상태로 변경
  setOptimisticIsPaused(false);
  onStart();  // 서버 액션 호출
}}

// 일시정지 버튼 클릭 시
onPause={() => {
  setOptimisticIsPaused(true);  // 즉시 "일시정지 중" 상태로 변경
  onPause();  // 서버 액션 호출
}}
```

서버 응답 후 `router.refresh()`로 실제 상태와 동기화합니다.

---

## 8. 에러 처리

### 시작하기 실패 시
- 에러 메시지 표시 (alert)
- Optimistic 상태 유지 (서버 응답 후 자동 초기화)
- 로딩 상태 해제

### 일시정지 실패 시
- "이미 일시정지된 상태입니다" 에러는 무시 (중복 호출 방지)
- 다른 에러는 alert로 표시
- Optimistic 상태 유지

---

## 9. 성능 최적화

1. **revalidatePath**: 필요한 경로만 재검증 (`/today`)
2. **Optimistic Update**: 즉시 UI 반응
3. **타임스탬프 기반 계산**: 실시간 업데이트 제거 (CPU 부하 감소)
4. **로딩 상태 관리**: 중복 호출 방지

---

## 요약

### 시작하기 버튼
1. Optimistic Update (즉시 UI 변경)
2. 새 세션 생성 (student_study_sessions)
3. 플랜 시작 시간 저장 (student_plan.actual_start_time)
4. 페이지 새로고침

### 일시정지 버튼
1. Optimistic Update (즉시 UI 변경)
2. 세션 일시정지 시간 저장 (student_study_sessions.paused_at)
3. 플랜 일시정지 횟수 증가 (student_plan.pause_count)
4. 페이지 새로고침

### 재시작 버튼
1. Optimistic Update (즉시 UI 변경)
2. 세션 재시작 시간 저장 (student_study_sessions.resumed_at)
3. 일시정지 시간 누적 (paused_duration_seconds)
4. 페이지 새로고침

### 핵심 포인트
- **타임스탬프만 저장**: 시간 계산은 타임스탬프 기반
- **Optimistic Update**: 즉시 반응하는 UI
- **서버 동기화**: router.refresh()로 최신 상태 반영

