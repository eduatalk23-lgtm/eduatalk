# 작업 일지: 완료하기 버튼 후에도 타이머가 계속 흐르는 문제 수정

## 날짜
2025-01-13

## 문제 상황
완료하기 버튼을 눌렀는데 진행중, 총학습, 순수 학습 시간에 계속 타이머가 흐르는 문제가 발생했습니다.

## 원인 분석

### 1. 총 학습 시간 계산 문제
`currentTotalSeconds` 계산에서 `timeStats.isActive`만 확인하고 `isCompleted`를 확인하지 않아, 완료 후에도 `elapsedSeconds`가 계속 더해졌습니다:

```typescript
// 문제 코드
const currentTotalSeconds = timeStats.isActive
  ? timeStats.totalDuration + elapsedSeconds
  : timeStats.totalDuration;
```

### 2. 순수 학습 시간 계산 문제
순수 학습 시간 계산에서도 `timeStats.isActive`만 확인하고 `isCompleted`를 확인하지 않아, 완료 후에도 `elapsedSeconds`가 계속 더해졌습니다:

```typescript
// 문제 코드
formatTime(timeStats.pureStudyTime + (timeStats.isActive && !isPausedState ? elapsedSeconds : 0))
```

### 3. 진행 중 섹션 표시 문제
완료 후에도 "진행 중" 섹션이 표시될 수 있었습니다.

## 해결 방법

### 1. 총 학습 시간 계산 수정
완료 상태일 때는 `elapsedSeconds`를 더하지 않도록 수정했습니다:

```typescript
// 수정된 코드
const currentTotalSeconds = isCompleted
  ? timeStats.totalDuration
  : timeStats.isActive
  ? timeStats.totalDuration + elapsedSeconds
  : timeStats.totalDuration;
```

### 2. 순수 학습 시간 계산 수정
완료 상태일 때는 `elapsedSeconds`를 더하지 않도록 수정했습니다:

```typescript
// 수정된 코드
formatTime(
  isCompleted
    ? timeStats.pureStudyTime
    : timeStats.pureStudyTime + (timeStats.isActive && !isPausedState ? elapsedSeconds : 0)
)
```

### 3. 진행 중 섹션 표시 조건 수정
완료되지 않은 경우에만 "진행 중" 섹션을 표시하도록 수정했습니다:

```typescript
// 수정된 코드
{timeStats.isActive && !isCompleted && (
  <div className={`mt-4 rounded-lg p-4 ${isPaused ? "bg-gray-50" : "bg-indigo-50"}`}>
    {/* 진행 중 UI */}
  </div>
)}
```

## 수정된 파일
- `app/(student)/today/_components/TimeCheckSection.tsx`

## 동작 방식
1. 완료하기 버튼 클릭
2. `completePlan` 함수 실행 (서버에서 `actual_end_time` 설정)
3. `router.refresh()` 호출 (서버 컴포넌트 재렌더링)
4. `timeStats.isCompleted`가 `true`가 됨
5. `isCompleted`가 `true`이면 `elapsedSeconds`를 더하지 않고 `timeStats.totalDuration`과 `timeStats.pureStudyTime`만 표시
6. "진행 중" 섹션은 표시되지 않음

## 참고사항
- `elapsedSeconds`는 `useEffect`에서 `isCompleted`일 때 0으로 설정되지만, 완료 후에도 계산 로직에서 사용되지 않도록 추가 체크를 했습니다.
- 완료 후에는 `timeStats.totalDuration`과 `timeStats.pureStudyTime`이 최종 값으로 고정되어 더 이상 증가하지 않습니다.

## 커밋
- 커밋 해시: (최신 커밋)
- 커밋 메시지: `fix: 완료하기 버튼 후에도 타이머가 계속 흐르는 문제 수정`

