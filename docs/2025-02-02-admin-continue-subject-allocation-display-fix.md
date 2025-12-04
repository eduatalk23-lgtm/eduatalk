# 관리자 모드 남은 단계 진행 시 전략과목/취약과목 표시 수정

## 📋 작업 개요

**작업 일시**: 2025-02-02  
**작업 내용**: 관리자 모드에서 남은 단계 진행하기 중 Step 6 최종확인에서 전략과목/취약과목 섹션이 표시되지 않는 문제 수정

## 🔍 문제 상황

### 발생 위치
- 컴포넌트: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- 표시 위치: Step 6 (최종 확인 단계) - 관리자 모드 남은 단계 진행하기

### 문제점
- 관리자 모드(`isAdminContinueMode=true`)에서 Step 6 진입 시 전략과목/취약과목 섹션이 표시되지 않음
- 기존 조건: `isCampMode && (isAdminContinueMode || ...)` 형태로 `isCampMode`가 먼저 체크됨
- 관리자 모드에서도 `isCampMode`가 true여야만 표시되는 구조였음

### 원인 분석

**기존 조건**:
```typescript
{isCampMode &&
  (isAdminContinueMode ||
    (data.scheduler_type === "1730_timetable" &&
      data.subject_allocations &&
      data.subject_allocations.length > 0)) && (
```

이 조건은:
1. `isCampMode`가 true여야 함 (먼저 체크)
2. 그리고 다음 중 하나:
   - `isAdminContinueMode`가 true이거나
   - `data.scheduler_type === "1730_timetable"`이고 `data.subject_allocations`가 있고 길이가 0보다 크거나

**문제**: 관리자 모드에서도 `isCampMode`가 true여야만 표시됨. 관리자 모드에서는 `isCampMode`와 관계없이 항상 표시되어야 함.

## 🔧 수정 내용

### Step6Simplified 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

#### 조건 로직 수정 (87-97번째 줄)

```typescript
// 수정 전
{isCampMode &&
  (isAdminContinueMode ||
    (data.scheduler_type === "1730_timetable" &&
      data.subject_allocations &&
      data.subject_allocations.length > 0)) && (
  <CollapsibleSection title="전략과목/취약과목" defaultOpen={false}>
    <SubjectAllocationSummary data={data} />
  </CollapsibleSection>
)}

// 수정 후
{(isAdminContinueMode ||
  (isCampMode &&
    data.scheduler_type === "1730_timetable" &&
    data.subject_allocations &&
    data.subject_allocations.length > 0)) && (
  <CollapsibleSection title="전략과목/취약과목" defaultOpen={false}>
    <SubjectAllocationSummary data={data} />
  </CollapsibleSection>
)}
```

### 변경 사항

1. **조건 우선순위 변경**: `isAdminContinueMode`를 먼저 체크하도록 변경
2. **관리자 모드 우선**: 관리자 모드일 때는 `isCampMode`와 관계없이 항상 표시
3. **일반 모드 조건 유지**: 일반 모드에서는 기존 조건 유지 (캠프 모드 + 1730_timetable + subject_allocations 존재)

## ✅ 수정 결과

### 수정 전
- 관리자 모드에서 Step 6 진입 시 전략과목/취약과목 섹션이 표시되지 않음
- `isCampMode`가 먼저 체크되어 관리자 모드에서도 캠프 모드 조건을 만족해야 함

### 수정 후
- 관리자 모드에서 Step 6 진입 시 전략과목/취약과목 섹션이 항상 표시됨
- `isAdminContinueMode`가 true이면 `isCampMode`와 관계없이 표시
- 일반 모드에서는 기존 조건 유지 (캠프 모드 + 1730_timetable + subject_allocations 존재)

## 📝 참고 사항

### 표시 조건 정리

1. **관리자 모드** (`isAdminContinueMode=true`): 항상 표시
   - `isCampMode`와 관계없이 표시
   - `subject_allocations`가 없어도 섹션은 표시 (빈 상태 메시지)

2. **일반 모드** (`isAdminContinueMode=false`): 조건부 표시
   - `isCampMode`가 true
   - `data.scheduler_type === "1730_timetable"`
   - `data.subject_allocations`가 있고 길이가 0보다 큼

### SubjectAllocationSummary 동작

- `subject_allocations`가 없거나 비어있을 때: 빈 상태 메시지 표시
- `subject_allocations`가 있을 때: 전략과목/취약과목 정보 표시

## 🧪 테스트 확인 사항

1. ✅ 관리자 모드에서 Step 6 진입 시 전략과목/취약과목 섹션 표시 확인
2. ✅ 관리자 모드에서 `subject_allocations`가 없을 때 빈 상태 메시지 표시 확인
3. ✅ 관리자 모드에서 `subject_allocations`가 있을 때 정보 표시 확인
4. ✅ 일반 모드에서 기존 조건대로 동작하는지 확인

## 📚 관련 파일

- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

