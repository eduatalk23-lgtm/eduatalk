# 가상 타임라인 개선 설계 문서

**작성일**: 2024-12-24
**상태**: 설계 완료, 구현 대기
**우선순위**: P0 (핵심 기능)

---

## 1. 개요

### 1.1 목적
콘텐츠 선택 화면의 가상 타임라인 미리보기를 실제 1730 플랜 생성 로직과 동일하게 작동하도록 개선하여, 학생이 선택한 콘텐츠가 어떻게 배치될지 정확하게 미리 볼 수 있도록 합니다.

### 1.2 현재 문제점

| 문제 | 현재 동작 | 실제 1730 로직 |
|------|----------|---------------|
| **과목 배분** | 슬롯 순서대로 순차 배치 | 취약과목은 모든 학습일, 전략과목은 주당 N일만 배정 |
| **학습-복습 주기** | 학습일/복습일 구분만 함 | 5-2 주기로 학습→복습 순환, 주기 번호 및 주기 내 일자 계산 |
| **복습일 콘텐츠** | 복습일에도 같은 콘텐츠 배치 | 복습일에는 해당 주기의 학습 내용 복습 배치 |
| **시간 계산** | 고정 90분 기본값 | 콘텐츠 타입별, 난이도별, 학생 수준별 계산 |

### 1.3 참조 코드

**현재 가상 타임라인**:
- `lib/plan/virtualSchedulePreview.ts` → `calculateVirtualTimeline()`

**1730 플랜 로직**:
- `lib/plan/1730TimetableLogic.ts` → `calculateStudyReviewCycle()`, `calculateSubjectAllocationDates()`

---

## 2. 핵심 개념

### 2.1 학습-복습 주기 (StudyReviewCycle)

```typescript
// 예: 5-2 주기 = 학습 5일 + 복습 2일
type StudyReviewCycle = {
  study_days: number;  // 5
  review_days: number; // 2
};

// 결과: 학학학학학복복 | 학학학학학복복 | ...
//       주기1        | 주기2        |
```

**주기 내 일자 예시**:
```
날짜      | 주기번호 | 주기내일자 | 유형
---------|---------|-----------|-----
12/25    | 1       | 1         | 학습
12/26    | 1       | 2         | 학습
12/27    | 1       | 3         | 학습
12/28    | 1       | 4         | 학습
12/29    | 1       | 5         | 학습
12/30    | 1       | 6         | 복습
12/31    | 1       | 7         | 복습
1/1      | 2       | 1         | 학습
...
```

### 2.2 과목 배분 로직 (SubjectAllocation)

```typescript
type SubjectAllocation = {
  subject_id: string;
  subject_name: string;
  subject_type: "strategy" | "weakness";
  weekly_days?: number; // 전략과목: 주당 2~4일
};
```

**배분 규칙**:
1. **취약과목**: **모든 학습일**에 배정 (매일 학습)
2. **전략과목**: 지정된 `weekly_days`만큼만 학습일에 배정 (주 N일 집중)
3. **복습일**: 해당 주기의 학습 내용 복습

> **핵심 차이**: 취약과목은 매일 꾸준히, 전략과목은 집중적으로

**배분 예시 (5-2 주기, 전략과목 주 3일)**:
```
         | 월(학1) | 화(학2) | 수(학3) | 목(학4) | 금(학5) | 토(복1) | 일(복2)
---------|--------|--------|--------|--------|--------|--------|--------
취약(국어)| ●      | ●      | ●      | ●      | ●      | ○      | ○
취약(영어)| ●      | ●      | ●      | ●      | ●      | ○      | ○
전략(수학)| ●      |        | ●      |        | ●      | ○      | ○

● = 학습, ○ = 복습

※ 취약과목: 학습일 5일 전체 배정
※ 전략과목: 학습일 중 주 3일만 배정 (월/수/금 균등 분배)
```

### 2.3 시간 계산 공식

```typescript
// 기본 소요 시간
const BASE_DURATION = {
  book: 90,        // 교재: 90분 (페이지 수에 따라 조정)
  lecture: 60,     // 강의: 60분 (회차 수에 따라 조정)
  self_study: 45,  // 자습: 45분
};

// 조정 계수
const FACTORS = {
  // 난이도별 (0.8 ~ 1.4)
  difficulty: { easy: 0.8, medium: 1.0, hard: 1.2, expert: 1.4 },

  // 학생 수준별 (0.7 ~ 1.3)
  studentLevel: { advanced: 0.7, normal: 1.0, slow: 1.3 },

  // 복습 시간 (원본의 50%)
  review: 0.5,
};

// 계산식
const duration = baseDuration
  * difficultyFactor
  * studentLevelFactor;

const reviewDuration = duration * FACTORS.review;
```

---

## 3. 개선된 타임라인 계산 설계

### 3.1 새 함수 시그니처

```typescript
// lib/plan/virtualSchedulePreviewV2.ts

export interface VirtualTimelineOptionsV2 {
  /** 학습-복습 주기 설정 */
  studyReviewCycle: StudyReviewCycle;

  /** 기간 (시작일~종료일) */
  periodStart: string;
  periodEnd: string;

  /** 제외일 목록 */
  exclusions: PlanExclusion[];

  /** 학생 수준 */
  studentLevel?: StudentLevel;

  /** 블록 시간 (분) - 레거시 호환용 */
  blockDuration?: number;
}

export interface VirtualTimelineResultV2 {
  /** 일별 계획 목록 */
  plans: VirtualPlanItemV2[];

  /** 교과별 시간 분배 */
  subjectDistribution: SubjectTimeDistribution[];

  /** 주차별 요약 */
  weekSummaries: WeekSummaryV2[];

  /** 총 학습 시간 (분) */
  totalStudyMinutes: number;

  /** 총 복습 시간 (분) */
  totalReviewMinutes: number;

  /** 총 콘텐츠 수 */
  totalContents: number;

  /** 주기 정보 */
  cycleInfo: {
    totalCycles: number;
    studyDaysPerCycle: number;
    reviewDaysPerCycle: number;
  };

  /** 경고 메시지 */
  warnings: string[];
}

export interface VirtualPlanItemV2 {
  // 기존 필드
  slot_index: number;
  slot_type: SlotType | null;
  subject_category: string;
  title?: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  range_start?: number;
  range_end?: number;

  // 주기 정보 (신규)
  cycle_number: number;
  cycle_day_number: number;
  day_type: "study" | "review";

  // 과목 배분 정보 (신규)
  subject_type: "strategy" | "weakness" | null;
  allocation_reason?: string; // "전략과목 주 3일 배정" 등

  // 관계 정보 (기존)
  linked_to_slot_index?: number;
  link_type?: "after" | "before";
  exclusive_with_indices?: number[];
  linked_group_id?: number;
}
```

