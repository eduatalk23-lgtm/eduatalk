# 관리자 플랜 생성 시나리오 및 캠프 모드 통합 분석

> 작성일: 2025-02-02
> 상태: 완료
> 목적: 관리자가 학생을 선택하여 플랜을 생성하는 기본 시나리오 정리 및 캠프 모드 통합 가능성 점검

---

## 🚧 개선 작업 진행 상태

> 최종 업데이트: 2026-01-06

### 완료된 Phase (1~7) ✅

| Phase | 작업 | 상태 | 변경 파일 |
|-------|------|------|----------|
| 1.1 | Step 4 체크박스 중복 확인 | ✅ 완료 | 중복 아님 (다른 조건부 렌더링) |
| 1.2 | AddAdHocModal 미구현 기능 제거 | ✅ 완료 | `AddAdHocModal.tsx` |
| 1.3 | DailyDock "+ 단발성" 버튼 비활성화 | ✅ 완료 | `DailyDock.tsx`, `AdminPlanManagement.tsx` |
| 2 | 7단계 위자드 자동저장 구현 | ✅ 완료 | `AdminPlanCreationWizard7Step.tsx` |
| 3 | 키보드 단축키 문서화 | ✅ 완료 | 본 문서 (아래 섹션) |
| 4 | Step 6 최종검토 UX 개선 | ✅ 완료 | `Step6FinalReview.tsx` |
| 5 | 모달 상태 useReducer 리팩토링 | ✅ 완료 | `AdminPlanManagement.tsx`, `types/modalState.ts` |
| 6 | AddContentModal 3단계 위자드 분리 | ✅ 완료 | `add-content-wizard/`, `AdminPlanManagement.tsx` |
| 7 | UI 일관성 개선 (모달 색상/아이콘 통일) | ✅ 완료 | `modals/ModalWrapper.tsx`, `AddAdHocModal.tsx` |

### 모든 Phase 완료! 🎉

관리자 플랜 생성 기능 개선 작업이 모두 완료되었습니다.

### Phase 7 상세: UI 일관성 개선

**생성된 공통 컴포넌트**:

- `modals/ModalWrapper.tsx` - 공통 모달 래퍼
- `modals/index.ts` - 모달 컴포넌트 export

**모달 테마 색상 체계**:

| 테마 | 색상 | 용도 |
|------|------|------|
| blue | 파랑 | 기본 액션 (콘텐츠 추가, 플랜 그룹) |
| amber | 주황 | 빠른 액션 (빠른 추가) |
| purple | 보라 | 특별 액션 (단발성, AI 관련) |
| green | 초록 | 성공/완료 관련 |
| red | 빨강 | 삭제/위험 액션 |

**ModalWrapper 사용법**:

```tsx
import { ModalWrapper, ModalButton } from './modals';

<ModalWrapper
  open={true}
  onClose={onClose}
  title="모달 제목"
  subtitle="부제목 (선택)"
  icon={<Icon className="h-5 w-5" />}
  theme="blue"
  size="md"
  loading={isPending}
  footer={
    <>
      <ModalButton variant="secondary" onClick={onClose}>취소</ModalButton>
      <ModalButton type="submit" theme="blue">확인</ModalButton>
    </>
  }
>
  {/* 모달 내용 */}
</ModalWrapper>
```

### 관련 계획 파일

- 전체 계획: `~/.claude/plans/lazy-launching-neumann.md`

---

## 📋 목차

