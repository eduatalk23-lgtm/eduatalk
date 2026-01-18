# Step4RecommendedContents 리팩토링 계획

**작성일**: 2025-12-01  
**목표**: 3,096줄의 거대한 컴포넌트를 관리 가능한 크기로 분리

---

## 📊 현재 상태 분석

### 파일 정보
- **파일명**: `Step4RecommendedContents.tsx`
- **라인 수**: 3,096줄
- **주요 문제점**:
  - 단일 파일에 모든 로직 집중
  - 15개 이상의 상태 변수
  - 복잡한 useEffect 의존성
  - 테스트 및 유지보수 어려움

### 상태 변수 분석 (총 19개)

#### 1. 추천 콘텐츠 관련 (7개)
```typescript
- recommendedContents: RecommendedContent[]
- allRecommendedContents: RecommendedContent[]
- selectedContentIds: Set<string>
- loading: boolean
- hasRequestedRecommendations: boolean
- hasScoreData: boolean
- fetchedRecommendedContentIdsRef: useRef<Set<string>>
```

#### 2. 추천 요청 설정 (4개)
```typescript
- selectedSubjects: Set<string>
- recommendationCounts: Map<string, number>
- autoAssignContents: boolean
- studentContentSubjects: Map<string, { title, subject_category }>
```

#### 3. 범위 편집 관련 (6개)
```typescript
- editingRangeIndex: number | null
- editingRange: { start, end } | null
- contentDetails: Map<number, { details, type }>
- startDetailId: Map<number, string>
- endDetailId: Map<number, string>
- loadingDetails: Set<number>
- cachedDetailsRef: useRef<Map<string, { details, type }>>
```

#### 4. 필수 교과 설정 (2개)
```typescript
- detailSubjects: Map<string, string[]>
- loadingDetailSubjects: Set<string>
```

### 주요 함수 분석

#### API 호출 함수 (3개)
1. `fetchRecommendationsWithSubjects` - 교과별 추천 조회
2. `fetchRecommendations` - 기본 추천 조회
3. `fetchContentMetadataAction` - 콘텐츠 메타데이터 조회

#### 비즈니스 로직 함수 (10+개)
- 콘텐츠 선택/추가/삭제
- 범위 편집
- 필수 교과 검증
- 교과 카운팅
- 등등...

---

## 🎯 리팩토링 목표

### 1. 파일 크기 감소
- 메인 파일: 200-300줄 이하
- 각 하위 파일: 100-200줄 이하

### 2. 관심사 분리
- 상태 관리 (Hooks)
- UI 컴포넌트
- 비즈니스 로직 (Utils)

### 3. 재사용성 향상
- 독립적인 컴포넌트
- 범용 훅
- 유틸리티 함수

---

## 📂 새로운 파일 구조

```
app/(student)/plan/new-group/_components/Step4RecommendedContents/
├── index.tsx                              # 메인 컴포넌트 (200-300줄)
├── types.ts                               # 타입 정의
├── constants.ts                           # 상수 정의
│
├── hooks/
│   ├── useRecommendations.ts             # 추천 콘텐츠 조회/관리
│   ├── useContentSelection.ts            # 콘텐츠 선택 상태 관리
│   ├── useRangeEditor.ts                 # 범위 편집 상태 관리
│   └── useRequiredSubjects.ts            # 필수 교과 관리
│
├── components/
│   ├── RequiredSubjectsSection.tsx       # 필수 교과 설정 섹션
│   ├── RecommendationRequestForm.tsx     # 추천 요청 폼
│   ├── RecommendedContentsList.tsx       # 추천 목록
│   ├── AddedContentsList.tsx             # 추가된 콘텐츠 목록
│   ├── ContentSelectionSummary.tsx       # 선택 요약
│   └── RequiredSubjectItem.tsx           # 이미 존재 (그대로 사용)
│
└── utils/
    ├── contentValidation.ts              # 검증 로직
    ├── contentTransform.ts               # 데이터 변환
    └── subjectCounting.ts                # 교과 카운팅
```

---

## 🔨 구현 계획

### Phase 1: 타입 및 상수 분리

**파일**: `types.ts`, `constants.ts`

```typescript
// types.ts
export type BookDetail = { ... };
export type LectureEpisode = { ... };
export type RecommendedContent = { ... };
export type Step4Props = { ... };

// constants.ts
export const AVAILABLE_SUBJECTS = ["국어", "수학", "영어", "과학", "사회"];
export const MAX_CONTENTS = 9;
```

