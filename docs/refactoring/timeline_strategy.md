# 타임라인 전략 문서

## 작성일: 2025-12-09

---

## 📋 개요

이 문서는 학습 플랜의 시간 배치(타임라인) 전략과 `start_time`/`end_time` 필드의 NULL 정책을 정의합니다.

---

## 🕐 시간 배치 모드

### 1. Block 모드 (기본)

플랜을 시간대 블록 단위로 배치합니다.

| 필드 | 설명 | 예시 |
|------|------|------|
| `block_index` | 블록 순서 (0부터 시작) | 0, 1, 2, ... |
| `start_time` | NULL 허용 | NULL |
| `end_time` | NULL 허용 | NULL |

**사용 상황:**
- 단순한 플랜 관리
- 시간대 지정 없이 순서만 중요한 경우

### 2. Time 모드 (1730 Timetable)

플랜을 구체적인 시간대에 배치합니다.

| 필드 | 설명 | 예시 |
|------|------|------|
| `block_index` | 블록 순서 | 0, 1, 2, ... |
| `start_time` | HH:mm 형식 | "09:00" |
| `end_time` | HH:mm 형식 | "10:30" |

**사용 상황:**
- 1730 Timetable 스케줄러
- 정확한 시간 관리가 필요한 경우

---

## 🔄 start_time/end_time NULL 정책

### NULL 허용 상황

```typescript
// Block 모드: 시간 배치 없이 순서만 관리
{
  block_index: 0,
  start_time: null,
  end_time: null
}
```

### NULL 방어 처리

```typescript
// UI 컴포넌트에서 방어
const displayTime = plan.start_time 
  ? `${plan.start_time} - ${plan.end_time}`
  : `#${plan.block_index + 1}`;

// 시간 계산에서 방어
const durationMinutes = plan.start_time && plan.end_time
  ? timeToMinutes(plan.end_time) - timeToMinutes(plan.start_time)
  : plan.planned_duration_minutes ?? 60;
```

### 스키마 정의

```sql
-- student_plan 테이블
start_time time NULL,  -- HH:mm 형식, Block 모드에서는 NULL
end_time time NULL,    -- HH:mm 형식, Block 모드에서는 NULL
```

---

## 📐 시간 배치 로직

### 핵심 함수

| 함수 | 위치 | 용도 |
|------|------|------|
| `calculateAvailableDates` | `lib/scheduler/calculateAvailableDates.ts` | 가용 날짜/시간 계산 |
| `assignPlanTimes` | `lib/plan/assignPlanTimes.ts` | 플랜에 시간 배정 |
| `generateTimeSlots` | `lib/scheduler/calculateAvailableDates.ts` | 시간 슬롯 생성 |

### 시간 배치 플로우

```
1. calculateAvailableDates()
   ├── 기간 내 날짜 생성
   ├── 제외일/학원 일정 적용
   └── daily_schedule 생성 (time_slots 포함)

2. assignPlanTimes()
   ├── 콘텐츠별 예상 소요시간 계산
   ├── time_slots에 플랜 배치
   └── start_time/end_time 설정
```

---

## ⚠️ 주의사항

### 1. 모드 혼용 금지

하나의 플랜 그룹 내에서 Block 모드와 Time 모드를 혼용하지 않습니다.

### 2. NULL 체크 필수

```typescript
// ❌ 위험한 코드
const duration = timeToMinutes(plan.end_time) - timeToMinutes(plan.start_time);

// ✅ 안전한 코드
if (plan.start_time && plan.end_time) {
  const duration = timeToMinutes(plan.end_time) - timeToMinutes(plan.start_time);
} else {
  const duration = plan.planned_duration_minutes ?? 60;
}
```

### 3. daily_schedule 의존성

`start_time`/`end_time`은 `plan_groups.daily_schedule`의 `time_slots`를 기반으로 계산됩니다.

```typescript
type DailyScheduleInfo = {
  date: string;
  day_type: string;
  study_hours: number;
  time_slots?: Array<{
    type: string;
    start: string;  // HH:mm
    end: string;    // HH:mm
    label?: string;
  }>;
};
```

---

## 🔗 관련 파일

| 파일 | 용도 |
|------|------|
| `lib/scheduler/calculateAvailableDates.ts` | 가용 날짜/시간 계산 |
| `lib/plan/assignPlanTimes.ts` | 플랜 시간 배정 |
| `lib/plan/scheduler.ts` | 플랜 생성 오케스트레이션 |
| `lib/types/plan.ts` | 타입 정의 |

---

## 📝 변경 기록

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-12-09 | v1.0 | 초안 작성 |

