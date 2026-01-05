# Phase 2: 적응형 스케줄링 서비스

> 구현 완료일: 2025-01-05
> 기준 문서: `docs/2025-02-02-plan-components-algorithm-analysis.md`

---

## 개요

Phase 2에서는 학생의 학습 패턴을 분석하여 플랜 스케줄링을 최적화하는 적응형 서비스들을 구현했습니다.

### 구현된 서비스

| 서비스 | 파일 | 주요 기능 |
|--------|------|----------|
| 피로도 모델링 | `fatigueModelingService.ts` | 연속 학습일 기반 피로도 분석 및 휴식일 제안 |
| 학습 속도 예측 | `learningPacePredictor.ts` | EWMA 기반 과목별/시간대별 학습 속도 예측 |
| 동적 난이도 조정 | `dynamicDifficultyService.ts` | 진행 속도 기반 난이도 피드백 분석 |
| 학습 가중치 | `learningWeightService.ts` | 학습 이력 기반 추천 가중치 계산 |
| 지연 예측 | `delayPredictionService.ts` | 패턴 기반 플랜 지연 예측 |
| 만족도 수집 | `satisfactionService.ts` | 플랜 완료 후 만족도 평가 |
| 통합 스케줄러 | `adaptiveScheduler.ts` | 모든 서비스 통합 분석 |

---

## 1. 피로도 모델링 서비스

### 위치
`lib/domains/plan/services/fatigueModelingService.ts`

### 주요 함수

```typescript
// 피로도 점수 계산
calculateFatigueScore(input: FatigueAnalysisInput): Promise<FatigueResult<FatigueMetrics>>

// 휴식일 제안
suggestRestDays(metrics: FatigueMetrics, plannedDates: string[]): RestDaySuggestion[]

// 학습 강도 조정
adjustLearningIntensity(baseMinutes: number, metrics: FatigueMetrics): number

// 피로도 경고 생성
generateFatigueWarnings(metrics: FatigueMetrics): FatigueWarning[]
```

### 피로도 점수 계산 로직

| 요소 | 가중치 | 설명 |
|------|--------|------|
| 연속 학습일 | 30% | 7일 초과 시 페널티 |
| 일일 학습량 | 30% | 4시간 초과 시 경고 |
| 과부하 빈도 | 20% | 최근 과부하 발생 횟수 |
| 휴식일 부족 | 20% | 7일 중 휴식일 비율 |

### 강도 레벨

| 레벨 | 점수 범위 | 권장 조치 |
|------|----------|----------|
| low | 0-39 | 학습량 10% 증가 가능 |
| medium | 40-59 | 현행 유지, 주의 관찰 |
| high | 60-79 | 학습량 30% 감소 권장 |
| overload | 80-100 | 즉시 휴식, 학습량 50% 감소 |

---

## 2. 학습 속도 예측 서비스

### 위치
`lib/domains/plan/services/learningPacePredictor.ts`

### 주요 함수

```typescript
// 학습 속도 프로필 조회
getLearningVelocityProfile(studentId: string): Promise<LearningPaceResult<VelocityProfile>>

// 시간대별 효율성 분석
analyzeTimeOfDayEfficiency(studentId: string): Promise<LearningPaceResult<TimeEfficiencyProfile>>

// 예상 소요 시간 예측
predictEstimatedDuration(input: DurationPredictionInput): Promise<LearningPaceResult<DurationPrediction>>
```

### EWMA 예측 모델

```typescript
// 지수가중이동평균 (Exponential Weighted Moving Average)
EWMA = α × current + (1-α) × previous
// α = 0.3 (최근 데이터 30% 반영)
```

### 시간대별 효율성

| 시간대 | 기본 효율성 | 조정 요인 |
|--------|------------|----------|
| 아침 (6-9시) | 1.0 | 개인 선호도 반영 |
| 오전 (9-12시) | 1.1 | 집중력 피크 |
| 오후 (12-18시) | 0.9 | 점심 후 저하 |
| 저녁 (18-22시) | 1.0 | 개인 선호도 반영 |
| 야간 (22-6시) | 0.7 | 피로 누적 |

---

## 3. 동적 난이도 조정 서비스

### 위치
`lib/domains/plan/services/dynamicDifficultyService.ts`

### 주요 함수

