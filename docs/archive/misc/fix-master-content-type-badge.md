# 마스터 콘텐츠 타입 뱃지 표시 수정

## 문제 상황

마스터 콘텐츠 타입을 "교재"로 선택했는데, 검색 결과의 상태 뱃지가 "강의"를 표시하는 문제가 발생했습니다.

### 증상
- 교재를 검색했는데 뱃지가 "🎧 강의"로 표시됨
- `result.content_type` 값이 올바르게 설정되지 않음

## 원인 분석

1. **`searchContentMasters` 함수의 문제**
   - `searchMasterBooks`와 `searchMasterLectures`는 각각 `MasterBook[]`과 `MasterLecture[]`를 반환
   - 이 타입들에는 `content_type` 필드가 없음
   - `searchContentMasters`에서 두 결과를 합칠 때 `content_type` 필드를 추가하지 않음

2. **타입 불일치**
   - `ContentMaster` 타입은 `content_type: "book" | "lecture"` 필드를 요구
   - 하지만 실제 반환 데이터에는 이 필드가 없어서 뱃지 표시 로직이 잘못 작동

## 수정 내용

### 1. `searchContentMasters` 함수 수정

반환하는 데이터에 `content_type` 필드를 명시적으로 추가:

```typescript
if (filters.content_type === "book") {
  const result = await searchMasterBooks(filters);
  // content_type 필드 추가
  const dataWithType = result.data.map((book) => ({
    ...book,
    content_type: "book" as const,
  }));
  return { data: dataWithType, total: result.total };
} else if (filters.content_type === "lecture") {
  const result = await searchMasterLectures(filters);
  // content_type 필드 추가
  const dataWithType = result.data.map((lecture) => ({
    ...lecture,
    content_type: "lecture" as const,
  }));
  return { data: dataWithType, total: result.total };
}
```

### 2. `MasterContentsPanel` 검증 로직 추가

검색 결과를 합칠 때 `content_type`이 없으면 추가:

```typescript
const dataWithType = result.data.map((item: any) => {
  // content_type이 없으면 검색 타입에 따라 추가
  if (!item.content_type) {
    const contentType = 
      (selectedContentType === "book") || 
      (selectedContentType === "all" && index === 0)
        ? "book"
        : "lecture";
    return {
      ...item,
      content_type: contentType,
    };
  }
  return item;
});
```

## 테스트 방법

1. 마스터 콘텐츠 패널에서 "교재" 타입 선택
2. 검색 실행
3. 검색 결과의 뱃지가 "📚 교재"로 표시되는지 확인
4. "강의" 타입 선택 후 검색
5. 검색 결과의 뱃지가 "🎧 강의"로 표시되는지 확인

## 예상 결과

- 교재 검색 시 뱃지가 "📚 교재"로 표시
- 강의 검색 시 뱃지가 "🎧 강의"로 표시
- "전체" 검색 시 각 결과가 올바른 타입 뱃지 표시

## 관련 파일

- `lib/data/contentMasters.ts`
- `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`

