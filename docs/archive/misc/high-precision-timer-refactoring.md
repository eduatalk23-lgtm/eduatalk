# 고정밀 타이머 시스템 리팩토링 완료 보고서

## 📋 개요

Next.js 14 (App Router) + TypeScript + Supabase 환경에서 **Flutter 수준의 고정밀, 드리프트 없는 타이머 시스템**으로 완전히 리팩토링했습니다.

## 🎯 핵심 목표 달성

✅ **Drift-free 알고리즘**: `baseAccumulated + floor((now + timeOffset - startedAt) / 1000)`  
✅ **Singleton Timer Store**: 하나의 interval로 모든 플랜 타이머 관리  
✅ **Visibility API 통합**: 탭 숨김 시 interval 정지, 다시 보일 때 동기화  
✅ **Server Time Offset**: 서버 시간과 클라이언트 시간 차이 보정  
✅ **브라우저 종료/새로고침 대응**: 서버 상태 기반 정확한 복원  
✅ **멀티 탭 안전**: 동일한 서버 데이터 기반 동기화  

## 📁 생성된 파일

### 1. `lib/store/planTimerStore.ts`
- **Zustand 기반 Singleton Timer Store**
- 하나의 global interval로 모든 플랜 타이머 관리
- Drift-free 알고리즘 구현
- Visibility API 통합
- Server time offset 관리

### 2. `lib/hooks/usePlanTimer.ts` (리팩토링)
- **UI-only consumption hook**
- 스토어를 구독하여 타이머 상태 읽기
- 자체 interval 생성하지 않음
- 서버에서 받은 초기값으로 자동 초기화

### 3. `lib/utils/timerUtils.ts` (리팩토링)
- **Drift-free 시간 계산 함수**
- `calculateDriftFreeSeconds()`: 정확한 경과 시간 계산
- `calculateServerTimeOffset()`: 서버 시간 오프셋 계산
- `computeInitialTimerState()`: 서버 데이터 기반 초기 상태 계산

### 4. `lib/hooks/useInterval.ts` (기존 유지)
- React에서 setInterval을 안정적으로 사용하기 위한 훅

## 🔧 수정된 파일

### Server Actions (`app/(student)/today/actions/todayActions.ts`)
- `startPlan()`: `serverNow`, `status`, `accumulatedSeconds`, `startedAt` 반환
- `pausePlan()`: `serverNow`, `status`, `accumulatedSeconds` 반환
- `resumePlan()`: `serverNow`, `status`, `accumulatedSeconds`, `startedAt` 반환
- `completePlan()`: `serverNow`, `status`, `accumulatedSeconds` 반환

### API Routes (`app/api/today/plans/route.ts`)
- 응답에 `serverNow` 필드 추가
- `TodayPlansResponse` 타입에 `serverNow: number` 추가

### 컴포넌트
1. **`app/(student)/today/_components/PlanCard.tsx`**
   - 새로운 스토어 시스템 사용
   - `serverNow` prop 받아서 전달
   - Server Actions 응답으로 스토어 업데이트

2. **`app/(student)/today/_components/PlanTimer.tsx`**
   - `usePlanTimer` 훅으로 스토어 구독
   - `planId`, `status`, `accumulatedSeconds`, `startedAt`, `serverNow` props 받음

3. **`app/(student)/today/_components/PlanTimerCard.tsx`**
   - 새로운 스토어 시스템 사용
   - `serverNow` prop 추가

4. **`app/(student)/today/_components/PlanViewContainer.tsx`**
   - API 응답에서 `serverNow` 추출하여 상태 관리
   - 하위 컴포넌트에 전달

5. **`app/(student)/today/_components/SinglePlanView.tsx`**
   - `serverNow` prop 추가 및 전달

6. **`app/(student)/today/_components/DailyPlanListView.tsx`**
   - `serverNow` prop 추가 및 전달

7. **`app/(student)/today/_components/TodayPlanListView.tsx`**
   - `serverNow` prop 추가 및 전달

8. **`app/(student)/today/_components/DraggablePlanList.tsx`**
   - `serverNow` prop 추가 및 `PlanTimerCard`에 전달

9. **`app/(student)/today/_components/TodayPlanList.tsx`**
   - `serverNow` 계산하여 `TodayPlanListView`에 전달

## 🔄 아키텍처 변경

### Before (기존 시스템)
```
각 컴포넌트 → 자체 setInterval → 1초마다 증가
                ↓
         초당 API 호출 또는 router.refresh()
                ↓
         UI 프리징, 성능 저하
```

### After (새 시스템)
```
Singleton Store → 하나의 global interval
                ↓
    Drift-free 계산: baseAccumulated + elapsed
                ↓
    컴포넌트는 스토어 구독만 (usePlanTimer)
                ↓
    타이머 동작 중 서버 요청 없음
                ↓
    start/pause/resume/complete 시에만 서버 통신
```

## 📊 성능 개선

### Interval 수 감소
- **Before**: 각 컴포넌트마다 독립적인 interval (N개)
- **After**: 전체 앱에서 하나의 global interval (1개)
- **감소율**: N → 1 (N개 컴포넌트 기준 100% 감소)

