# classifyPlanContents 함수 로직 단순화

## 🔍 문제 상황

`classifyPlanContents` 함수의 로직이 복잡하고 비효율적이었습니다:

1. **불필요한 마스터 콘텐츠 조회**: `content_id`로 마스터 콘텐츠를 먼저 조회하는데, 학생 콘텐츠의 `content_id`는 학생 콘텐츠 ID이므로 마스터 조회가 불필요함
2. **`plan_contents.master_content_id` 미활용**: 템플릿 제출 시 이미 저장된 `master_content_id`를 우선 활용하지 않음
3. **복잡한 fallback 로직**: 학생 콘텐츠를 찾지 못했을 때만 `plan_contents.master_content_id`를 사용

## 🛠 해결 방법

### 개선 사항

#### 1. 마스터 콘텐츠 ID 수집 로직 개선

**변경 전**:
```typescript
// content_id만 수집
const bookContentIds: string[] = [];
contents.forEach((content) => {
  if (content.content_type === "book") {
    bookContentIds.push(content.content_id);
  }
});
```

**변경 후**:
```typescript
// content_id와 plan_contents.master_content_id 모두 수집
const bookContentIds: string[] = [];
const masterBookIds: string[] = [];
contents.forEach((content) => {
  if (content.content_type === "book") {
    bookContentIds.push(content.content_id);
    // plan_contents에 저장된 master_content_id가 있으면 마스터 콘텐츠 ID로도 수집
    if (content.master_content_id) {
      masterBookIds.push(content.master_content_id);
    }
  }
});
```

#### 2. 불필요한 마스터 콘텐츠 조회 제거

**변경 전**:
```typescript
// content_id로 마스터 콘텐츠 조회 시도 (불필요)
bookContentIds.length > 0
  ? supabase
      .from("master_books")
      .select("id, title, subject_category")
      .in("id", bookContentIds)  // 학생 콘텐츠 ID로 마스터 조회 시도
  : Promise.resolve({ data: [], error: null }),
```

**변경 후**:
```typescript
// plan_contents.master_content_id로 마스터 콘텐츠 조회 (우선)
masterBookIds.length > 0
  ? supabase
      .from("master_books")
      .select("id, title, subject_category, subject")
      .in("id", masterBookIds)  // plan_contents.master_content_id로 조회
  : Promise.resolve({ data: [], error: null }),
```

#### 3. 콘텐츠 분류 로직 개선

**변경 전**:
```typescript
if (content.content_type === "book") {
  // 1. content_id로 마스터 콘텐츠 조회 시도 (불필요)
  const masterBook = masterBooksMap.get(content.content_id);
  if (masterBook) {
    // 추천 콘텐츠
  } else {
    // 2. content_id로 학생 콘텐츠 조회
    const studentBook = studentBooksMap.get(content.content_id);
    if (studentBook) {
      // 학생 콘텐츠의 master_content_id로 원본 마스터 조회
      if (studentBook.master_content_id) {
        const originalMasterBook = originalMasterBooksMap.get(...);
      }
    } else {
      // 3. plan_contents.master_content_id로 fallback
      if (content.master_content_id) {
        const fallbackMasterBook = originalMasterBooksMap.get(...);
      }
    }
  }
}
```

**변경 후**:
```typescript
if (content.content_type === "book") {
  // 1. plan_contents에 저장된 master_content_id가 있으면 우선 활용
  const masterBookFromPlan = content.master_content_id
    ? masterBooksMap.get(content.master_content_id)
    : null;

  // 2. content_id로 학생 콘텐츠 조회
  const studentBook = studentBooksMap.get(content.content_id);

  if (studentBook) {
    // 학생 콘텐츠를 찾은 경우
    // plan_contents의 master_content_id 또는 학생 콘텐츠의 master_content_id로 마스터 정보 조회
    const masterBook = masterBookFromPlan ||
      (studentBook.master_content_id
        ? masterBooksMap.get(studentBook.master_content_id)
        : null);

    if (masterBook) {
      // 마스터 콘텐츠 정보 우선 사용 (더 정확한 정보)
      title = masterBook.title || studentBook.title || "제목 없음";
      subjectCategory = masterBook.subject_category || masterBook.subject || studentBook.subject || null;
    }
  } else if (masterBookFromPlan) {
    // 학생 콘텐츠를 찾지 못했지만 plan_contents에 master_content_id가 있는 경우
    // → 추천 콘텐츠이거나 학생 콘텐츠가 삭제된 경우
    contentDetail = {
      ...,
      title: masterBookFromPlan.title || "제목 없음",
      subject_category: masterBookFromPlan.subject_category || masterBookFromPlan.subject || null,
      isRecommended: isMasterContentId,
      masterContentId: content.master_content_id,
    };
  }
}
```

## 📊 변경 사항 요약

### 조회 우선순위

**변경 전**:
1. `content_id`로 마스터 콘텐츠 조회 시도 (불필요)
2. `content_id`로 학생 콘텐츠 조회
3. 학생 콘텐츠의 `master_content_id`로 원본 마스터 조회
4. 학생 콘텐츠를 찾지 못하면 `plan_contents.master_content_id`로 fallback

**변경 후**:
1. `plan_contents.master_content_id`로 마스터 콘텐츠 조회 (우선)
2. `content_id`로 학생 콘텐츠 조회
3. 학생 콘텐츠를 찾았으면 → 학생 콘텐츠 정보 사용 (마스터 정보는 보조)
4. 학생 콘텐츠를 못 찾았지만 `plan_contents.master_content_id`가 있으면 → 마스터 콘텐츠 정보 사용

### 효과

- **불필요한 조회 제거**: `content_id`로 마스터 콘텐츠 조회 시도 제거
- **`plan_contents.master_content_id` 우선 활용**: 템플릿 제출 시 이미 저장된 정보 활용
- **로직 단순화**: 복잡한 fallback 로직 제거
- **성능 향상**: 불필요한 데이터베이스 쿼리 제거
- **정확도 향상**: `plan_contents.master_content_id`를 우선 사용하여 더 정확한 정보 표시

## ✅ 검증 완료

- [x] 마스터 콘텐츠 ID 수집 로직 개선
- [x] 불필요한 마스터 콘텐츠 조회 제거
- [x] 콘텐츠 분류 로직 개선
- [x] 린터 오류 없음

## 📝 참고

이제 `classifyPlanContents` 함수가:
- `plan_contents` 테이블의 `master_content_id` 필드를 우선 활용
- 불필요한 마스터 콘텐츠 조회 제거
- 로직 단순화로 유지보수성 향상
- 학생 콘텐츠가 삭제되었거나 변경되었을 때도 `plan_contents.master_content_id`로 정보 표시 가능

