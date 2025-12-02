# Step 6 (스케줄 결과) 버튼 기능 정리 및 개선

**작업 일시**: 2025-01-30  
**문제**: Step 6 (스케줄 결과) 페이지에서 중복되고 반응하지 않는 버튼들이 있음

## 문제 분석

### 발견된 문제점

1. **Step 6에서 불필요한 "플랜 생성하기" 버튼**
   - PlanGroupWizard의 "다음" 버튼이 Step 6에서도 "플랜 생성하기"로 표시됨
   - 이미 Step 5에서 플랜을 생성한 상태이므로 중복되고 혼란스러움

2. **버튼 레이블이 명확하지 않음**
   - "플랜 미리보기 및 재생성" 버튼은 실제로는 다이얼로그를 여는 버튼
   - PlanPreviewDialog 내부의 "플랜 미리보기", "플랜 생성하기" 버튼이 Step 6의 컨텍스트와 맞지 않음
   - Step 6에서는 이미 플랜이 생성되어 있으므로 "재생성"이 더 적절함

3. **버튼 기능이 분산되어 있음**
   - 미리보기와 재생성 기능이 여러 곳에 분산
   - 사용자가 어떤 버튼을 눌러야 할지 혼란스러움

## 수정 내용

### 1. PlanGroupWizard.tsx - Step 6에서 "다음" 버튼 숨기기

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**수정 전**:
```typescript
<button
  type="button"
  onClick={handleNext}
  disabled={isPending || currentStep === 7}
  className={`items-center justify-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400 ${
    currentStep === 7 ? "hidden" : "inline-flex"
  }`}
>
  {isPending
    ? "저장 중..."
    : currentStep === 3 && isTemplateMode
    ? "템플릿 저장하기"
    : currentStep === 4 && isCampMode && !isAdminContinueMode
    ? "참여 제출하기"
    : currentStep === 5
    ? isEditMode
      ? "수정 및 플랜 생성"
      : "플랜 생성하기"
    : currentStep === 6
    ? isEditMode
      ? "수정 및 플랜 생성"
      : "플랜 생성하기"  // ❌ 불필요한 버튼 텍스트
    : currentStep === 7
    ? ""
    : "다음"}
</button>
```

**수정 후**:
```typescript
<button
  type="button"
  onClick={handleNext}
  disabled={isPending || currentStep === 6 || currentStep === 7}  // ✅ Step 6에서 비활성화
  className={`items-center justify-center rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400 ${
    currentStep === 6 || currentStep === 7 ? "hidden" : "inline-flex"  // ✅ Step 6에서 숨김
  }`}
>
  {isPending
    ? "저장 중..."
    : currentStep === 3 && isTemplateMode
    ? "템플릿 저장하기"
    : currentStep === 4 && isCampMode && !isAdminContinueMode
    ? "참여 제출하기"
    : currentStep === 5
    ? isEditMode
      ? "수정 및 플랜 생성"
      : "플랜 생성하기"
    : "다음"}  // ✅ Step 6 조건 제거
</button>
```

**변경 사항**:
- `disabled` 조건에 `currentStep === 6` 추가
- `className`의 조건부 렌더링에 `currentStep === 6` 추가
- 버튼 텍스트에서 Step 6 관련 조건 제거

### 2. PlanPreviewDialog.tsx - 버튼 레이블 개선 및 재생성 모드 추가

**파일**: `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx`

#### 2.1. Props에 isRegenerateMode 추가

```typescript
type PlanPreviewDialogProps = {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlansGenerated?: () => void;
  isRegenerateMode?: boolean; // ✅ 추가: 이미 플랜이 생성되어 있는 경우 true
};
```

#### 2.2. 버튼 레이블 개선

**수정 전**:
```typescript
<button
  type="button"
  onClick={handlePreview}
  disabled={loading}
  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
>
  {loading ? "로딩 중..." : "플랜 미리보기"}  // ❌ 너무 긴 레이블
</button>
{plans.length > 0 && (
  <button
    type="button"
    onClick={handleGenerate}
    disabled={isGenerating}
    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
  >
    {isGenerating ? "생성 중..." : "플랜 생성하기"}  // ❌ Step 6에서는 "재생성"이 더 적절
  </button>
)}
```

**수정 후**:
```typescript
<button
  type="button"
  onClick={handlePreview}
  disabled={loading}
  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
>
  {loading ? "로딩 중..." : "미리보기"}  // ✅ 간결한 레이블
</button>
{plans.length > 0 && (
  <button
    type="button"
    onClick={handleGenerate}
    disabled={isGenerating}
    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
  >
    {isGenerating ? "생성 중..." : isRegenerateMode ? "재생성하기" : "플랜 생성하기"}  // ✅ 컨텍스트에 맞는 레이블
  </button>
)}
```

