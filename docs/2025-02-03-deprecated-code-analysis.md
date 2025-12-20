# Deprecated 코드 분석 보고서

**작업 일자**: 2025-02-03  
**작업 내용**: Deprecated 코드 식별 및 사용 현황 분석

## 분석 개요

리팩토링 과정에서 더 이상 사용되지 않거나 `@deprecated` 주석이 달린 함수들을 식별하고, 사용 현황을 분석했습니다.

## 발견된 Deprecated 코드

### 1. `campTemplateActions.ts` - 단순 Re-export (정상)

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**상태**: ✅ 정상 (Deprecated 아님)

**내용**:
```typescript
// app/(admin)/actions/campTemplateActions.ts
export * from './camp-templates/crud';
export * from './camp-templates/participants';
export * from './camp-templates/progress';
export * from './camp-templates/types';
```

**분석 결과**:
- 단순히 `camp-templates/` 폴더의 함수들을 re-export하는 역할
- 많은 곳에서 사용 중 (33곳에서 import)
- 하위 호환성을 위한 정상적인 구조
- **제거 불필요**: 현재 구조가 유지보수에 유리함

**사용처 예시**:
- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
- `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- 등 33곳

---

### 2. 학교 관련 Deprecated 함수들

**파일**: `app/(admin)/actions/schoolActions.ts`

#### 2.1 `createSchool` 함수

**상태**: ⚠️ Deprecated (사용 중)

**주석**:
```typescript
/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 생성은 더 이상 지원되지 않습니다.
 */
export const createSchool = withErrorHandling(...)
```

**사용처**:
- `app/(admin)/admin/schools/new/SchoolForm.tsx` (18줄)
- `app/(admin)/admin/schools/_components/SchoolFormModal.tsx` (97줄)

**반환값**:
```typescript
{
  success: false,
  error: "학교 데이터는 외부 데이터(나이스 등) 기반으로 읽기 전용입니다. 학교 추가가 필요하면 관리자에게 문의하세요."
}
```

**권장 사항**:
- UI에서 이 함수를 호출하는 부분을 제거하거나
- 학교 생성 기능을 완전히 비활성화하는 것이 좋음
- 현재는 에러 메시지만 표시하고 있음

#### 2.2 `updateSchool` 함수

**상태**: ⚠️ Deprecated (사용 중)

**주석**:
```typescript
/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 수정은 더 이상 지원되지 않습니다.
 */
export const updateSchool = withErrorHandling(...)
```

**사용처**:
- `app/(admin)/admin/schools/[id]/edit/SchoolEditForm.tsx` (43줄)

**권장 사항**:
- 학교 수정 기능을 완전히 비활성화하는 것이 좋음

#### 2.3 `deleteSchool` 함수

**상태**: ⚠️ Deprecated (사용 중)

**주석**:
```typescript
/**
 * @deprecated 새 테이블은 읽기 전용입니다.
 * 학교 삭제는 더 이상 지원되지 않습니다.
 */
export const deleteSchool = withErrorHandling(...)
```

**사용처**:
- `app/(admin)/admin/schools/[id]/edit/SchoolEditForm.tsx` (67줄)
- `app/(admin)/admin/schools/_components/SchoolTable.tsx` (61줄)

**권장 사항**:
- 학교 삭제 기능을 완전히 비활성화하는 것이 좋음

---

### 3. 학생 관리 Deprecated 함수

**파일**: `app/(admin)/actions/studentManagementActions.ts`

#### 3.1 `validateConnectionCode` 함수

**상태**: ⚠️ Deprecated (사용 여부 확인 필요)

**주석**:
```typescript
/**
 * 연결 코드 검증 (회원가입 시 사용)
 * 공통 모듈로 이동됨 - lib/utils/connectionCodeUtils.ts
 * 
 * @deprecated 이 함수는 lib/utils/connectionCodeUtils.ts의 validateConnectionCode를 사용하세요.
 */
export async function validateConnectionCode(...)
```

**대체 함수**: `lib/utils/connectionCodeUtils.ts`의 `validateConnectionCode`

**사용처 확인 필요**:
- 프로젝트 전체에서 `studentManagementActions`의 `validateConnectionCode`를 import하는 곳이 있는지 확인 필요

**권장 사항**:
- 사용처가 없으면 제거
- 사용처가 있으면 `lib/utils/connectionCodeUtils.ts`로 마이그레이션

---

### 4. 콘텐츠 메타데이터 Deprecated 함수들

**파일**: `app/(admin)/actions/contentMetadataActions.ts`

#### 4.1 `getSubjectCategoriesAction` 함수

**상태**: ⚠️ Deprecated (하위 호환성 유지)

**주석**:
```typescript
/**
 * @deprecated 이 함수는 더 이상 사용되지 않습니다. getSubjectGroupsAction을 사용하세요.
 */
export const getSubjectCategoriesAction = withErrorHandling(async (revisionId?: string) => {
  // subject_groups로 변환하여 반환 (하위 호환성)
  const { getSubjectGroupsAction } = await import("./subjectActions");
  const groups = await getSubjectGroupsAction(revisionId);
  // ...
});
```

**분석**:
- 내부적으로 `getSubjectGroupsAction`을 호출하여 하위 호환성 유지
- 실제 사용처 확인 필요

**권장 사항**:
- 사용처가 없으면 제거
- 사용처가 있으면 마이그레이션 후 제거

#### 4.2 `getSubjectsAction` 함수

**상태**: ⚠️ Deprecated (하위 호환성 유지)

**주석**:
```typescript
/**
 * @deprecated 이 함수는 더 이상 사용되지 않습니다. getSubjectsByGroupAction을 사용하세요.
 */
export const getSubjectsAction = withErrorHandling(async (subjectCategoryId?: string) => {
  // ...
});
```

**대체 함수**: `getSubjectsByGroupAction`

**권장 사항**:
- 사용처 확인 후 마이그레이션 또는 제거

---

## 권장 조치 사항

### 즉시 조치 가능 (사용처 없음)

1. **`validateConnectionCode`** (studentManagementActions.ts)
   - 사용처 확인 후 제거 또는 마이그레이션

### 신중한 조치 필요 (사용 중)

1. **학교 관련 함수들** (`createSchool`, `updateSchool`, `deleteSchool`)
   - UI에서 호출하는 부분 제거 또는 비활성화
   - 함수는 에러 메시지만 반환하므로 유지해도 무방하나, UI 개선 권장

2. **콘텐츠 메타데이터 함수들** (`getSubjectCategoriesAction`, `getSubjectsAction`)
   - 사용처 확인 후 마이그레이션 계획 수립

### 유지 권장

1. **`campTemplateActions.ts`**
   - 단순 re-export이지만 많은 곳에서 사용 중
   - 하위 호환성을 위해 유지 권장

---

## 다음 단계

1. **사용처 확인**: 각 deprecated 함수의 실제 사용처를 grep으로 확인
2. **마이그레이션 계획 수립**: 사용 중인 함수들의 마이그레이션 계획 작성
3. **UI 개선**: 학교 관련 기능 비활성화 또는 제거
4. **문서화**: 마이그레이션 가이드 작성

