# 타이머 기능 전체 점검 보고서

## 📋 점검 일자
2025-01-XX

## ✅ 정상 동작하는 기능

### 1. 타이머 시작/일시정지/재개/완료
- ✅ `startPlan`: 세션 생성 및 타이머 로그 기록
- ✅ `pausePlan`: 세션 일시정지 및 타이머 로그 기록
- ✅ `resumePlan`: 세션 재개 및 타이머 로그 기록 (최근 수정됨)
- ✅ `completePlan`: 세션 종료 및 최종 시간 계산

### 2. Optimistic Update
- ✅ 버튼 클릭 시 즉시 UI 업데이트
- ✅ 서버 응답 후 상태 동기화
- ✅ props 변경 시 optimistic 상태 초기화

### 3. 타이머 로그
- ✅ 모든 이벤트(시작/일시정지/재개/완료) 기록
- ✅ TimeCheckSection에서 로그 기반 시간 표시

### 4. 타이머 초기화
- ✅ 모든 세션 삭제
- ✅ 진행률 초기화
- ✅ 전체 진행률 반영

## ⚠️ 발견된 문제점

### 1. TimeCheckSection의 경과 시간 계산 문제

**문제**: `elapsedSeconds` 계산 시 일시정지 시간을 제외하지 않음

**현재 코드**:
```typescript
const elapsed = Math.floor((now - start) / 1000);
setElapsedSeconds(Math.max(0, elapsed));
```

**문제점**:
- `PlanItem`에서는 일시정지 시간을 제외하지만, `TimeCheckSection`에서는 제외하지 않음
- 일시정지 중에도 시간이 계속 증가하는 것처럼 보일 수 있음

**영향**: 
- 순수 학습 시간 계산이 부정확할 수 있음
- 일시정지 중에도 타이머가 증가하는 것처럼 보임

**권장 수정**:
```typescript
const elapsed = Math.floor((now - start) / 1000);
const pausedSeconds = timeStats.pausedDuration || 0;
setElapsedSeconds(Math.max(0, elapsed - pausedSeconds));
```

### 2. 순수 학습 시간 계산 문제

**문제**: `isPaused` 대신 `isPausedState`를 사용해야 함

**현재 코드**:
```typescript
{formatTime(timeStats.pureStudyTime + (timeStats.isActive && !isPaused ? elapsedSeconds : 0))}
```

**문제점**:
- Optimistic 상태(`isPausedState`)를 고려하지 않음
- 일시정지 버튼 클릭 후 즉시 반영되지 않을 수 있음

**권장 수정**:
```typescript
{formatTime(timeStats.pureStudyTime + (timeStats.isActive && !isPausedState ? elapsedSeconds : 0))}
```

### 3. 타이머 로그 조회 빈도

**문제**: `isActive`, `isPaused` 변경 시마다 로그 조회

**현재 코드**:
```typescript
useEffect(() => {
  const loadTimerLogs = async () => {
    const result = await getTimerLogsByPlanNumber(planNumber, planDate);
    if (result.success && result.logs) {
      setTimerLogs(result.logs);
    }
  };
  loadTimerLogs();
}, [planNumber, planDate, isActive, isPaused]);
```

**문제점**:
- Optimistic 상태 변경 시마다 불필요한 API 호출
- 성능에 영향을 줄 수 있음

**권장 수정**:
- Debounce 추가 또는 의존성 배열에서 `isActive`, `isPaused` 제거
- 서버 상태가 변경된 후에만 조회 (router.refresh 후)

### 4. 에러 발생 시 Optimistic 상태 롤백

**문제**: 서버 액션 실패 시 optimistic 상태가 롤백되지 않음

**현재 코드**:
```typescript
onPause={() => {
  setOptimisticIsPaused(true);
  onPause();
}}
```

**문제점**:
- 서버 액션이 실패해도 optimistic 상태가 유지됨
- 사용자가 잘못된 상태를 보게 될 수 있음

**권장 수정**:
- 서버 액션 실패 시 optimistic 상태 롤백
- 에러 메시지 표시

### 5. 일시정지 시간 계산 정확성

**문제**: `pausePlan`에서 일시정지 시간 계산 시 현재 일시정지 중인 시간 미포함

**현재 로직**:
- `pausePlan`: 일시정지 시작만 기록, 시간 계산 안 함
- `resumePlan`: 일시정지 기간 계산 및 누적

**영향**:
- 일시정지 중인 시간이 즉시 반영되지 않음
- 재개할 때까지 일시정지 시간이 누적되지 않음

**권장 개선**:
- 일시정지 중에도 주기적으로 일시정지 시간 업데이트 (선택사항)
- 또는 현재 로직 유지 (재개 시 계산하는 것이 더 정확)

## 🔍 추가 확인 사항

### 1. 세션 관리
- ✅ 여러 세션 처리 로직 확인됨
- ✅ 활성 세션 조회 시 최신 세션 우선 사용

### 2. 시간 계산 일관성
- ✅ `PlanItem`: 일시정지 시간 제외 ✅
- ⚠️ `TimeCheckSection`: 일시정지 시간 제외 ❌ (수정 필요)
- ✅ `PlanTimerCard`: 일시정지 시간 제외 ✅

### 3. 상태 동기화
- ✅ Optimistic 상태 관리 구현됨
- ⚠️ 에러 시 롤백 미구현 (개선 필요)

## 📝 권장 수정 사항 우선순위

### 높음 (즉시 수정)
1. **TimeCheckSection의 경과 시간 계산**: 일시정지 시간 제외
2. **순수 학습 시간 계산**: `isPausedState` 사용

### 중간 (개선 권장)
3. **타이머 로그 조회 최적화**: Debounce 또는 의존성 배열 수정
4. **에러 시 Optimistic 상태 롤백**: 사용자 경험 개선

### 낮음 (선택사항)
5. **일시정지 시간 계산 정확성**: 현재 로직도 충분히 정확함

## 🎯 결론

전반적으로 타이머 기능은 잘 구현되어 있으나, 몇 가지 개선이 필요한 부분이 있습니다. 특히 **경과 시간 계산**과 **순수 학습 시간 계산** 부분은 즉시 수정하는 것이 좋습니다.

