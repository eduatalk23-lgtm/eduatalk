<!-- d1c97a84-1b50-47ae-a02e-493b0455116f d0e24699-6525-4e87-ba49-aca95e9f9d2f -->
# 마스터 콘텐츠 CRUD 폼 최적화 계획

## 문제점 요약

### 1. 중복 코드 (4곳)

- 개정교육과정/교과 그룹/과목 선택 로직이 `MasterBookForm`, `MasterCustomContentForm`, `MasterBookEditForm`, `MasterCustomContentEditForm`에서 중복
- 약 1,500줄의 중복 코드

### 2. Form 필드 스타일링 중복

- 모든 폼에서 동일한 className 패턴 반복
- `FormField`, `FormSelect` 컴포넌트가 있으나 미사용

### 3. 에러 처리 패턴 중복

- `alert` 사용 (사용자 경험 저하)
- `useTransition` 사용 중이지만 `useActionState` 미사용 (Next.js 15 권장과 불일치)

### 4. Zod 스키마 미적용

- `lib/validation/schemas.ts`에 스키마 존재하나 마스터 콘텐츠 폼에는 적용되지 않음
- 클라이언트 사이드 검증 부재

## 수정 계획

### Phase 1: 공통 로직 추출

#### 1.1 Subject Selection Hook 생성

**파일**: `hooks/useSubjectSelection.ts` (신규 생성)

**기능**:

- 개정교육과정/교과 그룹/과목 선택 로직 통합
- 상태 관리 및 핸들러 함수 제공
- FormData 처리 헬퍼 포함

**구현 내용**:

```typescript
export function useSubjectSelection(
  curriculumRevisions: CurriculumRevision[],
  initialRevisionId?: string,
  initialGroupId?: string,
  initialSubjectId?: string
) {
  // 상태 관리
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(initialRevisionId || "");
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || "");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || "");
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<(SubjectGroup & { subjects: Subject[] })[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 핸들러 함수들
  async function handleCurriculumRevisionChange(e: React.ChangeEvent<HTMLSelectElement>) { ... }
  function handleSubjectGroupChange(e: React.ChangeEvent<HTMLSelectElement>) { ... }
  function handleSubjectChange(e: React.ChangeEvent<HTMLSelectElement>) { ... }
  
  // FormData 처리 헬퍼
  function addSubjectDataToFormData(formData: FormData) {
    if (selectedGroupId) {
      const selectedGroup = subjectGroups.find(g => g.id === selectedGroupId);
      if (selectedGroup) {
        formData.set("subject_group_id", selectedGroup.id);
        formData.set("subject_category", selectedGroup.name);
      }
    }
    if (selectedSubjectId) {
      const selectedSubject = selectedSubjects.find(s => s.id === selectedSubjectId);
      if (selectedSubject) {
        formData.set("subject", selectedSubject.name);
      }
    }
  }

  return {
    selectedRevisionId,
    selectedGroupId,
    selectedSubjectId,
    selectedSubjects,
    subjectGroups,
    loadingGroups,
    handleCurriculumRevisionChange,
    handleSubjectGroupChange,
    handleSubjectChange,
    addSubjectDataToFormData,
  };
}
```

#### 1.2 Subject Selection 컴포넌트 생성

**파일**: `components/forms/SubjectSelectionFields.

### To-dos

- [ ] hooks/useSubjectSelection.ts 생성 - 개정교육과정/교과 그룹/과목 선택 로직 통합
- [ ] components/forms/SubjectSelectionFields.tsx 생성 - Subject 선택 UI 컴포넌트
- [ ] components/forms/MasterContentFormLayout.tsx 생성 - 공통 Form 레이아웃
- [ ] lib/constants/masterContent.ts 생성 - 마스터 콘텐츠 상수 정의
- [ ] MasterBookForm.tsx 리팩토링 - useSubjectSelection, FormField/FormSelect 사용
- [ ] MasterBookEditForm.tsx 리팩토링 - useSubjectSelection, FormField/FormSelect 사용
- [ ] MasterLectureForm.tsx 리팩토링 - FormField/FormSelect 사용
- [ ] MasterCustomContentForm.tsx 리팩토링 - useSubjectSelection, FormField/FormSelect 사용
- [ ] MasterCustomContentEditForm.tsx 리팩토링 - useSubjectSelection, FormField/FormSelect 사용
- [ ] masterContentActions.ts 및 masterCustomContentActions.ts에 useActionState 지원 추가
- [ ] lib/validation/schemas.ts에 마스터 콘텐츠 스키마 추가 (masterBookSchema, masterLectureSchema, masterCustomContentSchema)
- [ ] 모든 마스터 콘텐츠 폼에 클라이언트 사이드 Zod 검증 추가
- [ ] 모든 마스터 콘텐츠 폼에서 alert를 useToast로 교체