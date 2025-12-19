# 캠프 템플릿 학습 관리 기능 개선 - Phase 1 완료

**작성일**: 2025년 1월 15일  
**Phase**: 1 - 공통 로직 추출 및 리팩토링  
**상태**: 완료

---

## 작업 내용

### 1. 공통 재조정 로직 추출

**파일**: `lib/reschedule/core.ts` (신규 생성)

역할에 독립적인 재조정 로직을 추출하여 공통 모듈로 분리했습니다.

**주요 함수**:
- `validateRescheduleInput`: 입력값 검증
- `calculateReschedulePreview`: 재조정 미리보기 계산 (역할 독립적)
- `executeRescheduleOperation`: 재조정 실행 로직 (역할 독립적)

**타입 정의**:
- `RescheduleContext`: 재조정 컨텍스트 (사용자 ID, 학생 ID, 역할, 테넌트 ID)
- `ReschedulePreviewResult`: 재조정 미리보기 결과
- `RescheduleResult`: 재조정 실행 결과
- `RescheduleValidationResult`: 입력값 검증 결과

### 2. 기간 계산 로직 통합

**파일**: `lib/reschedule/periodCalculator.ts` (수정)

중복된 기간 계산 로직을 통합 함수로 추출했습니다.

**추가 함수**:
- `calculateAdjustedPeriodUnified`: 통합된 기간 계산 함수
  - `placementDateRange`가 있으면 우선 사용
  - 없으면 `rescheduleDateRange`를 기반으로 자동 계산

### 3. 학생용 재조정 액션 리팩토링

**파일**: `app/(student)/actions/plan-groups/reschedule.ts` (수정)

기존의 중복된 로직을 제거하고 공통 로직을 사용하도록 리팩토링했습니다.

**변경 사항**:
- `_getReschedulePreview`: 공통 로직 `calculateReschedulePreview` 호출
- `_rescheduleContents`: 공통 로직 `executeRescheduleOperation` 호출
- 권한 검증: `verifyPlanGroupAccess` 사용
- 플랜 그룹 조회: `getPlanGroupWithDetailsByRole` 사용
- 학생 ID 결정: `getStudentIdForPlanGroup` 사용

**코드 감소**:
- 기존: 약 750줄
- 리팩토링 후: 약 150줄
- 약 80% 코드 감소

---

## 개선 효과

### 1. 코드 중복 제거

- 기간 계산 로직 중복 제거
- 재조정 미리보기 로직 중복 제거
- 재조정 실행 로직 중복 제거

### 2. 역할 독립성 확보

- 학생용과 관리자용이 동일한 핵심 로직 사용
- 권한 검증과 플랜 그룹 조회는 외부에서 주입
- 역할에 따라 적절한 컨텍스트 전달

### 3. 유지보수성 향상

- 핵심 로직이 한 곳에 집중되어 수정이 용이
- 버그 수정 시 한 곳만 수정하면 모든 역할에 적용
- 테스트 작성이 용이

---

## 다음 단계 (Phase 2)

1. 관리자용 재조정 서버 액션 생성
   - `app/(admin)/actions/plan-groups/reschedule.ts`
   - 공통 로직 `calculateReschedulePreview`, `executeRescheduleOperation` 사용

2. 관리자용 재조정 페이지 생성
   - `/admin/camp-templates/[id]/participants/[groupId]/reschedule`
   - 학생용 `RescheduleWizard` 컴포넌트 재사용

3. 참여자 상세 페이지에 재조정 버튼 추가
   - `CampParticipantDetailView.tsx` 수정

---

## 참고 파일

- `lib/reschedule/core.ts` - 공통 재조정 로직
- `lib/reschedule/periodCalculator.ts` - 기간 계산 로직 (통합 함수 추가)
- `app/(student)/actions/plan-groups/reschedule.ts` - 학생용 재조정 액션 (리팩토링)
- `lib/auth/planGroupAuth.ts` - 권한 검증 및 플랜 그룹 조회 유틸리티

