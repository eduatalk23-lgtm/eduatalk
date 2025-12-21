# TypeScript 에러 대량 수정 작업

## 작업 일시
2025-01-21

## 작업 개요
`npx tsc --noEmit` 명령어로 확인된 TypeScript 에러를 대량으로 수정했습니다.

## 에러 개수 변화
- **시작**: 202개
- **종료**: 103개
- **해결**: 99개 (약 49% 감소)

## 주요 수정 사항

### 1. ActionResponse 직접 사용 문제 해결 (21개)
ActionResponse를 반환하는 함수의 결과를 바로 사용하던 문제를 수정했습니다.

**수정 파일**:
- `app/(admin)/admin/sms/_components/SMSFilterPanel.tsx`
- `app/(admin)/admin/students/_components/StudentSearchFilter.tsx`
- `app/(admin)/admin/students/divisions/_components/DivisionFilters.tsx`
- `app/(admin)/admin/students/divisions/_components/BulkDivisionUpdateModal.tsx`
- `app/(admin)/admin/students/divisions/_components/DivisionStudentList.tsx`
- `app/(admin)/admin/students/divisions/items/_components/StudentDivisionsManager.tsx`
- `app/(parent)/parent/settings/_components/StudentSearchModal.tsx`
- `app/(parent)/parent/settings/page.tsx`
- `app/(student)/blocks/_components/BlocksViewer.tsx`
- `app/(student)/blocks/_components/BlockSetTabs.tsx`
- `app/(student)/plan/new-group/_components/_features/basic-info/hooks/useBlockSetManagement.ts`

**수정 패턴**:
```typescript
// ❌ 이전
const data = await getActiveStudentDivisionsAction();
const options = data.map((d) => ({ ... }));

// ✅ 수정 후
const result = await getActiveStudentDivisionsAction();
if (isSuccessResponse(result) && result.data) {
  const options = result.data.map((d) => ({ ... }));
}
```

### 2. Import Declaration Conflicts 해결 (66개)
같은 이름의 함수를 import하고 로컬에서도 선언하여 발생한 충돌을 해결했습니다.

**수정 파일**:
- `app/actions/blocks.ts`
- `app/actions/blockSets.ts`
- `app/actions/scores-internal.ts`
- `lib/data/blockSets.ts`
- `lib/data/contentMasters.ts`

**수정 패턴**:
```typescript
// ❌ 이전
import { updateBlock, deleteBlock } from "@/lib/data/blockSets";
export const updateBlock = withActionResponse(_updateBlock);

// ✅ 수정 후
import { updateBlock as updateBlockData, deleteBlock as deleteBlockData } from "@/lib/data/blockSets";
export const updateBlock = withActionResponse(_updateBlock);
```

### 3. isErrorResponse 제네릭 타입 지원 추가 (9개)
`isErrorResponse` 함수에 제네릭 타입을 추가하여 타입 안전성을 개선했습니다.

**수정 파일**:
- `lib/types/actionResponse.ts`

**수정 내용**:
```typescript
// ❌ 이전
export function isErrorResponse(
  response: ActionResponse
): response is { ... }

// ✅ 수정 후
export function isErrorResponse<T = void>(
  response: ActionResponse<T>
): response is { ... }
```

### 4. 함수 시그니처 불일치 해결 (1개)
함수 인자 개수 불일치를 수정했습니다.

**수정 파일**:
- `app/(student)/actions/scoreActions.ts`

**수정 내용**:
```typescript
// ❌ 이전
const result = await updateMockScore(id, user.userId, updates);

// ✅ 수정 후
const result = await updateMockScoreData(id, user.userId, user.tenantId || "", updates);
```

### 5. ExcelActions ActionResponse 변환 로직 개선
ExcelActions에서 ActionResponse를 올바르게 변환하도록 수정했습니다.

**수정 파일**:
- `app/(admin)/admin/master-books/_components/ExcelActions.tsx`
- `app/(admin)/admin/master-lectures/_components/ExcelActions.tsx`

### 6. useBlockSetManagement getTenantBlockSets 분기 처리
`getTenantBlockSets`는 `ActionResponse`를 반환하지 않으므로 분기 처리를 추가했습니다.

**수정 파일**:
- `app/(student)/plan/new-group/_components/_features/basic-info/hooks/useBlockSetManagement.ts`

## 남은 주요 에러 패턴

### 1. studentId 필수 속성 누락
여러 파일에서 `PlanGroupWizardProps`의 `studentId` 필수 속성이 누락되었습니다.

**에러 파일**:
- `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`
- `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`
- `app/(student)/camp/[invitationId]/page.tsx`
- `app/(student)/plan/group/[id]/edit/page.tsx`

### 2. FormEvent 타입 불일치
`FormEvent<HTMLFormElement>`와 `FormEvent<Element>` 간의 타입 불일치가 발생했습니다.

**에러 파일**:
- `app/(admin)/admin/subjects/_components/GroupForm.tsx`
- `app/(admin)/admin/subjects/_components/GroupFormModal.tsx`
- `app/(admin)/admin/subjects/_components/SubjectForm.tsx`
- `app/(admin)/admin/subjects/_components/SubjectFormModal.tsx`
- `app/(admin)/admin/subjects/_components/SubjectTypeForm.tsx`
- `app/(admin)/admin/subjects/_components/SubjectTypeFormModal.tsx`

### 3. DayOfWeek vs number 타입 불일치
`day_of_week` 필드가 `number`로 전달되지만 `DayOfWeek` 타입을 기대하는 문제가 있습니다.

**에러 파일**:
- `app/(admin)/admin/camp-templates/[id]/time-management/_components/TemplateBlockSetManagement.tsx`
- `app/(admin)/admin/time-management/[templateId]/_components/TemplateBlockSetManagement.tsx`
- `app/(admin)/admin/time-management/_components/TemplateBlockSetManagement.tsx`

### 4. null/undefined 타입 처리
`SMSTemplate | null | undefined`를 `SMSTemplate | null`에 할당할 수 없는 문제가 있습니다.

**에러 파일**:
- `app/(admin)/admin/sms/_components/SMSSendForm.tsx`

## 다음 단계
1. `studentId` 필수 속성 추가
2. `FormEvent` 타입 불일치 해결
3. `DayOfWeek` 타입 변환 로직 추가
4. null/undefined 타입 처리 개선

## 참고
- 모든 수정 사항은 TypeScript strict mode를 준수합니다.
- ActionResponse 패턴은 프로젝트 표준을 따릅니다.
- Import conflicts는 함수 이름 변경으로 해결했습니다.

