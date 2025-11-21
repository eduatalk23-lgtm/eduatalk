# 데이터 스키마 분석 보고서

> **관련 문서**: [README.md](./README.md) - 전체 문서 인덱스 | [Supabase 마이그레이션 가이드](./supabase_migration_guide.md) - 마이그레이션 실행 방법

## 1. 코드가 기대하는 데이터 스키마 전체 리스트

### 1.1 students (학생 테이블)

**사용 위치**: 학생 정보 조회, 인증, 대시보드 등 전반
**컬럼**:

- `id` (uuid, PK) - 학생 ID (auth.users.id와 동일)
- `name` (text) - 이름
- `grade` (integer/text) - 학년
- `class` (text) - 반
- `birth_date` (date) - 생년월일
- `tenant_id` (uuid, FK → tenants.id) - 소속 기관 ID

### 1.2 student_plan (학습 계획 테이블)

**사용 위치**: 학습 계획 관리, 스케줄 생성, 진행률 추적
**컬럼**:

- `id` (uuid, PK)
- `tenant_id` (uuid, FK → tenants.id)
- `student_id` (uuid, FK → students.id)
- `plan_date` (date) - 계획 날짜
- `block_index` (integer) - 블록 인덱스
- `content_type` (text) - 콘텐츠 유형 ('book', 'lecture', 'custom')
- `content_id` (uuid) - 콘텐츠 ID
- `chapter` (text, nullable) - 단원/챕터
- `planned_start_page_or_time` (integer, nullable) - 계획 시작 페이지/시간
- `planned_end_page_or_time` (integer, nullable) - 계획 종료 페이지/시간
- `completed_amount` (integer, nullable) - 완료량
- `progress` (numeric, nullable) - 진행률
- `is_reschedulable` (boolean) - 재스케줄 가능 여부
- `created_at` (timestamptz)
- `updated_at` (timestamptz, nullable)

### 1.3 student_scores (성적 테이블) ⚠️

**사용 위치**: 성적 관리, 분석, 리포트
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `subject_type` (text) - 과목 유형
- `semester` (text) - 학기
- `course` (text) - 교과
- `course_detail` (text) - 세부 교과
- `raw_score` (numeric) - 원점수
- `grade` (integer) - 등급 (1-9)
- `score_type_detail` (text) - 성적 유형 상세
- `test_date` (date) - 시험 날짜
- `created_at` (timestamptz)

**⚠️ 주의**: 마이그레이션에는 `student_school_scores`와 `student_mock_scores`로 분리되어 있음

### 1.4 student_school_scores (내신 성적 테이블)

**사용 위치**: 내신 성적 관리, 분석
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `grade` (integer) - 학년 (1-3)
- `semester` (integer) - 학기 (1, 2)
- `subject_group` (text) - 교과 그룹
- `subject_type` (text) - 과목 유형
- `subject_name` (text) - 세부 과목명
- `raw_score` (numeric, nullable) - 원점수
- `grade_score` (integer, nullable) - 성취도 등급 (1-9)
- `class_rank` (integer, nullable) - 반 석차
- `test_date` (date, nullable) - 시험 날짜
- `created_at` (timestamptz)

### 1.5 student_mock_scores (모의고사 성적 테이블)

**사용 위치**: 모의고사 성적 관리, 분석
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `grade` (integer) - 학년 (1-3)
- `subject_group` (text) - 교과 그룹
- `subject_name` (text) - 세부 과목명
- `exam_type` (text) - 시험 유형 (평가원, 교육청, 사설)
- `exam_round` (text, nullable) - 시험 회차
- `raw_score` (numeric, nullable) - 원점수
- `percentile` (numeric, nullable) - 백분위 (0-100)
- `grade_score` (integer, nullable) - 등급 (1-9)
- `test_date` (date, nullable) - 시험 날짜
- `created_at` (timestamptz)

