# Step6 콘텐츠 검증 로직 개선

## 문제 상황

Step6에서 플랜 생성 전 검증을 수행할 때, 다음과 같은 에러가 발생했습니다:

```
플랜에 포함될 콘텐츠가 없습니다. Step 3 또는 Step 4에서 콘텐츠를 선택해주세요.
```

사용자는 Step 3과 Step 4에서 콘텐츠를 모두 선택했지만, 검증 로직이 콘텐츠가 없다고 판단했습니다.

## 원인 분석

`continueCampStepsForAdmin` 함수에서 Step 6 또는 Step 7일 때 플랜 생성 전 검증을 수행하는데, 검증 로직이 `plan_contents` 테이블에서 콘텐츠를 조회하고 있었습니다:

```typescript
// 2. 콘텐츠 검증
const { data: planContents } = await supabase
  .from("plan_contents")
  .select("id")
  .eq("plan_group_id", groupId)
  .limit(1);

if (!planContents || planContents.length === 0) {
  validationErrors.push(
    "플랜에 포함될 콘텐츠가 없습니다. Step 3 또는 Step 4에서 콘텐츠를 선택해주세요."
  );
}
```

문제는 플랜 생성이 아직 실행되지 않았기 때문에 `plan_contents` 테이블에 데이터가 없을 수 있다는 것입니다. 플랜 생성은 Step 6에서 Step 7로 넘어갈 때 발생하므로, Step 6에서 검증할 때는 `plan_contents` 테이블이 비어있을 수 있습니다.

## 해결 방법

검증 로직을 수정하여 `wizardData`에서 콘텐츠를 우선적으로 확인하도록 변경했습니다:

1. **wizardData 우선 확인**: `wizardData.student_contents`와 `wizardData.recommended_contents`를 먼저 확인합니다.
2. **plan_contents 보조 확인**: `wizardData`에 콘텐츠가 없는 경우에만 `plan_contents` 테이블을 확인합니다 (이미 저장된 경우를 대비).

```typescript
// 2. 콘텐츠 검증
// wizardData에서 콘텐츠 확인 (플랜 생성 전이므로 plan_contents 테이블이 비어있을 수 있음)
const studentContents = wizardData.student_contents || [];
const recommendedContents = wizardData.recommended_contents || [];
const totalContents = studentContents.length + recommendedContents.length;

// wizardData에 콘텐츠가 없으면 plan_contents 테이블도 확인 (이미 저장된 경우)
if (totalContents === 0) {
  const { data: planContents } = await supabase
    .from("plan_contents")
    .select("id")
    .eq("plan_group_id", groupId)
    .limit(1);

  if (!planContents || planContents.length === 0) {
    validationErrors.push(
      "플랜에 포함될 콘텐츠가 없습니다. Step 3 또는 Step 4에서 콘텐츠를 선택해주세요."
    );
  }
}
```

## 수정된 파일

1. `app/(admin)/actions/campTemplateActions.ts`
   - `continueCampStepsForAdmin` 함수의 콘텐츠 검증 로직 개선
   - `wizardData` 우선 확인, `plan_contents` 보조 확인

## 효과

1. **정확한 검증**: 플랜 생성 전에도 `wizardData`에 있는 콘텐츠를 정확히 확인할 수 있습니다.
2. **하위 호환성**: 이미 `plan_contents` 테이블에 데이터가 있는 경우도 처리할 수 있습니다.
3. **에러 방지**: Step 6에서 콘텐츠를 선택했는데도 검증 실패하는 문제를 해결했습니다.

## 테스트 시나리오

1. Step 3에서 학생 콘텐츠 선택
2. Step 4에서 추천 콘텐츠 선택
3. Step 6에서 최종 확인 및 조정
4. **기대 결과**: 콘텐츠 검증 통과, 플랜 생성 가능

## 관련 이슈

- 플랜 생성은 `_generatePlansFromGroup` 함수에서 수행되며, 이 함수는 `plan_contents` 테이블의 데이터를 기반으로 플랜을 생성합니다.
- `plan_contents` 테이블은 플랜 그룹 생성 시 또는 플랜 그룹 업데이트 시 `createPlanContents` 함수를 통해 채워집니다.

