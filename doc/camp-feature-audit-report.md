# 캠프 기능 점검 보고서

## 점검 개요

- **점검 일시**: 2025-01-XX
- **점검 범위**: 캠프 템플릿, 캠프 모드, 캠프 진행 시 필요한 서비스 전체
- **점검 방법**: 코드 리뷰, 데이터베이스 확인, 통합 플로우 검증

---

## 1. 캠프 템플릿 기능 점검 결과

### 1.1 관리자 영역

#### 템플릿 CRUD 기능 ✅

**파일**: `app/(admin)/admin/camp-templates/`

**상태**: 정상 동작

- ✅ 템플릿 목록 조회 (`page.tsx`)
- ✅ 템플릿 생성 (`new/page.tsx`, `new/CampTemplateForm.tsx`)
- ✅ 템플릿 상세 조회 (`[id]/page.tsx`, `[id]/CampTemplateDetail.tsx`)
- ✅ 템플릿 수정 (`[id]/edit/page.tsx`, `[id]/edit/CampTemplateEditForm.tsx`)
- ✅ 템플릿 삭제 (다이얼로그 확인 포함)

**발견 사항**:
- 프로그램 유형, 설명, 상태 필드가 폼에 정상적으로 포함되어 있음
- 검색 및 필터링 기능(프로그램 유형, 상태) 정상 동작

#### 초대 발송 및 관리 ✅

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**상태**: 정상 동작

- ✅ 단일/일괄 초대 발송 (`sendCampInvitationsAction`)
- ✅ 초대 목록 조회 (`getCampInvitationsForTemplate`)
- ✅ 초대 삭제 (단일/일괄) (`deleteCampInvitationAction`, `deleteCampInvitationsAction`)
- ✅ 초대 재발송 (`resendCampInvitationsAction`)
- ✅ 초대 상태 통계 표시

**발견 사항**:
- 중복 초대 방지 로직 정상 동작
- 보관된 템플릿 초대 발송 방지 로직 포함
- 권한 검증 강화됨 (템플릿 소유권 확인)

