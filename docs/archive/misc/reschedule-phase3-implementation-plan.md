# 재조정 기능 Phase 3 구현 계획

**작성일**: 2025-01-27  
**기반 문서**: `docs/reschedule-ui-improvement-todo.md`  
**목적**: 기존 플랜 필터링과 새 플랜 생성의 논리적 일관성 개선

---

## 📋 개요

Phase 3는 재조정 기능에서 **기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록** 개선하는 것을 목표로 합니다.

### 현재 문제점

1. **기존 플랜 필터링**: `rescheduleDateRange`를 사용하여 사용자가 선택한 날짜 범위 전체를 사용 (과거 날짜 포함 가능)
2. **재조정 기간 결정**: `placementDateRange`가 없으면 `getAdjustedPeriod`로 자동 계산 (오늘 이후로 조정)
3. **문제**: 사용자가 과거 날짜를 포함한 범위를 선택하면, 기존 플랜 필터링은 선택한 범위 전체를 사용하지만 새 플랜 생성은 오늘 이후로만 생성되어 논리적 불일치 발생

### 개선 목표

- `adjustedPeriod`를 먼저 계산하고, 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정
- 사용자가 과거 날짜를 선택해도 자동으로 오늘 이후로 조정되는 것을 명확히 함
- UI에 자동 조정 안내 메시지 추가

---

## 🔧 구현 상세

### 1. 서버 액션 로직 개선

**파일**: `app/(student)/actions/plan-groups/reschedule.ts`

**변경 사항**:

#### 1.1. `_getReschedulePreview` 함수 수정

- `adjustedPeriod`를 먼저 계산 (기존 플랜 필터링 이전에)
- 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정
- `rescheduleDateRange`는 참고용으로만 사용 (UI 표시용)

**현재 로직** (150-183줄):
```typescript
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
    group.period_end,
    includeToday
  );
}
```

**개선된 로직**:
```typescript
// 1. 재조정 기간 결정: placementDateRange 우선, 없으면 자동 계산
let adjustedPeriod: { start: string; end: string };
if (placementDateRange?.from && placementDateRange?.to) {
  adjustedPeriod = {
    start: placementDateRange.from,
    end: placementDateRange.to,
  };
} else {
  // 자동 계산: rescheduleDateRange를 기반으로 오늘 이후 기간 계산
  adjustedPeriod = getAdjustedPeriod(
    rescheduleDateRange || null,
    today,
    group.period_end,
    includeToday
  );
}

// 2. 기존 플랜 필터링: adjustedPeriod 사용 (논리적 일관성 확보)
if (adjustedPeriod.start && adjustedPeriod.end) {
  query = query.gte("plan_date", adjustedPeriod.start)
              .lte("plan_date", adjustedPeriod.end);
}
```

**이유**:
- 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하여 논리적 일관성 확보
- 사용자가 과거 날짜를 선택해도 자동으로 오늘 이후로 조정되어 예상치 못한 동작 방지

#### 1.2. `_rescheduleContents` 함수 수정

- 동일한 로직 적용
- 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정

**현재 로직** (533-536줄):
```typescript
// 기존 플랜 필터링: rescheduleDateRange 사용
if (rescheduleDateRange?.from && rescheduleDateRange?.to) {
  query = query.gte("plan_date", rescheduleDateRange.from)
              .lte("plan_date", rescheduleDateRange.to);
}
```

**개선된 로직**:
```typescript
// adjustedPeriod를 먼저 계산 (미리보기와 동일한 로직)
const previewResult = await _getReschedulePreview(
  groupId,
  adjustments,
  rescheduleDateRange,
  placementDateRange,
  includeToday
);

// adjustedPeriod를 사용하여 기존 플랜 필터링
// (실제로는 _getReschedulePreview에서 이미 필터링된 결과를 사용하므로
//  여기서는 중복 필터링을 피하기 위해 previewResult의 정보 활용)
```

**주의사항**:
- `_rescheduleContents`에서 `_getReschedulePreview`를 호출하므로, 실제 필터링은 `_getReschedulePreview`에서 수행됨
- 하지만 트랜잭션 내에서 직접 쿼리하는 부분도 있으므로, 해당 부분도 수정 필요

---

