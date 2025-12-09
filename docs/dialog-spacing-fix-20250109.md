# 다이얼로그 UI 여백 수정 작업

**작업 일자**: 2025-01-09  
**작업 범위**: `/plan` 페이지 및 하위 페이지의 다이얼로그 UI 여백 문제 수정

## 문제점

다이얼로그 내부 항목이 헤더나 경계에 붙어서 표시되는 UI 문제가 있었습니다.

## 원인 분석

1. `DialogContent` 컴포넌트에 padding이 없음
2. `DialogFooter` 컴포넌트에 padding이 없음
3. `DayTimelineModal`이 DialogContent를 사용하지 않아 padding이 없음

## 수정 내용

### 1. Dialog 컴포넌트 수정

**파일**: `components/ui/Dialog.tsx`

#### DialogContent 수정
- `px-6 py-4` padding 추가
- 이 수정으로 다음 다이얼로그들이 자동으로 수정됨:
  - `PlanGroupDeleteDialog`
  - `PlanGroupBulkDeleteDialog`
  - `PlanGroupActiveToggleDialog`
  - `PlanGroupActivationDialog`

#### DialogFooter 수정
- `px-6 py-4` padding 추가
- `border-t border-gray-200` 추가 (푸터 구분선)

### 2. DayTimelineModal 수정

**파일**: `app/(student)/plan/calendar/_components/DayTimelineModal.tsx`

- Dialog를 사용하지만 DialogContent를 사용하지 않으므로, 직접 사용하는 최상위 div에 `px-6 py-4` padding 추가
- 기존: `className="w-full max-h-[90vh] overflow-hidden"`
- 수정: `className="w-full max-h-[90vh] overflow-hidden px-6 py-4"`

## 수정된 파일 목록

1. `components/ui/Dialog.tsx`
   - DialogContent에 padding 추가
   - DialogFooter에 padding 및 border 추가

2. `app/(student)/plan/calendar/_components/DayTimelineModal.tsx`
   - 최상위 div에 padding 추가

## 검증 사항

- 자체 구현된 다이얼로그들(`PlanPreviewDialog`, `RangeSettingModal`, `ExclusionImportModal`, `AcademyScheduleImportModal`)은 이미 padding이 있어 수정 불필요

## 결과

- 모든 Dialog 컴포넌트를 사용하는 다이얼로그에 일관된 여백 적용
- 헤더와 콘텐츠, 콘텐츠와 푸터 사이에 적절한 간격 확보
- Spacing-First 정책 준수

