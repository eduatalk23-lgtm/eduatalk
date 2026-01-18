# 관리자 모드 남은 단계 진행 시 전략과목/취약과목 편집 기능 추가

## 📋 작업 개요

**작업 일시**: 2025-02-02  
**작업 내용**: 관리자 모드에서 남은 단계 진행하기 중 Step 6 최종확인에서 전략과목/취약과목을 편집할 수 있도록 기능 추가

## 🔍 문제 상황

### 발생 위치
- 컴포넌트: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- 표시 위치: Step 6 (최종 확인 단계) - 관리자 모드 남은 단계 진행하기

### 문제점
- 관리자 모드에서 Step 6 진입 시 전략과목/취약과목 섹션이 표시되지만 편집 불가
- `SubjectAllocationSummary`는 읽기 전용 컴포넌트로 편집 기능이 없음
- 관리자 모드에서는 편집이 가능해야 함

## 🔧 수정 내용

### 1. Step6Simplified Props 확장

**파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

#### Props 추가
```typescript
export type Step6SimplifiedProps = {
  data: WizardData;
  onEditStep: (step: 1 | 2 | 4) => void;
  isCampMode?: boolean;
  isAdminContinueMode?: boolean;
  onUpdate?: (updates: Partial<WizardData>) => void;  // ✅ 추가
  contents?: {                                        // ✅ 추가
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  studentId?: string;                                 // ✅ 추가
};
```

### 2. SubjectAllocationEditor 컴포넌트 추가

관리자 모드에서 편집 가능한 UI 컴포넌트를 추가했습니다.

**주요 기능**:
- 콘텐츠에서 과목 정보 추출
- 각 과목별로 전략과목/취약과목 선택
- 전략과목 선택 시 주당 배정 일수 설정 (2일, 3일, 4일)
- `onUpdate`를 통해 `subject_allocations` 업데이트

**구현 내용**:
```typescript
function SubjectAllocationEditor({
  data,
  onUpdate,
  contents,
}: {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contents: { ... };
}) {
  // contentInfos 생성 (data.student_contents와 data.recommended_contents에서)
  const contentInfos = useMemo(() => {
    // 학생 콘텐츠 + 추천 콘텐츠 통합
    // ...
  }, [data.student_contents, data.recommended_contents]);

  // 과목 추출 및 편집 UI 렌더링
  // ...
}
```

### 3. 조건부 렌더링 추가

관리자 모드일 때는 편집 UI를, 일반 모드일 때는 읽기 전용 요약을 표시합니다.

```typescript
{isAdminContinueMode && onUpdate && contents ? (
  <SubjectAllocationEditor
    data={data}
    onUpdate={onUpdate}
    contents={contents}
  />
) : (
  <SubjectAllocationSummary data={data} />
)}
```

### 4. PlanGroupWizard에서 Props 전달

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

관리자 모드일 때 `onUpdate`, `contents`, `studentId`를 전달합니다.

```typescript
<Step6Simplified
  data={wizardData}
  onEditStep={(step) => setCurrentStep(step)}
  isCampMode={isCampMode}
  isAdminContinueMode={isAdminContinueMode}
  onUpdate={isAdminContinueMode ? updateWizardData : undefined}  // ✅ 추가
  contents={isAdminContinueMode ? initialContents : undefined}   // ✅ 추가
  studentId={(initialData as any)?.student_id}                   // ✅ 추가
/>
```

## ✅ 수정 결과

### 수정 전
- 관리자 모드에서 Step 6 진입 시 전략과목/취약과목 섹션이 표시되지만 편집 불가
- 읽기 전용 요약만 표시됨

### 수정 후
- 관리자 모드에서 Step 6 진입 시 전략과목/취약과목을 편집할 수 있음
- 각 과목별로 전략과목/취약과목 선택 가능
- 전략과목 선택 시 주당 배정 일수 설정 가능 (2일, 3일, 4일)
- 변경 사항이 `wizardData.subject_allocations`에 즉시 반영됨

## 📝 참고 사항

### 편집 UI 기능

1. **과목 유형 선택**
   - 취약과목: 전체 학습일에 플랜 배정
   - 전략과목: 주당 배정 일수에 따라 배정

2. **주당 배정 일수 설정** (전략과목 선택 시)
   - 주 2일
   - 주 3일
   - 주 4일

3. **콘텐츠 개수 표시**
   - 각 과목별로 포함된 콘텐츠 개수 표시

### 데이터 흐름

1. `data.student_contents`와 `data.recommended_contents`에서 과목 정보 추출
2. 각 과목별로 전략과목/취약과목 선택
3. `onUpdate({ subject_allocations: updatedAllocations })` 호출
4. `wizardData.subject_allocations` 업데이트

## 🧪 테스트 확인 사항

1. ✅ 관리자 모드에서 Step 6 진입 시 편집 UI 표시 확인
2. ✅ 과목별로 전략과목/취약과목 선택 가능 확인
3. ✅ 전략과목 선택 시 주당 배정 일수 설정 가능 확인
4. ✅ 변경 사항이 즉시 반영되는지 확인
5. ✅ 일반 모드에서는 읽기 전용 요약만 표시되는지 확인

## 📚 관련 파일

- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`

