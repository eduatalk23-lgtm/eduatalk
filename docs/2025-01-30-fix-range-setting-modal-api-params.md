# RangeSettingModal API 파라미터 수정

## 작업 일자
2025-01-30

## 문제 상황
`RangeSettingModal` 컴포넌트에서 콘텐츠 상세 정보를 조회할 때 API 호출이 실패하는 에러가 발생했습니다.

### 에러 메시지
```
상세 정보를 불러올 수 없습니다.
at RangeSettingModal.useEffect.fetchDetails (app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx:59:17)
```

## 원인 분석

### 1. 잘못된 쿼리 파라미터 사용
- **현재 사용**: `id`, `type`
- **API가 기대하는 값**: `contentId`, `contentType`

### 2. API 응답 구조 불일치
- API는 `apiSuccess` 헬퍼를 사용하여 `{ success: true, data: { details/episodes } }` 형식으로 응답
- 컴포넌트는 `data.details`로 직접 접근 시도
- 콘텐츠 타입에 따라 `details`(book) 또는 `episodes`(lecture)를 반환하는데 이를 처리하지 않음

### 3. 에러 처리 부족
- `response.ok`만 확인하고 실제 응답의 `success` 필드를 확인하지 않음
- 에러 응답의 상세 메시지를 활용하지 않음

## 수정 내용

### 파일
`app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

### 변경 사항

1. **쿼리 파라미터 수정**
   ```typescript
   // 수정 전
   `/api/student-content-details?id=${content.id}&type=${content.type}`
   
   // 수정 후
   `/api/student-content-details?contentType=${content.type}&contentId=${content.id}`
   ```

2. **응답 구조 처리 개선**
   ```typescript
   // 수정 전
   const data = await response.json();
   setDetails(data.details || []);
   
   // 수정 후
   const result = await response.json();
   
   if (!result.success) {
     throw new Error(
       result.error?.message || "상세 정보를 불러올 수 없습니다."
     );
   }
   
   // 콘텐츠 타입에 따라 details 또는 episodes 사용
   const detailsData = 
     content.type === "book" 
       ? result.data.details || []
       : result.data.episodes || [];
   
   setDetails(detailsData);
   ```

3. **에러 처리 개선**
   ```typescript
   // 수정 전
   if (!response.ok) {
     throw new Error("상세 정보를 불러올 수 없습니다.");
   }
   
   // 수정 후
   if (!response.ok) {
     const errorData = await response.json().catch(() => ({}));
     throw new Error(
       errorData.error?.message || "상세 정보를 불러올 수 없습니다."
     );
   }
   ```

## 참고 사항

### 다른 컴포넌트와의 일관성
- `Step3Contents.tsx`: 올바른 파라미터 사용 (`contentType`, `contentId`)
- `Step6FinalReview.tsx`: 올바른 파라미터 사용 (`contentType`, `contentId`)
- 이제 `RangeSettingModal`도 동일한 패턴을 따름

### API 엔드포인트 스펙
**GET** `/api/student-content-details`
- **Query Parameters**:
  - `contentType`: `"book" | "lecture"` (필수)
  - `contentId`: `string` (필수)
  - `includeMetadata`: `"true" | undefined` (선택)
  - `student_id`: `string` (관리자/컨설턴트의 경우 필수)

- **Response (성공)**:
  ```json
  {
    "success": true,
    "data": {
      "details": [...],  // book 타입인 경우
      "episodes": [...], // lecture 타입인 경우
      "metadata": {...}  // includeMetadata=true인 경우
    }
  }
  ```

- **Response (에러)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "BAD_REQUEST",
      "message": "contentType과 contentId가 필요합니다."
    }
  }
  ```

## 테스트 확인
- [x] 린터 오류 없음
- [ ] 실제 API 호출 테스트 필요 (브라우저에서 확인)

## 관련 파일
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`
- `app/api/student-content-details/route.ts`
- `app/(student)/plan/new-group/_components/Step3Contents.tsx`
- `app/(student)/plan/new-group/_components/Step6FinalReview.tsx`


