# 관리자 영역 플랜 생성 통합 섹션 구축 계획

**작성일**: 2025-02-02  
**작성자**: AI Assistant  
**관련 문서**: `2025-02-02-admin-student-list-plan-creation-ui-audit.md`

---

## 📋 개요

### 목표

관리자 영역에서 플랜 생성 기능들을 통합 관리할 수 있는 새로운 섹션을 구축하여, 현재 분산되어 있는 플랜 생성 기능들을 한 곳에서 접근하고 관리할 수 있도록 합니다.

### 배경

현재 플랜 생성 기능들이 여러 페이지에 분산되어 있어 사용자가 효율적으로 작업하기 어려운 상황입니다:

1. **학생 목록 페이지**: 배치 AI 플랜 생성만 가능
2. **학생 상세 페이지**: 플랜 생성 버튼 없음
3. **플랜 관리 페이지**: 모든 위저드 기능 존재하지만 별도 페이지로 이동 필요

이로 인해 다음과 같은 문제가 발생합니다:

- 플랜 생성 기능을 찾기 어려움
- 여러 학생에게 플랜을 생성할 때 페이지 이동이 많음
- 워크플로우가 비효율적임

---

## 🎯 목표 및 요구사항

### 핵심 목표

1. **통합 접근**: 모든 플랜 생성 기능을 한 곳에서 접근 가능
2. **효율성 향상**: 여러 학생에게 플랜을 생성할 때 워크플로우 최적화
3. **사용성 개선**: 직관적인 UI로 플랜 생성 기능 발견 및 사용 용이
4. **확장성**: 향후 새로운 플랜 생성 기능 추가 시 쉽게 통합 가능

### 기능 요구사항

#### 필수 기능 (MVP)

1. **학생 선택**
   - 학생 목록에서 다중 선택
   - 선택된 학생 정보 표시
   - 선택 해제 기능

2. **플랜 생성 방법 선택**
   - 배치 AI 플랜 생성
   - 플랜 그룹 생성 위저드 (7단계)
   - 빠른 플랜 추가
   - 콘텐츠 추가 위저드 (3단계)

3. **생성 진행 상황**
   - 진행 중인 작업 표시
   - 완료된 작업 결과 표시
   - 실패한 작업 에러 표시

#### 선택 기능 (Phase 2)

1. **플랜 생성 템플릿**
   - 자주 사용하는 설정 저장
   - 템플릿으로 빠른 생성

2. **일괄 작업**
   - 여러 학생에게 동일한 플랜 생성
   - 조건부 플랜 생성 (학년, 구분 등)

3. **플랜 생성 이력**
   - 생성 이력 조회
   - 재사용 가능한 설정 저장

---

## 🏗 아키텍처 설계

### 페이지 구조

```
/admin/plan-creation
├── page.tsx                    # 메인 페이지
├── _components/
│   ├── PlanCreationHub.tsx     # 통합 허브 컴포넌트
│   ├── StudentSelector.tsx     # 학생 선택 컴포넌트
│   ├── CreationMethodSelector.tsx  # 생성 방법 선택
│   ├── BatchAIPlanSection.tsx  # 배치 AI 플랜 생성
│   ├── PlanGroupWizardSection.tsx  # 플랜 그룹 위저드
│   ├── QuickPlanSection.tsx    # 빠른 플랜 추가
│   ├── ContentWizardSection.tsx  # 콘텐츠 추가 위저드
│   ├── ProgressTracker.tsx     # 진행 상황 추적
│   └── ResultSummary.tsx       # 결과 요약
└── _hooks/
    ├── usePlanCreation.ts      # 플랜 생성 로직
    ├── useStudentSelection.ts   # 학생 선택 관리
    └── useCreationProgress.ts   # 진행 상황 관리
```

### 라우트 구조

```
/admin/plan-creation
├── /                          # 메인 페이지 (통합 허브)
├── /batch-ai                  # 배치 AI 플랜 생성 (선택적)
├── /wizard                    # 플랜 그룹 위저드 (선택적)
└── /quick                     # 빠른 플랜 추가 (선택적)
```

### 컴포넌트 계층 구조

