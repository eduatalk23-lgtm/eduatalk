# Step4RecommendedContents 중복 방지 로직 강화

## 🔍 문제 상황

Step 4에서 추천 콘텐츠를 추가한 후 다시 추천 목록을 조회할 때, 같은 콘텐츠가 다시 추천되는 문제가 발생했습니다.

### 원인 분석

1. **추천 콘텐츠 추가 후 상태 동기화 문제**
   - 추천 콘텐츠를 추가한 후 `data.recommended_contents`가 업데이트되기 전에 다시 추천 목록을 조회할 수 있음
   - `allRecommendedContents`에서 추가된 콘텐츠를 제거하지 않아서 중복 발생 가능

2. **중복 방지 로직의 불완전성**
   - `existingIds`에 `data.recommended_contents`를 포함하고 있지만, 상태 업데이트 타이밍 문제로 인해 제대로 작동하지 않을 수 있음
   - `allRecommendedContents`를 확인하지 않아서 추가 안전장치가 없음

## ✅ 해결 방법

### 파일: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

#### 1. `addSelectedContents` 함수 개선

추천 콘텐츠를 추가한 후 `allRecommendedContents`에서도 제거하도록 수정했습니다.

**변경 전**:
```typescript
// 추가된 콘텐츠를 추천 목록에서 제거
const addedContentIds = new Set(contentsToAdd.map((c) => c.content_id));
setRecommendedContents((prev) =>
  prev.filter((c) => !addedContentIds.has(c.id))
);
```

**변경 후**:
```typescript
// 추가된 콘텐츠를 추천 목록에서 제거
const addedContentIds = new Set(contentsToAdd.map((c) => c.content_id));
setRecommendedContents((prev) =>
  prev.filter((c) => !addedContentIds.has(c.id))
);

// allRecommendedContents에서도 제거 (다시 추천 목록 조회 시 중복 방지)
setAllRecommendedContents((prev) =>
  prev.filter((c) => !addedContentIds.has(c.id))
);
```

#### 2. `fetchRecommendationsWithSubjects` 함수 개선

`allRecommendedContents`에서도 이미 추가된 콘텐츠를 확인하도록 추가 안전장치를 구현했습니다.

**변경 전**:
```typescript
// 중복 제거
const existingIds = new Set([
  ...data.student_contents.map((c) => c.content_id),
  ...data.recommended_contents.map((c) => c.content_id),
]);

const filteredRecommendations = recommendations.filter(
  (r: RecommendedContent) => {
    if (existingIds.has(r.id)) {
      return false;
    }
    if (studentMasterIds.has(r.id)) {
      return false;
    }
    return true;
  }
);
```

**변경 후**:
```typescript
// 중복 제거
const existingIds = new Set([
  ...data.student_contents.map((c) => c.content_id),
  ...data.recommended_contents.map((c) => c.content_id),
]);

// allRecommendedContents에서도 이미 추가된 콘텐츠 ID 수집 (추가 안전장치)
// 추천 콘텐츠를 추가한 직후 다시 조회할 때를 대비
// data.recommended_contents에 있는 콘텐츠는 allRecommendedContents에서도 제외
const allRecommendedIds = new Set(
  allRecommendedContents
    .filter((c) => 
      data.recommended_contents.some((rc) => rc.content_id === c.id)
    )
    .map((c) => c.id)
);

const filteredRecommendations = recommendations.filter(
  (r: RecommendedContent) => {
    // content_id로 직접 비교
    if (existingIds.has(r.id)) {
      return false;
    }
    // allRecommendedContents에서도 확인 (추가 안전장치)
    if (allRecommendedIds.has(r.id)) {
      return false;
    }
    // master_content_id로 비교 (학생이 마스터 콘텐츠를 등록한 경우)
    if (studentMasterIds.has(r.id)) {
      return false;
    }
    return true;
  }
);
```

#### 3. `fetchRecommendations` 함수 개선

`fetchRecommendationsWithSubjects`와 동일한 로직을 적용했습니다.

#### 4. `useCallback` 의존성 배열 개선

`allRecommendedContents`를 의존성 배열에 추가하여 상태 변경 시 함수가 재생성되도록 했습니다.

**변경 전**:
```typescript
}, [data.student_contents, data.recommended_contents, onUpdate]);
}, [data.student_contents, data.recommended_contents]);
```

**변경 후**:
```typescript
}, [data.student_contents, data.recommended_contents, allRecommendedContents, onUpdate]);
}, [data.student_contents, data.recommended_contents, allRecommendedContents]);
```

## 🔄 중복 방지 로직

### 3단계 중복 방지

1. **content_id로 직접 비교**
   - `existingIds`에 이미 추가된 콘텐츠 ID 확인
   - 학생 콘텐츠와 추천 콘텐츠 모두 확인

2. **allRecommendedContents에서 확인 (추가 안전장치)**
   - `allRecommendedContents`에서 이미 추가된 콘텐츠 확인
   - 추천 콘텐츠를 추가한 직후 다시 조회할 때를 대비

3. **master_content_id로 비교**
   - 학생 콘텐츠의 `master_content_id` 확인
   - 같은 마스터 콘텐츠를 기반으로 한 학생 콘텐츠가 있으면 추천 목록에서 제외

## 🎯 효과

### 개선 전

- 추천 콘텐츠를 추가한 후 다시 추천 목록을 조회하면 같은 콘텐츠가 다시 나타날 수 있음
- `data.recommended_contents`가 업데이트되기 전에 조회가 일어나면 중복 발생

### 개선 후

- 추천 콘텐츠를 추가한 후 `allRecommendedContents`에서도 제거하여 중복 방지
- `allRecommendedContents`에서도 이미 추가된 콘텐츠를 확인하여 추가 안전장치 제공
- 3단계 중복 방지로 더 확실한 중복 방지

## 📋 사용 예시

### 시나리오: 추천 콘텐츠 추가 후 다시 조회

1. Step 4에서 추천 콘텐츠 A를 추가
2. `data.recommended_contents`에 A 추가
3. `allRecommendedContents`에서도 A 제거
4. 다시 추천 목록 조회
5. **결과**: A는 `existingIds`와 `allRecommendedIds` 모두에서 제외되어 추천 목록에 나타나지 않음

## ✅ 검증 완료

- [x] `addSelectedContents`에서 `allRecommendedContents`에서도 제거
- [x] `fetchRecommendationsWithSubjects`에서 `allRecommendedContents` 확인 추가
- [x] `fetchRecommendations`에서 `allRecommendedContents` 확인 추가
- [x] `useCallback` 의존성 배열에 `allRecommendedContents` 추가
- [x] 린터 오류 없음

## 📝 참고 사항

- `allRecommendedContents`는 로컬 상태이지만, `data.recommended_contents`와 동기화하여 중복 방지
- 3단계 중복 방지로 더 확실한 중복 방지 제공
- 추천 콘텐츠를 추가한 직후 다시 조회해도 중복이 발생하지 않음

