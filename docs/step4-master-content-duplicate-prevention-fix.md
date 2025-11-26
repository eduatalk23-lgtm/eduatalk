# Step4 마스터 콘텐츠 중복 방지 개선

## 문제 상황

마스터에서 가져온 콘텐츠를 학생 추가 콘텐츠로 등록한 후, 추천 콘텐츠 받기를 실행하면 이미 등록된 콘텐츠가 추천 목록에 나타나는 문제가 발생했습니다.

## 원인 분석

1. **WizardData에 `master_content_id` 미저장**: Step3에서 학생 콘텐츠를 추가할 때 `master_content_id`가 WizardData에 저장되지 않았습니다.

2. **데이터베이스 조회 의존**: Step4에서 중복 체크 시 데이터베이스에서 `master_content_id`를 조회했지만, 플랜 그룹 생성 전에는 데이터베이스에 저장되지 않아 조회가 실패할 수 있습니다.

3. **중복 체크 로직 불완전**: `content_id`만 비교하고 `master_content_id`를 제대로 활용하지 못했습니다.

## 해결 방법

### 1. WizardData 타입 확장

`PlanGroupWizard.tsx`의 `WizardData` 타입에 `master_content_id` 필드를 추가했습니다:

```typescript
student_contents: Array<{
  // ... 기존 필드들
  master_content_id?: string | null; // 추가: 마스터 콘텐츠 ID (중복 방지용)
}>;
```

### 2. Step3에서 `master_content_id` 저장

`Step3Contents.tsx`에서 콘텐츠 추가 시 `master_content_id`를 함께 저장하도록 수정했습니다:

```typescript
contentsToAdd.push({
  // ... 기존 필드들
  master_content_id: content?.master_content_id || null, // 마스터 콘텐츠 ID 저장
});
```

### 3. Step4에서 중복 체크 개선

`Step4RecommendedContents.tsx`의 중복 체크 로직을 개선했습니다:

1. **WizardData에서 직접 조회 우선**: WizardData의 `student_contents`에서 `master_content_id`를 직접 수집합니다.
2. **데이터베이스 조회는 보조**: WizardData에 `master_content_id`가 없는 경우에만 데이터베이스에서 조회합니다.

```typescript
// 학생 콘텐츠의 master_content_id 수집 (WizardData에서 직접 가져오기 우선)
const studentMasterIds = new Set<string>();
data.student_contents.forEach((c) => {
  const masterContentId = (c as any).master_content_id;
  if (masterContentId) {
    studentMasterIds.add(masterContentId);
  }
});

// WizardData에 master_content_id가 없는 경우에만 데이터베이스에서 조회
const studentContentsWithoutMasterId = data.student_contents.filter(
  (c) => (c.content_type === "book" || c.content_type === "lecture") && !(c as any).master_content_id
);
```

## 수정된 파일

1. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
   - `student_contents` 타입에 `master_content_id` 필드 추가

2. `app/(student)/plan/new-group/_components/Step3Contents.tsx`
   - 콘텐츠 추가 시 `master_content_id` 저장

3. `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`
   - 중복 체크 로직 개선 (WizardData 우선, 데이터베이스 조회는 보조)
   - `fetchRecommendations`와 `fetchRecommendationsWithSubjects` 두 함수 모두 수정

## 효과

1. **즉시 중복 방지**: 마스터에서 가져온 콘텐츠를 추가한 직후 추천을 받아도 중복이 발생하지 않습니다.
2. **데이터베이스 의존성 감소**: 플랜 그룹 생성 전에도 중복 체크가 가능합니다.
3. **성능 개선**: 불필요한 데이터베이스 조회를 줄입니다.

## 테스트 시나리오

1. Step3에서 마스터 콘텐츠를 학생 콘텐츠로 추가
2. Step4에서 추천 콘텐츠 받기 실행
3. **기대 결과**: 추가한 마스터 콘텐츠가 추천 목록에 나타나지 않음

## 관련 이슈

- 마스터 콘텐츠를 학생 콘텐츠로 복사하는 로직은 `ContentMasterSearch.tsx`의 `copyMasterToStudentContentAction`을 통해 처리됩니다.
- 복사된 학생 콘텐츠는 `books`/`lectures` 테이블에 저장되며, `master_content_id` 필드에 원본 마스터 콘텐츠 ID가 저장됩니다.