### 3.2 계산 로직 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 입력 준비                                                     │
│    - ContentSlot[] 유효성 검증                                   │
│    - 옵션 파라미터 기본값 설정                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. 주기 일자 생성 (calculateStudyReviewCycle 활용)               │
│    - 기간 내 모든 날짜 순회                                      │
│    - 제외일 처리                                                 │
│    - 각 날짜에 주기번호/주기내일자/유형(학습/복습) 부여           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. 슬롯 과목 분류                                                │
│    - 전략과목 슬롯 추출 (subject_type === "strategy")           │
│    - 취약과목 슬롯 추출 (subject_type === "weakness")           │
│    - 미분류 슬롯은 취약과목으로 기본 처리                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. 취약과목 배정 (calculateSubjectAllocationDates 활용)         │
│    - 모든 학습일(study days)에 취약과목 슬롯 배정                │
│    - 취약과목은 매일 꾸준히 학습                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. 전략과목 배정                                                 │
│    - 주차별 학습일 그룹화                                        │
│    - 각 주차에서 weekly_days만큼 균등 선택                       │
│    - 선택된 날짜에만 전략과목 슬롯 배정 (집중 학습)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. 복습일 배정                                                   │
│    - 각 주기의 복습일 추출                                       │
│    - 해당 주기의 학습 콘텐츠를 복습 콘텐츠로 배정                │
│    - 복습 시간 = 학습 시간 × 0.5                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. 시간 블록 할당                                                │
│    - 각 날짜의 가용 시간 계산                                    │
│    - 슬롯별 소요 시간 계산 (타입/난이도/학생수준 반영)           │
│    - 시작/종료 시간 할당                                         │
│    - 점심시간 (12:00-13:00) 제외                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. 연계/배타 슬롯 처리 (기존 로직 유지)                          │
│    - 연계 슬롯 그룹 같은 날 배치                                 │
│    - 배타 슬롯 다른 날 배치                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. 결과 생성                                                     │
│    - VirtualPlanItemV2[] 생성                                   │
│    - 교과별 시간 분배 계산                                       │
│    - 주차별 요약 계산                                            │
│    - 경고 메시지 수집                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 핵심 함수 구현 (의사코드)

```typescript
export function calculateVirtualTimelineV2(
  slots: ContentSlot[],
  options: VirtualTimelineOptionsV2
): VirtualTimelineResultV2 {
  // 1. 유효 슬롯 필터링
  const validSlots = slots.filter(s => s.slot_type && s.subject_category);

  // 2. 주기 일자 생성
  const cycleDays = calculateStudyReviewCycle(
    options.periodStart,
    options.periodEnd,
    options.studyReviewCycle,
    options.exclusions
  );

  // 3. 슬롯 과목 분류
  const { strategySlots, weaknessSlots } = classifySlotsBySubjectType(validSlots);

  // 4. 과목별 배정 날짜 계산
  const allocations: SlotDateAllocation[] = [];
  const allStudyDays = cycleDays
    .filter(d => d.day_type === "study")
    .map(d => d.date);

  // 4-1. 취약과목 배정 (모든 학습일에 배정)
  for (const slot of weaknessSlots) {
    const allocation: SubjectAllocation = {
      subject_id: slot.subject_id ?? slot.subject_category,
      subject_name: slot.subject_category,
      subject_type: "weakness",
    };

    // 취약과목은 모든 학습일에 배정
    const dates = calculateSubjectAllocationDates(cycleDays, allocation);
    allocations.push({ slot, dates, type: "weakness" });
  }

  // 4-2. 전략과목 배정 (주 N일만 배정)
  for (const slot of strategySlots) {
    const allocation: SubjectAllocation = {
      subject_id: slot.subject_id ?? slot.subject_category,
      subject_name: slot.subject_category,
      subject_type: "strategy",
      weekly_days: slot.weekly_days ?? 3, // 주당 배정 일수
    };

    // 전략과목은 주당 weekly_days만큼만 배정
    const dates = calculateSubjectAllocationDates(cycleDays, allocation);
    allocations.push({ slot, dates, type: "strategy" });
  }

  // 5. 복습일 배정
  const reviewPlans = generateReviewPlans(cycleDays, allocations, options);

  // 6. 시간 블록 할당
  const studyPlans = allocations.flatMap(a =>
    a.dates.map(date => createPlanItem(a.slot, date, cycleDays, options))
  );

  // 7. 연계/배타 처리
  const adjustedPlans = applySlotRelationships([...studyPlans, ...reviewPlans], validSlots);

  // 8. 결과 생성
  return buildResult(adjustedPlans, cycleDays, options);
}
```

---

## 4. UI 변경 사항

### 4.1 개선된 가상 타임라인 UI

```
┌─────────────────────────────────────────────────────────────────┐
│  가상 타임라인 미리보기                    [일별] [주별] [리스트] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 과목 배분 요약 (5-2 주기)                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 취약과목 (매일)                전략과목 (주 3일)           │ │
│  │ ■■■■■ 국어 - 교재             ■■■ 수학 - 강의            │ │
│  │ ■■■■■ 영어 - 강의                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📅 주기 1 (12/25 ~ 12/31)                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 월 12/25 [학습일 1]  ✦ 전략과목 배정일                     │ │
│  │   09:00-10:00  국어 교재 (p.1-20)      [취약] 매일        │ │
│  │   10:00-11:00  영어 강의 (회차 1)      [취약] 매일        │ │
│  │   11:00-12:30  수학 강의 (회차 1-2)    [전략] 주3일       │ │
│  │                                                           │ │
│  │ 화 12/26 [학습일 2]                                       │ │
│  │   09:00-10:00  국어 교재 (p.21-40)     [취약] 매일        │ │
│  │   10:00-11:00  영어 강의 (회차 2)      [취약] 매일        │ │
│  │   (전략과목 없음)                                         │ │
│  │                                                           │ │
│  │ 수 12/27 [학습일 3]  ✦ 전략과목 배정일                     │ │
│  │   09:00-10:00  국어 교재 (p.41-60)     [취약] 매일        │ │
│  │   10:00-11:00  영어 강의 (회차 3)      [취약] 매일        │ │
│  │   11:00-12:30  수학 강의 (회차 3-4)    [전략] 주3일       │ │
│  │                                                           │ │
│  │ ...                                                       │ │
│  │                                                           │ │
│  │ 토 12/30 [복습일 1]  📖 복습                               │ │
│  │   09:00-09:45  수학 복습                                  │ │
│  │   09:45-10:15  국어 복습                                  │ │
│  │   10:15-10:45  영어 복습                                  │ │
│  │                                                           │ │
│  │ 일 12/31 [복습일 2]  📖 복습                               │ │
│  │   09:00-09:30  수학 복습 (마무리)                         │ │
│  │   09:30-10:00  국어 복습 (마무리)                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📅 주기 2 (1/1 ~ 1/7)                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ...                                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ⚠️ 주기 3에 시간 부족 예상: 전략과목 2개 미배정               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 주요 UI 변경점

| 항목 | 기존 | 개선 |
|------|------|------|
| 주기 표시 | 주차별 그룹화 | 주기(Cycle)별 그룹화 + 학습일/복습일 구분 |
| 과목 배지 | 교과명만 표시 | [전략] / [취약] 배지 추가 |
| 복습일 | 일반 콘텐츠로 표시 | "📖 복습" 태그 + 복습 콘텐츠 명시 |
| 배정 이유 | 표시 없음 | "✦ 전략과목 배정일" 등 이유 표시 |
| 시간 계산 | 고정 90분 | 계산된 실제 소요 시간 표시 |

---

## 5. 컴포넌트 구조

```
lib/plan/
├── virtualSchedulePreview.ts       # 기존 (레거시 유지)
└── virtualSchedulePreviewV2.ts     # 신규 (1730 로직 통합)

