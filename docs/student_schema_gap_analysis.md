# 학생 기능 데이터 스키마 차이 분석 보고서

## 1. 코드가 사용하는 전체 데이터 의존성

### 1.1 학생 관련 테이블 목록

코드에서 사용하는 학생 관련 테이블:

1. **students** - 학생 기본 정보
2. **student_plan** - 학습 계획
3. **student_block_schedule** - 시간 블록 스케줄
4. **student_daily_schedule** - 일일 스케줄
5. **student_content_progress** - 콘텐츠 진행률
6. **student_study_sessions** - 학습 세션
7. **student_goals** - 학습 목표
8. **student_goal_progress** - 목표 진행률
9. **student_scores** - 통합 성적
10. **student_school_scores** - 내신 성적
11. **student_mock_scores** - 모의고사 성적
12. **student_analysis** - 분석 데이터
13. **student_history** - 학습 히스토리
14. **books** - 책 콘텐츠
15. **lectures** - 강의 콘텐츠
16. **student_custom_contents** - 커스텀 콘텐츠

---

## 2. 테이블별 상세 분석

### 2.1 students 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `name` (text)
- `grade` (text)
- `class` (text)
- `birth_date` (date)
- `tenant_id` (uuid, FK) - 일부 코드에서 사용하지 않음 (deprecated)

**스키마 상태:** ✅ 정상

---

### 2.2 student_plan 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `plan_date` (date)
- `block_index` (integer)
- `content_type` (text: 'book' | 'lecture' | 'custom')
- `content_id` (uuid)
- `chapter` (text, nullable)
- `planned_start_page_or_time` (integer, nullable)
- `planned_end_page_or_time` (integer, nullable)
- `completed_amount` (integer, nullable) - 코드에서 사용하지만 스키마에 없을 수 있음
- `progress` (numeric, nullable) - 코드에서 사용하지만 스키마에 없을 수 있음
- `is_reschedulable` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz, nullable)

**⚠️ 문제점:**
- 초기 CREATE TABLE SQL이 마이그레이션 파일에 없음
- `completed_amount`, `progress` 컬럼이 스키마에 정의되어 있는지 확인 필요

**스키마 상태:** ⚠️ 확인 필요

---

### 2.3 student_block_schedule 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `student_id` (uuid, FK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `day_of_week` (integer: 0-6)
- `start_time` (time)
- `end_time` (time)
- `block_index` (integer)

**⚠️ 문제점:**
- 초기 CREATE TABLE SQL이 마이그레이션 파일에 없음

**스키마 상태:** ⚠️ 확인 필요

---

### 2.4 student_daily_schedule 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `student_id` (uuid, FK)
- `tenant_id` (uuid, FK)
- `schedule_date` (date)
- `block_index` (integer)
- `content_type` (text: 'book' | 'lecture' | 'custom')
- `content_id` (uuid)
- `planned_start` (time, nullable)
- `planned_end` (time, nullable)
- `planned_start_page_or_time` (integer, nullable)
- `planned_end_page_or_time` (integer, nullable)
- `created_at` (timestamptz)

**스키마 상태:** ✅ 20250108000000_create_missing_tables.sql에 정의됨

---

### 2.5 student_content_progress 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `student_id` (uuid, FK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `content_type` (text: 'book' | 'lecture' | 'custom')
- `content_id` (uuid)
- `plan_id` (uuid, nullable, FK)
- `completed_amount` (numeric/integer, nullable)
- `progress` (numeric, nullable)
- `start_page_or_time` (integer, nullable)
- `end_page_or_time` (integer, nullable)
- `last_updated` (timestamptz, nullable)

**스키마 상태:** ✅ 20250108000000_create_missing_tables.sql에 컬럼 추가됨

---

### 2.6 student_study_sessions 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `plan_id` (uuid, nullable, FK)
- `content_type` (text, nullable)
- `content_id` (uuid, nullable)
- `started_at` (timestamptz)
- `ended_at` (timestamptz, nullable)
- `duration_seconds` (integer, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz, nullable)

**스키마 상태:** ✅ 20250102000000_create_study_sessions_table.sql에 정의됨
**⚠️ 주의:** 스키마에 `focus_level`, `note` 컬럼이 있지만 코드에서 사용하지 않음

---

### 2.7 student_goals 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `goal_type` (text: 'range' | 'exam' | 'weekly' | 'monthly')
- `title` (text)
- `description` (text, nullable)
- `subject` (text, nullable)
- `content_id` (uuid, nullable)
- `start_date` (date)
- `end_date` (date)
- `expected_amount` (integer, nullable)
- `target_score` (integer, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz, nullable)

**⚠️ 문제점:**
- 스키마에 `updated_at` 컬럼이 없음

**스키마 상태:** ⚠️ `updated_at` 컬럼 누락

---

### 2.8 student_goal_progress 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `goal_id` (uuid, FK)
- `plan_id` (uuid, nullable, FK)
- `session_id` (uuid, nullable, FK)
- `progress_amount` (integer)
- `created_at` (timestamptz)

**⚠️ 문제점:**
- 스키마에는 `recorded_at` 컬럼이 있지만, 코드에서는 `created_at`을 사용함

**스키마 상태:** ⚠️ 컬럼명 불일치 (`recorded_at` vs `created_at`)

---

