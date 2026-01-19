# 스케줄러 알고리즘과 다중 콘텐츠 처리 분석 리포트

## 1. 스케줄러가 여러 콘텐츠를 함께 처리하는 이유

### 핵심 원리
**plan_group 수준에서 전체 시간 재원(resource) 최적 배분**

```
PlanGroup (기간 전체)
├─ 시간 블록 (요일별)
├─ 학원 일정 (제약)
├─ 제외일 (학습 불가능 일자)
└─ 다중 콘텐츠 (pages/episodes)
    ├─ Content 1: 수학, 100~150 pages
    ├─ Content 2: 국어, 200~300 pages
    └─ Content 3: 영어, 50~100 pages
```

### 이유 1: 블록(시간 슬롯) 효율성
- **각 날짜별 블록은 고정된 자원**: 예) 14:00~17:00 (180분)
- **동일 블록에 여러 콘텐츠 배정 가능**
  ```
  2024-01-15 (월) 블록 (14:00~17:00)
  ├─ 수학 30분 (page 110~120)
  ├─ 국어 90분 (page 200~220)  
  └─ 영어 60분 (episode 5~7)
  ```
- 단일 콘텐츠로 분리하면 블록이 낭비되거나 플랜이 지나치게 잘게 쪼개짐

### 이유 2: 전략과목/취약과목 균형
```typescript
// lib/plan/scheduler.ts: 171-206
const contentAllocations = schedulerOptions?.content_allocations // 콘텐츠별 배정
const subjectAllocations = schedulerOptions?.subject_allocations // 과목별 배정

// 전략과목 (3시간/주): 특정 날짜에만 배정 가능
// 취약과목 (전체): 모든 날짜에 배정
// → 여러 콘텐츠의 날짜 배정을 동시에 조정해야 함
```

### 이유 3: 학습 범위 분할 최적화
```typescript
// lib/plan/1730TimetableLogic.ts: 192-223
function divideContentRange(
  totalRange: number,
  allocatedDates: string[],  // 이 콘텐츠가 배정된 날짜
  contentId: string
)
```
- 콘텐츠별로 배정된 날짜가 **다름**
  - 수학(취약과목): 6일/주 전체
  - 과학(전략과목): 3일/주만 배정
  - 영어(전략과목): 2일/주만 배정
- **각 콘텐츠마다 범위를 다르게 분할** 필요
- → 동시에 처리해야 효율적

---

## 2. 시간 슬롯 배정 시 콘텐츠 간 의존성

### 의존성 유형 1: 동일 날짜/블록 공유
```typescript
// lib/scheduler/SchedulerEngine.ts: 전체 로직

// 같은 2024-01-15(월)에
// - Content A: 수학 30분
// - Content B: 국어 60분
// - Content C: 영어 45분
// 총 135분이 같은 블록(180분)에 배정

// → 순차적으로 처리되므로 콘텐츠 간 순서(우선순위)가 중요
```

### 의존성 유형 2: 주기(1730 Timetable)상의 연쇄 배정
```typescript
// lib/plan/scheduler.ts: 420-440
// 1730 Timetable: 6학습일 + 1복습일

주차 1: Mon~Sat(학습) + Sun(복습)
├─ 학습일 (Mon~Sat): 
│  ├─ 수학 범위 학습
│  ├─ 국어 범위 학습
│  └─ 영어 범위 학습
└─ 복습일 (Sun): 
   ├─ 수학 전주 범위 복습
   ├─ 국어 전주 범위 복습
   └─ 영어 전주 범위 복습

// 복습일에 "같은 주차의 모든 콘텐츠"를 함께 복습
// → 콘텐츠 간 강한 의존성
```

### 의존성 유형 3: 학습 범위 연쇄
```
Content A: 100~200 pages
Content B: 300~400 pages  
Content C: 50~100 pages

같은 plan_group 기간에서:
- 모두 같은 기간에 "동시에" 진행 중
- 각각 다른 속도(daily_amount)로 분할되지만
- 같은 날짜 블록에 함께 배치됨
```

### 코드 증거
```typescript
// lib/scheduler/SchedulerEngine.ts
public generate(): ScheduledPlan[] {
  // 1. 모든 콘텐츠의 일/복습 주기 계산 (공통)
  const cycleDays = this.calculateCycle();
  
  // 2. 각 콘텐츠별 배정 날짜 계산 (전략/취약 기반, 함께 고려)
  const contentAllocationMap = this.calculateContentAllocation();
  
  // 3. 각 콘텐츠의 범위를 배정 날짜에 분할 (동시에)
  const contentRangeMap = this.calculateContentRange();
  
  // 4. "날짜별"로 모든 콘텐츠 배치 (같은 블록에 여러 콘텐츠)
  for (const date of this.getDates()) {
    // 이 날짜에 배치될 모든 콘텐츠를 한번에 처리
    const contentForDate = this.getContentsForDate(date);
    this.assignTimeSlotsForDate(date, contentForDate);
  }
}
```

