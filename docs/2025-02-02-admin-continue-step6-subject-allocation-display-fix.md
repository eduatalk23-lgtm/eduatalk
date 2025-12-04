# 관리자 모드 Step 6 전략과목/취약과목 표시 수정

## 📋 작업 개요

**작업 일시**: 2025-02-02  
**작업 내용**: 관리자 모드에서 남은 단계 진행하기 중 Step 6 최종확인에서 전략과목/취약과목 섹션이 표시되지 않는 문제 수정

## 🔍 문제 상황

### 발생 위치
- 컴포넌트: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- 페이지: `/admin/camp-templates/[id]/participants/[groupId]/continue`
- 단계: Step 6 (최종 확인)

### 문제점
- 관리자 모드(`isAdminContinueMode=true`)에서 Step 6 진입 시 전략과목/취약과목 섹션이 표시되지 않음
- 기존 조건이 `scheduler_type === "1730_timetable"`을 필수로 요구하여 관리자 모드에서도 이 조건을 만족해야 함
- 관리자 모드에서는 `scheduler_type`이 설정되지 않았거나 다른 값일 수 있음

### 원인 분석

**기존 조건** (`Step6Simplified.tsx` 87-95번째 줄):
```typescript
{isCampMode &&
  data.scheduler_type === "1730_timetable" &&
  (isAdminContinueMode ||
    (data.subject_allocations && data.subject_allocations.length > 0)) && (
```

이 조건은:
1. `isCampMode`가 true여야 함 ✅
2. `data.scheduler_type === "1730_timetable"`이어야 함 ❌ (관리자 모드에서 문제)
3. `isAdminContinueMode`가 true이거나 `subject_allocations`가 있어야 함

문제는 관리자 모드에서도 `scheduler_type === "1730_timetable"` 조건을 만족해야 한다는 점입니다. 관리자 모드에서는 이 조건을 무시하고 항상 표시해야 합니다.

## 🔧 수정 내용

### Step6Simplified 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

#### 조건 로직 수정 (87-95번째 줄)

```typescript
// 수정 전
{isCampMode &&
  data.scheduler_type === "1730_timetable" &&
  (isAdminContinueMode ||
    (data.subject_allocations && data.subject_allocations.length > 0)) && (

// 수정 후
{isCampMode &&
  (isAdminContinueMode ||
    (data.scheduler_type === "1730_timetable" &&
      data.subject_allocations &&
      data.subject_allocations.length > 0)) && (
```

### 수정 로직 설명

**관리자 모드** (`isAdminContinueMode === true`):
- `scheduler_type` 조건 무시
- `subject_allocations` 조건 무시
- 항상 표시

**일반 모드** (`isAdminContinueMode === false`):
- `scheduler_type === "1730_timetable"` 필수
- `subject_allocations`가 있고 길이가 0보다 커야 함
- 두 조건을 모두 만족해야 표시

## ✅ 수정 결과

### 수정 전
- 관리자 모드에서 Step 6 진입 시 전략과목/취약과목 섹션이 표시되지 않음
- `scheduler_type`이 "1730_timetable"이 아니면 표시되지 않음

### 수정 후
- 관리자 모드에서 Step 6 진입 시 전략과목/취약과목 섹션이 항상 표시됨
- 일반 모드에서는 기존 조건 유지 (1730_timetable이고 subject_allocations가 있을 때만 표시)

## 📝 참고 사항

### 표시 조건 요약

| 모드 | isCampMode | scheduler_type | subject_allocations | 표시 여부 |
|------|------------|----------------|---------------------|-----------|
| 관리자 모드 | true | 무관 | 무관 | ✅ 항상 표시 |
| 일반 모드 | true | "1730_timetable" | 있음 (length > 0) | ✅ 표시 |
| 일반 모드 | true | "1730_timetable" | 없음 | ❌ 표시 안 함 |
| 일반 모드 | true | 기타 | 있음 | ❌ 표시 안 함 |

### 관련 컴포넌트
- `Step6Simplified`: 최종 확인 단계 컴포넌트
- `SubjectAllocationSummary`: 전략과목/취약과목 요약 컴포넌트
- `PlanGroupWizard`: 플랜 그룹 위저드 메인 컴포넌트

## 🧪 테스트 확인 사항

1. ✅ 관리자 모드에서 Step 6 진입 시 전략과목/취약과목 섹션 표시 확인
2. ✅ 일반 모드에서 1730_timetable이고 subject_allocations가 있을 때 표시 확인
3. ✅ 일반 모드에서 1730_timetable이 아니면 표시 안 함 확인
4. ✅ 일반 모드에서 subject_allocations가 없으면 표시 안 함 확인

## 📚 관련 파일

- `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
- `app/(student)/plan/new-group/_components/_summary/SubjectAllocationSummary.tsx`
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