### 2.9 student_scores 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `subject_type` (text)
- `semester` (text, nullable)
- `course` (text)
- `course_detail` (text)
- `raw_score` (numeric)
- `grade` (integer: 1-9)
- `score_type_detail` (text, nullable)
- `test_date` (date, nullable)
- `created_at` (timestamptz)

**스키마 상태:** ✅ 20250108000000_create_missing_tables.sql에 정의됨

---

### 2.10 student_school_scores 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `grade` (integer: 1-3)
- `semester` (integer: 1-2)
- `subject_group` (text)
- `subject_type` (text, nullable)
- `subject_name` (text, nullable)
- `raw_score` (numeric, nullable)
- `grade_score` (integer, nullable)
- `class_rank` (integer, nullable)
- `test_date` (date, nullable)
- `created_at` (timestamptz)

**스키마 상태:** ✅ 20250101000000_create_school_and_mock_scores_tables.sql에 정의됨

---

### 2.11 student_mock_scores 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `grade` (integer: 1-3)
- `subject_group` (text)
- `exam_type` (text)
- `subject_name` (text, nullable)
- `raw_score` (numeric, nullable)
- `percentile` (numeric, nullable)
- `grade_score` (integer, nullable)
- `exam_round` (text, nullable)
- `test_date` (date, nullable)
- `created_at` (timestamptz)

**스키마 상태:** ✅ 20250101000000_create_school_and_mock_scores_tables.sql에 정의됨

---

### 2.12 student_analysis 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `student_id` (uuid, FK)
- `tenant_id` (uuid, FK)
- `subject` (text)
- `risk_score` (numeric, nullable)
- `recent_grade_trend` (numeric, nullable)
- `consistency_score` (numeric, nullable)
- `mastery_estimate` (numeric, nullable)
- `updated_at` (timestamptz, nullable)
- `created_at` (timestamptz)

**스키마 상태:** ✅ 20250108000000_create_missing_tables.sql에 정의됨

---

### 2.13 student_history 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `student_id` (uuid, FK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `event_type` (text)
- `detail` (jsonb, nullable)
- `created_at` (timestamptz)

**스키마 상태:** ✅ 20250104000000_create_student_history_table.sql에 정의됨

---

### 2.14 books 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `title` (text)
- `publisher` (text, nullable)
- `difficulty_level` (text, nullable)
- `total_pages` (integer, nullable)
- `subject` (text, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz, nullable)

**⚠️ 문제점:**
- 초기 CREATE TABLE SQL이 마이그레이션 파일에 없음

**스키마 상태:** ⚠️ 확인 필요

---

### 2.15 lectures 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `title` (text)
- `subject` (text, nullable)
- `duration` (integer, nullable) - 분 단위
- `created_at` (timestamptz)
- `updated_at` (timestamptz, nullable)

**⚠️ 문제점:**
- 초기 CREATE TABLE SQL이 마이그레이션 파일에 없음

**스키마 상태:** ⚠️ 확인 필요

---

### 2.16 student_custom_contents 테이블

**코드에서 사용하는 컬럼:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK) - fallback 처리됨
- `student_id` (uuid, FK)
- `title` (text)
- `content_type` (text, nullable)
- `total_page_or_time` (integer, nullable)
- `difficulty_level` (text, nullable)
- `subject` (text, nullable)
- `created_at` (timestamptz)

**⚠️ 문제점:**
- 초기 CREATE TABLE SQL이 마이그레이션 파일에 없음

**스키마 상태:** ⚠️ 확인 필요

---

## 3. 누락된 스키마 항목 요약

### 3.1 테이블 생성이 필요한 항목

다음 테이블들의 초기 CREATE TABLE SQL이 마이그레이션 파일에 없습니다:

1. **student_plan** - 학습 계획 테이블
2. **student_block_schedule** - 블록 스케줄 테이블
3. **books** - 책 콘텐츠 테이블
4. **lectures** - 강의 콘텐츠 테이블
5. **student_custom_contents** - 커스텀 콘텐츠 테이블

### 3.2 컬럼 누락/불일치 항목

1. **student_goals**
   - ❌ `updated_at` 컬럼 누락

2. **student_goal_progress**
   - ⚠️ 컬럼명 불일치: 스키마는 `recorded_at`, 코드는 `created_at` 사용

3. **student_plan**
   - ⚠️ `completed_amount`, `progress` 컬럼 존재 여부 확인 필요

---

## 4. 해결 방안

### 4.1 누락된 테이블 생성 SQL

다음 마이그레이션 파일을 생성해야 합니다:
`supabase/migrations/20250109000000_create_missing_student_tables.sql`

### 4.2 컬럼 추가/수정 SQL

다음 마이그레이션 파일을 생성해야 합니다:
`supabase/migrations/20250109000001_fix_student_schema_columns.sql`

### 4.3 코드 수정이 필요한 항목

1. **student_goal_progress**: `created_at` → `recorded_at`으로 변경하거나, 스키마를 `created_at`으로 변경

---

## 5. 우선순위

### 높음 (즉시 해결 필요)
1. ✅ student_plan 테이블 생성
2. ✅ student_block_schedule 테이블 생성
3. ✅ books, lectures, student_custom_contents 테이블 생성

### 중간 (기능 동작에 영향)
4. ⚠️ student_goals.updated_at 컬럼 추가
5. ⚠️ student_goal_progress 컬럼명 통일

### 낮음 (확인 후 결정)
6. ⚠️ student_plan.completed_amount, progress 컬럼 확인

