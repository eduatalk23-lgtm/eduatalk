# Step6Simplified 돌아가기 버튼 수정

**작업 일시**: 2025-01-30  
**문제**: 최종 확인 페이지에서 step별 돌아가기 버튼 텍스트가 실제 step과 다름

## 문제 분석

### 실제 Step 매핑

`PlanGroupWizard.tsx`에서 확인한 실제 step 매핑:
- `currentStep === 1`: `Step1BasicInfo` (기본 정보)
- `currentStep === 2`: `Step2TimeSettings` (시간 설정)
- `currentStep === 3`: `Step3SchedulePreview` (스케줄 미리보기)
- `currentStep === 4`: `Step3ContentSelection` (콘텐츠 선택 - 학생 콘텐츠 + 추천 콘텐츠 통합)
- `currentStep === 5`: `Step6Simplified` (최종 확인)
- `currentStep === 6`: `Step7ScheduleResult` (스케줄 결과)

### 발견된 문제

`Step6Simplified`에서:
- ✅ "Step 1로 돌아가기" → `onEditStep(1)` → `setCurrentStep(1)` → Step1BasicInfo (기본 정보) ✅
- ✅ "Step 2로 돌아가기" → `onEditStep(2)` → `setCurrentStep(2)` → Step2TimeSettings (시간 설정) ✅
- ❌ "Step 3로 돌아가기" → `onEditStep(3)` → `setCurrentStep(3)` → Step3SchedulePreview (스케줄 미리보기) ❌
  - 실제로는 콘텐츠 선택(Step 4)로 가야 함

## 수정 내용

### 1. 타입 정의 수정

**파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

```typescript
// 수정 전
onEditStep: (step: 1 | 2 | 3) => void;

// 수정 후
onEditStep: (step: 1 | 2 | 4) => void;
```

### 2. 콘텐츠 선택 돌아가기 버튼 수정

```typescript
// 수정 전
<CollapsibleSection
  title="콘텐츠 선택"
  defaultOpen={true}
  onEdit={() => onEditStep(3)}
  editLabel="Step 3로 돌아가기"
>

// 수정 후
<CollapsibleSection
  title="콘텐츠 선택"
  defaultOpen={true}
  onEdit={() => onEditStep(4)}
  editLabel="Step 4로 돌아가기"
>
```

## 수정된 파일

- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
  - `onEditStep` 타입을 `(step: 1 | 2 | 4) => void`로 수정
  - 콘텐츠 선택 돌아가기 버튼을 `onEditStep(4)`로 변경
  - 버튼 텍스트를 "Step 4로 돌아가기"로 수정

## Step 매핑 정리

### 실제 Step 번호와 컴포넌트

| currentStep | 컴포넌트 | 설명 |
|------------|---------|------|
| 1 | Step1BasicInfo | 기본 정보 |
| 2 | Step2TimeSettings | 시간 설정 |
| 3 | Step3SchedulePreview | 스케줄 미리보기 |
| 4 | Step3ContentSelection | 콘텐츠 선택 (학생 + 추천 통합) |
| 5 | Step6Simplified | 최종 확인 |
| 6 | Step7ScheduleResult | 스케줄 결과 |

### Step6Simplified 돌아가기 버튼

| 섹션 | 버튼 텍스트 | 이동 Step | 컴포넌트 |
|------|-----------|----------|---------|
| 기본 정보 | Step 1로 돌아가기 | 1 | Step1BasicInfo ✅ |
| 시간 설정 | Step 2로 돌아가기 | 2 | Step2TimeSettings ✅ |
| 콘텐츠 선택 | Step 4로 돌아가기 | 4 | Step3ContentSelection ✅ |

## 예상 효과

- ✅ 콘텐츠 선택 돌아가기 버튼이 올바른 step으로 이동
- ✅ 버튼 텍스트가 실제 step 번호와 일치
- ✅ 사용자가 혼란 없이 원하는 단계로 이동 가능

## 테스트 시나리오

1. **최종 확인 페이지 접근**
   - Step 5 (최종 확인)로 이동

2. **콘텐츠 선택 돌아가기 버튼 클릭**
   - "Step 4로 돌아가기" 버튼 클릭
   - Step 4 (콘텐츠 선택)로 정상 이동 확인

3. **다른 돌아가기 버튼 확인**
   - "Step 1로 돌아가기" → Step 1 (기본 정보)로 이동 ✅
   - "Step 2로 돌아가기" → Step 2 (시간 설정)로 이동 ✅

## 관련 파일

- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

