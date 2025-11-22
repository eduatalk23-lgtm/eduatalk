# 타이머 필드 기반 접근 방식 분석

## 📋 제안된 방식

### 현재 방식 (세션 테이블 기반)
- `student_study_sessions` 테이블로 세션 관리
- 세션별로 일시정지/재개 정보 추적
- 여러 세션을 동시에 관리 가능

### 제안된 방식 (플랜 필드 기반)
```typescript
// student_plan 테이블에 필드 추가
is_timer_active: boolean (default: false)
timer_started_at: timestamptz
timer_paused_at: timestamptz
timer_resumed_at: timestamptz

// 플랜 불러올 때 확인
const activePlan = plans.find(p => p.is_timer_active === true);

// 시작 버튼
UPDATE student_plan 
SET is_timer_active = true, 
    timer_started_at = NOW(),
    actual_start_time = NOW()
WHERE id = planId;

// 완료/초기화 시
UPDATE student_plan 
SET is_timer_active = false
WHERE id = planId;
```

## ⚠️ 발견된 문제점

### 1. 일시정지/재개 처리의 복잡성

**문제**: 일시정지와 재개를 여러 번 할 수 있는데, 필드 기반으로는 추적이 어렵습니다.

**현재 방식 (세션 테이블)**:
```typescript
// 세션 테이블에 누적 저장
paused_duration_seconds: 300  // 총 일시정지 시간
pause_count: 2                 // 일시정지 횟수
paused_at: "2025-01-14T10:30:00Z"  // 현재 일시정지 시간
resumed_at: "2025-01-14T10:35:00Z" // 마지막 재개 시간
```

**제안된 방식의 문제**:
```typescript
// 플랜 테이블에 단일 필드만 저장
timer_paused_at: "2025-01-14T10:30:00Z"  // 마지막 일시정지만 저장
timer_resumed_at: "2025-01-14T10:35:00Z" // 마지막 재개만 저장

// 문제: 이전 일시정지 기록이 사라짐!
// 예: 10:00-10:05 일시정지, 10:30-10:35 일시정지
//     → 10:00-10:05 기록이 사라짐
```

**해결 방법**:
- 별도 `plan_timer_pauses` 테이블 필요 (결국 추가 테이블)
- 또는 JSON 배열로 저장 (비정규화, 쿼리 어려움)

**결론**: ❌ **일시정지/재개 추적이 복잡해집니다**

---

### 2. 세션별 상세 정보 손실

**현재 방식의 장점**:
```typescript
// 각 세션마다 독립적인 정보 저장
{
  id: "session-1",
  started_at: "2025-01-14T09:00:00Z",
  ended_at: "2025-01-14T10:00:00Z",
  paused_duration_seconds: 300,
  note: "집중도 높았음"
}

// 여러 세션을 추적 가능
// 예: 오전 세션, 오후 세션을 별도로 기록
```

**제안된 방식의 문제**:
```typescript
// 플랜 레벨에서만 관리
// 문제: 여러 번 시작/중지한 경우 이전 세션 정보 손실
// 예: 
//   09:00 시작 → 10:00 중지 (세션 1)
//   14:00 시작 → 15:00 중지 (세션 2)
//   → 세션 1 정보가 사라짐
```

**결론**: ❌ **세션별 상세 정보를 추적할 수 없습니다**

---

### 3. 동시성 문제 (Race Condition)

**문제**: 여러 요청이 동시에 들어올 때 데이터 불일치 발생 가능

**시나리오**:
```
사용자 A: 플랜 1 시작 버튼 클릭 (10:00:00.100)
사용자 B: 플랜 2 시작 버튼 클릭 (10:00:00.150) - 거의 동시

현재 방식 (세션 테이블):
1. A: 다른 활성 세션 확인 → 없음 → 세션 생성
2. B: 다른 활성 세션 확인 → A의 세션 발견 → 에러 반환 ✅

제안된 방식 (플랜 필드):
1. A: is_timer_active 확인 → false → true로 변경
2. B: is_timer_active 확인 → false (A의 변경 전) → true로 변경
   → 두 플랜이 모두 활성화됨! ❌
```

**해결 방법**:
- 트랜잭션 + SELECT FOR UPDATE 필요
- 또는 데이터베이스 제약조건 추가 (UNIQUE 제약 등)

**결론**: ❌ **동시성 문제가 발생할 수 있습니다**

---

### 4. 데이터 정합성 문제

**문제**: 활성 필드와 실제 세션 상태가 불일치할 수 있음

**시나리오**:
```
1. 플랜 시작 → is_timer_active = true
2. 서버 오류로 세션 생성 실패
3. 하지만 is_timer_active는 true로 남음
4. 다음 시작 시도 → 이미 활성화되어 있다고 에러
5. 하지만 실제로는 세션이 없음 ❌
```

**현재 방식**:
```typescript
// 세션 테이블을 기준으로 확인
const activeSessions = await getActiveSessions();
// → 실제 세션이 있는지 확인 가능 ✅
```

**제안된 방식**:
```typescript
// 플랜 필드만 확인
const activePlan = await getPlanWithActiveTimer();
// → 필드가 true인데 실제 세션이 없을 수 있음 ❌
```

**결론**: ❌ **데이터 정합성 문제가 발생할 수 있습니다**

