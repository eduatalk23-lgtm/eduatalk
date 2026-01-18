# 서비스 마스터 콘텐츠 가져오기 콘텐츠 유형 구분 수정

## 문제 상황

서비스 마스터 콘텐츠 가져오기 기능에서 콘텐츠 유형을 구분하지 않아 강의 콘텐츠가 교재에서 조회되는 문제가 발생했습니다.

### 원인 분석

1. **`copyMasterToStudentContent` 함수**: `content_type` 파라미터를 받지 않고, 먼저 교재에서 찾고, 없으면 강의에서 찾는 방식으로 동작
2. **`getContentMasterById` 함수**: 마찬가지로 `content_type` 파라미터를 받지 않고, 먼저 교재에서 찾고, 없으면 강의에서 찾는 방식으로 동작

이로 인해 강의 ID를 전달했을 때도 먼저 교재 테이블에서 조회를 시도하여 잘못된 결과가 반환될 수 있었습니다.

## 수정 내용

### 1. `lib/data/contentMasters.ts`

#### `copyMasterToStudentContent` 함수 수정

- `content_type` 파라미터 추가 (선택사항)
- `content_type`이 명시되어 있으면 해당 타입으로 직접 복사
- `content_type`이 없으면 기존 방식대로 자동 감지 (하위 호환성 유지)

```typescript
export async function copyMasterToStudentContent(
  masterId: string,
  studentId: string,
  tenantId: string,
  content_type?: "book" | "lecture" | "custom"
): Promise<{ bookId?: string; lectureId?: string; contentId?: string }> {
  // content_type이 명시되어 있으면 해당 타입으로 직접 복사
  if (content_type === "book") {
    const result = await copyMasterBookToStudent(masterId, studentId, tenantId);
    return { bookId: result.bookId };
  } else if (content_type === "lecture") {
    const result = await copyMasterLectureToStudent(masterId, studentId, tenantId);
    return { lectureId: result.lectureId };
  } else if (content_type === "custom") {
    const result = await copyMasterCustomContentToStudent(masterId, studentId, tenantId);
    return { contentId: result.contentId };
  }

  // content_type이 없으면 자동 감지 (하위 호환성)
  // ...
}
```

#### `getContentMasterById` 함수 수정

- `content_type` 파라미터 추가 (선택사항)
- `content_type`이 명시되어 있으면 해당 타입으로 직접 조회
- `content_type`이 없으면 기존 방식대로 자동 감지 (하위 호환성 유지)

```typescript
export async function getContentMasterById(
  masterId: string,
  content_type?: "book" | "lecture" | "custom"
): Promise<{ master: any | null; details: BookDetail[] }> {
  // content_type이 명시되어 있으면 해당 타입으로 직접 조회
  if (content_type === "book") {
    const bookResult = await getMasterBookById(masterId);
    if (bookResult.book) {
      return {
        master: bookResult.book,
        details: bookResult.details,
      };
    }
    return { master: null, details: [] };
  } else if (content_type === "lecture") {
    // ...
  } else if (content_type === "custom") {
    // ...
  }

  // content_type이 없으면 자동 감지 (하위 호환성)
  // ...
}
```

### 2. `app/(student)/actions/contentMasterActions.ts`

#### `_copyMasterToStudentContent` 함수 수정

- `content_type` 파라미터 추가 (선택사항)
- `copyMasterToStudentContent` 호출 시 `content_type` 전달

```typescript
async function _copyMasterToStudentContent(
  masterId: string,
  targetStudentId?: string,
  content_type?: "book" | "lecture" | "custom"
): Promise<{
  bookId?: string;
  lectureId?: string;
  contentId?: string;
}> {
  // ...
  return await copyMasterToStudentContent(
    masterId,
    finalStudentId,
    tenantContext.tenantId,
    content_type
  );
}
```

#### `_getContentMasterById` 함수 수정

- `content_type` 파라미터 추가 (선택사항)
- `getContentMasterById` 호출 시 `content_type` 전달

```typescript
async function _getContentMasterById(
  masterId: string,
  content_type?: "book" | "lecture" | "custom"
): Promise<{
  master: any | null;
  details: any[];
}> {
  // ...
  return await getContentMasterById(masterId, content_type);
}
```

### 3. 호출부 업데이트

#### `CopyMasterBookButton.tsx`

```typescript
const result = await copyMasterToStudentContentAction(masterBookId, undefined, "book");
```

#### `CopyMasterLectureButton.tsx`

```typescript
const result = await copyMasterToStudentContentAction(masterLectureId, undefined, "lecture");
```

#### `CopyMasterCustomContentButton.tsx`

```typescript
const result = await copyMasterToStudentContentAction(masterContentId, undefined, "custom");
```

#### `ContentMasterSearch.tsx`

```typescript
const result = await copyMasterToStudentContentAction(masterId, studentId, contentType);
const contentId = result.bookId || result.lectureId || result.contentId;
```

## 수정 효과

1. **정확한 콘텐츠 타입 구분**: `content_type`이 명시되면 해당 타입으로만 조회/복사하여 잘못된 결과 반환 방지
2. **하위 호환성 유지**: `content_type`이 없으면 기존 방식대로 자동 감지하여 기존 코드 영향 최소화
3. **성능 개선**: 불필요한 테이블 조회 제거 (교재 → 강의 → 커스텀 순서로 시도하지 않음)

## 테스트 항목

- [x] 교재 가져오기 버튼 클릭 시 교재만 조회되는지 확인
- [x] 강의 가져오기 버튼 클릭 시 강의만 조회되는지 확인
- [x] 커스텀 콘텐츠 가져오기 버튼 클릭 시 커스텀 콘텐츠만 조회되는지 확인
- [x] `ContentMasterSearch`에서 `contentType`에 따라 올바른 콘텐츠 타입으로 복사되는지 확인

## 관련 파일

- `lib/data/contentMasters.ts`
- `app/(student)/actions/contentMasterActions.ts`
- `app/(student)/contents/master-books/[id]/_components/CopyMasterBookButton.tsx`
- `app/(student)/contents/master-lectures/[id]/_components/CopyMasterLectureButton.tsx`
- `app/(student)/contents/master-custom-contents/[id]/_components/CopyMasterCustomContentButton.tsx`
- `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`

