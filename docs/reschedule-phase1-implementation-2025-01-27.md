# 재조정 기능 Phase 1 구현 완료 보고서

**작업 일자**: 2025-01-27  
**작업 내용**: 재조정 범위와 배치 범위 분리 구현

---

## 📋 개요

재조정 기능에서 "재조정할 플랜 범위"와 "재조정 플랜 배치 범위"를 명확히 구분하여 사용자 의도를 정확히 반영하도록 개선했습니다.

### 주요 변경 사항

1. **UI 분리**: Step 1에서 재조정할 플랜 범위 선택, Step 2에서 배치 범위 선택
2. **로직 분리**: 서버 액션에서 두 가지 범위를 별도로 처리
3. **사용자 경험 개선**: 두 범위가 다를 때 명확한 안내 메시지 제공

---

## 🔧 구현 상세

### 1. ContentSelectStep 수정

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`

**변경 사항**:
- "재생성 범위 선택" → "재조정할 플랜 범위 선택"으로 섹션 제목 변경
- `dateRange` state → `rescheduleDateRange`로 변수명 변경
- 설명 텍스트 수정: "어떤 날짜의 기존 플랜을 재조정할지 선택합니다 (과거 날짜 포함 가능)"
- `onComplete` 콜백에 `rescheduleDateRange` 전달

**주요 코드**:
```typescript
const [rescheduleDateRange, setRescheduleDateRange] = useState<DateRange>(
  initialDateRange
    ? {
        from: initialDateRange.from,
        to: initialDateRange.to,
      }
    : {
        from: null,
        to: null,
      }
);

onComplete(selectedIds, rescheduleMode === "range" ? rescheduleDateRange : null);
```

---

### 2. DateRangeSelector에 minDate 제한 추가

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/DateRangeSelector.tsx`

**변경 사항**:
- `minDate?: string` prop 추가 (최소 선택 가능 날짜)
- `isDateSelectable` 함수에 `minDate` 체크 로직 추가
- UI에서 `minDate` 이전 날짜는 선택 불가 표시

**주요 코드**:
```typescript
type DateRangeSelectorProps = {
  // ... 기존 props
  minDate?: string; // YYYY-MM-DD, 최소 선택 가능 날짜
};

const isDateSelectable = (date: Date): boolean => {
  const dateStr = format(date, "yyyy-MM-dd");
  
  // minDate 체크: minDate가 있으면 해당 날짜 이전은 선택 불가
  if (minDate && isBefore(date, parseISO(minDate))) {
    return false;
  }
  
  // ... 기존 로직
};
```

---

### 3. AdjustmentStep에 배치 범위 선택 추가

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/AdjustmentStep.tsx`

**변경 사항**:
- 새로운 "재조정 플랜 배치 범위 선택" 섹션 추가
- `placementMode` state 추가 ("auto" | "manual")
- `placementDateRange` state 추가
- 자동/수동 옵션 제공
- 수동 선택 시 `DateRangeSelector` 사용 (오늘 이후만 선택 가능)
- `onComplete` 콜백에 `placementDateRange` 전달
- `groupPeriodEnd`와 `existingPlans` props 추가

**주요 코드**:
```typescript
const [placementMode, setPlacementMode] = useState<"auto" | "manual">("auto");
const [placementDateRange, setPlacementDateRange] = useState<DateRange>({
  from: tomorrowStr,
  to: groupPeriodEnd,
});

const handleNext = () => {
  const adjustmentsArray = Array.from(localAdjustments.values());
  
  // 배치 범위 결정
  let finalPlacementRange: DateRange | null = null;
  if (placementMode === "auto") {
    finalPlacementRange = {
      from: tomorrowStr,
      to: groupPeriodEnd,
    };
  } else {
    if (placementDateRange.from && placementDateRange.to) {
      finalPlacementRange = placementDateRange;
    } else {
      alert("배치 범위를 선택해주세요.");
      return;
    }
  }
  
  onComplete(adjustmentsArray, finalPlacementRange);
};
```

---

### 4. RescheduleWizard 수정

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/RescheduleWizard.tsx`