---

## 3. 전략과목/취약과목 배정 로직

### 구조 (scheduler_options)
```typescript
// lib/types/plan/domain.ts (scheduler_options JSONB)
{
  "study_days": 6,
  "review_days": 1,
  
  // 과목별 배정
  "subject_allocations": [
    {
      "subject_name": "수학",
      "subject_type": "weakness",      // 취약과목 → 전체 날짜
      "weekly_days": null
    },
    {
      "subject_name": "과학", 
      "subject_type": "strategy",      // 전략과목 → 선택된 날짜만
      "weekly_days": 3                 // 주당 3일만
    }
  ],
  
  // 콘텐츠별 배정 (더 세밀한 제어)
  "content_allocations": [
    {
      "content_id": "book-123",
      "content_type": "book",
      "subject_type": "weakness",
      "weekly_days": null
    },
    {
      "content_id": "lecture-456",
      "content_type": "lecture",
      "subject_type": "strategy",
      "weekly_days": 2
    }
  ]
}
```

### 배정 알고리즘
```typescript
// lib/plan/1730TimetableLogic.ts: 143-187
function calculateSubjectAllocationDates(
  cycleDays: CycleDayInfo[],
  allocation: SubjectAllocation
): string[] {
  if (allocation.subject_type === "weakness") {
    // 취약과목: 모든 학습일
    // 주차별 6일 × N주 = 6N일
    return cycleDays
      .filter(d => d.day_type === "study")
      .map(d => d.date);
  } else {
    // 전략과목: 주당 X일만 (균등 분배)
    const weeklyDays = allocation.weekly_days || 3;
    for each week {
      select `weeklyDays` dates evenly from 6 study dates
    }
  }
}
```

### 콘텐츠별 범위 분할
```typescript
// lib/plan/1730TimetableLogic.ts: 192-223
function divideContentRange(
  totalRange: number,
  allocatedDates: string[]  // 이 콘텐츠의 배정 날짜
): Map<string, {start, end}>

예:
수학 (취약과목, 100~200 pages):
  allocatedDates = [월, 화, 수, 목, 금, 토] × 4주 = 24일
  dailyAmount = 100 / 24 = 4.17 pages/day
  → 각 날짜에 ~4 pages

과학 (전략과목, 50~100 pages):
  allocatedDates = [월, 수, 금] × 4주 = 12일
  dailyAmount = 50 / 12 = 4.17 pages/day
  → 각 날짜에 ~4 pages
```

### 왜 여러 콘텐츠를 함께 고려?
```
❌ 단일 콘텐츠만 처리하면:
- 수학만: 월~일 배정
- 과학만: 월, 수, 금 배정
- → 과학 배정을 어떻게 정할지 불명확
  (다른 콘텐츠의 일정이 영향을 줘야 하는지?)

✅ 여러 콘텐츠 함께:
- 전체 학습 부하 균형
- 각 콘텐츠의 중요도(strategy/weakness) 반영
- 같은 블록의 시간 효율성 최대화
```

---

## 4. 복습일 처리 로직

### review_info 구조
```typescript
// 각 ScheduledPlan에 포함:
{
  plan_date: "2024-01-21",      // 복습일
  date_type: "review",           // 학습일/복습일/제외일
  cycle_day_number: 7,           // 주기 내 7번째 = 복습일
  content_id: "book-123",
  planned_start_page_or_time: 100,  // 복습할 범위
  planned_end_page_or_time: 200,    // (지난주 학습 범위)
  is_reschedulable: true,
  start_time: "14:00",
  end_time: "15:20"  // 복습이므로 더 짧음
}
```

### 여러 콘텐츠의 복습 조합
```typescript
// lib/plan/scheduler.ts: 548-597
// 1730_timetable이면 각 주차의 복습일에:

복습일 (2024-01-21, 일요일):
├─ 수학: 지난주(1/15~1/20) 학습 범위 복습
│  ├─ planned_start_page_or_time: 100 (Mon의 시작)
│  └─ planned_end_page_or_time: 125 (Sat의 끝)
├─ 과학: 지난주 배정 날짜들 범위 복습  
│  ├─ planned_start_page_or_time: 50
│  └─ planned_end_page_or_time: 60
└─ 영어: 지난주 배정 날짜들 범위 복습
   ├─ planned_start_page_or_time: 100
   └─ planned_end_page_or_time: 120

// 복습 시간 계산:
// - 기본 소요시간 × 0.4 (복습 계수)
// - 여러 콘텐츠이므로 총 시간이 블록을 초과하지 않도록 조정
```

