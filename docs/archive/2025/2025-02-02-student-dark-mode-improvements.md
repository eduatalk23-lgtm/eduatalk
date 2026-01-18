# 학생 섹션 다크 모드 개선 작업

## 작업 일시
2025-02-02

## 작업 개요
`(student)` 폴더 내에서 다크/라이트 모드가 미반영된 부분을 검토하고 수정했습니다.

## 수정된 파일

### 1. `app/(student)/plan/_components/PlanGroupListItem.tsx`

#### 수정 내용
- 배경색: `bg-white` → `bg-white dark:bg-gray-800`
- 선택된 상태 배경: `bg-blue-50` → `bg-blue-50 dark:bg-blue-900/30`
- 테두리 색상: `border-gray-200` → `border-gray-200 dark:border-gray-700`
- 호버 테두리: `hover:border-gray-300` → `hover:border-gray-300 dark:hover:border-gray-600`
- 링 색상: `ring-blue-200` → `ring-blue-200 dark:ring-blue-800`

- 제목 텍스트: `text-gray-900` → `text-gray-900 dark:text-gray-100`
- 진행률 섹션:
  - 배경: `bg-gray-50` → `bg-gray-50 dark:bg-gray-900/50`
  - 테두리: `border-gray-100` → `border-gray-100 dark:border-gray-700`
  - 텍스트: `text-gray-600` → `text-gray-600 dark:text-gray-400`
  - 강조 텍스트: `text-gray-900` → `text-gray-900 dark:text-gray-100`

- 목적/스케줄러/기간 섹션:
  - 기본 텍스트: `text-gray-600` → `text-gray-600 dark:text-gray-400`
  - 라벨 텍스트: `text-gray-800` → `text-gray-800 dark:text-gray-300`
  - 값 텍스트: `text-gray-900` → `text-gray-900 dark:text-gray-100`

- 하단 메타 정보:
  - 테두리: `border-gray-100` → `border-gray-100 dark:border-gray-700`
  - 텍스트: `text-gray-800` → `text-gray-800 dark:text-gray-300`

- 버튼 스타일:
  - 체크박스 버튼: `text-gray-700` → `text-gray-700 dark:text-gray-300`
  - 호버: `hover:bg-gray-100` → `hover:bg-gray-100 dark:hover:bg-gray-700`
  - 보기 버튼: 다크 모드 호버 스타일 추가
  - 삭제 버튼: 다크 모드 호버 스타일 추가
  - 비활성화 버튼: `text-gray-300` → `text-gray-300 dark:text-gray-600`

- 토글 스위치:
  - 활성 상태: `bg-green-600` → `bg-green-600 dark:bg-green-500`
  - 비활성 상태: `bg-gray-200` → `bg-gray-200 dark:bg-gray-700`

### 2. `app/(student)/contents/_components/ContentHeader.tsx`

#### 수정 내용
- 표지 이미지 컨테이너:
  - 테두리: `border-gray-200` → `border-gray-200 dark:border-gray-700`
  - 배경: `bg-gray-100` → `bg-gray-100 dark:bg-gray-800`

- 제목 텍스트: `text-gray-900` → `text-gray-900 dark:text-gray-100`
- 부제목 텍스트: `text-gray-600` → `text-gray-600 dark:text-gray-400`

- 아이콘 배경: `bg-indigo-100` → `bg-indigo-100 dark:bg-indigo-900/30`
- 아이콘 색상: `text-indigo-600` → `text-indigo-600 dark:text-indigo-400`
- 라벨 텍스트: `text-indigo-600` → `text-indigo-600 dark:text-indigo-400`

- 구분점: `bg-gray-400` → `bg-gray-400 dark:bg-gray-500`

## 검토된 파일 (이미 다크 모드 적용됨)

다음 파일들은 이미 다크 모드가 잘 적용되어 있어 수정이 필요하지 않았습니다:

- `app/(student)/dashboard/page.tsx` - CSS 변수 기반 다크 모드 유틸리티 사용
- `app/(student)/today/page.tsx` - 서버 컴포넌트, 다크 모드 클래스 미사용
- `app/(student)/contents/_components/ContentCard.tsx` - 다크 모드 클래스 적용됨
- `app/(student)/scores/_components/ScoreCard.tsx` - CSS 변수 기반 유틸리티 사용
- `app/(student)/blocks/_components/BlocksViewer.tsx` - 다크 모드 클래스 적용됨
- `app/(student)/plan/calendar/_components/CalendarPlanCard.tsx` - 다크 모드 클래스 적용됨
- `app/(student)/scores/_components/ScoreListTable.tsx` - CSS 변수 기반 유틸리티 사용

## 개선 사항

1. **일관성 향상**: 모든 텍스트와 배경 색상에 다크 모드 클래스가 일관되게 적용되었습니다.
2. **가독성 개선**: 다크 모드에서도 텍스트와 배경의 대비가 적절하게 유지됩니다.
3. **사용자 경험**: 다크 모드 사용자도 모든 UI 요소를 명확하게 볼 수 있습니다.

## 참고 사항

- 프로젝트에서는 CSS 변수 기반 다크 모드 유틸리티(`lib/utils/darkMode.ts`)를 사용하는 것을 권장합니다.
- 새로운 코드 작성 시 `textPrimaryVar`, `bgSurfaceVar`, `borderDefaultVar` 등의 CSS 변수 기반 유틸리티를 우선 사용하세요.
- 기존 코드에서 하드코딩된 색상 클래스를 발견하면 다크 모드 클래스를 추가하거나 CSS 변수 기반 유틸리티로 교체하세요.

## 다음 단계

추가로 확인이 필요한 영역:
- `app/(student)/plan/calendar/` 폴더 내 일부 컴포넌트
- `app/(student)/scores/analysis/` 폴더 내 일부 컴포넌트
- `app/(student)/scores/dashboard/` 폴더 내 deprecated 컴포넌트들

이러한 영역들은 향후 필요시 추가 검토 및 수정이 필요할 수 있습니다.

