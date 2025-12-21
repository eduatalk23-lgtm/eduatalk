# 교과별 일괄 설정 시 콘텐츠별 개별 설정 UI 숨김 처리

## 📋 작업 개요

교과별 일괄 설정이 활성화되어 있을 때, 각 콘텐츠별 개별 설정 UI가 표시되는 문제를 수정했습니다. 일괄 설정 모드에서는 교과 전체 설정만 표시하고, 개별 콘텐츠 설정은 숨기도록 변경했습니다.

## 🎯 목표

1. 교과별 일괄 설정 활성화 시 개별 콘텐츠 설정 UI 숨김
2. 일괄 설정 모드에서는 읽기 전용 콘텐츠 목록만 표시
3. 일괄 설정 취소 시 다시 개별 설정 UI 표시

## 🔧 변경 사항

### 파일
`app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`

### 변경 내용

#### 1. 조건부 렌더링 추가

교과별 일괄 설정이 활성화되어 있는지 확인하여 콘텐츠 목록을 조건부로 렌더링:

```typescript
// 변경 전: 항상 개별 설정 UI 표시
<div className="flex flex-col gap-3">
  {contents.map((content) => {
    // ... 개별 설정 UI
  })}
</div>

// 변경 후: 일괄 설정 모드에서는 숨김
{batchSettingSubjectGroup !== subjectGroup && (
  <div className="flex flex-col gap-3">
    {contents.map((content) => {
      // ... 개별 설정 UI
    })}
  </div>
)}

// 일괄 설정 모드에서는 읽기 전용 목록만 표시
{batchSettingSubjectGroup === subjectGroup && (
  <div className="flex flex-col gap-2">
    {contents.map((content) => {
      // ... 읽기 전용 콘텐츠 정보
    })}
  </div>
)}
```

#### 2. 읽기 전용 콘텐츠 목록 추가

일괄 설정 모드에서 표시할 읽기 전용 콘텐츠 목록:

- 콘텐츠 제목과 과목 정보만 표시
- "일괄 설정 적용 예정" 메시지 표시
- 개별 설정 UI(`AllocationControls`) 제거

## ✅ 동작 방식

### 교과별 일괄 설정 비활성화 상태
- 각 콘텐츠별로 개별 설정 UI 표시
- 사용자가 각 콘텐츠의 전략/취약과목 및 주일수 설정 가능

### 교과별 일괄 설정 활성화 상태
- 교과 전체 일괄 설정 UI만 표시
- 콘텐츠 목록은 읽기 전용으로만 표시
- "일괄 설정 적용 예정" 메시지로 상태 표시
- 개별 설정 UI 숨김

### 일괄 설정 취소 시
- 다시 개별 설정 UI 표시
- 기존 설정값 유지

## 🎨 UI 개선 효과

1. **명확한 모드 구분**: 일괄 설정 모드와 개별 설정 모드가 명확하게 구분됨
2. **사용자 혼란 방지**: 일괄 설정 중에 개별 설정을 시도할 수 없어 혼란 방지
3. **일관된 UX**: 일괄 설정의 의미에 맞게 UI가 동작

## 📝 참고 사항

### 상태 관리
- `batchSettingSubjectGroup`: 현재 일괄 설정 중인 교과명 (null이면 일괄 설정 비활성화)
- 일괄 설정 버튼 클릭 시 토글 방식으로 상태 변경

### 데이터 흐름
1. 일괄 설정 활성화 → `batchSettingSubjectGroup`에 교과명 설정
2. 일괄 설정 값 변경 → `handleSubjectGroupBatchAllocation` 호출
3. 모든 콘텐츠에 동일한 설정 적용 (`content_allocations` 및 `subject_allocations` 업데이트)
4. 일괄 설정 취소 → `batchSettingSubjectGroup`을 null로 설정