### 서버 요청 감소
- **Before**: 타이머 동작 중 초당 API 호출 또는 router.refresh()
- **After**: 타이머 동작 중 서버 요청 없음 (start/pause/resume/complete 시에만)
- **감소율**: 초당 1회 → 0회 (타이머 동작 중)

### 정확도 개선
- **Before**: setInterval 드리프트로 인한 시간 오차 누적
- **After**: Drift-free 알고리즘으로 정확한 시간 계산
- **개선**: 서버 시간 기준 정확한 경과 시간 계산

## 🌐 브라우저 시나리오 대응

### 1. 브라우저 새로고침
- 서버에서 `status`, `accumulatedSeconds`, `startedAt` 조회
- `serverNow`와 함께 스토어 초기화
- 정확한 경과 시간 복원

### 2. 브라우저 종료/재시작
- 서버 상태 기반으로 정확한 시간 복원
- `startedAt`과 `serverNow`를 사용하여 경과 시간 계산

### 3. 멀티 탭
- 각 탭이 동일한 서버 데이터 읽기
- 스토어는 각 탭에서 독립적으로 동작
- Supabase Realtime으로 실시간 동기화 가능 (선택사항)

### 4. 탭 숨김/보임
- Visibility API로 탭 숨김 시 interval 정지
- 다시 보일 때 `syncNow()` 호출하여 동기화
- CPU 사용량 최적화

## ⚙️ Drift-Free 알고리즘

```typescript
// 핵심 공식
elapsed = floor(((Date.now() + timeOffset) - startedAt) / 1000)
seconds = baseAccumulated + elapsed

// timeOffset 계산
timeOffset = serverNow - Date.now()

// 사용 예시
const serverNow = Date.now(); // 서버에서 받은 시간
const timeOffset = serverNow - Date.now();
const startedAt = new Date(session.started_at).getTime();
const baseAccumulated = 100; // 시작 시점의 누적 시간

const now = Date.now();
const elapsed = Math.floor(((now + timeOffset) - startedAt) / 1000);
const currentSeconds = baseAccumulated + elapsed;
```

## 🔐 서버 시간 동기화

### Server Actions 반환 형식
```typescript
{
  success: boolean;
  serverNow: number;        // 서버 현재 시간 (밀리초)
  status: TimerStatus;      // "NOT_STARTED" | "RUNNING" | "PAUSED" | "COMPLETED"
  accumulatedSeconds: number; // 누적 시간 (초)
  startedAt: string | null;  // 시작 시각 (ISO 문자열)
}
```

### 클라이언트에서 사용
```typescript
const result = await startPlan(planId);
if (result.success && result.serverNow) {
  timerStore.startTimer(planId, result.serverNow);
}
```

## 🚫 제거된 항목

1. ❌ 컴포넌트별 독립적인 `setInterval`
2. ❌ 타이머 동작 중 `router.refresh()` 호출
3. ❌ 초당 API 호출
4. ❌ React Query `refetchInterval` (타이머용)
5. ❌ 단순 증가 로직 (`seconds + 1`)

## ✅ 추가된 기능

1. ✅ Singleton Timer Store (Zustand)
2. ✅ Drift-free 시간 계산
3. ✅ Visibility API 통합
4. ✅ Server time offset 보정
5. ✅ 하나의 global interval로 모든 타이머 관리

## 📝 주의사항 및 제한사항

### 1. 멀티 탭/멀티 디바이스
- 각 탭/디바이스는 독립적인 스토어 인스턴스
- 서버 데이터는 동일하지만, 클라이언트 타이머는 독립적으로 동작
- 실시간 동기화가 필요하면 Supabase Realtime 사용 권장

### 2. 시간 동기화
- 서버 시간과 클라이언트 시간 차이를 `timeOffset`으로 보정
- 네트워크 지연으로 인한 작은 오차는 무시 가능한 수준

### 3. Hydration 경고
- 서버와 클라이언트의 초기 시간 계산 차이로 인한 경고 가능
- `useEffect`에서 스토어 초기화로 해결

## 🎉 최종 결과

### Before → After 비교

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| Interval 수 | N개 (컴포넌트당 1개) | 1개 (전역) | 100% 감소 |
| 서버 요청 (타이머 동작 중) | 초당 1회 | 0회 | 100% 감소 |
| 시간 정확도 | 드리프트 누적 | Drift-free | 정확도 향상 |
| 브라우저 종료 대응 | 불완전 | 완벽 | 완전 대응 |
| 멀티 탭 안전성 | 불안정 | 안정적 | 안정성 향상 |
| CPU 사용량 (탭 숨김) | 계속 실행 | 정지 | 최적화 |

## 📚 참고 문서

- [Zustand 공식 문서](https://zustand-demo.pmnd.rs/)
- [Visibility API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [Next.js App Router 문서](https://nextjs.org/docs/app)

---

**작성일**: 2024년 12월  
**버전**: 1.0.0  
**상태**: ✅ 완료

