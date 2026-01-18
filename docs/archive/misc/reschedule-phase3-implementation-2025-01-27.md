# 재조정 기능 Phase 3 구현 완료 보고서

**작업 일자**: 2025-01-27  
**작업 내용**: 기존 플랜 필터링과 새 플랜 생성의 논리적 일관성 개선

---

## 📋 개요

재조정 기능에서 **기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록** 개선하고, 사용자에게 자동 조정 안내를 제공했습니다.

### 주요 변경 사항

1. **서버 액션 로직 개선**: `adjustedPeriod`를 먼저 계산하고, 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정
2. **UI 자동 조정 안내 추가**: 과거 날짜 선택 시 자동 조정 안내 메시지 표시
3. **실제 조정된 범위 미리보기**: 클라이언트 사이드에서 계산하여 표시
4. **PreviewStep 개선**: 선택한 범위와 실제 적용 범위를 구분하여 표시

---

## 🔧 구현 상세

### 1. 서버 액션 로직 개선

**파일**: `app/(student)/actions/plan-groups/reschedule.ts`

#### 1.1. `_getReschedulePreview` 함수 수정

**변경 사항**:
- `adjustedPeriod`를 먼저 계산 (기존 플랜 필터링 이전에)
- 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정
- `rescheduleDateRange`는 참고용으로만 사용 (UI 표시용)

**변경 위치**: 141-183줄

**변경 전**:
```typescript
// 기존 플랜 필터링: rescheduleDateRange 사용
if (rescheduleDateRange?.from && rescheduleDateRange?.to) {
  query = query.gte("plan_date", rescheduleDateRange.from)
              .lte("plan_date", rescheduleDateRange.to);
}

// 재조정 기간 결정: placementDateRange 우선, 없으면 자동 계산
let adjustedPeriod: { start: string; end: string };
// ...
```

**변경 후**:
```typescript
// 2. 오늘 날짜 가져오기
const today = getTodayDateString();

// 2.1 재조정 기간 결정: placementDateRange 우선, 없으면 자동 계산
// adjustedPeriod를 먼저 계산하여 기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록 함
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

// 2.2 기존 플랜 조회 (재조정 대상만, 상세 정보 포함)
// 기존 플랜 필터링: adjustedPeriod 사용 (논리적 일관성 확보)
if (adjustedPeriod.start && adjustedPeriod.end) {
  query = query.gte("plan_date", adjustedPeriod.start)
              .lte("plan_date", adjustedPeriod.end);
}
```

#### 1.2. `_rescheduleContents` 함수 수정

**변경 사항**:
- 동일한 로직 적용
- 트랜잭션 내 직접 쿼리 부분도 `adjustedPeriod` 사용

**변경 위치**: 530-540줄

**변경 내용**:
- `adjustedPeriod`를 먼저 계산
- 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정

---

### 2. UI 자동 조정 안내 추가

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`

#### 2.1. 필요한 유틸리티 함수 import 추가

**변경 사항**:
- `getTodayDateString`, `getNextDayString`, `isDateBefore` import 추가

**주요 코드**:
```typescript
import { getTodayDateString, getNextDayString, isDateBefore } from "@/lib/reschedule/periodCalculator";
```

#### 2.2. 자동 조정 안내 메시지 추가

**변경 사항**:
- 날짜 범위 선택 섹션에 자동 조정 안내 메시지 추가
- 과거 날짜를 선택하면 자동으로 오늘 이후로 조정된다는 것을 명확히 표시

**추가 위치**: 날짜 범위 선택 UI 아래 (약 447줄 이후)

**주요 코드**:
```typescript
{/* 자동 조정 안내 */}
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

#### 2.3. 실제 조정된 범위 미리보기 표시

**변경 사항**:
- 클라이언트 사이드 계산 함수 구현
- 실제 조정된 범위를 미리보기로 표시

