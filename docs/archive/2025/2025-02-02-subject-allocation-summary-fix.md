# 최종확인 단계 전략과목/취약과목 표시 수정

## 📋 작업 개요

**작업 일시**: 2025-02-02  
**작업 내용**: 최종확인 단계(Step 6)에서 전략과목/취약과목 정보가 표시되지 않는 문제 수정

## 🔍 문제 상황

### 발생 위치
- 컴포넌트: `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`
- 표시 위치: Step 6 (최종 확인 단계) - `Step6Simplified` 컴포넌트

### 문제점
- `SubjectAllocationSummary` 컴포넌트에서 `subject_allocations`의 필드명과 값이 잘못 매핑됨
- `WizardData` 타입 정의와 실제 사용하는 필드명이 일치하지 않음
- 필터링 조건에서 문자열 값이 잘못됨

### 원인 분석

**WizardData 타입 정의** (`PlanGroupWizard.tsx`):
```typescript
subject_allocations?: Array<{
  subject_id: string;
  subject_name: string;           // ✅ 실제 필드명
  subject_type: "strategy" | "weakness";  // ✅ 실제 필드명 및 값
  weekly_days?: number;           // ✅ 실제 필드명
}>;
```

**기존 코드 (잘못된 필드명)**:
```typescript
return data.subject_allocations.map((alloc) => ({
  subject: alloc.subject,                    // ❌ alloc.subject_name이어야 함
  type: alloc.allocation_type,              // ❌ alloc.subject_type이어야 함
  days: alloc.weekly_allocation_days || 0,   // ❌ alloc.weekly_days여야 함
}));

// 필터링 조건도 잘못됨
allocations.filter((a) => a.type === "전략과목");  // ❌ "strategy"여야 함
allocations.filter((a) => a.type === "취약과목");  // ❌ "weakness"여야 함
```

## 🔧 수정 내용

### SubjectAllocationSummary 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`

#### 1. 필드명 수정 (25-29번째 줄)

```typescript
// 수정 전
return data.subject_allocations.map((alloc) => ({
  subject: alloc.subject,
  type: alloc.allocation_type,
  days: alloc.weekly_allocation_days || 0,
}));

// 수정 후
return data.subject_allocations.map((alloc) => ({
  subject: alloc.subject_name,      // ✅ 수정
  type: alloc.subject_type,         // ✅ 수정
  days: alloc.weekly_days || 0,     // ✅ 수정
}));
```

#### 2. 필터링 조건 수정 (33-39번째 줄)

```typescript
// 수정 전
const strategicSubjects = useMemo(() => {
  return allocations.filter((a) => a.type === "전략과목");
}, [allocations]);

const weakSubjects = useMemo(() => {
  return allocations.filter((a) => a.type === "취약과목");
}, [allocations]);

// 수정 후
const strategicSubjects = useMemo(() => {
  return allocations.filter((a) => a.type === "strategy");  // ✅ 수정
}, [allocations]);

const weakSubjects = useMemo(() => {
  return allocations.filter((a) => a.type === "weakness");  // ✅ 수정
}, [allocations]);
```

## ✅ 수정 결과

### 수정 전
- Step 6에서 전략과목/취약과목 정보가 표시되지 않음
- 필드명이 잘못되어 데이터를 읽을 수 없음
- 필터링 조건이 잘못되어 전략과목/취약과목이 분류되지 않음

### 수정 후
- Step 6에서 전략과목/취약과목 정보가 정상적으로 표시됨
- 전략과목: 노란색 배지, 주당 배정 일수 표시
- 취약과목: 주황색 배지, "집중 학습" 표시
- `subject_allocations`가 없거나 비어있을 때는 빈 상태 메시지 표시

## 📝 참고 사항

### WizardData 타입 정의
- `subject_allocations`는 `SubjectAllocation[]` 타입
- 각 항목은 `subject_id`, `subject_name`, `subject_type`, `weekly_days` 필드를 가짐
- `subject_type`은 `"strategy" | "weakness"` 값만 가질 수 있음

### 표시 조건
`Step6Simplified` 컴포넌트에서 전략과목/취약과목 섹션은 다음 조건에서만 표시됨:
```typescript
{isCampMode &&
  data.subject_allocations &&
  data.subject_allocations.length > 0 && (
    <CollapsibleSection title="전략과목/취약과목" defaultOpen={false}>
      <SubjectAllocationSummary data={data} />
    </CollapsibleSection>
  )}
```

### 표시 내용
1. **요약 카드**: 전략과목/취약과목 개수 표시
2. **상세 목록**: 각 과목별 정보 표시
   - 전략과목: 주당 배정 일수 (예: "주 3일")
   - 취약과목: "집중 학습"
3. **설명**: 전략과목/취약과목의 배정 방식 안내

## 🧪 테스트 확인 사항

1. ✅ 캠프 모드에서 `subject_allocations`가 있을 때 섹션 표시 확인
2. ✅ 전략과목/취약과목이 올바르게 분류되어 표시되는지 확인
3. ✅ 주당 배정 일수가 올바르게 표시되는지 확인
4. ✅ `subject_allocations`가 없을 때 빈 상태 메시지 표시 확인

## 📚 관련 파일

- `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`
- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `lib/types/plan.ts`

