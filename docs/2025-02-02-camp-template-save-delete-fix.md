# 캠프 템플릿 저장 및 삭제 기능 수정

## 📋 작업 개요

관리자 영역의 캠프 템플릿 저장 기능에서 발생하던 에러를 수정하고, 삭제 기능을 점검했습니다.

## 🔍 문제 분석

### 저장 기능 문제

**에러 메시지**:
```
관리자 모드에서는 student_id 또는 draftGroupId가 필요합니다.
```

**원인**:
- `PlanGroupWizard`에서 템플릿 모드(`isTemplateMode={true}`)일 때 "저장" 버튼을 클릭하면 `handleSaveDraft`가 호출됨
- `handleSaveDraft`는 내부적으로 `usePlanDraft`의 `saveDraft`를 호출
- `saveDraft`는 `savePlanGroupDraftAction`을 호출하여 플랜 그룹을 저장하려고 시도
- 하지만 템플릿 모드에서는 플랜 그룹을 저장할 필요가 없고, `onTemplateSave` 콜백만 호출하면 됨
- 관리자 모드에서 플랜 그룹을 저장하려면 `student_id` 또는 `draftGroupId`가 필요한데, 템플릿 모드에서는 이 값들이 없어서 에러 발생

### 삭제 기능 점검

삭제 기능은 이미 잘 구현되어 있었습니다:
- 템플릿 삭제 전에 관련된 플랜 그룹 삭제
- `camp_template_block_sets` 테이블은 `ON DELETE CASCADE`로 설정되어 있어 자동 삭제됨
- 템플릿 삭제 후 캐시 무효화

## ✅ 해결 방안

### 1. 템플릿 모드에서 저장 버튼 처리 수정

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**변경 내용**:
- `handleSaveDraft` 함수를 수정하여 템플릿 모드일 때는 `onTemplateSave` 콜백을 호출하도록 변경
- 일반 모드일 때는 기존 로직(`executeSave`) 사용

```typescript
// 템플릿 모드일 때는 onTemplateSave 호출, 그 외에는 executeSave 호출
const handleSaveDraft = useCallback(
  async (silent: boolean = false) => {
    if (isTemplateMode && onTemplateSave) {
      // 템플릿 모드: onTemplateSave 콜백 호출
      try {
        await onTemplateSave(wizardData);
      } catch (error) {
        console.error("[PlanGroupWizard] Template save failed:", error);
        if (!silent) {
          toast.showError(
            error instanceof Error
              ? error.message
              : "템플릿 저장에 실패했습니다."
          );
        }
      }
    } else {
      // 일반 모드: 기존 로직 사용
      await executeSave(silent);
    }
  },
  [isTemplateMode, onTemplateSave, wizardData, executeSave, toast]
);
```

### 2. 삭제 기능 점검 결과

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**확인 사항**:
- ✅ 템플릿 삭제 전에 관련된 플랜 그룹 삭제 (`deletePlanGroupsByTemplateId`)
- ✅ `camp_template_block_sets` 테이블은 `ON DELETE CASCADE`로 설정되어 있어 자동 삭제됨
- ✅ 템플릿 삭제 후 캐시 무효화 (`revalidatePath`)

**삭제 순서**:
1. 관련 플랜 그룹 삭제 (`deletePlanGroupsByTemplateId`)
2. 템플릿 삭제 (`camp_templates` 테이블에서 삭제)
3. 블록 세트 연결 자동 삭제 (`camp_template_block_sets` - CASCADE)
4. 캐시 무효화

## 📝 변경 사항 요약

### 수정된 파일

1. **`app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`**
   - 템플릿 모드에서 저장 버튼 클릭 시 `onTemplateSave` 콜백 호출하도록 수정
   - 일반 모드에서는 기존 로직 유지

### 점검 완료

1. **`app/(admin)/actions/campTemplateActions.ts`**
   - 삭제 기능 정상 작동 확인
   - 관련 데이터 정리 로직 확인

## 🧪 테스트 시나리오

### 저장 기능 테스트

1. 관리자로 로그인
2. `/admin/camp-templates/new` 접속
3. 템플릿 기본 정보 입력
4. 위저드 단계 진행
5. "저장" 버튼 클릭
6. ✅ 템플릿이 정상적으로 저장되어야 함 (에러 없이)

### 삭제 기능 테스트

1. 관리자로 로그인
2. `/admin/camp-templates` 접속
3. 템플릿 카드의 드롭다운 메뉴에서 "삭제" 선택
4. 삭제 확인 다이얼로그에서 "삭제" 클릭
5. ✅ 템플릿과 관련된 모든 데이터가 정상적으로 삭제되어야 함

## 🎯 결과

- ✅ 템플릿 모드에서 저장 버튼 클릭 시 에러 해결
- ✅ 템플릿 저장 시 `onTemplateSave` 콜백이 정상적으로 호출됨
- ✅ 삭제 기능 정상 작동 확인

## 📚 참고 사항

- 템플릿 모드에서는 플랜 그룹을 생성하지 않고 템플릿만 저장함
- `camp_template_block_sets` 테이블은 `ON DELETE CASCADE`로 설정되어 있어 템플릿 삭제 시 자동으로 삭제됨
- 플랜 그룹 삭제는 `deletePlanGroupsByTemplateId` 함수에서 처리됨

