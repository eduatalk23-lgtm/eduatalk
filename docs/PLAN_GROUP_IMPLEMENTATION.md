# 플랜 그룹 시스템 구현 문서

## 📋 개요

학습 플랜을 그룹 단위로 관리하는 시스템입니다. 플랜 그룹은 메타데이터(목적, 기간, 스케줄러 유형 등)를 포함하며, 개별 플랜 항목들은 플랜 그룹에 연결됩니다.

## 🏗 아키텍처

### 데이터베이스 구조

#### 핵심 테이블
- **`plan_groups`**: 플랜 그룹 메타데이터
  - `id`, `tenant_id`, `student_id`
  - `name`, `plan_purpose`, `scheduler_type`
  - `period_start`, `period_end`, `target_date`
  - `block_set_id`, `status`
  - `deleted_at` (soft delete)

- **`student_plan`**: 개별 플랜 항목 (기존 구조 유지)
  - `plan_group_id` 추가 (플랜 그룹 참조)
  - 기존 필드: `plan_date`, `block_index`, `content_type`, `content_id` 등

#### 관련 테이블
- **`plan_contents`**: 플랜 그룹-콘텐츠 관계
- **`plan_exclusions`**: 학습 제외일
- **`academy_schedules`**: 학원 일정
- **`content_masters`**: 서비스 제공 교재/강의 마스터 데이터
- **`content_master_details`**: 교재 세부 정보 (대단원, 중단원, 페이지)

### 타입 정의

**주요 타입** (`lib/types/plan.ts`):
- `PlanGroup`: 플랜 그룹 메타데이터
- `Plan`: 개별 플랜 항목
- `PlanContent`: 플랜 그룹-콘텐츠 관계
- `PlanExclusion`: 학습 제외일
- `AcademySchedule`: 학원 일정
- `ContentMaster`: 콘텐츠 마스터
- `PlanPurpose`: "내신대비" | "모의고사" | "수능" | "기타"
- `SchedulerType`: "성적기반" | "1730_timetable" | "전략취약과목" | "커스텀"
- `PlanStatus`: "draft" | "saved" | "active" | "paused" | "completed" | "cancelled"

## 📁 주요 파일 구조

### 데이터 액세스 레이어
- `lib/data/planGroups.ts`: 플랜 그룹 CRUD
- `lib/data/contentMasters.ts`: 콘텐츠 마스터 검색 및 복사

### 서버 액션
- `app/(student)/actions/planGroupActions.ts`:
  - `createPlanGroupAction`: 플랜 그룹 생성
  - `updatePlanGroupAction`: 플랜 그룹 업데이트
  - `updatePlanGroupStatus`: 상태 변경
  - `deletePlanGroupAction`: 삭제
  - `generatePlansFromGroupAction`: 플랜 그룹에서 개별 플랜 생성

- `app/(student)/actions/contentMasterActions.ts`:
  - `searchContentMastersAction`: 마스터 콘텐츠 검색
  - `copyMasterToStudentContentAction`: 마스터 → 학생 콘텐츠 복사

### 비즈니스 로직
- `lib/validation/planValidator.ts`: 플랜 생성 데이터 검증
- `lib/plan/statusManager.ts`: 플랜 상태 머신 및 전이 규칙
- `lib/plan/scheduler.ts`: 플랜 스케줄러 엔진 (규칙 기반)

### UI 컴포넌트

#### 플랜 생성 마법사
- `app/(student)/plan/new-group/page.tsx`: 마법사 페이지
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`: 마법사 컨테이너
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`: 기본 정보 입력
- `app/(student)/plan/new-group/_components/Step2BlocksAndExclusions.tsx`: 제외일 및 학원 일정
- `app/(student)/plan/new-group/_components/Step3Contents.tsx`: 콘텐츠 선택
- `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`: 마스터 콘텐츠 검색 모달

#### 플랜 그룹 상세
- `app/(student)/plan/group/[id]/page.tsx`: 상세 페이지
- `app/(student)/plan/group/[id]/_components/PlanGroupStatusButtons.tsx`: 상태 관리 버튼
- `app/(student)/plan/group/[id]/_components/PlanGroupDeleteButton.tsx`: 삭제 버튼
- `app/(student)/plan/group/[id]/_components/GeneratePlansButton.tsx`: 플랜 생성 버튼

