# Step4RecommendedContents 컴포넌트 전체 검토 보고서

**작성일**: 2025-01-30  
**컴포넌트**: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`  
**파일 크기**: 3,040줄

---

## 📋 개요

Step4RecommendedContents는 플랜 그룹 생성 위저드의 4단계로, 서비스 추천 콘텐츠를 선택하고 관리하는 컴포넌트입니다. 성적 데이터를 기반으로 맞춤형 추천을 제공하며, 필수 교과 검증, 콘텐츠 범위 편집 등 복잡한 기능을 포함하고 있습니다.

---

## 🏗 컴포넌트 구조

### 주요 기능

1. **추천 콘텐츠 조회**

   - 교과별 추천 목록 조회 (`fetchRecommendationsWithSubjects`)
   - 기본 추천 목록 조회 (`fetchRecommendations`)
   - 관리자 모드 지원 (다른 학생의 추천 조회)

2. **콘텐츠 선택 및 추가**

   - 다중 선택 기능
   - 최대 9개 제한 검증
   - 자동 배정 옵션

3. **필수 교과 설정 및 검증**

   - 필수 교과 설정 UI
   - 세부 과목 지정
   - 실시간 검증 및 경고

4. **콘텐츠 범위 편집**

   - 교재: 페이지 범위 선택
   - 강의: 회차 범위 선택
   - 상세 정보 기반 범위 설정

5. **상태 관리**
   - 학생 콘텐츠 정보 조회
   - 추천 콘텐츠 정보 캐싱
   - 편집 모드 지원

---

## ✅ 강점

### 1. 기능 완성도

- 추천 콘텐츠 조회, 선택, 추가, 편집, 삭제 등 모든 CRUD 기능 구현
- 필수 교과 검증 로직이 잘 구현됨
- 편집 모드와 생성 모드 모두 지원

### 2. 사용자 경험

- 진행률 표시 (`ProgressIndicator`)
- 필수 과목 충족 여부 시각적 표시
- 부족한 콘텐츠에 대한 명확한 안내

### 3. 에러 처리

- `PlanGroupError`를 통한 일관된 에러 처리
- API 실패 시 사용자 친화적 메시지 표시

### 4. 성능 최적화

- 상세 정보 캐싱 (`cachedDetailsRef`)
- 중복 조회 방지 (`fetchedRecommendedContentIdsRef`)
- 함수형 업데이트를 통한 불필요한 리렌더링 방지

---

## ⚠️ 문제점 및 개선사항

### 1. 파일 크기 문제 (Critical)

**현재 상태**: 3,040줄의 거대한 단일 파일

**문제점**:

- 유지보수 어려움
- 코드 가독성 저하
- 테스트 작성 어려움
- 리뷰 어려움

**개선 방안**:

```typescript
// 제안 구조
Step4RecommendedContents/
├── index.tsx                    // 메인 컴포넌트 (200-300줄)
├── hooks/
│   ├── useRecommendedContents.ts
│   ├── useContentDetails.ts
│   ├── useRequiredSubjects.ts
│   └── useContentSelection.ts
├── components/
│   ├── RequiredSubjectItem.tsx  // 이미 분리됨
│   ├── ContentCard.tsx
│   ├── ContentRangeEditor.tsx
│   ├── RecommendationRequestForm.tsx
│   └── ContentList.tsx
└── utils/
    ├── contentValidation.ts
    └── contentTransform.ts
```

### 2. 타입 안전성 문제 (High)

**문제점**:

- `as any` 사용이 다수 발견됨 (약 20곳 이상)
- WizardData의 타입이 불완전함

**예시**:

```typescript
// 현재 코드
const storedTitle = (content as any).title;
const storedSubjectCategory = (content as any).subject_category;
const masterContentId = (content as any).master_content_id;
```

**개선 방안**:

```typescript
// 타입 정의 강화
type StudentContentWithMetadata = {
  content_id: string;
  content_type: "book" | "lecture";
  title?: string;
  subject_category?: string;
  master_content_id?: string;
  // ... 기타 필드
};

