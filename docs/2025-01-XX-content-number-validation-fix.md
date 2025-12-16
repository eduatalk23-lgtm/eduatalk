# 콘텐츠 등록 숫자 검증 수정

## 작업 일자
2025-01-XX

## 문제 상황
콘텐츠 등록 시 "Expected number, received string" 에러가 발생하는 문제가 있었습니다.

### 원인 분석
1. **타입 변환 에러**: `Number(formData.get("total_pages") || 0)` 패턴에서 빈 문자열이나 잘못된 값이 문자열로 전달될 수 있음
2. **중복 코드**: 여러 함수에서 동일한 FormData 파싱 로직 반복
3. **검증 부족**: 숫자 필드에 대한 NaN 체크 및 범위 검증이 없음
4. **데이터베이스 스키마 불일치**: DB는 `integer | null`을 기대하지만, 코드에서 `0`을 기본값으로 사용

## 해결 방안

### 1. FormData 숫자 파싱 헬퍼 함수 생성

**파일**: `lib/utils/formDataHelpers.ts`

새로운 `getNumberFromFormData` 함수를 추가하여 안전한 숫자 파싱을 제공:

```typescript
export function getNumberFromFormData(
  formData: FormData,
  key: string,
  options?: {
    min?: number;
    max?: number;
    required?: boolean;
  }
): number | null
```

**주요 기능**:
- 빈 문자열이나 null은 null 반환
- 숫자로 변환 불가능한 경우 null 반환 (required가 false인 경우)
- NaN 체크 포함
- 범위 검증 지원 (min, max)
- 필수 필드 검증 지원 (required)

### 2. contentActions.ts 리팩토링

다음 함수들을 수정하여 `getNumberFromFormData`를 사용하도록 변경:

- `addBook`: `total_pages` 파싱 개선 (min: 1)
- `updateBook`: `total_pages` 파싱 개선 (min: 1)
- `createBookWithoutRedirect`: `total_pages` 파싱 개선 (min: 1, 에러 처리 추가)
- `addLecture`: `duration` 파싱 개선 (min: 0)
- `updateLecture`: `duration` 파싱 개선 (min: 0)
- `addCustomContent`: `total` 파싱 개선 (min: 0)
- `updateCustomContent`: `total` 파싱 개선 (min: 0)

### 3. formDataToObject 함수 개선

**파일**: `lib/validation/schemas.ts`

빈 문자열 처리 로직을 개선하여 `Number("")`가 `0`으로 변환되는 문제를 해결:

- 빈 문자열을 명시적으로 처리
- 숫자 변환 전에 빈 문자열 체크 강화
- `isFinite` 체크 추가

## 수정된 파일

1. `lib/utils/formDataHelpers.ts`
   - `getNumberFromFormData` 함수 추가

2. `app/(student)/actions/contentActions.ts`
   - 모든 콘텐츠 등록/수정 함수에서 숫자 파싱 로직 개선
   - `getNumberFromFormData` import 추가

3. `lib/validation/schemas.ts`
   - `formDataToObject` 함수 개선

## 검증 사항

- [x] 린터 에러 없음
- [x] 타입 안전성 확보
- [x] 빈 값 처리 개선
- [x] NaN 체크 추가
- [x] 범위 검증 추가
- [x] 에러 메시지 개선

## 예상 효과

1. **에러 해결**: "Expected number, received string" 에러 완전 해결
2. **코드 품질**: 중복 코드 제거로 유지보수성 향상
3. **타입 안전성**: 명시적인 null 처리로 타입 안전성 향상
4. **사용자 경험**: 더 명확한 에러 메시지 제공

## 참고 사항

- 데이터베이스 스키마: `total_pages`, `duration`, `total_page_or_time` 모두 `integer`, nullable
- 기존 코드와의 호환성 유지
- 에러 처리는 각 함수의 특성에 맞게 구현 (throw 또는 return)