### 복습의 복습 (additional_review)
```typescript
// lib/plan/scheduler.ts: 354-601
// 추가 기간에서 "복습의 복습" 생성

{
  type: "additional_review",
  original_period_start: "2024-01-01",
  original_period_end: "2024-01-28",
  period_start: "2024-01-29",    // 추가 기간
  period_end: "2024-02-28",
  subjects?: ["수학", "과학"],    // 특정 과목만 (여러 개 가능)
  review_of_review_factor: 0.25   // 0.25배로 더 줄임
}

추가 기간에서:
- 1730 Timetable 패턴 다시 생성
- 하지만 시간은 0.25배 (복습의 복습이므로 매우 짧음)
- 여러 콘텐츠가 함께 처리됨
```

---

## 5. plan_group을 단일 콘텐츠로 분리할 경우 영향

### 현재 아키텍처
```
PlanGroup (기간 전체)
  └─ generatePlansFromGroup(
       group,
       [Content1, Content2, Content3],  // 여러 콘텐츠
       options: {
         subject_allocations: [...],
         content_allocations: [...]
       }
     )
     → SchedulerInput {
         contentInfos: [...],           // 모두 함께 처리
         ...
       }
```

### 분리 시 문제점

#### 1. 시간 슬롯 낭비
```
분리 전 (현재):
- 수학 30분 + 국어 90분 + 영어 60분 = 180분 (블록 정확히 fill)
- 효율성: 100%

분리 후 (각각 호출):
- 수학: 블록 180분 중 30분 사용 → 150분 낭비 OR 시간 불정확
- 국어: 블록 180분 중 90분 사용 → 90분 낭비 OR 시간 불정확
- 영어: 블록 180분 중 60분 사용 → 120분 낭비 OR 시간 불정확
```

#### 2. 전략과목 배정 로직 복잡성
```
현재:
scheduler_options의 subject_allocations에서:
  {subject: "과학", type: "strategy", weekly_days: 3}
→ 전체 plan_group 기간에 균등하게 3일/주 배정

분리 후:
- 과학 콘텐츠1, 콘텐츠2, 콘텐츠3이 따로 호출되면?
- 각각 독립적으로 3일/주 배정?
- 아니면 조율?
- → 전략과목 배정이 비효율적 또는 부정확
```

#### 3. 학습 부하 균형 깨짐
```
현재:
모든 콘텐츠의 daily_amount를 동시에 고려:
- 수학: 4 pages/day
- 국어: 8 pages/day
- 영어: 2 pages/day
→ 학생의 일일 총 학습량 = 14 pages (균형)

분리 후:
- 수학 플랜: 4 pages/day → 180분 블록
- 국어 플랜: 8 pages/day → 180분 블록
- 영어 플랜: 2 pages/day → 180분 블록
→ 학생의 일일 총 학습량 = 14 pages (같지만)
→ 각 플랜은 독립적으로 "180분 블록 할당" → 비비례적 시간 배정
```

#### 4. 복습일 조정 불가능
```
현재:
복습일(일요일)에 모든 콘텐츠 복습:
- 수학 복습: 100~125 (25 pages)
- 국어 복습: 200~260 (60 pages)
- 영어 복습: 100~120 (20 pages)
→ 총 복습 시간 조정되어 블록 fit

분리 후:
- 수학 복습: 100~125 (25 pages) → ?시간?
  (국어, 영어가 같은 날에 없으므로 시간 계산 불명확)
- 국어 복습: 200~260 (60 pages) → ?시간?
- 영어 복습: 100~120 (20 pages) → ?시간?
→ 각각 독립적으로 시간 계산되어 블록 초과 가능
```

### 스케줄러 입력 변경 필요
```typescript
// 분리 시 각 콘텐츠마다:
const schedulerInput1: SchedulerInput = {
  availableDates: [...],  // 같은 기간
  contentInfos: [Content1],  // 단일 콘텐츠
  blocks: [...],         // 같은 블록
  options: {
    subject_allocations: [{
      subject_name: "수학",
      subject_type: "weakness",  // 과목이 같으므로 같은 배정
      weekly_days: null
    }],
    content_allocations: [{
      content_id: "book-math-1",
      subject_type: "weakness"
    }]
  }
  // 문제: 다른 콘텐츠 정보가 없음!
}

const schedulerInput2: SchedulerInput = { ... Content2 ... }
const schedulerInput3: SchedulerInput = { ... Content3 ... }

// 스케줄러 엔진이 각각 독립적으로:
// 1. cycle 계산 (같음)
// 2. content allocation (다름!)
// 3. range division (다름!)
// 4. time slot assignment (비효율)
```