app/(student)/plan/new-group/_components/_features/content-selection/slot-mode/
├── VirtualTimelinePreview.tsx      # 기존 (레거시 유지)
└── VirtualTimelinePreviewV2.tsx    # 신규 UI
```

---

## 6. 구현 계획

### Phase 1: 핵심 로직 구현 (2일)

| 태스크 | 설명 | 예상 시간 |
|--------|------|----------|
| `virtualSchedulePreviewV2.ts` 생성 | 새 파일 생성 및 타입 정의 | 1h |
| `classifySlotsBySubjectType()` | 슬롯 과목 분류 함수 | 1h |
| `calculateSubjectAllocation()` | 과목별 날짜 배정 로직 | 3h |
| `generateReviewPlans()` | 복습일 계획 생성 | 2h |
| `calculateDurationV2()` | 시간 계산 개선 | 2h |
| 연계/배타 처리 통합 | 기존 로직 재사용 | 1h |

### Phase 2: UI 구현 (2일)

| 태스크 | 설명 | 예상 시간 |
|--------|------|----------|
| `VirtualTimelinePreviewV2.tsx` 생성 | 새 UI 컴포넌트 | 4h |
| 주기별 그룹화 UI | 주기 경계 시각화 | 2h |
| 과목 배지 UI | [전략]/[취약] 배지 | 1h |
| 복습일 UI | 복습 콘텐츠 표시 | 1h |
| 과목 배분 요약 차트 | 상단 요약 영역 | 2h |

### Phase 3: 통합 및 테스트 (1일)

| 태스크 | 설명 | 예상 시간 |
|--------|------|----------|
| Step3SlotModeSelection 통합 | V2 컴포넌트 교체 | 1h |
| 유닛 테스트 | 핵심 로직 테스트 | 3h |
| 통합 테스트 | E2E 플로우 테스트 | 2h |

---

## 7. 테스트 케이스

### 7.1 유닛 테스트

```typescript
describe("calculateVirtualTimelineV2", () => {
  describe("과목 배분", () => {
    it("취약과목은 모든 학습일에 배정된다", () => {
      const slots = [
        { subject_category: "수학", subject_type: "strategy", weekly_days: 3 },
        { subject_category: "국어", subject_type: "weakness" },
        { subject_category: "영어", subject_type: "weakness" },
      ];
      const result = calculateVirtualTimelineV2(slots, options);

      const koreanPlans = result.plans.filter(p =>
        p.subject_category === "국어" && p.day_type === "study"
      );
      const englishPlans = result.plans.filter(p =>
        p.subject_category === "영어" && p.day_type === "study"
      );

      // 취약과목은 모든 학습일에 배정 (주 5일 × 4주 = 20회)
      expect(koreanPlans.length).toBe(20);
      expect(englishPlans.length).toBe(20);
    });

    it("전략과목은 주당 지정 일수만큼만 배정된다", () => {
      const slots = [
        { subject_category: "수학", subject_type: "strategy", weekly_days: 3 },
        { subject_category: "국어", subject_type: "weakness" },
      ];
      const result = calculateVirtualTimelineV2(slots, options);

      const mathPlans = result.plans.filter(p => p.subject_category === "수학");
      // 전략과목: 주당 3일 × 4주 = 12회 배정
      expect(mathPlans.filter(p => p.day_type === "study")).toHaveLength(12);
    });

    it("같은 날 취약과목과 전략과목이 함께 배정될 수 있다", () => {
      const slots = [
        { subject_category: "수학", subject_type: "strategy", weekly_days: 3 },
        { subject_category: "국어", subject_type: "weakness" },
      ];
      const result = calculateVirtualTimelineV2(slots, options);

      // 전략과목 배정일에는 취약과목도 함께 있어야 함
      const strategyDates = result.plans
        .filter(p => p.subject_type === "strategy" && p.day_type === "study")
        .map(p => p.date);

      for (const date of strategyDates) {
        const weaknessOnSameDay = result.plans.filter(p =>
          p.date === date && p.subject_type === "weakness" && p.day_type === "study"
        );
        expect(weaknessOnSameDay.length).toBeGreaterThan(0);
      }
    });
  });

  describe("학습-복습 주기", () => {
    it("복습일에 해당 주기의 학습 내용이 복습으로 배정된다", () => {
      const result = calculateVirtualTimelineV2(slots, {
        ...options,
        studyReviewCycle: { study_days: 5, review_days: 2 },
      });

      const cycle1ReviewPlans = result.plans.filter(p =>
        p.cycle_number === 1 && p.day_type === "review"
      );

      expect(cycle1ReviewPlans.length).toBeGreaterThan(0);
      expect(cycle1ReviewPlans[0].duration_minutes).toBeLessThan(
        result.plans.find(p => p.cycle_number === 1 && p.day_type === "study")!.duration_minutes
      );
    });

    it("주기 일자 번호가 올바르게 부여된다", () => {
      const result = calculateVirtualTimelineV2(slots, {
        ...options,
        studyReviewCycle: { study_days: 5, review_days: 2 },
      });

      // 첫 번째 학습일: cycle_day_number = 1
      const firstStudyDay = result.plans.find(p =>
        p.cycle_number === 1 && p.day_type === "study"
      );
      expect(firstStudyDay?.cycle_day_number).toBe(1);

      // 첫 번째 복습일: cycle_day_number = 6
      const firstReviewDay = result.plans.find(p =>
        p.cycle_number === 1 && p.day_type === "review"
      );
      expect(firstReviewDay?.cycle_day_number).toBe(6);
    });
  });

  describe("시간 계산", () => {
    it("복습 시간은 학습 시간의 50%이다", () => {
      const result = calculateVirtualTimelineV2(slots, options);

      const studyPlan = result.plans.find(p => p.day_type === "study");
      const reviewPlan = result.plans.find(p =>
        p.day_type === "review" &&
        p.slot_index === studyPlan?.slot_index
      );

      expect(reviewPlan?.duration_minutes).toBe(
        Math.round(studyPlan!.duration_minutes * 0.5)
      );
    });
  });
});
```

### 7.2 통합 테스트

```typescript
describe("Step3SlotModeSelection with VirtualTimelineV2", () => {
  it("슬롯 추가 시 가상 타임라인이 1730 로직에 따라 업데이트된다", async () => {
    render(<Step3SlotModeSelection {...props} />);

    // 전략과목 슬롯 추가
    await addSlot({
      subject_category: "수학",
      subject_type: "strategy",
      weekly_days: 3
    });

    // 가상 타임라인에 전략과목 배지 표시 확인
    expect(screen.getByText("[전략]")).toBeInTheDocument();

    // 복습일 표시 확인
    expect(screen.getByText(/복습일/)).toBeInTheDocument();
  });
});
```

---

## 8. 기술적 고려사항

### 8.1 기존 코드 재사용

| 함수 | 파일 | 재사용 방법 |
|------|------|------------|
| `calculateStudyReviewCycle()` | 1730TimetableLogic.ts | 직접 import |
| `calculateSubjectAllocationDates()` | 1730TimetableLogic.ts | 직접 import |
| `groupLinkedSlots()` | virtualSchedulePreview.ts | 직접 import |
| `checkExclusiveConstraints()` | virtualSchedulePreview.ts | 직접 import |

### 8.2 하위 호환성

- 기존 `VirtualTimelineResult` 타입은 유지
- `VirtualTimelineResultV2`는 확장된 새 타입
- 레거시 컴포넌트는 그대로 유지, 점진적 마이그레이션

### 8.3 성능 최적화

- 계산 결과 메모이제이션 (`useMemo`)
- 슬롯 변경 시 debounce 적용 (300ms)
- 큰 데이터셋 가상화 (필요시)

---

## 9. 마이그레이션 계획

### 9.1 단계별 전환

1. **Phase 1**: V2 로직 구현 + 플래그 기반 전환
   ```typescript
   const useV2Timeline = true; // feature flag

   const timelineResult = useV2Timeline
     ? calculateVirtualTimelineV2(slots, optionsV2)
     : calculateVirtualTimeline(slots, dailySchedules, options);
   ```

2. **Phase 2**: 기존 UI 유지하면서 V2 UI 병행 테스트

3. **Phase 3**: V2 UI 기본값 전환

4. **Phase 4**: 레거시 코드 제거 (1-2주 후)

---

## 10. 결론

이 설계를 통해:

1. **정확한 미리보기**: 실제 1730 플랜 결과와 동일한 타임라인 표시
2. **학습 효과 극대화**: 전략/취약 과목 배분 시각화로 학습 계획 이해도 향상
3. **복습 주기 인식**: 학습-복습 주기가 명확히 표시되어 복습 중요성 인식

구현 준비가 완료되면 Phase 1부터 진행하겠습니다.

---

## 11. 추가 개선 사항 (2024-12-24)

### 11.1 미연결 슬롯 추천 범위 계산

**문제**: 콘텐츠가 연결되지 않은 슬롯은 범위가 없어 시간 계산이 부정확함

**현재 동작**:
```typescript
// calculateSlotDurationV2에서
if (slot.start_range !== undefined && slot.end_range !== undefined) {
  // 범위 기반 계산
} else {
  // 기본 시간 사용 (90분) - 부정확!
}
```

**개선 방안**:
```typescript
/**
 * 미연결 슬롯의 추천 범위 계산
 * - 기간 내 학습일 수와 일일 학습량을 기반으로 추정
 */