**예상 시간**: 30분

---

### Phase 2: 훅 분리

#### 2.1 useRecommendations.ts

**책임**: 추천 콘텐츠 조회 및 관리

```typescript
export function useRecommendations(props: {
  data: WizardData;
  isEditMode: boolean;
  studentId?: string;
}) {
  const [recommendedContents, setRecommendedContents] = useState<RecommendedContent[]>([]);
  const [allRecommendedContents, setAllRecommendedContents] = useState<RecommendedContent[]>([]);
  const [loading, setLoading] = useState(!props.isEditMode);
  const [hasRequestedRecommendations, setHasRequestedRecommendations] = useState(!props.isEditMode);
  const [hasScoreData, setHasScoreData] = useState(false);
  
  const fetchRecommendations = useCallback(async () => {
    // ... 추천 조회 로직
  }, []);
  
  const fetchRecommendationsWithSubjects = useCallback(async (
    subjects: string[],
    counts: Map<string, number>,
    autoAssign: boolean
  ) => {
    // ... 교과별 추천 조회 로직
  }, []);
  
  return {
    recommendedContents,
    allRecommendedContents,
    loading,
    hasRequestedRecommendations,
    hasScoreData,
    fetchRecommendations,
    fetchRecommendationsWithSubjects,
    setRecommendedContents,
    setAllRecommendedContents,
  };
}
```

**예상 시간**: 2시간

#### 2.2 useContentSelection.ts

**책임**: 콘텐츠 선택 상태 관리

```typescript
export function useContentSelection(props: {
  data: WizardData;
  recommendedContents: RecommendedContent[];
  onUpdate: (updates: Partial<WizardData>) => void;
}) {
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());
  
  const toggleContentSelection = useCallback((contentId: string) => {
    // ... 선택 토글 로직
  }, []);
  
  const addSelectedContents = useCallback(() => {
    // ... 선택된 콘텐츠 추가 로직
  }, []);
  
  const removeContent = useCallback((index: number) => {
    // ... 콘텐츠 제거 로직
  }, []);
  
  return {
    selectedContentIds,
    toggleContentSelection,
    addSelectedContents,
    removeContent,
  };
}
```

**예상 시간**: 1.5시간

#### 2.3 useRangeEditor.ts

**책임**: 범위 편집 상태 관리

```typescript
export function useRangeEditor(props: {
  data: WizardData;
}) {
  const [editingRangeIndex, setEditingRangeIndex] = useState<number | null>(null);
  const [contentDetails, setContentDetails] = useState<Map<...>>(...);
  const [startDetailId, setStartDetailId] = useState<Map<...>>(...);
  const [endDetailId, setEndDetailId] = useState<Map<...>>(...);
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());
  
  const startEditing = useCallback((index: number) => {
    // ... 편집 시작 로직
  }, []);
  
  const saveRange = useCallback(() => {
    // ... 범위 저장 로직
  }, []);
  
  const cancelEditing = useCallback(() => {
    // ... 편집 취소 로직
  }, []);
  
  return {
    editingRangeIndex,
    contentDetails,
    startDetailId,
    endDetailId,
    loadingDetails,
    startEditing,
    saveRange,
    cancelEditing,
  };
}
```

**예상 시간**: 2시간

#### 2.4 useRequiredSubjects.ts

**책임**: 필수 교과 관리

```typescript
export function useRequiredSubjects(props: {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}) {
  const [detailSubjects, setDetailSubjects] = useState<Map<string, string[]>>(new Map());
  const [loadingDetailSubjects, setLoadingDetailSubjects] = useState<Set<string>>(new Set());
  
  const handleLoadDetailSubjects = useCallback(async (category: string) => {
    // ... 세부 과목 조회 로직
  }, []);
  
  const handleRequiredSubjectUpdate = useCallback((index: number, updated: any) => {
    // ... 필수 교과 업데이트 로직
  }, []);
  
  const handleRequiredSubjectRemove = useCallback((index: number) => {
    // ... 필수 교과 제거 로직
  }, []);
  
  const handleAddRequiredSubject = useCallback(() => {
    // ... 필수 교과 추가 로직
  }, []);
  
  return {
    detailSubjects,
    loadingDetailSubjects,
    handleLoadDetailSubjects,
    handleRequiredSubjectUpdate,
    handleRequiredSubjectRemove,
    handleAddRequiredSubject,
  };
}
```

**예상 시간**: 1.5시간

