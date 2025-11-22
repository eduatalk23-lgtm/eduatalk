# 전체 진행률 vs 오늘 성취도 설명

## 개요

`/today` 페이지에는 두 가지 다른 진행률/성취도 지표가 있습니다:
1. **전체 진행률** (PlanGroupCard 내부)
2. **오늘 성취도** (TodayAchievements 컴포넌트)

이 두 항목은 서로 다른 범위와 목적을 가지고 있습니다.

---

## 1. 전체 진행률 (PlanGroupCard)

### 위치
- 단일 뷰에서 특정 플랜 그룹의 진행률을 표시
- `PlanGroupCard` 컴포넌트 내부

### 범위
- **특정 플랜 그룹**에 한정된 진행률
- 같은 `plan_number`를 가진 플랜들의 집합 단위

### 계산 방식

```typescript
// app/(student)/today/_utils/planGroupUtils.ts
export function calculateGroupProgress(planGroup: PlanGroup): number {
  // 1. 모든 블록의 계획된 범위 합산
  const totalPages = planGroup.plans.reduce((sum, plan) => {
    const range =
      (plan.planned_end_page_or_time ?? 0) -
      (plan.planned_start_page_or_time ?? 0);
    return sum + range;
  }, 0);

  // 2. 모든 블록의 완료된 범위 합산
  const completedPages = planGroup.plans.reduce((sum, plan) => {
    return sum + (plan.completed_amount ?? 0);
  }, 0);

  // 3. 진행률 계산 (완료 / 계획 * 100)
  return totalPages > 0
    ? Math.round((completedPages / totalPages) * 100)
    : 0;
}
```

### 공식
```
전체 진행률 = (완료된 페이지/시간) / (계획된 페이지/시간) × 100
```

### 예시
- **계획**: p.50 ~ p.75 (25페이지)
- **완료**: 20페이지
- **진행률**: 20 / 25 × 100 = **80%**

### 표시 정보
- 진행률 퍼센트 (큰 숫자)
- 진행률 바 (시각적 표시)
- 총 학습 시간

### 특징
- ✅ **플랜 그룹 단위**: 하나의 논리적 플랜 그룹에 대한 진행률
- ✅ **범위 기반**: 계획된 범위 대비 완료된 범위
- ✅ **실시간 업데이트**: 플랜 완료 시 즉시 반영

---

## 2. 오늘 성취도 (TodayAchievements)

### 위치
- `/today` 페이지 하단
- `TodayAchievements` 컴포넌트

### 범위
- **오늘 하루 전체**의 성취도
- 모든 플랜, 모든 목표, 모든 학습 시간을 종합

### 계산 방식

```typescript
// lib/metrics/todayProgress.ts
export async function calculateTodayProgress(
  studentId: string,
  tenantId?: string | null
): Promise<TodayProgress> {
  // 1. 오늘의 모든 플랜 조회
  const plans = await getPlansForStudent({...});
  const planTotalCount = plans.length;
  const planCompletedCount = plans.filter(
    (plan) => plan.progress >= 100
  ).length;

  // 2. 오늘의 모든 세션 조회 및 학습 시간 계산
  const sessions = await getSessionsInRange({...});
  const todayStudyMinutes = sessions.reduce((total, session) => {
    return total + Math.floor(session.duration_seconds / 60);
  }, 0);

  // 3. 오늘 목표 진행률 조회
  const goals = await getGoalsForStudent({...});
  const goalProgressSummary = await Promise.all(...);

  // 4. Achievement Score 계산
  const executionRate = (planCompletedCount / planTotalCount) * 100;
  const goalCompletionRate = goalProgressSummary 평균;
  const focusTimerRate = (todayStudyMinutes / 예상시간) * 100;

  const achievementScore = Math.round(
    executionRate * 0.5 +      // 플랜 실행률 50%
    goalCompletionRate * 0.3 +  // 목표 달성률 30%
    focusTimerRate * 0.2        // 집중 타이머 20%
  );
}
```

### 공식

#### 플랜 완료율
```
플랜 완료율 = 완료한 플랜 수 / 전체 플랜 수 × 100
```

#### 학습 효율 점수 (Achievement Score)
```
학습 효율 점수 = 
  (플랜 실행률 × 0.5) + 
  (목표 달성률 × 0.3) + 
  (집중 타이머 비율 × 0.2)
```

### 표시 정보
1. **학습 시간**: 오늘 총 학습 시간 (시간/분)
2. **완료한 플랜**: 완료한 플랜 수 / 전체 플랜 수 (진행률 바 포함)
3. **학습 효율 점수**: 0-100점 (진행률 바 포함)

### 특징
- ✅ **하루 전체**: 오늘 하루의 모든 활동 종합
- ✅ **다차원 평가**: 플랜, 목표, 학습 시간을 종합
- ✅ **가중치 적용**: 플랜 실행률(50%) + 목표 달성률(30%) + 집중 타이머(20%)

---

## 비교표

| 항목 | 전체 진행률 | 오늘 성취도 |
|------|------------|------------|
| **범위** | 특정 플랜 그룹 | 오늘 하루 전체 |
| **위치** | 단일 뷰 (PlanGroupCard) | 페이지 하단 (TodayAchievements) |
| **계산 기준** | 범위 기반 (페이지/시간) | 플랜 수, 목표, 학습 시간 종합 |
| **업데이트** | 플랜 완료 시 즉시 | 페이지 로드 시 |
| **표시 형식** | 진행률 % + 진행률 바 | 학습 시간, 완료 플랜, 효율 점수 |
| **목적** | 특정 플랜의 진행 상황 파악 | 하루 전체의 성취도 평가 |

---

## 사용 시나리오

### 전체 진행률을 확인할 때
- 특정 플랜 그룹의 진행 상황을 빠르게 파악
- "이 플랜을 얼마나 완료했나?"
- 단일 뷰에서 현재 보고 있는 플랜 그룹의 진행률

### 오늘 성취도를 확인할 때
- 하루 전체의 학습 성과를 종합적으로 평가
- "오늘 하루 얼마나 잘했나?"
- 페이지 하단에서 오늘의 전체 성취도 확인

---

## 데이터 흐름

### 전체 진행률
```
PlanGroupCard
  └─> calculateGroupProgress(group)
      └─> group.plans의 planned_start/end와 completed_amount 비교
      └─> 진행률 % 반환
```

### 오늘 성취도
```
TodayPage
  └─> calculateTodayProgress(studentId, tenantId)
      ├─> getPlansForStudent() - 오늘의 모든 플랜
      ├─> getSessionsInRange() - 오늘의 모든 세션
      ├─> getGoalsForStudent() - 활성 목표
      └─> achievementScore 계산 (가중치 적용)
  └─> TodayAchievements 컴포넌트에 전달
```

---

## 개선 제안

### 전체 진행률
- 실시간 업데이트 개선 (WebSocket 또는 Polling)
- 블록별 세부 진행률 표시
- 예상 완료 시간 계산

### 오늘 성취도
- 시간대별 성취도 추이 그래프
- 주간/월간 성취도 비교
- 목표별 상세 분석
- 학습 패턴 분석 (집중 시간대, 효율적인 학습 시간 등)

