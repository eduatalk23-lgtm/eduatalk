# 관리자 모드 플랜 그룹 임시저장 에러 수정

## 📋 문제 개요

**에러 메시지**: "관리자 모드에서는 student_id 또는 draftGroupId가 필요합니다."  
**발생 위치**: `app/(student)/actions/plan-groups/create.ts:394`  
**에러 타입**: `AppError` (Validation Error)

## 🔍 원인 분석

관리자 모드에서 캠프 템플릿 참여자의 남은 단계를 진행할 때 플랜 그룹을 임시저장하려고 하면 에러가 발생했습니다.

### 문제점

1. **타입 정의 누락**: `usePlanSubmission`의 `initialData` 타입에 `student_id`와 `studentId`가 포함되어 있지 않았습니다.
2. **옵션 전달 로직 불완전**: `usePlanDraft`에서 `initialData?.groupId`를 확인하지 않아, 기존 그룹이 있을 때 `draftGroupId`로 사용하지 못했습니다.

### 에러 발생 흐름

1. `continue/page.tsx`에서 `initialData`에 `student_id`와 `groupId` 설정
2. `PlanGroupWizard` → `usePlanSubmission` → `usePlanDraft`로 전달
3. `usePlanDraft`의 `saveDraft`에서 `initialData?.student_id` 확인
4. `initialData`가 `usePlanSubmission`의 타입 정의에 맞지 않아 타입 체크 실패 가능성
5. `_savePlanGroupDraft`에서 `options?.studentId` 또는 `options?.draftGroupId`가 없어 에러 발생

## ✅ 해결 방법

### 1. `usePlanSubmission` 타입 정의 수정

`initialData` 타입에 `student_id`와 `studentId` 필드를 추가했습니다.

```typescript
// app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts
initialData?: {
  templateId?: string;
  groupId?: string;
  student_id?: string;  // 추가
  studentId?: string;   // 추가
};
```

### 2. `usePlanDraft` 옵션 전달 로직 개선

`initialData?.groupId`도 확인하여 `draftGroupId`로 사용하도록 수정했습니다.

```typescript
// app/(student)/plan/new-group/_components/hooks/usePlanDraft.ts
const studentId = initialData?.student_id || initialData?.studentId;
const groupIdFromInitialData = initialData?.groupId;  // 추가
const options = studentId
  ? { studentId }
  : groupIdFromInitialData  // 추가: initialData의 groupId를 draftGroupId로 사용
  ? { draftGroupId: groupIdFromInitialData }
  : draftGroupId
  ? { draftGroupId }
  : undefined;
```

## 📝 변경 사항

### 수정된 파일

1. **`app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts`**
   - `initialData` 타입에 `student_id`, `studentId` 필드 추가

2. **`app/(student)/plan/new-group/_components/hooks/usePlanDraft.ts`**
   - `initialData?.groupId` 확인 로직 추가
   - 옵션 전달 우선순위: `studentId` → `groupIdFromInitialData` → `draftGroupId`

## 🧪 테스트 시나리오

다음 시나리오에서 정상 동작하는지 확인:

1. **관리자 모드 - 남은 단계 진행**
   - `/admin/camp-templates/[id]/participants/[groupId]/continue`
   - `initialData`에 `student_id`와 `groupId` 포함
   - 임시저장 시 정상 동작

2. **학생 모드 - 일반 플랜 생성**
   - 기존 동작 유지 확인

3. **관리자 모드 - 새 플랜 생성**
   - `initialData`에 `student_id`만 포함
   - 임시저장 시 정상 동작

## 🔗 관련 파일

- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`
- `app/(student)/plan/new-group/_components/hooks/usePlanSubmission.ts`
- `app/(student)/plan/new-group/_components/hooks/usePlanDraft.ts`
- `app/(student)/actions/plan-groups/create.ts` (`_savePlanGroupDraft`)

## ✅ 해결 완료

관리자 모드에서 플랜 그룹 임시저장 시 `student_id` 또는 `draftGroupId`가 제대로 전달되도록 수정했습니다.

---

**수정 완료일**: 2025-02-02

