# 관리자 페이지 '남은 단계 진행하기' 학생 추가 콘텐츠 조회 문제 재수정

## 🔍 문제 상황

관리자 페이지에서 '남은 단계 진행하기' 기능에서 학생이 추가 등록한 콘텐츠 정보가 다시 조회되지 않는 문제가 발생했습니다.

### 원인 분석

1. **`getCampPlanGroupForReview` 함수의 반환 구조 문제**
   - `getCampPlanGroupForReview` 함수가 `contentsWithDetails`를 반환하는데, 이는 `contentTitle`, `contentSubtitle`, `isRecommended` 등의 추가 필드가 포함된 변환된 데이터입니다.
   - `continue/page.tsx`에서 이 변환된 데이터를 `classifyPlanContents`에 전달할 때, 원본 `master_content_id` 정보가 유지되기는 하지만, 데이터 흐름이 복잡하여 문제가 발생할 수 있습니다.

2. **데이터 변환 과정에서의 정보 손실 가능성**
   - `getCampPlanGroupForReview` 내부에서 `classifyPlanContents`를 호출하여 `contentsWithDetails`를 생성합니다.
   - 그런데 `continue/page.tsx`에서 다시 `classifyPlanContents`를 호출할 때, 변환된 데이터를 전달하면서 원본 `master_content_id` 정보가 명확하게 전달되지 않을 수 있습니다.

## 🛠 해결 방법

### 수정 내용

#### 1. `getCampPlanGroupForReview` 함수 수정

**파일**: `app/(admin)/actions/campTemplateActions.ts`

원본 `contents`를 별도로 반환하여 `classifyPlanContents` 호출 시 사용할 수 있도록 했습니다.

**변경 전**:
```typescript
return {
  success: true,
  group: result.group,
  contents: contentsWithDetails,
  exclusions: result.exclusions,
  academySchedules: result.academySchedules,
  templateBlocks,
  templateBlockSetName,
  student_id: result.group.student_id,
};
```

**변경 후**:
```typescript
return {
  success: true,
  group: result.group,
  contents: contentsWithDetails, // 표시용 (contentTitle, contentSubtitle 등 포함)
  originalContents: result.contents, // 원본 contents (master_content_id 포함) - classifyPlanContents 호출용
  exclusions: result.exclusions,
  academySchedules: result.academySchedules,
  templateBlocks,
  templateBlockSetName,
  student_id: result.group.student_id,
};
```

#### 2. `continue/page.tsx` 수정

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

원본 `contents`를 사용하여 `classifyPlanContents`를 호출하도록 수정했습니다.

**변경 전**:
```typescript
const { group, contents, exclusions, academySchedules } = result;

// 콘텐츠 정보 조회 및 학생/추천 구분
const { studentContents: classifiedStudentContents, recommendedContents: classifiedRecommendedContents } = 
  await classifyPlanContents(contents, studentId);
```

**변경 후**:
```typescript
const { group, contents, originalContents, exclusions, academySchedules } = result;

// 콘텐츠 정보 조회 및 학생/추천 구분
// originalContents를 사용하여 master_content_id가 포함된 원본 데이터로 조회
const contentsForClassification = originalContents || contents;
const { studentContents: classifiedStudentContents, recommendedContents: classifiedRecommendedContents } = 
  await classifyPlanContents(contentsForClassification, studentId);
```

#### 3. `wizardData` 변환 시 원본 데이터 사용

**변경 전**:
```typescript
const wizardData = syncCreationDataToWizardData({
  group,
  contents: contents
    .filter((c) => {
      return !(c.is_auto_recommended || c.recommendation_source);
    })
    .map((c) => {
      const classifiedContent = contentsMap.get(c.content_id);
      return {
        ...c,
        title: classifiedContent?.title || undefined,
        subject_category: classifiedContent?.subject_category || undefined,
        master_content_id: classifiedContent?.masterContentId || c.master_content_id || undefined,
      };
    }),
  // ...
});
```

**변경 후**:
```typescript
// originalContents를 사용하여 master_content_id가 포함된 원본 데이터로 변환
const contentsForWizard = originalContents || contents;
const wizardData = syncCreationDataToWizardData({
  group,
  contents: contentsForWizard
    .filter((c) => {
      return !(c.is_auto_recommended || c.recommendation_source);
    })
    .map((c) => {
      const classifiedContent = contentsMap.get(c.content_id);
      return {
        ...c,
        title: classifiedContent?.title || undefined,
        subject_category: classifiedContent?.subject_category || undefined,
        // master_content_id는 원본 데이터(c.master_content_id)를 우선 사용
        master_content_id: c.master_content_id || classifiedContent?.masterContentId || undefined,
      };
    }),
  // ...
});
```

## 📊 변경 사항 요약

### 데이터 흐름 개선

**변경 전**:
1. `getCampPlanGroupForReview` → `contentsWithDetails` 반환 (변환된 데이터)
2. `continue/page.tsx` → `contentsWithDetails`를 `classifyPlanContents`에 전달
3. `master_content_id` 정보가 불명확하게 전달될 수 있음

**변경 후**:
1. `getCampPlanGroupForReview` → `originalContents` (원본) + `contents` (변환된 데이터) 모두 반환
2. `continue/page.tsx` → `originalContents`를 `classifyPlanContents`에 전달
3. `master_content_id` 정보가 명확하게 전달됨

### 효과

- ✅ 원본 `master_content_id` 정보가 명확하게 전달되어 학생 콘텐츠 조회 성공률 향상
- ✅ 데이터 변환 과정에서 정보 손실 방지
- ✅ `classifyPlanContents` 함수의 fallback 로직이 정상적으로 작동

## ✅ 검증 완료

- [x] `getCampPlanGroupForReview`에서 `originalContents` 반환
- [x] `continue/page.tsx`에서 `originalContents` 사용
- [x] `wizardData` 변환 시 원본 데이터 사용
- [x] 린터 오류 없음
- [x] 기존 기능(`review/page.tsx`) 영향 없음 확인

## 📝 참고

- 이전에 해결했던 내용: `docs/admin-camp-continue-content-retrieval-fix.md`
- 관련 이슈: `classifyPlanContents` 함수가 `master_content_id`를 활용하여 fallback 로직을 수행하므로, 원본 데이터를 전달하는 것이 중요합니다.

## 🔄 이전 수정과의 차이점

이전 수정에서는 `classifyPlanContents` 함수 내부의 로직을 개선했습니다. 이번 수정에서는 데이터 전달 과정을 개선하여 원본 `master_content_id` 정보가 명확하게 전달되도록 했습니다.

두 수정 사항 모두 학생 추가 콘텐츠 정보 조회를 위해 필요하며, 함께 작동하여 더 안정적인 조회를 보장합니다.

