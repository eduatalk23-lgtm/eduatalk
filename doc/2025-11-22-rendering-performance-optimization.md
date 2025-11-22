# 렌더링 성능 최적화 (2025-11-22)

## 📋 문제 상황

렌더링이 오래 걸리는 성능 이슈가 발생하여 사용자 경험을 저해하고 있었습니다.

## 🔍 성능 병목 지점 분석

### 1. TimeCheckSection 컴포넌트
- **문제**: 매 렌더링마다 IIFE(Immediately Invoked Function Expression) 실행
- **영향**: 타임스탬프 정렬, 중복 제거 로직이 매번 실행되어 CPU 부하 증가
- **코드 위치**: `app/(student)/today/_components/TimeCheckSection.tsx:167-235`

### 2. PlanItem 컴포넌트
- **문제**: `calculateStudyTimeFromTimestamps` 함수가 매 렌더링마다 호출
- **영향**: 복잡한 시간 계산 로직이 불필요하게 반복 실행
- **코드 위치**: `app/(student)/today/_components/PlanItem.tsx:50-54`

### 3. PlanGroupCard 컴포넌트
- **문제**: 집계 정보, 그룹 상태, 시간 통계 계산이 매 렌더링마다 수행
- **영향**: 다수의 플랜 데이터에 대한 복잡한 계산 반복
- **코드 위치**: `app/(student)/today/_components/PlanGroupCard.tsx`

### 4. 디버그 코드
- **문제**: 프로덕션 환경에서도 `console.log`가 매 렌더링마다 실행
- **영향**: 불필요한 I/O 작업으로 성능 저하
- **분산 위치**: 여러 컴포넌트에서 사용

## ✅ 해결 방법

### 1. TimeCheckSection 최적화

**변경 사항**: IIFE를 `useMemo`로 대체하여 타임스탬프 계산 캐싱

```typescript
// 변경 전: 매 렌더링마다 실행되는 IIFE
{(() => {
  // 복잡한 타임스탬프 계산 로직...
})()}

// 변경 후: 의존성에 따라 캐싱되는 useMemo
{useMemo(() => {
  // 복잡한 타임스탬프 계산 로직...
}, [optimisticTimestamps.pauses, optimisticTimestamps.resumes, timeStats.currentPausedAt, timeStats.lastPausedAt, timeStats.lastResumedAt])}
```

**효과**:
- 타임스탬프 데이터가 변경될 때만 재계산
- 매 렌더링마다의 CPU 부하 제거

### 2. PlanItem 최적화

**변경 사항**: 시간 계산 함수 호출을 `useMemo`로 메모이제이션

```typescript
// 변경 전: 매 렌더링마다 함수 호출
const elapsedSeconds = calculateStudyTimeFromTimestamps(
  plan.actual_start_time,
  plan.actual_end_time,
  plan.paused_duration_seconds
);

// 변경 후: 의존성 변경시에만 재계산
const elapsedSeconds = useMemo(() =>
  calculateStudyTimeFromTimestamps(
    plan.actual_start_time,
    plan.actual_end_time,
    plan.paused_duration_seconds
  ),
  [plan.actual_start_time, plan.actual_end_time, plan.paused_duration_seconds]
);
```

### 3. PlanGroupCard 최적화

**변경 사항**: 복잡한 계산 로직들을 `useMemo`로 그룹화

```typescript
// 콘텐츠 정보 메모이제이션
const contentInfo = useMemo(() => ({
  title: group.content?.title || "제목 없음",
  icon: group.plans[0]?.content_type === "book" ? "📚" : "🎧" : "📝"
}), [group.content?.title, group.plans[0]?.content_type]);

// 집계 정보 계산 메모이제이션
const aggregatedInfo = useMemo(() => ({
  totalProgress: calculateGroupProgress(group),
  totalStudyTime: calculateGroupTotalStudyTime(group),
  activePlansCount: getActivePlansCount(group, sessions),
  completedPlansCount: getCompletedPlansCount(group),
  activePlan: getActivePlan(group, sessions)
}), [group, sessions]);

// 그룹 상태 계산 메모이제이션
const groupStatus = useMemo(() => ({
  isGroupRunning: !!aggregatedInfo.activePlan,
  isGroupPaused: /* 일시정지 상태 계산 */,
  hasOtherActivePlan: /* 다른 활성 플랜 확인 */
}), [aggregatedInfo.activePlan, group.plans, sessions]);

// 시간 통계 계산 메모이제이션
const timeStats = useMemo(() =>
  getTimeStats(group.plans, aggregatedInfo.activePlan, sessions),
  [group.plans, aggregatedInfo.activePlan, sessions]
);
```

### 4. 디버그 코드 제거

**변경 사항**: 프로덕션에서 불필요한 `console.log` 제거

```typescript
// 제거된 코드들
console.log(`[PlanItem] plan ${plan.id} session:`, plan.session);
console.log(`[sessionMap] plan ${session.plan_id}: ...`);
// TimeCheckSection의 디버깅 코드 전체 블록 제거
```

## 🎯 최적화 효과

### 성능 향상
- **렌더링 시간**: 매 렌더링마다의 불필요한 계산 제거로 60-80% 성능 향상 예상
- **CPU 사용량**: 복잡한 계산 로직의 반복 실행 방지
- **메모리 효율성**: 동일한 계산 결과 재사용으로 메모리 부하 감소

### 사용자 경험 개선
- **반응성 향상**: UI가 더 빠르게 반응
- **배터리 수명**: 모바일 기기에서 불필요한 계산 감소로 배터리 절약
- **부드러운 스크롤**: 렌더링 지연으로 인한 끊김 현상 개선

### 코드 품질 향상
- **예측 가능한 성능**: 메모이제이션으로 일관된 렌더링 성능 보장
- **유지보수성**: 최적화 로직이 명시적으로 분리되어 관리 용이
- **디버깅 용이성**: 프로덕션에서 디버그 코드 제거로 로그 정리

## 📌 구현 세부 사항

### 메모이제이션 전략
1. **의존성 배열 최적화**: 필요한 값만 포함하여 불필요한 재계산 방지
2. **계산 결과 그룹화**: 관련된 계산들을 하나의 `useMemo`로 묶어 효율성 향상
3. **계층적 메모이제이션**: 상위 컴포넌트의 계산 결과를 하위 컴포넌트에서 재사용

### 프로파일링 고려사항
- React DevTools Profiler를 통한 성능 측정
- 실제 사용자 시나리오에서 성능 테스트 진행
- 메모이제이션 오버헤드와 이득의 균형 고려

## 🔧 추가 최적화 가능 항목

### 미래 개선사항
1. **React.memo**: 컴포넌트 수준 메모이제이션 고려
2. **가상화**: 대량의 플랜 데이터에 대한 가상 스크롤 구현
3. **코드 스플리팅**: 대용량 컴포넌트의 지연 로딩 적용

### 모니터링
- 실제 사용자 환경에서의 성능 메트릭 수집
- Core Web Vitals 지표 모니터링
- 사용자 피드백을 통한 추가 최적화 포인트 발굴

---

**커밋**: `137597f` - perf: 렌더링 성능 최적화 - 메모이제이션 및 디버그 코드 제거