#### 참여자 목록 조회 ✅

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/CampParticipantsList.tsx`

**상태**: 정상 동작

- ✅ 참여자 목록 조회
- ✅ 플랜 그룹 상태 확인
- ✅ 플랜 생성 여부 확인
- ✅ 일괄 작업 기능 (활성화 등)

**발견 사항**:
- 플랜 그룹이 없는 경우와 있는 경우 모두 정확히 처리됨
- 플랜 생성 전/후 상태 구분 명확함

### 1.2 학생 영역

#### 초대 목록 조회 ✅

**파일**: `app/(student)/camp/page.tsx`

**상태**: 정상 동작

- ✅ 초대받은 캠프 목록 표시
- ✅ 플랜 그룹 상태별 UI 표시
- ✅ 단계별 진행 상태 시각화
- ✅ 상태별 액션 버튼 제공

**발견 사항**:
- 플랜 그룹 상태에 따른 적절한 UI 제공
- 진행 단계(① 참여 정보 제출 → ② 플랜 생성 → ③ 학습 시작) 명확히 표시

#### 초대 상세 및 참여 제출 ✅

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

**상태**: 정상 동작

- ✅ 템플릿 데이터 로드 및 검증
- ✅ 템플릿 블록 세트 조회 및 표시
- ✅ Draft 플랜 그룹 복원 기능
- ✅ PlanGroupWizard 통합 (캠프 모드)

**발견 사항**:
- 템플릿 데이터 검증 로직 포함
- 템플릿 블록 세트가 학생 블록 세트 목록 맨 앞에 표시됨
- 템플릿 제외일/학원 일정 lock 처리 정상

### 1.3 데이터 레이어

#### 데이터 액세스 함수 ✅

**파일**: `lib/data/campTemplates.ts`

**상태**: 정상 동작

- ✅ 템플릿 CRUD 함수
- ✅ 초대 CRUD 함수
- ✅ 에러 처리 적절함

#### 타입 정의 ✅

**파일**: `lib/types/plan.ts`

**상태**: 정상 동작

- ✅ `CampTemplate`, `CampInvitation` 타입 정의
- ✅ `CampProgramType`, `CampInvitationStatus` 타입 정의

#### 데이터베이스 스키마 ✅

**파일**: `supabase/migrations/20250201000000_add_camp_tables.sql`

**상태**: 정상 동작

- ✅ `camp_templates` 테이블
- ✅ `camp_invitations` 테이블
- ✅ 인덱스 및 제약 조건 적절함

---

## 2. 캠프 모드 동작 점검 결과

### 2.1 플랜 그룹 생성 (학생 영역) ✅

**파일**: `app/(student)/actions/campActions.ts::submitCampParticipation`

**상태**: 정상 동작

- ✅ `plan_type: "camp"` 설정 확인
- ✅ `camp_template_id`, `camp_invitation_id` 설정 확인
- ✅ 템플릿 데이터와 학생 입력 데이터 병합 로직 정상
- ✅ 초대 상태 업데이트 (pending → accepted)

**발견 사항**:
- 템플릿 제외일/학원 일정에 `source: "template"`, `is_locked: true` 필드 추가됨
- `subject_allocations`는 null로 설정 (관리자 검토 후 설정)
- 자동 추천 콘텐츠 생성 로직 포함

### 2.2 PlanGroupWizard 캠프 모드 ✅

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

**상태**: 정상 동작

- ✅ `isCampMode` prop 처리
- ✅ 템플릿 블록 세트 조회 및 표시
- ✅ 템플릿 제외일/학원 일정 lock 처리
- ✅ 캠프 모드에서 `block_set_id` null 처리 로직

**발견 사항**:
- 캠프 모드에서는 Step 1-4만 검증 (Step 6 제외)
- 캠프 모드에서는 템플릿 블록 세트 사용 (student_block_sets 참조 불가)

---

## 3. 캠프 진행 시 필요한 서비스 점검 결과

### 3.1 관리자 영역 - 플랜 생성 및 활성화 ✅

#### 플랜 그룹 검토 ✅

**파일**: `app/(admin)/actions/campTemplateActions.ts::getCampPlanGroupForReview`

**상태**: 정상 동작

- ✅ 플랜 그룹 및 상세 정보 조회
- ✅ 캠프 플랜 그룹 확인 (`plan_type === "camp"`)

#### 남은 단계 진행 (Step 5, 6, 7) ✅

**파일**: 
- `app/(admin)/actions/campTemplateActions.ts::continueCampStepsForAdmin`
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

**상태**: 정상 동작

- ✅ Step 5-7 진행 가능
- ✅ 플랜 생성 전 단계 진행 가능
- ✅ 템플릿 블록 세트 조회 및 표시

**발견 사항**:
- 이미 플랜이 생성된 경우 검토 페이지로 리다이렉트
- 관리자 모드(`isAdminMode={true}`)로 PlanGroupWizard 실행

#### 전략과목/취약과목 설정 ✅

**파일**: `app/(admin)/actions/campTemplateActions.ts::updateCampPlanGroupSubjectAllocations`

**상태**: 정상 동작

- ✅ 과목별 전략과목/취약과목 설정
- ✅ 전략과목 주당 배정 일수 설정
- ✅ `scheduler_options.subject_allocations`에 저장

#### 플랜 생성 ✅

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/review/CampPlanGroupReviewForm.tsx`

**상태**: 정상 동작

- ✅ 전략과목/취약과목 설정 후 플랜 생성
- ✅ `generatePlansFromGroupAction` 호출
- ✅ 플랜 생성 후 상세 페이지로 이동

**발견 사항**:
- 플랜 생성 전 모든 과목의 전략과목/취약과목 설정 검증
- 플랜 생성 개수 표시

#### 플랜 그룹 활성화 ✅

**파일**: `app/(admin)/actions/campTemplateActions.ts::updateCampPlanGroupStatus`

**상태**: 정상 동작

- ✅ 상태 전이 검증 (`PlanValidator.validateStatusTransition`)
- ✅ 플랜 생성 여부 확인 (active로 변경 시)
- ✅ 학생별 활성 플랜 그룹 1개 제한 (다른 활성 플랜 그룹 자동 비활성화)

**발견 사항**:
- 활성화 시 다른 활성 플랜 그룹을 "saved" 상태로 변경
- 플랜이 없는 경우 활성화 불가 에러 처리

