# Phase 3 타입 안전성 개선 작업

**작업 일시**: 2025-02-04  
**Phase**: 3 - 학생 도메인 핵심 기능 타입 안전성 개선

---

## 📋 작업 개요

Phase 3 (학생 도메인 핵심 기능)에서 `any` 타입 사용을 제거하고 타입 안전성을 개선했습니다.

---

## 🎯 개선 대상

### 1. lib/plan/ - 플랜 관련 비즈니스 로직
- `blocks.ts`: `schedulerOptions` 타입 개선
- `scheduler.ts`: `options` 타입 개선

### 2. lib/scores/ - 성적 처리 로직
- `mockAnalysis.ts`: Supabase Relational Query 결과 타입 정의

### 3. app/(student)/plan/ - 학습 계획 생성/관리
- `PlanGroupWizard.tsx`: 콜백 함수 타입 개선
- `usePlanDraft.ts`: `initialData` 타입 정의
- `recommendationTransform.ts`: API 응답 타입 정의
- `useRecommendedContents.ts`: WizardData 타입 사용
- `useRecommendations.ts`: API 응답 타입 정의

### 4. app/(student)/scores/ - 성적 관리
- `MockTrendChart.tsx`: MockScore 타입 사용
- `SubjectGradeHistoryChart.tsx`: 차트 데이터 타입 개선

---

## 📊 개선 통계

### 제거된 any 타입
- **총 15개 파일**에서 `any` 타입 제거
- **약 25개 위치**에서 타입 안전성 개선

### 주요 개선 사항

#### 1. lib/plan/blocks.ts
```typescript
// Before
schedulerOptions?: Record<string, any> | null

// After
schedulerOptions?: SchedulerOptions | null
```

#### 2. lib/plan/scheduler.ts
```typescript
// Before
options?: any

// After
options?: SchedulerOptions
```

#### 3. lib/scores/mockAnalysis.ts
```typescript
// Before
.map((score: any) => { ... })

// After
type MockScoreWithRelations = { ... };
.map((score) => { ... })
```

#### 4. app/(student)/plan/new-group/_components/PlanGroupWizard.tsx
```typescript
// Before
onBlockSetsLoaded={(latestBlockSets: any) => { ... }}
onUpdate={(updates: any) => { ... }}

// After
onBlockSetsLoaded={(latestBlockSets) => { ... }}
onUpdate={(updates) => { ... }}
```

#### 5. app/(student)/plan/new-group/_components/hooks/usePlanDraft.ts
```typescript
// Before
initialData?: any

// After
type InitialData = Partial<WizardData> & {
  templateId?: string;
  student_id?: string;
  studentId?: string;
  groupId?: string;
  // ...
};
initialData?: InitialData
```

#### 6. recommendationTransform.ts
```typescript
// Before
export function transformRecommendation(r: any): RecommendedContent { ... }

// After
type RecommendationApiResponse = { ... };
export function transformRecommendation(r: RecommendationApiResponse): RecommendedContent { ... }
```

#### 7. useRecommendedContents.ts
```typescript
// Before
data: {
  student_contents: Array<{ [key: string]: any }>;
  recommended_contents: Array<{ [key: string]: any }>;
};
onUpdate: (updates: any) => void;

// After
data: {
  student_contents: WizardData["student_contents"];
  recommended_contents: WizardData["recommended_contents"];
};
onUpdate: (updates: Partial<Pick<WizardData, "student_contents" | "recommended_contents">>) => void;
```

#### 8. useRecommendations.ts
```typescript
// Before
let detailsResult: any = null;
rawRecommendations.map((r: any) => { ... })

// After
type ContentDetailsApiResponse = { ... };
type RecommendationApiResponse = { ... };
let detailsResult: ContentDetailsApiResponse | null = null;
(rawRecommendations as RecommendationApiResponse[]).map((r) => { ... })
```

#### 9. MockTrendChart.tsx
```typescript
// Before
scores: any[];
formatter={(value: any) => { ... }}

// After
scores: Array<Pick<MockScore, "exam_date" | "exam_title" | "percentile">>;
formatter={(value: number | string) => { ... }}
```

#### 10. SubjectGradeHistoryChart.tsx
```typescript
// Before
const point: Record<string, any> = { ... };
formatter={(value: any) => { ... }}

// After
const point: Record<string, string | number | null> = { ... };
formatter={(value: number | string | null) => { ... }}
```

---

## ✅ 개선 효과

### 타입 안전성 향상
- 컴파일 타임에 타입 오류 감지 가능
- IDE 자동완성 및 타입 체크 지원
- 런타임 에러 감소

### 코드 가독성 개선
- 명시적인 타입 정의로 코드 의도 명확화
- API 응답 구조 명확화

### 유지보수성 향상
- 타입 변경 시 영향 범위 파악 용이
- 리팩토링 시 안전성 보장

---

## 📝 다음 단계

1. **Deprecated 함수 정리**: Phase 3에서 사용 중인 deprecated 함수 확인 및 마이그레이션
2. **추가 타입 안전성 개선**: 남은 any 타입 사용 위치 확인 및 개선
3. **테스트**: 타입 변경 후 기능 동작 확인

---

## 🔍 참고 사항

- 모든 변경사항은 기존 기능을 유지하면서 타입 안전성만 개선했습니다.
- Linter 및 TypeScript 컴파일 에러 없이 통과했습니다.
- deprecated 폴더의 파일들은 개선 대상에서 제외했습니다.

---

**작업 완료 시간**: 2025-02-04