// 타입 가드 함수
function hasMetadata(content: any): content is StudentContentWithMetadata {
  return typeof content === "object" && content !== null;
}
```

### 3. 상태 관리 복잡도 (High)

**문제점**:

- 너무 많은 상태 변수 (약 15개 이상)
- Map과 Set을 혼용하여 일관성 부족
- 상태 간 의존성이 복잡함

**현재 상태 목록**:

```typescript
-recommendedContents -
  allRecommendedContents -
  selectedContentIds -
  loading -
  hasRequestedRecommendations -
  hasScoreData -
  selectedSubjects -
  recommendationCounts -
  autoAssignContents -
  editingRangeIndex -
  editingRange -
  studentContentSubjects -
  contentDetails -
  startDetailId -
  endDetailId -
  loadingDetails -
  detailSubjects -
  loadingDetailSubjects;
```

**개선 방안**:

```typescript
// useReducer를 활용한 상태 통합
type Step4State = {
  recommendations: {
    list: RecommendedContent[];
    all: RecommendedContent[];
    selected: Set<string>;
    loading: boolean;
  };
  contentDetails: {
    map: Map<number, ContentDetail>;
    loading: Set<number>;
    editingIndex: number | null;
  };
  // ...
};

const [state, dispatch] = useReducer(step4Reducer, initialState);
```

### 4. useEffect 의존성 문제 (Medium)

**문제점**:

- `eslint-disable-next-line react-hooks/exhaustive-deps` 사용이 다수
- 의존성 배열이 불완전하여 버그 가능성

**예시**:

```typescript
// 현재 코드
useEffect(() => {
  fetchExistingRecommendedContents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isEditMode, data.recommended_contents.length]);
```

**개선 방안**:

- 의존성을 정확히 파악하여 추가
- useCallback으로 함수 메모이제이션
- 필요시 useRef로 최신 값 참조

### 5. 중복 코드 (Medium)

**문제점**:

- 콘텐츠 정보 조회 로직이 여러 곳에 중복
- 과목 카운팅 로직이 반복됨

**예시**:

```typescript
// 중복된 패턴
const subjectCategory =
  (content as any).subject_category ||
  allRecommendedContents.find((c) => c.id === content.content_id)
    ?.subject_category;
```

**개선 방안**:

```typescript
// 유틸리티 함수로 추출
function getContentSubjectCategory(
  content: any,
  allRecommendedContents: RecommendedContent[]
): string | null {
  return (
    content.subject_category ||
    allRecommendedContents.find((c) => c.id === content.content_id)
      ?.subject_category ||
    null
  );
}
```

### 6. API 호출 최적화 (Medium)

**문제점**:

- 순차적 API 호출로 인한 성능 저하
- 에러 발생 시 부분 실패 처리 미흡

**예시**:

```typescript
// 현재 코드 - 순차 처리
for (const contentId of selectedContentIds) {
  const response = await fetch(...);
  // ...
}
```

**개선 방안**:

```typescript
// 병렬 처리
const results = await Promise.allSettled(
  Array.from(selectedContentIds).map(async (contentId) => {
    const response = await fetch(...);
    return response.json();
  })
);
```

### 7. 하드코딩된 값 (Low)

**문제점**:

- 최대 콘텐츠 개수 (9개)가 하드코딩됨
- 교과 목록이 하드코딩됨

**개선 방안**:

```typescript
// 상수로 분리
const MAX_CONTENTS = 9;
const AVAILABLE_SUBJECTS = ["국어", "수학", "영어", "과학", "사회"] as const;
```

### 8. 접근성 (Low)

**문제점**:

- ARIA 속성 부족
- 키보드 네비게이션 미지원
- 스크린 리더 지원 부족

**개선 방안**:

```typescript
<button
  type="button"
  aria-label="추천 콘텐츠 추가"
  aria-describedby="content-description"
>
  추가