**주요 코드**:
```typescript
// 클라이언트에서 간단히 계산 (서버 로직과 동일하게)
const calculateAdjustedRange = (
  dateRange: DateRange,
  today: string,
  groupEnd: string,
  includeTodayValue: boolean
): DateRange | null => {
  if (!dateRange.from || !dateRange.to) {
    return null;
  }
  const startDate = includeTodayValue ? today : getNextDayString(today);
  const adjustedStart = isDateBefore(dateRange.from, startDate) 
    ? startDate 
    : dateRange.from;
  const adjustedEnd = isDateBefore(groupEnd, dateRange.to) 
    ? groupEnd 
    : dateRange.to;
  return { from: adjustedStart, to: adjustedEnd };
};

// UI 추가
{/* 실제 조정된 범위 미리보기 */}
{rescheduleMode === "range" && rescheduleDateRange.from && rescheduleDateRange.to && (
  <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3">
    <div className="text-xs text-gray-600">
      <div className="font-medium text-gray-700 mb-1">실제 재조정 범위</div>
      <div className="text-gray-600">
        {(() => {
          const today = getTodayDateString();
          const adjustedRange = calculateAdjustedRange(
            rescheduleDateRange,
            today,
            group.period_end,
            includeToday
          );
          if (adjustedRange && adjustedRange.from && adjustedRange.to) {
            return `${adjustedRange.from} ~ ${adjustedRange.to}`;
          }
          return "계산 중...";
        })()}
      </div>
    </div>
  </div>
)}
```

---

### 3. PreviewStep 개선

**파일**: `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx`

#### 3.1. 날짜 범위 정보 섹션 개선

**변경 사항**:
- "재조정할 플랜 범위" → "선택한 재조정 범위"로 변경
- "재조정 플랜 배치 범위" → "실제 적용 범위"로 변경
- 자동 조정이 발생한 경우 명확한 안내 메시지 추가

**주요 변경 내용**:
1. 레이블 변경: "선택한 재조정 범위", "실제 적용 범위"
2. 설명 텍스트 개선: "실제로 재조정이 적용되는 날짜 범위입니다. 기존 플랜 필터링과 새 플랜 생성이 이 범위를 사용합니다."
3. 자동 조정 안내 메시지 개선:
   - `placementDateRange`가 명시적으로 제공된 경우: "선택한 범위가 자동으로 조정되었습니다. 과거 날짜는 제외되고 오늘 이후 범위만 적용됩니다."
   - `placementDateRange`가 없고 `rescheduleDateRange`가 과거 날짜를 포함하는 경우: "선택한 범위에 과거 날짜가 포함되어 있어 자동으로 오늘 이후 범위로 조정됩니다."

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

- [x] 과거 날짜를 포함한 범위를 선택했을 때 자동으로 오늘 이후로 조정되는지 확인
- [x] 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하는지 확인
- [x] 자동 조정 안내 메시지가 표시되는지 확인
- [x] 실제 조정된 범위 미리보기가 올바르게 표시되는지 확인
- [x] `placementDateRange`를 수동으로 선택했을 때도 올바르게 동작하는지 확인
- [x] 전체 기간 모드에서도 올바르게 동작하는지 확인

### UI 테스트

- [x] ContentSelectStep에서 자동 조정 안내 메시지 표시
- [x] ContentSelectStep에서 실제 조정된 범위 미리보기 표시
- [x] PreviewStep에서 선택한 범위와 실제 적용 범위 구분 표시
- [x] PreviewStep에서 자동 조정 안내 메시지 표시

---

## 🎯 주요 개선 사항

1. **논리적 일관성 확보**: 기존 플랜 필터링과 새 플랜 생성이 같은 기간(`adjustedPeriod`)을 사용하여 논리적 일관성 확보
2. **사용자 경험 개선**: 과거 날짜 선택 시 자동 조정 안내 메시지 제공으로 사용자 혼란 방지
3. **명확한 정보 제공**: 실제 조정된 범위를 미리보기로 표시하여 사용자가 예상할 수 있도록 함
4. **PreviewStep 개선**: 선택한 범위와 실제 적용 범위를 구분하여 표시하여 사용자가 이해하기 쉽도록 함

---

## 📝 하위 호환성

- 기존 `rescheduleDateRange` 파라미터는 유지하되, 내부 로직만 변경
- `placementDateRange`가 명시적으로 제공되면 그대로 사용
- `placementDateRange`가 없으면 `rescheduleDateRange`를 기반으로 자동 계산
- 기존 코드는 정상 동작 (논리적 일관성만 개선)

---

## 🚀 다음 단계

Phase 3 구현이 완료되었습니다. 모든 개선 사항이 적용되었으며, 기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록 개선되었습니다.

---

**작업 완료 일자**: 2025-01-27

