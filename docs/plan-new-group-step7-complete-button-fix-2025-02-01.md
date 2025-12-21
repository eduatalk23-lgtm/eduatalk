# 플랜 생성 위저드 Step 7 완료 버튼 위치 수정

**작업 일자**: 2025-02-01  
**작업 내용**: 스케줄 결과 단계(Step 7)의 완료 버튼을 하단 네비게이션 영역으로 이동

## 문제 상황

`/plan/new-group` 페이지의 스케줄 결과 단계(Step 7)에서:
- 완료 버튼이 스케줄 결과 영역 내부에 위치하여 일관성 없는 UI
- 하단 네비게이션 영역의 완료 버튼이 Step 7일 때 숨겨져 있음

## 요구사항

스케줄 결과 단계에서 완료 버튼을 하단 네비게이션 영역에 표시하여 다른 단계와 일관된 UI 제공

## 해결 방법

### 1. Step7ScheduleResult 컴포넌트 내부 완료 버튼 제거

`Step7ScheduleResult` 컴포넌트 내부에 있던 완료 버튼을 제거하여 스케줄 결과 영역만 표시하도록 수정:

```typescript
// app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx

// 완료 버튼 제거
<ScheduleTableView
  dailySchedule={dailySchedule}
  plans={plans}
  contents={contents}
  blocks={blocks}
/>
// 완료 버튼 제거됨
```

### 2. PlanGroupWizard 하단 네비게이션에 Step 7 완료 버튼 추가

`PlanGroupWizard` 컴포넌트의 하단 네비게이션 영역에서 Step 7일 때 완료 버튼을 표시하도록 수정:

```typescript
// app/(student)/plan/new-group/_components/PlanGroupWizard.tsx

{/* 네비게이션 버튼 */}
<div className="mt-6 flex justify-between">
  <div className="flex gap-2">
    <button
      type="button"
      onClick={handleBack}
      disabled={currentStep === 1 || isSubmitting}
      className="..."
    >
      이전
    </button>
  </div>
  {currentStep === 7 && draftGroupId && !isTemplateMode ? (
    <button
      type="button"
      onClick={handleStep7Complete}
      disabled={isSubmitting}
      className="..."
    >
      완료
    </button>
  ) : (
    <button
      type="button"
      onClick={handleNext}
      disabled={isSubmitting}
      className="..."
    >
      {isSubmitting ? "저장 중..." : isLastStep ? "완료" : "다음"}
    </button>
  )}
</div>
```

### 3. Step 7 완료 핸들러 분리

Step 7 완료 로직을 별도 함수로 추출하여 재사용 가능하도록 수정:

```typescript
// Step 7 완료 핸들러
const handleStep7Complete = useCallback(async () => {
  if (!draftGroupId) return;

  // 관리자 continue 모드 처리
  if (isAdminContinueMode) {
    // ... 관리자 모드 로직
    return;
  }

  // 일반 모드(학생 모드) 처리
  // 플랜 확인, 활성화 다이얼로그 표시, 활성화 및 리다이렉트
  // ...
}, [draftGroupId, isAdminContinueMode, wizardData, currentStep, initialData, toast, setValidationErrors, router]);
```

## 수정된 파일

1. **app/(student)/plan/new-group/_components/Step7ScheduleResult.tsx**
   - 컴포넌트 내부의 완료 버튼 제거
   - 스케줄 결과 영역만 표시하도록 수정

2. **app/(student)/plan/new-group/_components/PlanGroupWizard.tsx**
   - `handleStep7Complete` 함수 추가 (Step 7 완료 로직 분리)
   - 하단 네비게이션에서 Step 7일 때 완료 버튼 표시
   - `Step7ScheduleResult`의 `onComplete` prop에 `handleStep7Complete` 전달

## 동작 원리

1. Step 7 진입 시 `Step7ScheduleResult` 컴포넌트가 스케줄 결과만 표시
2. 하단 네비게이션 영역에 완료 버튼이 표시됨
3. 완료 버튼 클릭 시 `handleStep7Complete` 함수 실행
4. 플랜 확인, 활성화 다이얼로그 표시(필요 시), 활성화 및 리다이렉트 처리

## UI 개선 효과

- **일관성**: 모든 단계에서 하단 네비게이션 영역에 버튼이 표시되어 일관된 UI 제공
- **사용성**: 사용자가 항상 같은 위치에서 다음/완료 버튼을 찾을 수 있음
- **접근성**: 하단 고정 네비게이션으로 스크롤 없이 버튼에 접근 가능

## 참고 사항

- Step 7 완료 버튼은 플랜이 생성되었을 때만 활성화되어야 하지만, 현재는 `isSubmitting` 상태만 확인
- 향후 플랜 생성 상태를 확인하여 버튼 활성화/비활성화 로직을 추가할 수 있음
- 템플릿 모드일 때는 Step 7이 표시되지 않으므로 완료 버튼도 표시되지 않음








