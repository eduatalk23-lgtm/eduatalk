# 추천 콘텐츠 저장 시 master_content_id 설정 문제 해결

## 🔍 문제 상황

추천 콘텐츠는 마스터 콘텐츠를 사용하는 것이 맞지만, `plan_contents` 테이블에 저장될 때 `master_content_id`가 설정되지 않는 문제가 있습니다.

### 현재 상황

1. **추천 콘텐츠 조회**: ✅ 정상 작동
   - `/api/recommended-master-contents` API에서 마스터 콘텐츠 조회
   - `getRecommendedMasterContents` 함수가 `master_books`와 `master_lectures` 테이블에서 조회

2. **추천 콘텐츠 저장**: ❌ 문제 있음
   - `Step4RecommendedContents`에서 `content_id`는 마스터 콘텐츠 ID로 저장됨
   - 하지만 `master_content_id`가 명시적으로 설정되지 않음

3. **데이터 변환**: ❌ 문제 있음
   - `syncWizardDataToCreationData`에서 추천 콘텐츠의 `master_content_id`를 전달하지 않음

### 근본 원인

추천 콘텐츠의 경우:
- `content_id` = 마스터 콘텐츠 ID (예: `master_books.id` 또는 `master_lectures.id`)
- `master_content_id` = `content_id`와 동일하게 설정해야 함

하지만 현재 코드에서는:
1. `Step4RecommendedContents`에서 추천 콘텐츠 추가 시 `master_content_id`를 설정하지 않음
2. `syncWizardDataToCreationData`에서 추천 콘텐츠의 `master_content_id`를 전달하지 않음

## 🛠 해결 방법

### 수정 내용

#### 1. `Step4RecommendedContents.tsx` 수정

추천 콘텐츠 추가 시 `master_content_id`를 명시적으로 설정하도록 수정합니다.

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

**변경 전**:
```typescript
contentsToAdd.push({
  content_type: content.contentType,
  content_id: content.id, // 마스터 콘텐츠 ID
  start_range: 1,
  end_range: defaultEndRange,
  title: content.title,
  subject_category: content.subject_category || undefined,
});
```

**변경 후**:
```typescript
contentsToAdd.push({
  content_type: content.contentType,
  content_id: content.id, // 마스터 콘텐츠 ID
  master_content_id: content.id, // 추천 콘텐츠는 content_id와 동일 (마스터 콘텐츠 ID)
  start_range: 1,
  end_range: defaultEndRange,
  title: content.title,
  subject_category: content.subject_category || undefined,
});
```

#### 2. `syncWizardDataToCreationData` 함수 수정

추천 콘텐츠의 경우 `master_content_id`를 명시적으로 전달하도록 수정합니다.

**파일**: `lib/utils/planGroupDataSync.ts`

**변경 전**:
```typescript
contents: allContents.map((c, idx) => ({
  content_type: c.content_type,
  content_id: c.content_id,
  start_range: c.start_range,
  end_range: c.end_range,
  start_detail_id: (c as any).start_detail_id ?? null,
  end_detail_id: (c as any).end_detail_id ?? null,
  display_order: idx,
})),
```

**변경 후**:
```typescript
contents: allContents.map((c, idx) => {
  const contentItem: any = {
    content_type: c.content_type,
    content_id: c.content_id,
    start_range: c.start_range,
    end_range: c.end_range,
    start_detail_id: (c as any).start_detail_id ?? null,
    end_detail_id: (c as any).end_detail_id ?? null,
    display_order: idx,
  };
  
  // 추천 콘텐츠의 경우: content_id가 마스터 콘텐츠 ID이므로 master_content_id도 동일하게 설정
  // WizardData에서 master_content_id가 명시적으로 설정된 경우 우선 사용
  if ((c as any).master_content_id) {
    contentItem.master_content_id = (c as any).master_content_id;
  } else {
    // 추천 콘텐츠인지 확인 (recommended_contents에 있는 경우)
    const isRecommended = data.recommended_contents.some(
      (rc) => rc.content_id === c.content_id && rc.content_type === c.content_type
    );
    if (isRecommended) {
      // 추천 콘텐츠는 content_id 자체가 마스터 콘텐츠 ID
      contentItem.master_content_id = c.content_id;
    }
  }
  
  // 자동 추천 관련 필드 추가
  if ((c as any).is_auto_recommended !== undefined) {
    contentItem.is_auto_recommended = (c as any).is_auto_recommended;
  }
  if ((c as any).recommendation_source) {
    contentItem.recommendation_source = (c as any).recommendation_source;
  }
  if ((c as any).recommendation_reason) {
    contentItem.recommendation_reason = (c as any).recommendation_reason;
  }
  if ((c as any).recommendation_metadata) {
    contentItem.recommendation_metadata = (c as any).recommendation_metadata;
  }
  
  return contentItem;
}),
```