```
PlanCreationHub (메인 컨테이너)
├── StudentSelector (학생 선택)
├── CreationMethodSelector (방법 선택)
├── ActiveCreationSection (활성 생성 섹션)
│   ├── BatchAIPlanSection
│   ├── PlanGroupWizardSection
│   ├── QuickPlanSection
│   └── ContentWizardSection
├── ProgressTracker (진행 상황)
└── ResultSummary (결과 요약)
```

---

## 🎨 UI/UX 설계

### 페이지 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  플랜 생성 관리                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [1단계] 학생 선택                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [검색] [필터] [정렬]                            │   │
│  │ ┌─────┬─────┬─────┐                            │   │
│  │ │ ☑   │ 이름 │ 학년 │ ...                      │   │
│  │ ├─────┼─────┼─────┤                            │   │
│  │ │ ☑   │ ... │ ... │                            │   │
│  │ └─────┴─────┴─────┘                            │   │
│  │ 선택됨: 3명                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [2단계] 생성 방법 선택                                  │
│  ┌──────────┬──────────┬──────────┬──────────┐        │
│  │ 🤖 AI    │ 📋 위저드│ ⚡ 빠른  │ 📚 콘텐츠│        │
│  │ 플랜 생성│ 플랜 그룹│ 플랜 추가│ 추가     │        │
│  └──────────┴──────────┴──────────┴──────────┘        │
│                                                         │
│  [3단계] 설정 및 생성                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [선택된 방법에 따른 설정 UI]                     │   │
│  │                                                 │   │
│  │ [생성 시작] 버튼                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [4단계] 진행 상황                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 진행 중: 학생 A (1/3)                            │   │
│  │ ████████░░░░░░░░ 33%                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [5단계] 결과 요약                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✅ 성공: 2명                                     │   │
│  │ ❌ 실패: 1명                                     │   │
│  │ [상세 보기]                                      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 주요 UI 컴포넌트

#### 1. StudentSelector

**기능**:

- 학생 검색 및 필터링
- 다중 선택 (체크박스)
- 선택된 학생 목록 표시
- 선택 해제 기능

**UI 요소**:

- 검색 바
- 필터 (학년, 구분, 상태 등)
- 학생 테이블 (체크박스 포함)
- 선택 요약 카드

#### 2. CreationMethodSelector

**기능**:

- 플랜 생성 방법 선택
- 각 방법에 대한 설명 및 아이콘
- 방법별 특징 표시

**UI 요소**:

- 카드 그리드 레이아웃
- 각 방법별 카드 (아이콘, 제목, 설명)
- 선택 시 활성화 표시

#### 3. ActiveCreationSection

**기능**:

- 선택된 방법에 따른 설정 UI 표시
- 기존 위저드/모달 컴포넌트 재사용
- 다중 학생 지원

**UI 요소**:

- 동적으로 변경되는 설정 섹션
- 기존 컴포넌트 래퍼

#### 4. ProgressTracker

**기능**:

- 진행 중인 작업 표시
- 각 학생별 진행률 표시
- 취소 기능

**UI 요소**:

- 진행률 바
- 학생별 진행 상태
- 취소 버튼

#### 5. ResultSummary

**기능**:

- 생성 결과 요약
- 성공/실패 통계
- 상세 결과 보기

**UI 요소**:

- 통계 카드
- 결과 테이블
- 상세 보기 링크

---

## 🔧 기술적 구현 계획

### Phase 1: 기본 구조 구축 (1-2주)

#### 1.1 페이지 및 라우트 생성

```typescript
// app/(admin)/admin/plan-creation/page.tsx
export default async function PlanCreationPage() {
  // 권한 검증
  // 기본 데이터 로드
  return <PlanCreationHub />;
}
```

#### 1.2 핵심 컴포넌트 구현

- `PlanCreationHub`: 메인 컨테이너
- `StudentSelector`: 학생 선택 컴포넌트
- `CreationMethodSelector`: 방법 선택 컴포넌트

#### 1.3 상태 관리 설정

```typescript
// Context 또는 Zustand 사용
interface PlanCreationState {
  selectedStudents: Student[];
  selectedMethod: CreationMethod | null;
  isCreating: boolean;
  progress: CreationProgress;
  results: CreationResult[];
}
```

