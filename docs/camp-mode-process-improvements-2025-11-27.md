# 캠프 모드 프로세스 개선 기록 (2025-11-27)

## 1. 관리자 영역
- `app/(admin)/admin/camp-templates/[id]/edit/page.tsx`, `CampTemplateEditForm.tsx`
  - 템플릿별 초대 및 플랜 그룹 현황을 서버에서 수집하여 경고 배너와 통계 카드로 노출.
  - 초대가 진행 중인 상태에서 템플릿을 수정할 때의 영향 범위를 명시하고 참여자 페이지로 이동하는 단축 링크 제공.
- `lib/data/campTemplates.ts`
  - `getCampTemplateImpactSummary`를 추가하여 초대/플랜 그룹 통계를 일관되게 계산.

## 2. 학생 영역
- `PlanGroupWizard.tsx`
  - 캠프 모드에서 자동 저장 스냅샷을 생성·비교하여 2초 간격으로 백그라운드 저장.
  - 자동 저장 상태(`저장 중/저장됨/실패`)와 마지막 저장 시간을 상단 바에 표기.
  - Draft 저장 API를 Promise 기반으로 정리하고, Step3 콘텐츠 화면(`Step3Contents.tsx`)에서 `await`가 가능하도록 타입 수정.

## 3. 데이터/권한 구조
- `lib/auth/guards.ts`: `requireAdminOrConsultant` 헬퍼 추가.
- `app/(admin)/actions/campTemplateActions.ts`, `campTemplateBlockSets.ts`
  - 주요 서버 액션(템플릿 생성/수정/상태 변경/초대 관리/플랜 상태 변경)과 블록 세트 액션에서 공통 가드를 사용하도록 리팩터링.
  - 반복되던 역할 검증 로직 제거, 예외 메시지 통일.

## 4. 추가 참고
- 관련 파일: `docs/camp-mode-process-review-2025-11-27.md` (기존 프로세스 요약)
- 향후 과제: 템플릿 복사 기능 및 초대 만료 자동화 로드맵 정리 필요.

