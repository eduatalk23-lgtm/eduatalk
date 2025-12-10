# 재조정 기능 Phase 2 구현 완료 보고서

**작업 일자**: 2025-01-27  
**작업 내용**: 오늘 날짜 포함 옵션 추가

---

## 📋 개요

재조정 기능에 "오늘 날짜 포함" 옵션을 추가하여 사용자가 오늘 날짜의 플랜도 재조정할 수 있도록 개선했습니다.

### 주요 변경 사항

1. **UI 추가**: Step 1에 "오늘 날짜 포함" 체크박스 추가
2. **로직 개선**: `periodCalculator`에 `includeToday` 옵션 추가
3. **미진행 플랜 조회**: 오늘 날짜 포함 여부에 따라 조회 조건 변경
4. **서버 액션**: 모든 관련 함수에 `includeToday` 파라미터 추가

---

## 🔧 구현 상세

### 1. ContentSelectStep 수정

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`

**변경 사항**:
- `includeToday` state 추가 (기본값: `false`)
- "재조정할 플랜 범위 선택" 섹션에 "오늘 날짜 포함" 체크박스 추가
- 체크박스 옆에 안내 메시지 표시: "오늘 날짜의 플랜도 재조정 대상에 포함됩니다. 이미 진행 중이거나 완료된 플랜은 제외됩니다."
- `onComplete` 콜백에 `includeToday` 값 전달

**주요 코드**:
```typescript
const [includeToday, setIncludeToday] = useState(false);

// UI 추가
<div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
  <label className="flex cursor-pointer items-start gap-3">
    <input
      type="checkbox"
      checked={includeToday}
      onChange={(e) => setIncludeToday(e.target.checked)}
      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      aria-label="오늘 날짜 포함"
    />
    <div className="flex-1">
      <div className="font-medium text-gray-900">오늘 날짜 포함</div>
      <div className="mt-1 text-xs text-gray-600">
        오늘 날짜의 플랜도 재조정 대상에 포함됩니다. 이미 진행 중이거나 완료된 플랜은 제외됩니다.
      </div>
    </div>
  </label>
</div>

onComplete(selectedIds, rescheduleMode === "range" ? rescheduleDateRange : null, includeToday);
```

---

### 2. RescheduleWizard 수정

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/RescheduleWizard.tsx`

**변경 사항**:
- `includeToday` state 추가
- `handleStep1Complete`에서 `includeToday` 받아서 저장
- Step 3에 `includeToday` prop 전달

**주요 코드**:
```typescript
const [includeToday, setIncludeToday] = useState(false);

const handleStep1Complete = (
  contentIds: Set<string>,
  selectedRescheduleRange: DateRange | null,
  includeTodayValue: boolean
) => {
  setSelectedContentIds(contentIds);
  setRescheduleDateRange(selectedRescheduleRange);
  setIncludeToday(includeTodayValue);
  setCompletedSteps(new Set([1]));
  setCurrentStep(2);
};

<PreviewStep
  // ... 기존 props
  includeToday={includeToday}
/>
```

---

### 3. periodCalculator 수정

**파일**: `lib/reschedule/periodCalculator.ts`

**변경 사항**:
- `getAdjustedPeriod` 함수에 `includeToday?: boolean` 파라미터 추가 (기본값: `false`)
- `includeToday`가 `true`이면 `today`부터 시작, `false`이면 `tomorrow`부터 시작
- `getAdjustedPeriodWithDetails`에도 동일한 파라미터 추가
- `validateReschedulePeriod`에도 동일한 파라미터 추가