---

### 5. 복구 및 오류 처리 문제

**문제**: 네트워크 오류나 브라우저 종료 시 상태 복구가 어려움

**현재 방식**:
```typescript
// 세션 테이블에서 실제 상태 확인
const activeSession = await getActiveSession(planId);
if (activeSession) {
  // 실제 세션이 있으면 복구 가능
  // paused_at이 있으면 일시정지 상태
  // resumed_at이 없으면 아직 일시정지 중
}
```

**제안된 방식**:
```typescript
// 플랜 필드만 확인
if (plan.is_timer_active) {
  // 하지만 실제로 언제 시작했는지?
  // 일시정지 중인지 재개 중인지?
  // → timer_paused_at과 timer_resumed_at을 비교해야 함
  // → 복잡하고 오류 가능성 높음
}
```

**결론**: ❌ **복구 로직이 복잡해집니다**

---

### 6. 성능 측면 분석

**제안된 방식의 장점**:
- ✅ 플랜 조회 시 JOIN 불필요 (플랜 테이블만 조회)
- ✅ 활성 플랜 확인이 간단함 (`WHERE is_timer_active = true`)

**현재 방식의 성능**:
```typescript
// 플랜 조회 + 세션 조회 (JOIN 또는 별도 쿼리)
const plans = await getPlans();
const sessions = await getActiveSessions();
// → 2번의 쿼리 또는 JOIN 필요
```

**하지만 실제 성능 차이**:
- 플랜 조회: 이미 인덱스가 있어서 빠름
- 세션 조회: `ended_at IS NULL` 인덱스로 빠름
- JOIN: 인덱스가 있으면 성능 차이 미미

**실제 측정 필요**:
- 현재 방식도 충분히 빠름 (인덱스 활용)
- 제안된 방식이 크게 빠르지 않을 수 있음

**결론**: ⚠️ **성능 향상이 크지 않을 수 있습니다**

---

### 7. 확장성 문제

**현재 방식의 장점**:
- 세션별로 독립적인 메타데이터 저장 가능
  - 집중도 (focus_level)
  - 메모 (note)
  - 세션별 통계
- 향후 기능 확장 용이

**제안된 방식의 문제**:
- 플랜 레벨에서만 관리
- 세션별 메타데이터 저장 어려움
- 확장성 제한

**결론**: ❌ **확장성이 떨어집니다**

---

## 📊 비교표

| 항목 | 현재 방식 (세션 테이블) | 제안된 방식 (플랜 필드) |
|------|------------------------|------------------------|
| 일시정지/재개 추적 | ✅ 쉬움 (세션 테이블) | ❌ 복잡 (별도 테이블 필요) |
| 세션별 정보 | ✅ 가능 | ❌ 불가능 |
| 동시성 처리 | ✅ 안전 (세션 확인) | ❌ 위험 (Race Condition) |
| 데이터 정합성 | ✅ 높음 | ❌ 낮음 (불일치 가능) |
| 복구 로직 | ✅ 간단 | ❌ 복잡 |
| 성능 | ✅ 충분히 빠름 | ⚠️ 약간 빠를 수 있음 |
| 확장성 | ✅ 높음 | ❌ 낮음 |

## 🎯 결론 및 권장사항

### 제안된 방식의 문제점 요약

1. ❌ **일시정지/재개 추적이 복잡함** - 여러 번 일시정지한 경우 추적 어려움
2. ❌ **세션별 상세 정보 손실** - 여러 세션을 추적할 수 없음
3. ❌ **동시성 문제** - Race Condition 발생 가능
4. ❌ **데이터 정합성 문제** - 필드와 실제 상태 불일치 가능
5. ❌ **복구 로직 복잡** - 오류 시 상태 복구 어려움
6. ⚠️ **성능 향상 미미** - 현재 방식도 충분히 빠름
7. ❌ **확장성 제한** - 향후 기능 추가 어려움

### 권장사항

**현재 방식을 유지하는 것을 권장합니다.**

**이유**:
1. ✅ **데이터 정합성**: 세션 테이블이 실제 상태를 정확히 반영
2. ✅ **안정성**: 동시성 문제와 데이터 불일치 문제 없음
3. ✅ **확장성**: 향후 기능 추가 용이
4. ✅ **성능**: 현재도 충분히 빠름 (인덱스 활용)

### 성능 최적화 대안

제안된 방식 대신, 현재 방식을 최적화하는 것이 더 안전합니다:

```typescript
// 1. 인덱스 최적화 (이미 있음)
CREATE INDEX idx_study_sessions_active 
ON student_study_sessions(student_id, ended_at) 
WHERE ended_at IS NULL;

// 2. 조회 최적화
// 플랜과 세션을 한 번에 조회 (JOIN)
SELECT p.*, s.id as session_id, s.is_paused
FROM student_plan p
LEFT JOIN student_study_sessions s 
  ON p.id = s.plan_id AND s.ended_at IS NULL
WHERE p.student_id = ? AND p.plan_date = ?;

// 3. 캐싱 활용
// React Query 등으로 클라이언트 캐싱
```

**결론**: 제안된 방식은 **성능 향상이 크지 않으면서도 여러 문제점**이 있어서 **권장하지 않습니다**.

