# 교재 관리 수정 시 이미지 표시 문제 수정

## 문제 상황

관리자 페이지의 교재 관리 메뉴에서 교재를 수정할 때, 기존에 있던 표지 이미지가 사라지는 문제가 발생했습니다.

## 원인 분석

1. **수정 폼에 이미지 필드 부재**: `MasterBookEditForm.tsx`에 `cover_image_url` 입력 필드가 없어서, 수정 시 이미지 URL이 폼 데이터에 포함되지 않았습니다.

2. **이미지 URL 처리**: `updateMasterBookAction`에서 이미지 URL을 처리하고 있었지만, 폼에서 전달되지 않아 기존 이미지가 유지되지 않았습니다.

## 해결 방법

### 1. 수정 폼에 이미지 URL 필드 추가

`app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`에 다음 기능을 추가했습니다:

- **표지 이미지 URL 입력 필드**: 기존 이미지 URL을 수정할 수 있는 입력 필드
- **이미지 미리보기**: 기존 이미지가 있을 경우 미리보기 표시
- **Next.js Image 컴포넌트 사용**: 최적화된 이미지 표시

```tsx
{
  /* 표지 이미지 URL */
}
<div className="md:col-span-2">
  <label className="mb-1 block text-sm font-medium text-gray-700">
    표지 이미지 URL
  </label>
  <input
    name="cover_image_url"
    type="url"
    defaultValue={book.cover_image_url || ""}
    placeholder="https://example.com/image.jpg"
    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
  />
  {book.cover_image_url && (
    <div className="mt-3">
      <p className="mb-2 text-xs text-gray-500">현재 이미지 미리보기:</p>
      <div className="relative h-48 w-32 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
        <Image
          src={book.cover_image_url}
          alt={`${book.title} 표지`}
          fill
          className="object-cover"
          sizes="128px"
        />
      </div>
    </div>
  )}
  <p className="mt-1 text-xs text-gray-500">
    교재 표지 이미지의 URL을 입력하세요
  </p>
</div>;
```

### 2. 이미지 URL 처리 로직 개선

`app/(student)/actions/masterContentActions.ts`의 `updateMasterBookAction` 함수에서 빈 문자열을 명시적으로 `null`로 처리하도록 개선했습니다:

```typescript
cover_image_url: (() => {
  const url = formData.get("cover_image_url")?.toString();
  return url && url.trim() !== "" ? url.trim() : null;
})(),
```

## 변경 사항

### 수정된 파일

1. **app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx**

   - `Image` 컴포넌트 import 추가
   - 표지 이미지 URL 입력 필드 추가
   - 기존 이미지 미리보기 기능 추가

2. **app/(student)/actions/masterContentActions.ts**
   - `updateMasterBookAction`에서 `cover_image_url` 처리 로직 개선
   - 빈 문자열을 명시적으로 `null`로 변환

## 테스트 시나리오

1. ✅ 기존 이미지가 있는 교재 수정 시 이미지 URL이 유지되는지 확인
2. ✅ 이미지 URL을 변경할 수 있는지 확인
3. ✅ 이미지 URL을 삭제(빈 문자열)할 수 있는지 확인
4. ✅ 이미지 미리보기가 올바르게 표시되는지 확인

## 추가 수정 사항

### 폼에 없는 필드가 데이터베이스에서 사라지는 문제 수정

**문제**: 수정 폼에 표시되지 않은 필드들이 `|| null`로 처리되어 데이터베이스에서 값이 사라지는 문제가 발생했습니다.

**원인**: `updateMasterBookAction`에서 폼에 필드가 없을 때도 `null`로 설정되어, `updateMasterBook` 함수에서 `undefined` 체크를 하지만 실제로는 `null`이 전달되어 데이터베이스에 `null`로 업데이트되었습니다.

**해결 방법**:

1. `getFormValue` 헬퍼 함수 추가:

   - 폼에 필드가 없으면 → `undefined` 반환 (업데이트하지 않음)
   - 폼에 필드가 있고 빈 문자열이면 → `null` 반환 (명시적으로 삭제)
   - 폼에 필드가 있고 값이 있으면 → 값 반환

2. 모든 선택적 필드에 `getFormValue` 적용:

   - `subtitle`, `series_name`, `author`, `publisher_id`, `publisher_name`, `isbn_10`, `isbn_13`, `edition`, `published_date`, `description`, `toc`, `publisher_review`, `source`, `source_product_code`, `source_url`, `cover_image_url`, `difficulty_level`, `notes` 등

3. `tags` 필드도 동일한 로직 적용:
   - 폼에 필드가 없으면 → `undefined` (업데이트하지 않음)
   - 폼에 필드가 있고 빈 문자열이면 → `null` (태그 삭제)
   - 폼에 필드가 있고 값이 있으면 → 배열로 변환

## 참고 사항

- 이미지 업로드 기능은 아직 구현되지 않았으며, URL 입력 방식만 지원합니다.
- 향후 이미지 파일 업로드 기능을 추가할 수 있습니다.
- 새 교재 등록 폼(`MasterBookForm.tsx`)에도 동일한 이미지 필드를 추가하는 것을 고려할 수 있습니다.
- 폼에 표시되지 않은 필드는 데이터베이스에서 유지되며, 명시적으로 빈 값으로 설정한 경우에만 `null`로 업데이트됩니다.