#### 플랜 그룹 일괄 활성화 ✅

**파일**: `app/(admin)/actions/campTemplateActions.ts::batchUpdateCampPlanGroupStatus`

**상태**: 정상 동작

- ✅ 여러 플랜 그룹 일괄 활성화
- ✅ 학생별 활성 플랜 그룹 제한 처리
- ✅ 실패한 항목별 에러 반환

### 3.2 학생 영역 - 학습 진행 ✅

#### 학습 세션 시작/종료 ✅

**파일**: 
- `app/(student)/today/actions/todayActions.ts::startPlan`
- `app/(student)/actions/studySessionActions.ts`

**상태**: 정상 동작

- ✅ 캠프 플랜 그룹의 플랜에서도 학습 세션 시작 가능
- ✅ 다른 플랜의 활성 세션 확인 및 에러 처리

#### 오늘의 학습 진행률 ✅

**파일**: `lib/metrics/todayProgress.ts::calculateTodayProgress`

**상태**: 정상 동작

- ✅ `getPlansForStudent` 함수로 해당 날짜의 모든 플랜 조회
- ✅ 캠프 플랜 그룹의 플랜도 `plan_group_id`로 연결되어 포함됨

**발견 사항**:
- `calculateTodayProgress`는 활성 플랜 그룹 필터링 없이 해당 날짜의 모든 플랜을 조회
- 캠프 플랜 그룹이 활성화(`status: "active"`)되면 플랜이 정상적으로 포함됨
- `plan/calendar` 페이지에서는 활성 플랜 그룹 ID로 필터링하여 조회 (더 정확한 필터링)

#### 플랜 조회 및 관리 ✅

**파일**: 
- `app/(student)/plan/_components/PlanGroupList.tsx`
- `app/(student)/plan/group/[id]/page.tsx`

**상태**: 정상 동작

- ✅ 캠프 플랜 그룹 목록 조회
- ✅ 캠프 플랜 그룹 상세 조회
- ✅ 학생은 조회만 가능 (활성화는 관리자)

### 3.3 성적 관리 ⚠️

**상태**: 별도 구현 필요 확인

**발견 사항**:
- 캠프 플랜 그룹과 성적 데이터 연결 기능 확인 필요
- 성적 입력 기능은 학생 영역에 일반적으로 구현되어 있음 (`app/(student)/actions/scoreActions.ts`)
- 캠프 모드 전용 성적 관리 기능은 별도 구현되지 않은 것으로 보임

---

## 4. 데이터 일관성 확인 결과

### 4.1 `plan_type: "camp"` 설정 ✅

**상태**: 정상

- ✅ 플랜 그룹 생성 시 `plan_type: "camp"` 설정됨
- ✅ 캠프 관련 액션에서 `plan_type === "camp"` 검증 포함

### 4.2 `camp_template_id`, `camp_invitation_id` 연결 ✅

**상태**: 정상

- ✅ 플랜 그룹 생성 시 두 필드 모두 설정됨
- ✅ 초대 ID와 플랜 그룹 연결 확인 로직 포함
- ✅ 불일치 시 자동 업데이트 시도

### 4.3 템플릿 블록 세트와 학생 블록 세트 구분 ✅

**상태**: 정상

- ✅ 템플릿 블록 세트는 `template_block_sets` 테이블 사용
- ✅ 학생 블록 세트는 `student_block_sets` 테이블 사용
- ✅ 캠프 모드에서는 `block_set_id`를 null로 설정 (템플릿 블록 세트는 별도 참조)

### 4.4 템플릿 제외일/학원 일정 lock 처리 ✅

**상태**: 정상

- ✅ `source: "template"`, `is_locked: true` 필드 추가
- ✅ 템플릿에서 추가한 항목은 삭제 불가

### 4.5 플랜 그룹 상태 전이 검증 ✅

**상태**: 정상

- ✅ `PlanValidator.validateStatusTransition` 사용
- ✅ draft → saved → active 전이 검증
- ✅ 플랜 생성 전 활성화 불가

---

## 5. 에러 처리 및 권한 검증 확인 결과

### 5.1 권한 검증 ✅

**상태**: 강화됨

