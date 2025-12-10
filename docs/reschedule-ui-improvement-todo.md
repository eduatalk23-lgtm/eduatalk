# 재조정 기능 UI/UX 개선 TODO

**작성일**: 2025-01-XX  
**기반 대화**: 재조정 기능 재생성 범위 선택 및 오늘 날짜 처리 개선 논의  
**목적**: 재조정 기능의 사용자 경험 개선 및 논리적 문제 해결

---

## 📋 목차

1. [문제점 분석](#문제점-분석)
2. [개선 방안](#개선-방안)
3. [구현 TODO](#구현-todo)
4. [테스트 시나리오](#테스트-시나리오)

---

## 🔍 문제점 분석

### 1. 재생성 범위 선택의 의미 혼란

**현재 상황**:

- Step 1에서 하나의 날짜 범위만 선택
- 이 날짜 범위가 두 가지 의미로 혼재되어 사용됨:
  1. **재조정할 플랜의 범위**: 어떤 날짜의 기존 플랜을 재조정할지
  2. **재조정 플랜을 배치할 범위**: 새 플랜을 어떤 날짜 범위에 배치할지

**문제점**:

- 사용자가 "재조정할 플랜 범위"를 선택한다고 생각하지만, 실제로는 "배치 범위"도 함께 결정됨
- UI에서 두 가지 의미가 명확히 구분되지 않음
- 사용자 의도와 시스템 동작이 불일치할 수 있음

**예시**:

- 사용자가 2025-01-01 ~ 2025-01-28 범위를 선택
- 의도: 이 범위의 플랜을 재조정하고 싶음
- 실제 동작:
  - 기존 플랜 필터링: 2025-01-01 ~ 2025-01-28 범위의 플랜 찾음
  - 새 플랜 생성: 2025-01-16(오늘 다음날) ~ 2025-01-28 범위에만 생성
  - 결과: 2025-01-01 ~ 2025-01-15 범위의 플랜은 사라지고 새 플랜이 생성되지 않음

---

### 2. 날짜 범위 선택 시 논리적 문제

**현재 로직** (`app/(student)/actions/plan-groups/reschedule.ts`):

```typescript
// 기존 플랜 필터링: 사용자가 선택한 날짜 범위 전체 사용
if (dateRange?.from && dateRange?.to) {
  query = query.gte("plan_date", dateRange.from).lte("plan_date", dateRange.to);
}

// 재조정 기간 결정: 오늘 이후로 자동 조정
adjustedPeriod = getAdjustedPeriod(dateRange || null, today, group.period_end);
// 결과: adjustedPeriod.start = max(dateRange.from, tomorrow)
```

**문제점**:

- 사용자가 과거 날짜를 포함한 범위를 선택하면
- 기존 플랜 필터링은 선택한 범위 전체를 사용하지만
- 새 플랜 생성은 오늘 이후로만 조정됨
- 결과적으로 과거 날짜의 플랜은 비활성화되지만 새 플랜이 생성되지 않음

**예시 시나리오**:

- 플랜 그룹 기간: 2025-01-01 ~ 2025-01-28
- 재조정 시점: 2025-01-15 (오늘)
- 사용자 선택 범위: 2025-01-01 ~ 2025-01-28
- 기존 플랜 필터링: 2025-01-01 ~ 2025-01-28 범위의 플랜 찾음 ✅
- 재조정 기간: 2025-01-16 ~ 2025-01-28 (오늘 이후로 조정) ✅
- 새 플랜 생성: 2025-01-16 ~ 2025-01-28 범위에만 생성 ✅
- **문제**: 2025-01-01 ~ 2025-01-15 범위의 플랜은 비활성화되지만 새 플랜이 생성되지 않음 ❌

---

### 3. 오늘 날짜 제외 문제

**현재 로직** (`lib/reschedule/periodCalculator.ts`):

```typescript
const tomorrow = getNextDayString(today);
return {
  start: tomorrow, // 오늘 다음날부터 시작
  end: groupEnd,
};
```

**미진행 플랜 조회** (`app/(student)/actions/plan-groups/reschedule.ts`):

```typescript
.lt("plan_date", today)  // 오늘 이전만 조회
```

**문제점**:

- 오늘 날짜의 플랜은 재조정 대상에서 제외됨
- 하지만 사용자가 오늘 날짜도 재조정하고 싶을 수 있음
- 특히 오늘 아침에 재조정하는 경우, 오늘 플랜은 아직 시작하지 않았을 수 있음

**예시**:

- 오늘 날짜: 2025-01-15
- 오늘 플랜 상태: `pending` (아직 시작하지 않음)
- 현재 동작: 오늘 플랜은 재조정 대상에서 제외됨
- 사용자 의도: 오늘 플랜도 재조정하고 싶음

---

## 🎯 개선 방안

### 방안 1: 재조정 범위와 배치 범위 분리 (권장)

**목표**: 두 가지 범위를 명확히 구분하여 사용자가 의도를 정확히 표현할 수 있도록 함

**구조**:

1. **Step 1: 콘텐츠 선택 + 재조정할 플랜 범위 선택**

   - 콘텐츠 선택
   - 재조정할 플랜 범위 선택 (과거 날짜 포함 가능)
     - 전체 기간
     - 날짜 범위 선택

2. **Step 2: 상세 조정 + 재조정 플랜 배치 범위 선택**
   - 콘텐츠별 조정
   - 재조정 플랜 배치 범위 선택 (오늘 이후만 가능)
     - 자동 (오늘 이후 ~ 플랜 그룹 종료일)
     - 수동 선택 (오늘 이후만 선택 가능)

**장점**:

- 사용자 의도가 명확해짐
- 과거 날짜 포함 선택과 실제 배치 범위를 구분
- UI가 더 직관적

**단점**:

- Step이 하나 더 늘어날 수 있음 (또는 Step 1, 2에 통합)
- 구현 복잡도 증가

---

### 방안 2: 기존 플랜 필터링도 adjustedPeriod 사용

**목표**: 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하도록 일관성 확보

**구조**:

- `adjustedPeriod`를 먼저 계산
- 기존 플랜 필터링도 `adjustedPeriod`를 사용
- 사용자가 과거 날짜를 선택해도 자동으로 오늘 이후로 조정

**장점**:

- 논리적 일관성 확보
- 구현이 상대적으로 간단

**단점**:

- 사용자가 과거 날짜를 선택했는데 실제로는 오늘 이후로만 적용되는 것이 명확하지 않을 수 있음
- UI에서 명확한 안내 필요

---

### 방안 3: 오늘 날짜 포함 옵션 추가 (개선 방안 1)

**목표**: 사용자가 오늘 날짜도 재조정할 수 있도록 옵션 제공

**구조**:

- Step 1에 "오늘 날짜 포함" 체크박스 추가
- 선택 시:
  - 미진행 플랜 조회: `plan_date <= today` 사용
  - 재조정 기간: `today`부터 시작 (또는 `today` 포함)

**장점**:

- 사용자 요구사항 반영
- 유연성 증가

**단점**:

- 오늘 플랜이 이미 진행 중일 수 있어 혼란 가능
- 완료된 오늘 플랜 처리 필요

---

## 📝 구현 TODO

### Phase 1: 재조정 범위와 배치 범위 분리 (우선순위 P0)

**목표**: 두 가지 범위를 명확히 구분

**예상 기간**: 2-3일

**위험도**: 🟡 중간

#### [I1-1] Step 1에 재조정할 플랜 범위 선택 추가

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`
- **작업**:
  - "재조정할 플랜 범위 선택" 섹션 추가
  - 전체 기간 / 날짜 범위 선택 옵션
  - 과거 날짜 포함 가능
  - 선택한 범위를 state로 관리
- **위험도**: 🟢 낮음
- **의존성**: 없음

#### [I1-2] Step 2에 재조정 플랜 배치 범위 선택 추가

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/AdjustmentStep.tsx`
- **작업**:
  - "재조정 플랜 배치 범위 선택" 섹션 추가
  - 자동 (오늘 이후 ~ 플랜 그룹 종료일) / 수동 선택 옵션
  - 수동 선택 시 오늘 이후만 선택 가능하도록 제한
  - 선택한 범위를 state로 관리
- **위험도**: 🟡 중간
- **의존성**: I1-1 완료

#### [I1-3] RescheduleWizard에 배치 범위 state 추가

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/RescheduleWizard.tsx`
- **작업**:
  - `rescheduleDateRange` (재조정할 플랜 범위) state 추가
  - `placementDateRange` (배치 범위) state 추가
  - Step 간 state 전달 로직 수정
- **위험도**: 🟢 낮음
- **의존성**: I1-1, I1-2 완료

#### [I1-4] 서버 액션에 두 가지 범위 파라미터 추가

- **파일**: `app/(student)/actions/plan-groups/reschedule.ts`
- **작업**:
  - `getReschedulePreview` 함수에 `rescheduleDateRange`, `placementDateRange` 파라미터 추가
  - `rescheduleContents` 함수에 동일 파라미터 추가
  - 기존 플랜 필터링: `rescheduleDateRange` 사용
  - 재조정 기간 결정: `placementDateRange` 사용 (또는 `getAdjustedPeriod`로 조정)
- **위험도**: 🔴 높음
- **의존성**: I1-3 완료

#### [I1-5] 기존 플랜 필터링 로직 수정

- **파일**: `app/(student)/actions/plan-groups/reschedule.ts`
- **작업**:
  - `rescheduleDateRange`를 사용하여 기존 플랜 필터링
  - `placementDateRange`를 사용하여 재조정 기간 결정
  - 두 범위가 다를 수 있음을 고려한 로직 구현
- **위험도**: 🔴 높음
- **의존성**: I1-4 완료

#### [I1-6] 미리보기에 두 가지 범위 정보 표시

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx`
- **작업**:
  - 재조정할 플랜 범위 표시
  - 재조정 플랜 배치 범위 표시
  - 두 범위가 다른 경우 명확한 안내
- **위험도**: 🟢 낮음
- **의존성**: I1-5 완료

---

### Phase 2: 오늘 날짜 포함 옵션 추가 (우선순위 P1)

**목표**: 사용자가 오늘 날짜도 재조정할 수 있도록 옵션 제공

**예상 기간**: 1-2일

**위험도**: 🟡 중간

#### [I2-1] Step 1에 오늘 날짜 포함 옵션 추가

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`
- **작업**:
  - "오늘 날짜 포함" 체크박스 추가
  - 기본값: false (오늘 날짜 제외)
  - 체크박스 상태를 state로 관리
- **위험도**: 🟢 낮음
- **의존성**: 없음

#### [I2-2] RescheduleWizard에 includeToday state 추가

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/RescheduleWizard.tsx`
- **작업**:
  - `includeToday` state 추가
  - Step 간 state 전달 로직 수정
- **위험도**: 🟢 낮음
- **의존성**: I2-1 완료

#### [I2-3] periodCalculator에 includeToday 옵션 추가

- **파일**: `lib/reschedule/periodCalculator.ts`
- **작업**:
  - `getAdjustedPeriod` 함수에 `includeToday` 파라미터 추가
  - `includeToday`가 true이면 `today`부터 시작, false이면 `tomorrow`부터 시작
  - 타입 정의 업데이트
- **위험도**: 🟡 중간
- **의존성**: I2-2 완료

#### [I2-4] 미진행 플랜 조회 로직 수정

- **파일**: `app/(student)/actions/plan-groups/reschedule.ts`
- **작업**:
  - `includeToday` 파라미터 추가
  - `includeToday`가 true이면 `plan_date <= today` 사용
  - `includeToday`가 false이면 `plan_date < today` 사용 (기존 로직)
- **위험도**: 🟡 중간
- **의존성**: I2-3 완료

#### [I2-5] 서버 액션에 includeToday 파라미터 추가

- **파일**: `app/(student)/actions/plan-groups/reschedule.ts`
- **작업**:
  - `getReschedulePreview` 함수에 `includeToday` 파라미터 추가
  - `rescheduleContents` 함수에 `includeToday` 파라미터 추가
  - `getAdjustedPeriod` 호출 시 `includeToday` 전달
  - 미진행 플랜 조회 시 `includeToday` 사용
- **위험도**: 🟡 중간
- **의존성**: I2-4 완료

#### [I2-6] UI에 오늘 날짜 포함 시 안내 메시지 추가

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`
- **작업**:
  - "오늘 날짜 포함" 체크박스 옆에 안내 메시지 추가
  - "오늘 날짜의 플랜도 재조정 대상에 포함됩니다. 이미 진행 중인 플랜은 제외됩니다." 등
- **위험도**: 🟢 낮음
- **의존성**: I2-1 완료

---

### Phase 3: 기존 플랜 필터링 일관성 개선 (우선순위 P2)

**목표**: 기존 플랜 필터링과 새 플랜 생성이 논리적으로 일관되도록 개선

**예상 기간**: 1일

**위험도**: 🟡 중간

#### [I3-1] 기존 플랜 필터링 로직 개선

- **파일**: `app/(student)/actions/plan-groups/reschedule.ts`
- **작업**:
  - `adjustedPeriod`를 먼저 계산
  - 기존 플랜 필터링도 `adjustedPeriod`를 사용하도록 수정
  - 사용자가 과거 날짜를 선택해도 자동으로 오늘 이후로 조정되는 것을 명확히 함
- **위험도**: 🟡 중간
- **의존성**: Phase 1 완료

#### [I3-2] UI에 자동 조정 안내 추가

- **파일**: `app/(student)/plan/group/[id]/reschedule/_components/ContentSelectStep.tsx`
- **작업**:
  - 날짜 범위 선택 시 "과거 날짜를 선택하면 자동으로 오늘 이후로 조정됩니다" 안내 추가
  - 실제 조정된 범위를 미리보기로 표시
- **위험도**: 🟢 낮음
- **의존성**: I3-1 완료

---

## 🧪 테스트 시나리오

### Phase 1 테스트

- [ ] 재조정할 플랜 범위와 배치 범위를 각각 선택할 수 있는지 확인
- [ ] 재조정할 플랜 범위에 과거 날짜를 포함할 수 있는지 확인
- [ ] 배치 범위는 오늘 이후만 선택 가능한지 확인
- [ ] 두 범위가 다를 때 올바르게 동작하는지 확인
- [ ] 미리보기에 두 범위가 모두 표시되는지 확인

### Phase 2 테스트

- [ ] "오늘 날짜 포함" 옵션이 동작하는지 확인
- [ ] 오늘 날짜 포함 시 미진행 플랜 조회에 오늘 날짜가 포함되는지 확인
- [ ] 오늘 날짜 포함 시 재조정 기간이 오늘부터 시작하는지 확인
- [ ] 오늘 날짜의 완료된 플랜은 제외되는지 확인
- [ ] 오늘 날짜의 진행 중인 플랜은 제외되는지 확인

### Phase 3 테스트

- [ ] 과거 날짜를 선택했을 때 자동으로 오늘 이후로 조정되는지 확인
- [ ] 자동 조정 안내가 표시되는지 확인
- [ ] 기존 플랜 필터링과 새 플랜 생성이 같은 기간을 사용하는지 확인

---

## 📊 우선순위 요약

| 우선순위 | Phase   | 기능                         | 예상 기간 | 위험도  |
| -------- | ------- | ---------------------------- | --------- | ------- |
| P0       | Phase 1 | 재조정 범위와 배치 범위 분리 | 2-3일     | 🟡 중간 |
| P1       | Phase 2 | 오늘 날짜 포함 옵션 추가     | 1-2일     | 🟡 중간 |
| P2       | Phase 3 | 기존 플랜 필터링 일관성 개선 | 1일       | 🟡 중간 |

---

## 📝 참고 사항

### 현재 구현 상태

- 재조정 기능은 거의 완료 상태 (95%)
- 날짜 범위 선택 기능은 구현되어 있으나 의미가 혼재됨
- 오늘 날짜는 기본적으로 제외됨

### 관련 문서

- `docs/reschedule-todo.md` - 재조정 기능 구현 TODO
- `docs/re.md` - 재조정 기능 시나리오
- `docs/reschedule-scenario-partial-completion.md` - 부분 완료 시나리오

### 의존성 순서

1. **Phase 1** → 다른 Phase의 기반
2. **Phase 2** → Phase 1 완료 후 구현 가능
3. **Phase 3** → Phase 1 완료 후 구현 가능

---

**문서 버전**: 1.0  
**최종 수정일**: 2025-01-XX