---

### Phase 3: 컴포넌트 분리

#### 3.1 RequiredSubjectsSection.tsx

**책임**: 필수 교과 설정 UI

```typescript
export function RequiredSubjectsSection({
  data,
  availableSubjects,
  detailSubjects,
  loadingDetailSubjects,
  onUpdate,
  onLoadDetailSubjects,
  onAddRequiredSubject,
  onUpdateRequiredSubject,
  onRemoveRequiredSubject,
}: RequiredSubjectsSectionProps) {
  return (
    <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6">
      {/* 필수 교과 설정 UI */}
    </div>
  );
}
```

**예상 시간**: 1시간

#### 3.2 RecommendationRequestForm.tsx

**책임**: 추천 받기 폼 UI

```typescript
export function RecommendationRequestForm({
  selectedSubjects,
  recommendationCounts,
  autoAssignContents,
  availableSubjects,
  onSubjectToggle,
  onCountChange,
  onAutoAssignChange,
  onSubmit,
}: RecommendationRequestFormProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8">
      {/* 교과 선택, 개수 설정, 추천받기 버튼 */}
    </div>
  );
}
```

**예상 시간**: 1.5시간

#### 3.3 RecommendedContentsList.tsx

**책임**: 추천 콘텐츠 목록 표시

```typescript
export function RecommendedContentsList({
  recommendedContents,
  selectedContentIds,
  requiredSubjects,
  onToggleSelection,
  onRefresh,
}: RecommendedContentsListProps) {
  return (
    <>
      {/* 재추천 버튼 */}
      {/* 과목별 그룹화된 추천 목록 */}
    </>
  );
}
```

**예상 시간**: 2시간

#### 3.4 AddedContentsList.tsx

**책임**: 추가된 콘텐츠 목록 표시

```typescript
export function AddedContentsList({
  contents,
  allRecommendedContents,
  editingRangeIndex,
  contentDetails,
  onStartEditing,
  onSaveRange,
  onCancelEditing,
  onRemove,
}: AddedContentsListProps) {
  return (
    <div className="space-y-2">
      {/* 추가된 콘텐츠 카드들 */}
    </div>
  );
}
```

**예상 시간**: 2시간

---

### Phase 4: 유틸리티 함수 분리

#### 4.1 contentValidation.ts

```typescript
export function validateMaxContents(
  currentTotal: number,
  toAdd: number,
  max: number = 9
): { valid: boolean; error?: string } {
  // ...
}

export function validateRequiredSubjects(
  selectedContents: SelectedContent[],
  requiredSubjects: RequiredSubject[],
  allContents: RecommendedContent[]
): { valid: boolean; missing: Array<{ name: string; current: number; required: number }> } {
  // ...
}
```

**예상 시간**: 1시간

#### 4.2 contentTransform.ts

```typescript
export function transformToSelectedContent(
  content: RecommendedContent,
  startRange: number,
  endRange: number,
  startDetailId?: string,
  endDetailId?: string
): SelectedContent {
  // ...
}

export function groupContentsBySubject(
  contents: RecommendedContent[]
): Map<string, RecommendedContent[]> {
  // ...
}
```

**예상 시간**: 1시간

#### 4.3 subjectCounting.ts

```typescript
export function countContentsBySubject(
  contents: SelectedContent[],
  allContents: RecommendedContent[]
): Map<string, number> {
  // ...
}

export function getSelectedSubjectCategories(
  contents: SelectedContent[],
  allContents: RecommendedContent[]
): Set<string> {
  // ...
}
```

**예상 시간**: 1시간

---

### Phase 5: 메인 컴포넌트 통합

**파일**: `index.tsx`

