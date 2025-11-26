# 캠프 모드 Step6 콘텐츠 저장 보장 및 플랜 생성 실패 해결

## 문제 상황

관리자-학생-관리자 흐름으로 모든 항목을 입력받았는데도, Step6에서 플랜 생성 시 다음과 같은 에러가 발생했습니다:

```
생성된 플랜이 없습니다. 기간, 제외일, 블록 설정을 확인해주세요. (콘텐츠 개수: 0개, 사용 가능한 날짜: 29일, 제외일: 0개, 학원 일정: 0개)
```

에러 메시지에서 "콘텐츠 개수: 0개"가 핵심 문제였습니다.

## 원인 분석

### 1. 콘텐츠가 plan_contents 테이블에 저장되지 않음

`continueCampStepsForAdmin` 함수에서 콘텐츠를 업데이트하는 로직이 있지만, 다음 경우에 콘텐츠가 저장되지 않을 수 있습니다:

1. **wizardData에 콘텐츠가 없는 경우**: `creationData.contents`가 빈 배열이 되어 저장 로직이 실행되지 않음
2. **콘텐츠 변환 실패**: 마스터 콘텐츠를 학생 콘텐츠로 변환하는 과정에서 모든 콘텐츠가 필터링됨
3. **Step 6에서 플랜 생성 전 콘텐츠 미저장**: Step 6에서 플랜을 생성하기 전에 콘텐츠가 `plan_contents` 테이블에 저장되지 않았을 수 있음

### 2. 플랜 생성 시 콘텐츠 조회 실패

`_generatePlansFromGroup` 함수에서 `getPlanGroupWithDetailsForAdmin`을 호출하여 콘텐츠를 조회하는데, 이 시점에 `plan_contents` 테이블이 비어있으면 `contents`가 빈 배열이 됩니다.

## 해결 방법

### 1. Step 6에서 플랜 생성 전 콘텐츠 저장 보장

Step 6에서 플랜 생성 전에 `wizardData`의 콘텐츠를 `plan_contents` 테이블에 저장하도록 보장하는 로직을 추가했습니다:

```typescript
// 2. 콘텐츠 검증 및 저장 보장
const studentContents = wizardData.student_contents || [];
const recommendedContents = wizardData.recommended_contents || [];
const totalContents = studentContents.length + recommendedContents.length;

// plan_contents 테이블에 콘텐츠가 있는지 확인
const { data: existingPlanContents } = await supabase
  .from("plan_contents")
  .select("id")
  .eq("plan_group_id", groupId)
  .limit(1);

const hasPlanContents = existingPlanContents && existingPlanContents.length > 0;

// wizardData에 콘텐츠가 있고 plan_contents에 없으면 저장
if (totalContents > 0 && !hasPlanContents) {
  // creationData를 다시 생성하여 콘텐츠 저장
  const creationDataForContents = syncWizardDataToCreationData(
    wizardData as WizardData
  );

  if (creationDataForContents.contents && creationDataForContents.contents.length > 0) {
    // 마스터 콘텐츠를 학생 콘텐츠로 변환하는 로직
    // ... (변환 로직)
    
    // plan_contents 테이블에 저장
    await createPlanContents(groupId, tenantContext.tenantId, validContents);
  }
}
```

### 2. 마스터 콘텐츠를 학생 콘텐츠로 변환

캠프 모드에서는 추천 콘텐츠가 마스터 콘텐츠 ID로 전달될 수 있으므로, 이를 학생 콘텐츠 ID로 변환하는 로직을 추가했습니다:

```typescript
// 마스터 교재인 경우, 해당 학생의 교재를 master_content_id로 찾기
const { data: studentBookByMaster } = await supabase
  .from("books")
  .select("id, master_content_id")
  .eq("student_id", studentId)
  .eq("master_content_id", content.content_id)
  .maybeSingle();

if (studentBookByMaster) {
  isValidContent = true;
  actualContentId = studentBookByMaster.id;
  masterContentId = content.content_id; // 원본 마스터 콘텐츠 ID
}
```

