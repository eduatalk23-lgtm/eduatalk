ㅐㅐ# 관리자 페이지 '남은 단계 진행하기' 학생 추가 콘텐츠 조회 개선

## 🔍 문제 상황

관리자 페이지에서 '남은 단계 진행하기'에서 학생이 추가 등록한 콘텐츠 정보가 원활하게 조회되지 않는 문제가 있었습니다.

### 원인 분석

1. **`master_content_id` 필드 미활용**

   - `plan_contents` 테이블에 `master_content_id` 필드가 있지만, `classifyPlanContents` 함수에서 활용하지 않음
   - 학생 콘텐츠를 찾지 못했을 때 fallback 로직이 없어서 콘텐츠 정보가 누락됨

2. **타입 정의 누락**

   - `classifyPlanContents` 함수의 입력 타입에 `master_content_id` 필드가 없음
   - `plan_contents`에서 조회한 `master_content_id` 정보가 전달되지 않음

3. **Fallback 로직 부재**
   - 학생 콘텐츠를 찾지 못했을 때, `plan_contents`에 저장된 `master_content_id`로 마스터 콘텐츠를 조회하는 로직이 없음
   - 학생이 추가한 콘텐츠가 삭제되었거나 변경되었을 때 정보를 표시할 수 없음

## 🛠 해결 방법

### 수정 내용

**파일**: `lib/data/planContents.ts`

#### 1. 입력 타입에 `master_content_id` 필드 추가

**변경 전**:

```typescript
export async function classifyPlanContents(
  contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
    // ...
  }>,
  studentId: string
);
```

**변경 후**:

```typescript
export async function classifyPlanContents(
  contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    master_content_id?: string | null; // 마스터 콘텐츠 ID (plan_contents에서 조회한 값)
    start_range: number;
    end_range: number;
    // ...
  }>,
  studentId: string
);
```

#### 2. 마스터 콘텐츠 ID 수집 로직 개선

**변경 전**:

```typescript
// 4. 마스터 콘텐츠 ID 추출 (학생 콘텐츠의 master_content_id)
const masterContentIdsForLookup = new Set<string>();
[...studentBooksMap.values(), ...studentLecturesMap.values()].forEach(
  (item) => {
    if (item.master_content_id) {
      masterContentIdsForLookup.add(item.master_content_id);
    }
  }
);
```

**변경 후**:

```typescript
// 4. 마스터 콘텐츠 ID 추출 (학생 콘텐츠의 master_content_id + plan_contents의 master_content_id)
const masterContentIdsForLookup = new Set<string>();
// 학생 콘텐츠의 master_content_id
[...studentBooksMap.values(), ...studentLecturesMap.values()].forEach(
  (item) => {
    if (item.master_content_id) {
      masterContentIdsForLookup.add(item.master_content_id);
    }
  }
);
// plan_contents의 master_content_id (fallback용)
contents.forEach((content) => {
  if (
    content.master_content_id &&
    (content.content_type === "book" || content.content_type === "lecture")
  ) {
    masterContentIdsForLookup.add(content.master_content_id);
  }
});
```

#### 3. Fallback 로직 추가 (책)

**변경 전**:

```typescript
} else {
  // 학생 교재를 찾지 못한 경우
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
  // 학생 교재를 찾지 못한 경우
  // plan_contents에 저장된 master_content_id로 마스터 콘텐츠 조회 시도 (fallback)
  if (content.master_content_id) {
    const fallbackMasterBook = originalMasterBooksMap.get(content.master_content_id);
    if (fallbackMasterBook) {
      // 마스터 콘텐츠 정보로 표시 (학생 콘텐츠가 삭제되었을 수 있음)
      contentDetail = {
        content_type: "book",
        content_id: content.content_id,
        start_range: content.start_range,
        end_range: content.end_range,
        title: fallbackMasterBook.title || "제목 없음",
        subject_category: fallbackMasterBook.subject_category || fallbackMasterBook.subject || null,
        isRecommended: false,
        masterContentId: content.master_content_id,
      };
    } else {
      missingContents.push({
        content_type: "book",
        content_id: content.content_id,
        reason: `학생(${studentId})의 교재를 찾을 수 없습니다. master_books(${content.master_content_id})에도 존재하지 않습니다.`,
      });
    }
  } else {
    missingContents.push({
      content_type: "book",
      content_id: content.content_id,
      reason: `학생(${studentId})의 교재를 찾을 수 없습니다. master_books에도 존재하지 않습니다.`,
    });
  }
}
```

#### 4. Fallback 로직 추가 (강의)

강의 콘텐츠에도 동일한 fallback 로직을 추가했습니다.

## 📊 변경 사항 요약

### 조회 우선순위

**변경 전**:

1. `content_id`로 마스터 콘텐츠 조회
2. `content_id`로 학생 콘텐츠 조회
3. 둘 다 없으면 누락 처리

**변경 후**:

1. `content_id`로 마스터 콘텐츠 조회
2. `content_id`로 학생 콘텐츠 조회
3. 학생 콘텐츠가 없고 `master_content_id`가 있으면, `master_content_id`로 마스터 콘텐츠 조회 (fallback)
4. 그래도 없으면 누락 처리

### 효과

- 학생이 추가한 콘텐츠가 삭제되었거나 변경되었을 때도 원본 마스터 콘텐츠 정보를 표시할 수 있음
- `plan_contents` 테이블에 저장된 `master_content_id` 정보를 활용하여 조회 성공률 향상
- 관리자가 학생의 추가 콘텐츠 정보를 더 정확하게 확인할 수 있음

## ✅ 검증 완료

- [x] 입력 타입에 `master_content_id` 필드 추가
- [x] 마스터 콘텐츠 ID 수집 로직 개선
- [x] Fallback 로직 추가 (책, 강의)
- [x] 린터 오류 없음

## 📝 참고

이제 `classifyPlanContents` 함수가 `plan_contents` 테이블의 `master_content_id` 필드를 활용하여:

- 학생 콘텐츠를 찾지 못했을 때 마스터 콘텐츠 정보를 표시
- 콘텐츠 정보 조회 성공률 향상
- 관리자 페이지에서 학생 추가 콘텐츠 정보를 더 정확하게 확인 가능
