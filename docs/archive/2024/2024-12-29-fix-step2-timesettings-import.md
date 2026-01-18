# Step2TimeSettings import 경로 수정

## 작업 일시
2024-12-29

## 문제 상황
빌드 에러 발생: `Module not found: Can't resolve '@/app/(student)/plan/new-group/_components/Step2TimeSettingsWithPreview'`

### 에러 상세
- 파일: `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`
- 에러 위치: 17번 라인의 `Step2TimeSettingsWithPreview` import
- 원인: 존재하지 않는 컴포넌트 `Step2TimeSettingsWithPreview`를 참조하고 있음

## 해결 방법
존재하는 `Step2TimeSettings` 컴포넌트를 사용하도록 import 경로 및 컴포넌트 이름 변경

### 변경 사항
1. Import 경로 변경:
   - `Step2TimeSettingsWithPreview` → `Step2TimeSettings`
   - 파일 경로: `Step2TimeSettingsWithPreview` → `Step2TimeSettings.tsx`

2. Props 정리:
   - `blockSets` prop 제거 (사용되지 않음)
   - `campTemplateId` prop 제거 (사용되지 않음)
   - 실제 `Step2TimeSettings`가 지원하는 props만 사용

## 영향 받는 파일
- `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`
  - 16-17번 라인: lazy import 수정
  - 179번 라인: 컴포넌트 사용 부분 수정
  - 불필요한 props 제거

## 참고
`Step2TimeSettings`는 `Step2TimeSettingsWithPreview` 대신 사용되는 실제 컴포넌트이며, 동일한 기능을 제공합니다.