function estimateSlotRange(
  slot: ContentSlot,
  options: {
    studyDaysCount: number;
    dailyStudyMinutes: number;
    slotsPerDay: number;
  }
): { start: number; end: number } {
  const { studyDaysCount, dailyStudyMinutes, slotsPerDay } = options;

  // 슬롯당 일일 할당 시간
  const minutesPerSlotPerDay = dailyStudyMinutes / slotsPerDay;

  if (slot.slot_type === 'book') {
    // 교재: 페이지당 2분
    const pagesPerDay = Math.floor(minutesPerSlotPerDay / 2);
    const totalPages = pagesPerDay * studyDaysCount;
    return { start: 1, end: Math.max(totalPages, 20) }; // 최소 20페이지
  } else if (slot.slot_type === 'lecture') {
    // 강의: 회차당 30분
    const episodesPerDay = Math.max(1, Math.floor(minutesPerSlotPerDay / 30));
    const totalEpisodes = episodesPerDay * studyDaysCount;
    return { start: 1, end: Math.max(totalEpisodes, 5) }; // 최소 5회차
  }

  return { start: 1, end: 10 }; // 기본값
}
```

**적용 위치**: `calculateVirtualTimelineV2()` 초반에 미연결 슬롯에 대해 추정 범위 설정

### 11.2 학습 범위 일별 분배 (1730 로직 기반)

**문제**: 전체 범위(예: 1p~100p)가 매일 반복 표시됨

**현재 동작**:
```typescript
// 5일간 학습해도 매일 1p-100p로 표시
studyPlans.push({
  range_start: slot.start_range,  // 1
  range_end: slot.end_range,      // 100
  // ...
});
```

**1730 실제 로직** (`1730TimetableLogic.ts:divideContentRange`):
```typescript
// 핵심: "전체 학습일"이 아니라 "해당 슬롯이 배정된 날짜 수" 기준!
export function divideContentRange(
  totalRange: number,
  allocatedDates: string[],  // ← calculateSubjectAllocationDates()의 결과
  contentId: string
): Map<string, { start: number; end: number }> {
  const dailyRange = totalRange / allocatedDates.length;
  // ...
}
```

**배정 날짜 계산 로직**:
- 취약과목: 모든 학습일 (예: 5일 × 4주 = 20일)
- 전략과목: 주당 N일만 (예: 3일 × 4주 = 12일)

**개선 방안** (기존 1730 로직 활용):
```typescript
/**
 * 범위를 해당 슬롯의 배정 날짜에 분배
 *
 * 중요: 전체 학습일이 아닌, calculateSubjectAllocationDates()에서
 * 반환된 날짜 수 기준으로 분배
 */
