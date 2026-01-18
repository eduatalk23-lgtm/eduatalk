# 전략과목/취약과목 설정 UI 구조 개선

## 📋 작업 개요

전략과목/취약과목 설정 UI의 구조적 문제를 해결했습니다. 교과별 설정인데 과목이 기준이 되던 문제와 중복된 토글 문제를 해결하고, 콘텐츠별 설정에서 각 콘텐츠 아래에서 취약/전략을 선택하도록 개선했습니다.

## 🎯 문제점

1. **교과별 설정인데 과목이 기준이 되는 문제**
   - `subject_category`(과목명)로 그룹화하고 있었음
   - 교과별 설정이어야 하는데 과목별로 그룹화됨

2. **중복된 토글 문제**
   - Step6FinalReview 상위 레벨에서 "교과별 설정" / "콘텐츠별 설정" 토글
   - StrategyWeaknessAllocationEditor 내부에서도 각 과목별로 "교과 단위 설정" / "콘텐츠별 설정" 토글
   - 콘텐츠별 설정 안에서도 교과별/콘텐츠별 설정이 반복됨

3. **UI 구조 문제**
   - 콘텐츠별 설정 모드에서도 각 콘텐츠에서 취약/전략을 선택하는 UI가 명확하지 않음

## 🔧 변경 사항

### 1. ContentInfo 타입에 subject_group_name 추가

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/types.ts`

- `subject_group_name?: string | null;` 필드 추가
- 교과명을 저장할 수 있도록 타입 확장

### 2. useContentInfos에서 subject_group_name 조회

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/hooks/useContentInfos.ts`

- `ContentMetadata` 타입에 `subject_group_name` 추가
- `fetchContentMetadataAction`을 사용할 때 `subject_group_name` 포함
- 학생 콘텐츠와 추천 콘텐츠 모두에서 `subject_group_name` 조회

### 3. StrategyWeaknessAllocationEditor를 교과별로 그룹화

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`

**주요 변경:**
- `contentsBySubject` → `contentsBySubjectGroup`로 변경
- `subject_category` 대신 `subject_group_name` 기준으로 그룹화
- `subject_group_name`이 없으면 `subject_category`로 fallback (하위 호환성)

**제거된 기능:**
- 교과 단위 설정 모드 제거 (항상 콘텐츠별 설정 모드로 동작)
- 각 교과별 "교과 단위 설정" / "콘텐츠별 설정" 토글 제거
- `getSubjectGroupAllocationMode`, `handleSubjectGroupAllocationChange`, `handleModeChange` 함수 제거

**개선된 UI:**
- 교과별로 그룹화하여 표시
- 각 콘텐츠 아래에서 취약/전략 선택 UI 표시
- 교과 단위 설정이 있으면 "교과 단위 설정 적용 중" 표시
- 기본값이면 "기본값 (취약과목)" 표시

### 4. Step6FinalReview의 상위 토글 제거

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview.tsx`

**변경 내용:**
- 상위 레벨의 "교과별 설정" / "콘텐츠별 설정" 토글 제거
- `SubjectAllocationUI` import 제거
- 항상 `ContentAllocationUI`만 사용 (내부적으로 StrategyWeaknessAllocationEditor 사용)
- 안내 문구 단순화: "각 콘텐츠마다 전략/취약과목을 설정합니다. 교과별로 그룹화되어 표시됩니다."

## 📊 UI 구조 변경

### Before
```
전략과목/취약과목 정보
├─ [교과별 설정] [콘텐츠별 설정] 토글
├─ 안내 문구
└─ SubjectAllocationUI 또는 ContentAllocationUI
   └─ [과목명] N개 콘텐츠
       ├─ [교과 단위 설정] [콘텐츠별 설정] 토글
       ├─ 교과 단위 설정 UI (선택 시)
       └─ 콘텐츠 목록
           └─ 콘텐츠별 설정 UI (선택 시)
```

### After
```
전략과목/취약과목 정보
├─ 안내 문구
└─ ContentAllocationUI (StrategyWeaknessAllocationEditor)
   └─ [교과명] N개 콘텐츠
       └─ 콘텐츠 목록
           └─ 각 콘텐츠
               ├─ 콘텐츠 정보
               └─ 취약/전략 선택 UI
```

## ✅ 개선 효과

1. **명확한 구조**
   - 교과별로 그룹화되어 논리적으로 명확함
   - 각 콘텐츠에서 직접 취약/전략 선택 가능

2. **중복 제거**
   - 상위/하위 토글 중복 제거
   - 단순하고 일관된 UI

3. **사용자 경험 개선**
   - 각 콘텐츠 아래에서 바로 취약/전략 선택 가능
   - 교과 단위 설정이 있으면 명확히 표시
   - 기본값도 명확히 표시

## 📝 수정된 파일

1. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/types.ts`
   - `ContentInfo` 타입에 `subject_group_name` 추가

2. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/hooks/useContentInfos.ts`
   - `ContentMetadata` 타입에 `subject_group_name` 추가
   - `subject_group_name` 조회 로직 추가

3. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor.tsx`
   - 교과별 그룹화로 변경
   - 교과 단위 설정 모드 제거
   - 각 콘텐츠에서 취약/전략 선택 UI 개선

4. `app/(student)/plan/new-group/_components/_features/content-selection/Step6FinalReview.tsx`
   - 상위 토글 제거
   - `SubjectAllocationUI` import 제거
   - 안내 문구 단순화

## 🚀 향후 개선 사항

- 교과 단위 설정 기능이 필요하면 별도 UI로 추가 가능
- 현재는 콘텐츠별 설정만 지원하지만, 폴백 메커니즘으로 교과 단위 설정도 참고 가능

