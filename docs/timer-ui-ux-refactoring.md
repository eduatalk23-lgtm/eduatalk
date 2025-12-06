# 타이머 UI/UX 리팩토링 문서

## 📋 개요

고정밀 타이머 시스템의 UI/UX를 개선하여 상태가 명확하게 보이고, 일관된 디자인 패턴을 적용했습니다.

## 🎯 목표

1. **상태 시각화**: RUNNING/PAUSED/COMPLETED/NOT_STARTED 상태가 한눈에 보이도록
2. **일관된 UI**: 모든 뷰에서 동일한 타이머 UI 패턴 사용
3. **직관적인 버튼**: 상태별 명확한 버튼 레이블과 동작
4. **반응형 디자인**: 모바일/태블릿/데스크톱 모두 지원

## 📦 생성된 파일

### 공통 컴포넌트

1. **`app/(student)/today/_components/timer/StatusBadge.tsx`**
   - 타이머 상태를 시각적으로 표시하는 배지 컴포넌트
   - 상태별 색상: NOT_STARTED (회색), RUNNING (파란색), PAUSED (노란색), COMPLETED (초록색)
   - 크기 옵션: sm, md, lg

2. **`app/(student)/today/_components/timer/TimerDisplay.tsx`**
   - 시간 표시와 상태 배지를 함께 보여주는 컴포넌트
   - compact 모드 지원 (카드 뷰용)
   - HH:MM:SS 형식으로 시간 표시

3. **`app/(student)/today/_components/timer/TimerControls.tsx`**
   - 상태별 버튼 레이아웃을 관리하는 컴포넌트
   - 로딩 상태 표시 (스피너)
   - 중복 클릭 방지 (disabled 처리)

### 유틸리티

4. **`lib/utils/timerUtils.ts`** (업데이트)
   - `formatSecondsToHHMMSS()` 함수 추가
   - HH:MM:SS 또는 MM:SS 형식으로 포맷팅

## 🔄 수정된 파일

### 주요 컴포넌트

1. **`app/(student)/today/_components/PlanTimer.tsx`**
   - 공통 컴포넌트(`TimerDisplay`, `TimerControls`) 사용
   - 상태 배지 표시 추가
   - 일관된 UI 패턴 적용

2. **`app/(student)/today/_components/PlanTimerCard.tsx`**
   - 공통 컴포넌트 사용으로 리팩토링
   - 상태 기반 버튼 표시
   - 로딩 상태 개선

## 🎨 UI/UX 개선 사항

### 1. 상태 배지 (StatusBadge)

각 타이머 상태를 색상으로 구분:

- **NOT_STARTED**: 회색 배지 "대기"
- **RUNNING**: 파란색 배지 "진행 중"
- **PAUSED**: 노란색 배지 "일시정지"
- **COMPLETED**: 초록색 배지 "완료"

### 2. 시간 표시 (TimerDisplay)

- 큰 폰트로 시간 표시 (compact 모드: text-lg, 전체 모드: text-2xl)
- 상태 배지와 함께 표시
- "학습 시간" 레이블 포함

### 3. 버튼 레이아웃 (TimerControls)

상태별 버튼 구성:

#### NOT_STARTED
- Primary: [시작하기] (파란색)

#### RUNNING
- Primary: [일시정지] (노란색)
- Secondary: [완료하기] (초록색)

#### PAUSED
- Primary: [재시작] (파란색)
- Secondary: [완료하기] (초록색)

#### COMPLETED
- 비활성화된 "완료됨" 배지 표시

### 4. 로딩 상태

- 각 버튼에 로딩 스피너 표시
- 로딩 중 다른 버튼 비활성화
- "처리 중..." 메시지 표시

### 5. 반응형 디자인

- **모바일**: 세로 스택 (시간 → 상태 → 버튼)
- **데스크톱**: 가로 배치 (시간/상태 왼쪽, 버튼 오른쪽)
- compact 모드: 카드 뷰용 작은 크기

## 🔧 기술적 세부사항

### 상태 관리

- `usePlanTimer` 훅을 통한 단일 소스
- `planTimerStore`에서 타이머 상태 구독
- 서버 상태와 클라이언트 상태 동기화

### 에러 처리

- Server Action 실패 시 alert 표시
- 로딩 상태 자동 해제
- 중복 액션 방지 (disabled 처리)

### 성능 최적화

- 공통 컴포넌트 재사용으로 코드 중복 제거
- 메모이제이션된 상태 계산
- 불필요한 리렌더링 방지

## 📱 사용 예시

### PlanTimer (전체 뷰)

```tsx
<PlanTimer
  planId={planId}
  timeStats={timeStats}
  status={status}
  accumulatedSeconds={accumulatedSeconds}
  startedAt={startedAt}
  serverNow={serverNow}
  isLoading={isLoading}
  pendingAction={pendingAction}
  onStart={handleStart}
  onPause={handlePause}
  onResume={handleResume}
  onComplete={handleComplete}
/>
```

### PlanTimerCard (컴팩트 뷰)

```tsx
<PlanTimerCard
  planId={planId}
  planTitle={title}
  status={status}
  accumulatedSeconds={accumulatedSeconds}
  startedAt={startedAt}
  serverNow={serverNow}
  // ... 기타 props
/>
```

## ✅ 체크리스트

- [x] 상태 배지 컴포넌트 생성
- [x] 시간 표시 컴포넌트 생성
- [x] 버튼 컨트롤 컴포넌트 생성
- [x] PlanTimer 리팩토링
- [x] PlanTimerCard 리팩토링
- [x] 시간 포맷팅 헬퍼 추가
- [x] 로딩 상태 처리
- [x] 에러 처리
- [x] 반응형 디자인

## 🚀 다음 단계

1. 다른 뷰 컴포넌트들도 공통 컴포넌트 사용하도록 업데이트
2. 토스트 알림으로 alert 대체 (향후 개선)
3. 애니메이션 추가 (선택사항)

## 📝 참고

- 핵심 타이머 로직(`planTimerStore`, `timerUtils`)은 변경하지 않음
- UI/UX 개선에만 집중
- 기존 기능은 모두 유지