function divideRangeAcrossAllocatedDates(
  slot: ContentSlot,
  allocatedDates: string[]  // ← 해당 슬롯이 배정된 날짜만
): DailyRangeAllocation[] {
  if (!slot.start_range || !slot.end_range || allocatedDates.length === 0) {
    return [];
  }

  const totalRange = slot.end_range - slot.start_range + 1;
  const dailyRange = totalRange / allocatedDates.length;

  const allocations: DailyRangeAllocation[] = [];
  let currentStart = slot.start_range;

  for (let i = 0; i < allocatedDates.length; i++) {
    const date = allocatedDates[i];
    const isLast = i === allocatedDates.length - 1;
    const rangeSize = isLast
      ? slot.end_range - currentStart + 1
      : Math.round(dailyRange);
    const currentEnd = currentStart + rangeSize - 1;

    // 시간 계산 (슬롯 타입별)
    const duration = slot.slot_type === 'book'
      ? rangeSize * 2      // 페이지당 2분
      : rangeSize * 30;    // 회차당 30분

    allocations.push({
      date,
      range_start: currentStart,
      range_end: currentEnd,
      duration_minutes: duration,
    });

    currentStart = currentEnd + 1;
  }

  return allocations;
}
```

**예시** (5-2 주기, 4주 = 총 20 학습일):
```
취약과목 100페이지:
  → 배정 날짜: 20일 (모든 학습일)
  → 100 / 20 = 5페이지/일
  - 학습일 1: 1p-5p
  - 학습일 2: 6p-10p
  - ...
  - 학습일 20: 96p-100p

전략과목 주3일 100페이지:
  → 배정 날짜: 12일 (4주 × 3일)
  → 100 / 12 ≈ 8페이지/일
  - 배정일 1 (월): 1p-8p
  - 배정일 2 (수): 9p-16p
  - 배정일 3 (금): 17p-25p
  - ...
  - 배정일 12: 93p-100p
```

**주의**: 주기별로 나누는 것이 아님!
- (X) 1주기에 전체 범위 학습 → 2주기에 또 전체 범위 학습
- (O) 전체 배정 날짜에 걸쳐 순차적으로 분배

### 11.3 복습일 콘텐츠별 배치 개선

**문제**: 복습 플랜이 학습 플랜을 단순히 균등 분배함

**현재 동작**:
```typescript
// generateReviewPlans에서
const plansPerReviewDay = Math.ceil(cycleStudyPlans.length / reviewDays.length);
// 순서대로 나눠서 배치 - 콘텐츠 연속성 고려 안함
```

**개선 방안**:
```typescript
/**
 * 콘텐츠별로 그룹화하여 복습 배치
 * - 같은 콘텐츠의 학습 내용은 연속으로 복습
 * - 연속 범위는 병합하여 효율적 복습
 */
function generateReviewPlansV2(
  cycleDays: CycleDayInfo[],
  studyPlans: VirtualPlanItemV2[]
): VirtualPlanItemV2[] {
  const reviewPlans: VirtualPlanItemV2[] = [];

  // 주기별 복습일 추출
  const cycleReviewDays = groupByField(
    cycleDays.filter(d => d.day_type === 'review'),
    'cycle_number'
  );

  for (const [cycleNumber, reviewDays] of cycleReviewDays) {
    // 해당 주기의 학습 플랜을 콘텐츠(slot_index)별로 그룹화
    const cycleStudyPlans = studyPlans.filter(
      p => p.cycle_number === cycleNumber && p.day_type === 'study'
    );

    const plansBySlot = groupByField(cycleStudyPlans, 'slot_index');

    let reviewDayIndex = 0;
    let currentTime = '09:00';

    for (const [slotIndex, slotPlans] of plansBySlot) {
      // 연속 범위 압축
      const compressed = compressConsecutiveRanges(slotPlans);

      for (const item of compressed) {
        if (reviewDayIndex >= reviewDays.length) break;

        const reviewDay = reviewDays[reviewDayIndex];
        const reviewDuration = Math.round(item.duration_minutes * 0.5);

        // 시간 체크 (점심, 일일 종료)
        if (currentTime >= '12:00' && currentTime < '13:00') {
          currentTime = '13:00';
        }
        if (currentTime >= '17:00') {
          reviewDayIndex++;
          currentTime = '09:00';
          if (reviewDayIndex >= reviewDays.length) break;
        }

        reviewPlans.push({
          ...item,
          date: reviewDays[reviewDayIndex].date,
          start_time: currentTime,
          end_time: addMinutesToTime(currentTime, reviewDuration),
          duration_minutes: reviewDuration,
          day_type: 'review',
          title: `${item.title} (복습)`,
        });

        currentTime = addMinutesToTime(currentTime, reviewDuration);
      }
    }
  }

  return reviewPlans;
}

/**
 * 연속된 범위를 병합
 */
function compressConsecutiveRanges(
  plans: VirtualPlanItemV2[]
): VirtualPlanItemV2[] {
  if (plans.length === 0) return [];

  const sorted = [...plans].sort((a, b) => a.date.localeCompare(b.date));
  const result: VirtualPlanItemV2[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const plan = sorted[i];

    // 연속 범위면 병합
    if (
      current.range_end !== undefined &&
      plan.range_start !== undefined &&
      plan.range_start === current.range_end + 1
    ) {
      current.range_end = plan.range_end;
      current.duration_minutes += plan.duration_minutes;
    } else {
      result.push(current);
      current = { ...plan };
    }
  }
  result.push(current);

  return result;
}
```

### 11.4 스케줄 시간 블록 활용

**문제**: Step2에서 설정한 시간대(daily_schedule)를 무시하고 09:00부터 순차 배치

**현재 동작**:
```typescript
let currentTime = dateTimeTracker.get(date) ?? "09:00"; // 고정
```

**개선 방안**:
```typescript
/**
 * WizardData의 daily_schedule에서 가용 시간 블록 추출
 */