```typescript
// 플랜 난이도 피드백 추론
inferPlanDifficultyFeedback(plan: PlanData): DifficultyFeedback

// 학생 난이도 프로필 조회
getStudentDifficultyProfile(input: DifficultyAnalysisInput): Promise<DifficultyResult<StudentDifficultyProfile>>

// 과목별 난이도 조정 권장
getSubjectDifficultyAdjustment(studentId: string, subjectType: string): Promise<DifficultyResult<AdjustmentResult>>
```

### 난이도 추론 규칙

| 조건 | 피드백 |
|------|--------|
| 시간비율 < 0.7 AND 진행률 >= 90% | too_easy |
| 시간비율 > 1.5 AND 진행률 < 70% | too_hard |
| 그 외 | appropriate |

### 권장 조정

| 피드백 | 조정값 | 의미 |
|--------|--------|------|
| too_easy | +1 | 난이도 한 단계 상향 |
| appropriate | 0 | 현행 유지 |
| too_hard | -1 | 난이도 한 단계 하향 |

---

## 4. 학습 가중치 서비스

### 위치
`lib/domains/plan/services/learningWeightService.ts`

### 주요 함수

```typescript
// 학습 가중치 계산
calculateLearningWeights(studentId: string, daysBack?: number): Promise<WeightServiceResult<LearningWeightResult>>

// 시간 슬롯 가중치 조회
getTimeSlotWeight(weights: LearningWeightResult, hour: number, dayOfWeek: string): number

// 과목 가중치 조회
getSubjectWeight(weights: LearningWeightResult, subjectType: string): number

// 슬롯 추천에 가중치 적용
applyLearningWeights(baseScore: number, weights: LearningWeightResult, options: WeightOptions): number
```

### 가중치 정규화

```typescript
// 가중치 범위: 0.5 ~ 1.5
normalizedWeight = Math.max(0.5, Math.min(1.5, value / average))
```

### 가중치 적용 예시

```typescript
// 기본 점수에 과목 및 시간 가중치 적용
const adjustedScore = applyLearningWeights(baseScore, weights, {
  hour: 14,
  dayOfWeek: "monday",
  subjectType: "수학"
});
// 결과: baseScore * timeSlotWeight * subjectWeight
```

---

## 5. 지연 예측 서비스

### 위치
`lib/domains/plan/services/delayPredictionService.ts`

### 주요 함수

```typescript
// 학생 패턴 분석
analyzeStudentPattern(studentId: string, daysBack?: number): Promise<DelayPredictionResult<StudentPatternAnalysis>>

// 플랜 지연 예측
predictPlanDelays(studentId: string, daysAhead?: number): Promise<DelayPredictionResult<DelayPrediction[]>>

// 고위험 플랜 조회
getHighRiskPlans(studentId: string, daysAhead?: number): Promise<DelayPredictionResult<DelayPrediction[]>>
```

### 리스크 점수 계산

| 요인 | 가중치 | 설명 |
|------|--------|------|
| 취약 요일 | 0.3 | 해당 요일 완료율 50% 미만 |
| 취약 과목 | 0.3 | 해당 과목 완료율 50% 미만 |
| 연속 미완료 | 0.4 | 3회 이상 연속 미완료 |
| 하락 추세 | 0.2 | 최근 완료율 하락 |
| 낮은 완료율 | 0.2 | 전체 완료율 50% 미만 |

### 리스크 레벨

| 레벨 | 점수 범위 | 예상 지연일 |
|------|----------|-----------|
| low | 0-0.19 | 0일 |
| medium | 0.2-0.69 | 1일 |
| high | 0.7-1.0 | 3일 |

---

## 6. 만족도 수집 서비스

### 위치
`lib/domains/satisfaction/satisfactionService.ts`

### DB 마이그레이션
`supabase/migrations/YYYYMMDD_create_plan_satisfaction_ratings.sql`

### 주요 함수

```typescript
// 만족도 평가 제출
submitSatisfactionRating(input: SatisfactionRatingInput): Promise<SatisfactionResult<SatisfactionRating>>

// 만족도 조회
getSatisfactionRating(planId: string): Promise<SatisfactionResult<SatisfactionRating | null>>

// 만족도 요약 조회
getSatisfactionSummary(studentId: string, daysBack?: number): Promise<SatisfactionResult<SatisfactionSummary>>
```

### 평가 항목

