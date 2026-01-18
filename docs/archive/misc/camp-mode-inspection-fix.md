# 캠프 모드 점검 및 수정 작업

## 작업 일시
2024년 11월

## 개요
캠프 모드에서 발생하는 4가지 문제를 해결했습니다.

## 수정 사항

### 1. 학생: 캠프 모드 제출 상세보기에서 추천 콘텐츠 탭 제거

**문제**: 학생이 캠프 모드에서 초대 받은 템플릿 작성 후 제출한 템플릿 상세보기에서 추천 콘텐츠 상세보기 탭이 표시됨

**해결**:
- 파일: `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`
- `campSubmissionMode`일 때 탭 필터링을 `[1, 2, 4, 5]`에서 `[1, 2, 4]`로 변경하여 탭 5(추천 콘텐츠) 제외
- `allowedTabIds`도 동일하게 수정

**변경 내용**:
```typescript
// 캠프 제출 모드일 때 탭 필터링 (1, 2, 4만 표시, 추천 콘텐츠 제외)
const tabs = useMemo(() => {
  if (campSubmissionMode) {
    return allTabs.filter(tab => [1, 2, 4].includes(tab.id));
  }
  return allTabs;
}, [allTabs, campSubmissionMode]);

// 허용된 탭 ID 목록
const allowedTabIds = useMemo(() => {
  if (campSubmissionMode) {
    return [1, 2, 4];
  }
  return [1, 2, 3, 4, 5, 6, 7];
}, [campSubmissionMode]);
```

### 2. 템플릿 시간 블록 정보가 상세보기에 표시되지 않음

**문제**: 템플릿에 반영되어 있는 시간 블록 정보가 학생의 제출 상세보기에 표시되지 않음

**해결**:
- 파일: `app/(student)/camp/[invitationId]/submitted/page.tsx`
- 템플릿 블록 조회 로직 개선:
  - `template_data` 안전하게 파싱 (문자열/객체 모두 처리)
  - 에러 처리 및 디버깅 로그 추가
  - `block_set_id` 조회 로직 검증

**변경 내용**:
```typescript
// template_data 안전하게 파싱
let templateData: any = null;
if (template.template_data) {
  if (typeof template.template_data === "string") {
    templateData = JSON.parse(template.template_data);
  } else {
    templateData = template.template_data;
  }
}

const blockSetId = templateData?.block_set_id;

if (blockSetId) {
  // 템플릿 블록 세트 조회 (에러 처리 포함)
  const { data: templateBlockSet, error: blockSetError } = await supabase
    .from("template_block_sets")
    .select("id, name")
    .eq("id", blockSetId)
    .eq("template_id", group.camp_template_id)
    .maybeSingle();

  // 에러 처리 및 블록 조회 로직 개선
  // ...
}
```

### 3. 관리자 영역에서 학생의 추가 콘텐츠 정보가 제대로 조회되지 않음

**문제**: 관리자가 학생의 캠프 플랜 그룹을 조회할 때 추가 콘텐츠 정보(제목, 과목 등)가 제대로 표시되지 않음

**해결**:
- 파일: `app/(admin)/actions/campTemplateActions.ts`
- `getCampPlanGroupForReview` 함수에서 콘텐츠 상세 정보 조회 추가:
  - `classifyPlanContents` 함수를 사용하여 콘텐츠 상세 정보 조회
  - 학생 ID를 사용하여 콘텐츠 메타데이터 조회
  - 상세 정보를 포함한 `contentsWithDetails` 반환

- 파일: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/review/CampPlanGroupReviewForm.tsx`
- 클라이언트 컴포넌트에서 서버에서 이미 조회한 상세 정보를 우선 사용하도록 수정
- 커스텀 콘텐츠 조회 로직 추가

**변경 내용**:
```typescript
// 콘텐츠 상세 정보 조회 (관리자가 학생의 추가 콘텐츠 정보를 제대로 볼 수 있도록)
let contentsWithDetails = result.contents;
if (result.group.student_id && result.contents.length > 0) {
  try {
    const { classifyPlanContents } = await import("@/lib/data/planContents");
    const { studentContents, recommendedContents } = await classifyPlanContents(
      result.contents,
      result.group.student_id
    );

    // 상세 페이지 형식으로 변환
    const allContents = [...studentContents, ...recommendedContents];
    const contentsMap = new Map(allContents.map((c) => [c.content_id, c]));

    contentsWithDetails = result.contents.map((content) => {
      const detail = contentsMap.get(content.content_id);
      if (!detail) {
        return {
          ...content,
          contentTitle: "알 수 없음",
          contentSubtitle: null,
          isRecommended: false,
        };
      }

      return {
        ...content,
        contentTitle: detail.title || "알 수 없음",
        contentSubtitle: detail.subject_category || null,
        isRecommended: detail.isRecommended,
      };
    });
  } catch (error) {
    console.error("[getCampPlanGroupForReview] 콘텐츠 상세 정보 조회 실패:", error);
  }
}
```

### 4. 필수과목 선택 및 콘텐츠 제약 조건 조작 UI가 관리자 화면에 보이지 않음

**문제**: 관리자가 템플릿을 편집할 때 필수과목 선택 및 제약 조건을 설정할 수 있는 UI가 없음

**해결**:
- 파일: `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`
- `CampTemplateForm.tsx`의 필수과목 선택 UI 로직을 참고하여 편집 폼에 추가:
  - 필수과목 검증 활성화 체크박스
  - 개정교육과정 및 교과-과목 선택 UI
  - 선택된 필수 과목 목록 표시 및 관리
  - 템플릿 저장 시 `subject_constraints` 데이터 포함
  - 기존 템플릿 데이터에서 `subject_constraints` 로드

**변경 내용**:
- 상태 변수 추가 (curriculumRevisions, selectedRevisionId, subjectGroups, subjectsByGroup, expandedGroups, loadingSubjects, enableRequiredSubjectsValidation, requiredSubjects)
- useEffect로 개정교육과정 및 교과-과목 데이터 로드
- 필수과목 선택 UI 추가 (교과-과목 위계 구조)
- `handleTemplateUpdate`에서 `subject_constraints` 포함
- `initialData`에서 기존 `subject_constraints` 로드

## 테스트 확인 사항

1. 학생이 캠프 모드에서 템플릿 제출 후 상세보기에서 추천 콘텐츠 탭이 표시되지 않는지 확인
2. 학생이 캠프 모드에서 템플릿 제출 후 상세보기에서 시간 블록 정보가 표시되는지 확인
3. 관리자가 학생의 캠프 플랜 그룹을 조회할 때 추가 콘텐츠 정보가 제대로 표시되는지 확인
4. 관리자가 템플릿 편집 시 필수과목 선택 및 제약 조건을 설정할 수 있는지 확인

## 관련 파일

- `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`
- `app/(student)/camp/[invitationId]/submitted/page.tsx`
- `app/(admin)/actions/campTemplateActions.ts`
- `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/review/CampPlanGroupReviewForm.tsx`