- ✅ 템플릿 소유권 검증 (tenant_id 확인)
- ✅ 초대 접근 권한 검증 (student_id 확인)
- ✅ 관리자/컨설턴트 역할 검증

### 5.2 데이터 검증 ✅

**상태**: 적절함

- ✅ 템플릿 필수 필드 검증
- ✅ 날짜 범위 검증
- ✅ 프로그램 유형, 상태 검증

### 5.3 에러 메시지 ✅

**상태**: 명확함

- ✅ `AppError` 및 `withErrorHandling` 사용
- ✅ 사용자 친화적인 에러 메시지
- ✅ 적절한 HTTP 상태 코드 반환

---

## 6. 통합 플로우 테스트 시나리오

### 시나리오 1: 템플릿 생성 → 초대 발송 → 학생 참여 → 플랜 그룹 생성 ✅

1. **관리자**: 템플릿 생성 (`/admin/camp-templates/new`)
   - 프로그램 유형, 설명, 상태 설정
   - 템플릿 데이터 입력 (Step 1-3)

2. **관리자**: 학생 초대 발송 (`/admin/camp-templates/[id]`)
   - 학생 선택
   - 초대 발송

3. **학생**: 초대 수락 및 참여 제출 (`/camp/[invitationId]`)
   - 템플릿 데이터 확인
   - 학원 일정 및 학습 콘텐츠 입력 (Step 1-4)
   - 참여 정보 제출

4. **결과**: 플랜 그룹 생성 (draft 상태)

**점검 결과**: ✅ 정상 동작

### 시나리오 2: 관리자 플랜 생성 및 활성화 ✅

1. **관리자**: 플랜 그룹 검토 (`/admin/camp-templates/[id]/participants/[groupId]/review`)
   - 학생 제출 정보 확인
   - Step 1-4 내용 검토

2. **관리자**: 남은 단계 진행 (필요시) (`/admin/camp-templates/[id]/participants/[groupId]/continue`)
   - Step 5-7 진행 (추천 콘텐츠, 최종 확인, 스케줄 결과)

3. **관리자**: 전략과목/취약과목 설정 (`CampPlanGroupReviewForm`)
   - 과목별 전략과목/취약과목 분류
   - 전략과목 주당 배정 일수 설정

4. **관리자**: 플랜 생성 (`CampPlanGroupReviewForm`)
   - "플랜 생성하기" 버튼 클릭
   - 플랜 생성 완료

5. **관리자**: 플랜 그룹 활성화 (`CampParticipantsList`)
   - 플랜 그룹 선택
   - 활성화 버튼 클릭
   - 상태 변경: draft → saved → active

**점검 결과**: ✅ 정상 동작

### 시나리오 3: 학생 학습 시작 ✅

1. **학생**: 캠프 초대 목록 확인 (`/camp`)
   - 플랜 그룹 상태 확인 (active)
   - "학습 시작하기" 버튼 표시

2. **학생**: 학습 시작 (`/today`)
   - 플랜 목록에서 캠프 플랜 확인
   - 타이머 시작

3. **학생**: 진행률 확인
   - 오늘의 학습 진행률 계산

**점검 결과**: ✅ 정상 동작 (추가 검증 권장)

---

## 7. 발견된 문제점 및 개선 사항

### 7.1 잠재적 문제

#### 문제 1: 캠프 모드에서 블록 조회 로직 ⚠️

**상황**:
- 캠프 모드에서 `block_set_id`가 null로 설정됨
- 템플릿 블록 세트는 별도로 조회해야 함

**영향**:
- 블록 조회 시 템플릿 블록 세트와 학생 블록 세트 구분 필요
- 현재는 정상 동작하지만 로직 복잡도가 높음

**권장 사항**:
- 블록 조회 로직을 캠프 모드 전용으로 명확화
- 헬퍼 함수로 분리하여 가독성 향상

#### 문제 2: 성적 관리 기능 연결 미확인 ⚠️

**상황**:
- 캠프 플랜 그룹과 성적 데이터의 명시적 연결 확인 필요
- 일반 성적 관리 기능은 존재하나 캠프 전용 기능 불명확

**권장 사항**:
- 캠프 플랜 그룹과 성적 데이터 연결 확인
- 필요시 캠프 전용 성적 분석 기능 추가 검토