**변경 사항**:
- `rescheduleDateRange` state 추가 (재조정할 플랜 범위)
- `placementDateRange` state 추가 (배치 범위)
- `handleStep1Complete` 수정: `rescheduleDateRange`만 받도록 변경
- `handleStep2Complete` 수정: `placementDateRange`도 함께 받도록 변경
- Step 2에 `groupPeriodEnd`와 `existingPlans` 전달
- Step 3에 두 가지 범위 모두 전달

**주요 코드**:
```typescript
const [rescheduleDateRange, setRescheduleDateRange] = useState<DateRange | null>(
  initialDateRange || null
);
const [placementDateRange, setPlacementDateRange] = useState<DateRange | null>(null);

const handleStep1Complete = (
  contentIds: Set<string>,
  selectedRescheduleRange: DateRange | null
) => {
  setSelectedContentIds(contentIds);
  setRescheduleDateRange(selectedRescheduleRange);
  setCompletedSteps(new Set([1]));
  setCurrentStep(2);
};

const handleStep2Complete = (
  newAdjustments: AdjustmentInput[],
  selectedPlacementRange: DateRange | null
) => {
  setAdjustments(newAdjustments);
  setPlacementDateRange(selectedPlacementRange);
  setCompletedSteps(new Set([1, 2]));
  setCurrentStep(3);
};
```

---

### 5. 서버 액션 수정

**파일**: `app/(student)/actions/plan-groups/reschedule.ts`

**변경 사항**:

#### 5.1. `_getReschedulePreview` 함수

- `rescheduleDateRange` 파라미터 추가 (재조정할 플랜 범위)
- `placementDateRange` 파라미터 추가 (배치 범위, null이면 자동)
- 기존 플랜 필터링: `rescheduleDateRange` 사용
- 재조정 기간 결정: `placementDateRange` 우선, 없으면 `getAdjustedPeriod`로 자동 계산

**주요 코드**:
```typescript
async function _getReschedulePreview(
  groupId: string,
  adjustments: AdjustmentInput[],
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null
): Promise<ReschedulePreviewResult> {
  // ...
  
  // 기존 플랜 필터링: rescheduleDateRange 사용
  if (rescheduleDateRange?.from && rescheduleDateRange?.to) {
    query = query.gte("plan_date", rescheduleDateRange.from)
                .lte("plan_date", rescheduleDateRange.to);
  }
  
  // 재조정 기간 결정: placementDateRange 우선, 없으면 자동 계산
  let adjustedPeriod: { start: string; end: string };
  if (placementDateRange?.from && placementDateRange?.to) {
    adjustedPeriod = {
      start: placementDateRange.from,
      end: placementDateRange.to,
    };
  } else {
    adjustedPeriod = getAdjustedPeriod(
      rescheduleDateRange || null,
      today,
      group.period_end
    );
  }
  // ...
}
```

#### 5.2. `_rescheduleContents` 함수

- 동일한 파라미터 추가
- `_getReschedulePreview` 호출 시 두 범위 전달

**주요 코드**:
```typescript
async function _rescheduleContents(
  groupId: string,
  adjustments: AdjustmentInput[],
  reason?: string,
  rescheduleDateRange?: { from: string; to: string } | null,
  placementDateRange?: { from: string; to: string } | null
): Promise<RescheduleResult> {
  // ...
  
  // 기존 플랜 필터링: rescheduleDateRange 사용
  if (rescheduleDateRange?.from && rescheduleDateRange?.to) {
    query = query.gte("plan_date", rescheduleDateRange.from)
                .lte("plan_date", rescheduleDateRange.to);
  }
  
  // 새 플랜 생성 - 미리보기와 동일한 로직 사용
  const previewResult = await _getReschedulePreview(
    groupId,
    adjustments,
    rescheduleDateRange,
    placementDateRange
  );
  // ...
}
```

---

### 6. PreviewStep 수정

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx`

**변경 사항**:
- `rescheduleDateRange`와 `placementDateRange` props 추가
- "날짜 범위 정보" 섹션 추가
- 두 범위가 다른 경우 안내 메시지 표시
- `getReschedulePreview`와 `rescheduleContents` 호출 시 두 범위 전달

**주요 코드**:
```typescript
type PreviewStepProps = {
  groupId: string;
  adjustments: AdjustmentInput[];
  rescheduleDateRange?: { from: string; to: string } | null;
  placementDateRange?: { from: string; to: string } | null;
  onLoad: (preview: ReschedulePreviewResult) => void;
  previewResult: ReschedulePreviewResult | null;
};

