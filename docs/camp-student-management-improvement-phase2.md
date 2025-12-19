# 캠프 기능 학생 관리 영역 개선 - Phase 2 완료

## 작업 개요

캠프 기능의 학생 관리 영역 개선 계획 중 Phase 2를 완료했습니다. 학생 선택 UI를 개선하고 일괄 선택 기능을 추가했습니다.

## 완료된 작업

### 1. 학생 선택 UI 개선

**파일**: `app/(admin)/admin/camp-templates/[id]/StudentInvitationForm.tsx`

#### 추가된 기능

1. **학년별 일괄 선택 기능**
   - `handleSelectByGrade()` 함수 추가
   - 선택된 학년 필터에 해당하는 모든 학생을 일괄 선택/해제
   - 선택 상태에 따라 "전체 선택" / "해제" 버튼 텍스트 자동 변경

2. **반별 일괄 선택 기능**
   - `handleSelectByClass()` 함수 추가
   - 선택된 반 필터에 해당하는 모든 학생을 일괄 선택/해제
   - 선택 상태에 따라 "전체 선택" / "해제" 버튼 텍스트 자동 변경

3. **UI 개선**
   - 학년/반 필터 선택 시 해당 필터의 전체 선택 버튼 표시
   - 버튼 위치: 필터 레이블 옆에 배치
   - 선택 상태에 따른 동적 버튼 텍스트

### 2. 사용자 경험 개선

#### 이전 동작
- 필터링된 모든 학생만 일괄 선택 가능
- 학년/반별로 선택하려면 수동으로 하나씩 선택해야 함

#### 개선된 동작
- 학년 필터 선택 시 → 해당 학년 전체 선택 버튼 표시
- 반 필터 선택 시 → 해당 반 전체 선택 버튼 표시
- 선택 상태에 따라 "전체 선택" / "해제" 자동 전환
- 대량 학생 선택 시 시간 절약

## 구현 세부사항

### 일괄 선택 로직

```typescript
// 학년별 일괄 선택
const handleSelectByGrade = (grade: string) => {
  const gradeStudents = filteredStudents.filter((s) => s.grade === grade);
  const gradeStudentIds = new Set(gradeStudents.map((s) => s.id));
  
  // 해당 학년의 모든 학생이 이미 선택되어 있는지 확인
  const allSelected = gradeStudentIds.size > 0 && 
    Array.from(gradeStudentIds).every((id) => selectedStudentIds.has(id));
  
  setSelectedStudentIds((prev) => {
    const next = new Set(prev);
    if (allSelected) {
      // 모두 선택되어 있으면 해제
      gradeStudentIds.forEach((id) => next.delete(id));
    } else {
      // 일부만 선택되어 있거나 선택되지 않았으면 모두 선택
      gradeStudentIds.forEach((id) => next.add(id));
    }
    return next;
  });
};
```

### UI 통합

- 학년 필터 선택 시: 필터 레이블 옆에 "전체 선택" / "해제" 버튼 표시
- 반 필터 선택 시: 필터 레이블 옆에 "전체 선택" / "해제" 버튼 표시
- 버튼은 필터가 선택되었을 때만 표시됨

## 사용 예시

1. **학년별 일괄 선택**
   - 학년 필터에서 "1학년" 선택
   - 필터 옆에 "전체 선택" 버튼 표시
   - 버튼 클릭 시 1학년 모든 학생 선택
   - 다시 클릭 시 1학년 모든 학생 해제

2. **반별 일괄 선택**
   - 반 필터에서 "1반" 선택
   - 필터 옆에 "전체 선택" 버튼 표시
   - 버튼 클릭 시 1반 모든 학생 선택
   - 다시 클릭 시 1반 모든 학생 해제

## 다음 단계

Phase 3에서는 다음 작업을 진행합니다:
- 초대 목록 서버 사이드 필터링 함수 수정 (`lib/data/campTemplates.ts`)
- `CampInvitationList`에 서버 사이드 필터링 통합
- URL searchParams를 통한 필터 상태 동기화

## 참고

- 원본 계획: `.cursor/plans/-2cd8e253.plan.md`
- 관련 파일:
  - `app/(admin)/admin/camp-templates/[id]/StudentInvitationForm.tsx`