function getAvailableTimeBlocks(
  wizardData: WizardData,
  date: string
): TimeBlock[] {
  const dayOfWeek = new Date(date).getDay(); // 0=일, 1=월, ...
  const daySettings = wizardData.daily_schedule?.[dayOfWeek];

  if (!daySettings?.time_blocks?.length) {
    // 기본값: 09:00-12:00, 13:00-17:00
    return [
      { start: '09:00', end: '12:00', minutes: 180 },
      { start: '13:00', end: '17:00', minutes: 240 },
    ];
  }

  return daySettings.time_blocks
    .filter(b => b.is_active)
    .map(b => ({
      start: b.start_time,
      end: b.end_time,
      minutes: calculateMinutes(b.start_time, b.end_time),
    }));
}

/**
 * 시간 블록 내에서 플랜 배치
 */
function placePlansInTimeBlocks(
  plansForDate: VirtualPlanItemV2[],
  timeBlocks: TimeBlock[]
): VirtualPlanItemV2[] {
  const result: VirtualPlanItemV2[] = [];
  let blockIndex = 0;
  let currentTime = timeBlocks[0]?.start ?? '09:00';
  let remainingMinutes = timeBlocks[0]?.minutes ?? 180;

  for (const plan of plansForDate) {
    // 현재 블록에 안 들어가면 다음 블록으로
    while (remainingMinutes < plan.duration_minutes) {
      blockIndex++;
      if (blockIndex >= timeBlocks.length) break;
      currentTime = timeBlocks[blockIndex].start;
      remainingMinutes = timeBlocks[blockIndex].minutes;
    }

    if (blockIndex >= timeBlocks.length) {
      // 가용 시간 초과 - 경고 추가
      continue;
    }

    result.push({
      ...plan,
      start_time: currentTime,
      end_time: addMinutesToTime(currentTime, plan.duration_minutes),
    });

    currentTime = addMinutesToTime(currentTime, plan.duration_minutes);
    remainingMinutes -= plan.duration_minutes;
  }

  return result;
}
```

---

## 12. 슬롯 영역 개선

### 12.1 슬롯 상세에 과목명 표시

**문제**: 슬롯 요약에 교과(subject_category)만 표시, 과목(subject)은 미표시

**현재** (SlotRow.tsx):
```typescript
const detailSummary = slot.slot_type
  ? `${typeConfig?.label} / ${slot.subject_category || "교과 미선택"}...`
  : undefined;
// 결과: "교재 / 수학" (과목명 없음)
```

**개선**:
```typescript
// ContentSlot 타입에 subject 필드 추가
export type ContentSlot = SlotTemplate & {
  subject_category: string;
  subject_id?: string | null;
  subject?: string | null;  // 과목명 (신규)
  // ...
};

// SlotDetailPanel에서 과목 선택 시 subject 필드도 업데이트
const handleSubjectIdChange = useCallback(
  (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = subjects.find(s => s.id === e.target.value);
    handleSlotUpdate({
      subject_id: e.target.value || null,
      subject: selected?.name ?? null, // 과목명도 저장
    });
  },
  [handleSlotUpdate, subjects]
);

// SlotRow에서 과목명 표시
const detailSummary = slot.slot_type
  ? `${typeConfig?.label} / ${slot.subject_category}${
      slot.subject ? ` / ${slot.subject}` : ''
    }${
      slot.subject_type === 'strategy' ? ` / 전략 주${slot.weekly_days}일` : ''
    }`
  : undefined;
// 결과: "교재 / 수학 / 미적분 / 전략 주3일"
```

### 12.2 수정 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `lib/types/content-selection.ts` | ContentSlot에 `subject?: string` 추가 |
| `SlotDetailPanel.tsx` | 과목 선택 시 subject 필드 업데이트 |
| `SlotRow.tsx` | detailSummary에 subject 포함 |

---

## 13. 구현 우선순위 (업데이트)

| 순서 | 항목 | 복잡도 | 영향도 | 예상 시간 |
|------|------|--------|--------|----------|
| 1 | 슬롯 과목명 표시 (12.1) | 낮음 | 중간 | 1시간 |
| 2 | 미연결 슬롯 추천 범위 (11.1) | 중간 | 높음 | 2시간 |
| 3 | 학습 범위 일별 분배 (11.2) | 중간 | 높음 | 3시간 |
| 4 | 복습일 콘텐츠별 배치 (11.3) | 중간 | 중간 | 2시간 |
| 5 | 스케줄 시간 블록 활용 (11.4) | 높음 | 중간 | 3시간 |

**총 예상 시간**: 11시간

---

## 14. 예상 결과 비교

### Before (현재)
```
슬롯 1: 수학 (교재)
├── 학습일 1: 1p-100p, 09:00-12:20
├── 학습일 2: 1p-100p, 09:00-12:20 ← 동일 범위 반복!
├── 학습일 3: 1p-100p, 09:00-12:20
└── 복습일: 슬롯1~3 균등 분배

* 과목명(미적분) 미표시
* 범위가 나뉘지 않음
* 스케줄 시간대 무시
```

### After (개선)
```
슬롯 1: 수학 / 미적분 (교재)
├── 학습일 1 (10:00-10:40): 1p-20p      ← 시간블록 반영
├── 학습일 2 (10:00-10:40): 21p-40p     ← 범위 분배
├── 학습일 3 (10:00-10:40): 41p-60p
├── 학습일 4 (10:00-10:40): 61p-80p
├── 학습일 5 (10:00-10:40): 81p-100p
└── 복습일 1 (09:00-09:50): 1p-100p 복습 ← 콘텐츠 연속 복습

* 과목명(미적분) 표시
* 범위가 학습일에 분배됨
* Step2 시간 설정 반영
```

---

## 15. Step 3 스케줄 미리보기 로직 분석

### 15.1 로직 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ Step3SchedulePreview.tsx                                        │
│   └── SchedulePreviewPanel.tsx                                  │
│         └── calculateScheduleAvailability (Server Action)       │
│               └── calculateAvailableDates (Core Logic)          │
└─────────────────────────────────────────────────────────────────┘
```

### 15.2 calculateScheduleAvailability 핵심 로직

**파일**: `lib/domains/plan/actions/calculateScheduleAvailability.ts`

```typescript
export async function calculateScheduleAvailability(params) {
  // 1. 블록 데이터 조회 (캠프/템플릿/일반 모드별 분기)
  let blocks: Block[] = [];

  if (params.isCampMode && params.campTemplateId) {
    // 캠프: camp_template_block_sets → tenant_blocks
  } else if (params.isTemplateMode) {
    // 템플릿: params.blocks 직접 사용
  } else {
    // 일반: student_block_schedule
  }

  // 2. 제외일 위계 처리 (캠프 모드)
  if (params.isCampMode) {
    // 같은 날짜에 여러 제외일 → 위계 높은 것만 유지
    // 우선순위: 지정휴일 > 휴가 > 개인일정
  }

  // 3. calculateAvailableDates 호출
  return calculateAvailableDates(
    params.periodStart, params.periodEnd,
    blocks, processedExclusions,
    params.academySchedules, options
  );
}
```

