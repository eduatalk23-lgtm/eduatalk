# 관리자 페이지 '남은 단계 진행하기' content_id가 마스터 ID인 경우 조회 개선

## 🔍 문제 상황

터미널 로그를 분석한 결과, 다음과 같은 문제가 발견되었습니다:

1. **`plan_contents` 테이블에 `master_content_id`가 `null`**
   ```
   master_content_id: null
   ```

2. **학생 콘텐츠 조회 실패**
   - `books` 테이블에서 `content_id`로 조회했지만 결과가 0개

3. **결과적으로 콘텐츠를 찾을 수 없음**
   - 학생 콘텐츠도 없고, `master_content_id`도 없어서 fallback 로직이 작동하지 않음

### 근본 원인

`content_id` 자체가 마스터 콘텐츠 ID일 수 있는데, 현재 로직은 `plan_contents.master_content_id`만 마스터 콘텐츠 조회 대상에 포함하고 있었습니다.

- 학생이 마스터 콘텐츠를 직접 선택한 경우: `content_id` = 마스터 콘텐츠 ID
- 학생이 자신의 콘텐츠를 추가한 경우: `content_id` = 학생 콘텐츠 ID, `master_content_id` = 마스터 콘텐츠 ID

현재 로직은 두 번째 경우만 처리하고 있었습니다.

## 🛠 해결 방법

### 수정 내용

#### 1. 마스터 콘텐츠 ID 수집 로직 개선

**파일**: `lib/data/planContents.ts`

`content_id` 자체도 마스터 콘텐츠 조회 대상에 포함하도록 수정했습니다.

**변경 전**:
```typescript
contents.forEach((content) => {
  if (content.content_type === "book") {
    bookContentIds.push(content.content_id);
    // plan_contents에 저장된 master_content_id가 있으면 마스터 콘텐츠 ID로도 수집
    if (content.master_content_id) {
      masterBookIds.push(content.master_content_id);
    }
  }
  // ...
});
```

**변경 후**:
```typescript
contents.forEach((content) => {
  if (content.content_type === "book") {
    bookContentIds.push(content.content_id);
    // plan_contents에 저장된 master_content_id가 있으면 마스터 콘텐츠 ID로도 수집
    if (content.master_content_id) {
      masterBookIds.push(content.master_content_id);
    }
    // content_id 자체가 마스터 콘텐츠 ID일 수 있으므로 마스터 콘텐츠 조회 대상에 포함
    masterBookIds.push(content.content_id);
  }
  // ...
});

// 중복 제거
const uniqueMasterBookIds = [...new Set(masterBookIds)];
const uniqueMasterLectureIds = [...new Set(masterLectureIds)];
```

#### 2. Fallback 로직 개선

학생 콘텐츠를 찾지 못하고 `master_content_id`도 없을 때, `content_id`로 직접 마스터 콘텐츠를 조회하도록 개선했습니다.

**변경 전**:
```typescript
} else {
  // 둘 다 없는 경우
  missingContents.push({
    content_type: "book",
    content_id: content.content_id,
    reason: `학생(${studentId})의 교재를 찾을 수 없습니다. master_books에도 존재하지 않습니다.`,
  });
}
```

**변경 후**:
```typescript
} else {
  // 학생 콘텐츠도 없고 plan_contents의 master_content_id로도 조회 실패
  // content_id 자체가 마스터 콘텐츠 ID인지 확인 (이미 masterBooksMap에 조회됨)
  const masterBookByContentId = masterBooksMap.get(content.content_id);
  if (masterBookByContentId) {
    // content_id가 마스터 콘텐츠 ID인 경우 → 추천 콘텐츠
    contentDetail = {
      content_type: "book",
      content_id: content.content_id,
      start_range: content.start_range,
      end_range: content.end_range,
      title: masterBookByContentId.title || "제목 없음",
      subject_category: masterBookByContentId.subject_category || masterBookByContentId.subject || null,
      isRecommended: true, // 마스터 콘텐츠이므로 추천 콘텐츠
      masterContentId: content.content_id, // content_id 자체가 마스터 ID
      // 자동 추천 정보 전달
      is_auto_recommended: content.is_auto_recommended ?? false,
      recommendation_source: content.recommendation_source ?? null,
      recommendation_reason: content.recommendation_reason ?? null,
      recommendation_metadata: content.recommendation_metadata ?? null,
    };
  } else {
    // 정말로 찾을 수 없는 경우
    missingContents.push({
      content_type: "book",
      content_id: content.content_id,
      reason: `학생(${studentId})의 교재를 찾을 수 없습니다. master_books에도 존재하지 않습니다.`,
    });
  }
}
```

#### 3. 마스터 콘텐츠 조회 시 중복 제거된 ID 사용

**변경 전**:
```typescript
masterBookIds.length > 0
  ? supabase
      .from("master_books")
      .select("id, title, subject_category, subject")
      .in("id", masterBookIds)
  : Promise.resolve({ data: [], error: null }),
```

**변경 후**:
```typescript
uniqueMasterBookIds.length > 0
  ? supabase
      .from("master_books")
      .select("id, title, subject_category, subject")
      .in("id", uniqueMasterBookIds)
  : Promise.resolve({ data: [], error: null }),
```

## 📊 변경 사항 요약

### 조회 우선순위

**변경 전**:
1. `content_id`로 마스터 콘텐츠 조회 (없음)
2. `content_id`로 학생 콘텐츠 조회
3. `master_content_id`로 마스터 콘텐츠 조회 (없음)
4. 둘 다 없으면 누락 처리

**변경 후**:
1. `content_id`로 마스터 콘텐츠 조회 (✅ 추가됨)
2. `content_id`로 학생 콘텐츠 조회
3. `master_content_id`로 마스터 콘텐츠 조회
4. 학생 콘텐츠를 찾지 못하고 `master_content_id`도 없을 때, `content_id`로 마스터 콘텐츠 재조회 (✅ 추가됨)
5. 그래도 없으면 누락 처리

### 효과

- ✅ `content_id` 자체가 마스터 콘텐츠 ID인 경우도 정상적으로 조회 가능
- ✅ 학생이 마스터 콘텐츠를 직접 선택한 경우에도 정보 표시 가능
- ✅ `master_content_id`가 `null`이어도 `content_id`로 마스터 콘텐츠 조회 가능

## ✅ 검증 완료

- [x] `content_id`를 마스터 콘텐츠 조회 대상에 포함
- [x] 중복 제거 로직 추가
- [x] Fallback 로직 개선 (content_id로 마스터 콘텐츠 재조회)
- [x] 책(book)과 강의(lecture) 모두 동일한 로직 적용
- [x] 린터 오류 없음

## 📝 참고

### 데이터 구조 예시

**케이스 1: 학생이 마스터 콘텐츠를 직접 선택한 경우**
```typescript
plan_contents: {
  content_id: "master-book-id",  // 마스터 콘텐츠 ID
  master_content_id: null,        // null
}
```

**케이스 2: 학생이 자신의 콘텐츠를 추가한 경우**
```typescript
plan_contents: {
  content_id: "student-book-id",  // 학생 콘텐츠 ID
  master_content_id: "master-book-id",  // 마스터 콘텐츠 ID
}
```

이제 두 케이스 모두 정상적으로 처리됩니다.

## 🔄 관련 수정 사항

이전 수정:
- `docs/admin-camp-continue-content-retrieval-fix.md` - fallback 로직 추가
- `docs/admin-camp-continue-student-content-fix-2025-11-27.md` - 원본 데이터 전달 개선

이번 수정은 위 두 수정과 함께 작동하여 더 안정적인 콘텐츠 조회를 보장합니다.

