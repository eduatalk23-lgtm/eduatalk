# 교과과목 관리 페이지 Buffer Blob 타입 에러 수정

## 작업 일시
2025-12-05

## 문제 상황
Vercel 프로덕션 빌드 중 TypeScript 에러 발생:

### 에러 1
```
./app/(admin)/admin/subjects/page.tsx:55:30
Type error: Type 'Buffer<ArrayBufferLike>' is not assignable to type 'BlobPart'.
```

### 에러 2
```
./app/(admin)/admin/subjects/page.tsx:116:7
Type error: 'a.display_order' is possibly 'undefined'.
```

## 원인 분석

### 에러 1
`exportSubjectsToExcel()` 함수가 서버 사이드에서 `Buffer`를 반환하는데, 클라이언트 사이드의 `Blob` 생성자는 `BlobPart` 타입을 기대합니다. `BlobPart`는 `string | Blob | ArrayBuffer | ArrayBufferView` 타입이지만, Node.js의 `Buffer` 타입은 직접 호환되지 않습니다.

### 에러 2
`CurriculumRevision` 타입의 `display_order` 필드가 `undefined`일 수 있는데, 정렬 로직에서 직접 사용하고 있었습니다.

## 수정 내용

### 파일
- `app/(admin)/admin/subjects/page.tsx`

### 변경 사항
`Buffer`를 `Uint8Array`로 변환하여 `Blob` 생성자에 전달하도록 수정했습니다.

#### 수정 1: handleExport 함수
```typescript
// 수정 전
const buffer = await exportSubjectsToExcel();
const blob = new Blob([buffer], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

// 수정 후
const buffer = await exportSubjectsToExcel();
// Buffer를 Uint8Array로 변환하여 Blob 생성
const uint8Array = new Uint8Array(buffer);
const blob = new Blob([uint8Array], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
```

#### 수정 2: handleDownloadTemplate 함수
```typescript
// 수정 전
const buffer = await downloadSubjectsTemplate();
const blob = new Blob([buffer], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

// 수정 후
const buffer = await downloadSubjectsTemplate();
// Buffer를 Uint8Array로 변환하여 Blob 생성
const uint8Array = new Uint8Array(buffer);
const blob = new Blob([uint8Array], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
```

#### 수정 3: display_order undefined 체크
정렬 로직에서 `display_order`가 `undefined`일 수 있으므로 기본값을 제공하도록 수정했습니다.

```typescript
// 수정 전
const sortedRevisions = [...revisions].sort(
  (a, b) =>
    a.display_order - b.display_order || a.name.localeCompare(b.name)
);

// 수정 후
const sortedRevisions = [...revisions].sort(
  (a, b) => {
    const orderA = a.display_order ?? 0;
    const orderB = b.display_order ?? 0;
    const orderDiff = orderA - orderB;
    return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
  }
);
```

## 검증
- TypeScript 컴파일 에러 해결 확인
- 린터 에러 없음 확인

## 참고
- `Uint8Array`는 `ArrayBufferView`의 일종으로 `BlobPart` 타입과 호환됩니다.
- 다른 파일(`master-books/_components/ExcelActions.tsx`)에서는 `as any`를 사용하고 있지만, 타입 안전성을 위해 `Uint8Array` 변환을 권장합니다.
- `master-lectures/_components/ExcelActions.tsx`에서는 이미 `Uint8Array` 변환을 사용하고 있습니다.