### 15.3 calculateAvailableDates 반환 데이터

**파일**: `lib/scheduler/calculateAvailableDates.ts`

```typescript
interface ScheduleAvailabilityResult {
  summary: ScheduleSummary;
  daily_schedule: DailySchedule[];
  errors: string[];
}

interface DailySchedule {
  date: string;                    // "2024-12-25"
  day_type: DayType;               // "학습일" | "복습일" | "휴가" | "개인일정" | "지정휴일"
  study_hours: number;             // 가용 학습 시간 (시간)
  available_time_ranges: TimeRange[];
  note?: string;
  academy_schedules?: AcademySchedule[];
  exclusion: Exclusion | null;
  week_number?: number;

  // ★ 핵심: 시간 슬롯 배열
  time_slots: TimeSlot[];
}

interface TimeSlot {
  type: "학습시간" | "자율학습" | "이동시간" | "학원일정";
  start: string;  // "09:00"
  end: string;    // "12:00"
  label?: string; // "오전 학습"
  academyName?: string; // 학원일정인 경우
}
```

### 15.4 time_slots 계산 로직

```typescript
// calculateAvailableTimeForDate 함수에서 생성
function calculateAvailableTimeForDate(date, dayType, blocks, academySchedules, exclusion, options) {
  const timeSlots: TimeSlot[] = [];

  // 1. 블록 기반 학습 시간 슬롯 추가
  for (const block of blocksForDay) {
    timeSlots.push({
      type: "학습시간",
      start: block.start_time,
      end: block.end_time,
    });
  }

  // 2. 학원 일정이 있으면 학습 시간에서 차감 + 이동시간 추가
  for (const academy of academySchedules) {
    // 학원 시간 전에 이동시간 추가
    timeSlots.push({
      type: "이동시간",
      start: addMinutes(academy.start_time, -travelTime),
      end: academy.start_time,
    });

    // 학원 일정 추가
    timeSlots.push({
      type: "학원일정",
      start: academy.start_time,
      end: academy.end_time,
      academyName: academy.name,
    });

    // 학원 시간 후에 이동시간 추가
    timeSlots.push({
      type: "이동시간",
      start: academy.end_time,
      end: addMinutes(academy.end_time, travelTime),
    });
  }

  // 3. 자율학습 시간 추가 (옵션에 따라)
  if (options.enable_self_study_for_study_days) {
    timeSlots.push({
      type: "자율학습",
      start: "06:00",
      end: "08:00",
    });
  }

  return { timeSlots, ranges, hours, note };
}
```

### 15.5 SchedulePreviewPanel에서의 사용

```typescript
// SchedulePreviewPanel.tsx에서 wizardData 업데이트
useEffect(() => {
  if (result?.data) {
    updateWizardData({
      schedule_summary: result.data.summary,
      daily_schedule: result.data.daily_schedule, // ★ time_slots 포함
    });
  }
}, [result]);
```

---

## 16. Step 7 플랜 생성 로직 분석

### 16.1 로직 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ Step7ScheduleResult.tsx                                         │
│   └── generatePlansFromGroupAction                              │
│         └── _generatePlansFromGroupWithFeatureFlag              │
│               └── generatePlansWithServices (피처 플래그 ON)    │
│                     └── preparePlanGenerationData               │
│                           └── allocatePlansToTimeSlots          │
│                     └── getPlanPersistenceService().savePlans() │
└─────────────────────────────────────────────────────────────────┘
```

### 16.2 generatePlansWithServices 핵심 로직

**파일**: `lib/plan/services/generatePlansWithServices.ts`

```typescript
export async function generatePlansWithServices(input) {
  // 1-7. 공통 데이터 준비
  const preparedData = await preparePlanGenerationData(input, logger);

  // → 결과: contentMetadataMap, dateAllocations
  // dateAllocations: 각 날짜별 시간 세그먼트와 콘텐츠 배치 정보

  // 8. 플랜 페이로드 생성
  const planPayloads = [];

  for (const { date, segments, dateMetadata, dayType } of dateAllocations) {
    segments.forEach((segment, index) => {
      planPayloads.push({
        plan_date: date,
        block_index: segment.plan.block_index ?? index,
        content_type: segment.plan.content_type,
        content_id: segment.plan.content_id,
        planned_start_page_or_time: segment.plan.planned_start_page_or_time,
        planned_end_page_or_time: segment.plan.planned_end_page_or_time,
        start_time: segment.start,    // ★ 시간 슬롯에 맞춘 시작 시간
        end_time: segment.end,        // ★ 시간 슬롯에 맞춘 종료 시간
        day_type: dayType,            // "학습일" | "복습일"
        week: dateMetadata.week_number,
        is_partial: segment.isPartial,
        is_continued: segment.isContinued,
        plan_number: planNumber,
        subject_type: segment.plan.subject_type ?? null,
        content_title: metadata?.title ?? null,
        content_subject: metadata?.subject ?? null,
      });
    });
  }

  // 9. 플랜 저장
  const persistResult = await persistenceService.savePlans({
    plans: planPayloads,
    planGroupId: groupId,
    context,
    options: { deleteExisting: true },
  });

  return { success: true, count: persistResult.data?.savedCount };
}
```

### 16.3 플랜 페이로드 구조

```typescript
interface PlanPayloadBase {
  plan_date: string;                      // "2024-12-25"
  block_index: number;                    // 슬롯 인덱스
  content_type: string;                   // "book" | "lecture" | "custom"
  content_id: string;
  planned_start_page_or_time: number;     // 범위 시작 (1페이지 or 1회차)
  planned_end_page_or_time: number;       // 범위 종료
  start_time: string;                     // "09:00" (시간 슬롯 내 시작)
  end_time: string;                       // "10:30" (시간 슬롯 내 종료)
  day_type: "학습일" | "복습일" | ...;
  week: number;                           // 주차 번호
  is_partial: boolean;                    // 시간 부족으로 나뉜 플랜
  is_continued: boolean;                  // 이전 날짜에서 계속된 플랜
  plan_number: number;                    // 플랜 고유 번호
  subject_type: "strategy" | "weakness" | null;
  content_title?: string;
  content_subject?: string;
}
```

---

## 17. 가상 타임라인과 스케줄 데이터 연동 설계

### 17.1 현재 문제점

Step 3에서 계산된 `daily_schedule.time_slots`가 있지만, Step 4의 가상 타임라인은 이를 활용하지 않고 독립적으로 "09:00"부터 순차 배치:

```
Step 3 (SchedulePreviewPanel)
   ↓
