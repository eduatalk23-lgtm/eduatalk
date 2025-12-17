# 플랜 생성 관련 기능 분석

## 작성일: 2025-01-17

---

## 📋 목차

1. [개요](#개요)
2. [추천 시스템 (Recommendations)](#추천-시스템-recommendations)
3. [리스크 분석 (Risk Analysis)](#리스크-분석-risk-analysis)
4. [재조정 기능 (Reschedule)](#재조정-기능-reschedule)
5. [과목 배정 (Subject Allocation)](#과목-배정-subject-allocation)
6. [코칭 기능 (Coaching)](#코칭-기능-coaching)
7. [기능별 통합 흐름도](#기능별-통합-흐름도)

---

## 개요

플랜 생성은 단순히 학습 일정을 생성하는 것이 아니라, 학생의 데이터를 분석하고 맞춤형 추천을 제공하며, 리스크를 평가하고, 필요시 재조정하는 종합적인 시스템입니다.

**주요 관련 기능:**
- 추천 시스템: 콘텐츠, 과목, 범위 추천
- 리스크 분석: 위험 점수 계산 및 취약 과목 분석
- 재조정 기능: 플랜 재배치 및 자동 제안
- 과목 배정: 전략/취약 과목별 배정 전략
- 코칭 기능: 주간 학습 코칭 메시지 생성

---

## 추천 시스템 (Recommendations)

### 1. 통합 추천 엔진

**파일 위치:**
- `lib/recommendations/engine.ts`

```mermaid
graph TB
    Start([추천 요청]) --> Parallel[병렬 추천 생성]
    Parallel --> Subject[과목 추천]
    Parallel --> Goal[목표 추천]
    Parallel --> StudyPlan[학습 계획 추천]
    Parallel --> Content[콘텐츠 추천]
    
    Subject --> Clean[중복 제거]
    Goal --> Clean
    StudyPlan --> Clean
    Content --> Clean
    
    Clean --> Combine[우선순위 정렬]
    Combine --> TopN[상위 N개 추천]
    TopN --> Return([추천 결과 반환])
```

**우선순위:**
1. 목표 추천 (goals)
2. 과목 추천 (subjects)
3. 학습 계획 추천 (studyPlan)
4. 콘텐츠 추천 (contents)

**주요 함수:**
```typescript
getRecommendations(supabase, studentId): Promise<Recommendations>
getTopRecommendations(recs, limit): string[]
```

---

### 2. 마스터 콘텐츠 추천

**파일 위치:**
- `lib/recommendations/masterContentRecommendation.ts`

**추천 로직:**

```mermaid
graph TB
    Start([마스터 콘텐츠 추천 시작]) --> GetData[데이터 조회]
    GetData --> WeakSubjects[취약 과목 조회]
    GetData --> RiskIndex[Risk Index 조회]
    GetData --> ScoreSummary[성적 요약 조회]
    
    WeakSubjects --> FilterRisk[위험도 30 이상 필터링]
    RiskIndex --> FilterRisk
    
    FilterRisk --> ForEachSubject[각 과목별 반복]
    ForEachSubject --> CalculateCount[추천 개수 계산]
    CalculateCount --> GetDifficulty[난이도 결정]
    
    GetDifficulty --> Search[마스터 콘텐츠 검색]
    Search --> SortRevision[최신 개정판 우선 정렬]
    SortRevision --> FilterDifficulty[난이도 필터링]
    FilterDifficulty --> AddRecommendation[추천 목록에 추가]
    
    AddRecommendation --> CheckRequired[필수 과목 확인]
    CheckRequired --> FillDefault[기본 추천 채우기]
    FillDefault --> Return([추천 결과 반환])
```

**추천 기준:**

1. **취약 과목 기반 추천**
   - Risk Score 30 이상 과목
   - 성적 수준에 따른 동적 개수 조정
   - 난이도 매칭

2. **필수 과목 보장**
   - 국어, 수학, 영어는 항상 포함
   - 요청된 과목도 필수로 처리

3. **성적 수준에 따른 추천 개수**
```typescript
function getRecommendationCount(riskScore: number, isWeak: boolean): {
  books: number;
  lectures: number;
}

// Risk Score 높을수록 더 많은 추천
// Risk 50-70: 책 1-2개, 강의 0-1개
// Risk 70+: 책 2-3개, 강의 1-2개
```

4. **난이도 매칭**
```typescript
function getRecommendedDifficultyLevel(
  schoolGrade: number | null,
  mockGrade: number | null
): "기초" | "기본" | "발전" | "심화" | null

// 등급에 따른 난이도 추천
// 7-9등급 → 기초
// 5-6등급 → 기본
// 3-4등급 → 발전
// 1-2등급 → 심화
```

**예시:**
```
취약 과목: 수학 (Risk Score: 75)
→ 추천 개수: 책 2개, 강의 1개
→ 난이도: 기본 (최근 내신 6등급)
→ 최신 개정판 우선 정렬
```

---

### 3. 학습 범위 추천

**파일 위치:**
- `lib/plan/rangeRecommendation.ts`

**추천 알고리즘:**

```mermaid
graph TB
    Start([범위 추천 시작]) --> Validate[스케줄 검증]
    Validate -->|검증 실패| Unavailable[불가능 이유 반환]
    Validate -->|검증 성공| Calculate[일일 학습량 계산]
    
    Calculate --> DailyHours[일일 평균 학습 시간 계산]
    DailyHours --> PerContent[콘텐츠당 일일 학습량 계산]
    PerContent --> ForEach[각 콘텐츠별 반복]
    
    ForEach --> CheckType{콘텐츠 타입?}
    CheckType -->|book| BookCalc[페이지 계산]
    CheckType -->|lecture| LectureCalc[회차 계산]
    
    BookCalc --> PagesPerDay[일일 페이지 수 계산]
    PagesPerDay --> TotalPages[총 추천 페이지 계산]
    TotalPages --> BookRange[범위 설정]
    
    LectureCalc --> EpisodesPerDay[일일 회차 수 계산]
    EpisodesPerDay --> TotalEpisodes[총 추천 회차 계산]
    TotalEpisodes --> LectureRange[범위 설정]
    
    BookRange --> Return([추천 범위 반환])
    LectureRange --> Return
```

**계산 공식:**

```typescript
// 일일 평균 학습 시간
avgDailyHours = total_study_hours / total_study_days

// 콘텐츠당 일일 학습 시간
hoursPerContentPerDay = avgDailyHours / totalContents

// 교재: 일일 페이지 수
dailyPages = hoursPerContentPerDay * pagesPerHour (기본값: 10페이지/시간)
recommendedEnd = Math.min(dailyPages * total_study_days, total_pages)

// 강의: 일일 회차 수
dailyEpisodes = hoursPerContentPerDay * episodesPerHour (기본값: 2회차/시간)
recommendedEnd = Math.min(dailyEpisodes * total_study_days, total_episodes)
```

**예시:**
```
스케줄:
  - 총 학습일: 30일
  - 총 학습 시간: 90시간
  - 콘텐츠 수: 5개

계산:
  - 일일 평균: 90 / 30 = 3시간
  - 콘텐츠당 일일: 3 / 5 = 0.6시간 (36분)
  - 교재: 36분 × 10페이지/시간 = 6페이지/일
  - 추천 범위: 1 ~ 180페이지 (6 × 30일)
```

---

### 4. 과목 추천

**파일 위치:**
- `lib/recommendations/subjectRecommendation.ts`

**추천 규칙:**

1. **Rule 1: 취약 과목 학습시간 비중 부족**
   - 취약 과목인데 학습시간 비중 < 15%
   - 추천: "최근 4주 동안 [과목] 학습시간이 전체의 [비율]%에 불과합니다."

2. **Rule 2: 성적 하락 과목**
   - 최근 2회 연속 등급 하락
   - 추천: "[과목]는 최근 2회 연속 등급이 하락했습니다."

3. **Rule 3: 취약 과목인데 목표 없음**
   - 취약 과목으로 설정되었지만 목표가 없음
   - 추천: "[과목]에 대한 목표를 설정해보세요."

---

### 5. 콘텐츠 추천

**파일 위치:**
- `lib/recommendations/contentRecommendation.ts`

**추천 규칙:**

1. **Rule 1: 50% 미만 진행 중인 콘텐츠**
   - 진행률 0% < progress < 50%
   - 추천: "[콘텐츠]은 [진행률]% 진행되었습니다. 이번주에 [목표]%까지 끌어올리는 것을 추천합니다."

2. **Rule 2: 최근 사용하지 않은 콘텐츠**
   - 최근 2주 동안 사용 기록 없음
   - 추천: "[콘텐츠]을 다시 학습해보세요."

3. **Rule 3: 목표와 연관된 콘텐츠**
   - 활성 목표와 과목이 일치하는 콘텐츠
   - 추천: "[목표] 달성을 위해 [콘텐츠] 학습을 추천합니다."

---

## 리스크 분석 (Risk Analysis)

### 1. 위험 점수 계산

**파일 위치:**
- `lib/risk/engine.ts`

**위험 점수 계산 로직:**

```mermaid
graph TB
    Start([위험 점수 계산 시작]) --> GetMetrics[주간 메트릭 조회]
    GetMetrics --> Check[각 지표별 체크]
    
    Check --> TimeCheck{학습시간 급감?}
    TimeCheck -->|Yes| AddTime[+25점 또는 +15점]
    TimeCheck -->|No| PlanCheck{플랜 실행률 저조?}
    
    PlanCheck -->|Yes < 40%| AddPlanLow[+20점]
    PlanCheck -->|Yes < 60%| AddPlanMedium[+10점]
    PlanCheck -->|No| GoalCheck{목표 진행률 저조?}
    
    GoalCheck -->|Yes| AddGoal[+20점 또는 +15점]
    GoalCheck -->|No| ScoreCheck{성적 하락?}
    
    ScoreCheck -->|Yes| AddScore[+20점 또는 +15점]
    ScoreCheck -->|No| WeakCheck{취약 과목 학습 부족?}
    
    WeakCheck -->|Yes < 10%| AddWeak[+10점]
    WeakCheck -->|No| HistoryCheck{히스토리 패턴 위험?}
    
    HistoryCheck -->|연속 실패 5회| AddHistory1[+20점]
    HistoryCheck -->|연속 무학습 3일| AddHistory2[+15점]
    HistoryCheck -->|No| Clamp[최대 100점으로 제한]
    
    AddTime --> Clamp
    AddPlanLow --> Clamp
    AddPlanMedium --> Clamp
    AddGoal --> Clamp
    AddScore --> Clamp
    AddWeak --> Clamp
    AddHistory1 --> Clamp
    AddHistory2 --> Clamp
    
    Clamp --> Level[위험 수준 결정]
    Level --> Low{≤ 30?}
    Low -->|Yes| LowLevel[low]
    Low -->|No| Medium{≤ 60?}
    Medium -->|Yes| MediumLevel[medium]
    Medium -->|No| HighLevel[high]
    
    LowLevel --> Return([결과 반환])
    MediumLevel --> Return
    HighLevel --> Return
```

**위험 지표 (Risk Indicators):**

1. **학습시간 급감** (+25 또는 +15점)
   - 이번주 학습시간이 지난주 대비 50% 미만: +25점
   - 70% 미만: +15점

2. **이번주 학습시간 부족** (+20 또는 +10점)
   - 5시간 미만: +20점
   - 10시간 미만: +10점

3. **플랜 실행률 저조** (+20 또는 +10점)
   - 실행률 < 40%: +20점
   - 실행률 < 60%: +10점

4. **목표 진행률 저조** (+20 또는 +15점)
   - 목표 2개 이상 곧 마감 + 진행률 저조: +20점
   - 목표 1개 3일 이내 마감 + 진행률 50% 미만: +15점

5. **성적 하락** (+20 또는 +15점)
   - 최근 2회 연속 등급 하락: +20점
   - 7등급 이하 과목 존재: +15점

6. **취약 과목 학습 부족** (+10점)
   - 취약 과목 학습시간 비율 < 10%

7. **히스토리 기반 위험 신호** (+20 또는 +15점)
   - 플랜 미완료 5회 연속: +20점
   - 학습세션 없는 날 3일 연속: +15점

**위험 수준:**
- **Low**: 0-30점
- **Medium**: 31-60점
- **High**: 61-100점

---

### 2. 취약 과목 분석

**파일 위치:**
- `lib/metrics/getWeakSubjects.ts`

**분석 기준:**
- Risk Score >= 50인 과목을 취약 과목으로 간주
- `student_analysis` 테이블에서 조회

**반환 데이터:**
```typescript
type WeakSubjectMetrics = {
  weakSubjects: string[]; // 취약 과목 목록
  subjectStudyTime: Map<string, number>; // 과목별 학습시간 (분)
  totalStudyTime: number; // 전체 학습시간 (분)
  weakSubjectStudyTimeRatio: number; // 취약 과목 학습시간 비율 (%)
};
```

---

## 재조정 기능 (Reschedule)

### 1. 재조정 개요

**파일 위치:**
- `app/(student)/actions/plan-groups/reschedule.ts`
- `lib/reschedule/scheduleEngine.ts`

**재조정 타입:**

```mermaid
graph TB
    A[재조정 요청] --> B{조정 타입}
    B -->|range| C[범위 변경]
    B -->|replace| D[콘텐츠 교체]
    B -->|full| E[전체 재생성]
    
    C --> Apply[조정 적용]
    D --> Apply
    E --> Apply
    
    Apply --> Preview[미리보기 생성]
    Preview --> Confirm{확인?}
    Confirm -->|Yes| Execute[재조정 실행]
    Confirm -->|No| Cancel[취소]
    
    Execute --> Delete[기존 플랜 삭제]
    Delete --> Generate[새 플랜 생성]
    Generate --> Save[플랜 저장]
    Save --> History[히스토리 기록]
    History --> Complete([완료])
```

---

### 2. 자동 제안 (Auto Suggester)

**파일 위치:**
- `lib/reschedule/autoSuggester.ts`

**제안 타입:**

1. **기한 연장 (extend_deadline)**
   - 학습 지연이 발생한 경우
   - 지연 일수 × 1.2로 기한 연장 제안

2. **일일 학습량 증가 (increase_daily_load)**
   - 일일 학습 시간을 늘려서 기한 내 완료 제안

3. **콘텐츠 범위 축소 (reduce_content_range)**
   - 학습 범위를 줄여서 완료 가능성 높임

4. **콘텐츠 교체 (replace_content)**
   - 더 적합한 콘텐츠로 교체 제안

5. **플랜 재분배 (redistribute_plans)**
   - 학습량을 더 균등하게 재분배

**제안 우선순위:**
- Critical: 5점
- High: 4점
- Medium: 3점
- Low: 2점
- Info: 1점

---

### 3. 지연 감지 (Delay Detector)

**파일 위치:**
- `lib/reschedule/delayDetector.ts`

**지연 심각도:**
- **Critical**: 지연 일수 >= 7일
- **High**: 지연 일수 >= 3일
- **Medium**: 지연 일수 >= 1일
- **Low**: 지연 일수 < 1일

---

### 4. 충돌 감지 (Conflict Detector)

**파일 위치:**
- `lib/reschedule/conflictDetector.ts`

**충돌 타입:**
- 시간 겹침
- 콘텐츠 중복
- 블록 초과
- 날짜 범위 초과

---

### 5. 패턴 분석 (Pattern Analyzer)

**파일 위치:**
- `lib/reschedule/patternAnalyzer.ts`

**분석 항목:**
- 학습 패턴 (요일별, 시간대별)
- 완료율 패턴
- 지연 패턴
- 취소 패턴

---

## 과목 배정 (Subject Allocation)

### 1. 전략/취약 과목 배정

**파일 위치:**
- `lib/plan/1730TimetableLogic.ts`
- `lib/utils/subjectAllocation.ts`

**배정 우선순위:**

```mermaid
graph TB
    Start([과목 배정 시작]) --> GetContent[콘텐츠 정보 가져오기]
    GetContent --> Check1{콘텐츠별 설정 있음?}
    
    Check1 -->|Yes| UseContent[콘텐츠별 설정 사용]
    Check1 -->|No| Check2{교과별 설정 있음?}
    
    Check2 -->|Yes| MatchSubject[교과별 설정 매칭]
    MatchSubject --> Check3{subject_id 매칭?}
    Check3 -->|Yes| UseSubjectId[subject_id 사용]
    Check3 -->|No| Check4{subject_name 정확 일치?}
    
    Check4 -->|Yes| UseSubjectName[subject_name 사용]
    Check4 -->|No| Check5{부분 매칭?}
    
    Check5 -->|Yes| UsePartial[부분 매칭 사용]
    Check5 -->|No| Default[기본값: weakness]
    
    UseContent --> Allocate[날짜 배정]
    UseSubjectId --> Allocate
    UseSubjectName --> Allocate
    UsePartial --> Allocate
    Default --> Allocate
    
    Allocate --> Strategy{타입?}
    Strategy -->|strategy| WeeklyDays[주당 N일 배정]
    Strategy -->|weakness| AllDays[모든 학습일 배정]
    
    WeeklyDays --> Return([배정 결과 반환])
    AllDays --> Return
```

**매칭 우선순위:**
1. `content_allocations` (콘텐츠별 설정)
2. `subject_allocations` (교과별 설정)
   - `subject_id`로 매칭 (가장 정확)
   - `subject_name`과 `subject_category` 정확 일치
   - `subject_name`에 `subject_category` 포함 확인 (부분 매칭)
   - `subject` 필드도 매칭
3. 기본값: `weakness` (취약과목)

---

### 2. 날짜 배정 알고리즘

**전략과목 배정:**
```typescript
// 주당 배정 일수 (weekly_days: 2, 3, 4)
// 각 주차에서 균등하게 분배
const step = weekDates.length / selectedCount;
for (let i = 0; i < selectedCount; i++) {
  const index = Math.floor((i + 0.5) * step);
  allocatedDates.push(weekDates[index]);
}
```

**취약과목 배정:**
- 모든 학습일에 배정
- 취약도 순서 우선 (Risk Score 높은 순)

---

## 코칭 기능 (Coaching)

### 1. 주간 코칭 엔진

**파일 위치:**
- `lib/coaching/engine.ts`

**코칭 메시지 구조:**

```typescript
type WeeklyCoaching = {
  highlights: string[]; // 이번주 잘한 점
  warnings: string[]; // 주의할 점
  nextWeekGuide: string[]; // 다음주 가이드
  summary: string; // 1줄 요약
};
```

**생성 로직:**

```mermaid
graph TB
    Start([코칭 생성 시작]) --> GetMetrics[주간 메트릭 조회]
    GetMetrics --> Highlights[하이라이트 생성]
    GetMetrics --> Warnings[경고 생성]
    GetMetrics --> NextWeek[다음주 가이드 생성]
    
    Highlights --> Check1{학습량 증가?}
    Check1 -->|+20% 이상| Add1[학습량 증가 하이라이트]
    Check1 --> Check2{플랜 실행률 높음?}
    
    Check2 -->|≥ 70%| Add2[실행률 하이라이트]
    Check2 --> Check3{목표 달성?}
    
    Check3 -->|100%| Add3[목표 달성 하이라이트]
    Check3 --> Check4{연속성 좋음?}
    
    Check4 -->|≥ 80%| Add4[연속성 하이라이트]
    Check4 --> Check5{집중력 좋음?}
    
    Check5 -->|≥ 80%| Add5[집중력 하이라이트]
    Check5 --> HighlightsEnd[하이라이트 완료]
    
    Warnings --> Warn1{실행률 저조?}
    Warn1 -->| < 40%| AddW1[실행률 경고]
    Warn1 --> Warn2{학습시간 급감?}
    
    Warn2 -->| -20% 이상| AddW2[학습시간 경고]
    Warn2 --> Warn3{취약 과목 부족?}
    
    Warn3 -->|Yes| AddW3[취약 과목 경고]
    Warn3 --> Warn4{Risk Level 높음?}
    
    Warn4 -->|high| AddW4[위험 경고]
    Warn4 --> WarningsEnd[경고 완료]
    
    NextWeek --> Guide1{긴급 목표 있음?}
    Guide1 -->|Yes| AddG1[목표 우선 가이드]
    Guide1 --> Guide2{실행률 낮음?}
    
    Guide2 -->| < 50%| AddG2[플랜 수 줄이기 가이드]
    Guide2 --> Guide3{취약 과목 있음?}
    
    Guide3 -->|Yes| AddG3[취약 과목 학습 강화]
    Guide3 --> NextWeekEnd[가이드 완료]
    
    HighlightsEnd --> Summary[요약 생성]
    WarningsEnd --> Summary
    NextWeekEnd --> Summary
    
    Summary --> Return([코칭 결과 반환])
```

**하이라이트 규칙:**

1. 학습량 증가
   - 지난주 대비 +20% 이상: "학습량이 크게 늘었어요!"
   - +1% 이상: "학습량이 지난주보다 늘었어요!"

2. 플랜 실행률
   - ≥ 70%: "계획 실행력이 매우 좋습니다."
   - ≥ 60%: "계획 실행력이 양호합니다."

3. 목표 달성
   - 100%: "목표를 완주했어요!"
   - ≥ 80%: "목표 달성률이 높아요!"

4. 연속성 점수
   - ≥ 80%: "매일 꾸준히 학습하는 습관이 잘 형성되어 있어요!"
   - ≥ 60%: "학습 연속성이 좋아요!"

5. 집중 점수
   - ≥ 80%: "집중력이 뛰어나요!"
   - ≥ 60%: "집중해서 학습하는 모습이 보여요!"

**경고 규칙:**

1. 실행률 < 40%
2. 학습시간 급감 (-20% 이상)
3. 취약 과목 학습 부족
4. Risk Level이 high
5. 연속성 점수 < 40%
6. 집중 점수 < 40%
7. 목표 진행률 < 30%

**다음주 가이드:**

1. 긴급 목표 우선 처리
2. 플랜 실행률 낮음 → 플랜 수 줄이기
3. 취약 과목 학습 강화
4. 학습 시간 늘리기
5. 연속성 개선
6. 집중력 개선

---

## 기능별 통합 흐름도

```mermaid
graph TB
    Start([플랜 생성 시작]) --> Step1[Step 1: 기본 정보]
    Step1 --> Step2[Step 2: 시간 설정]
    Step2 --> Step3[Step 3: 콘텐츠 선택]
    
    Step3 --> Recommend{추천 사용?}
    Recommend -->|Yes| GetRecommendations[추천 시스템 호출]
    GetRecommendations --> MasterRec[마스터 콘텐츠 추천]
    GetRecommendations --> RangeRec[범위 추천]
    GetRecommendations --> SubjectRec[과목 추천]
    
    MasterRec --> RiskAnalysis[리스크 분석]
    RiskAnalysis --> WeakSubjects[취약 과목 분석]
    WeakSubjects --> SubjectAlloc[과목 배정 설정]
    
    RangeRec --> ContentSelect[콘텐츠 선택]
    SubjectRec --> SubjectAlloc
    
    Recommend -->|No| ContentSelect
    ContentSelect --> Step4[Step 4: 추천 콘텐츠]
    Step4 --> Step5[Step 5: 스케줄 미리보기]
    Step5 --> Step6[Step 6: 최종 검토]
    
    Step6 --> SubjectAlloc
    SubjectAlloc --> GeneratePlans[플랜 생성]
    
    GeneratePlans --> CheckRisk{Risk Level 확인}
    CheckRisk -->|High| Warning[경고 표시]
    CheckRisk -->|Medium/Low| SavePlans[플랜 저장]
    Warning --> SavePlans
    
    SavePlans --> Step7[Step 7: 결과 확인]
    
    Step7 --> Monitor[학습 모니터링]
    Monitor --> DelayDetect{지연 감지?}
    DelayDetect -->|Yes| AutoSuggest[자동 제안]
    AutoSuggest --> Reschedule[재조정 제안]
    
    DelayDetect -->|No| Coaching[코칭 메시지]
    Reschedule --> Coaching
    Coaching --> End([완료])
```

---

## 주요 데이터 흐름

### 추천 시스템 데이터 흐름

```mermaid
sequenceDiagram
    participant UI
    participant RecommendationEngine
    participant RiskEngine
    participant Database
    participant Scheduler
    
    UI->>RecommendationEngine: 추천 요청
    RecommendationEngine->>Database: 학생 데이터 조회
    RecommendationEngine->>RiskEngine: Risk Index 요청
    RiskEngine->>Database: 성적 데이터 조회
    RiskEngine-->>RecommendationEngine: Risk Index 반환
    
    RecommendationEngine->>Database: 취약 과목 조회
    RecommendationEngine->>Database: 마스터 콘텐츠 검색
    Database-->>RecommendationEngine: 추천 콘텐츠 목록
    RecommendationEngine->>RecommendationEngine: 난이도 매칭
    RecommendationEngine->>RecommendationEngine: 최신 개정판 정렬
    RecommendationEngine-->>UI: 추천 결과 반환
    
    UI->>Scheduler: 추천 콘텐츠 선택
    Scheduler->>Scheduler: 과목 배정 적용
    Scheduler-->>UI: 플랜 생성 완료
```

### 재조정 데이터 흐름

```mermaid
sequenceDiagram
    participant UI
    participant RescheduleAction
    participant DelayDetector
    participant AutoSuggester
    participant ScheduleEngine
    participant Scheduler
    participant Database
    
    UI->>RescheduleAction: 재조정 요청
    RescheduleAction->>Database: 기존 플랜 조회
    RescheduleAction->>DelayDetector: 지연 분석
    DelayDetector-->>RescheduleAction: 지연 분석 결과
    
    RescheduleAction->>AutoSuggester: 자동 제안 생성
    AutoSuggester-->>RescheduleAction: 제안 목록
    
    RescheduleAction->>ScheduleEngine: 조정 적용
    ScheduleEngine->>Scheduler: 새 플랜 생성
    Scheduler-->>ScheduleEngine: ScheduledPlan[]
    
    ScheduleEngine-->>RescheduleAction: 미리보기 결과
    RescheduleAction-->>UI: 미리보기 반환
    
    UI->>RescheduleAction: 재조정 실행 확인
    RescheduleAction->>Database: 트랜잭션 시작
    RescheduleAction->>Database: 기존 플랜 히스토리 백업
    RescheduleAction->>Database: 기존 플랜 삭제
    RescheduleAction->>Database: 새 플랜 저장
    RescheduleAction->>Database: 트랜잭션 커밋
    RescheduleAction-->>UI: 재조정 완료
```

---

## 기능별 연관성

### 추천 시스템 ↔ 리스크 분석

- 리스크 분석 결과를 바탕으로 추천 생성
- 취약 과목 (Risk Score >= 50) 기반 추천
- Risk Index를 활용한 추천 개수 및 난이도 결정

### 추천 시스템 ↔ 과목 배정

- 추천된 과목의 전략/취약 설정 자동 적용
- 취약 과목 추천 → weakness 배정
- 전략 과목 추천 → strategy 배정 (주당 N일)

### 리스크 분석 ↔ 코칭

- Risk Level에 따른 코칭 메시지 생성
- High Risk → 경고 메시지 강화
- Medium/Low Risk → 가이드 메시지 제공

### 재조정 ↔ 추천 시스템

- 재조정 시 추천 콘텐츠로 교체 제안
- 범위 축소 시 범위 추천 재계산

---

## 참고 문서

- `docs/plan-generation-comprehensive-guide.md`: 플랜 생성 과정 종합 가이드
- `lib/recommendations/`: 추천 시스템 구현
- `lib/risk/`: 리스크 분석 구현
- `lib/reschedule/`: 재조정 기능 구현
- `lib/coaching/`: 코칭 기능 구현
- `lib/utils/subjectAllocation.ts`: 과목 배정 유틸리티

---

**마지막 업데이트**: 2025-01-17
