# 캠프 모드 권한 처리 최적화 (2025-11-27)

## 작업 개요
- 플랜 생성/미리보기 액션에서 반복적으로 사용하던 권한 및 클라이언트 선택 로직을 유틸리티로 추출했습니다.
- 관리자/컨설턴트가 학생 대시보드를 대신 처리할 때 발생하던 중복 코드와 실수 가능성을 줄였습니다.

## 주요 변경 사항
1. `lib/auth/planGroupAuth.ts`
   - `verifyPlanGroupAccess`, `getPlanGroupWithDetailsByRole`, `getStudentIdForPlanGroup`, `shouldBypassStatusCheck`, `getSupabaseClientForStudent`를 추가했습니다.
   - 계획 그룹 조회/상태 검증/학생 ID 결정/클라이언트 선택을 단일 진입점으로 정리했습니다.
2. `lib/supabase/clientSelector.ts`
   - `ensureAdminClient`와 `selectClientForStudentQuery`를 추가하여 Admin 클라이언트 생성을 중앙에서 관리합니다.
3. `app/(student)/actions/plan-groups/plans.ts`
   - `_generatePlansFromGroup`, `_previewPlansFromGroup`에서 새 유틸리티를 사용하도록 리팩토링했습니다.
   - 학생 ID를 일관되게 사용하도록 수정하여 관리자 플로우에서도 학생 데이터가 정확히 조회됩니다.

## 테스트
- `npx eslint 'app/(student)/actions/plan-groups/plans.ts' lib/auth/planGroupAuth.ts lib/supabase/clientSelector.ts`
  - 기존 파일(`app/(student)/actions/plan-groups/plans.ts`)에 존재하던 `any` 관련 규칙으로 인해 실패합니다. 새로 작성한 유틸리티 파일은 에러 없이 통과합니다.

