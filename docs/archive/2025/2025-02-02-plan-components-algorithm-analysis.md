# 플랜 관련 컴포넌트 및 알고리즘 종합 분석

> 작성일: 2025-02-02  
> 목적: 플랜 관련 컴포넌트 기능 분석 및 알고리즘 개선 방향 도출  
> 상태: 완료

---

## 📋 목차

1. [개요](#개요)
2. [컴포넌트 구조 분석](#컴포넌트-구조-분석)
3. [알고리즘 분석](#알고리즘-분석)
4. [성능 및 최적화 분석](#성능-및-최적화-분석)
5. [개선 사항](#개선-사항)
6. [알고리즘 개선 방향](#알고리즘-개선-방향)
7. [우선순위별 개선 로드맵](#우선순위별-개선-로드맵)

---

## 개요

### 분석 범위

플랜 시스템은 학습 계획 생성, 관리, 실행을 담당하는 핵심 도메인입니다. 이 문서는 다음 영역을 분석합니다:

1. **UI 컴포넌트**: 플랜 표시 및 조작 인터페이스
2. **생성 알고리즘**: 스케줄링 및 시간 배정 로직
3. **서비스 레이어**: 플랜 생성 오케스트레이션
4. **데이터 처리**: 콘텐츠 해석 및 변환

### 주요 파일 구조

```
lib/plan/
├── scheduler.ts                    # 메인 스케줄러 (973줄)
├── 1730TimetableLogic.ts          # 1730 타임테이블 로직 (815줄)
├── planSplitter.ts                 # 플랜 분할 유틸리티 (136줄)
├── slotRecommendationService.ts    # 슬롯 추천 서비스 (623줄)
├── rangeRecommendation.ts          # 범위 추천 로직 (175줄)
├── services/
│   ├── PlanGenerationOrchestrator.ts  # 오케스트레이터 (422줄)
│   ├── ScheduleGenerationService.ts   # 스케줄 생성 서비스 (193줄)
│   └── TimeAllocationService.ts       # 시간 할당 서비스 (229줄)
└── assignPlanTimes.ts              # 시간 배정 (500+줄)

components/plan/
├── MultiViewContainer.tsx          # 다중 뷰 컨테이너 (413줄)
├── MatrixView.tsx                  # 매트릭스 뷰
├── TimelineView.tsx                # 타임라인 뷰
├── TableView.tsx                   # 테이블 뷰
└── ListView.tsx                    # 리스트 뷰

app/(student)/plan/
├── _components/                    # 학생용 플랜 컴포넌트
├── new-group/                      # 플랜 그룹 생성 위저드
└── group/[id]/                     # 플랜 그룹 상세
```

---

## 컴포넌트 구조 분석

### 1. 뷰 컴포넌트 시스템

#### 1.1 MultiViewContainer

**위치**: `app/(student)/plan/_components/MultiViewContainer.tsx`

**역할**: 
- 다중 뷰 시스템의 통합 컨테이너
- 캘린더, 매트릭스, 타임라인, 테이블, 리스트 뷰 전환
- 플랜 데이터 변환 및 이벤트 처리

**주요 기능**:
```typescript
interface MultiViewContainerProps {
  plans: PlanData[];
  adHocPlans?: PlanData[];
  timeSlots?: MatrixTimeSlot[];
  onPlanClick?: (plan: PlanData) => void;
  onSimpleComplete?: (planId: string, planType: string) => void;
  onPlanMove?: (planId, planType, targetDate, ...) => Promise<...>;
  enableDragDrop?: boolean;
}
```

**특징**:
- ✅ 뷰 타입별 데이터 변환 함수 분리 (`toMatrixPlanItem`, `toTimelinePlanItem` 등)
- ✅ `useMemo`를 통한 성능 최적화
- ✅ ViewProvider를 통한 전역 뷰 상태 관리
- ⚠️ 기본 시간 슬롯 하드코딩 (개선 필요)

**개선 사항**:
1. 시간 슬롯을 props로 받거나 설정에서 가져오도록 변경
2. 플랜 데이터 변환 로직을 별도 유틸리티로 분리
3. 뷰별 렌더링 최적화 (가상 스크롤 등)

#### 1.2 뷰 컴포넌트들

| 컴포넌트 | 위치 | 역할 | 특징 |
|---------|------|------|------|
| **MatrixView** | `components/plan/MatrixView.tsx` | 시간×요일 격자 뷰 | Notion 스타일, 드래그앤드롭 지원 |
| **TimelineView** | `components/plan/TimelineView.tsx` | 시간순 리스트 | 날짜별 그룹화, 진행률 표시 |
| **TableView** | `components/plan/TableView.tsx` | 테이블 형식 | 정렬, 필터링 지원 |
| **ListView** | `components/plan/ListView.tsx` | 간단한 목록 | 그룹화 옵션, 컴팩트 모드 |

**공통 특징**:
- ✅ 간단 완료(Simple Complete) 기능 지원
- ✅ 플랜 클릭 이벤트 처리
- ✅ 상태별 스타일링 (pending, completed, in_progress 등)
- ⚠️ 대량 데이터 렌더링 시 성능 이슈 가능성

---

### 2. 플랜 생성 위저드

#### 2.1 PlanGroupWizard

**위치**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**역할**: 7단계 플랜 그룹 생성 위저드

**단계별 구성**:
1. **Step 1**: 기본 정보 (이름, 목적, 기간, 블록 세트)
2. **Step 2**: 시간 설정 (제외일, 학원 일정)
3. **Step 3**: 콘텐츠 선택
4. **Step 4**: 추천 콘텐츠
5. **Step 5**: 스케줄 미리보기
6. **Step 6**: 최종 검토
7. **Step 7**: 완료

**특징**:
- ✅ 단계별 검증 로직
- ✅ 자동 저장 기능
- ✅ 미리보기 모드 지원
- ⚠️ 복잡한 상태 관리 (개선 필요)

---

## 알고리즘 분석

### 1. 스케줄러 알고리즘

#### 1.1 1730 Timetable 알고리즘

**위치**: `lib/plan/1730TimetableLogic.ts`, `lib/plan/scheduler.ts`

**핵심 로직**:

```typescript
// 1. 학습일/복습일 주기 계산
calculateStudyReviewCycle(periodStart, periodEnd, cycle, exclusions)
  → CycleDayInfo[]

// 2. 전략/취약과목 배정 날짜 계산
calculateSubjectAllocationDates(cycleDays, allocation)
  → string[]

// 3. 학습 범위 분할
divideContentRange(totalRange, allocatedDates, contentId)
  → Map<date, {start, end}>

// 4. 소요시간 계산 (학생 수준, 과목 타입, 복습 여부 반영)
calculateDuration(range, durationInfo, studentLevel, subjectType, isReview)
  → DurationCalculationResult
```

**알고리즘 흐름**:

```
1. 기간 내 학습 가능한 날짜 계산 (제외일 제외)
   ↓
2. 학습일/복습일 주기 분류 (예: 6일 학습 + 1일 복습)
   ↓
3. 전략과목: 주당 N일 배정 (균등 분배)
   취약과목: 모든 학습일 배정
   ↓
4. 콘텐츠 범위를 배정된 날짜에 분배
   - even: 균등 분배
   - front_loaded: 앞쪽에 더 많이
   - back_loaded: 뒤쪽에 더 많이
   ↓
5. 복습일: 직전 주차 학습 범위 전체 복습 (0.4배 소요시간)
   ↓
6. 시간 슬롯 배정 (Bin Packing 유사)
```

**성능 특성**:
- 시간 복잡도: O(n × m) (n: 콘텐츠 수, m: 날짜 수)
- 공간 복잡도: O(n × m)
- 최적화 포인트:
  - 날짜별 그룹화로 중복 계산 감소
  - Map 자료구조 활용으로 조회 성능 향상

**개선 방향**:
1. **캐싱**: 동일 입력에 대한 결과 캐싱
2. **병렬 처리**: 콘텐츠별 배정을 병렬로 처리
3. **점진적 계산**: 날짜별로 순차 계산하여 메모리 사용량 감소

#### 1.2 기본 스케줄러

**위치**: `lib/plan/scheduler.ts` - `generateDefaultPlans()`

**특징**:
- 단순 범위 분할 (총량 / 학습일 수)
- 취약과목 우선 배정 (Risk Index 기반)
- 시간 슬롯 동적 생성

**알고리즘**:
```typescript
// 1. 콘텐츠별 일일 배정량 계산
dailyAmount = totalAmount / totalStudyDays

// 2. 취약과목 우선 정렬 (Risk Index 높은 순)
sortedContents = contents.sort((a, b) => bRisk - aRisk)

// 3. 날짜별로 콘텐츠 배정
dates.forEach(date => {
  sortedContents.forEach(content => {
    // 범위 계산 및 플랜 생성
  })
})
```

**한계점**:
- 복습일 로직 없음
- 주기 기반 배정 없음
- 단순 분배만 수행

---

### 2. 시간 할당 알고리즘

#### 2.1 TimeAllocationService

**위치**: `lib/plan/services/TimeAllocationService.ts`

**역할**: 스케줄된 플랜에 구체적인 시간 슬롯 할당

**알고리즘**:
```typescript
// 1. 날짜별로 플랜 그룹화
plansByDate = groupPlansByDate(scheduledPlans)

// 2. 각 날짜별로 시간 할당
for (date, plans) in plansByDate {
  timeRanges = dateTimeRanges.get(date)
  
  // 첫 번째 시간 슬롯 사용
  currentTime = timeRanges[0].start
  
  plans.forEach(plan => {
    duration = plan.estimated_duration
    planEndTime = currentTime + duration
    
    // 플랜 생성
    allocatedPlans.push({
      ...plan,
      start_time: currentTime,
      end_time: planEndTime
    })
    
    currentTime = planEndTime
  })
}
```

**특징**:
- ✅ 단순하고 직관적인 알고리즘
- ⚠️ 시간 슬롯 충돌 처리 미흡
- ⚠️ 최적화된 시간 배정 없음 (First-Fit 방식)

**개선 방향**:
1. **Bin Packing 알고리즘 적용**: 시간 슬롯을 효율적으로 채우기
2. **충돌 감지 및 해결**: 시간 겹침 자동 처리
3. **우선순위 기반 배정**: 중요도 높은 플랜에 우선 배정

#### 2.2 assignPlanTimes

**위치**: `lib/plan/assignPlanTimes.ts`

**역할**: Episode별 분할 후 시간 재배정

**특징**:
- 강의 콘텐츠를 Episode별로 분할
- 각 Episode의 실제 duration 반영
- 시간 슬롯에 맞춰 재배정

**알고리즘**:
```typescript
// 1. 강의 플랜을 Episode별로 분할
splitPlans = splitPlanByEpisodes(plan, contentDurationMap)

// 2. 각 Episode의 duration 조회
episodeDuration = durationInfo.episodes[episodeNumber].duration

// 3. 시간 슬롯에 배정
for (splitPlan in splitPlans) {
  // 사용 가능한 시간 슬롯 찾기
  slot = findAvailableSlot(date, episodeDuration)
  
  // 시간 배정
  assignedPlan = {
    ...splitPlan,
    start_time: slot.start,
    end_time: slot.start + episodeDuration
  }
}
```

---

### 3. 콘텐츠 해석 알고리즘

#### 3.1 ContentResolutionService

**위치**: `lib/plan/shared/ContentResolutionService.ts`

**역할**: 마스터 콘텐츠 → 학생 콘텐츠 복사 및 ID 매핑

**알고리즘**:
```typescript
// 1. 콘텐츠 타입별 처리
for (content in contents) {
  if (content.content_type === "book") {
    // Master Book → Student Book 복사
    studentBook = copyMasterBook(content.content_id)
    contentIdMap.set(originalId, studentBook.id)
  } else if (content.content_type === "lecture") {
    // Master Lecture → Student Lecture 복사
    studentLecture = copyMasterLecture(content.content_id)
    contentIdMap.set(originalId, studentLecture.id)
  }
}

// 2. Duration 정보 조회
for (contentId in contentIdMap.values()) {
  durationInfo = getContentDuration(contentId)
  contentDurationMap.set(contentId, durationInfo)
}
```

**특징**:
- ✅ Fallback 체인으로 안정성 확보
- ⚠️ 복잡한 조건 분기 (개선 필요)
- ⚠️ RLS 권한 문제 가능성

---

### 4. 추천 알고리즘

#### 4.1 슬롯 추천 서비스

**위치**: `lib/plan/slotRecommendationService.ts`

**역할**: 학생 프로필 기반 슬롯 구성 추천

**알고리즘**:
```typescript
// 1. 학년별 기본 교과 분배 가져오기
baseDistribution = GRADE_SUBJECT_DISTRIBUTION[gradeLevel]

// 2. 선호/약점 교과 반영
adjustedWeights = adjustWeightsForPreferences(
  baseDistribution,
  preferredSubjects,
  weakSubjects
)

// 3. 슬롯 수 분배
for (subject, weight) in adjustedWeights {
  slotCount = Math.round((weight / 100) * totalSlots)
  distribution.push({ subject, slotCount })
}

// 4. 슬롯 타입 결정 (플랜 목적 기반)
slotTypes = determineSlotTypes(slotCount, purposePreference)

// 5. 슬롯 생성
slots = generateSlotsFromDistribution(distribution, profile)
```

**특징**:
- ✅ 학년별, 목적별 프리셋 제공
- ✅ 선호/약점 교과 자동 반영
- ⚠️ 하드코딩된 가중치 (학습 데이터 기반 조정 필요)

**개선 방향**:
1. **학습 데이터 기반 가중치**: 실제 학습 결과를 반영한 동적 가중치
2. **A/B 테스트**: 다양한 추천 전략 비교
3. **개인화 강화**: 학생별 학습 패턴 분석

#### 4.2 범위 추천

**위치**: `lib/plan/rangeRecommendation.ts`

**역할**: 스케줄 정보 기반 학습 범위 추천

**알고리즘**:
```typescript
// 1. 일일 평균 학습 시간 계산
avgDailyHours = total_study_hours / total_study_days

// 2. 각 콘텐츠에 할당할 일일 학습량 계산
hoursPerContentPerDay = avgDailyHours / totalContents

// 3. 콘텐츠 타입별 범위 계산
if (content_type === "book") {
  dailyPages = hoursPerContentPerDay * pagesPerHour
  recommendedEnd = dailyPages * total_study_days
} else if (content_type === "lecture") {
  dailyEpisodes = hoursPerContentPerDay * episodesPerHour
  recommendedEnd = dailyEpisodes * total_study_days
}
```

**특징**:
- ✅ 단순하고 직관적인 계산
- ⚠️ 콘텐츠 난이도 미반영
- ⚠️ 학생 수준 미반영

**개선 방향**:
1. **난이도 보정**: 콘텐츠별 난이도 계수 적용
2. **학생 수준 반영**: 학생의 과거 학습 속도 기반 조정
3. **동적 조정**: 학습 진행 상황에 따른 범위 재조정

---

## 성능 및 최적화 분석

### 1. 현재 성능 추적 시스템

**위치**: `lib/plan/services/logging.ts`

**특징**:
- ✅ `PerformanceTracker` 클래스로 성능 메트릭 수집
- ✅ 느린 작업 자동 감지 (임계값: 1000ms)
- ✅ 서비스별 성능 추적

**사용 예시**:
```typescript
const trackingId = globalPerformanceTracker.start(
  "PlanGenerationOrchestrator",
  "generate",
  planGroupId
);

// ... 작업 수행 ...

globalPerformanceTracker.end(trackingId, true);
```

**개선 사항**:
1. **성능 대시보드**: 수집된 메트릭을 시각화
2. **알림 시스템**: 성능 저하 시 자동 알림
3. **벤치마크**: 주요 알고리즘의 성능 기준 설정

### 2. 메모리 사용량 분석

**주요 메모리 사용 지점**:
1. **날짜별 플랜 맵**: O(n × m) (n: 플랜 수, m: 날짜 수)
2. **콘텐츠 Duration 맵**: O(c) (c: 콘텐츠 수)
3. **스케줄 결과**: O(n × m)

**최적화 방안**:
1. **스트리밍 처리**: 대량 데이터를 청크 단위로 처리
2. **지연 로딩**: 필요한 데이터만 메모리에 로드
3. **캐싱 전략**: 자주 사용되는 데이터 캐싱

### 3. 알고리즘 복잡도 요약

| 알고리즘 | 시간 복잡도 | 공간 복잡도 | 최적화 여지 |
|---------|------------|------------|------------|
| 1730 Timetable | O(n × m) | O(n × m) | 병렬 처리, 캐싱 |
| 기본 스케줄러 | O(n × m) | O(n × m) | 정렬 최적화 |
| 시간 할당 | O(n) | O(n) | Bin Packing 적용 |
| 콘텐츠 해석 | O(c) | O(c) | 배치 처리 |
| 슬롯 추천 | O(s) | O(s) | 프리셋 캐싱 |
| 범위 추천 | O(c) | O(1) | 난이도 보정 |

*n: 플랜 수, m: 날짜 수, c: 콘텐츠 수, s: 슬롯 수*

---

## 개선 사항

### 1. 컴포넌트 개선

#### 1.1 MultiViewContainer

**문제점**:
- 기본 시간 슬롯 하드코딩
- 플랜 데이터 변환 로직 중복
- 대량 데이터 렌더링 시 성능 이슈

**개선 방안**:
```typescript
// 1. 시간 슬롯을 설정에서 가져오기
const timeSlots = useTimeSlots(studentId) || getDefaultTimeSlots();

// 2. 변환 로직을 별도 유틸리티로 분리
// lib/utils/planTransform.ts
export const planTransformers = {
  toMatrix: toMatrixPlanItem,
  toTimeline: toTimelinePlanItem,
  // ...
};

// 3. 가상 스크롤 적용
import { useVirtualizer } from '@tanstack/react-virtual';

function MatrixView({ plans, ... }) {
  const virtualizer = useVirtualizer({
    count: plans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });
  // ...
}
```

#### 1.2 뷰 컴포넌트 최적화

**개선 방안**:
1. **React.memo 적용**: 불필요한 리렌더링 방지
2. **가상 스크롤**: 대량 데이터 효율적 렌더링
3. **코드 스플리팅**: 뷰별 동적 import

### 2. 알고리즘 개선

#### 2.1 스케줄러 최적화

**현재 문제점**:
- 순차 처리로 인한 지연
- 동일 입력에 대한 중복 계산
- 메모리 사용량 과다

**개선 방안**:
```typescript
// 1. 병렬 처리
async function generate1730TimetablePlans(...) {
  const contentPromises = contents.map(content =>
    generatePlansForContent(content, cycleDays, ...)
  );
  
  const results = await Promise.all(contentPromises);
  return results.flat();
}

// 2. 결과 캐싱
const scheduleCache = new Map<string, ScheduledPlan[]>();

function getCachedSchedule(key: string) {
  if (scheduleCache.has(key)) {
    return scheduleCache.get(key);
  }
  
  const result = generateSchedule(...);
  scheduleCache.set(key, result);
  return result;
}

// 3. 점진적 계산
function generatePlansIncremental(dates: string[], contents: ContentInfo[]) {
  const plans: ScheduledPlan[] = [];
  
  for (const date of dates) {
    const datePlans = generatePlansForDate(date, contents);
    plans.push(...datePlans);
    
    // 메모리 정리
    if (plans.length > 1000) {
      yield plans;
      plans.length = 0;
    }
  }
  
  return plans;
}
```

#### 2.2 시간 할당 최적화

**현재 문제점**:
- First-Fit 방식으로 인한 비효율
- 시간 슬롯 충돌 처리 미흡

**개선 방안**:
```typescript
// Bin Packing 알고리즘 적용
function allocateTimeWithBinPacking(
  plans: ScheduledPlan[],
  timeSlots: TimeSlot[]
): AllocatedPlan[] {
  // 1. 플랜을 duration 내림차순 정렬 (Best-Fit Decreasing)
  const sortedPlans = [...plans].sort((a, b) => 
    b.estimated_duration - a.estimated_duration
  );
  
  // 2. 각 시간 슬롯을 Bin으로 관리
  const bins: Bin[] = timeSlots.map(slot => ({
    slot,
    used: 0,
    plans: []
  }));
  
  // 3. 각 플랜을 가장 적합한 Bin에 배정
  for (const plan of sortedPlans) {
    const bestBin = findBestFit(plan, bins);
    if (bestBin) {
      bestBin.plans.push(plan);
      bestBin.used += plan.estimated_duration;
    }
  }
  
  // 4. Bin별로 시간 배정
  return bins.flatMap(bin => 
    assignTimesToPlans(bin.plans, bin.slot)
  );
}

function findBestFit(plan: ScheduledPlan, bins: Bin[]): Bin | null {
  let bestBin: Bin | null = null;
  let minWaste = Infinity;
  
  for (const bin of bins) {
    const remaining = bin.slot.duration - bin.used;
    if (remaining >= plan.estimated_duration) {
      const waste = remaining - plan.estimated_duration;
      if (waste < minWaste) {
        minWaste = waste;
        bestBin = bin;
      }
    }
  }
  
  return bestBin;
}
```

### 3. 데이터 처리 개선

#### 3.1 콘텐츠 해석 최적화

**개선 방안**:
1. **배치 처리**: 여러 콘텐츠를 한 번에 처리
2. **트랜잭션 최적화**: DB 쿼리 최소화
3. **에러 복구**: 실패한 콘텐츠만 재시도

```typescript
// 배치 처리 예시
async function resolveContentsBatch(
  contents: PlanContent[],
  batchSize: number = 10
): Promise<Map<string, string>> {
  const contentIdMap = new Map<string, string>();
  
  for (let i = 0; i < contents.length; i += batchSize) {
    const batch = contents.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(content => resolveContent(content))
    );
    
    results.forEach((result, index) => {
      if (result.success) {
        contentIdMap.set(batch[index].content_id, result.studentContentId);
      }
    });
  }
  
  return contentIdMap;
}
```

---

## 알고리즘 개선 방향

### 1. 스케줄링 알고리즘 개선

#### 1.1 지능형 스케줄링

**목표**: 학생의 학습 패턴과 성과를 반영한 동적 스케줄링

**방안**:
1. **학습 속도 예측**: 과거 학습 데이터 기반 속도 예측
2. **난이도 조정**: 콘텐츠 난이도와 학생 수준 매칭
3. **피로도 고려**: 연속 학습일 피로도 누적 반영

```typescript
interface IntelligentSchedulerOptions {
  // 학습 속도 예측 모델
  learningSpeedModel: LearningSpeedModel;
  
  // 난이도 매칭
  difficultyMatching: {
    enabled: boolean;
    tolerance: number; // 허용 오차
  };
  
  // 피로도 관리
  fatigueManagement: {
    enabled: boolean;
    maxConsecutiveDays: number;
    restDayInterval: number;
  };
}

function generateIntelligentSchedule(
  contents: ContentInfo[],
  studentProfile: StudentProfile,
  options: IntelligentSchedulerOptions
): ScheduledPlan[] {
  // 1. 학습 속도 예측
  const predictedSpeed = options.learningSpeedModel.predict(
    studentProfile.historicalData
  );
  
  // 2. 난이도 기반 배정
  const difficultyAdjustedContents = adjustDifficulty(
    contents,
    studentProfile.level,
    options.difficultyMatching
  );
  
  // 3. 피로도 고려한 날짜 배정
  const fatigueAwareDates = calculateFatigueAwareDates(
    availableDates,
    options.fatigueManagement
  );
  
  // 4. 스케줄 생성
  return generateSchedule(
    difficultyAdjustedContents,
    fatigueAwareDates,
    predictedSpeed
  );
}
```

#### 1.2 적응형 스케줄링

**목표**: 학습 진행 상황에 따른 자동 조정

**방안**:
1. **진행률 모니터링**: 실시간 학습 진행률 추적
2. **자동 재조정**: 지연 시 자동으로 스케줄 조정
3. **예측 기반 최적화**: 미래 학습량 예측 및 사전 조정

```typescript
interface AdaptiveScheduler {
  // 진행률 모니터링
  monitorProgress(planId: string): ProgressStatus;
  
  // 자동 재조정
  autoReschedule(
    planGroupId: string,
    delayThreshold: number
  ): Promise<RescheduleResult>;
  
  // 예측 기반 최적화
  optimizeSchedule(
    planGroupId: string,
    predictionHorizon: number // 예측 기간 (일)
  ): Promise<OptimizationResult>;
}
```

### 2. 시간 할당 알고리즘 개선

#### 2.1 고급 Bin Packing

**목표**: 시간 슬롯을 최대한 효율적으로 활용

**알고리즘 선택**:
- **Best-Fit Decreasing (BFD)**: 현재 가장 널리 사용되는 방식
- **First-Fit Decreasing (FFD)**: 빠르지만 효율성 낮음
- **Genetic Algorithm**: 최적해 탐색 (계산 비용 높음)

**권장**: BFD 알고리즘 적용

```typescript
function allocateTimeWithBFD(
  plans: ScheduledPlan[],
  timeSlots: TimeSlot[]
): AllocatedPlan[] {
  // 1. 플랜을 duration 내림차순 정렬
  const sortedPlans = [...plans].sort((a, b) => 
    b.estimated_duration - a.estimated_duration
  );
  
  // 2. 각 시간 슬롯을 Bin으로 관리
  const bins = timeSlots.map(slot => new Bin(slot));
  
  // 3. Best-Fit Decreasing 배정
  for (const plan of sortedPlans) {
    const bestBin = findBestFitBin(plan, bins);
    if (bestBin) {
      bestBin.addPlan(plan);
    } else {
      // 슬롯이 부족한 경우 처리
      handleOverflow(plan, bins);
    }
  }
  
  // 4. 시간 배정
  return bins.flatMap(bin => bin.assignTimes());
}
```

#### 2.2 충돌 해결 알고리즘

**목표**: 시간 겹침 자동 감지 및 해결

```typescript
interface ConflictResolutionStrategy {
  // 전략 타입
  type: "split" | "delay" | "reschedule" | "skip";
  
  // 분할 전략
  split?: {
    maxSplits: number;
    minDuration: number; // 최소 분할 단위 (분)
  };
  
  // 지연 전략
  delay?: {
    maxDelay: number; // 최대 지연 시간 (분)
    priority: "fifo" | "priority" | "deadline";
  };
}

function resolveTimeConflicts(
  plans: AllocatedPlan[],
  strategy: ConflictResolutionStrategy
): AllocatedPlan[] {
  // 1. 충돌 감지
  const conflicts = detectConflicts(plans);
  
  // 2. 전략별 해결
  switch (strategy.type) {
    case "split":
      return resolveBySplitting(conflicts, strategy.split);
    case "delay":
      return resolveByDelaying(conflicts, strategy.delay);
    case "reschedule":
      return resolveByRescheduling(conflicts);
    case "skip":
      return resolveBySkipping(conflicts);
  }
}
```

### 3. 추천 알고리즘 개선

#### 3.1 머신러닝 기반 추천

**목표**: 학습 데이터 기반 개인화된 추천

**방안**:
1. **협업 필터링**: 유사 학생의 학습 패턴 활용
2. **콘텐츠 기반 필터링**: 콘텐츠 특성 기반 추천
3. **하이브리드**: 두 방식을 결합

```typescript
interface MLRecommendationEngine {
  // 협업 필터링
  collaborativeFiltering(
    studentId: string,
    similarStudents: string[]
  ): Recommendation[];
  
  // 콘텐츠 기반 필터링
  contentBasedFiltering(
    studentProfile: StudentProfile,
    availableContents: Content[]
  ): Recommendation[];
  
  // 하이브리드 추천
  hybridRecommendation(
    studentId: string,
    options: RecommendationOptions
  ): Recommendation[];
}

// 사용 예시
const engine = new MLRecommendationEngine();
const recommendations = await engine.hybridRecommendation(
  studentId,
  {
    maxRecommendations: 10,
    diversity: 0.5, // 다양성 가중치
    novelty: 0.3    // 신규성 가중치
  }
);
```

#### 3.2 실시간 피드백 반영

**목표**: 학습 진행 중 피드백을 즉시 반영

```typescript
interface RealTimeFeedbackSystem {
  // 학습 완료 시 피드백 수집
  collectFeedback(
    planId: string,
    feedback: {
      actualDuration: number;
      difficulty: number;
      satisfaction: number;
    }
  ): Promise<void>;
  
  // 추천 가중치 업데이트
  updateWeights(
    studentId: string,
    feedback: Feedback[]
  ): Promise<void>;
  
  // 다음 추천 생성
  generateNextRecommendation(
    studentId: string
  ): Promise<Recommendation>;
}
```

---

## 우선순위별 개선 로드맵

### Phase 1: 즉시 개선 (1-2주)

**목표**: 성능 및 안정성 향상

> **Phase 1 완료: 2025-01-05**

1. **컴포넌트 최적화**
   - [x] MultiViewContainer 시간 슬롯 설정화 ✅ (2025-01-05)
     - `lib/config/timeSlots.ts` 생성
     - 하드코딩 제거 및 import로 대체
   - [x] React.memo 적용 ✅ (2025-01-05)
     - `MatrixView`: DraggablePlanCard, DroppableCell, DragOverlayCard
     - `TimelineView`: TimelineItem
   - [ ] 가상 스크롤 도입 (필요 시 Phase 2로 연기)

2. **알고리즘 최적화**
   - [x] 스케줄러 결과 캐싱 ✅ (이미 구현됨)
     - `SchedulerEngine.ts`: Episode Map 캐싱 (라인 1010-1038)
     - `contentDuration.ts`: Duration 5분 TTL 캐싱 (라인 50-128)
   - [x] 병렬 처리 적용 ✅ (이미 구현됨)
     - `contentResolver.ts`: Promise.all로 병렬 쿼리 (라인 94-107)
   - [x] Bin Packing 알고리즘 적용 ✅
     - `SchedulerEngine.ts`: Best-Fit 유사 로직 (라인 1107-1195)
     - `TimeAllocationService.ts`: Best-Fit Decreasing 구현 (2025-01-05)

3. **에러 처리 강화**
   - [ ] 충돌 감지 및 해결
   - [ ] 에러 복구 로직
   - [ ] 사용자 친화적 에러 메시지

### Phase 2: 중기 개선 (1-2개월)

**목표**: 알고리즘 고도화

1. **지능형 스케줄링**
   - [ ] 학습 속도 예측 모델
   - [ ] 난이도 매칭 시스템
   - [ ] 피로도 관리

2. **추천 시스템 개선**
   - [ ] 학습 데이터 기반 가중치
   - [ ] A/B 테스트 프레임워크
   - [ ] 개인화 강화

3. **적응형 스케줄링**
   - [ ] 진행률 모니터링
   - [ ] 자동 재조정
   - [ ] 예측 기반 최적화

### Phase 3: 장기 개선 (3-6개월)

**목표**: AI/ML 기반 고도화

1. **머신러닝 통합**
   - [ ] 협업 필터링
   - [ ] 콘텐츠 기반 필터링
   - [ ] 하이브리드 추천

2. **실시간 피드백**
   - [ ] 피드백 수집 시스템
   - [ ] 가중치 동적 업데이트
   - [ ] 실시간 추천 생성

3. **성능 모니터링**
   - [ ] 성능 대시보드
   - [ ] 자동 알림 시스템
   - [ ] 벤치마크 설정

---

## 결론

### 주요 발견 사항

1. **컴포넌트 구조**: 잘 설계되었으나 최적화 여지 있음
2. **알고리즘**: 기본적인 로직은 안정적이나 고도화 필요
3. **성능**: 대부분 양호하나 대량 데이터 처리 시 개선 필요
4. **확장성**: 현재 구조는 확장 가능하나 리팩토링 권장

### 권장 사항

1. **즉시 적용**: 컴포넌트 최적화, 캐싱, Bin Packing
2. **단계적 개선**: 지능형 스케줄링, 추천 시스템 고도화
3. **장기 계획**: AI/ML 통합, 실시간 피드백 시스템

### 다음 단계

1. Phase 1 작업 시작 (즉시 개선 항목)
2. 성능 벤치마크 설정
3. A/B 테스트 프레임워크 구축
4. 사용자 피드백 수집 시스템 구축

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰  
**업데이트 주기**: 분기별

