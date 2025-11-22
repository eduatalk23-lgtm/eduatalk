# 타이머 기능 로직 점검 보고서

## 날짜
2025-01-14

## 점검 범위
- 타이머 시작/일시정지/재개/완료 로직
- 시간 계산 로직 (일시정지 시간 제외)
- 타입 정의 및 타입 안전성
- 상태 관리 및 동기화

## ✅ 정상 동작하는 기능

### 1. 타이머 제어 로직
- ✅ `startPlan`: 세션 생성 및 플랜 시작 시간 기록
- ✅ `pausePlan`: 세션 일시정지 및 일시정지 횟수 증가
- ✅ `resumePlan`: 세션 재개 및 일시정지 시간 누적 계산
- ✅ `completePlan`: 세션 종료 및 최종 시간 계산

### 2. 시간 계산 로직
- ✅ `calculateStudyTimeFromTimestamps`: 타임스탬프 기반 순수 학습 시간 계산 (일시정지 시간 제외)
- ✅ `calculateStudyTimeFromSession`: 세션 정보 기반 순수 학습 시간 계산 (현재 일시정지 중인 시간 포함)
- ✅ 일시정지 중인 경우 현재 일시정지 시간도 올바르게 계산됨

### 3. 상태 관리
- ✅ Optimistic Update 구현 (버튼 클릭 시 즉시 UI 업데이트)
- ✅ 서버 응답 후 상태 동기화
- ✅ props 변경 시 optimistic 상태 초기화

### 4. 세션 관리
- ✅ 여러 세션 처리 로직 (최신 세션 우선 사용)
- ✅ 다른 플랜의 활성 세션 확인 로직
- ✅ 활성 세션 종료 로직

## 🔧 수정한 문제점

### 1. 타입 정의 누락
**문제**: `TimerControlButtons`와 `TimeCheckSection` 컴포넌트에서 `hasOtherActivePlan` prop이 타입에 정의되지 않았는데 사용되고 있었습니다.

**수정 내용**:
- `TimerControlButtonsProps`에 `hasOtherActivePlan?: boolean` 추가
- `TimeCheckSectionProps`에 `hasOtherActivePlan?: boolean` 추가

**파일**:
- `app/(student)/today/_components/TimerControlButtons.tsx`
- `app/(student)/today/_components/TimeCheckSection.tsx`

## 📊 시간 계산 로직 검증

### 1. 순수 학습 시간 계산
```typescript
// calculateStudyTimeFromTimestamps 함수
const totalSeconds = Math.floor((end - start) / 1000);
const pausedSeconds = pausedDurationSeconds || 0;
return Math.max(0, totalSeconds - pausedSeconds);
```
✅ **검증 결과**: 일시정지 시간이 올바르게 제외되고 있습니다.

### 2. 현재 일시정지 중인 경우
```typescript
// calculateStudyTimeFromSession 함수
if (session.paused_at && !session.resumed_at && !session.ended_at) {
  const pausedAt = new Date(session.paused_at).getTime();
  const now = Date.now();
  pausedSeconds += Math.floor((now - pausedAt) / 1000);
}
```
✅ **검증 결과**: 현재 일시정지 중인 시간도 올바르게 계산되고 있습니다.

### 3. 완료 후 타이머 중지
```typescript
// completePlan 함수
const finalDuration = totalDurationSeconds 
  ? Math.max(0, totalDurationSeconds - totalPausedDuration) 
  : 0;
```
✅ **검증 결과**: 완료 후 타이머가 더 이상 증가하지 않습니다.

## 🎯 컴포넌트별 시간 계산 일관성

### PlanTimerCard
- ✅ `calculateStudyTimeFromTimestamps` 사용
- ✅ 일시정지 시간 제외

### PlanItem
- ✅ `calculateStudyTimeFromTimestamps` 사용
- ✅ 일시정지 시간 제외

### TimeCheckSection
- ✅ `timeStats` 기반 계산
- ✅ 순수 학습 시간 표시

## 🔍 추가 확인 사항

### 1. 일시정지 시간 누적 로직
**현재 로직**:
- 일시정지 시: `paused_at` 기록
- 재개 시: `(resumed_at - paused_at)` 계산하여 `paused_duration_seconds`에 누적
- 플랜 레벨: 모든 세션의 일시정지 시간 합산

✅ **검증 결과**: 올바르게 구현되어 있습니다.

### 2. 완료 시 최종 시간 계산
**현재 로직**:
```typescript
// completePlan 함수
const totalDurationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
const totalPausedDuration = currentPauseDuration + planPausedDuration;
const finalDuration = Math.max(0, totalDurationSeconds - totalPausedDuration);
```

✅ **검증 결과**: 완료 시 최종 순수 학습 시간이 올바르게 계산됩니다.

### 3. 중복 호출 방지
**현재 로직**:
- `handlePause`: `isLoading || isPaused` 체크
- `pausePlan`: 이미 일시정지된 상태 확인

✅ **검증 결과**: 중복 호출이 방지되고 있습니다.

## 📝 권장 사항

### 1. 에러 처리 개선 (선택사항)
현재 Optimistic Update가 실패했을 때 롤백 로직이 없습니다. 향후 개선 시 고려할 수 있습니다.

### 2. 타입 안전성 강화 (완료)
모든 prop 타입을 명시적으로 정의하여 타입 안전성을 강화했습니다.

## 🎯 결론

타이머 기능의 로직은 전반적으로 **올바르게 구현**되어 있습니다:

1. ✅ 시간 계산 로직이 정확함 (일시정지 시간 제외)
2. ✅ 상태 관리가 올바르게 구현됨
3. ✅ 세션 관리 로직이 안정적임
4. ✅ 타입 정의가 완료됨

**추가 수정이 필요한 부분은 없습니다.** 현재 구현된 로직으로 정확한 학습 시간 추적이 가능합니다.

