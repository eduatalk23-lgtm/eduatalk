# 같은 플랜 일시정지 후 재시작 오류 수정

## 📋 문제 상황

같은 플랜에서 시작 → 일시정지 → 재시작 → 일시정지를 시도할 때 "다른 플랜 활성 중입니다" 오류가 발생했습니다.

## 🔍 원인 분석

### 문제점

1. **일시정지된 세션도 활성 세션으로 간주**: `startPlan` 함수에서 다른 플랜의 활성 세션을 확인할 때, 일시정지된 세션도 `ended_at IS NULL`이므로 활성 세션으로 간주됨
2. **일시정지 상태 구분 부재**: 일시정지된 세션은 `paused_at`이 있고 `resumed_at`이 없는 상태인데, 이를 구분하지 않음

### 시나리오

1. 플랜 A 시작 → 세션 생성 (ended_at = null, paused_at = null)
2. 플랜 A 일시정지 → paused_at 설정 (ended_at = null, paused_at = timestamp, resumed_at = null)
3. 플랜 A 재시작 시도 → `startPlan`에서 다른 플랜의 활성 세션 확인
4. 일시정지된 세션이 "활성 세션"으로 감지되어 오류 발생

## ✅ 해결 방법

### 1. startPlan 함수 수정

**파일**: `app/(student)/today/actions/todayActions.ts`

**변경 사항**:
- 일시정지된 세션을 제외하도록 필터링 로직 추가
- 일시정지된 세션은 `paused_at IS NOT NULL AND resumed_at IS NULL` 조건으로 식별

```typescript
// 다른 플랜이 활성화되어 있는지 확인 (현재 플랜 제외, 일시정지된 세션 제외)
// 일시정지된 세션은 paused_at이 있고 resumed_at이 없는 상태
const { data: activeSessions, error: sessionError } = await supabase
  .from("student_study_sessions")
  .select("plan_id, paused_at, resumed_at")
  .eq("student_id", user.userId)
  .is("ended_at", null)
  .neq("plan_id", planId);

// 일시정지되지 않은 실제 활성 세션만 필터링
const trulyActiveSessions = activeSessions?.filter(
  (session) => !session.paused_at || session.resumed_at
) || [];

// 다른 플랜이 활성화되어 있으면 에러 반환
if (trulyActiveSessions.length > 0) {
  return { 
    success: false, 
    error: "다른 플랜의 타이머가 실행 중입니다. 먼저 해당 플랜의 타이머를 중지해주세요." 
  };
}
```

### 2. startStudySession 함수 수정

**파일**: `app/(student)/actions/studySessionActions.ts`

**변경 사항**:
- 같은 플랜의 일시정지된 세션은 허용하도록 수정
- 일시정지되지 않은 실제 활성 세션만 차단

```typescript
// 특정 플랜의 활성 세션이 있는지 확인 (일시정지된 세션 제외)
const { data: existingSession } = await supabase
  .from("student_study_sessions")
  .select("id, paused_at, resumed_at")
  .eq("plan_id", planId)
  .eq("student_id", user.userId)
  .is("ended_at", null)
  .maybeSingle();

// 일시정지되지 않은 실제 활성 세션이 있으면 에러 반환
// 일시정지된 세션(paused_at이 있고 resumed_at이 없는 경우)은 허용
if (existingSession && (!existingSession.paused_at || existingSession.resumed_at)) {
  return { success: false, error: "이미 해당 플랜의 타이머가 실행 중입니다." };
}
```

## 🎯 수정 효과

### 수정 전
- 같은 플랜에서 일시정지 후 재시작 시도 시 "다른 플랜 활성 중" 오류 발생
- 일시정지된 세션도 활성 세션으로 간주되어 차단됨

### 수정 후
- 같은 플랜에서 일시정지 후 재시작 가능
- 일시정지된 세션은 활성 세션으로 간주하지 않음
- 다른 플랜의 실제 활성 세션만 차단

## 📌 세션 상태 구분

### 활성 세션 (실제 실행 중)
- `ended_at IS NULL`
- `paused_at IS NULL` 또는 `resumed_at IS NOT NULL`

### 일시정지된 세션
- `ended_at IS NULL`
- `paused_at IS NOT NULL`
- `resumed_at IS NULL`

### 종료된 세션
- `ended_at IS NOT NULL`

## ✅ 테스트 시나리오

1. ✅ 플랜 A 시작 → 성공
2. ✅ 플랜 A 일시정지 → 성공
3. ✅ 플랜 A 재시작 → 성공 (수정 전에는 실패했음)
4. ✅ 플랜 A 일시정지 → 성공
5. ✅ 다른 플랜 B 시작 시도 → 차단 (플랜 A가 활성 상태인 경우)