| 항목 | 타입 | 설명 |
|------|------|------|
| rating | 1-5 | 별점 평가 |
| tags | string[] | 선택 태그 (쉬움, 어려움, 재미있음 등) |
| feedback | string? | 자유 텍스트 피드백 |

### UI 컴포넌트
`app/(student)/today/_components/SatisfactionRating.tsx`

---

## 7. 통합 적응형 스케줄러

### 위치
`lib/domains/plan/services/adaptiveScheduler.ts`

### 주요 함수

```typescript
// 향상된 적응형 분석
generateEnhancedAdaptiveSchedule(
  studentId: string,
  options: EnhancedAdaptiveOptions
): Promise<EnhancedAdaptiveScheduleAnalysis>
```

### 통합 옵션

```typescript
interface EnhancedAdaptiveOptions {
  includeRestDaySuggestions?: boolean;  // 휴식일 제안 포함
  includeDifficultyAdjustments?: boolean;  // 난이도 조정 포함
  includeDelayPredictions?: boolean;  // 지연 예측 포함
  includeLearningWeights?: boolean;  // 학습 가중치 포함
  daysBack?: number;  // 분석 기간
  predictionDays?: number;  // 예측 기간
}
```

### 통합 결과

```typescript
interface EnhancedAdaptiveScheduleAnalysis {
  // 기본 분석
  studentId: string;
  recommendations: EnhancedRecommendation[];
  suggestedExclusionDates: string[];

  // Phase 2 확장
  fatigue?: {
    metrics: FatigueMetrics;
    suggestedRestDays: RestDaySuggestion[];
    intensityAdjustment: number;
    warnings: FatigueWarning[];
  };
  difficulty?: {
    profile: StudentDifficultyProfile;
    adjustments: SubjectAdjustment[];
  };
  delays?: {
    pattern: StudentPatternAnalysis;
    predictions: DelayPrediction[];
  };
  weights?: LearningWeightResult;
}
```

---

## 코칭 엔진 연동

### 새 메트릭 필드 (WeeklyMetricsData)

```typescript
// Phase 2 적응형 스케줄링 필드
fatigueScore: number;  // 피로도 점수 (0-100)
fatigueIntensity: "low" | "medium" | "high" | "overload";
satisfactionAverage: number;  // 평균 만족도 (1-5)
satisfactionTrend: "improving" | "stable" | "declining";
difficultyFeedback: "too_easy" | "appropriate" | "too_hard";
highRiskPlansCount: number;  // 고위험 플랜 수
learningEfficiency: number;  // 학습 효율성 (0-1)
```

### 코칭 규칙

#### Highlights (잘한 점)
- 피로도 낮음 (30점 이하): 건강한 학습 리듬 유지
- 만족도 높음 (4.0 이상): 학습 적합성 우수
- 효율성 높음 (0.8 이상): 시간 대비 성과 우수
- 난이도 적절: 학습 난이도 최적화

#### Warnings (주의점)
- 피로도 과부하: 즉시 휴식 필요
- 피로도 높음/중간: 학습량 조절 필요
- 만족도 하락: 학습 방식 점검 필요
- 난이도 부적절: 콘텐츠 조정 필요
- 고위험 플랜 다수: 일정 조정 필요
- 효율성 낮음: 환경 개선 필요

#### Next Week Guide (다음주 가이드)
- 피로도 기반 휴식일 계획
- 난이도 조정 권장
- 고위험 플랜 우선 처리
- 효율성/만족도 개선 팁

---

## 테스트

### 단위 테스트 (139개 통과)

| 파일 | 테스트 수 |
|------|----------|
| fatigueModelingService.test.ts | 18 |
| learningPacePredictor.test.ts | 21 |
| dynamicDifficultyService.test.ts | 26 |
| learningWeightService.test.ts | 30 |
| delayPredictionService.test.ts | 36 |
| satisfactionService.test.ts | 14 |
| coachingEngineIntegration.test.ts | 21 |

### 실행 명령

```bash
# 전체 서비스 테스트
pnpm vitest run __tests__/lib/domains/plan/services/

# 만족도 서비스 테스트
pnpm vitest run __tests__/lib/domains/satisfaction/

# 코칭 엔진 테스트
pnpm vitest run __tests__/lib/coaching/
```

---

## 향후 계획 (Phase 3)

- [ ] A/B 테스트 프레임워크 구현
- [ ] 적응형 설정 사용자 UI
- [ ] 가중치 캐싱 시스템
- [ ] 실시간 피로도 알림
