# 캠프 관리자 남은 단계 진행 콘텐츠 조회 개선

## 작업 개요

관리자 페이지에서 캠프 관리 '남은 단계 진행하기' 기능에서 발생하던 문제들을 해결했습니다:
1. 학원 일정 동기화 권한 문제 (403 에러)
2. 관리자 조회 권한 문제 (RLS 정책)
3. 디버깅 및 로깅 강화

## 해결된 문제

### 1. 학원 일정 동기화 권한 문제

**문제**: 관리자가 '남은 단계 진행하기'를 할 때 `_syncTimeManagementAcademySchedules` 함수가 학생 권한만 허용하여 403 에러 발생

**해결**:
- `app/(student)/actions/plan-groups/academy.ts` 수정
  - `requireStudentAuth()` 대신 `getCurrentUserRole()` 사용
  - 관리자/컨설턴트 모드일 때는 `studentId` 파라미터를 받아서 해당 학생의 학원 일정 조회
  - 학생 모드일 때는 기존 로직 유지 (현재 사용자 ID 사용)
  - 함수 시그니처 변경: `(groupId: string | null, studentId?: string)`
  - 관리자 모드일 때 플랜 그룹에서 `student_id`를 가져와서 사용

- `app/(student)/plan/new-group/_components/Step2BlocksAndExclusions.tsx` 수정
  - 관리자 모드일 때 `studentId`를 `syncTimeManagementAcademySchedulesAction`에 전달
  - `isAdminMode`, `isAdminContinueMode` props 추가

- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` 수정
  - `Step2BlocksAndExclusions`에 `studentId`, `isAdminMode`, `isAdminContinueMode` 전달

### 2. 관리자 조회 권한 문제 해결

**문제**: 관리자가 다른 학생의 콘텐츠를 조회할 때 RLS 정책으로 인해 조회 실패 가능성

**해결**:
- `lib/data/planContents.ts` 수정
  - Admin 클라이언트 사용 여부 로깅 추가
  - 관리자 모드에서 조회 실패 시 상세한 에러 로깅
  - 조회된 콘텐츠 개수가 예상보다 적을 때 경고 로그 출력
  - `isUsingAdminClient` 플래그 추가하여 디버깅 강화

- `app/(admin)/actions/campTemplateActions.ts` 수정
  - `getCampPlanGroupForReview` 함수에서 콘텐츠 조회 개수 검증 로직 추가
  - 원본 콘텐츠 개수와 분류된 콘텐츠 개수 비교
  - `master_content_id` 정보를 로그에 포함
  - 누락된 콘텐츠 타입별 집계 정보 추가

### 3. 디버깅 및 로깅 강화

**개선 사항**:
- `app/(student)/actions/campActions.ts`
  - `master_content_id` 조회 시작/완료 로그 추가
  - 조회 실패 시 에러 로깅
  - 콘텐츠 매핑 전후 개수 비교 로그
  - `master_content_id`가 있는 콘텐츠와 없는 콘텐츠 개수 집계

- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`
  - 콘텐츠 조회 결과 로그 추가
  - 콘텐츠 분류 결과 로그 추가
  - 누락된 콘텐츠 개수 로그

## 변경된 파일

1. `app/(student)/actions/plan-groups/academy.ts`
   - `_syncTimeManagementAcademySchedules` 함수 수정 (관리자 모드 지원)

2. `app/(student)/plan/new-group/_components/Step2BlocksAndExclusions.tsx`
   - 관리자 모드 props 추가 및 `studentId` 전달

3. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
   - `Step2BlocksAndExclusions`에 관리자 모드 관련 props 전달

4. `lib/data/planContents.ts`
   - 관리자 모드 조회 로깅 강화
   - 조회 실패 및 누락 감지 로직 추가

5. `app/(admin)/actions/campTemplateActions.ts`
   - 콘텐츠 조회 개수 검증 로직 추가
   - 로깅 강화

6. `app/(student)/actions/campActions.ts`
   - `master_content_id` 조회 로깅 강화

7. `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`
   - 콘텐츠 조회 및 분류 결과 로깅 추가

## 테스트 권장 사항

1. 관리자가 '남은 단계 진행하기' 클릭 시 학원 일정 동기화 버튼 작동 확인
2. 관리자가 학생이 작성한 콘텐츠가 제대로 조회되는지 확인
3. 콘솔 로그에서 조회 과정 및 결과 확인
4. 권한 문제 발생 시 에러 메시지 확인

## 참고 사항

- Admin 클라이언트는 RLS를 우회하므로 관리자 모드에서 다른 학생의 데이터 조회 가능
- `master_content_id`가 저장되어 있으면 마스터 콘텐츠 정보를 우선적으로 사용
- 조회 실패 시 상세한 로그가 출력되므로 디버깅이 용이함

