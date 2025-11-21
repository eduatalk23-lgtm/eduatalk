# 현재 스키마 분석 및 필요한 마이그레이션

## 📊 현재 스키마 상태

### ✅ 이미 존재하는 테이블

1. **`student_analysis`** - 존재하지만 구조가 다름
   - 현재 컬럼: `id, student_id, subject, difficulty_requirement, analysis_data, analyzed_at`
   - 필요한 컬럼: `id, student_id, tenant_id, subject, risk_score, recent_grade_trend, consistency_score, mastery_estimate, updated_at, created_at`
   - ⚠️ **구조가 완전히 다름** - 기존 테이블을 수정하거나 새로 생성해야 함

2. **`student_scores`** - 존재하지만 구조가 다름
   - 현재 컬럼: `id, student_id, subject, score_type, score, test_date, created_at, semester, subject_type, course, course_detail, raw_score, grade, score_type_detail`
   - 필요한 컬럼: `id, student_id, tenant_id, subject_type, semester, course, course_detail, raw_score, grade, score_type_detail, test_date, created_at`
   - ⚠️ **`tenant_id` 누락**, 일부 컬럼은 이미 존재

3. **`student_content_progress`** - 존재하고 일부 컬럼도 이미 있음
   - 현재 컬럼: `id, student_id, plan_id (NOT NULL UNIQUE), progress, start_page_or_time, end_page_or_time, last_updated`
   - 필요한 컬럼: `plan_id (nullable), start_page_or_time, end_page_or_time, last_updated`
   - ✅ **필요한 컬럼이 이미 존재하지만 `plan_id`가 NOT NULL UNIQUE** - 수정 필요할 수 있음

4. **`student_daily_schedule`** - 존재하지 않음
   - ❌ **생성 필요**

### ❌ 존재하지 않는 테이블

- `student_daily_schedule` - 생성 필요

### ⚠️ tenant_id 누락 테이블

다음 테이블들에 `tenant_id`가 없음:
- `student_analysis`
- `student_scores`
- `student_study_sessions` (스키마에 없지만 마이그레이션 파일에 있음)
- `student_goals` (스키마에 없지만 마이그레이션 파일에 있음)
- `student_goal_progress` (스키마에 없지만 마이그레이션 파일에 있음)
- `student_history` (스키마에 없지만 마이그레이션 파일에 있음)

## 🔧 필요한 마이그레이션 전략

### 옵션 1: 기존 테이블 수정 (권장)

기존 데이터를 보존하면서 구조를 수정합니다.

### 옵션 2: 테이블 재생성

기존 테이블을 삭제하고 새로 생성합니다. (데이터 손실)

## 📝 수정된 마이그레이션 파일 필요

현재 마이그레이션 파일은 `CREATE TABLE IF NOT EXISTS`를 사용하므로, 기존 테이블이 있으면 아무것도 하지 않습니다. 

기존 테이블을 수정하는 마이그레이션이 필요합니다.

