# 캠프 템플릿 학습 관리 기능 개선 - Phase 2 완료

**작성일**: 2025년 1월 15일  
**Phase**: 2 - 관리자용 재조정 기능 구현  
**상태**: 완료

---

## 작업 내용

### 1. 관리자용 재조정 서버 액션 생성

**파일**: `app/(admin)/actions/plan-groups/reschedule.ts` (신규 생성)

관리자가 학생의 플랜 그룹을 재조정할 수 있는 서버 액션을 생성했습니다.

**주요 함수**:
- `getReschedulePreviewForAdmin`: 관리자용 재조정 미리보기
- `rescheduleContentsForAdmin`: 관리자용 재조정 실행

**특징**:
- 공통 로직 `calculateReschedulePreview`, `executeRescheduleOperation` 사용
- 권한 검증: `verifyPlanGroupAccess` 사용 (관리자/컨설턴트만 허용)
- 플랜 그룹 조회: `getPlanGroupWithDetailsByRole` 사용
- 학생 ID 결정: `getStudentIdForPlanGroup` 사용

### 2. 관리자용 재조정 페이지 생성

**경로**: `/admin/camp-templates/[id]/participants/[groupId]/reschedule`

**파일 구조**:
```
app/(admin)/admin/camp-templates/[id]/participants/[groupId]/
  reschedule/
    page.tsx
    _components/
      AdminRescheduleWizard.tsx
      AdminPreviewStep.tsx
```

**구현 내용**:
- 학생용 `RescheduleWizard` 컴포넌트를 참고하여 관리자용 `AdminRescheduleWizard` 생성
- 관리자용 `AdminPreviewStep` 컴포넌트 생성 (관리자용 액션 사용)
- 학생용 `ContentSelectStep`, `AdjustmentStep` 재사용
- 권한 검증 및 에러 처리

**주요 차이점**:
- 관리자용 액션 사용 (`getReschedulePreviewForAdmin`, `rescheduleContentsForAdmin`)
- 완료 후 참여자 목록으로 리다이렉트
- 템플릿 ID와 플랜 그룹 ID 일치 확인

### 3. 참여자 상세 페이지에 재조정 버튼 추가

**파일**: 
- `app/(admin)/admin/camp-templates/[id]/participants/student/[studentId]/page.tsx` (수정)
- `app/(admin)/admin/camp-templates/[id]/participants/student/[studentId]/_components/CampParticipantDetailView.tsx` (수정)

**추가 기능**:
- 플랜 그룹 ID 조회 로직 추가
- 플랜 그룹이 있는 경우 "플랜 재조정" 버튼 표시
- 재조정 페이지로 이동하는 링크

**버튼 위치**:
- 참여자 상세 페이지 헤더의 버튼 영역
- "학생 상세" 버튼 옆에 배치

---

## 개선 효과

### 1. 관리자 권한 확장

- 관리자가 학생의 플랜 그룹을 직접 재조정할 수 있음
- 학생의 학습 일정을 관리자가 조정 가능

### 2. 코드 재사용성 향상

- 학생용 재조정 컴포넌트 재사용 (`ContentSelectStep`, `AdjustmentStep`)
- 공통 로직 활용으로 중복 코드 최소화

### 3. 일관된 사용자 경험

- 학생용과 관리자용이 동일한 UI/UX 제공
- 역할에 따라 적절한 권한 검증 및 리다이렉트

---

## 다음 단계 (Phase 3)

1. 학습 진행 현황 컴포넌트 개선
   - 일별 학습 현황 차트 추가
   - 과목별 상세 분석 섹션 추가
   - 학습 패턴 분석 그래프

2. 참여자 통계 조회 함수 개선
   - 일별 학습 데이터 조회 추가
   - 과목별 상세 통계 조회 추가
   - 학습 패턴 분석 데이터 조회 추가

---

## 참고 파일

- `app/(admin)/actions/plan-groups/reschedule.ts` - 관리자용 재조정 액션
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/reschedule/page.tsx` - 관리자용 재조정 페이지
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/reschedule/_components/AdminRescheduleWizard.tsx` - 관리자용 재조정 위저드
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/reschedule/_components/AdminPreviewStep.tsx` - 관리자용 미리보기 스텝
- `app/(admin)/admin/camp-templates/[id]/participants/student/[studentId]/_components/CampParticipantDetailView.tsx` - 참여자 상세 뷰 (재조정 버튼 추가)

