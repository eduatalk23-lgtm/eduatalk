# 타이머 상태 전이 문서

## 작성일: 2025-12-09

---

## 📋 개요

이 문서는 학습 플랜 타이머의 상태 전이 규칙과 관련 필드를 정의합니다.

---

## 🔄 상태 전이 다이어그램

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
┌──────┐      ┌─────────┐      ┌────────┐      ┌──────────┴──┐
│ IDLE │──────│ RUNNING │──────│ PAUSED │──────│  COMPLETED  │
└──────┘      └─────────┘      └────────┘      └─────────────┘
   │              │  ▲              │                  ▲
   │              │  │              │                  │
   │              │  └──────────────┘                  │
   │              │      resumePlan                    │
   │              │                                    │
   │              └────────────────────────────────────┘
   │                        completePlan
   │
   └──────── 초기 상태 (actual_start_time = NULL)
```

---

## 📊 상태 정의

| 상태 | 조건 | 설명 |
|------|------|------|
| **IDLE** | `actual_start_time = NULL` | 아직 시작하지 않은 플랜 |
| **RUNNING** | `actual_start_time ≠ NULL` AND `actual_end_time = NULL` AND 활성 세션 존재 | 현재 학습 중 |
| **PAUSED** | `actual_start_time ≠ NULL` AND `actual_end_time = NULL` AND 일시정지 세션 | 일시정지 상태 |
| **COMPLETED** | `actual_end_time ≠ NULL` | 완료된 플랜 |

---

## 🎯 상태 전이 액션

### startPlan (IDLE → RUNNING)

```typescript
// 입력 조건
- actual_start_time = NULL
- 현재 RUNNING 상태인 다른 플랜 없음 (경합 방지)

// 출력
- actual_start_time = now()
- student_study_sessions 레코드 생성 (started_at = now())
```

### pausePlan (RUNNING → PAUSED)

```typescript
// 입력 조건
- actual_start_time ≠ NULL
- actual_end_time = NULL
- 활성 세션 존재

// 출력
- student_study_sessions.paused_at = now()
- paused_duration_seconds 갱신
```

### resumePlan (PAUSED → RUNNING)

```typescript
// 입력 조건
- actual_start_time ≠ NULL
- actual_end_time = NULL
- 일시정지된 세션 존재

// 출력
- student_study_sessions.resumed_at = now()
- pause_count 증가
```

### completePlan (RUNNING/PAUSED → COMPLETED)

```typescript
// 입력 조건
- actual_start_time ≠ NULL
- actual_end_time = NULL

// 출력
- actual_end_time = now()
- student_study_sessions.ended_at = now()
- total_duration_seconds 계산
- progress = 100 (또는 사용자 입력)
- completed_amount = planned_end_page_or_time
```

---

## ⚠️ 경합 방지 규칙

### 1. 동시 실행 금지

한 학생이 동시에 여러 플랜을 RUNNING 상태로 둘 수 없습니다.

```typescript
// startPlan 전에 확인
const runningPlans = await getPlansForStudent({
  studentId,
  filters: { hasActiveSession: true }
});

if (runningPlans.length > 0) {
  throw new Error("이미 진행 중인 플랜이 있습니다.");
}
```

### 2. 완료된 플랜 재시작 금지

`actual_end_time`이 설정된 플랜은 다시 시작할 수 없습니다.

```typescript
if (plan.actual_end_time) {
  throw new Error("이미 완료된 플랜입니다.");
}
```

### 3. 세션 무결성

`student_study_sessions` 레코드는 항상 일관된 상태를 유지해야 합니다.

```sql
-- 유효한 세션 상태
ended_at IS NULL AND paused_at IS NULL  -- RUNNING
ended_at IS NULL AND paused_at IS NOT NULL  -- PAUSED
ended_at IS NOT NULL  -- ENDED
```

---

## 📐 관련 필드

### student_plan 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `actual_start_time` | timestamptz | 실제 시작 시간 |
| `actual_end_time` | timestamptz | 실제 종료 시간 |
| `total_duration_seconds` | integer | 총 학습 시간 (초) |
| `paused_duration_seconds` | integer | 일시정지 누적 시간 (초) |
| `pause_count` | integer | 일시정지 횟수 |

### student_study_sessions 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| `started_at` | timestamptz | 세션 시작 시간 |
| `paused_at` | timestamptz | 일시정지 시간 |
| `resumed_at` | timestamptz | 재개 시간 |
| `ended_at` | timestamptz | 세션 종료 시간 |
| `paused_duration_seconds` | integer | 세션 내 일시정지 시간 |

---

## 🔗 관련 파일

| 파일 | 용도 |
|------|------|
| `app/(student)/today/actions/todayActions.ts` | 타이머 액션 |
| `lib/data/studentSessions.ts` | 세션 데이터 레이어 |
| `lib/metrics/studyTime.ts` | 학습 시간 계산 |

---

## 📝 변경 기록

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-12-09 | v1.0 | 초안 작성 |