### Phase 2: 위저드 통합 (2-3주)

#### 2.1 기존 위저드 컴포넌트 리팩토링

**목표**: 단일/배치 모드 지원

```typescript
// 기존 컴포넌트를 래핑하여 배치 모드 지원
<AdminPlanCreationWizard7Step
  studentIds={selectedStudentIds}
  mode="batch" // 또는 "single"
  onSuccess={handleSuccess}
/>
```

#### 2.2 배치 모드 지원

- 여러 학생에게 동일한 설정 적용
- 각 학생별 진행 상황 추적
- 부분 실패 처리

#### 2.3 진행 상황 추적

```typescript
interface CreationProgress {
  total: number;
  completed: number;
  failed: number;
  currentStudent: string | null;
  studentProgress: Record<string, number>;
}
```

### Phase 3: 고급 기능 (2-3주)

#### 3.1 템플릿 기능

- 자주 사용하는 설정 저장
- 템플릿 목록 및 관리
- 템플릿으로 빠른 생성

#### 3.2 일괄 작업 최적화

- 조건부 플랜 생성
- 그룹별 일괄 생성
- 스케줄링 기능

#### 3.3 생성 이력

- 생성 이력 조회
- 재사용 가능한 설정 저장
- 통계 및 분석

---

## 📦 컴포넌트 재사용 전략

### 기존 컴포넌트 활용

#### 1. 위저드 컴포넌트

```typescript
// 기존: app/(admin)/admin/students/[id]/plans/_components/admin-wizard/
// 재사용: app/(admin)/admin/plan-creation/_components/wizards/

// 래퍼 컴포넌트 생성
export function BatchPlanGroupWizard({
  studentIds,
  onSuccess,
}: {
  studentIds: string[];
  onSuccess: (results: CreationResult[]) => void;
}) {
  // 기존 위저드를 배치 모드로 래핑
  return (
    <AdminPlanCreationWizard7Step
      studentIds={studentIds}
      mode="batch"
      onSuccess={onSuccess}
    />
  );
}
```

#### 2. 모달 컴포넌트

```typescript
// 기존 모달을 재사용하되, 다중 학생 지원 추가
export function BatchAIPlanModal({
  studentIds,
  onSuccess,
}: {
  studentIds: string[];
  onSuccess: (results: CreationResult[]) => void;
}) {
  // 기존 BatchAIPlanModal 재사용
  // 다중 학생 지원 로직 추가
}
```

### 새로운 컴포넌트

#### 1. 통합 허브 컴포넌트

```typescript
export function PlanCreationHub() {
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<CreationMethod | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<CreationProgress | null>(null);
  const [results, setResults] = useState<CreationResult[]>([]);

  return (
    <div className="flex flex-col gap-6">
      <StudentSelector
        selectedStudents={selectedStudents}
        onSelectionChange={setSelectedStudents}
      />
      <CreationMethodSelector
        selectedMethod={selectedMethod}
        onMethodSelect={setSelectedMethod}
        disabled={selectedStudents.length === 0}
      />
      {selectedMethod && (
        <ActiveCreationSection
          method={selectedMethod}
          students={selectedStudents}
          onStart={handleStart}
          onProgress={setProgress}
          onComplete={setResults}
        />
      )}
      {isCreating && progress && (
        <ProgressTracker progress={progress} onCancel={handleCancel} />
      )}
      {results.length > 0 && (
        <ResultSummary results={results} />
      )}
    </div>
  );
}
```

---

## 🔄 마이그레이션 계획

### 기존 기능 유지

기존 페이지들의 기능은 유지하되, 새로운 통합 섹션을 추가합니다:

1. **학생 목록 페이지**: 기존 배치 AI 플랜 생성 버튼 유지
2. **학생 상세 페이지**: 플랜 생성 버튼 추가 (통합 섹션으로 이동)
3. **플랜 관리 페이지**: 기존 기능 유지

### 점진적 마이그레이션

#### Phase 1: 병행 운영

- 새로운 통합 섹션 구축
- 기존 기능 유지
- 사용자 피드백 수집

