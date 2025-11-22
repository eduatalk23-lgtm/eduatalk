# 일시정지/재개 반복 시 오류 수정

## 📋 문제 상황

일시정지/재개를 여러 번 반복하다보면 타이머가 고장나는 문제가 발생했습니다.

## 🔍 원인 분석

### 문제점

**시나리오**:
1. 플랜 시작 → 세션 생성 (`paused_at = null`, `resumed_at = null`)
2. 첫 번째 일시정지 → `paused_at = T1`, `resumed_at = null`
3. 재개 → `paused_at = T1`, `resumed_at = T2`, `paused_duration_seconds += (T2 - T1)`
4. 두 번째 일시정지 → `paused_at = T3`, `resumed_at = T2` (그대로 남음) ❌
5. 두 번째 재개 시도 → "일시정지된 상태가 아닙니다" 오류 발생

**문제**:
- 재개 후 다시 일시정지할 때 `resumed_at`이 그대로 남아있어서
- 다음 재개 시도 시 `resumed_at`이 있으면 "일시정지된 상태가 아님"으로 판단됨
- `resumePlan` 함수의 검증 로직: `if (!activeSession.paused_at || activeSession.resumed_at)`

## ✅ 해결 방법

### 수정 내용

**파일**: `app/(student)/today/actions/todayActions.ts`

**변경 사항**:
- 일시정지할 때 `resumed_at`을 `null`로 리셋
- 이렇게 하면 재개 후 다시 일시정지해도 정상 작동

```typescript
// 수정 전
const { error: pauseError } = await supabase
  .from("student_study_sessions")
  .update({
    paused_at: pauseTimestamp,
  })
  .eq("id", activeSession.id)
  .eq("student_id", user.userId);

// 수정 후
const { error: pauseError } = await supabase
  .from("student_study_sessions")
  .update({
    paused_at: pauseTimestamp,
    resumed_at: null, // 재개 후 다시 일시정지할 때 리셋
  })
  .eq("id", activeSession.id)
  .eq("student_id", user.userId);
```

## 🎯 수정 효과

### 수정 전
- 재개 후 다시 일시정지 시 `resumed_at`이 그대로 남음
- 다음 재개 시도 시 "일시정지된 상태가 아닙니다" 오류 발생
- 여러 번 반복하면 상태가 꼬여서 타이머가 고장남

### 수정 후
- 재개 후 다시 일시정지 시 `resumed_at`이 `null`로 리셋됨
- 여러 번 일시정지/재개해도 정상 작동
- 각 일시정지 시간이 `paused_duration_seconds`에 정확히 누적됨

## 📌 세션 상태 흐름

### 정상적인 상태 전환

1. **시작**: `paused_at = null`, `resumed_at = null`
2. **일시정지**: `paused_at = T1`, `resumed_at = null`
3. **재개**: `paused_at = T1`, `resumed_at = T2`, `paused_duration_seconds += (T2 - T1)`
4. **다시 일시정지**: `paused_at = T3`, `resumed_at = null` ✅ (리셋됨)
5. **다시 재개**: `paused_at = T3`, `resumed_at = T4`, `paused_duration_seconds += (T4 - T3)`

### 상태 검증 로직

**일시정지 가능 조건**:
- `paused_at IS NULL` 또는 `resumed_at IS NOT NULL` (재개된 상태)

**재개 가능 조건**:
- `paused_at IS NOT NULL` AND `resumed_at IS NULL` (일시정지된 상태)

## ✅ 테스트 시나리오

1. ✅ 플랜 시작 → 성공
2. ✅ 일시정지 → 성공 (`paused_at` 설정, `resumed_at = null`)
3. ✅ 재개 → 성공 (`resumed_at` 설정, `paused_duration_seconds` 누적)
4. ✅ 다시 일시정지 → 성공 (`paused_at` 새로 설정, `resumed_at = null`로 리셋)
5. ✅ 다시 재개 → 성공 (`resumed_at` 설정, `paused_duration_seconds` 추가 누적)
6. ✅ 여러 번 반복 → 정상 작동

## 📝 참고사항

- `paused_duration_seconds`는 각 일시정지 구간의 시간을 누적하여 저장
- 재개할 때마다 해당 일시정지 구간의 시간을 계산하여 누적
- 일시정지할 때 `resumed_at`을 리셋하는 것이 핵심