```typescript
export function Step4RecommendedContents({
  data,
  onUpdate,
  isEditMode,
  isCampMode,
  studentId,
}: Step4Props) {
  // 훅 사용
  const recommendations = useRecommendations({ data, isEditMode, studentId });
  const contentSelection = useContentSelection({ data, recommendedContents: recommendations.recommendedContents, onUpdate });
  const rangeEditor = useRangeEditor({ data });
  const requiredSubjects = useRequiredSubjects({ data, onUpdate });
  
  // 추천 요청 설정 상태
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [recommendationCounts, setRecommendationCounts] = useState<Map<string, number>>(new Map());
  const [autoAssignContents, setAutoAssignContents] = useState(false);
  
  return (
    <div className="space-y-6">
      <RequiredSubjectsSection {...requiredSubjects} data={data} />
      
      <ProgressIndicator {...progressProps} />
      
      {isEditMode && !recommendations.hasRequestedRecommendations && (
        <RecommendationRequestForm
          selectedSubjects={selectedSubjects}
          recommendationCounts={recommendationCounts}
          autoAssignContents={autoAssignContents}
          onSubmit={recommendations.fetchRecommendationsWithSubjects}
          // ...
        />
      )}
      
      {recommendations.hasRequestedRecommendations && recommendations.recommendedContents.length > 0 && (
        <RecommendedContentsList
          recommendedContents={recommendations.recommendedContents}
          selectedContentIds={contentSelection.selectedContentIds}
          onToggleSelection={contentSelection.toggleContentSelection}
          onRefresh={recommendations.fetchRecommendationsWithSubjects}
          // ...
        />
      )}
      
      {data.recommended_contents.length > 0 && (
        <AddedContentsList
          contents={data.recommended_contents}
          allRecommendedContents={recommendations.allRecommendedContents}
          editingRangeIndex={rangeEditor.editingRangeIndex}
          onStartEditing={rangeEditor.startEditing}
          onRemove={contentSelection.removeContent}
          // ...
        />
      )}
    </div>
  );
}
```

**예상 시간**: 2시간

---

## ⏱️ 예상 작업 시간

| Phase | 작업 내용 | 예상 시간 |
|-------|----------|-----------|
| Phase 1 | 타입 및 상수 분리 | 0.5시간 |
| Phase 2 | 훅 분리 (4개) | 7시간 |
| Phase 3 | 컴포넌트 분리 (4개) | 6.5시간 |
| Phase 4 | 유틸리티 분리 (3개) | 3시간 |
| Phase 5 | 메인 컴포넌트 통합 | 2시간 |
| **테스트 및 디버깅** | **전체 동작 확인** | **3시간** |
| **문서 작성** | **리팩토링 문서** | **1시간** |
| **총 예상 시간** | | **23시간 (~3일)** |

---

## 🎯 우선순위

### 🔴 높음 (먼저 진행)
1. Phase 1: 타입 및 상수 분리
2. Phase 2.1: useRecommendations 훅
3. Phase 3.3: RecommendedContentsList 컴포넌트

### 🟡 중간 (순차 진행)
4. Phase 2.2: useContentSelection 훅
5. Phase 3.4: AddedContentsList 컴포넌트
6. Phase 4: 유틸리티 함수 분리

### 🟢 낮음 (마지막)
7. Phase 2.3: useRangeEditor 훅
8. Phase 2.4: useRequiredSubjects 훅
9. Phase 3.1-3.2: 나머지 컴포넌트
10. Phase 5: 메인 컴포넌트 통합

---

## ✅ 체크리스트

### 시작 전
- [ ] 현재 기능 완전히 이해
- [ ] 기존 코드 백업 (git branch)
- [ ] 테스트 계획 수립

### Phase 1
- [ ] types.ts 생성
- [ ] constants.ts 생성
- [ ] 메인 파일에서 import 확인

### Phase 2
- [ ] useRecommendations.ts 생성 및 테스트
- [ ] useContentSelection.ts 생성 및 테스트
- [ ] useRangeEditor.ts 생성 및 테스트
- [ ] useRequiredSubjects.ts 생성 및 테스트

### Phase 3
- [ ] RequiredSubjectsSection.tsx 생성
- [ ] RecommendationRequestForm.tsx 생성
- [ ] RecommendedContentsList.tsx 생성
- [ ] AddedContentsList.tsx 생성

### Phase 4
- [ ] contentValidation.ts 생성
- [ ] contentTransform.ts 생성
- [ ] subjectCounting.ts 생성

### Phase 5
- [ ] 메인 컴포넌트 통합
- [ ] 전체 기능 테스트
- [ ] 린트 에러 수정
- [ ] 문서 작성
- [ ] Git 커밋

---

## 🚨 주의사항

1. **점진적 리팩토링**: 한 번에 모든 것을 바꾸지 말고 단계적으로 진행
2. **기능 보존**: 리팩토링 중에도 기존 기능이 동작해야 함
3. **테스트**: 각 Phase 완료 후 동작 확인
4. **롤백 계획**: 문제 발생 시 이전 상태로 되돌릴 수 있도록 git branch 활용

---

**작성자**: AI Assistant  
**작성일**: 2025-12-01  
**예상 완료일**: 2025-12-04 (3일 소요)