### 1.6 student_daily_schedule (일일 스케줄 테이블) ⚠️

**사용 위치**: 일일 스케줄 조회 및 관리
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `schedule_date` (date) - 스케줄 날짜
- `block_index` (integer) - 블록 인덱스
- `content_type` (text) - 콘텐츠 유형
- `content_id` (uuid) - 콘텐츠 ID
- `planned_start` (time, nullable) - 계획 시작 시간
- `planned_end` (time, nullable) - 계획 종료 시간
- `planned_start_page_or_time` (integer, nullable) - 계획 시작 페이지/시간
- `planned_end_page_or_time` (integer, nullable) - 계획 종료 페이지/시간

**⚠️ 주의**: 마이그레이션 파일에 이 테이블 정의가 없음

### 1.7 student_block_schedule (블록 스케줄 테이블)

**사용 위치**: 블록 시간대 관리, 스케줄 생성
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `day_of_week` (integer) - 요일 (0-6)
- `block_index` (integer) - 블록 인덱스
- `start_time` (time, nullable) - 시작 시간
- `end_time` (time, nullable) - 종료 시간

### 1.8 student_content_progress (콘텐츠 진행률 테이블)

**사용 위치**: 학습 진행률 추적, 리포트
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `content_type` (text) - 콘텐츠 유형
- `content_id` (uuid) - 콘텐츠 ID
- `plan_id` (uuid, nullable, FK → student_plan.id) - 플랜 ID
- `completed_amount` (integer, nullable) - 완료량
- `progress` (numeric, nullable) - 진행률
- `start_page_or_time` (integer, nullable) - 시작 페이지/시간
- `end_page_or_time` (integer, nullable) - 종료 페이지/시간
- `last_updated` (timestamptz, nullable) - 마지막 업데이트 시간

### 1.9 student_custom_contents (커스텀 콘텐츠 테이블) ⚠️

**사용 위치**: 커스텀 콘텐츠 관리
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `title` (text) - 제목
- `subject` (text, nullable) - 과목
- `content_type` (text) - 콘텐츠 유형
- `total_page_or_time` (integer, nullable) - 총 페이지/시간
- `created_at` (timestamptz)

**⚠️ 주의**: 마이그레이션 파일에 이 테이블 정의가 없을 수 있음

### 1.10 books (책 테이블) ⚠️

**사용 위치**: 책 콘텐츠 관리
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `title` (text) - 제목
- `subject` (text, nullable) - 과목
- `total_pages` (integer, nullable) - 총 페이지 (코드에서 `total_pages` 사용)
- `created_at` (timestamptz)

**⚠️ 주의**: 마이그레이션 파일에 이 테이블 정의가 없을 수 있음

### 1.11 lectures (강의 테이블) ⚠️

**사용 위치**: 강의 콘텐츠 관리
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `title` (text) - 제목
- `subject` (text, nullable) - 과목
- `duration` (integer, nullable) - 총 시간 (코드에서 `duration` 사용)
- `created_at` (timestamptz)

**⚠️ 주의**: 마이그레이션 파일에 이 테이블 정의가 없을 수 있음

### 1.12 student_goals (학습 목표 테이블)

**사용 위치**: 목표 관리, 진행률 추적
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `goal_type` (text) - 목표 유형 ('range', 'exam', 'weekly', 'monthly')
- `title` (text) - 목표명
- `description` (text, nullable) - 상세 설명
- `subject` (text, nullable) - 과목
- `content_id` (uuid, nullable) - 콘텐츠 ID
- `start_date` (date) - 시작 날짜
- `end_date` (date) - 종료 날짜
- `expected_amount` (integer, nullable) - 목표량
- `target_score` (integer, nullable) - 성적 목표
- `created_at` (timestamptz)

### 1.13 student_goal_progress (목표 진행률 테이블)

**사용 위치**: 목표 달성률 추적
**컬럼**:

