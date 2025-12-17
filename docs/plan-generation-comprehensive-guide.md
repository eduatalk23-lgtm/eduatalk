# 플랜 생성 과정 종합 가이드

## 작성일: 2025-01-17

---

## 📋 목차

1. [개요](#개요)
2. [전체 흐름도](#전체-흐름도)
3. [UI 플로우 (Wizard Steps)](#ui-플로우-wizard-steps)
4. [서버 사이드 플랜 생성 알고리즘](#서버-사이드-플랜-생성-알고리즘)
5. [주요 알고리즘 상세](#주요-알고리즘-상세)
6. [스켈레톤 UI](#스켈레톤-ui)
7. [데이터 구조](#데이터-구조)
8. [에러 처리](#에러-처리)
9. [성능 최적화](#성능-최적화)

---

## 개요

플랜 생성은 학생의 학습 계획을 자동으로 생성하는 핵심 기능입니다. 다음 두 가지 주요 단계로 구성됩니다:

1. **플랜 그룹 생성**: 사용자가 위저드를 통해 설정 정보 입력
2. **플랜 생성**: 서버에서 스케줄러 알고리즘을 통해 실제 학습 플랜 생성

### 주요 구성 요소

- **Wizard UI**: Step 1~7의 다단계 입력 인터페이스
- **SchedulerEngine**: 1730 타임테이블 알고리즘 구현
- **PlanSplitter**: 강의 콘텐츠 Episode별 분할
- **TimeAssigner**: 시간 슬롯 배정 (Bin Packing 유사)

---

## 전체 흐름도

```mermaid
graph TB
    Start([사용자: 플랜 생성 시작]) --> Step1[Step 1: 기본 정보 입력]
    Step1 --> Step2[Step 2: 시간 설정]
    Step2 --> Step3[Step 3: 콘텐츠 선택]
    Step3 --> Step4[Step 4: 추천 콘텐츠]
    Step4 --> Step5[Step 5: 스케줄 미리보기]
    Step5 --> Step6[Step 6: 최종 검토]
    Step6 --> Submit{플랜 생성 버튼 클릭}
    
    Submit --> Validate[데이터 검증]
    Validate -->|검증 실패| Error[에러 표시]
    Error --> Step1
    
    Validate -->|검증 성공| CreateGroup[플랜 그룹 생성/업데이트]
    CreateGroup --> GeneratePlans[플랜 생성 서버 액션 호출]
    
    GeneratePlans --> LoadData[1. 데이터 조회]
    LoadData --> LoadGroup[플랜 그룹 및 관련 데이터]
    LoadData --> LoadBlocks[블록 세트 조회]
    LoadData --> LoadSchedule[스케줄 계산]
    
    LoadGroup --> ResolveContent[2. 콘텐츠 해석 및 복사]
    ResolveContent --> CopyBooks[Master Book → Student Book]
    ResolveContent --> CopyLectures[Master Lecture → Student Lecture]
    
    CopyBooks --> LoadDuration[3. 콘텐츠 소요시간 조회]
    CopyLectures --> LoadDuration
    LoadDuration --> LoadMetadata[4. 콘텐츠 메타데이터 조회]
    
    LoadMetadata --> Scheduler[5. 스케줄러 실행]
    Scheduler -->|1730_timetable| Engine1730[SchedulerEngine: 1730 알고리즘]
    Scheduler -->|default| DefaultScheduler[기본 스케줄러]
    
    Engine1730 --> Cycle[학습일/복습일 주기 계산]
    Cycle --> Allocate[콘텐츠 날짜 배정]
    Allocate --> Divide[학습 범위 분할]
    Divide --> TimeAssign[시간 슬롯 배정]
    
    DefaultScheduler --> SimpleDivide[단순 범위 분할]
    SimpleDivide --> SimpleTime[시간 배정]
    
    TimeAssign --> SplitEpisode[6. Episode별 분할]
    SimpleTime --> SplitEpisode
    SplitEpisode --> AssignTimes[7. 시간 재배정]
    AssignTimes --> DeleteOld[8. 기존 플랜 삭제]
    DeleteOld --> SavePlans[9. 플랜 저장]
    
    SavePlans --> Success([생성 완료])
    Success --> Step7[Step 7: 결과 확인]
    Step7 --> End([완료])
```

---

## UI 플로우 (Wizard Steps)

### Step 1: 기본 정보 입력

```mermaid
graph LR
    A[Step 1: 기본 정보] --> B[플랜 그룹명]
    A --> C[목적 선택]
    A --> D[스케줄러 타입]
    A --> E[블록 세트 선택]
    A --> F[요일 선택]
    
    B --> Validate1[실시간 검증]
    C --> Validate1
    D --> Validate1
    E --> Validate1
    F --> Validate1
    
    Validate1 -->|저장| Draft1[임시 저장]
    Validate1 -->|다음| Step2[Step 2 이동]
```

**주요 입력 항목:**
- 플랜 그룹명 (`name`)
- 목적 (`purpose`: "내신대비" | "모의고사(수능)")
- 스케줄러 타입 (`scheduler_type`: "1730_timetable")
- 블록 세트 ID (`block_set_id`)
- 요일 선택 (`weekdays`: number[])

**컴포넌트 위치:**
- `app/(student)/plan/new-group/_components/_features/basic-info/Step1BasicInfo.tsx`

---

### Step 2: 시간 설정

```mermaid
graph TB
    A[Step 2: 시간 설정] --> B[기간 설정]
    A --> C[제외일 관리]
    A --> D[학원 일정 관리]
    A --> E[스케줄 미리보기]
    
    B --> B1[시작일]
    B --> B2[종료일]
    
    C --> C1[휴가/개인사정/휴일지정]
    C --> C2[제외일 추가/삭제]
    
    D --> D1[요일별 학원 일정]
    D --> D2[이동시간 설정]
    
    E --> E1[스케줄 계산 API 호출]
    E1 --> E2[날짜별 타임라인 표시]
    E2 --> E3[학습일/복습일 구분]
    
    E2 --> Validate2[검증]
    Validate2 -->|저장| Draft2[임시 저장]
    Validate2 -->|다음| Step3[Step 3 이동]
```

**주요 입력 항목:**
- 기간 시작일 (`period_start`)
- 기간 종료일 (`period_end`)
- 제외일 목록 (`exclusions`)
- 학원 일정 목록 (`academy_schedules`)

**스케줄 계산 결과:**
- `dateTimeSlots`: 날짜별 시간 슬롯 (학습시간/점심시간/학원일정/이동시간)
- `dateMetadataMap`: 날짜별 메타데이터 (day_type, week_number)
- `dateAvailableTimeRanges`: 날짜별 사용 가능한 시간 범위

**컴포넌트 위치:**
- `app/(student)/plan/new-group/_components/_features/scheduling/Step2TimeSettings.tsx`
- `app/(student)/plan/new-group/_components/_features/scheduling/Step3SchedulePreview.tsx`

---

### Step 3: 콘텐츠 선택

```mermaid
graph TB
    A[Step 3: 콘텐츠 선택] --> B[탭 선택]
    B --> C[학생 콘텐츠]
    B --> D[추천 콘텐츠]
    B --> E[마스터 콘텐츠]
    
    C --> C1[학생 책 목록]
    C --> C2[학생 강의 목록]
    C --> C3[커스텀 콘텐츠]
    
    D --> D1[AI 추천 요청]
    D1 --> D2[추천 콘텐츠 목록]
    D2 --> D3[범위 편집]
    
    E --> E1[마스터 콘텐츠 검색]
    E1 --> E2[마스터 콘텐츠 선택]
    E2 --> E3[학생으로 복사]
    
    C1 --> Select[콘텐츠 선택]
    C2 --> Select
    C3 --> Select
    D3 --> Select
    E3 --> Select
    
    Select --> Range[학습 범위 설정]
    Range --> Validate3[검증]
    Validate3 -->|저장| Draft3[임시 저장]
    Validate3 -->|다음| Step4[Step 4 이동]
```

**주요 입력 항목:**
- 콘텐츠 목록 (`contents`)
  - `content_type`: "book" | "lecture" | "custom"
  - `content_id`: 콘텐츠 ID
  - `start_range`: 시작 범위 (페이지/회차)
  - `end_range`: 종료 범위 (페이지/회차)

**컴포넌트 위치:**
- `app/(student)/plan/new-group/_components/_features/content-selection/Step3ContentSelection.tsx`
- `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/`

---

### Step 4: 추천 콘텐츠 (선택)

**AI 기반 추천 시스템:**
- 학생의 성적 데이터 분석
- 취약 과목 기반 추천
- 학습 범위 자동 계산

---

### Step 5: 스케줄 미리보기

**Step 2에서 이미 표시되지만, Step 5에서 최종 확인**

---

### Step 6: 최종 검토

```mermaid
graph LR
    A[Step 6: 최종 검토] --> B[기본 정보 요약]
    A --> C[시간 설정 요약]
    A --> D[콘텐츠 요약]
    A --> E[과목 배정 요약]
    
    B --> Validate6[전체 검증]
    C --> Validate6
    D --> Validate6
    E --> Validate6
    
    Validate6 -->|저장만| SaveOnly[플랜 그룹만 저장]
    Validate6 -->|생성| Generate[플랜 생성 실행]
```

**컴포넌트 위치:**
- `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview.tsx`
- `app/(student)/plan/new-group/_components/_summary/`

---

### Step 7: 결과 확인

```mermaid
graph TB
    A[Step 7: 결과 확인] --> B[생성된 플랜 목록]
    B --> C[날짜별 플랜]
    C --> D[시간별 플랜]
    
    D --> E[플랜 상세 확인]
    E --> F[완료 버튼]
    F --> G[플랜 그룹 상세 페이지로 이동]
```

**컴포넌트 위치:**
- `app/(student)/plan/new-group/_components/_features/scheduling/Step7ScheduleResult.tsx`

---

## 서버 사이드 플랜 생성 알고리즘

### 메인 플랜 생성 함수

**파일 위치:**
- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

```mermaid
sequenceDiagram
    participant Client
    participant ServerAction
    participant DB
    participant Scheduler
    participant TimeAssigner
    
    Client->>ServerAction: generatePlansFromGroupRefactored(groupId)
    
    Note over ServerAction: 1. 데이터 조회 단계
    ServerAction->>DB: getPlanGroupWithDetailsByRole()
    DB-->>ServerAction: group, contents, exclusions, academySchedules
    
    ServerAction->>DB: getBlockSetForPlanGroup()
    DB-->>ServerAction: baseBlocks
    
    ServerAction->>ServerAction: calculateAvailableDates()
    Note over ServerAction: 스케줄 계산 (학습일/복습일 분류)
    
    Note over ServerAction: 2. 콘텐츠 해석 및 복사
    ServerAction->>DB: 학생 콘텐츠 존재 확인 (병렬)
    ServerAction->>DB: 마스터 콘텐츠 존재 확인 (병렬)
    ServerAction->>DB: copyMasterBookToStudent()
    ServerAction->>DB: copyMasterLectureToStudent()
    
    Note over ServerAction: 3. 콘텐츠 소요시간 조회
    ServerAction->>DB: loadContentDurations()
    DB-->>ServerAction: contentDurationMap
    
    Note over ServerAction: 4. 콘텐츠 메타데이터 조회
    ServerAction->>DB: loadContentMetadata()
    DB-->>ServerAction: contentMetadataMap
    
    Note over ServerAction: 5. 스케줄러 실행
    ServerAction->>Scheduler: generatePlansFromGroup()
    Scheduler->>Scheduler: calculateCycle() (학습일/복습일 주기)
    Scheduler->>Scheduler: allocateContentDates() (날짜 배정)
    Scheduler->>Scheduler: divideContentRange() (범위 분할)
    Scheduler->>Scheduler: generateStudyDayPlans() (학습일 플랜)
    Scheduler->>Scheduler: generateReviewDayPlans() (복습일 플랜)
    Scheduler-->>ServerAction: scheduledPlans[]
    
    Note over ServerAction: 6. Episode별 분할 (강의만)
    ServerAction->>ServerAction: splitPlanTimeInputByEpisodes()
    Note over ServerAction: 큰 범위(2~23) → 개별 episode(2~2, 3~3, ...)
    
    Note over ServerAction: 7. 시간 재배정
    ServerAction->>TimeAssigner: assignPlanTimes()
    TimeAssigner->>TimeAssigner: Bin Packing 알고리즘
    TimeAssigner-->>ServerAction: timeSegments[]
    
    Note over ServerAction: 8. 기존 플랜 삭제
    ServerAction->>DB: DELETE FROM student_plan WHERE plan_group_id = ?
    
    Note over ServerAction: 9. 플랜 저장
    ServerAction->>DB: INSERT INTO student_plan (배치 저장)
    DB-->>ServerAction: insertedData[]
    
    ServerAction->>DB: updatePlanGroupStatus('saved')
    ServerAction-->>Client: { count: N }
```

---

## 주요 알고리즘 상세

### 1. 학습일/복습일 주기 계산 알고리즘

**파일 위치:**
- `lib/plan/1730TimetableLogic.ts`

```typescript
function calculateStudyReviewCycle(
  periodStart: string,
  periodEnd: string,
  cycle: { study_days: number; review_days: number },
  exclusions: PlanExclusion[]
): CycleDayInfo[]
```

**알고리즘 흐름:**

```mermaid
graph TB
    Start([시작]) --> Init[초기화: cycleDayNumber = 0, cycleNumber = 1]
    Init --> Loop[날짜 범위 반복]
    Loop --> CheckExclusion{제외일인가?}
    CheckExclusion -->|Yes| Exclusion[day_type = 'exclusion'<br/>cycle_day_number = 0]
    CheckExclusion -->|No| Increment[cycleDayNumber++]
    Increment --> CheckBoundary{cycleDayNumber > cycleLength?}
    CheckBoundary -->|Yes| ResetCycle[cycleDayNumber = 1<br/>cycleNumber++]
    CheckBoundary -->|No| Classify
    ResetCycle --> Classify[학습일/복습일 구분]
    Classify --> IsStudy{cycleDayNumber <= study_days?}
    IsStudy -->|Yes| Study[day_type = 'study']
    IsStudy -->|No| Review[day_type = 'review']
    Study --> AddResult[결과 배열에 추가]
    Review --> AddResult
    Exclusion --> AddResult
    AddResult --> HasMore{더 많은 날짜?}
    HasMore -->|Yes| Loop
    HasMore -->|No| End([종료])
```

**예시:**
- `study_days = 6`, `review_days = 1`
- 주기 길이 = 7일
- 제외일은 주기에서 완전히 제외

```
2025-01-01 (월): 학습일 (cycle_day_number = 1)
2025-01-02 (화): 학습일 (cycle_day_number = 2)
2025-01-03 (수): 학습일 (cycle_day_number = 3)
2025-01-04 (목): 학습일 (cycle_day_number = 4)
2025-01-05 (금): 학습일 (cycle_day_number = 5)
2025-01-06 (토): 학습일 (cycle_day_number = 6)
2025-01-07 (일): 복습일 (cycle_day_number = 7)
2025-01-08 (월): 학습일 (cycle_day_number = 1, cycle_number = 2)
...
```

---

### 2. 콘텐츠 날짜 배정 알고리즘 (전략/취약 과목)

**파일 위치:**
- `lib/plan/1730TimetableLogic.ts`
- `lib/scheduler/SchedulerEngine.ts`

```mermaid
graph TB
    Start([콘텐츠 날짜 배정 시작]) --> GetCycle[학습일/복습일 주기 가져오기]
    GetCycle --> FilterStudy[학습일만 필터링]
    FilterStudy --> ForEach[각 콘텐츠에 대해 반복]
    
    ForEach --> GetAllocation[콘텐츠 배정 설정 가져오기]
    GetAllocation --> CheckType{과목 타입?}
    
    CheckType -->|전략과목| Strategy[전략과목 배정]
    CheckType -->|취약과목| Weakness[취약과목 배정]
    CheckType -->|기본| Default[기본 배정]
    
    Strategy --> WeeklyDays{weekly_days 지정?}
    WeeklyDays -->|Yes| StrategyWeekly[주당 N일 배정]
    WeeklyDays -->|No| StrategyAll[모든 학습일 배정]
    
    Weakness --> WeaknessAll[모든 학습일 배정<br/>취약도 순서 우선]
    
    StrategyWeekly --> Validate[배정 검증]
    StrategyAll --> Validate
    WeaknessAll --> Validate
    Default --> Validate
    
    Validate --> HasDates{배정 날짜 있음?}
    HasDates -->|Yes| Save[배정 결과 저장]
    HasDates -->|No| Fail[실패 원인 기록]
    
    Save --> Next{다음 콘텐츠?}
    Fail --> Next
    Next -->|Yes| ForEach
    Next -->|No| End([종료])
```

**전략과목 배정 예시:**
- `weekly_days = 2`: 주당 2일 배정
- 주차별로 균등 분배

```
주차 1:
  - 2025-01-01 (학습일 1)
  - 2025-01-03 (학습일 3)

주차 2:
  - 2025-01-08 (학습일 1)
  - 2025-01-10 (학습일 3)
...
```

---

### 3. 학습 범위 분할 알고리즘

**파일 위치:**
- `lib/plan/1730TimetableLogic.ts`

```mermaid
graph TB
    Start([범위 분할 시작]) --> GetDates[배정된 날짜 목록 가져오기]
    GetDates --> CalculateDaily[일일 배정량 계산]
    CalculateDaily --> TotalAmount[총 학습량 / 날짜 수]
    TotalAmount --> Distribute[날짜별로 분배]
    
    Distribute --> ForEachDate[각 날짜에 대해]
    ForEachDate --> CalculateRange[날짜별 범위 계산]
    CalculateRange --> StartRange[start = 이전 날짜까지의 누적량]
    StartRange --> EndRange[end = start + 일일 배정량]
    EndRange --> ValidateRange{범위 유효?}
    
    ValidateRange -->|Yes| SaveRange[범위 저장]
    ValidateRange -->|No| Adjust[범위 조정]
    Adjust --> SaveRange
    
    SaveRange --> NextDate{다음 날짜?}
    NextDate -->|Yes| ForEachDate
    NextDate -->|No| End([종료])
```

**예시:**
- 콘텐츠 범위: 1~100 페이지
- 배정 날짜: 5일

```
날짜 1: 1~20 (20페이지)
날짜 2: 21~40 (20페이지)
날짜 3: 41~60 (20페이지)
날짜 4: 61~80 (20페이지)
날짜 5: 81~100 (20페이지)
```

---

### 4. 시간 슬롯 배정 알고리즘 (Bin Packing 유사)

**파일 위치:**
- `lib/plan/assignPlanTimes.ts`
- `lib/scheduler/SchedulerEngine.ts`

```mermaid
graph TB
    Start([시간 배정 시작]) --> GetSlots[학습 시간 슬롯 가져오기]
    GetSlots --> SortPlans[플랜을 소요시간 내림차순 정렬]
    SortPlans --> ForEachPlan[각 플랜에 대해]
    
    ForEachPlan --> CalculateDuration[소요시간 계산]
    CalculateDuration --> CheckDurationInfo{콘텐츠 duration 정보 있음?}
    CheckDurationInfo -->|Yes| UseDuration[실제 duration 사용]
    CheckDurationInfo -->|No| DefaultDuration[기본 duration 계산]
    
    UseDuration --> FindSlot[적합한 슬롯 찾기]
    DefaultDuration --> FindSlot
    
    FindSlot --> CheckSlot{슬롯 여유 있음?}
    CheckSlot -->|Yes| AssignFull[전체 배정]
    CheckSlot -->|No| AssignPartial[부분 배정]
    
    AssignFull --> MarkComplete[플랜 완료 표시]
    AssignPartial --> MarkPartial[부분 배정 표시<br/>다음 슬롯에 계속]
    
    MarkComplete --> NextPlan{다음 플랜?}
    MarkPartial --> NextPlan
    NextPlan -->|Yes| ForEachPlan
    NextPlan -->|No| End([종료])
```

**Best Fit 알고리즘:**
1. 플랜을 소요시간 내림차순으로 정렬 (큰 것부터)
2. 각 플랜에 대해 가장 적합한 슬롯 찾기
3. 슬롯 여유가 부족하면 다음 슬롯으로 분할

**예시:**
```
시간 슬롯:
  - 09:00~12:00 (180분)
  - 14:00~18:00 (240분)

플랜:
  - 플랜 A: 120분 → 슬롯 1에 배정
  - 플랜 B: 90분 → 슬롯 1에 배정 (남은 60분)
  - 플랜 C: 100분 → 슬롯 1에 60분, 슬롯 2에 40분 (분할)
  - 플랜 D: 200분 → 슬롯 2에 배정
```

---

### 5. Episode별 분할 알고리즘 (강의 콘텐츠)

**파일 위치:**
- `lib/plan/planSplitter.ts`

```mermaid
graph TB
    Start([Episode 분할 시작]) --> CheckType{콘텐츠 타입?}
    CheckType -->|lecture| CheckEpisodes{Episode 정보 있음?}
    CheckType -->|book/custom| NoSplit[분할하지 않음]
    
    CheckEpisodes -->|Yes| CheckRange{범위가 1개 episode?}
    CheckEpisodes -->|No| NoSplit
    
    CheckRange -->|Yes| NoSplit
    CheckRange -->|No| Split[범위를 개별 episode로 분할]
    
    Split --> ForLoop[start부터 end까지 반복]
    ForLoop --> CreatePlan[각 episode별 플랜 생성]
    CreatePlan --> AddToList[분할된 플랜 목록에 추가]
    AddToList --> NextEpisode{다음 episode?}
    NextEpisode -->|Yes| ForLoop
    NextEpisode -->|No| Return[분할된 플랜 반환]
    
    NoSplit --> ReturnSingle[원본 플랜 1개 반환]
    ReturnSingle --> End([종료])
    Return --> End
```

**예시:**
```
입력 플랜:
  - planned_start_page_or_time: 2
  - planned_end_page_or_time: 5

분할 결과:
  - 플랜 1: 2~2
  - 플랜 2: 3~3
  - 플랜 3: 4~4
  - 플랜 4: 5~5
```

**중요 사항:**
- 복습일인 경우 Episode별 분할하지 않음 (범위형 유지)
- 이미 단일 episode인 경우 (start === end) 재분할하지 않음

---

## 스켈레톤 UI

### 로딩 상태 표시 컴포넌트

**파일 위치:**
- `components/ui/LoadingSkeleton.tsx`
- `components/atoms/Skeleton.tsx`

**주요 Variant:**

1. **Schedule Skeleton** (스케줄 미리보기)
```tsx
<LoadingSkeleton variant="schedule" />
```

2. **Tab Skeleton** (탭 로딩)
```tsx
<LoadingSkeleton variant="tab" />
```

3. **Card Skeleton** (카드 로딩)
```tsx
<LoadingSkeleton variant="card" />
```

### 플랜 생성 중 스켈레톤 UI

**파일 위치:**
- `app/(student)/plan/group/[id]/_components/ScheduleLoadingSkeleton.tsx`

```mermaid
graph TB
    A[플랜 생성 시작] --> B[스켈레톤 UI 표시]
    B --> C[헤더 스켈레톤]
    B --> D[통계 카드 스켈레톤]
    B --> E[플랜 목록 스켈레톤]
    
    C --> C1[제목: 48px width]
    C --> C2[설명: 300px width]
    
    D --> D1[5개의 통계 카드]
    D1 --> D2[라벨: 60px]
    D1 --> D3[값: 40px]
    D1 --> D4[설명: 20px]
    
    E --> E1[5개의 플랜 아이템]
    E1 --> E2[플랜 헤더: 100% height 48px]
    E1 --> E3[플랜 내용: 2개, 각 64px]
    
    E --> F[플랜 생성 완료]
    F --> G[실제 데이터 표시]
```

**컴포넌트 예시:**

```tsx
// SchedulePreviewPanel.tsx (로딩 상태)
if (loading) {
  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 스켈레톤 */}
      <div className="flex flex-col gap-1">
        <Skeleton variant="text" height={28} width="200px" />
        <Skeleton variant="text" height={16} width="300px" />
      </div>

      {/* 요약 통계 스켈레톤 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
            <Skeleton variant="rectangular" height={20} width="60px" />
            <Skeleton variant="text" height={32} width="40px" />
            <Skeleton variant="text" height={14} width="20px" />
          </div>
        ))}
      </div>

      {/* 주차별 스케줄 스켈레톤 */}
      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-6">
            <Skeleton variant="text" height={24} width="150px" />
            <div className="mt-4 flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} variant="rectangular" height={80} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 데이터 구조

### 플랜 그룹 (plan_groups)

```typescript
type PlanGroup = {
  id: string;
  tenant_id: string;
  student_id: string;
  name: string;
  purpose: "내신대비" | "모의고사(수능)" | null;
  scheduler_type: "1730_timetable" | "default";
  scheduler_options: SchedulerOptions;
  period_start: string;
  period_end: string;
  status: "draft" | "saved" | "active" | "completed";
  block_set_id: string | null;
  camp_template_id: string | null;
  camp_invitation_id: string | null;
};
```

### 플랜 콘텐츠 (plan_group_contents)

```typescript
type PlanContent = {
  id: string;
  plan_group_id: string;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  start_range: number;
  end_range: number;
  subject_type?: "strategy" | "weakness";
  weekly_days?: number;
};
```

### 학생 플랜 (student_plan)

```typescript
type StudentPlan = {
  id: string;
  plan_group_id: string;
  student_id: string;
  tenant_id: string;
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null; // HH:mm
  end_time: string | null; // HH:mm
  day_type: "학습일" | "복습일" | null;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  status: "pending" | "running" | "completed" | "skipped";
  sequence: number | null;
};
```

---

## 에러 처리

### 에러 타입

**파일 위치:**
- `lib/errors/planGroupErrors.ts`
- `lib/errors/planGenerationErrors.ts`

```mermaid
graph TB
    A[에러 발생] --> B{에러 타입}
    B -->|PlanGroupError| C[플랜 그룹 에러]
    B -->|AppError| D[일반 애플리케이션 에러]
    B -->|DB Error| E[데이터베이스 에러]
    
    C --> C1[플랜 그룹 생성 실패]
    C --> C2[플랜 생성 실패]
    C --> C3[권한 없음]
    
    D --> D1[검증 에러]
    D --> D2[비즈니스 로직 에러]
    
    E --> E1[참조 무결성 오류]
    E --> E2[중복 키 오류]
    E --> E3[제약 조건 위반]
    
    C1 --> Handle[에러 처리]
    C2 --> Handle
    C3 --> Handle
    D1 --> Handle
    D2 --> Handle
    E1 --> Handle
    E2 --> Handle
    E3 --> Handle
    
    Handle --> UserMessage[사용자 친화적 메시지]
    UserMessage --> Toast[토스트 알림]
    UserMessage --> ValidationError[검증 에러 표시]
```

### 실패 원인 (Failure Reasons)

```typescript
type PlanGenerationFailureReason = {
  type: 
    | "no_study_days"
    | "content_allocation_failed"
    | "time_allocation_failed"
    | "no_plans_generated";
  contentId?: string;
  contentType?: string;
  reason: string;
  // ... 기타 필드
};
```

**에러 처리 예시:**

```typescript
// generatePlansRefactored.ts
try {
  scheduledPlans = await generatePlansFromGroup(...);
} catch (error) {
  if (error instanceof PlanGroupError) {
    const userMessage = error.userMessage || error.message;
    throw new AppError(
      userMessage,
      ErrorCode.BUSINESS_LOGIC_ERROR,
      400,
      true,
      {
        originalError: error.message,
        failureReason: error.failureReason,
        code: error.code,
      }
    );
  }
  throw error;
}
```

---

## 성능 최적화

### 1. 배치 쿼리

```typescript
// 병렬 쿼리 실행
const [existingBooksResult, existingLecturesResult] = await Promise.all([
  bookContents.length > 0
    ? queryClient.from("books").select("id, master_content_id")
        .in("master_content_id", bookContents.map(c => c.content_id))
        .eq("student_id", studentId)
    : Promise.resolve({ data: [] }),
  lectureContents.length > 0
    ? queryClient.from("lectures").select("id, master_content_id")
        .in("master_content_id", lectureContents.map(c => c.content_id))
        .eq("student_id", studentId)
    : Promise.resolve({ data: [] }),
]);
```

### 2. Episode Map 캐싱

```typescript
// SchedulerEngine.ts
const episodeMapCache = new Map<string, Map<number, number>>();

// Episode 정보 재사용
let episodeMap = episodeMapCache.get(content.content_id);
if (!episodeMap) {
  episodeMap = new Map();
  durationInfo.episodes.forEach(ep => {
    episodeMap.set(ep.episode_number, ep.duration || DEFAULT_EPISODE_DURATION);
  });
  episodeMapCache.set(content.content_id, episodeMap);
}
```

### 3. 배치 삽입

```typescript
// 플랜 일괄 저장
const { error: insertError, data: insertedData } = await supabase
  .from("student_plan")
  .insert(planPayloads) // 배열로 일괄 삽입
  .select();
```

### 4. 불필요한 재계산 방지

```typescript
// SchedulerEngine 클래스 내부 캐싱
private cycleDays: CycleDayInfo[] | null = null;
private contentAllocationMap: Map<string, string[]> | null = null;

public calculateCycle(): CycleDayInfo[] {
  if (this.cycleDays) return this.cycleDays; // 캐시된 값 반환
  // ... 계산 로직
  this.cycleDays = result;
  return result;
}
```

---

## MVP 이해 체크리스트

### 핵심 개념 이해

- [ ] **플랜 그룹**: 여러 플랜을 묶는 상위 개념
- [ ] **플랜**: 개별 학습 계획 (날짜, 시간, 콘텐츠 범위 포함)
- [ ] **스케줄러**: 플랜을 생성하는 알고리즘 엔진
- [ ] **블록**: 시간대 단위 (예: 09:00~12:00)
- [ ] **학습일/복습일**: 1730 타임테이블의 주기 개념

### 주요 알고리즘 이해

- [ ] 학습일/복습일 주기 계산 로직
- [ ] 전략/취약 과목 배정 로직
- [ ] 학습 범위 분할 알고리즘
- [ ] 시간 슬롯 배정 (Bin Packing 유사)
- [ ] Episode별 분할 (강의 콘텐츠)

### 데이터 흐름 이해

- [ ] Wizard → Server Action → Scheduler → Database
- [ ] Master 콘텐츠 → Student 콘텐츠 복사 과정
- [ ] ScheduledPlan → StudentPlan 변환 과정

### UI 흐름 이해

- [ ] Step 1~7의 각 단계 역할
- [ ] 임시 저장 (Draft) 메커니즘
- [ ] 스켈레톤 UI 표시 시점

---

## 참고 문서

- `docs/refactoring/plan_flow_documentation.md`: 전체 플로우 문서
- `timetable/1730Timetable-PRD.md`: 1730 타임테이블 요구사항
- `lib/plan/1730TimetableLogic.ts`: 1730 알고리즘 구현
- `lib/scheduler/SchedulerEngine.ts`: 스케줄러 엔진 구현

---

**마지막 업데이트**: 2025-01-17
