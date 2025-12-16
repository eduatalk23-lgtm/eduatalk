# 마스터 콘텐츠 CRUD 최적화 작업 완료

## 작업 개요

마스터 콘텐츠 관련 등록/수정 폼의 중복 코드를 제거하고, 일관성을 개선하며, 2025년 최신 모범 사례를 적용하여 전면적으로 최적화했습니다.

**작업 일자**: 2025-02-15  
**작업 범위**: 마스터 교재, 마스터 강의, 마스터 커스텀 콘텐츠 CRUD 최적화

---

## 완료된 작업

### Phase 1: FormData 파싱 유틸리티 통합 ✅

#### 1.1 formDataHelpers.ts 확장 및 통합

- **파일**: `lib/utils/formDataHelpers.ts`
- **작업 내용**:
  - `formData.ts`의 모든 기능을 `formDataHelpers.ts`로 통합
  - 하위 호환성을 위해 `formData.ts`의 함수들을 deprecated로 유지
  - 추가 함수: `getFormFloat`, `getFormBoolean`, `getFormDate` 추가
  - 네이밍 통일: `getFormString`, `getFormInt`, `getFormUuid`, `getFormArray`, `getFormTags` 유지

#### 1.2 마스터 교재 FormData 파싱 헬퍼 생성

- **파일**: `lib/utils/masterContentFormHelpers.ts`
- **추가된 함수**:
  - `parseMasterBookFormData(formData: FormData, tenantId: string | null)`: 생성용
  - `parseMasterBookUpdateFormData(formData: FormData)`: 수정용
- **기능**:
  - 모든 교재 필드 파싱 (40개 필드)
  - `target_exam_type` 배열 처리
  - `tags` 배열 처리
  - `formDataHelpers.ts` 함수 활용

#### 1.3 마스터 강의 FormData 파싱 헬퍼 생성

- **파일**: `lib/utils/masterContentFormHelpers.ts`
- **추가된 함수**:
  - `parseMasterLectureFormData(formData: FormData, tenantId: string | null)`: 생성용
  - `parseMasterLectureUpdateFormData(formData: FormData)`: 수정용
- **기능**:
  - 모든 강의 필드 파싱 (28개 필드)
  - `total_duration` 분→초 변환 처리
  - `formDataHelpers.ts` 함수 활용

---

### Phase 2: 마스터 교재/강의 액션 개선 ✅

#### 2.1 addMasterBook 리팩토링

- **파일**: `app/(student)/actions/masterContentActions.ts`
- **변경 사항**:
  - `parseMasterBookFormData` 사용
  - `withErrorHandling` 적용
  - `requireAdminOrConsultant` 사용
  - `getTenantContext` 사용
  - `AppError` 사용

#### 2.2 updateMasterBookAction 리팩토링

- **파일**: `app/(student)/actions/masterContentActions.ts`
- **변경 사항**:
  - `parseMasterBookUpdateFormData` 사용
  - `withErrorHandling` 적용
  - `requireAdminOrConsultant` 사용
  - `AppError` 사용
  - `revalidatePath` 추가

#### 2.3 addMasterLecture 리팩토링

- **파일**: `app/(student)/actions/masterContentActions.ts`
- **변경 사항**:
  - `parseMasterLectureFormData` 사용
  - `withErrorHandling` 적용
  - `requireAdminOrConsultant` 사용
  - `getTenantContext` 사용
  - `AppError` 사용

#### 2.4 updateMasterLectureAction 리팩토링

- **파일**: `app/(student)/actions/masterContentActions.ts`
- **변경 사항**:
  - `parseMasterLectureUpdateFormData` 사용
  - `withErrorHandling` 적용
  - `requireAdminOrConsultant` 사용
  - `AppError` 사용
  - `revalidatePath` 추가

---

### Phase 3: MasterLectureEditForm 개선 ✅

#### 3.1 에러 처리 개선

- **파일**: `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`
- **변경 사항**:
  - `alert` → `useToast`로 변경
  - `showSuccess`, `showError` 사용

#### 3.2 클라이언트 사이드 검증 추가

- **파일**: `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`
- **변경 사항**:
  - `masterLectureSchema`로 FormData 검증
  - 검증 실패 시 Toast로 에러 표시
  - 필드별 에러 메시지 표시

#### 3.3 FormField/FormSelect 컴포넌트 사용

- **파일**: `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`
- **변경 사항**:
  - 직접 `input`/`select` → `FormField`/`FormSelect`로 교체
  - 일관된 스타일링 적용
  - 에러 메시지 표시 통합

---

### Phase 4: 코드 정리 및 문서화 ✅

#### 4.1 formData.ts 제거