- `id` (uuid, PK)
- `goal_id` (uuid, FK → student_goals.id)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `plan_id` (uuid, nullable, FK → student_plan.id)
- `session_id` (uuid, nullable, FK → student_study_sessions.id)
- `progress_amount` (integer, nullable) - 진행량
- `recorded_at` (timestamptz)

### 1.14 student_study_sessions (학습 세션 테이블)

**사용 위치**: 학습 세션 기록, 시간 추적
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `plan_id` (uuid, nullable, FK → student_plan.id)
- `content_type` (text, nullable) - 콘텐츠 유형 ('book', 'lecture', 'custom')
- `content_id` (uuid, nullable) - 콘텐츠 ID
- `started_at` (timestamptz) - 시작 시간
- `ended_at` (timestamptz, nullable) - 종료 시간
- `duration_seconds` (integer, nullable) - 학습 시간 (초)
- `focus_level` (integer, nullable) - 집중도 (1-5)
- `note` (text, nullable) - 세션 메모
- `created_at` (timestamptz)

### 1.15 student_history (학습 히스토리 테이블)

**사용 위치**: 학습 활동 기록, 리포트
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `event_type` (text) - 이벤트 유형 ('plan_completed', 'study_session', 'goal_progress', 'goal_created', 'goal_completed', 'score_added', 'score_updated', 'content_progress', 'auto_schedule_generated')
- `detail` (jsonb, nullable) - 상세 정보
- `created_at` (timestamptz)

### 1.16 student_analysis (학생 분석 테이블) ⚠️

**사용 위치**: 취약 과목 분석, Risk Index 계산
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `subject` (text) - 과목
- `risk_score` (numeric, nullable) - Risk Index 점수
- `recent_grade_trend` (numeric, nullable) - 최근 성적 추세
- `consistency_score` (numeric, nullable) - 일관성 점수
- `mastery_estimate` (numeric, nullable) - 숙련도 추정
- `updated_at` (timestamptz, nullable)

**⚠️ 주의**: 마이그레이션 파일에 이 테이블 정의가 없음

### 1.17 student_consulting_notes (상담노트 테이블)

**사용 위치**: 관리자 상담노트 작성 및 조회
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `consultant_id` (uuid, FK → admin_users.id)
- `note` (text) - 상담 내용
- `created_at` (timestamptz)

### 1.18 admin_users (관리자 사용자 테이블)

**사용 위치**: 관리자 권한 관리
**컬럼**:

- `id` (uuid, PK, FK → auth.users.id)
- `tenant_id` (uuid, nullable, FK → tenants.id) - Super Admin은 NULL
- `role` (text) - 역할 ('student', 'consultant', 'admin')
- `created_at` (timestamptz)

### 1.19 parent_users (학부모 사용자 테이블)

**사용 위치**: 학부모 권한 관리
**컬럼**:

- `id` (uuid, PK, FK → auth.users.id)
- `tenant_id` (uuid, FK → tenants.id)
- `name` (text) - 이름
- `created_at` (timestamptz)

### 1.20 parent_student_links (부모-학생 연결 테이블)

**사용 위치**: 학부모-학생 관계 관리
**컬럼**:

- `id` (uuid, PK)
- `parent_id` (uuid, FK → parent_users.id)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- `relation` (text) - 관계 ('mother', 'father', 'guardian')
- `created_at` (timestamptz)

### 1.21 tenants (기관 테이블)

**사용 위치**: 멀티테넌트 관리
**컬럼**:

- `id` (uuid, PK)
- `name` (text) - 기관명
- `type` (text) - 기관 유형 ('academy', 'school', 'enterprise', 'other')
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 1.22 recommended_contents (추천 콘텐츠 테이블)

**사용 위치**: 콘텐츠 추천 기능
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- (기타 컬럼은 코드에서 명시적으로 사용되지 않음)

### 1.23 make_scenario_logs (시나리오 생성 로그 테이블)

