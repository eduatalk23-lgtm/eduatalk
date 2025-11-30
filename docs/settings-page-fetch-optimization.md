# Settings 페이지 Fetch 최적화

## 작업 일시
2024년 12월

## 문제점
`/settings` 페이지에서 fetch가 계속 발생하는 문제가 있었습니다. 주요 원인은 다음과 같습니다:

### 1. SchoolSelect 컴포넌트의 무한 루프
- `useEffect`의 의존성 배열에 `selectedSchool`이 포함되어 있어, `fetchSchoolById`로 `selectedSchool`이 변경되면 다시 실행되는 무한 루프 발생

### 2. SchoolMultiSelect 컴포넌트의 무한 루프
- `value` 배열이 매번 새로운 참조로 전달되어 `useEffect`가 계속 실행됨

### 3. settings/page.tsx의 useEffect 의존성 문제
- `router` 객체가 매번 새로 생성될 수 있어 불필요한 재실행 발생

### 4. formData.school_id 변경 시 중복 조회
- `school_id`가 변경될 때마다 `getSchoolById`를 호출하지만, 동일한 값에 대한 중복 조회 방지 로직이 없음

## 해결 방법

### 1. SchoolSelect 컴포넌트 수정
- `useRef`를 사용하여 이전 `value`를 추적
- `selectedSchool`을 의존성 배열에서 제거하고, `value`만 의존성으로 사용
- `selectedSchool.id`와 `value`를 비교하여 동일하면 조회하지 않음

```typescript
// 이전 value를 추적하여 중복 조회 방지
const previousValueRef = useRef<string | undefined>(undefined);

useEffect(() => {
  // value가 변경되지 않았으면 조회하지 않음
  if (value === previousValueRef.current) {
    return;
  }

  previousValueRef.current = value;
  
  // ... 조회 로직
}, [value]);
```

### 2. SchoolMultiSelect 컴포넌트 수정
- `useRef`를 사용하여 이전 `value` 배열을 추적
- `JSON.stringify`로 배열 내용을 비교하여 실제 변경이 있을 때만 조회
- 이미 선택된 학교들의 ID와 비교하여 불필요한 조회 방지

```typescript
// 이전 value 배열을 추적하여 중복 조회 방지
const previousValueRef = useRef<string[]>([]);

useEffect(() => {
  // 배열 내용이 실제로 변경되었는지 확인
  const currentValueStr = JSON.stringify(value?.sort() || []);
  const previousValueStr = JSON.stringify(previousValueRef.current.sort());

  if (currentValueStr === previousValueStr) {
    return;
  }

  previousValueRef.current = value || [];
  
  // ... 조회 로직
}, [value]);
```

### 3. settings/page.tsx의 useEffect 수정
- `router`를 의존성 배열에서 제거하고 빈 배열 `[]` 사용
- 마운트 시에만 실행되도록 변경

```typescript
useEffect(() => {
  async function loadStudent() {
    // ... 로직
  }

  loadStudent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

### 4. formData.school_id 변경 시 학교 조회 최적화
- `useRef`를 사용하여 이전 `school_id`를 추적
- 동일한 `school_id`에 대해서는 조회하지 않음

```typescript
// 이전 school_id를 추적하여 중복 조회 방지
const previousSchoolIdRef = useRef<string | undefined>(undefined);

useEffect(() => {
  // school_id가 변경되지 않았으면 조회하지 않음
  if (formData.school_id === previousSchoolIdRef.current) {
    return;
  }

  previousSchoolIdRef.current = formData.school_id;
  
  // ... 조회 로직
}, [formData.school_id]);
```

## 수정된 파일
- `components/ui/SchoolSelect.tsx`
- `components/ui/SchoolMultiSelect.tsx`
- `app/(student)/settings/page.tsx`

## 결과
- 불필요한 fetch 호출 제거
- 페이지 성능 개선
- 네트워크 트래픽 감소