### 기존 로직 중 깨지는 부분
```typescript
// lib/scheduler/SchedulerEngine.ts: 절대 깨짐
private calculateContentAllocation(): Map<string, string[]> {
  // 콘텐츠 간 "우선순위" 고려
  // 단일 콘텐츠면 우선순위 의미 없음
}

// lib/plan/scheduler.ts: 784-862 깨짐
// generateDefaultPlans에서 날짜별 시간 슬롯 배치:
datePlans.forEach(({ content, dailyAmount, currentStart: start }) => {
  // 이 날짜에 여러 콘텐츠가 있다고 가정
  // 단일이면 블록 효율성 극저하
})

// lib/plan/scheduler.ts: 230-249 깨짐
// 추가 기간 재배치:
for (const [contentKey, contentPlans] of plansByContent.entries()) {
  // 여러 콘텐츠 기준으로 복습의 복습 생성
  // 단일 콘텐츠면 다른 콘텐츠의 복습 범위가 없음
}
```

---

## 6. 권장 마이그레이션 전략

### 옵션 A: 콘텐츠별 plan_group 자동 분리 (분산 아키텍처)
```typescript
// PlanGroup 생성 시:
if (contents.length > 1) {
  // 각 콘텐츠마다 자식 plan_group 생성
  for (const content of contents) {
    const childGroup = await createPlanGroup({
      ...parentGroup,
      parent_plan_group_id: parentGroup.id,
      contents: [content],  // 단일 콘텐츠
      scheduler_options: {
        // 자동 조정 (동일 비율로)
      }
    });
    await generatePlansFromGroup(childGroup, [content], ...);
  }
}

// 장점:
// - 콘텐츠별 독립적 관리
// - 재조정 용이 (하나만 수정)

// 단점:
// - 아키텍처 복잡
// - 복습일 조율 필요 (별도 로직)
```

### 옵션 B: 시간 분할 알고리즘 추가
```typescript
// 단일 콘텐츠를 위한 별도 로직:
function generatePlansForSingleContent(
  content: ContentInfo,
  blocks: BlockInfo[],
  schedulerOptions: SchedulerOptions,
  // "다른 콘텐츠"의 일일 소요시간 정보
  otherContentsHoursMap: Map<string, number>
) {
  // 각 날짜에서 다른 콘텐츠의 시간을 미리 차감
  for (const date of dates) {
    const otherUsedTime = otherContentsHoursMap.get(date) || 0;
    const availableTime = blockDuration - otherUsedTime;
    // 이 콘텐츠는 availableTime만 사용
  }
}

// 장점:
// - 단일 콘텐츠도 효율성 유지
// - 기존 구조 유지

// 단점:
// - 콘텐츠 간 순서 의존성 (누가 먼저? 후에?)
```

### 옵션 C: 현재 구조 유지 (권장)
```typescript
// 현재 generatePlansFromGroup이 정확하고 효율적
// 콘텐츠 수 = 1일 때도 정상 작동:

generatePlansFromGroup(
  group,
  [content],  // 단일 요소 배열
  exclusions,
  blocks,
  options: {
    subject_allocations: [{
      subject_name: content.subject,
      subject_type: "weakness"  // 기본값
    }],
    content_allocations: [{
      content_id: content.content_id,
      subject_type: "weakness"
    }]
  }
) → 완벽하게 작동
   // cycle 계산: 6+1
   // content allocation: 전체 날짜
   // range division: 전체 기간 ÷ 날짜 수
   // time slot: 블록의 모든 시간 사용
```

---

## 결론

1. **여러 콘텐츠를 함께 처리하는 이유**
   - 시간 블록의 효율적 활용
   - 전략과목/취약과목의 균형 배정
   - 복습일에서 여러 콘텐츠의 조율

2. **시간 슬롯 배정 시 의존성**
   - 같은 날짜의 블록을 공유
   - 1730 Timetable 주기에서 동시 진행
   - 복습일에 모든 콘텐츠 함께 복습

3. **단일 콘텐츠로 분리 시 주요 문제**
   - 시간 슬롯 낭비
   - 전략과목 배정 불명확
   - 학습 부하 균형 깨짐
   - 복습일 시간 계산 오류

4. **현재 아키텍처가 최적임**
   - generatePlansFromGroup은 다중 콘텐츠를 위해 설계됨
   - 단일 콘텐츠도 올바르게 처리 가능
   - 복습의 복습(additional_review)도 통합됨