**사용 위치**: 자동 스케줄 생성 로그
**컬럼**:

- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id)
- `tenant_id` (uuid, FK → tenants.id)
- (기타 컬럼은 코드에서 명시적으로 사용되지 않음)

---

## 2. 누락된 테이블/컬럼 분석

### 2.1 누락된 테이블

#### ❌ student_scores

**상태**: 코드에서 사용하지만 마이그레이션에 없음
**대체 테이블**: `student_school_scores`, `student_mock_scores`
**사용 위치**:

- `app/actions/scores.ts` - 성적 추가/수정/삭제
- `app/scores/dashboard/_utils.ts` - 성적 조회
- `app/analysis/_utils.ts` - 분석용 성적 조회
- `lib/reports/monthly.ts` - 월간 리포트
- `app/actions/autoSchedule.ts` - 자동 스케줄 생성 시 성적 조회

**문제점**:

- 코드는 통합된 `student_scores` 테이블을 기대하지만, 실제 스키마는 내신/모의고사로 분리됨
- `subject_type`, `semester`, `course`, `course_detail`, `score_type_detail` 컬럼 사용
- 마이그레이션의 `student_school_scores`와 `student_mock_scores`는 다른 구조를 가짐

**해결 방안**:

1. `student_scores` 테이블을 생성하거나
2. 코드를 `student_school_scores`와 `student_mock_scores`를 사용하도록 수정

#### ❌ student_daily_schedule

**상태**: 코드에서 사용하지만 마이그레이션에 없음
**사용 위치**:

- `app/schedule/[date]/page.tsx` - 일일 스케줄 조회
- `app/actions/schedule.ts` - 일일 스케줄 생성

**필요한 컬럼**:

- `id`, `student_id`, `schedule_date`, `block_index`, `content_type`, `content_id`, `planned_start`, `planned_end`, `planned_start_page_or_time`, `planned_end_page_or_time`

**해결 방안**: `student_daily_schedule` 테이블 생성 마이그레이션 추가

#### ❌ student_analysis

**상태**: 코드에서 사용하지만 마이그레이션에 없음
**사용 위치**:

- `app/analysis/page.tsx` - 취약 과목 분석 페이지
- `app/analysis/_utils.ts` - Risk Index 계산 및 저장
- `lib/reports/weekly.ts` - 주간 리포트
- `lib/metrics/getWeakSubjects.ts` - 취약 과목 분석

**필요한 컬럼**:

- `id`, `student_id`, `tenant_id`, `subject`, `risk_score`, `recent_grade_trend`, `consistency_score`, `mastery_estimate`, `updated_at`

**해결 방안**: `student_analysis` 테이블 생성 마이그레이션 추가

### 2.2 누락된 테이블 (추가)

#### ❌ books

**상태**: 코드에서 사용하지만 마이그레이션에 없을 수 있음
**사용 위치**:

- `app/contents/page.tsx` - 콘텐츠 목록 조회
- `app/plan/[id]/page.tsx` - 플랜 상세에서 책 정보 조회
- `app/plan/[id]/progress/page.tsx` - 진행률 페이지에서 책 정보 조회
- `lib/data/studentContents.ts` - 책 CRUD 작업
- `app/actions/autoSchedule.ts` - 자동 스케줄 생성 시 책 조회

**필요한 컬럼**:

- `id`, `student_id`, `tenant_id`, `title`, `subject`, `total_pages`, `created_at`

#### ❌ lectures

**상태**: 코드에서 사용하지만 마이그레이션에 없을 수 있음
**사용 위치**:

- `app/contents/page.tsx` - 콘텐츠 목록 조회
- `app/plan/[id]/page.tsx` - 플랜 상세에서 강의 정보 조회
- `app/plan/[id]/progress/page.tsx` - 진행률 페이지에서 강의 정보 조회
- `lib/data/studentContents.ts` - 강의 CRUD 작업
- `app/actions/autoSchedule.ts` - 자동 스케줄 생성 시 강의 조회