#### 플랜 목록
- `app/(student)/plan/page.tsx`: 플랜 목록 (그룹 + 개별)
- `app/(student)/plan/_components/PlanGroupList.tsx`: 플랜 그룹 목록 컴포넌트

## 🔄 주요 워크플로우

### 1. 플랜 그룹 생성
```
사용자 → /plan/new-group
  → Step 1: 기본 정보 (목적, 스케줄러, 기간)
  → Step 2: 제외일 및 학원 일정
  → Step 3: 콘텐츠 선택 (마스터 검색 가능)
  → createPlanGroupAction
  → plan_groups + plan_contents + plan_exclusions + academy_schedules 생성
```

### 2. 플랜 생성
```
사용자 → /plan/group/[id]
  → "플랜 생성하기" 버튼 클릭
  → generatePlansFromGroupAction
  → 스케줄러 엔진으로 날짜별 플랜 계산
  → student_plan 일괄 생성
```

### 3. 콘텐츠 마스터 검색 및 복사
```
사용자 → Step 3에서 "서비스에서 가져오기"
  → ContentMasterSearch 모달
  → searchContentMastersAction (검색)
  → copyMasterToStudentContentAction (복사)
  → books/lectures 테이블에 학생 콘텐츠 생성 (master_content_id 연결)
```

## 🎯 스케줄러 유형

### 기본 스케줄러
- 콘텐츠를 기간 내에 균등 분배

### 성적 기반 스케줄러
- 취약과목 우선 배정 (TODO: 성적 데이터 연동)

### 1730 Timetable
- 6일 학습 + 1일 복습 패턴
- 주차별 그룹화

### 전략/취약과목 스케줄러
- 전략과목: 주 2-4일
- 취약과목: 4주 집중 (TODO: 과목 분류 로직)

### 커스텀 스케줄러
- 사용자 정의 규칙 (TODO: 커스텀 규칙 설정)

## 🔐 상태 관리

### 상태 전이 규칙
- `draft` → `saved`, `cancelled`
- `saved` → `active`, `cancelled`, `draft`
- `active` → `paused`, `completed`, `cancelled`
- `paused` → `active`, `cancelled`
- `completed`, `cancelled`: 종료 상태 (전이 불가)

### 상태별 권한
- **수정 가능**: `draft`, `saved`
- **삭제 가능**: `draft`, `saved`, `paused`
- **플랜 생성 가능**: `saved`, `active`

## 📝 마이그레이션

**파일**: `supabase/migrations/20250115000000_extend_plan_structure.sql`

주요 변경사항:
1. `plan_groups` 테이블 생성
2. `student_plan`에 `plan_group_id` 추가
3. `plan_contents`, `plan_exclusions`, `academy_schedules` 테이블 생성
4. `content_masters`, `content_master_details` 테이블 생성
5. `books`, `lectures`에 `master_content_id` 추가
6. RLS 정책 설정

## 🚀 주요 기능

### ✅ 완료된 기능
1. 플랜 그룹 생성 마법사 (3단계)
2. 플랜 그룹 상세 페이지
3. 플랜 그룹 목록 통합
4. 플랜 스케줄러 엔진 (규칙 기반)
5. 콘텐츠 마스터 검색 및 복사
6. 상태 관리 및 전이
7. 제외일 및 학원 일정 관리

### 🔨 향후 개선 사항
1. 성적 데이터 연동 (성적 기반 스케줄러)
2. 과목 분류 로직 (전략/취약과목 스케줄러)
3. 커스텀 규칙 설정 UI
4. 학습량 최적화 알고리즘 개선
5. 플랜 그룹 수정 페이지

## 📚 참고 사항

### 네이밍 규칙
- 컴포넌트: PascalCase
- 파일: 컴포넌트명과 동일
- 타입: PascalCase
- 함수: camelCase

### 스타일링
- Tailwind CSS 우선 사용
- Spacing-First 정책 (gap 우선, margin 금지)
- 인라인 style 금지

### 데이터 일관성
- 트랜잭션으로 관련 데이터 일괄 생성
- Soft Delete 사용 (`deleted_at`)
- Foreign Key 제약조건으로 참조 무결성 보장

## 🔗 관련 링크

- 플랜 생성: `/plan/new-group`
- 플랜 그룹 상세: `/plan/group/[id]`
- 플랜 목록: `/plan`