#### 2.3. 확인 메시지 개선

```typescript
const handleGenerate = () => {
  const message = isRegenerateMode
    ? "플랜을 재생성하시겠습니까? 기존 플랜이 삭제되고 새로 생성됩니다."
    : "플랜을 생성하시겠습니까? 기존 플랜이 있다면 삭제되고 새로 생성됩니다.";
  
  if (!confirm(message)) {
    return;
  }
  // ...
};
```

### 3. Step7ScheduleResult.tsx - isRegenerateMode 전달

**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx`

```typescript
<PlanPreviewDialog
  groupId={groupId}
  open={previewOpen}
  onOpenChange={setPreviewOpen}
  isRegenerateMode={true}  // ✅ 추가: Step 6에서는 재생성 모드
  onPlansGenerated={() => {
    // 플랜 재생성 후 데이터 새로고침
    // ...
  }}
/>
```

## 수정된 파일 목록

1. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
   - Step 6에서 "다음" 버튼 숨김
   - 버튼 텍스트 조건 단순화

2. `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx`
   - `isRegenerateMode` prop 추가
   - 버튼 레이블 개선: "플랜 미리보기" → "미리보기"
   - 버튼 레이블 컨텍스트 인식: "플랜 생성하기" vs "재생성하기"
   - 확인 메시지 개선

3. `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx`
   - `isRegenerateMode={true}` prop 전달

## Step별 버튼 플로우 정리

### Step 5 (최종 확인)
- **PlanGroupWizard의 "플랜 생성하기" 버튼**: 플랜 생성 후 Step 6으로 이동

### Step 6 (스케줄 결과)
- **"플랜 미리보기 및 재생성" 버튼**: PlanPreviewDialog 열기
  - **PlanPreviewDialog의 "미리보기" 버튼**: 플랜 미리보기 실행
  - **PlanPreviewDialog의 "재생성하기" 버튼**: 플랜 재생성 (미리보기 후 표시)
- **"완료" 버튼**: 플랜 그룹 활성화 및 상세 페이지로 이동
- ~~**PlanGroupWizard의 "다음" 버튼**: 제거됨~~ ✅

## 버튼 동작 흐름

```
Step 5 (최종 확인)
  │
  └─> "플랜 생성하기" 클릭
       │
       ├─> 플랜 생성
       │
       └─> Step 6 (스케줄 결과)로 이동

Step 6 (스케줄 결과)
  │
  ├─> "플랜 미리보기 및 재생성" 클릭
  │    │
  │    └─> PlanPreviewDialog 열림
  │         │
  │         ├─> "미리보기" 클릭
  │         │    │
  │         │    └─> 플랜 미리보기 표시
  │         │
  │         └─> "재생성하기" 클릭
  │              │
  │              ├─> 확인 다이얼로그
  │              │
  │              ├─> 기존 플랜 삭제 및 새 플랜 생성
  │              │
  │              └─> Step 6 데이터 새로고침
  │
  └─> "완료" 클릭
       │
       ├─> 플랜 그룹 활성화
       │
       └─> 상세 페이지로 이동
```

## 예상 효과

### 사용자 경험 개선
- ✅ Step 6에서 불필요한 "플랜 생성하기" 버튼 제거
- ✅ 버튼 레이블이 명확해져 사용자 혼란 감소
- ✅ 재생성 시 "재생성하기"로 표시되어 의도가 명확함
- ✅ 버튼 기능이 더 직관적으로 배치됨

### 기능 개선
- ✅ Step 6에서는 Step7ScheduleResult 내부의 버튼만 사용
- ✅ PlanPreviewDialog가 사용 컨텍스트에 맞게 동작
- ✅ 반응하지 않는 버튼 문제 해결

## 테스트 시나리오

1. **Step 5에서 플랜 생성**
   - "플랜 생성하기" 버튼 클릭
   - 플랜 생성 완료 후 Step 6으로 이동 확인

2. **Step 6 버튼 확인**
   - PlanGroupWizard의 "다음" 버튼이 숨겨져 있는지 확인
   - "플랜 미리보기 및 재생성" 버튼 표시 확인
   - "완료" 버튼 표시 확인

3. **플랜 미리보기 및 재생성**
   - "플랜 미리보기 및 재생성" 버튼 클릭
   - PlanPreviewDialog 열림 확인
   - "미리보기" 버튼으로 플랜 미리보기 확인
   - "재생성하기" 버튼으로 플랜 재생성 확인 (버튼 레이블 확인)
   - 확인 메시지에 "재생성" 문구 확인

4. **완료 버튼**
   - "완료" 버튼 클릭
   - 플랜 그룹 활성화 확인
   - 상세 페이지로 이동 확인

## 관련 파일

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx`
- `app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx`