**필요한 컬럼**:

- `id`, `student_id`, `tenant_id`, `title`, `subject`, `duration`, `created_at`

#### ❌ student_custom_contents

**상태**: 코드에서 사용하지만 마이그레이션에 없을 수 있음
**사용 위치**:

- `app/contents/page.tsx` - 커스텀 콘텐츠 목록 조회
- `app/plan/[id]/page.tsx` - 플랜 상세에서 커스텀 콘텐츠 정보 조회
- `app/plan/[id]/progress/page.tsx` - 진행률 페이지에서 커스텀 콘텐츠 정보 조회
- `lib/data/studentContents.ts` - 커스텀 콘텐츠 CRUD 작업
- `app/actions/autoSchedule.ts` - 자동 스케줄 생성 시 커스텀 콘텐츠 조회

**필요한 컬럼**:

- `id`, `student_id`, `tenant_id`, `title`, `subject`, `content_type`, `total_page_or_time`, `created_at`

### 2.3 누락된 컬럼

#### student_plan 테이블

**누락된 컬럼**: 없음 (모든 컬럼이 마이그레이션에 정의됨)

#### student_content_progress 테이블

**누락된 컬럼**:

- `plan_id` (uuid, nullable, FK → student_plan.id) - 코드에서 사용하지만 마이그레이션에 없을 수 있음
- `start_page_or_time` (integer, nullable) - 코드에서 사용
- `end_page_or_time` (integer, nullable) - 코드에서 사용
- `last_updated` (timestamptz, nullable) - 코드에서 사용

**사용 위치**:

- `app/actions/progress.ts` - 진행률 업데이트 시 `last_updated` 사용
- `app/actions/progress.ts` - `plan_id`, `start_page_or_time`, `end_page_or_time` 사용

---

## 3. 요약

### 3.1 누락된 테이블 (6개)

1. **student_scores** - 성적 관리 기능 (내신/모의고사로 분리되어 있음)
2. **student_daily_schedule** - 일일 스케줄 관리 기능
3. **student_analysis** - 취약 과목 분석 기능
4. **books** - 책 콘텐츠 관리 기능
5. **lectures** - 강의 콘텐츠 관리 기능
6. **student_custom_contents** - 커스텀 콘텐츠 관리 기능

### 3.2 누락된 컬럼

1. **student_content_progress**:
   - `plan_id` (FK)
   - `start_page_or_time`
   - `end_page_or_time`
   - `last_updated`

### 3.3 우선순위

1. **높음**: `student_analysis` 테이블 (분석 기능 핵심)
2. **높음**: `student_daily_schedule` 테이블 (스케줄 기능 핵심)
3. **높음**: `books`, `lectures`, `student_custom_contents` 테이블 (콘텐츠 관리 핵심)
4. **중간**: `student_scores` 테이블 또는 코드 수정 (성적 관리 기능)
5. **중간**: `student_content_progress` 누락 컬럼 추가 (진행률 추적 기능)

---

## 4. 권장 사항

1. **student_analysis 테이블 생성**: 취약 과목 분석 기능이 작동하지 않을 수 있음
2. **student_daily_schedule 테이블 생성**: 일일 스케줄 조회 기능이 작동하지 않을 수 있음
3. **books, lectures, student_custom_contents 테이블 생성**: 콘텐츠 관리 기능이 작동하지 않을 수 있음
4. **student_scores vs 분리된 테이블**: 코드와 스키마의 불일치 해결 필요
   - 옵션 A: `student_scores` 테이블 생성 (기존 코드 유지)
   - 옵션 B: 코드를 `student_school_scores`와 `student_mock_scores` 사용하도록 수정
5. **student_content_progress 컬럼 추가**: 진행률 추적 기능 완성도 향상