**주요 코드**:
```typescript
export function getAdjustedPeriod(
  dateRange: { from: string; to: string } | null,
  today: string,
  groupEnd: string,
  includeToday: boolean = false
): AdjustedPeriod {
  const startDate = includeToday ? today : getNextDayString(today);
  const tomorrow = getNextDayString(today);
  
  // 전체 재조정 (날짜 범위 미지정)
  if (!dateRange) {
    if (isDateBefore(groupEnd, startDate)) {
      throw new PeriodCalculationError(
        '재조정할 기간이 남아있지 않습니다. 플랜 그룹 종료일이 오늘 이전입니다.',
        'NO_REMAINING_PERIOD'
      );
    }
    
    return {
      start: startDate,
      end: groupEnd,
    };
  }
  
  // 날짜 범위 지정된 경우
  const { from, to } = dateRange;
  
  // 선택한 범위가 모두 시작일 이전인 경우
  if (isDateBefore(to, startDate)) {
    throw new PeriodCalculationError(
      '선택한 날짜 범위에 유효한 기간이 포함되지 않았습니다.',
      'PAST_DATE_RANGE'
    );
  }
  
  // 시작일 조정: 시작일 이후로 설정
  const adjustedStart = isDateBefore(from, startDate) ? startDate : from;
  
  // 종료일: groupEnd를 초과하지 않도록
  const adjustedEnd = isDateBefore(groupEnd, to) ? groupEnd : to;
  
  return {
    start: adjustedStart,
    end: adjustedEnd,
  };
}
```

---

### 4. 미진행 플랜 조회 로직 수정

**파일**: `app/(student)/actions/plan-groups/reschedule.ts`

**변경 사항**:
- `_getReschedulePreview` 함수에 `includeToday?: boolean` 파라미터 추가
- 미진행 플랜 조회 쿼리 수정:
  - `includeToday === true`: `.lte("plan_date", today)` 사용
  - `includeToday === false`: `.lt("plan_date", today)` 사용 (기존 로직)

**주요 코드**:
```typescript
// 미진행 플랜 조회: includeToday에 따라 조건 변경
let pastUncompletedQuery = supabase
  .from("student_plan")
  .select(
    "content_id, planned_start_page_or_time, planned_end_page_or_time, completed_amount"
  )
  .eq("plan_group_id", groupId)
  .eq("student_id", group.student_id)
  .eq("is_active", true)
  .in("status", ["pending", "in_progress"]);

// includeToday가 true이면 오늘까지 포함, false이면 오늘 이전만
if (includeToday) {
  pastUncompletedQuery = pastUncompletedQuery.lte("plan_date", today);
} else {
  pastUncompletedQuery = pastUncompletedQuery.lt("plan_date", today);
}

const { data: pastUncompletedPlans } = await pastUncompletedQuery;
```

---

### 5. 서버 액션에 includeToday 파라미터 추가

**파일**: `app/(student)/actions/plan-groups/reschedule.ts`

**변경 사항**:
- `getReschedulePreview` 함수에 `includeToday?: boolean` 파라미터 추가
- `_getReschedulePreview` 호출 시 `includeToday` 전달
- `getAdjustedPeriod` 호출 시 `includeToday` 전달
- `_rescheduleContents` 함수에도 동일한 파라미터 추가
- `_rescheduleContents`에서 `_getReschedulePreview` 호출 시 `includeToday` 전달

**주요 코드**:
```typescript
async function _getReschedulePreview(
  groupId: string,
  adjustments: AdjustmentInput[],
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): Promise<ReschedulePreviewResult> {
  // ...
  
  // 재조정 기간 결정: placementDateRange 우선, 없으면 자동 계산
  let adjustedPeriod: { start: string; end: string };
  if (placementDateRange?.from && placementDateRange?.to) {
    adjustedPeriod = {
      start: placementDateRange.from,
      end: placementDateRange.to,
    };
  } else {
    // 자동 계산: rescheduleDateRange를 기반으로 오늘 이후 기간 계산
    try {
      adjustedPeriod = getAdjustedPeriod(
        rescheduleDateRange || null,
        today,
        group.period_end,
        includeToday
      );
    } catch (error) {
      if (error instanceof PeriodCalculationError) {
        throw new AppError(error.message, ErrorCode.VALIDATION_ERROR, 400, true);
      }
      throw error;
    }
  }
  // ...
}

async function _rescheduleContents(
  groupId: string,
  adjustments: AdjustmentInput[],
  reason?: string,
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null,
  includeToday: boolean = false
): Promise<RescheduleResult> {
  // ...
  
  // 새 플랜 생성 - 미리보기와 동일한 로직 사용
  const previewResult = await _getReschedulePreview(
    groupId,
    adjustments,
    rescheduleDateRange,
    placementDateRange,
    includeToday
  );
  // ...
}
```

---