### 2. UI 개선: 자동 조정 안내 추가

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`

**변경 사항**:

#### 2.1. 날짜 범위 선택 시 자동 조정 안내 추가

- 날짜 범위 선택 섹션에 안내 메시지 추가
- 과거 날짜를 선택하면 자동으로 오늘 이후로 조정된다는 것을 명확히 표시
- 실제 조정된 범위를 미리보기로 표시

**추가할 UI**:
```typescript
// 날짜 범위 선택 UI 아래에 추가
{rescheduleMode === "range" && rescheduleDateRange.from && rescheduleDateRange.to && (
  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
    <div className="flex items-start gap-2">
      <span className="text-blue-600">💡</span>
      <div className="flex-1">
        <div className="text-sm font-medium text-blue-900">
          자동 조정 안내
        </div>
        <div className="mt-1 text-xs text-blue-700">
          {(() => {
            const today = getTodayDateString();
            const tomorrow = getNextDayString(today);
            const isPastDate = isDateBefore(rescheduleDateRange.from!, tomorrow);
            
            if (isPastDate) {
              return `과거 날짜를 선택하셨습니다. 재조정 플랜은 자동으로 ${tomorrow}부터 시작됩니다.`;
            }
            return "선택한 날짜 범위에 따라 재조정이 진행됩니다.";
          })()}
        </div>
      </div>
    </div>
  </div>
)}
```

**필요한 import 추가**:
```typescript
import { getTodayDateString, getNextDayString, isDateBefore } from "@/lib/reschedule/periodCalculator";
```

#### 2.2. 실제 조정된 범위 미리보기 표시

- 날짜 범위 선택 후 실제 조정된 범위를 계산하여 표시
- `getAdjustedPeriodWithDetails` 함수 활용

**추가할 UI**:
```typescript
// 자동 조정 안내 아래에 추가
{rescheduleMode === "range" && rescheduleDateRange.from && rescheduleDateRange.to && (
  <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3">
    <div className="text-xs text-gray-600">
      <div className="font-medium text-gray-700 mb-1">실제 재조정 범위</div>
      <div className="text-gray-600">
        {(() => {
          const today = getTodayDateString();
          const adjustedPeriod = getAdjustedPeriod(
            rescheduleDateRange,
            today,
            group.period_end,
            includeToday
          );
          return `${adjustedPeriod.start} ~ ${adjustedPeriod.end}`;
        })()}
      </div>
    </div>
  </div>
)}
```

**주의사항**:
- `getAdjustedPeriod`는 서버 사이드 함수이므로, 클라이언트에서 직접 호출 불가
- 대신 클라이언트에서 간단한 계산 로직을 구현하거나, 서버 액션을 통해 조정된 범위를 받아와야 함
- 또는 `useEffect`를 사용하여 날짜 범위 변경 시 서버에 요청하여 조정된 범위를 받아올 수 있음

**대안**: 간단한 클라이언트 사이드 계산
```typescript
// 클라이언트에서 간단히 계산 (서버 로직과 동일하게)
const calculateAdjustedRange = (
  dateRange: DateRange,
  today: string,
  groupEnd: string,
  includeToday: boolean
): DateRange => {
  const startDate = includeToday ? today : getNextDayString(today);
  const adjustedStart = isDateBefore(dateRange.from!, startDate) 
    ? startDate 
    : dateRange.from!;
  const adjustedEnd = isDateBefore(groupEnd, dateRange.to!) 
    ? groupEnd 
    : dateRange.to!;
  return { from: adjustedStart, to: adjustedEnd };
};
```

---

### 3. PreviewStep 개선

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx`

**변경 사항**:

#### 3.1. 날짜 범위 정보 섹션 개선

- "재조정할 플랜 범위"와 "실제 적용 범위"를 구분하여 표시
- 자동 조정이 발생한 경우 명확한 안내 메시지 추가

