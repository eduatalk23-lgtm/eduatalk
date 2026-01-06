# 관리자 영역 플랜 생성 플로우 점검 및 개선 계획

**작성일**: 2025-02-02  
**작성자**: AI Assistant  
**관련 문서**: 
- `2025-02-02-admin-plan-creation-unified-section-plan.md`
- `2025-02-02-plan-creation-features-comprehensive-analysis.md`

---

## 📋 목차

1. [현재 플로우 분석](#현재-플로우-분석)
2. [문제점 분석](#문제점-분석)
3. [개선 작업 단위](#개선-작업-단위)
4. [구현 우선순위](#구현-우선순위)
5. [성공 지표](#성공-지표)

---

## 🔍 현재 플로우 분석

### 1. 플랜 생성 진입점

#### 1.1 통합 플랜 생성 페이지 (`/admin/plan-creation`)

**구조**:
```
/app/(admin)/admin/plan-creation/
├── page.tsx                    # 서버 컴포넌트 (학생 목록 로드)
├── _components/
│   ├── PlanCreationClient.tsx  # 클라이언트 래퍼
│   ├── student-selection/       # 학생 선택 섹션
│   ├── method-selection/        # 방법 선택 섹션
│   ├── creation-flow/           # 생성 플로우 섹션
│   ├── progress/                # 진행 상황 추적
│   ├── results/                 # 결과 표시
│   └── ...
└── _context/
    └── PlanCreationContext.tsx  # 상태 관리 (2-Layer Context)
```

**플로우**:
1. 학생 선택 (다중 선택 가능)
2. 생성 방법 선택 (4가지)
3. 생성 플로우 실행
4. 결과 표시

**지원하는 생성 방법**:
- `batch-ai`: 배치 AI 플랜 생성
- `plan-group-wizard`: 플랜 그룹 생성 위저드 (7단계)
- `quick-plan`: 빠른 플랜 추가
- `content-wizard`: 콘텐츠 추가 위저드

#### 1.2 학생 상세 페이지 (`/admin/students/[id]/plans`)

**구조**:
```
/app/(admin)/admin/students/[id]/plans/
├── page.tsx                          # 서버 컴포넌트
└── _components/
    ├── AdminPlanManagement.tsx        # 메인 관리 컴포넌트
    ├── AdminPlanCreationWizard7Step.tsx  # 7단계 위저드
    ├── AdminAIPlanModal.tsx          # AI 플랜 생성 모달
    ├── AdminQuickPlanModal.tsx       # 빠른 플랜 추가 모달
    └── AddContentWizard.tsx          # 콘텐츠 추가 위저드
```

**플로우**:
- 단일 학생 대상
- 각 기능이 독립적인 모달/위저드로 구현
- 통합 플랜 생성 페이지와 중복

#### 1.3 학생 목록 페이지 (`/admin/students`)

**구조**:
```
/app/(admin)/admin/students/
├── page.tsx
└── _components/
    └── BatchAIPlanModal.tsx          # 배치 AI 플랜 생성 모달
```

**플로우**:
- 학생 목록에서 다중 선택
- 배치 AI 플랜 생성만 지원
- 통합 플랜 생성 페이지와 중복

---

### 2. 플랜 생성 방법별 상세 분석

#### 2.1 배치 AI 플랜 생성 (`batch-ai`)

**컴포넌트 경로**:
- 통합 페이지: `app/(admin)/admin/plan-creation/_components/creation-flow/BatchAIPlanWrapper.tsx`
- 학생 목록: `app/(admin)/admin/students/_components/BatchAIPlanModal.tsx`

**플로우**:
1. 설정: 기간, 학습 시간, 옵션 설정
2. 미리보기: 생성된 플랜 미리보기
3. 진행: 실시간 진행 상황 표시
4. 결과: 생성 결과 요약

**특징**:
- ✅ 다중 학생 지원
- ✅ 실시간 진행 상황 추적
- ✅ 부분 실패 처리
- ❌ 에러 메시지가 기술적임
- ❌ 재시도 기능 제한적

**서버 액션**:
- `lib/domains/plan/llm/actions/generatePlan.ts`: `generatePlanWithAI`
- `app/api/admin/batch-plan/stream/route.ts`: 스트리밍 API

#### 2.2 플랜 그룹 생성 위저드 (`plan-group-wizard`)

**컴포넌트 경로**:
- 통합 페이지: `app/(admin)/admin/plan-creation/_components/creation-flow/PlanGroupWizardWrapper.tsx`
- 학생 상세: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**플로우** (7단계):
1. 기본 정보: 플랜 이름, 기간, 목적, 블록셋
2. 시간 설정: 학원 일정, 제외일, 시간 설정
3. 스케줄 미리보기: 스케줄 미리보기
4. 콘텐츠 선택: 콘텐츠 선택
5. 배분 설정: 전략/취약과목 배분
6. 최종 검토: 최종 검토
7. 생성 및 결과: 플랜 생성 및 결과

**특징**:
- ✅ 4-Layer Context 패턴 사용
- ✅ 자동 저장 지원
- ✅ 에러 바운더리 적용
- ❌ 배치 모드 지원 제한적 (단일 학생 위주)
- ❌ 다중 학생 처리 시 UI 복잡도 증가

**서버 액션**:
- `lib/domains/plan/actions/plan-groups/create.ts`: `createPlanGroupAction`
- `lib/data/planGroups/core.ts`: `createPlanGroup`

**검증**:
- `lib/validation/planValidator.ts`: `PlanValidator.validateCreation`
- `app/(student)/plan/new-group/_components/utils/planValidation.ts`: 단계별 검증

#### 2.3 빠른 플랜 추가 (`quick-plan`)

**컴포넌트 경로**:
- 통합 페이지: `app/(admin)/admin/plan-creation/_components/creation-flow/QuickPlanWrapper.tsx`
- 학생 상세: `app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx`

**플로우**:
1. 콘텐츠 선택
2. 날짜 및 시간 설정
3. 생성 및 저장

**특징**:
- ✅ 간단한 UI
- ✅ 빠른 생성
- ❌ 배치 모드 지원 제한적
- ❌ 검증 로직 부족

**서버 액션**:
- `lib/domains/admin-plan/actions/adHocPlan.ts`: `createStudentAdHocPlan`
- `lib/domains/plan/actions/contentPlanGroup/quickCreate.ts`: `quickCreateFromContent`

#### 2.4 콘텐츠 추가 위저드 (`content-wizard`)

**컴포넌트 경로**:
- 통합 페이지: `app/(admin)/admin/plan-creation/_components/creation-flow/ContentWizardWrapper.tsx`
- 학생 상세: `app/(admin)/admin/students/[id]/plans/_components/add-content-wizard/AddContentWizard.tsx`

**플로우** (3단계):
1. 콘텐츠 정보 입력
2. 배치 방식 선택 (오늘/주간/기간)
3. 생성 및 저장

**특징**:
- ✅ 유연한 콘텐츠 생성
- ✅ 배치 방식 지원
- ❌ 배치 모드 지원 제한적 (단일 학생 위주)
- ❌ 검증 로직 부족

**서버 액션**:
- `lib/domains/admin-plan/actions/createPlanFromContent.ts`: `createPlanFromContent`
- `app/(admin)/admin/students/[id]/plans/_components/AddContentModal.tsx`: 모달 내부 로직

---

### 3. 상태 관리 분석

#### 3.1 통합 플랜 생성 페이지 Context

**파일**: `app/(admin)/admin/plan-creation/_context/PlanCreationContext.tsx`

**구조** (2-Layer Context):
- `SelectionContext`: 학생 선택 및 방법 선택
- `FlowContext`: 생성 플로우 및 결과 관리

**상태 구조**:
```typescript
interface PlanCreationState {
  // Selection
  selectedStudentIds: Set<string>;
  selectedMethod: CreationMethod | null;
  
  // Flow
  currentStep: PlanCreationStep;
  isCreating: boolean;
  creationResults: CreationResult[];
  retryStudentIds: string[];
  error: string | null;
}
```

**특징**:
- ✅ 명확한 책임 분리
- ✅ 재사용 가능한 훅 제공
- ❌ 배치 처리 진행 상황 추적 부족
- ❌ 에러 복구 메커니즘 제한적

#### 3.2 플랜 그룹 위저드 Context

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/`

**구조** (4-Layer Context):
- `AdminWizardDataContext`: 위저드 데이터
- `AdminWizardStepContext`: 단계 관리
- `AdminWizardValidationContext`: 검증
- `AdminWizardProvider`: 통합 프로바이더

**특징**:
- ✅ 복잡한 위저드 상태 관리에 적합
- ✅ 자동 저장 지원
- ❌ 배치 모드 지원 부족

---

### 4. 에러 처리 분석

#### 4.1 에러 처리 패턴

**현재 구현**:
1. **서버 액션 레벨**: `{ success: boolean, error?: string }` 형태 반환
2. **컴포넌트 레벨**: try-catch로 에러 캐치 후 토스트 표시
3. **검증 레벨**: `ValidationResult` 타입으로 에러/경고 반환

**문제점**:
- ❌ 에러 메시지가 기술적임 (사용자 친화적이지 않음)
- ❌ 에러 복구 메커니즘 부족
- ❌ 부분 실패 처리 일관성 부족
- ❌ 에러 로깅 및 추적 부족

#### 4.2 검증 로직 분석

**검증 계층**:
1. **클라이언트 검증**: React 컴포넌트 내부
2. **서버 검증**: Server Actions 내부
3. **데이터베이스 검증**: 제약 조건

**검증 도구**:
- `lib/validation/planValidator.ts`: `PlanValidator` 클래스
- `lib/domains/plan/services/planValidationService.ts`: `PlanValidationService` 클래스
- `app/(student)/plan/new-group/_components/utils/planValidation.ts`: 단계별 검증

**문제점**:
- ❌ 검증 로직이 분산되어 있음
- ❌ 검증 메시지 일관성 부족
- ❌ 배치 모드 검증 부족

---

## ⚠️ 문제점 분석

### 1. 구조적 문제

#### 1.1 기능 중복

**문제**:
- 통합 플랜 생성 페이지와 학생 상세 페이지에 동일한 기능이 중복 구현됨
- 학생 목록 페이지에도 배치 AI 플랜 생성 기능이 별도로 존재

**영향**:
- 코드 중복으로 인한 유지보수 어려움
- 기능 개선 시 여러 곳 수정 필요
- 일관성 없는 사용자 경험

**예시**:
```typescript
// 통합 페이지
app/(admin)/admin/plan-creation/_components/creation-flow/BatchAIPlanWrapper.tsx

// 학생 목록 페이지
app/(admin)/admin/students/_components/BatchAIPlanModal.tsx

// 학생 상세 페이지
app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx
```

#### 1.2 배치 처리 지원 부족

**문제**:
- 플랜 그룹 위저드, 빠른 플랜 추가, 콘텐츠 추가 위저드가 단일 학생 위주로 설계됨
- 다중 학생 처리 시 순차 처리로 인한 성능 저하
- 진행 상황 추적이 일관되지 않음

**영향**:
- 여러 학생에게 플랜을 생성할 때 시간이 오래 걸림
- 사용자가 진행 상황을 파악하기 어려움
- 부분 실패 시 복구 어려움

#### 1.3 상태 관리 분산

**문제**:
- 각 생성 방법마다 별도의 상태 관리 로직
- 통합 플랜 생성 페이지의 Context와 각 위저드의 Context가 분리됨
- 상태 동기화 어려움

**영향**:
- 상태 불일치 가능성
- 디버깅 어려움
- 기능 확장 시 복잡도 증가

### 2. 사용자 경험 문제

#### 2.1 에러 메시지

**문제**:
- 에러 메시지가 기술적임 (예: "플랜 그룹 생성 실패: ... (코드: ...)")
- 사용자가 이해하기 어려운 메시지
- 에러 복구 방법 제시 부족

**예시**:
```typescript
// 현재
"플랜 그룹 생성 실패: duplicate key value violates unique constraint (코드: 23505)"

// 개선 필요
"이미 동일한 이름의 플랜 그룹이 존재합니다. 다른 이름을 사용해주세요."
```

#### 2.2 진행 상황 추적

**문제**:
- 배치 AI 플랜 생성만 실시간 진행 상황 표시
- 다른 방법들은 진행 상황 추적 부족
- 부분 실패 시 어떤 학생이 실패했는지 파악 어려움

**영향**:
- 사용자가 대기 시간 동안 불안감
- 실패 원인 파악 어려움
- 재시도 시 전체 재실행 필요

#### 2.3 검증 피드백

**문제**:
- 검증 실패 시 에러 메시지가 단계별로 표시되지 않음
- 어떤 필드가 문제인지 명확하지 않음
- 검증 경고가 무시되기 쉬움

**영향**:
- 사용자가 문제를 해결하기 어려움
- 반복적인 시도로 인한 시간 낭비

### 3. 기술적 문제

#### 3.1 검증 로직 분산

**문제**:
- 검증 로직이 여러 파일에 분산되어 있음
- 검증 메시지 일관성 부족
- 배치 모드 검증 부족

**파일 위치**:
- `lib/validation/planValidator.ts`
- `lib/domains/plan/services/planValidationService.ts`
- `app/(student)/plan/new-group/_components/utils/planValidation.ts`
- 각 컴포넌트 내부

#### 3.2 에러 처리 일관성 부족

**문제**:
- 에러 처리 패턴이 일관되지 않음
- 에러 로깅 부족
- 에러 복구 메커니즘 부족

**현재 패턴**:
```typescript
// 패턴 1: { success, error } 반환
const result = await createPlanGroup(...);
if (!result.success) {
  toast.showError(result.error);
}

// 패턴 2: throw Error
try {
  await generatePlans(...);
} catch (error) {
  toast.showError(error.message);
}

// 패턴 3: ValidationResult
const validation = PlanValidator.validateCreation(...);
if (!validation.valid) {
  setErrors(validation.errors);
}
```

#### 3.3 성능 문제

**문제**:
- 배치 처리 시 순차 처리로 인한 성능 저하
- 대량 학생 처리 시 타임아웃 가능성
- 불필요한 리렌더링

**영향**:
- 사용자 대기 시간 증가
- 서버 부하 증가
- 타임아웃 에러 발생 가능성

---

## 🔧 개선 작업 단위

### Phase 1: 구조 개선 (우선순위: 높음)

#### 작업 1.1: 통합 컴포넌트 추출

**목표**: 중복된 컴포넌트를 공통 컴포넌트로 추출

**작업 내용**:
1. 배치 AI 플랜 생성 컴포넌트 통합
   - `BatchAIPlanWrapper`를 공통 컴포넌트로 추출
   - 학생 목록 페이지와 통합 페이지에서 재사용
2. 플랜 그룹 위저드 배치 모드 지원
   - `PlanGroupWizardWrapper`에 배치 모드 추가
   - 다중 학생 처리 로직 구현
3. 빠른 플랜 추가 배치 모드 지원
   - `QuickPlanWrapper`에 배치 모드 추가
4. 콘텐츠 추가 위저드 배치 모드 지원
   - `ContentWizardWrapper`에 배치 모드 추가

**예상 작업 시간**: 2-3주

**파일 구조**:
```
/components/admin/plan-creation/
├── BatchAIPlanCreator.tsx        # 공통 배치 AI 플랜 생성
├── PlanGroupWizardCreator.tsx    # 공통 플랜 그룹 위저드 (배치 지원)
├── QuickPlanCreator.tsx          # 공통 빠른 플랜 추가 (배치 지원)
└── ContentWizardCreator.tsx      # 공통 콘텐츠 위저드 (배치 지원)
```

#### 작업 1.2: 배치 처리 인프라 구축

**목표**: 일관된 배치 처리 및 진행 상황 추적

**작업 내용**:
1. 배치 처리 유틸리티 생성
   - `lib/utils/batchProcessor.ts`: 배치 처리 로직
   - `lib/utils/progressTracker.ts`: 진행 상황 추적
2. 배치 처리 훅 생성
   - `lib/hooks/useBatchCreation.ts`: 배치 생성 훅
   - `lib/hooks/useProgressTracker.ts`: 진행 상황 추적 훅
3. 진행 상황 UI 컴포넌트 통합
   - `components/admin/plan-creation/ProgressTracker.tsx` 개선
   - 학생별 진행 상황 표시

**예상 작업 시간**: 1-2주

**구현 예시**:
```typescript
// lib/utils/batchProcessor.ts
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options?: {
    concurrency?: number;
    onProgress?: (progress: BatchProgress) => void;
    onError?: (error: Error, item: T) => void;
  }
): Promise<BatchResult<T, R>> {
  // 배치 처리 로직
}
```

#### 작업 1.3: 상태 관리 통합

**목표**: 일관된 상태 관리 및 동기화

**작업 내용**:
1. 통합 상태 관리 Context 개선
   - `PlanCreationContext`에 배치 처리 상태 추가
   - 진행 상황 추적 상태 통합
2. 위저드 Context와 통합
   - 위저드 Context를 통합 Context로 통합 가능하도록 리팩토링
3. 상태 동기화 메커니즘 구현
   - 상태 변경 이벤트 시스템

**예상 작업 시간**: 1-2주

### Phase 2: 사용자 경험 개선 (우선순위: 중간)

#### 작업 2.1: 에러 메시지 개선

**목표**: 사용자 친화적인 에러 메시지 및 복구 방법 제시

**작업 내용**:
1. 에러 메시지 매핑 시스템 구축
   - `lib/errors/errorMessageMapper.ts`: 에러 코드 → 사용자 친화적 메시지
   - 기술적 에러를 사용자 친화적 메시지로 변환
2. 에러 복구 메커니즘 구현
   - 자동 재시도 로직
   - 부분 실패 시 재시도 옵션 제공
3. 에러 상세 정보 모달
   - 기술적 에러 정보는 상세 보기에서만 표시

**예상 작업 시간**: 1주

**구현 예시**:
```typescript
// lib/errors/errorMessageMapper.ts
export const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  "23505": {
    userMessage: "이미 동일한 이름의 플랜 그룹이 존재합니다.",
    recovery: "다른 이름을 사용하거나 기존 플랜 그룹을 수정해주세요.",
    action: "이름 변경",
  },
  // ...
};
```

#### 작업 2.2: 진행 상황 추적 개선

**목표**: 모든 생성 방법에 일관된 진행 상황 추적

**작업 내용**:
1. 진행 상황 추적 통합
   - 모든 생성 방법에 진행 상황 추적 적용
   - 학생별 진행 상황 표시
2. 진행 상황 UI 개선
   - 진행률 바, 예상 시간, 현재 작업 표시
   - 부분 실패 시 명확한 표시
3. 취소 기능 추가
   - 진행 중인 작업 취소 기능

**예상 작업 시간**: 1주

#### 작업 2.3: 검증 피드백 개선

**목표**: 명확한 검증 피드백 및 해결 방법 제시

**작업 내용**:
1. 검증 메시지 개선
   - 필드별 검증 메시지 표시
   - 해결 방법 제시
2. 실시간 검증 피드백
   - 입력 중 실시간 검증
   - 경고 메시지 명확화
3. 검증 요약 표시
   - 모든 검증 에러/경고 요약 표시

**예상 작업 시간**: 1주

### Phase 3: 기술적 개선 (우선순위: 낮음)

#### 작업 3.1: 검증 로직 통합

**목표**: 검증 로직 중앙화 및 일관성 확보

**작업 내용**:
1. 검증 서비스 통합
   - `lib/validation/planValidationService.ts` 생성
   - 모든 검증 로직을 한 곳으로 통합
2. 검증 메시지 표준화
   - 검증 메시지 포맷 표준화
   - 다국어 지원 준비
3. 배치 모드 검증 추가
   - 다중 학생 검증 로직

**예상 작업 시간**: 1-2주

#### 작업 3.2: 에러 처리 표준화

**목표**: 일관된 에러 처리 패턴

**작업 내용**:
1. 에러 처리 유틸리티 생성
   - `lib/utils/errorHandler.ts`: 통합 에러 처리
   - 에러 로깅 시스템
2. 에러 타입 정의
   - `lib/types/errors.ts`: 에러 타입 정의
   - 에러 코드 표준화
3. 에러 복구 메커니즘 구현
   - 자동 재시도
   - 부분 실패 복구

**예상 작업 시간**: 1주

#### 작업 3.3: 성능 최적화

**목표**: 배치 처리 성능 개선

**작업 내용**:
1. 병렬 처리 구현
   - 동시 처리 수 제한 (concurrency)
   - 우선순위 큐 구현
2. 캐싱 전략
   - 학생 정보 캐싱
   - 콘텐츠 정보 캐싱
3. 최적화된 쿼리
   - 배치 쿼리 최적화
   - 불필요한 리렌더링 방지

**예상 작업 시간**: 1-2주

---

## 📊 구현 우선순위

### 우선순위 1: 구조 개선 (즉시 시작)

**이유**:
- 중복 코드 제거로 유지보수성 향상
- 배치 처리 지원으로 사용자 경험 개선
- 이후 개선 작업의 기반이 됨

**작업 순서**:
1. 작업 1.1: 통합 컴포넌트 추출 (2-3주)
2. 작업 1.2: 배치 처리 인프라 구축 (1-2주)
3. 작업 1.3: 상태 관리 통합 (1-2주)

**예상 총 소요 시간**: 4-7주

### 우선순위 2: 사용자 경험 개선 (구조 개선 후)

**이유**:
- 사용자 만족도 향상
- 에러 처리 개선으로 운영 안정성 향상

**작업 순서**:
1. 작업 2.1: 에러 메시지 개선 (1주)
2. 작업 2.2: 진행 상황 추적 개선 (1주)
3. 작업 2.3: 검증 피드백 개선 (1주)

**예상 총 소요 시간**: 3주

### 우선순위 3: 기술적 개선 (사용자 경험 개선 후)

**이유**:
- 장기적 유지보수성 향상
- 성능 개선으로 확장성 향상

**작업 순서**:
1. 작업 3.1: 검증 로직 통합 (1-2주)
2. 작업 3.2: 에러 처리 표준화 (1주)
3. 작업 3.3: 성능 최적화 (1-2주)

**예상 총 소요 시간**: 3-5주

---

## 📈 성공 지표

### 정량적 지표

1. **코드 중복 감소**
   - 목표: 중복 코드 50% 감소
   - 측정: 코드 라인 수 비교

2. **배치 처리 성능**
   - 목표: 10명 학생 처리 시간 50% 감소
   - 측정: 배치 처리 시간 측정

3. **에러 발생률**
   - 목표: 에러 발생률 30% 감소
   - 측정: 에러 로그 분석

4. **사용자 만족도**
   - 목표: 사용자 만족도 4.0/5.0 이상
   - 측정: 사용자 설문 조사

### 정성적 지표

1. **사용자 경험**
   - 에러 메시지 이해도 향상
   - 진행 상황 파악 용이성 향상
   - 검증 피드백 명확성 향상

2. **개발자 경험**
   - 코드 유지보수성 향상
   - 디버깅 용이성 향상
   - 기능 확장 용이성 향상

---

## 📝 체크리스트

### Phase 1: 구조 개선

- [ ] 작업 1.1: 통합 컴포넌트 추출
  - [ ] 배치 AI 플랜 생성 컴포넌트 통합
  - [ ] 플랜 그룹 위저드 배치 모드 지원
  - [ ] 빠른 플랜 추가 배치 모드 지원
  - [ ] 콘텐츠 추가 위저드 배치 모드 지원
- [ ] 작업 1.2: 배치 처리 인프라 구축
  - [ ] 배치 처리 유틸리티 생성
  - [ ] 배치 처리 훅 생성
  - [ ] 진행 상황 UI 컴포넌트 통합
- [ ] 작업 1.3: 상태 관리 통합
  - [ ] 통합 상태 관리 Context 개선
  - [ ] 위저드 Context와 통합
  - [ ] 상태 동기화 메커니즘 구현

### Phase 2: 사용자 경험 개선

- [ ] 작업 2.1: 에러 메시지 개선
  - [ ] 에러 메시지 매핑 시스템 구축
  - [ ] 에러 복구 메커니즘 구현
  - [ ] 에러 상세 정보 모달
- [ ] 작업 2.2: 진행 상황 추적 개선
  - [ ] 진행 상황 추적 통합
  - [ ] 진행 상황 UI 개선
  - [ ] 취소 기능 추가
- [ ] 작업 2.3: 검증 피드백 개선
  - [ ] 검증 메시지 개선
  - [ ] 실시간 검증 피드백
  - [ ] 검증 요약 표시

### Phase 3: 기술적 개선

- [ ] 작업 3.1: 검증 로직 통합
  - [ ] 검증 서비스 통합
  - [ ] 검증 메시지 표준화
  - [ ] 배치 모드 검증 추가
- [ ] 작업 3.2: 에러 처리 표준화
  - [ ] 에러 처리 유틸리티 생성
  - [ ] 에러 타입 정의
  - [ ] 에러 복구 메커니즘 구현
- [ ] 작업 3.3: 성능 최적화
  - [ ] 병렬 처리 구현
  - [ ] 캐싱 전략
  - [ ] 최적화된 쿼리

---

## 🔄 다음 단계

1. **팀 검토**: 이 문서를 팀에 공유하고 피드백 수집
2. **우선순위 확정**: 비즈니스 요구사항에 따라 우선순위 조정
3. **작업 시작**: Phase 1 작업 1.1부터 시작
4. **정기 점검**: 주간 진행 상황 점검 및 조정

---

**문서 작성 완료일**: 2025-02-02

