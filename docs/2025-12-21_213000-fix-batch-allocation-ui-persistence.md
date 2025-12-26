# 교과별 일괄 설정 UI 지속성 문제 수정

## 📋 작업 개요

교과별 일괄 설정 UI가 설정 변경 시마다 자동으로 닫히는 문제를 수정했습니다. 이제 사용자가 명시적으로 "일괄 설정 취소" 버튼을 클릭하거나 다른 교과의 일괄 설정을 열 때만 UI가 닫힙니다.

## 🎯 문제점

**기존 동작:**
- 일괄 설정 UI에서 취약/전략 선택 또는 주당 배정 일수 변경 시
- `onChange` 핸들러가 호출되면서 `handleSubjectGroupBatchAllocation` 실행
- 함수 끝에서 `setBatchSettingSubjectGroup(null)` 호출
- 결과: 설정 변경할 때마다 일괄 설정 UI가 닫힘

**사용자 경험 문제:**
- 여러 번 설정을 변경하려고 할 때마다 UI가 닫혀서 불편함
- 설정을 확인하거나 수정하기 어려움

## 🔧 변경 사항

### 수정 내용

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`

**변경 전:**
```typescript
onUpdate({
  subject_allocations: updatedSubjectAllocations,
  content_allocations: filteredContentAllocations,
});

// 일괄 설정 UI 닫기
setBatchSettingSubjectGroup(null);
```

**변경 후:**
```typescript
onUpdate({
  subject_allocations: updatedSubjectAllocations,
  content_allocations: filteredContentAllocations,
});

// 일괄 설정 UI는 유지 (사용자가 명시적으로 취소할 때까지 열어둠)
// setBatchSettingSubjectGroup(null); 제거
```

## ✅ 개선 효과

1. **UI 지속성**
   - 설정 변경 시에도 일괄 설정 UI가 열려있음
   - 여러 번 설정을 변경하거나 확인 가능

2. **사용자 제어**
   - 사용자가 명시적으로 "일괄 설정 취소" 버튼을 클릭할 때만 UI 닫힘
   - 다른 교과의 일괄 설정을 열 때도 이전 교과의 UI는 자동으로 닫힘

3. **실시간 반영**
   - 설정 변경 시 즉시 반영되면서도 UI는 유지
   - 사용자가 설정 결과를 바로 확인 가능

## 📊 동작 흐름

### Before
```
1. 일괄 설정 UI 열기
2. 취약/전략 선택
3. 설정 적용 → UI 자동 닫힘 ❌
4. 다시 설정하려면 버튼 클릭 필요
```

### After
```
1. 일괄 설정 UI 열기
2. 취약/전략 선택
3. 설정 적용 → UI 유지 ✅
4. 추가 설정 변경 가능
5. "일괄 설정 취소" 버튼 클릭 → UI 닫힘
```

## 📝 수정된 파일

1. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`
   - `handleSubjectGroupBatchAllocation` 함수에서 `setBatchSettingSubjectGroup(null)` 제거





