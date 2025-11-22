# 타이머 타임스탬프 기반 계산으로 개선

## 날짜
2025-01-13

## 작업 목적
타이머 기능을 개선하여 실시간 시간 업데이트 UI를 제거하고, 타임스탬프 기반으로 총 학습 시간을 계산하도록 변경했습니다.

## 주요 변경 사항

### 1. 타임스탬프 기반 시간 계산 함수 추가
- `calculateStudyTimeFromTimestamps`: 시작/종료 타임스탬프와 일시정지 시간으로 총 학습 시간 계산
- `calculateStudyTimeFromSession`: 세션 정보로 총 학습 시간 계산

### 2. 실시간 시간 업데이트 제거
다음 컴포넌트에서 `setInterval` 기반 실시간 업데이트 로직을 제거했습니다:
- `PlanTimerCard.tsx`: 실시간 경과 시간 계산 제거
- `TimestampDisplay.tsx`: 실시간 업데이트 표시 제거
- `PlanItem.tsx`: 실시간 경과 시간 계산 제거
- `TimeCheckSection.tsx`: 실시간 타이머 계산 제거

### 3. 타임스탬프 기반 계산으로 변경
모든 컴포넌트에서 타임스탬프 기반으로 시간을 계산하도록 변경:
- 시작 타임스탬프: `actual_start_time`
- 종료 타임스탬프: `actual_end_time`
- 일시정지 시간: `paused_duration_seconds`
- 총 학습 시간 = (종료 시간 또는 현재 시간) - 시작 시간 - 일시정지 시간

### 4. 시간 표시 통합
- `TimestampDisplay` 컴포넌트를 통일된 시간 표시 컴포넌트로 사용
- "실시간 업데이트" 텍스트 제거
- 일시정지 중일 때만 "(일시정지 중)" 표시

## 변경된 파일

### 유틸리티 함수
- `app/(student)/today/_utils/planGroupUtils.ts`
  - `calculateStudyTimeFromTimestamps` 함수 추가
  - `calculateStudyTimeFromSession` 함수 추가

### 컴포넌트
- `app/(student)/today/_components/PlanTimerCard.tsx`
  - 실시간 업데이트 로직 제거
  - 타임스탬프 기반 계산으로 변경
  
- `app/(student)/today/_components/TimestampDisplay.tsx`
  - 실시간 업데이트 표시 제거
  - 타임스탬프 기반 계산으로 변경
  
- `app/(student)/today/_components/PlanItem.tsx`
  - 실시간 업데이트 로직 제거
  - 타임스탬프 기반 계산으로 변경
  
- `app/(student)/today/_components/TimeCheckSection.tsx`
  - 실시간 타이머 계산 제거
  - 타임스탬프 기반 계산으로 변경

## 타임스탬프 저장 방식

타이머 액션 함수들은 이미 타임스탬프를 저장하고 있습니다:

1. **시작 클릭** → `actual_start_time` 저장 (플랜), `started_at` 저장 (세션)
2. **일시정지 클릭** → `paused_at` 저장 (세션), `pause_count` 증가 (플랜)
3. **재시작 클릭** → `resumed_at` 저장 (세션), `paused_duration_seconds` 업데이트
4. **완료 클릭** → `actual_end_time` 저장 (플랜), `ended_at` 저장 (세션)

## 총 학습 시간 계산 로직

```typescript
총 학습 시간 = (종료 시간 또는 현재 시간) - 시작 시간 - 일시정지 시간
```

- 완료된 경우: `actual_end_time - actual_start_time - paused_duration_seconds`
- 진행 중인 경우: `현재 시간 - actual_start_time - paused_duration_seconds - 현재 일시정지 시간`

## 장점

1. **성능 개선**: 실시간 업데이트를 위한 `setInterval` 제거로 CPU 사용량 감소
2. **정확성 향상**: 타임스탬프 기반 계산으로 서버와 클라이언트 간 시간 차이 문제 해결
3. **일관성**: 모든 컴포넌트에서 동일한 계산 로직 사용
4. **단순화**: 실시간 업데이트 로직 제거로 코드 복잡도 감소

## 테스트 필요 사항

1. 타이머 시작 후 시간이 올바르게 표시되는지 확인
2. 일시정지 후 재시작 시 시간이 올바르게 계산되는지 확인
3. 완료 후 총 학습 시간이 올바르게 표시되는지 확인
4. 여러 번 일시정지/재시작해도 시간이 올바르게 계산되는지 확인