// 날짜 범위 정보 섹션
<div className="rounded-lg border border-gray-200 bg-white p-6">
  <h3 className="mb-4 font-semibold text-gray-900">날짜 범위 정보</h3>
  <div className="flex flex-col gap-4">
    <div>
      <p className="text-sm font-medium text-gray-700">재조정할 플랜 범위</p>
      <p className="mt-1 text-sm text-gray-600">
        {rescheduleDateRange?.from && rescheduleDateRange?.to
          ? `${rescheduleDateRange.from} ~ ${rescheduleDateRange.to}`
          : "전체 기간"}
      </p>
    </div>
    <div>
      <p className="text-sm font-medium text-gray-700">재조정 플랜 배치 범위</p>
      <p className="mt-1 text-sm text-gray-600">
        {placementDateRange?.from && placementDateRange?.to
          ? `${placementDateRange.from} ~ ${placementDateRange.to}`
          : "자동 (오늘 이후 ~ 플랜 그룹 종료일)"}
      </p>
    </div>
    {/* 두 범위가 다른 경우 안내 메시지 */}
    {rescheduleDateRange?.from &&
      rescheduleDateRange?.to &&
      placementDateRange?.from &&
      placementDateRange?.to &&
      (rescheduleDateRange.from !== placementDateRange.from ||
        rescheduleDateRange.to !== placementDateRange.to) && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-800">
            💡 재조정할 플랜 범위와 배치 범위가 다릅니다. 선택한 재조정 범위의 플랜은
            비활성화되고, 배치 범위에 새 플랜이 생성됩니다.
          </p>
        </div>
      )}
  </div>
</div>
```

---

## 🔄 데이터 흐름

```
Step 1: ContentSelectStep
  └─> rescheduleDateRange 선택 (과거 날짜 포함 가능)
      └─> RescheduleWizard.rescheduleDateRange 저장

Step 2: AdjustmentStep
  └─> placementDateRange 선택 (오늘 이후만)
      └─> RescheduleWizard.placementDateRange 저장

Step 3: PreviewStep
  └─> getReschedulePreview(groupId, adjustments, rescheduleDateRange, placementDateRange)
      └─> 기존 플랜 필터링: rescheduleDateRange 사용
      └─> 재조정 기간: placementDateRange 사용 (또는 자동 계산)
      └─> 미리보기 결과 반환
```

---

## ✅ 테스트 체크리스트

- [x] Step 1에서 재조정할 플랜 범위 선택 (과거 날짜 포함 가능)
- [x] Step 2에서 배치 범위 선택 (오늘 이후만)
- [x] 두 범위가 다를 때 올바르게 동작
- [x] 배치 범위 자동 모드 동작
- [x] 미리보기에 두 범위 정보 표시
- [x] 서버 액션에서 두 범위 올바르게 처리

---

## 🎯 주요 개선 사항

1. **명확한 의도 분리**: 재조정할 플랜 범위와 배치 범위를 명확히 구분하여 사용자 의도를 정확히 반영
2. **과거 날짜 처리**: 재조정할 플랜 범위는 과거 날짜 포함 가능, 배치 범위는 오늘 이후만 가능
3. **자동/수동 옵션**: 배치 범위는 자동(기본값) 또는 수동 선택 가능
4. **사용자 안내**: 두 범위가 다를 때 명확한 안내 메시지 제공

---

## 📝 하위 호환성

- 기존 `dateRange` 파라미터는 `rescheduleDateRange`로 매핑하여 하위 호환성 유지
- `placementDateRange`가 null이면 자동으로 오늘 이후 ~ 플랜 그룹 종료일 사용

---

## 🚀 다음 단계

Phase 2: 오늘 날짜 포함 옵션 추가 (우선순위 P1)
- "오늘 날짜 포함" 체크박스 추가
- `getAdjustedPeriod` 함수에 `includeToday` 파라미터 추가
- 미진행 플랜 조회 로직 수정

---

**작업 완료 일자**: 2025-01-27