### 6. PreviewStep 수정

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx`

**변경 사항**:
- `includeToday` prop 추가
- "날짜 범위 정보" 섹션에 "오늘 날짜 포함" 여부 표시
- `getReschedulePreview`와 `rescheduleContents` 호출 시 `includeToday` 전달
- `useEffect` 의존성 배열에 `includeToday` 추가

**주요 코드**:
```typescript
type PreviewStepProps = {
  groupId: string;
  adjustments: AdjustmentInput[];
  rescheduleDateRange?: { from: string; to: string } | null;
  placementDateRange?: { from: string; to: string } | null;
  includeToday?: boolean;
  onLoad: (preview: ReschedulePreviewResult) => void;
  previewResult: ReschedulePreviewResult | null;
};

// 날짜 범위 정보 섹션에 추가
<div>
  <p className="text-sm font-medium text-gray-700">오늘 날짜 포함</p>
  <p className="mt-1 text-sm text-gray-600">
    {includeToday ? "포함됨" : "제외됨"}
  </p>
  <p className="mt-1 text-xs text-gray-500">
    {includeToday
      ? "오늘 날짜의 플랜도 재조정 대상에 포함됩니다"
      : "오늘 날짜의 플랜은 재조정 대상에서 제외됩니다"}
  </p>
</div>

// 서버 액션 호출 시 includeToday 전달
const result = await getReschedulePreview(
  groupId,
  currentAdjustments,
  currentRescheduleRange || null,
  currentPlacementRange || null,
  includeToday
);

const result = await rescheduleContents(
  groupId,
  adjustments,
  undefined,
  rescheduleDateRange || null,
  placementDateRange || null,
  includeToday
);
```

---

## 🔄 데이터 흐름

```
Step 1: ContentSelectStep
  └─> includeToday 체크박스 선택
      └─> RescheduleWizard.includeToday 저장

Step 2: AdjustmentStep
  └─> (변경 없음)

Step 3: PreviewStep
  └─> getReschedulePreview(groupId, adjustments, rescheduleDateRange, placementDateRange, includeToday)
      └─> 미진행 플랜 조회: includeToday에 따라 .lt() 또는 .lte() 사용
      └─> getAdjustedPeriod(..., includeToday): includeToday에 따라 today 또는 tomorrow부터 시작
      └─> 미리보기 결과 반환
```

---

## ✅ 테스트 체크리스트

- [x] "오늘 날짜 포함" 체크박스가 표시되는지 확인
- [x] 체크박스를 선택/해제할 수 있는지 확인
- [x] 체크박스 선택 시 미진행 플랜 조회에 오늘 날짜가 포함되는지 확인
- [x] 체크박스 선택 시 재조정 기간이 오늘부터 시작하는지 확인
- [x] 체크박스 미선택 시 기존 로직(오늘 제외)이 동작하는지 확인
- [x] 오늘 날짜의 완료된 플랜은 제외되는지 확인 (기존 `isReschedulable` 로직 유지)
- [x] 오늘 날짜의 진행 중인 플랜은 제외되는지 확인 (기존 `isReschedulable` 로직 유지)
- [x] 미리보기에 "오늘 날짜 포함" 여부가 표시되는지 확인

---

## 🎯 주요 개선 사항

1. **유연성 증가**: 사용자가 오늘 날짜의 플랜도 재조정할 수 있도록 옵션 제공
2. **명확한 의도 표현**: 체크박스를 통해 사용자 의도를 명확히 표현
3. **안전한 처리**: 오늘 날짜의 진행 중이거나 완료된 플랜은 자동으로 제외 (기존 `isReschedulable` 로직 유지)
4. **하위 호환성**: `includeToday` 파라미터는 선택적이며 기본값은 `false`로 기존 동작 유지

---

## 📝 하위 호환성

- `includeToday` 파라미터는 선택적(optional)이며 기본값은 `false`
- 기존 코드는 `includeToday`를 전달하지 않아도 정상 동작 (오늘 날짜 제외)
- Phase 1에서 추가된 `rescheduleDateRange`, `placementDateRange`와 독립적으로 동작

---

## 🚀 다음 단계

Phase 3: 기존 플랜 필터링 일관성 개선 (우선순위 P2)
- 기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록 개선
- 과거 날짜를 선택했을 때 자동으로 오늘 이후로 조정되는 것을 명확히 함

---

**작업 완료 일자**: 2025-01-27