wizardData.daily_schedule = [
  { date: "2024-12-25", time_slots: [
    { type: "학습시간", start: "10:00", end: "12:00" },
    { type: "자율학습", start: "14:00", end: "16:00" },
  ]}
]
   ↓
Step 4 (VirtualTimelinePreview) - 현재 이 데이터 무시!
   ↓
09:00부터 순차 배치 (Step 3 계산 결과와 불일치)
```

### 17.2 개선 방안: wizardData.daily_schedule 활용

```typescript
// VirtualTimelinePreviewV2.tsx
function calculateVirtualTimelineV2(
  slots: ContentSlot[],
  options: VirtualTimelineOptionsV2
): VirtualTimelineResultV2 {
  // ★ wizardData.daily_schedule에서 time_slots 가져오기
  const dailySchedule = options.dailySchedule; // Step 3에서 계산된 결과

  // ...

  // 7. 시간 블록 할당 - Step 3의 time_slots 사용
  for (const { date, plans } of dateAllocations) {
    const schedule = dailySchedule.find(s => s.date === date);
    const studyTimeSlots = schedule?.time_slots
      .filter(t => t.type === "학습시간") ?? [];

    // 학습시간 슬롯 내에서만 플랜 배치
    placePlansWithinTimeSlots(plans, studyTimeSlots);
  }
}
```

### 17.3 VirtualTimelineOptionsV2 확장

```typescript
export interface VirtualTimelineOptionsV2 {
  // 기존 필드...
  studyReviewCycle: StudyReviewCycle;
  periodStart: string;
  periodEnd: string;
  exclusions: PlanExclusion[];
  studentLevel?: StudentLevel;
  blockDuration?: number;

  // ★ 신규: Step 3에서 계산된 일별 스케줄
  dailySchedule?: DailySchedule[];
}
```

### 17.4 통합 플로우

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Step 2: 시간 설정                                                          │
│   - 블록 세트 선택, 제외일 설정, 학원일정 입력                              │
└───────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌───────────────────────────────────────────────────────────────────────────┐
│ Step 3: 스케줄 미리보기 (SchedulePreviewPanel)                             │
│   - calculateScheduleAvailability() 호출                                   │
│   - wizardData.daily_schedule 저장 (time_slots 포함)                       │
│   - 시간 가용성 시각화: 학습시간/자율학습/학원일정/이동시간                  │
└───────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌───────────────────────────────────────────────────────────────────────────┐
│ Step 4: 콘텐츠 선택 (VirtualTimelinePreviewV2)                             │
│   ★ wizardData.daily_schedule.time_slots 활용                              │
│   - 슬롯 과목 분류 (전략/취약)                                              │
│   - 날짜별 배정 (1730 로직)                                                │
│   - time_slots 내에서 시간 할당 (Step 3 결과 반영!)                         │
│   - 학습 범위 일별 분배                                                    │
│   - 복습일 콘텐츠별 배치                                                   │
└───────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌───────────────────────────────────────────────────────────────────────────┐
│ Step 7: 플랜 생성 (generatePlansWithServices)                              │
│   - 가상 타임라인과 동일한 로직 적용                                        │
│   - 실제 DB에 플랜 저장                                                    │
│   ★ 결과: Step 4 미리보기와 일치하는 플랜 생성                              │
└───────────────────────────────────────────────────────────────────────────┘
```

### 17.5 time_slots 활용 구현

```typescript
/**
 * Step 3에서 계산된 time_slots를 활용하여 플랜 배치
 */
function placePlansWithinTimeSlots(
  plansForDate: VirtualPlanItemV2[],
  timeSlots: TimeSlot[]
): VirtualPlanItemV2[] {
  // 학습시간 슬롯만 추출
  const studySlots = timeSlots.filter(s => s.type === "학습시간");

  if (studySlots.length === 0) {
    // 시간 슬롯이 없으면 경고 추가 후 기본 배치
    return plansForDate.map(p => ({
      ...p,
      warning: "해당 날짜에 학습 가능 시간이 없습니다",
    }));
  }

  const result: VirtualPlanItemV2[] = [];
  let slotIndex = 0;
  let currentTimeMinutes = timeToMinutes(studySlots[0].start);

  for (const plan of plansForDate) {
    const slot = studySlots[slotIndex];
    const slotEndMinutes = timeToMinutes(slot.end);

    // 현재 슬롯에 안 들어가면 다음 슬롯으로
    while (currentTimeMinutes + plan.duration_minutes > slotEndMinutes) {
      slotIndex++;
      if (slotIndex >= studySlots.length) {
        // 가용 시간 초과 - 경고 추가
        result.push({
          ...plan,
          warning: "시간 부족으로 배치 불가",
        });
        continue;
      }
      currentTimeMinutes = timeToMinutes(studySlots[slotIndex].start);
    }

    result.push({
      ...plan,
      start_time: minutesToTime(currentTimeMinutes),
      end_time: minutesToTime(currentTimeMinutes + plan.duration_minutes),
    });

    currentTimeMinutes += plan.duration_minutes;
  }

  return result;
}
```

---

## 18. 수정 파일 목록 (업데이트)

| 파일 | 수정 내용 |
|------|----------|
| `lib/plan/virtualSchedulePreviewV2.ts` | dailySchedule 옵션 추가, time_slots 활용 로직 |
| `VirtualTimelinePreviewV2.tsx` | wizardData.daily_schedule 전달 |
| `Step3SlotModeSelection.tsx` | V2 컴포넌트 통합 시 dailySchedule props 전달 |

---

## 19. 구현 우선순위 (최종 업데이트)

| 순서 | 항목 | 복잡도 | 영향도 | 예상 시간 |
|------|------|--------|--------|----------|
| 1 | 슬롯 과목명 표시 (12.1) | 낮음 | 중간 | 1시간 |
| 2 | 미연결 슬롯 추천 범위 (11.1) | 중간 | 높음 | 2시간 |
| 3 | 학습 범위 일별 분배 (11.2) | 중간 | 높음 | 3시간 |
| 4 | **Step 3 time_slots 연동 (17)** | 중간 | **매우 높음** | 3시간 |
| 5 | 복습일 콘텐츠별 배치 (11.3) | 중간 | 중간 | 2시간 |

**총 예상 시간**: 11시간

**핵심 우선순위**: Step 3에서 계산된 `time_slots`를 Step 4 가상 타임라인에 활용하는 것이 가장 중요. 이를 통해 Step 7 실제 플랜 결과와 미리보기 일치도 향상.