#### Phase 2: 기능 통합

- 기존 페이지에서 통합 섹션으로 리다이렉트
- 기존 기능은 내부적으로 통합 섹션 사용

#### Phase 3: 완전 통합

- 기존 페이지의 플랜 생성 기능 제거
- 모든 플랜 생성은 통합 섹션에서만 가능

---

## 📊 데이터 모델

### 상태 관리

```typescript
interface PlanCreationState {
  // 학생 선택
  selectedStudents: Student[];

  // 생성 방법
  selectedMethod: CreationMethod | null;

  // 생성 설정 (방법별로 다름)
  settings: PlanCreationSettings;

  // 진행 상황
  progress: {
    isCreating: boolean;
    total: number;
    completed: number;
    failed: number;
    currentStudent: string | null;
    studentProgress: Record<
      string,
      {
        status: "pending" | "processing" | "completed" | "failed";
        progress: number;
        error?: string;
      }
    >;
  };

  // 결과
  results: CreationResult[];
}

type CreationMethod =
  | "batch-ai"
  | "plan-group-wizard"
  | "quick-plan"
  | "content-wizard";

interface PlanCreationSettings {
  method: CreationMethod;
  // 방법별 설정
  batchAISettings?: BatchAISettings;
  planGroupSettings?: PlanGroupSettings;
  quickPlanSettings?: QuickPlanSettings;
  contentWizardSettings?: ContentWizardSettings;
}
```

### API/Server Actions

```typescript
// 기존 Server Actions 재사용
// 새로운 배치 처리 Server Actions 추가

// 배치 플랜 그룹 생성
export async function batchCreatePlanGroups(
  studentIds: string[],
  settings: PlanGroupSettings
): Promise<BatchCreationResult>;

// 배치 빠른 플랜 추가
export async function batchCreateQuickPlans(
  studentIds: string[],
  settings: QuickPlanSettings
): Promise<BatchCreationResult>;
```

---

## 🚀 구현 우선순위

### Phase 1: MVP (2-3주)

**목표**: 기본 통합 섹션 구축

1. ✅ 페이지 및 기본 구조 생성
2. ✅ 학생 선택 컴포넌트
3. ✅ 생성 방법 선택 컴포넌트
4. ✅ 배치 AI 플랜 생성 통합
5. ✅ 진행 상황 추적
6. ✅ 결과 요약

**기대 효과**:

- 모든 플랜 생성 기능을 한 곳에서 접근 가능
- 기본적인 배치 작업 지원

### Phase 2: 위저드 통합 (2-3주)

**목표**: 모든 위저드 기능 통합

1. ✅ 플랜 그룹 생성 위저드 배치 모드 지원
2. ✅ 빠른 플랜 추가 배치 모드 지원
3. ✅ 콘텐츠 추가 위저드 배치 모드 지원
4. ✅ 부분 실패 처리 개선
5. ✅ 진행 상황 추적 개선

**기대 효과**:

- 모든 플랜 생성 방법 지원
- 완전한 배치 작업 지원

### Phase 3: 고급 기능 (2-3주)

**목표**: 사용성 및 효율성 향상

1. ✅ 템플릿 기능
2. ✅ 생성 이력
3. ✅ 조건부 일괄 생성
4. ✅ 통계 및 분석

**기대 효과**:

- 반복 작업 효율화
- 데이터 기반 의사결정 지원

---

## 📝 상세 구현 계획

### 1. 학생 선택 컴포넌트

**파일**: `app/(admin)/admin/plan-creation/_components/StudentSelector.tsx`

**기능**:

- 학생 검색
- 필터링 (학년, 구분, 상태)
- 다중 선택
- 선택 요약

**구현**:

```typescript
export function StudentSelector({
  selectedStudents,
  onSelectionChange,
}: {
  selectedStudents: Student[];
  onSelectionChange: (students: Student[]) => void;
}) {
  // 학생 목록 조회 (기존 로직 재사용)
  // 검색 및 필터링
  // 다중 선택 UI
  // 선택 요약 표시
}
```

### 2. 생성 방법 선택 컴포넌트