#### 문제 3: 초대 상태와 플랜 그룹 상태 동기화 ⚠️

**상황**:
- 초대 상태(pending/accepted)와 플랜 그룹 상태(draft/saved/active)가 분리되어 있음
- 상태 동기화 로직 확인 필요

**현재 상태**:
- 정상 동작 (초대 상태는 참여 제출 시 업데이트, 플랜 그룹 상태는 별도 관리)

**권장 사항**:
- 상태 동기화 로직 문서화
- 상태 전이 다이어그램 추가

### 7.2 개선 제안

#### 개선 1: 관리자 영역 플랜 생성 및 활성화 UI/UX 개선

**현재 상태**: 기능은 정상 동작하나 워크플로우가 다단계임

**개선 제안**:
- 작업 흐름 가이드 추가 (검토 → 설정 → 생성 → 활성화)
- 진행 상태 시각화 강화
- 일괄 작업 기능 확대

#### 개선 2: 플랜 그룹 상태 전이 검증 강화

**현재 상태**: 기본 검증 포함

**개선 제안**:
- 상태 전이 규칙 문서화
- 상태별 허용 작업 명확화
- 상태 전이 히스토리 추적 (선택사항)

#### 개선 3: 에러 처리 및 사용자 피드백 개선

**현재 상태**: 기본 에러 처리 포함

**개선 제안**:
- 에러 복구 가이드 제공
- 작업 실패 시 롤백 옵션 (필요시)
- 진행 중 작업 취소 기능

---

## 8. 점검 결과 요약

### 8.1 전체 평가

| 영역 | 상태 | 평가 |
|------|------|------|
| 캠프 템플릿 기능 | ✅ | 정상 동작 |
| 캠프 모드 동작 | ✅ | 정상 동작 |
| 관리자 플랜 생성/활성화 | ✅ | 정상 동작 |
| 학생 학습 진행 | ✅ | 정상 동작 (추가 검증 권장) |
| 데이터 일관성 | ✅ | 정상 |
| 에러 처리/권한 검증 | ✅ | 강화됨 |
| 성적 관리 | ⚠️ | 추가 확인 필요 |

### 8.2 주요 성과

1. ✅ 캠프 템플릿 CRUD 기능 완전 구현
2. ✅ 초대 발송 및 관리 기능 완전 구현
3. ✅ 학생 참여 플로우 정상 동작
4. ✅ 관리자 플랜 생성 및 활성화 플로우 정상 동작
5. ✅ 권한 검증 및 에러 처리 강화

### 8.3 개선 필요 사항

1. ⚠️ 캠프 모드 블록 조회 로직 명확화
2. ⚠️ 성적 관리 기능 연결 확인
3. ⚠️ 관리자 작업 흐름 가이드 추가
4. ⚠️ 상태 동기화 로직 문서화

---

## 9. 우선순위별 개선 계획

### 높은 우선순위

1. **성적 관리 기능 연결 확인**
   - 캠프 플랜 그룹과 성적 데이터 연결 확인
   - 필요시 연결 기능 추가

2. **캠프 모드 블록 조회 로직 명확화**
   - 헬퍼 함수로 분리
   - 주석 및 문서화

### 중간 우선순위

3. **관리자 작업 흐름 가이드 추가**
   - 워크플로우 시각화
   - 진행 상태 표시 강화

4. **상태 동기화 로직 문서화**
   - 상태 전이 다이어그램
   - 상태별 허용 작업 명확화

### 낮은 우선순위

5. **에러 처리 개선**
   - 에러 복구 가이드
   - 작업 취소 기능

6. **성능 최적화**
   - 대량 초대 발송 최적화
   - 플랜 생성 성능 최적화

---

## 10. 결론

캠프 기능의 핵심 기능들은 모두 정상 동작하고 있으며, 권한 검증 및 에러 처리도 적절히 구현되어 있습니다. 다만, 일부 로직의 명확화 및 문서화, 그리고 성적 관리 기능과의 연결 확인이 필요합니다.

전체적으로 **프로덕션 환경에서 사용 가능한 수준**으로 판단됩니다.

---

**점검 완료일**: 2025-01-XX
**점검자**: AI Assistant
