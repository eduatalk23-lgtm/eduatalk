# 메트릭/통계 집계 정책

## 작성일: 2025-12-09

---

## 📋 개요

이 문서는 `student_plan` 데이터를 기반으로 하는 모든 메트릭/통계 집계에 대한 통일된 정책을 정의합니다.

---

## 🎯 핵심 정책

### 1. 플랜 완료 기준

| 기준 | 필드 | 조건 | 우선순위 |
|------|------|------|----------|
| 기본 | `actual_end_time` | NOT NULL | 1순위 |
| 대체 | `progress` | >= 100 | 2순위 |

**통일된 판별 함수:**

```typescript
import { isCompletedPlan } from "@/lib/utils/planUtils";

// 사용 예시
const completedPlans = plans.filter(plan => isCompletedPlan(plan));
```

**기존 방식과의 차이:**

| 파일 | 기존 방식 | 통일 후 방식 |
|------|----------|-------------|
| `todayProgress.ts` | `!!plan.actual_end_time` | `isCompletedPlan(plan)` |
| `getPlanCompletion.ts` | `completed_amount > 0` | `isCompletedPlan(plan)` |

---

### 2. 더미 콘텐츠 집계 정책

| 항목 | 비학습 항목 | 자율학습 항목 |
|------|-----------|-------------|
| Content ID | `00000000-0000-0000-0000-000000000000` | `00000000-0000-0000-0000-000000000001` |
| 예시 | 이동, 점심, 학원 고정 일정 | 지정휴일 자율학습 |

#### 집계 포함 여부

| 메트릭 | 더미 콘텐츠 포함 | 이유 |
|--------|-----------------|------|
| 전체 플랜 수 | ✅ 포함 | 타임라인 표시용 |
| 완료율 계산 | ❌ 제외 | 학습 성취도 측정 목적 |
| 학습 시간 집계 | ❌ 제외 | 실제 학습 시간만 |
| 타임라인 표시 | ✅ 포함 | 일정 시각화 목적 |

**판별 함수:**

```typescript
import { isDummyContent, filterLearningPlans } from "@/lib/utils/planUtils";

// 단일 플랜 확인
if (isDummyContent(plan.content_id)) {
  // 더미 콘텐츠 처리
}

// 학습 플랜만 필터링
const learningPlans = filterLearningPlans(allPlans);
```

---

## 📊 메트릭별 정의

### 3.1 오늘의 진행률 (todayProgress)

**위치:** `lib/metrics/todayProgress.ts`

| 메트릭 | 정의 | 더미 포함 |
|--------|------|----------|
| `planTotalCount` | 해당일 전체 학습 플랜 수 | ❌ 제외 |
| `planCompletedCount` | 완료된 학습 플랜 수 | ❌ 제외 |
| `todayStudyMinutes` | 실제 학습 시간 (분) | ❌ 제외 |
| `achievementScore` | 종합 성취도 점수 (0-100) | ❌ 제외 |

**완료 판별:**

```typescript
const planCompletedCount = learningPlans.filter(plan => 
  isCompletedPlan(plan)
).length;
```

---

### 3.2 주간 플랜 실행률 (getPlanCompletion)

**위치:** `lib/metrics/getPlanCompletion.ts`

| 메트릭 | 정의 | 더미 포함 |
|--------|------|----------|
| `totalPlans` | 주간 전체 학습 플랜 수 | ❌ 제외 |
| `completedPlans` | 완료된 학습 플랜 수 | ❌ 제외 |
| `completionRate` | 완료율 (0-100) | ❌ 제외 |

---

## ⚠️ 마이그레이션 주의사항

### 통계 변동 가능성

기존 메트릭과 비교했을 때 다음과 같은 차이가 발생할 수 있습니다:

| 상황 | 기존 | 신규 | 영향 |
|------|------|------|------|
| 더미 콘텐츠 포함 플랜 | 전체 수에 포함 | 전체 수에서 제외 | 완료율 상승 가능 |
| `progress=100` but `actual_end_time=null` | 미완료 | 완료 | 완료 수 증가 가능 |
| `actual_end_time` 설정 but `progress<100` | 완료 | 완료 | 동일 |

### 권장 검증 방법

```sql
-- 기존 방식 vs 신규 방식 비교 쿼리
SELECT 
  student_id,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE actual_end_time IS NOT NULL) as old_completed,
  COUNT(*) FILTER (
    WHERE actual_end_time IS NOT NULL 
    OR progress >= 100
  ) as new_completed,
  COUNT(*) FILTER (
    WHERE content_id NOT IN (
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001'
    )
  ) as learning_only
FROM student_plan
WHERE plan_date = CURRENT_DATE
GROUP BY student_id;
```

---

## 🔗 관련 파일

| 파일 | 용도 |
|------|------|
| `lib/constants/plan.ts` | 상수 정의 |
| `lib/utils/planUtils.ts` | 헬퍼 함수 |
| `lib/metrics/todayProgress.ts` | 오늘 진행률 |
| `lib/metrics/getPlanCompletion.ts` | 주간 실행률 |

---

## 📝 변경 기록

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-12-09 | v1.0 | 초안 작성 |