</button>
```

---

## 🔧 구체적 개선 제안

### 1. 커스텀 훅 분리

```typescript
// hooks/useRecommendedContents.ts
export function useRecommendedContents(
  data: WizardData,
  isEditMode: boolean,
  studentId?: string
) {
  const [recommendedContents, setRecommendedContents] = useState<
    RecommendedContent[]
  >([]);
  const [loading, setLoading] = useState(!isEditMode);

  const fetchRecommendations = useCallback(async () => {
    // 추천 목록 조회 로직
  }, [data, studentId]);

  return {
    recommendedContents,
    loading,
    fetchRecommendations,
  };
}
```

### 2. 컴포넌트 분리

```typescript
// components/ContentRangeEditor.tsx
export function ContentRangeEditor({
  content,
  index,
  onSave,
  onCancel,
}: ContentRangeEditorProps) {
  // 범위 편집 로직만 담당
}
```

### 3. 타입 정의 강화

```typescript
// types/step4.ts
export interface Step4RecommendedContentsProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  isEditMode?: boolean;
  isCampMode?: boolean;
  studentId?: string;
}

export interface ContentWithMetadata {
  content_id: string;
  content_type: "book" | "lecture";
  title: string;
  subject_category: string | null;
  master_content_id?: string;
  // ...
}
```

### 4. 에러 바운더리 추가

```typescript
// components/Step4ErrorBoundary.tsx
export function Step4ErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={<Step4ErrorFallback />}
      onError={(error) => {
        console.error("[Step4RecommendedContents] 에러:", error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

---

## 📊 우선순위별 개선 계획

### Phase 1: 긴급 (1-2주)

1. ✅ 타입 안전성 개선 (`as any` 제거)
2. ✅ useEffect 의존성 수정
3. ✅ 중복 코드 제거

### Phase 2: 중요 (2-4주)

1. ✅ 커스텀 훅 분리
2. ✅ 컴포넌트 분리
3. ✅ 상태 관리 개선 (useReducer 도입)

### Phase 3: 개선 (1-2개월)

1. ✅ 파일 구조 리팩토링
2. ✅ API 호출 최적화
3. ✅ 접근성 개선

---

## 🧪 테스트 전략

### 단위 테스트

```typescript
// __tests__/Step4RecommendedContents.test.tsx
describe("Step4RecommendedContents", () => {
  it("should fetch recommendations on mount", async () => {
    // ...
  });

  it("should validate max content limit", () => {
    // ...
  });

  it("should handle required subjects validation", () => {
    // ...
  });
});
```

### 통합 테스트

- 추천 콘텐츠 조회 플로우
- 콘텐츠 추가 플로우
- 범위 편집 플로우

---

## 📝 체크리스트

### 코드 품질

- [ ] 타입 안전성 개선 (`as any` 제거)
- [ ] ESLint 경고 해결
- [ ] 중복 코드 제거
- [ ] 함수 길이 최적화 (100줄 이하)

### 구조 개선

- [ ] 커스텀 훅 분리
- [ ] 컴포넌트 분리
- [ ] 유틸리티 함수 분리
- [ ] 타입 정의 강화

### 성능

- [ ] 불필요한 리렌더링 제거
- [ ] API 호출 최적화
- [ ] 메모이제이션 적용

### 사용자 경험

- [ ] 로딩 상태 개선
- [ ] 에러 메시지 개선
- [ ] 접근성 개선

---

## 🎯 결론

Step4RecommendedContents 컴포넌트는 기능적으로는 완성도가 높지만, 코드 구조와 유지보수성 측면에서 개선이 필요합니다. 특히 파일 크기와 타입 안전성 문제는 우선적으로 해결해야 할 사항입니다.

**권장 사항**:

1. 단계적 리팩토링 진행 (한 번에 모든 것을 바꾸지 않기)
2. 테스트 코드 작성 후 리팩토링
3. 기능 추가 전 구조 개선 우선

---

**검토자**: AI Assistant  
**검토일**: 2025-01-30