**개선할 UI** (현재 272-307줄):
```typescript
// 날짜 범위 정보 섹션
<div className="rounded-lg border border-gray-200 bg-white p-6">
  <h3 className="mb-4 font-semibold text-gray-900">날짜 범위 정보</h3>
  <div className="flex flex-col gap-4">
    <div>
      <p className="text-sm font-medium text-gray-700">선택한 재조정 범위</p>
      <p className="mt-1 text-sm text-gray-600">
        {rescheduleDateRange?.from && rescheduleDateRange?.to
          ? `${rescheduleDateRange.from} ~ ${rescheduleDateRange.to}`
          : "전체 기간"}
      </p>
    </div>
    <div>
      <p className="text-sm font-medium text-gray-700">실제 적용 범위</p>
      <p className="mt-1 text-sm text-gray-600">
        {placementDateRange?.from && placementDateRange?.to
          ? `${placementDateRange.from} ~ ${placementDateRange.to}`
          : "자동 계산됨 (오늘 이후 ~ 플랜 그룹 종료일)"}
      </p>
      {/* 자동 조정 안내 */}
      {rescheduleDateRange?.from && 
       rescheduleDateRange?.to &&
       placementDateRange?.from &&
       placementDateRange?.to &&
       (rescheduleDateRange.from !== placementDateRange.from ||
        rescheduleDateRange.to !== placementDateRange.to) && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-800">
            💡 선택한 범위가 자동으로 조정되었습니다. 과거 날짜는 제외되고 오늘 이후 범위만 적용됩니다.
          </p>
        </div>
      )}
    </div>
    {/* ... 기존 코드 ... */}
  </div>
</div>
```

---

## 🔄 데이터 흐름

```
Step 1: ContentSelectStep
  └─> rescheduleDateRange 선택 (과거 날짜 포함 가능)
      └─> 자동 조정 안내 표시 (과거 날짜 선택 시)
      └─> 실제 조정된 범위 미리보기 표시

Step 2: AdjustmentStep
  └─> placementDateRange 선택 (오늘 이후만)

Step 3: PreviewStep
  └─> getReschedulePreview(groupId, adjustments, rescheduleDateRange, placementDateRange, includeToday)
      └─> adjustedPeriod 계산 (먼저)
      └─> 기존 플랜 필터링: adjustedPeriod 사용 (논리적 일관성)
      └─> 새 플랜 생성: adjustedPeriod 사용
      └─> 미리보기 결과 반환
```

---

## ✅ 테스트 체크리스트

### 기능 테스트

- [ ] 과거 날짜를 포함한 범위를 선택했을 때 자동으로 오늘 이후로 조정되는지 확인
- [ ] 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하는지 확인
- [ ] 자동 조정 안내 메시지가 표시되는지 확인
- [ ] 실제 조정된 범위 미리보기가 올바르게 표시되는지 확인
- [ ] `placementDateRange`를 수동으로 선택했을 때도 올바르게 동작하는지 확인
- [ ] 전체 기간 모드에서도 올바르게 동작하는지 확인

### 엣지 케이스 테스트

- [ ] 오늘 날짜만 선택한 경우
- [ ] 과거 날짜만 선택한 경우 (자동 조정 후 빈 범위가 되는 경우)
- [ ] 플랜 그룹 종료일 이후 날짜를 선택한 경우
- [ ] `includeToday`가 true일 때와 false일 때 모두 테스트

---

## 📊 우선순위 및 예상 기간

| 항목 | 우선순위 | 예상 기간 | 위험도 |
|------|---------|----------|--------|
| 서버 액션 로직 개선 | P0 | 0.5일 | 🟡 중간 |
| UI 자동 조정 안내 추가 | P0 | 0.5일 | 🟢 낮음 |
| PreviewStep 개선 | P1 | 0.5일 | 🟢 낮음 |
| **총 예상 기간** | - | **1일** | - |

---

## 🚨 주의사항

### 하위 호환성

- 기존 `rescheduleDateRange` 파라미터는 유지하되, 내부 로직만 변경
- `placementDateRange`가 명시적으로 제공되면 그대로 사용 (수동 선택 모드)
- `placementDateRange`가 없으면 `rescheduleDateRange`를 기반으로 자동 계산

### 성능 고려사항

- `adjustedPeriod`를 먼저 계산하므로 추가 계산 비용은 없음
- 기존 플랜 필터링 쿼리는 동일하므로 성능 영향 없음

### 사용자 경험

- 자동 조정이 발생하는 경우 명확한 안내 메시지 제공
- 실제 적용 범위를 미리보기로 표시하여 사용자 혼란 방지

---

## 📝 관련 문서

- `docs/reschedule-ui-improvement-todo.md` - 전체 개선 계획
- `docs/reschedule-phase1-implementation-2025-01-27.md` - Phase 1 완료 보고서
- `docs/reschedule-phase2-implementation-2025-01-27.md` - Phase 2 완료 보고서

---

**문서 버전**: 1.0  
**최종 수정일**: 2025-01-27

