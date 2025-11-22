# 타이머 즉시 반응 개선 (Optimistic Update)

## 📋 작업 개요

타이머가 계속 흐르는 것처럼 보이는 문제를 해결하기 위해 optimistic 상태 관리를 추가했습니다.

## 🐛 문제점

타이머 버튼(일시정지/재개)을 클릭해도 타이머가 계속 흐르는 것처럼 보였습니다.

**원인**:
- `isPaused`와 `isActive` 상태가 서버에서 오는 props였습니다.
- `router.refresh()`가 비동기적으로 실행되어 서버 상태 업데이트가 지연되었습니다.
- 버튼 클릭 후 서버 응답을 기다리는 동안 UI가 업데이트되지 않아 타이머가 계속 흐르는 것처럼 보였습니다.

## ✅ 해결 방법

`TimeCheckSection` 컴포넌트에 optimistic 상태 관리를 추가하여 버튼 클릭 시 즉시 UI를 업데이트하도록 했습니다.

### Optimistic 상태 관리

```typescript
// Optimistic 상태 관리 (서버 응답 전 즉시 UI 업데이트)
const [optimisticIsPaused, setOptimisticIsPaused] = useState<boolean | null>(null);
const [optimisticIsActive, setOptimisticIsActive] = useState<boolean | null>(null);

// props가 변경되면 optimistic 상태 초기화 (서버 상태와 동기화)
useEffect(() => {
  setOptimisticIsPaused(null);
  setOptimisticIsActive(null);
}, [isPaused, isActive]);
```

### 상태 우선순위

Optimistic 상태가 있으면 우선 사용하고, 없으면 props를 사용합니다:

```typescript
// Optimistic 상태가 있으면 우선 사용, 없으면 props 사용
const isActiveState = optimisticIsActive !== null ? optimisticIsActive : Boolean(isActive);
const isPausedState = optimisticIsPaused !== null ? optimisticIsPaused : Boolean(isPaused);
```

### 버튼 핸들러에서 즉시 상태 업데이트

```typescript
onStart={() => {
  setOptimisticIsActive(true);
  setOptimisticIsPaused(false);
  onStart();
}}
onPause={() => {
  setOptimisticIsPaused(true);
  onPause();
}}
onResume={() => {
  setOptimisticIsPaused(false);
  onResume();
}}
```

## 📝 변경 사항

### 파일
- `app/(student)/today/_components/TimeCheckSection.tsx`
  - Optimistic 상태 관리 추가
  - 버튼 핸들러에서 즉시 상태 업데이트
  - props 변경 시 optimistic 상태 초기화

## 🎯 효과

### 즉시 반응
- 일시정지/재개 버튼 클릭 시 즉시 타이머가 멈추거나 재개됩니다.
- 서버 응답을 기다리지 않고 UI가 즉시 업데이트됩니다.

### 상태 동기화
- 서버 응답 후 실제 상태로 자동 동기화됩니다.
- props가 변경되면 optimistic 상태가 초기화되어 서버 상태와 일치합니다.

### 사용자 경험 개선
- 타이머가 계속 흐르는 것처럼 보이는 문제가 해결되었습니다.
- 버튼 클릭에 즉시 반응하여 더 나은 사용자 경험을 제공합니다.

## 🔄 동작 흐름

1. **버튼 클릭**: 사용자가 일시정지/재개 버튼 클릭
2. **즉시 UI 업데이트**: Optimistic 상태로 즉시 타이머 멈춤/재개
3. **서버 요청**: 백그라운드에서 서버 액션 실행
4. **상태 동기화**: 서버 응답 후 `router.refresh()`로 실제 상태 업데이트
5. **Optimistic 상태 초기화**: props 변경 시 optimistic 상태 초기화

## 📅 작업 일자

2025-01-XX