### 3. 추천 콘텐츠 정보 저장

추천 콘텐츠의 경우 `is_auto_recommended`, `recommendation_source`, `recommendation_reason` 등의 정보도 함께 저장하도록 수정했습니다:

```typescript
const contentsToSave = validContents.map((c, idx) => {
  const isRecommended = recommendedContentIds.has(c.content_id) || 
    (c.master_content_id && recommendedContentIds.has(c.master_content_id));
  
  // wizardData에서 추천 정보 가져오기
  const recommendedContent = recommendedContents.find(
    (rc) => rc.content_id === c.content_id || rc.content_id === c.master_content_id
  );
  
  return {
    content_type: c.content_type,
    content_id: c.content_id,
    start_range: c.start_range,
    end_range: c.end_range,
    display_order: c.display_order ?? idx,
    master_content_id: c.master_content_id || null,
    is_auto_recommended: (recommendedContent as any)?.is_auto_recommended ?? false,
    recommendation_source: (recommendedContent as any)?.recommendation_source ?? (isRecommended ? "admin" : null),
    recommendation_reason: (recommendedContent as any)?.recommendation_reason ?? null,
    recommendation_metadata: (recommendedContent as any)?.recommendation_metadata ?? null,
  };
});
```

### 4. 최종 콘텐츠 검증

플랜 생성 전에 최종적으로 `plan_contents` 테이블에 콘텐츠가 있는지 확인하고, 없으면 에러를 발생시킵니다:

```typescript
// 최종 콘텐츠 검증 (plan_contents 테이블 확인)
const { data: finalPlanContents } = await supabase
  .from("plan_contents")
  .select("id")
  .eq("plan_group_id", groupId)
  .limit(1);

if (!finalPlanContents || finalPlanContents.length === 0) {
  validationErrors.push(
    "플랜에 포함될 콘텐츠가 없습니다. Step 3 또는 Step 4에서 콘텐츠를 선택해주세요."
  );
}
```

## 수정된 파일

1. `app/(admin)/actions/campTemplateActions.ts`
   - Step 6에서 플랜 생성 전 콘텐츠 저장 보장 로직 추가
   - 마스터 콘텐츠를 학생 콘텐츠로 변환하는 로직 추가
   - 추천 콘텐츠 정보 저장 로직 추가
   - 최종 콘텐츠 검증 로직 추가

## 효과

1. **콘텐츠 저장 보장**: Step 6에서 플랜 생성 전에 콘텐츠가 반드시 `plan_contents` 테이블에 저장됩니다.
2. **마스터 콘텐츠 변환**: 추천 콘텐츠가 마스터 콘텐츠 ID로 전달되어도 학생 콘텐츠 ID로 변환되어 저장됩니다.
3. **추천 정보 보존**: 추천 콘텐츠의 추천 이유, 우선순위 등의 정보가 함께 저장됩니다.
4. **에러 방지**: 플랜 생성 시 콘텐츠가 0개인 문제를 해결했습니다.

## 테스트 시나리오

1. 관리자-학생-관리자 흐름으로 캠프 플랜 그룹 생성
2. Step 3에서 학생 콘텐츠 선택 (마스터에서 가져온 콘텐츠 포함)
3. Step 4에서 추천 콘텐츠 선택 (마스터 콘텐츠)
4. Step 6에서 최종 확인 및 조정
5. **기대 결과**: 
   - 콘텐츠가 `plan_contents` 테이블에 저장됨
   - 플랜이 정상적으로 생성됨 (콘텐츠 개수 > 0)

## 관련 이슈

- 캠프 모드에서는 추천 콘텐츠가 마스터 콘텐츠 ID로 전달될 수 있습니다.
- 플랜 생성 시에는 학생 콘텐츠 ID가 필요하므로, 마스터 콘텐츠 ID를 학생 콘텐츠 ID로 변환해야 합니다.
- `master_content_id` 필드를 통해 마스터 콘텐츠와 학생 콘텐츠의 관계를 추적할 수 있습니다.

