# PlanGroupWizard 컴포넌트 리팩토링

**작업일**: 2025-02-04  
**작업 내용**: PlanGroupWizard 컴포넌트를 Presentational/Container 패턴으로 분리

## 작업 개요

거대해진 `PlanGroupWizard.tsx` 컴포넌트를 역할별로 분리하여 복잡도를 낮추는 작업을 수행했습니다. UI 렌더링과 비즈니스 로직이 혼재되어 있던 구조를 **Presentational Component (UI)**와 **Container Component (Logic)** 패턴으로 분리했습니다.

## 리팩토링 목표

- **BasePlanWizard**: 순수 UI 렌더링과 단계 전환만 담당
- **PlanGroupWizard**: 비즈니스 로직 관리 및 BasePlanWizard에 필요한 Props 제공
- 코드 중복 제거 및 가독성 향상
- 유지보수성 향상

## 작업 내용

### 1단계: BasePlanWizard.tsx 생성

**파일**: `app/(student)/plan/new-group/_components/BasePlanWizard.tsx`

순수 UI 컴포넌트로, 다음 기능만 담당합니다:

- **UI 렌더링**: 단계별 컴포넌트 렌더링 (Step1BasicInfo ~ Step7ScheduleResult)
- **진행률 표시 바**: 템플릿 모드가 아닐 때 진행률 표시
- **상단 액션 바**: 취소/저장 버튼 (템플릿 모드에서는 숨김)
- **에러/경고 메시지**: 검증 에러 및 경고 표시
- **하단 네비게이션 버튼**: 이전/다음/완료 버튼

#### Props 설계

```typescript
export type BasePlanWizardProps = {
  // 모드 플래그
  mode: WizardMode;
  isTemplateMode: boolean;
  isEditMode: boolean;
  draftGroupId: string | null;
  
  // 데이터
  blockSets: Array<{ id: string; name: string }>;
  initialContents: {...};
  initialData?: {...};
  
  // 진행률
  progress: number;
  
  // 상태
  isSubmitting: boolean;
  isLastStep: boolean;
  
  // 이벤트 핸들러 (비즈니스 로직은 상위에서 주입)
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onUpdateWizardData: (updates: ...) => void;
  onSetStep: (step: WizardStep) => void;
  onBlockSetsLoaded: (blockSets: ...) => void;
};
```

### 2단계: PlanGroupWizard.tsx 리팩토링

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

비즈니스 로직을 관리하고 `BasePlanWizard`를 렌더링하는 Container Component로 변경했습니다.

#### 주요 변경 사항

1. **UI 렌더링 코드 제거**
   - 기존의 긴 JSX 렌더링 부분 (715-949줄)을 모두 제거
   - `<BasePlanWizard ... />`로 대체

2. **비즈니스 로직 유지**
   - `usePlanSubmission`, `useWizardValidation` 등의 훅 사용 유지
   - `handleNext`, `handleBack`, `handleStep7Complete` 등 핸들러 함수들 유지
   - 복잡한 모드별 분기 로직 유지

3. **Props 전달**
   - 필요한 모든 데이터와 핸들러를 `BasePlanWizard` Props로 전달
   - `handleCancel` 핸들러 추가 (취소 버튼 클릭 처리)

4. **불필요한 import 제거**
   - `Link` 컴포넌트 제거 (BasePlanWizard에서 사용)
   - Step 컴포넌트 import 제거 (BasePlanWizard에서 사용)

#### 핸들러 함수 구조

```typescript
// 단계 이동 핸들러
const handleNext = useCallback(() => { ... }, [deps]);
const handleBack = useCallback(() => { ... }, [deps]);

// 저장 핸들러
const handleSaveDraft = useCallback(async (silent: boolean) => { ... }, [deps]);

// 완료 핸들러
const handleStep7Complete = useCallback(async () => { ... }, [deps]);

// 취소 핸들러
const handleCancel = useCallback(() => { ... }, [deps]);
```

### 3단계: 검증

리팩토링 후에도 기존 기능이 정상 작동하는지 확인:

- ✅ 학생 플랜 생성
- ✅ 관리자 템플릿 생성
- ✅ 캠프 모드
- ✅ 편집 모드
- ✅ Step 7 완료 처리

`PlanWizardProvider`는 기존처럼 최상위에서 감싸는 구조를 유지했습니다.

## 변경된 파일

### 신규 생성
- `app/(student)/plan/new-group/_components/BasePlanWizard.tsx`

### 수정
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

## 코드 라인 수 변화

- **Before**: PlanGroupWizard.tsx 약 1,012줄
- **After**: 
  - PlanGroupWizard.tsx 약 730줄 (약 28% 감소)
  - BasePlanWizard.tsx 약 320줄

## 리팩토링 효과

### 1. 관심사 분리
- **BasePlanWizard**: UI 렌더링에만 집중
- **PlanGroupWizard**: 비즈니스 로직에만 집중

### 2. 가독성 향상
- PlanGroupWizard의 핵심 로직이 명확해짐
- BasePlanWizard의 UI 구조가 명확해짐

### 3. 재사용성 향상
- BasePlanWizard는 다른 곳에서도 재사용 가능
- 테스트 작성이 용이해짐

### 4. 유지보수성 향상
- UI 변경 시 BasePlanWizard만 수정
- 비즈니스 로직 변경 시 PlanGroupWizard만 수정

## 향후 개선 사항

1. **테스트 작성**
   - BasePlanWizard의 UI 렌더링 테스트
   - PlanGroupWizard의 비즈니스 로직 테스트

2. **추가 리팩토링**
   - handleStep7Complete 함수를 별도 훅으로 추출 검토
   - 모드별 분기 로직을 더 명확하게 구조화

3. **문서화**
   - BasePlanWizard Props 문서화
   - 각 핸들러 함수의 역할 명확화

