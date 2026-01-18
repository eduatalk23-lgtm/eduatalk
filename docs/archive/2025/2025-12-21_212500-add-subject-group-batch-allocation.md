# 교과별 일괄 설정 기능 추가

## 📋 작업 개요

교과별로 일괄 설정할 수 있는 기능을 추가했습니다. 콘텐츠가 2개 이상인 교과에만 "교과별 일괄 설정" 버튼이 표시되며, 클릭 시 해당 교과의 모든 콘텐츠에 동일한 설정을 적용할 수 있습니다.

## 🎯 목표

1. 교과별 일괄 설정 버튼 추가 (콘텐츠 2개 이상일 때만 표시)
2. 인라인 설정 UI 제공
3. 해당 교과의 모든 콘텐츠에 동일한 설정 적용
4. 교과 단위 설정(subject_allocations)과 콘텐츠별 설정(content_allocations) 모두 저장

## 🔧 변경 사항

### 1. 교과별 일괄 설정 상태 관리

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`

- `batchSettingSubjectGroup` state 추가
- 현재 일괄 설정 중인 교과를 추적

### 2. 교과별 일괄 설정 버튼 추가

**조건:**
- 콘텐츠가 2개 이상인 교과에만 표시
- `editable`이 `true`일 때만 표시

**위치:**
- 교과 헤더 오른쪽에 버튼 배치
- 클릭 시 인라인 설정 UI 토글

### 3. 교과별 일괄 설정 핸들러 구현

**함수**: `handleSubjectGroupBatchAllocation`

**기능:**
1. 해당 교과의 모든 콘텐츠에서 `subject_id` 추출
2. 교과 단위 설정(`subject_allocations`)에 저장
3. 해당 교과의 모든 콘텐츠에 동일한 설정을 `content_allocations`에 추가
4. 기존 콘텐츠별 설정은 제거하고 일괄 설정으로 교체

**데이터 구조:**
```typescript
// subject_allocations에 저장
{
  subject_id: string | undefined,
  subject_name: string, // 교과명
  subject_type: "strategy" | "weakness",
  weekly_days?: number
}

// content_allocations에 각 콘텐츠별로 저장
{
  content_type: "book" | "lecture",
  content_id: string,
  subject_type: "strategy" | "weakness",
  weekly_days?: number
}
```

### 4. 인라인 설정 UI

**구성:**
- 파란색 배경의 박스로 강조
- 교과명과 적용될 콘텐츠 개수 표시
- `AllocationControls` 컴포넌트 재사용
- 기존 교과 단위 설정이 있으면 해당 값으로 초기화

**UI 구조:**
```
[교과명] N개 콘텐츠 [교과별 일괄 설정 버튼]
└─ [일괄 설정 UI] (클릭 시 표시)
   ├─ 교과명 전체 일괄 설정
   ├─ (N개 콘텐츠에 동일하게 적용됩니다)
   └─ [취약과목] [전략과목] [주당 배정 일수]
```

## 📊 동작 흐름

### Before
```
[교과명] N개 콘텐츠
└─ 각 콘텐츠마다 개별 설정
```

### After
```
[교과명] N개 콘텐츠 [교과별 일괄 설정] (N >= 2일 때만)
├─ [일괄 설정 UI] (클릭 시)
│  └─ 모든 콘텐츠에 동일한 설정 적용
└─ 각 콘텐츠마다 개별 설정 (일괄 설정 후에도 개별 수정 가능)
```

## ✅ 사용 시나리오

1. **교과별 일괄 설정**
   - 교과에 콘텐츠가 2개 이상일 때 "교과별 일괄 설정" 버튼 표시
   - 버튼 클릭 → 인라인 설정 UI 표시
   - 취약/전략 선택 및 주당 배정 일수 설정
   - 설정 적용 → 해당 교과의 모든 콘텐츠에 동일한 설정 적용

2. **개별 설정 (일괄 설정 후)**
   - 일괄 설정 후에도 각 콘텐츠를 개별적으로 수정 가능
   - 개별 수정 시 해당 콘텐츠만 변경됨

3. **폴백 메커니즘**
   - 콘텐츠별 설정이 없으면 교과 단위 설정 참조
   - 교과 단위 설정도 없으면 기본값(취약과목) 사용

## 📝 수정된 파일

1. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`
   - `batchSettingSubjectGroup` state 추가
   - `handleSubjectGroupBatchAllocation` 함수 추가
   - 교과 헤더에 일괄 설정 버튼 추가
   - 인라인 설정 UI 추가

## 🚀 향후 개선 사항

- 일괄 설정 취소 기능 (기존 설정으로 되돌리기)
- 일괄 설정 적용 전 확인 다이얼로그
- 일괄 설정 적용 후 피드백 메시지

