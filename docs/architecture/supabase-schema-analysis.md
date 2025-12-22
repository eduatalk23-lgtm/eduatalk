# Supabase 데이터베이스 스키마 분석

**작성일**: 2025-02-02  
**프로젝트**: TimeLevelUp (Eduatalk)  
**데이터베이스**: PostgreSQL (Supabase)  
**분석 방법**: Supabase MCP를 통한 실제 데이터베이스 조회

---

## 📋 목차

1. [스키마 개요](#스키마-개요)
2. [테이블 통계](#테이블-통계)
3. [테이블 카테고리별 분류](#테이블-카테고리별-분류)
4. [주요 테이블 상세](#주요-테이블-상세)
5. [데이터베이스 확장 기능](#데이터베이스-확장-기능)
6. [마이그레이션 히스토리](#마이그레이션-히스토리)
7. [RLS 정책 현황](#rls-정책-현황)
8. [관계도 (ERD)](#관계도-erd)

---

## 스키마 개요

### 데이터베이스 구조

- **스키마**: `public` (기본)
- **인증**: Supabase Auth (`auth.users`)
- **RLS**: Row Level Security 활성화 (대부분의 테이블)
- **캐싱**: `today_plans_cache` 테이블 사용
- **총 테이블 수**: **80개**

### 주요 특징

1. **멀티 테넌트 아키텍처**: `tenant_id` 기반 데이터 격리
2. **역할 기반 접근 제어**: 학생, 관리자, 부모, 컨설턴트, 슈퍼관리자
3. **학습 계획 관리**: 복잡한 플랜 생성 및 재조정 시스템
4. **콘텐츠 관리**: 교재, 강의, 커스텀 콘텐츠 통합 관리
5. **성적 관리**: 정규화된 성적 테이블 구조 (내신, 모의고사 분리)
6. **출석 관리**: QR 코드 및 위치 기반 출석 시스템

---

## 테이블 통계

### 전체 테이블 목록 (80개)

| 카테고리         | 테이블 수 | 주요 테이블                                                                                                     |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| 인증 및 사용자   | 6         | `tenants`, `admin_users`, `students`, `parent_users`, `parent_student_links`, `user_sessions`                   |
| 교육과정 및 과목 | 6         | `curriculum_revisions`, `subject_groups`, `subjects`, `subject_types`, `student_divisions`, `difficulty_levels` |
| 콘텐츠 관리      | 15        | `master_books`, `master_lectures`, `master_custom_contents`, `books`, `lectures`, `student_custom_contents` 등  |
| 학습 계획        | 9         | `plan_groups`, `plan_group_items`, `student_plan`, `plan_history`, `reschedule_log` 등                          |
| 성적 관리        | 5         | `student_terms`, `student_internal_scores`, `student_mock_scores`, `grade_conversion_rules` 등                  |
| 출석 관리        | 3         | `attendance_records`, `attendance_qr_codes`, `attendance_record_history`                                        |
| 캠프 관리        | 3         | `camp_templates`, `camp_invitations`, `camp_template_block_sets`                                                |
| 블록 및 스케줄   | 5         | `tenant_block_sets`, `tenant_blocks`, `student_block_sets`, `student_block_schedule`, `academy_schedules`       |
| 설정 및 시스템   | 4         | `system_settings`, `recommendation_settings`, `tenant_scheduler_settings`, `terms_contents`                     |
| 기타             | 24        | 학교 정보, 대학교 정보, 지역 정보, 로그 테이블 등                                                               |

---

## 테이블 카테고리별 분류

### 1. 인증 및 사용자 관리 (6개)

#### `tenants` - 테넌트(학원) 정보

- **목적**: 멀티 테넌트 구조의 핵심 테이블
- **주요 컬럼**: `id`, `name`, `type`, `status`, `location_latitude`, `location_longitude`, `attendance_sms_*` 설정들
- **특징**: 출석 관련 SMS 설정 포함, 위치 기반 출석 인정 반경 설정

#### `admin_users` - 관리자 사용자

- **목적**: 관리자 권한 정보 저장
- **주요 컬럼**: `id` (FK → auth.users), `role` (admin/consultant/superadmin), `tenant_id`
- **RLS**: 활성화

#### `students` - 학생 정보

- **목적**: 학생 기본 정보 관리
- **주요 컬럼**: `id`, `tenant_id`, `name`, `grade`, `division`, `status`, `active_block_set_id`
- **특징**: 40개 이상의 외래키 관계를 가진 핵심 테이블
- **RLS**: 활성화

#### `parent_users` - 부모 사용자

- **목적**: 학부모 사용자 정보
- **주요 컬럼**: `id` (FK → auth.users), `name`, `tenant_id`
- **RLS**: 활성화

#### `parent_student_links` - 부모-학생 연결

- **목적**: 부모와 학생의 연결 관계
- **주요 컬럼**: `parent_id`, `student_id`, `relation` (mother/father/guardian), `is_approved`
- **특징**: 승인 프로세스 포함

#### `user_sessions` - 사용자 세션

- **목적**: 로그인 세션 및 기기 정보 추적
- **주요 컬럼**: `user_id`, `session_token`, `device_name`, `ip_address`, `is_current_session`

---

### 2. 교육과정 및 과목 관리 (6개)

#### `curriculum_revisions` - 교육과정 개정

- **목적**: 교육과정 개정 버전 관리 (2015개정, 2022개정 등)
- **주요 컬럼**: `id`, `name`, `year`, `is_active`
- **특징**: 전역 마스터 데이터

#### `subject_groups` - 교과 그룹

- **목적**: 교과 그룹 관리 (국어, 수학, 영어 등)
- **주요 컬럼**: `id`, `name`, `curriculum_revision_id`
- **특징**: 교육과정별로 관리

#### `subjects` - 과목

- **목적**: 과목 관리 (수학Ⅰ, 수학Ⅱ 등)
- **주요 컬럼**: `id`, `subject_group_id`, `name`, `subject_type_id`
- **특징**: 교과 그룹과 과목구분에 연결

#### `subject_types` - 과목구분

- **목적**: 과목구분 관리 (공통, 일반선택, 진로선택 등)
- **주요 컬럼**: `id`, `curriculum_revision_id`, `name`, `is_active`

#### `student_divisions` - 학생 구분

- **목적**: 학생 구분 마스터 (고등부, 중등부, 기타)
- **주요 컬럼**: `id`, `name`, `display_order`, `is_active`
- **초기 데이터**: 고등부, 중등부, 기타

#### `difficulty_levels` - 난이도 레벨

- **목적**: 콘텐츠 난이도 마스터
- **주요 컬럼**: `id`, `name`, `content_type` (book/lecture/custom/common), `display_order`
- **특징**: 콘텐츠 타입별로 난이도 관리

---

### 3. 콘텐츠 관리 (15개)

#### 마스터 콘텐츠 (템플릿)

##### `master_books` - 마스터 교재

- **목적**: 교재 템플릿 (전체 기관 공통 또는 테넌트별)
- **주요 컬럼**:
  - 기본: `id`, `tenant_id`, `title`, `total_pages`, `is_active`
  - 교육과정: `curriculum_revision_id`, `subject_id`, `subject_group_id`, `grade_min`, `grade_max`
  - 출판 정보: `publisher_id`, `publisher_name`, `isbn_13`, `published_date`
  - 메타데이터: `cover_image_url`, `pdf_url`, `ocr_data`, `page_analysis`, `overall_difficulty`
  - Denormalized: `subject`, `subject_category` (성능 최적화)
- **특징**: 1,277개 행 (대량의 마스터 데이터)

##### `master_lectures` - 마스터 강의

- **목적**: 강의 템플릿
- **주요 컬럼**: `id`, `tenant_id`, `title`, `total_episodes`, `total_duration`, `linked_book_id`, `platform_id`, `is_active`
- **특징**: 교재와 연결 가능, 플랫폼 정보 포함

##### `master_custom_contents` - 마스터 커스텀 콘텐츠

- **목적**: 커스텀 콘텐츠 템플릿
- **주요 컬럼**: `id`, `tenant_id`, `title`, `content_type`, `total_page_or_time`, `subject_id`

#### 학생별 콘텐츠

##### `books` - 학생 교재

- **목적**: 학생이 등록한 교재
- **주요 컬럼**: `id`, `student_id`, `master_content_id`, `title`, `subject`, `difficulty_level_id`
- **특징**: 마스터 교재를 복제하여 학생별로 관리

##### `lectures` - 학생 강의

- **목적**: 학생이 등록한 강의
- **주요 컬럼**: `id`, `student_id`, `master_lecture_id`, `master_content_id`, `title`, `total_episodes`, `linked_book_id`
- **특징**: 마스터 강의와 연결, 교재와 연결 가능

##### `student_custom_contents` - 학생 커스텀 콘텐츠

- **목적**: 학생이 직접 생성한 커스텀 콘텐츠
- **주요 컬럼**: `id`, `student_id`, `content_type`, `title`, `total_page_or_time`, `difficulty_level_id`

#### 콘텐츠 상세 정보

##### `book_details` - 교재 상세 정보

- **목적**: 마스터 교재의 페이지별 상세 정보
- **주요 컬럼**: `id`, `book_id` (FK → master_books), `major_unit`, `minor_unit`, `page_number`
- **특징**: 177개 행

##### `student_book_details` - 학생 교재 상세 정보

- **목적**: 학생 교재의 페이지별 상세 정보
- **주요 컬럼**: `id`, `book_id` (FK → books), `major_unit`, `minor_unit`, `page_number`

##### `lecture_episodes` - 강의 회차 정보

- **목적**: 마스터 강의의 회차별 정보
- **주요 컬럼**: `id`, `lecture_id` (FK → master_lectures), `episode_number`, `episode_title`, `duration`
- **특징**: 982개 행

##### `student_lecture_episodes` - 학생 강의 회차 정보

- **목적**: 학생 강의의 회차별 정보
- **주요 컬럼**: `id`, `lecture_id` (FK → lectures), `episode_number`, `episode_title`, `duration`
- **특징**: 71개 행

#### 기타 콘텐츠 관련

##### `content_masters` - 콘텐츠 마스터 (레거시?)

- **목적**: 서비스 제공 교재/강의 마스터 데이터
- **상태**: 0개 행 (사용되지 않는 것으로 보임)

##### `content_master_details` - 콘텐츠 마스터 상세

- **목적**: 교재 세부 정보
- **상태**: 0개 행

##### `recommended_contents` - 추천 콘텐츠

- **목적**: 학생별 추천 콘텐츠 목록
- **주요 컬럼**: `id`, `student_id`, `content_type`, `content_id`, `is_selected`, `recommended_reason`

##### `book_subject_mapping` - 교재-과목 매핑

- **목적**: 키워드 기반 교재-과목 매핑
- **주요 컬럼**: `id`, `keyword`, `curriculum_revision_id`, `subject_group_id`

---

### 4. 학습 계획 관리 (9개)

#### `plan_groups` - 플랜 그룹

- **목적**: 학습 계획 그룹 (논리적 그룹핑)
- **주요 컬럼**:
  - 기본: `id`, `tenant_id`, `student_id`, `name`, `status`, `plan_type`
  - 기간: `period_start`, `period_end`, `target_date`
  - 스케줄러: `scheduler_type`, `scheduler_options` (JSONB), `block_set_id`
  - 제약조건: `subject_constraints` (JSONB), `additional_period_reallocation` (JSONB)
  - 캠프: `camp_template_id`, `camp_invitation_id`
- **특징**: 140개 행, 복잡한 JSONB 필드로 유연한 설정 저장
- **RLS**: 활성화

#### `plan_group_items` - 플랜 그룹 항목

- **목적**: 논리 플랜 항목 (플랜 그룹 내 학습 계획의 "설계" 단위)
- **주요 컬럼**:
  - 콘텐츠: `content_type`, `content_id`, `master_content_id`
  - 범위: `target_start_page_or_time`, `target_end_page_or_time`
  - 분할: `repeat_count`, `split_strategy` (equal/custom/auto)
  - 플래그: `is_review`, `is_required`, `priority`
- **특징**: 0개 행 (새로 생성된 테이블)

#### `student_plan` - 학생 플랜

- **목적**: 학생의 실제 학습 일정
- **주요 컬럼**:
  - 기본: `id`, `student_id`, `plan_group_id`, `plan_date`, `block_index`
  - 콘텐츠: `content_type`, `content_id`, `planned_start_page_or_time`, `planned_end_page_or_time`
  - 진행률: `progress` (0-100), `completed_amount`, `status`
  - 시간: `start_time`, `end_time`, `actual_start_time`, `actual_end_time`, `total_duration_seconds`
  - 메타: `plan_number`, `sequence`, `day_type`, `week`, `day`, `subject_type`
  - Denormalized: `content_title`, `content_subject`, `content_subject_category`, `content_category`
- **특징**: 101개 행, 복잡한 스케줄링 정보 포함
- **RLS**: 활성화

#### `plan_contents` - 플랜 콘텐츠

- **목적**: 플랜 그룹과 콘텐츠의 관계 및 학습 범위
- **주요 컬럼**: `id`, `plan_group_id`, `content_type`, `content_id`, `start_range`, `end_range`, `master_content_id`, `start_detail_id`, `end_detail_id`
- **특징**: 127개 행, 자동 추천 정보 포함 (`is_auto_recommended`, `recommendation_source`)

#### `plan_exclusions` - 플랜 제외일

- **목적**: 플랜 그룹의 학습 제외일
- **주요 컬럼**: `id`, `plan_group_id` (nullable), `student_id`, `exclusion_date`, `exclusion_type`, `reason`
- **특징**: `plan_group_id`가 NULL이면 시간 관리 영역의 전역 제외일

#### `plan_history` - 플랜 히스토리

- **목적**: 재조정 시 기존 플랜의 스냅샷 보관
- **주요 컬럼**: `id`, `plan_id`, `plan_group_id`, `plan_data` (JSONB), `adjustment_type`, `reschedule_log_id`
- **특징**: 0개 행

#### `reschedule_log` - 재조정 로그

- **목적**: 플랜 그룹 재조정 이력 관리
- **주요 컬럼**: `id`, `plan_group_id`, `student_id`, `adjusted_contents` (JSONB), `plans_before_count`, `plans_after_count`, `status`
- **특징**: 0개 행

#### `plan_timer_logs` - 플랜 타이머 로그

- **목적**: 플랜 타이머 이벤트 로그 (시작, 일시정지, 재개, 완료)
- **주요 컬럼**: `id`, `plan_id`, `student_id`, `event_type`, `timestamp`, `duration_seconds`
- **특징**: 0개 행

#### `today_plans_cache` - 오늘의 플랜 캐시

- **목적**: 오늘의 플랜 조회 결과 캐싱
- **주요 컬럼**: `id`, `tenant_id` (nullable), `student_id`, `plan_date`, `is_camp_mode`, `payload` (JSONB), `expires_at`
- **특징**: 21개 행, TTL 기반 만료

---

### 5. 성적 관리 (5개)

#### `student_terms` - 학생 학기 정보

- **목적**: 학생의 학기 정보 관리
- **주요 컬럼**: `id`, `student_id`, `school_year`, `grade`, `semester`, `curriculum_revision_id`, `class_name`, `homeroom_teacher`
- **특징**: 0개 행

#### `student_internal_scores` - 내신 성적

- **목적**: 내신 성적 관리
- **주요 컬럼**:
  - 기본: `id`, `student_id`, `curriculum_revision_id`, `subject_id`, `subject_group_id`, `subject_type_id`
  - 성적: `grade`, `semester`, `credit_hours`, `raw_score`, `avg_score`, `std_dev`, `rank_grade`, `total_students`
  - 연결: `student_term_id`
- **특징**: 0개 행, 정규화된 구조

#### `student_mock_scores` - 모의고사 성적

- **목적**: 모의고사 성적 관리
- **주요 컬럼**:
  - 기본: `id`, `student_id`, `exam_date`, `exam_title`, `grade`, `subject_id`, `subject_group_id`
  - 성적: `standard_score`, `percentile`, `grade_score`, `raw_score`
  - 연결: `student_term_id`
- **특징**: 5개 행

#### `grade_conversion_rules` - 등급 변환 규칙

- **목적**: 등급 변환 규칙 관리
- **주요 컬럼**: `id`, `curriculum_revision_id`, `grade_level`, `converted_percentile`
- **특징**: 0개 행

#### `student_score_analysis_cache` - 성적 분석 캐시

- **목적**: 성적 분석 결과 캐싱
- **주요 컬럼**: `student_id` (PK), `internal_summary` (JSONB), `mock_summary` (JSONB), `strategy_summary` (JSONB)
- **특징**: 0개 행

#### `student_score_events` - 성적 이벤트 로그

- **목적**: 성적 변경 이벤트 로그
- **주요 컬럼**: `id`, `student_id`, `event_type`, `score_table`, `before_data` (JSONB), `after_data` (JSONB)
- **특징**: 0개 행

---

### 6. 출석 관리 (3개)

#### `attendance_records` - 출석 기록

- **목적**: 입실/퇴실 기록
- **주요 컬럼**:
  - 기본: `id`, `tenant_id`, `student_id`, `attendance_date`
  - 시간: `check_in_time`, `check_out_time`
  - 방법: `check_in_method`, `check_out_method` (manual/qr/location/auto)
  - 상태: `status` (present/absent/late/early_leave/excused)
- **특징**: 1개 행, UNIQUE 제약조건 (student_id, attendance_date)
- **RLS**: 활성화

#### `attendance_qr_codes` - QR 코드

- **목적**: 출석용 QR 코드 관리
- **주요 컬럼**: `id`, `tenant_id`, `qr_data`, `qr_code_url`, `is_active`, `expires_at`, `usage_count`, `last_used_at`
- **특징**: 6개 행, 만료 시간 및 사용 횟수 추적

#### `attendance_record_history` - 출석 기록 히스토리

- **목적**: 출석 기록 수정 이력
- **주요 컬럼**: `id`, `attendance_record_id`, `before_data` (JSONB), `after_data` (JSONB), `modified_by`, `reason`
- **특징**: 0개 행, 감사 추적용

---

### 7. 캠프 관리 (3개)

#### `camp_templates` - 캠프 템플릿

- **목적**: 캠프 템플릿 관리
- **주요 컬럼**:
  - 기본: `id`, `tenant_id`, `name`, `description`, `program_type`, `status`
  - 기간/위치: `camp_start_date`, `camp_end_date`, `camp_location`
  - 데이터: `template_data` (JSONB), `reminder_settings` (JSONB)
- **특징**: 2개 행

#### `camp_invitations` - 캠프 초대

- **목적**: 캠프 템플릿 초대 명단
- **주요 컬럼**: `id`, `tenant_id`, `camp_template_id`, `student_id`, `status`, `expires_at`
- **특징**: 1개 행, UNIQUE 제약조건 (plan_groups.camp_invitation_id)

#### `camp_template_block_sets` - 캠프 템플릿 블록 세트

- **목적**: 템플릿-블록세트 연결
- **주요 컬럼**: `id`, `camp_template_id` (UNIQUE), `tenant_block_set_id`
- **특징**: 2개 행, 1:1 관계 (하나의 템플릿은 하나의 블록 세트만)

---

### 8. 블록 및 스케줄 관리 (5개)

#### `tenant_block_sets` - 테넌트 블록 세트

- **목적**: 테넌트별 블록 세트 (템플릿과 독립적으로 관리)
- **주요 컬럼**: `id`, `tenant_id`, `name`, `description`
- **특징**: 1개 행

#### `tenant_blocks` - 테넌트 블록

- **목적**: 테넌트 블록 (요일별 시간 블록)
- **주요 컬럼**: `id`, `tenant_block_set_id`, `day_of_week`, `start_time`, `end_time`
- **특징**: 7개 행

#### `student_block_sets` - 학생 블록 세트

- **목적**: 학생의 시간 블록 세트(템플릿)
- **주요 컬럼**: `id`, `tenant_id`, `student_id`, `name`, `description`, `display_order`
- **특징**: 2개 행

#### `student_block_schedule` - 학생 블록 스케줄

- **목적**: 학생의 시간 블록 스케줄 정보
- **주요 컬럼**: `id`, `student_id`, `day_of_week`, `start_time`, `end_time`, `block_set_id`
- **특징**: 14개 행

#### `academy_schedules` - 학원 일정

- **목적**: 학원 일정 정보
- **주요 컬럼**: `id`, `tenant_id`, `student_id`, `academy_id`, `plan_group_id` (nullable), `day_of_week`, `start_time`, `end_time`, `academy_name`, `subject`
- **특징**: 7개 행, `plan_group_id`가 NULL이면 시간 관리 영역의 전역 학원 일정

#### `academies` - 학원 정보

- **목적**: 학생별 학원 정보
- **주요 컬럼**: `id`, `tenant_id`, `student_id`, `name`, `travel_time`
- **특징**: 3개 행

---

### 9. 설정 및 시스템 (4개)

#### `system_settings` - 시스템 설정

- **목적**: 시스템 전역 설정 (교육과정 계산 기준 등)
- **주요 컬럼**: `id`, `key` (UNIQUE), `value` (JSONB), `description`
- **특징**: 4개 행, 교육과정 개정 시작년도 저장

#### `recommendation_settings` - 추천 설정

- **목적**: 추천 시스템 설정 저장소
- **주요 컬럼**: `id`, `tenant_id` (nullable), `setting_type`, `setting_key`, `setting_value` (JSONB), `version`
- **특징**: 0개 행, 테넌트별 또는 전역 설정

#### `tenant_scheduler_settings` - 스케줄러 설정

- **목적**: 기관별 전역 스케줄러 기본 설정
- **주요 컬럼**: `id`, `tenant_id` (UNIQUE), `default_study_days`, `default_review_days`, `default_weak_subject_focus`, `default_review_scope`, `default_lunch_time` (JSONB), `default_study_hours` (JSONB), `review_time_ratio`
- **특징**: 0개 행

#### `terms_contents` - 약관 내용

- **목적**: 약관 내용 저장 (이용약관, 개인정보취급방침, 마케팅 활용 동의)
- **주요 컬럼**: `id`, `content_type`, `version`, `title`, `content`, `is_active`, `created_by`
- **특징**: 3개 행, 버전 관리 포함

---

### 10. 기타 테이블 (24개)

#### 학생 관련

- `student_profiles` - 학생 프로필 정보 (1:1 관계)
- `student_career_goals` - 학생 진로 목표 (7개 행)
- `student_career_field_preferences` - 학생 진로 계열 선호도
- `student_goals` - 학습 목표
- `student_goal_progress` - 목표 진행률
- `student_content_progress` - 콘텐츠 진행률 (4개 행)
- `student_study_sessions` - 학습 세션 (20개 행)
- `student_history` - 학습 히스토리 (569개 행)
- `student_analysis` - 학생별 과목 분석
- `student_consulting_notes` - 학생별 상담노트
- `student_notification_preferences` - 학생 알림 설정
- `student_connection_codes` - 학생 연결 코드
- `student_daily_schedule` - 학생 일일 스케줄
- `excluded_dates` - 제외 날짜

#### 학교 정보

- `school_info` - 중·고등학교 정보 (5,909개 행, 나이스 데이터 기반)
- `universities` - 대학교 기본 정보 (2,056개 행)
- `university_campuses` - 대학교 캠퍼스 정보 (2,056개 행)
- `edu_office` - 교육청 정보 (18개 행)
- `district_office` - 교육지원청 정보 (194개 행)
- `regions` - 지역 정보 (27개 행, 위계 구조)

#### 마스터 데이터

- `publishers` - 출판사 정보 (54개 행)
- `platforms` - 강의 플랫폼 정보 (8개 행)
- `career_fields` - 진로 계열 마스터 (10개 행)

#### 로그 및 캐시

- `make_scenario_logs` - 시나리오 생성 로그
- `sms_logs` - SMS 전송 로그 (11개 행)
- `user_consents` - 사용자 약관 동의

---

## 주요 테이블 상세

### 1. `students` 테이블

**목적**: 학생 기본 정보 관리

**주요 컬럼**:

- `id`: UUID (PK)
- `tenant_id`: UUID (FK → tenants)
- `name`: 학생 이름
- `grade`: 학년 (1-3)
- `division`: 학생 구분 (student_divisions.name 참조)
- `status`: 학생 상태 (enrolled/on_leave/graduated/transferred)
- `active_block_set_id`: 현재 활성화된 블록 세트 ID
- `school_id`: 학교 ID (school_type에 따라 참조 테이블 다름)
- `school_type`: 학교 유형 (MIDDLE/HIGH/UNIVERSITY)

**외래키 관계**: 40개 이상의 테이블과 관계

**RLS**: 활성화

**데이터**: 7개 행

---

### 2. `plan_groups` 테이블

**목적**: 학습 계획 그룹 (논리적 그룹핑)

**주요 컬럼**:

- `id`: UUID (PK)
- `tenant_id`: UUID (FK → tenants)
- `student_id`: UUID (FK → students)
- `name`: 플랜 그룹 이름
- `status`: 상태 (draft/saved/active/paused/completed/cancelled)
- `plan_purpose`: 플랜 목적 (내신대비/모의고사/수능/기타)
- `scheduler_type`: 스케줄러 유형 (성적기반/1730_timetable/전략취약과목/커스텀)
- `period_start`, `period_end`: 플랜 기간
- `target_date`: 목표 날짜 (D-day)
- `block_set_id`: 기간별 블록 세트 ID
- `scheduler_options`: 스케줄러 옵션 (JSONB)
- `subject_constraints`: 교과 제약 조건 (JSONB)
- `additional_period_reallocation`: 추가 기간 학습 범위 재배치 (JSONB)
- `non_study_time_blocks`: 학습 시간 제외 항목 (JSONB)
- `plan_type`: 플랜 타입 (individual/integrated/camp)
- `camp_template_id`, `camp_invitation_id`: 캠프 관련

**특징**: 복잡한 JSONB 필드로 유연한 설정 저장

**데이터**: 140개 행

---

### 3. `student_plan` 테이블

**목적**: 학생의 실제 학습 일정

**주요 컬럼**:

- `id`: UUID (PK)
- `student_id`: UUID (FK → students)
- `plan_group_id`: UUID (FK → plan_groups)
- `plan_date`: DATE (학습 날짜)
- `block_index`: 블록 인덱스
- `content_type`: TEXT ('book', 'lecture', 'custom')
- `content_id`: UUID (콘텐츠 ID)
- `planned_start_page_or_time`, `planned_end_page_or_time`: 계획된 범위
- `progress`: NUMERIC (0-100, 학습 진행률)
- `status`: TEXT ('pending', 'in_progress', 'completed', 'canceled')
- `start_time`, `end_time`: TIME (계획된 시작/종료 시간)
- `actual_start_time`, `actual_end_time`: TIMESTAMPTZ (실제 시작/종료 시간)
- `total_duration_seconds`: INTEGER (총 소요 시간)
- `day_type`: TEXT (학습일/복습일/지정휴일/휴가/개인일정)
- `week`, `day`: INTEGER (주차 번호, 일차)
- `plan_number`, `sequence`: INTEGER (플랜 번호, 회차)
- `subject_type`: TEXT (strategy/weakness)
- Denormalized: `content_title`, `content_subject`, `content_subject_category`, `content_category`

**특징**: 복잡한 스케줄링 정보와 진행률 추적

**데이터**: 101개 행

---

### 4. `master_books` 테이블

**목적**: 마스터 교재 템플릿

**주요 컬럼**:

- `id`: UUID (PK)
- `tenant_id`: UUID (FK → tenants, nullable)
- `title`: TEXT (교재 제목)
- `total_pages`: INTEGER (총 페이지 수)
- `subject_id`: UUID (FK → subjects)
- `curriculum_revision_id`: UUID (FK → curriculum_revisions)
- `grade_min`, `grade_max`: INTEGER (학년 범위)
- `publisher_id`: UUID (FK → publishers)
- `isbn_13`: TEXT (UNIQUE)
- `cover_image_url`: TEXT
- `pdf_url`: TEXT (AI 분석용)
- `ocr_data`: JSONB (OCR 분석 데이터)
- `page_analysis`: JSONB (페이지별 분석 데이터)
- `overall_difficulty`: NUMERIC (전체 난이도 점수)
- Denormalized: `subject`, `subject_category` (성능 최적화)

**특징**: 대량의 마스터 데이터 (1,277개 행), AI 분석 데이터 포함

---

## 데이터베이스 확장 기능

### 설치된 확장 기능

1. **plpgsql** (1.0) - PL/pgSQL procedural language
2. **pg_trgm** (1.6) - text similarity measurement and index searching based on trigrams
3. **pgcrypto** (1.3) - cryptographic functions
4. **uuid-ossp** (1.1) - generate universally unique identifiers (UUIDs)
5. **pg_stat_statements** (1.11) - track planning and execution statistics
6. **hypopg** (1.4.1) - Hypothetical indexes for PostgreSQL
7. **index_advisor** (0.2.0) - Query index advisor
8. **supabase_vault** (0.3.1) - Supabase Vault Extension
9. **pg_graphql** (1.5.11) - GraphQL support

### 주요 용도

- **pg_trgm**: 텍스트 검색 최적화 (학생 이름, 교재 제목 등)
- **pgcrypto**: 암호화 기능 (민감 정보 보호)
- **uuid-ossp**: UUID 생성
- **pg_stat_statements**: 쿼리 성능 모니터링
- **hypopg**: 가상 인덱스 테스트
- **index_advisor**: 인덱스 최적화 권장사항
- **pg_graphql**: GraphQL API 지원

---

## 마이그레이션 히스토리

### 총 마이그레이션 수: 86개

### 주요 마이그레이션 타임라인

#### 2025년 1월

- `20250101000000`: restore_master_books_schema
- `20250105000000`: add_performance_indexes_for_today_plans
- `20250107000000`: optimize_today_plans_indexes
- `20250115000000`: add_attendance_location_to_tenants
- `20250119220000`: add_student_division
- `20250120000000`: create_student_divisions
- `20250120000001`: update_students_division_constraint

#### 2025년 2월

- `20250201000000`: add_parent_student_links_admin_policies
- `20250201000001`: create_user_consents
- `20250202000000`: create_tenant_scheduler_settings
- `20250202153937`: add_superadmin_to_admin_users_role
- `20250204000000`: remove_legacy_student_scores_table
- `20250205000000`: drop_legacy_student_school_scores_table

#### 2025년 11월

- `20251128225817`: change_desired_university_ids_to_text_array
- `20251129054251`: current_schema
- `20251130005859`: restructure_master_books_schema
- `20251130165605`: add_subject_denormalized_fields_to_master_books
- `20251130230715`: add_student_content_fields

#### 2025년 12월

- `20251201064437`: add_plan_group_id_to_academy_schedules
- `20251202172406`: add_tenant_status_column
- `20251203132450`: add_content_details_indexes
- `20251203224451`: create_system_settings
- `20251204055022`: remove_semester_from_master_contents
- `20251204205824`: create_recommendation_settings
- `20251208174346`: add_attendance_sms_settings_to_tenants
- `20251208174347`: add_attendance_settings_to_student_notifications
- `20251208180000`: create_attendance_qr_codes_table
- `20251208181201`: add_attendance_sms_recipient_to_tenants
- `20251209000001`: add_student_plan_rls_and_triggers
- `20251209000002`: create_plan_group_items
- `20251209140747`: create_master_custom_contents
- `20251209211447`: add_student_plan_status
- `20251209211500`: create_plan_history_and_reschedule_log
- `20251209212000`: add_version_group_id
- `20251209212530`: create_enum_types
- `20251209212750`: add_tenant_id_to_history
- `20251209212800`: add_history_rls
- `20251209213000`: optimize_reschedule_indexes
- `20251210000000`: optimize_sessions_narrowed_query
- `20251211000000`: create_today_plans_cache
- `20251211000001`: fix_today_plans_cache_rls
- `20251211000002`: simplify_today_plans_cache_unique_constraint
- `20251211190438`: add_attendance_sms_show_failure_to_user
- `20251211192716`: create_attendance_record_history
- `20251212000000`: create_attendance_tables
- `20251212000001`: create_sms_logs_table
- `20251212000002`: remove_student_plan_unique_constraint
- `20251212111311`: add_attendance_records_student_policies
- `20251213000000`: add_students_parents_insert_policy
- `20251213000002`: restore_students_parents_insert_policy
- `20251214000000`: add_auto_approve_settings
- `20251214133504`: create_terms_contents
- `20251214133942`: seed_terms_contents
- `20251215163535`: create_today_plan_view
- `20251216101211`: add_master_lecture_id_to_lectures
- `20251216133753`: add_url_fields_to_master_contents
- `20251216220330`: add_content_table_indexes
- `20251216220331`: ensure_content_table_fk_constraints
- `20251216222517`: create_difficulty_levels
- `20251216222518`: migrate_existing_difficulties
- `20251216222519`: add_difficulty_fk_constraints
- `20251217020000`: allow_null_plan_group_id_in_exclusions
- `20251217160000`: remove_student_plan_unique_constraint_corrected
- `20251218000000`: add_is_active_to_master_lectures
- `20251218000001`: allow_null_plan_group_id_in_academy_schedules
- `20251218000002`: add_review_time_ratio_to_scheduler_settings
- `20251218204001`: add_student_management_indexes
- `20251219025931`: create_student_connection_codes
- `20251219031510`: add_students_insert_admin_policy
- `20251219031511`: improve_student_connection_codes_insert_policy
- `20251219114051`: create_link_student_with_connection_code_function
- `20251219124149`: fix_link_student_with_connection_code_security
- `20251219131000`: add_tenant_id_indexes
- `20251219142008`: add_camp_invitations_insert_policy
- `20251219164405`: add_camp_notification_preferences
- `20251219164759`: add_camp_invitation_expires_at
- `20251219164800`: add_camp_template_reminder_settings
- `20251219164801`: add_camp_indexes
- `20251219181731`: add_difficulty_level_id_to_student_tables
- `20251219192242`: add_student_phone_search_indexes
- `20251221195548`: add_camp_invitations_update_select_policies_fix
- `20251221200303`: add_subject_type_to_plans
- `20251222034907`: add_camp_template_block_sets_rls_policies
- `20251222041824`: add_camp_invitations_update_select_policies

---

## RLS 정책 현황

### RLS 활성화 테이블

대부분의 테이블에 RLS가 활성화되어 있습니다. 주요 패턴:

1. **테넌트 기반 격리**: `tenant_id` 기반 접근 제어
2. **역할 기반 접근**: `admin_users.role` 기반 권한 체크
3. **소유자 기반 접근**: 학생은 자신의 데이터만 조회

### 주요 RLS 정책 패턴

```sql
-- 관리자는 자신의 테넌트 내 모든 데이터 조회 가능
CREATE POLICY "admin_select_own_tenant"
ON table_name FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
    AND admin_users.tenant_id = table_name.tenant_id
    AND admin_users.role IN ('admin', 'consultant')
  )
);

-- 학생은 자신의 데이터만 조회 가능
CREATE POLICY "student_select_own"
ON table_name FOR SELECT
USING (student_id = auth.uid()::uuid);
```

---

## 관계도 (ERD)

### 핵심 관계

```
tenants (1)
  ├── admin_users (1:N)
  ├── students (1:N)
  ├── plan_groups (1:N)
  ├── master_books (1:N)
  └── master_lectures (1:N)

students (1)
  ├── student_plan (1:N)
  ├── books (1:N)
  ├── lectures (1:N)
  ├── student_internal_scores (1:N)
  ├── student_mock_scores (1:N)
  ├── attendance_records (1:N)
  ├── plan_groups (1:N)
  └── student_profiles (1:1)

plan_groups (1)
  ├── plan_group_items (1:N)
  ├── student_plan (1:N)
  ├── plan_contents (1:N)
  ├── plan_exclusions (1:N)
  └── plan_history (1:N)

master_books (1)
  ├── books (1:N, master_content_id)
  ├── book_details (1:N)
  └── master_lectures (1:N, linked_book_id)

subjects (1)
  ├── master_books (1:N)
  ├── master_lectures (1:N)
  ├── student_internal_scores (1:N)
  └── student_mock_scores (1:N)

curriculum_revisions (1)
  ├── subject_groups (1:N)
  ├── subjects (1:N, via subject_groups)
  ├── master_books (1:N)
  └── master_lectures (1:N)
```

---

## 성능 최적화

### 캐싱 전략

1. **today_plans_cache**: 오늘의 플랜 조회 결과 캐싱
   - TTL 기반 만료
   - `student_id`, `plan_date`, `is_camp_mode` 조합으로 캐시 키 생성
   - 21개 행

2. **student_score_analysis_cache**: 성적 분석 결과 캐싱
   - JSONB 형식으로 분석 결과 저장

### 인덱스 최적화

1. **부분 인덱스**: NULL 값 처리
2. **복합 인덱스**: 자주 함께 조회되는 컬럼 조합
3. **조건부 인덱스**: 특정 조건의 데이터만 인덱싱

### Denormalization (비정규화)

성능 최적화를 위해 다음 필드들이 denormalized되어 있습니다:

- `master_books.subject`, `master_books.subject_category`
- `student_plan.content_title`, `student_plan.content_subject`, `student_plan.content_subject_category`, `student_plan.content_category`

---

## 보안 고려사항

1. **RLS 활성화**: 모든 주요 테이블에 RLS 정책 적용
2. **테넌트 격리**: `tenant_id` 기반 데이터 격리
3. **역할 기반 접근**: 관리자, 학생, 부모 역할별 접근 제어
4. **서비스 역할**: 시스템 작업은 `service_role` 사용
5. **민감 정보**: `student_profiles.medical_info` 등은 암호화 고려 필요

---

## 향후 개선 사항

1. **스키마 버전 관리**: 명시적 스키마 버전 관리
2. **마이그레이션 롤백**: 안전한 롤백 전략 수립
3. **성능 모니터링**: 쿼리 성능 모니터링 및 최적화
4. **문서화**: API 문서와 스키마 문서 동기화
5. **데이터 정리**: 사용되지 않는 테이블 정리 (content_masters 등)

---

## 참고 자료

- **마이그레이션 파일**: `supabase/migrations/`
- **설정 파일**: `supabase/config.toml`
- **리셋 가이드**: `supabase/RESET_MIGRATION_STEPS.md`
- **Supabase MCP**: 실제 데이터베이스 스키마 조회에 사용

---

**마지막 업데이트**: 2025-02-02  
**분석 방법**: Supabase MCP를 통한 실제 데이터베이스 조회