0. [개선 작업 진행 상태](#-개선-작업-진행-상태)
1. [개요](#개요)
2. [기본 시나리오](#기본-시나리오)
3. [시각화 (플로우차트)](#시각화-플로우차트)
4. [UI 컴포넌트 분석](#ui-컴포넌트-분석)
5. [관련 코드 분석](#관련-코드-분석)
6. [캠프 모드 통합 가능성](#캠프-모드-통합-가능성)
7. [통합 방안 제안](#통합-방안-제안)
8. [키보드 단축키](#키보드-단축키)
9. [참고 자료](#참고-자료)

---

## 개요

### 관리자 플랜 생성 기능 개요

관리자는 학생 목록에서 특정 학생을 선택한 후, 해당 학생의 플랜 관리 페이지에서 다양한 방식으로 플랜을 생성할 수 있습니다.

### 플랜 생성 방법

관리자가 사용할 수 있는 플랜 생성 방법은 다음과 같습니다:

1. **플랜 그룹 생성 (7단계 위자드)** - 가장 상세한 설정 (항상 사용 가능)
2. **AI 플랜 생성** - AI 기반 자동 생성 (활성 플랜 그룹이 있을 때만 표시)
3. **빠른 플랜 추가** - 간단한 플랜 추가 (항상 사용 가능)
4. **콘텐츠 추가** - 특정 콘텐츠로 플랜 추가 (Daily Dock에서 사용 가능)
5. **일회성 플랜 추가** - 단발성 플랜 추가 (활성 플랜 그룹이 있을 때만 사용 가능)

### 버튼 표시 조건

**헤더 영역 버튼들** (`/admin/students/[id]/plans`):

- ✅ **빠른 추가**: 항상 표시
- ✅ **플랜 그룹**: 항상 표시
- ⚠️ **AI 생성**: `activePlanGroupId`가 있을 때만 표시 (활성 플랜 그룹 필요)
- ✅ **AI 분석**: 항상 표시

**Daily Dock 버튼들**:

- ✅ **+ 플랜 추가**: 항상 표시 (콘텐츠 추가 모달 열기)
- ⚠️ **+ 단발성**: 버튼은 항상 표시되지만, `activePlanGroupId`가 없으면 모달이 열리지 않음 (활성 플랜 그룹 필요)

**Weekly Dock**:

- 플랜 추가 버튼 없음 (재분배 기능만 제공)

### 버튼이 보이지 않는 경우

#### 문제 1: "AI 생성" 버튼이 보이지 않음

**원인**:

- 활성 플랜 그룹(`activePlanGroupId`)이 없음
- 플랜 그룹이 생성되었지만 활성화되지 않음

**해결 방법**:

1. "플랜 그룹" 버튼을 클릭하여 플랜 그룹 생성
2. 플랜 그룹을 활성화 (`status: 'active'`)
3. 활성화 후 페이지 새로고침

#### 문제 2: "+ 단발성" 버튼을 클릭해도 모달이 열리지 않음

**원인**:

- 활성 플랜 그룹(`activePlanGroupId`)이 없음
- `AddAdHocModal`은 `planGroupId`가 필수이므로 활성 플랜 그룹이 필요

**해결 방법**:

1. "플랜 그룹" 버튼을 클릭하여 플랜 그룹 생성
2. 플랜 그룹을 활성화
3. 활성화 후 "+ 단발성" 버튼 클릭

#### 문제 3: 모든 버튼이 보이지 않음

**원인**:

- 권한 문제 (관리자 권한이 아님)
- 페이지 로딩 오류
- CSS 스타일 문제

**해결 방법**:

1. 브라우저 개발자 도구로 콘솔 에러 확인
2. 페이지 새로고침
3. 관리자 권한 확인

---

## 기본 시나리오

### 시나리오 1: 플랜 그룹 생성 (7단계 위자드)

#### 1단계: 학생 선택

**경로**: `/admin/students`

**프로세스**:

1. 관리자가 학생 목록 페이지에 접근
2. 학생 목록에서 특정 학생을 선택 (테이블에서 클릭)
3. 해당 학생의 플랜 관리 페이지로 이동: `/admin/students/[id]/plans`

**관련 컴포넌트**:

- `app/(admin)/admin/students/page.tsx` - 학생 목록 페이지
- `app/(admin)/admin/students/_components/StudentListClient.tsx` - 학생 목록 클라이언트
- `app/(admin)/admin/students/_components/StudentTable.tsx` - 학생 테이블

#### 2단계: 플랜 그룹 생성 버튼 클릭

**경로**: `/admin/students/[id]/plans`

**프로세스**:

1. 플랜 관리 페이지에서 "플랜 그룹" 버튼 클릭 (또는 키보드 단축키 `g`)
2. 7단계 플랜 생성 위자드 모달이 열림

**버튼 위치**:

- 헤더 영역 우측 상단
- 항상 표시됨 (조건 없음)

**관련 컴포넌트**:

- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` - 플랜 관리 메인 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx` - 7단계 위자드

### 시나리오 2: 빠른 플랜 추가

**경로**: `/admin/students/[id]/plans`

**프로세스**:

1. 플랜 관리 페이지에서 "빠른 추가" 버튼 클릭 (또는 키보드 단축키 `q`)
2. 빠른 플랜 추가 모달이 열림
3. 콘텐츠 선택 및 간단한 설정 후 플랜 생성

**버튼 위치**:

- 헤더 영역 우측 상단 (플랜 그룹 버튼 왼쪽)
- 항상 표시됨 (조건 없음)

**관련 컴포넌트**:

- `app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx` - 빠른 플랜 추가 모달

### 시나리오 3: AI 플랜 생성

**경로**: `/admin/students/[id]/plans`

**프로세스**:

1. 활성 플랜 그룹이 있는 경우에만 "AI 생성" 버튼이 표시됨
2. "AI 생성" 버튼 클릭 (또는 키보드 단축키 `i`)
3. AI 플랜 생성 모달이 열림
4. AI 설정 후 플랜 생성

**버튼 표시 조건**:

- ⚠️ **활성 플랜 그룹(`activePlanGroupId`)이 있어야 함**
- 활성 플랜 그룹이 없으면 버튼이 표시되지 않음

**관련 컴포넌트**:

- `app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx` - AI 플랜 생성 모달

### 시나리오 4: 콘텐츠 추가 (Daily Dock)

**경로**: `/admin/students/[id]/plans`

**프로세스**:

1. Daily Dock 영역에서 "+ 플랜 추가" 버튼 클릭
2. 콘텐츠 추가 모달이 열림
3. 콘텐츠 선택 및 날짜 설정 후 플랜 생성

**버튼 위치**:

- Daily Dock 헤더 우측
- 항상 표시됨 (조건 없음)

**관련 컴포넌트**:

- `app/(admin)/admin/students/[id]/plans/_components/DailyDock.tsx` - Daily Dock 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/AddContentModal.tsx` - 콘텐츠 추가 모달

### 시나리오 5: 일회성 플랜 추가 (Daily Dock)

**경로**: `/admin/students/[id]/plans`

**프로세스**:

1. Daily Dock 영역에서 "+ 단발성" 버튼 클릭
2. 일회성 플랜 추가 모달이 열림
3. 플랜 정보 입력 후 생성

**버튼 표시 조건**:

- ⚠️ **활성 플랜 그룹(`activePlanGroupId`)이 있어야 함**
- 활성 플랜 그룹이 없으면 버튼이 표시되지 않음

**관련 컴포넌트**:

- `app/(admin)/admin/students/[id]/plans/_components/DailyDock.tsx` - Daily Dock 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx` - 일회성 플랜 추가 모달

#### 3단계: 7단계 위자드 진행

**Step 1: 기본 정보**

- 플랜 이름
- 기간 (시작일, 종료일)
- 플랜 목적 (내신대비, 모의고사, 수능)

**Step 2: 시간 설정**

- 학원 스케줄 설정
- 제외 일정 설정

**Step 3: 스케줄 미리보기**

- 생성될 스케줄 미리 확인

**Step 4: 콘텐츠 선택**

- 학습할 콘텐츠 선택
- 콘텐츠 범위 설정

**Step 5: 배분 설정**

- 콘텐츠 배분 방식 설정

**Step 6: 최종 검토**

- 모든 설정 사항 검토

**Step 7: 생성 및 결과**

- 플랜 그룹 생성 실행
- 생성 결과 확인

#### 4단계: 플랜 그룹 생성 완료

**결과**:

- 플랜 그룹이 생성되고 `draft` 상태로 저장됨
- 생성된 플랜 그룹 ID 반환
- 선택적으로 AI 플랜 생성 모달 자동 열림

**관련 액션**:

- `lib/domains/plan/actions/plan-groups/create.ts` - `createPlanGroupAction`
- `lib/data/planGroups.ts` - `createPlanGroup`

---

## 시각화 (플로우차트)

### 전체 플로우

```
┌─────────────────────────────────────────────────────────────┐
│                    관리자 플랜 생성 플로우                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  학생 목록 페이지 │
                    │ /admin/students │
                    └─────────────────┘
                              │
                              │ [학생 선택]
                              ▼
                    ┌─────────────────┐
                    │  플랜 관리 페이지 │
                    │/admin/students/  │
                    │   [id]/plans    │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ 플랜 그룹 생성 │    │  AI 플랜 생성  │    │ 빠른 플랜 추가 │
│  (7단계 위자드)│    │                │    │                │
└───────────────┘    └───────────────┘    └───────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 1: 기본 정보                                 │
│  - 플랜 이름                                                  │
│  - 기간 (시작일, 종료일)                                      │
│  - 플랜 목적                                                  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 2: 시간 설정                                 │
│  - 학원 스케줄 설정                                            │
│  - 제외 일정 설정                                             │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 3: 스케줄 미리보기                           │
│  - 생성될 스케줄 미리 확인                                     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 4: 콘텐츠 선택                               │
│  - 학습할 콘텐츠 선택                                          │
│  - 콘텐츠 범위 설정                                            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 5: 배분 설정                                 │
│  - 콘텐츠 배분 방식 설정                                       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 6: 최종 검토                                 │
│  - 모든 설정 사항 검토                                         │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 7: 생성 및 결과                              │
│  - 플랜 그룹 생성 실행                                         │
│  - 생성 결과 확인                                             │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              플랜 그룹 생성 완료                               │
│  - draft 상태로 저장                                           │
│  - 플랜 그룹 ID 반환                                           │
│  - (선택) AI 플랜 생성 모달 자동 열림                          │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    데이터 흐름도                               │
└─────────────────────────────────────────────────────────────┘

[AdminPlanManagement]
        │
        │ studentId, tenantId, studentName 전달
        ▼
[AdminPlanCreationWizard7Step]
        │
        │ 위자드 데이터 수집
        ▼
[AdminWizardProvider (Context)]
        │
        │ PlanGroupCreationData 변환
        ▼
[createPlanGroupAction]
        │
        │ options: { studentId, skipContentValidation }
        ▼
[_createPlanGroup]
        │
        │ studentId 사용 (관리자 모드)
        ▼
[createPlanGroup (lib/data/planGroups)]
        │
        │ DB에 플랜 그룹 저장
        ▼
[plan_groups 테이블]
        │
        │ groupId 반환
        ▼
[AdminPlanManagement]
        │
        │ onSuccess(groupId, generateAI)
        ▼
[플랜 관리 페이지 새로고침]
```

---

## UI 컴포넌트 분석

### 관리자 플랜 생성 위자드 UI 구조

관리자 플랜 생성 위자드는 7단계로 구성되어 있으며, 각 Step은 독립적인 컴포넌트로 구현되어 있습니다.

#### 위자드 메인 컴포넌트

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

**주요 특징**:

- 모달 형태의 전체 화면 위자드
- 상단에 7단계 진행 인디케이터 표시
- 각 Step별 제목과 설명 표시
- 이전/다음 버튼으로 단계 이동
- ESC 키로 위자드 닫기
- 자동 저장 상태 표시

**UI 레이아웃**:

```
┌─────────────────────────────────────────────────────────┐
│  [X] 플랜 그룹 생성                    [자동저장 상태]    │
│  학생명: {studentName}                                    │
├─────────────────────────────────────────────────────────┤
│  [1]─[2]─[3]─[4]─[5]─[6]─[7]  (진행 인디케이터)        │
│  Step 제목: {STEP_TITLES[currentStep]}                  │
│  설명: {STEP_DESCRIPTIONS[currentStep]}                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Step 컴포넌트 내용]                                    │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  [이전]                                    [다음]        │
└─────────────────────────────────────────────────────────┘
```

#### Step 1: 기본 정보

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step1BasicInfo.tsx`

**UI 구성**:

1. **학습 기간 설정**
   - 시작일/종료일 날짜 입력 필드
   - 기간 자동 계산 및 표시 (예: "30일간의 학습 계획")
   - 최대 365일 제한 검증
   - 실시간 유효성 검사 및 에러 메시지 표시

2. **플랜 이름**
   - 텍스트 입력 필드 (선택사항)
   - 최대 100자 제한
   - 플레이스홀더: "예: 겨울방학 학습 계획"

3. **학습 목적**
   - 5개 버튼 그리드 레이아웃
   - 옵션: 없음, 내신대비, 모의고사, 수능, 기타
   - 선택된 옵션은 파란색 배경으로 강조

4. **학습 시간표 (블록셋)**
   - 드롭다운 선택 UI
   - 학생의 블록셋 목록 표시
   - 블록셋 미리보기 (최대 5개 블록 표시)
   - "새 시간표 만들기" 링크 (TODO)

**UI 특징**:

- 아이콘과 함께 레이블 표시 (Calendar, FileText, Target, Clock)
- 필수 항목은 빨간색 별표(\*) 표시
- 실시간 검증 피드백
- 선택된 블록셋의 블록 정보 미리보기

#### Step 2: 시간 설정

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step2TimeSettings.tsx`

**UI 구성**:

1. **스케줄러 타입 선택**
   - 라디오 버튼 형태
   - 옵션: "1730 시간표", "맞춤 설정"
   - 각 옵션에 설명 텍스트 포함

2. **학원 스케줄 관리**
   - 추가된 학원 스케줄 목록 표시
   - "학원 스케줄 추가" 버튼
   - 각 스케줄: 요일, 시간, 학원명, 과목
   - 삭제 버튼으로 개별 제거 가능

3. **제외 일정 관리**
   - 추가된 제외일 목록 표시
   - "제외일 추가" 버튼
   - 각 제외일: 날짜, 유형(휴일/행사/개인), 사유
   - 삭제 버튼으로 개별 제거 가능

**UI 특징**:

- 폼 형태의 추가 UI (드롭다운/입력 필드)
- 추가/취소 버튼으로 폼 토글
- 빈 상태일 때 안내 메시지 표시

#### Step 3: 스케줄 미리보기

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step3SchedulePreview.tsx`

**UI 구성**:

1. **뷰 모드 전환**
   - 주간 뷰 / 일간 뷰 토글 버튼

2. **주간 뷰**
   - 캘린더 형태의 주 단위 표시
   - 각 날짜에 제외일/학원 스케줄 표시
   - 이전/다음 주 이동 버튼

3. **일간 뷰**
   - 선택한 날짜의 상세 정보 표시
   - 시간대별 스케줄 표시

4. **설정 수정 링크**
   - "시간 설정 수정" 버튼으로 Step 2로 이동

**UI 특징**:

- 시각적인 캘린더 UI
- 제외일은 빨간색, 학원 스케줄은 파란색으로 구분
- 정보 아이콘으로 도움말 표시

#### Step 4: 콘텐츠 선택

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step4ContentSelection.tsx`

**UI 구성**:

1. **선택 현황 표시**
   - 선택된 콘텐츠 수 표시 (예: "선택: 3/9개")
   - 전략 과목/취약 과목 통계 표시
   - "콘텐츠 선택 건너뛰기" 체크박스

2. **콘텐츠 목록**
   - 각 콘텐츠 카드 형태로 표시
   - 체크박스로 선택/해제
   - 선택된 콘텐츠는 파란색 배경으로 강조
   - 최대 9개 선택 제한

3. **콘텐츠 정보**
   - 아이콘: 교재(BookOpen) / 강의(Video)
   - 제목, 타입, 과목, 범위 정보 표시
   - 확장 버튼으로 상세 설정 표시

4. **상세 설정 (확장 시)**
   - 범위 설정: 시작/종료 숫자 입력
   - 과목 분류: 미분류/전략/취약 선택 버튼
   - 전략 과목은 주황색, 취약 과목은 파란색 배지

5. **빈 상태 처리**
   - 콘텐츠가 없을 때 안내 메시지
   - "콘텐츠 선택 건너뛰기" 옵션 제공

**UI 특징**:

- 최대 선택 개수 제한 시도 시 경고 메시지
- 선택된 콘텐츠의 통계 실시간 업데이트
- 확장/축소 애니메이션
- 안내 메시지 카드 (파란색 배경)

#### Step 5: 배분 설정

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step5AllocationSettings.tsx`

**UI 구성**:

1. **학생 레벨 선택**
   - 3개 옵션: 상위권, 중위권, 하위권
   - 각 옵션에 설명 포함
   - 카드 형태의 선택 UI

2. **취약 과목 집중도**
   - 3개 레벨: 낮음, 보통, 높음
   - 각 레벨별 추가 배분 비율 표시
   - 취약 과목이 있을 때만 표시

3. **주간 학습일/복습 주기**
   - 숫자 입력 필드
   - 기본값: 학습일 5일, 복습 2일

4. **콘텐츠 통계**
   - 전체 콘텐츠 수
   - 전략/취약 과목 수
   - 과목별 통계 표시

**UI 특징**:

- 콘텐츠가 없을 때 경고 메시지
- 정보 아이콘으로 각 설정 설명
- 통계 정보를 시각적으로 표시

#### Step 6: 최종 검토

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step6FinalReview.tsx`

**UI 구성**:

1. **학생 정보 카드**
   - 파란색 배경의 안내 카드
   - "{학생명} 학생을 위한 플랜을 생성합니다" 메시지

2. **요약 카드들**
   - 기본 정보: 기간, 이름, 목적, 시간표
   - 시간 설정: 스케줄러 타입, 학원 스케줄 수, 제외일 수
   - 콘텐츠: 통계 (전체/교재/전략/취약), 선택된 콘텐츠 목록
   - 배분 설정: 학생 레벨, 취약 과목 집중도, 학습일/복습 주기
   - 각 카드에 "수정" 버튼으로 해당 Step으로 이동

3. **AI 플랜 생성 옵션**
   - 체크박스로 AI 생성 활성화/비활성화
   - AI 모드 선택 (하이브리드/AI 전용)
   - 각 옵션에 설명 텍스트

4. **검증 오류/경고**
   - 빨간색 배경의 오류 메시지
   - 노란색 배경의 경고 메시지

**UI 특징**:

- 모든 설정을 한눈에 확인 가능
- 각 섹션별 수정 버튼으로 빠른 수정
- AI 생성 옵션을 명확하게 표시
- 통계 정보를 시각적으로 표현

#### Step 7: 생성 및 결과

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step7GenerateResult.tsx`

**UI 구성**:

1. **생성 전 상태 (idle)**
   - 준비 완료 안내 메시지
   - 선택된 콘텐츠 수, AI 생성 여부 요약
   - "플랜 생성 시작" 버튼

2. **진행 중 상태**
   - 로딩 스피너
   - 진행 단계 메시지 (검증 중/그룹 생성 중/AI 생성 중)
   - 프로그레스 바 (0-100%)
   - 진행률 퍼센트 표시

3. **완료 상태**
   - 성공 아이콘 (CheckCircle2)
   - 성공 메시지
   - "닫기" / "플랜 확인하기" 버튼

4. **오류 상태**
   - 오류 아이콘 (XCircle)
   - 오류 메시지
   - "이전 단계로" / "다시 시도" 버튼

**UI 특징**:

- 단계별 진행 상태를 명확하게 표시
- 프로그레스 바로 진행률 시각화
- 오류 발생 시 재시도 옵션 제공
- 완료 후 다음 액션 안내

### UI/UX 특징 요약

#### 공통 UI 패턴

1. **아이콘 사용**
   - 각 섹션마다 관련 아이콘 표시 (Lucide React)
   - 시각적 구분 및 가독성 향상

2. **색상 시스템**
   - 파란색: 주요 액션, 선택된 항목
   - 빨간색: 오류, 필수 항목 표시
   - 노란색: 경고 메시지
   - 초록색: 성공 상태
   - 주황색: 전략 과목
   - 회색: 비활성, 보조 정보

3. **반응형 디자인**
   - 모바일/데스크톱 대응
   - 그리드 레이아웃 활용

4. **접근성**
   - 명확한 레이블
   - 키보드 네비게이션 지원
   - 에러 메시지 명확히 표시

5. **사용자 피드백**
   - 실시간 검증
   - 로딩 상태 표시
   - 성공/실패 피드백

#### 관리자 전용 UI 특징

1. **학생 정보 표시**
   - 각 Step에서 학생 이름 표시
   - 학생별 맞춤 설정 가능

2. **간소화된 UI**
   - 학생 영역보다 단순한 UI
   - 필수 기능에 집중

3. **일괄 작업 지원**
   - 여러 학생에게 동일한 설정 적용 가능 (향후 확장)

---

## 관련 코드 분석

### 1. 학생 선택 및 플랜 관리 페이지 접근

**파일**: `app/(admin)/admin/students/page.tsx`

```typescript
// 학생 목록 조회 및 표시
// 학생 클릭 시 /admin/students/[id]/plans로 이동
```

**파일**: `app/(admin)/admin/students/[id]/plans/page.tsx`

```12:72:app/(admin)/admin/students/[id]/plans/page.tsx
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}

async function getStudentInfo(studentId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('students')
    .select('id, name, tenant_id')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export default async function StudentPlansPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { date } = await searchParams;

  const student = await getStudentInfo(id);

  if (!student) {
    notFound();
  }

  const targetDate = date ?? new Date().toISOString().split('T')[0];

  // 활성 플랜 그룹 조회
  const activePlanGroups = await getPlanGroupsForStudent({
    studentId: id,
    status: 'active',
  });
  const activePlanGroupId = activePlanGroups[0]?.id ?? null;

  // ⚠️ 중요: activePlanGroupId가 null이면 다음 버튼들이 표시되지 않음:
  // - 헤더 영역의 "AI 생성" 버튼
  // - Daily Dock의 "+ 단발성" 버튼 (기능 사용 불가)

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          플랜 관리: {student.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          학생의 학습 플랜을 관리하고 재분배할 수 있습니다
        </p>
      </div>

      {/* 플랜 관리 컴포넌트 */}
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={student.id}
          studentName={student.name}
          tenantId={student.tenant_id}
          initialDate={targetDate}
          activePlanGroupId={activePlanGroupId}
        />
      </Suspense>
    </div>
  );
}
```

### 2. 플랜 그룹 생성 위자드

**파일**: `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx`

```380:387:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
            <button
              onClick={() => setShowCreateWizard(true)}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
              title="플랜 그룹 생성 (g)"
            >
              <Plus className="h-4 w-4" />
              플랜 그룹
            </button>
```

```584:601:app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx
        {/* 플랜 그룹 생성 위자드 (7단계) */}
        {showCreateWizard && (
          <AdminPlanCreationWizard7Step
            studentId={studentId}
            tenantId={tenantId}
            studentName={studentName}
            onClose={() => setShowCreateWizard(false)}
            onSuccess={(groupId, generateAI) => {
              setShowCreateWizard(false);
              handleRefresh();
              // AI 생성 옵션이 선택된 경우, 새로 생성된 그룹으로 AI 모달 열기
              if (generateAI) {
                setNewGroupIdForAI(groupId);
                setShowAIPlanModal(true);
              }
            }}
          />
        )}
```

**파일**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx`

```192:283:app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx
  const handleSubmit = useCallback(async () => {
    if (hasErrors) {
      setError("입력 값에 오류가 있습니다. 이전 단계를 확인해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const {
        name,
        planPurpose,
        periodStart,
        periodEnd,
        selectedContents,
        skipContents,
        exclusions,
        academySchedules,
        schedulerType,
        blockSetId,
        schedulerOptions,
      } = wizardData;

      // PlanGroupCreationData 구성
      const planGroupData: PlanGroupCreationData = {
        name: name || null,
        plan_purpose: (planPurpose as "내신대비" | "모의고사" | "수능" | "") || "내신대비",
        scheduler_type: schedulerType === "custom" ? "1730_timetable" : (schedulerType || "1730_timetable"),
        period_start: periodStart,
        period_end: periodEnd,
        block_set_id: blockSetId || null,
        scheduler_options: schedulerOptions || undefined,
        contents: skipContents
          ? []
          : selectedContents.map((c, index) => ({
              content_type: c.contentType as "book" | "lecture",
              content_id: c.contentId,
              master_content_id: null,
              start_range: c.startRange,
              end_range: c.endRange,
              start_detail_id: null,
              end_detail_id: null,
              display_order: index,
            })),
        exclusions: exclusions.map((e) => ({
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type === "holiday" ? "휴일지정"
            : e.exclusion_type === "personal" ? "개인사정"
            : "기타" as const,
          reason: e.reason || undefined,
        })),
        academy_schedules: academySchedules.map((s) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name || undefined,
          subject: s.subject || undefined,
        })),
      };

      const result = await createPlanGroupAction(planGroupData, {
        skipContentValidation: true,
        studentId: studentId,
      });

      // 에러 확인
      if ("success" in result && result.success === false) {
        setError(result.error?.message || "플랜 그룹 생성에 실패했습니다.");
        setSubmitting(false);
        return;
      }

      // 성공 시
      const groupId = (result as { groupId: string }).groupId;
      setCreatedGroupId(groupId);
      setSubmitting(false);
      onSuccess(groupId, wizardData.generateAIPlan);
    } catch (err) {
      console.error("[AdminWizard] 생성 실패:", err);
      setError("플랜 그룹 생성 중 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }, [
    hasErrors,
    wizardData,
    studentId,
    setSubmitting,
    setError,
    setCreatedGroupId,
    onSuccess,
  ]);
```

### 3. 플랜 그룹 생성 액션

**파일**: `lib/domains/plan/actions/plan-groups/create.ts`

```179:185:lib/domains/plan/actions/plan-groups/create.ts
async function _createPlanGroup(
  data: PlanGroupCreationData,
  options?: {
    skipContentValidation?: boolean; // 캠프 모드에서 Step 3 제출 시 콘텐츠 검증 건너뛰기
    studentId?: string | null; // 관리자 모드에서 직접 지정하는 student_id
  }
): Promise<{ groupId: string }> {
```

**핵심 로직**:

- `options.studentId`가 제공되면 관리자 모드로 인식
- 관리자 모드에서는 해당 `studentId`를 사용하여 플랜 그룹 생성
- 일반 모드(학생 모드)에서는 현재 로그인한 사용자의 ID 사용

---

## 캠프 모드 통합 가능성

### 현재 캠프 모드 구현

#### 1. 캠프 모드 식별

캠프 모드는 다음 필드로 식별됩니다:

- `plan_type`: `"camp"`로 설정
- `camp_template_id`: 캠프 템플릿 ID
- `camp_invitation_id`: 캠프 초대 ID (학생별 고유)

**파일**: `lib/data/planGroups.ts`

```409:412:lib/data/planGroups.ts
    // 캠프 관련 필드
    plan_type?: string | null;
    camp_template_id?: string | null;
    camp_invitation_id?: string | null;
```

#### 2. 캠프 모드 플랜 그룹 생성 로직

**파일**: `lib/domains/plan/actions/plan-groups/create.ts`

```293:319:lib/domains/plan/actions/plan-groups/create.ts
  // 캠프 모드인 경우 camp_invitation_id로 먼저 확인
  const supabase = await createSupabaseServerClient();

  // 캠프 모드인 경우 camp_invitation_id로 기존 플랜 그룹 확인
  if (data.camp_invitation_id) {
    const { data: existingCampGroup, error: campGroupError } = await supabase
      .from("plan_groups")
      .select("id, status")
      .eq("camp_invitation_id", data.camp_invitation_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (campGroupError && campGroupError.code !== "PGRST116") {
      logActionDebug(
        { domain: "plan", action: "createPlanGroup", userId: studentId },
        "캠프 플랜 그룹 확인 중 에러 (무시하고 계속 진행)",
        { error: campGroupError }
      );
    } else if (existingCampGroup) {
      // 기존 캠프 플랜 그룹이 있으면 업데이트
      await updatePlanGroupDraftAction(existingCampGroup.id, data);
      revalidatePath("/plan");
      return { groupId: existingCampGroup.id };
    }
  }
```

#### 3. 학생 영역 캠프 모드 플랜 생성

**파일**: `app/(student)/plan/new-group/_components/hooks/usePlanGenerator.ts`

```115:121:app/(student)/plan/new-group/_components/hooks/usePlanGenerator.ts
    // Camp Mode Overrides
    if (isCampMode) {
      creationData.block_set_id = null;
      if (campInvitationId) creationData.camp_invitation_id = campInvitationId;
      if (initialData?.templateId) creationData.camp_template_id = initialData.templateId;
      creationData.plan_type = "camp";
    }
```

### 관리자 영역에서의 캠프 모드 통합 가능성

#### ✅ 통합 가능한 부분

1. **플랜 그룹 생성 시 캠프 모드 지원**
   - `AdminPlanCreationWizard7Step`에서 캠프 모드 옵션 추가 가능
   - `camp_template_id`와 `camp_invitation_id`를 위자드 데이터에 포함 가능

2. **학생 선택 후 캠프 템플릿 적용**
   - 관리자가 학생을 선택한 후, 특정 캠프 템플릿을 적용하여 플랜 생성 가능
   - 캠프 초대(`camp_invitation`)를 통해 학생과 캠프 템플릿 연결

3. **기존 캠프 플랜 그룹 업데이트**
   - `camp_invitation_id`로 기존 플랜 그룹을 찾아 업데이트하는 로직이 이미 구현됨

#### ⚠️ 주의사항

1. **캠프 초대 필요**
   - 캠프 모드로 플랜을 생성하려면 `camp_invitation_id`가 필요
   - 관리자가 직접 캠프 초대를 생성하거나, 기존 초대를 사용해야 함

2. **템플릿 데이터 필요**
   - 캠프 템플릿(`camp_template_id`)이 존재해야 함
   - 템플릿에서 기본 설정을 가져와야 함

3. **학생별 고유성**
   - `camp_invitation_id`는 학생별로 고유해야 함
   - 동일한 학생에게 동일한 캠프 템플릿으로 여러 플랜 그룹 생성 시 충돌 가능

---

## 통합 방안 제안

### 방안 1: 관리자 위자드에 캠프 모드 옵션 추가

**구현 방법**:

1. `AdminPlanCreationWizard7Step`에 캠프 모드 토글 추가
2. 캠프 모드 선택 시 캠프 템플릿 선택 UI 표시
3. 선택된 템플릿의 기본 설정을 위자드에 자동 채움
4. 플랜 그룹 생성 시 `camp_template_id`와 `camp_invitation_id` 포함

**장점**:

- 기존 위자드 구조 재사용 가능
- 관리자가 캠프 모드와 일반 모드를 동일한 인터페이스에서 사용 가능

**단점**:

- 위자드가 복잡해질 수 있음
- 캠프 초대 생성 로직 추가 필요

### 방안 2: 별도의 캠프 플랜 생성 모달

**구현 방법**:

1. `AdminPlanManagement`에 "캠프 플랜 생성" 버튼 추가
2. 캠프 템플릿 선택 모달 생성
3. 선택된 템플릿과 학생 정보로 플랜 그룹 생성

**장점**:

- 캠프 모드 전용 UI로 명확함
- 기존 위자드와 분리되어 유지보수 용이

**단점**:

- 별도 컴포넌트 개발 필요
- 코드 중복 가능성

### 방안 3: 학생 목록에서 일괄 캠프 플랜 생성

**구현 방법**:

1. 학생 목록에서 여러 학생 선택
2. "캠프 플랜 일괄 생성" 버튼 클릭
3. 캠프 템플릿 선택 후 선택된 학생들에게 일괄 생성

**장점**:

- 여러 학생에게 동시에 캠프 플랜 생성 가능
- 효율적인 작업 흐름

**단점**:

- 일괄 생성 로직 복잡도 증가
- 에러 처리 및 롤백 로직 필요

### 추천 방안

**방안 1 + 방안 3 조합**을 추천합니다:

1. **개별 생성**: `AdminPlanCreationWizard7Step`에 캠프 모드 옵션 추가
2. **일괄 생성**: 학생 목록에서 일괄 캠프 플랜 생성 기능 추가

이렇게 하면:

- 개별 학생에 대한 세밀한 제어 가능
- 여러 학생에 대한 효율적인 작업 가능
- 기존 코드 구조 최대한 재사용

---

## 구현 체크리스트

### Phase 1: 기본 통합

- [ ] `AdminPlanCreationWizard7Step`에 캠프 모드 토글 추가
- [ ] 캠프 템플릿 선택 UI 추가
- [ ] 선택된 템플릿의 기본 설정 로드 로직 구현
- [ ] 플랜 그룹 생성 시 캠프 필드 포함 로직 추가

### Phase 2: 캠프 초대 처리

- [ ] 캠프 초대 생성/조회 로직 구현
- [ ] 기존 캠프 초대 재사용 로직 구현
- [ ] 캠프 초대 없이 플랜 생성 시 자동 생성 로직 구현

### Phase 3: 일괄 생성

- [ ] 학생 목록에서 일괄 선택 기능 확인
- [ ] 일괄 캠프 플랜 생성 모달 구현
- [ ] 일괄 생성 진행 상황 표시 UI 구현
- [ ] 에러 처리 및 부분 성공 처리 로직 구현

---

## 키보드 단축키

관리자 플랜 관리 페이지(`/admin/students/[id]/plans`)에서 사용할 수 있는 키보드 단축키입니다.

> **주의**: 입력 필드(input, textarea, select)에 포커스가 있을 때는 단축키가 비활성화됩니다.

### 탐색

| 단축키 | 설명 |
|--------|------|
| `←` (ArrowLeft) | 이전 날짜로 이동 |
| `→` (ArrowRight) | 다음 날짜로 이동 |
| `T` | 오늘로 이동 |

### 작업

| 단축키 | 설명 |
|--------|------|
| `R` | 새로고침 |

### 모달

| 단축키 | 설명 | 조건 |
|--------|------|------|
| `N` | 플랜 추가 (콘텐츠 추가 모달) | - |
| `A` | 단발성 추가 | - |
| `Q` | 빠른 플랜 추가 | - |
| `G` | 플랜 그룹 생성 (7단계 위자드) | - |
| `I` | AI 플랜 생성 | 활성 플랜 그룹 필요 |
| `O` | AI 플랜 최적화 | - |
| `Shift + ?` | 단축키 도움말 | - |
| `Esc` | 모든 모달 닫기 | - |

### 위저드 내부 단축키

7단계 플랜 그룹 생성 위저드 내에서 사용할 수 있는 단축키입니다.

| 단축키 | 설명 |
|--------|------|
| `Esc` | 위저드 닫기 |

### 인라인 편집 단축키

날짜 편집, 범위 편집 등 인라인 에디터에서 사용할 수 있는 단축키입니다.

| 단축키 | 설명 |
|--------|------|
| `Enter` | 변경사항 저장 |
| `Esc` | 편집 취소 |

### 관련 코드

- `app/(admin)/admin/students/[id]/plans/_components/useKeyboardShortcuts.ts` - 키보드 단축키 훅
- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` - 단축키 설정 (라인 264-359)

---

## 참고 자료

### 관련 문서

- [학생/관리자 영역 플랜 생성 기능 통합 분석](./2025-02-02-plan-creation-features-comprehensive-analysis.md)
- [관리자 플랜 배정 플로우](./admin-plan-assignment-flow.md)
- [캠프 모드 플랜 생성 권한 수정](./camp-mode-plan-generation-permission-fix-2025-11-27.md)

### 관련 코드

- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` - 플랜 관리 메인 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/AdminPlanCreationWizard7Step.tsx` - 7단계 위자드
- `lib/domains/plan/actions/plan-groups/create.ts` - 플랜 그룹 생성 액션
- `lib/data/planGroups.ts` - 플랜 그룹 데이터 레이어
- `lib/domains/camp/actions/progress/bulk.ts` - 캠프 일괄 플랜 생성

### 데이터베이스 스키마

- `plan_groups` 테이블:
  - `plan_type`: 플랜 유형 (`"camp"` | `null`)
  - `camp_template_id`: 캠프 템플릿 ID
  - `camp_invitation_id`: 캠프 초대 ID

---

**마지막 업데이트**: 2025-02-02