**더 나은 방법**: `wizardData` 파라미터에 접근할 수 없으므로, 추천 콘텐츠 정보를 `allContents`에 포함시키는 것이 더 좋습니다.

실제로는 `WizardData`의 구조를 확인하여 추천 콘텐츠와 학생 콘텐츠를 구분할 수 있도록 해야 합니다.

**더 간단한 방법**:
```typescript
contents: allContents.map((c, idx) => ({
  content_type: c.content_type,
  content_id: c.content_id,
  // 추천 콘텐츠의 경우: WizardData에서 master_content_id가 설정되어 있으면 사용, 없으면 content_id 사용
  master_content_id: (c as any).master_content_id || 
    // 추천 콘텐츠는 content_id 자체가 마스터 콘텐츠 ID (하지만 확실하게 구분하기 위해 추천 관련 필드 확인)
    ((c as any).is_auto_recommended || (c as any).recommendation_source) ? c.content_id : null,
  start_range: c.start_range,
  end_range: c.end_range,
  start_detail_id: (c as any).start_detail_id ?? null,
  end_detail_id: (c as any).end_detail_id ?? null,
  display_order: idx,
  // 자동 추천 관련 필드
  ...((c as any).is_auto_recommended !== undefined && { is_auto_recommended: (c as any).is_auto_recommended }),
  ...((c as any).recommendation_source && { recommendation_source: (c as any).recommendation_source }),
  ...((c as any).recommendation_reason && { recommendation_reason: (c as any).recommendation_reason }),
  ...((c as any).recommendation_metadata && { recommendation_metadata: (c as any).recommendation_metadata }),
})),
```

## 📊 변경 사항 요약

### 데이터 흐름

**변경 전**:
1. 추천 콘텐츠 선택 → `content_id`만 저장 (마스터 콘텐츠 ID)
2. `syncWizardDataToCreationData` → `master_content_id` 없이 저장
3. `plan_contents` 테이블 → `master_content_id`가 `null`

**변경 후**:
1. 추천 콘텐츠 선택 → `content_id`와 `master_content_id` 모두 저장 (동일한 값)
2. `syncWizardDataToCreationData` → `master_content_id` 전달
3. `plan_contents` 테이블 → `master_content_id`가 정상적으로 저장됨

### 효과

- ✅ 추천 콘텐츠의 `master_content_id`가 정상적으로 저장됨
- ✅ `classifyPlanContents` 함수가 추천 콘텐츠 정보를 정확하게 조회할 수 있음
- ✅ 마스터 콘텐츠 정보 표시가 정확해짐

## ✅ 검증 항목

- [ ] `Step4RecommendedContents`에서 추천 콘텐츠 추가 시 `master_content_id` 설정
- [ ] `syncWizardDataToCreationData`에서 추천 콘텐츠의 `master_content_id` 전달
- [ ] `plan_contents` 테이블에 `master_content_id` 정상 저장 확인
- [ ] 추천 콘텐츠 조회 시 정보 정상 표시 확인

## 📝 참고

### 추천 콘텐츠와 학생 콘텐츠의 차이

**학생 콘텐츠**:
- `content_id` = 학생 콘텐츠 ID (예: `books.id`, `lectures.id`)
- `master_content_id` = 마스터 콘텐츠 ID (예: `master_books.id`, `master_lectures.id`)
- 학생이 마스터 콘텐츠를 복사하여 생성한 경우에만 `master_content_id`가 있음

**추천 콘텐츠**:
- `content_id` = 마스터 콘텐츠 ID (예: `master_books.id`, `master_lectures.id`)
- `master_content_id` = `content_id`와 동일 (마스터 콘텐츠를 직접 참조)
- 항상 마스터 콘텐츠를 사용하므로 `master_content_id`가 필수

