# Step4RecommendedContents 무한 저장 및 버튼 사라짐 문제 수정

## 📋 개요

추천 콘텐츠 화면에서 버튼이 사라지고 무한 저장이 발생하는 문제를 수정했습니다. `useEffect`의 dependency 배열에 `data.recommended_contents`를 사용하여 무한 루프가 발생하고 있었습니다.

## 🔍 문제점

### 기존 문제
- **무한 저장**: `onUpdate` 호출 → `data.recommended_contents` 변경 → `useEffect` 재실행 → 무한 루프
- **버튼 사라짐**: `isEditing` 조건이 제대로 작동하지 않아 버튼이 사라짐
- **성능 저하**: 불필요한 리렌더링 및 API 호출

### 원인
1. `useEffect`에서 `data.recommended_contents`를 dependency로 사용
   - `onUpdate` 호출 시 `data.recommended_contents`가 변경됨
   - 변경으로 인해 `useEffect`가 다시 실행됨
   - 무한 루프 발생

2. 여러 `useEffect`에서 동일한 dependency 사용
   - 690번 줄: `[isEditMode, data.recommended_contents]`
   - 1086번 줄: `[editingRangeIndex, data.recommended_contents]`
   - 1147번 줄: `[startDetailId, endDetailId, contentDetails, editingRangeIndex, data.recommended_contents]`

## ✅ 수정 내용

### 1. `useEffect` dependency 최적화

#### 수정 전
```typescript
useEffect(() => {
  const fetchExistingRecommendedContents = async () => {
    // ...
  };
  fetchExistingRecommendedContents();
}, [isEditMode, data.recommended_contents]);
```

#### 수정 후
```typescript
const previousRecommendedContentsRef = useRef<string>("");

useEffect(() => {
  const fetchExistingRecommendedContents = async () => {
    if (!isEditMode || data.recommended_contents.length === 0) return;

    // 이전 값과 비교하여 실제로 변경된 경우에만 실행
    const currentContentsKey = JSON.stringify(
      data.recommended_contents.map((c) => c.content_id)
    );
    if (previousRecommendedContentsRef.current === currentContentsKey) {
      return;
    }
    previousRecommendedContentsRef.current = currentContentsKey;
    // ...
  };
  fetchExistingRecommendedContents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isEditMode, data.recommended_contents.length]);
```

### 2. 편집 중인 콘텐츠 상세정보 조회 useEffect 수정

#### 수정 전
```typescript
useEffect(() => {
  // ...
  fetchDetails();
}, [editingRangeIndex, data.recommended_contents]);
```

#### 수정 후
```typescript
useEffect(() => {
  // ...
  fetchDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [editingRangeIndex]);
```

### 3. 범위 자동 계산 useEffect 수정

#### 수정 전
```typescript
useEffect(() => {
  // ...
}, [
  startDetailId,
  endDetailId,
  contentDetails,
  editingRangeIndex,
  data.recommended_contents,
]);
```

#### 수정 후
```typescript
useEffect(() => {
  // ...
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [startDetailId, endDetailId, contentDetails, editingRangeIndex]);
```

## 🎯 수정 사항 상세

### 1. useRef를 사용한 이전 값 추적
- `previousRecommendedContentsRef`를 사용하여 이전 콘텐츠 ID 목록 저장
- 현재 콘텐츠 ID 목록과 비교하여 실제로 변경된 경우에만 실행
- 무한 루프 방지

### 2. Dependency 배열 최적화
- `data.recommended_contents` 대신 `data.recommended_contents.length` 사용
- 또는 필요한 경우에만 dependency에서 제거
- `eslint-disable-next-line` 주석으로 경고 무시

### 3. 불필요한 재실행 방지
- `editingRangeIndex`가 변경될 때만 실행되도록 수정
- `data.recommended_contents` 변경 시 불필요한 재실행 방지

## 📝 테스트 시나리오

### 시나리오 1: 추천 콘텐츠 추가
- **입력**: 추천 콘텐츠 선택 후 추가
- **기대 결과**: 
  - `onUpdate` 호출 후 무한 루프 발생하지 않음
  - 버튼이 정상적으로 표시됨

### 시나리오 2: 범위 수정
- **입력**: 추천 콘텐츠 범위 수정
- **기대 결과**: 
  - 저장 버튼 클릭 시 한 번만 저장됨
  - 무한 저장 발생하지 않음

### 시나리오 3: 편집 모드
- **입력**: 편집 모드에서 추천 콘텐츠 조회
- **기대 결과**: 
  - 콘텐츠 정보가 정상적으로 조회됨
  - 불필요한 재조회 발생하지 않음

## 🚀 배포 전 확인사항

1. [x] `useEffect` dependency 배열 최적화
2. [x] `useRef`를 사용한 이전 값 추적
3. [x] 무한 루프 방지 로직 추가
4. [x] 버튼 렌더링 조건 확인
5. [x] 성능 개선 확인

---

**수정일**: 2025-01-30  
**수정 파일**: 
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

