# 캠프 템플릿 추가 콘텐츠 정보 불러오기 수정

## 작업 개요

관리자의 "남은 단계 작업하기" 페이지에서 Step 4(콘텐츠 선택)로 진입할 때, 학생이 제출한 템플릿에 등록된 추가 콘텐츠의 정보(title, subject_category)가 정확하게 불러와지지 않는 문제를 해결했습니다.

## 문제 분석

### 근본 원인

1. **데이터 흐름 불일치**: 
   - `continue/page.tsx`에서 `classifyPlanContents`로 콘텐츠 정보를 조회하고 `contentsMap`에 저장하지만
   - `syncCreationDataToWizardData` 함수가 `title`과 `subject_category`를 받지 않아 정보가 손실됨

2. **WizardData 타입 제한**:
   - `WizardData`의 `student_contents`와 `recommended_contents`에 `title`과 `subject_category` 필드가 이미 있었지만, 데이터 전달 과정에서 정보가 손실됨

3. **Step4RecommendedContents 컴포넌트**:
   - `studentContentSubjects` Map이 제대로 채워지지 않아 콘텐츠 정보를 표시하지 못함
   - WizardData에서 전달된 정보를 우선적으로 사용하지 않음

## 해결 방안

### 1. syncCreationDataToWizardData 함수 수정

**파일**: `lib/utils/planGroupDataSync.ts`

- `contents` 배열의 타입에 `title`과 `subject_category` 필드 추가
- `contentItem` 생성 시 `title`과 `subject_category`를 포함하도록 수정

**변경 전:**
```typescript
contents: Array<{
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  start_range: number;
  end_range: number;
  display_order: number;
  is_auto_recommended?: boolean;
  recommendation_source?: string | null;
  recommendation_reason?: string | null;
}>;
```

**변경 후:**
```typescript
contents: Array<{
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  start_range: number;
  end_range: number;
  display_order: number;
  is_auto_recommended?: boolean;
  recommendation_source?: string | null;
  recommendation_reason?: string | null;
  title?: string; // 콘텐츠 제목
  subject_category?: string; // 과목 카테고리
}>;
```

**변경 전:**
```typescript
const contentItem = {
  content_type: c.content_type as "book" | "lecture",
  content_id: c.content_id,
  start_range: c.start_range,
  end_range: c.end_range,
};
```

**변경 후:**
```typescript
const contentItem = {
  content_type: c.content_type as "book" | "lecture",
  content_id: c.content_id,
  start_range: c.start_range,
  end_range: c.end_range,
  // title과 subject_category가 있으면 포함
  ...(c.title && { title: c.title }),
  ...(c.subject_category && { subject_category: c.subject_category }),
};
```

### 2. continue/page.tsx 개선

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

- `classifyPlanContents`로 조회한 정보를 `syncCreationDataToWizardData`에 명시적으로 전달
- `title`과 `subject_category`를 `undefined`로 명시하여 정보 손실 방지

**변경 내용:**
```typescript
.map((c) => {
  // classifyPlanContents에서 조회한 정보를 우선적으로 사용
  const classifiedContent = contentsMap.get(c.content_id);
  return {
    ...c,
    // classifyPlanContents에서 조회한 정보가 있으면 사용
    // title과 subject_category를 명시적으로 전달하여 정보 손실 방지
    title: classifiedContent?.title || undefined,
    subject_category: classifiedContent?.subject_category || undefined,
  };
})
```

### 3. Step4RecommendedContents 컴포넌트 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

- WizardData에서 전달된 `title`과 `subject_category`를 우선적으로 사용
- `studentContentSubjects` Map을 채울 때 저장된 정보를 우선 사용하도록 수정

**변경 전:**
```typescript
if (storedSubjectCategory && storedTitle) {
  subjectMap.set(content.content_id, {
    title: storedTitle,
    subject_category: storedSubjectCategory,
  });
  continue;
}
```

**변경 후:**
```typescript
// title이나 subject_category 중 하나라도 있으면 저장된 정보 사용
if (storedTitle || storedSubjectCategory) {
  subjectMap.set(content.content_id, {
    title: storedTitle || "알 수 없음",
    subject_category: storedSubjectCategory || null,
  });
  continue;
}
```

**변경 전:**
```typescript
const contentInfo = studentContentSubjects.get(content.content_id);
const title = contentInfo?.title || (content as any).title || "알 수 없음";
const subjectCategory =
  contentInfo?.subject_category ||
  (content as any).subject_category ||
  null;
```

**변경 후:**
```typescript
// 우선순위: 1) WizardData에서 전달된 정보, 2) studentContentSubjects Map, 3) fallback
const storedTitle = (content as any).title;
const storedSubjectCategory = (content as any).subject_category;
const contentInfo = studentContentSubjects.get(content.content_id);

const title = storedTitle || contentInfo?.title || "알 수 없음";
const subjectCategory = storedSubjectCategory || contentInfo?.subject_category || null;
```

## 주요 변경사항

1. **데이터 흐름 일관성 확보**
   - 서버 사이드에서 조회한 콘텐츠 정보가 클라이언트까지 일관되게 전달되도록 수정
   - `classifyPlanContents` → `syncCreationDataToWizardData` → `Step4RecommendedContents`로 정보가 손실 없이 전달됨

2. **우선순위 명확화**
   - WizardData에서 전달된 정보를 최우선으로 사용
   - 정보가 없을 경우에만 API 호출로 조회

3. **불필요한 API 호출 감소**
   - 서버 사이드에서 이미 조회한 정보를 재사용하여 불필요한 API 호출 방지

## 테스트 시나리오

1. ✅ 관리자가 "남은 단계 작업하기" 페이지에서 Step 4로 진입
2. ✅ 학생이 제출한 템플릿에 등록된 추가 콘텐츠의 제목과 과목 카테고리가 정확하게 표시됨
3. ✅ 콘텐츠 정보가 없을 경우에만 API 호출로 조회
4. ✅ 데이터 흐름이 일관되어 반복적인 에러 발생 방지

## 관련 파일

- `lib/utils/planGroupDataSync.ts` - syncCreationDataToWizardData 함수 수정
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx` - 콘텐츠 정보 전달 개선
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx` - 콘텐츠 정보 표시 개선
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - WizardData 타입 정의 (이미 title, subject_category 필드 포함)

## 작업 일시

2025-01-XX