**파일**: `app/(admin)/admin/plan-creation/_components/CreationMethodSelector.tsx`

**기능**:

- 4가지 방법 카드 표시
- 각 방법 설명 및 아이콘
- 선택 상태 관리

**구현**:

```typescript
const METHODS: CreationMethodInfo[] = [
  {
    id: "batch-ai",
    name: "AI 플랜 생성",
    icon: Wand2,
    description: "AI가 자동으로 최적의 학습 플랜을 생성합니다",
    features: ["빠른 생성", "AI 최적화", "다중 학생 지원"],
  },
  {
    id: "plan-group-wizard",
    name: "플랜 그룹 생성",
    icon: FileText,
    description: "7단계 위저드로 상세한 플랜 그룹을 생성합니다",
    features: ["세밀한 설정", "콘텐츠 선택", "스케줄 커스터마이징"],
  },
  // ...
];
```

### 3. 배치 처리 로직

**파일**: `app/(admin)/admin/plan-creation/_hooks/useBatchCreation.ts`

**기능**:

- 여러 학생에게 순차적/병렬 처리
- 진행 상황 추적
- 에러 처리

**구현**:

```typescript
export function useBatchCreation() {
  const [progress, setProgress] = useState<CreationProgress | null>(null);

  const createBatch = async (
    studentIds: string[],
    method: CreationMethod,
    settings: PlanCreationSettings
  ) => {
    // 배치 처리 로직
    // 진행 상황 업데이트
    // 결과 수집
  };

  return { createBatch, progress };
}
```

---

## ✅ 체크리스트

### Phase 1: MVP

- [ ] 페이지 및 라우트 생성
- [ ] 학생 선택 컴포넌트 구현
- [ ] 생성 방법 선택 컴포넌트 구현
- [ ] 배치 AI 플랜 생성 통합
- [ ] 진행 상황 추적 구현
- [ ] 결과 요약 구현
- [ ] 기본 스타일링 및 반응형 디자인
- [ ] 에러 처리
- [ ] 로딩 상태 처리

### Phase 2: 위저드 통합

- [ ] 플랜 그룹 위저드 배치 모드 지원
- [ ] 빠른 플랜 추가 배치 모드 지원
- [ ] 콘텐츠 추가 위저드 배치 모드 지원
- [ ] 부분 실패 처리 개선
- [ ] 진행 상황 추적 개선
- [ ] 재시도 기능

### Phase 3: 고급 기능

- [ ] 템플릿 저장 기능
- [ ] 템플릿 목록 및 관리
- [ ] 생성 이력 조회
- [ ] 조건부 일괄 생성
- [ ] 통계 및 분석

---

## 🎯 성공 지표

### 사용성 지표

1. **접근성**: 플랜 생성 기능 발견 시간 단축 (목표: 50% 감소)
2. **효율성**: 여러 학생에게 플랜 생성 시간 단축 (목표: 30% 감소)
3. **만족도**: 사용자 만족도 조사 (목표: 4.0/5.0 이상)

### 기술적 지표

1. **성능**: 페이지 로딩 시간 (목표: 2초 이하)
2. **안정성**: 에러 발생률 (목표: 1% 이하)
3. **재사용성**: 코드 재사용률 (목표: 70% 이상)

---

## 📚 참고 자료

### 관련 문서

- `2025-02-02-admin-student-list-plan-creation-ui-audit.md`: 현재 상태 분석
- `2025-02-02-admin-plan-creation-scenario-and-camp-integration.md`: 플랜 생성 시나리오

### 기존 컴포넌트

- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/`: 플랜 그룹 위저드
- `app/(admin)/admin/students/_components/BatchAIPlanModal.tsx`: 배치 AI 플랜 생성
- `app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx`: 빠른 플랜 추가

---

## 🔄 다음 단계

1. **설계 검토**: 팀 내 설계 검토 및 피드백 수집
2. **프로토타입**: 핵심 기능 프로토타입 개발
3. **사용자 테스트**: 프로토타입으로 사용자 테스트 진행
4. **개발 시작**: Phase 1 MVP 개발 시작

---

**문서 작성 완료일**: 2025-02-02


