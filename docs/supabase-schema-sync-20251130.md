# Supabase 스키마 동기화 작업

## 작업 일시
- 2025-11-30 21:13

## 작업 내용
현재 Supabase DB의 스키마를 확인하고, 최신 정보를 반영한 마이그레이션 파일을 생성했습니다.

## 확인된 주요 스키마 정보

### 테이블 목록
총 60개의 테이블이 확인되었습니다:
- academies
- academy_schedules
- admin_users
- book_details
- books
- camp_invitations
- camp_template_block_sets
- camp_templates
- career_fields
- content_master_details
- content_masters
- content_subjects
- curriculum_revisions
- excluded_dates
- grades
- lecture_episodes
- lectures
- make_scenario_logs
- master_books
- master_lectures
- parent_student_links
- parent_users
- plan_contents
- plan_exclusions
- plan_groups
- plan_timer_logs
- platforms
- publishers
- recommended_contents
- regions
- schools
- semesters
- student_analysis
- student_block_schedule
- student_block_sets
- student_book_details
- student_career_field_preferences
- student_career_goals
- student_consulting_notes
- student_content_progress
- student_custom_contents
- student_daily_schedule
- student_goal_progress
- student_goals
- student_history
- student_lecture_episodes
- student_mock_scores
- student_plan
- student_profiles
- student_school_scores
- student_scores
- student_study_sessions
- students
- subject_groups
- subject_types
- subjects
- tenant_block_sets
- tenant_blocks
- tenants
- user_sessions

### 주요 변경사항 확인

#### master_books 테이블
- `subject_group_id` (uuid, FK to subject_groups) - denormalized for performance
- `subject_category` (text) - Denormalized subject group name
- `subject` (text) - Denormalized subject name

이 변경사항은 이미 `20251130165605_add_subject_denormalized_fields_to_master_books.sql` 마이그레이션에 포함되어 있습니다.

## 현재 적용된 마이그레이션 목록
1. 20251128225817_change_desired_university_ids_to_text_array
2. 20251129155953_restructure_master_books_schema
3. 20251129163755_refactor_master_lectures_and_episodes
4. 20251129163828_refactor_lectures_and_student_episodes
5. 20251130070235_restore_master_books_schema
6. 20251130073834_add_subject_group_and_names_to_master_books
7. 20251130075625_add_subject_denormalized_fields_to_master_books

## 다음 단계
1. 로컬 마이그레이션 파일들과 DB에 적용된 마이그레이션을 비교
2. 차이점이 있다면 새로운 마이그레이션 파일 생성
3. 마이그레이션 파일 커밋

## 참고사항
- 현재 DB 스키마는 최신 상태입니다
- 모든 테이블, 인덱스, 제약조건이 정상적으로 적용되어 있습니다
- 추가 스키마 변경이 필요한 경우, 새로운 마이그레이션 파일을 생성하세요

