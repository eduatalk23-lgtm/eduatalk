# 재조정 기능 Phase 3 구현 TODO

**작성일**: 2025-01-27  
**기반 문서**: `docs/reschedule-phase3-implementation-plan.md`  
**목적**: 기존 플랜 필터링과 새 플랜 생성의 논리적 일관성 개선

---

## 📋 목차

1. [개요](#개요)
2. [구현 TODO](#구현-todo)
3. [테스트 시나리오](#테스트-시나리오)
4. [체크리스트](#체크리스트)

---

## 📋 개요

### 목표

재조정 기능에서 **기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록** 개선합니다.

### 현재 문제점

- 사용자가 과거 날짜를 포함한 `rescheduleDateRange`를 선택하면
- 기존 플랜 필터링은 선택한 범위 전체를 사용하지만
- 새 플랜 생성은 `adjustedPeriod`를 사용하여 오늘 이후로만 생성됨
- 결과적으로 과거 날짜의 플랜은 비활성화되지만 새 플랜이 생성되지 않음

### 개선 방안

1. `adjustedPeriod`를 먼저 계산
2. 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정
3. UI에 자동 조정 안내 메시지 추가

---

## 📝 구현 TODO

### Phase 3-1: 서버 액션 로직 개선 (우선순위 P0)

**목표**: 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하도록 수정

**예상 기간**: 0.5일

**위험도**: 🟡 중간

#### [I3-1-1] `_getReschedulePreview` 함수 수정

- **파일**: `app/(student)/actions/plan-groups/reschedule.ts`
- **작업**:
  - `adjustedPeriod`를 먼저 계산 (기존 플랜 필터링 이전에)
  - 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정
  - `rescheduleDateRange`는 참고용으로만 사용 (UI 표시용)
- **위험도**: 🟡 중간
- **의존성**: 없음

**변경 위치**: 150-183줄

**변경 전**:
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

**변경 후**:
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

#### [I3-1-2] `_rescheduleContents` 함수 수정

- **파일**: `app/(student)/actions/plan-groups/reschedule.ts`
- **작업**:
  - `adjustedPeriod`를 먼저 계산
  - 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정
  - `_getReschedulePreview`를 호출하므로 실제 필터링은 거기서 수행되지만, 트랜잭션 내 직접 쿼리 부분도 수정 필요
- **위험도**: 🟡 중간
- **의존성**: I3-1-1 완료

**변경 위치**: 526-536줄

**변경 전**:
```typescript
// 기존 플랜 필터링: rescheduleDateRange 사용
if (rescheduleDateRange?.from && rescheduleDateRange?.to) {
  query = query.gte("plan_date", rescheduleDateRange.from)
              .lte("plan_date", rescheduleDateRange.to);
}
```

**변경 후**:
```typescript
// adjustedPeriod를 먼저 계산
const today = getTodayDateString();
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

// 기존 플랜 필터링: adjustedPeriod 사용
if (adjustedPeriod.start && adjustedPeriod.end) {
  query = query.gte("plan_date", adjustedPeriod.start)
              .lte("plan_date", adjustedPeriod.end);
}
```

---

### Phase 3-2: UI 자동 조정 안내 추가 (우선순위 P0)

**목표**: 사용자가 과거 날짜를 선택해도 자동으로 오늘 이후로 조정되는 것을 명확히 표시

**예상 기간**: 0.5일

**위험도**: 🟢 낮음

#### [I3-2-1] ContentSelectStep에 자동 조정 안내 추가

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`
- **작업**:
  - 날짜 범위 선택 섹션에 자동 조정 안내 메시지 추가
  - 과거 날짜를 선택하면 자동으로 오늘 이후로 조정된다는 것을 명확히 표시
  - 필요한 유틸리티 함수 import 추가
- **위험도**: 🟢 낮음
- **의존성**: 없음

**추가할 코드 위치**: 날짜 범위 선택 UI 아래 (약 445줄 이후)

**추가할 import**:
```typescript
import { getTodayDateString, getNextDayString, isDateBefore } from "@/lib/reschedule/periodCalculator";
```

**추가할 UI**:
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

#### [I3-2-2] 실제 조정된 범위 미리보기 표시

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`
- **작업**:
  - 날짜 범위 선택 후 실제 조정된 범위를 계산하여 표시
  - 클라이언트 사이드 계산 함수 구현
- **위험도**: 🟢 낮음
- **의존성**: I3-2-1 완료

**추가할 코드 위치**: 자동 조정 안내 아래

**추가할 함수**:
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

**추가할 UI**:
```typescript
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
          return `${adjustedRange.from} ~ ${adjustedRange.to}`;
        })()}
      </div>
    </div>
  </div>
)}
```

---

### Phase 3-3: PreviewStep 개선 (우선순위 P1)

**목표**: 미리보기에서 자동 조정 정보를 명확히 표시

**예상 기간**: 0.5일

**위험도**: 🟢 낮음

#### [I3-3-1] 날짜 범위 정보 섹션 개선

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx`
- **작업**:
  - "선택한 재조정 범위"와 "실제 적용 범위"를 구분하여 표시
  - 자동 조정이 발생한 경우 명확한 안내 메시지 추가
- **위험도**: 🟢 낮음
- **의존성**: Phase 3-1, Phase 3-2 완료

**변경 위치**: 272-307줄 (날짜 범위 정보 섹션)

**변경 내용**:
- "재조정할 플랜 범위" → "선택한 재조정 범위"로 변경
- "재조정 플랜 배치 범위" → "실제 적용 범위"로 변경
- 자동 조정 안내 메시지 개선

---

## 🧪 테스트 시나리오

### 시나리오 1: 과거 날짜 포함 범위 선택

**전제 조건**:
- 플랜 그룹 기간: 2025-01-01 ~ 2025-01-28
- 재조정 시점: 2025-01-15 (오늘)
- 사용자 선택 범위: 2025-01-01 ~ 2025-01-28

**예상 동작**:
1. Step 1에서 자동 조정 안내 메시지 표시: "과거 날짜를 선택하셨습니다. 재조정 플랜은 자동으로 2025-01-16부터 시작됩니다."
2. 실제 재조정 범위 미리보기: "2025-01-16 ~ 2025-01-28"
3. 기존 플랜 필터링: 2025-01-16 ~ 2025-01-28 범위의 플랜만 필터링
4. 새 플랜 생성: 2025-01-16 ~ 2025-01-28 범위에만 생성
5. Step 3에서 "선택한 재조정 범위"와 "실제 적용 범위"가 다를 때 안내 메시지 표시

**검증 항목**:
- [ ] 자동 조정 안내 메시지가 표시되는지
- [ ] 실제 재조정 범위 미리보기가 올바른지
- [ ] 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하는지
- [ ] Step 3에서 자동 조정 안내가 표시되는지

### 시나리오 2: 오늘 이후 날짜만 선택

**전제 조건**:
- 플랜 그룹 기간: 2025-01-01 ~ 2025-01-28
- 재조정 시점: 2025-01-15 (오늘)
- 사용자 선택 범위: 2025-01-16 ~ 2025-01-28

**예상 동작**:
1. Step 1에서 자동 조정 안내 메시지 표시: "선택한 날짜 범위에 따라 재조정이 진행됩니다."
2. 실제 재조정 범위 미리보기: "2025-01-16 ~ 2025-01-28"
3. 기존 플랜 필터링: 2025-01-16 ~ 2025-01-28 범위의 플랜 필터링
4. 새 플랜 생성: 2025-01-16 ~ 2025-01-28 범위에 생성
5. Step 3에서 "선택한 재조정 범위"와 "실제 적용 범위"가 동일

**검증 항목**:
- [ ] 자동 조정 안내 메시지가 올바른지
- [ ] 실제 재조정 범위 미리보기가 올바른지
- [ ] 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하는지

### 시나리오 3: placementDateRange 수동 선택

**전제 조건**:
- 플랜 그룹 기간: 2025-01-01 ~ 2025-01-28
- 재조정 시점: 2025-01-15 (오늘)
- 사용자 선택 범위 (Step 1): 2025-01-01 ~ 2025-01-28
- 배치 범위 (Step 2): 2025-01-20 ~ 2025-01-28 (수동 선택)

**예상 동작**:
1. Step 1에서 자동 조정 안내 메시지 표시
2. Step 2에서 배치 범위 수동 선택
3. 기존 플랜 필터링: 2025-01-20 ~ 2025-01-28 범위의 플랜 필터링 (adjustedPeriod 사용)
4. 새 플랜 생성: 2025-01-20 ~ 2025-01-28 범위에 생성

**검증 항목**:
- [ ] 수동 선택한 배치 범위가 올바르게 적용되는지
- [ ] 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하는지

### 시나리오 4: includeToday 옵션 사용

**전제 조건**:
- 플랜 그룹 기간: 2025-01-01 ~ 2025-01-28
- 재조정 시점: 2025-01-15 (오늘)
- 사용자 선택 범위: 2025-01-15 ~ 2025-01-28
- includeToday: true

**예상 동작**:
1. Step 1에서 "오늘 날짜 포함" 체크박스 선택
2. 실제 재조정 범위 미리보기: "2025-01-15 ~ 2025-01-28"
3. 기존 플랜 필터링: 2025-01-15 ~ 2025-01-28 범위의 플랜 필터링
4. 새 플랜 생성: 2025-01-15 ~ 2025-01-28 범위에 생성

**검증 항목**:
- [ ] includeToday 옵션이 올바르게 적용되는지
- [ ] 오늘 날짜가 포함되는지

---

## ✅ 체크리스트

### 구현 체크리스트

- [ ] I3-1-1: `_getReschedulePreview` 함수 수정
- [ ] I3-1-2: `_rescheduleContents` 함수 수정
- [ ] I3-2-1: ContentSelectStep에 자동 조정 안내 추가
- [ ] I3-2-2: 실제 조정된 범위 미리보기 표시
- [ ] I3-3-1: PreviewStep 날짜 범위 정보 섹션 개선

### 테스트 체크리스트

- [ ] 시나리오 1: 과거 날짜 포함 범위 선택
- [ ] 시나리오 2: 오늘 이후 날짜만 선택
- [ ] 시나리오 3: placementDateRange 수동 선택
- [ ] 시나리오 4: includeToday 옵션 사용
- [ ] 엣지 케이스: 오늘 날짜만 선택
- [ ] 엣지 케이스: 과거 날짜만 선택 (자동 조정 후 빈 범위)
- [ ] 엣지 케이스: 플랜 그룹 종료일 이후 날짜 선택

### 코드 리뷰 체크리스트

- [ ] TypeScript 타입 정의 완료
- [ ] ESLint 규칙 준수
- [ ] 하위 호환성 유지
- [ ] 성능 영향 없음
- [ ] 에러 처리 완료

---

## 📊 우선순위 요약

| 우선순위 | Phase   | 기능                         | 예상 기간 | 위험도  |
| -------- | ------- | ---------------------------- | --------- | ------- |
| P0       | Phase 3-1 | 서버 액션 로직 개선         | 0.5일     | 🟡 중간 |
| P0       | Phase 3-2 | UI 자동 조정 안내 추가       | 0.5일     | 🟢 낮음 |
| P1       | Phase 3-3 | PreviewStep 개선             | 0.5일     | 🟢 낮음 |
| **총계** | -       | -                            | **1일**   | -       |

---

## 📝 참고 사항

### 현재 구현 상태

- Phase 1: 재조정 범위와 배치 범위 분리 ✅ 완료
- Phase 2: 오늘 날짜 포함 옵션 추가 ✅ 완료
- Phase 3: 기존 플랜 필터링 일관성 개선 🔄 진행 중

### 관련 문서

- `docs/reschedule-ui-improvement-todo.md` - 전체 개선 계획
- `docs/reschedule-phase1-implementation-2025-01-27.md` - Phase 1 완료 보고서
- `docs/reschedule-phase2-implementation-2025-01-27.md` - Phase 2 완료 보고서
- `docs/reschedule-phase3-implementation-plan.md` - Phase 3 구현 계획

### 의존성 순서

1. **Phase 3-1** → 다른 Phase의 기반
2. **Phase 3-2** → Phase 3-1 완료 후 구현 가능
3. **Phase 3-3** → Phase 3-1, Phase 3-2 완료 후 구현 가능

---

**문서 버전**: 1.0  
**최종 수정일**: 2025-01-27