## 5. 각 누락 항목의 기능별 사용 위치

### 5.1 student_scores 테이블

**기능**: 통합 성적 관리
**사용 위치**:

- `app/actions/scores.ts` - 성적 추가/수정/삭제 액션
- `app/scores/dashboard/_utils.ts` - 성적 대시보드 조회
- `app/scores/dashboard/page.tsx` - 성적 대시보드 페이지
- `app/analysis/_utils.ts` - 취약 과목 분석을 위한 성적 조회
- `lib/reports/monthly.ts` - 월간 리포트 생성
- `app/actions/autoSchedule.ts` - 자동 스케줄 생성 시 성적 기반 우선순위 계산

### 5.2 student_daily_schedule 테이블

**기능**: 일일 스케줄 관리
**사용 위치**:

- `app/schedule/[date]/page.tsx` - 특정 날짜의 스케줄 조회 페이지
- `app/actions/schedule.ts` - 일일 스케줄 생성 및 관리 액션

### 5.3 student_analysis 테이블

**기능**: 취약 과목 분석 및 Risk Index 계산
**사용 위치**:

- `app/analysis/page.tsx` - 취약 과목 분석 페이지
- `app/analysis/_utils.ts` - Risk Index 계산 및 저장 로직
- `lib/reports/weekly.ts` - 주간 리포트에서 분석 데이터 사용
- `lib/metrics/getWeakSubjects.ts` - 취약 과목 식별

### 5.4 books 테이블

**기능**: 책 콘텐츠 관리
**사용 위치**:

- `app/contents/page.tsx` - 콘텐츠 목록 페이지 (책 탭)
- `app/plan/[id]/page.tsx` - 플랜 상세에서 책 정보 표시
- `app/plan/[id]/progress/page.tsx` - 진행률 페이지에서 책 정보 표시
- `lib/data/studentContents.ts` - 책 CRUD 작업
- `app/actions/autoSchedule.ts` - 자동 스케줄 생성 시 책 조회
- `app/(student)/dashboard/_utils.ts` - 대시보드에서 책 정보 조회

### 5.5 lectures 테이블

**기능**: 강의 콘텐츠 관리
**사용 위치**:

- `app/contents/page.tsx` - 콘텐츠 목록 페이지 (강의 탭)
- `app/plan/[id]/page.tsx` - 플랜 상세에서 강의 정보 표시
- `app/plan/[id]/progress/page.tsx` - 진행률 페이지에서 강의 정보 표시
- `lib/data/studentContents.ts` - 강의 CRUD 작업
- `app/actions/autoSchedule.ts` - 자동 스케줄 생성 시 강의 조회
- `app/(student)/dashboard/_utils.ts` - 대시보드에서 강의 정보 조회

### 5.6 student_custom_contents 테이블

**기능**: 커스텀 콘텐츠 관리
**사용 위치**:

- `app/contents/page.tsx` - 콘텐츠 목록 페이지 (커스텀 탭)
- `app/plan/[id]/page.tsx` - 플랜 상세에서 커스텀 콘텐츠 정보 표시
- `app/plan/[id]/progress/page.tsx` - 진행률 페이지에서 커스텀 콘텐츠 정보 표시
- `lib/data/studentContents.ts` - 커스텀 콘텐츠 CRUD 작업
- `app/actions/autoSchedule.ts` - 자동 스케줄 생성 시 커스텀 콘텐츠 조회
- `app/(student)/dashboard/_utils.ts` - 대시보드에서 커스텀 콘텐츠 정보 조회

### 5.7 student_content_progress 누락 컬럼

**기능**: 학습 진행률 추적
**사용 위치**:

- `app/actions/progress.ts` - 진행률 업데이트 시 `plan_id`, `start_page_or_time`, `end_page_or_time`, `last_updated` 사용
- `app/actions/schedule.ts` - 스케줄 생성 시 진행률 초기화
