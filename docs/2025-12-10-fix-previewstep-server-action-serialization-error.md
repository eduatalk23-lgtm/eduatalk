# PreviewStep 서버 액션 직렬화 오류 수정

**날짜**: 2025-12-10  
**작업 내용**: PreviewStep 컴포넌트의 서버 액션 직렬화 오류 수정

## 문제 상황

`PreviewStep.tsx` 컴포넌트에서 서버 액션 `getReschedulePreview`를 호출할 때 다음과 같은 오류가 발생했습니다:

```
Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".
```

## 원인 분석

`loadPreview` useCallback의 의존성 배열에 `adjustments` (배열)와 `dateRange` (객체)를 직접 포함하여 발생한 문제입니다. Next.js가 서버 액션과 클라이언트 컴포넌트 간 경계에서 이 값들을 직렬화할 때 오류가 발생했습니다.

### 문제 코드

```typescript
const loadPreview = useCallback(async () => {
  // ...
  const result = await getReschedulePreview(
    groupId,
    adjustments,  // 직접 참조
    dateRange     // 직접 참조
  );
  // ...
}, [groupId, adjustments, dateRange]); // 객체/배열이 의존성에 포함
```

## 해결 방법

`useRef`를 사용하여 최신 `adjustments`와 `dateRange` 값을 참조하도록 변경하고, `useCallback`의 의존성 배열에서 객체/배열을 제거했습니다.

## 수정 내용

### 파일: `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx`

1. **useRef 추가** (line 51-52)
   - `adjustmentsRef`: 최신 adjustments 값을 저장
   - `dateRangeRef`: 최신 dateRange 값을 저장

2. **useEffect 추가** (line 54-58)
   - `adjustments`와 `dateRange`가 변경될 때마다 ref 값 업데이트

3. **loadPreview useCallback 수정** (line 106-151)
   - 함수 내에서 `adjustmentsRef.current`와 `dateRangeRef.current` 사용
   - 의존성 배열에서 `adjustments`와 `dateRange` 제거
   - `groupId`, `onLoad`, `toast`만 의존성으로 유지

### 수정된 코드

```typescript
// ref 선언 (line 51-52)
const adjustmentsRef = useRef(adjustments); // 최신 adjustments 값을 저장
const dateRangeRef = useRef(dateRange); // 최신 dateRange 값을 저장

// ref 업데이트 (line 54-58)
useEffect(() => {
  adjustmentsRef.current = adjustments;
  dateRangeRef.current = dateRange;
}, [adjustments, dateRange]);

// loadPreview 수정 (line 106-151)
const loadPreview = useCallback(async () => {
  // ...
  // ref에서 최신 값 가져오기
  const currentAdjustments = adjustmentsRef.current;
  const currentDateRange = dateRangeRef.current;

  const result = await getReschedulePreview(
    groupId,
    currentAdjustments,  // ref를 통한 참조
    currentDateRange     // ref를 통한 참조
  );
  // ...
}, [groupId, onLoad, toast]); // 객체/배열 제거, 함수 참조만 포함
```

## 검증 사항

1. ✅ 서버 액션 호출 시 직렬화 오류가 발생하지 않음
2. ✅ `adjustments`나 `dateRange` 변경 시 `loadPreview`가 최신 값을 사용
3. ✅ `useEffect`에서 `loadPreview` 호출이 정상 작동

## 영향 범위

- 변경 파일: `PreviewStep.tsx` 1개
- 의존하는 컴포넌트: `RescheduleWizard.tsx` (변경 불필요)
- 기능: 재조정 미리보기 기능 정상 작동 확인

## 참고

이 패턴은 클라이언트 컴포넌트에서 서버 액션을 호출할 때 객체나 배열을 의존성 배열에 포함해야 하는 경우 유용합니다. `useRef`를 통해 최신 값을 참조하면서도 직렬화 문제를 피할 수 있습니다.