- **파일**: `lib/utils/formData.ts`
- **작업**: 
  - 모든 import 경로를 `formDataHelpers.ts`로 변경
  - 파일 삭제
- **변경된 파일**:
  - `lib/utils/index.ts`
  - `lib/domains/score/actions.ts`
  - `lib/domains/school/actions.ts`

#### 4.2 중복 코드 제거 확인

- `app/(student)/actions/masterContentActions.ts`에서 직접 파싱 코드 제거
  - 약 300줄 이상의 중복 코드 제거
- 헬퍼 함수 사용으로 대체

---

## 개선 효과

### 코드 중복 제거

- **약 300줄 이상의 중복 코드 제거**
- FormData 파싱 로직 통합
- 단일 책임 원칙 적용

### 일관성 향상

- 모든 마스터 콘텐츠 폼에서 동일한 패턴 사용
- 에러 처리 통일 (`withErrorHandling` + `AppError`)
- UI 컴포넌트 통일 (`FormField`/`FormSelect`)

### 유지보수성 향상

- 헬퍼 함수로 로직 중앙화
- 스키마 변경 시 한 곳만 수정
- 타입 안전성 향상

---

## 변경된 파일 목록

### 수정된 파일

1. `lib/utils/formDataHelpers.ts` - 확장 및 통합
2. `lib/utils/masterContentFormHelpers.ts` - 교재/강의 파싱 함수 추가
3. `app/(student)/actions/masterContentActions.ts` - 리팩토링
4. `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx` - 개선
5. `lib/utils/index.ts` - import 경로 변경
6. `lib/domains/score/actions.ts` - import 경로 변경
7. `lib/domains/school/actions.ts` - import 경로 변경

### 제거된 파일

1. `lib/utils/formData.ts` - 기능 통합 후 제거

---

## 사용 가이드

### 마스터 교재 생성/수정

```typescript
import {
  parseMasterBookFormData,
  parseMasterBookUpdateFormData,
} from "@/lib/utils/masterContentFormHelpers";

// 생성
const bookData = parseMasterBookFormData(formData, tenantId);
await createMasterBook(bookData);

// 수정
const updateData = parseMasterBookUpdateFormData(formData);
await updateMasterBook(bookId, updateData);
```

### 마스터 강의 생성/수정

```typescript
import {
  parseMasterLectureFormData,
  parseMasterLectureUpdateFormData,
} from "@/lib/utils/masterContentFormHelpers";

// 생성
const lectureData = parseMasterLectureFormData(formData, tenantId);
await createMasterLecture(lectureData);

// 수정
const updateData = parseMasterLectureUpdateFormData(formData);
await updateMasterLecture(lectureId, updateData);
```

### FormData 파싱 유틸리티 사용

```typescript
import {
  getFormString,
  getFormInt,
  getFormUuid,
  getFormArray,
  getFormTags,
  getFormBoolean,
  getFormDate,
} from "@/lib/utils/formDataHelpers";

// 문자열
const title = getFormString(formData, "title");

// 숫자
const totalPages = getFormInt(formData, "total_pages");

// UUID
const subjectId = getFormUuid(formData, "subject_id");

// 배열
const examTypes = getFormArray(formData, "target_exam_type");

// 태그
const tags = getFormTags(formData, "tags");

// 불리언
const isActive = getFormBoolean(formData, "is_active");

// 날짜
const publishedDate = getFormDate(formData, "published_date");
```

---

## 참고 사항

### 하위 호환성

- `formData.ts`의 함수들은 `formDataHelpers.ts`에서 deprecated로 제공
- 기존 코드는 자동으로 동작하지만, 새로운 코드는 `formDataHelpers.ts` 사용 권장

### 에러 처리 패턴

모든 마스터 콘텐츠 액션은 다음 패턴을 따릅니다:

```typescript
export const actionName = withErrorHandling(async (formData: FormData) => {
  await requireAdminOrConsultant();
  const tenantContext = await getTenantContext();
  
  // FormData 파싱
  const data = parseFormData(formData, tenantContext?.tenantId || null);
  
  // 검증
  if (!data.title) {
    throw new AppError(
      "제목은 필수입니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
  
  // 서비스 호출
  await serviceFunction(data);
  
  // 리다이렉트
  redirect("/path");
});
```

---

## 향후 개선 사항

1. **MasterBookEditForm 개선**: `MasterLectureEditForm`과 동일한 패턴 적용
2. **MasterBookForm 개선**: 클라이언트 사이드 검증 및 FormField/FormSelect 사용
3. **테스트 코드 추가**: 헬퍼 함수 및 액션에 대한 단위 테스트 작성

---

**작업 완료일**: 2025-02-15
