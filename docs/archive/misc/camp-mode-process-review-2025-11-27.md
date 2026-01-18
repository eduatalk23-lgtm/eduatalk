# 캠프 모드 프로세스 정리 및 점검 (2025-11-27)

## 1. 개요
- 목적: 캠프 모드 전반(관리자/학생)의 흐름과 데이터 구조를 재정리하고, 잠재 이슈와 개선 과제를 도출.
- 참고 파일: `app/(student)/camp/page.tsx`, `app/(student)/camp/[invitationId]/page.tsx`, `app/(student)/actions/campActions.ts`, `app/(admin)/actions/campTemplateActions.ts`, `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`, `docs/camp-process-improvement.md` 등.

## 2. 프로세스 흐름 요약

### 2.1 관리자 영역
1. **템플릿 생성/수정** (`/admin/camp-templates`, `CampTemplateForm`, `CampTemplateEditForm`)
   - Step1~3에서 기본 정보/블록/스케줄 정의 → `camp_templates.template_data`로 저장.
   - 블록 세트는 `camp_template_block_sets`를 통해 `tenant_block_sets`와 매핑.
2. **초대 발송** (`app/(admin)/admin/camp-templates/[id]/CampInvitationList.tsx`, `sendCampInvitationsAction`)
   - 중복 초대 검사 → `camp_invitations`에 `pending` 상태로 삽입.
3. **참여자 검토** (`/admin/camp-templates/[id]/participants`, `getCampPlanGroupForReview`)
   - 학생 제출 데이터 확인, Step5~7을 이어서 진행 (`continueCampStepsForAdmin`).
4. **플랜 활성화** (`updateCampPlanGroupStatus`, `batchUpdateCampPlanGroupStatus`)
   - `plan_groups.status`를 `saved/active`로 전환, 다른 활성 플랜 자동 정리.

### 2.2 학생 영역
1. **초대 목록** (`/camp`, `CampInvitationCard`)
   - `getStudentCampInvitations`로 개인 초대 조회, 상태에 따라 이동 경로 결정.
2. **참여 입력** (`/camp/[invitationId]`, `PlanGroupWizard`)
   - Step1~4만 활성, 템플릿에서 잠금 여부(`templateLockedFields`) 반영.
   - Draft가 있으면 불러오고, 제출 시 `plan_groups`에 `plan_type: "camp"`로 저장.
3. **제출 결과 확인** (`/camp/[invitationId]/submitted`)
   - 제출 본문 + 템플릿 블록 정보(`scheduler_options.template_block_set_id` 또는 연결 테이블) 표시.
   - 생성된 플랜 여부에 따라 `/plan/group/[groupId]`로 릴레이.

## 3. 데이터 흐름
1. **템플릿 정의**
   - `camp_templates`에 WizardData 스냅샷 저장, 블록 세트는 별도 테이블로 분리.
2. **초대 발송**
   - `camp_invitations`가 학생과 템플릿을 연결. 상태 변화는 `updateCampInvitationStatus`.
3. **학생 제출**
   - `submitCampParticipation`: 템플릿 값 + 학생 입력을 병합 후 `plan_groups`/`plan_contents`/`plan_exclusions` 등에 반영.
   - `scheduler_options.template_block_set_id`에 템플릿 블록 참조를 저장, `block_set_id`는 null.
4. **관리자 후속 단계**
   - `continueCampStepsForAdmin`이 Step5~7 데이터를 직접 갱신하고, `generatePlansFromGroupAction`으로 실제 `student_plan` 레코드 생성.

## 4. 단계별 역할 (PlanGroupWizard 기준)
| 단계 | 담당 | 주요 파일/액션 | 비고 |
| --- | --- | --- | --- |
| Step1 기본 정보 | 학생 | `Step1BasicInfo` | 템플릿 잠금 필드 적용 |
| Step2 블록/제외일 | 학생 | `Step2BlocksAndExclusions` | 템플릿 제외일 삭제 불가 |
| Step3 스케줄 미리보기 | 학생 | `Step2_5SchedulePreview` | 템플릿 블록 세트 우선 |
| Step4 콘텐츠 선택 | 학생 | `Step3Contents` | 캠프 모드: 추천 콘텐츠 숨김 |
| Step5 추천 콘텐츠/제약 | 관리자 | `Step4RecommendedContents`, `continueCampStepsForAdmin` | 제약 조건 검증 수행 |
| Step6 최종 확인 | 관리자 | `Step6FinalReview` | 학습 분량 조절 전용 |
| Step7 결과 | 관리자 | `Step7ScheduleResult` | 플랜 미생성 시 자동 생성 |

## 5. 잠재적 이슈
1. **템플릿 수정 영향 범위 미노출**: 이미 초대가 발송된 템플릿에 대한 경고/버전 관리 미구현.
2. **블록 세트 조회 분기 복잡**: `scheduler_options` → 연결 테이블 → `template_data` 순으로 조회하는데, 불일치 시 사용자가 오류를 이해하기 어려움.
3. **권한 검증 중복 로직**: 여러 액션에서 동일한 tenant/student 검증 로직이 반복되어 유지보수 비용 증가.
4. **상태 전이 실패 시 사용자 메시지 부족**: `PlanValidator` 오류가 그대로 노출되어 이해가 어려울 수 있음.
5. **Draft 자동 저장 부재**: 학생 입력 도중 세션 만료 시 데이터 유실 가능.

## 6. 개선 제안
1. **템플릿 버전/경고**
   - `camp_templates`에 `version` 필드 추가 또는 수정 시 경고 모달 제공.
2. **블록 세트 진단 도구**
   - `/camp/[invitationId]/submitted`에서 블록 세트를 찾지 못한 경우 UI 레벨 안내문 추가.
3. **권한 헬퍼 공통화**
   - `requireAdminOrConsultant`, `assertStudentOwnership` 등을 `lib/auth` 계층으로 이동하여 재사용.
4. **Draft 자동 저장**
   - `PlanGroupWizard`에 debounce 적용, `savePlanGroupDraftAction` 호출 고도화.
5. **상태 전이 피드백 개선**
   - `PlanValidator` 결과를 사용자 친화 텍스트로 매핑하는 헬퍼 추가.

## 7. 점검 체크리스트 결과
- 데이터베이스 구조: `camp_templates`, `camp_invitations`, `camp_template_block_sets`, `plan_groups` 모두 캠프 필드 포함 및 인덱스 존재 확인.
- 권한 검증: 관리자 액션은 `getCurrentUserRole`, 학생 액션은 `getCurrentUser`/`student_id` 비교로 보호됨.
- 데이터 흐름: 템플릿 → 초대 → 플랜 그룹 → 플랜 생성 경로 명확. 블록 세트 저장 위치도 문서화됨.
- 프로세스: 학생/관리자 단계가 명확히 분리되어 있으며, Step5~7은 관리자 전용이라는 점을 UI/서버 양쪽에서 강제.

## 8. 후속 작업 권장
1. 위 개선 제안에 대한 우선순위 산정 및 티켓화.
2. Step5 제약 조건 실패 시 구체적 가이드 메시지 추가.
3. 캠프 모드용 QA 시나리오(초대 만료, draft 복구, 관리자 재검토) 정의.


